-- =============================================================================
-- FestFlow — Supabase Migration 013: Allow Students to View Registered Events
-- =============================================================================
-- Root Cause:
-- In migration 002_events.sql, Row Level Security (RLS) on public.events only permitted:
--   1. "anyone can view published events": status = 'published'
--   2. "clubs can view own events": auth.uid() = club_id
--
-- When an event concluded, was cancelled, or was temporarily unpublished,
-- its status changed from 'published' to 'completed', 'cancelled', or 'draft'.
-- When students queried their registered passes via:
--   SELECT *, event:event_id (...) FROM public.registrations WHERE student_id = :id
-- PostgREST evaluated RLS on public.events. Because status was no longer 'published'
-- and the student was not the club owner, RLS silently blocked the student from
-- reading the event record. PostgREST returned event: null for every attendee
-- registration for that event.
-- Downstream component renders in StudentDashboardPage crashed with:
--   TypeError: Cannot read properties of null (reading 'start_date')
--
-- Fix:
-- Add an RLS SELECT policy on public.events allowing authenticated students to
-- read event details for any event they have an active registration for,
-- regardless of the event's published/completed/cancelled lifecycle state.
-- =============================================================================

DO $$
BEGIN
  DROP POLICY IF EXISTS "students can view events they are registered for" ON public.events;
END $$;

CREATE POLICY "students can view events they are registered for"
  ON public.events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.registrations r
      WHERE r.event_id = events.id
        AND r.student_id = auth.uid()
    )
  );

COMMENT ON POLICY "students can view events they are registered for" ON public.events IS
  'Allows authenticated students to view details of events they have registered for, including completed and cancelled events.';
