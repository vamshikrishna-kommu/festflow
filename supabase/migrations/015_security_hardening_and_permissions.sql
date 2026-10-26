-- ============================================================================
-- FestFlow Migration 015: Supabase Security, Database Integrity & Permissions
-- ============================================================================
-- PHASE 7 BACKEND HARDENING:
-- 1. Eliminate cross-club payment proof data leakage in storage.objects RLS.
-- 2. Prevent role escalation and verification status tampering on public.profiles.
-- 3. Prevent registration identity tampering, ticket forgery, and self-approval on public.registrations.
-- 4. Enforce payment submission integrity and prevent student self-approvals on public.payment_submissions.
-- 5. Harden public.queue_email RPC against unauthenticated spam relay and privilege abuse.
-- 6. Add missing UPDATE and DELETE storage policies for avatars and club-payment-qrs.
-- 7. Grant platform_admin authorization parity in review_registration_application and send_event_reminders.
-- Non-destructive, additive, and safe for existing records.
-- ============================================================================

-- ─── 1. Storage RLS Hardening: Re-scope payment-proofs ────────────────────────
-- FIXES FINDING 1 (HIGH): Prevent organizers from viewing payment proofs for other clubs' events
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can read own payment proofs" ON storage.objects;
    DROP POLICY IF EXISTS "Users can read authorized payment proofs" ON storage.objects;
END $$;

CREATE POLICY "Users can read authorized payment proofs"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'payment-proofs' AND (
            -- 1. The student who uploaded the screenshot can always view it
            (storage.foldername(name))[1] = auth.uid()::text
            OR
            -- 2. The organizer of the event that the student submitted a payment for
            EXISTS (
                SELECT 1
                FROM public.payment_submissions ps
                JOIN public.events e ON e.id = ps.event_id
                WHERE ps.student_id::text = (storage.foldername(name))[1]
                  AND e.club_id = auth.uid()
            )
            OR
            -- 3. The organizer of the event that the student registered for
            EXISTS (
                SELECT 1
                FROM public.registrations r
                JOIN public.events e ON e.id = r.event_id
                WHERE r.student_id::text = (storage.foldername(name))[1]
                  AND e.club_id = auth.uid()
            )
            OR
            -- 4. Platform administrators with legitimate audit authority
            EXISTS (
                SELECT 1
                FROM public.profiles p
                WHERE p.id = auth.uid()
                  AND p.role = 'platform_admin'
            )
        )
    );

COMMENT ON POLICY "Users can read authorized payment proofs" ON storage.objects IS
    'Restricts payment screenshot access strictly to the uploading student, the authorized event host, or platform admins.';

-- ─── 2. Storage RLS: Missing UPDATE and DELETE for Avatars and QRs ───────────
-- FIXES FINDING 7 (LOW): Users could upload but not update or delete their avatars/QRs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
    DROP POLICY IF EXISTS "Club organizers can update own payment QRs" ON storage.objects;
    DROP POLICY IF EXISTS "Club organizers can delete own payment QRs" ON storage.objects;
END $$;

CREATE POLICY "Users can update own avatar"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'avatars' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Users can delete own avatar"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'avatars' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Club organizers can update own payment QRs"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'club-payment-qrs' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Club organizers can delete own payment QRs"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'club-payment-qrs' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- ─── 3. Trigger: Prevent Profile Role & Verification Escalation ───────────────
-- FIXES FINDING 4 (MEDIUM): Prevents users from elevating role or setting is_verified = true
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- If role or is_verified is being modified
    IF (OLD.role IS DISTINCT FROM NEW.role OR OLD.is_verified IS DISTINCT FROM NEW.is_verified) THEN
        -- Allow if executed by service_role or platform_admin
        IF auth.uid() IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin'
        ) THEN
            RAISE EXCEPTION 'Unauthorized: Users cannot modify their role or verification status directly.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- ─── 4. Trigger: Prevent Registration Identity Tampering & Self-Approval ─────
-- FIXES FINDING 5 (MEDIUM): Freezes event_id, student_id, ticket_code and blocks self-approval
CREATE OR REPLACE FUNCTION public.prevent_registration_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

DROP TRIGGER IF EXISTS trg_prevent_registration_tampering ON public.registrations;
CREATE TRIGGER trg_prevent_registration_tampering
BEFORE UPDATE ON public.registrations
FOR EACH ROW
EXECUTE FUNCTION public.prevent_registration_tampering();

-- ─── 5. Trigger: Enforce Payment Submission Integrity ─────────────────────────
-- Guarantees that students cannot insert an already-approved payment or forge reviewer fields
CREATE OR REPLACE FUNCTION public.enforce_payment_submission_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_expected_price numeric(10,2);
    v_is_organizer boolean := false;
BEGIN
    -- On INSERT:
    IF TG_OP = 'INSERT' THEN
        -- Verify amount is not less than event price
        SELECT price INTO v_expected_price FROM public.events WHERE id = NEW.event_id;
        IF v_expected_price IS NOT NULL AND NEW.amount < v_expected_price THEN
            RAISE EXCEPTION 'Submitted payment amount (INR %) cannot be less than event price (INR %).', NEW.amount, v_expected_price;
        END IF;

        -- Ensure student_id matches caller when authenticated
        IF auth.uid() IS NOT NULL AND NEW.student_id <> auth.uid() THEN
            RAISE EXCEPTION 'student_id must match authenticated user identity.';
        END IF;

        -- Ensure regular students cannot inject status = 'approved'
        IF auth.uid() IS NOT NULL THEN
            SELECT EXISTS (
                SELECT 1 FROM public.events e 
                WHERE e.id = NEW.event_id AND (
                    e.club_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin')
                )
            ) INTO v_is_organizer;

            IF NOT v_is_organizer AND NEW.status <> 'pending_review' THEN
                NEW.status := 'pending_review';
            END IF;
        END IF;
    END IF;

    -- On UPDATE:
    IF TG_OP = 'UPDATE' THEN
        -- Prevent changing event_id or registration_id
        IF OLD.event_id IS DISTINCT FROM NEW.event_id OR OLD.registration_id IS DISTINCT FROM NEW.registration_id THEN
            RAISE EXCEPTION 'Payment submission references are immutable.';
        END IF;

        -- Prevent student from altering status or audit fields directly
        IF auth.uid() IS NOT NULL AND auth.uid() = OLD.student_id THEN
            SELECT EXISTS (
                SELECT 1 FROM public.events e 
                WHERE e.id = OLD.event_id AND (
                    e.club_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin')
                )
            ) INTO v_is_organizer;

            IF NOT v_is_organizer THEN
                IF OLD.status IS DISTINCT FROM NEW.status THEN
                    RAISE EXCEPTION 'Unauthorized: Students cannot modify payment submission status directly.';
                END IF;
                IF OLD.reviewer_id IS DISTINCT FROM NEW.reviewer_id OR OLD.reviewed_at IS DISTINCT FROM NEW.reviewed_at THEN
                    RAISE EXCEPTION 'Unauthorized: Students cannot modify review audit fields.';
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_payment_submission_integrity ON public.payment_submissions;
CREATE TRIGGER trg_enforce_payment_submission_integrity
BEFORE INSERT OR UPDATE ON public.payment_submissions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_payment_submission_integrity();

-- ─── 6. Secure queue_email RPC Function ───────────────────────────────────────
-- FIXES FINDING 3 (HIGH): Prevent unauthenticated spam relay and ensure identity ownership
CREATE OR REPLACE FUNCTION public.queue_email(
    p_recipient_email TEXT,
    p_recipient_name TEXT,
    p_template_type TEXT,
    p_subject TEXT,
    p_payload JSONB,
    p_idempotency_key TEXT,
    p_event_id UUID DEFAULT NULL,
    p_registration_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_is_authorized BOOLEAN := FALSE;
    v_new_id UUID;
BEGIN
    v_caller_id := auth.uid();

    -- Reject completely unauthenticated requests unless invoked with service_role internal claim
    IF v_caller_id IS NULL AND COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'UNAUTHENTICATED',
            'message', 'Authentication required to queue emails.'
        );
    END IF;

    -- Granular authorization checks for authenticated users
    IF v_caller_id IS NOT NULL THEN
        -- 1. Caller is queueing notification for themselves
        IF p_user_id IS NOT NULL AND p_user_id = v_caller_id THEN
            v_is_authorized := TRUE;
        END IF;

        -- 2. Caller is the attendee of the registration
        IF NOT v_is_authorized AND p_registration_id IS NOT NULL THEN
            SELECT EXISTS (
                SELECT 1 FROM public.registrations WHERE id = p_registration_id AND student_id = v_caller_id
            ) INTO v_is_authorized;
        END IF;

        -- 3. Caller is the club organizer of the event
        IF NOT v_is_authorized AND p_event_id IS NOT NULL THEN
            SELECT EXISTS (
                SELECT 1 FROM public.events WHERE id = p_event_id AND club_id = v_caller_id
            ) INTO v_is_authorized;
        END IF;

        -- 4. Caller is a platform administrator
        IF NOT v_is_authorized THEN
            SELECT EXISTS (
                SELECT 1 FROM public.profiles WHERE id = v_caller_id AND role = 'platform_admin'
            ) INTO v_is_authorized;
        END IF;

        IF NOT v_is_authorized THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'UNAUTHORIZED',
                'message', 'You do not have permission to queue transactional emails for this event or user.'
            );
        END IF;
    END IF;

    -- Check idempotency
    IF p_idempotency_key IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.email_outbox WHERE idempotency_key = p_idempotency_key
    ) THEN
        RETURN jsonb_build_object(
            'success', true,
            'queued', false,
            'message', 'Email already queued or sent under this idempotency key.'
        );
    END IF;

    INSERT INTO public.email_outbox (
        recipient_email,
        recipient_name,
        template_type,
        subject,
        payload,
        idempotency_key,
        event_id,
        registration_id,
        user_id,
        status,
        created_at,
        updated_at
    ) VALUES (
        TRIM(p_recipient_email),
        TRIM(p_recipient_name),
        TRIM(p_template_type),
        TRIM(p_subject),
        p_payload,
        p_idempotency_key,
        p_event_id,
        p_registration_id,
        p_user_id,
        'pending',
        now(),
        now()
    )
    RETURNING id INTO v_new_id;

    RETURN jsonb_build_object(
        'success', true,
        'queued', true,
        'outbox_id', v_new_id,
        'message', 'Email successfully queued in outbox.'
    );
END;
$$;

-- Explicitly revoke execution from anon
REVOKE EXECUTE ON FUNCTION public.queue_email FROM anon;
GRANT EXECUTE ON FUNCTION public.queue_email TO authenticated, service_role;

-- ─── 7. Platform Admin Parity: review_registration_application ───────────────
-- FIXES FINDING 8 (LOW): Enable platform admins to review registration applications
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
  v_is_authorized boolean := false;
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

  -- 3. Fetch event & verify caller owns the club OR is platform admin
  SELECT * INTO v_event FROM public.events WHERE id = v_reg.event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Event not found.');
  END IF;

  IF v_event.club_id = v_user_id THEN
    v_is_authorized := true;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = v_user_id AND role = 'platform_admin'
    ) INTO v_is_authorized;
  END IF;

  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'Only the event host or platform admin can review this application.');
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
      WHEN p_decision = 'approved' AND v_event.is_free THEN 'Application approved. Free pass issued!'
      WHEN p_decision = 'approved' THEN 'Application approved. Awaiting student payment.'
      ELSE 'Application rejected.'
    END
  );
END;
$$;

-- ─── 8. Platform Admin Parity: send_event_reminders ───────────────────────────
CREATE OR REPLACE FUNCTION public.send_event_reminders(
    p_event_id UUID,
    p_custom_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_event RECORD;
    v_reg RECORD;
    v_count INT := 0;
    v_date_str TEXT;
    v_idempotency TEXT;
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'You must be signed in.');
    END IF;

    -- Confirm event exists
    SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
    IF v_event.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Event not found.');
    END IF;

    -- Verify caller owns the event OR is platform admin
    IF v_event.club_id = v_caller_id THEN
        v_is_authorized := TRUE;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.profiles WHERE id = v_caller_id AND role = 'platform_admin'
        ) INTO v_is_authorized;
    END IF;

    IF NOT v_is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Only the owning club organizer or platform admin can send reminders.');
    END IF;

    v_date_str := TO_CHAR(now(), 'YYYYMMDD');

    -- Loop over confirmed attendees only
    FOR v_reg IN
        SELECT r.id AS reg_id, r.ticket_code, p.id AS student_id, p.display_name, p.email
        FROM public.registrations r
        JOIN public.profiles p ON p.id = r.student_id
        WHERE r.event_id = p_event_id AND r.status = 'confirmed'
    LOOP
        v_idempotency := 'remind-' || p_event_id::text || '-' || v_reg.reg_id::text || '-' || v_date_str;

        IF NOT EXISTS (SELECT 1 FROM public.email_outbox WHERE idempotency_key = v_idempotency) THEN
            INSERT INTO public.email_outbox (
                recipient_email,
                recipient_name,
                template_type,
                subject,
                payload,
                idempotency_key,
                event_id,
                registration_id,
                user_id,
                status
            ) VALUES (
                v_reg.email,
                v_reg.display_name,
                'event_reminder',
                'Reminder: ' || v_event.title || ' is coming up!',
                jsonb_build_object(
                    'event_title', v_event.title,
                    'start_date', v_event.start_date,
                    'venue_name', v_event.venue_name,
                    'ticket_code', v_reg.ticket_code,
                    'custom_message', p_custom_message,
                    'ticket_link', '/student/tickets/' || v_reg.reg_id::text
                ),
                v_idempotency,
                p_event_id,
                v_reg.reg_id,
                v_reg.student_id,
                'pending'
            );

            INSERT INTO public.in_app_notifications (
                user_id,
                title,
                message,
                type,
                link
            ) VALUES (
                v_reg.student_id,
                'Event Reminder: ' || v_event.title,
                'Upcoming event: ' || v_event.title || ' on ' || TO_CHAR(v_event.start_date, 'Mon DD') || ' at ' || v_event.venue_name || '.' ||
                CASE WHEN p_custom_message IS NOT NULL AND p_custom_message <> '' THEN ' Note from organizer: ' || p_custom_message ELSE '' END,
                'event_reminder',
                '/student/tickets/' || v_reg.reg_id::text
            );

            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'reminders_queued', v_count,
        'message', v_count || ' event reminders successfully queued.'
    );
END;
$$;
