-- =============================================================================
-- FestFlow — Migration 060: Revoke Student Self-Service Check-In / Check-Out
-- Check-in and check-out are restricted exclusively to authorized event organizers
-- and staff at venue entrance gates using the organizer scanner / ops panel.
-- =============================================================================

-- Revoke all execute privileges on participant_toggle_attendance from students and public
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'participant_toggle_attendance'
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.participant_toggle_attendance(UUID, TEXT) FROM PUBLIC, authenticated, anon;';
    EXECUTE 'DROP FUNCTION public.participant_toggle_attendance(UUID, TEXT);';
  END IF;
END $$;

