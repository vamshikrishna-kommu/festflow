-- ══════════════════════════════════════════════════════════════════════════════
-- FESTFLOW DATABASE MIGRATION 035: PHASE 5 SOCIAL & CAMPUS COMMUNITY
-- ══════════════════════════════════════════════════════════════════════════════
-- Additive migration for:
-- 1. Student Profile Social Extensions (bio, course, academic_year, skills, visibility)
-- 2. Table: club_followers (Club following system)
-- 3. Table: club_announcements (Club official broadcasts & member updates)
-- 4. Table: event_discussions (Threaded Q&A and event discussions)
-- 5. Table: teammate_profiles & teammate_requests (Matchmaking & Squad Discovery)
-- 6. Table: conversations & messages (1-to-1 Private Direct Messaging)
-- 7. Table: user_blocks & community_reports (Community safety, blocking, & abuse reporting)
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Student Profiles Social Extensions ───────────────────────────────────
ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS course text,
  ADD COLUMN IF NOT EXISTS academic_year text,
  ADD COLUMN IF NOT EXISTS skills text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_categories text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'public' CHECK (visibility IN ('public', 'campus_only', 'private')),
  ADD COLUMN IF NOT EXISTS hide_certificates boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_events boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_skills boolean DEFAULT false;

-- ─── 2. Table: club_followers ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_followers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  club_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_club_followers UNIQUE (student_id, club_id)
);

CREATE INDEX IF NOT EXISTS idx_club_followers_club_id    ON public.club_followers(club_id);
CREATE INDEX IF NOT EXISTS idx_club_followers_student_id ON public.club_followers(student_id);

ALTER TABLE public.club_followers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone authenticated can read club followers" ON public.club_followers;
CREATE POLICY "anyone authenticated can read club followers"
  ON public.club_followers FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "students can follow clubs" ON public.club_followers;
CREATE POLICY "students can follow clubs"
  ON public.club_followers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "students can unfollow clubs" ON public.club_followers;
CREATE POLICY "students can unfollow clubs"
  ON public.club_followers FOR DELETE
  TO authenticated
  USING (auth.uid() = student_id);

-- ─── 3. Table: club_announcements ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_announcements (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  title           text        NOT NULL,
  content         text        NOT NULL,
  image_url       text,
  is_pinned       boolean     DEFAULT false,
  is_members_only boolean     DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_announcements_club_id    ON public.club_announcements(club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_announcements_is_pinned  ON public.club_announcements(is_pinned);

ALTER TABLE public.club_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view public club announcements" ON public.club_announcements;
CREATE POLICY "view public club announcements"
  ON public.club_announcements FOR SELECT
  TO authenticated
  USING (
    is_members_only = false
    OR club_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = public.club_announcements.club_id
        AND user_id = auth.uid()
        AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "club leads can create announcements" ON public.club_announcements;
CREATE POLICY "club leads can create announcements"
  ON public.club_announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    club_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = public.club_announcements.club_id
        AND user_id = auth.uid()
        AND status = 'active'
        AND role IN ('admin', 'lead', 'coordinator')
    )
  );

DROP POLICY IF EXISTS "club leads can update announcements" ON public.club_announcements;
CREATE POLICY "club leads can update announcements"
  ON public.club_announcements FOR UPDATE
  TO authenticated
  USING (
    club_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = public.club_announcements.club_id
        AND user_id = auth.uid()
        AND status = 'active'
        AND role IN ('admin', 'lead', 'coordinator')
    )
  );

DROP POLICY IF EXISTS "club leads can delete announcements" ON public.club_announcements;
CREATE POLICY "club leads can delete announcements"
  ON public.club_announcements FOR DELETE
  TO authenticated
  USING (
    club_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = public.club_announcements.club_id
        AND user_id = auth.uid()
        AND status = 'active'
        AND role IN ('admin', 'lead')
    )
  );

-- ─── 4. Table: event_discussions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_discussions (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id               uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id             uuid        REFERENCES public.event_discussions(id) ON DELETE CASCADE,
  content               text        NOT NULL,
  is_organizer_response boolean     DEFAULT false,
  is_pinned             boolean     DEFAULT false,
  is_hidden             boolean     DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_discussions_event_id  ON public.event_discussions(event_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_event_discussions_parent_id ON public.event_discussions(parent_id);

ALTER TABLE public.event_discussions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view event discussions" ON public.event_discussions;
CREATE POLICY "view event discussions"
  ON public.event_discussions FOR SELECT
  TO authenticated
  USING (
    is_hidden = false
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.events
      WHERE id = public.event_discussions.event_id AND club_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "post event comments" ON public.event_discussions;
CREATE POLICY "post event comments"
  ON public.event_discussions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "edit own comments" ON public.event_discussions;
CREATE POLICY "edit own comments"
  ON public.event_discussions FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.events
      WHERE id = public.event_discussions.event_id AND club_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete own comments or organizer delete" ON public.event_discussions;
CREATE POLICY "delete own comments or organizer delete"
  ON public.event_discussions FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.events
      WHERE id = public.event_discussions.event_id AND club_id = auth.uid()
    )
  );

-- ─── 5. Tables: teammate_profiles & teammate_requests ─────────────────────────
CREATE TABLE IF NOT EXISTS public.teammate_profiles (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  headline              text,
  bio                   text,
  skills                text[]      DEFAULT '{}',
  preferred_categories  text[]      DEFAULT '{}',
  looking_for           text,
  availability          text        DEFAULT 'actively_looking' CHECK (availability IN ('actively_looking', 'open_to_offers', 'unavailable')),
  is_opted_in           boolean     DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teammate_profiles_opted_in ON public.teammate_profiles(is_opted_in, availability);

ALTER TABLE public.teammate_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view opted in teammate profiles" ON public.teammate_profiles;
CREATE POLICY "view opted in teammate profiles"
  ON public.teammate_profiles FOR SELECT
  TO authenticated
  USING (is_opted_in = true OR student_id = auth.uid());

DROP POLICY IF EXISTS "manage own teammate profile" ON public.teammate_profiles;
CREATE POLICY "manage own teammate profile"
  ON public.teammate_profiles FOR ALL
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.teammate_requests (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id    uuid        REFERENCES public.events(id) ON DELETE SET NULL,
  message     text        NOT NULL,
  status      text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_no_self_requests CHECK (sender_id != receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_teammate_requests_participants ON public.teammate_requests(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_teammate_requests_receiver     ON public.teammate_requests(receiver_id, status);

ALTER TABLE public.teammate_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participants view teammate requests" ON public.teammate_requests;
CREATE POLICY "participants view teammate requests"
  ON public.teammate_requests FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "senders can create teammate requests" ON public.teammate_requests;
CREATE POLICY "senders can create teammate requests"
  ON public.teammate_requests FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "participants can update requests" ON public.teammate_requests;
CREATE POLICY "participants can update requests"
  ON public.teammate_requests FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid())
  WITH CHECK (sender_id = auth.uid() OR receiver_id = auth.uid());

-- ─── 6. Tables: conversations & messages (1-to-1 Messaging) ──────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_one     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_two     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message_at     timestamptz NOT NULL DEFAULT now(),
  last_message_text   text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_conversations_participants UNIQUE (participant_one, participant_two),
  CONSTRAINT chk_no_self_conversation CHECK (participant_one != participant_two)
);

CREATE INDEX IF NOT EXISTS idx_conversations_p1 ON public.conversations(participant_one, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_p2 ON public.conversations(participant_two, last_message_at DESC);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participants view conversations" ON public.conversations;
CREATE POLICY "participants view conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (participant_one = auth.uid() OR participant_two = auth.uid());

DROP POLICY IF EXISTS "participants create conversations" ON public.conversations;
CREATE POLICY "participants create conversations"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (participant_one = auth.uid() OR participant_two = auth.uid());

DROP POLICY IF EXISTS "participants update conversations" ON public.conversations;
CREATE POLICY "participants update conversations"
  ON public.conversations FOR UPDATE
  TO authenticated
  USING (participant_one = auth.uid() OR participant_two = auth.uid());

CREATE TABLE IF NOT EXISTS public.messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content         text        NOT NULL,
  is_read         boolean     DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages(conversation_id, created_at ASC);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversation participants view messages" ON public.messages;
CREATE POLICY "conversation participants view messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = public.messages.conversation_id
        AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
    )
  );

DROP POLICY IF EXISTS "conversation participants send messages" ON public.messages;
CREATE POLICY "conversation participants send messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = public.messages.conversation_id
        AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
    )
  );

DROP POLICY IF EXISTS "recipients mark messages read" ON public.messages;
CREATE POLICY "recipients mark messages read"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = public.messages.conversation_id
        AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
    )
  );

-- ─── 7. Tables: user_blocks & community_reports ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_blocks UNIQUE (blocker_id, blocked_id),
  CONSTRAINT chk_no_self_block CHECK (blocker_id != blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON public.user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON public.user_blocks(blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blockers view their blocks" ON public.user_blocks;
CREATE POLICY "blockers view their blocks"
  ON public.user_blocks FOR SELECT
  TO authenticated
  USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS "blockers create blocks" ON public.user_blocks;
CREATE POLICY "blockers create blocks"
  ON public.user_blocks FOR INSERT
  TO authenticated
  WITH CHECK (blocker_id = auth.uid());

DROP POLICY IF EXISTS "blockers delete blocks" ON public.user_blocks;
CREATE POLICY "blockers delete blocks"
  ON public.user_blocks FOR DELETE
  TO authenticated
  USING (blocker_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.community_reports (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type     text        NOT NULL CHECK (target_type IN ('profile', 'comment', 'message', 'announcement', 'teammate_request')),
  target_id       text        NOT NULL,
  reason          text        NOT NULL,
  details         text,
  status          text        DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
  action_taken    text,
  moderator_notes text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_reports_reporter ON public.community_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_community_reports_status   ON public.community_reports(status);

ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reporters can view own reports" ON public.community_reports;
CREATE POLICY "reporters can view own reports"
  ON public.community_reports FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS "authenticated users can submit reports" ON public.community_reports;
CREATE POLICY "authenticated users can submit reports"
  ON public.community_reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

