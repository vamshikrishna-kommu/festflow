-- FESTFLOW DATABASE MIGRATION 045: COMPLETE CERTIFICATE FEATURE REMOVAL
-- Permanently removes all certificate-related tables, storage buckets, RLS policies, indexes, and columns.
-- Preserves all unrelated events, registrations, check-ins, payments, users, and audit records.

-- 1. Drop storage policies and bucket for certificates
DROP POLICY IF EXISTS "Public can view certificates" ON storage.objects;
DROP POLICY IF EXISTS "Organizers can upload certificates" ON storage.objects;

DELETE FROM storage.objects WHERE bucket_id = 'certificates';
DELETE FROM storage.buckets WHERE id = 'certificates';

-- 2. Drop RLS policies for event_certificates and certificate_templates
DROP POLICY IF EXISTS "Public can verify valid certificates" ON public.event_certificates;
DROP POLICY IF EXISTS "Students can view own certificates" ON public.event_certificates;
DROP POLICY IF EXISTS "Organizers can issue certificates" ON public.event_certificates;
DROP POLICY IF EXISTS "Organizers can update certificates" ON public.event_certificates;
DROP POLICY IF EXISTS "Organizers can view own club templates" ON public.certificate_templates;
DROP POLICY IF EXISTS "Organizers can insert own club templates" ON public.certificate_templates;
DROP POLICY IF EXISTS "Organizers can update own club templates" ON public.certificate_templates;
DROP POLICY IF EXISTS "Organizers can delete own club templates" ON public.certificate_templates;

-- 3. Drop triggers
DROP TRIGGER IF EXISTS trg_event_certificates_updated_at ON public.event_certificates;
DROP TRIGGER IF EXISTS trg_certificate_templates_updated_at ON public.certificate_templates;

-- 4. Drop performance indexes
DROP INDEX IF EXISTS public.idx_certificates_student_event;
DROP INDEX IF EXISTS public.idx_event_certs_student_id;
DROP INDEX IF EXISTS public.idx_event_certs_event_id;
DROP INDEX IF EXISTS public.idx_event_certs_token;
DROP INDEX IF EXISTS public.idx_event_certs_number;
DROP INDEX IF EXISTS public.idx_cert_templates_club_id;
DROP INDEX IF EXISTS public.idx_cert_templates_active;

-- 5. Drop tables CASCADE
DROP TABLE IF EXISTS public.event_certificates CASCADE;
DROP TABLE IF EXISTS public.certificate_templates CASCADE;

-- 6. Safely remove certificate-specific columns from remaining tables if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'student_profiles' AND column_name = 'hide_certificates'
  ) THEN
    ALTER TABLE public.student_profiles DROP COLUMN hide_certificates;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notification_preferences' AND column_name = 'certificate_notifications'
  ) THEN
    ALTER TABLE public.notification_preferences DROP COLUMN certificate_notifications;
  END IF;
END $$;
