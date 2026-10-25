-- ============================================================================
-- FestFlow Migration 004: UPI Payments, Verification & Notifications
-- ============================================================================

-- 1. Create payment_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE public.payment_status AS ENUM ('pending_review', 'approved', 'rejected');
    END IF;
END $$;

-- 2. Create club_payment_settings table
CREATE TABLE IF NOT EXISTS public.club_payment_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    upi_id TEXT NOT NULL,
    account_name TEXT NOT NULL,
    payment_instructions TEXT,
    qr_image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_club_payment_settings_club UNIQUE (club_id)
);

-- Indexes for club_payment_settings
CREATE INDEX IF NOT EXISTS idx_club_payment_settings_club_id ON public.club_payment_settings(club_id);

-- Enable RLS for club_payment_settings
ALTER TABLE public.club_payment_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Public read for club payment settings" ON public.club_payment_settings;
    DROP POLICY IF EXISTS "Club owner insert payment settings" ON public.club_payment_settings;
    DROP POLICY IF EXISTS "Club owner update payment settings" ON public.club_payment_settings;
END $$;

-- RLS: Public / Authenticated read access (needed by students making UPI payments)
CREATE POLICY "Public read for club payment settings"
    ON public.club_payment_settings
    FOR SELECT
    USING (true);

-- RLS: Club owner insert access
CREATE POLICY "Club owner insert payment settings"
    ON public.club_payment_settings
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = club_id);

-- RLS: Club owner update access
CREATE POLICY "Club owner update payment settings"
    ON public.club_payment_settings
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = club_id)
    WITH CHECK (auth.uid() = club_id);

-- 3. Create payment_submissions table
CREATE TABLE IF NOT EXISTS public.payment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    transaction_reference VARCHAR(100) NOT NULL,
    screenshot_url TEXT,
    status public.payment_status NOT NULL DEFAULT 'pending_review',
    reviewer_id UUID REFERENCES public.profiles(id),
    review_notes TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique index: prevent duplicate active or approved transaction references for the same event
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_active_transaction_ref
    ON public.payment_submissions (event_id, LOWER(TRIM(transaction_reference)))
    WHERE status IN ('pending_review', 'approved');

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_payment_submissions_reg_id ON public.payment_submissions(registration_id);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_student_id ON public.payment_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_event_id ON public.payment_submissions(event_id);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_status ON public.payment_submissions(status);
CREATE INDEX IF NOT EXISTS idx_payment_submissions_submitted_at ON public.payment_submissions(submitted_at DESC);

-- Enable RLS for payment_submissions
ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Students can view own payment submissions" ON public.payment_submissions;
    DROP POLICY IF EXISTS "Club organizers can view event payment submissions" ON public.payment_submissions;
    DROP POLICY IF EXISTS "Students can insert own payment submissions" ON public.payment_submissions;
END $$;

-- RLS: Students can view their own payment submissions
CREATE POLICY "Students can view own payment submissions"
    ON public.payment_submissions
    FOR SELECT
    TO authenticated
    USING (student_id = auth.uid());

-- RLS: Club members can view submissions for events they own
CREATE POLICY "Club organizers can view event payment submissions"
    ON public.payment_submissions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = payment_submissions.event_id
              AND e.club_id = auth.uid()
        )
    );

-- RLS: Students can insert submissions for their own registrations
CREATE POLICY "Students can insert own payment submissions"
    ON public.payment_submissions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        student_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.registrations r
            WHERE r.id = registration_id
              AND r.student_id = auth.uid()
              AND r.status IN ('pending_payment', 'rejected')
        )
    );

-- Note: Updates to payment_submissions status are handled strictly via server-side RPC functions.

-- 4. Create in_app_notifications table
CREATE TABLE IF NOT EXISTS public.in_app_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    link TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.in_app_notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own notifications" ON public.in_app_notifications;
    DROP POLICY IF EXISTS "Users can update own notifications" ON public.in_app_notifications;
END $$;

CREATE POLICY "Users can view own notifications"
    ON public.in_app_notifications
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
    ON public.in_app_notifications
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 5. Storage Buckets Setup
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('payment-proofs', 'payment-proofs', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('club-payment-qrs', 'club-payment-qrs', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Authenticated users can upload payment proofs" ON storage.objects;
    DROP POLICY IF EXISTS "Users can read own payment proofs" ON storage.objects;
    DROP POLICY IF EXISTS "Public read for club payment QRs" ON storage.objects;
    DROP POLICY IF EXISTS "Club organizers can manage own payment QRs" ON storage.objects;
END $$;

-- Storage RLS: payment-proofs
CREATE POLICY "Authenticated users can upload payment proofs"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'payment-proofs' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Users can read own payment proofs"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'payment-proofs' AND
        (
            (storage.foldername(name))[1] = auth.uid()::text
            OR EXISTS (
                SELECT 1 FROM public.events e
                WHERE e.club_id = auth.uid()
            )
        )
    );

-- Storage RLS: club-payment-qrs
CREATE POLICY "Public read for club payment QRs"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'club-payment-qrs');

CREATE POLICY "Club organizers can manage own payment QRs"
    ON storage.objects FOR ALL
    TO authenticated
    USING (
        bucket_id = 'club-payment-qrs' AND
        (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'club-payment-qrs' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- 6. Atomic Transactional Function: Submit Payment
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
    v_club_id UUID;
    v_reg_status public.registration_status;
    v_clean_ref TEXT;
    v_new_sub_id UUID;
BEGIN
    v_student_id := auth.uid();
    IF v_student_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'You must be signed in to submit payment details.');
    END IF;

    v_clean_ref := TRIM(p_transaction_reference);
    IF v_clean_ref IS NULL OR length(v_clean_ref) < 4 THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_REFERENCE', 'message', 'Please provide a valid UPI transaction reference / UTR (minimum 4 characters).');
    END IF;

    -- Fetch and lock the registration record
    SELECT r.event_id, r.status, e.title, e.price, e.currency, e.club_id
    INTO v_event_id, v_reg_status, v_event_title, v_event_price, v_event_currency, v_club_id
    FROM public.registrations r
    JOIN public.events e ON e.id = r.event_id
    WHERE r.id = p_registration_id AND r.student_id = v_student_id
    FOR UPDATE OF r;

    IF v_event_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'REGISTRATION_NOT_FOUND', 'message', 'Eligible registration record was not found.');
    END IF;

    IF v_reg_status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'REGISTRATION_CANCELLED', 'message', 'This registration has been cancelled.');
    END IF;

    IF v_reg_status = 'confirmed' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_CONFIRMED', 'message', 'This registration is already confirmed and valid.');
    END IF;

    -- Check if there is already an active pending submission
    IF EXISTS (
        SELECT 1 FROM public.payment_submissions
        WHERE registration_id = p_registration_id AND status = 'pending_review'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'SUBMISSION_PENDING', 'message', 'A payment submission for this registration is currently under review by the club organizer.');
    END IF;

    -- Check duplicate reference for this event across active or approved submissions
    IF EXISTS (
        SELECT 1 FROM public.payment_submissions
        WHERE event_id = v_event_id
          AND LOWER(TRIM(transaction_reference)) = LOWER(v_clean_ref)
          AND status IN ('pending_review', 'approved')
    ) THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'DUPLICATE_REFERENCE', 'message', 'This transaction reference / UTR has already been submitted for this event.');
    END IF;

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

    -- Ensure registration status is pending_payment if it was previously rejected
    UPDATE public.registrations
    SET status = 'pending_payment', updated_at = now()
    WHERE id = p_registration_id;

    -- Create notification for the club organizer
    INSERT INTO public.in_app_notifications (
        user_id,
        title,
        message,
        type,
        link
    ) VALUES (
        v_club_id,
        'New Payment Submitted',
        'Payment of ' || COALESCE(v_event_currency, 'INR') || ' ' || COALESCE(v_event_price, 0)::text || ' submitted for ' || v_event_title || ' (Ref: ' || v_clean_ref || ').',
        'payment_submitted',
        '/club/payments'
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Payment submitted for organizer review.',
        'submission_id', v_new_sub_id,
        'status', 'pending_review'
    );
END;
$$;

-- 7. Atomic Transactional Function: Review Payment (Approve / Reject)
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
BEGIN
    v_reviewer_id := auth.uid();
    IF v_reviewer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'You must be signed in to review payments.');
    END IF;

    IF p_decision NOT IN ('approved', 'rejected') THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DECISION', 'message', 'Review decision must be either "approved" or "rejected".');
    END IF;

    -- Fetch and lock the payment submission
    SELECT * INTO v_sub
    FROM public.payment_submissions
    WHERE id = p_payment_id
    FOR UPDATE;

    IF v_sub.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Payment submission not found.');
    END IF;

    IF v_sub.status <> 'pending_review' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_REVIEWED', 'message', 'This payment has already been ' || v_sub.status || '.');
    END IF;

    -- Fetch and lock associated event
    SELECT * INTO v_event
    FROM public.events
    WHERE id = v_sub.event_id
    FOR UPDATE;

    -- Authorize reviewer is the owning club
    IF v_event.club_id <> v_reviewer_id THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'Only the organizer of this event can review payment submissions.');
    END IF;

    -- Fetch and lock associated registration
    SELECT * INTO v_reg
    FROM public.registrations
    WHERE id = v_sub.registration_id
    FOR UPDATE;

    IF v_reg.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'REGISTRATION_NOT_FOUND', 'message', 'Associated registration record was not found.');
    END IF;

    IF v_reg.status = 'cancelled' THEN
        -- Registration cancelled before review
        UPDATE public.payment_submissions
        SET status = 'rejected',
            reviewer_id = v_reviewer_id,
            reviewed_at = now(),
            review_notes = 'Registration was cancelled prior to payment approval.',
            updated_at = now()
        WHERE id = p_payment_id;

        RETURN jsonb_build_object('success', false, 'error_code', 'REGISTRATION_CANCELLED', 'message', 'Registration was cancelled by the student.');
    END IF;

    IF p_decision = 'approved' THEN
        -- Generate or preserve valid ticket code
        v_issued_ticket_code := COALESCE(
            NULLIF(v_reg.ticket_code, ''),
            'TKT-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8)) || '-' || TO_CHAR(now(), 'MIIS')
        );

        -- Mark payment approved
        UPDATE public.payment_submissions
        SET status = 'approved',
            reviewer_id = v_reviewer_id,
            reviewed_at = now(),
            review_notes = COALESCE(NULLIF(TRIM(p_notes), ''), 'Payment verified and approved.'),
            updated_at = now()
        WHERE id = p_payment_id;

        -- Atomically confirm registration and issue ticket
        UPDATE public.registrations
        SET status = 'confirmed',
            ticket_code = v_issued_ticket_code,
            ticket_issued_at = now(),
            updated_at = now()
        WHERE id = v_sub.registration_id;

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
            'message', 'Payment approved and digital ticket issued successfully.',
            'status', 'approved',
            'ticket_code', v_issued_ticket_code
        );

    ELSIF p_decision = 'rejected' THEN
        IF p_notes IS NULL OR TRIM(p_notes) = '' THEN
            RETURN jsonb_build_object('success', false, 'error_code', 'REASON_REQUIRED', 'message', 'A clear reason for rejection is required to inform the student.');
        END IF;

        -- Mark payment rejected
        UPDATE public.payment_submissions
        SET status = 'rejected',
            reviewer_id = v_reviewer_id,
            reviewed_at = now(),
            review_notes = TRIM(p_notes),
            updated_at = now()
        WHERE id = p_payment_id;

        -- Update registration to rejected status
        UPDATE public.registrations
        SET status = 'rejected',
            updated_at = now()
        WHERE id = v_sub.registration_id;

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
            'Your payment submission for ' || v_event.title || ' was not approved. Reason: ' || TRIM(p_notes),
            'payment_rejected',
            '/student/payments/' || v_sub.registration_id
        );

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Payment rejected with stated reason.',
            'status', 'rejected'
        );
    END IF;
END;
$$;
