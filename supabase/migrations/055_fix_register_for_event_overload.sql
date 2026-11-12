-- Migration 055: Fix register_for_event function overloading ambiguity & allow dual-workspace registrations
-- Created: 2026-11-13
--
-- Fixes two critical issues:
-- 1. Function Overloading Collision:
--    PostgreSQL error: "Could not choose the best candidate function between:
--    public.register_for_event(5 params), public.register_for_event(6 params with default)".
--    Resolved by dropping the ambiguous 6-parameter overload with DEFAULT NULL and providing
--    a clean wrapper without default arguments.
--
-- 2. "Only student accounts can register for event passes" error:
--    In FestFlow 2.0, club members, organizers, and platform admins have dual workspace eligibility
--    and can participate in campus events from the Student Workspace.
--    The obsolete restriction (v_user_role != 'student') has been updated so any valid user account
--    with an active profile can register for event passes.
--
-- 3. QR Token Return:
--    Guarantees qr_token is returned directly in the RPC response for instant ticket QR code rendering.

-- ── 1. Drop the ambiguous 6-parameter overload ─────────────────────────────
DROP FUNCTION IF EXISTS public.register_for_event(uuid, text, jsonb, jsonb, jsonb, uuid);

-- ── 2. Update canonical 5-parameter register_for_event ─────────────────────
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
  v_qr_token text;
  v_initial_status registration_status;
  v_approval_status text;
  v_issued_at timestamptz;
  v_reg_id uuid;
  v_team_size int;
  v_question jsonb;
  v_q_id text;
  v_q_val text;
BEGIN
  -- 1. Identify caller
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'UNAUTHENTICATED',
      'message', 'You must be signed in to register for events.'
    );
  END IF;

  -- 2. Verify caller profile exists (students, club organizers, and admins can all register for event passes)
  SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
  IF v_user_role IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'FORBIDDEN_ROLE',
      'message', 'Profile not found. Please complete your profile.'
    );
  END IF;

  -- 3. Fetch event & acquire row lock
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR SHARE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'EVENT_NOT_FOUND',
      'message', 'Event not found.'
    );
  END IF;

  -- 4. Status check
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

  -- 7. Organizer Required Participant Fields Validation
  IF v_event.participant_fields IS NOT NULL THEN
    IF (v_event.participant_fields->>'require_college')::boolean IS TRUE THEN
      IF NULLIF(TRIM(p_participant_details->>'college_name'), '') IS NULL THEN
        RETURN jsonb_build_object(
          'success', false,
          'error_code', 'FIELD_REQUIRED',
          'message', 'College name is required for registration by the event organizer.'
        );
      END IF;
    END IF;

    IF (v_event.participant_fields->>'require_phone')::boolean IS TRUE THEN
      IF NULLIF(TRIM(p_participant_details->>'phone'), '') IS NULL THEN
        RETURN jsonb_build_object(
          'success', false,
          'error_code', 'FIELD_REQUIRED',
          'message', 'Contact phone number is required for registration by the event organizer.'
        );
      END IF;
    END IF;

    IF (v_event.participant_fields->>'require_grad_year')::boolean IS TRUE THEN
      IF NULLIF(TRIM(p_participant_details->>'grad_year'), '') IS NULL THEN
        RETURN jsonb_build_object(
          'success', false,
          'error_code', 'FIELD_REQUIRED',
          'message', 'Graduation / passing year is required for registration by the event organizer.'
        );
      END IF;
    END IF;

    IF (v_event.participant_fields->>'require_id_card')::boolean IS TRUE THEN
      IF NULLIF(TRIM(p_participant_details->>'id_card_number'), '') IS NULL THEN
        RETURN jsonb_build_object(
          'success', false,
          'error_code', 'FIELD_REQUIRED',
          'message', 'Student ID card number is required for registration by the event organizer.'
        );
      END IF;
    END IF;
  END IF;

  -- 8. Organizer Custom Questions Validation
  IF v_event.custom_questions IS NOT NULL AND jsonb_typeof(v_event.custom_questions) = 'array' THEN
    FOR v_question IN SELECT * FROM jsonb_array_elements(v_event.custom_questions)
    LOOP
      IF (v_question->>'required')::boolean IS TRUE THEN
        v_q_id := v_question->>'id';
        v_q_val := TRIM(COALESCE(p_custom_responses->>v_q_id, ''));

        IF v_question->>'type' = 'checkbox' THEN
          IF COALESCE((p_custom_responses->v_q_id)::boolean, false) IS NOT TRUE THEN
            RETURN jsonb_build_object(
              'success', false,
              'error_code', 'QUESTION_REQUIRED',
              'message', format('Required agreement missing: %s', COALESCE(v_question->>'label', 'Agreement'))
            );
          END IF;
        ELSE
          IF v_q_val = '' THEN
            RETURN jsonb_build_object(
              'success', false,
              'error_code', 'QUESTION_REQUIRED',
              'message', format('Please answer the required question: %s', COALESCE(v_question->>'label', 'Organizer Question'))
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 9. Team requirements and size limits validation
  IF v_event.participation_type = 'team' THEN
    IF v_event.require_team_name AND (p_team_name IS NULL OR trim(p_team_name) = '') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'TEAM_NAME_REQUIRED',
        'message', 'Please specify a team name to register.'
      );
    END IF;

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

  -- 10. Check existing registration
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
      'qr_token', v_existing.qr_token,
      'status', v_existing.status
    );
  END IF;

  -- 11. Atomic capacity enforcement under concurrent submissions
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

  -- 12. Determine status and approval
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

  -- Set transaction-local flag so tamper trigger allows initial creation / update
  PERFORM set_config('festflow.internal_system_operation', 'true', true);

  -- 13. Insert or reactivate registration
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
        created_at = now(),
        updated_at = now()
    WHERE id = v_existing.id
    RETURNING id, qr_token INTO v_reg_id, v_qr_token;
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
    RETURNING id, qr_token INTO v_reg_id, v_qr_token;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'registration_id', v_reg_id,
    'ticket_code', v_ticket_code,
    'qr_token', v_qr_token,
    'status', v_initial_status,
    'approval_status', v_approval_status,
    'is_free', v_event.is_free,
    'ticket_issued', (v_issued_at IS NOT NULL)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_for_event(uuid, text, jsonb, jsonb, jsonb) TO authenticated, service_role;

-- ── 3. Unambiguous 6-parameter compatibility wrapper (no defaults) ─────────
-- Callers passing 5 parameters match ONLY the 5-parameter function above.
-- Callers passing 6 parameters (including p_ticket_tier_id) match ONLY this wrapper.
CREATE OR REPLACE FUNCTION public.register_for_event(
  p_event_id uuid,
  p_team_name text,
  p_team_members jsonb,
  p_custom_responses jsonb,
  p_participant_details jsonb,
  p_ticket_tier_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.register_for_event(
    p_event_id,
    p_team_name,
    p_team_members,
    p_custom_responses,
    CASE 
      WHEN p_ticket_tier_id IS NOT NULL THEN
        jsonb_set(COALESCE(p_participant_details, '{}'::jsonb), '{ticket_tier_id}', to_jsonb(p_ticket_tier_id::text))
      ELSE
        COALESCE(p_participant_details, '{}'::jsonb)
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_for_event(uuid, text, jsonb, jsonb, jsonb, uuid) TO authenticated, service_role;
