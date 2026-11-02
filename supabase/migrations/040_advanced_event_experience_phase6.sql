-- =============================================================================
-- FESTFLOW DATABASE MIGRATION 040: PHASE 6 ADVANCED EVENT EXPERIENCE
-- =============================================================================
-- Additive, non-breaking schema extensions for:
-- 1. Table: event_ticket_tiers (Extensions: max_per_order, eligibility, sort_order)
-- 2. Table: event_schedules (Chronological agenda, tracks, stages, live indicator)
-- 3. Table: event_speakers (Guest speakers, judges, mentors, bios, socials)
-- 4. Table: event_gallery_images (Curated photo galleries, tags, full-screen previews)
-- 5. Table: event_announcements (Live updates, pinned alerts, venue changes)
-- 6. Table: event_leaderboard_entries (Scores, ranks, submission statuses)
-- 7. Table: event_addons (Merchandise, kits, food vouchers, stock limits)
-- 8. Columns on events: meeting_platform, meeting_url, joining_instructions,
--    access_window_minutes, leaderboard_enabled, leaderboard_title,
--    leaderboard_visibility, prizes, faqs, gallery_enabled, announcements_enabled
-- 9. RPC: get_event_meeting_details (Secure attendee-only virtual join access)
-- 10. RPC: register_for_event (Tier-aware atomic seat reservation & pricing)
-- =============================================================================

-- ── 1. Columns on public.events ───────────────────────────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS meeting_platform TEXT DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS meeting_url TEXT,
  ADD COLUMN IF NOT EXISTS joining_instructions TEXT,
  ADD COLUMN IF NOT EXISTS access_window_minutes INT DEFAULT 30,
  ADD COLUMN IF NOT EXISTS leaderboard_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS leaderboard_title TEXT DEFAULT 'Event Standings',
  ADD COLUMN IF NOT EXISTS leaderboard_visibility TEXT DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS prizes JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS faqs JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS gallery_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS announcements_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS addons_enabled BOOLEAN DEFAULT false;

-- ── 2. Table: event_ticket_tiers Extensions ───────────────────────────────────
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
  max_per_order       INT           DEFAULT 1 CHECK (max_per_order >= 1),
  eligibility         TEXT,
  sort_order          INT           DEFAULT 0,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE public.event_ticket_tiers
  ADD COLUMN IF NOT EXISTS max_per_order INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS eligibility TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_event_ticket_tiers_event_id ON public.event_ticket_tiers(event_id);
CREATE INDEX IF NOT EXISTS idx_event_ticket_tiers_active ON public.event_ticket_tiers(event_id, is_active);

ALTER TABLE public.event_ticket_tiers ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Organizers can manage event ticket tiers" ON public.event_ticket_tiers;
CREATE POLICY "Organizers can manage event ticket tiers"
  ON public.event_ticket_tiers FOR ALL
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
              AND cm.status = 'active'
          )
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin')
        )
    )
  )
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
              AND cm.status = 'active'
          )
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin')
        )
    )
  );

-- ── 3. Table: event_schedules ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_schedules (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  day_number      INT         NOT NULL DEFAULT 1,
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ,
  title           TEXT        NOT NULL,
  description     TEXT,
  speaker_name    TEXT,
  venue_stage     TEXT,
  category        TEXT        NOT NULL DEFAULT 'general' CHECK (category IN ('keynote', 'workshop', 'competition', 'networking', 'panel', 'break', 'ceremony', 'general')),
  sort_order      INT         NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_schedules_event_time ON public.event_schedules(event_id, start_time ASC);

ALTER TABLE public.event_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view event schedules" ON public.event_schedules;
CREATE POLICY "Public can view event schedules"
  ON public.event_schedules FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_schedules.event_id
        AND (e.status = 'published' OR e.club_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Organizers can manage event schedules" ON public.event_schedules;
CREATE POLICY "Organizers can manage event schedules"
  ON public.event_schedules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_schedules.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = e.club_id
              AND cm.user_id = auth.uid()
              AND cm.status = 'active'
          )
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_schedules.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = e.club_id
              AND cm.user_id = auth.uid()
              AND cm.status = 'active'
          )
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin')
        )
    )
  );

-- ── 4. Table: event_speakers ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_speakers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  designation     TEXT,
  organization    TEXT,
  bio             TEXT,
  avatar_url      TEXT,
  role            TEXT        NOT NULL DEFAULT 'speaker' CHECK (role IN ('keynote_speaker', 'speaker', 'judge', 'mentor', 'host', 'panelist')),
  social_links    JSONB       DEFAULT '{}'::jsonb,
  sort_order      INT         NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_speakers_event ON public.event_speakers(event_id, sort_order ASC);

ALTER TABLE public.event_speakers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view event speakers" ON public.event_speakers;
CREATE POLICY "Public can view event speakers"
  ON public.event_speakers FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_speakers.event_id
        AND (e.status = 'published' OR e.club_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Organizers can manage event speakers" ON public.event_speakers;
CREATE POLICY "Organizers can manage event speakers"
  ON public.event_speakers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_speakers.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = e.club_id
              AND cm.user_id = auth.uid()
              AND cm.status = 'active'
          )
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_speakers.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = e.club_id
              AND cm.user_id = auth.uid()
              AND cm.status = 'active'
          )
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin')
        )
    )
  );

-- ── 5. Table: event_gallery_images ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_gallery_images (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  image_url       TEXT        NOT NULL,
  caption         TEXT,
  tags            TEXT[]      DEFAULT '{}',
  sort_order      INT         NOT NULL DEFAULT 0,
  uploaded_by     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_gallery_event ON public.event_gallery_images(event_id, created_at DESC);

ALTER TABLE public.event_gallery_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view event gallery images" ON public.event_gallery_images;
CREATE POLICY "Public can view event gallery images"
  ON public.event_gallery_images FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_gallery_images.event_id
        AND (e.status = 'published' OR e.club_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Organizers can manage event gallery images" ON public.event_gallery_images;
CREATE POLICY "Organizers can manage event gallery images"
  ON public.event_gallery_images FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_gallery_images.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = e.club_id
              AND cm.user_id = auth.uid()
              AND cm.status = 'active'
          )
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_gallery_images.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = e.club_id
              AND cm.user_id = auth.uid()
              AND cm.status = 'active'
          )
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin')
        )
    )
  );

-- ── 6. Table: event_announcements ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_announcements (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  club_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id       UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  title           TEXT        NOT NULL,
  content         TEXT        NOT NULL,
  priority        TEXT        NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent', 'schedule_change', 'venue_change', 'results')),
  is_pinned       BOOLEAN     DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_announcements_event ON public.event_announcements(event_id, is_pinned DESC, created_at DESC);

ALTER TABLE public.event_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view event announcements" ON public.event_announcements;
CREATE POLICY "Public can view event announcements"
  ON public.event_announcements FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_announcements.event_id
        AND (e.status = 'published' OR e.club_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Organizers can manage event announcements" ON public.event_announcements;
CREATE POLICY "Organizers can manage event announcements"
  ON public.event_announcements FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_announcements.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = e.club_id
              AND cm.user_id = auth.uid()
              AND cm.status = 'active'
          )
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_announcements.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = e.club_id
              AND cm.user_id = auth.uid()
              AND cm.status = 'active'
          )
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin')
        )
    )
  );

-- ── 7. Table: event_leaderboard_entries ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_leaderboard_entries (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID          NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  participant_id      UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  team_id             UUID          REFERENCES public.teams(id) ON DELETE SET NULL,
  participant_name    TEXT          NOT NULL,
  team_name           TEXT,
  score               NUMERIC(10,2) NOT NULL DEFAULT 0,
  rank                INT,
  submission_status   TEXT          DEFAULT 'submitted' CHECK (submission_status IN ('submitted', 'under_review', 'evaluated', 'finalist', 'disqualified')),
  notes               TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_leaderboard_rank ON public.event_leaderboard_entries(event_id, rank ASC, score DESC);

ALTER TABLE public.event_leaderboard_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View event leaderboard entries" ON public.event_leaderboard_entries;
CREATE POLICY "View event leaderboard entries"
  ON public.event_leaderboard_entries FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_leaderboard_entries.event_id
        AND (
          e.leaderboard_visibility = 'public'
          OR (
            e.leaderboard_visibility = 'attendees_only'
            AND auth.uid() IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.registrations r
              WHERE r.event_id = e.id AND r.student_id = auth.uid() AND r.status = 'confirmed'
            )
          )
          OR e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = e.club_id AND cm.user_id = auth.uid() AND cm.status = 'active'
          )
        )
    )
  );

DROP POLICY IF EXISTS "Organizers can manage leaderboard entries" ON public.event_leaderboard_entries;
CREATE POLICY "Organizers can manage leaderboard entries"
  ON public.event_leaderboard_entries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_leaderboard_entries.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = e.club_id AND cm.user_id = auth.uid() AND cm.status = 'active'
          )
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_leaderboard_entries.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = e.club_id AND cm.user_id = auth.uid() AND cm.status = 'active'
          )
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin')
        )
    )
  );

-- ── 8. Table: event_addons ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_addons (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID          NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name            TEXT          NOT NULL,
  description     TEXT,
  image_url       TEXT,
  price           NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  stock_quantity  INT           NOT NULL DEFAULT 100 CHECK (stock_quantity >= 0),
  sold_quantity   INT           NOT NULL DEFAULT 0 CHECK (sold_quantity >= 0),
  is_active       BOOLEAN       DEFAULT true,
  max_per_user    INT           DEFAULT 2 CHECK (max_per_user >= 1),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_addons_event ON public.event_addons(event_id, is_active);

ALTER TABLE public.event_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active event addons" ON public.event_addons;
CREATE POLICY "Public can view active event addons"
  ON public.event_addons FOR SELECT
  TO authenticated, anon
  USING (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_addons.event_id AND e.club_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Organizers can manage event addons" ON public.event_addons;
CREATE POLICY "Organizers can manage event addons"
  ON public.event_addons FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_addons.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = e.club_id AND cm.user_id = auth.uid() AND cm.status = 'active'
          )
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_addons.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = e.club_id AND cm.user_id = auth.uid() AND cm.status = 'active'
          )
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin')
        )
    )
  );

-- ── 9. RPC: Secure Meeting Details Access for Virtual Events ──────────────────
CREATE OR REPLACE FUNCTION public.get_event_meeting_details(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_event RECORD;
  v_reg RECORD;
  v_now TIMESTAMPTZ := now();
  v_access_start TIMESTAMPTZ;
  v_is_organizer BOOLEAN := false;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'accessible', false,
      'error_code', 'UNAUTHENTICATED',
      'message', 'Please sign in to access session meeting credentials.'
    );
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('accessible', false, 'error_code', 'NOT_FOUND', 'message', 'Event not found.');
  END IF;

  -- Allow event organizers access at any time
  IF v_event.club_id = v_user_id OR EXISTS (
    SELECT 1 FROM public.club_members cm WHERE cm.club_id = v_event.club_id AND cm.user_id = v_user_id AND cm.status = 'active'
  ) OR EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND role = 'platform_admin') THEN
    v_is_organizer := true;
  END IF;

  IF NOT v_is_organizer THEN
    -- Check for confirmed registration
    SELECT * INTO v_reg FROM public.registrations
    WHERE event_id = p_event_id AND student_id = v_user_id AND status = 'confirmed';

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'accessible', false,
        'error_code', 'REGISTRATION_REQUIRED',
        'message', 'Meeting links are restricted to confirmed registered attendees.'
      );
    END IF;

    -- Check access window (e.g. 30 minutes before event start until event end)
    v_access_start := v_event.start_date - (COALESCE(v_event.access_window_minutes, 30) || ' minutes')::interval;
    IF v_now < v_access_start THEN
      RETURN jsonb_build_object(
        'accessible', false,
        'error_code', 'WINDOW_NOT_OPEN',
        'message', format('Meeting link unlocks %s minutes before session start.', COALESCE(v_event.access_window_minutes, 30)),
        'unlocks_at', v_access_start
      );
    END IF;

    IF v_event.end_date IS NOT NULL AND v_now > v_event.end_date THEN
      RETURN jsonb_build_object(
        'accessible', false,
        'error_code', 'EVENT_CONCLUDED',
        'message', 'This session has already concluded.'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'accessible', true,
    'platform', COALESCE(v_event.meeting_platform, 'virtual'),
    'meeting_url', v_event.meeting_url,
    'joining_instructions', v_event.joining_instructions,
    'is_organizer', v_is_organizer
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_meeting_details(UUID) TO authenticated;

