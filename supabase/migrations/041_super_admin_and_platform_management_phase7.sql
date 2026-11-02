-- =============================================================================
-- FESTFLOW DATABASE MIGRATION 041: SUPER ADMIN & PLATFORM MANAGEMENT (PHASE 7)
-- =============================================================================
-- Comprehensive platform administration architecture:
-- 1. Master Colleges directory with verification and status tracking
-- 2. Platform Admins sub-profile table with granular role-based permissions
-- 3. Immutable Administrative Audit Logs
-- 4. Platform Announcements for targeted community broadcasting
-- 5. Platform Settings & Feature Flags key-value store
-- 6. Event Moderation columns on public.events
-- 7. Account Suspension & Status columns on profiles & club_profiles
-- 8. Platform Admin RLS Policies across all core tables
-- 9. Security Definer RPC Functions for administrative operations
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Master Colleges Directory
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.colleges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    code TEXT,
    domain TEXT,
    city TEXT,
    state TEXT,
    country TEXT NOT NULL DEFAULT 'India',
    logo_url TEXT,
    website TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_verification', 'suspended')),
    verification_notes TEXT,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_colleges_status ON public.colleges(status);
CREATE INDEX IF NOT EXISTS idx_colleges_name ON public.colleges(name);

ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;

-- Colleges RLS:
-- Public can view active colleges (needed for registration dropdowns and discovery)
DROP POLICY IF EXISTS "Public can view active colleges" ON public.colleges;
CREATE POLICY "Public can view active colleges"
    ON public.colleges FOR SELECT
    USING (status = 'active' OR (auth.uid() IS NOT NULL AND public.check_is_platform_admin(auth.uid())));

-- Platform Admins can manage all colleges
DROP POLICY IF EXISTS "Platform admins manage colleges" ON public.colleges;
CREATE POLICY "Platform admins manage colleges"
    ON public.colleges FOR ALL
    TO authenticated
    USING (public.check_is_platform_admin(auth.uid()))
    WITH CHECK (public.check_is_platform_admin(auth.uid()));


-- -----------------------------------------------------------------------------
-- 2. Platform Administrators & Granular Roles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin', 'platform_moderator', 'college_admin', 'support_admin')),
    permissions TEXT[] NOT NULL DEFAULT ARRAY[
        'manage_colleges',
        'verify_clubs',
        'moderate_events',
        'review_reports',
        'manage_announcements',
        'view_analytics',
        'manage_settings',
        'manage_finances',
        'manage_admins'
    ]::TEXT[],
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_admins_user_id ON public.platform_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_admins_role ON public.platform_admins(role);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Platform Admins RLS:
DROP POLICY IF EXISTS "Platform admins view admin team" ON public.platform_admins;
CREATE POLICY "Platform admins view admin team"
    ON public.platform_admins FOR SELECT
    TO authenticated
    USING (public.check_is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "Platform admins manage admin team" ON public.platform_admins;
CREATE POLICY "Platform admins manage admin team"
    ON public.platform_admins FOR ALL
    TO authenticated
    USING (public.check_is_platform_admin(auth.uid()))
    WITH CHECK (public.check_is_platform_admin(auth.uid()));


-- -----------------------------------------------------------------------------
-- 3. Immutable Administrative Audit Logs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    admin_email TEXT NOT NULL,
    action TEXT NOT NULL,
    target_entity TEXT NOT NULL,
    target_record_id TEXT,
    previous_state JSONB,
    new_state JSONB,
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target ON public.admin_audit_logs(target_entity, target_record_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at DESC);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit Logs RLS:
-- Read-only for platform admins
DROP POLICY IF EXISTS "Platform admins view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Platform admins view audit logs"
    ON public.admin_audit_logs FOR SELECT
    TO authenticated
    USING (public.check_is_platform_admin(auth.uid()));

-- Insert permitted for platform admins
DROP POLICY IF EXISTS "Platform admins insert audit logs" ON public.admin_audit_logs;
CREATE POLICY "Platform admins insert audit logs"
    ON public.admin_audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (public.check_is_platform_admin(auth.uid()));

-- UPDATE and DELETE are intentionally omitted to maintain strict immutability.


-- -----------------------------------------------------------------------------
-- 4. Platform Announcements
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    banner_url TEXT,
    target_audience TEXT NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'students', 'clubs', 'colleges')),
    target_college_id UUID REFERENCES public.colleges(id) ON DELETE SET NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    published_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_announcements_audience ON public.platform_announcements(target_audience, status);
CREATE INDEX IF NOT EXISTS idx_platform_announcements_pinned ON public.platform_announcements(is_pinned DESC, published_at DESC);

ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;

-- Announcements RLS:
DROP POLICY IF EXISTS "Public can view active platform announcements" ON public.platform_announcements;
CREATE POLICY "Public can view active platform announcements"
    ON public.platform_announcements FOR SELECT
    USING (
        status = 'published' AND
        (expires_at IS NULL OR expires_at > now()) OR
        (auth.uid() IS NOT NULL AND public.check_is_platform_admin(auth.uid()))
    );

DROP POLICY IF EXISTS "Platform admins manage announcements" ON public.platform_announcements;
CREATE POLICY "Platform admins manage announcements"
    ON public.platform_announcements FOR ALL
    TO authenticated
    USING (public.check_is_platform_admin(auth.uid()))
    WITH CHECK (public.check_is_platform_admin(auth.uid()));


-- -----------------------------------------------------------------------------
-- 5. Platform Settings Key-Value Store
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT false,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Settings RLS:
DROP POLICY IF EXISTS "Public view public platform settings" ON public.platform_settings;
CREATE POLICY "Public view public platform settings"
    ON public.platform_settings FOR SELECT
    USING (is_public = true OR (auth.uid() IS NOT NULL AND public.check_is_platform_admin(auth.uid())));

DROP POLICY IF EXISTS "Platform admins manage settings" ON public.platform_settings;
CREATE POLICY "Platform admins manage settings"
    ON public.platform_settings FOR ALL
    TO authenticated
    USING (public.check_is_platform_admin(auth.uid()))
    WITH CHECK (public.check_is_platform_admin(auth.uid()));

-- Seed default safe platform configuration
INSERT INTO public.platform_settings (key, value, description, is_public)
VALUES
    ('maintenance_mode', 'false'::jsonb, 'Global platform maintenance toggle', true),
    ('student_registration_enabled', 'true'::jsonb, 'Allow student event registrations across platform', true),
    ('club_event_creation_enabled', 'true'::jsonb, 'Allow clubs to publish new events', true),
    ('require_event_approval', 'false'::jsonb, 'Require Super Admin moderation review before events go live', false),
    ('max_upload_size_mb', '10'::jsonb, 'Maximum allowed media upload size in megabytes', true),
    ('allowed_upload_types', '["image/jpeg", "image/png", "image/webp"]'::jsonb, 'Permitted MIME types for file uploads', true),
    ('support_email', '"support@festflow.online"'::jsonb, 'Official support contact address', true),
    ('support_phone', '"+91-9876543210"'::jsonb, 'Official emergency platform contact number', true),
    ('platform_fee_percentage', '0'::jsonb, 'Platform service fee on paid tickets (UPI direct to club preserves 0)', true),
    ('announcement_banner_enabled', 'true'::jsonb, 'Display platform-wide notice banner on public pages', true)
ON CONFLICT (key) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 6. Add Moderation Columns to public.events (Non-breaking)
-- -----------------------------------------------------------------------------
ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved' 
        CHECK (moderation_status IN ('approved', 'pending_approval', 'rejected', 'changes_requested', 'unpublished')),
    ADD COLUMN IF NOT EXISTS moderation_notes TEXT,
    ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_moderation_status ON public.events(moderation_status);


-- -----------------------------------------------------------------------------
-- 7. Add Account Status & College Linking to Profiles (Non-breaking)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' 
        CHECK (status IN ('active', 'suspended', 'pending_verification')),
    ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
    ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS suspended_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.club_profiles
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' 
        CHECK (status IN ('active', 'suspended', 'pending_verification')),
    ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
    ADD COLUMN IF NOT EXISTS verification_notes TEXT,
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS college_id UUID REFERENCES public.colleges(id) ON DELETE SET NULL;

ALTER TABLE public.student_profiles
    ADD COLUMN IF NOT EXISTS college_id UUID REFERENCES public.colleges(id) ON DELETE SET NULL;


-- -----------------------------------------------------------------------------
-- 8. Platform Admin RLS Policies for Community Reports
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'community_reports'
    ) THEN
        DROP POLICY IF EXISTS "Platform admins view community reports" ON public.community_reports;
        CREATE POLICY "Platform admins view community reports"
            ON public.community_reports FOR SELECT
            TO authenticated
            USING (public.check_is_platform_admin(auth.uid()));

        DROP POLICY IF EXISTS "Platform admins update community reports" ON public.community_reports;
        CREATE POLICY "Platform admins update community reports"
            ON public.community_reports FOR UPDATE
            TO authenticated
            USING (public.check_is_platform_admin(auth.uid()))
            WITH CHECK (public.check_is_platform_admin(auth.uid()));
    END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 9. Security Definer RPC Functions for Administrative Operations
-- -----------------------------------------------------------------------------

-- 9.1 Secure Initial Super Admin Bootstrap (Can only run if NO admin exists)
CREATE OR REPLACE FUNCTION public.bootstrap_initial_super_admin(
    p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_admin_count INT;
BEGIN
    -- 1. Check if any platform administrator already exists
    SELECT COUNT(*) INTO v_admin_count
    FROM public.profiles
    WHERE role = 'platform_admin';

    IF v_admin_count > 0 THEN
        RAISE EXCEPTION 'A platform administrator already exists. Bootstrap process is permanently closed.';
    END IF;

    -- 2. Find target user profile by email
    SELECT id INTO v_user_id
    FROM public.profiles
    WHERE LOWER(email) = LOWER(TRIM(p_email));

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User profile with email % was not found. The user must register first.', p_email;
    END IF;

    -- 3. Promote profile to platform_admin
    UPDATE public.profiles
    SET role = 'platform_admin',
        updated_at = now()
    WHERE id = v_user_id;

    -- 4. Insert into platform_admins table as super_admin
    INSERT INTO public.platform_admins (
        user_id,
        role,
        permissions,
        is_active,
        assigned_by
    ) VALUES (
        v_user_id,
        'super_admin',
        ARRAY[
            'manage_colleges',
            'verify_clubs',
            'moderate_events',
            'review_reports',
            'manage_announcements',
            'view_analytics',
            'manage_settings',
            'manage_finances',
            'manage_admins'
        ]::TEXT[],
        true,
        v_user_id
    ) ON CONFLICT (user_id) DO UPDATE SET
        role = 'super_admin',
        is_active = true,
        updated_at = now();

    -- 5. Record initial audit log
    INSERT INTO public.admin_audit_logs (
        admin_id,
        admin_email,
        action,
        target_entity,
        target_record_id,
        reason
    ) VALUES (
        v_user_id,
        p_email,
        'bootstrap_initial_super_admin',
        'platform_admins',
        v_user_id::text,
        'Initial Super Admin promoted via secure bootstrap protocol.'
    );

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'email', p_email,
        'role', 'super_admin'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bootstrap_initial_super_admin(TEXT) TO authenticated, anon;


-- 9.2 Real Platform Metrics Aggregator
CREATE OR REPLACE FUNCTION public.admin_get_platform_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_total_students INT := 0;
    v_total_clubs INT := 0;
    v_total_verified_clubs INT := 0;
    v_total_colleges INT := 0;
    v_total_events INT := 0;
    v_total_published_events INT := 0;
    v_total_pending_moderation INT := 0;
    v_total_registrations INT := 0;
    v_total_pending_payments INT := 0;
    v_total_verified_payments INT := 0;
    v_total_issued_passes INT := 0;
    v_total_check_ins INT := 0;
    v_total_revenue NUMERIC(12, 2) := 0.00;
BEGIN
    -- Verify caller is platform_admin
    IF v_caller_id IS NULL OR NOT public.check_is_platform_admin(v_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators can access global platform metrics.';
    END IF;

    -- Total Students
    SELECT COUNT(*) INTO v_total_students FROM public.profiles WHERE role = 'student';

    -- Total Clubs & Verified Clubs
    SELECT COUNT(*), COUNT(*) FILTER (WHERE is_verified = true)
    INTO v_total_clubs, v_total_verified_clubs
    FROM public.club_profiles;

    -- Total Colleges
    SELECT COUNT(*) INTO v_total_colleges FROM public.colleges;

    -- Events Counts
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'published'),
        COUNT(*) FILTER (WHERE moderation_status = 'pending_approval')
    INTO v_total_events, v_total_published_events, v_total_pending_moderation
    FROM public.events;

    -- Registrations Counts
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'confirmed' AND ticket_issued_at IS NOT NULL)
    INTO v_total_registrations, v_total_issued_passes
    FROM public.registrations;

    -- Payments Counts & Revenue
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'payment_submissions'
    ) THEN
        SELECT 
            COUNT(*) FILTER (WHERE status = 'pending'),
            COUNT(*) FILTER (WHERE status = 'verified'),
            COALESCE(SUM(amount) FILTER (WHERE status = 'verified'), 0.00)
        INTO v_total_pending_payments, v_total_verified_payments, v_total_revenue
        FROM public.payment_submissions;
    END IF;

    -- Total Check-ins
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'check_ins'
    ) THEN
        SELECT COUNT(*) INTO v_total_check_ins FROM public.check_ins;
    END IF;

    RETURN jsonb_build_object(
        'total_students', v_total_students,
        'total_clubs', v_total_clubs,
        'total_verified_clubs', v_total_verified_clubs,
        'total_colleges', v_total_colleges,
        'total_events', v_total_events,
        'total_published_events', v_total_published_events,
        'total_pending_moderation', v_total_pending_moderation,
        'total_registrations', v_total_registrations,
        'total_pending_payments', v_total_pending_payments,
        'total_verified_payments', v_total_verified_payments,
        'total_issued_passes', v_total_issued_passes,
        'total_check_ins', v_total_check_ins,
        'total_revenue_inr', v_total_revenue
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_platform_metrics() TO authenticated;


-- 9.3 Event Moderation Action
CREATE OR REPLACE FUNCTION public.admin_moderate_event(
    p_event_id UUID,
    p_action TEXT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_admin_email TEXT;
    v_event RECORD;
    v_new_moderation TEXT;
    v_new_status TEXT;
BEGIN
    IF v_admin_id IS NULL OR NOT public.check_is_platform_admin(v_admin_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators can moderate events.';
    END IF;

    SELECT email INTO v_admin_email FROM public.profiles WHERE id = v_admin_id;

    SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Event with ID % not found.', p_event_id;
    END IF;

    IF p_action = 'approve' THEN
        v_new_moderation := 'approved';
        v_new_status := 'published';
    ELSIF p_action = 'reject' THEN
        v_new_moderation := 'rejected';
        v_new_status := 'draft';
    ELSIF p_action = 'request_changes' THEN
        v_new_moderation := 'changes_requested';
        v_new_status := 'draft';
    ELSIF p_action = 'unpublish' THEN
        v_new_moderation := 'unpublished';
        v_new_status := 'draft';
    ELSE
        RAISE EXCEPTION 'Invalid moderation action: %', p_action;
    END IF;

    -- Update event without deleting registrations or payment history
    UPDATE public.events
    SET moderation_status = v_new_moderation,
        moderation_notes = p_reason,
        moderated_at = now(),
        moderated_by = v_admin_id,
        status = v_new_status,
        updated_at = now()
    WHERE id = p_event_id;

    -- Record immutable audit log
    INSERT INTO public.admin_audit_logs (
        admin_id,
        admin_email,
        action,
        target_entity,
        target_record_id,
        previous_state,
        new_state,
        reason
    ) VALUES (
        v_admin_id,
        v_admin_email,
        'moderate_event_' || p_action,
        'events',
        p_event_id::text,
        jsonb_build_object('moderation_status', v_event.moderation_status, 'status', v_event.status),
        jsonb_build_object('moderation_status', v_new_moderation, 'status', v_new_status),
        p_reason
    );

    RETURN jsonb_build_object(
        'success', true,
        'event_id', p_event_id,
        'moderation_status', v_new_moderation,
        'status', v_new_status
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_moderate_event(UUID, TEXT, TEXT) TO authenticated;


-- 9.4 Club Verification and Suspension
CREATE OR REPLACE FUNCTION public.admin_update_club_status(
    p_club_id UUID,
    p_action TEXT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_admin_email TEXT;
    v_club RECORD;
    v_is_verified BOOLEAN;
    v_status TEXT;
BEGIN
    IF v_admin_id IS NULL OR NOT public.check_is_platform_admin(v_admin_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators can manage club verification and status.';
    END IF;

    SELECT email INTO v_admin_email FROM public.profiles WHERE id = v_admin_id;

    SELECT * INTO v_club FROM public.club_profiles WHERE profile_id = p_club_id OR id = p_club_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Club profile not found.';
    END IF;

    v_is_verified := v_club.is_verified;
    v_status := COALESCE(v_club.status, 'active');

    IF p_action = 'verify' THEN
        v_is_verified := true;
        v_status := 'active';
    ELSIF p_action = 'reject_verification' THEN
        v_is_verified := false;
    ELSIF p_action = 'suspend' THEN
        v_status := 'suspended';
    ELSIF p_action = 'reactivate' THEN
        v_status := 'active';
    ELSE
        RAISE EXCEPTION 'Invalid club action: %', p_action;
    END IF;

    UPDATE public.club_profiles
    SET is_verified = v_is_verified,
        status = v_status,
        verification_notes = p_reason,
        verified_at = CASE WHEN p_action = 'verify' THEN now() ELSE verified_at END,
        verified_by = CASE WHEN p_action = 'verify' THEN v_admin_id ELSE verified_by END,
        suspension_reason = CASE WHEN p_action = 'suspend' THEN p_reason ELSE suspension_reason END,
        updated_at = now()
    WHERE id = v_club.id;

    -- Record audit log
    INSERT INTO public.admin_audit_logs (
        admin_id,
        admin_email,
        action,
        target_entity,
        target_record_id,
        previous_state,
        new_state,
        reason
    ) VALUES (
        v_admin_id,
        v_admin_email,
        'update_club_' || p_action,
        'club_profiles',
        v_club.id::text,
        jsonb_build_object('is_verified', v_club.is_verified, 'status', v_club.status),
        jsonb_build_object('is_verified', v_is_verified, 'status', v_status),
        p_reason
    );

    RETURN jsonb_build_object(
        'success', true,
        'club_id', v_club.id,
        'is_verified', v_is_verified,
        'status', v_status
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_club_status(UUID, TEXT, TEXT) TO authenticated;


-- 9.5 Student Profile Suspension & Reactivation
CREATE OR REPLACE FUNCTION public.admin_update_student_status(
    p_student_id UUID,
    p_action TEXT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_admin_email TEXT;
    v_profile RECORD;
    v_new_status TEXT;
BEGIN
    IF v_admin_id IS NULL OR NOT public.check_is_platform_admin(v_admin_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators can manage student accounts.';
    END IF;

    SELECT email INTO v_admin_email FROM public.profiles WHERE id = v_admin_id;

    SELECT * INTO v_profile FROM public.profiles WHERE id = p_student_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Student profile with ID % not found.', p_student_id;
    END IF;

    IF p_action = 'suspend' THEN
        v_new_status := 'suspended';
    ELSIF p_action = 'reactivate' THEN
        v_new_status := 'active';
    ELSE
        RAISE EXCEPTION 'Invalid student status action: %', p_action;
    END IF;

    UPDATE public.profiles
    SET status = v_new_status,
        suspension_reason = CASE WHEN p_action = 'suspend' THEN p_reason ELSE NULL END,
        suspended_at = CASE WHEN p_action = 'suspend' THEN now() ELSE NULL END,
        suspended_by = CASE WHEN p_action = 'suspend' THEN v_admin_id ELSE NULL END,
        updated_at = now()
    WHERE id = p_student_id;

    INSERT INTO public.admin_audit_logs (
        admin_id,
        admin_email,
        action,
        target_entity,
        target_record_id,
        previous_state,
        new_state,
        reason
    ) VALUES (
        v_admin_id,
        v_admin_email,
        'student_' || p_action,
        'profiles',
        p_student_id::text,
        jsonb_build_object('status', v_profile.status),
        jsonb_build_object('status', v_new_status),
        p_reason
    );

    RETURN jsonb_build_object(
        'success', true,
        'student_id', p_student_id,
        'status', v_new_status
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_student_status(UUID, TEXT, TEXT) TO authenticated;


-- 9.6 Authorized Payment Dispute Override (Strictly Audited)
CREATE OR REPLACE FUNCTION public.admin_payment_override(
    p_submission_id UUID,
    p_action TEXT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_admin_email TEXT;
    v_sub RECORD;
    v_new_status TEXT;
    v_new_reg_status TEXT;
BEGIN
    IF v_admin_id IS NULL OR NOT public.check_is_platform_admin(v_admin_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators can perform payment overrides.';
    END IF;

    IF TRIM(COALESCE(p_reason, '')) = '' THEN
        RAISE EXCEPTION 'An explicit written audit reason is strictly mandatory for administrative payment overrides.';
    END IF;

    SELECT email INTO v_admin_email FROM public.profiles WHERE id = v_admin_id;

    SELECT * INTO v_sub FROM public.payment_submissions WHERE id = p_submission_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment submission with ID % not found.', p_submission_id;
    END IF;

    IF p_action = 'verify' THEN
        v_new_status := 'verified';
        v_new_reg_status := 'confirmed';
    ELSIF p_action = 'reject' THEN
        v_new_status := 'rejected';
        v_new_reg_status := 'rejected';
    ELSE
        RAISE EXCEPTION 'Invalid payment override action: %', p_action;
    END IF;

    -- Update submission
    UPDATE public.payment_submissions
    SET status = v_new_status,
        admin_notes = p_reason,
        verified_at = CASE WHEN p_action = 'verify' THEN now() ELSE verified_at END,
        verified_by = v_admin_id,
        updated_at = now()
    WHERE id = p_submission_id;

    -- Update linked registration
    UPDATE public.registrations
    SET status = v_new_reg_status,
        ticket_issued_at = CASE WHEN p_action = 'verify' THEN COALESCE(ticket_issued_at, now()) ELSE ticket_issued_at END,
        updated_at = now()
    WHERE id = v_sub.registration_id;

    -- Record mandatory audit log
    INSERT INTO public.admin_audit_logs (
        admin_id,
        admin_email,
        action,
        target_entity,
        target_record_id,
        previous_state,
        new_state,
        reason,
        metadata
    ) VALUES (
        v_admin_id,
        v_admin_email,
        'payment_override_' || p_action,
        'payment_submissions',
        p_submission_id::text,
        jsonb_build_object('status', v_sub.status, 'registration_id', v_sub.registration_id),
        jsonb_build_object('status', v_new_status, 'registration_status', v_new_reg_status),
        p_reason,
        jsonb_build_object('utr', v_sub.utr, 'amount', v_sub.amount)
    );

    RETURN jsonb_build_object(
        'success', true,
        'submission_id', p_submission_id,
        'status', v_new_status,
        'registration_status', v_new_reg_status
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_payment_override(UUID, TEXT, TEXT) TO authenticated;

