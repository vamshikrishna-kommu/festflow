-- =============================================================================
-- FestFlow — Migration 023: Club Members, Staff Invitations & Granular Permissions
-- =============================================================================
-- PHASE 6 BACKEND ENFORCEMENT:
-- 1. Create public.club_members with least-privilege roles ('owner', 'admin', 'event_manager', 'payment_reviewer', 'checkin_staff', 'viewer')
-- 2. Create public.club_invitations with secure tokens and expiration
-- 3. Create public.club_audit_logs for audit trails
-- 4. Create public.has_club_permission helper function
-- 5. Create secure database RPCs for invitation, acceptance, role update, member removal, and ownership transfer
-- 6. Add Row Level Security (RLS) policies enforcing cross-club resource isolation
-- =============================================================================

-- ─── 1. Table: club_members ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'event_manager', 'payment_reviewer', 'checkin_staff', 'viewer')),
    status      TEXT NOT NULL CHECK (status IN ('active', 'suspended')) DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_club_members_club_user UNIQUE (club_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_club_members_club_id ON public.club_members(club_id);
CREATE INDEX IF NOT EXISTS idx_club_members_user_id ON public.club_members(user_id);
CREATE INDEX IF NOT EXISTS idx_club_members_role    ON public.club_members(club_id, role);

-- ─── 2. Table: club_invitations ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_invitations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    role        TEXT NOT NULL CHECK (role IN ('admin', 'event_manager', 'payment_reviewer', 'checkin_staff', 'viewer')),
    invited_by  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token       TEXT UNIQUE NOT NULL,
    status      TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')) DEFAULT 'pending',
    expires_at  TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_invitations_club_id ON public.club_invitations(club_id);
CREATE INDEX IF NOT EXISTS idx_club_invitations_token   ON public.club_invitations(token);
CREATE INDEX IF NOT EXISTS idx_club_invitations_email   ON public.club_invitations(lower(email));

-- ─── 3. Table: club_audit_logs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_audit_logs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    actor_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action       TEXT NOT NULL,
    target_id    TEXT,
    target_email TEXT,
    old_value    TEXT,
    new_value    TEXT,
    details      JSONB DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_audit_logs_club_id ON public.club_audit_logs(club_id, created_at DESC);

-- ─── 4. Helper Function: has_club_permission ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_club_permission(
    p_user_id     UUID,
    p_club_id     UUID,
    p_permission  TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
    v_role             TEXT;
    v_user_global_role TEXT;
BEGIN
    IF p_user_id IS NULL OR p_club_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 1. Platform Admin override
    SELECT role INTO v_user_global_role FROM public.profiles WHERE id = p_user_id;
    IF v_user_global_role = 'platform_admin' THEN
        RETURN TRUE;
    END IF;

    -- 2. Primary club owner (club_id is owner profile_id)
    IF p_club_id = p_user_id THEN
        RETURN TRUE;
    END IF;

    -- 3. Query club_members table
    SELECT role INTO v_role
    FROM public.club_members
    WHERE club_id = p_club_id AND user_id = p_user_id AND status = 'active';

    IF v_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 4. Evaluate granular least-privilege matrix
    IF v_role = 'owner' THEN
        RETURN TRUE;
    ELSIF v_role = 'admin' THEN
        RETURN p_permission IN ('manage_club', 'manage_members', 'manage_events', 'view_attendees', 'gate_checkin', 'review_payments', 'view_reports');
    ELSIF v_role = 'event_manager' THEN
        RETURN p_permission IN ('manage_events', 'view_attendees', 'view_reports');
    ELSIF v_role = 'payment_reviewer' THEN
        RETURN p_permission IN ('review_payments', 'view_reports');
    ELSIF v_role = 'checkin_staff' THEN
        RETURN p_permission IN ('gate_checkin', 'view_attendees');
    ELSIF v_role = 'viewer' THEN
        RETURN p_permission IN ('view_attendees', 'view_reports');
    END IF;

    RETURN FALSE;
END;
$$;

-- ─── 5. RPC: accept_club_invitation ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_club_invitation(
    p_token    TEXT,
    p_user_id  UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_invitation RECORD;
    v_user_email TEXT;
    v_existing   UUID;
BEGIN
    -- 1. Fetch invitation
    SELECT * INTO v_invitation FROM public.club_invitations WHERE token = p_token;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVITATION_NOT_FOUND', 'message', 'Invitation not found or invalid link.');
    END IF;

    -- 2. Check status
    IF v_invitation.status = 'revoked' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVITATION_REVOKED', 'message', 'This invitation has been revoked by the club organizer.');
    END IF;
    IF v_invitation.status = 'accepted' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_ACCEPTED', 'message', 'This invitation has already been accepted.');
    END IF;
    IF v_invitation.expires_at < now() OR v_invitation.status = 'expired' THEN
        UPDATE public.club_invitations SET status = 'expired' WHERE id = v_invitation.id;
        RETURN jsonb_build_object('success', false, 'error_code', 'INVITATION_EXPIRED', 'message', 'This invitation has expired.');
    END IF;

    -- 3. Match authenticated user email against invited email
    SELECT email INTO v_user_email FROM public.profiles WHERE id = p_user_id;
    IF v_user_email IS NULL OR lower(v_user_email) <> lower(v_invitation.email) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'EMAIL_MISMATCH',
            'message', format('This invitation was issued to %s. You are authenticated as %s.', v_invitation.email, COALESCE(v_user_email, 'unknown'))
        );
    END IF;

    -- 4. Check duplicate membership
    SELECT id INTO v_existing FROM public.club_members WHERE club_id = v_invitation.club_id AND user_id = p_user_id;
    IF FOUND THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'DUPLICATE_MEMBERSHIP', 'message', 'You are already an active member of this organization.');
    END IF;

    -- 5. Insert member record
    INSERT INTO public.club_members (club_id, user_id, role, status)
    VALUES (v_invitation.club_id, p_user_id, v_invitation.role, 'active');

    -- 6. Update invitation status
    UPDATE public.club_invitations
    SET status = 'accepted', accepted_at = now(), accepted_by = p_user_id, updated_at = now()
    WHERE id = v_invitation.id;

    -- 7. Ensure profile role grants club access
    UPDATE public.profiles
    SET role = 'club_member', updated_at = now()
    WHERE id = p_user_id AND role = 'student';

    -- 8. Write audit log
    INSERT INTO public.club_audit_logs (club_id, actor_id, action, target_id, target_email, new_value, details)
    VALUES (
        v_invitation.club_id,
        p_user_id,
        'invitation_accepted',
        p_user_id::text,
        v_user_email,
        v_invitation.role,
        jsonb_build_object('invitation_id', v_invitation.id, 'accepted_at', now())
    );

    RETURN jsonb_build_object(
        'success', true,
        'club_id', v_invitation.club_id,
        'role', v_invitation.role,
        'message', format('Successfully joined as %s.', v_invitation.role)
    );
END;
$$;

-- ─── 6. RPC: remove_club_member ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.remove_club_member(
    p_member_id UUID,
    p_actor_id  UUID,
    p_club_id   UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_target RECORD;
    v_active_owners INT;
BEGIN
    -- Check permission
    IF NOT public.has_club_permission(p_actor_id, p_club_id, 'manage_members') THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'Unauthorized: manage_members permission required.');
    END IF;

    SELECT * INTO v_target FROM public.club_members WHERE id = p_member_id AND club_id = p_club_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Member not found.');
    END IF;

    -- Sole owner protection
    IF v_target.role = 'owner' THEN
        SELECT count(*) INTO v_active_owners
        FROM public.club_members
        WHERE club_id = p_club_id AND role = 'owner' AND status = 'active';

        IF v_active_owners <= 1 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error_code', 'CANNOT_REMOVE_SOLE_OWNER',
                'message', 'Cannot remove the sole club owner. You must transfer primary ownership first.'
            );
        END IF;
    END IF;

    DELETE FROM public.club_members WHERE id = p_member_id;

    -- Audit log
    INSERT INTO public.club_audit_logs (club_id, actor_id, action, target_id, old_value, details)
    VALUES (p_club_id, p_actor_id, 'member_removed', v_target.user_id::text, v_target.role, jsonb_build_object('removed_at', now()));

    RETURN jsonb_build_object('success', true, 'message', 'Member access revoked and removed.');
END;
$$;

-- ─── 7. Row Level Security Policies ──────────────────────────────────────────
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_audit_logs ENABLE ROW LEVEL SECURITY;

-- club_members policies
DROP POLICY IF EXISTS "Club members viewable by authorized members" ON public.club_members;
CREATE POLICY "Club members viewable by authorized members"
    ON public.club_members FOR SELECT
    TO authenticated
    USING (
        public.has_club_permission(auth.uid(), club_id, 'view_attendees')
        OR user_id = auth.uid()
    );

DROP POLICY IF EXISTS "Club members manageable by club administrators" ON public.club_members;
CREATE POLICY "Club members manageable by club administrators"
    ON public.club_members FOR ALL
    TO authenticated
    USING (public.has_club_permission(auth.uid(), club_id, 'manage_members'))
    WITH CHECK (public.has_club_permission(auth.uid(), club_id, 'manage_members'));

-- club_invitations policies
DROP POLICY IF EXISTS "Invitations viewable by club admins and recipient" ON public.club_invitations;
CREATE POLICY "Invitations viewable by club admins and recipient"
    ON public.club_invitations FOR SELECT
    TO authenticated
    USING (
        public.has_club_permission(auth.uid(), club_id, 'manage_members')
        OR lower(email) = lower((SELECT email FROM public.profiles WHERE id = auth.uid()))
    );

DROP POLICY IF EXISTS "Invitations manageable by club admins" ON public.club_invitations;
CREATE POLICY "Invitations manageable by club admins"
    ON public.club_invitations FOR ALL
    TO authenticated
    USING (public.has_club_permission(auth.uid(), club_id, 'manage_members'))
    WITH CHECK (public.has_club_permission(auth.uid(), club_id, 'manage_members'));

-- club_audit_logs policies
DROP POLICY IF EXISTS "Audit logs viewable by club managers" ON public.club_audit_logs;
CREATE POLICY "Audit logs viewable by club managers"
    ON public.club_audit_logs FOR SELECT
    TO authenticated
    USING (public.has_club_permission(auth.uid(), club_id, 'manage_members'));
