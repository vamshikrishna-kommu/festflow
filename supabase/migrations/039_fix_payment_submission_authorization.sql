-- =============================================================================
-- FESTFLOW DATABASE MIGRATION 039: FIX PAYMENT SUBMISSION AUTHORIZATION & INTEGRITY
-- =============================================================================
-- Root Cause Addressed:
-- 1. Trigger trg_enforce_payment_submission_integrity previously checked:
--      IF OLD.status IS DISTINCT FROM NEW.status THEN
--          RAISE EXCEPTION 'Unauthorized: Students cannot modify payment submission status directly.';
--      END IF;
--    When a student resubmitted payment proof after an organizer rejection (status: 'rejected' -> 'pending_review'),
--    or updated their submission reference, PostgreSQL fired this trigger and aborted the transaction.
-- 2. Trusted server-side RPC functions (submit_payment_submission) were not marked with
--    festflow.internal_system_operation, preventing them from updating submission rows.
-- 3. submit_payment_submission now sets festflow.internal_system_operation, enforces team leader
--    submission permissions, validates UTR format, supports coupon-discounted amounts,
--    and resets registration status cleanly without trigger conflicts.
-- =============================================================================

-- ── 1. Update enforce_payment_submission_integrity Trigger Function ───────────
CREATE OR REPLACE FUNCTION public.enforce_payment_submission_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_is_organizer boolean := false;
BEGIN
    -- Permit authorized server-side system operations (marked by transaction-scoped GUC)
    IF current_setting('festflow.internal_system_operation', true) = 'true' THEN
        RETURN NEW;
    END IF;

    -- On INSERT:
    IF TG_OP = 'INSERT' THEN
        -- Verify amount is non-negative
        IF NEW.amount IS NOT NULL AND NEW.amount < 0 THEN
            RAISE EXCEPTION 'Submitted payment amount cannot be negative.';
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
        -- Prevent changing immutable foreign keys
        IF OLD.event_id IS DISTINCT FROM NEW.event_id OR OLD.registration_id IS DISTINCT FROM NEW.registration_id THEN
            RAISE EXCEPTION 'Payment submission references are immutable.';
        END IF;

        IF OLD.student_id IS DISTINCT FROM NEW.student_id THEN
            RAISE EXCEPTION 'Payment submission student ownership is immutable.';
        END IF;

        -- Prevent student from self-approving or modifying reviewer audit fields
        IF auth.uid() IS NOT NULL AND auth.uid() = OLD.student_id THEN
            SELECT EXISTS (
                SELECT 1 FROM public.events e 
                WHERE e.id = OLD.event_id AND (
                    e.club_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin')
                )
            ) INTO v_is_organizer;

            IF NOT v_is_organizer THEN
                -- Students can NEVER approve or reject their own payment directly
                IF NEW.status IN ('approved', 'rejected') AND OLD.status IS DISTINCT FROM NEW.status THEN
                    RAISE EXCEPTION 'Unauthorized: Students cannot approve or reject payment submissions directly.';
                END IF;

                -- Students can NEVER alter reviewer audit fields directly
                IF (NEW.reviewer_id IS NOT NULL AND NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id) OR
                   (NEW.reviewed_at IS NOT NULL AND NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at) THEN
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

-- ── 2. Update submit_payment_submission RPC ──────────────────────────────────
DROP FUNCTION IF EXISTS public.submit_payment_submission(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.submit_payment_submission(UUID, TEXT, TEXT, TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.submit_payment_submission(
    p_registration_id UUID,
    p_transaction_reference TEXT,
    p_screenshot_url TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_student_id UUID;
    v_reg_id UUID;
    v_reg_status TEXT;
    v_reg_student_id UUID;
    v_event_id UUID;
    v_event_title TEXT;
    v_event_price NUMERIC;
    v_event_currency TEXT;
    v_event_is_free BOOLEAN;
    v_event_part_type TEXT;
    v_club_id UUID;
    v_clean_ref TEXT;
    v_existing_id UUID;
    v_sub_id UUID;
    v_team_id UUID;
    v_team_role TEXT;
    v_final_amount NUMERIC;
    v_now TIMESTAMPTZ := now();
BEGIN
    -- 1. Authenticate caller
    v_student_id := auth.uid();
    IF v_student_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'UNAUTHENTICATED',
            'message', 'You must be signed in to submit payment.'
        );
    END IF;

    -- 2. Validate UTR reference
    v_clean_ref := UPPER(TRIM(COALESCE(p_transaction_reference, '')));
    IF length(v_clean_ref) < 6 OR length(v_clean_ref) > 24 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_UTR',
            'message', 'Transaction reference (UTR) must be between 6 and 24 characters.'
        );
    END IF;

    IF v_clean_ref !~ '^[A-Z0-9\-_]+$' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_UTR_FORMAT',
            'message', 'Transaction reference may only contain alphanumeric characters, hyphens, and underscores.'
        );
    END IF;

    -- 3. Fetch and lock registration
    SELECT r.id, r.event_id, r.status, r.team_id, r.team_role, r.student_id,
           e.title, e.price, e.currency, e.is_free, e.club_id, e.participation_type
    INTO v_reg_id, v_event_id, v_reg_status, v_team_id, v_team_role, v_reg_student_id,
         v_event_title, v_event_price, v_event_currency, v_event_is_free, v_club_id, v_event_part_type
    FROM public.registrations r
    JOIN public.events e ON e.id = r.event_id
    WHERE r.id = p_registration_id
    FOR UPDATE OF r;

    IF v_reg_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'REGISTRATION_NOT_FOUND',
            'message', 'Registration record was not found.'
        );
    END IF;

    -- 4. Authorize registration ownership
    IF v_reg_student_id <> v_student_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'FORBIDDEN',
            'message', 'Unauthorized: You can only submit payment details for your own registration.'
        );
    END IF;

    -- 5. Team leadership check: only squad leader may submit payment for the entire squad
    IF v_team_id IS NOT NULL AND v_event_part_type = 'team' AND COALESCE(v_team_role, '') <> 'leader' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'NOT_TEAM_LEADER',
            'message', 'Only the team leader can submit payment proof for the squad.'
        );
    END IF;

    -- 6. Business state validations
    IF v_event_is_free = true OR COALESCE(v_event_price, 0) <= 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'EVENT_IS_FREE',
            'message', 'This event is free. No payment submission is required.'
        );
    END IF;

    IF v_reg_status = 'confirmed' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ALREADY_CONFIRMED',
            'message', 'This registration is already confirmed. Pass has been issued.'
        );
    END IF;

    IF v_reg_status = 'cancelled' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'REGISTRATION_CANCELLED',
            'message', 'Cannot submit payment for a cancelled registration.'
        );
    END IF;

    -- 7. Prevent duplicate active/approved UTR across other registrations in this event
    SELECT id INTO v_existing_id
    FROM public.payment_submissions
    WHERE event_id = v_event_id
      AND UPPER(TRIM(transaction_reference)) = v_clean_ref
      AND registration_id <> p_registration_id
      AND status IN ('pending_review', 'approved')
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'DUPLICATE_UTR',
            'message', 'This transaction reference (UTR) has already been submitted for another registration in this event.'
        );
    END IF;

    -- 8. Compute payable amount (respects coupon discounts while ensuring non-negative)
    v_final_amount := COALESCE(p_amount, v_event_price);
    IF v_final_amount < 0 THEN
        v_final_amount := 0;
    END IF;

    -- 9. Set transaction-local flag so triggers recognize this authorized system operation
    PERFORM set_config('festflow.internal_system_operation', 'true', true);

    -- 10. Upsert payment submission record
    SELECT id INTO v_sub_id
    FROM public.payment_submissions
    WHERE registration_id = p_registration_id
    LIMIT 1;

    IF v_sub_id IS NOT NULL THEN
        UPDATE public.payment_submissions
        SET transaction_reference = v_clean_ref,
            screenshot_url = COALESCE(p_screenshot_url, screenshot_url),
            student_notes = COALESCE(p_notes, student_notes),
            amount = v_final_amount,
            status = 'pending_review',
            reviewed_at = NULL,
            reviewer_id = NULL,
            review_notes = NULL,
            updated_at = v_now
        WHERE id = v_sub_id;
    ELSE
        INSERT INTO public.payment_submissions (
            registration_id,
            event_id,
            student_id,
            amount,
            currency,
            transaction_reference,
            screenshot_url,
            student_notes,
            status,
            submitted_at,
            created_at,
            updated_at
        ) VALUES (
            p_registration_id,
            v_event_id,
            v_student_id,
            v_final_amount,
            COALESCE(v_event_currency, 'INR'),
            v_clean_ref,
            p_screenshot_url,
            p_notes,
            'pending_review',
            v_now,
            v_now,
            v_now
        ) RETURNING id INTO v_sub_id;
    END IF;

    -- 11. Update registration status back to pending_payment, clearing rejection reason
    UPDATE public.registrations
    SET status = 'pending_payment',
        rejection_reason = NULL,
        updated_at = v_now
    WHERE id = p_registration_id;

    -- 12. If team leader, sync squad members' registrations back to pending_payment
    IF v_team_id IS NOT NULL AND (v_team_role = 'leader' OR v_event_part_type = 'team') THEN
        UPDATE public.registrations
        SET status = 'pending_payment',
            rejection_reason = NULL,
            updated_at = v_now
        WHERE team_id = v_team_id AND id <> p_registration_id;
    END IF;

    -- 13. Record payment audit trail if audit table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'payment_audit_logs'
    ) THEN
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
            v_sub_id,
            p_registration_id,
            v_event_id,
            'submitted',
            v_student_id,
            'student',
            v_reg_status,
            'pending_review',
            'Student submitted payment proof via UPI.',
            jsonb_build_object('utr', v_clean_ref, 'amount', v_final_amount)
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'submission_id', v_sub_id,
        'status', 'pending_review',
        'message', 'Payment reference submitted successfully! The club organizer will verify and activate your pass.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_payment_submission(UUID, TEXT, TEXT, TEXT, NUMERIC) TO authenticated, service_role;

