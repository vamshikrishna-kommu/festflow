-- ══════════════════════════════════════════════════════════════════════════════
-- FESTFLOW DATABASE MIGRATION 029: FIX PROFILE ROLE ESCALATION TRIGGER
-- ══════════════════════════════════════════════════════════════════════════════
-- Resolves PostgreSQL error: record "old" has no field "is_verified"
--
-- Root Cause:
-- Migration 015 created trigger trg_prevent_profile_role_escalation on public.profiles
-- that checked `OLD.is_verified`. However, `is_verified` only exists on
-- public.club_profiles, NOT on public.profiles. Whenever a student or organizer
-- updated their display name in public.profiles, PostgreSQL threw this error.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Fix trigger function for public.profiles (only checks role)
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Only check role on public.profiles (is_verified does not exist here)
    IF (OLD.role IS DISTINCT FROM NEW.role) THEN
        -- Allow if executed by service_role or platform_admin
        IF auth.uid() IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin'
        ) THEN
            RAISE EXCEPTION 'Unauthorized: Users cannot modify their role directly.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- 2. Re-attach clean trigger to public.profiles
DROP TRIGGER IF EXISTS trg_prevent_profile_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- 3. Separate trigger for public.club_profiles to protect is_verified
CREATE OR REPLACE FUNCTION public.prevent_club_verification_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF (OLD.is_verified IS DISTINCT FROM NEW.is_verified) THEN
        IF auth.uid() IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin'
        ) THEN
            RAISE EXCEPTION 'Unauthorized: Only platform administrators can verify clubs.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_club_verification_escalation ON public.club_profiles;
CREATE TRIGGER trg_prevent_club_verification_escalation
BEFORE UPDATE ON public.club_profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_club_verification_escalation();
