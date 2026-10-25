-- ============================================================================
-- FestFlow Migration 006: Transactional Email Outbox & Report Analytics
-- ============================================================================

-- 1. Create email_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_status') THEN
        CREATE TYPE public.email_status AS ENUM ('pending', 'sent', 'failed', 'disabled');
    END IF;
END $$;

-- 2. Create email_outbox table for idempotent transactional delivery
CREATE TABLE IF NOT EXISTS public.email_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
    template_type VARCHAR(50) NOT NULL,
    subject TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status public.email_status NOT NULL DEFAULT 'pending',
    idempotency_key TEXT UNIQUE,
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_email_outbox_event_id ON public.email_outbox(event_id, status);
CREATE INDEX IF NOT EXISTS idx_email_outbox_user_id ON public.email_outbox(user_id);
CREATE INDEX IF NOT EXISTS idx_email_outbox_status ON public.email_outbox(status, created_at DESC);

-- Enable RLS
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own email outbox records" ON public.email_outbox;
    DROP POLICY IF EXISTS "Organizers can view event email outbox records" ON public.email_outbox;
END $$;

-- RLS: Recipients can view their own email logs
CREATE POLICY "Users can view own email outbox records"
    ON public.email_outbox
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() OR
        recipient_email = auth.email()
    );

-- RLS: Event organizers can view email logs for events they manage
CREATE POLICY "Organizers can view event email outbox records"
    ON public.email_outbox
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = email_outbox.event_id
              AND e.club_id = auth.uid()
        )
    );

-- 3. Stored Procedure: Queue Email Idempotently
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
    v_new_id UUID;
BEGIN
    -- If an entry with this idempotency key already exists, return existing status
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

-- 4. Stored Procedure: Send Bulk Event Reminders (Organizer Control)
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
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'You must be signed in.');
    END IF;

    -- Confirm event exists and caller is owner
    SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
    IF v_event.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Event not found.');
    END IF;

    IF v_event.club_id <> v_caller_id THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Only the owning club organizer can send reminders.');
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

        -- Queue in outbox if not already sent today
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

            -- Also create an in-app notification
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
