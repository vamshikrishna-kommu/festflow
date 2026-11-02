-- =============================================================================
-- FESTFLOW DATABASE MIGRATION 038: HIGH-PERFORMANCE QUERY OPTIMIZATION INDEXES
-- =============================================================================
-- Additive, non-breaking composite indexes designed to optimize:
-- 1. Published event discovery and chronological start-date sorting
-- 2. Student dashboard registration lookups by status
-- 3. Gate turnstile scanner & ticket check-in queries
-- 4. Payment reconciliation lookups by status and event
-- 5. Teammate discovery candidate filtering
-- 6. User active club membership resolution
-- 7. In-app notifications unread counter
-- 8. Student certificate retrieval
-- =============================================================================

-- 1. Events: Status + Start Date composite index for fast Discover page queries
CREATE INDEX IF NOT EXISTS idx_events_status_start_date 
  ON public.events(status, start_date ASC) 
  WHERE status = 'published';

-- 2. Events: Category + Status composite index for category tabs
CREATE INDEX IF NOT EXISTS idx_events_category_published 
  ON public.events(category, start_date ASC) 
  WHERE status = 'published';

-- 3. Registrations: Student ID + Status for instant Student Dashboard loading
CREATE INDEX IF NOT EXISTS idx_registrations_student_status 
  ON public.registrations(student_id, status);

-- 4. Registrations: Event ID + Status for Club Attendee Management
CREATE INDEX IF NOT EXISTS idx_registrations_event_status 
  ON public.registrations(event_id, status);

-- 5. Registrations: Event ID + Ticket Code for Gate Turnstile Scanner
CREATE INDEX IF NOT EXISTS idx_registrations_event_ticket 
  ON public.registrations(event_id, ticket_code);

-- 6. Check-ins: Event ID + Registration ID for instant Check-in deduplication
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'check_ins'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_check_ins_event_reg 
      ON public.check_ins(event_id, registration_id);
  END IF;
END $$;

-- 7. Payment Submissions: Event ID + Status for Club Payment Review Desk
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'payment_submissions'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_payment_submissions_event_status 
      ON public.payment_submissions(event_id, status);
    
    CREATE INDEX IF NOT EXISTS idx_payment_submissions_reg_status 
      ON public.payment_submissions(registration_id, status);
  END IF;
END $$;

-- 8. Teammate Profiles: Opt-in + Availability for fast candidate browsing
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'teammate_profiles'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_teammate_profiles_optin_avail 
      ON public.teammate_profiles(is_opted_in, availability) 
      WHERE is_opted_in = true;
  END IF;
END $$;

-- 9. Club Members: User ID + Status for multi-workspace resolution
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'club_members'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_club_members_user_status 
      ON public.club_members(user_id, status) 
      WHERE status = 'active';
  END IF;
END $$;

-- 10. In-App Notifications: User ID + Read Status for badge counter
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'in_app_notifications'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
      ON public.in_app_notifications(user_id, is_read);
  END IF;
END $$;

-- 11. Event Certificates: Student ID + Event ID for Student Certificate lookups
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'event_certificates'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_certificates_student_event 
      ON public.event_certificates(student_id, event_id);
  END IF;
END $$;
