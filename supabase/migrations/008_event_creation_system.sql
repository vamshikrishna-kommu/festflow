-- ============================================================================
-- FestFlow Migration 008: Professional Event Creation & Participation System
-- ============================================================================
-- Idempotent & non-destructive: Safe to run on existing FestFlow databases.
-- ============================================================================

-- 1. Extend public.events with professional configuration fields
ALTER TABLE public.events 
  ADD COLUMN IF NOT EXISTS rules TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS online_meeting_url TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  ADD COLUMN IF NOT EXISTS approval_type TEXT NOT NULL DEFAULT 'automatic',
  ADD COLUMN IF NOT EXISTS participation_type TEXT NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS min_team_size INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_team_size INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS leader_counts_towards_size BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS team_registration_mode TEXT NOT NULL DEFAULT 'leader_adds_members',
  ADD COLUMN IF NOT EXISTS require_team_name BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allowed_colleges TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS allowed_departments TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS allowed_years INT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custom_questions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS participant_fields JSONB DEFAULT '{"require_college": true, "require_phone": true, "require_grad_year": true, "require_id_card": false}'::jsonb;

-- 2. Update status constraint to include 'registration_closed'
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE public.events ADD CONSTRAINT events_status_check 
  CHECK (status IN ('draft', 'published', 'registration_closed', 'cancelled', 'completed'));

-- 3. Check constraints for team sizes and validation
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS chk_event_team_sizes;
ALTER TABLE public.events ADD CONSTRAINT chk_event_team_sizes 
  CHECK (min_team_size >= 1 AND max_team_size >= min_team_size);

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS chk_event_participation_type;
ALTER TABLE public.events ADD CONSTRAINT chk_event_participation_type 
  CHECK (participation_type IN ('individual', 'team'));

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS chk_event_approval_type;
ALTER TABLE public.events ADD CONSTRAINT chk_event_approval_type 
  CHECK (approval_type IN ('automatic', 'manual'));

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS chk_event_team_reg_mode;
ALTER TABLE public.events ADD CONSTRAINT chk_event_team_reg_mode 
  CHECK (team_registration_mode IN ('leader_adds_members', 'members_join_with_code'));

-- 4. Extend registrations table for teams, custom responses, and approval
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS team_name TEXT,
  ADD COLUMN IF NOT EXISTS team_role TEXT DEFAULT 'leader' CHECK (team_role IN ('leader', 'member')),
  ADD COLUMN IF NOT EXISTS team_id UUID,
  ADD COLUMN IF NOT EXISTS custom_responses JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS participant_details JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- 5. Safe re-runnable RLS update for public event discovery
DROP POLICY IF EXISTS "anyone can view published events" ON public.events;
CREATE POLICY "anyone can view published events"
  ON public.events FOR SELECT
  USING (status IN ('published', 'registration_closed', 'completed'));

-- 6. Add indexes for high-throughput queries
CREATE INDEX IF NOT EXISTS idx_events_participation ON public.events (participation_type);
CREATE INDEX IF NOT EXISTS idx_registrations_team_id ON public.registrations (team_id);
CREATE INDEX IF NOT EXISTS idx_registrations_approval_status ON public.registrations (approval_status);

-- 7. Atomic Event Registration with Team, Custom Responses, and Approval Support
DROP FUNCTION IF EXISTS public.register_for_event(uuid);

CREATE OR REPLACE FUNCTION public.register_for_event(
  p_event_id uuid,
  p_team_name text DEFAULT NULL,
  p_custom_responses jsonb DEFAULT '{}'::jsonb,
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
  v_event record;
  v_active_count int;
  v_existing record;
  v_ticket_code text;
  v_initial_status registration_status;
  v_approval_status text;
  v_issued_at timestamptz;
  v_reg_id uuid;
BEGIN
  -- 1. Identify caller
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'UNAUTHENTICATED',
      'message', 'You must be signed in to register for an event.'
    );
  END IF;

  -- 2. Verify caller role (Student or platform admin)
  SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
  IF v_user_role NOT IN ('student', 'platform_admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'FORBIDDEN_ROLE',
      'message', 'Club organizer accounts cannot register as students for events.'
    );
  END IF;

  -- 3. Concurrency lock on event row
  SELECT * INTO v_event
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'EVENT_NOT_FOUND',
      'message', 'Event could not be found.'
    );
  END IF;

  -- 4. Verify event published
  IF v_event.status != 'published' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'EVENT_NOT_PUBLISHED',
      'message', 'This event is not currently open for registration.'
    );
  END IF;

  -- 5. Timing validations
  IF now() >= v_event.start_date THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'EVENT_ALREADY_STARTED',
      'message', 'Registration is closed because the event has already started.'
    );
  END IF;

  IF v_event.registration_opens_at IS NOT NULL AND now() < v_event.registration_opens_at THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'REGISTRATION_NOT_OPEN',
      'message', 'Registration for this event has not opened yet.'
    );
  END IF;

  IF v_event.registration_closes_at IS NOT NULL AND now() > v_event.registration_closes_at THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'REGISTRATION_DEADLINE_PASSED',
      'message', 'The registration deadline for this event has passed.'
    );
  END IF;

  -- 6. Team requirements validation
  IF v_event.participation_type = 'team' AND v_event.require_team_name AND (p_team_name IS NULL OR trim(p_team_name) = '') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'TEAM_NAME_REQUIRED',
      'message', 'Please specify a team name to register.'
    );
  END IF;

  -- 7. Check existing registration
  SELECT * INTO v_existing
  FROM public.registrations
  WHERE event_id = p_event_id AND student_id = v_user_id;

  IF FOUND AND v_existing.status != 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ALREADY_REGISTERED',
      'message', 'You already have an active registration for this event.',
      'registration_id', v_existing.id,
      'ticket_code', v_existing.ticket_code,
      'status', v_existing.status
    );
  END IF;

  -- 8. Atomic capacity enforcement under concurrent submissions
  SELECT count(*) INTO v_active_count
  FROM public.registrations
  WHERE event_id = p_event_id AND status IN ('confirmed', 'pending_payment');

  IF v_active_count >= v_event.capacity THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'CAPACITY_REACHED',
      'message', 'This event has reached full capacity. No seats remaining.'
    );
  END IF;

  -- 9. Determine status and approval
  v_ticket_code := 'FF-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  IF v_event.approval_type = 'manual' THEN
    v_approval_status := 'pending';
    v_initial_status := 'pending_payment'::registration_status;
    v_issued_at := NULL;
  ELSIF v_event.is_free THEN
    v_approval_status := 'approved';
    v_initial_status := 'confirmed'::registration_status;
    v_issued_at := now();
  ELSE
    v_approval_status := 'approved';
    v_initial_status := 'pending_payment'::registration_status;
    v_issued_at := NULL;
  END IF;

  -- 10. Insert or reactivate registration
  IF v_existing.id IS NOT NULL THEN
    UPDATE public.registrations
    SET ticket_code = v_ticket_code,
        status = v_initial_status,
        approval_status = v_approval_status,
        team_name = p_team_name,
        custom_responses = p_custom_responses,
        participant_details = p_participant_details,
        ticket_issued_at = v_issued_at,
        cancelled_at = NULL,
        created_at = now()
    WHERE id = v_existing.id
    RETURNING id INTO v_reg_id;
  ELSE
    INSERT INTO public.registrations (
      event_id,
      student_id,
      ticket_code,
      status,
      approval_status,
      team_name,
      custom_responses,
      participant_details,
      ticket_issued_at
    )
    VALUES (
      p_event_id,
      v_user_id,
      v_ticket_code,
      v_initial_status,
      v_approval_status,
      p_team_name,
      p_custom_responses,
      p_participant_details,
      v_issued_at
    )
    RETURNING id INTO v_reg_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'registration_id', v_reg_id,
    'ticket_code', v_ticket_code,
    'status', v_initial_status,
    'approval_status', v_approval_status,
    'is_free', v_event.is_free,
    'ticket_issued', (v_issued_at IS NOT NULL),
    'message', CASE
      WHEN v_event.approval_type = 'manual' THEN 'Registration submitted for organizer approval.'
      WHEN v_event.is_free THEN 'Registration confirmed! Digital QR pass issued.'
      ELSE 'Registration received! Please proceed to payment verification.'
    END
  );
END;
$$;

