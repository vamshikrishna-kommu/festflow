-- =============================================================================
-- FESTFLOW DATABASE MIGRATION 042: NOTIFICATIONS & AUTOMATION SYSTEM (PHASE 8)
-- =============================================================================
-- Features:
-- 1. Extend in_app_notifications with category, metadata, and archived status
-- 2. Push notification subscriptions store for Web Push API
-- 3. User notification preferences (channel & category granularity)
-- 4. Event waitlist management with concurrency-safe atomic promotion RPC
-- 5. Club event automation rules (welcome, reminders, surveys, certificates)
-- 6. Super Admin automation queue inspection RPC
-- 7. High-performance composite query indexes & robust RLS policies
-- =============================================================================

-- 1. Extend in_app_notifications with category, metadata, and archived
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'in_app_notifications' AND column_name = 'category'
  ) THEN
    ALTER TABLE public.in_app_notifications ADD COLUMN category TEXT DEFAULT 'general';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'in_app_notifications' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.in_app_notifications ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'in_app_notifications' AND column_name = 'archived'
  ) THEN
    ALTER TABLE public.in_app_notifications ADD COLUMN archived BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Notification category index for Central Notification Center
CREATE INDEX IF NOT EXISTS idx_in_app_notifs_user_cat 
  ON public.in_app_notifications(user_id, category, is_read, created_at DESC);

-- 2. Web Push Subscriptions Table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'push_subscriptions' AND policyname = 'Users can view their own push subscriptions'
  ) THEN
    CREATE POLICY "Users can view their own push subscriptions"
      ON public.push_subscriptions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'push_subscriptions' AND policyname = 'Users can register their own push subscriptions'
  ) THEN
    CREATE POLICY "Users can register their own push subscriptions"
      ON public.push_subscriptions FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'push_subscriptions' AND policyname = 'Users can delete their own push subscriptions'
  ) THEN
    CREATE POLICY "Users can delete their own push subscriptions"
      ON public.push_subscriptions FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);

-- 3. User Notification Preferences Table
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT false,
  event_reminders BOOLEAN DEFAULT true,
  payment_updates BOOLEAN DEFAULT true,
  club_announcements BOOLEAN DEFAULT true,
  platform_announcements BOOLEAN DEFAULT true,
  team_notifications BOOLEAN DEFAULT true,
  certificate_notifications BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_notification_preferences' AND policyname = 'Users can view their own preferences'
  ) THEN
    CREATE POLICY "Users can view their own preferences"
      ON public.user_notification_preferences FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_notification_preferences' AND policyname = 'Users can update their own preferences'
  ) THEN
    CREATE POLICY "Users can update their own preferences"
      ON public.user_notification_preferences FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Event Waitlists Configuration Table
CREATE TABLE IF NOT EXISTS public.event_waitlists (
  event_id UUID PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT true,
  max_capacity INT DEFAULT 50,
  auto_promote BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.event_waitlists ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_waitlists' AND policyname = 'Anyone can view waitlist settings'
  ) THEN
    CREATE POLICY "Anyone can view waitlist settings"
      ON public.event_waitlists FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_waitlists' AND policyname = 'Organizers can manage event waitlists'
  ) THEN
    CREATE POLICY "Organizers can manage event waitlists"
      ON public.event_waitlists FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.events e
          WHERE e.id = event_waitlists.event_id AND (
            e.club_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.club_members cm WHERE cm.club_id = e.club_id AND cm.user_id = auth.uid() AND cm.status = 'active') OR
            EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'platform_admin')
          )
        )
      );
  END IF;
END $$;

-- 5. Event Waitlist Entries Table
CREATE TABLE IF NOT EXISTS public.event_waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'offered', 'claimed', 'expired', 'cancelled')),
  offer_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_event_student_waitlist UNIQUE (event_id, student_id)
);

ALTER TABLE public.event_waitlist_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_waitlist_entries' AND policyname = 'Students can view their own waitlist entries'
  ) THEN
    CREATE POLICY "Students can view their own waitlist entries"
      ON public.event_waitlist_entries FOR SELECT
      USING (auth.uid() = student_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_waitlist_entries' AND policyname = 'Students can join waitlist'
  ) THEN
    CREATE POLICY "Students can join waitlist"
      ON public.event_waitlist_entries FOR INSERT
      WITH CHECK (auth.uid() = student_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_waitlist_entries' AND policyname = 'Students can cancel their own waitlist entry'
  ) THEN
    CREATE POLICY "Students can cancel their own waitlist entry"
      ON public.event_waitlist_entries FOR UPDATE
      USING (auth.uid() = student_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_waitlist_entries' AND policyname = 'Organizers can view event waitlist entries'
  ) THEN
    CREATE POLICY "Organizers can view event waitlist entries"
      ON public.event_waitlist_entries FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.events e
          WHERE e.id = event_waitlist_entries.event_id AND (
            e.club_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.club_members cm WHERE cm.club_id = e.club_id AND cm.user_id = auth.uid() AND cm.status = 'active') OR
            EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'platform_admin')
          )
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_waitlist_event_status ON public.event_waitlist_entries(event_id, status, position);
CREATE INDEX IF NOT EXISTS idx_waitlist_student ON public.event_waitlist_entries(student_id);

-- 6. Club Event Automations Table
CREATE TABLE IF NOT EXISTS public.club_event_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('welcome_registration', 'reminder_7d', 'reminder_3d', 'reminder_1d', 'reminder_2h', 'post_event_feedback', 'certificate_ready')),
  schedule_offset TEXT,
  message_template TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  last_executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.club_event_automations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'club_event_automations' AND policyname = 'Organizers can manage club event automations'
  ) THEN
    CREATE POLICY "Organizers can manage club event automations"
      ON public.club_event_automations FOR ALL
      USING (
        club_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.club_members cm
          WHERE cm.club_id = club_event_automations.club_id
            AND cm.user_id = auth.uid()
            AND cm.status = 'active'
        )
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'platform_admin'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_club_automations_event ON public.club_event_automations(event_id, trigger_type);

-- 7. Concurrency-Safe Waitlist Promotion RPC
CREATE OR REPLACE FUNCTION public.promote_waitlist_attendee(p_waitlist_entry_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entry RECORD;
  v_event RECORD;
  v_current_count INT;
BEGIN
  -- 1. Fetch waitlist entry with lock
  SELECT * INTO v_entry
  FROM public.event_waitlist_entries
  WHERE id = p_waitlist_entry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'WAITLIST_ENTRY_NOT_FOUND');
  END IF;

  IF v_entry.status NOT IN ('waiting', 'offered') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS', 'current_status', v_entry.status);
  END IF;

  -- 2. Fetch event capacity
  SELECT id, capacity, title INTO v_event
  FROM public.events
  WHERE id = v_entry.event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'EVENT_NOT_FOUND');
  END IF;

  -- 3. Check existing confirmed registrations count
  SELECT COUNT(*) INTO v_current_count
  FROM public.registrations
  WHERE event_id = v_entry.event_id AND status = 'confirmed';

  IF v_event.capacity IS NOT NULL AND v_current_count >= v_event.capacity THEN
    RETURN jsonb_build_object('success', false, 'error', 'CAPACITY_REACHED', 'capacity', v_event.capacity, 'current', v_current_count);
  END IF;

  -- 4. Mark waitlist entry claimed
  UPDATE public.event_waitlist_entries
  SET status = 'claimed', updated_at = now()
  WHERE id = p_waitlist_entry_id;

  RETURN jsonb_build_object(
    'success', true,
    'entry_id', v_entry.id,
    'event_id', v_entry.event_id,
    'student_id', v_entry.student_id,
    'event_title', v_event.title
  );
END;
$$;

-- 8. Super Admin Automation Queue Inspection RPC
CREATE OR REPLACE FUNCTION public.get_automation_queue_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_queued_emails INT := 0;
  v_sent_emails INT := 0;
  v_failed_emails INT := 0;
  v_push_subs_count INT := 0;
  v_waitlist_count INT := 0;
  v_active_automations INT := 0;
BEGIN
  -- Email Outbox metrics
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_outbox') THEN
    SELECT COUNT(*) INTO v_queued_emails FROM public.email_outbox WHERE status IN ('pending', 'queued', 'retry');
    SELECT COUNT(*) INTO v_sent_emails FROM public.email_outbox WHERE status = 'sent';
    SELECT COUNT(*) INTO v_failed_emails FROM public.email_outbox WHERE status = 'failed';
  END IF;

  -- Push subscriptions count
  SELECT COUNT(*) INTO v_push_subs_count FROM public.push_subscriptions;

  -- Waitlist active entries
  SELECT COUNT(*) INTO v_waitlist_count FROM public.event_waitlist_entries WHERE status IN ('waiting', 'offered');

  -- Active club automations
  SELECT COUNT(*) INTO v_active_automations FROM public.club_event_automations WHERE is_enabled = true;

  RETURN jsonb_build_object(
    'emails_queued', v_queued_emails,
    'emails_sent', v_sent_emails,
    'emails_failed', v_failed_emails,
    'push_subscriptions_count', v_push_subs_count,
    'waitlist_active_count', v_waitlist_count,
    'active_automations_count', v_active_automations
  );
END;
$$;

