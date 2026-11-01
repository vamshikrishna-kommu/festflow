-- ══════════════════════════════════════════════════════════════════════════════
-- FESTFLOW DATABASE MIGRATION 034: CERTIFICATES & ACHIEVEMENTS ECOSYSTEM
-- ══════════════════════════════════════════════════════════════════════════════
-- Phase 4: Automated Certificate Generation, Public Verification, Club Studio,
-- and Student Achievement Badges
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Create certificate_templates Table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.certificate_templates (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id                     UUID NOT NULL REFERENCES public.club_profiles(profile_id) ON DELETE CASCADE,
  name                        TEXT NOT NULL,
  description                 TEXT,
  layout                      TEXT NOT NULL DEFAULT 'landscape' CHECK (layout IN ('landscape', 'portrait')),
  theme                       TEXT NOT NULL DEFAULT 'obsidian_gold' CHECK (theme IN ('obsidian_gold', 'cyan_cobalt', 'royal_violet', 'radiant_magenta', 'minimal_ivory')),
  title_text                  TEXT NOT NULL DEFAULT 'CERTIFICATE OF PARTICIPATION',
  subtitle_text               TEXT DEFAULT 'This is proudly presented to',
  body_template               TEXT DEFAULT 'for outstanding participation and successful completion of {event_title} organized by {club_name} on {event_date}.',
  signatory_1_name            TEXT,
  signatory_1_role            TEXT,
  signatory_1_signature_url    TEXT,
  signatory_2_name            TEXT,
  signatory_2_role            TEXT,
  signatory_2_signature_url    TEXT,
  club_logo_url               TEXT,
  border_style                TEXT DEFAULT 'modern_double' CHECK (border_style IN ('modern_double', 'classic_gold', 'tech_neon', 'minimal_sleek')),
  is_default                  BOOLEAN NOT NULL DEFAULT false,
  is_archived                 BOOLEAN NOT NULL DEFAULT false,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_certificate_templates_updated_at ON public.certificate_templates;
CREATE TRIGGER trg_certificate_templates_updated_at
  BEFORE UPDATE ON public.certificate_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cert_templates_club_id ON public.certificate_templates(club_id);
CREATE INDEX IF NOT EXISTS idx_cert_templates_active ON public.certificate_templates(club_id, is_archived);

-- RLS
ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organizers can view own club templates" ON public.certificate_templates;
CREATE POLICY "Organizers can view own club templates"
  ON public.certificate_templates
  FOR SELECT
  TO authenticated
  USING (
    club_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = certificate_templates.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
    ) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin')
  );

DROP POLICY IF EXISTS "Organizers can insert own club templates" ON public.certificate_templates;
CREATE POLICY "Organizers can insert own club templates"
  ON public.certificate_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    club_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = certificate_templates.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('leader', 'admin', 'coordinator')
    )
  );

DROP POLICY IF EXISTS "Organizers can update own club templates" ON public.certificate_templates;
CREATE POLICY "Organizers can update own club templates"
  ON public.certificate_templates
  FOR UPDATE
  TO authenticated
  USING (
    club_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = certificate_templates.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('leader', 'admin', 'coordinator')
    )
  )
  WITH CHECK (
    club_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = certificate_templates.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('leader', 'admin', 'coordinator')
    )
  );

DROP POLICY IF EXISTS "Organizers can delete own club templates" ON public.certificate_templates;
CREATE POLICY "Organizers can delete own club templates"
  ON public.certificate_templates
  FOR DELETE
  TO authenticated
  USING (
    club_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = certificate_templates.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role = 'leader'
    )
  );


-- ── 2. Create event_certificates Table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_certificates (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_number          TEXT NOT NULL UNIQUE,
  verification_token          TEXT NOT NULL UNIQUE,
  event_id                    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  club_id                     UUID NOT NULL REFERENCES public.club_profiles(profile_id) ON DELETE CASCADE,
  student_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  registration_id             UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
  template_id                 UUID REFERENCES public.certificate_templates(id) ON DELETE SET NULL,
  category                    TEXT NOT NULL CHECK (category IN ('participation', 'completion', 'winner', 'runner_up', 'finalist', 'special_recognition', 'merit')),
  title                       TEXT NOT NULL,
  recipient_name              TEXT NOT NULL,
  recipient_college           TEXT,
  recipient_email             TEXT,
  event_title                 TEXT NOT NULL,
  club_name                   TEXT NOT NULL,
  issue_date                  DATE NOT NULL DEFAULT CURRENT_DATE,
  status                      TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'revoked', 'reissued')),
  revoked_at                  TIMESTAMPTZ,
  revoked_by                  UUID REFERENCES public.profiles(id),
  revocation_reason           TEXT,
  reissued_certificate_id     UUID REFERENCES public.event_certificates(id),
  reissued_at                 TIMESTAMPTZ,
  qr_code_url                 TEXT,
  pdf_storage_path            TEXT,
  metadata                    JSONB DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Duplicate Prevention Invariant: Exactly one certificate per student per event per category
  CONSTRAINT uq_event_student_category UNIQUE (event_id, student_id, category)
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_event_certificates_updated_at ON public.event_certificates;
CREATE TRIGGER trg_event_certificates_updated_at
  BEFORE UPDATE ON public.event_certificates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_event_certs_student_id ON public.event_certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_event_certs_event_id ON public.event_certificates(event_id);
CREATE INDEX IF NOT EXISTS idx_event_certs_club_id ON public.event_certificates(club_id);
CREATE INDEX IF NOT EXISTS idx_event_certs_token ON public.event_certificates(verification_token);
CREATE INDEX IF NOT EXISTS idx_event_certs_number ON public.event_certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_event_certs_status ON public.event_certificates(status);

-- RLS
ALTER TABLE public.event_certificates ENABLE ROW LEVEL SECURITY;

-- 2.1 Public Verification (Anyone can inspect by verification_token or certificate_number)
DROP POLICY IF EXISTS "Public can verify valid certificates" ON public.event_certificates;
CREATE POLICY "Public can verify valid certificates"
  ON public.event_certificates
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 2.2 Students can view their own certificates
DROP POLICY IF EXISTS "Students can view own certificates" ON public.event_certificates;
CREATE POLICY "Students can view own certificates"
  ON public.event_certificates
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin')
  );

-- 2.3 Club organizers can insert certificates for their events
DROP POLICY IF EXISTS "Organizers can issue certificates" ON public.event_certificates;
CREATE POLICY "Organizers can issue certificates"
  ON public.event_certificates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    club_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_certificates.event_id
        AND events.club_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = event_certificates.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('leader', 'admin', 'coordinator')
    )
  );

-- 2.4 Club organizers can update (revoke/reissue) certificates
DROP POLICY IF EXISTS "Organizers can update certificates" ON public.event_certificates;
CREATE POLICY "Organizers can update certificates"
  ON public.event_certificates
  FOR UPDATE
  TO authenticated
  USING (
    club_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_certificates.event_id
        AND events.club_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = event_certificates.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('leader', 'admin')
    )
  )
  WITH CHECK (
    club_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_certificates.event_id
        AND events.club_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = event_certificates.club_id
        AND club_members.user_id = auth.uid()
        AND club_members.status = 'active'
        AND club_members.role IN ('leader', 'admin')
    )
  );


-- ── 3. Create student_badges Table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_badges (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_key                   TEXT NOT NULL,
  title                       TEXT NOT NULL,
  description                 TEXT NOT NULL,
  icon_name                   TEXT NOT NULL,
  category                    TEXT NOT NULL CHECK (category IN ('attendance', 'awards', 'participation', 'mastery')),
  tier                        TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  earned_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_pinned                   BOOLEAN NOT NULL DEFAULT false,
  is_public                   BOOLEAN NOT NULL DEFAULT true,
  metadata                    JSONB DEFAULT '{}'::jsonb,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_student_badge UNIQUE (student_id, badge_key)
);

CREATE INDEX IF NOT EXISTS idx_student_badges_student ON public.student_badges(student_id);
CREATE INDEX IF NOT EXISTS idx_student_badges_key ON public.student_badges(badge_key);

ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view public student badges" ON public.student_badges;
CREATE POLICY "Public can view public student badges"
  ON public.student_badges
  FOR SELECT
  TO anon, authenticated
  USING (is_public = true OR student_id = auth.uid());

DROP POLICY IF EXISTS "Students can manage own badges" ON public.student_badges;
CREATE POLICY "Students can manage own badges"
  ON public.student_badges
  FOR ALL
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Service role and system can award badges" ON public.student_badges;
CREATE POLICY "Service role and system can award badges"
  ON public.student_badges
  FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());


-- ── 4. Storage Bucket Setup (Metadata Registration) ───────────────────────────
-- Ensures certificates storage bucket exists in Supabase Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificates', 'certificates', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Public can view certificates, authenticated organizers can upload
DROP POLICY IF EXISTS "Public can view certificates" ON storage.objects;
CREATE POLICY "Public can view certificates"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'certificates');

DROP POLICY IF EXISTS "Organizers can upload certificates" ON storage.objects;
CREATE POLICY "Organizers can upload certificates"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'certificates');

