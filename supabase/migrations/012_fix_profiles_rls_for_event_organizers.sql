-- =============================================================================
-- FestFlow — Supabase Migration 012: Fix Profiles RLS for Event Organizers
-- =============================================================================
-- Root Cause:
-- In migration 001_auth_profiles.sql, the Row Level Security (RLS) policies on
-- public.profiles only permitted:
--   1. "users can read own profile": auth.uid() = id
--   2. "anyone can read public profiles": role in ('club_member', 'platform_admin')
--
-- When club organizers loaded the Event Check-In Page or Event Registrations Page,
-- Supabase executed the relational query:
--   SELECT *, student:student_id (display_name, email, avatar_url)
--   FROM public.registrations
--   WHERE event_id = :event_id
--
-- Because attendee accounts have role = 'student' and auth.uid() != student_id,
-- the profiles table RLS policy silently blocked organizers from reading student
-- profiles. PostgREST returned student: null for every attendee record in production.
-- Downstream component renders then crashed with:
--   TypeError: Cannot read properties of null (reading 'display_name')
--
-- Fix:
-- Add an RLS SELECT policy on public.profiles allowing authenticated users who
-- organize an event to read the display_name, email, and avatar_url of attendees
-- registered for their own events.
-- =============================================================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "organizers can view registered student profiles" ON public.profiles;
END $$;

CREATE POLICY "organizers can view registered student profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    -- Allow organizers to read profile if the student registered for an event owned by the caller
    EXISTS (
      SELECT 1
      FROM public.registrations r
      JOIN public.events e ON e.id = r.event_id
      WHERE r.student_id = profiles.id
        AND e.club_id = auth.uid()
    )
    OR
    -- Allow platform administrators to view profiles for system management
    EXISTS (
      SELECT 1
      FROM public.profiles admin_p
      WHERE admin_p.id = auth.uid()
        AND admin_p.role = 'platform_admin'
    )
  );

COMMENT ON POLICY "organizers can view registered student profiles" ON public.profiles IS
  'Permits event organizers to view the name and contact profiles of students registered for their events.';
