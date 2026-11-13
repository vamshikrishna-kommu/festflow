-- ============================================================================
-- FestFlow Migration 056: Unlimited Check-In & Check-Out Lifecycle
-- ============================================================================
-- Created: 2026-11-13
--
-- Features:
-- 1. Removes the 1-time checkout restriction.
-- 2. Makes re-entry permitted at all times by default (allow_reentry = true).
-- 3. Updates check_in_ticket() to never block re-entry after check-out, incrementing entry_count indefinitely.
-- 4. Updates check_out_ticket() to support unlimited check-out cycles.
-- 5. Introduces participant_toggle_attendance() RPC allowing participants to self check-out and
--    check back in from their digital pass whenever they wish.
-- ============================================================================

-- ── 1. Update events default policy: Re-entry permitted at all times ───────
ALTER TABLE public.events
    ALTER COLUMN allow_reentry SET DEFAULT true;

-- Update all existing events so participants are never restricted to 1-time checkout
UPDATE public.events
SET allow_reentry = true
WHERE allow_reentry = false;


-- ── 2. Update check_in_ticket: Unlimited Re-Entry & Entry Count Tracking ────
CREATE OR REPLACE FUNCTION public.check_in_ticket(
    p_event_id UUID,
    p_ticket_code_or_payload TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
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
    v_input_hash TEXT;
    v_clean_hash TEXT;
    v_reg RECORD;
    v_existing_checkin RECORD;
    v_student_profile RECORD;
    v_checked_in_time TIMESTAMPTZ;
    v_team_members JSONB;
    v_member_obj JSONB;
    v_new_entry_count INT := 1;
BEGIN
    v_staff_id := auth.uid();
    IF v_staff_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'UNAUTHORIZED',
            'message', 'You must be signed in to perform attendee check-in.'
        );
    END IF;

    v_raw_input := TRIM(COALESCE(p_ticket_code_or_payload, ''));
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

    -- Reject human-readable ticket codes for gate scanner to prevent manual code guessing
    IF v_clean_code ~* '^(FF|TKT)-[A-Z0-9]+' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'INVALID_TICKET',
            'message', 'Human-readable ticket reference codes cannot be used for gate admission. The student must present their official bearer QR pass.'
        );
    END IF;

    v_base_code := v_clean_code;
    IF v_clean_code ~* '(-M[0-9]+)$' THEN
        v_suffix := (regexp_match(v_clean_code, '(-M[0-9]+)$', 'i'))[1];
        v_member_index := SUBSTRING(v_suffix FROM 3)::INT;
        v_base_code := SUBSTRING(v_clean_code FROM 1 FOR length(v_clean_code) - length(v_suffix));
    END IF;

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

    IF v_event.club_id IS DISTINCT FROM v_staff_id THEN
        SELECT role::text INTO v_staff_role
        FROM public.profiles
        WHERE id = v_staff_id;

        IF COALESCE(v_staff_role, '') IS DISTINCT FROM 'platform_admin' THEN
            RETURN jsonb_build_object(
                'success', false,
                'outcome', 'UNAUTHORIZED',
                'message', 'You are not authorized to check in attendees for this event.'
            );
        END IF;
    END IF;

    IF v_event.status = 'cancelled' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'CANCELLED',
            'message', 'This event has been cancelled by organizers. Gate entry is closed.'
        );
    END IF;

    -- Indexed SHA-256 hash lookup
    v_input_hash := encode(extensions.digest(UPPER(TRIM(v_base_code)), 'sha256'), 'hex');

    SELECT * INTO v_reg
    FROM public.registrations
    WHERE qr_token_hash = v_input_hash
    FOR UPDATE;

    IF v_reg.id IS NULL AND v_member_index > 0 THEN
        v_clean_hash := encode(extensions.digest(UPPER(TRIM(v_clean_code)), 'sha256'), 'hex');
        SELECT * INTO v_reg
        FROM public.registrations
        WHERE qr_token_hash = v_clean_hash
        FOR UPDATE;
        IF v_reg.id IS NOT NULL THEN
            v_member_index := 0;
        END IF;
    END IF;

    IF v_reg.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'INVALID_TICKET',
            'message', 'Unknown QR pass. No registration matches this token.'
        );
    END IF;

    IF v_reg.event_id IS DISTINCT FROM p_event_id THEN
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

    SELECT display_name, email INTO v_student_profile
    FROM public.profiles
    WHERE id = v_reg.student_id;

    IF v_member_index > 0 THEN
        IF v_reg.team_members IS NULL OR jsonb_array_length(v_reg.team_members) < v_member_index OR v_member_index < 1 THEN
            RETURN jsonb_build_object(
                'success', false,
                'outcome', 'INVALID_TICKET',
                'ticket_code', v_reg.ticket_code,
                'message', 'Invalid team member pass. Registration does not contain member #' || v_member_index || '.'
            );
        END IF;
        v_team_members := v_reg.team_members;
        v_member_obj := v_team_members->(v_member_index - 1);
        v_member_name := COALESCE(v_member_obj->>'name', 'Team Member #' || v_member_index);
    END IF;

    IF v_reg.status = 'cancelled' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'CANCELLED',
            'student_name', COALESCE(v_member_name, v_student_profile.display_name, v_reg.team_name, 'Student Attendee'),
            'ticket_code', v_reg.ticket_code,
            'message', 'Registration cancelled. This pass has been revoked and is void for entry.'
        );
    END IF;

    IF v_reg.status::text IS DISTINCT FROM 'confirmed' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'NOT_CONFIRMED',
            'student_name', COALESCE(v_member_name, v_student_profile.display_name, v_reg.team_name, 'Student Attendee'),
            'ticket_code', v_reg.ticket_code,
            'message', 'Registration not confirmed. Current status is "' || v_reg.status || '". Only confirmed passes are admitted.'
        );
    END IF;

    SELECT * INTO v_existing_checkin
    FROM public.check_ins
    WHERE registration_id = v_reg.id
      AND member_index = v_member_index
    FOR UPDATE;

    v_checked_in_time := now();

    IF v_existing_checkin.id IS NOT NULL THEN
        -- Already checked in right now
        IF v_existing_checkin.status = 'checked_in' THEN
            RETURN jsonb_build_object(
                'success', false,
                'outcome', 'ALREADY_USED',
                'student_name', COALESCE(v_member_name, v_student_profile.display_name, v_reg.team_name, 'Student Attendee'),
                'ticket_code', v_reg.ticket_code,
                'member_index', v_member_index,
                'entry_count', v_existing_checkin.entry_count,
                'checked_in_at', v_existing_checkin.checked_in_at,
                'message', CASE
                    WHEN v_member_name IS NOT NULL THEN 'Team member (' || v_member_name || ') is currently checked in since ' || TO_CHAR(v_existing_checkin.checked_in_at, 'HH12:MI AM') || '.'
                    ELSE 'Attendee is currently checked in at the venue since ' || TO_CHAR(v_existing_checkin.checked_in_at, 'HH12:MI AM') || '.'
                END
            );
        END IF;

        -- Re-entry: Attendee previously checked out -> ALWAYS permitted without limits
        IF v_existing_checkin.status::text = 'checked_out' THEN
            v_new_entry_count := COALESCE(v_existing_checkin.entry_count, 1) + 1;
            UPDATE public.check_ins
            SET status = 'checked_in',
                checked_in_at = v_checked_in_time,
                staff_id = v_staff_id,
                entry_count = v_new_entry_count,
                checkin_notes = COALESCE(p_notes, checkin_notes)
            WHERE id = v_existing_checkin.id;

            RETURN jsonb_build_object(
                'success', true,
                'outcome', 'VALID',
                'is_reentry', true,
                'entry_count', v_new_entry_count,
                'student_name', COALESCE(v_member_name, v_student_profile.display_name, v_reg.team_name, 'Student Attendee'),
                'team_name', v_reg.team_name,
                'member_index', v_member_index,
                'member_name', v_member_name,
                'ticket_code', v_reg.ticket_code,
                'checked_in_at', v_checked_in_time,
                'event_title', v_event.title,
                'message', 'Re-entry verified! Admission granted (Entry #' || v_new_entry_count || ').'
            );
        END IF;
    END IF;

    -- First-time check-in
    BEGIN
        INSERT INTO public.check_ins (
            registration_id,
            event_id,
            ticket_code,
            staff_id,
            checked_in_at,
            checkin_notes,
            member_index,
            member_name,
            status,
            entry_count
        ) VALUES (
            v_reg.id,
            p_event_id,
            v_reg.ticket_code,
            v_staff_id,
            v_checked_in_time,
            p_notes,
            v_member_index,
            v_member_name,
            'checked_in',
            1
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

    RETURN jsonb_build_object(
        'success', true,
        'outcome', 'VALID',
        'is_reentry', false,
        'entry_count', 1,
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

GRANT EXECUTE ON FUNCTION public.check_in_ticket(UUID, TEXT, TEXT) TO authenticated, service_role;


-- ── 3. Update check_out_ticket: Unlimited Check-Out Cycles ─────────────────
CREATE OR REPLACE FUNCTION public.check_out_ticket(
    p_event_id UUID,
    p_ticket_code_or_payload TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
DECLARE
    v_staff_id UUID;
    v_staff_role TEXT;
    v_event RECORD;
    v_clean_code TEXT;
    v_base_code TEXT;
    v_member_index INT := 0;
    v_member_name TEXT := NULL;
    v_suffix TEXT;
    v_input_hash TEXT;
    v_clean_hash TEXT;
    v_reg RECORD;
    v_existing_checkin RECORD;
    v_student_profile RECORD;
    v_checked_out_time TIMESTAMPTZ;
    v_team_members JSONB;
    v_member_obj JSONB;
BEGIN
    v_staff_id := auth.uid();
    IF v_staff_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'outcome', 'UNAUTHORIZED', 'message', 'Sign in required.');
    END IF;

    v_clean_code := TRIM(COALESCE(p_ticket_code_or_payload, ''));
    IF v_clean_code ILIKE 'festflow://pass/%' THEN
        v_clean_code := SUBSTRING(v_clean_code FROM 17);
    ELSIF v_clean_code ILIKE 'festflow://ticket/%' THEN
        v_clean_code := SUBSTRING(v_clean_code FROM 19);
    ELSIF v_clean_code ILIKE '%/pass/%' THEN
        v_clean_code := SUBSTRING(v_clean_code FROM POSITION('/pass/' IN v_clean_code) + 6);
    ELSIF v_clean_code ILIKE '%/ticket/%' THEN
        v_clean_code := SUBSTRING(v_clean_code FROM POSITION('/ticket/' IN v_clean_code) + 8);
    END IF;

    IF POSITION('?' IN v_clean_code) > 0 THEN
        v_clean_code := SUBSTRING(v_clean_code FROM 1 FOR POSITION('?' IN v_clean_code) - 1);
    END IF;
    v_clean_code := TRIM(TRAILING '/' FROM v_clean_code);
    v_clean_code := TRIM(v_clean_code);

    IF v_clean_code IS NULL OR length(v_clean_code) < 3 THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'INVALID_TICKET',
            'message', 'No valid ticket or pass token was provided for check-out.'
        );
    END IF;

    IF v_clean_code ~* '^(FF|TKT)-[A-Z0-9]+' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'INVALID_TICKET',
            'message', 'Ticket reference codes cannot be used for turnstile exit. Please scan the QR pass.'
        );
    END IF;

    v_base_code := v_clean_code;
    IF v_clean_code ~* '(-M[0-9]+)$' THEN
        v_suffix := (regexp_match(v_clean_code, '(-M[0-9]+)$', 'i'))[1];
        v_member_index := SUBSTRING(v_suffix FROM 3)::INT;
        v_base_code := SUBSTRING(v_clean_code FROM 1 FOR length(v_clean_code) - length(v_suffix));
    END IF;

    SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
    IF v_event.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'outcome', 'UNAUTHORIZED', 'message', 'Event not found.');
    END IF;

    IF v_event.club_id IS DISTINCT FROM v_staff_id THEN
        SELECT role::text INTO v_staff_role FROM public.profiles WHERE id = v_staff_id;
        IF COALESCE(v_staff_role, '') IS DISTINCT FROM 'platform_admin' THEN
            RETURN jsonb_build_object(
                'success', false,
                'outcome', 'UNAUTHORIZED',
                'message', 'You are not authorized to check out attendees for this event.'
            );
        END IF;
    END IF;

    v_input_hash := encode(extensions.digest(UPPER(TRIM(v_base_code)), 'sha256'), 'hex');

    SELECT * INTO v_reg
    FROM public.registrations
    WHERE qr_token_hash = v_input_hash
    FOR UPDATE;

    IF v_reg.id IS NULL AND v_member_index > 0 THEN
        v_clean_hash := encode(extensions.digest(UPPER(TRIM(v_clean_code)), 'sha256'), 'hex');
        SELECT * INTO v_reg
        FROM public.registrations
        WHERE qr_token_hash = v_clean_hash
        FOR UPDATE;
        IF v_reg.id IS NOT NULL THEN
            v_member_index := 0;
        END IF;
    END IF;

    IF v_reg.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'INVALID_TICKET',
            'message', 'No registration found for this QR pass.'
        );
    END IF;

    IF v_reg.event_id IS DISTINCT FROM p_event_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'WRONG_EVENT',
            'message', 'Ticket belongs to a different event.'
        );
    END IF;

    SELECT display_name INTO v_student_profile FROM public.profiles WHERE id = v_reg.student_id;
    IF v_member_index > 0 THEN
        IF v_reg.team_members IS NULL OR jsonb_array_length(v_reg.team_members) < v_member_index OR v_member_index < 1 THEN
            RETURN jsonb_build_object(
                'success', false,
                'outcome', 'INVALID_TICKET',
                'ticket_code', v_reg.ticket_code,
                'message', 'Invalid team member pass for check-out. Registration does not contain member #' || v_member_index || '.'
            );
        END IF;
        v_team_members := v_reg.team_members;
        v_member_obj := v_team_members->(v_member_index - 1);
        v_member_name := COALESCE(v_member_obj->>'name', 'Team Member #' || v_member_index);
    END IF;

    SELECT * INTO v_existing_checkin
    FROM public.check_ins
    WHERE registration_id = v_reg.id
      AND member_index = v_member_index
    FOR UPDATE;

    IF v_existing_checkin.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'NOT_CHECKED_IN',
            'student_name', COALESCE(v_member_name, v_student_profile.display_name, v_reg.team_name, 'Student Attendee'),
            'ticket_code', v_reg.ticket_code,
            'message', 'Attendee has not checked into the venue yet.'
        );
    END IF;

    IF v_existing_checkin.status::text = 'checked_out' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'ALREADY_CHECKED_OUT',
            'student_name', COALESCE(v_member_name, v_student_profile.display_name, v_reg.team_name, 'Student Attendee'),
            'ticket_code', v_reg.ticket_code,
            'checked_out_at', v_existing_checkin.checked_out_at,
            'message', 'Attendee is already checked out. Re-entry is permitted at any time.'
        );
    END IF;

    v_checked_out_time := now();
    UPDATE public.check_ins
    SET status = 'checked_out',
        checked_out_at = v_checked_out_time,
        checked_out_by = v_staff_id,
        checkout_notes = COALESCE(p_notes, checkout_notes)
    WHERE id = v_existing_checkin.id;

    RETURN jsonb_build_object(
        'success', true,
        'outcome', 'CHECKED_OUT',
        'student_name', COALESCE(v_member_name, v_student_profile.display_name, v_reg.team_name, 'Student Attendee'),
        'team_name', v_reg.team_name,
        'ticket_code', v_reg.ticket_code,
        'checked_out_at', v_checked_out_time,
        'entry_count', v_existing_checkin.entry_count,
        'event_title', v_event.title,
        'message', 'Check-out recorded successfully. Re-entry is permitted at any time.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_out_ticket(UUID, TEXT, TEXT) TO authenticated, service_role;


-- ── 4. Participant Self-Service Attendance RPC ──────────────────────────────
-- Allows a participant to check out and check in anytime during the event
-- directly from their digital pass, with zero limit to the number of checkouts.
CREATE OR REPLACE FUNCTION public.participant_toggle_attendance(
    p_registration_id UUID,
    p_action TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_reg RECORD;
    v_event RECORD;
    v_checkin RECORD;
    v_now TIMESTAMPTZ := now();
    v_new_entry_count INT := 1;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'UNAUTHENTICATED',
            'message', 'You must be signed in to manage attendance.'
        );
    END IF;

    SELECT * INTO v_reg
    FROM public.registrations
    WHERE id = p_registration_id
    FOR UPDATE;

    IF v_reg.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'NOT_FOUND',
            'message', 'Registration record not found.'
        );
    END IF;

    SELECT * INTO v_event
    FROM public.events
    WHERE id = v_reg.event_id;

    IF v_event.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'EVENT_NOT_FOUND',
            'message', 'Associated event not found.'
        );
    END IF;

    -- Security: Only registration owner, event club organizer, or platform_admin can toggle
    IF v_reg.student_id IS DISTINCT FROM v_user_id AND v_event.club_id IS DISTINCT FROM v_user_id THEN
        SELECT role::text INTO v_user_role FROM public.profiles WHERE id = v_user_id;
        IF COALESCE(v_user_role, '') IS DISTINCT FROM 'platform_admin' THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'UNAUTHORIZED',
                'message', 'You are not authorized to manage attendance for this ticket.'
            );
        END IF;
    END IF;

    IF v_event.status = 'cancelled' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'EVENT_CANCELLED',
            'message', 'This event has been cancelled.'
        );
    END IF;

    IF v_reg.status::text IS DISTINCT FROM 'confirmed' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'NOT_CONFIRMED',
            'message', 'Only confirmed passes can check in or check out.'
        );
    END IF;

    SELECT * INTO v_checkin
    FROM public.check_ins
    WHERE registration_id = v_reg.id
      AND member_index = 0
    FOR UPDATE;

    IF p_action = 'check_in' THEN
        IF v_checkin.id IS NOT NULL THEN
            IF v_checkin.status = 'checked_in' THEN
                RETURN jsonb_build_object(
                    'success', true,
                    'attendance_status', 'checked_in',
                    'entry_count', v_checkin.entry_count,
                    'checked_in_at', v_checkin.checked_in_at,
                    'message', 'You are currently checked in inside the venue.'
                );
            END IF;

            -- Re-entry: Increment entry count and set status back to checked_in
            v_new_entry_count := COALESCE(v_checkin.entry_count, 1) + 1;
            UPDATE public.check_ins
            SET status = 'checked_in',
                checked_in_at = v_now,
                entry_count = v_new_entry_count
            WHERE id = v_checkin.id;

            RETURN jsonb_build_object(
                'success', true,
                'attendance_status', 'checked_in',
                'entry_count', v_new_entry_count,
                'checked_in_at', v_now,
                'message', 'Welcome back inside! Re-entry recorded (Entry #' || v_new_entry_count || ').'
            );
        ELSE
            -- First-time check-in
            INSERT INTO public.check_ins (
                registration_id,
                event_id,
                ticket_code,
                staff_id,
                checked_in_at,
                member_index,
                status,
                entry_count
            ) VALUES (
                v_reg.id,
                v_event.id,
                v_reg.ticket_code,
                v_user_id,
                v_now,
                0,
                'checked_in',
                1
            );

            RETURN jsonb_build_object(
                'success', true,
                'attendance_status', 'checked_in',
                'entry_count', 1,
                'checked_in_at', v_now,
                'message', 'Checked in successfully! Welcome to the event.'
            );
        END IF;

    ELSIF p_action = 'check_out' THEN
        IF v_checkin.id IS NOT NULL THEN
            IF v_checkin.status = 'checked_out' THEN
                RETURN jsonb_build_object(
                    'success', true,
                    'attendance_status', 'checked_out',
                    'entry_count', v_checkin.entry_count,
                    'checked_out_at', v_checkin.checked_out_at,
                    'message', 'You are already marked as stepped out. You can re-enter anytime.'
                );
            END IF;

            UPDATE public.check_ins
            SET status = 'checked_out',
                checked_out_at = v_now,
                checked_out_by = v_user_id
            WHERE id = v_checkin.id;

            RETURN jsonb_build_object(
                'success', true,
                'attendance_status', 'checked_out',
                'entry_count', v_checkin.entry_count,
                'checked_out_at', v_now,
                'message', 'Checked out successfully. You can re-enter at any time during the event.'
            );
        ELSE
            -- Initial check-out if stepping out without explicit initial gate scan
            INSERT INTO public.check_ins (
                registration_id,
                event_id,
                ticket_code,
                staff_id,
                checked_in_at,
                checked_out_at,
                checked_out_by,
                member_index,
                status,
                entry_count
            ) VALUES (
                v_reg.id,
                v_event.id,
                v_reg.ticket_code,
                v_user_id,
                v_now,
                v_now,
                v_user_id,
                0,
                'checked_out',
                1
            );

            RETURN jsonb_build_object(
                'success', true,
                'attendance_status', 'checked_out',
                'entry_count', 1,
                'checked_out_at', v_now,
                'message', 'Checked out. You can re-enter at any time during the event.'
            );
        END IF;
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_ACTION',
            'message', 'Invalid attendance action. Must be "check_in" or "check_out".'
        );
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.participant_toggle_attendance(UUID, TEXT) TO authenticated, service_role;

