-- ══════════════════════════════════════════════════════════════════════════════
-- FESTFLOW DATABASE MIGRATION 032: PHASE 3 ADVANCED DIGITAL TICKETING & PAYMENTS
-- ══════════════════════════════════════════════════════════════════════════════
-- Additive, non-breaking migration for:
-- 1. Table: event_ticket_tiers (Configurable ticket tiers, early-bird pricing, VIP perks)
-- 2. Table: payment_refund_requests (Formal manual refund request & review lifecycle)
-- 3. Columns: events.has_multiple_tiers, registrations.ticket_tier_id,
--    registrations.ticket_tier_name, registrations.unit_price,
--    payment_submissions.is_refunded, payment_submissions.refunded_amount
-- 4. RLS policies with strict ownership and security checks
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Columns Additions ────────────────────────────────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS has_multiple_tiers BOOLEAN DEFAULT false;

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS ticket_tier_id UUID,
  ADD COLUMN IF NOT EXISTS ticket_tier_name TEXT,
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2);

ALTER TABLE public.payment_submissions
  ADD COLUMN IF NOT EXISTS is_refunded BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(10,2) DEFAULT 0;

-- ─── 2. Table: event_ticket_tiers ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_ticket_tiers (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID          NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name                TEXT          NOT NULL,
  tier_type           TEXT          NOT NULL DEFAULT 'standard' CHECK (tier_type IN ('standard', 'early_bird', 'vip', 'student', 'group', 'free')),
  description         TEXT,
  price               NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  original_price      NUMERIC(10,2),
  capacity            INT           NOT NULL DEFAULT 100 CHECK (capacity >= 1),
  sold_count          INT           NOT NULL DEFAULT 0 CHECK (sold_count >= 0),
  available_from      TIMESTAMPTZ,
  available_until     TIMESTAMPTZ,
  perks               JSONB         DEFAULT '[]'::jsonb,
  is_active           BOOLEAN       DEFAULT true,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_ticket_tiers_event_id ON public.event_ticket_tiers(event_id);
CREATE INDEX IF NOT EXISTS idx_event_ticket_tiers_tier_type ON public.event_ticket_tiers(tier_type);
CREATE INDEX IF NOT EXISTS idx_event_ticket_tiers_active ON public.event_ticket_tiers(event_id, is_active);

-- Foreign key linking for registrations.ticket_tier_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_registrations_ticket_tier'
  ) THEN
    ALTER TABLE public.registrations
      ADD CONSTRAINT fk_registrations_ticket_tier
      FOREIGN KEY (ticket_tier_id) REFERENCES public.event_ticket_tiers(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.event_ticket_tiers ENABLE ROW LEVEL SECURITY;

-- Anyone can view active tiers for published events; organizers can view all tiers for their events
DROP POLICY IF EXISTS "Public can view active event ticket tiers" ON public.event_ticket_tiers;
CREATE POLICY "Public can view active event ticket tiers"
  ON public.event_ticket_tiers FOR SELECT
  TO authenticated, anon
  USING (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_ticket_tiers.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = e.club_id
              AND cm.user_id = auth.uid()
              AND cm.status = 'active'
          )
        )
    )
  );

DROP POLICY IF EXISTS "Organizers can insert event ticket tiers" ON public.event_ticket_tiers;
CREATE POLICY "Organizers can insert event ticket tiers"
  ON public.event_ticket_tiers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_ticket_tiers.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = e.club_id
              AND cm.user_id = auth.uid()
              AND cm.role IN ('owner', 'admin', 'event_manager')
              AND cm.status = 'active'
          )
        )
    )
  );

DROP POLICY IF EXISTS "Organizers can update event ticket tiers" ON public.event_ticket_tiers;
CREATE POLICY "Organizers can update event ticket tiers"
  ON public.event_ticket_tiers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_ticket_tiers.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = e.club_id
              AND cm.user_id = auth.uid()
              AND cm.role IN ('owner', 'admin', 'event_manager')
              AND cm.status = 'active'
          )
        )
    )
  );

DROP POLICY IF EXISTS "Organizers can delete event ticket tiers" ON public.event_ticket_tiers;
CREATE POLICY "Organizers can delete event ticket tiers"
  ON public.event_ticket_tiers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_ticket_tiers.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = e.club_id
              AND cm.user_id = auth.uid()
              AND cm.role IN ('owner', 'admin', 'event_manager')
              AND cm.status = 'active'
          )
        )
    )
  );

-- ─── 3. Table: payment_refund_requests ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_refund_requests (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id       UUID          NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  payment_submission_id UUID          REFERENCES public.payment_submissions(id) ON DELETE CASCADE,
  event_id              UUID          NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  student_id            UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount                NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  reason                TEXT          NOT NULL,
  status                TEXT          NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'under_review', 'approved', 'rejected', 'refunded')),
  refund_method         TEXT          DEFAULT 'upi',
  student_upi_id        TEXT,
  reviewer_id           UUID          REFERENCES public.profiles(id),
  review_notes          TEXT,
  reviewed_at           TIMESTAMPTZ,
  refund_transaction_ref TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_refund_requests_reg_id ON public.payment_refund_requests(registration_id);
CREATE INDEX IF NOT EXISTS idx_payment_refund_requests_event_id ON public.payment_refund_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_payment_refund_requests_student_id ON public.payment_refund_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_payment_refund_requests_status ON public.payment_refund_requests(status);

ALTER TABLE public.payment_refund_requests ENABLE ROW LEVEL SECURITY;

-- Students can view their own refund requests
DROP POLICY IF EXISTS "Students can view own refund requests" ON public.payment_refund_requests;
CREATE POLICY "Students can view own refund requests"
  ON public.payment_refund_requests FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = payment_refund_requests.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = e.club_id
              AND cm.user_id = auth.uid()
              AND cm.status = 'active'
          )
        )
    )
  );

-- Students can insert refund request for their own registration
DROP POLICY IF EXISTS "Students can insert own refund requests" ON public.payment_refund_requests;
CREATE POLICY "Students can insert own refund requests"
  ON public.payment_refund_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.registrations r
      WHERE r.id = payment_refund_requests.registration_id
        AND r.student_id = auth.uid()
    )
  );

-- Organizers can update refund requests for their events (approve, reject, mark refunded)
DROP POLICY IF EXISTS "Organizers can update refund requests" ON public.payment_refund_requests;
CREATE POLICY "Organizers can update refund requests"
  ON public.payment_refund_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = payment_refund_requests.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = e.club_id
              AND cm.user_id = auth.uid()
              AND cm.role IN ('owner', 'admin', 'payment_reviewer')
              AND cm.status = 'active'
          )
        )
    )
  );
