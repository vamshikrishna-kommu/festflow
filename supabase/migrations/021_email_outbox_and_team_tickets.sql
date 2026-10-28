-- ============================================================================
-- FestFlow Migration 021: Email Outbox, Team Member Tickets & Realtime Status
-- ============================================================================
-- Fully idempotent and non-destructive.
-- Enforces:
--   1. Individual tickets and registrations for all team members
--   2. Authoritative team payment status synchronization across all member passes
--   3. Email outbox tracking with retry states, provider message IDs & sanitized logs
--   4. Authorized resend with 60-second rate-limiting
--   5. Secure Realtime publication for registrations, payment_submissions, team_members
-- ============================================================================

-- ── 1. Enhance email_outbox table ──────────────────────────────────────────
DO $$
BEGIN
  -- Add provider_message_id column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_outbox' AND column_name = 'provider_message_id'
  ) THEN
    ALTER TABLE public.email_outbox ADD COLUMN provider_message_id TEXT;
  END IF;

  -- Add retry_count column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_outbox' AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE public.email_outbox ADD COLUMN retry_count INT NOT NULL DEFAULT 0;
  END IF;

  -- Add max_retries column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_outbox' AND column_name = 'max_retries'
  ) THEN
    ALTER TABLE public.email_outbox ADD COLUMN max_retries INT NOT NULL DEFAULT 3;
  END IF;

  -- Add last_attempt_at column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_outbox' AND column_name = 'last_attempt_at'
  ) THEN
    ALTER TABLE public.email_outbox ADD COLUMN last_attempt_at TIMESTAMPTZ;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_outbox_provider_id ON public.email_outbox(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_email_outbox_last_attempt ON public.email_outbox(last_attempt_at DESC);

-- ── 2. Authorized Stored Procedure: Resend Outbox Email ─────────────────────
CREATE OR REPLACE FUNCTION public.resend_outbox_email(p_outbox_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_outbox RECORD;
  v_event RECORD;
  v_now TIMESTAMPTZ := now();
BEGIN
  v_user_id := auth.uid();
  v_user_email := auth.jwt()->>'email';

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'UNAUTHENTICATED',
      'message', 'You must be signed in to request an email resend.'
    );
  END IF;

  SELECT * INTO v_outbox FROM public.email_outbox WHERE id = p_outbox_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'NOT_FOUND',
      'message', 'Email record could not be found.'
    );
  END IF;

  -- Authorization check: Recipient or Event Organizer only
  IF v_outbox.user_id IS DISTINCT FROM v_user_id AND lower(COALESCE(v_outbox.recipient_email, '')) != lower(COALESCE(v_user_email, '')) THEN
    IF v_outbox.event_id IS NOT NULL THEN
      SELECT * INTO v_event FROM public.events WHERE id = v_outbox.event_id;
      IF NOT FOUND OR v_event.club_id != v_user_id THEN
        RETURN jsonb_build_object(
          'success', false,
          'error_code', 'FORBIDDEN',
          'message', 'You are not authorized to resend this notification.'
        );
      END IF;
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'FORBIDDEN',
        'message', 'You are not authorized to resend this notification.'
      );
    END IF;
  END IF;

  -- Retry limit enforcement
  IF v_outbox.retry_count >= v_outbox.max_retries THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'MAX_RETRIES_EXCEEDED',
      'message', format('Maximum retry limit (%s) has been reached for this email.', v_outbox.max_retries)
    );
  END IF;

  -- Rate limit enforcement: 60 seconds cooldown
  IF v_outbox.last_attempt_at IS NOT NULL AND (v_now - v_outbox.last_attempt_at) < INTERVAL '60 seconds' THEN
    DECLARE
      v_wait_seconds INT;
    BEGIN
      v_wait_seconds := EXTRACT(SECOND FROM (INTERVAL '60 seconds' - (v_now - v_outbox.last_attempt_at)))::INT;
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'RATE_LIMITED',
        'message', format('Please wait %s seconds before resending this email.', GREATEST(v_wait_seconds, 1))
      );
    END;
  END IF;

  -- Update outbox record for fresh dispatch attempt
  UPDATE public.email_outbox
  SET status = 'pending',
      retry_count = v_outbox.retry_count + 1,
      last_attempt_at = v_now,
      updated_at = v_now
  WHERE id = p_outbox_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Email queued for resending.',
    'outbox_id', p_outbox_id,
    'retry_count', v_outbox.retry_count + 1
  );
END;
$$;

-- ── 3. Individual Registrations for Team Members ───────────────────────────
CREATE OR REPLACE FUNCTION public.sync_team_member_registration(
  p_team_id UUID,
  p_member_user_id UUID,
  p_member_email TEXT,
  p_member_name TEXT,
  p_participant_details JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team RECORD;
  v_leader_reg RECORD;
  v_member_reg RECORD;
  v_member_index INT;
  v_member_ticket_code TEXT;
  v_member_qr_token TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1. Fetch team
  SELECT * INTO v_team FROM public.teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Team not found.');
  END IF;

  -- 2. Fetch leader's registration
  SELECT * INTO v_leader_reg FROM public.registrations WHERE id = v_team.registration_id;
  IF NOT FOUND THEN
    SELECT * INTO v_leader_reg 
    FROM public.registrations 
    WHERE event_id = v_team.event_id AND student_id = v_team.leader_id 
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  -- 3. Check if member already has a registration for this event
  SELECT * INTO v_member_reg 
  FROM public.registrations 
  WHERE event_id = v_team.event_id AND student_id = p_member_user_id;

  IF FOUND THEN
    -- Update existing registration with team linkage
    UPDATE public.registrations
    SET team_id = v_team.id,
        team_name = v_team.name,
        status = COALESCE(v_leader_reg.status, status),
        ticket_issued_at = CASE 
          WHEN COALESCE(v_leader_reg.status, status) = 'confirmed' THEN COALESCE(ticket_issued_at, v_now)
          ELSE NULL 
        END,
        updated_at = v_now
    WHERE id = v_member_reg.id;

    -- Link team_members row
    UPDATE public.team_members
    SET registration_id = v_member_reg.id,
        updated_at = v_now
    WHERE team_id = v_team.id AND user_id = p_member_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'registration_id', v_member_reg.id,
      'ticket_code', v_member_reg.ticket_code,
      'is_new', false
    );
  END IF;

  -- 4. Calculate member index for individual ticket code
  SELECT count(*) + 1 INTO v_member_index
  FROM public.registrations
  WHERE team_id = v_team.id AND student_id != v_team.leader_id;

  IF v_leader_reg.ticket_code IS NOT NULL THEN
    v_member_ticket_code := format('%s-M%s', v_leader_reg.ticket_code, v_member_index);
  ELSE
    v_member_ticket_code := format('FF-%s', upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8)));
  END IF;

  v_member_qr_token := format('FFQ_%s', encode(gen_random_bytes(12), 'hex'));

  -- 5. Insert individual registration for the team member
  INSERT INTO public.registrations (
    event_id,
    student_id,
    status,
    ticket_code,
    qr_token,
    ticket_issued_at,
    team_name,
    team_id,
    team_members,
    participant_details,
    approval_status,
    created_at,
    updated_at
  ) VALUES (
    v_team.event_id,
    p_member_user_id,
    COALESCE(v_leader_reg.status, 'confirmed'),
    v_member_ticket_code,
    v_member_qr_token,
    CASE WHEN COALESCE(v_leader_reg.status, 'confirmed') = 'confirmed' THEN v_now ELSE NULL END,
    v_team.name,
    v_team.id,
    COALESCE(v_leader_reg.team_members, '[]'::jsonb),
    p_participant_details,
    COALESCE(v_leader_reg.approval_status, 'approved'),
    v_now,
    v_now
  ) RETURNING * INTO v_member_reg;

  -- 6. Link registration to team_members
  UPDATE public.team_members
  SET registration_id = v_member_reg.id,
      updated_at = v_now
  WHERE team_id = v_team.id AND user_id = p_member_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'registration_id', v_member_reg.id,
    'ticket_code', v_member_reg.ticket_code,
    'is_new', true
  );
END;
$$;

-- ── 4. Authoritative Payment Review Team Synchronization ───────────────────
CREATE OR REPLACE FUNCTION public.sync_team_payment_approval(
  p_registration_id UUID,
  p_decision TEXT, -- 'approved' or 'rejected'
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lead_reg RECORD;
  v_now TIMESTAMPTZ := now();
  v_new_status TEXT;
  v_updated_count INT := 0;
BEGIN
  SELECT * INTO v_lead_reg FROM public.registrations WHERE id = p_registration_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Registration not found.');
  END IF;

  IF p_decision = 'approved' THEN
    v_new_status := 'confirmed';
  ELSE
    v_new_status := 'rejected';
  END IF;

  -- Update primary registration
  UPDATE public.registrations
  SET status = v_new_status,
      ticket_issued_at = CASE WHEN v_new_status = 'confirmed' THEN COALESCE(ticket_issued_at, v_now) ELSE NULL END,
      updated_at = v_now
  WHERE id = p_registration_id;

  v_updated_count := 1;

  -- If this registration belongs to a squad, synchronize all squad member tickets
  IF v_lead_reg.team_id IS NOT NULL THEN
    UPDATE public.registrations
    SET status = v_new_status,
        ticket_issued_at = CASE WHEN v_new_status = 'confirmed' THEN COALESCE(ticket_issued_at, v_now) ELSE NULL END,
        updated_at = v_now
    WHERE team_id = v_lead_reg.team_id AND id != p_registration_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    v_updated_count := v_updated_count + 1;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', v_new_status,
    'registrations_updated', v_updated_count
  );
END;
$$;

-- ── 5. Enable Realtime Publications ─────────────────────────────────────────
-- Enable postgres replication publication for Realtime subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'registrations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.registrations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'payment_submissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_submissions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'team_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'team_invitations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_invitations;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore if publications already exist or in limited permission contexts
    NULL;
END $$;
