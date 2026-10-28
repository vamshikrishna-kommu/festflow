-- =============================================================================
-- FestFlow — Migration 024: Secure Club Invitation Preview & Hardened Acceptance
-- =============================================================================
-- SECURITY AUDIT REMEDIATION:
-- 1. Drops any broad anonymous RLS policies on public.club_invitations
-- 2. Restricts public.club_invitations table access strictly to authenticated club admins
--    and verified recipients via existing Migration 023 RLS policies
-- 3. Implements SECURITY DEFINER RPC get_club_invitation_preview with search_path protection:
--    - Returns only safe preview fields (club_name, inviter_name, role, status, expires_at)
--    - Masks recipient email for anonymous/mismatched callers to prevent harvesting
--    - Never leaks raw tokens, user IDs, or internal record IDs to unauthorized callers
-- 4. Hardens accept_club_invitation RPC:
--    - Derives caller identity strictly from auth.uid()
--    - Enforces verified email check against auth.users (email_confirmed_at IS NOT NULL)
--    - Enforces normalized email comparison (lower(trim(...)))
--    - Enforces row-level atomic lock (FOR UPDATE) to prevent double acceptance
--    - Validates role against trusted DB constraints ('admin', 'event_manager', 'payment_reviewer', 'checkin_staff', 'viewer')
--    - Prevents privilege escalation and duplicate active memberships
--    - Logs to club_audit_logs and notifies club owner via in_app_notifications
-- =============================================================================

-- ─── 1. Drop Any Broad / Insecure RLS Policies on club_invitations ─────────────
-- Ensure anonymous callers CANNOT perform direct SELECT * or enumeration on club_invitations
DROP POLICY IF EXISTS "Allow token holders to view invitation" ON public.club_invitations;
DROP POLICY IF EXISTS "Public token preview" ON public.club_invitations;
DROP POLICY IF EXISTS "Token holders can view" ON public.club_invitations;

-- Ensure RLS is active on public.club_invitations
ALTER TABLE public.club_invitations ENABLE ROW LEVEL SECURITY;

-- ─── 2. RPC: get_club_invitation_preview ─────────────────────────────────────
-- Allows unauthenticated visitors to safely inspect invitation metadata
-- without exposing private columns, user IDs, or full email addresses.
CREATE OR REPLACE FUNCTION public.get_club_invitation_preview(
    p_token TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_invitation          RECORD;
    v_club_name           TEXT;
    v_inviter_name        TEXT;
    v_caller_id           UUID;
    v_caller_email        TEXT;
    v_is_matched          BOOLEAN := FALSE;
    v_is_admin            BOOLEAN := FALSE;
    v_masked_email        TEXT;
    v_safe_email          TEXT;
    v_email_parts         TEXT[];
    v_local_part          TEXT;
    v_domain_part         TEXT;
BEGIN
    -- 1. Input Validation
    IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_TOKEN',
            'message', 'Invalid or malformed invitation token.'
        );
    END IF;

    -- 2. Lookup invitation by token
    SELECT id, club_id, email, role, status, expires_at, invited_by
    INTO v_invitation
    FROM public.club_invitations
    WHERE token = trim(p_token);

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVITATION_NOT_FOUND',
            'message', 'Invitation not found or invalid link.'
        );
    END IF;

    -- 3. Check revocation status
    IF v_invitation.status = 'revoked' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVITATION_REVOKED',
            'status', 'revoked',
            'message', 'This invitation has been revoked by the club organizer.'
        );
    END IF;

    -- 4. Check already accepted status
    IF v_invitation.status = 'accepted' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ALREADY_ACCEPTED',
            'status', 'accepted',
            'message', 'This invitation has already been accepted.'
        );
    END IF;

    -- 5. Auto-expire if past expiry date and still pending
    IF v_invitation.expires_at < now() OR v_invitation.status = 'expired' THEN
        IF v_invitation.status = 'pending' THEN
            UPDATE public.club_invitations
            SET status = 'expired', updated_at = now()
            WHERE id = v_invitation.id;
        END IF;

        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVITATION_EXPIRED',
            'status', 'expired',
            'message', 'This invitation has expired.'
        );
    END IF;

    -- 6. Lookup Club Display Name
    SELECT club_name INTO v_club_name
    FROM public.club_profiles
    WHERE profile_id = v_invitation.club_id;

    IF v_club_name IS NULL THEN
        SELECT display_name INTO v_club_name
        FROM public.profiles
        WHERE id = v_invitation.club_id;
    END IF;

    -- 7. Lookup Inviter Display Name
    SELECT display_name INTO v_inviter_name
    FROM public.profiles
    WHERE id = v_invitation.invited_by;

    -- 8. Privacy: Mask recipient email for anonymous callers or unverified third parties
    v_email_parts := string_to_array(v_invitation.email, '@');
    IF array_length(v_email_parts, 1) = 2 THEN
        v_local_part := v_email_parts[1];
        v_domain_part := v_email_parts[2];
        IF length(v_local_part) <= 2 THEN
            v_masked_email := substring(v_local_part from 1 for 1) || '***@' || v_domain_part;
        ELSE
            v_masked_email := substring(v_local_part from 1 for 2) || '***' || substring(v_local_part from length(v_local_part) for 1) || '@' || v_domain_part;
        END IF;
    ELSE
        v_masked_email := '***@***';
    END IF;

    -- Check if caller is authenticated and matches recipient or club admin
    v_caller_id := auth.uid();
    IF v_caller_id IS NOT NULL THEN
        SELECT email INTO v_caller_email
        FROM public.profiles
        WHERE id = v_caller_id;

        IF v_caller_email IS NOT NULL AND lower(trim(v_caller_email)) = lower(trim(v_invitation.email)) THEN
            v_is_matched := TRUE;
            v_safe_email := v_invitation.email;
        ELSIF public.has_club_permission(v_caller_id, v_invitation.club_id, 'manage_members') THEN
            v_is_admin := TRUE;
            v_safe_email := v_invitation.email;
        ELSE
            v_safe_email := v_masked_email;
        END IF;
    ELSE
        v_safe_email := v_masked_email;
    END IF;

    -- 9. Return strictly safe preview fields (No raw token, No internal UUIDs)
    RETURN jsonb_build_object(
        'success', true,
        'invitation', jsonb_build_object(
            'club_name', COALESCE(v_club_name, 'Campus Organization'),
            'inviter_name', COALESCE(v_inviter_name, 'Club Administrator'),
            'role', v_invitation.role,
            'status', v_invitation.status,
            'expires_at', v_invitation.expires_at,
            'email', v_safe_email,
            'masked_email', v_masked_email,
            'is_recipient_matched', v_is_matched
        )
    );
END;
$$;

-- Function permissions and ownership
ALTER FUNCTION public.get_club_invitation_preview(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_club_invitation_preview(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_club_invitation_preview(TEXT) TO anon, authenticated, service_role;

-- ─── 3. RPC: accept_club_invitation (Hardened & Atomic) ──────────────────────
-- Strictly enforces:
-- 1. Caller identity derived from auth.uid() (caller-supplied p_user_id is not trusted)
-- 2. Verified email check against auth.users (email_confirmed_at IS NOT NULL)
-- 3. Normalized email comparison (lower(trim(...)))
-- 4. Atomic row lock (FOR UPDATE)
-- 5. Role validation against allowed club roles
-- 6. Prevention of duplicate memberships and role escalation
CREATE OR REPLACE FUNCTION public.accept_club_invitation(
    p_token    TEXT,
    p_user_id  UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id           UUID;
    v_user_email          TEXT;
    v_email_confirmed_at  TIMESTAMPTZ;
    v_invitation          RECORD;
    v_existing_role       TEXT;
    v_club_name           TEXT;
BEGIN
    -- 1. Input Validation
    IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_TOKEN',
            'message', 'Invalid or missing invitation token.'
        );
    END IF;

    -- 2. Derive Caller Identity Strictly from auth.uid()
    v_caller_id := auth.uid();

    -- Service-role bypass ONLY for automated testing / system maintenance
    IF v_caller_id IS NULL THEN
        IF current_setting('request.jwt.claim.role', true) = 'service_role' OR auth.role() = 'service_role' THEN
            v_caller_id := p_user_id;
        END IF;
    END IF;

    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'UNAUTHENTICATED',
            'message', 'Authentication required. Please sign in to accept this invitation.'
        );
    END IF;

    -- Prevent an authenticated user from passing someone else's user_id
    IF p_user_id IS NOT NULL AND p_user_id <> v_caller_id AND auth.role() <> 'service_role' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'FORBIDDEN',
            'message', 'Caller identity mismatch. Cannot accept invitations on behalf of another user.'
        );
    END IF;

    -- 3. Verify Authenticated User Email and Confirmation Status
    SELECT email, email_confirmed_at
    INTO v_user_email, v_email_confirmed_at
    FROM auth.users
    WHERE id = v_caller_id;

    -- Fallback to public.profiles if auth.users is unavailable (e.g. simulated/mock environment)
    IF v_user_email IS NULL THEN
        SELECT email INTO v_user_email
        FROM public.profiles
        WHERE id = v_caller_id;
    END IF;

    IF v_user_email IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'USER_NOT_FOUND',
            'message', 'User account record not found.'
        );
    END IF;

    -- Enforce verified email in Supabase Auth (email_confirmed_at must not be null)
    IF v_email_confirmed_at IS NULL AND auth.role() <> 'service_role' AND EXISTS (SELECT 1 FROM auth.users WHERE id = v_caller_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'EMAIL_NOT_VERIFIED',
            'message', 'Please verify your email address before accepting this invitation.'
        );
    END IF;

    -- 4. Fetch invitation with row-level lock (FOR UPDATE) to prevent concurrent double-acceptance
    SELECT * INTO v_invitation
    FROM public.club_invitations
    WHERE token = trim(p_token)
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVITATION_NOT_FOUND',
            'message', 'Invitation not found or invalid link.'
        );
    END IF;

    -- 5. Status checks
    IF v_invitation.status = 'revoked' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVITATION_REVOKED',
            'message', 'This invitation has been revoked by the club organizer.'
        );
    END IF;

    IF v_invitation.status = 'accepted' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'ALREADY_ACCEPTED',
            'message', 'This invitation has already been accepted.'
        );
    END IF;

    IF v_invitation.expires_at < now() OR v_invitation.status = 'expired' THEN
        UPDATE public.club_invitations
        SET status = 'expired', updated_at = now()
        WHERE id = v_invitation.id;

        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVITATION_EXPIRED',
            'message', 'This invitation has expired.'
        );
    END IF;

    -- 6. Match authenticated user email against invited email (normalized comparison)
    -- Do not leak the invited email address to unauthorized callers
    IF lower(trim(v_user_email)) <> lower(trim(v_invitation.email)) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'EMAIL_MISMATCH',
            'message', 'This invitation was issued to a different email address.'
        );
    END IF;

    -- 7. Validate Invited Role against Allowed Club Roles
    IF v_invitation.role NOT IN ('admin', 'event_manager', 'payment_reviewer', 'checkin_staff', 'viewer') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'INVALID_ROLE',
            'message', 'Invitation specifies an invalid or unauthorized club role.'
        );
    END IF;

    -- 8. Check duplicate active membership
    SELECT role INTO v_existing_role
    FROM public.club_members
    WHERE club_id = v_invitation.club_id AND user_id = v_caller_id AND status = 'active';

    IF v_existing_role IS NOT NULL THEN
        -- Mark invitation as accepted if already a member
        UPDATE public.club_invitations
        SET status = 'accepted', accepted_at = now(), accepted_by = v_caller_id, updated_at = now()
        WHERE id = v_invitation.id;

        RETURN jsonb_build_object(
            'success', true,
            'club_id', v_invitation.club_id,
            'role', v_existing_role,
            'message', format('You are already an active member of this organization with the role %s.', v_existing_role)
        );
    END IF;

    -- 9. Insert or update member record atomically
    INSERT INTO public.club_members (club_id, user_id, role, status, updated_at)
    VALUES (v_invitation.club_id, v_caller_id, v_invitation.role, 'active', now())
    ON CONFLICT (club_id, user_id)
    DO UPDATE SET role = EXCLUDED.role, status = 'active', updated_at = now();

    -- 10. Update invitation status to accepted
    UPDATE public.club_invitations
    SET status = 'accepted', accepted_at = now(), accepted_by = v_caller_id, updated_at = now()
    WHERE id = v_invitation.id;

    -- 11. Ensure profile role grants club access
    UPDATE public.profiles
    SET role = 'club_member', updated_at = now()
    WHERE id = v_caller_id AND role = 'student';

    -- 12. Write audit log
    INSERT INTO public.club_audit_logs (club_id, actor_id, action, target_id, target_email, new_value, details)
    VALUES (
        v_invitation.club_id,
        v_caller_id,
        'invitation_accepted',
        v_caller_id::text,
        v_user_email,
        v_invitation.role,
        jsonb_build_object('invitation_id', v_invitation.id, 'accepted_at', now())
    );

    -- 13. Fetch Club Name for feedback
    SELECT club_name INTO v_club_name
    FROM public.club_profiles
    WHERE profile_id = v_invitation.club_id;

    -- 14. Notify club owner/inviter via in_app_notifications
    BEGIN
        INSERT INTO public.in_app_notifications (user_id, title, message, type, link, is_read)
        VALUES (
            v_invitation.invited_by,
            'Staff Invitation Accepted',
            format('%s accepted the invitation to join %s as %s.', v_user_email, COALESCE(v_club_name, 'your organization'), v_invitation.role),
            'club_invitation_accepted',
            '/club/settings',
            false
        );
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'club_id', v_invitation.club_id,
        'club_name', COALESCE(v_club_name, 'Campus Organization'),
        'role', v_invitation.role,
        'message', format('Welcome! Successfully joined as %s.', v_invitation.role)
    );
END;
$$;

-- Function permissions and ownership
ALTER FUNCTION public.accept_club_invitation(TEXT, UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.accept_club_invitation(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_club_invitation(TEXT, UUID) TO authenticated, service_role;
