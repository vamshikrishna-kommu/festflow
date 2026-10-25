-- ============================================================================
-- FestFlow Migration 005: Event Entry Check-In & Live QR Scanner
-- ============================================================================

-- 1. Create check_in_outcome enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'check_in_outcome') THEN
        CREATE TYPE public.check_in_outcome AS ENUM (
            'VALID',
            'ALREADY_USED',
            'INVALID_TICKET',
            'WRONG_EVENT',
            'NOT_CONFIRMED',
            'CANCELLED',
            'UNAUTHORIZED'
        );
    END IF;
END $$;

-- 2. Create check_ins table
CREATE TABLE IF NOT EXISTS public.check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    ticket_code TEXT NOT NULL,
    staff_id UUID NOT NULL REFERENCES public.profiles(id),
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    checkin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_check_in_registration UNIQUE (registration_id)
);

-- Indexes for fast check-in verification and event live statistics
CREATE INDEX IF NOT EXISTS idx_check_ins_event_checked_at ON public.check_ins(event_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_check_ins_ticket_code ON public.check_ins(ticket_code);
CREATE INDEX IF NOT EXISTS idx_check_ins_staff_id ON public.check_ins(staff_id);

-- Enable RLS for check_ins
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Organizers can view event check-ins" ON public.check_ins;
    DROP POLICY IF EXISTS "Students can view own check-in" ON public.check_ins;
END $$;

-- RLS: Club staff / organizers can view check-ins for events they own
CREATE POLICY "Organizers can view event check-ins"
    ON public.check_ins
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = check_ins.event_id
              AND e.club_id = auth.uid()
        )
    );

-- RLS: Students can view check-in record for their own registration
CREATE POLICY "Students can view own check-in"
    ON public.check_ins
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.registrations r
            WHERE r.id = check_ins.registration_id
              AND r.student_id = auth.uid()
        )
    );

-- Note: All check-in inserts and updates must be executed via the trusted atomic check_in_ticket function.

-- 3. Atomic Server-Side RPC Function for QR & Manual Ticket Check-In
CREATE OR REPLACE FUNCTION public.check_in_ticket(
    p_event_id UUID,
    p_ticket_code_or_payload TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_staff_id UUID;
    v_event RECORD;
    v_clean_code TEXT;
    v_reg RECORD;
    v_existing_checkin RECORD;
    v_student_profile RECORD;
    v_checked_in_time TIMESTAMPTZ;
BEGIN
    v_staff_id := auth.uid();
    IF v_staff_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'UNAUTHORIZED',
            'message', 'You must be signed in to perform attendee check-in.'
        );
    END IF;

    -- Extract clean ticket code from raw payload (e.g. "festflow://ticket/TKT-XYZ" or "TKT-XYZ")
    v_clean_code := TRIM(p_ticket_code_or_payload);
    IF v_clean_code ILIKE 'festflow://ticket/%' THEN
        v_clean_code := SUBSTRING(v_clean_code FROM 19);
    ELSIF v_clean_code ILIKE '%/ticket/%' THEN
        v_clean_code := SUBSTRING(v_clean_code FROM POSITION('/ticket/' IN v_clean_code) + 8);
    END IF;
    v_clean_code := TRIM(UPPER(v_clean_code));

    IF v_clean_code IS NULL OR length(v_clean_code) < 4 THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'INVALID_TICKET',
            'message', 'No valid ticket code was provided.'
        );
    END IF;

    -- Fetch and verify target event
    SELECT * INTO v_event
    FROM public.events
    WHERE id = p_event_id;

    IF v_event.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'UNAUTHORIZED',
            'message', 'Target event not found.'
        );
    END IF;

    -- Verify caller owns the event (or is authorized staff)
    IF v_event.club_id <> v_staff_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'UNAUTHORIZED',
            'message', 'You are not authorized to check in attendees for this event.'
        );
    END IF;

    -- Lock and retrieve the registration row by ticket code
    SELECT * INTO v_reg
    FROM public.registrations
    WHERE UPPER(ticket_code) = v_clean_code
    FOR UPDATE;

    IF v_reg.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'INVALID_TICKET',
            'message', 'Unknown ticket code. No registration matches this code.'
        );
    END IF;

    -- Verify ticket belongs to this specific event
    IF v_reg.event_id <> p_event_id THEN
        DECLARE
            v_actual_event_title TEXT;
        BEGIN
            SELECT title INTO v_actual_event_title FROM public.events WHERE id = v_reg.event_id;
            RETURN jsonb_build_object(
                'success', false,
                'outcome', 'WRONG_EVENT',
                'ticket_code', v_clean_code,
                'message', 'This ticket belongs to another event (' || COALESCE(v_actual_event_title, 'different event') || ').'
            );
        END;
    END IF;

    -- Fetch student display details for reporting
    SELECT display_name, email INTO v_student_profile
    FROM public.profiles
    WHERE id = v_reg.student_id;

    -- Check registration status
    IF v_reg.status = 'cancelled' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'CANCELLED',
            'student_name', v_student_profile.display_name,
            'ticket_code', v_clean_code,
            'message', 'Registration cancelled. This ticket has been revoked and is void for entry.'
        );
    END IF;

    IF v_reg.status <> 'confirmed' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'NOT_CONFIRMED',
            'student_name', v_student_profile.display_name,
            'ticket_code', v_clean_code,
            'message', 'Registration not confirmed. Status is "' || v_reg.status || '". Payment must be verified before entry.'
        );
    END IF;

    -- Check if ticket was already checked in (Row lock check_ins)
    SELECT * INTO v_existing_checkin
    FROM public.check_ins
    WHERE registration_id = v_reg.id
    FOR UPDATE;

    IF v_existing_checkin.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'ALREADY_USED',
            'student_name', v_student_profile.display_name,
            'ticket_code', v_clean_code,
            'checked_in_at', v_existing_checkin.checked_in_at,
            'message', 'Ticket was already checked in at ' || TO_CHAR(v_existing_checkin.checked_in_at, 'HH12:MI AM on Mon DD, YYYY') || '.'
        );
    END IF;

    -- Perform atomic check-in insert
    v_checked_in_time := now();
    INSERT INTO public.check_ins (
        registration_id,
        event_id,
        ticket_code,
        staff_id,
        checked_in_at,
        checkin_notes
    ) VALUES (
        v_reg.id,
        p_event_id,
        v_clean_code,
        v_staff_id,
        v_checked_in_time,
        p_notes
    );

    RETURN jsonb_build_object(
        'success', true,
        'outcome', 'VALID',
        'student_name', v_student_profile.display_name,
        'ticket_code', v_clean_code,
        'checked_in_at', v_checked_in_time,
        'event_title', v_event.title,
        'message', 'Entry granted! Ticket verified successfully.'
    );
END;
$$;
