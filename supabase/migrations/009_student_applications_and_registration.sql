-- ============================================================================
-- FestFlow Migration 009: Student Applications, Registration & Approvals
-- ============================================================================
-- Idempotent & non-destructive: Safe to run on existing FestFlow databases.
-- ============================================================================

-- 1. Extend registration_status enum with 'pending_approval'
DO $$
BEGIN
  ALTER TYPE public.registration_status ADD VALUE IF NOT EXISTS 'pending_approval';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Extend registrations table with team_members and rejection_reason
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS team_members JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL;

-- 3. Update RLS policy so students can view their registrations under all statuses
DROP POLICY IF EXISTS "students can view own registrations" ON public.registrations;
CREATE POLICY "students can view own registrations"
  ON public.registrations FOR SELECT
  USING (auth.uid() = student_id);

-- 4. RPC: Organizer Reviews Student Application (Approve or Reject)
CREATE OR REPLACE FUNCTION public.review_registration_application(
  p_registration_id uuid,
  p_decision text,
  p_rejection_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_reg record;
  v_event record;
  v_new_status registration_status;
  v_new_approval text;
  v_issued_at timestamptz;
BEGIN
  -- 1. Identify caller
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
  END IF;

  -- 2. Fetch registration
  SELECT * INTO v_reg FROM public.registrations WHERE id = p_registration_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Registration not found.');
  END IF;

  -- 3. Fetch event & verify caller owns the club
  SELECT * INTO v_event FROM public.events WHERE id = v_reg.event_id;
  IF NOT FOUND OR v_event.club_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'Only the event host can review this application.');
  END IF;

  -- 4. Check if registration is already finalized
  IF v_reg.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_CANCELLED', 'message', 'Cannot review a cancelled registration.');
  END IF;

  -- 5. Process decision
  IF p_decision = 'approved' THEN
    v_new_approval := 'approved';
    IF v_event.is_free THEN
      v_new_status := 'confirmed'::registration_status;
      v_issued_at := now();
    ELSE
      v_new_status := 'pending_payment'::registration_status;
      v_issued_at := NULL;
    END IF;
  ELSIF p_decision = 'rejected' THEN
    v_new_approval := 'rejected';
    v_new_status := 'rejected'::registration_status;
    v_issued_at := NULL;
  ELSE
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DECISION', 'message', 'Decision must be approved or rejected.');
  END IF;

  -- 6. Apply updates
  UPDATE public.registrations
  SET approval_status = v_new_approval,
      status = v_new_status,
      ticket_issued_at = COALESCE(v_issued_at, ticket_issued_at),
      rejection_reason = CASE WHEN p_decision = 'rejected' THEN p_rejection_reason ELSE NULL END,
      updated_at = now()
  WHERE id = p_registration_id;

  RETURN jsonb_build_object(
    'success', true,
    'registration_id', p_registration_id,
    'status', v_new_status,
    'approval_status', v_new_approval,
    'message', CASE
      WHEN p_decision = 'approved' AND v_event.is_free THEN 'Application approved! Digital pass issued.'
      WHEN p_decision = 'approved' AND NOT v_event.is_free THEN 'Application approved! Awaiting student payment.'
      ELSE 'Application rejected.'
    END
  );
END;
$$;

-- 5. RPC: Atomic Registration with Eligibility, Team Membership, and Capacity Locking
DROP FUNCTION IF EXISTS public.register_for_event(uuid);
DROP FUNCTION IF EXISTS public.register_for_event(uuid, text, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.register_for_event(uuid, text, jsonb, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.register_for_event(
  p_event_id uuid,
  p_team_name text DEFAULT NULL,
  p_team_members jsonb DEFAULT '[]'::jsonb,
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
  v_student_profile record;
  v_active_count int;
  v_existing record;
  v_ticket_code text;
  v_initial_status registration_status;
  v_approval_status text;
  v_issued_at timestamptz;
  v_reg_id uuid;
  v_team_size int;
  v_member record;
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

  -- 6. Check eligibility constraints (Colleges, Departments, Years)
  SELECT * INTO v_student_profile FROM public.student_profiles WHERE id = v_user_id;
  IF FOUND THEN
    IF v_event.allowed_colleges IS NOT NULL AND array_length(v_event.allowed_colleges, 1) > 0 THEN
      IF v_student_profile.college_name IS NULL OR NOT (v_student_profile.college_name = ANY(v_event.allowed_colleges)) THEN
        RETURN jsonb_build_object(
          'success', false,
          'error_code', 'COLLEGE_INELIGIBLE',
          'message', 'This event is restricted to students from designated institutions.'
        );
      END IF;
    END IF;

    IF v_event.allowed_departments IS NOT NULL AND array_length(v_event.allowed_departments, 1) > 0 THEN
      IF v_student_profile.department IS NULL OR NOT (v_student_profile.department = ANY(v_event.allowed_departments)) THEN
        RETURN jsonb_build_object(
          'success', false,
          'error_code', 'DEPARTMENT_INELIGIBLE',
          'message', 'This event is restricted to students from designated departments.'
        );
      END IF;
    END IF;

    IF v_event.allowed_years IS NOT NULL AND array_length(v_event.allowed_years, 1) > 0 THEN
      IF v_student_profile.year_of_study IS NULL OR NOT (v_student_profile.year_of_study = ANY(v_event.allowed_years)) THEN
        RETURN jsonb_build_object(
          'success', false,
          'error_code', 'YEAR_INELIGIBLE',
          'message', 'This event is restricted to students in specific years of study.'
        );
      END IF;
    END IF;
  END IF;

  -- 7. Team requirements and size limits validation
  IF v_event.participation_type = 'team' THEN
    IF v_event.require_team_name AND (p_team_name IS NULL OR trim(p_team_name) = '') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'TEAM_NAME_REQUIRED',
        'message', 'Please specify a team name to register.'
      );
    END IF;

    -- Calculate total team size
    v_team_size := jsonb_array_length(COALESCE(p_team_members, '[]'::jsonb));
    IF v_event.leader_counts_towards_size THEN
      v_team_size := v_team_size + 1;
    END IF;

    IF v_team_size < v_event.min_team_size THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'TEAM_TOO_SMALL',
        'message', format('This event requires a minimum of %s team members (currently %s).', v_event.min_team_size, v_team_size)
      );
    END IF;

    IF v_team_size > v_event.max_team_size THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'TEAM_TOO_LARGE',
        'message', format('This event allows a maximum of %s team members (currently %s).', v_event.max_team_size, v_team_size)
      );
    END IF;
  END IF;

  -- 8. Check existing registration
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

  -- 9. Atomic capacity enforcement under concurrent submissions
  SELECT count(*) INTO v_active_count
  FROM public.registrations
  WHERE event_id = p_event_id AND status IN ('confirmed', 'pending_payment', 'pending_approval');

  IF v_active_count >= v_event.capacity THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'CAPACITY_REACHED',
      'message', 'This event has reached full capacity. No seats remaining.'
    );
  END IF;

  -- 10. Determine status and approval
  v_ticket_code := 'FF-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  IF v_event.approval_type = 'manual' THEN
    v_approval_status := 'pending';
    v_initial_status := 'pending_approval'::registration_status;
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

  -- 11. Insert or reactivate registration
  IF v_existing.id IS NOT NULL THEN
    UPDATE public.registrations
    SET ticket_code = v_ticket_code,
        status = v_initial_status,
        approval_status = v_approval_status,
        team_name = p_team_name,
        team_members = p_team_members,
        custom_responses = p_custom_responses,
        participant_details = p_participant_details,
        ticket_issued_at = v_issued_at,
        cancelled_at = NULL,
        rejection_reason = NULL,
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
      team_members,
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
      p_team_members,
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
      WHEN v_event.approval_type = 'manual' THEN 'Application submitted for organizer review.'
      WHEN v_event.is_free THEN 'Registration confirmed! Digital entry pass issued.'
      ELSE 'Application accepted! Please submit payment to confirm your pass.'
    END
  );
END;
$$;

-- 6. RPC: Safe Registration Cancellation with Business Rules Enforcement
CREATE OR REPLACE FUNCTION public.cancel_registration(p_registration_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_reg record;
  v_event record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
  END IF;

  SELECT * INTO v_reg FROM public.registrations WHERE id = p_registration_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Registration not found.');
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = v_reg.event_id;

  -- Caller must be student owner OR event club owner
  IF v_reg.student_id != v_user_id AND v_event.club_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'You do not have permission to cancel this registration.');
  END IF;

  IF v_reg.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Registration is already cancelled.');
  END IF;

  -- Business Rule: Student cannot cancel after event has started
  IF v_reg.student_id = v_user_id AND now() >= v_event.start_date THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'EVENT_STARTED',
      'message', 'Pass cannot be cancelled because the event has already started.'
    );
  END IF;

  -- Business Rule: Cannot cancel if ticket has already been used for gate check-in
  IF EXISTS (SELECT 1 FROM public.check_ins WHERE registration_id = p_registration_id AND outcome = 'VALID') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ALREADY_CHECKED_IN',
      'message', 'Cannot cancel a pass that has already been verified at the entry gate.'
    );
  END IF;

  UPDATE public.registrations
  SET status = 'cancelled'::registration_status,
      cancelled_at = now(),
      updated_at = now()
  WHERE id = p_registration_id;

  RETURN jsonb_build_object('success', true, 'message', 'Registration cancelled successfully.');
END;
$$;
