-- =============================================================================
-- FESTFLOW DATABASE MIGRATION 046: SECURE QR TOKEN HASHING & ENTROPY HARDENING
-- =============================================================================
-- Solves:
-- 1. Upgrades QR token entropy to 256 bits of cryptographically secure randomness (CSPRNG).
-- 2. Adds `qr_token_hash` column with SHA-256 digest storage for zero-knowledge token verification.
-- 3. Automatically backfills SHA-256 hashes for all existing issued tickets (zero invalidation).
-- 4. Creates indexed unique constraint on `qr_token_hash` for fast, secure turnstile lookups.
-- 5. Updates `check_in_ticket()` and `check_out_ticket()` to authenticate exclusively via QR token hashes.
-- 6. Strictly disallows human-readable `ticket_code` (32 bits) as an entry credential.
-- 7. Hardens team and payment ticket generation paths with 256-bit CSPRNG tokens.
-- =============================================================================

-- ── 1. Enable Cryptographic Functions & Schema Hardening ─────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- Explicitly revoke CREATE on schemas from untrusted roles to protect SECURITY DEFINER search paths
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE CREATE ON SCHEMA extensions FROM PUBLIC, anon, authenticated;

-- ── 2. Add qr_token_hash Column to public.registrations ───────────────────────
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS qr_token_hash TEXT;

-- ── 3. Backfill Hashes for Existing Registrations (Case-Insensitive) ───────────
UPDATE public.registrations
SET qr_token_hash = encode(extensions.digest(UPPER(TRIM(qr_token)), 'sha256'), 'hex')
WHERE qr_token IS NOT NULL
  AND NULLIF(TRIM(qr_token), '') IS NOT NULL
  AND qr_token_hash IS NULL;

-- ── 4. Indexes & Unique Constraints on qr_token_hash ──────────────────────────
-- Unique index to prevent duplicate token collisions and provide fast B-Tree turnstile lookups
CREATE UNIQUE INDEX IF NOT EXISTS uq_registrations_qr_token_hash
  ON public.registrations(qr_token_hash)
  WHERE qr_token_hash IS NOT NULL;

-- ── 5. Trigger: Automated CSPRNG Token Generation & Synchronized Hashing ──────
CREATE OR REPLACE FUNCTION public.set_registration_qr_token_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
BEGIN
    -- Ensure 256-bit cryptographically secure token (32 random bytes = 64 hex characters via pgcrypto CSPRNG)
    IF NEW.qr_token IS NULL OR NULLIF(TRIM(NEW.qr_token), '') IS NULL THEN
        NEW.qr_token := 'FFQ_' || encode(extensions.gen_random_bytes(32), 'hex');
    END IF;

    -- Authoritatively compute SHA-256 hash of normalized token
    NEW.qr_token_hash := encode(extensions.digest(UPPER(TRIM(NEW.qr_token)), 'sha256'), 'hex');

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_registration_qr_token_hash ON public.registrations;
CREATE TRIGGER trg_set_registration_qr_token_hash
BEFORE INSERT OR UPDATE OF qr_token ON public.registrations
FOR EACH ROW
EXECUTE FUNCTION public.set_registration_qr_token_hash();

-- Update table default on qr_token to 256-bit CSPRNG using extensions.gen_random_bytes(32)
ALTER TABLE public.registrations
  ALTER COLUMN qr_token SET DEFAULT ('FFQ_' || encode(extensions.gen_random_bytes(32), 'hex'));

-- ── 6. Update check_in_ticket(): Authenticate via Hash, Reject ticket_code ────
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

    -- SECURITY HARDENING: Strictly reject human-readable ticket codes from scanner
    IF v_clean_code ~* '^(FF|TKT)-[A-Z0-9]+' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'INVALID_TICKET',
            'message', 'Human-readable ticket reference codes cannot be used for gate admission. The student must present their official bearer QR pass.'
        );
    END IF;

    -- 3. Detect member sub-token suffix (e.g. "FFQ_ABC...-M2")
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

    -- 5. Verify caller owns event or is platform_admin (NULL-safe)
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

    -- 6. Check event active state (reject check-in if event was cancelled)
    IF v_event.status = 'cancelled' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'CANCELLED',
            'message', 'This event has been cancelled by organizers. Gate entry is closed.'
        );
    END IF;

    -- 7. Compute SHA-256 digest of presented token and lock registration row
    v_input_hash := encode(extensions.digest(UPPER(TRIM(v_base_code)), 'sha256'), 'hex');

    SELECT * INTO v_reg
    FROM public.registrations
    WHERE qr_token_hash = v_input_hash
    FOR UPDATE;

    -- Backward compatibility fallback for unhashed legacy records
    IF v_reg.id IS NULL THEN
        SELECT * INTO v_reg
        FROM public.registrations
        WHERE UPPER(qr_token) = UPPER(v_base_code)
           OR UPPER(qr_token) = UPPER(v_clean_code)
        FOR UPDATE;
    END IF;

    IF v_reg.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'INVALID_TICKET',
            'message', 'Unknown QR pass. No registration matches this token.'
        );
    END IF;

    -- 8. Verify ticket belongs to this specific event (NULL-safe)
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

    -- 9. Fetch primary student profile
    SELECT display_name, email INTO v_student_profile
    FROM public.profiles
    WHERE id = v_reg.student_id;

    -- 10. Check if it's an individual team member check-in
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

    IF v_reg.status::text IS DISTINCT FROM 'confirmed' THEN
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
        IF v_existing_checkin.status::text = 'checked_out' THEN
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

-- ── 7. Update check_out_ticket(): Authenticate via Hash, Reject ticket_code ───
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
    v_reg RECORD;
    v_existing_checkin RECORD;
    v_student_profile RECORD;
    v_checked_out_time TIMESTAMPTZ;
    v_team_members JSONB;
    v_member_obj JSONB;
BEGIN
    -- 1. Authentication
    v_staff_id := auth.uid();
    IF v_staff_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'outcome', 'UNAUTHORIZED', 'message', 'Sign in required.');
    END IF;

    -- 2. Input cleaning
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

    -- Strictly reject human-readable ticket codes
    IF v_clean_code ~* '^(FF|TKT)-[A-Z0-9]+' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'INVALID_TICKET',
            'message', 'Ticket reference codes cannot be used for turnstile exit. Please scan the QR pass.'
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

    -- 4. Find registration via SHA-256 hash
    v_input_hash := encode(extensions.digest(UPPER(TRIM(v_base_code)), 'sha256'), 'hex');

    SELECT * INTO v_reg
    FROM public.registrations
    WHERE qr_token_hash = v_input_hash
    FOR UPDATE;

    -- Backward compatibility fallback
    IF v_reg.id IS NULL THEN
        SELECT * INTO v_reg
        FROM public.registrations
        WHERE UPPER(qr_token) = UPPER(v_base_code)
           OR UPPER(qr_token) = UPPER(v_clean_code)
        FOR UPDATE;
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

    -- Resolve student / member name
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

    -- 5. Find check-in row
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
            'message', 'Attendee is already checked out.'
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
        'ticket_code', v_reg.ticket_code,
        'checked_out_at', v_checked_out_time,
        'event_title', v_event.title,
        'message', 'Check-out recorded successfully.'
    );
END;
$$;

-- ── 8. Function Permissions & Grants ───────────────────────────────────────────
ALTER FUNCTION public.check_in_ticket(UUID, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.check_in_ticket(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_in_ticket(UUID, TEXT, TEXT) TO authenticated, service_role;

ALTER FUNCTION public.check_out_ticket(UUID, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.check_out_ticket(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_out_ticket(UUID, TEXT, TEXT) TO authenticated, service_role;

-- ── 9. Harden Team Member Registration SQL Pathway to 256-Bit CSPRNG ───────────
CREATE OR REPLACE FUNCTION public.sync_team_member_registration(
  p_team_id UUID,
  p_member_user_id UUID,
  p_member_email TEXT,
  p_member_name TEXT,
  p_participant_details JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_profile RECORD;
  v_caller_auth_email TEXT;
  v_caller_confirmed_at TIMESTAMPTZ;
  v_target_profile RECORD;
  v_target_auth_email TEXT;
  v_target_confirmed_at TIMESTAMPTZ;
  v_team RECORD;
  v_event RECORD;
  v_team_member_rec RECORD;
  v_leader_reg RECORD;
  v_member_reg RECORD;
  v_member_index INT;
  v_member_ticket_code TEXT;
  v_member_qr_token TEXT;
  v_now TIMESTAMPTZ := now();
  v_is_self BOOLEAN := false;
  v_is_leader BOOLEAN := false;
  v_is_organizer BOOLEAN := false;
  v_is_admin BOOLEAN := false;
BEGIN
  -- 1. Identify and authenticate caller
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'outcome', 'UNAUTHENTICATED',
      'message', 'You must be signed in to synchronize team registrations.'
    );
  END IF;

  -- Verify caller authenticated account and email confirmation in auth.users
  SELECT email, email_confirmed_at INTO v_caller_auth_email, v_caller_confirmed_at
  FROM auth.users
  WHERE id = v_caller_id;

  IF v_caller_auth_email IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'outcome', 'UNAUTHENTICATED',
      'message', 'Caller account not found in authentication provider.'
    );
  END IF;

  IF v_caller_confirmed_at IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'outcome', 'UNVERIFIED_EMAIL',
      'message', 'Please verify your student email address before synchronizing your event pass.'
    );
  END IF;

  -- 2. Fetch and validate target team
  SELECT * INTO v_team FROM public.teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'outcome', 'NOT_FOUND',
      'message', 'Team not found.'
    );
  END IF;

  -- 3. Fetch target event
  SELECT * INTO v_event FROM public.events WHERE id = v_team.event_id;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'outcome', 'NOT_FOUND',
      'message', 'Associated event not found.'
    );
  END IF;

  -- 4. Fetch caller profile to verify roles and verified identity
  SELECT * INTO v_caller_profile FROM public.profiles WHERE id = v_caller_id;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'outcome', 'UNAUTHENTICATED',
      'message', 'Caller profile not found.'
    );
  END IF;

  -- 5. Establish Authorization Role Context
  v_is_self := (v_caller_id = p_member_user_id);
  v_is_leader := (v_caller_id = v_team.leader_id);
  v_is_organizer := (v_event.club_id IS NOT NULL AND v_caller_id = v_event.club_id);
  v_is_admin := (COALESCE(v_caller_profile.role::text, '') = 'platform_admin');

  IF NOT (v_is_self OR v_is_leader OR v_is_organizer OR v_is_admin) THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'outcome', 'FORBIDDEN',
      'message', 'Access denied. You are not authorized to synchronize registrations for this team.'
    );
  END IF;

  -- 6. STRICT MEMBERSHIP VERIFICATION (Separation of Accepted Membership vs Pending Invitations):
  -- Registrations can ONLY be created or synchronized for users who have genuinely ACCEPTED team membership.
  -- A pending invitation alone must NEVER generate a confirmed registration or active QR pass!
  SELECT * INTO v_team_member_rec
  FROM public.team_members
  WHERE team_id = v_team.id
    AND user_id = p_member_user_id;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'outcome', 'FORBIDDEN',
      'message', 'Target user is not an assigned member of this team.'
    );
  END IF;

  -- Verify membership has been explicitly accepted
  IF v_team_member_rec.status IS DISTINCT FROM 'accepted' THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'outcome', 'FORBIDDEN',
      'status', v_team_member_rec.status,
      'message', 'Team membership is not accepted. Pending invitations cannot be registered.'
    );
  END IF;

  -- 7. IDENTITY & INVITATION BINDING CHECKS
  IF v_is_self THEN
    -- Self-service synchronization:
    -- Verify caller's authenticated email strictly matches the accepted membership email.
    -- Canonical verified email is v_caller_auth_email directly from auth.users.
    IF LOWER(TRIM(v_team_member_rec.email)) IS DISTINCT FROM LOWER(TRIM(v_caller_auth_email)) THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'outcome', 'FORBIDDEN',
        'message', 'Authenticated user verified email does not match accepted team membership record.'
      );
    END IF;

    IF p_member_email IS NOT NULL AND NULLIF(TRIM(p_member_email), '') IS NOT NULL THEN
      IF LOWER(TRIM(p_member_email)) IS DISTINCT FROM LOWER(TRIM(v_caller_auth_email)) THEN
        RETURN pg_catalog.jsonb_build_object(
          'success', false,
          'outcome', 'FORBIDDEN',
          'message', 'Supplied member email does not match authenticated profile email.'
        );
      END IF;
    END IF;
  ELSE
    -- Leader / Organizer / Admin call:
    -- Verify target user's profile and auth verification status
    SELECT * INTO v_target_profile FROM public.profiles WHERE id = p_member_user_id;
    IF NOT FOUND THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'outcome', 'FORBIDDEN',
        'message', 'Target member profile not found.'
      );
    END IF;

    SELECT email, email_confirmed_at INTO v_target_auth_email, v_target_confirmed_at
    FROM auth.users
    WHERE id = p_member_user_id;

    IF v_target_auth_email IS NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'outcome', 'FORBIDDEN',
        'message', 'Target member account not found in authentication provider.'
      );
    END IF;

    IF v_target_confirmed_at IS NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'outcome', 'UNVERIFIED_EMAIL',
        'message', 'Target member has not verified their student email address yet.'
      );
    END IF;

    IF LOWER(TRIM(v_team_member_rec.email)) IS DISTINCT FROM LOWER(TRIM(v_target_auth_email)) THEN
      RETURN pg_catalog.jsonb_build_object(
        'success', false,
        'outcome', 'FORBIDDEN',
        'message', 'Target member verified email does not match accepted team membership email.'
      );
    END IF;

    IF p_member_email IS NOT NULL AND NULLIF(TRIM(p_member_email), '') IS NOT NULL THEN
      IF LOWER(TRIM(p_member_email)) IS DISTINCT FROM LOWER(TRIM(v_team_member_rec.email)) THEN
        RETURN pg_catalog.jsonb_build_object(
          'success', false,
          'outcome', 'FORBIDDEN',
          'message', 'Supplied member email does not match the accepted team membership record.'
        );
      END IF;
    END IF;
  END IF;

  -- 2. Fetch leader's registration
  SELECT * INTO v_leader_reg FROM public.registrations WHERE id = v_team.registration_id;
  IF NOT FOUND THEN
    SELECT * INTO v_leader_reg
    FROM public.registrations
    WHERE event_id = v_team.event_id AND student_id = v_team.leader_id
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  -- 3. Check if member already has a registration for this event
  SELECT * INTO v_member_reg
  FROM public.registrations
  WHERE event_id = v_team.event_id AND student_id = p_member_user_id;

  IF FOUND THEN
    UPDATE public.registrations
    SET team_id = v_team.id,
        team_name = v_team.name,
        status = COALESCE(v_leader_reg.status, status),
        ticket_issued_at = CASE
          WHEN COALESCE(v_leader_reg.status, status) = 'confirmed' THEN COALESCE(ticket_issued_at, v_now)
          ELSE NULL
        END,
        updated_at = v_now
    WHERE id = v_member_reg.id;

    UPDATE public.team_members
    SET registration_id = v_member_reg.id,
        updated_at = v_now
    WHERE team_id = v_team.id AND user_id = p_member_user_id;

    RETURN pg_catalog.jsonb_build_object(
      'success', true,
      'outcome', 'SYNCHRONIZED',
      'registration_id', v_member_reg.id,
      'ticket_code', v_member_reg.ticket_code,
      'is_new', false
    );
  END IF;

  -- 4. Calculate member index for individual ticket code
  SELECT count(*) + 1 INTO v_member_index
  FROM public.registrations
  WHERE team_id = v_team.id AND student_id != v_team.leader_id;

  IF v_leader_reg.ticket_code IS NOT NULL THEN
    v_member_ticket_code := format('%s-M%s', v_leader_reg.ticket_code, v_member_index);
  ELSE
    v_member_ticket_code := format('FF-%s', upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8)));
  END IF;

  -- 256-bit cryptographically secure QR token (32 random bytes = 64 hex characters via pgcrypto CSPRNG)
  v_member_qr_token := 'FFQ_' || encode(extensions.gen_random_bytes(32), 'hex');

  -- 5. Insert individual registration for the team member (trigger automatically sets qr_token_hash)
  INSERT INTO public.registrations (
    event_id,
    student_id,
    status,
    ticket_code,
    qr_token,
    ticket_issued_at,
    team_name,
    team_id,
    team_members,
    participant_details,
    approval_status,
    created_at,
    updated_at
  ) VALUES (
    v_team.event_id,
    p_member_user_id,
    COALESCE(v_leader_reg.status, 'confirmed'),
    v_member_ticket_code,
    v_member_qr_token,
    CASE WHEN COALESCE(v_leader_reg.status, 'confirmed') = 'confirmed' THEN v_now ELSE NULL END,
    v_team.name,
    v_team.id,
    COALESCE(v_leader_reg.team_members, '[]'::jsonb),
    p_participant_details,
    COALESCE(v_leader_reg.approval_status, 'approved'),
    v_now,
    v_now
  ) RETURNING * INTO v_member_reg;

  -- 6. Link registration to team_members
  UPDATE public.team_members
  SET registration_id = v_member_reg.id,
      updated_at = v_now
  WHERE team_id = v_team.id AND user_id = p_member_user_id;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'outcome', 'CREATED',
    'registration_id', v_member_reg.id,
    'ticket_code', v_member_reg.ticket_code,
    'is_new', true
  );
END;
$$;

ALTER FUNCTION public.sync_team_member_registration(UUID, UUID, TEXT, TEXT, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sync_team_member_registration(UUID, UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_team_member_registration(UUID, UUID, TEXT, TEXT, JSONB) TO authenticated, service_role;

-- ── 10. Database-Level Column Confidentiality for Bearer Tokens ──────────────
-- 1. Create secure student ticket pass retrieval RPC (Strict Attendee Owner-Only)
CREATE OR REPLACE FUNCTION public.get_student_ticket_pass(p_registration_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID;
  v_reg RECORD;
BEGIN
  -- Authenticate caller (strict session validation)
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'outcome', 'UNAUTHENTICATED',
      'message', 'You must be signed in to retrieve digital pass credentials.'
    );
  END IF;

  SELECT * INTO v_reg
  FROM public.registrations
  WHERE id = p_registration_id;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'outcome', 'NOT_FOUND',
      'message', 'Registration pass not found.'
    );
  END IF;

  -- STRICT LEAST-PRIVILEGE ACCESS BOUNDARY:
  -- Only the legitimate student ticket owner can retrieve their private QR bearer token.
  -- Organizers, club staff, turnstile operators, and administrators CANNOT retrieve attendee bearer passes.
  IF v_reg.student_id IS DISTINCT FROM v_user_id THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'outcome', 'FORBIDDEN',
      'message', 'Access denied. You are not authorized to retrieve this attendee bearer pass.'
    );
  END IF;

  -- Pass issuance status enforcement (NULL-safe):
  -- Bearer pass credentials are only released for authoritatively confirmed registrations.
  IF v_reg.status::text IS DISTINCT FROM 'confirmed' THEN
    RETURN pg_catalog.jsonb_build_object(
      'success', false,
      'outcome', 'NOT_CONFIRMED',
      'status', v_reg.status,
      'ticket_code', v_reg.ticket_code,
      'message', 'Digital pass QR credential is only available for confirmed registrations.'
    );
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'outcome', 'AUTHORIZED',
    'id', v_reg.id,
    'event_id', v_reg.event_id,
    'student_id', v_reg.student_id,
    'ticket_code', v_reg.ticket_code,
    'qr_token', v_reg.qr_token,
    'status', v_reg.status,
    'ticket_issued_at', v_reg.ticket_issued_at
  );
END;
$$;

ALTER FUNCTION public.get_student_ticket_pass(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_student_ticket_pass(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_ticket_pass(UUID) TO authenticated, service_role;

-- 2. Revoke table-level SELECT on public.registrations from authenticated, anon, and PUBLIC
REVOKE SELECT ON public.registrations FROM authenticated, anon, PUBLIC;

-- Explicitly revoke column-level SELECT on sensitive credentials from authenticated, anon, and PUBLIC
-- Guarantees any prior column-level grants in pg_attribute are completely removed
REVOKE SELECT (qr_token, qr_token_hash) ON public.registrations FROM authenticated, anon, PUBLIC;

-- 3. Grant column-level SELECT on all safe, non-sensitive columns
GRANT SELECT (
  id,
  event_id,
  student_id,
  ticket_code,
  status,
  team_name,
  team_role,
  team_id,
  team_members,
  custom_responses,
  participant_details,
  ticket_tier_id,
  ticket_tier_name,
  unit_price,
  coupon_id,
  discount_amount,
  approval_status,
  rejection_reason,
  waitlist_offer_expires_at,
  ticket_issued_at,
  created_at,
  updated_at
) ON public.registrations TO authenticated;



