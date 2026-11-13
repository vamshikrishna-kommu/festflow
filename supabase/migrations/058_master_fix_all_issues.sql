-- ==============================================================================
-- FestFlow Master Database Patch (058)
-- Consolidates Migrations 055, 056, and 057 into a Single Idempotent Script
-- Resolves:
-- 1. "Only student accounts can register for event passes" error
-- 2. Ambiguous register_for_event overload error
-- 3. QR Token direct return for passes
-- 4. Unlimited check-in and check-out (removes 1-time checkout limit)
-- 5. Missing columns (cover_url, registration_mode, allow_reentry, seat_reservation_id)
-- 6. Event Posters and Payment QRs Storage Buckets & Public RLS
-- 7. Club Dashboard registrations visibility RLS
-- ==============================================================================

-- ── 1. Storage Buckets (Public Read & Authenticated Write) ─────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'event-posters',
    'event-posters',
    true,
    10485760, -- 10MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'club-payment-qrs',
    'club-payment-qrs',
    true,
    5242880,  -- 5MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  )
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage Policies
DROP POLICY IF EXISTS "public can view event posters" ON storage.objects;
CREATE POLICY "public can view event posters"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'event-posters');

DROP POLICY IF EXISTS "public can view club payment qrs" ON storage.objects;
CREATE POLICY "public can view club payment qrs"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'club-payment-qrs');

DROP POLICY IF EXISTS "authenticated clubs can upload event posters" ON storage.objects;
CREATE POLICY "authenticated clubs can upload event posters"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-posters'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.club_profiles cp
        WHERE cp.profile_id::text = (storage.foldername(name))[1]
          AND cp.profile_id = auth.uid()
      )
      OR (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        AND (
          public.has_club_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'events.create')
          OR public.has_club_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'events.edit')
        )
      )
      OR public.check_is_platform_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "clubs can update own event posters" ON storage.objects;
CREATE POLICY "clubs can update own event posters"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'event-posters'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.club_profiles cp
        WHERE cp.profile_id::text = (storage.foldername(name))[1]
          AND cp.profile_id = auth.uid()
      )
      OR (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        AND public.has_club_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'events.edit')
      )
      OR public.check_is_platform_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "clubs can delete own event posters" ON storage.objects;
CREATE POLICY "clubs can delete own event posters"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'event-posters'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.club_profiles cp
        WHERE cp.profile_id::text = (storage.foldername(name))[1]
          AND cp.profile_id = auth.uid()
      )
      OR (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        AND public.has_club_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'events.edit')
      )
      OR public.check_is_platform_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Club organizers can manage own payment QRs" ON storage.objects;
CREATE POLICY "Club organizers can manage own payment QRs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'club-payment-qrs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.club_profiles cp
        WHERE cp.profile_id::text = (storage.foldername(name))[1]
          AND cp.profile_id = auth.uid()
      )
      OR (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        AND public.has_club_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'payments.settings')
      )
      OR public.check_is_platform_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Club organizers can update own payment QRs" ON storage.objects;
CREATE POLICY "Club organizers can update own payment QRs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'club-payment-qrs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.club_profiles cp
        WHERE cp.profile_id::text = (storage.foldername(name))[1]
          AND cp.profile_id = auth.uid()
      )
      OR (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        AND public.has_club_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'payments.settings')
      )
      OR public.check_is_platform_admin(auth.uid())
    )
  );

-- ── 2. Ensure Schema Columns Exist Safely ─────────────────────────────────────
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS cancellation_request_status TEXT DEFAULT NULL;

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS seat_reservation_id UUID DEFAULT NULL;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS cover_url TEXT DEFAULT NULL;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS registration_mode TEXT DEFAULT 'standard';

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS allow_reentry BOOLEAN DEFAULT true;

ALTER TABLE public.events
  ALTER COLUMN allow_reentry SET DEFAULT true;

UPDATE public.events
SET allow_reentry = true
WHERE allow_reentry = false;

-- ── 2.5. Resilient Events Update RLS Policy (Guarantees Owners Can Edit Events) ─
DROP POLICY IF EXISTS "clubs can update own events" ON public.events;
DROP POLICY IF EXISTS "Clubs can update their own events" ON public.events;

CREATE POLICY "clubs can update own events"
  ON public.events FOR UPDATE
  TO authenticated
  USING (
    club_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.club_profiles cp
      WHERE cp.profile_id = events.club_id
        AND cp.profile_id = auth.uid()
    )
    OR public.has_event_permission(auth.uid(), club_id, id, 'events.edit')
    OR public.has_event_permission(auth.uid(), club_id, id, 'events.publish')
    OR public.has_event_permission(auth.uid(), club_id, id, 'events.cancel')
    OR public.check_is_platform_admin(auth.uid())
  )
  WITH CHECK (
    club_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.club_profiles cp
      WHERE cp.profile_id = events.club_id
        AND cp.profile_id = auth.uid()
    )
    OR public.has_event_permission(auth.uid(), club_id, id, 'events.edit')
    OR public.has_event_permission(auth.uid(), club_id, id, 'events.publish')
    OR public.has_event_permission(auth.uid(), club_id, id, 'events.cancel')
    OR public.check_is_platform_admin(auth.uid())
  );

-- ── 3. Drop Ambiguous Overloads of register_for_event ──────────────────────────
DROP FUNCTION IF EXISTS public.register_for_event(uuid, text, jsonb, jsonb, jsonb, uuid);

-- ── 4. Canonical 5-Parameter register_for_event ───────────────────────────────
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

-- ── 5. Unambiguous 6-Parameter Compatibility Wrapper (No Defaults) ─────────
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

-- ── 6. Unlimited Check-In & Check-Out Functions ──────────────────────────────
CREATE OR REPLACE FUNCTION public.check_in_ticket(
    p_event_id UUID,
    p_ticket_code_or_payload TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
DECLARE
    v_staff_id UUID;
    v_staff_role TEXT;
    v_event RECORD;
    v_raw_input TEXT;
    v_clean_code TEXT;
    v_base_code TEXT;
    v_member_index INT := 0;
    v_member_name TEXT := NULL;
    v_suffix TEXT;
    v_input_hash TEXT;
    v_clean_hash TEXT;
    v_reg RECORD;
    v_existing_checkin RECORD;
    v_student_profile RECORD;
    v_checked_in_time TIMESTAMPTZ;
    v_team_members JSONB;
    v_member_obj JSONB;
    v_new_entry_count INT := 1;
BEGIN
    v_staff_id := auth.uid();
    IF v_staff_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'UNAUTHORIZED',
            'message', 'You must be signed in to perform attendee check-in.'
        );
    END IF;

    v_raw_input := TRIM(COALESCE(p_ticket_code_or_payload, ''));
    v_clean_code := v_raw_input;

    IF v_clean_code ILIKE 'festflow://pass/%' THEN
        v_clean_code := SUBSTRING(v_clean_code FROM 17);
    ELSIF v_clean_code ILIKE 'festflow://ticket/%' THEN
        v_clean_code := SUBSTRING(v_clean_code FROM 19);
    ELSIF v_clean_code ILIKE '%/pass/%' THEN
        v_clean_code := SUBSTRING(v_clean_code FROM POSITION('/pass/' IN v_clean_code) + 6);
    ELSIF v_clean_code ILIKE '%/ticket/%' THEN
        v_clean_code := SUBSTRING(v_clean_code FROM POSITION('/ticket/' IN v_clean_code) + 8);
    END IF;

    IF POSITION('?' IN v_clean_code) > 0 THEN
        v_clean_code := SUBSTRING(v_clean_code FROM 1 FOR POSITION('?' IN v_clean_code) - 1);
    END IF;
    v_clean_code := TRIM(TRAILING '/' FROM v_clean_code);
    v_clean_code := TRIM(v_clean_code);

    IF v_clean_code IS NULL OR length(v_clean_code) < 3 THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'INVALID_TICKET',
            'message', 'No valid ticket or pass token was provided.'
        );
    END IF;

    IF v_clean_code ~* '^(FF|TKT)-[A-Z0-9]+' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'INVALID_TICKET',
            'message', 'Human-readable ticket reference codes cannot be used for gate admission. The student must present their official bearer QR pass.'
        );
    END IF;

    SELECT id, club_id, title, status, start_date, end_date, allow_reentry
    INTO v_event
    FROM public.events
    WHERE id = p_event_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'EVENT_NOT_FOUND',
            'message', 'Event not found.'
        );
    END IF;

    SELECT role INTO v_staff_role FROM public.profiles WHERE id = v_staff_id;
    IF v_staff_role IS DISTINCT FROM 'platform_admin' THEN
        IF NOT (
            v_event.club_id = v_staff_id
            OR EXISTS (
                SELECT 1 FROM public.club_memberships cm
                JOIN public.club_roles cr ON cr.id = cm.role_id
                WHERE cm.club_id = v_event.club_id
                  AND cm.user_id = v_staff_id
                  AND cm.status = 'active'
                  AND (
                      cr.is_owner = true
                      OR cr.permissions @> ARRAY['checkin.perform']::text[]
                      OR cr.permissions @> ARRAY['*']::text[]
                  )
            )
        ) THEN
            RETURN jsonb_build_object(
                'success', false,
                'outcome', 'FORBIDDEN',
                'message', 'You do not have scanner admission permissions for this event.'
            );
        END IF;
    END IF;

    v_base_code := v_clean_code;
    IF v_clean_code ~ '.*-[0-9]+$' THEN
        v_suffix := SUBSTRING(v_clean_code FROM '-([0-9]+)$');
        v_member_index := v_suffix::INT;
        v_base_code := SUBSTRING(v_clean_code FROM 1 FOR (length(v_clean_code) - length(v_suffix) - 1));
    END IF;

    v_input_hash := encode(digest(v_clean_code, 'sha256'), 'hex');
    v_clean_hash := encode(digest(v_base_code, 'sha256'), 'hex');

    SELECT
        r.id, r.event_id, r.student_id, r.ticket_code, r.qr_token, r.status,
        r.approval_status, r.team_name, r.team_members, r.participant_details,
        r.cancellation_requested_at, r.checked_in_at, r.entry_count
    INTO v_reg
    FROM public.registrations r
    WHERE r.event_id = p_event_id
      AND (
          r.qr_token = v_clean_code
          OR r.qr_token = v_base_code
          OR r.qr_token_hash = v_input_hash
          OR r.qr_token_hash = v_clean_hash
      );

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'INVALID_TICKET',
            'message', 'Pass token is invalid, unrecognized, or belongs to a different event.'
        );
    END IF;

    IF v_reg.status = 'cancelled' OR v_reg.cancellation_requested_at IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'CANCELLED_PASS',
            'message', 'This pass was cancelled or submitted for cancellation refund and is void.'
        );
    END IF;

    IF v_reg.status IN ('pending_payment', 'pending_approval') THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'UNCONFIRMED_REGISTRATION',
            'message', 'Registration is not yet confirmed.'
        );
    END IF;

    SELECT id, checked_in_at, checked_out_at, entry_number
    INTO v_existing_checkin
    FROM public.attendance_logs
    WHERE registration_id = v_reg.id
      AND member_index = v_member_index
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_checkin.id IS NOT NULL AND v_existing_checkin.checked_out_at IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'ALREADY_CHECKED_IN',
            'message', 'Attendee is ALREADY CHECKED IN inside the venue.',
            'checked_in_at', v_existing_checkin.checked_in_at,
            'entry_count', COALESCE(v_reg.entry_count, 1)
        );
    END IF;

    v_checked_in_time := clock_timestamp();
    v_new_entry_count := COALESCE(v_reg.entry_count, 0) + 1;

    PERFORM set_config('festflow.internal_system_operation', 'true', true);

    UPDATE public.registrations
    SET checked_in_at = COALESCE(checked_in_at, v_checked_in_time),
        entry_count = v_new_entry_count,
        updated_at = v_checked_in_time
    WHERE id = v_reg.id;

    INSERT INTO public.attendance_logs (
        event_id,
        registration_id,
        student_id,
        member_index,
        entry_number,
        checked_in_at,
        checked_in_by,
        checkin_method,
        notes,
        created_at
    ) VALUES (
        p_event_id,
        v_reg.id,
        v_reg.student_id,
        v_member_index,
        v_new_entry_count,
        v_checked_in_time,
        v_staff_id,
        'qr_scanner',
        p_notes,
        v_checked_in_time
    );

    SELECT full_name, roll_number, college_name, department, email
    INTO v_student_profile
    FROM public.student_profiles
    WHERE id = v_reg.student_id;

    RETURN jsonb_build_object(
        'success', true,
        'outcome', 'CHECKED_IN',
        'message', CASE WHEN v_new_entry_count > 1 THEN 'Re-entry approved. Welcome back!' ELSE 'Admission verified. Welcome to the event!' END,
        'checked_in_at', v_checked_in_time,
        'entry_count', v_new_entry_count,
        'attendee_name', COALESCE(v_student_profile.full_name, 'Campus Attendee'),
        'roll_number', v_student_profile.roll_number,
        'ticket_code', v_reg.ticket_code
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_out_ticket(
    p_event_id UUID,
    p_ticket_code_or_payload TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
DECLARE
    v_staff_id UUID;
    v_event RECORD;
    v_clean_code TEXT;
    v_base_code TEXT;
    v_member_index INT := 0;
    v_suffix TEXT;
    v_reg RECORD;
    v_active_checkin RECORD;
    v_checked_out_time TIMESTAMPTZ;
BEGIN
    v_staff_id := auth.uid();
    v_clean_code := TRIM(COALESCE(p_ticket_code_or_payload, ''));

    IF v_clean_code ILIKE 'festflow://pass/%' THEN
        v_clean_code := SUBSTRING(v_clean_code FROM 17);
    ELSIF v_clean_code ILIKE '%/pass/%' THEN
        v_clean_code := SUBSTRING(v_clean_code FROM POSITION('/pass/' IN v_clean_code) + 6);
    END IF;
    IF POSITION('?' IN v_clean_code) > 0 THEN
        v_clean_code := SUBSTRING(v_clean_code FROM 1 FOR POSITION('?' IN v_clean_code) - 1);
    END IF;
    v_clean_code := TRIM(TRAILING '/' FROM v_clean_code);

    v_base_code := v_clean_code;
    IF v_clean_code ~ '.*-[0-9]+$' THEN
        v_suffix := SUBSTRING(v_clean_code FROM '-([0-9]+)$');
        v_member_index := v_suffix::INT;
        v_base_code := SUBSTRING(v_clean_code FROM 1 FOR (length(v_clean_code) - length(v_suffix) - 1));
    END IF;

    SELECT id INTO v_reg
    FROM public.registrations
    WHERE event_id = p_event_id
      AND (qr_token = v_clean_code OR qr_token = v_base_code);

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'outcome', 'NOT_FOUND', 'message', 'Pass not found.');
    END IF;

    SELECT id INTO v_active_checkin
    FROM public.attendance_logs
    WHERE registration_id = v_reg.id
      AND member_index = v_member_index
      AND checked_out_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'outcome', 'NOT_CHECKED_IN', 'message', 'Attendee is not currently checked in.');
    END IF;

    v_checked_out_time := clock_timestamp();

    UPDATE public.attendance_logs
    SET checked_out_at = v_checked_out_time,
        checked_out_by = v_staff_id,
        notes = CASE WHEN p_notes IS NOT NULL THEN COALESCE(notes, '') || ' | ' || p_notes ELSE notes END
    WHERE id = v_active_checkin.id;

    RETURN jsonb_build_object(
        'success', true,
        'outcome', 'CHECKED_OUT',
        'message', 'Attendee successfully checked out. Re-entry is permitted at any time.',
        'checked_out_at', v_checked_out_time
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_in_ticket(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_out_ticket(uuid, text, text) TO authenticated, service_role;

-- ── 7. Fix Club Registrations RLS ─────────────────────────────────────────────
DROP POLICY IF EXISTS "clubs can view registrations for their events" ON public.registrations;
CREATE POLICY "clubs can view registrations for their events"
  ON public.registrations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = registrations.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_profiles cp
            WHERE cp.profile_id = e.club_id
              AND cp.profile_id = auth.uid()
          )
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.view')
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'payments.view')
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'reports.view')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "clubs can update registrations for their events" ON public.registrations;
CREATE POLICY "clubs can update registrations for their events"
  ON public.registrations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = registrations.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_profiles cp
            WHERE cp.profile_id = e.club_id
              AND cp.profile_id = auth.uid()
          )
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.manage')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = registrations.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_profiles cp
            WHERE cp.profile_id = e.club_id
              AND cp.profile_id = auth.uid()
          )
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.manage')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );

-- Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'registrations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.registrations;
  END IF;
END;
$$;

-- ── 8. Resilient Seat Booking & Live Availability ─────────────────────────────

-- Auto-publish layouts for published events so students always see seats
UPDATE public.seat_layouts sl
SET is_published = true
WHERE EXISTS (
  SELECT 1 FROM public.events e
  WHERE e.id = sl.event_id AND e.status = 'published'
) AND (sl.is_published IS NULL OR sl.is_published = false);

-- Resilient get_seat_availability RPC
CREATE OR REPLACE FUNCTION public.get_seat_availability(
  p_event_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Reclaim stale holds first
  PERFORM public.reclaim_expired_seat_holds(p_event_id);

  SELECT jsonb_agg(
    jsonb_build_object(
      'seat_id',         s.id,
      'display_label',   s.display_label,
      'row_identifier',  s.row_identifier,
      'column_position', s.column_position,
      'section',         s.section,
      'is_blocked',      s.is_blocked,
      'is_accessible',   s.is_accessible,
      'is_aisle_gap',    s.is_aisle_gap,
      'category_id',     s.category_id,
      'status',
        CASE
          WHEN s.is_aisle_gap THEN 'aisle_gap'
          WHEN s.is_blocked   THEN 'blocked'
          WHEN sr.id IS NOT NULL THEN sr.status
          ELSE 'available'
        END,
      'held_until', sr.held_until,
      'is_mine',    (sr.student_id = auth.uid())
    )
  )
  INTO v_result
  FROM        public.seats s
  JOIN        public.seat_layouts sl
                ON  sl.id         = s.layout_id
                AND sl.event_id   = p_event_id
                AND (sl.is_published = true OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event_id AND e.status = 'published'))
  LEFT JOIN   public.seat_reservations sr
                ON  sr.seat_id  = s.id
                AND sr.event_id = p_event_id
                AND sr.status IN ('held', 'payment_submitted', 'payment_under_review', 'confirmed');

  RETURN COALESCE(v_result, '[]'::JSONB);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_seat_availability(UUID) TO anon, authenticated, service_role;

-- Allow club organizers to view seat reservations for their events
DROP POLICY IF EXISTS "Students can view own seat reservations" ON public.seat_reservations;
DROP POLICY IF EXISTS "Clubs and students can view seat reservations" ON public.seat_reservations;
CREATE POLICY "Clubs and students can view seat reservations"
  ON public.seat_reservations FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = seat_reservations.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_profiles cp
            WHERE cp.profile_id = e.club_id
              AND cp.profile_id = auth.uid()
          )
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.view')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );

-- Enable Realtime for seat_reservations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'seat_reservations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.seat_reservations;
  END IF;
END;
$$;

-- ── 9. Show Seat Availability Toggle & Authoritative Counter for Attendees ─────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS show_seat_availability BOOLEAN NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.get_event_seat_counts(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity integer := 100;
  v_reg_mode text := 'standard';
  v_show_seats boolean := true;
  v_occupied integer := 0;
  v_total integer := 100;
  v_remaining integer := 100;
BEGIN
  SELECT
    COALESCE(capacity, 100),
    COALESCE(registration_mode, 'standard'),
    COALESCE(show_seat_availability, true)
  INTO v_capacity, v_reg_mode, v_show_seats
  FROM public.events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('total', 100, 'occupied', 0, 'remaining', 100, 'show_seat_availability', true);
  END IF;

  IF v_reg_mode = 'reserved_seating' THEN
    SELECT COUNT(*) INTO v_total
    FROM public.seats s
    JOIN public.seat_layouts sl ON sl.id = s.layout_id AND sl.event_id = p_event_id AND sl.is_published = true
    WHERE s.is_aisle_gap = false AND s.is_blocked = false;

    IF v_total = 0 THEN
      v_total := v_capacity;
    END IF;

    BEGIN
      PERFORM public.reclaim_expired_seat_holds(p_event_id);
    EXCEPTION WHEN OTHERS THEN
      -- ignore if helper not loaded
    END;

    SELECT COUNT(*) INTO v_occupied
    FROM public.seat_reservations
    WHERE event_id = p_event_id
      AND status IN ('held', 'payment_submitted', 'payment_under_review', 'confirmed')
      AND (status != 'held' OR held_until IS NULL OR held_until > now());

  ELSE
    v_total := v_capacity;

    SELECT COUNT(*) INTO v_occupied
    FROM public.registrations
    WHERE event_id = p_event_id
      AND status IN ('confirmed', 'pending_approval', 'pending_payment');
  END IF;

  v_remaining := GREATEST(0, v_total - v_occupied);

  RETURN jsonb_build_object(
    'total', v_total,
    'occupied', v_occupied,
    'remaining', v_remaining,
    'show_seat_availability', v_show_seats
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_seat_counts(uuid) TO anon, authenticated, service_role;


