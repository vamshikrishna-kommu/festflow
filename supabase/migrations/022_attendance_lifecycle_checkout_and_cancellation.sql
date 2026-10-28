-- ============================================================================
-- FestFlow Migration 022: Attendance Lifecycle, Check-Out & Registration Cancellation
-- ============================================================================
-- Idempotent & non-destructive: Safe to run on existing FestFlow databases.
-- ============================================================================

-- 1. Enhance events table with attendance and cancellation policy fields
ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS allow_reentry BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS require_checkout BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS cancellation_cutoff_hours INT DEFAULT NULL;

-- 2. Enhance check_ins table with check-out and re-entry lifecycle fields
ALTER TABLE public.check_ins
    ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS checked_out_by UUID REFERENCES public.profiles(id) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS checkout_notes TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'checked_in',
    ADD COLUMN IF NOT EXISTS entry_count INT NOT NULL DEFAULT 1;

-- Add check constraint on check_ins status if not already present
DO $$
BEGIN
    ALTER TABLE public.check_ins
        ADD CONSTRAINT chk_check_in_status CHECK (status IN ('checked_in', 'checked_out'));
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN OTHERS THEN null;
END $$;

-- 3. Indexes for fast status filtering and checkout lookups
CREATE INDEX IF NOT EXISTS idx_check_ins_event_status ON public.check_ins(event_id, status);
CREATE INDEX IF NOT EXISTS idx_check_ins_reg_status ON public.check_ins(registration_id, status);
CREATE INDEX IF NOT EXISTS idx_check_ins_checked_out_at ON public.check_ins(checked_out_at);

-- 4. Enable Supabase Realtime for check_ins table
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.check_ins;
EXCEPTION
    WHEN duplicate_object THEN null;
    WHEN undefined_object THEN null;
END $$;

-- 5. Atomic RPC: Check In Ticket (With Re-Entry Policy Support)
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
    v_new_entry_count INT := 1;
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

    -- 9. Fetch primary student profile
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

    -- 12. Check existing check-in row
    SELECT * INTO v_existing_checkin
    FROM public.check_ins
    WHERE registration_id = v_reg.id
      AND member_index = v_member_index
    FOR UPDATE;

    v_checked_in_time := now();

    IF v_existing_checkin.id IS NOT NULL THEN
        -- If attendee is currently checked in
        IF v_existing_checkin.status = 'checked_in' THEN
            RETURN jsonb_build_object(
                'success', false,
                'outcome', 'ALREADY_USED',
                'student_name', COALESCE(v_member_name, v_student_profile.display_name, v_reg.team_name, 'Student Attendee'),
                'ticket_code', v_reg.ticket_code,
                'member_index', v_member_index,
                'checked_in_at', v_existing_checkin.checked_in_at,
                'message', CASE
                    WHEN v_member_name IS NOT NULL THEN 'Team member (' || v_member_name || ') is currently checked in since ' || TO_CHAR(v_existing_checkin.checked_in_at, 'HH12:MI AM') || '.'
                    ELSE 'Attendee is already checked in at the venue since ' || TO_CHAR(v_existing_checkin.checked_in_at, 'HH12:MI AM on Mon DD') || '.'
                END
            );
        END IF;

        -- If attendee is currently checked out, check if event allows re-entry
        IF v_existing_checkin.status = 'checked_out' THEN
            IF COALESCE(v_event.allow_reentry, false) = false THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'outcome', 'ALREADY_USED',
                    'student_name', COALESCE(v_member_name, v_student_profile.display_name, v_reg.team_name, 'Student Attendee'),
                    'ticket_code', v_reg.ticket_code,
                    'member_index', v_member_index,
                    'checked_out_at', v_existing_checkin.checked_out_at,
                    'message', 'Attendee checked out at ' || TO_CHAR(v_existing_checkin.checked_out_at, 'HH12:MI AM') || '. Re-entry is not permitted for this event.'
                );
            END IF;

            -- Re-entry permitted: Update existing record back to checked_in
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

    -- 13. Perform initial atomic check-in insertion
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

    -- 14. Return successful admission confirmation
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

-- 6. Atomic RPC: Check Out Ticket
CREATE OR REPLACE FUNCTION public.check_out_ticket(
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
    v_clean_code TEXT;
    v_base_code TEXT;
    v_member_index INT := 0;
    v_suffix TEXT;
    v_reg RECORD;
    v_existing_checkin RECORD;
    v_student_profile RECORD;
    v_checked_out_time TIMESTAMPTZ;
    v_team_members JSONB;
    v_member_name TEXT := NULL;
    v_member_obj JSONB;
BEGIN
    -- 1. Verify caller is authenticated
    v_staff_id := auth.uid();
    IF v_staff_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'UNAUTHORIZED',
            'message', 'You must be signed in to perform attendee check-out.'
        );
    END IF;

    -- 2. Clean input ticket code
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

    -- Extract member index if present
    v_base_code := v_clean_code;
    IF v_clean_code ~* '(-M[0-9]+)$' THEN
        v_suffix := (regexp_match(v_clean_code, '(-M[0-9]+)$', 'i'))[1];
        v_member_index := SUBSTRING(v_suffix FROM 3)::INT;
        v_base_code := SUBSTRING(v_clean_code FROM 1 FOR length(v_clean_code) - length(v_suffix));
    END IF;

    -- 3. Fetch event & verify permissions
    SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
    IF v_event.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'outcome', 'UNAUTHORIZED', 'message', 'Event not found.');
    END IF;

    IF v_event.club_id <> v_staff_id THEN
        SELECT role::text INTO v_staff_role FROM public.profiles WHERE id = v_staff_id;
        IF COALESCE(v_staff_role, '') <> 'platform_admin' THEN
            RETURN jsonb_build_object(
                'success', false,
                'outcome', 'UNAUTHORIZED',
                'message', 'You are not authorized to check out attendees for this event.'
            );
        END IF;
    END IF;

    -- 4. Find registration
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
            'message', 'No registration found for this ticket.'
        );
    END IF;

    IF v_reg.event_id <> p_event_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'WRONG_EVENT',
            'message', 'Ticket belongs to a different event.'
        );
    END IF;

    -- Resolve student / member name
    SELECT display_name INTO v_student_profile FROM public.profiles WHERE id = v_reg.student_id;
    IF v_member_index > 0 AND v_reg.team_members IS NOT NULL THEN
        v_team_members := v_reg.team_members;
        IF jsonb_array_length(v_team_members) >= v_member_index THEN
            v_member_obj := v_team_members->(v_member_index - 1);
            v_member_name := COALESCE(v_member_obj->>'name', 'Team Member #' || v_member_index);
        END IF;
    END IF;

    -- 5. Find check-in row
    SELECT * INTO v_existing_checkin
    FROM public.check_ins
    WHERE registration_id = v_reg.id
      AND member_index = v_member_index
    FOR UPDATE;

    -- Guard: Cannot check out if never checked in
    IF v_existing_checkin.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'NOT_CHECKED_IN',
            'student_name', COALESCE(v_member_name, v_student_profile.display_name, v_reg.team_name, 'Student Attendee'),
            'ticket_code', v_reg.ticket_code,
            'message', 'Cannot check out: Attendee has not checked in to this event yet.'
        );
    END IF;

    -- Guard: Cannot check out if already checked out
    IF v_existing_checkin.status = 'checked_out' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'ALREADY_CHECKED_OUT',
            'student_name', COALESCE(v_member_name, v_student_profile.display_name, v_reg.team_name, 'Student Attendee'),
            'ticket_code', v_reg.ticket_code,
            'checked_out_at', v_existing_checkin.checked_out_at,
            'message', 'Attendee was already checked out at ' || TO_CHAR(v_existing_checkin.checked_out_at, 'HH12:MI AM on Mon DD') || '.'
        );
    END IF;

    -- 6. Perform check-out
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
        'member_index', v_member_index,
        'member_name', v_member_name,
        'ticket_code', v_reg.ticket_code,
        'checked_in_at', v_existing_checkin.checked_in_at,
        'checked_out_at', v_checked_out_time,
        'allow_reentry', COALESCE(v_event.allow_reentry, false),
        'message', 'Attendee checked out successfully.' ||
            CASE WHEN COALESCE(v_event.allow_reentry, false) THEN ' (Re-entry permitted).' ELSE ' (Single entry).' END
    );
END;
$$;

-- 7. Enhanced Registration Cancellation RPC with Policy & Gate Checks
CREATE OR REPLACE FUNCTION public.cancel_registration_with_policy(
    p_registration_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_reg RECORD;
    v_event RECORD;
    v_cutoff_hours INT;
    v_cutoff_timestamp TIMESTAMPTZ;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
    END IF;

    SELECT * INTO v_reg FROM public.registrations WHERE id = p_registration_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Registration not found.');
    END IF;

    SELECT * INTO v_event FROM public.events WHERE id = v_reg.event_id;

    -- Permissions: Caller must be student owner OR event organizer OR platform_admin
    SELECT role::text INTO v_user_role FROM public.profiles WHERE id = v_user_id;

    IF v_reg.student_id <> v_user_id AND v_event.club_id <> v_user_id AND COALESCE(v_user_role, '') <> 'platform_admin' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'FORBIDDEN',
            'message', 'You do not have permission to cancel this registration.'
        );
    END IF;

    -- Cannot cancel an already cancelled registration
    IF v_reg.status = 'cancelled' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ALREADY_CANCELLED',
            'message', 'Registration is already cancelled.'
        );
    END IF;

    -- Gate Check: Cannot cancel if ticket has already been used for entry
    IF EXISTS (
        SELECT 1 FROM public.check_ins
        WHERE registration_id = p_registration_id
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ALREADY_CHECKED_IN',
            'message', 'Cannot cancel a pass that has already been verified at the entry gate.'
        );
    END IF;

    -- Policy Check: Student cancellation before event start
    IF v_reg.student_id = v_user_id AND COALESCE(v_user_role, '') <> 'platform_admin' THEN
        -- Check event start date
        IF now() >= v_event.start_date THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'EVENT_STARTED',
                'message', 'Pass cannot be cancelled because the event has already started.'
            );
        END IF;

        -- Check cancellation cutoff hours if specified
        v_cutoff_hours := v_event.cancellation_cutoff_hours;
        IF v_cutoff_hours IS NOT NULL AND v_cutoff_hours > 0 THEN
            v_cutoff_timestamp := v_event.start_date - (v_cutoff_hours * interval '1 hour');
            IF now() >= v_cutoff_timestamp THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error_code', 'CUTOFF_EXCEEDED',
                    'message', 'Cancellation deadline passed. Cancellations are closed ' || v_cutoff_hours || ' hours prior to event start.'
                );
            END IF;
        END IF;
    END IF;

    -- Bypass tamper triggers for trusted server-side cancellation
    PERFORM set_config('festflow.internal_system_operation', 'true', true);

    UPDATE public.registrations
    SET status = 'cancelled'::registration_status,
        cancelled_at = now(),
        updated_at = now()
    WHERE id = p_registration_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Registration cancelled successfully. Your seat has been released.'
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_in_ticket(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_out_ticket(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_registration_with_policy(UUID, TEXT) TO authenticated;
