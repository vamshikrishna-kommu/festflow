-- ============================================================================
-- FestFlow Migration 019: Direct UPI Payments Only & Decommissioning Razorpay
-- ============================================================================
-- 1. Decommissions online gateway / Razorpay checkout RPCs safely.
-- 2. Hardens direct UPI payment submission (submit_payment_submission) and
--    organizer review (review_payment_submission).
-- 3. Adds payment audit logging (payment_audit_logs) for tamper-evident review tracking.
-- 4. Ensures strict state transitions:
--    pending_payment -> pending_review -> approved (confirmed ticket) OR rejected (retry).
-- 5. Non-destructive: Does NOT drop existing tables or alter historical data.
-- ============================================================================

-- ─── 1. Payment Audit Logs Table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_submission_id UUID REFERENCES public.payment_submissions(id) ON DELETE CASCADE,
    registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'submitted', 'resubmitted', 'approved', 'rejected'
    actor_id UUID REFERENCES public.profiles(id),
    actor_role VARCHAR(50), -- 'student', 'organizer', 'system'
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_audit_sub_id ON public.payment_audit_logs(payment_submission_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_reg_id ON public.payment_audit_logs(registration_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_event_id ON public.payment_audit_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_actor_id ON public.payment_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_created_at ON public.payment_audit_logs(created_at DESC);

ALTER TABLE public.payment_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Students can view own payment audit logs" ON public.payment_audit_logs;
    DROP POLICY IF EXISTS "Organizers can view audit logs for their events" ON public.payment_audit_logs;
END $$;

CREATE POLICY "Students can view own payment audit logs"
    ON public.payment_audit_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.registrations r
            WHERE r.id = payment_audit_logs.registration_id
              AND r.student_id = auth.uid()
        )
    );

CREATE POLICY "Organizers can view audit logs for their events"
    ON public.payment_audit_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = payment_audit_logs.event_id
              AND e.club_id = auth.uid()
        )
    );

-- ─── 2. Hardened submit_payment_submission RPC ───────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_payment_submission(
    p_registration_id UUID,
    p_transaction_reference TEXT,
    p_screenshot_url TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_student_id UUID;
    v_event_id UUID;
    v_event_title TEXT;
    v_event_price NUMERIC(10,2);
    v_event_currency VARCHAR(10);
    v_event_is_free BOOLEAN;
    v_club_id UUID;
    v_reg_status public.registration_status;
    v_clean_ref TEXT;
    v_new_sub_id UUID;
    v_prev_sub RECORD;
BEGIN
    v_student_id := auth.uid();
    IF v_student_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'UNAUTHENTICATED',
            'message', 'You must be signed in to submit payment details.'
        );
    END IF;

    v_clean_ref := TRIM(p_transaction_reference);
    IF v_clean_ref IS NULL OR length(v_clean_ref) < 4 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_REFERENCE',
            'message', 'Please provide a valid UPI transaction reference / UTR (minimum 4 characters).'
        );
    END IF;

    -- Fetch and lock the registration record
    SELECT r.event_id, r.status, e.title, e.price, e.currency, e.is_free, e.club_id
    INTO v_event_id, v_reg_status, v_event_title, v_event_price, v_event_currency, v_event_is_free, v_club_id
    FROM public.registrations r
    JOIN public.events e ON e.id = r.event_id
    WHERE r.id = p_registration_id AND r.student_id = v_student_id
    FOR UPDATE OF r;

    IF v_event_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'REGISTRATION_NOT_FOUND',
            'message', 'Eligible registration record was not found.'
        );
    END IF;

    IF v_event_is_free = true OR COALESCE(v_event_price, 0) <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'FREE_EVENT',
            'message', 'This event is free of charge. No payment submission is required.'
        );
    END IF;

    IF v_reg_status = 'cancelled' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'REGISTRATION_CANCELLED',
            'message', 'This registration has been cancelled.'
        );
    END IF;

    IF v_reg_status = 'confirmed' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ALREADY_CONFIRMED',
            'message', 'This registration is already confirmed and active.'
        );
    END IF;

    IF v_reg_status = 'pending_approval' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'APPROVAL_REQUIRED',
            'message', 'Your application is under organizer review. Payment is locked until application is approved.'
        );
    END IF;

    -- Check if there is already an active pending submission
    IF EXISTS (
        SELECT 1 FROM public.payment_submissions
        WHERE registration_id = p_registration_id AND status = 'pending_review'
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'SUBMISSION_PENDING',
            'message', 'A payment submission for this registration is currently under review by the club organizer.'
        );
    END IF;

    -- Check duplicate reference for this event across active or approved submissions
    IF EXISTS (
        SELECT 1 FROM public.payment_submissions
        WHERE event_id = v_event_id
          AND LOWER(TRIM(transaction_reference)) = LOWER(v_clean_ref)
          AND status IN ('pending_review', 'approved')
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'DUPLICATE_REFERENCE',
            'message', 'This transaction reference / UTR has already been submitted for an active or approved registration for this event.'
        );
    END IF;

    -- Check previous submission to determine if resubmitting
    SELECT * INTO v_prev_sub
    FROM public.payment_submissions
    WHERE registration_id = p_registration_id
    ORDER BY created_at DESC
    LIMIT 1;

    -- Insert new payment submission
    INSERT INTO public.payment_submissions (
        registration_id,
        student_id,
        event_id,
        amount,
        currency,
        transaction_reference,
        screenshot_url,
        review_notes,
        status,
        submitted_at
    ) VALUES (
        p_registration_id,
        v_student_id,
        v_event_id,
        COALESCE(v_event_price, 0),
        COALESCE(v_event_currency, 'INR'),
        v_clean_ref,
        p_screenshot_url,
        p_notes,
        'pending_review',
        now()
    )
    RETURNING id INTO v_new_sub_id;

    -- Ensure registration status is pending_payment if previously rejected
    UPDATE public.registrations
    SET status = 'pending_payment', updated_at = now()
    WHERE id = p_registration_id;

    -- Insert audit log
    INSERT INTO public.payment_audit_logs (
        payment_submission_id,
        registration_id,
        event_id,
        action,
        actor_id,
        actor_role,
        previous_status,
        new_status,
        notes,
        metadata
    ) VALUES (
        v_new_sub_id,
        p_registration_id,
        v_event_id,
        CASE WHEN v_prev_sub.id IS NOT NULL THEN 'resubmitted' ELSE 'submitted' END,
        v_student_id,
        'student',
        COALESCE(v_prev_sub.status::text, 'none'),
        'pending_review',
        p_notes,
        jsonb_build_object(
            'utr', v_clean_ref,
            'amount', v_event_price,
            'has_screenshot', p_screenshot_url IS NOT NULL
        )
    );

    -- Create in-app notification for the club organizer
    INSERT INTO public.in_app_notifications (
        user_id,
        title,
        message,
        type,
        link
    ) VALUES (
        v_club_id,
        'New UPI Payment Submitted',
        'Payment of ' || COALESCE(v_event_currency, 'INR') || ' ' || COALESCE(v_event_price, 0)::text || ' submitted for ' || v_event_title || ' (Ref: ' || v_clean_ref || ').',
        'payment_submitted',
        '/club/payments'
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Payment reference submitted successfully for organizer verification.',
        'submission_id', v_new_sub_id,
        'status', 'pending_review'
    );
END;
$$;


-- ─── 3. Hardened review_payment_submission RPC ───────────────────────────────
CREATE OR REPLACE FUNCTION public.review_payment_submission(
    p_payment_id UUID,
    p_decision TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_reviewer_id UUID;
    v_sub RECORD;
    v_event RECORD;
    v_reg RECORD;
    v_issued_ticket_code TEXT;
    v_clean_notes TEXT;
BEGIN
    v_reviewer_id := auth.uid();
    IF v_reviewer_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'UNAUTHENTICATED',
            'message', 'You must be signed in to review payments.'
        );
    END IF;

    IF p_decision NOT IN ('approved', 'rejected') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_DECISION',
            'message', 'Review decision must be either "approved" or "rejected".'
        );
    END IF;

    v_clean_notes := TRIM(COALESCE(p_notes, ''));

    -- Fetch and lock the payment submission
    SELECT * INTO v_sub
    FROM public.payment_submissions
    WHERE id = p_payment_id
    FOR UPDATE;

    IF v_sub.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'NOT_FOUND',
            'message', 'Payment submission not found.'
        );
    END IF;

    IF v_sub.status <> 'pending_review' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ALREADY_REVIEWED',
            'message', 'This payment has already been ' || v_sub.status || '.'
        );
    END IF;

    -- Fetch and lock associated event
    SELECT * INTO v_event
    FROM public.events
    WHERE id = v_sub.event_id
    FOR UPDATE;

    -- Authorize reviewer is the owning club organizer
    IF v_event.club_id <> v_reviewer_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'FORBIDDEN',
            'message', 'Only the organizer of this event can review payment submissions.'
        );
    END IF;

    -- Fetch and lock associated registration
    SELECT * INTO v_reg
    FROM public.registrations
    WHERE id = v_sub.registration_id
    FOR UPDATE;

    IF v_reg.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'REGISTRATION_NOT_FOUND',
            'message', 'Associated registration record was not found.'
        );
    END IF;

    -- Prevent confirming a registration that was cancelled
    IF v_reg.status = 'cancelled' THEN
        UPDATE public.payment_submissions
        SET status = 'rejected',
            reviewer_id = v_reviewer_id,
            reviewed_at = now(),
            review_notes = 'Registration was cancelled by the student prior to payment review.',
            updated_at = now()
        WHERE id = p_payment_id;

        INSERT INTO public.payment_audit_logs (
            payment_submission_id,
            registration_id,
            event_id,
            action,
            actor_id,
            actor_role,
            previous_status,
            new_status,
            notes
        ) VALUES (
            p_payment_id,
            v_sub.registration_id,
            v_sub.event_id,
            'rejected',
            v_reviewer_id,
            'organizer',
            'pending_review',
            'rejected',
            'Registration was cancelled by the student prior to payment review.'
        );

        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'REGISTRATION_CANCELLED',
            'message', 'Registration was cancelled by the student.'
        );
    END IF;

    IF p_decision = 'approved' THEN
        -- Preserve existing ticket code or issue fresh one
        v_issued_ticket_code := COALESCE(
            NULLIF(v_reg.ticket_code, ''),
            'TKT-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8)) || '-' || TO_CHAR(now(), 'MIIS')
        );

        -- Mark payment approved
        UPDATE public.payment_submissions
        SET status = 'approved',
            reviewer_id = v_reviewer_id,
            reviewed_at = now(),
            review_notes = CASE WHEN v_clean_notes <> '' THEN v_clean_notes ELSE 'Payment verified and approved by organizer.' END,
            updated_at = now()
        WHERE id = p_payment_id;

        -- Atomically confirm registration and issue ticket
        UPDATE public.registrations
        SET status = 'confirmed',
            ticket_code = v_issued_ticket_code,
            ticket_issued_at = now(),
            updated_at = now()
        WHERE id = v_sub.registration_id;

        -- Audit log
        INSERT INTO public.payment_audit_logs (
            payment_submission_id,
            registration_id,
            event_id,
            action,
            actor_id,
            actor_role,
            previous_status,
            new_status,
            notes,
            metadata
        ) VALUES (
            p_payment_id,
            v_sub.registration_id,
            v_sub.event_id,
            'approved',
            v_reviewer_id,
            'organizer',
            'pending_review',
            'approved',
            v_clean_notes,
            jsonb_build_object(
                'ticket_code', v_issued_ticket_code,
                'utr', v_sub.transaction_reference,
                'amount', v_sub.amount
            )
        );

        -- Notify student
        INSERT INTO public.in_app_notifications (
            user_id,
            title,
            message,
            type,
            link
        ) VALUES (
            v_sub.student_id,
            'Payment Approved! 🎉',
            'Your payment of ' || v_sub.currency || ' ' || v_sub.amount::text || ' for ' || v_event.title || ' has been approved. Your digital entry pass is now ready!',
            'payment_approved',
            '/student/tickets/' || v_sub.registration_id
        );

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Payment approved and digital ticket confirmed successfully.',
            'status', 'approved',
            'ticket_code', v_issued_ticket_code
        );

    ELSIF p_decision = 'rejected' THEN
        IF v_clean_notes = '' THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'REASON_REQUIRED',
                'message', 'A clear reason for rejection is required to inform the student.'
            );
        END IF;

        -- Mark payment submission rejected
        UPDATE public.payment_submissions
        SET status = 'rejected',
            reviewer_id = v_reviewer_id,
            reviewed_at = now(),
            review_notes = v_clean_notes,
            updated_at = now()
        WHERE id = p_payment_id;

        -- Mark registration rejected (allows student to fix and resubmit)
        UPDATE public.registrations
        SET status = 'rejected',
            updated_at = now()
        WHERE id = v_sub.registration_id;

        -- Audit log
        INSERT INTO public.payment_audit_logs (
            payment_submission_id,
            registration_id,
            event_id,
            action,
            actor_id,
            actor_role,
            previous_status,
            new_status,
            notes,
            metadata
        ) VALUES (
            p_payment_id,
            v_sub.registration_id,
            v_sub.event_id,
            'rejected',
            v_reviewer_id,
            'organizer',
            'pending_review',
            'rejected',
            v_clean_notes,
            jsonb_build_object(
                'utr', v_sub.transaction_reference,
                'amount', v_sub.amount
            )
        );

        -- Notify student
        INSERT INTO public.in_app_notifications (
            user_id,
            title,
            message,
            type,
            link
        ) VALUES (
            v_sub.student_id,
            'Payment Verification Issue',
            'Your payment for ' || v_event.title || ' could not be verified. Reason: ' || v_clean_notes,
            'payment_rejected',
            '/student/payments/' || v_sub.registration_id
        );

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Payment marked as rejected. Student notified with the provided reason.',
            'status', 'rejected'
        );
    END IF;
END;
$$;


-- ─── 4. Decommission Obsolete Online Gateway Functions ───────────────────────
CREATE OR REPLACE FUNCTION public.create_payment_order(
    p_registration_id UUID,
    p_provider TEXT DEFAULT 'razorpay',
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN jsonb_build_object(
        'success', false,
        'error_code', 'GATEWAY_DECOMMISSIONED',
        'message', 'Instant online gateway checkout has been decommissioned. FestFlow uses direct organizer UPI payments with UTR verification.'
    );
END;
$$;

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
BEGIN
    RETURN jsonb_build_object(
        'success', false,
        'error_code', 'GATEWAY_DECOMMISSIONED',
        'message', 'Gateway order verification has been decommissioned. FestFlow uses direct organizer UPI payments with UTR verification.'
    );
END;
$$;

-- ─── 5. Permissions ──────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.submit_payment_submission(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_payment_submission(UUID, TEXT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_payment_order(UUID, TEXT, TEXT) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.verify_payment_order(UUID, TEXT, TEXT, TEXT) FROM authenticated, anon, public;
