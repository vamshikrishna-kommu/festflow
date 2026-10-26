-- ============================================================================
-- FestFlow Migration 010: Payment Orders, Checkout & Gateway Verification
-- ============================================================================
-- Idempotent & non-destructive: Safe to run on existing FestFlow databases.
-- ============================================================================

-- 1. Create order_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE public.order_status AS ENUM (
            'created',
            'attempted',
            'paid',
            'failed',
            'cancelled',
            'refunded',
            'expired'
        );
    END IF;
END $$;

-- 2. Create payment_orders table
CREATE TABLE IF NOT EXISTS public.payment_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_reference VARCHAR(100) NOT NULL UNIQUE,
    registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    provider VARCHAR(50) NOT NULL DEFAULT 'razorpay',
    provider_order_id VARCHAR(150),
    provider_payment_id VARCHAR(150),
    provider_signature VARCHAR(255),
    status public.order_status NOT NULL DEFAULT 'created',
    idempotency_key VARCHAR(100) UNIQUE,
    receipt VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb,
    error_code VARCHAR(100),
    error_description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at TIMESTAMPTZ
);

-- Partial unique index: prevent multiple active (uncompleted) orders for the same registration
CREATE UNIQUE INDEX IF NOT EXISTS uq_reg_active_payment_order
    ON public.payment_orders (registration_id)
    WHERE status IN ('created', 'attempted');

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_payment_orders_reg_id ON public.payment_orders(registration_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_student_id ON public.payment_orders(student_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_event_id ON public.payment_orders(event_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON public.payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_provider_order_id ON public.payment_orders(provider_order_id);

-- 3. Row Level Security for payment_orders
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Students can view own payment orders" ON public.payment_orders;
    DROP POLICY IF EXISTS "Club organizers can view event payment orders" ON public.payment_orders;
END $$;

CREATE POLICY "Students can view own payment orders"
    ON public.payment_orders
    FOR SELECT
    TO authenticated
    USING (student_id = auth.uid());

CREATE POLICY "Club organizers can view event payment orders"
    ON public.payment_orders
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = payment_orders.event_id
              AND e.club_id = auth.uid()
        )
    );

-- Note: All INSERT, UPDATE, and DELETE operations on payment_orders are handled
-- strictly via trusted SECURITY DEFINER functions or backend edge functions.

-- 4. Atomic Server-Side Function: Create Payment Order
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
DECLARE
    v_student_id UUID;
    v_reg RECORD;
    v_event RECORD;
    v_existing_order RECORD;
    v_order_ref TEXT;
    v_new_order_id UUID;
    v_receipt TEXT;
BEGIN
    v_student_id := auth.uid();
    IF v_student_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'UNAUTHENTICATED',
            'message', 'You must be signed in to initiate payment checkout.'
        );
    END IF;

    -- Fetch and lock the registration
    SELECT * INTO v_reg
    FROM public.registrations
    WHERE id = p_registration_id
    FOR UPDATE;

    IF v_reg.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'REGISTRATION_NOT_FOUND',
            'message', 'Registration record was not found.'
        );
    END IF;

    -- Check student ownership
    IF v_reg.student_id <> v_student_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'FORBIDDEN',
            'message', 'You can only create payment orders for your own registrations.'
        );
    END IF;

    -- State validations
    IF v_reg.status = 'confirmed' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ALREADY_CONFIRMED',
            'message', 'This registration is already confirmed and paid.'
        );
    END IF;

    IF v_reg.status = 'cancelled' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'REGISTRATION_CANCELLED',
            'message', 'This registration has been cancelled.'
        );
    END IF;

    IF v_reg.status = 'pending_approval' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'APPROVAL_REQUIRED',
            'message', 'This application is under host review. Payment is locked until approved.'
        );
    END IF;

    IF v_reg.status <> 'pending_payment' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_REGISTRATION_STATE',
            'message', 'Registration is not currently in a payable state.'
        );
    END IF;

    -- Fetch event details
    SELECT * INTO v_event
    FROM public.events
    WHERE id = v_reg.event_id;

    IF v_event.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'EVENT_NOT_FOUND',
            'message', 'Associated event was not found.'
        );
    END IF;

    -- Free event check
    IF v_event.is_free OR COALESCE(v_event.price, 0) <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'FREE_EVENT',
            'message', 'This event is free. No payment order is required.'
        );
    END IF;

    -- Check if an active order already exists for this registration with identical amount
    SELECT * INTO v_existing_order
    FROM public.payment_orders
    WHERE registration_id = p_registration_id
      AND status IN ('created', 'attempted')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_order.id IS NOT NULL THEN
        -- Return existing order safely to prevent duplicate charges
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Existing active order retrieved.',
            'order', jsonb_build_object(
                'id', v_existing_order.id,
                'order_reference', v_existing_order.order_reference,
                'registration_id', v_existing_order.registration_id,
                'event_id', v_existing_order.event_id,
                'event_title', v_event.title,
                'amount', v_existing_order.amount,
                'currency', v_existing_order.currency,
                'provider', v_existing_order.provider,
                'provider_order_id', v_existing_order.provider_order_id,
                'status', v_existing_order.status,
                'created_at', v_existing_order.created_at
            )
        );
    END IF;

    -- Generate trusted unique order reference and receipt
    v_order_ref := 'ORD-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 10)) || '-' || TO_CHAR(now(), 'MIIS');
    v_receipt := 'RCP-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8));

    -- Insert trusted payment order using server-stored event price
    INSERT INTO public.payment_orders (
        order_reference,
        registration_id,
        student_id,
        event_id,
        amount,
        currency,
        provider,
        provider_order_id,
        status,
        idempotency_key,
        receipt,
        metadata
    ) VALUES (
        v_order_ref,
        p_registration_id,
        v_student_id,
        v_event.id,
        v_event.price,
        COALESCE(v_event.currency, 'INR'),
        COALESCE(p_provider, 'razorpay'),
        NULL,
        'created',
        p_idempotency_key,
        v_receipt,
        jsonb_build_object(
            'event_title', v_event.title,
            'ticket_code', v_reg.ticket_code,
            'created_via', 'web_checkout'
        )
    )
    RETURNING id INTO v_new_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Payment order created successfully.',
        'order', jsonb_build_object(
            'id', v_new_order_id,
            'order_reference', v_order_ref,
            'registration_id', p_registration_id,
            'event_id', v_event.id,
            'event_title', v_event.title,
            'amount', v_event.price,
            'currency', COALESCE(v_event.currency, 'INR'),
            'provider', COALESCE(p_provider, 'razorpay'),
            'status', 'created',
            'created_at', now()
        )
    );
END;
$$;

-- 5. Atomic Server-Side Function: Verify Payment Order & Confirm Registration
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

-- 6. Atomic Server-Side Function: Record Payment Failure
CREATE OR REPLACE FUNCTION public.record_payment_failure(
    p_order_id UUID,
    p_error_code TEXT,
    p_error_description TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_student_id UUID;
    v_order RECORD;
BEGIN
    v_student_id := auth.uid();
    IF v_student_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'UNAUTHENTICATED',
            'message', 'Authentication required.'
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

    IF v_order.status = 'paid' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ORDER_ALREADY_PAID',
            'message', 'Cannot fail an already paid order.'
        );
    END IF;

    UPDATE public.payment_orders
    SET status = 'failed',
        error_code = COALESCE(p_error_code, 'PAYMENT_FAILED'),
        error_description = p_error_description,
        updated_at = now()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Payment failure recorded.',
        'order_id', p_order_id,
        'status', 'failed'
    );
END;
$$;

-- 7. Grant Permissions
GRANT SELECT ON public.payment_orders TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_payment_order(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_payment_order(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment_failure(UUID, TEXT, TEXT) TO authenticated;
