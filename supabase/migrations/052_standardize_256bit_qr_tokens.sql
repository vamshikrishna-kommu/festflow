-- =============================================================================
-- FESTFLOW DATABASE MIGRATION 052: STANDARDIZE 256-BIT CSPRNG QR TOKENS & HASH LOOKUPS
-- =============================================================================
-- Purpose & Audit Remediation:
--   Resolves release-gate audit findings where certain team/payment paths generated
--   weaker or non-CSPRNG tokens and updates check-in/out to avoid unindexed plaintext fallbacks.
--
-- Historical Migration Documentation (Historical files remain untouched):
--   1. 027_fix_gen_random_bytes.sql: Replaced `gen_random_bytes(12)` inside
--      `review_payment_submission()` with 96-bit `SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 24)`.
--      Because `trg_set_registration_qr_token_hash` only generates a random token when `qr_token`
--      is empty, team members confirmed via payment approval still received 96-bit tokens.
--   2. 036_auto_verify_upi_payment.sql: Used 48-bit `MD5(RANDOM()::TEXT)`, already dropped in
--      037_secure_upi_payment_lifecycle.sql.
--   3. 046_secure_qr_token_hashing.sql: Standardized column DEFAULT, trigger, and
--      `sync_team_member_registration()` to 32-byte CSPRNG, added `qr_token_hash TEXT`,
--      and added SHA-256 verification to `check_in_ticket()` / `check_out_ticket()` while
--      keeping an unindexed plaintext `UPPER(qr_token)` fallback.
--   4. 048_secure_team_invitations.sql & 050_fix_accept_team_invitation_enum.sql: Generated
--      `FFQ_` + concatenated dual UUIDv4 (~244 random bits) and declared `v_member_qr_hash BYTEA`
--      instead of `TEXT`, relying on 046's trigger to overwrite `qr_token_hash`.
--   5. 043_production_excellence_and_scalability_phase9.sql: Created legacy `validate_and_check_in_ticket`
--      without organizer authorization checks or QR token hash verification.
--
-- Strategy:
--   - Historical migrations stay immutable so previously deployed databases maintain linear
--     migration integrity.
--   - All existing issued tickets (regardless of token length) are idempotently backfilled with
--     accurate SHA-256 `qr_token_hash` values before removing plaintext fallback lookups,
--     guaranteeing zero invalidation of already-issued tickets.
--   - Every newly generated registration/team QR token in PostgreSQL uses 32 CSPRNG bytes
--     (`extensions.gen_random_bytes(32)`) encoded as `'FFQ_' || UPPER(encode(..., 'hex'))` (256 bits)
--     with consistent hex SHA-256 `qr_token_hash TEXT`.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- ── 1. Safe Idempotent Backfill for All Existing Issued Tickets ────────────────
-- Guarantees 100% of existing tickets have an authoritative SHA-256 `qr_token_hash`
-- matching `UPPER(TRIM(qr_token))` so indexed hash-only lookups preserve legacy tickets.
UPDATE public.registrations
SET qr_token_hash = encode(extensions.digest(UPPER(TRIM(qr_token)), 'sha256'), 'hex')
WHERE qr_token IS NOT NULL
  AND NULLIF(TRIM(qr_token), '') IS NOT NULL
  AND qr_token_hash IS DISTINCT FROM encode(extensions.digest(UPPER(TRIM(qr_token)), 'sha256'), 'hex');

-- ── 2. Standardize Column Default & Trigger Format (256-Bit Uppercase Hex) ─────
CREATE OR REPLACE FUNCTION public.set_registration_qr_token_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
BEGIN
    -- Generate 256-bit cryptographically secure token (32 random bytes = 64 hex chars via pgcrypto CSPRNG)
    IF NEW.qr_token IS NULL OR NULLIF(TRIM(NEW.qr_token), '') IS NULL THEN
        NEW.qr_token := 'FFQ_' || UPPER(encode(extensions.gen_random_bytes(32), 'hex'));
    END IF;

    -- Authoritatively store hex-encoded SHA-256 digest of normalized token
    NEW.qr_token_hash := encode(extensions.digest(UPPER(TRIM(NEW.qr_token)), 'sha256'), 'hex');

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_registration_qr_token_hash ON public.registrations;
CREATE TRIGGER trg_set_registration_qr_token_hash
BEFORE INSERT OR UPDATE OF qr_token ON public.registrations
FOR EACH ROW
EXECUTE FUNCTION public.set_registration_qr_token_hash();

ALTER TABLE public.registrations
  ALTER COLUMN qr_token SET DEFAULT ('FFQ_' || UPPER(encode(extensions.gen_random_bytes(32), 'hex')));

-- ── 3. Standardize review_payment_submission(): 256-Bit CSPRNG + SHA-256 Hash ─
CREATE OR REPLACE FUNCTION public.review_payment_submission(
    p_payment_id UUID,
    p_decision TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_reviewer_id UUID;
    v_reviewer_role TEXT;
    v_sub RECORD;
    v_reg RECORD;
    v_event RECORD;
    v_issued_ticket_code TEXT;
    v_leader_qr_token TEXT;
    v_leader_qr_hash TEXT;
    v_clean_notes TEXT;
    v_now TIMESTAMPTZ := now();
    v_member_rec RECORD;
    v_member_reg RECORD;
    v_member_idx INT := 0;
    v_member_ticket_code TEXT;
    v_member_qr_token TEXT;
    v_member_qr_hash TEXT;
    v_final_member_qr TEXT;
    v_final_member_hash TEXT;
    v_synced_members_count INT := 0;
BEGIN
    -- 1. Authentication check
    v_reviewer_id := auth.uid();
    IF v_reviewer_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'UNAUTHENTICATED',
            'message', 'You must be signed in to review payment submissions.'
        );
    END IF;

    -- Validate decision argument
    IF p_decision NOT IN ('approved', 'rejected') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_DECISION',
            'message', 'Decision must be either "approved" or "rejected".'
        );
    END IF;

    v_clean_notes := TRIM(COALESCE(p_notes, ''));

    IF p_decision = 'rejected' AND v_clean_notes = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'REJECTION_REASON_REQUIRED',
            'message', 'A clear reason for rejection is required to inform the student.'
        );
    END IF;

    -- 2. Lock payment submission row for update
    SELECT * INTO v_sub
    FROM public.payment_submissions
    WHERE id = p_payment_id
    FOR UPDATE;

    IF v_sub.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'NOT_FOUND',
            'message', 'Payment submission not found.'
        );
    END IF;

    IF v_sub.status <> 'pending_review' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ALREADY_REVIEWED',
            'message', 'This payment has already been ' || v_sub.status || '.'
        );
    END IF;

    -- 3. Lock associated registration row
    SELECT * INTO v_reg
    FROM public.registrations
    WHERE id = v_sub.registration_id
    FOR UPDATE;

    IF v_reg.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'REGISTRATION_NOT_FOUND',
            'message', 'Associated registration record could not be found.'
        );
    END IF;

    -- 4. Fetch target event
    SELECT * INTO v_event
    FROM public.events
    WHERE id = v_sub.event_id;

    IF v_event.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'EVENT_NOT_FOUND',
            'message', 'Target event could not be found.'
        );
    END IF;

    -- 5. Authorization (host club owner, platform admin, or active club reviewer)
    IF v_event.club_id <> v_reviewer_id THEN
        SELECT role::text INTO v_reviewer_role
        FROM public.profiles
        WHERE id = v_reviewer_id;

        IF COALESCE(v_reviewer_role, '') <> 'platform_admin' THEN
            IF NOT EXISTS (
                SELECT 1 FROM public.club_members cm
                WHERE cm.club_id = v_event.club_id
                  AND cm.user_id = v_reviewer_id
                  AND cm.status = 'active'
                  AND cm.role IN ('owner', 'admin', 'payment_reviewer')
            ) THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error_code', 'UNAUTHORIZED',
                    'message', 'You do not have permission to review payments for this event.'
                );
            END IF;
        END IF;
    END IF;

    -- 6. Check registration state
    IF v_reg.status = 'cancelled' THEN
        UPDATE public.payment_submissions
        SET status = 'rejected',
            reviewer_id = v_reviewer_id,
            reviewed_at = v_now,
            review_notes = 'Registration was cancelled prior to review.',
            updated_at = v_now
        WHERE id = p_payment_id;

        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'REGISTRATION_CANCELLED',
            'message', 'Registration was cancelled by the student.'
        );
    END IF;

    -- 7. Execute Decision
    IF p_decision = 'approved' THEN
        v_issued_ticket_code := COALESCE(
            NULLIF(v_reg.ticket_code, ''),
            'TKT-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8)) || '-' || TO_CHAR(v_now, 'MIIS')
        );
        v_leader_qr_token := COALESCE(
            NULLIF(TRIM(v_reg.qr_token), ''),
            'FFQ_' || UPPER(encode(extensions.gen_random_bytes(32), 'hex'))
        );
        v_leader_qr_hash := encode(extensions.digest(UPPER(TRIM(v_leader_qr_token)), 'sha256'), 'hex');

        UPDATE public.payment_submissions
        SET status = 'approved',
            reviewer_id = v_reviewer_id,
            reviewed_at = v_now,
            review_notes = CASE WHEN v_clean_notes <> '' THEN v_clean_notes ELSE 'Payment verified and approved by organizer.' END,
            updated_at = v_now
        WHERE id = p_payment_id;

        UPDATE public.registrations
        SET status = 'confirmed',
            ticket_code = v_issued_ticket_code,
            qr_token = v_leader_qr_token,
            qr_token_hash = v_leader_qr_hash,
            ticket_issued_at = COALESCE(ticket_issued_at, v_now),
            rejection_reason = NULL,
            updated_at = v_now
        WHERE id = v_sub.registration_id;

        IF v_reg.team_id IS NOT NULL AND (v_reg.team_role = 'leader' OR v_event.participation_type = 'team') THEN
            FOR v_member_rec IN
                SELECT tm.*, p.display_name, p.email AS profile_email
                FROM public.team_members tm
                LEFT JOIN public.profiles p ON p.id = tm.user_id
                WHERE tm.team_id = v_reg.team_id
                  AND tm.status = 'accepted'
                  AND tm.user_id <> v_reg.student_id
                ORDER BY tm.created_at ASC
            LOOP
                v_member_idx := v_member_idx + 1;
                v_member_ticket_code := format('%s-M%s', v_issued_ticket_code, v_member_idx);
                -- 256-bit cryptographically secure QR token (32 random bytes = 64 hex chars via pgcrypto CSPRNG)
                v_member_qr_token := 'FFQ_' || UPPER(encode(extensions.gen_random_bytes(32), 'hex'));
                v_member_qr_hash := encode(extensions.digest(UPPER(TRIM(v_member_qr_token)), 'sha256'), 'hex');

                SELECT * INTO v_member_reg
                FROM public.registrations
                WHERE event_id = v_event.id AND student_id = v_member_rec.user_id
                FOR UPDATE;

                IF v_member_reg.id IS NOT NULL THEN
                    v_final_member_qr := COALESCE(NULLIF(TRIM(v_member_reg.qr_token), ''), v_member_qr_token);
                    v_final_member_hash := encode(extensions.digest(UPPER(TRIM(v_final_member_qr)), 'sha256'), 'hex');

                    UPDATE public.registrations
                    SET status = 'confirmed',
                        ticket_code = COALESCE(NULLIF(ticket_code, ''), v_member_ticket_code),
                        qr_token = v_final_member_qr,
                        qr_token_hash = v_final_member_hash,
                        ticket_issued_at = COALESCE(ticket_issued_at, v_now),
                        team_id = v_reg.team_id,
                        team_name = v_reg.team_name,
                        team_role = 'member',
                        rejection_reason = NULL,
                        updated_at = v_now
                    WHERE id = v_member_reg.id;
                ELSE
                    INSERT INTO public.registrations (
                        event_id,
                        student_id,
                        status,
                        ticket_code,
                        qr_token,
                        qr_token_hash,
                        ticket_issued_at,
                        team_name,
                        team_id,
                        team_role,
                        participant_details,
                        approval_status,
                        created_at,
                        updated_at
                    ) VALUES (
                        v_event.id,
                        v_member_rec.user_id,
                        'confirmed',
                        v_member_ticket_code,
                        v_member_qr_token,
                        v_member_qr_hash,
                        v_now,
                        v_reg.team_name,
                        v_reg.team_id,
                        'member',
                        jsonb_build_object(
                            'student_name', COALESCE(v_member_rec.display_name, 'Squad Member'),
                            'email', COALESCE(v_member_rec.profile_email, '')
                        ),
                        'approved',
                        v_now,
                        v_now
                    ) RETURNING * INTO v_member_reg;
                END IF;

                UPDATE public.team_members
                SET registration_id = v_member_reg.id,
                    updated_at = v_now
                WHERE id = v_member_rec.id;

                INSERT INTO public.in_app_notifications (
                    user_id,
                    title,
                    message,
                    type,
                    link
                ) VALUES (
                    v_member_rec.user_id,
                    'Team Pass Ready! 🎉',
                    'Payment for your team (' || COALESCE(v_reg.team_name, 'Squad') || ') for ' || v_event.title || ' has been approved. Your pass is now active!',
                    'ticket_issued',
                    '/student/tickets/' || v_member_reg.id
                );

                v_synced_members_count := v_synced_members_count + 1;
            END LOOP;
        END IF;

        INSERT INTO public.payment_audit_logs (
            payment_submission_id,
            registration_id,
            event_id,
            action,
            actor_id,
            actor_role,
            previous_status,
            new_status,
            notes,
            metadata
        ) VALUES (
            p_payment_id,
            v_sub.registration_id,
            v_sub.event_id,
            'approved',
            v_reviewer_id,
            'organizer',
            'pending_review',
            'approved',
            v_clean_notes,
            jsonb_build_object(
                'ticket_code', v_issued_ticket_code,
                'utr', v_sub.transaction_reference,
                'amount', v_sub.amount,
                'squad_members_activated', v_synced_members_count
            )
        );

        INSERT INTO public.in_app_notifications (
            user_id,
            title,
            message,
            type,
            link
        ) VALUES (
            v_sub.student_id,
            'Payment Approved! 🎉',
            'Your payment of ' || v_sub.currency || ' ' || v_sub.amount::text || ' for ' || v_event.title || ' has been approved. Your digital entry pass is now ready!',
            'payment_approved',
            '/student/tickets/' || v_sub.registration_id
        );

        RETURN jsonb_build_object(
            'success', true,
            'status', 'approved',
            'ticket_code', v_issued_ticket_code,
            'registration_id', v_sub.registration_id,
            'squad_members_activated', v_synced_members_count,
            'message', 'Payment approved successfully. Entry pass issued.'
        );

    ELSE -- p_decision = 'rejected'
        UPDATE public.payment_submissions
        SET status = 'rejected',
            reviewer_id = v_reviewer_id,
            reviewed_at = v_now,
            review_notes = v_clean_notes,
            updated_at = v_now
        WHERE id = p_payment_id;

        UPDATE public.registrations
        SET status = 'rejected',
            rejection_reason = v_clean_notes,
            updated_at = v_now
        WHERE id = v_sub.registration_id;

        IF v_reg.team_id IS NOT NULL AND (v_reg.team_role = 'leader' OR v_event.participation_type = 'team') THEN
            UPDATE public.registrations
            SET status = 'rejected',
                rejection_reason = v_clean_notes,
                updated_at = v_now
            WHERE team_id = v_reg.team_id AND id <> v_sub.registration_id;

            INSERT INTO public.in_app_notifications (
                user_id,
                title,
                message,
                type,
                link
            )
            SELECT tm.user_id,
                   'Team Payment Issue',
                   'The organizer could not verify payment for ' || v_event.title || ': ' || v_clean_notes,
                   'payment_rejected',
                   '/student/dashboard?tab=cancelled'
            FROM public.team_members tm
            WHERE tm.team_id = v_reg.team_id
              AND tm.status = 'accepted'
              AND tm.user_id <> v_reg.student_id;
        END IF;

        INSERT INTO public.payment_audit_logs (
            payment_submission_id,
            registration_id,
            event_id,
            action,
            actor_id,
            actor_role,
            previous_status,
            new_status,
            notes,
            metadata
        ) VALUES (
            p_payment_id,
            v_sub.registration_id,
            v_sub.event_id,
            'rejected',
            v_reviewer_id,
            'organizer',
            'pending_review',
            'rejected',
            v_clean_notes,
            jsonb_build_object(
                'utr', v_sub.transaction_reference,
                'amount', v_sub.amount,
                'rejection_reason', v_clean_notes
            )
        );

        INSERT INTO public.in_app_notifications (
            user_id,
            title,
            message,
            type,
            link
        ) VALUES (
            v_sub.student_id,
            'Payment Verification Issue',
            'Your payment reference for ' || v_event.title || ' could not be verified: ' || v_clean_notes || '. Please check your transaction details and resubmit.',
            'payment_rejected',
            '/student/payments/' || v_sub.registration_id
        );

        RETURN jsonb_build_object(
            'success', true,
            'status', 'rejected',
            'message', 'Payment rejected. Student notified to resubmit.'
        );
    END IF;
END;
$$;

ALTER FUNCTION public.review_payment_submission(UUID, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.review_payment_submission(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_payment_submission(UUID, TEXT, TEXT) TO authenticated, service_role;

-- ── 4. Standardize accept_team_invitation(): 256-Bit CSPRNG + TEXT SHA-256 ────
CREATE OR REPLACE FUNCTION public.accept_team_invitation(
    p_token TEXT,
    p_participant_details JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_clean_token TEXT;
    v_token_hash BYTEA;
    v_caller_id UUID;
    v_user_profile RECORD;
    v_user_email TEXT;
    v_email_confirmed_at TIMESTAMPTZ;
    v_invitation RECORD;
    v_team RECORD;
    v_event RECORD;
    v_leader_reg RECORD;
    v_existing_membership RECORD;
    v_accepted_count INT;
    v_max_size INT;
    v_member_name TEXT;
    v_college TEXT;
    v_phone TEXT;
    v_student_id TEXT;
    v_target_status public.registration_status := 'confirmed'::public.registration_status;
    v_target_issued_at TIMESTAMPTZ;
    v_member_reg RECORD;
    v_member_idx INT;
    v_member_ticket_code TEXT;
    v_member_qr_token TEXT;
    v_member_qr_hash TEXT;
    v_final_member_qr TEXT;
    v_final_member_hash TEXT;
    v_member_rec RECORD;
    v_now TIMESTAMPTZ := now();
BEGIN
    v_clean_token := TRIM(COALESCE(p_token, ''));
    IF LENGTH(v_clean_token) < 4 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_TOKEN',
            'message', 'Invalid or missing invitation token.'
        );
    END IF;

    -- 1. Identify caller
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'UNAUTHENTICATED',
            'message', 'Sign in required to accept team invitations.'
        );
    END IF;

    -- 2. Fetch caller profile
    SELECT * INTO v_user_profile
    FROM public.profiles
    WHERE id = v_caller_id;

    IF v_user_profile.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'PROFILE_NOT_FOUND',
            'message', 'Student profile record could not be found.'
        );
    END IF;

    -- 3. Verify student email confirmation
    SELECT email, email_confirmed_at INTO v_user_email, v_email_confirmed_at
    FROM auth.users
    WHERE id = v_caller_id;

    IF v_user_email IS NULL THEN
        v_user_email := v_user_profile.email;
    END IF;

    IF v_email_confirmed_at IS NULL AND auth.role() <> 'service_role' AND EXISTS (SELECT 1 FROM auth.users WHERE id = v_caller_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'EMAIL_NOT_VERIFIED',
            'message', 'Please verify your student email address before accepting this squad invitation.'
        );
    END IF;

    -- 4. Calculate SHA-256 hash of invitation token to match unguessable team invite tokens
    v_token_hash := extensions.digest(UPPER(v_clean_token), 'sha256');

    SELECT * INTO v_invitation
    FROM public.team_invitations
    WHERE (
        token = v_clean_token
        OR token_hash = v_token_hash
        OR invite_code = v_clean_token
    )
    FOR UPDATE;

    IF v_invitation.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVITATION_NOT_FOUND',
            'message', 'Invalid or expired team invitation token.'
        );
    END IF;

    IF v_invitation.status = 'revoked' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVITATION_REVOKED',
            'message', 'This squad invitation has been revoked by the team leader.'
        );
    END IF;

    IF v_invitation.status = 'accepted' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ALREADY_ACCEPTED',
            'message', 'This squad invitation has already been accepted and claimed.'
        );
    END IF;

    IF v_invitation.status = 'declined' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVITATION_DECLINED',
            'message', 'This squad invitation was previously declined.'
        );
    END IF;

    IF v_invitation.expires_at < v_now THEN
        UPDATE public.team_invitations SET status = 'expired', updated_at = v_now WHERE id = v_invitation.id;
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVITATION_EXPIRED',
            'message', 'This squad invitation has expired.'
        );
    END IF;

    -- 5. Strict recipient identity match
    IF v_invitation.email IS NOT NULL AND TRIM(v_invitation.email) <> '' THEN
        IF lower(TRIM(v_user_email)) <> lower(TRIM(v_invitation.email)) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'EMAIL_MISMATCH',
                'message', format('This invitation was sent to %s. You are signed in as %s. Please switch accounts to accept.', v_invitation.email, v_user_email)
            );
        END IF;
    END IF;

    -- 6. Lock and fetch team
    SELECT * INTO v_team
    FROM public.teams
    WHERE id = v_invitation.team_id
    FOR UPDATE;

    IF v_team.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TEAM_NOT_FOUND',
            'message', 'The team associated with this invitation does not exist.'
        );
    END IF;

    IF v_team.status = 'disbanded' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TEAM_DISBANDED',
            'message', 'This squad has been disbanded by the leader.'
        );
    END IF;

    IF v_team.leader_id = v_caller_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ALREADY_LEADER',
            'message', 'You are the leader of this team and cannot accept an invitation to your own squad.'
        );
    END IF;

    -- 7. Fetch and validate event
    SELECT * INTO v_event
    FROM public.events
    WHERE id = v_team.event_id;

    IF v_event.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'EVENT_NOT_FOUND',
            'message', 'Event for this team could not be found.'
        );
    END IF;

    IF v_event.status <> 'published' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'EVENT_NOT_ACTIVE',
            'message', 'Registrations for this event are currently closed.'
        );
    END IF;

    IF v_event.registration_closes_at IS NOT NULL AND v_event.registration_closes_at <= v_now THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'DEADLINE_PASSED',
            'message', 'Registration deadline for this event has passed.'
        );
    END IF;

    IF v_event.start_date <= v_now THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'EVENT_STARTED',
            'message', 'This event has already started.'
        );
    END IF;

    -- 8. Cross-team isolation & duplicate checks
    SELECT * INTO v_existing_membership
    FROM public.team_members
    WHERE event_id = v_team.event_id
      AND (user_id = v_caller_id OR lower(email) = lower(v_user_email))
      AND status = 'accepted'
      AND team_id <> v_team.id;

    IF v_existing_membership.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ALREADY_IN_TEAM',
            'message', 'You are already a confirmed member of another squad for this event.'
        );
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.teams
        WHERE event_id = v_team.event_id
          AND leader_id = v_caller_id
          AND id <> v_team.id
          AND status != 'disbanded'
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ALREADY_IN_TEAM',
            'message', 'You are already the leader of a squad for this event.'
        );
    END IF;

    -- 9. Capacity check
    v_max_size := COALESCE(v_event.max_team_size, 5);
    SELECT count(*) INTO v_accepted_count
    FROM public.team_members
    WHERE team_id = v_team.id AND status = 'accepted';

    IF v_accepted_count >= v_max_size THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TEAM_FULL',
            'message', format('This squad has reached maximum team capacity (%s/%s members).', v_accepted_count, v_max_size)
        );
    END IF;

    -- 10. Extract participant details safely
    v_member_name := COALESCE(
        NULLIF(TRIM(p_participant_details ->> 'student_name'), ''),
        NULLIF(TRIM(p_participant_details ->> 'full_name'), ''),
        v_user_profile.display_name,
        split_part(v_user_email, '@', 1)
    );
    v_college := COALESCE(p_participant_details ->> 'college_name', '');
    v_phone := COALESCE(p_participant_details ->> 'phone', '');
    v_student_id := COALESCE(p_participant_details ->> 'id_card_number', '');

    -- 11. Lock leader's registration record
    SELECT * INTO v_leader_reg FROM public.registrations WHERE id = v_team.registration_id;
    IF v_leader_reg.id IS NULL THEN
        SELECT * INTO v_leader_reg
        FROM public.registrations
        WHERE event_id = v_team.event_id AND student_id = v_team.leader_id
        ORDER BY created_at DESC LIMIT 1;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.team_members WHERE team_id = v_team.id AND (user_id = v_team.leader_id OR role = 'leader')
    ) THEN
        IF EXISTS (
            SELECT 1 FROM public.team_members WHERE event_id = v_team.event_id AND user_id = v_team.leader_id
        ) THEN
            UPDATE public.team_members
            SET team_id = v_team.id,
                role = 'leader',
                status = 'accepted',
                registration_id = COALESCE(v_leader_reg.id, public.team_members.registration_id),
                updated_at = v_now
            WHERE event_id = v_team.event_id AND user_id = v_team.leader_id;
        ELSE
            INSERT INTO public.team_members (
                team_id,
                event_id,
                user_id,
                registration_id,
                name,
                email,
                role,
                status,
                college,
                phone,
                joined_at,
                created_at,
                updated_at
            )
            SELECT
                v_team.id,
                v_team.event_id,
                v_team.leader_id,
                v_leader_reg.id,
                COALESCE(v_leader_reg.participant_details->>'student_name', p.display_name, 'Team Leader'),
                COALESCE(lower(trim(v_leader_reg.participant_details->>'email')), lower(trim(p.email)), ''),
                'leader',
                'accepted',
                COALESCE(v_leader_reg.participant_details->>'college_name', sp.college_name, ''),
                COALESCE(v_leader_reg.participant_details->>'phone', ''),
                v_team.created_at,
                v_team.created_at,
                v_team.created_at
            FROM public.profiles p
            LEFT JOIN public.student_profiles sp ON sp.profile_id = p.id
            WHERE p.id = v_team.leader_id
            ON CONFLICT (team_id, email) DO UPDATE
            SET role = 'leader', status = 'accepted';
        END IF;
    END IF;

    -- 12. Determine member pass status based on event & leader payment state
    IF v_event.is_free = true OR COALESCE(v_event.price, 0) <= 0 THEN
        IF v_event.approval_type = 'manual' AND COALESCE(v_leader_reg.status::text, '') = 'pending_approval' THEN
            v_target_status := 'pending_approval'::public.registration_status;
            v_target_issued_at := NULL;
        ELSE
            v_target_status := 'confirmed'::public.registration_status;
            v_target_issued_at := v_now;
        END IF;
    ELSE
        IF v_leader_reg.id IS NOT NULL AND v_leader_reg.status::text = 'confirmed' AND v_leader_reg.ticket_issued_at IS NOT NULL THEN
            v_target_status := 'confirmed'::public.registration_status;
            v_target_issued_at := v_now;
        ELSE
            v_target_status := 'pending_payment'::public.registration_status;
            v_target_issued_at := NULL;
        END IF;
    END IF;

    -- 13. Generate ticket code and standardized 256-bit CSPRNG QR token with hex SHA-256 hash
    SELECT count(*) + 1 INTO v_member_idx
    FROM public.team_members
    WHERE team_id = v_team.id AND user_id <> v_team.leader_id;

    IF v_leader_reg.ticket_code IS NOT NULL THEN
        v_member_ticket_code := format('%s-M%s', v_leader_reg.ticket_code, v_member_idx);
    ELSE
        v_member_ticket_code := format('FF-%s', UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8)));
    END IF;

    v_member_qr_token := 'FFQ_' || UPPER(encode(extensions.gen_random_bytes(32), 'hex'));
    v_member_qr_hash := encode(extensions.digest(UPPER(TRIM(v_member_qr_token)), 'sha256'), 'hex');

    SELECT * INTO v_member_reg
    FROM public.registrations
    WHERE event_id = v_team.event_id AND student_id = v_caller_id
    FOR UPDATE;

    IF v_member_reg.id IS NOT NULL THEN
        v_final_member_qr := COALESCE(NULLIF(TRIM(v_member_reg.qr_token), ''), v_member_qr_token);
        v_final_member_hash := encode(extensions.digest(UPPER(TRIM(v_final_member_qr)), 'sha256'), 'hex');

        UPDATE public.registrations
        SET team_id = v_team.id,
            team_name = v_team.name,
            team_role = 'member',
            status = v_target_status,
            ticket_issued_at = v_target_issued_at,
            ticket_code = COALESCE(NULLIF(ticket_code, ''), v_member_ticket_code),
            qr_token = v_final_member_qr,
            qr_token_hash = v_final_member_hash,
            participant_details = CASE WHEN p_participant_details <> '{}'::jsonb THEN p_participant_details ELSE participant_details END,
            rejection_reason = CASE WHEN v_target_status::text = 'confirmed' THEN NULL ELSE rejection_reason END,
            updated_at = v_now
        WHERE id = v_member_reg.id
        RETURNING * INTO v_member_reg;
    ELSE
        INSERT INTO public.registrations (
            event_id,
            student_id,
            status,
            ticket_code,
            qr_token,
            qr_token_hash,
            ticket_issued_at,
            team_name,
            team_id,
            team_role,
            participant_details,
            approval_status,
            created_at,
            updated_at
        ) VALUES (
            v_team.event_id,
            v_caller_id,
            v_target_status,
            v_member_ticket_code,
            v_member_qr_token,
            v_member_qr_hash,
            v_target_issued_at,
            v_team.name,
            v_team.id,
            'member',
            p_participant_details,
            CASE WHEN v_target_status::text = 'confirmed' THEN 'approved' ELSE 'pending' END,
            v_now,
            v_now
        ) RETURNING * INTO v_member_reg;
    END IF;

    -- 14. Mark invitation accepted atomically
    UPDATE public.team_invitations
    SET status = 'accepted',
        accepted_at = v_now,
        accepted_by = v_caller_id,
        registration_id = v_member_reg.id,
        updated_at = v_now
    WHERE id = v_invitation.id;

    -- 15. Update or insert team_members record
    SELECT * INTO v_member_rec
    FROM public.team_members
    WHERE team_id = v_team.id AND (
        user_id = v_caller_id
        OR lower(email) = lower(v_user_email)
        OR (v_invitation.email IS NOT NULL AND lower(email) = lower(v_invitation.email))
    )
    FOR UPDATE;

    IF FOUND THEN
        UPDATE public.team_members
        SET user_id = v_caller_id,
            event_id = v_team.event_id,
            name = v_member_name,
            email = lower(v_user_email),
            college = CASE WHEN v_college <> '' THEN v_college ELSE college END,
            phone = CASE WHEN v_phone <> '' THEN v_phone ELSE phone END,
            student_id_card = CASE WHEN v_student_id <> '' THEN v_student_id ELSE student_id_card END,
            status = 'accepted',
            registration_id = v_member_reg.id,
            invitation_id = v_invitation.id,
            joined_at = COALESCE(joined_at, v_now),
            updated_at = v_now
        WHERE id = v_member_rec.id;
    ELSE
        INSERT INTO public.team_members (
            team_id,
            event_id,
            user_id,
            name,
            email,
            role,
            status,
            college,
            phone,
            student_id_card,
            registration_id,
            invitation_id,
            joined_at,
            created_at,
            updated_at
        ) VALUES (
            v_team.id,
            v_team.event_id,
            v_caller_id,
            v_member_name,
            lower(v_user_email),
            'member',
            'accepted',
            v_college,
            v_phone,
            v_student_id,
            v_member_reg.id,
            v_invitation.id,
            v_now,
            v_now,
            v_now
        ) RETURNING * INTO v_member_rec;
    END IF;

    -- 16. Recalculate accepted count and update team status if full
    SELECT count(*) INTO v_accepted_count
    FROM public.team_members
    WHERE team_id = v_team.id AND status = 'accepted';

    IF v_accepted_count >= v_max_size THEN
        UPDATE public.teams SET status = 'complete', updated_at = v_now WHERE id = v_team.id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', format('Successfully joined team "%s"!', v_team.name),
        'team_id', v_team.id,
        'team_name', v_team.name,
        'registration_id', v_member_reg.id,
        'ticket_code', v_member_reg.ticket_code,
        'status', v_target_status,
        'member_count', v_accepted_count,
        'max_size', v_max_size
    );
END;
$$;

ALTER FUNCTION public.accept_team_invitation(TEXT, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.accept_team_invitation(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(TEXT, JSONB) TO authenticated, service_role;

-- ── 5. Harden check_in_ticket() & check_out_ticket(): Hash-Only Indexed Lookups
-- Removes unindexed plaintext `UPPER(qr_token)` fallback scans now that all issued
-- tickets (legacy and 256-bit) have backfilled SHA-256 `qr_token_hash` values.
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

    -- Reject human-readable ticket codes
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

    -- Indexed SHA-256 hash lookup (no sequential plaintext fallback)
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

    SELECT * INTO v_existing_checkin
    FROM public.check_ins
    WHERE registration_id = v_reg.id
      AND member_index = v_member_index
    FOR UPDATE;

    v_checked_in_time := now();

    IF v_existing_checkin.id IS NOT NULL THEN
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
            'message', 'Attendee is already checked out.'
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
        'event_title', v_event.title,
        'message', 'Check-out recorded successfully.'
    );
END;
$$;

ALTER FUNCTION public.check_in_ticket(UUID, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.check_in_ticket(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_in_ticket(UUID, TEXT, TEXT) TO authenticated, service_role;

ALTER FUNCTION public.check_out_ticket(UUID, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.check_out_ticket(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_out_ticket(UUID, TEXT, TEXT) TO authenticated, service_role;

-- ── 6. Drop Unused Unauthenticated Legacy Check-In Bypass RPC (Migration 043) ─
-- validate_and_check_in_ticket accepted predictable ticket_code without organizer checks.
REVOKE ALL ON FUNCTION public.validate_and_check_in_ticket(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.validate_and_check_in_ticket(UUID, TEXT, TEXT, UUID);

