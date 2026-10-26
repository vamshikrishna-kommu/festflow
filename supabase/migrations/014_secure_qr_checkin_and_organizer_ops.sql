-- ============================================================================
-- FestFlow Migration 014: Secure QR Check-In & Organizer Operations
-- ============================================================================
-- Idempotent & non-destructive: Safe to run on existing FestFlow databases.
-- ============================================================================

-- 1. Ensure check_in_outcome enum contains all expected outcomes
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

-- 2. Ensure public.check_ins table has all necessary fields
CREATE TABLE IF NOT EXISTS public.check_ins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    ticket_code TEXT NOT NULL,
    staff_id UUID NOT NULL REFERENCES public.profiles(id),
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    checkin_notes TEXT,
    member_index INT NOT NULL DEFAULT 0,
    member_name TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure columns exist if table was already created earlier
ALTER TABLE public.check_ins
    ADD COLUMN IF NOT EXISTS member_index INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS member_name TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS checkin_notes TEXT DEFAULT NULL;

-- 3. Atomic Multi-Member Check-In Unique Constraint
-- Guarantees that a single ticket (or individual team member) can only be checked in once
DO $$
BEGIN
    ALTER TABLE public.check_ins DROP CONSTRAINT IF EXISTS uq_check_in_registration;
    ALTER TABLE public.check_ins DROP CONSTRAINT IF EXISTS uq_check_in_registration_member;
    ALTER TABLE public.check_ins ADD CONSTRAINT uq_check_in_registration_member UNIQUE (registration_id, member_index);
EXCEPTION
    WHEN OTHERS THEN null;
END $$;

-- 4. Fast Performance & Gate Operation Indexes
CREATE INDEX IF NOT EXISTS idx_check_ins_event_checked_at ON public.check_ins(event_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_check_ins_ticket_code ON public.check_ins(ticket_code);
CREATE INDEX IF NOT EXISTS idx_check_ins_staff_id ON public.check_ins(staff_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_reg_member ON public.check_ins(registration_id, member_index);

-- 5. Enable Row Level Security
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Organizers can view event check-ins" ON public.check_ins;
    DROP POLICY IF EXISTS "Students can view own check-in" ON public.check_ins;
END $$;

-- RLS: Event organizers and platform admins can view check-ins for events they manage
CREATE POLICY "Organizers can view event check-ins"
    ON public.check_ins
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = check_ins.event_id
              AND (
                  e.club_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM public.profiles p
                      WHERE p.id = auth.uid() AND p.role = 'platform_admin'
                  )
              )
        )
    );

-- RLS: Students can view check-in records for their own registrations
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

-- 6. Atomic Server-Side RPC Function for QR & Manual Ticket Check-In
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
    v_staff_role TEXT;
    v_event RECORD;
    v_raw_input TEXT;
    v_clean_code TEXT;
    v_base_code TEXT;
    v_member_index INT := 0;
    v_member_name TEXT := NULL;
    v_suffix TEXT;
    v_reg RECORD;
    v_existing_checkin RECORD;
    v_student_profile RECORD;
    v_checked_in_time TIMESTAMPTZ;
    v_team_members JSONB;
    v_member_obj JSONB;
BEGIN
    -- 1. Verify caller is authenticated
    v_staff_id := auth.uid();
    IF v_staff_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'UNAUTHORIZED',
            'message', 'You must be signed in to perform attendee check-in.'
        );
    END IF;

    -- 2. Clean input code from QR URI schemes, URLs, or JSON payloads
    v_raw_input := TRIM(COALESCE(p_ticket_code_or_payload, ''));
    v_clean_code := v_raw_input;

    -- Handle URI prefixes
    IF v_clean_code ILIKE 'festflow://pass/%' THEN
        v_clean_code := SUBSTRING(v_clean_code FROM 17);
    ELSIF v_clean_code ILIKE 'festflow://ticket/%' THEN
        v_clean_code := SUBSTRING(v_clean_code FROM 19);
    ELSIF v_clean_code ILIKE '%/pass/%' THEN
        v_clean_code := SUBSTRING(v_clean_code FROM POSITION('/pass/' IN v_clean_code) + 6);
    ELSIF v_clean_code ILIKE '%/ticket/%' THEN
        v_clean_code := SUBSTRING(v_clean_code FROM POSITION('/ticket/' IN v_clean_code) + 8);
    END IF;

    -- Strip URL query string or trailing slashes if present
    IF POSITION('?' IN v_clean_code) > 0 THEN
        v_clean_code := SUBSTRING(v_clean_code FROM 1 FOR POSITION('?' IN v_clean_code) - 1);
    END IF;
    v_clean_code := TRIM(TRAILING '/' FROM v_clean_code);
    v_clean_code := TRIM(v_clean_code);

    IF v_clean_code IS NULL OR length(v_clean_code) < 3 THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'INVALID_TICKET',
            'message', 'No valid ticket or pass token was provided.'
        );
    END IF;

    -- 3. Detect member sub-token suffix (e.g. "TKT-1234-M1" or "FFQ_ABC-M2")
    v_base_code := v_clean_code;
    IF v_clean_code ~* '(-M[0-9]+)$' THEN
        v_suffix := (regexp_match(v_clean_code, '(-M[0-9]+)$', 'i'))[1];
        v_member_index := SUBSTRING(v_suffix FROM 3)::INT;
        v_base_code := SUBSTRING(v_clean_code FROM 1 FOR length(v_clean_code) - length(v_suffix));
    END IF;

    -- 4. Fetch target event
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

    -- 5. Verify caller owns event or is platform_admin
    IF v_event.club_id <> v_staff_id THEN
        SELECT role::text INTO v_staff_role
        FROM public.profiles
        WHERE id = v_staff_id;

        IF COALESCE(v_staff_role, '') <> 'platform_admin' THEN
            RETURN jsonb_build_object(
                'success', false,
                'outcome', 'UNAUTHORIZED',
                'message', 'You are not authorized to check in attendees for this event.'
            );
        END IF;
    END IF;

    -- 6. Check event active state (reject check-in if event was cancelled)
    IF v_event.status = 'cancelled' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'CANCELLED',
            'message', 'This event has been cancelled by organizers. Gate entry is closed.'
        );
    END IF;

    -- 7. Lock and retrieve registration row by qr_token or ticket_code (case-insensitive)
    SELECT * INTO v_reg
    FROM public.registrations
    WHERE UPPER(qr_token) = UPPER(v_base_code)
       OR UPPER(ticket_code) = UPPER(v_base_code)
       OR UPPER(qr_token) = UPPER(v_clean_code)
       OR UPPER(ticket_code) = UPPER(v_clean_code)
    FOR UPDATE;

    IF v_reg.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'INVALID_TICKET',
            'message', 'Unknown ticket or QR pass. No registration matches this token.'
        );
    END IF;

    -- 8. Verify ticket belongs to this specific event
    IF v_reg.event_id <> p_event_id THEN
        DECLARE
            v_actual_event_title TEXT;
        BEGIN
            SELECT title INTO v_actual_event_title FROM public.events WHERE id = v_reg.event_id;
            RETURN jsonb_build_object(
                'success', false,
                'outcome', 'WRONG_EVENT',
                'ticket_code', v_reg.ticket_code,
                'message', 'This ticket belongs to another event (' || COALESCE(v_actual_event_title, 'different event') || ').'
            );
        END;
    END IF;

    -- 9. Fetch primary student profile (safe against missing display_name)
    SELECT display_name, email INTO v_student_profile
    FROM public.profiles
    WHERE id = v_reg.student_id;

    -- 10. Check if it's an individual team member check-in
    IF v_member_index > 0 AND v_reg.team_members IS NOT NULL THEN
        v_team_members := v_reg.team_members;
        IF jsonb_array_length(v_team_members) >= v_member_index THEN
            v_member_obj := v_team_members->(v_member_index - 1);
            v_member_name := COALESCE(v_member_obj->>'name', 'Team Member #' || v_member_index);
        END IF;
    END IF;

    -- 11. Check registration status & eligibility
    IF v_reg.status = 'cancelled' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'CANCELLED',
            'student_name', COALESCE(v_member_name, v_student_profile.display_name, v_reg.team_name, 'Student Attendee'),
            'ticket_code', v_reg.ticket_code,
            'message', 'Registration cancelled. This pass has been revoked and is void for entry.'
        );
    END IF;

    IF v_reg.status = 'rejected' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'CANCELLED',
            'student_name', COALESCE(v_member_name, v_student_profile.display_name, v_reg.team_name, 'Student Attendee'),
            'ticket_code', v_reg.ticket_code,
            'message', 'Registration application was rejected by organizers. Pass is invalid.'
        );
    END IF;

    IF v_reg.status = 'pending_approval' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'NOT_CONFIRMED',
            'student_name', COALESCE(v_member_name, v_student_profile.display_name, v_reg.team_name, 'Student Attendee'),
            'ticket_code', v_reg.ticket_code,
            'message', 'Application under review. Pass has not been approved for admission yet.'
        );
    END IF;

    IF v_reg.status = 'pending_payment' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'NOT_CONFIRMED',
            'student_name', COALESCE(v_member_name, v_student_profile.display_name, v_reg.team_name, 'Student Attendee'),
            'ticket_code', v_reg.ticket_code,
            'message', 'Payment pending. Attendee ticket fee must be verified before entry.'
        );
    END IF;

    IF v_reg.status = 'waitlisted' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'NOT_CONFIRMED',
            'student_name', COALESCE(v_member_name, v_student_profile.display_name, v_reg.team_name, 'Student Attendee'),
            'ticket_code', v_reg.ticket_code,
            'message', 'Registration is on the waitlist. Pass is not confirmed for admission.'
        );
    END IF;

    IF v_reg.status <> 'confirmed' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'NOT_CONFIRMED',
            'student_name', COALESCE(v_member_name, v_student_profile.display_name, v_reg.team_name, 'Student Attendee'),
            'ticket_code', v_reg.ticket_code,
            'message', 'Registration not confirmed. Current status is "' || v_reg.status || '". Only confirmed passes are admitted.'
        );
    END IF;

    -- 12. Check if this specific ticket / member pass was already checked in
    SELECT * INTO v_existing_checkin
    FROM public.check_ins
    WHERE registration_id = v_reg.id
      AND member_index = v_member_index
    FOR UPDATE;

    IF v_existing_checkin.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'ALREADY_USED',
            'student_name', COALESCE(v_member_name, v_student_profile.display_name, v_reg.team_name, 'Student Attendee'),
            'ticket_code', v_reg.ticket_code,
            'member_index', v_member_index,
            'checked_in_at', v_existing_checkin.checked_in_at,
            'message', CASE
                WHEN v_member_name IS NOT NULL THEN 'Member (' || v_member_name || ') was already checked in at ' || TO_CHAR(v_existing_checkin.checked_in_at, 'HH12:MI AM on Mon DD') || '.'
                ELSE 'Pass was already checked in at ' || TO_CHAR(v_existing_checkin.checked_in_at, 'HH12:MI AM on Mon DD, YYYY') || '.'
            END
        );
    END IF;

    -- 13. Perform atomic check-in insertion with concurrency exception safety
    v_checked_in_time := now();
    BEGIN
        INSERT INTO public.check_ins (
            registration_id,
            event_id,
            ticket_code,
            staff_id,
            checked_in_at,
            checkin_notes,
            member_index,
            member_name
        ) VALUES (
            v_reg.id,
            p_event_id,
            v_reg.ticket_code,
            v_staff_id,
            v_checked_in_time,
            p_notes,
            v_member_index,
            v_member_name
        );
    EXCEPTION
        WHEN unique_violation THEN
            SELECT * INTO v_existing_checkin
            FROM public.check_ins
            WHERE registration_id = v_reg.id
              AND member_index = v_member_index;

            RETURN jsonb_build_object(
                'success', false,
                'outcome', 'ALREADY_USED',
                'student_name', COALESCE(v_member_name, v_student_profile.display_name, v_reg.team_name, 'Student Attendee'),
                'ticket_code', v_reg.ticket_code,
                'member_index', v_member_index,
                'checked_in_at', v_existing_checkin.checked_in_at,
                'message', 'Pass was already checked in (concurrent entry prevented).'
            );
    END;

    -- 14. Return successful admission confirmation
    RETURN jsonb_build_object(
        'success', true,
        'outcome', 'VALID',
        'student_name', COALESCE(v_member_name, v_student_profile.display_name, v_reg.team_name, 'Student Attendee'),
        'team_name', v_reg.team_name,
        'member_index', v_member_index,
        'member_name', v_member_name,
        'ticket_code', v_reg.ticket_code,
        'checked_in_at', v_checked_in_time,
        'event_title', v_event.title,
        'message', CASE
            WHEN v_member_name IS NOT NULL THEN 'Team member ' || v_member_name || ' checked in successfully!'
            WHEN v_reg.team_name IS NOT NULL THEN 'Team ' || v_reg.team_name || ' pass verified! Entry granted.'
            ELSE 'Entry granted! Ticket verified successfully.'
        END
    );
END;
$$;
