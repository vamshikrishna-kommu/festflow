-- ==============================================================================
-- FestFlow Migration 057: Fix Storage Policies (Event Posters & Payment QRs)
-- and Club Registrations RLS & Schema Resilience
-- ==============================================================================

-- 1. Ensure Storage Buckets exist and are marked PUBLIC
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'event-posters',
    'event-posters',
    true,
    10485760, -- 10MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'club-payment-qrs',
    'club-payment-qrs',
    true,
    5242880,  -- 5MB
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  )
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Storage Objects: Public Read Access for Event Posters & Club Payment QRs
DROP POLICY IF EXISTS "public can view event posters" ON storage.objects;
CREATE POLICY "public can view event posters"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'event-posters');

DROP POLICY IF EXISTS "public can view club payment qrs" ON storage.objects;
CREATE POLICY "public can view club payment qrs"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'club-payment-qrs');

-- 3. Storage Objects: Resilient Upload Policy for Event Posters
DROP POLICY IF EXISTS "authenticated clubs can upload event posters" ON storage.objects;
CREATE POLICY "authenticated clubs can upload event posters"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-posters'
    AND (
      -- Case 1: Uploading under own user UUID folder
      (storage.foldername(name))[1] = auth.uid()::text
      -- Case 2: Uploading under a club profile owned by current user
      OR EXISTS (
        SELECT 1 FROM public.club_profiles cp
        WHERE cp.profile_id::text = (storage.foldername(name))[1]
          AND cp.profile_id = auth.uid()
      )
      -- Case 3: Uploading under a club where user has events.create or events.edit permission
      OR (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        AND (
          public.has_club_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'events.create')
          OR public.has_club_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'events.edit')
        )
      )
      -- Case 4: Platform admin
      OR public.check_is_platform_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "clubs can update own event posters" ON storage.objects;
CREATE POLICY "clubs can update own event posters"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'event-posters'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.club_profiles cp
        WHERE cp.profile_id::text = (storage.foldername(name))[1]
          AND cp.profile_id = auth.uid()
      )
      OR (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        AND public.has_club_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'events.edit')
      )
      OR public.check_is_platform_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "clubs can delete own event posters" ON storage.objects;
CREATE POLICY "clubs can delete own event posters"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'event-posters'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.club_profiles cp
        WHERE cp.profile_id::text = (storage.foldername(name))[1]
          AND cp.profile_id = auth.uid()
      )
      OR (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        AND public.has_club_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'events.edit')
      )
      OR public.check_is_platform_admin(auth.uid())
    )
  );

-- 4. Storage Objects: Resilient Upload Policy for Club Payment QRs
DROP POLICY IF EXISTS "Club organizers can manage own payment QRs" ON storage.objects;
CREATE POLICY "Club organizers can manage own payment QRs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'club-payment-qrs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.club_profiles cp
        WHERE cp.profile_id::text = (storage.foldername(name))[1]
          AND cp.profile_id = auth.uid()
      )
      OR (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        AND public.has_club_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'payments.settings')
      )
      OR public.check_is_platform_admin(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Club organizers can update own payment QRs" ON storage.objects;
CREATE POLICY "Club organizers can update own payment QRs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'club-payment-qrs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.club_profiles cp
        WHERE cp.profile_id::text = (storage.foldername(name))[1]
          AND cp.profile_id = auth.uid()
      )
      OR (
        (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        AND public.has_club_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'payments.settings')
      )
      OR public.check_is_platform_admin(auth.uid())
    )
  );

-- 5. Ensure missing columns on public.registrations & public.events exist safely
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS cancellation_request_status TEXT DEFAULT NULL;

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS seat_reservation_id UUID DEFAULT NULL;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS cover_url TEXT DEFAULT NULL;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS registration_mode TEXT DEFAULT 'standard';

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS allow_reentry BOOLEAN DEFAULT true;

-- 6. Ensure RLS on public.registrations allows organizers to view ALL registrations for their events
DROP POLICY IF EXISTS "clubs can view registrations for their events" ON public.registrations;
CREATE POLICY "clubs can view registrations for their events"
  ON public.registrations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = registrations.event_id
        AND (
          -- Direct ownership: event's club_id matches user's auth id
          e.club_id = auth.uid()
          -- Direct ownership: user owns the club profile
          OR EXISTS (
            SELECT 1 FROM public.club_profiles cp
            WHERE cp.profile_id = e.club_id
              AND cp.profile_id = auth.uid()
          )
          -- Club membership permissions
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.view')
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'payments.view')
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'reports.view')
          -- Platform admin
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "clubs can update registrations for their events" ON public.registrations;
CREATE POLICY "clubs can update registrations for their events"
  ON public.registrations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = registrations.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_profiles cp
            WHERE cp.profile_id = e.club_id
              AND cp.profile_id = auth.uid()
          )
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.manage')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = registrations.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_profiles cp
            WHERE cp.profile_id = e.club_id
              AND cp.profile_id = auth.uid()
          )
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.manage')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );

-- 7. Ensure Realtime publication includes registrations and storage.objects safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'registrations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.registrations;
  END IF;
END;
$$;
