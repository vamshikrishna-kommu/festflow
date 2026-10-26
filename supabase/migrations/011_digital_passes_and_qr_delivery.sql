-- ============================================================================
-- FestFlow Migration 011: Digital Passes, Secure QR Tokens & Pass Delivery
-- ============================================================================
-- Idempotent & non-destructive: Safe to run on existing FestFlow databases.
-- ============================================================================

-- 1. Extend public.registrations with secure unpredictable QR token
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS qr_token TEXT;

-- Generate random cryptographic QR tokens for any existing registrations without one
UPDATE public.registrations
SET qr_token = 'FFQ_' || encode(gen_random_bytes(16), 'hex')
WHERE qr_token IS NULL;

-- Ensure uniqueness constraint on qr_token
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_registrations_qr_token'
  ) THEN
    ALTER TABLE public.registrations ADD CONSTRAINT uq_registrations_qr_token UNIQUE (qr_token);
  END IF;
END $$;

-- Set default for new rows
ALTER TABLE public.registrations
  ALTER COLUMN qr_token SET DEFAULT ('FFQ_' || encode(gen_random_bytes(16), 'hex'));

-- Index on qr_token for instantaneous scanner lookup
CREATE INDEX IF NOT EXISTS idx_registrations_qr_token ON public.registrations(qr_token);

-- 2. Extend public.check_ins to support individual team member check-ins
ALTER TABLE public.check_ins
  ADD COLUMN IF NOT EXISTS member_index INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS member_name TEXT DEFAULT NULL;

-- Update unique constraint to allow each member of a team registration to check in independently
DO $$
BEGIN
  ALTER TABLE public.check_ins DROP CONSTRAINT IF EXISTS uq_check_in_registration;
  ALTER TABLE public.check_ins DROP CONSTRAINT IF EXISTS uq_check_in_registration_member;
  ALTER TABLE public.check_ins ADD CONSTRAINT uq_check_in_registration_member UNIQUE (registration_id, member_index);
EXCEPTION
  WHEN OTHERS THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_check_ins_reg_member ON public.check_ins(registration_id, member_index);

-- 3. Upgrade Server-Side Atomic RPC Function for QR & Manual Ticket Check-In
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
    v_staff_id := auth.uid();
    IF v_staff_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'UNAUTHORIZED',
            'message', 'You must be signed in to perform attendee check-in.'
        );
    END IF;

    -- Extract clean code from QR URI schemes
    v_raw_input := TRIM(p_ticket_code_or_payload);
    v_clean_code := v_raw_input;

    IF v_clean_code ILIKE 'festflow://pass/%' THEN
        v_clean_code := SUBSTRING(v_clean_code FROM 17);
    ELSIF v_clean_code ILIKE 'festflow://ticket/%' THEN
        v_clean_code := SUBSTRING(v_clean_code FROM 19);
    ELSIF v_clean_code ILIKE '%/pass/%' THEN
        v_clean_code := SUBSTRING(v_clean_code FROM POSITION('/pass/' IN v_clean_code) + 6);
    ELSIF v_clean_code ILIKE '%/ticket/%' THEN
        v_clean_code := SUBSTRING(v_clean_code FROM POSITION('/ticket/' IN v_clean_code) + 8);
    END IF;

    v_clean_code := TRIM(v_clean_code);

    IF v_clean_code IS NULL OR length(v_clean_code) < 4 THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'INVALID_TICKET',
            'message', 'No valid ticket or pass token was provided.'
        );
    END IF;

    -- Detect member sub-token suffix (e.g. "TKT-1234-M1" or "FFQ_ABC-M2")
    v_base_code := v_clean_code;
    IF v_clean_code ~* '(-M[0-9]+)$' THEN
        v_suffix := (regexp_match(v_clean_code, '(-M[0-9]+)$', 'i'))[1];
        v_member_index := SUBSTRING(v_suffix FROM 3)::INT;
        v_base_code := SUBSTRING(v_clean_code FROM 1 FOR length(v_clean_code) - length(v_suffix));
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

    -- Lock and retrieve registration row by either qr_token or ticket_code (case-insensitive)
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

    -- Verify ticket belongs to this specific event
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

    -- Fetch primary student profile
    SELECT display_name, email INTO v_student_profile
    FROM public.profiles
    WHERE id = v_reg.student_id;

    -- Check if it's an individual team member check-in
    IF v_member_index > 0 AND v_reg.team_members IS NOT NULL THEN
        v_team_members := v_reg.team_members;
        IF jsonb_array_length(v_team_members) >= v_member_index THEN
            v_member_obj := v_team_members->(v_member_index - 1);
            v_member_name := COALESCE(v_member_obj->>'name', 'Team Member #' || v_member_index);
        END IF;
    END IF;

    -- Check registration status & eligibility
    IF v_reg.status = 'cancelled' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'CANCELLED',
            'student_name', COALESCE(v_member_name, v_student_profile.display_name),
            'ticket_code', v_reg.ticket_code,
            'message', 'Registration cancelled. This pass has been revoked and is void for entry.'
        );
    END IF;

    IF v_reg.status = 'rejected' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'CANCELLED',
            'student_name', COALESCE(v_member_name, v_student_profile.display_name),
            'ticket_code', v_reg.ticket_code,
            'message', 'Registration application was rejected by organizers. Pass is invalid.'
        );
    END IF;

    IF v_reg.status = 'pending_approval' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'NOT_CONFIRMED',
            'student_name', COALESCE(v_member_name, v_student_profile.display_name),
            'ticket_code', v_reg.ticket_code,
            'message', 'Application under review. Pass has not been approved for admission yet.'
        );
    END IF;

    IF v_reg.status = 'pending_payment' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'NOT_CONFIRMED',
            'student_name', COALESCE(v_member_name, v_student_profile.display_name),
            'ticket_code', v_reg.ticket_code,
            'message', 'Payment pending. Attendee ticket fee must be verified before entry.'
        );
    END IF;

    IF v_reg.status <> 'confirmed' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'NOT_CONFIRMED',
            'student_name', COALESCE(v_member_name, v_student_profile.display_name),
            'ticket_code', v_reg.ticket_code,
            'message', 'Registration not confirmed. Current status is "' || v_reg.status || '".'
        );
    END IF;

    -- Check if this specific ticket / member pass was already checked in
    SELECT * INTO v_existing_checkin
    FROM public.check_ins
    WHERE registration_id = v_reg.id
      AND member_index = v_member_index
    FOR UPDATE;

    IF v_existing_checkin.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'ALREADY_USED',
            'student_name', COALESCE(v_member_name, v_student_profile.display_name),
            'ticket_code', v_reg.ticket_code,
            'member_index', v_member_index,
            'checked_in_at', v_existing_checkin.checked_in_at,
            'message', CASE
                WHEN v_member_name IS NOT NULL THEN 'Member (' || v_member_name || ') was already checked in at ' || TO_CHAR(v_existing_checkin.checked_in_at, 'HH12:MI AM on Mon DD')
                ELSE 'Pass was already checked in at ' || TO_CHAR(v_existing_checkin.checked_in_at, 'HH12:MI AM on Mon DD, YYYY') || '.'
            END
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

    RETURN jsonb_build_object(
        'success', true,
        'outcome', 'VALID',
        'student_name', COALESCE(v_member_name, v_student_profile.display_name),
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

-- 4. Stored Procedure: Resend Registration Pass
CREATE OR REPLACE FUNCTION public.resend_registration_pass(
    p_registration_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_reg RECORD;
    v_event RECORD;
    v_student RECORD;
    v_idempotency_key TEXT;
    v_outbox_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'You must be signed in to resend a pass.'
        );
    END IF;

    -- Fetch registration
    SELECT * INTO v_reg
    FROM public.registrations
    WHERE id = p_registration_id;

    IF v_reg.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Registration not found.'
        );
    END IF;

    -- Fetch event
    SELECT * INTO v_event
    FROM public.events
    WHERE id = v_reg.event_id;

    -- Verify authorization: must be the student or event organizer
    IF v_reg.student_id <> v_caller_id AND (v_event.club_id IS NULL OR v_event.club_id <> v_caller_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'You do not have permission to resend this pass.'
        );
    END IF;

    -- Check eligibility: pass MUST be confirmed
    IF v_reg.status <> 'confirmed' THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Digital pass cannot be sent because registration status is "' || v_reg.status || '". Only confirmed registrations have active passes.'
        );
    END IF;

    -- Fetch student profile
    SELECT display_name, email INTO v_student
    FROM public.profiles
    WHERE id = v_reg.student_id;

    IF v_student.email IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Student has no registered email address.'
        );
    END IF;

    -- Queue in email_outbox with safe hourly idempotency key to prevent spam
    v_idempotency_key := 'resend_pass_' || v_reg.id::text || '_' || TO_CHAR(now(), 'YYYYMMDDHH24MI');

    INSERT INTO public.email_outbox (
        recipient_email,
        recipient_name,
        template_type,
        subject,
        payload,
        idempotency_key,
        event_id,
        registration_id,
        user_id,
        status,
        created_at,
        updated_at
    ) VALUES (
        TRIM(v_student.email),
        TRIM(COALESCE(v_student.display_name, 'Student Attendee')),
        'registration_confirmed',
        'Your Digital Pass: ' || v_event.title,
        jsonb_build_object(
            'event_title', v_event.title,
            'ticket_code', v_reg.ticket_code,
            'qr_token', v_reg.qr_token,
            'start_date', v_event.start_date,
            'venue_name', v_event.venue_name,
            'team_name', v_reg.team_name,
            'is_resend', true
        ),
        v_idempotency_key,
        v_event.id,
        v_reg.id,
        v_reg.student_id,
        'pending',
        now(),
        now()
    )
    ON CONFLICT (idempotency_key) DO UPDATE
    SET updated_at = now()
    RETURNING id INTO v_outbox_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Pass email queued successfully for ' || v_student.email,
        'recipient_email', v_student.email,
        'ticket_code', v_reg.ticket_code,
        'outbox_id', v_outbox_id
    );
END;
$$;
