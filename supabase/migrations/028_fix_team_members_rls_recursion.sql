-- ══════════════════════════════════════════════════════════════════════════════
-- FESTFLOW DATABASE MIGRATION 028: FIX INFINITE RECURSION IN TEAM_MEMBERS RLS
-- ══════════════════════════════════════════════════════════════════════════════
-- Fixes PostgreSQL error 42P17 (infinite recursion detected in policy for
-- relation "team_members") by replacing the recursive subquery on team_members
-- with a STABLE SECURITY DEFINER helper function.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Helper function: Get user team IDs safely without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_team_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT team_id FROM public.team_members WHERE user_id = p_user_id AND status = 'accepted';
$$;

COMMENT ON FUNCTION public.get_user_team_ids(uuid) IS
  'Returns accepted team IDs for a user with SECURITY DEFINER to bypass RLS recursion.';

-- 2. Drop existing recurring policies on team_members
DROP POLICY IF EXISTS "members and leaders view team roster" ON public.team_members;
DROP POLICY IF EXISTS "Members can view squad roster" ON public.team_members;
DROP POLICY IF EXISTS "Team leaders can manage team members" ON public.team_members;
DROP POLICY IF EXISTS "Members and leaders view squad roster" ON public.team_members;

-- 3. Create non-recursive SELECT policy for team_members
CREATE POLICY "Members and leaders view squad roster"
  ON public.team_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR team_id IN (
      SELECT id FROM public.teams WHERE leader_id = auth.uid()
    )
    OR team_id IN (
      SELECT public.get_user_team_ids(auth.uid())
    )
    OR event_id IN (
      SELECT id FROM public.events WHERE club_id = auth.uid()
    )
  );

-- 4. Create safe ALL policy for team leaders to manage their roster
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

-- 5. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_team_ids(uuid) TO authenticated, service_role, anon;
