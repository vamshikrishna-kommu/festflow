-- =============================================================================
-- Migration 048: Secure Team Invitation, Acceptance and Hashing Architecture
--
-- Features:
-- 1. Cryptographic token hashing (SHA-256) for team_invitations.
-- 2. Atomic, server-side invitation acceptance with verified email enforcement.
-- 3. Dedicated decline_team_invitation RPC.
-- 4. Event poster, venue, and metadata enrichment in invitation preview.
-- 5. Strict capacity, cross-team isolation, and duplicate prevention.
-- 6. Ticket generation with Phase 11 SHA-256 qr_token_hash.
-- 7. Hardened Row Level Security (RLS) on team_invitations.
-- =============================================================================

-- ── 1. Schema Extensions for public.team_invitations ─────────────────────────
ALTER TABLE public.team_invitations
  ADD COLUMN IF NOT EXISTS token_hash TEXT,
  ADD COLUMN IF NOT EXISTS registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decline_reason TEXT,
  ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;

-- Backfill existing token hashes using pgcrypto digest
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    UPDATE public.team_invitations
    SET token_hash = encode(digest(token, 'sha256'), 'hex')
    WHERE token IS NOT NULL AND token_hash IS NULL;
  END IF;
END $$;

-- ── 2. Create Optimized Indexes ──────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_invitations_token_hash
  ON public.team_invitations(token_hash)
  WHERE token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_team_invitations_team_status
  ON public.team_invitations(team_id, status);

CREATE INDEX IF NOT EXISTS idx_team_invitations_email_team
  ON public.team_invitations(lower(email), team_id);

-- ── 3. Automatic Token Hash Maintenance Trigger ─────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_team_invitation_token_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF NEW.token IS NOT NULL AND (NEW.token_hash IS NULL OR NEW.token <> OLD.token) THEN
    NEW.token_hash := encode(digest(NEW.token, 'sha256'), 'hex');
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_invitations_token_hash ON public.team_invitations;
CREATE TRIGGER trg_team_invitations_token_hash
  BEFORE INSERT OR UPDATE OF token ON public.team_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_team_invitation_token_hash();

-- ── 4. RPC: get_team_invitation_preview (Enriched Preview) ──────────────────
DROP FUNCTION IF EXISTS public.get_team_invitation_preview(TEXT);

CREATE OR REPLACE FUNCTION public.get_team_invitation_preview(
    p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_clean_token TEXT;
    v_token_hash TEXT;
    v_invitation RECORD;
    v_team RECORD;
    v_event RECORD;
    v_leader RECORD;
    v_caller_id UUID;
    v_caller_email TEXT;
    v_is_matched BOOLEAN := false;
    v_current_count INT := 0;
    v_max_size INT := 5;
    v_masked_email TEXT := '';
    v_safe_email TEXT := '';
    v_email_parts TEXT[];
    v_local_part TEXT;
    v_domain_part TEXT;
BEGIN
    v_clean_token := TRIM(COALESCE(p_token, ''));
    IF LENGTH(v_clean_token) < 4 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_TOKEN',
            'message', 'Invalid or missing invitation token.'
        );
    END IF;

    -- Compute SHA-256 digest of normalized token
    v_token_hash := encode(digest(v_clean_token, 'sha256'), 'hex');

    -- Lookup invitation (by token_hash, raw token, or team invite_code)
    SELECT i.* INTO v_invitation
    FROM public.team_invitations i
    LEFT JOIN public.teams t ON t.id = i.team_id
    WHERE i.token_hash = v_token_hash
       OR i.token = v_clean_token
       OR upper(trim(t.invite_code)) = upper(v_clean_token)
    ORDER BY i.created_at DESC
    LIMIT 1;

    IF v_invitation.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVITATION_NOT_FOUND',
            'message', 'Invitation not found or link has expired.'
        );
    END IF;

    -- Check lifecycle status
    IF v_invitation.status = 'revoked' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVITATION_REVOKED',
            'message', 'This squad invitation has been revoked by the team leader.'
        );
    END IF;

    IF v_invitation.status = 'accepted' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ALREADY_ACCEPTED',
            'message', 'This squad invitation has already been accepted and claimed.'
        );
    END IF;

    IF v_invitation.status = 'declined' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVITATION_DECLINED',
            'message', 'This squad invitation has been declined.'
        );
    END IF;

    IF v_invitation.expires_at < now() THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVITATION_EXPIRED',
            'message', 'This squad invitation has expired.'
        );
    END IF;

    -- Fetch team details
    SELECT * INTO v_team FROM public.teams WHERE id = v_invitation.team_id;
    IF v_team.id IS NULL OR v_team.status = 'disbanded' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TEAM_NOT_FOUND',
            'message', 'This squad is no longer active.'
        );
    END IF;

    -- Fetch event details
    SELECT * INTO v_event FROM public.events WHERE id = v_invitation.event_id;
    IF v_event.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'EVENT_NOT_FOUND',
            'message', 'Event for this team could not be found.'
        );
    END IF;

    -- Fetch leader profile
    SELECT display_name, email INTO v_leader FROM public.profiles WHERE id = v_team.leader_id;

    -- Calculate current confirmed capacity
    SELECT count(*) INTO v_current_count
    FROM public.team_members
    WHERE team_id = v_team.id AND status = 'accepted';

    v_max_size := COALESCE(v_event.max_team_size, 5);

    -- Mask recipient email for privacy
    v_email_parts := string_to_array(lower(trim(v_invitation.email)), '@');
    IF array_length(v_email_parts, 1) = 2 THEN
        v_local_part  := v_email_parts[1];
        v_domain_part := v_email_parts[2];
        IF length(v_local_part) <= 2 THEN
            v_masked_email := rpad(v_local_part, 4, '*') || '@' || v_domain_part;
        ELSE
            v_masked_email := substring(v_local_part from 1 for 2) || repeat('*', GREATEST(length(v_local_part) - 2, 3)) || '@' || v_domain_part;
        END IF;
    ELSE
        v_masked_email := '***@***';
    END IF;

    -- Recipient Match Evaluation
    v_caller_id := auth.uid();
    IF v_caller_id IS NOT NULL THEN
        SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;
        IF v_caller_email IS NULL THEN
            SELECT email INTO v_caller_email FROM public.profiles WHERE id = v_caller_id;
        END IF;

        IF v_caller_email IS NOT NULL AND lower(trim(v_caller_email)) = lower(trim(v_invitation.email)) THEN
            v_is_matched := true;
            v_safe_email := v_invitation.email;
        ELSE
            v_safe_email := v_masked_email;
        END IF;
    ELSE
        v_safe_email := v_masked_email;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'invitation', jsonb_build_object(
            'id', v_invitation.id,
            'team_id', v_team.id,
            'team_name', v_team.name,
            'event_id', v_event.id,
            'event_title', v_event.title,
            'event_slug', v_event.slug,
            'event_category', v_event.category,
            'poster_url', v_event.poster_url,
            'description', v_event.description,
            'venue_name', v_event.venue_name,
            'start_date', v_event.start_date,
            'is_free', v_event.is_free,
            'price', v_event.price,
            'leader_name', COALESCE(v_leader.display_name, 'Team Leader'),
            'invite_code', v_team.invite_code,
            'recipient_email', v_safe_email,
            'masked_email', v_masked_email,
            'is_recipient_matched', v_is_matched,
            'status', v_invitation.status,
            'expires_at', v_invitation.expires_at,
            'current_size', v_current_count,
            'max_size', v_max_size,
            'is_full', (v_current_count >= v_max_size),
            'is_open', (v_event.status = 'published' AND (v_event.registration_closes_at IS NULL OR v_event.registration_closes_at > now()))
        )
    );
END;
$$;

-- ── 5. RPC: accept_team_invitation (Atomic Acceptance) ──────────────────────
DROP FUNCTION IF EXISTS public.accept_team_invitation(TEXT, JSONB);
DROP FUNCTION IF EXISTS public.accept_team_invitation(TEXT);

CREATE OR REPLACE FUNCTION public.accept_team_invitation(
    p_token TEXT,
    p_participant_details JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_clean_token TEXT;
    v_token_hash TEXT;
    v_caller_id UUID;
    v_user_profile RECORD;
    v_user_email TEXT;
    v_email_confirmed_at TIMESTAMPTZ;
    v_invitation RECORD;
    v_team RECORD;
    v_event RECORD;
    v_leader_reg RECORD;
    v_existing_membership RECORD;
    v_accepted_count INT;
    v_max_size INT;
    v_member_name TEXT;
    v_college TEXT;
    v_phone TEXT;
    v_student_id TEXT;
    v_target_status public.registration_status := 'confirmed'::public.registration_status;
    v_target_issued_at TIMESTAMPTZ;
    v_member_reg RECORD;
    v_member_idx INT;
    v_member_ticket_code TEXT;
    v_member_qr_token TEXT;
    v_member_qr_hash BYTEA;
    v_member_rec RECORD;
    v_now TIMESTAMPTZ := now();
BEGIN
    v_clean_token := TRIM(COALESCE(p_token, ''));
    IF LENGTH(v_clean_token) < 4 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_TOKEN',
            'message', 'Invalid or missing invitation token.'
        );
    END IF;

    -- 1. Identify caller
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'UNAUTHENTICATED',
            'message', 'Sign in required to accept team invitations.'
        );
    END IF;

    -- 2. Fetch caller profile
    SELECT * INTO v_user_profile
    FROM public.profiles
    WHERE id = v_caller_id;

    IF v_user_profile.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'PROFILE_NOT_FOUND',
            'message', 'Student profile record could not be found.'
        );
    END IF;

    -- 3. Verify student email confirmation
    SELECT email, email_confirmed_at INTO v_user_email, v_email_confirmed_at
    FROM auth.users
    WHERE id = v_caller_id;

    IF v_user_email IS NULL THEN
        v_user_email := v_user_profile.email;
    END IF;

    -- Strict email confirmation check
    IF v_email_confirmed_at IS NULL AND auth.role() <> 'service_role' AND EXISTS (SELECT 1 FROM auth.users WHERE id = v_caller_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'EMAIL_NOT_VERIFIED',
            'message', 'Please verify your student email address before accepting this squad invitation.'
        );
    END IF;

    -- 4. Compute token hash & Lock invitation row
    v_token_hash := encode(digest(v_clean_token, 'sha256'), 'hex');

    SELECT i.* INTO v_invitation
    FROM public.team_invitations i
    LEFT JOIN public.teams t ON t.id = i.team_id
    WHERE i.token_hash = v_token_hash
       OR i.token = v_clean_token
       OR upper(trim(t.invite_code)) = upper(v_clean_token)
    ORDER BY i.created_at DESC
    LIMIT 1
    FOR UPDATE OF i;

    IF v_invitation.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVITATION_NOT_FOUND',
            'message', 'Invalid or expired team invitation token.'
        );
    END IF;

    IF v_invitation.status = 'revoked' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVITATION_REVOKED',
            'message', 'This squad invitation has been revoked by the team leader.'
        );
    END IF;

    IF v_invitation.status = 'accepted' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ALREADY_ACCEPTED',
            'message', 'This squad invitation has already been accepted.'
        );
    END IF;

    IF v_invitation.status = 'declined' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVITATION_DECLINED',
            'message', 'This squad invitation was previously declined.'
        );
    END IF;

    IF v_invitation.expires_at < v_now THEN
        UPDATE public.team_invitations SET status = 'expired', updated_at = v_now WHERE id = v_invitation.id;
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVITATION_EXPIRED',
            'message', 'This squad invitation has expired.'
        );
    END IF;

    -- 5. Email matching check (Verified Email Bound)
    IF v_invitation.email IS NOT NULL AND TRIM(v_invitation.email) <> '' THEN
        IF lower(TRIM(v_user_email)) <> lower(TRIM(v_invitation.email)) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'EMAIL_MISMATCH',
                'message', format('This invitation was sent to %s. Please switch accounts to accept.', v_invitation.email)
            );
        END IF;
    END IF;

    -- 6. Lock and fetch team
    SELECT * INTO v_team
    FROM public.teams
    WHERE id = v_invitation.team_id
    FOR UPDATE;

    IF v_team.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TEAM_NOT_FOUND',
            'message', 'The team associated with this invitation does not exist.'
        );
    END IF;

    IF v_team.status = 'disbanded' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TEAM_DISBANDED',
            'message', 'This squad has been disbanded by the leader.'
        );
    END IF;

    IF v_team.leader_id = v_caller_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ALREADY_LEADER',
            'message', 'You are already the leader of this team.'
        );
    END IF;

    -- 7. Fetch and validate event
    SELECT * INTO v_event
    FROM public.events
    WHERE id = v_team.event_id;

    IF v_event.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'EVENT_NOT_FOUND',
            'message', 'Event for this team could not be found.'
        );
    END IF;

    IF v_event.status <> 'published' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'EVENT_NOT_ACTIVE',
            'message', 'Registrations for this event are currently closed.'
        );
    END IF;

    IF v_event.registration_closes_at IS NOT NULL AND v_event.registration_closes_at <= v_now THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'DEADLINE_PASSED',
            'message', 'Registration deadline for this event has passed.'
        );
    END IF;

    IF v_event.start_date <= v_now THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'EVENT_STARTED',
            'message', 'This event has already started.'
        );
    END IF;

    -- 8. Cross-team isolation & duplicate checks
    SELECT * INTO v_existing_membership
    FROM public.team_members
    WHERE event_id = v_team.event_id
      AND (user_id = v_caller_id OR lower(email) = lower(v_user_email))
      AND status = 'accepted'
      AND team_id <> v_team.id;

    IF v_existing_membership.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ALREADY_IN_TEAM',
            'message', 'You are already a confirmed member of another squad for this event.'
        );
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.teams
        WHERE event_id = v_team.event_id
          AND leader_id = v_caller_id
          AND id <> v_team.id
          AND status <> 'disbanded'
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ALREADY_IN_TEAM',
            'message', 'You are already the leader of a squad for this event.'
        );
    END IF;

    -- 9. Capacity check (Only ACCEPTED members count toward size)
    v_max_size := COALESCE(v_event.max_team_size, 5);
    SELECT count(*) INTO v_accepted_count
    FROM public.team_members
    WHERE team_id = v_team.id AND status = 'accepted';

    IF v_accepted_count >= v_max_size THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'TEAM_FULL',
            'message', format('This squad has reached maximum team capacity (%s/%s members).', v_accepted_count, v_max_size)
        );
    END IF;

    -- 10. Extract participant details safely
    v_member_name := COALESCE(
        NULLIF(TRIM(p_participant_details ->> 'student_name'), ''),
        NULLIF(TRIM(p_participant_details ->> 'full_name'), ''),
        v_user_profile.display_name,
        split_part(v_user_email, '@', 1)
    );
    v_college := COALESCE(p_participant_details ->> 'college_name', '');
    v_phone := COALESCE(p_participant_details ->> 'phone', '');
    v_student_id := COALESCE(p_participant_details ->> 'id_card_number', '');

    -- 11. Lock leader's registration record
    SELECT * INTO v_leader_reg FROM public.registrations WHERE id = v_team.registration_id;
    IF v_leader_reg.id IS NULL THEN
        SELECT * INTO v_leader_reg
        FROM public.registrations
        WHERE event_id = v_team.event_id AND student_id = v_team.leader_id
        ORDER BY created_at DESC LIMIT 1;
    END IF;

    -- 12. Determine member pass status based on event & leader payment state
    IF v_event.is_free = true OR COALESCE(v_event.price, 0) <= 0 THEN
        IF v_event.approval_type = 'manual' AND COALESCE(v_leader_reg.status::text, '') = 'pending_approval' THEN
            v_target_status := 'pending_approval'::public.registration_status;
            v_target_issued_at := NULL;
        ELSE
            v_target_status := 'confirmed'::public.registration_status;
            v_target_issued_at := v_now;
        END IF;
    ELSE
        IF v_leader_reg.id IS NOT NULL AND v_leader_reg.status::text = 'confirmed' AND v_leader_reg.ticket_issued_at IS NOT NULL THEN
            v_target_status := 'confirmed'::public.registration_status;
            v_target_issued_at := v_now;
        ELSE
            v_target_status := 'pending_payment'::public.registration_status;
            v_target_issued_at := NULL;
        END IF;
    END IF;

    -- 13. Generate ticket code and secure 256-bit QR token with SHA-256 hash
    SELECT count(*) + 1 INTO v_member_idx
    FROM public.team_members
    WHERE team_id = v_team.id AND user_id <> v_team.leader_id;

    IF v_leader_reg.ticket_code IS NOT NULL THEN
        v_member_ticket_code := format('%s-M%s', v_leader_reg.ticket_code, v_member_idx);
    ELSE
        v_member_ticket_code := format('FF-%s', UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8)));
    END IF;

    v_member_qr_token := format('FFQ_%s', UPPER(REPLACE(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')));
    v_member_qr_hash := digest(UPPER(TRIM(v_member_qr_token)), 'sha256');

    -- Insert or update member registration
    SELECT * INTO v_member_reg
    FROM public.registrations
    WHERE event_id = v_team.event_id AND student_id = v_caller_id
    FOR UPDATE;

    IF v_member_reg.id IS NOT NULL THEN
        UPDATE public.registrations
        SET team_id = v_team.id,
            team_name = v_team.name,
            team_role = 'member',
            status = v_target_status,
            ticket_issued_at = v_target_issued_at,
            ticket_code = COALESCE(NULLIF(ticket_code, ''), v_member_ticket_code),
            qr_token = COALESCE(NULLIF(qr_token, ''), v_member_qr_token),
            qr_token_hash = COALESCE(qr_token_hash, v_member_qr_hash),
            participant_details = CASE WHEN p_participant_details <> '{}'::jsonb THEN p_participant_details ELSE participant_details END,
            rejection_reason = CASE WHEN v_target_status::text = 'confirmed' THEN NULL ELSE rejection_reason END,
            updated_at = v_now
        WHERE id = v_member_reg.id
        RETURNING * INTO v_member_reg;
    ELSE
        INSERT INTO public.registrations (
            event_id,
            student_id,
            status,
            ticket_code,
            qr_token,
            qr_token_hash,
            ticket_issued_at,
            team_name,
            team_id,
            team_role,
            participant_details,
            approval_status,
            created_at,
            updated_at
        ) VALUES (
            v_team.event_id,
            v_caller_id,
            v_target_status,
            v_member_ticket_code,
            v_member_qr_token,
            v_member_qr_hash,
            v_target_issued_at,
            v_team.name,
            v_team.id,
            'member',
            p_participant_details,
            CASE WHEN v_target_status::text = 'confirmed' THEN 'approved' ELSE 'pending' END,
            v_now,
            v_now
        ) RETURNING * INTO v_member_reg;
    END IF;

    -- 14. Mark invitation accepted atomically
    UPDATE public.team_invitations
    SET status = 'accepted',
        accepted_at = v_now,
        accepted_by = v_caller_id,
        registration_id = v_member_reg.id,
        updated_at = v_now
    WHERE id = v_invitation.id;

    -- 15. Update or insert team_members record
    SELECT * INTO v_member_rec
    FROM public.team_members
    WHERE team_id = v_team.id AND (
        user_id = v_caller_id
        OR lower(email) = lower(v_user_email)
        OR (v_invitation.email IS NOT NULL AND lower(email) = lower(v_invitation.email))
    )
    FOR UPDATE;

    IF FOUND THEN
        UPDATE public.team_members
        SET user_id = v_caller_id,
            event_id = v_team.event_id,
            name = v_member_name,
            email = lower(v_user_email),
            college = CASE WHEN v_college <> '' THEN v_college ELSE college END,
            phone = CASE WHEN v_phone <> '' THEN v_phone ELSE phone END,
            student_id_card = CASE WHEN v_student_id <> '' THEN v_student_id ELSE student_id_card END,
            status = 'accepted',
            registration_id = v_member_reg.id,
            invitation_id = v_invitation.id,
            joined_at = COALESCE(joined_at, v_now),
            updated_at = v_now
        WHERE id = v_member_rec.id;
    ELSE
        INSERT INTO public.team_members (
            team_id,
            event_id,
            user_id,
            name,
            email,
            role,
            status,
            college,
            phone,
            student_id_card,
            registration_id,
            invitation_id,
            joined_at,
            created_at,
            updated_at
        ) VALUES (
            v_team.id,
            v_team.event_id,
            v_caller_id,
            v_member_name,
            lower(v_user_email),
            'member',
            'accepted',
            v_college,
            v_phone,
            v_student_id,
            v_member_reg.id,
            v_invitation.id,
            v_now,
            v_now,
            v_now
        ) RETURNING * INTO v_member_rec;
    END IF;

    -- 16. Update team status if full
    IF v_accepted_count + 1 >= v_max_size THEN
        UPDATE public.teams SET status = 'complete', updated_at = v_now WHERE id = v_team.id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', format('Successfully joined team "%s"!', v_team.name),
        'team_id', v_team.id,
        'team_name', v_team.name,
        'registration_id', v_member_reg.id,
        'ticket_code', v_member_reg.ticket_code,
        'status', v_target_status,
        'member_count', v_accepted_count + 1,
        'max_size', v_max_size
    );
END;
$$;

-- ── 6. RPC: decline_team_invitation (Explicit Decline) ──────────────────────
DROP FUNCTION IF EXISTS public.decline_team_invitation(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.decline_team_invitation(TEXT);

CREATE OR REPLACE FUNCTION public.decline_team_invitation(
    p_token TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_clean_token TEXT;
    v_token_hash TEXT;
    v_invitation RECORD;
    v_team RECORD;
    v_now TIMESTAMPTZ := now();
BEGIN
    v_clean_token := TRIM(COALESCE(p_token, ''));
    IF LENGTH(v_clean_token) < 4 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_TOKEN',
            'message', 'Invalid or missing invitation token.'
        );
    END IF;

    v_token_hash := encode(digest(v_clean_token, 'sha256'), 'hex');

    SELECT i.* INTO v_invitation
    FROM public.team_invitations i
    LEFT JOIN public.teams t ON t.id = i.team_id
    WHERE i.token_hash = v_token_hash
       OR i.token = v_clean_token
       OR upper(trim(t.invite_code)) = upper(v_clean_token)
    ORDER BY i.created_at DESC
    LIMIT 1
    FOR UPDATE OF i;

    IF v_invitation.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVITATION_NOT_FOUND',
            'message', 'Invitation not found or link has expired.'
        );
    END IF;

    IF v_invitation.status = 'revoked' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVITATION_REVOKED',
            'message', 'This invitation has already been revoked.'
        );
    END IF;

    IF v_invitation.status = 'accepted' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ALREADY_ACCEPTED',
            'message', 'This invitation was already accepted and cannot be declined.'
        );
    END IF;

    -- Update invitation status
    UPDATE public.team_invitations
    SET status = 'declined',
        declined_at = v_now,
        decline_reason = p_reason,
        updated_at = v_now
    WHERE id = v_invitation.id;

    -- Update pending slot in team_members if exists
    UPDATE public.team_members
    SET status = 'declined',
        updated_at = v_now
    WHERE team_id = v_invitation.team_id
      AND invitation_id = v_invitation.id
      AND status = 'pending';

    SELECT * INTO v_team FROM public.teams WHERE id = v_invitation.team_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Squad invitation declined.',
        'team_id', v_invitation.team_id,
        'team_name', COALESCE(v_team.name, 'Squad')
    );
END;
$$;

-- ── 7. RPC: invite_team_member (Secure Leader Dispatch) ─────────────────────
DROP FUNCTION IF EXISTS public.invite_team_member(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.invite_team_member(
    p_team_id UUID,
    p_email TEXT,
    p_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_clean_email TEXT;
    v_team RECORD;
    v_event RECORD;
    v_current_count INT;
    v_max_size INT;
    v_raw_token TEXT;
    v_token_hash TEXT;
    v_existing_invite RECORD;
    v_invitation_id UUID;
    v_now TIMESTAMPTZ := now();
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
    END IF;

    v_clean_email := lower(trim(COALESCE(p_email, '')));
    IF v_clean_email = '' OR v_clean_email NOT LIKE '%@%.%' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_EMAIL', 'message', 'Please provide a valid email address.');
    END IF;

    -- Validate team and leadership
    SELECT * INTO v_team FROM public.teams WHERE id = p_team_id;
    IF v_team.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'TEAM_NOT_FOUND', 'message', 'Team not found.');
    END IF;

    IF v_team.leader_id <> v_caller_id AND auth.role() <> 'service_role' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Only team leaders can dispatch invitations.');
    END IF;

    -- Prevent leader from inviting themselves
    IF EXISTS (
        SELECT 1 FROM auth.users WHERE id = v_caller_id AND lower(email) = v_clean_email
    ) OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = v_caller_id AND lower(email) = v_clean_email
    ) THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'SELF_INVITE', 'message', 'You are already the leader of this squad.');
    END IF;

    -- Check event capacity
    SELECT * INTO v_event FROM public.events WHERE id = v_team.event_id;
    v_max_size := COALESCE(v_event.max_team_size, 5);

    SELECT count(*) INTO v_current_count
    FROM public.team_members
    WHERE team_id = v_team.id AND status = 'accepted';

    IF v_current_count >= v_max_size THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'TEAM_FULL', 'message', 'This team has already reached maximum capacity.');
    END IF;

    -- Check if already an accepted member
    IF EXISTS (
        SELECT 1 FROM public.team_members
        WHERE team_id = v_team.id AND lower(email) = v_clean_email AND status = 'accepted'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_MEMBER', 'message', 'This student is already a confirmed member of your team.');
    END IF;

    -- Generate secure 64-hex character unguessable token (256 bits)
    v_raw_token := 'FFINV_' || UPPER(REPLACE(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''));
    v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');

    -- Insert or update pending invitation
    SELECT * INTO v_existing_invite
    FROM public.team_invitations
    WHERE team_id = v_team.id AND lower(email) = v_clean_email AND status = 'pending';

    IF v_existing_invite.id IS NOT NULL THEN
        UPDATE public.team_invitations
        SET token = v_raw_token,
            token_hash = v_token_hash,
            last_sent_at = v_now,
            resend_count = resend_count + 1,
            expires_at = v_now + INTERVAL '7 days',
            updated_at = v_now
        WHERE id = v_existing_invite.id
        RETURNING id INTO v_invitation_id;
    ELSE
        INSERT INTO public.team_invitations (
            team_id,
            event_id,
            inviter_id,
            email,
            token,
            token_hash,
            status,
            expires_at,
            last_sent_at,
            created_at,
            updated_at
        ) VALUES (
            v_team.id,
            v_team.event_id,
            v_caller_id,
            v_clean_email,
            v_raw_token,
            v_token_hash,
            'pending',
            v_now + INTERVAL '7 days',
            v_now,
            v_now,
            v_now
        ) RETURNING id INTO v_invitation_id;
    END IF;

    -- Upsert pending slot in team_members
    INSERT INTO public.team_members (
        team_id,
        event_id,
        name,
        email,
        role,
        status,
        invitation_id,
        created_at,
        updated_at
    ) VALUES (
        v_team.id,
        v_team.event_id,
        COALESCE(NULLIF(TRIM(p_name), ''), split_part(v_clean_email, '@', 1)),
        v_clean_email,
        'member',
        'pending',
        v_invitation_id,
        v_now,
        v_now
    )
    ON CONFLICT (team_id, email) DO UPDATE
    SET invitation_id = v_invitation_id,
        name = COALESCE(NULLIF(TRIM(p_name), ''), public.team_members.name),
        updated_at = v_now;

    RETURN jsonb_build_object(
        'success', true,
        'message', format('Invitation dispatched to %s', v_clean_email),
        'invitation_id', v_invitation_id,
        'token', v_raw_token,
        'invite_code', v_team.invite_code,
        'expires_at', (v_now + INTERVAL '7 days')
    );
END;
$$;

-- ── 8. RPC: revoke_team_invitation (Cancel Invitation) ──────────────────────
DROP FUNCTION IF EXISTS public.revoke_team_invitation(UUID);

CREATE OR REPLACE FUNCTION public.revoke_team_invitation(
    p_invitation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_invitation RECORD;
    v_team RECORD;
    v_now TIMESTAMPTZ := now();
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
    END IF;

    SELECT * INTO v_invitation FROM public.team_invitations WHERE id = p_invitation_id FOR UPDATE;
    IF v_invitation.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Invitation not found.');
    END IF;

    SELECT * INTO v_team FROM public.teams WHERE id = v_invitation.team_id;
    IF v_team.id IS NULL OR (v_team.leader_id <> v_caller_id AND auth.role() <> 'service_role') THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Only team leaders can cancel invitations.');
    END IF;

    IF v_invitation.status = 'accepted' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_ACCEPTED', 'message', 'This invitation has already been accepted and cannot be cancelled.');
    END IF;

    -- Revoke invitation
    UPDATE public.team_invitations
    SET status = 'revoked',
        updated_at = v_now
    WHERE id = v_invitation.id;

    -- Remove pending slot from team_members
    DELETE FROM public.team_members
    WHERE team_id = v_invitation.team_id
      AND invitation_id = v_invitation.id
      AND status = 'pending';

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Invitation cancelled successfully.'
    );
END;
$$;

-- ── 9. Row Level Security Policies on team_invitations ───────────────────────
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team leaders view invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "Team leaders can manage team invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "recipients view own invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "Recipients can view invitations sent to their email" ON public.team_invitations;

-- Policy: Leaders can view and insert invitations for their team
CREATE POLICY "team_leaders_select_invitations"
  ON public.team_invitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_invitations.team_id AND t.leader_id = auth.uid()
    )
  );

CREATE POLICY "team_leaders_insert_invitations"
  ON public.team_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_invitations.team_id AND t.leader_id = auth.uid()
    )
  );

CREATE POLICY "team_leaders_update_invitations"
  ON public.team_invitations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_invitations.team_id AND t.leader_id = auth.uid()
    )
  );

-- Policy: Recipients can view invitations issued to their verified email or claimed by them
CREATE POLICY "recipients_select_own_invitations"
  ON public.team_invitations FOR SELECT
  TO authenticated
  USING (
    lower(team_invitations.email) = lower(auth.jwt()->>'email')
    OR team_invitations.accepted_by = auth.uid()
  );

-- Policy: Service role has full access
CREATE POLICY "service_role_team_invitations_all"
  ON public.team_invitations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 10. Explicit Function Permissions ────────────────────────────────────────
ALTER FUNCTION public.get_team_invitation_preview(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_team_invitation_preview(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_invitation_preview(TEXT) TO anon, authenticated, service_role;

ALTER FUNCTION public.accept_team_invitation(TEXT, JSONB) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.accept_team_invitation(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(TEXT, JSONB) TO authenticated, service_role;

ALTER FUNCTION public.decline_team_invitation(TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.decline_team_invitation(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decline_team_invitation(TEXT, TEXT) TO authenticated, service_role;

ALTER FUNCTION public.invite_team_member(UUID, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.invite_team_member(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_team_member(UUID, TEXT, TEXT) TO authenticated, service_role;

ALTER FUNCTION public.revoke_team_invitation(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.revoke_team_invitation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_team_invitation(UUID) TO authenticated, service_role;

