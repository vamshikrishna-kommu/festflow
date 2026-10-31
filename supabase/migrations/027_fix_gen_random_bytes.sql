-- ==============================================================================
-- FestFlow Migration 027: Replace gen_random_bytes with gen_random_uuid
-- ==============================================================================
-- Problem: In Supabase, the 'pgcrypto' extension resides in the 'extensions' schema.
-- When a SECURITY DEFINER function sets search_path = public, pg_temp, unqualified
-- calls to gen_random_bytes(integer) fail with:
--   "function gen_random_bytes(integer) does not exist"
--
-- Solution: Replace gen_random_bytes calls with PostgreSQL core gen_random_uuid()
-- from pg_catalog, and include 'extensions' in search_path.
-- gen_random_uuid() is built into PostgreSQL core and requires zero extensions.
-- ==============================================================================

-- ── 0. Ensure pgcrypto extension is installed in extensions schema ───────────
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ── 1. Fix public.invite_team_member ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.invite_team_member(
  p_team_id uuid,
  p_email text,
  p_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_team record;
  v_event record;
  v_clean_email text;
  v_token text;
  v_existing_invite record;
  v_current_count int;
  v_max_size int;
  v_invitation_id uuid;
BEGIN
  -- 1. Identify caller
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
  END IF;

  -- 2. Verify caller is the team leader
  SELECT * INTO v_team FROM public.teams WHERE id = p_team_id;
  IF NOT FOUND OR v_team.leader_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'Only the team leader can send invitations.');
  END IF;

  -- 3. Fetch event & capacity
  SELECT * INTO v_event FROM public.events WHERE id = v_team.event_id;
  IF NOT FOUND OR v_event.status != 'published' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'EVENT_CLOSED', 'message', 'Event registration is closed.');
  END IF;

  v_clean_email := lower(trim(p_email));
  IF v_clean_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_EMAIL', 'message', 'Please enter a valid email address.');
  END IF;

  -- Check if leader invited themselves
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND lower(email) = v_clean_email) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'SELF_INVITE', 'message', 'You are already the leader of this team.');
  END IF;

  -- Check capacity
  SELECT count(*) INTO v_current_count FROM public.team_members WHERE team_id = v_team.id AND status = 'accepted';
  v_max_size := COALESCE(v_event.max_team_size, 5);
  IF v_current_count >= v_max_size THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'TEAM_FULL', 'message', 'This team has already reached maximum capacity.');
  END IF;

  -- Check if already an accepted member
  IF EXISTS (SELECT 1 FROM public.team_members WHERE team_id = v_team.id AND lower(email) = v_clean_email AND status = 'accepted') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_MEMBER', 'message', 'This student is already a confirmed member of your team.');
  END IF;

  -- Generate secure token using core PostgreSQL gen_random_uuid() (64 hex characters)
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  -- Insert or update invitation
  SELECT * INTO v_existing_invite
  FROM public.team_invitations
  WHERE team_id = v_team.id AND lower(email) = v_clean_email AND status = 'pending';

  IF FOUND THEN
    UPDATE public.team_invitations
    SET token = v_token,
        last_sent_at = now(),
        resend_count = resend_count + 1,
        expires_at = now() + INTERVAL '7 days',
        updated_at = now()
    WHERE id = v_existing_invite.id
    RETURNING id INTO v_invitation_id;
  ELSE
    INSERT INTO public.team_invitations (
      team_id,
      event_id,
      inviter_id,
      email,
      token,
      expires_at
    )
    VALUES (
      v_team.id,
      v_team.event_id,
      v_user_id,
      v_clean_email,
      v_token,
      now() + INTERVAL '7 days'
    )
    RETURNING id INTO v_invitation_id;
  END IF;

  -- Ensure pending slot exists in team_members
  INSERT INTO public.team_members (
    team_id,
    event_id,
    name,
    email,
    role,
    status,
    invitation_id
  )
  VALUES (
    v_team.id,
    v_team.event_id,
    COALESCE(p_name, split_part(v_clean_email, '@', 1)),
    v_clean_email,
    'member',
    'pending',
    v_invitation_id
  )
  ON CONFLICT (team_id, email) DO UPDATE
  SET invitation_id = v_invitation_id,
      updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Invitation created successfully.',
    'invitation_id', v_invitation_id,
    'token', v_token,
    'invite_code', v_team.invite_code,
    'email', v_clean_email
  );
END;
$$;

ALTER FUNCTION public.invite_team_member(uuid, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.invite_team_member(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_team_member(uuid, text, text) TO authenticated, service_role;


-- ── 2. Fix public.review_payment_submission (QR token generation) ─────────────
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
    v_clean_notes TEXT;
    v_now TIMESTAMPTZ := now();
    v_member_rec RECORD;
    v_member_reg RECORD;
    v_member_idx INT := 0;
    v_member_ticket_code TEXT;
    v_member_qr_token TEXT;
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

    -- 5. Authorization
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
                -- Native gen_random_uuid replacement for gen_random_bytes
                v_member_qr_token := format('FFQ_%s', SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 24));

                SELECT * INTO v_member_reg
                FROM public.registrations
                WHERE event_id = v_event.id AND student_id = v_member_rec.user_id
                FOR UPDATE;

                IF v_member_reg.id IS NOT NULL THEN
                    UPDATE public.registrations
                    SET status = 'confirmed',
                        ticket_code = COALESCE(NULLIF(ticket_code, ''), v_member_ticket_code),
                        qr_token = COALESCE(NULLIF(qr_token, ''), v_member_qr_token),
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


-- ── 3. Fix public.accept_team_invitation (QR token generation) ────────────────
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
    v_target_status TEXT;
    v_target_issued_at TIMESTAMPTZ;
    v_member_reg RECORD;
    v_member_idx INT;
    v_member_ticket_code TEXT;
    v_member_qr_token TEXT;
    v_member_rec RECORD;
    v_new_members_json JSONB;
    v_now TIMESTAMPTZ := now();
BEGIN
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

    -- 4. Lock and validate invitation
    SELECT * INTO v_invitation
    FROM public.team_invitations
    WHERE (token = trim(p_token) OR invite_code = trim(p_token))
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
            'message', 'This squad invitation has already been accepted.'
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

    -- 5. Email matching check
    IF v_invitation.email IS NOT NULL AND TRIM(v_invitation.email) <> '' THEN
        IF lower(TRIM(v_user_email)) <> lower(TRIM(v_invitation.email)) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'EMAIL_MISMATCH',
                'message', format('This invitation was sent to %s. Please switch accounts to claim this pass.', v_invitation.email)
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

    -- 12. Calculate member pass status based on Event & Leader state
    IF v_event.is_free = true OR COALESCE(v_event.price, 0) <= 0 THEN
        IF v_event.approval_type = 'manual' AND COALESCE(v_leader_reg.status, '') = 'pending_approval' THEN
            v_target_status := 'pending_approval';
            v_target_issued_at := NULL;
        ELSE
            v_target_status := 'confirmed';
            v_target_issued_at := v_now;
        END IF;
    ELSE
        IF v_leader_reg.id IS NOT NULL AND v_leader_reg.status = 'confirmed' AND v_leader_reg.ticket_issued_at IS NOT NULL THEN
            v_target_status := 'confirmed';
            v_target_issued_at := v_now;
        ELSE
            v_target_status := 'pending_payment';
            v_target_issued_at := NULL;
        END IF;
    END IF;

    -- 13. Idempotently update or create member registration
    SELECT * INTO v_member_reg
    FROM public.registrations
    WHERE event_id = v_team.event_id AND student_id = v_caller_id
    FOR UPDATE;

    SELECT count(*) + 1 INTO v_member_idx
    FROM public.team_members
    WHERE team_id = v_team.id AND user_id <> v_team.leader_id;

    IF v_leader_reg.ticket_code IS NOT NULL THEN
        v_member_ticket_code := format('%s-M%s', v_leader_reg.ticket_code, v_member_idx);
    ELSE
        v_member_ticket_code := format('FF-%s', UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8)));
    END IF;
    -- Native gen_random_uuid replacement for gen_random_bytes
    v_member_qr_token := format('FFQ_%s', SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 24));

    IF v_member_reg.id IS NOT NULL THEN
        UPDATE public.registrations
        SET team_id = v_team.id,
            team_name = v_team.name,
            team_role = 'member',
            status = v_target_status,
            ticket_issued_at = v_target_issued_at,
            ticket_code = COALESCE(NULLIF(ticket_code, ''), v_member_ticket_code),
            qr_token = COALESCE(NULLIF(qr_token, ''), v_member_qr_token),
            participant_details = CASE WHEN p_participant_details <> '{}'::jsonb THEN p_participant_details ELSE participant_details END,
            rejection_reason = CASE WHEN v_target_status = 'confirmed' THEN NULL ELSE rejection_reason END,
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
            v_target_issued_at,
            v_team.name,
            v_team.id,
            'member',
            p_participant_details,
            CASE WHEN v_target_status = 'confirmed' THEN 'approved' ELSE 'pending' END,
            v_now,
            v_now
        ) RETURNING * INTO v_member_reg;
    END IF;

    -- 14. Mark invitation accepted
    UPDATE public.team_invitations
    SET status = 'accepted',
        accepted_at = v_now,
        accepted_by = v_caller_id,
        updated_at = v_now
    WHERE id = v_invitation.id;

    -- 15. Add / Update team_members record safely
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

    -- 16. Update team status if full
    IF v_accepted_count + 1 >= v_max_size THEN
        UPDATE public.teams SET status = 'complete', updated_at = v_now WHERE id = v_team.id;
    END IF;

    -- 17. Update team leader's registration JSONB snapshot (team_members array)
    SELECT jsonb_agg(
        jsonb_build_object(
            'name', name,
            'email', email,
            'college', college,
            'studentId', student_id_card,
            'phone', phone,
            'user_id', user_id,
            'status', status
        )
    ) INTO v_new_members_json
    FROM public.team_members
    WHERE team_id = v_team.id AND role = 'member';

    IF v_team.registration_id IS NOT NULL THEN
        UPDATE public.registrations
        SET team_members = COALESCE(v_new_members_json, '[]'::jsonb),
            team_id = v_team.id,
            updated_at = v_now
        WHERE id = v_team.registration_id;
    END IF;

    -- 18. In-App Notification to Team Leader
    BEGIN
        INSERT INTO public.in_app_notifications (
            user_id,
            title,
            message,
            type,
            link
        ) VALUES (
            v_team.leader_id,
            'Teammate Joined Squad! 🚀',
            format('%s (%s) has accepted your invitation and joined %s.', v_member_name, v_user_email, v_team.name),
            'team_member_joined',
            '/student/tickets/' || COALESCE(v_team.registration_id, v_leader_reg.id)
        );
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'team_id', v_team.id,
        'team_name', v_team.name,
        'registration_id', v_member_reg.id,
        'status', v_target_status,
        'pass_issued', (v_target_issued_at IS NOT NULL),
        'ticket_code', v_member_ticket_code,
        'member_count', v_accepted_count + 1,
        'message', CASE
            WHEN v_target_status = 'confirmed' THEN 'Welcome to ' || v_team.name || '! Your confirmed gate pass is ready.'
            WHEN v_target_status = 'pending_payment' THEN 'Welcome to ' || v_team.name || '! Pass is locked pending team payment verification.'
            ELSE 'Welcome to ' || v_team.name || '! Your registration is under review.'
        END
    );
END;
$$;

ALTER FUNCTION public.accept_team_invitation(TEXT, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.accept_team_invitation(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(TEXT, JSONB) TO authenticated, service_role;


-- ── 4. Fix public.sync_team_member_registration ──────────────────────────────
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
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_team RECORD;
  v_leader_reg RECORD;
  v_member_reg RECORD;
  v_member_index INT;
  v_member_ticket_code TEXT;
  v_member_qr_token TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1. Fetch team
  SELECT * INTO v_team FROM public.teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Team not found.');
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
    -- Update existing registration with team linkage
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

    -- Link team_members row
    UPDATE public.team_members
    SET registration_id = v_member_reg.id,
        updated_at = v_now
    WHERE team_id = v_team.id AND user_id = p_member_user_id;

    RETURN jsonb_build_object(
      'success', true,
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

  -- Native gen_random_uuid replacement for gen_random_bytes
  v_member_qr_token := format('FFQ_%s', SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 24));

  -- 5. Insert individual registration for the team member
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

  RETURN jsonb_build_object(
    'success', true,
    'registration_id', v_member_reg.id,
    'ticket_code', v_member_reg.ticket_code,
    'is_new', true
  );
END;
$$;

ALTER FUNCTION public.sync_team_member_registration(UUID, UUID, TEXT, TEXT, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sync_team_member_registration(UUID, UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_team_member_registration(UUID, UUID, TEXT, TEXT, JSONB) TO authenticated, service_role;


-- ── 5. Fix Default Value on public.registrations.qr_token ─────────────────────
ALTER TABLE public.registrations
  ALTER COLUMN qr_token SET DEFAULT ('FFQ_' || replace(gen_random_uuid()::text, '-', ''));
