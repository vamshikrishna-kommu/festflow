-- =============================================================================
-- FestFlow — Supabase Migration 016: Fix RLS Infinite Recursion
-- =============================================================================
-- Root Cause:
-- In migration 013, an RLS SELECT policy was added to public.events:
--   CREATE POLICY "students can view events they are registered for"
--     ON public.events FOR SELECT TO authenticated
--     USING (EXISTS (SELECT 1 FROM public.registrations r WHERE r.event_id = events.id AND r.student_id = auth.uid()));
--
-- Meanwhile, public.registrations has a policy:
--   CREATE POLICY "clubs can view registrations for their events"
--     ON public.registrations FOR SELECT
--     USING (EXISTS (SELECT 1 FROM public.events WHERE events.id = registrations.event_id AND events.club_id = auth.uid()));
--
-- When any authenticated student queries public.events (such as visiting /discover
-- or /events/:slug), PostgreSQL evaluates the policies for public.events:
--   1. The policy on public.events initiates a subquery on public.registrations.
--   2. PostgreSQL evaluates RLS on public.registrations, which initiates a subquery on public.events.
--   3. PostgreSQL evaluates RLS on public.events again.
--   4. PostgreSQL detects circular dependency and halts query execution:
--      ERROR: 42P17: infinite recursion detected in policy for relation "registrations"
--
-- Solution:
-- Decouple cross-table RLS queries using STABLE SECURITY DEFINER helper functions.
-- When a SECURITY DEFINER function executes, it runs with the privileges of the
-- database owner (postgres), which bypasses Row Level Security on the queried tables.
-- Therefore, checking registrations from events or checking events from registrations
-- will NEVER trigger recursive policy evaluation.
-- =============================================================================

-- ─── 1. SECURITY DEFINER Helper Functions ────────────────────────────────────

-- Check if a student is registered for an event (bypasses RLS on registrations)
CREATE OR REPLACE FUNCTION public.check_user_is_registered_for_event(
  p_event_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.registrations
    WHERE event_id = p_event_id
      AND student_id = p_user_id
  );
$$;

COMMENT ON FUNCTION public.check_user_is_registered_for_event IS
  'Securely checks if student has a registration for an event without triggering RLS recursion.';

-- Check if a user owns an event (bypasses RLS on events)
CREATE OR REPLACE FUNCTION public.check_user_owns_event(
  p_event_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events
    WHERE id = p_event_id
      AND club_id = p_user_id
  );
$$;

COMMENT ON FUNCTION public.check_user_owns_event IS
  'Securely checks if user owns an event without triggering RLS recursion.';

-- Check if user is a platform administrator (bypasses RLS on profiles)
CREATE OR REPLACE FUNCTION public.check_is_platform_admin(
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
      AND role = 'platform_admin'
  );
$$;

COMMENT ON FUNCTION public.check_is_platform_admin IS
  'Securely checks platform admin status without triggering RLS recursion on profiles.';

-- Check if a student is registered for any event owned by an organizer (bypasses RLS)
CREATE OR REPLACE FUNCTION public.check_student_registered_for_organizer(
  p_student_id uuid,
  p_organizer_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.registrations r
    JOIN public.events e ON e.id = r.event_id
    WHERE r.student_id = p_student_id
      AND e.club_id = p_organizer_id
  );
$$;

COMMENT ON FUNCTION public.check_student_registered_for_organizer IS
  'Securely checks if a student attended an organizer event without triggering RLS recursion.';

-- Check if user owns the registration linked to a check-in record
CREATE OR REPLACE FUNCTION public.check_user_owns_checkin_registration(
  p_registration_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.registrations
    WHERE id = p_registration_id
      AND student_id = p_user_id
  );
$$;

COMMENT ON FUNCTION public.check_user_owns_checkin_registration IS
  'Securely checks registration ownership for check-in records without triggering RLS recursion.';

-- ─── 2. Update public.events Policies ────────────────────────────────────────
DO $$
BEGIN
  DROP POLICY IF EXISTS "students can view events they are registered for" ON public.events;
END $$;

CREATE POLICY "students can view events they are registered for"
  ON public.events FOR SELECT
  TO authenticated
  USING (
    public.check_user_is_registered_for_event(events.id, auth.uid())
  );

COMMENT ON POLICY "students can view events they are registered for" ON public.events IS
  'Allows authenticated students to view events they have registered for, using recursion-safe security definer lookup.';

-- ─── 3. Update public.registrations Policies ──────────────────────────────────
DO $$
BEGIN
  DROP POLICY IF EXISTS "clubs can view registrations for their events" ON public.registrations;
  DROP POLICY IF EXISTS "clubs can update registrations for their events" ON public.registrations;
END $$;

CREATE POLICY "clubs can view registrations for their events"
  ON public.registrations FOR SELECT
  TO authenticated
  USING (
    public.check_user_owns_event(registrations.event_id, auth.uid())
    OR
    public.check_is_platform_admin(auth.uid())
  );

CREATE POLICY "clubs can update registrations for their events"
  ON public.registrations FOR UPDATE
  TO authenticated
  USING (
    public.check_user_owns_event(registrations.event_id, auth.uid())
    OR
    public.check_is_platform_admin(auth.uid())
  );

-- ─── 4. Update public.profiles Policies ───────────────────────────────────────
DO $$
BEGIN
  DROP POLICY IF EXISTS "organizers can view registered student profiles" ON public.profiles;
END $$;

CREATE POLICY "organizers can view registered student profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.check_student_registered_for_organizer(profiles.id, auth.uid())
    OR
    public.check_is_platform_admin(auth.uid())
  );

-- ─── 5. Update public.check_ins Policies ──────────────────────────────────────
DO $$
BEGIN
  DROP POLICY IF EXISTS "Organizers can view event check-ins" ON public.check_ins;
  DROP POLICY IF EXISTS "Students can view own check-in" ON public.check_ins;
END $$;

CREATE POLICY "Organizers can view event check-ins"
  ON public.check_ins FOR SELECT
  TO authenticated
  USING (
    public.check_user_owns_event(check_ins.event_id, auth.uid())
    OR
    public.check_is_platform_admin(auth.uid())
  );

CREATE POLICY "Students can view own check-in"
  ON public.check_ins FOR SELECT
  TO authenticated
  USING (
    public.check_user_owns_checkin_registration(check_ins.registration_id, auth.uid())
  );

-- ─── 6. Update public.payment_submissions & payment_orders Policies ───────────
DO $$
BEGIN
  DROP POLICY IF EXISTS "Club organizers can view event payment submissions" ON public.payment_submissions;
  DROP POLICY IF EXISTS "Club organizers can view event payment orders" ON public.payment_orders;
  DROP POLICY IF EXISTS "Organizers can view event email outbox records" ON public.email_outbox;
END $$;

CREATE POLICY "Club organizers can view event payment submissions"
  ON public.payment_submissions FOR SELECT
  TO authenticated
  USING (
    public.check_user_owns_event(payment_submissions.event_id, auth.uid())
    OR
    public.check_is_platform_admin(auth.uid())
  );

CREATE POLICY "Club organizers can view event payment orders"
  ON public.payment_orders FOR SELECT
  TO authenticated
  USING (
    public.check_user_owns_event(payment_orders.event_id, auth.uid())
    OR
    public.check_is_platform_admin(auth.uid())
  );

CREATE POLICY "Organizers can view event email outbox records"
  ON public.email_outbox FOR SELECT
  TO authenticated
  USING (
    public.check_user_owns_event(email_outbox.event_id, auth.uid())
    OR
    public.check_is_platform_admin(auth.uid())
  );

-- ─── 7. Grant Permissions on Helper Functions ────────────────────────────────
GRANT EXECUTE ON FUNCTION public.check_user_is_registered_for_event(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_user_owns_event(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_is_platform_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_student_registered_for_organizer(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_user_owns_checkin_registration(uuid, uuid) TO authenticated, anon;
