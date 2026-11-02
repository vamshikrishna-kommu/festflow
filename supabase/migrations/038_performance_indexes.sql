-- =============================================================================
-- FESTFLOW DATABASE MIGRATION 038: HIGH-PERFORMANCE QUERY OPTIMIZATION INDEXES
-- =============================================================================
-- Additive, non-breaking composite indexes designed to optimize:
-- 1. Published event discovery and chronological start-date sorting
-- 2. Student dashboard registration lookups by status
-- 3. Club attendee management and check-in queries
-- 4. Payment reconciliation lookups by status and event
-- 5. Teammate discovery candidate filtering
-- 6. User active club membership resolution
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

-- 5. Registrations: Event ID + Attendance Status for Gate Turnstile Scanner
CREATE INDEX IF NOT EXISTS idx_registrations_event_attendance 
  ON public.registrations(event_id, attendance_status);

-- 6. Payment Submissions: Event ID + Status for Club Payment Review Desk
CREATE INDEX IF NOT EXISTS idx_payment_submissions_event_status 
  ON public.payment_submissions(event_id, status);

-- 7. Payment Submissions: Registration ID + Status for Student Payment Page
CREATE INDEX IF NOT EXISTS idx_payment_submissions_reg_status 
  ON public.payment_submissions(registration_id, status);

-- 8. Teammate Discovery Profiles: Opt-in + Availability for fast browsing
CREATE INDEX IF NOT EXISTS idx_teammate_profiles_optin_avail 
  ON public.teammate_discovery_profiles(is_opted_in, availability) 
  WHERE is_opted_in = true;

-- 9. Club Members: User ID + Status for multi-workspace resolution
CREATE INDEX IF NOT EXISTS idx_club_members_user_status 
  ON public.club_members(user_id, status) 
  WHERE status = 'active';

-- 10. In-App Notifications: User ID + Read Status for badge counter
CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
  ON public.in_app_notifications(user_id, is_read);

-- 11. Event Certificates: Recipient ID + Event ID for Student Certificate lookups
CREATE INDEX IF NOT EXISTS idx_certificates_recipient_event 
  ON public.event_certificates(recipient_id, event_id);
