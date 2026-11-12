-- Migration 054: Cinema-style interactive seat booking system
-- Created: 2026-11-12
-- Adds optional reserved seating to FestFlow events.
-- Existing events unaffected (registration_mode defaults to 'standard').
-- Do NOT run against production without review.

-- =============================================================================
-- FestFlow — Migration 054: Cinema-style Seat Booking System
-- =============================================================================
-- Adds optional reserved seating to FestFlow events:
-- 1. seat_layouts      — per-event layout config (hold timer, capacity, stage pos)
-- 2. seat_categories   — named, priced, coloured seat tiers within a layout
-- 3. seats             — individual seat rows/columns with aisle gap support
-- 4. seat_reservations — time-limited holds → confirmed on payment approval
-- 5. seat_layout_audit — append-only audit trail for layout changes
-- 6. events.registration_mode       — 'standard' | 'reserved_seating'
-- 7. registrations.seat_reservation_id — back-link to confirmed reservation
-- RPCs:
--   reserve_event_seats                  — atomic, deadlock-safe seat hold
--   reclaim_expired_seat_holds           — expire stale holds (cron-safe)
--   release_seat_hold                    — user releases their own hold
--   get_seat_availability                — full seat map with live status
--   confirm_seat_reservations_on_payment — called by payment approval flow
-- RLS: students see own reservations; organizers manage via has_event_permission
-- =============================================================================


-- ─── 1. Tables ───────────────────────────────────────────────────────────────

-- 1a. seat_layouts
CREATE TABLE IF NOT EXISTS public.seat_layouts (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                  UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name                      TEXT        NOT NULL DEFAULT 'Main Hall',
  venue_description         TEXT,
  total_capacity            INT         NOT NULL DEFAULT 0,
  hold_duration_minutes     INT         NOT NULL DEFAULT 10
    CHECK (hold_duration_minutes BETWEEN 5 AND 60),
  max_seats_per_registration INT        NOT NULL DEFAULT 1
    CHECK (max_seats_per_registration BETWEEN 1 AND 20),
  allow_multi_seat          BOOLEAN     NOT NULL DEFAULT false,
  stage_position            TEXT        NOT NULL DEFAULT 'front'
    CHECK (stage_position IN ('front', 'back', 'left', 'right')),
  is_published              BOOLEAN     NOT NULL DEFAULT false,
  version                   INT         NOT NULL DEFAULT 1,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_seat_layout_event UNIQUE (event_id)
);

-- 1b. seat_categories
CREATE TABLE IF NOT EXISTS public.seat_categories (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id   UUID         NOT NULL REFERENCES public.seat_layouts(id) ON DELETE CASCADE,
  name        TEXT         NOT NULL,
  color       TEXT         NOT NULL DEFAULT '#18CFFC',
  price       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  description TEXT,
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 1c. seats
CREATE TABLE IF NOT EXISTS public.seats (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id       UUID        NOT NULL REFERENCES public.seat_layouts(id) ON DELETE CASCADE,
  category_id     UUID        REFERENCES public.seat_categories(id) ON DELETE SET NULL,
  row_identifier  TEXT        NOT NULL,
  column_position INT         NOT NULL,
  display_label   TEXT        NOT NULL,
  section         TEXT,
  is_blocked      BOOLEAN     NOT NULL DEFAULT false,
  is_accessible   BOOLEAN     NOT NULL DEFAULT false,
  is_aisle_gap    BOOLEAN     NOT NULL DEFAULT false,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_seat_layout_position UNIQUE (layout_id, row_identifier, column_position)
);

-- Partial unique index for display labels — aisle gaps are excluded (they share synthetic labels)
CREATE UNIQUE INDEX IF NOT EXISTS uq_seat_layout_label
  ON public.seats (layout_id, display_label)
  WHERE NOT is_aisle_gap;

-- 1d. seat_reservations
CREATE TABLE IF NOT EXISTS public.seat_reservations (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  seat_id               UUID        NOT NULL REFERENCES public.seats(id) ON DELETE RESTRICT,
  registration_id       UUID        REFERENCES public.registrations(id) ON DELETE SET NULL,
  student_id            UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status                TEXT        NOT NULL DEFAULT 'held'
    CHECK (status IN ('held', 'payment_submitted', 'payment_under_review', 'confirmed', 'cancelled', 'expired', 'released')),
  held_until            TIMESTAMPTZ,
  confirmed_at          TIMESTAMPTZ,
  released_at           TIMESTAMPTZ,
  payment_submission_id UUID        REFERENCES public.payment_submissions(id) ON DELETE SET NULL,
  idempotency_key       TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- THE critical partial unique index — enforces one active reservation per seat per event
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_seat_reservation
  ON public.seat_reservations (event_id, seat_id)
  WHERE status IN ('held', 'payment_submitted', 'payment_under_review', 'confirmed');

-- 1e. seat_layout_audit
CREATE TABLE IF NOT EXISTS public.seat_layout_audit (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id      UUID        NOT NULL REFERENCES public.seat_layouts(id) ON DELETE CASCADE,
  actor_id       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  action         TEXT        NOT NULL,
  change_summary JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ─── 2. Column additions to existing tables ───────────────────────────────────

-- Add registration_mode to events (existing events get 'standard' default — no data disruption)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS registration_mode TEXT NOT NULL DEFAULT 'standard'
  CHECK (registration_mode IN ('standard', 'reserved_seating'));

-- Add seat_reservation_id back-link to registrations
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS seat_reservation_id UUID
  REFERENCES public.seat_reservations(id) ON DELETE SET NULL;


-- ─── 3. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_seat_reservations_event_status
  ON public.seat_reservations (event_id, status);

CREATE INDEX IF NOT EXISTS idx_seat_reservations_student
  ON public.seat_reservations (student_id, event_id);

CREATE INDEX IF NOT EXISTS idx_seat_reservations_held_until
  ON public.seat_reservations (held_until)
  WHERE status = 'held';

CREATE INDEX IF NOT EXISTS idx_seats_layout
  ON public.seats (layout_id, row_identifier, column_position);

CREATE INDEX IF NOT EXISTS idx_seat_layout_audit_layout
  ON public.seat_layout_audit (layout_id, created_at DESC);


-- ─── 4. updated_at triggers ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_seat_reservations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seat_reservations_updated_at ON public.seat_reservations;
CREATE TRIGGER trg_seat_reservations_updated_at
  BEFORE UPDATE ON public.seat_reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_seat_reservations_updated_at();

CREATE OR REPLACE FUNCTION public.update_seat_layouts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seat_layouts_updated_at ON public.seat_layouts;
CREATE TRIGGER trg_seat_layouts_updated_at
  BEFORE UPDATE ON public.seat_layouts
  FOR EACH ROW EXECUTE FUNCTION public.update_seat_layouts_updated_at();


-- ─── 5. RPC: reserve_event_seats ─────────────────────────────────────────────
-- Atomic, deadlock-safe seat hold. Locks rows in deterministic UUID order.
-- Returns JSONB with success flag, reservation IDs, held_until, pricing breakdown.

CREATE OR REPLACE FUNCTION public.reserve_event_seats(
  p_event_id        UUID,
  p_seat_ids        UUID[],
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id      UUID;
  v_event           RECORD;
  v_layout          RECORD;
  v_seat            RECORD;
  v_seat_ids_sorted UUID[];
  v_held_until      TIMESTAMPTZ;
  v_reservation_ids UUID[];
  v_reservation_id  UUID;
  v_prices          JSONB    := '[]'::JSONB;
  v_total_price     NUMERIC  := 0;
  v_seat_count      INT;
  v_existing_hold   RECORD;
BEGIN
  -- Auth check
  v_student_id := auth.uid();
  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object(
      'success',    false,
      'error_code', 'NOT_AUTHENTICATED',
      'message',    'You must be logged in to reserve seats.'
    );
  END IF;

  -- Idempotency check: return success if same key already produced a held reservation
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_hold
    FROM public.seat_reservations
    WHERE student_id      = v_student_id
      AND idempotency_key = p_idempotency_key
      AND status          = 'held'
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success',    true,
        'idempotent', true,
        'message',    'Existing hold returned.'
      );
    END IF;
  END IF;

  -- Validate input array
  v_seat_count := array_length(p_seat_ids, 1);
  IF v_seat_count IS NULL OR v_seat_count = 0 THEN
    RETURN jsonb_build_object(
      'success',    false,
      'error_code', 'NO_SEATS',
      'message',    'No seats selected.'
    );
  END IF;

  -- Load & validate event
  SELECT id, status, registration_mode, club_id, capacity
  INTO v_event
  FROM public.events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success',    false,
      'error_code', 'EVENT_NOT_FOUND',
      'message',    'Event not found.'
    );
  END IF;

  IF v_event.status NOT IN ('published', 'registration_closed') THEN
    RETURN jsonb_build_object(
      'success',    false,
      'error_code', 'EVENT_NOT_OPEN',
      'message',    'Event is not accepting reservations.'
    );
  END IF;

  IF v_event.registration_mode != 'reserved_seating' THEN
    RETURN jsonb_build_object(
      'success',    false,
      'error_code', 'NOT_RESERVED_SEATING',
      'message',    'This event does not use reserved seating.'
    );
  END IF;

  -- Load published layout
  SELECT id, hold_duration_minutes, max_seats_per_registration, allow_multi_seat
  INTO v_layout
  FROM public.seat_layouts
  WHERE event_id = p_event_id AND is_published = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success',    false,
      'error_code', 'NO_LAYOUT',
      'message',    'No published seat layout found for this event.'
    );
  END IF;

  -- Enforce per-registration seat limit
  IF v_seat_count > v_layout.max_seats_per_registration THEN
    RETURN jsonb_build_object(
      'success',    false,
      'error_code', 'TOO_MANY_SEATS',
      'message',    format('You can select at most %s seat(s).', v_layout.max_seats_per_registration)
    );
  END IF;

  -- Check student doesn't already hold/confirm seats for this event
  IF EXISTS (
    SELECT 1 FROM public.seat_reservations
    WHERE event_id   = p_event_id
      AND student_id = v_student_id
      AND status IN ('held', 'payment_submitted', 'payment_under_review', 'confirmed')
  ) THEN
    RETURN jsonb_build_object(
      'success',    false,
      'error_code', 'ALREADY_HAS_RESERVATION',
      'message',    'You already have an active reservation for this event.'
    );
  END IF;

  -- Reclaim expired holds first (non-locking sweep — safe to do before we lock)
  UPDATE public.seat_reservations
  SET    status      = 'expired',
         released_at = now()
  WHERE  status     = 'held'
    AND  held_until < now()
    AND  event_id   = p_event_id;

  -- Sort seat IDs for deterministic lock ordering (prevents deadlocks under concurrent requests)
  SELECT ARRAY(SELECT unnest(p_seat_ids) ORDER BY 1) INTO v_seat_ids_sorted;

  -- Initialise output accumulators
  v_reservation_ids := ARRAY[]::UUID[];
  v_held_until      := now() + (v_layout.hold_duration_minutes || ' minutes')::INTERVAL;

  -- Pass 1: Lock and validate ALL requested seats before performing any inserts
  -- This guarantees strict atomicity: if ANY seat fails, ZERO seats are inserted.
  FOR v_seat IN
    SELECT s.id,
           s.display_label,
           s.is_blocked,
           s.is_aisle_gap,
           s.layout_id,
           s.category_id,
           sc.price,
           sc.name  AS category_name,
           sc.color
    FROM        public.seats s
    LEFT JOIN   public.seat_categories sc ON sc.id = s.category_id
    WHERE  s.id = ANY(v_seat_ids_sorted)
      AND  s.layout_id = v_layout.id
    ORDER BY s.id   -- deterministic lock order (deadlock-free)
    FOR UPDATE OF s
  LOOP
    -- Reject aisle gaps
    IF v_seat.is_aisle_gap THEN
      RETURN jsonb_build_object(
        'success',    false,
        'error_code', 'INVALID_SEAT',
        'message',    format('Seat %s is an aisle gap and cannot be reserved.', v_seat.display_label)
      );
    END IF;

    -- Reject blocked seats
    IF v_seat.is_blocked THEN
      RETURN jsonb_build_object(
        'success',    false,
        'error_code', 'SEAT_BLOCKED',
        'message',    format('Seat %s is not available.', v_seat.display_label)
      );
    END IF;

    -- Friendly conflict check (the partial unique index enforces this at DB level too)
    IF EXISTS (
      SELECT 1 FROM public.seat_reservations
      WHERE  seat_id  = v_seat.id
        AND  event_id = p_event_id
        AND  status IN ('held', 'payment_submitted', 'payment_under_review', 'confirmed')
    ) THEN
      RETURN jsonb_build_object(
        'success',    false,
        'error_code', 'SEAT_TAKEN',
        'message',    format('Seat %s was just taken by another user. Please choose a different seat.', v_seat.display_label)
      );
    END IF;
  END LOOP;

  -- Pass 2: All seats are verified available and locked. Perform inserts atomically.
  FOR v_seat IN
    SELECT s.id,
           s.display_label,
           sc.price,
           sc.name  AS category_name,
           sc.color
    FROM        public.seats s
    LEFT JOIN   public.seat_categories sc ON sc.id = s.category_id
    WHERE  s.id = ANY(v_seat_ids_sorted)
      AND  s.layout_id = v_layout.id
    ORDER BY s.id
  LOOP
    -- Insert the hold
    INSERT INTO public.seat_reservations (
      event_id, seat_id, student_id, status, held_until, idempotency_key
    ) VALUES (
      p_event_id, v_seat.id, v_student_id, 'held', v_held_until, p_idempotency_key
    )
    RETURNING id INTO v_reservation_id;

    v_reservation_ids := array_append(v_reservation_ids, v_reservation_id);

    -- Accumulate per-seat pricing info
    v_prices := v_prices || jsonb_build_object(
      'seat_id',       v_seat.id,
      'display_label', v_seat.display_label,
      'category_name', COALESCE(v_seat.category_name, 'Standard'),
      'category_color', COALESCE(v_seat.color, '#18CFFC'),
      'price',         COALESCE(v_seat.price, 0)
    );
    v_total_price := v_total_price + COALESCE(v_seat.price, 0);
  END LOOP;

  -- Guard: all requested seats must have been found in this layout
  IF array_length(v_reservation_ids, 1) != v_seat_count THEN
    RAISE EXCEPTION 'Some seats do not belong to this event layout.';
  END IF;

  RETURN jsonb_build_object(
    'success',         true,
    'reservation_ids', to_jsonb(v_reservation_ids),
    'held_until',      v_held_until,
    'total_price',     v_total_price,
    'seats',           v_prices
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success',    false,
      'error_code', 'SEAT_TAKEN',
      'message',    'One or more selected seats were just taken. Please try again.'
    );
  WHEN OTHERS THEN
    RAISE;
END;
$$;


-- ─── 6. RPC: reclaim_expired_seat_holds ──────────────────────────────────────
-- Safe to call from a cron job or before any seat-map render.
-- Optionally scoped to a single event; NULL = global sweep.

CREATE OR REPLACE FUNCTION public.reclaim_expired_seat_holds(
  p_event_id UUID DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE public.seat_reservations
  SET    status      = 'expired',
         released_at = now(),
         updated_at  = now()
  WHERE  status     = 'held'
    AND  held_until < now()
    AND  (p_event_id IS NULL OR event_id = p_event_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ─── 7. RPC: release_seat_hold ────────────────────────────────────────────────
-- Allows a student to voluntarily release their own held seats before checkout.

CREATE OR REPLACE FUNCTION public.release_seat_hold(
  p_reservation_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_count      INT;
BEGIN
  v_student_id := auth.uid();
  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object(
      'success',    false,
      'error_code', 'NOT_AUTHENTICATED'
    );
  END IF;

  UPDATE public.seat_reservations
  SET    status      = 'released',
         released_at = now(),
         updated_at  = now()
  WHERE  id = ANY(p_reservation_ids)
    AND  student_id = v_student_id
    AND  status     = 'held';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'released_count', v_count);
END;
$$;


-- ─── 8. RPC: get_seat_availability ───────────────────────────────────────────
-- Returns the full seat map with live status for the published layout of an event.
-- Reclaims expired holds inline so callers always see fresh availability.

CREATE OR REPLACE FUNCTION public.get_seat_availability(
  p_event_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Expire stale holds before building the map
  PERFORM public.reclaim_expired_seat_holds(p_event_id);

  SELECT jsonb_agg(
    jsonb_build_object(
      'seat_id',         s.id,
      'display_label',   s.display_label,
      'row_identifier',  s.row_identifier,
      'column_position', s.column_position,
      'section',         s.section,
      'is_blocked',      s.is_blocked,
      'is_accessible',   s.is_accessible,
      'is_aisle_gap',    s.is_aisle_gap,
      'category_id',     s.category_id,
      'status',
        CASE
          WHEN s.is_aisle_gap THEN 'aisle_gap'
          WHEN s.is_blocked   THEN 'blocked'
          WHEN sr.id IS NOT NULL THEN sr.status
          ELSE 'available'
        END,
      'held_until', sr.held_until,
      'is_mine',    (sr.student_id = auth.uid())
    )
  )
  INTO v_result
  FROM        public.seats s
  JOIN        public.seat_layouts sl
                ON  sl.id         = s.layout_id
                AND sl.event_id   = p_event_id
                AND sl.is_published = true
  LEFT JOIN   public.seat_reservations sr
                ON  sr.seat_id  = s.id
                AND sr.event_id = p_event_id
                AND sr.status IN ('held', 'payment_submitted', 'payment_under_review', 'confirmed');

  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;


-- ─── 9. RPC: confirm_seat_reservations_on_payment ────────────────────────────
-- Called by the payment-approval flow after a payment submission is approved.
-- Transitions held/under-review reservations to 'confirmed' and links them
-- to the registration and payment submission records.

CREATE OR REPLACE FUNCTION public.confirm_seat_reservations_on_payment(
  p_registration_id       UUID,
  p_payment_submission_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.seat_reservations sr
  SET    status                = 'confirmed',
         confirmed_at          = now(),
         registration_id       = p_registration_id,
         payment_submission_id = p_payment_submission_id,
         updated_at            = now()
  WHERE  sr.student_id = (SELECT student_id FROM public.registrations WHERE id = p_registration_id)
    AND  sr.event_id   = (SELECT event_id   FROM public.registrations WHERE id = p_registration_id)
    AND  sr.status IN ('payment_submitted', 'payment_under_review');
END;
$$;


-- ─── 10. Row-Level Security ───────────────────────────────────────────────────

ALTER TABLE public.seat_layouts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seat_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seats             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seat_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seat_layout_audit ENABLE ROW LEVEL SECURITY;

-- ── seat_layouts ──────────────────────────────────────────────────────────────

-- Drop before recreate to stay idempotent
DROP POLICY IF EXISTS "Anyone can view published seat layouts" ON public.seat_layouts;
CREATE POLICY "Anyone can view published seat layouts"
  ON public.seat_layouts FOR SELECT
  USING (
    is_published = true
    OR public.has_event_permission(
         auth.uid(),
         (SELECT club_id FROM public.events WHERE id = event_id),
         event_id,
         'events.edit'
       )
  );

DROP POLICY IF EXISTS "Organizers can manage seat layouts" ON public.seat_layouts;
CREATE POLICY "Organizers can manage seat layouts"
  ON public.seat_layouts FOR ALL
  USING (
    public.has_event_permission(
      auth.uid(),
      (SELECT club_id FROM public.events WHERE id = event_id),
      event_id,
      'events.edit'
    )
  )
  WITH CHECK (
    public.has_event_permission(
      auth.uid(),
      (SELECT club_id FROM public.events WHERE id = event_id),
      event_id,
      'events.edit'
    )
  );

-- ── seat_categories ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone can view seat categories" ON public.seat_categories;
CREATE POLICY "Anyone can view seat categories"
  ON public.seat_categories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.seat_layouts sl
      WHERE sl.id = layout_id
        AND (
          sl.is_published = true
          OR public.has_event_permission(
               auth.uid(),
               (SELECT club_id FROM public.events WHERE id = sl.event_id),
               sl.event_id,
               'events.edit'
             )
        )
    )
  );

DROP POLICY IF EXISTS "Organizers can manage seat categories" ON public.seat_categories;
CREATE POLICY "Organizers can manage seat categories"
  ON public.seat_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM  public.seat_layouts sl
      JOIN  public.events e ON e.id = sl.event_id
      WHERE sl.id = layout_id
        AND public.has_event_permission(auth.uid(), e.club_id, e.id, 'events.edit')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM  public.seat_layouts sl
      JOIN  public.events e ON e.id = sl.event_id
      WHERE sl.id = layout_id
        AND public.has_event_permission(auth.uid(), e.club_id, e.id, 'events.edit')
    )
  );

-- ── seats ─────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone can view seats for published layouts" ON public.seats;
CREATE POLICY "Anyone can view seats for published layouts"
  ON public.seats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.seat_layouts sl
      WHERE sl.id = layout_id
        AND (
          sl.is_published = true
          OR public.has_event_permission(
               auth.uid(),
               (SELECT club_id FROM public.events WHERE id = sl.event_id),
               sl.event_id,
               'events.edit'
             )
        )
    )
  );

DROP POLICY IF EXISTS "Organizers can manage seats" ON public.seats;
CREATE POLICY "Organizers can manage seats"
  ON public.seats FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM  public.seat_layouts sl
      JOIN  public.events e ON e.id = sl.event_id
      WHERE sl.id = layout_id
        AND public.has_event_permission(auth.uid(), e.club_id, e.id, 'events.edit')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM  public.seat_layouts sl
      JOIN  public.events e ON e.id = sl.event_id
      WHERE sl.id = layout_id
        AND public.has_event_permission(auth.uid(), e.club_id, e.id, 'events.edit')
    )
  );

-- ── seat_reservations ─────────────────────────────────────────────────────────

-- Students see their own reservations; organizers see all for their events
DROP POLICY IF EXISTS "Students can view own seat reservations" ON public.seat_reservations;
CREATE POLICY "Students can view own seat reservations"
  ON public.seat_reservations FOR SELECT
  USING (
    student_id = auth.uid()
    OR public.has_event_permission(
         auth.uid(),
         (SELECT club_id FROM public.events WHERE id = event_id),
         event_id,
         'registrations.view'
       )
  );

-- No direct INSERT from frontend — only via SECURITY DEFINER RPC reserve_event_seats
-- Organizers can UPDATE reservation status (e.g. block/unblock operations)
DROP POLICY IF EXISTS "Organizers can manage seat reservations" ON public.seat_reservations;
CREATE POLICY "Organizers can manage seat reservations"
  ON public.seat_reservations FOR UPDATE
  USING (
    public.has_event_permission(
      auth.uid(),
      (SELECT club_id FROM public.events WHERE id = event_id),
      event_id,
      'registrations.manage'
    )
  );

-- ── seat_layout_audit ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Organizers can view seat layout audit" ON public.seat_layout_audit;
CREATE POLICY "Organizers can view seat layout audit"
  ON public.seat_layout_audit FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM  public.seat_layouts sl
      JOIN  public.events e ON e.id = sl.event_id
      WHERE sl.id = layout_id
        AND public.has_event_permission(auth.uid(), e.club_id, e.id, 'events.view')
    )
  );


-- ─── 11. Grants ───────────────────────────────────────────────────────────────

GRANT USAGE ON SCHEMA public TO authenticated;

-- authenticated role — table-level grants (RLS enforces row-level access)
GRANT SELECT, INSERT, UPDATE        ON public.seat_layouts      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seat_categories  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seats            TO authenticated;
GRANT SELECT                         ON public.seat_reservations TO authenticated;
GRANT UPDATE                         ON public.seat_reservations TO authenticated;
GRANT SELECT, INSERT                 ON public.seat_layout_audit TO authenticated;

-- service_role bypasses RLS — full access for backend / edge functions
GRANT ALL ON public.seat_layouts      TO service_role;
GRANT ALL ON public.seat_categories   TO service_role;
GRANT ALL ON public.seats             TO service_role;
GRANT ALL ON public.seat_reservations TO service_role;
GRANT ALL ON public.seat_layout_audit TO service_role;


-- ─── 12. Realtime replication ─────────────────────────────────────────────────

-- Enable Realtime replication for seat_reservations so the seat map updates live
ALTER PUBLICATION supabase_realtime ADD TABLE public.seat_reservations;


-- ─── 13. Automatic Payment Lifecycle Synchronization Triggers ────────────────
-- Automatically bridges the manual UPI payment workflow with seat reservations:
-- 1. When payment proof is submitted (payment_submissions INSERT):
--    transitions 'held' seats to 'payment_submitted', links submission & registration,
--    and extends held_until by 48 hours for organizer review.
-- 2. When payment submission is reviewed (payment_submissions UPDATE status):
--    - 'approved': transitions seats to 'confirmed'
--    - 'rejected': releases the seats ('released') so other students can immediately book them.

CREATE OR REPLACE FUNCTION public.sync_seat_on_payment_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger for newly submitted payments pending review
  IF NEW.status = 'pending_review' THEN
    -- Match by registration_id, back-linked seat_reservation_id, or active hold for student & event
    UPDATE public.seat_reservations
    SET    status                = 'payment_submitted',
           payment_submission_id = NEW.id,
           registration_id       = NEW.registration_id,
           held_until            = now() + INTERVAL '48 hours',
           updated_at            = now()
    WHERE  status IN ('held', 'payment_submitted')
      AND  (
        registration_id = NEW.registration_id
        OR id = (SELECT seat_reservation_id FROM public.registrations WHERE id = NEW.registration_id)
        OR (student_id = NEW.student_id AND event_id = NEW.event_id AND status = 'held')
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_seat_on_payment_submission ON public.payment_submissions;
CREATE TRIGGER trg_sync_seat_on_payment_submission
  AFTER INSERT ON public.payment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_seat_on_payment_submission();


CREATE OR REPLACE FUNCTION public.sync_seat_on_payment_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When payment is approved, confirm associated seat reservations
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.seat_reservations
    SET    status                = 'confirmed',
           confirmed_at          = now(),
           payment_submission_id = NEW.id,
           registration_id       = COALESCE(registration_id, NEW.registration_id),
           updated_at            = now()
    WHERE  (
        payment_submission_id = NEW.id
        OR registration_id = NEW.registration_id
        OR id = (SELECT seat_reservation_id FROM public.registrations WHERE id = NEW.registration_id)
        OR (student_id = NEW.student_id AND event_id = NEW.event_id AND status IN ('held', 'payment_submitted', 'payment_under_review'))
      )
      AND  status IN ('held', 'payment_submitted', 'payment_under_review');

  -- When payment is rejected, release seats back into the available pool
  ELSIF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    UPDATE public.seat_reservations
    SET    status                = 'released',
           released_at           = now(),
           notes                 = COALESCE(notes, '') || ' [Payment rejected: ' || COALESCE(NEW.review_notes, 'No reason provided') || ']',
           updated_at            = now()
    WHERE  (
        payment_submission_id = NEW.id
        OR registration_id = NEW.registration_id
        OR id = (SELECT seat_reservation_id FROM public.registrations WHERE id = NEW.registration_id)
        OR (student_id = NEW.student_id AND event_id = NEW.event_id AND status IN ('held', 'payment_submitted', 'payment_under_review'))
      )
      AND  status IN ('held', 'payment_submitted', 'payment_under_review');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_seat_on_payment_review ON public.payment_submissions;
CREATE TRIGGER trg_sync_seat_on_payment_review
  AFTER UPDATE OF status ON public.payment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_seat_on_payment_review();


-- ============================================================================
-- Migration 054 complete: Cinema-style seat booking system
-- Tables: seat_layouts, seat_categories, seats, seat_reservations, seat_layout_audit
-- RPCs: reserve_event_seats, reclaim_expired_seat_holds, release_seat_hold,
--       get_seat_availability, confirm_seat_reservations_on_payment
-- Triggers: trg_sync_seat_on_payment_submission, trg_sync_seat_on_payment_review
-- New columns: events.registration_mode, registrations.seat_reservation_id
-- ============================================================================
