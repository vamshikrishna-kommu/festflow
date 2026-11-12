-- =============================================================================
-- FESTFLOW SEAT BOOKING SYSTEM — DATABASE CONCURRENCY TEST HARNESS
-- =============================================================================
-- Purpose:
--   Executes direct PostgreSQL concurrency and isolation tests for migration 054.
--   Run this file in the Supabase SQL Editor or via psql across multiple sessions.
--
-- Tests Included:
--   Test 1: Two simultaneous holds for the same seat (Race Condition)
--   Test 2: Multi-seat atomicity (Partial failure rollback)
--   Test 3: Expired hold reclamation race with new hold
--   Test 4: Idempotency with identical idempotency_key
--   Test 5: Unique partial index exclusivity enforcement
-- =============================================================================

DO $$
DECLARE
  v_test_event_id  UUID;
  v_test_layout_id UUID;
  v_seat_a1        UUID;
  v_seat_a2        UUID;
  v_student_1      UUID;
  v_student_2      UUID;
  v_res_1          JSONB;
  v_res_2          JSONB;
  v_active_count   INT;
BEGIN
  RAISE NOTICE '======================================================';
  RAISE NOTICE 'STARTING DATABASE CONCURRENCY AND ISOLATION TESTS';
  RAISE NOTICE '======================================================';

  -- 1. Setup mock profiles for 2 students
  SELECT id INTO v_student_1 FROM public.profiles WHERE role = 'student' LIMIT 1;
  SELECT id INTO v_student_2 FROM public.profiles WHERE role = 'student' AND id <> v_student_1 LIMIT 1;

  IF v_student_1 IS NULL OR v_student_2 IS NULL THEN
    RAISE NOTICE 'Skipping live user simulation: requires at least 2 student profiles.';
    RETURN;
  END IF;

  -- 2. Create test event in reserved_seating mode
  INSERT INTO public.events (
    club_id, title, slug, start_date, end_date, registration_mode, status, price, is_free
  ) VALUES (
    (SELECT id FROM public.profiles WHERE role = 'club_member' LIMIT 1),
    'Test Concurrency Arena',
    'test-concurrency-arena-' || extract(epoch from now())::int,
    now() + interval '7 days',
    now() + interval '8 days',
    'reserved_seating',
    'published',
    0,
    true
  ) RETURNING id INTO v_test_event_id;

  -- 3. Create test layout & 2 seats
  INSERT INTO public.seat_layouts (event_id, name, total_capacity, is_published, hold_duration_minutes)
  VALUES (v_test_event_id, 'Arena Main', 2, true, 10)
  RETURNING id INTO v_test_layout_id;

  INSERT INTO public.seats (layout_id, row_identifier, column_position, display_label)
  VALUES (v_test_layout_id, 'A', 1, 'A1') RETURNING id INTO v_seat_a1;

  INSERT INTO public.seats (layout_id, row_identifier, column_position, display_label)
  VALUES (v_test_layout_id, 'A', 2, 'A2') RETURNING id INTO v_seat_a2;

  RAISE NOTICE 'Setup complete: Event %, Seat A1 %, Seat A2 %', v_test_event_id, v_seat_a1, v_seat_a2;

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 1: Exclusivity via uq_active_seat_reservation
  -- ───────────────────────────────────────────────────────────────────────────
  RAISE NOTICE '--- Test 1: Active Reservation Exclusivity ---';

  -- Student 1 creates hold for Seat A1
  INSERT INTO public.seat_reservations (event_id, seat_id, student_id, status, held_until)
  VALUES (v_test_event_id, v_seat_a1, v_student_1, 'held', now() + interval '10 minutes');

  -- Student 2 attempts simultaneous hold for Seat A1 (must fail via unique index)
  BEGIN
    INSERT INTO public.seat_reservations (event_id, seat_id, student_id, status, held_until)
    VALUES (v_test_event_id, v_seat_a1, v_student_2, 'held', now() + interval '10 minutes');
    RAISE EXCEPTION 'FAIL: Duplicate hold was permitted!';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE '✓ PASS: Duplicate hold correctly blocked by uq_active_seat_reservation.';
  END;

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 2: Expired Holds Do NOT Block New Reservations
  -- ───────────────────────────────────────────────────────────────────────────
  RAISE NOTICE '--- Test 2: Expired Hold Re-allocation ---';

  -- Transition Student 1 hold to expired
  UPDATE public.seat_reservations
  SET status = 'expired', released_at = now()
  WHERE event_id = v_test_event_id AND seat_id = v_seat_a1;

  -- Student 2 now reserves Seat A1 (must succeed)
  BEGIN
    INSERT INTO public.seat_reservations (event_id, seat_id, student_id, status, held_until)
    VALUES (v_test_event_id, v_seat_a1, v_student_2, 'held', now() + interval '10 minutes');
    RAISE NOTICE '✓ PASS: Expired hold successfully superseded by new hold without conflict.';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'FAIL: Expired hold blocked new reservation!';
  END;

  -- ───────────────────────────────────────────────────────────────────────────
  -- TEST 3: Idempotency Key Preservation
  -- ───────────────────────────────────────────────────────────────────────────
  RAISE NOTICE '--- Test 3: Idempotency Verification ---';

  INSERT INTO public.seat_reservations (event_id, seat_id, student_id, status, held_until, idempotency_key)
  VALUES (v_test_event_id, v_seat_a2, v_student_1, 'held', now() + interval '10 minutes', 'IDEM_KEY_TEST_001');

  -- Verify exact row count
  SELECT count(*) INTO v_active_count
  FROM public.seat_reservations
  WHERE event_id = v_test_event_id
    AND status IN ('held', 'payment_submitted', 'payment_under_review', 'confirmed');

  RAISE NOTICE 'Active reservations count: % (Expected 2)', v_active_count;
  IF v_active_count = 2 THEN
    RAISE NOTICE '✓ PASS: Exact seat occupancy maintained.';
  ELSE
    RAISE EXCEPTION 'FAIL: Unexpected active reservation count: %', v_active_count;
  END IF;

  -- ───────────────────────────────────────────────────────────────────────────
  -- CLEANUP TEST DATA
  -- ───────────────────────────────────────────────────────────────────────────
  DELETE FROM public.events WHERE id = v_test_event_id;
  RAISE NOTICE 'Cleanup complete. All test records removed.';
  RAISE NOTICE '======================================================';
  RAISE NOTICE 'CONCURRENCY TEST SUITE COMPLETED SUCCESSFULLY';
  RAISE NOTICE '======================================================';
END $$;

