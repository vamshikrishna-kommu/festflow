-- =============================================================================
-- FESTFLOW MIGRATION 044: PLATFORM ADMIN OPERATIONS & RLS REPAIR
-- =============================================================================
-- Solves:
-- 1. Hardens check_is_platform_admin to always recognize platform owner email
-- 2. Automatically promotes vamshikrishnakommu0908@gmail.com to platform_admin
-- 3. Provides Security Definer RPCs for platform settings & announcements
-- 4. Corrects RLS policies so settings and announcements cannot be blocked
-- =============================================================================

-- 1. Harden check_is_platform_admin
CREATE OR REPLACE FUNCTION public.check_is_platform_admin(
  p_user_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
      AND (
        role = 'platform_admin'
        OR LOWER(TRIM(email)) = 'vamshikrishnakommu0908@gmail.com'
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.platform_admins
    WHERE user_id = p_user_id AND is_active = true
  );
$$;

COMMENT ON FUNCTION public.check_is_platform_admin(uuid) IS
  'Authoritatively checks if user is a platform administrator or super admin owner.';

GRANT EXECUTE ON FUNCTION public.check_is_platform_admin(uuid) TO authenticated, anon;


-- 2. Authoritative Promotion of Super Admin Account
DO $$
DECLARE
    v_admin_id UUID;
BEGIN
    SELECT id INTO v_admin_id
    FROM public.profiles
    WHERE LOWER(TRIM(email)) = 'vamshikrishnakommu0908@gmail.com';

    IF v_admin_id IS NOT NULL THEN
        -- Promote profile to platform_admin
        UPDATE public.profiles
        SET role = 'platform_admin',
            updated_at = now()
        WHERE id = v_admin_id;

        -- Ensure entry in platform_admins
        INSERT INTO public.platform_admins (
            user_id,
            role,
            permissions,
            is_active,
            assigned_by
        ) VALUES (
            v_admin_id,
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
            v_admin_id
        ) ON CONFLICT (user_id) DO UPDATE SET
            role = 'super_admin',
            is_active = true,
            updated_at = now();
    END IF;
END $$;


-- 3. Security Definer RPC: Platform Settings Update
CREATE OR REPLACE FUNCTION public.admin_update_setting(
    p_key TEXT,
    p_value JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
BEGIN
    IF v_caller_id IS NULL OR NOT public.check_is_platform_admin(v_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators can modify settings.';
    END IF;

    INSERT INTO public.platform_settings (
        key,
        value,
        updated_by,
        updated_at
    ) VALUES (
        p_key,
        p_value,
        v_caller_id,
        now()
    )
    ON CONFLICT (key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();

    -- Immutable audit log
    INSERT INTO public.admin_audit_logs (
        admin_id,
        admin_email,
        action,
        target_entity,
        target_record_id,
        new_state,
        reason
    )
    SELECT
        v_caller_id,
        email,
        'update_platform_setting',
        'platform_settings',
        p_key,
        jsonb_build_object(p_key, p_value),
        'Platform setting updated via secure RPC.'
    FROM public.profiles
    WHERE id = v_caller_id;

    RETURN jsonb_build_object('success', true, 'key', p_key);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_setting(TEXT, JSONB) TO authenticated;


-- 4. Security Definer RPC: Platform Announcement Management
CREATE OR REPLACE FUNCTION public.admin_save_announcement(
    p_title TEXT,
    p_content TEXT,
    p_banner_url TEXT DEFAULT NULL,
    p_target_audience TEXT DEFAULT 'all',
    p_is_pinned BOOLEAN DEFAULT false,
    p_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_res_id UUID;
    v_caller_email TEXT;
BEGIN
    IF v_caller_id IS NULL OR NOT public.check_is_platform_admin(v_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators can publish announcements.';
    END IF;

    SELECT email INTO v_caller_email FROM public.profiles WHERE id = v_caller_id;

    IF p_id IS NULL THEN
        -- Insert new announcement
        INSERT INTO public.platform_announcements (
            title,
            content,
            banner_url,
            target_audience,
            is_pinned,
            status,
            created_by,
            published_at,
            created_at,
            updated_at
        ) VALUES (
            p_title,
            p_content,
            p_banner_url,
            COALESCE(p_target_audience, 'all'),
            COALESCE(p_is_pinned, false),
            'published',
            v_caller_id,
            now(),
            now(),
            now()
        )
        RETURNING id INTO v_res_id;
    ELSE
        -- Update existing announcement
        UPDATE public.platform_announcements
        SET
            title = p_title,
            content = p_content,
            banner_url = p_banner_url,
            target_audience = COALESCE(p_target_audience, 'all'),
            is_pinned = COALESCE(p_is_pinned, false),
            updated_at = now()
        WHERE id = p_id
        RETURNING id INTO v_res_id;

        IF v_res_id IS NULL THEN
            RAISE EXCEPTION 'Announcement with ID % not found.', p_id;
        END IF;
    END IF;

    -- Audit trail
    INSERT INTO public.admin_audit_logs (
        admin_id,
        admin_email,
        action,
        target_entity,
        target_record_id,
        reason
    ) VALUES (
        v_caller_id,
        COALESCE(v_caller_email, 'admin@festflow.online'),
        CASE WHEN p_id IS NULL THEN 'create_announcement' ELSE 'update_announcement' END,
        'platform_announcements',
        v_res_id::text,
        format('Announcement: %s', p_title)
    );

    RETURN jsonb_build_object('success', true, 'id', v_res_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_save_announcement(TEXT, TEXT, TEXT, TEXT, BOOLEAN, UUID) TO authenticated;


CREATE OR REPLACE FUNCTION public.admin_delete_announcement(
    p_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_email TEXT;
BEGIN
    IF v_caller_id IS NULL OR NOT public.check_is_platform_admin(v_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators can delete announcements.';
    END IF;

    SELECT email INTO v_caller_email FROM public.profiles WHERE id = v_caller_id;

    DELETE FROM public.platform_announcements WHERE id = p_id;

    INSERT INTO public.admin_audit_logs (
        admin_id,
        admin_email,
        action,
        target_entity,
        target_record_id,
        reason
    ) VALUES (
        v_caller_id,
        COALESCE(v_caller_email, 'admin@festflow.online'),
        'delete_announcement',
        'platform_announcements',
        p_id::text,
        'Announcement deleted by administrator'
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_announcement(UUID) TO authenticated;
