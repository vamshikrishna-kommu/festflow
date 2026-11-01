-- ══════════════════════════════════════════════════════════════════════════════
-- FESTFLOW DATABASE MIGRATION 031: PHASE 2 ADVANCED CLUB MANAGEMENT SYSTEM
-- ══════════════════════════════════════════════════════════════════════════════
-- Additive migration for:
-- 1. Event enhancements (cover_url, registration_start_date, page_layout, waitlist_enabled, is_unlisted)
-- 2. Registration waitlist & coupon enhancements (waitlist_offer_expires_at, coupon_id, discount_amount)
-- 3. Club profile branding extensions (cover_url, logo_url, category, social_links)
-- 4. Table: event_coupons (Event and club-specific discount codes)
-- 5. Table: event_assignments (Event-specific team delegations)
-- 6. Table: event_feedback (Attendee post-event ratings and reviews)
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Events Table Additions ───────────────────────────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS registration_start_date timestamptz,
  ADD COLUMN IF NOT EXISTS page_layout jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS waitlist_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_unlisted boolean DEFAULT false;

-- ─── 2. Club Profiles Branding Extensions ────────────────────────────────────
ALTER TABLE public.club_profiles
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}'::jsonb;

-- ─── 3. Table: event_coupons ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_coupons (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id            uuid          REFERENCES public.events(id) ON DELETE CASCADE,
  code                text          NOT NULL,
  discount_type       text          NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value      numeric       NOT NULL CHECK (discount_value > 0),
  min_purchase_amount numeric       DEFAULT 0,
  max_discount_amount numeric,
  max_uses            int           DEFAULT 100,
  used_count          int           DEFAULT 0,
  valid_from          timestamptz   DEFAULT now(),
  valid_until         timestamptz,
  is_active           boolean       DEFAULT true,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT uq_event_coupons_club_code UNIQUE (club_id, code)
);

CREATE INDEX IF NOT EXISTS idx_event_coupons_club_id  ON public.event_coupons(club_id);
CREATE INDEX IF NOT EXISTS idx_event_coupons_event_id ON public.event_coupons(event_id);
CREATE INDEX IF NOT EXISTS idx_event_coupons_code     ON public.event_coupons(upper(code));

ALTER TABLE public.event_coupons ENABLE ROW LEVEL SECURITY;

-- Organizers can manage their club's coupons
DROP POLICY IF EXISTS "organizers can view club coupons" ON public.event_coupons;
CREATE POLICY "organizers can view club coupons"
  ON public.event_coupons FOR SELECT
  TO authenticated
  USING (
    auth.uid() = club_id
    OR EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = event_coupons.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
    )
    OR (is_active = true) -- Allow attendees to validate coupon during checkout
  );

DROP POLICY IF EXISTS "organizers can insert club coupons" ON public.event_coupons;
CREATE POLICY "organizers can insert club coupons"
  ON public.event_coupons FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = club_id
    OR EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = event_coupons.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.role IN ('owner', 'admin', 'event_manager')
        AND club_members.status = 'active'
    )
  );

DROP POLICY IF EXISTS "organizers can update club coupons" ON public.event_coupons;
CREATE POLICY "organizers can update club coupons"
  ON public.event_coupons FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = club_id
    OR EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = event_coupons.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.role IN ('owner', 'admin', 'event_manager')
        AND club_members.status = 'active'
    )
  );

DROP POLICY IF EXISTS "organizers can delete club coupons" ON public.event_coupons;
CREATE POLICY "organizers can delete club coupons"
  ON public.event_coupons FOR DELETE
  TO authenticated
  USING (
    auth.uid() = club_id
    OR EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = event_coupons.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.role IN ('owner', 'admin')
        AND club_members.status = 'active'
    )
  );

-- ─── 4. Registrations Additions ───────────────────────────────────────────────
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS waitlist_offer_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES public.event_coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0;

-- ─── 5. Table: event_assignments (Team-Based Event Staff) ─────────────────────
CREATE TABLE IF NOT EXISTS public.event_assignments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  club_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('event_manager', 'registration_manager', 'finance_manager', 'checkin_staff', 'content_manager')),
  assigned_by uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_event_assignments_event_user_role UNIQUE (event_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_event_assignments_event_id ON public.event_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_event_assignments_user_id  ON public.event_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_event_assignments_club_id  ON public.event_assignments(club_id);

ALTER TABLE public.event_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "club staff can view event assignments" ON public.event_assignments;
CREATE POLICY "club staff can view event assignments"
  ON public.event_assignments FOR SELECT
  TO authenticated
  USING (
    auth.uid() = club_id
    OR auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = event_assignments.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
    )
  );

DROP POLICY IF EXISTS "club admins can manage event assignments" ON public.event_assignments;
CREATE POLICY "club admins can manage event assignments"
  ON public.event_assignments FOR ALL
  TO authenticated
  USING (
    auth.uid() = club_id
    OR EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = event_assignments.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.role IN ('owner', 'admin')
        AND club_members.status = 'active'
    )
  );

-- ─── 6. Table: event_feedback (Attendee Post-Event Ratings & Reviews) ─────────
CREATE TABLE IF NOT EXISTS public.event_feedback (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating        int         NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment       text,
  is_anonymous  boolean     DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_event_feedback_event_user UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_feedback_event_id ON public.event_feedback(event_id);
CREATE INDEX IF NOT EXISTS idx_event_feedback_user_id  ON public.event_feedback(user_id);

ALTER TABLE public.event_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can view public feedback on completed events" ON public.event_feedback;
CREATE POLICY "anyone can view public feedback on completed events"
  ON public.event_feedback FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "attendees can submit feedback" ON public.event_feedback;
CREATE POLICY "attendees can submit feedback"
  ON public.event_feedback FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.registrations
      WHERE registrations.event_id = event_feedback.event_id
        AND registrations.student_id = auth.uid()
        AND registrations.status = 'confirmed'
    )
  );

DROP POLICY IF EXISTS "attendees can update own feedback" ON public.event_feedback;
CREATE POLICY "attendees can update own feedback"
  ON public.event_feedback FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

