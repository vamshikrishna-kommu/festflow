-- =============================================================================
-- FestFlow — Migration 059: Show Seat Availability Toggle for Organizers
-- Allows club organizers to toggle whether seat counting ("N left of M")
-- is visible to public participants/students or hidden.
-- =============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS show_seat_availability BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.events.show_seat_availability IS
  'When true, live remaining seat counting and capacity progress are displayed to participants. When false, the counting is completely hidden from public users.';

-- =============================================================================
-- Authoritative RPC: get_event_seat_counts
-- Bypasses student-isolation RLS to return accurate real-time seat availability
-- for both standard and cinema reserved seating events.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_event_seat_counts(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity integer := 100;
  v_reg_mode text := 'standard';
  v_show_seats boolean := true;
  v_occupied integer := 0;
  v_total integer := 100;
  v_remaining integer := 100;
BEGIN
  SELECT
    COALESCE(capacity, 100),
    COALESCE(registration_mode, 'standard'),
    COALESCE(show_seat_availability, true)
  INTO v_capacity, v_reg_mode, v_show_seats
  FROM public.events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('total', 100, 'occupied', 0, 'remaining', 100, 'show_seat_availability', true);
  END IF;

  IF v_reg_mode = 'reserved_seating' THEN
    -- Get total published unblocked seats
    SELECT COUNT(*) INTO v_total
    FROM public.seats s
    JOIN public.seat_layouts sl ON sl.id = s.layout_id AND sl.event_id = p_event_id AND sl.is_published = true
    WHERE s.is_aisle_gap = false AND s.is_blocked = false;

    IF v_total = 0 THEN
      v_total := v_capacity;
    END IF;

    -- Expire stale holds if helper function exists
    BEGIN
      PERFORM public.reclaim_expired_seat_holds(p_event_id);
    EXCEPTION WHEN OTHERS THEN
      -- ignore if function not available
    END;

    -- Count active holds & confirmed reservations
    SELECT COUNT(*) INTO v_occupied
    FROM public.seat_reservations
    WHERE event_id = p_event_id
      AND status IN ('held', 'payment_submitted', 'payment_under_review', 'confirmed')
      AND (status != 'held' OR held_until IS NULL OR held_until > now());

  ELSE
    v_total := v_capacity;

    SELECT COUNT(*) INTO v_occupied
    FROM public.registrations
    WHERE event_id = p_event_id
      AND status IN ('confirmed', 'pending_approval', 'pending_payment');
  END IF;

  v_remaining := GREATEST(0, v_total - v_occupied);

  RETURN jsonb_build_object(
    'total', v_total,
    'occupied', v_occupied,
    'remaining', v_remaining,
    'show_seat_availability', v_show_seats
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_seat_counts(uuid) TO anon, authenticated, service_role;
