-- ══════════════════════════════════════════════════════════════════════════════
-- FESTFLOW DATABASE MIGRATION 030: PHASE 1 STUDENT EXPERIENCE UPGRADE
-- ══════════════════════════════════════════════════════════════════════════════
-- Additive migration for:
-- 1. Student interest profile preferences on public.student_profiles
-- 2. Event Wishlists (saved events) table with user-scoped RLS
-- 3. Recently Viewed Events tracking table with user-scoped RLS
-- 4. Geolocation coordinates (latitude, longitude) on public.events for discovery map
-- 5. View counter on public.events
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Student Interests Column on student_profiles
ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS interests text[] DEFAULT '{}';

-- 2. Coordinates & View Count on events table for Discovery Map & Trending calculations
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS view_count int DEFAULT 0;

-- 3. Table: student_wishlists (Event Wishlist)
CREATE TABLE IF NOT EXISTS public.student_wishlists (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id    uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_student_wishlists_user_event UNIQUE (user_id, event_id)
);

-- Enable RLS on student_wishlists
ALTER TABLE public.student_wishlists ENABLE ROW LEVEL SECURITY;

-- Wishlist RLS Policies (Students own their wishlist)
DROP POLICY IF EXISTS "students can view own wishlist" ON public.student_wishlists;
CREATE POLICY "students can view own wishlist"
  ON public.student_wishlists FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "students can add to own wishlist" ON public.student_wishlists;
CREATE POLICY "students can add to own wishlist"
  ON public.student_wishlists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "students can remove from own wishlist" ON public.student_wishlists;
CREATE POLICY "students can remove from own wishlist"
  ON public.student_wishlists FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_student_wishlists_user_id ON public.student_wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_student_wishlists_event_id ON public.student_wishlists(event_id);

-- 4. Table: recently_viewed_events
CREATE TABLE IF NOT EXISTS public.recently_viewed_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id    uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  viewed_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_recently_viewed_user_event UNIQUE (user_id, event_id)
);

-- Enable RLS on recently_viewed_events
ALTER TABLE public.recently_viewed_events ENABLE ROW LEVEL SECURITY;

-- Recently Viewed RLS Policies
DROP POLICY IF EXISTS "students can view own recent history" ON public.recently_viewed_events;
CREATE POLICY "students can view own recent history"
  ON public.recently_viewed_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "students can insert own recent history" ON public.recently_viewed_events;
CREATE POLICY "students can insert own recent history"
  ON public.recently_viewed_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "students can update own recent history" ON public.recently_viewed_events;
CREATE POLICY "students can update own recent history"
  ON public.recently_viewed_events FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "students can clear own recent history" ON public.recently_viewed_events;
CREATE POLICY "students can clear own recent history"
  ON public.recently_viewed_events FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_recently_viewed_user_viewed ON public.recently_viewed_events(user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_recently_viewed_event_id ON public.recently_viewed_events(event_id);

