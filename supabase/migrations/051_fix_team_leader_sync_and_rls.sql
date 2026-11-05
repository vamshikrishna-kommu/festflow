-- =============================================================================
-- Migration 051: Fix Team Leader Sync, Auto-Membership Trigger, and Non-Recursive RLS
-- =============================================================================
-- Ensures:
-- 1. All squad members can view their complete team roster (including leader and fellow teammates).
-- 2. Team leaders are automatically synchronized into team_members and registrations.team_id.
-- 3. Any existing team (such as MAGNUM) has its leader retroactively populated into team_members.
-- =============================================================================

-- ── 1. Helper function: is_member_of_team (SECURITY DEFINER to avoid RLS recursion) ──
CREATE OR REPLACE FUNCTION public.is_member_of_team(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND user_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.teams
    WHERE id = p_team_id AND leader_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_member_of_team(UUID, UUID) TO authenticated, service_role, anon;

-- ── 2. Clean Non-Recursive RLS Policy on public.team_members ──────────────────────────
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members and leaders view team roster" ON public.team_members;
DROP POLICY IF EXISTS "Members can view squad roster" ON public.team_members;
DROP POLICY IF EXISTS "Members and leaders view squad roster" ON public.team_members;

CREATE POLICY "Members and leaders view squad roster"
  ON public.team_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_member_of_team(team_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = team_members.event_id
        AND events.club_id = auth.uid()
    )
  );

-- ── 3. Trigger Function: Automatically sync leader into team_members & registrations ──
CREATE OR REPLACE FUNCTION public.handle_new_team_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_leader_profile RECORD;
  v_student_profile RECORD;
  v_leader_reg RECORD;
  v_leader_name TEXT;
  v_leader_email TEXT;
  v_leader_college TEXT;
  v_leader_phone TEXT;
BEGIN
  -- Fetch leader profile
  SELECT * INTO v_leader_profile FROM public.profiles WHERE id = NEW.leader_id;
  SELECT * INTO v_student_profile FROM public.student_profiles WHERE profile_id = NEW.leader_id;
  
  -- Fetch leader registration if linked or by event
  IF NEW.registration_id IS NOT NULL THEN
    SELECT * INTO v_leader_reg FROM public.registrations WHERE id = NEW.registration_id;
  ELSE
    SELECT * INTO v_leader_reg FROM public.registrations 
    WHERE event_id = NEW.event_id AND student_id = NEW.leader_id 
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  -- Update registrations to bind team_id
  IF v_leader_reg.id IS NOT NULL THEN
    UPDATE public.registrations
    SET team_id = NEW.id,
        team_name = NEW.name,
        team_role = 'leader'
    WHERE id = v_leader_reg.id;
  END IF;

  v_leader_name := COALESCE(
    v_leader_reg.participant_details->>'student_name',
    v_leader_profile.display_name,
    'Team Leader'
  );
  v_leader_email := COALESCE(
    v_leader_reg.participant_details->>'email',
    v_leader_profile.email,
    ''
  );
  v_leader_college := COALESCE(
    v_leader_reg.participant_details->>'college_name',
    v_student_profile.college_name,
    ''
  );
  v_leader_phone := COALESCE(
    v_leader_reg.participant_details->>'phone',
    ''
  );

  -- Upsert leader into team_members:
  -- If leader already has a member record for this event (from an older team), migrate them to this team as leader!
  IF EXISTS (
    SELECT 1 FROM public.team_members
    WHERE event_id = NEW.event_id AND user_id = NEW.leader_id
  ) THEN
    UPDATE public.team_members
    SET team_id = NEW.id,
        role = 'leader',
        status = 'accepted',
        registration_id = COALESCE(v_leader_reg.id, public.team_members.registration_id),
        name = v_leader_name,
        email = lower(trim(v_leader_email)),
        college = COALESCE(NULLIF(v_leader_college, ''), public.team_members.college),
        phone = COALESCE(NULLIF(v_leader_phone, ''), public.team_members.phone),
        updated_at = now()
    WHERE event_id = NEW.event_id AND user_id = NEW.leader_id;
  ELSIF v_leader_email <> '' THEN
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
    ) VALUES (
      NEW.id,
      NEW.event_id,
      NEW.leader_id,
      v_leader_reg.id,
      v_leader_name,
      lower(trim(v_leader_email)),
      'leader',
      'accepted',
      v_leader_college,
      v_leader_phone,
      NEW.created_at,
      NEW.created_at,
      NEW.created_at
    )
    ON CONFLICT (team_id, email) DO UPDATE
    SET role = 'leader',
        status = 'accepted',
        user_id = EXCLUDED.user_id,
        registration_id = COALESCE(EXCLUDED.registration_id, public.team_members.registration_id),
        name = EXCLUDED.name,
        college = COALESCE(EXCLUDED.college, public.team_members.college),
        phone = COALESCE(EXCLUDED.phone, public.team_members.phone),
        updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_team_leader_sync ON public.teams;
CREATE TRIGGER trg_new_team_leader_sync
  AFTER INSERT ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_team_created();

-- ── 4. Retroactive Backfill for existing squads (e.g. MAGNUM) ─────────────────────────
DO $$
DECLARE
  v_team RECORD;
  v_leader_profile RECORD;
  v_student_profile RECORD;
  v_leader_reg RECORD;
  v_leader_name TEXT;
  v_leader_email TEXT;
  v_leader_college TEXT;
  v_leader_phone TEXT;
BEGIN
  FOR v_team IN SELECT * FROM public.teams LOOP
    -- Fetch leader profile
    SELECT * INTO v_leader_profile FROM public.profiles WHERE id = v_team.leader_id;
    SELECT * INTO v_student_profile FROM public.student_profiles WHERE profile_id = v_team.leader_id;

    -- Fetch leader registration
    IF v_team.registration_id IS NOT NULL THEN
      SELECT * INTO v_leader_reg FROM public.registrations WHERE id = v_team.registration_id;
    ELSE
      SELECT * INTO v_leader_reg FROM public.registrations 
      WHERE event_id = v_team.event_id AND student_id = v_team.leader_id 
      ORDER BY created_at DESC LIMIT 1;
    END IF;

    -- Update registrations to bind team_id
    IF v_leader_reg.id IS NOT NULL AND (v_leader_reg.team_id IS NULL OR v_leader_reg.team_id <> v_team.id) THEN
      UPDATE public.registrations
      SET team_id = v_team.id,
          team_name = v_team.name,
          team_role = 'leader'
      WHERE id = v_leader_reg.id;
    END IF;

    v_leader_name := COALESCE(
      v_leader_reg.participant_details->>'student_name',
      v_leader_profile.display_name,
      'Team Leader'
    );
    v_leader_email := COALESCE(
      v_leader_reg.participant_details->>'email',
      v_leader_profile.email,
      ''
    );
    v_leader_college := COALESCE(
      v_leader_reg.participant_details->>'college_name',
      v_student_profile.college_name,
      ''
    );
    v_leader_phone := COALESCE(
      v_leader_reg.participant_details->>'phone',
      ''
    );

    -- If leader already has a member row for this event (from an older team), move them to this team as leader!
    IF EXISTS (
      SELECT 1 FROM public.team_members
      WHERE event_id = v_team.event_id AND user_id = v_team.leader_id
    ) THEN
      UPDATE public.team_members
      SET team_id = v_team.id,
          role = 'leader',
          status = 'accepted',
          registration_id = COALESCE(v_leader_reg.id, public.team_members.registration_id),
          name = v_leader_name,
          email = lower(trim(v_leader_email)),
          college = COALESCE(NULLIF(v_leader_college, ''), public.team_members.college),
          phone = COALESCE(NULLIF(v_leader_phone, ''), public.team_members.phone),
          updated_at = now()
      WHERE event_id = v_team.event_id AND user_id = v_team.leader_id;
    ELSIF v_leader_email <> '' THEN
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
      ) VALUES (
        v_team.id,
        v_team.event_id,
        v_team.leader_id,
        v_leader_reg.id,
        v_leader_name,
        lower(trim(v_leader_email)),
        'leader',
        'accepted',
        v_leader_college,
        v_leader_phone,
        v_team.created_at,
        v_team.created_at,
        v_team.created_at
      )
      ON CONFLICT (team_id, email) DO UPDATE
      SET role = 'leader',
          status = 'accepted',
          user_id = EXCLUDED.user_id,
          registration_id = COALESCE(EXCLUDED.registration_id, public.team_members.registration_id),
          name = EXCLUDED.name,
          college = COALESCE(EXCLUDED.college, public.team_members.college),
          phone = COALESCE(EXCLUDED.phone, public.team_members.phone),
          updated_at = now();
    END IF;
  END LOOP;
END $$;

