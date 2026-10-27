-- ============================================================================
-- FestFlow Migration 018: Trusted Payment Verification, Replay Hardening,
-- Least-Privilege Permissions, and Ticket Immutability
-- ============================================================================
-- Addresses SEC-01 through SEC-05:
-- 1. SEC-01: Revokes direct authenticated execution of verify_payment_order.
--            Only service_role (trusted Edge Functions) can confirm paid orders.
-- 2. SEC-02: Partial unique index on provider_payment_id for paid orders,
--            plus explicit duplicate-check logic to prevent replay attacks.
-- 3. SEC-03: Preserves existing ticket codes and unifies confirmation pipeline.
-- 4. SEC-04: Enforces strict state transitions (rejects cancelled/rejected
--            registrations and enforces organizer approval).
-- 5. SEC-05: Explicit grants and revocations with secure search_path.
-- ============================================================================

-- ─── 1. SEC-02: Pre-audit & Partial Unique Index for Replay Protection ──────
DO $$
DECLARE
    v_dup_count INT;
BEGIN
    SELECT COUNT(*) INTO v_dup_count
    FROM (
        SELECT provider_payment_id
        FROM public.payment_orders
        WHERE status = 'paid'
          AND provider_payment_id IS NOT NULL
          AND TRIM(provider_payment_id) <> ''
        GROUP BY provider_payment_id
        HAVING COUNT(*) > 1
    ) dups;

    IF v_dup_count > 0 THEN
        RAISE WARNING 'Found % duplicate paid provider_payment_ids in historical data. Manual review advised.', v_dup_count;
    END IF;
END $$;

-- Enforce database-level uniqueness for paid provider_payment_ids
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_orders_paid_provider_payment_id
    ON public.payment_orders (TRIM(provider_payment_id))
    WHERE status = 'paid' AND provider_payment_id IS NOT NULL AND TRIM(provider_payment_id) <> '';


-- ─── 2. SEC-01, SEC-02, SEC-03, SEC-04: Trusted verify_payment_order RPC ─────
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
    v_order RECORD;
    v_reg RECORD;
    v_event RECORD;
    v_issued_ticket_code TEXT;
    v_clean_payment_id TEXT;
    v_clean_signature TEXT;
    v_clean_provider_order_id TEXT;
BEGIN
    -- Sanitize input strings
    v_clean_payment_id := TRIM(COALESCE(p_provider_payment_id, ''));
    v_clean_signature := TRIM(COALESCE(p_provider_signature, ''));
    v_clean_provider_order_id := NULLIF(TRIM(COALESCE(p_provider_order_id, '')), '');

    -- 1. Input presence validation
    IF v_clean_payment_id = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_PAYMENT_ID',
            'message', 'Provider payment transaction reference is required.'
        );
    END IF;

    -- 2. Fetch and lock the payment order row to prevent concurrent race conditions
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

    -- 3. Idempotent check: if already paid, return confirmed pass immediately
    IF v_order.status = 'paid' THEN
        SELECT ticket_code INTO v_issued_ticket_code
        FROM public.registrations
        WHERE id = v_order.registration_id;

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Payment order was already verified and confirmed.',
            'order_id', v_order.id,
            'ticket_code', v_issued_ticket_code,
            'status', 'paid'
        );
    END IF;

    -- 4. Check order status validity
    IF v_order.status IN ('cancelled', 'refunded', 'expired') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ORDER_VOID',
            'message', 'This payment order has been ' || v_order.status || ' and cannot be verified.'
        );
    END IF;

    -- 5. SEC-02: Replay Attack Protection
    -- Reject if this payment ID was already used by another confirmed order
    IF EXISTS (
        SELECT 1
        FROM public.payment_orders
        WHERE TRIM(provider_payment_id) = v_clean_payment_id
          AND id <> p_order_id
          AND status = 'paid'
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'PAYMENT_REPLAY_DETECTED',
            'message', 'Payment reference has already been consumed by another order. Replay rejected.'
        );
    END IF;

    -- 6. Fetch and lock associated registration
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

    -- 7. SEC-04: Prevent confirming cancelled or rejected registrations
    IF v_reg.status IN ('cancelled', 'rejected') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'REGISTRATION_INELIGIBLE',
            'message', 'Cannot confirm payment for a registration that is ' || v_reg.status || '.'
        );
    END IF;

    -- 8. Fetch associated event
    SELECT * INTO v_event
    FROM public.events
    WHERE id = v_order.event_id;

    IF v_event.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'EVENT_NOT_FOUND',
            'message', 'Associated event record was not found.'
        );
    END IF;

    -- 9. SEC-04: Respect manual organizer approval requirements
    IF v_event.approval_type = 'manual' AND v_reg.approval_status <> 'approved' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'APPROVAL_REQUIRED',
            'message', 'Registration application is pending organizer review and cannot be paid until approved.'
        );
    END IF;

    -- 10. SEC-03: Preserve existing ticket code; only generate new one if missing
    v_issued_ticket_code := COALESCE(
        NULLIF(TRIM(v_reg.ticket_code), ''),
        'TKT-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8)) || '-' || TO_CHAR(now(), 'MIIS')
    );

    -- 11. Transition payment order to 'paid'
    UPDATE public.payment_orders
    SET status = 'paid',
        provider_payment_id = v_clean_payment_id,
        provider_order_id = COALESCE(v_clean_provider_order_id, provider_order_id),
        provider_signature = v_clean_signature,
        paid_at = now(),
        updated_at = now()
    WHERE id = p_order_id;

    -- 12. Set transaction-local flag so tamper trigger allows server confirmation
    PERFORM set_config('festflow.internal_system_operation', 'true', true);

    -- 13. Atomically confirm registration and issue ticket
    UPDATE public.registrations
    SET status = 'confirmed',
        approval_status = 'approved',
        ticket_code = v_issued_ticket_code,
        ticket_issued_at = COALESCE(v_reg.ticket_issued_at, now()),
        updated_at = now()
    WHERE id = v_order.registration_id;

    -- 14. Notify student
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

    -- 15. Notify club organizer
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


-- ─── 3. SEC-01 & SEC-05: Least-Privilege Permissions & Grants ─────────────────

-- Strictly REVOKE execute privileges on verify_payment_order from untrusted roles
REVOKE ALL ON FUNCTION public.verify_payment_order(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_payment_order(UUID, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.verify_payment_order(UUID, TEXT, TEXT, TEXT) FROM authenticated;

-- GRANT execute privilege on verify_payment_order EXCLUSIVELY to service_role
GRANT EXECUTE ON FUNCTION public.verify_payment_order(UUID, TEXT, TEXT, TEXT) TO service_role;

-- Ensure public client RPCs are explicitly granted to authenticated users only
GRANT EXECUTE ON FUNCTION public.register_for_event(UUID, TEXT, JSONB, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_registration(UUID) TO authenticated;

-- Ensure unauthenticated anon callers cannot invoke registration RPCs
REVOKE ALL ON FUNCTION public.register_for_event(UUID, TEXT, JSONB, JSONB, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.cancel_registration(UUID) FROM anon;

COMMENT ON FUNCTION public.verify_payment_order IS 
  'Privileged server-side RPC for atomic payment confirmation. Callable exclusively by trusted service_role after cryptographic signature validation.';
