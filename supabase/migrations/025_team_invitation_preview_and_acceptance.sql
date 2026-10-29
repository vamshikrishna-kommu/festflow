-- =============================================================================
-- FestFlow — Migration 025: Team Invitation Preview, Hardened Acceptance & Sync
-- =============================================================================
-- Solves:
-- 1. Token-based secure preview for team invitations (masked email, status, capacity)
-- 2. Atomic, transaction-safe invitation acceptance with row-level locks
-- 3. Strict recipient email matching against verified Supabase Auth accounts
-- 4. Automatic generation of individual member tickets/passes upon squad joining
-- 5. Safe grant permissions for authenticated team members
-- =============================================================================

-- ── 1. RPC: get_team_invitation_preview ──────────────────────────────────────
-- Allows visitors to safely inspect squad invitation metadata before sign-in
-- without leaking full email addresses or unauthorized private details.
DROP FUNCTION IF EXISTS public.get_team_invitation_preview(text);

CREATE OR REPLACE FUNCTION public.get_team_invitation_preview(
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation RECORD;
  v_team RECORD;
  v_event RECORD;
  v_leader RECORD;
  v_caller_id uuid;
  v_caller_email text;
  v_is_matched boolean := false;
  v_current_count int := 0;
  v_max_size int := 5;
  v_masked_email text := '';
  v_safe_email text := '';
  v_email_parts text[];
  v_local_part text;
  v_domain_part text;
BEGIN
  -- 1. Input Validation
  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_TOKEN',
      'message', 'Invalid or missing invitation token.'
    );
  END IF;

  -- 2. Lookup invitation (by token or invite code)
  SELECT * INTO v_invitation
  FROM public.team_invitations
  WHERE token = trim(p_token) OR invite_code = trim(p_token);

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVITATION_NOT_FOUND',
      'message', 'Invitation not found or link has expired.'
    );
  END IF;

  -- 3. Check status
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

  IF v_invitation.expires_at < now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVITATION_EXPIRED',
      'message', 'This squad invitation has expired.'
    );
  END IF;

  -- 4. Fetch team & event
  SELECT * INTO v_team FROM public.teams WHERE id = v_invitation.team_id;
  IF NOT FOUND OR v_team.status = 'disbanded' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'TEAM_NOT_FOUND',
      'message', 'This squad is no longer active.'
    );
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = v_invitation.event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'EVENT_NOT_FOUND',
      'message', 'Event not found.'
    );
  END IF;

  SELECT display_name, email INTO v_leader FROM public.profiles WHERE id = v_team.leader_id;

  -- 5. Calculate capacity
  SELECT count(*) INTO v_current_count
  FROM public.team_members
  WHERE team_id = v_team.id AND status = 'accepted';

  v_max_size := COALESCE(v_event.max_team_size, 5);

  -- 6. Email Masking
  v_email_parts := string_to_array(lower(trim(v_invitation.email)), '@');
  IF array_length(v_email_parts, 1) = 2 THEN
    v_local_part  := v_email_parts[1];
    v_domain_part := v_email_parts[2];
    IF length(v_local_part) <= 2 THEN
      v_masked_email := rpad(v_local_part, 4, '*') || '@' || v_domain_part;
    ELSE
      v_masked_email := substring(v_local_part from 1 for 2) || repeat('*', GREATEST(length(v_local_part) - 2, 3)) || '@' || v_domain_part;
    END IF;
  ELSE
    v_masked_email := '***@***';
  END IF;

  -- 7. Recipient Match Evaluation
  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL THEN
    SELECT email INTO v_caller_email FROM public.profiles WHERE id = v_caller_id;
    IF v_caller_email IS NOT NULL AND lower(trim(v_caller_email)) = lower(trim(v_invitation.email)) THEN
      v_is_matched := true;
      v_safe_email := v_invitation.email;
    ELSE
      v_safe_email := v_masked_email;
    END IF;
  ELSE
    v_safe_email := v_masked_email;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'invitation', jsonb_build_object(
      'id', v_invitation.id,
      'team_id', v_team.id,
      'team_name', v_team.name,
      'event_id', v_event.id,
      'event_title', v_event.title,
      'event_slug', v_event.slug,
      'event_category', v_event.category,
      'venue_name', v_event.venue_name,
      'start_date', v_event.start_date,
      'is_free', v_event.is_free,
      'price', v_event.price,
      'leader_name', COALESCE(v_leader.display_name, 'Team Leader'),
      'invite_code', v_team.invite_code,
      'recipient_email', v_safe_email,
      'masked_email', v_masked_email,
      'is_recipient_matched', v_is_matched,
      'status', v_invitation.status,
      'expires_at', v_invitation.expires_at,
      'current_size', v_current_count,
      'max_size', v_max_size,
      'is_full', (v_current_count >= v_max_size)
    )
  );
END;
$$;

ALTER FUNCTION public.get_team_invitation_preview(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_team_invitation_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_invitation_preview(text) TO anon, authenticated, service_role;


-- ── 2. RPC: accept_team_invitation (Atomic & Safe) ───────────────────────────
DROP FUNCTION IF EXISTS public.accept_team_invitation(text, jsonb);
DROP FUNCTION IF EXISTS public.accept_team_invitation(text);

CREATE OR REPLACE FUNCTION public.accept_team_invitation(
  p_token text,
  p_participant_details jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid;
  v_user_profile RECORD;
  v_invitation RECORD;
  v_team RECORD;
  v_event RECORD;
  v_existing_membership RECORD;
  v_existing_reg RECORD;
  v_accepted_count int;
  v_max_size int;
  v_member_name text;
  v_college text;
  v_phone text;
  v_student_id text;
  v_member_rec RECORD;
  v_leader_reg RECORD;
  v_member_reg RECORD;
  v_member_index int;
  v_member_ticket_code text;
  v_member_qr_token text;
  v_new_members_json jsonb;
  v_user_email text;
  v_email_confirmed_at timestamptz;
  v_now timestamptz := now();
BEGIN
  -- 1. Caller Authentication
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'UNAUTHENTICATED',
      'message', 'Please sign in to accept this squad invitation.'
    );
  END IF;

  -- 2. Verify Student Role
  SELECT * INTO v_user_profile FROM public.profiles WHERE id = v_caller_id;
  IF NOT FOUND OR (v_user_profile.role != 'student' AND v_user_profile.role != 'platform_admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'FORBIDDEN_ROLE',
      'message', 'Club organizer accounts cannot join attendee event teams. Please use a student account.'
    );
  END IF;

  -- 3. Verify Email Confirmation Status
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

  -- 4. Lock and validate invitation (by token or invite code)
  SELECT * INTO v_invitation
  FROM public.team_invitations
  WHERE (token = trim(p_token) OR invite_code = trim(p_token))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVITATION_NOT_FOUND',
      'message', 'Invitation not found or invalid link.'
    );
  END IF;

  IF v_invitation.status = 'revoked' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVITATION_REVOKED',
      'message', 'This invitation has been revoked by the team leader.'
    );
  END IF;

  IF v_invitation.status = 'accepted' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ALREADY_ACCEPTED',
      'message', 'This invitation has already been accepted.'
    );
  END IF;

  IF v_invitation.expires_at < now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVITATION_EXPIRED',
      'message', 'This invitation has expired.'
    );
  END IF;

  -- 5. Email Match Security Verification
  IF lower(trim(v_user_email)) != lower(trim(v_invitation.email)) AND auth.role() <> 'service_role' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'EMAIL_MISMATCH',
      'message', format('This invitation was sent to %s. You are currently signed in as %s.', v_invitation.email, v_user_email)
    );
  END IF;

  -- 6. Lock and validate team
  SELECT * INTO v_team
  FROM public.teams
  WHERE id = v_invitation.team_id AND status != 'disbanded'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'TEAM_NOT_FOUND',
      'message', 'This squad is no longer active.'
    );
  END IF;

  IF v_team.leader_id = v_caller_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ALREADY_LEADER',
      'message', 'You are already the leader of this team.'
    );
  END IF;

  -- 7. Validate event status & deadlines
  SELECT * INTO v_event FROM public.events WHERE id = v_team.event_id;
  IF NOT FOUND OR v_event.status != 'published' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'EVENT_NOT_OPEN',
      'message', 'Registration for this event is closed.'
    );
  END IF;

  IF v_event.registration_closes_at IS NOT NULL AND v_event.registration_closes_at < now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'DEADLINE_PASSED',
      'message', 'Registration deadline for this event has passed.'
    );
  END IF;

  IF v_event.start_date <= now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'EVENT_STARTED',
      'message', 'This event has already started.'
    );
  END IF;

  -- 8. Verify caller is not already an accepted member of any squad for this event
  SELECT * INTO v_existing_membership
  FROM public.team_members
  WHERE event_id = v_team.event_id
    AND (user_id = v_caller_id OR lower(email) = lower(v_user_email))
    AND status = 'accepted';

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ALREADY_IN_TEAM',
      'message', 'You are already a confirmed member of a squad for this event.'
    );
  END IF;

  -- 9. Check capacity
  SELECT count(*) INTO v_accepted_count
  FROM public.team_members
  WHERE team_id = v_team.id AND status = 'accepted';

  v_max_size := COALESCE(v_event.max_team_size, 5);
  IF v_accepted_count >= v_max_size THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'TEAM_FULL',
      'message', format('This squad is already at maximum capacity (%s/%s members).', v_accepted_count, v_max_size)
    );
  END IF;

  -- 10. Extract participant details
  v_member_name := COALESCE(
    p_participant_details->>'student_name',
    v_user_profile.display_name,
    split_part(v_user_email, '@', 1)
  );
  v_college := COALESCE(p_participant_details->>'college_name', '');
  v_phone := COALESCE(p_participant_details->>'phone', '');
  v_student_id := COALESCE(p_participant_details->>'id_card_number', '');

  -- 11. Mark invitation accepted
  UPDATE public.team_invitations
  SET status = 'accepted',
      accepted_by = v_caller_id,
      accepted_at = v_now,
      updated_at = v_now
  WHERE id = v_invitation.id;

  -- 12. Upsert team_members record
  SELECT * INTO v_member_rec
  FROM public.team_members
  WHERE team_id = v_team.id AND (lower(email) = lower(v_invitation.email) OR user_id = v_caller_id);

  IF FOUND THEN
    UPDATE public.team_members
    SET user_id = v_caller_id,
        name = v_member_name,
        email = lower(v_user_email),
        college = CASE WHEN v_college <> '' THEN v_college ELSE college END,
        phone = CASE WHEN v_phone <> '' THEN v_phone ELSE phone END,
        student_id_card = CASE WHEN v_student_id <> '' THEN v_student_id ELSE student_id_card END,
        status = 'accepted',
        invitation_id = v_invitation.id,
        joined_at = v_now,
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
      v_invitation.id,
      v_now,
      v_now,
      v_now
    ) RETURNING * INTO v_member_rec;
  END IF;

  -- 13. Update team status if full
  IF v_accepted_count + 1 >= v_max_size THEN
    UPDATE public.teams SET status = 'complete', updated_at = v_now WHERE id = v_team.id;
  END IF;

  -- 14. Synchronize individual member registration & pass
  SELECT * INTO v_leader_reg FROM public.registrations WHERE id = v_team.registration_id;
  IF NOT FOUND THEN
    SELECT * INTO v_leader_reg
    FROM public.registrations
    WHERE event_id = v_team.event_id AND student_id = v_team.leader_id
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  SELECT * INTO v_member_reg
  FROM public.registrations
  WHERE event_id = v_team.event_id AND student_id = v_caller_id;

  IF FOUND THEN
    UPDATE public.registrations
    SET team_id = v_team.id,
        team_name = v_team.name,
        status = COALESCE(v_leader_reg.status, status),
        ticket_issued_at = CASE WHEN COALESCE(v_leader_reg.status, status) = 'confirmed' THEN COALESCE(ticket_issued_at, v_now) ELSE NULL END,
        updated_at = v_now
    WHERE id = v_member_reg.id;
  ELSE
    SELECT count(*) + 1 INTO v_member_index
    FROM public.registrations
    WHERE team_id = v_team.id AND student_id != v_team.leader_id;

    IF v_leader_reg.ticket_code IS NOT NULL THEN
      v_member_ticket_code := format('%s-M%s', v_leader_reg.ticket_code, v_member_index);
    ELSE
      v_member_ticket_code := format('FF-%s', upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8)));
    END IF;

    v_member_qr_token := format('FFQ_%s', encode(gen_random_bytes(12), 'hex'));

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
      v_caller_id,
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
  END IF;

  -- Link registration to team_members
  UPDATE public.team_members
  SET registration_id = v_member_reg.id,
      updated_at = v_now
  WHERE team_id = v_team.id AND user_id = v_caller_id;

  -- 15. Update leader's registration JSONB snapshot
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

  -- 16. In-App Notification to Team Leader
  BEGIN
    INSERT INTO public.in_app_notifications (
      user_id,
      title,
      message,
      type,
      link
    ) VALUES (
      v_team.leader_id,
      'Teammate Joined Your Squad!',
      format('%s (%s) has accepted your invitation and joined %s.', v_member_name, v_user_email, v_team.name),
      'team_member_joined',
      '/student/tickets/' || COALESCE(v_team.registration_id, v_leader_reg.id)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Successfully joined %s! Your spot and digital pass are confirmed.', v_team.name),
    'team_id', v_team.id,
    'team_name', v_team.name,
    'registration_id', v_member_reg.id,
    'ticket_code', v_member_reg.ticket_code,
    'member_count', v_accepted_count + 1
  );
END;
$$;

ALTER FUNCTION public.accept_team_invitation(text, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.accept_team_invitation(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(text, jsonb) TO authenticated, service_role;

-- ── 3. Grant Explicit Permissions on sync_team_member_registration ──────────
GRANT EXECUTE ON FUNCTION public.sync_team_member_registration(UUID, UUID, TEXT, TEXT, JSONB) TO authenticated, service_role;
