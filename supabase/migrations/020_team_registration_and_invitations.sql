-- ============================================================================
-- FestFlow Migration 020: Complete Team Registration & Team Invitations
-- ============================================================================
-- Fully idempotent and non-destructive: Safe to run on existing FestFlow databases.
-- Enforces:
--   1. Team records with unique invite codes
--   2. Atomic team membership with role & status tracking
--   3. Expiring, secure team invitations
--   4. Concurrency safety (row-level locking FOR UPDATE to prevent capacity race conditions)
--   5. Prevention of duplicate memberships across teams in the same event
--   6. Strict RLS and safe public preview functions (zero private data leaks)
-- ============================================================================

-- ── 1. Create teams table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  leader_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  registration_id uuid REFERENCES public.registrations(id) ON DELETE CASCADE,
  name text NOT NULL,
  invite_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'forming' CHECK (status IN ('forming', 'complete', 'locked', 'disbanded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Invariants: One team per leader per event; unique team name per event
  CONSTRAINT unique_event_team_name UNIQUE (event_id, name),
  CONSTRAINT unique_event_leader UNIQUE (event_id, leader_id)
);

-- Trigger: updated_at for teams
DROP TRIGGER IF EXISTS teams_updated_at ON public.teams;
CREATE TRIGGER teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_teams_event_id ON public.teams(event_id);
CREATE INDEX IF NOT EXISTS idx_teams_leader_id ON public.teams(leader_id);
CREATE INDEX IF NOT EXISTS idx_teams_invite_code ON public.teams(invite_code);

-- ── 2. Create team_invitations table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'revoked')),
  expires_at timestamptz NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  resend_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger: updated_at for team_invitations
DROP TRIGGER IF EXISTS team_invitations_updated_at ON public.team_invitations;
CREATE TRIGGER team_invitations_updated_at
  BEFORE UPDATE ON public.team_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_team_invites_team_id ON public.team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_event_id ON public.team_invitations(event_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON public.team_invitations(lower(email));
CREATE INDEX IF NOT EXISTS idx_team_invites_token ON public.team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invites_status ON public.team_invitations(status);

-- ── 3. Create team_members table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  registration_id uuid REFERENCES public.registrations(id) ON DELETE CASCADE,
  invitation_id uuid REFERENCES public.team_invitations(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'removed')),
  college text,
  student_id_card text,
  phone text,
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Cannot add the same email twice to the same team
  CONSTRAINT unique_team_member_email UNIQUE (team_id, email)
);

-- Trigger: updated_at for team_members
DROP TRIGGER IF EXISTS team_members_updated_at ON public.team_members;
CREATE TRIGGER team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_event_id ON public.team_members(event_id);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON public.team_members(status);

-- Critical Invariant: A user can only be an accepted member in ONE team per event
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_accepted_user_per_event
  ON public.team_members (event_id, user_id)
  WHERE user_id IS NOT NULL AND status = 'accepted';

-- Critical Invariant: An email can only be an accepted member in ONE team per event
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_accepted_email_per_event
  ON public.team_members (event_id, lower(email))
  WHERE status = 'accepted';

-- ── 4. Row Level Security ───────────────────────────────────────────────────
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- 4.1 Teams Policies
DROP POLICY IF EXISTS "public read teams for preview" ON public.teams;
CREATE POLICY "public read teams for preview"
  ON public.teams FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "team leaders can update own team" ON public.teams;
CREATE POLICY "team leaders can update own team"
  ON public.teams FOR UPDATE
  USING (auth.uid() = leader_id);

-- 4.2 Team Invitations Policies
DROP POLICY IF EXISTS "team leaders view invitations" ON public.team_invitations;
CREATE POLICY "team leaders view invitations"
  ON public.team_invitations FOR SELECT
  USING (auth.uid() = inviter_id);

DROP POLICY IF EXISTS "recipients view own invitations" ON public.team_invitations;
CREATE POLICY "recipients view own invitations"
  ON public.team_invitations FOR SELECT
  USING (
    lower(email) = lower(COALESCE(auth.jwt()->>'email', ''))
  );

-- 4.3 Team Members Policies
DROP POLICY IF EXISTS "members and leaders view team roster" ON public.team_members;
CREATE POLICY "members and leaders view team roster"
  ON public.team_members FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.teams
      WHERE teams.id = team_members.team_id
        AND teams.leader_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = team_members.event_id
        AND events.club_id = auth.uid()
    )
  );

-- ── 5. Safe Team Invite Code Generator Helper ──────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_team_invite_code(p_event_slug text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_code text;
  v_exists boolean;
  v_chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_rand text;
  i int;
BEGIN
  LOOP
    v_rand := '';
    FOR i IN 1..6 LOOP
      v_rand := v_rand || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    END LOOP;
    v_code := 'TF-' || v_rand;

    SELECT EXISTS(SELECT 1 FROM public.teams WHERE invite_code = v_code) INTO v_exists;
    IF NOT v_exists THEN
      RETURN v_code;
    END IF;
  END LOOP;
END;
$$;

-- ── 6. RPC: Public Safe Team Preview (No Private Information Leaked) ───────
CREATE OR REPLACE FUNCTION public.get_team_preview_by_code(p_invite_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team record;
  v_event record;
  v_leader record;
  v_accepted_count int;
  v_max_size int;
  v_min_size int;
  v_is_full boolean;
  v_is_open boolean;
BEGIN
  -- 1. Find team
  SELECT * INTO v_team
  FROM public.teams
  WHERE upper(trim(invite_code)) = upper(trim(p_invite_code))
    AND status != 'disbanded';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_CODE',
      'message', 'Team invitation code is invalid or has expired.'
    );
  END IF;

  -- 2. Fetch event
  SELECT * INTO v_event FROM public.events WHERE id = v_team.event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'EVENT_NOT_FOUND',
      'message', 'Event for this team could not be found.'
    );
  END IF;

  -- 3. Check event status & registration deadlines
  v_is_open := (
    v_event.status = 'published' AND
    (v_event.registration_opens_at IS NULL OR v_event.registration_opens_at <= now()) AND
    (v_event.registration_closes_at IS NULL OR v_event.registration_closes_at > now()) AND
    (v_event.start_date > now())
  );

  -- 4. Count accepted members
  SELECT count(*) INTO v_accepted_count
  FROM public.team_members
  WHERE team_id = v_team.id AND status = 'accepted';

  v_max_size := COALESCE(v_event.max_team_size, 5);
  v_min_size := COALESCE(v_event.min_team_size, 2);
  v_is_full := v_accepted_count >= v_max_size;

  -- 5. Fetch leader display name (zero private contact info exposed)
  SELECT display_name INTO v_leader FROM public.profiles WHERE id = v_team.leader_id;

  RETURN jsonb_build_object(
    'success', true,
    'team_id', v_team.id,
    'team_name', v_team.name,
    'event_id', v_event.id,
    'event_title', v_event.title,
    'event_slug', v_event.slug,
    'event_category', v_event.category,
    'event_poster', v_event.poster_url,
    'start_date', v_event.start_date,
    'venue_name', v_event.venue_name,
    'is_free', v_event.is_free,
    'price', v_event.price,
    'leader_name', COALESCE(v_leader.display_name, 'Team Leader'),
    'current_size', v_accepted_count,
    'min_size', v_min_size,
    'max_size', v_max_size,
    'is_full', v_is_full,
    'is_open', v_is_open,
    'require_team_name', v_event.require_team_name
  );
END;
$$;

-- ── 7. RPC: Atomic Concurrency-Safe Team Join ──────────────────────────────
CREATE OR REPLACE FUNCTION public.join_team_with_code(
  p_invite_code text,
  p_participant_details jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_role user_role;
  v_user_profile record;
  v_team record;
  v_event record;
  v_existing_membership record;
  v_existing_reg record;
  v_accepted_count int;
  v_max_size int;
  v_member_name text;
  v_college text;
  v_phone text;
  v_student_id text;
  v_member_rec record;
  v_ticket_code text;
  v_new_members_json jsonb;
BEGIN
  -- 1. Identify and authenticate caller
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'UNAUTHENTICATED',
      'message', 'You must be signed in to join a team.'
    );
  END IF;

  -- 2. Verify student role
  SELECT * INTO v_user_profile FROM public.profiles WHERE id = v_user_id;
  IF NOT FOUND OR v_user_profile.role != 'student' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'FORBIDDEN_ROLE',
      'message', 'Only student accounts can join event teams.'
    );
  END IF;

  -- 3. Lock team row FOR UPDATE to prevent concurrency race conditions on the last slot
  SELECT * INTO v_team
  FROM public.teams
  WHERE upper(trim(invite_code)) = upper(trim(p_invite_code))
    AND status != 'disbanded'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_CODE',
      'message', 'Invalid team invitation code or team is no longer active.'
    );
  END IF;

  -- 4. Fetch and validate event
  SELECT * INTO v_event FROM public.events WHERE id = v_team.event_id;
  IF NOT FOUND OR v_event.status != 'published' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'EVENT_NOT_OPEN',
      'message', 'Registration for this event is closed or not available.'
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

  -- 5. Prevent leader joining their own team as a member
  IF v_team.leader_id = v_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ALREADY_LEADER',
      'message', 'You are already the leader of this team.'
    );
  END IF;

  -- 6. Check if user is already an accepted member of ANY team for this event
  SELECT * INTO v_existing_membership
  FROM public.team_members
  WHERE event_id = v_team.event_id
    AND (user_id = v_user_id OR lower(email) = lower(v_user_profile.email))
    AND status = 'accepted';

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ALREADY_IN_TEAM',
      'message', 'You are already an active member of a team for this event.'
    );
  END IF;

  -- 7. Check if user has an existing individual registration for this event
  SELECT * INTO v_existing_reg
  FROM public.registrations
  WHERE event_id = v_team.event_id
    AND student_id = v_user_id
    AND status IN ('confirmed', 'pending_approval', 'pending_payment');

  IF FOUND AND v_existing_reg.team_id IS DISTINCT FROM v_team.id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ALREADY_REGISTERED',
      'message', 'You already have an active standalone registration for this event.'
    );
  END IF;

  -- 8. Capacity validation (strict atomic check)
  SELECT count(*) INTO v_accepted_count
  FROM public.team_members
  WHERE team_id = v_team.id AND status = 'accepted';

  v_max_size := COALESCE(v_event.max_team_size, 5);
  IF v_accepted_count >= v_max_size THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'TEAM_FULL',
      'message', format('This team is already full (%s/%s members).', v_accepted_count, v_max_size)
    );
  END IF;

  -- 9. Extract participant details
  v_member_name := COALESCE(
    p_participant_details->>'student_name',
    v_user_profile.display_name,
    split_part(v_user_profile.email, '@', 1)
  );
  v_college := p_participant_details->>'college_name';
  v_phone := p_participant_details->>'phone';
  v_student_id := p_participant_details->>'id_card_number';

  -- 10. Check if an invitation or pending member record exists for this email
  SELECT * INTO v_member_rec
  FROM public.team_members
  WHERE team_id = v_team.id
    AND (lower(email) = lower(v_user_profile.email) OR user_id = v_user_id);

  IF FOUND THEN
    -- Update existing pending slot
    UPDATE public.team_members
    SET user_id = v_user_id,
        name = v_member_name,
        email = lower(v_user_profile.email),
        college = COALESCE(v_college, college),
        phone = COALESCE(v_phone, phone),
        student_id_card = COALESCE(v_student_id, student_id_card),
        status = 'accepted',
        joined_at = now(),
        updated_at = now()
    WHERE id = v_member_rec.id;
  ELSE
    -- Insert new accepted member
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
      joined_at
    )
    VALUES (
      v_team.id,
      v_team.event_id,
      v_user_id,
      v_member_name,
      lower(v_user_profile.email),
      'member',
      'accepted',
      v_college,
      v_phone,
      v_student_id,
      now()
    );
  END IF;

  -- 11. Mark any pending invitations for this email as accepted
  UPDATE public.team_invitations
  SET status = 'accepted',
      accepted_by = v_user_id,
      accepted_at = now(),
      updated_at = now()
  WHERE team_id = v_team.id
    AND lower(email) = lower(v_user_profile.email)
    AND status = 'pending';

  -- 12. Check if team reached capacity and update team status
  IF v_accepted_count + 1 >= v_max_size THEN
    UPDATE public.teams SET status = 'complete', updated_at = now() WHERE id = v_team.id;
  END IF;

  -- 13. Sync leader's registration record team_members JSONB for backward compatibility
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
        updated_at = now()
    WHERE id = v_team.registration_id;
  END IF;

  -- Fetch leader ticket code to return
  SELECT ticket_code INTO v_ticket_code
  FROM public.registrations
  WHERE id = v_team.registration_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Successfully joined %s! Your spot is confirmed.', v_team.name),
    'team_id', v_team.id,
    'team_name', v_team.name,
    'registration_id', v_team.registration_id,
    'ticket_code', v_ticket_code,
    'member_count', v_accepted_count + 1
  );
END;
$$;

-- ── 8. RPC: Leader Invites a Member by Email ───────────────────────────────
CREATE OR REPLACE FUNCTION public.invite_team_member(
  p_team_id uuid,
  p_email text,
  p_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Generate secure token
  v_token := encode(gen_random_bytes(24), 'hex');

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

-- ── 9. RPC: Revoke Team Invitation ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_team_invitation(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_invite record;
  v_team record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
  END IF;

  SELECT * INTO v_invite FROM public.team_invitations WHERE id = p_invitation_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Invitation not found.');
  END IF;

  SELECT * INTO v_team FROM public.teams WHERE id = v_invite.team_id;
  IF NOT FOUND OR v_team.leader_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'Only team leaders can revoke invitations.');
  END IF;

  IF v_invite.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_PENDING', 'message', 'Only pending invitations can be revoked.');
  END IF;

  UPDATE public.team_invitations
  SET status = 'revoked', updated_at = now()
  WHERE id = p_invitation_id;

  DELETE FROM public.team_members
  WHERE team_id = v_invite.team_id
    AND lower(email) = lower(v_invite.email)
    AND status = 'pending';

  RETURN jsonb_build_object('success', true, 'message', 'Invitation has been revoked.');
END;
$$;

-- ── 10. Row Level Security Policies ─────────────────────────────────────────

-- Teams table RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Allow public preview of active teams by invite code
DROP POLICY IF EXISTS "Public preview teams by code" ON public.teams;
CREATE POLICY "Public preview teams by code"
  ON public.teams
  FOR SELECT
  USING (true);

-- Allow leaders full access to their own teams
DROP POLICY IF EXISTS "Team leaders can manage own team" ON public.teams;
CREATE POLICY "Team leaders can manage own team"
  ON public.teams
  FOR ALL
  TO authenticated
  USING (leader_id = auth.uid())
  WITH CHECK (leader_id = auth.uid());

-- Allow event hosts/clubs to view teams registered for their events
DROP POLICY IF EXISTS "Organizers can view teams in their events" ON public.teams;
CREATE POLICY "Organizers can view teams in their events"
  ON public.teams
  FOR SELECT
  TO authenticated
  USING (
    event_id IN (
      SELECT id FROM public.events WHERE club_id = auth.uid()
    )
  );

-- Team members table RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Allow members and leaders to view their squad roster
DROP POLICY IF EXISTS "Members can view squad roster" ON public.team_members;
CREATE POLICY "Members can view squad roster"
  ON public.team_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR team_id IN (
      SELECT id FROM public.teams WHERE leader_id = auth.uid()
    )
    OR team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND status = 'accepted'
    )
    OR event_id IN (
      SELECT id FROM public.events WHERE club_id = auth.uid()
    )
  );

-- Allow team leader to insert and manage team members
DROP POLICY IF EXISTS "Team leaders can manage team members" ON public.team_members;
CREATE POLICY "Team leaders can manage team members"
  ON public.team_members
  FOR ALL
  TO authenticated
  USING (
    team_id IN (
      SELECT id FROM public.teams WHERE leader_id = auth.uid()
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT id FROM public.teams WHERE leader_id = auth.uid()
    )
  );

-- Team invitations table RLS
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- Allow leaders to manage team invitations
DROP POLICY IF EXISTS "Team leaders can manage team invitations" ON public.team_invitations;
CREATE POLICY "Team leaders can manage team invitations"
  ON public.team_invitations
  FOR ALL
  TO authenticated
  USING (
    team_id IN (
      SELECT id FROM public.teams WHERE leader_id = auth.uid()
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT id FROM public.teams WHERE leader_id = auth.uid()
    )
  );

-- Allow recipient to view invitation sent to their email
DROP POLICY IF EXISTS "Recipients can view invitations sent to their email" ON public.team_invitations;
CREATE POLICY "Recipients can view invitations sent to their email"
  ON public.team_invitations
  FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower(auth.jwt() ->> 'email')
  );

