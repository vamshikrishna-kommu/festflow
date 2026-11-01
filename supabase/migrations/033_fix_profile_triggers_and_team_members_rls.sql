-- ══════════════════════════════════════════════════════════════════════════════
-- FESTFLOW DATABASE MIGRATION 033: FIX ALL TRIGGERS, POLICIES & TEAM RLS
-- ══════════════════════════════════════════════════════════════════════════════
-- Resolves:
-- 1. PostgreSQL error: record "old" has no field "is_verified" on public.profiles
-- 2. PostgreSQL error: new row violates row-level security policy for table "student_profiles"
-- 3. PostgreSQL error 42P17 / HTTP 500: infinite recursion on public.team_members
-- 4. Ensures team_members columns (joined_at, created_at, updated_at) exist safely
-- 5. Hardens invite_team_member RPC with SECURITY DEFINER and non-recursive queries
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Fix Profile Role Escalation Trigger on public.profiles ─────────────────
-- Root Cause: Migration 015 inspected OLD.is_verified, which does not exist on profiles.
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Only check role on public.profiles (is_verified only exists on club_profiles)
    IF (OLD.role IS DISTINCT FROM NEW.role) THEN
        IF auth.uid() IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin'
        ) THEN
            RAISE EXCEPTION 'Unauthorized: Users cannot modify their role directly.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- ── 2. Dedicated Trigger on public.club_profiles to Protect is_verified ────────
CREATE OR REPLACE FUNCTION public.prevent_club_verification_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF (OLD.is_verified IS DISTINCT FROM NEW.is_verified) THEN
        IF auth.uid() IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin'
        ) THEN
            RAISE EXCEPTION 'Unauthorized: Only platform administrators can verify clubs.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_club_verification_escalation ON public.club_profiles;
CREATE TRIGGER trg_prevent_club_verification_escalation
BEFORE UPDATE ON public.club_profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_club_verification_escalation();

-- ── 3. Comprehensive RLS Policies for public.student_profiles ─────────────────
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students can insert own student profile" ON public.student_profiles;
CREATE POLICY "students can insert own student profile"
  ON public.student_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "students can update own student profile" ON public.student_profiles;
CREATE POLICY "students can update own student profile"
  ON public.student_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "students can read own student profile" ON public.student_profiles;
CREATE POLICY "students can read own student profile"
  ON public.student_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "platform admins can read all student profiles" ON public.student_profiles;
CREATE POLICY "platform admins can read all student profiles"
  ON public.student_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin')
  );

-- ── 4. Comprehensive RLS Policies for public.club_profiles ────────────────────
ALTER TABLE public.club_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "club organizers can insert own club profile" ON public.club_profiles;
CREATE POLICY "club organizers can insert own club profile"
  ON public.club_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "club members can update own club profile" ON public.club_profiles;
CREATE POLICY "club members can update own club profile"
  ON public.club_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

-- ── 5. Schema Hardening on public.team_members ────────────────────────────────
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS joined_at timestamptz;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ── 6. Non-Recursive Helper for Team Members RLS ──────────────────────────────
-- PL/pgSQL prevents PostgreSQL query planner from inlining this function into RLS policies
CREATE OR REPLACE FUNCTION public.get_user_team_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT team_id FROM public.team_members WHERE user_id = p_user_id AND status = 'accepted';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_team_ids(uuid) TO authenticated, service_role, anon;

-- ── 7. Clean Non-Recursive Policies on public.team_members ─────────────────────
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members and leaders view team roster" ON public.team_members;
DROP POLICY IF EXISTS "Members can view squad roster" ON public.team_members;
DROP POLICY IF EXISTS "Team leaders can manage team members" ON public.team_members;
DROP POLICY IF EXISTS "Members and leaders view squad roster" ON public.team_members;
DROP POLICY IF EXISTS "organizers view event squad rosters" ON public.team_members;

-- 7.1 SELECT Policy: Allows user, team leader, organizers, or accepted teammates
CREATE POLICY "Members and leaders view squad roster"
  ON public.team_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR team_id IN (
      SELECT id FROM public.teams WHERE leader_id = auth.uid()
    )
    OR event_id IN (
      SELECT id FROM public.events WHERE club_id = auth.uid()
    )
    OR team_id IN (
      SELECT public.get_user_team_ids(auth.uid())
    )
  );

-- 7.2 ALL Policy: Team leaders can manage their own roster
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

-- ── 8. Robust invite_team_member RPC Function ─────────────────────────────────
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
      status,
      expires_at
    )
    VALUES (
      v_team.id,
      v_team.event_id,
      v_user_id,
      v_clean_email,
      v_token,
      'pending',
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
        name = COALESCE(EXCLUDED.name, public.team_members.name),
        status = 'pending',
        updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', v_invitation_id,
    'token', v_token,
    'invite_code', v_team.invite_code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_team_member(uuid, text, text) TO authenticated, service_role;
