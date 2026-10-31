-- ══════════════════════════════════════════════════════════════════════════════
-- FESTFLOW DATABASE MIGRATION 029: FIX PROFILE ROLE ESCALATION TRIGGER & RLS
-- ══════════════════════════════════════════════════════════════════════════════
-- Resolves:
-- 1. PostgreSQL error: record "old" has no field "is_verified" on public.profiles
-- 2. PostgreSQL error: new row violates row-level security policy for table "student_profiles"
--
-- Root Causes:
-- 1. Migration 015 created trigger trg_prevent_profile_role_escalation on public.profiles
--    that checked `OLD.is_verified`. However, `is_verified` only exists on
--    public.club_profiles, NOT on public.profiles. Whenever any student or organizer
--    updated their profile, PostgreSQL threw this error.
-- 2. Migration 001 created SELECT and UPDATE policies on public.student_profiles,
--    but omitted an INSERT policy for authenticated users, causing any insert or
--    upsert by students to fail with an RLS violation.
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

-- 4. Add missing INSERT policy on public.student_profiles for authenticated users
DROP POLICY IF EXISTS "students can insert own student profile" ON public.student_profiles;
CREATE POLICY "students can insert own student profile"
  ON public.student_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

-- 5. Add missing INSERT policy on public.club_profiles for authenticated users
DROP POLICY IF EXISTS "club organizers can insert own club profile" ON public.club_profiles;
CREATE POLICY "club organizers can insert own club profile"
  ON public.club_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);
