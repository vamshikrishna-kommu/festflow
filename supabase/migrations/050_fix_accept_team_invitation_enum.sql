-- Migration 050: Fix accept_team_invitation registration_status enum coercion
-- Resolves "invalid input value for enum registration_status: ''" error during squad invitation acceptance.

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
    v_member_qr_hash BYTEA;
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

    -- Strict email confirmation check
    IF v_email_confirmed_at IS NULL AND auth.role() <> 'service_role' AND EXISTS (SELECT 1 FROM auth.users WHERE id = v_caller_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'EMAIL_NOT_VERIFIED',
            'message', 'Please verify your student email address before accepting this squad invitation.'
        );
    END IF;

    -- 4. Calculate SHA-256 hash of token to match unguessable tokens
    v_token_hash := digest(UPPER(v_clean_token), 'sha256');

    -- Lock and validate invitation
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

    -- 12. Determine member pass status based on event & leader payment state
    -- Uses explicit enum type and text cast to prevent enum coercion errors
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

    -- 13. Generate ticket code and secure 256-bit QR token with SHA-256 hash
    SELECT count(*) + 1 INTO v_member_idx
    FROM public.team_members
    WHERE team_id = v_team.id AND user_id <> v_team.leader_id;

    IF v_leader_reg.ticket_code IS NOT NULL THEN
        v_member_ticket_code := format('%s-M%s', v_leader_reg.ticket_code, v_member_idx);
    ELSE
        v_member_ticket_code := format('FF-%s', UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8)));
    END IF;

    v_member_qr_token := format('FFQ_%s', UPPER(REPLACE(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')));
    v_member_qr_hash := digest(UPPER(TRIM(v_member_qr_token)), 'sha256');

    -- Insert or update member registration
    SELECT * INTO v_member_reg
    FROM public.registrations
    WHERE event_id = v_team.event_id AND student_id = v_caller_id
    FOR UPDATE;

    IF v_member_reg.id IS NOT NULL THEN
        UPDATE public.registrations
        SET team_id = v_team.id,
            team_name = v_team.name,
            team_role = 'member',
            status = v_target_status,
            ticket_issued_at = v_target_issued_at,
            ticket_code = COALESCE(NULLIF(ticket_code, ''), v_member_ticket_code),
            qr_token = COALESCE(NULLIF(qr_token, ''), v_member_qr_token),
            qr_token_hash = COALESCE(qr_token_hash, v_member_qr_hash),
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

    -- 16. Update team status if full
    IF v_accepted_count + 1 >= v_max_size THEN
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
        'member_count', v_accepted_count + 1,
        'max_size', v_max_size
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_team_invitation(TEXT, JSONB) TO authenticated;

-- Compatibility overload for register_for_event with 6 parameters (including p_ticket_tier_id)
-- Resolves "Could not find the function public.register_for_event(p_custom_responses, p_event_id, p_participant_details, p_team_members, p_team_name, p_ticket_tier_id) in the schema cache"
CREATE OR REPLACE FUNCTION public.register_for_event(
  p_event_id uuid,
  p_team_name text DEFAULT NULL,
  p_team_members jsonb DEFAULT '[]'::jsonb,
  p_custom_responses jsonb DEFAULT '{}'::jsonb,
  p_participant_details jsonb DEFAULT '{}'::jsonb,
  p_ticket_tier_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.register_for_event(
    p_event_id,
    p_team_name,
    p_team_members,
    p_custom_responses,
    CASE 
      WHEN p_ticket_tier_id IS NOT NULL THEN
        jsonb_set(COALESCE(p_participant_details, '{}'::jsonb), '{ticket_tier_id}', to_jsonb(p_ticket_tier_id::text))
      ELSE
        COALESCE(p_participant_details, '{}'::jsonb)
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_for_event(uuid, text, jsonb, jsonb, jsonb, uuid) TO authenticated;

