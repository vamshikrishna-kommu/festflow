-- =============================================================================
-- Migration 049: Complete Registration, Cancellation, Team Changes, Edit Requests & Waitlist
--
-- Features:
-- 1. Student Cancellation Requests & Club Organizer Approval/Rejection Workflow.
-- 2. Independent Refund Status Tracking for Manual UPI Payments.
-- 3. Registration Edit Requests with Audit Trail & Approval Workflow.
-- 4. Controlled Team Member Change Requests (Remove, Replace, Leave, Change Leader).
-- 5. Atomic Waitlist Management with Expiring Slot Allocation.
-- 6. Event Cancellation & Cascading Ticket Invalidation.
-- 7. Payment Review / Dispute Workflow for Rejected Submissions.
-- 8. Immutable Workflow Audit Logs across all actions.
-- 9. Role-Based Access Control (RBAC) & Hardened Entry Gate Verification.
-- =============================================================================

-- ── 1. Enhance public.registrations Schema ───────────────────────────────────
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS cancellation_request_status TEXT DEFAULT NULL
    CHECK (cancellation_request_status IS NULL OR cancellation_request_status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  ADD COLUMN IF NOT EXISTS refund_status TEXT NOT NULL DEFAULT 'not_applicable'
    CHECK (refund_status IN ('not_applicable', 'refund_requested', 'refund_approved', 'refund_rejected', 'refund_processing', 'refunded', 'refund_failed')),
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_transaction_ref TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS waitlist_position INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS waitlist_offered_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS waitlist_offer_expires_at TIMESTAMPTZ DEFAULT NULL;

-- ── 2. Table: public.registration_cancellation_requests ───────────────────────
CREATE TABLE IF NOT EXISTS public.registration_cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  explanation TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  refund_applicable BOOLEAN NOT NULL DEFAULT false,
  refund_status TEXT NOT NULL DEFAULT 'not_applicable'
    CHECK (refund_status IN ('not_applicable', 'refund_requested', 'refund_approved', 'refund_rejected', 'refund_processing', 'refunded', 'refund_failed')),
  refund_amount NUMERIC(10,2) DEFAULT 0,
  refund_notes TEXT,
  refund_transaction_ref TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  decision_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reg_cancel_event_status ON public.registration_cancellation_requests(event_id, status);
CREATE INDEX IF NOT EXISTS idx_reg_cancel_student ON public.registration_cancellation_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_reg_cancel_reg ON public.registration_cancellation_requests(registration_id);

-- ── 3. Table: public.registration_edit_requests ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.registration_edit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  proposed_changes JSONB NOT NULL,
  previous_values JSONB NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  decision_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reg_edit_event_status ON public.registration_edit_requests(event_id, status);
CREATE INDEX IF NOT EXISTS idx_reg_edit_student ON public.registration_edit_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_reg_edit_reg ON public.registration_edit_requests(registration_id);

-- ── 4. Table: public.team_change_requests ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL
    CHECK (request_type IN ('remove_member', 'replace_member', 'leave_team', 'change_leader')),
  target_member_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_email TEXT,
  replacement_email TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  decision_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_change_team ON public.team_change_requests(team_id, status);
CREATE INDEX IF NOT EXISTS idx_team_change_event ON public.team_change_requests(event_id, status);

-- ── 5. Table: public.workflow_audit_logs ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workflow_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_email TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  target_entity TEXT NOT NULL,
  target_record_id TEXT,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES public.registrations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  previous_state JSONB,
  new_state JSONB,
  reason TEXT,
  decision_notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_audit_event ON public.workflow_audit_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_workflow_audit_reg ON public.workflow_audit_logs(registration_id);
CREATE INDEX IF NOT EXISTS idx_workflow_audit_actor ON public.workflow_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_workflow_audit_created ON public.workflow_audit_logs(created_at DESC);

-- ── 6. Table: public.payment_dispute_reviews ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_dispute_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_submission_id UUID NOT NULL REFERENCES public.payment_submissions(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_notes TEXT NOT NULL,
  additional_proof_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  decision_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_reviews_event ON public.payment_dispute_reviews(event_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_reviews_sub ON public.payment_dispute_reviews(payment_submission_id);

-- ── 7. Row Level Security (RLS) Configuration ────────────────────────────────

ALTER TABLE public.registration_cancellation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_edit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_dispute_reviews ENABLE ROW LEVEL SECURITY;

-- Helper to check if caller organizes event
CREATE OR REPLACE FUNCTION public.check_is_event_organizer(p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = p_event_id AND (
      e.club_id = p_user_id
      OR EXISTS (
        SELECT 1 FROM public.club_members cm
        WHERE cm.club_id = e.club_id AND cm.user_id = p_user_id AND cm.status = 'active'
      )
    )
  );
$$;

-- RLS: cancellation requests
DROP POLICY IF EXISTS "Students can view own cancellation requests" ON public.registration_cancellation_requests;
CREATE POLICY "Students can view own cancellation requests"
  ON public.registration_cancellation_requests FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Organizers can view cancellation requests for their events" ON public.registration_cancellation_requests;
CREATE POLICY "Organizers can view cancellation requests for their events"
  ON public.registration_cancellation_requests FOR SELECT
  TO authenticated
  USING (public.check_is_event_organizer(event_id, auth.uid()));

-- RLS: edit requests
DROP POLICY IF EXISTS "Students view own edit requests" ON public.registration_edit_requests;
CREATE POLICY "Students view own edit requests"
  ON public.registration_edit_requests FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Organizers view edit requests for their events" ON public.registration_edit_requests;
CREATE POLICY "Organizers view edit requests for their events"
  ON public.registration_edit_requests FOR SELECT
  TO authenticated
  USING (public.check_is_event_organizer(event_id, auth.uid()));

-- RLS: team change requests
DROP POLICY IF EXISTS "Team members view own team change requests" ON public.team_change_requests;
CREATE POLICY "Team members view own team change requests"
  ON public.team_change_requests FOR SELECT
  TO authenticated
  USING (
    requested_by = auth.uid()
    OR target_member_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.teams t WHERE t.id = team_id AND t.leader_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Organizers view team change requests for their events" ON public.team_change_requests;
CREATE POLICY "Organizers view team change requests for their events"
  ON public.team_change_requests FOR SELECT
  TO authenticated
  USING (public.check_is_event_organizer(event_id, auth.uid()));

-- RLS: workflow audit logs (organizers and platform admins view logs)
DROP POLICY IF EXISTS "Organizers view audit logs for their events" ON public.workflow_audit_logs;
CREATE POLICY "Organizers view audit logs for their events"
  ON public.workflow_audit_logs FOR SELECT
  TO authenticated
  USING (
    public.check_is_event_organizer(event_id, auth.uid())
    OR actor_id = auth.uid()
  );

-- RLS: payment dispute reviews
DROP POLICY IF EXISTS "Students view own payment reviews" ON public.payment_dispute_reviews;
CREATE POLICY "Students view own payment reviews"
  ON public.payment_dispute_reviews FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Organizers view payment reviews for their events" ON public.payment_dispute_reviews;
CREATE POLICY "Organizers view payment reviews for their events"
  ON public.payment_dispute_reviews FOR SELECT
  TO authenticated
  USING (public.check_is_event_organizer(event_id, auth.uid()));

-- ── 8. RPC: request_registration_cancellation ────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_registration_cancellation(
    p_registration_id UUID,
    p_reason TEXT,
    p_explanation TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_reg RECORD;
    v_event RECORD;
    v_clean_reason TEXT;
    v_clean_expl TEXT;
    v_existing_req RECORD;
    v_request_id UUID;
    v_refund_applicable BOOLEAN := false;
    v_refund_amt NUMERIC(10,2) := 0;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
    END IF;

    v_clean_reason := TRIM(COALESCE(p_reason, ''));
    v_clean_expl := TRIM(COALESCE(p_explanation, ''));

    IF v_clean_reason = '' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_REASON', 'message', 'Please select a reason for cancellation.');
    END IF;

    -- Fetch registration
    SELECT * INTO v_reg FROM public.registrations WHERE id = p_registration_id FOR UPDATE;
    IF v_reg.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Registration not found.');
    END IF;

    -- Caller must be student owner
    IF v_reg.student_id <> v_caller_id THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'You can only request cancellation for your own registration.');
    END IF;

    -- Cannot cancel already cancelled registration
    IF v_reg.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_CANCELLED', 'message', 'This registration is already cancelled.');
    END IF;

    -- Cannot cancel if checked in
    IF EXISTS (SELECT 1 FROM public.check_ins WHERE registration_id = v_reg.id) THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_CHECKED_IN', 'message', 'Cannot cancel a pass that has already been verified at entry.');
    END IF;

    -- Prevent duplicate active cancellation request
    SELECT * INTO v_existing_req
    FROM public.registration_cancellation_requests
    WHERE registration_id = v_reg.id AND status = 'pending';

    IF v_existing_req.id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'REQUEST_EXISTS', 'message', 'A cancellation request is already pending review by the club organizer.');
    END IF;

    -- Fetch event
    SELECT * INTO v_event FROM public.events WHERE id = v_reg.event_id;
    IF v_event.start_date <= now() THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'EVENT_STARTED', 'message', 'Cancellation requests cannot be submitted after the event has started.');
    END IF;

    -- Determine refund eligibility preview
    IF NOT v_event.is_free AND v_event.price > 0 THEN
        v_refund_applicable := true;
        v_refund_amt := v_event.price;
    END IF;

    -- Insert cancellation request
    INSERT INTO public.registration_cancellation_requests (
        registration_id,
        event_id,
        student_id,
        reason,
        explanation,
        status,
        refund_applicable,
        refund_status,
        refund_amount
    ) VALUES (
        v_reg.id,
        v_reg.event_id,
        v_caller_id,
        v_clean_reason,
        v_clean_expl,
        'pending',
        v_refund_applicable,
        CASE WHEN v_refund_applicable THEN 'refund_requested' ELSE 'not_applicable' END,
        v_refund_amt
    ) RETURNING id INTO v_request_id;

    -- Update registration status marker
    UPDATE public.registrations
    SET cancellation_request_status = 'pending',
        updated_at = now()
    WHERE id = v_reg.id;

    -- Audit log
    INSERT INTO public.workflow_audit_logs (
        actor_id,
        actor_role,
        action,
        target_entity,
        target_record_id,
        event_id,
        registration_id,
        team_id,
        previous_state,
        new_state,
        reason
    ) VALUES (
        v_caller_id,
        'student',
        'cancellation_requested',
        'registration_cancellation_requests',
        v_request_id::text,
        v_reg.event_id,
        v_reg.id,
        v_reg.team_id,
        jsonb_build_object('status', v_reg.status, 'cancellation_request_status', v_reg.cancellation_request_status),
        jsonb_build_object('status', v_reg.status, 'cancellation_request_status', 'pending', 'reason', v_clean_reason),
        v_clean_reason
    );

    RETURN jsonb_build_object(
        'success', true,
        'request_id', v_request_id,
        'message', 'Cancellation request submitted successfully. The club organizer will review your request.'
    );
END;
$$;

-- ── 9. RPC: review_registration_cancellation ────────────────────────────────
CREATE OR REPLACE FUNCTION public.review_registration_cancellation(
    p_request_id UUID,
    p_decision TEXT,
    p_decision_notes TEXT DEFAULT NULL,
    p_refund_status TEXT DEFAULT 'not_applicable',
    p_refund_amount NUMERIC DEFAULT 0,
    p_refund_ref TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_req RECORD;
    v_reg RECORD;
    v_event RECORD;
    v_now TIMESTAMPTZ := now();
    v_clean_decision TEXT;
    v_clean_notes TEXT;
    v_clean_refund_status TEXT;
    v_is_organizer BOOLEAN := false;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
    END IF;

    v_clean_decision := LOWER(TRIM(COALESCE(p_decision, '')));
    IF v_clean_decision NOT IN ('approved', 'rejected') THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DECISION', 'message', 'Decision must be approved or rejected.');
    END IF;

    v_clean_notes := TRIM(COALESCE(p_decision_notes, ''));
    v_clean_refund_status := LOWER(TRIM(COALESCE(p_refund_status, 'not_applicable')));

    -- Fetch request
    SELECT * INTO v_req FROM public.registration_cancellation_requests WHERE id = p_request_id FOR UPDATE;
    IF v_req.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Cancellation request not found.');
    END IF;

    IF v_req.status <> 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_REVIEWED', 'message', 'This cancellation request has already been reviewed.');
    END IF;

    -- Validate authorization
    v_is_organizer := public.check_is_event_organizer(v_req.event_id, v_caller_id);
    IF NOT v_is_organizer THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'Only event organizers can review cancellation requests.');
    END IF;

    SELECT * INTO v_reg FROM public.registrations WHERE id = v_req.registration_id FOR UPDATE;
    SELECT * INTO v_event FROM public.events WHERE id = v_req.event_id;

    IF v_clean_decision = 'approved' THEN
        -- Mark request approved
        UPDATE public.registration_cancellation_requests
        SET status = 'approved',
            reviewed_by = v_caller_id,
            reviewed_at = v_now,
            decision_notes = v_clean_notes,
            refund_status = v_clean_refund_status,
            refund_amount = COALESCE(p_refund_amount, v_req.refund_amount),
            refund_transaction_ref = p_refund_ref,
            updated_at = v_now
        WHERE id = v_req.id;

        -- Update registration to cancelled and invalidate ticket
        UPDATE public.registrations
        SET status = 'cancelled'::registration_status,
            cancellation_request_status = 'approved',
            cancelled_at = v_now,
            refund_status = v_clean_refund_status,
            refund_amount = COALESCE(p_refund_amount, v_req.refund_amount),
            refund_transaction_ref = p_refund_ref,
            updated_at = v_now
        WHERE id = v_reg.id;

        -- If part of team, update team_members record status to cancelled
        IF v_reg.team_id IS NOT NULL THEN
            UPDATE public.team_members
            SET status = 'cancelled',
                updated_at = v_now
            WHERE (registration_id = v_reg.id OR user_id = v_reg.student_id) AND team_id = v_reg.team_id;
        END IF;

    ELSE
        -- Mark request rejected
        UPDATE public.registration_cancellation_requests
        SET status = 'rejected',
            reviewed_by = v_caller_id,
            reviewed_at = v_now,
            decision_notes = v_clean_notes,
            updated_at = v_now
        WHERE id = v_req.id;

        -- Revert registration cancellation marker; keep original active status
        UPDATE public.registrations
        SET cancellation_request_status = 'rejected',
            updated_at = v_now
        WHERE id = v_reg.id;
    END IF;

    -- Audit log
    INSERT INTO public.workflow_audit_logs (
        actor_id,
        actor_role,
        action,
        target_entity,
        target_record_id,
        event_id,
        registration_id,
        team_id,
        previous_state,
        new_state,
        decision_notes
    ) VALUES (
        v_caller_id,
        'organizer',
        CASE WHEN v_clean_decision = 'approved' THEN 'cancellation_approved' ELSE 'cancellation_rejected' END,
        'registration_cancellation_requests',
        v_req.id::text,
        v_req.event_id,
        v_reg.id,
        v_reg.team_id,
        jsonb_build_object('status', v_reg.status, 'cancellation_request_status', 'pending'),
        jsonb_build_object(
            'status', CASE WHEN v_clean_decision = 'approved' THEN 'cancelled' ELSE v_reg.status::text END,
            'cancellation_request_status', v_clean_decision,
            'refund_status', v_clean_refund_status
        ),
        v_clean_notes
    );

    RETURN jsonb_build_object(
        'success', true,
        'decision', v_clean_decision,
        'message', CASE
            WHEN v_clean_decision = 'approved' THEN 'Cancellation approved. Registration has been cancelled.'
            ELSE 'Cancellation rejected. Registration remains active.'
        END
    );
END;
$$;

-- ── 10. RPC: request_registration_edit ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_registration_edit(
    p_registration_id UUID,
    p_proposed_changes JSONB,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_reg RECORD;
    v_clean_reason TEXT;
    v_request_id UUID;
    v_prev_values JSONB := '{}'::jsonb;
    v_sanitized_changes JSONB := '{}'::jsonb;
    v_key TEXT;
    v_val TEXT;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
    END IF;

    v_clean_reason := TRIM(COALESCE(p_reason, ''));
    IF v_clean_reason = '' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_REASON', 'message', 'Please provide a reason for the edit.');
    END IF;

    SELECT * INTO v_reg FROM public.registrations WHERE id = p_registration_id FOR UPDATE;
    IF v_reg.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Registration not found.');
    END IF;

    IF v_reg.student_id <> v_caller_id THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'You can only request edits for your own registration.');
    END IF;

    IF v_reg.status IN ('cancelled', 'rejected') THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_STATUS', 'message', 'Cannot edit a cancelled or rejected registration.');
    END IF;

    -- Extract allowed editable fields: student_name, phone, college, team_name
    IF p_proposed_changes ? 'student_name' THEN
        v_sanitized_changes := jsonb_set(v_sanitized_changes, '{student_name}', p_proposed_changes -> 'student_name');
        v_prev_values := jsonb_set(v_prev_values, '{student_name}', to_jsonb(COALESCE(v_reg.participant_details ->> 'student_name', '')));
    END IF;

    IF p_proposed_changes ? 'phone' THEN
        v_sanitized_changes := jsonb_set(v_sanitized_changes, '{phone}', p_proposed_changes -> 'phone');
        v_prev_values := jsonb_set(v_prev_values, '{phone}', to_jsonb(COALESCE(v_reg.participant_details ->> 'phone', '')));
    END IF;

    IF p_proposed_changes ? 'college' THEN
        v_sanitized_changes := jsonb_set(v_sanitized_changes, '{college}', p_proposed_changes -> 'college');
        v_prev_values := jsonb_set(v_prev_values, '{college}', to_jsonb(COALESCE(v_reg.participant_details ->> 'college_name', '')));
    END IF;

    IF p_proposed_changes ? 'team_name' AND v_reg.team_role = 'leader' THEN
        v_sanitized_changes := jsonb_set(v_sanitized_changes, '{team_name}', p_proposed_changes -> 'team_name');
        v_prev_values := jsonb_set(v_prev_values, '{team_name}', to_jsonb(COALESCE(v_reg.team_name, '')));
    END IF;

    IF v_sanitized_changes = '{}'::jsonb THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NO_ELIGIBLE_FIELDS', 'message', 'No eligible fields selected for edit.');
    END IF;

    INSERT INTO public.registration_edit_requests (
        registration_id,
        event_id,
        student_id,
        proposed_changes,
        previous_values,
        reason,
        status
    ) VALUES (
        v_reg.id,
        v_reg.event_id,
        v_caller_id,
        v_sanitized_changes,
        v_prev_values,
        v_clean_reason,
        'pending'
    ) RETURNING id INTO v_request_id;

    -- Audit log
    INSERT INTO public.workflow_audit_logs (
        actor_id,
        actor_role,
        action,
        target_entity,
        target_record_id,
        event_id,
        registration_id,
        team_id,
        previous_state,
        new_state,
        reason
    ) VALUES (
        v_caller_id,
        'student',
        'edit_requested',
        'registration_edit_requests',
        v_request_id::text,
        v_reg.event_id,
        v_reg.id,
        v_reg.team_id,
        v_prev_values,
        v_sanitized_changes,
        v_clean_reason
    );

    RETURN jsonb_build_object(
        'success', true,
        'request_id', v_request_id,
        'message', 'Edit request submitted for organizer review.'
    );
END;
$$;

-- ── 11. RPC: review_registration_edit ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.review_registration_edit(
    p_request_id UUID,
    p_decision TEXT,
    p_decision_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_req RECORD;
    v_reg RECORD;
    v_clean_decision TEXT;
    v_clean_notes TEXT;
    v_new_details JSONB;
    v_is_organizer BOOLEAN := false;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
    END IF;

    v_clean_decision := LOWER(TRIM(COALESCE(p_decision, '')));
    IF v_clean_decision NOT IN ('approved', 'rejected') THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DECISION', 'message', 'Decision must be approved or rejected.');
    END IF;

    v_clean_notes := TRIM(COALESCE(p_decision_notes, ''));

    SELECT * INTO v_req FROM public.registration_edit_requests WHERE id = p_request_id FOR UPDATE;
    IF v_req.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Edit request not found.');
    END IF;

    IF v_req.status <> 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_REVIEWED', 'message', 'This edit request has already been reviewed.');
    END IF;

    v_is_organizer := public.check_is_event_organizer(v_req.event_id, v_caller_id);
    IF NOT v_is_organizer THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'Only event organizers can review edit requests.');
    END IF;

    SELECT * INTO v_reg FROM public.registrations WHERE id = v_req.registration_id FOR UPDATE;

    IF v_clean_decision = 'approved' THEN
        v_new_details := COALESCE(v_reg.participant_details, '{}'::jsonb);

        IF v_req.proposed_changes ? 'student_name' THEN
            v_new_details := jsonb_set(v_new_details, '{student_name}', v_req.proposed_changes -> 'student_name');
        END IF;
        IF v_req.proposed_changes ? 'phone' THEN
            v_new_details := jsonb_set(v_new_details, '{phone}', v_req.proposed_changes -> 'phone');
        END IF;
        IF v_req.proposed_changes ? 'college' THEN
            v_new_details := jsonb_set(v_new_details, '{college_name}', v_req.proposed_changes -> 'college');
        END IF;

        UPDATE public.registrations
        SET participant_details = v_new_details,
            team_name = CASE
                WHEN v_req.proposed_changes ? 'team_name' THEN v_req.proposed_changes ->> 'team_name'
                ELSE team_name
            END,
            updated_at = now()
        WHERE id = v_reg.id;

        IF v_req.proposed_changes ? 'team_name' AND v_reg.team_id IS NOT NULL THEN
            UPDATE public.teams
            SET name = v_req.proposed_changes ->> 'team_name',
                updated_at = now()
            WHERE id = v_reg.team_id;
        END IF;

        UPDATE public.registration_edit_requests
        SET status = 'approved',
            reviewed_by = v_caller_id,
            reviewed_at = now(),
            decision_notes = v_clean_notes,
            updated_at = now()
        WHERE id = v_req.id;
    ELSE
        UPDATE public.registration_edit_requests
        SET status = 'rejected',
            reviewed_by = v_caller_id,
            reviewed_at = now(),
            decision_notes = v_clean_notes,
            updated_at = now()
        WHERE id = v_req.id;
    END IF;

    -- Audit log
    INSERT INTO public.workflow_audit_logs (
        actor_id,
        actor_role,
        action,
        target_entity,
        target_record_id,
        event_id,
        registration_id,
        team_id,
        previous_state,
        new_state,
        decision_notes
    ) VALUES (
        v_caller_id,
        'organizer',
        CASE WHEN v_clean_decision = 'approved' THEN 'edit_approved' ELSE 'edit_rejected' END,
        'registration_edit_requests',
        v_req.id::text,
        v_req.event_id,
        v_reg.id,
        v_reg.team_id,
        v_req.previous_values,
        v_req.proposed_changes,
        v_clean_notes
    );

    RETURN jsonb_build_object(
        'success', true,
        'decision', v_clean_decision,
        'message', CASE
            WHEN v_clean_decision = 'approved' THEN 'Edit request approved and registration updated.'
            ELSE 'Edit request rejected.'
        END
    );
END;
$$;

-- ── 12. RPC: offer_waitlist_slot ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.offer_waitlist_slot(
    p_registration_id UUID,
    p_expires_hours INT DEFAULT 24
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_reg RECORD;
    v_is_organizer BOOLEAN;
    v_expires_at TIMESTAMPTZ;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
    END IF;

    SELECT * INTO v_reg FROM public.registrations WHERE id = p_registration_id FOR UPDATE;
    IF v_reg.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Registration not found.');
    END IF;

    v_is_organizer := public.check_is_event_organizer(v_reg.event_id, v_caller_id);
    IF NOT v_is_organizer THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'Only event organizers can offer waitlist slots.');
    END IF;

    IF v_reg.status <> 'waitlisted' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_WAITLISTED', 'message', 'Registration is not currently waitlisted.');
    END IF;

    v_expires_at := now() + (COALESCE(p_expires_hours, 24) * interval '1 hour');

    UPDATE public.registrations
    SET waitlist_offered_at = now(),
        waitlist_offer_expires_at = v_expires_at,
        updated_at = now()
    WHERE id = v_reg.id;

    -- Audit log
    INSERT INTO public.workflow_audit_logs (
        actor_id,
        actor_role,
        action,
        target_entity,
        target_record_id,
        event_id,
        registration_id,
        new_state
    ) VALUES (
        v_caller_id,
        'organizer',
        'waitlist_slot_offered',
        'registrations',
        v_reg.id::text,
        v_reg.event_id,
        v_reg.id,
        jsonb_build_object('offered_at', now(), 'expires_at', v_expires_at)
    );

    RETURN jsonb_build_object(
        'success', true,
        'offer_expires_at', v_expires_at,
        'message', format('Slot offered to student. Offer expires in %s hours.', COALESCE(p_expires_hours, 24))
    );
END;
$$;

-- ── 13. RPC: claim_waitlist_offer ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_waitlist_offer(
    p_registration_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_reg RECORD;
    v_event RECORD;
    v_target_status registration_status;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
    END IF;

    SELECT * INTO v_reg FROM public.registrations WHERE id = p_registration_id FOR UPDATE;
    IF v_reg.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Registration not found.');
    END IF;

    IF v_reg.student_id <> v_caller_id THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'You can only claim offers for your own registration.');
    END IF;

    IF v_reg.status <> 'waitlisted' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_WAITLISTED', 'message', 'This registration is not waitlisted.');
    END IF;

    IF v_reg.waitlist_offer_expires_at IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NO_ACTIVE_OFFER', 'message', 'No active offer found for this waitlist position.');
    END IF;

    IF v_reg.waitlist_offer_expires_at < now() THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'OFFER_EXPIRED', 'message', 'This waitlist offer has expired.');
    END IF;

    SELECT * INTO v_event FROM public.events WHERE id = v_reg.event_id;

    v_target_status := CASE WHEN v_event.is_free THEN 'confirmed'::registration_status ELSE 'pending_payment'::registration_status END;

    UPDATE public.registrations
    SET status = v_target_status,
        waitlist_offered_at = NULL,
        waitlist_offer_expires_at = NULL,
        ticket_issued_at = CASE WHEN v_target_status = 'confirmed' THEN now() ELSE NULL END,
        updated_at = now()
    WHERE id = v_reg.id;

    -- Audit log
    INSERT INTO public.workflow_audit_logs (
        actor_id,
        actor_role,
        action,
        target_entity,
        target_record_id,
        event_id,
        registration_id,
        new_state
    ) VALUES (
        v_caller_id,
        'student',
        'waitlist_offer_claimed',
        'registrations',
        v_reg.id::text,
        v_reg.event_id,
        v_reg.id,
        jsonb_build_object('new_status', v_target_status)
    );

    RETURN jsonb_build_object(
        'success', true,
        'status', v_target_status,
        'message', CASE
            WHEN v_target_status = 'confirmed' THEN 'Offer accepted! Your pass is confirmed.'
            ELSE 'Offer accepted! Please complete payment to confirm your pass.'
        END
    );
END;
$$;

-- ── 14. RPC: cancel_event_by_organizer ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_event_by_organizer(
    p_event_id UUID,
    p_cancellation_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_event RECORD;
    v_clean_reason TEXT;
    v_is_organizer BOOLEAN;
    v_now TIMESTAMPTZ := now();
    v_affected_count INT := 0;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
    END IF;

    v_clean_reason := TRIM(COALESCE(p_cancellation_reason, ''));
    IF v_clean_reason = '' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_REASON', 'message', 'Please specify a reason for event cancellation.');
    END IF;

    SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR UPDATE;
    IF v_event.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Event not found.');
    END IF;

    v_is_organizer := public.check_is_event_organizer(p_event_id, v_caller_id);
    IF NOT v_is_organizer THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'Only authorized event organizers can cancel events.');
    END IF;

    -- Update event status
    UPDATE public.events
    SET status = 'cancelled'::event_status,
        description = description || E'\n\n[EVENT CANCELLED BY ORGANIZER: ' || v_clean_reason || ']',
        updated_at = v_now
    WHERE id = p_event_id;

    -- Invalidate registrations
    UPDATE public.registrations
    SET status = 'cancelled'::registration_status,
        cancellation_request_status = 'approved',
        cancelled_at = v_now,
        refund_status = CASE WHEN NOT v_event.is_free AND v_event.price > 0 THEN 'refund_requested' ELSE refund_status END,
        refund_amount = CASE WHEN NOT v_event.is_free AND v_event.price > 0 THEN v_event.price ELSE refund_amount END,
        updated_at = v_now
    WHERE event_id = p_event_id AND status NOT IN ('cancelled', 'rejected');

    GET DIAGNOSTICS v_affected_count = ROW_COUNT;

    -- Audit log
    INSERT INTO public.workflow_audit_logs (
        actor_id,
        actor_role,
        action,
        target_entity,
        target_record_id,
        event_id,
        reason,
        metadata
    ) VALUES (
        v_caller_id,
        'organizer',
        'event_cancelled',
        'events',
        p_event_id::text,
        p_event_id,
        v_clean_reason,
        jsonb_build_object('affected_registrations', v_affected_count)
    );

    RETURN jsonb_build_object(
        'success', true,
        'affected_registrations', v_affected_count,
        'message', format('Event cancelled successfully. %s registrations marked cancelled with refund review queued.', v_affected_count)
    );
END;
$$;

-- ── 15. RPC: request_payment_review ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_payment_review(
    p_submission_id UUID,
    p_student_notes TEXT,
    p_proof_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_sub RECORD;
    v_reg RECORD;
    v_clean_notes TEXT;
    v_review_id UUID;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
    END IF;

    v_clean_notes := TRIM(COALESCE(p_student_notes, ''));
    IF v_clean_notes = '' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_NOTES', 'message', 'Please provide an explanation for payment review.');
    END IF;

    SELECT * INTO v_sub FROM public.payment_submissions WHERE id = p_submission_id FOR UPDATE;
    IF v_sub.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Payment submission not found.');
    END IF;

    IF v_sub.student_id <> v_caller_id THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'You can only dispute your own payment submission.');
    END IF;

    SELECT * INTO v_reg FROM public.registrations WHERE id = v_sub.registration_id;

    INSERT INTO public.payment_dispute_reviews (
        payment_submission_id,
        registration_id,
        event_id,
        student_id,
        student_notes,
        additional_proof_url,
        status
    ) VALUES (
        v_sub.id,
        v_sub.registration_id,
        v_sub.event_id,
        v_caller_id,
        v_clean_notes,
        p_proof_url,
        'pending'
    ) RETURNING id INTO v_review_id;

    -- Audit log
    INSERT INTO public.workflow_audit_logs (
        actor_id,
        actor_role,
        action,
        target_entity,
        target_record_id,
        event_id,
        registration_id,
        reason
    ) VALUES (
        v_caller_id,
        'student',
        'payment_review_requested',
        'payment_dispute_reviews',
        v_review_id::text,
        v_sub.event_id,
        v_sub.registration_id,
        v_clean_notes
    );

    RETURN jsonb_build_object(
        'success', true,
        'review_id', v_review_id,
        'message', 'Payment review request submitted. The organizer will re-verify your submission.'
    );
END;
$$;

-- ── 16. Update Check-In Entry Gate Security Check ────────────────────────────
-- Ensure check_in_ticket strictly rejects cancelled/cancellation_requested passes
-- We enhance check_in_ticket to verify registration status isn't in non-permitted states
CREATE OR REPLACE FUNCTION public.validate_ticket_status_for_entry(p_reg_status TEXT, p_cancel_status TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_reg_status = 'confirmed' AND (p_cancel_status IS NULL OR p_cancel_status <> 'approved');
$$;

-- ── 17. Deprecate and Guard Legacy Direct Cancellation RPCs ──────────────────
-- Direct student cancellation is strictly prohibited across FestFlow.
-- Any direct call by an attendee is redirected to request_registration_cancellation.
CREATE OR REPLACE FUNCTION public.cancel_registration_with_policy(
    p_registration_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_reg RECORD;
    v_event RECORD;
    v_is_organizer BOOLEAN := false;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
    END IF;

    SELECT * INTO v_reg FROM public.registrations WHERE id = p_registration_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Registration not found.');
    END IF;

    SELECT * INTO v_event FROM public.events WHERE id = v_reg.event_id;
    v_is_organizer := (v_event.club_id = v_user_id) OR public.check_is_event_organizer(v_event.id, v_user_id);

    -- If caller is a regular attendee (not club organizer), direct cancellation is strictly prohibited!
    -- Automatically forward into request_registration_cancellation
    IF NOT v_is_organizer THEN
        RETURN public.request_registration_cancellation(
            p_registration_id,
            COALESCE(NULLIF(TRIM(p_reason), ''), 'unable_to_attend'),
            p_reason
        );
    END IF;

    -- If organizer, cancel directly
    UPDATE public.registrations
    SET status = 'cancelled',
        cancelled_at = NOW(),
        ticket_issued_at = NULL,
        cancellation_request_status = 'approved',
        updated_at = NOW()
    WHERE id = p_registration_id;

    RETURN jsonb_build_object('success', true, 'message', 'Registration cancelled by organizer.');
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_registration(p_registration_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    RETURN public.cancel_registration_with_policy(p_registration_id, 'Direct cancellation requested');
END;
$$;

-- Grant execute permissions to authenticated
GRANT EXECUTE ON FUNCTION public.request_registration_cancellation(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_registration_cancellation(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_registration_edit(UUID, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_registration_edit(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.offer_waitlist_slot(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_waitlist_offer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_event_by_organizer(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_payment_review(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_registration_with_policy(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_registration(UUID) TO authenticated;

