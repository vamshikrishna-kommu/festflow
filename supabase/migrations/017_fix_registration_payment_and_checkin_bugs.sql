-- ============================================================================
-- FestFlow Migration 017: Fix Registration Validation, Payment Verification,
-- Check-In Enum, and Outcome Column Bugs
-- ============================================================================
-- Safe, idempotent & non-destructive incremental migration.
-- Addresses:
--   - BUG 1: Server-side validation of organizer custom questions & attendee fields
--   - BUG 2: Trigger bypass in verify_payment_order for authorized payment confirmation
--   - BUG 3: Extend registration_status enum with 'waitlisted'
--   - BUG 4: Fix cancel_registration query referencing nonexistent column 'outcome'
-- ============================================================================

-- ─── 1. BUG 3: Extend registration_status enum with 'waitlisted' ─────────────
DO $$
BEGIN
    ALTER TYPE public.registration_status ADD VALUE IF NOT EXISTS 'waitlisted';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- ─── 2. BUG 2: Update prevent_registration_tampering trigger ─────────────────
-- Permits internal trusted system operations (marked by transaction-scoped GUC)
-- while maintaining 100% strictness against direct student client updates.
CREATE OR REPLACE FUNCTION public.prevent_registration_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Allow trusted server RPCs (e.g. verify_payment_order, review_registration_application)
    IF current_setting('festflow.internal_system_operation', true) = 'true' THEN
        RETURN NEW;
    END IF;

    -- 1. Immutable structural identity fields
    IF OLD.event_id IS DISTINCT FROM NEW.event_id THEN
        RAISE EXCEPTION 'Registration event_id is immutable.';
    END IF;

    IF OLD.student_id IS DISTINCT FROM NEW.student_id THEN
        RAISE EXCEPTION 'Registration student_id is immutable.';
    END IF;

    IF OLD.ticket_code IS NOT NULL AND NEW.ticket_code IS DISTINCT FROM OLD.ticket_code THEN
        RAISE EXCEPTION 'Registration ticket_code is immutable once issued.';
    END IF;

    -- 2. Student self-approval and state transition checks
    IF auth.uid() IS NOT NULL AND auth.uid() = OLD.student_id THEN
        -- If caller is regular student (not club organizer or admin)
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role IN ('club_member', 'platform_admin')
        ) THEN
            -- Students can ONLY transition their own registration to 'cancelled'
            IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'cancelled' THEN
                RAISE EXCEPTION 'Unauthorized: Students cannot self-approve or directly alter registration status.';
            END IF;
            -- Students cannot alter approval_status
            IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
                RAISE EXCEPTION 'Unauthorized: Students cannot alter approval status.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


-- ─── 3. BUG 2: Update verify_payment_order to authorize state transition ─────
CREATE OR REPLACE FUNCTION public.verify_payment_order(
    p_order_id UUID,
    p_provider_payment_id TEXT,
    p_provider_signature TEXT,
    p_provider_order_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_student_id UUID;
    v_order RECORD;
    v_reg RECORD;
    v_event RECORD;
    v_issued_ticket_code TEXT;
BEGIN
    v_student_id := auth.uid();
    IF v_student_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'UNAUTHENTICATED',
            'message', 'You must be signed in to verify payments.'
        );
    END IF;

    IF p_provider_payment_id IS NULL OR TRIM(p_provider_payment_id) = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_PAYMENT_ID',
            'message', 'Provider payment transaction ID is required.'
        );
    END IF;

    -- Fetch and lock the order
    SELECT * INTO v_order
    FROM public.payment_orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ORDER_NOT_FOUND',
            'message', 'Payment order record was not found.'
        );
    END IF;

    -- Check student ownership
    IF v_order.student_id <> v_student_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'FORBIDDEN',
            'message', 'You can only verify payment orders for your own registrations.'
        );
    END IF;

    -- Idempotent check: if already paid, return confirmed pass immediately
    IF v_order.status = 'paid' THEN
        SELECT ticket_code INTO v_issued_ticket_code
        FROM public.registrations
        WHERE id = v_order.registration_id;

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Payment was already verified and confirmed.',
            'order_id', v_order.id,
            'ticket_code', v_issued_ticket_code,
            'status', 'paid'
        );
    END IF;

    IF v_order.status IN ('cancelled', 'refunded', 'expired') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ORDER_VOID',
            'message', 'This payment order has been ' || v_order.status || ' and cannot be verified.'
        );
    END IF;

    -- Fetch and lock associated registration
    SELECT * INTO v_reg
    FROM public.registrations
    WHERE id = v_order.registration_id
    FOR UPDATE;

    IF v_reg.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'REGISTRATION_NOT_FOUND',
            'message', 'Associated registration record was not found.'
        );
    END IF;

    -- Fetch event
    SELECT * INTO v_event
    FROM public.events
    WHERE id = v_order.event_id;

    -- Generate or retain official ticket code
    v_issued_ticket_code := COALESCE(
        NULLIF(v_reg.ticket_code, ''),
        'TKT-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8)) || '-' || TO_CHAR(now(), 'MIIS')
    );

    -- Update order to paid
    UPDATE public.payment_orders
    SET status = 'paid',
        provider_payment_id = TRIM(p_provider_payment_id),
        provider_order_id = COALESCE(TRIM(p_provider_order_id), provider_order_id),
        provider_signature = TRIM(p_provider_signature),
        paid_at = now(),
        updated_at = now()
    WHERE id = p_order_id;

    -- Set transaction-local flag so tamper trigger allows server confirmation
    PERFORM set_config('festflow.internal_system_operation', 'true', true);

    -- Atomically confirm registration and issue ticket
    UPDATE public.registrations
    SET status = 'confirmed',
        ticket_code = v_issued_ticket_code,
        ticket_issued_at = now(),
        updated_at = now()
    WHERE id = v_order.registration_id;

    -- Notify student
    INSERT INTO public.in_app_notifications (
        user_id,
        title,
        message,
        type,
        link
    ) VALUES (
        v_order.student_id,
        'Payment Confirmed! 🎉',
        'Your payment of ' || v_order.currency || ' ' || v_order.amount::text || ' for ' || v_event.title || ' has been confirmed. Your digital gate pass is ready!',
        'payment_confirmed',
        '/student/tickets/' || v_order.registration_id
    );

    -- Notify club organizer
    IF v_event.club_id IS NOT NULL THEN
        INSERT INTO public.in_app_notifications (
            user_id,
            title,
            message,
            type,
            link
        ) VALUES (
            v_event.club_id,
            'New Ticket Paid',
            'Payment of ' || v_order.currency || ' ' || v_order.amount::text || ' confirmed for ' || v_event.title || ' (Ref: ' || v_issued_ticket_code || ').',
            'ticket_paid',
            '/club/payments?eventId=' || v_event.id
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Payment verified and entry pass confirmed successfully.',
        'order_id', p_order_id,
        'ticket_code', v_issued_ticket_code,
        'status', 'paid'
    );
END;
$$;


-- ─── 4. BUG 4: Fix cancel_registration query (remove non-existent 'outcome') ──
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

  -- Cannot cancel an already cancelled registration
  IF v_reg.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_CANCELLED', 'message', 'Registration is already cancelled.');
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
  -- FIX: Remove 'outcome = VALID' as check_ins table only contains valid admissions
  IF EXISTS (SELECT 1 FROM public.check_ins WHERE registration_id = p_registration_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'ALREADY_CHECKED_IN',
      'message', 'Cannot cancel a pass that has already been verified at the entry gate.'
    );
  END IF;

  -- Set transaction-local flag so tamper trigger allows cancellation
  PERFORM set_config('festflow.internal_system_operation', 'true', true);

  UPDATE public.registrations
  SET status = 'cancelled'::registration_status,
      cancelled_at = now(),
      updated_at = now()
  WHERE id = p_registration_id;

  RETURN jsonb_build_object('success', true, 'message', 'Registration cancelled successfully.');
END;
$$;


-- ─── 5. BUG 1: Enhanced register_for_event with Server-Side Validation ────────
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

  -- 2. Verify caller role
  SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
  IF v_user_role != 'student' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'FORBIDDEN_ROLE',
      'message', 'Only student accounts can register for event passes.'
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

  -- 7. Organizer Required Participant Fields Validation (BUG 1)
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

  -- 8. Organizer Custom Questions Validation (BUG 1)
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
