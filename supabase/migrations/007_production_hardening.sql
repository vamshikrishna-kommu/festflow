-- ============================================================================
-- FestFlow Migration 007: Production Hardening, Integrity & Security Safeguards
-- ============================================================================
-- Run in your Supabase SQL Editor or via Supabase CLI:
--   supabase db push
-- ============================================================================

-- 1. Ensure Storage Buckets & Safe Re-runnable Policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('event-posters', 'event-posters', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    ('payment-proofs', 'payment-proofs', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('club-payment-qrs', 'club-payment-qrs', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Safe storage policies with DROP IF EXISTS
DO $$
BEGIN
    DROP POLICY IF EXISTS "public can view event posters" ON storage.objects;
    DROP POLICY IF EXISTS "authenticated clubs can upload event posters" ON storage.objects;
    DROP POLICY IF EXISTS "clubs can update own event posters" ON storage.objects;
    DROP POLICY IF EXISTS "clubs can delete own event posters" ON storage.objects;

    DROP POLICY IF EXISTS "Authenticated users can upload payment proofs" ON storage.objects;
    DROP POLICY IF EXISTS "Users can read own payment proofs" ON storage.objects;
    DROP POLICY IF EXISTS "Public read for club payment QRs" ON storage.objects;
    DROP POLICY IF EXISTS "Public read for avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
END $$;

CREATE POLICY "public can view event posters"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'event-posters');

CREATE POLICY "authenticated clubs can upload event posters"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'event-posters' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "clubs can update own event posters"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'event-posters' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "clubs can delete own event posters"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'event-posters' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

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

CREATE POLICY "Public read for club payment QRs"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'club-payment-qrs');

CREATE POLICY "Public read for avatars"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'avatars' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- 2. Performance & Production Indexes
CREATE INDEX IF NOT EXISTS idx_registrations_ticket_lookup 
    ON public.registrations (UPPER(ticket_code), event_id);

CREATE INDEX IF NOT EXISTS idx_payment_submissions_event_status 
    ON public.payment_submissions (event_id, status);

CREATE INDEX IF NOT EXISTS idx_events_start_status 
    ON public.events (start_date, status);

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user_unread 
    ON public.in_app_notifications (user_id, is_read, created_at DESC);

-- 3. Production Check-In Integrity Guard: Prevent Inactive or Unconfirmed Check-Ins
-- Re-verify that check_in_ticket rejects non-confirmed registrations
CREATE OR REPLACE FUNCTION public.check_in_ticket(
    p_event_id UUID,
    p_ticket_code_or_payload TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_staff_id UUID;
    v_event RECORD;
    v_clean_code TEXT;
    v_reg RECORD;
    v_existing_checkin RECORD;
    v_student_profile RECORD;
    v_checked_in_time TIMESTAMPTZ;
BEGIN
    v_staff_id := auth.uid();
    IF v_staff_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'UNAUTHORIZED',
            'message', 'You must be signed in to perform attendee check-in.'
        );
    END IF;

    -- Extract clean ticket code from raw payload (e.g. "festflow://ticket/TKT-XYZ" or "TKT-XYZ")
    v_clean_code := TRIM(p_ticket_code_or_payload);
    IF v_clean_code LIKE 'festflow://ticket/%' THEN
        v_clean_code := SUBSTRING(v_clean_code FROM 19);
    END IF;
    v_clean_code := UPPER(TRIM(v_clean_code));

    -- Lock and retrieve event details
    SELECT * INTO v_event
    FROM public.events
    WHERE id = p_event_id;

    IF v_event.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'UNAUTHORIZED',
            'message', 'Target event not found.'
        );
    END IF;

    -- Verify caller owns the event (or is authorized staff/admin)
    IF v_event.club_id <> v_staff_id THEN
        -- Check if caller is platform_admin
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles WHERE id = v_staff_id AND role = 'platform_admin'
        ) THEN
            RETURN jsonb_build_object(
                'success', false,
                'outcome', 'UNAUTHORIZED',
                'message', 'You are not authorized to check in attendees for this event.'
            );
        END IF;
    END IF;

    -- Lock and retrieve the registration row by ticket code
    SELECT * INTO v_reg
    FROM public.registrations
    WHERE UPPER(ticket_code) = v_clean_code
    FOR UPDATE;

    IF v_reg.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'INVALID_TICKET',
            'message', 'Unknown ticket code. No registration matches this code.'
        );
    END IF;

    -- Verify ticket belongs to this specific event
    IF v_reg.event_id <> p_event_id THEN
        DECLARE
            v_actual_event_title TEXT;
        BEGIN
            SELECT title INTO v_actual_event_title FROM public.events WHERE id = v_reg.event_id;
            RETURN jsonb_build_object(
                'success', false,
                'outcome', 'WRONG_EVENT',
                'ticket_code', v_clean_code,
                'message', 'This ticket belongs to another event (' || COALESCE(v_actual_event_title, 'different event') || ').'
            );
        END;
    END IF;

    -- Fetch student display details for reporting
    SELECT display_name, email INTO v_student_profile
    FROM public.profiles
    WHERE id = v_reg.student_id;

    -- Security Guard 1: Revoked / Cancelled Tickets
    IF v_reg.status = 'cancelled' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'CANCELLED',
            'student_name', v_student_profile.display_name,
            'ticket_code', v_clean_code,
            'message', 'Registration cancelled. This ticket has been revoked and is void for entry.'
        );
    END IF;

    -- Security Guard 2: Rejected Registrations
    IF v_reg.status = 'rejected' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'NOT_CONFIRMED',
            'student_name', v_student_profile.display_name,
            'ticket_code', v_clean_code,
            'message', 'Payment rejected by organizer. Entry is not permitted.'
        );
    END IF;

    -- Security Guard 3: Must be confirmed (Paid events without approval are blocked)
    IF v_reg.status <> 'confirmed' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'NOT_CONFIRMED',
            'student_name', v_student_profile.display_name,
            'ticket_code', v_clean_code,
            'message', 'Registration not confirmed. Status is "' || v_reg.status || '". Payment must be verified before entry.'
        );
    END IF;

    -- Security Guard 4: Duplicate Check-In Prevention (Row lock check_ins)
    SELECT * INTO v_existing_checkin
    FROM public.check_ins
    WHERE registration_id = v_reg.id
    FOR UPDATE;

    IF v_existing_checkin.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'ALREADY_USED',
            'student_name', v_student_profile.display_name,
            'ticket_code', v_clean_code,
            'checked_in_at', v_existing_checkin.checked_in_at,
            'message', 'Ticket was already checked in at ' || TO_CHAR(v_existing_checkin.checked_in_at, 'HH12:MI AM on Mon DD, YYYY') || '.'
        );
    END IF;

    -- Perform atomic check-in insert
    v_checked_in_time := now();
    INSERT INTO public.check_ins (
        registration_id,
        event_id,
        ticket_code,
        staff_id,
        checked_in_at,
        checkin_notes
    ) VALUES (
        v_reg.id,
        p_event_id,
        v_clean_code,
        v_staff_id,
        v_checked_in_time,
        p_notes
    );

    RETURN jsonb_build_object(
        'success', true,
        'outcome', 'VALID',
        'registration_id', v_reg.id,
        'ticket_code', v_clean_code,
        'student_name', COALESCE(v_student_profile.display_name, 'Student Attendee'),
        'student_email', COALESCE(v_student_profile.email, ''),
        'checked_in_at', v_checked_in_time,
        'message', 'Entry granted! Ticket validated successfully.'
    );
END;
$$;

-- 4. RPC Permissions: Explicit execution grants for authenticated users
GRANT EXECUTE ON FUNCTION public.register_for_event(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_registration(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_payment_submission(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_payment_submission(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_in_ticket(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.queue_email(text, text, text, text, jsonb, text, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_event_reminders(uuid, text) TO authenticated;

-- Migration 007 completed: Production hardening, storage bucket idempotency, RPC grants, and attendance security constraints.
