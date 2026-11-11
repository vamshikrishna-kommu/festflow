-- =============================================================================
-- FestFlow — Migration 053: Complete Club RBAC, Ownership & Workflow Hardening
-- =============================================================================
-- AUTHORITATIVE BACKEND RBAC REPAIR (Preserves 001..052, zero destructive deletes):
-- 1. Guarantees club_members ownership invariant (auto-insert on club creation,
--    idempotent non-destructive backfill for legacy clubs without owner rows,
--    single-owner / sole-owner protection trigger + 'revoked' status support).
-- 2. Establishes canonical granular club permissions & role hierarchy in SQL
--    matching src/lib/rbac.ts identically, retiring legacy gate_checkin.
-- 3. Eliminates spoofed/bypassed helpers:
--    - Removes unconditional `IF p_club_id = p_user_id` bypass after ownership transfer.
--    - Integrates event_assignments strictly scoped to (club_id, event_id) for
--      active club_members only via public.has_event_permission(...).
--    - Secures check_is_event_organizer(...) against passive viewers/check-in staff.
--    - Guards against cross-club permission/role enumeration oracles.
-- 4. Replaces broken/owner-only RLS across club, event, registration, payment,
--    automation, coupon, waitlist, discussion, profile, and storage objects tables.
-- 5. Implements & hardens SECURITY DEFINER RPCs:
--    - invite_club_member, revoke_club_invitation, resend_club_invitation,
--      update_club_member_role, remove_club_member, transfer_club_ownership,
--      get_club_invitation_preview, accept_club_invitation, validate_event_coupon
--    - Preserves 052's 256-bit QR CSPRNG & SHA-256 logic inside review_payment_submission
--    - Repairs auth gaps in review_registration_*, offer_waitlist_slot,
--      cancel_event_by_organizer, cancel_registration*, send_event_reminders,
--      resend_registration_pass, resend_outbox_email, sync_team_member_registration,
--      sync_team_payment_approval, promote_waitlist_attendee,
--      get_automation_queue_metrics, get_event_attendance_stats, record_payment_failure,
--      get_event_meeting_details, admin_set_college_verification.
-- 6. Enables Supabase Realtime replication on club_members, club_invitations,
--    and event_assignments for live revocation/role-change propagation.
-- =============================================================================

-- ─── 1. Schema Constraints & Non-Destructive Owner Membership Backfill ────────

DO $$
DECLARE
  v_con RECORD;
BEGIN
  FOR v_con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.club_members'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.club_members DROP CONSTRAINT %I', v_con.conname);
  END LOOP;
END $$;

ALTER TABLE public.club_members
  ADD CONSTRAINT club_members_status_check
  CHECK (status IN ('active', 'suspended', 'revoked'));

-- Trigger: Automatically create active 'owner' membership whenever a club profile is created
CREATE OR REPLACE FUNCTION public.ensure_club_owner_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.profile_id IS NOT NULL THEN
    INSERT INTO public.club_members (club_id, user_id, role, status)
    VALUES (NEW.profile_id, NEW.profile_id, 'owner', 'active')
    ON CONFLICT (club_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_club_owner_membership ON public.club_profiles;
CREATE TRIGGER trg_ensure_club_owner_membership
AFTER INSERT ON public.club_profiles
FOR EACH ROW
EXECUTE FUNCTION public.ensure_club_owner_membership();

-- Non-destructive backfill for clubs lacking any active 'owner' row in club_members
INSERT INTO public.club_members (club_id, user_id, role, status)
SELECT cp.profile_id, cp.profile_id, 'owner', 'active'
FROM public.club_profiles cp
WHERE NOT EXISTS (
  SELECT 1
  FROM public.club_members cm
  WHERE cm.club_id = cp.profile_id
    AND cm.role = 'owner'
    AND cm.status = 'active'
)
ON CONFLICT (club_id, user_id) DO NOTHING;

-- Protect club_members invariants against direct SQL demotion/removal/owner forgery
CREATE OR REPLACE FUNCTION public.protect_club_member_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_allow_transfer TEXT := current_setting('festflow.allow_owner_transfer', true);
  v_active_owners INT;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF NEW.role = 'owner' AND NEW.status = 'active' THEN
      IF TG_OP = 'INSERT' OR (OLD.role IS DISTINCT FROM 'owner' OR OLD.status IS DISTINCT FROM 'active') THEN
        IF COALESCE(v_allow_transfer, '') <> 'on' THEN
          SELECT COUNT(*) INTO v_active_owners
          FROM public.club_members
          WHERE club_id = NEW.club_id
            AND role = 'owner'
            AND status = 'active'
            AND id IS DISTINCT FROM NEW.id;

          IF v_active_owners > 0 THEN
            RAISE EXCEPTION 'Unauthorized: A club can only have one primary owner. Use transfer_club_ownership.';
          END IF;
        END IF;
      END IF;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.role = 'owner' AND OLD.status = 'active' THEN
      IF (NEW.role IS DISTINCT FROM 'owner' OR NEW.status IS DISTINCT FROM 'active')
         AND COALESCE(v_allow_transfer, '') <> 'on' THEN
        SELECT COUNT(*) INTO v_active_owners
        FROM public.club_members
        WHERE club_id = OLD.club_id
          AND role = 'owner'
          AND status = 'active'
          AND id <> OLD.id;

        IF v_active_owners = 0 THEN
          RAISE EXCEPTION 'Cannot demote or suspend the sole club owner. Transfer ownership first.';
        END IF;
      END IF;
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.role = 'owner' AND OLD.status = 'active' AND COALESCE(v_allow_transfer, '') <> 'on' THEN
      SELECT COUNT(*) INTO v_active_owners
      FROM public.club_members
      WHERE club_id = OLD.club_id
        AND role = 'owner'
        AND status = 'active'
        AND id <> OLD.id;

      IF v_active_owners = 0 THEN
        RAISE EXCEPTION 'Cannot remove the sole club owner. Transfer ownership first.';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_club_member_integrity ON public.club_members;
CREATE TRIGGER trg_protect_club_member_integrity
BEFORE INSERT OR UPDATE OR DELETE ON public.club_members
FOR EACH ROW
EXECUTE FUNCTION public.protect_club_member_integrity();

-- ─── 2.Canonical SQL RBAC Role Hierarchy & Permission Matrix Helpers ──────────

CREATE OR REPLACE FUNCTION public.club_role_rank(p_role TEXT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE COALESCE(p_role, '')
    WHEN 'owner'            THEN 6
    WHEN 'admin'            THEN 5
    WHEN 'event_manager'    THEN 4
    WHEN 'payment_reviewer' THEN 3
    WHEN 'checkin_staff'    THEN 2
    WHEN 'viewer'           THEN 1
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_club_permission(p_permission TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE COALESCE(p_permission, '')
    WHEN 'manage_club'     THEN 'club.manage'
    WHEN 'manage_members'  THEN 'members.manage'
    WHEN 'manage_events'   THEN 'events.edit'
    WHEN 'view_attendees'  THEN 'registrations.view'
    WHEN 'review_payments' THEN 'payments.verify'
    WHEN 'view_reports'    THEN 'reports.view'
    WHEN 'gate_checkin'    THEN '__RETIRED_GATE_CHECKIN__'
    ELSE COALESCE(p_permission, '')
  END;
$$;

CREATE OR REPLACE FUNCTION public.permission_matches_club_role(p_role TEXT, p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_perm TEXT := public.normalize_club_permission(p_permission);
BEGIN
  IF p_role IS NULL OR v_perm = '' OR v_perm = '__RETIRED_GATE_CHECKIN__' THEN
    RETURN FALSE;
  END IF;

  CASE p_role
    WHEN 'owner' THEN
      RETURN v_perm IN (
        'club.view', 'club.manage', 'club.transfer_ownership',
        'members.view', 'members.invite', 'members.manage', 'roles.assign',
        'events.view', 'events.create', 'events.edit', 'events.publish', 'events.cancel',
        'registrations.view', 'registrations.manage',
        'payments.view', 'payments.verify', 'payments.settings',
        'reports.view', 'reports.export'
      );
    WHEN 'admin' THEN
      RETURN v_perm IN (
        'club.view', 'club.manage',
        'members.view', 'members.invite', 'members.manage', 'roles.assign',
        'events.view', 'events.create', 'events.edit', 'events.publish', 'events.cancel',
        'registrations.view', 'registrations.manage',
        'payments.view', 'payments.verify', 'payments.settings',
        'reports.view', 'reports.export'
      );
    WHEN 'event_manager' THEN
      RETURN v_perm IN (
        'club.view',
        'events.view', 'events.create', 'events.edit', 'events.publish', 'events.cancel',
        'registrations.view', 'registrations.manage',
        'reports.view', 'reports.export'
      );
    WHEN 'payment_reviewer' THEN
      RETURN v_perm IN (
        'club.view', 'events.view',
        'payments.view', 'payments.verify',
        'reports.view', 'reports.export'
      );
    WHEN 'checkin_staff' THEN
      -- Deprecated compatibility role: read-only, retired gate_checkin always returns FALSE.
      RETURN v_perm IN ('club.view', 'events.view', 'registrations.view');
    WHEN 'viewer' THEN
      RETURN v_perm IN ('club.view', 'events.view', 'registrations.view', 'reports.view');
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.permission_matches_event_assignment_role(p_role TEXT, p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_perm TEXT := public.normalize_club_permission(p_permission);
BEGIN
  IF p_role IS NULL OR v_perm = '' OR v_perm = '__RETIRED_GATE_CHECKIN__' THEN
    RETURN FALSE;
  END IF;

  CASE p_role
    WHEN 'event_manager' THEN
      RETURN v_perm IN (
        'events.view', 'events.edit', 'events.publish', 'events.cancel',
        'registrations.view', 'registrations.manage',
        'reports.view', 'reports.export'
      );
    WHEN 'registration_manager' THEN
      RETURN v_perm IN ('events.view', 'registrations.view', 'registrations.manage', 'reports.view', 'reports.export');
    WHEN 'finance_manager' THEN
      RETURN v_perm IN ('events.view', 'payments.view', 'payments.verify', 'reports.view', 'reports.export');
    WHEN 'content_manager' THEN
      RETURN v_perm IN ('events.view', 'events.edit');
    WHEN 'checkin_staff' THEN
      RETURN v_perm IN ('events.view', 'registrations.view');
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_is_platform_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_user_id
      AND p.role = 'platform_admin'
      AND COALESCE(p.status, 'active') = 'active'
  ) OR EXISTS (
    SELECT 1 FROM public.platform_admins pa
    WHERE pa.user_id = p_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_effective_club_role(p_user_id UUID, p_club_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_member RECORD;
BEGIN
  IF p_user_id IS NULL OR p_club_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Prevent cross-club role probing by non-admin authenticated callers
  IF v_caller IS NOT NULL AND p_user_id IS DISTINCT FROM v_caller
     AND auth.role() <> 'service_role'
     AND NOT public.check_is_platform_admin(v_caller) THEN
    RETURN NULL;
  END IF;

  -- Authoritative membership lookup first (honors role transfers, demotions & revocations)
  SELECT role, status INTO v_member
  FROM public.club_members
  WHERE club_id = p_club_id AND user_id = p_user_id;

  IF FOUND THEN
    IF v_member.status = 'active' THEN
      RETURN v_member.role;
    ELSE
      RETURN NULL;
    END IF;
  END IF;

  -- Legacy fallback ONLY when club_id = p_user_id AND club has zero active owner rows yet
  IF p_club_id = p_user_id THEN
    IF EXISTS (SELECT 1 FROM public.club_profiles WHERE profile_id = p_club_id)
       AND NOT EXISTS (
         SELECT 1 FROM public.club_members
         WHERE club_id = p_club_id AND role = 'owner' AND status = 'active'
       ) THEN
      RETURN 'owner';
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_club_permission(
  p_user_id UUID,
  p_club_id UUID,
  p_permission TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := public.get_effective_club_role(p_user_id, p_club_id);
  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN public.permission_matches_club_role(v_role, p_permission);
END;
$$;

CREATE OR REPLACE FUNCTION public.has_event_permission(
  p_user_id UUID,
  p_club_id UUID,
  p_event_id UUID,
  p_permission TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_club_role TEXT;
BEGIN
  IF p_user_id IS NULL OR p_club_id IS NULL OR p_event_id IS NULL THEN
    RETURN FALSE;
  END IF;

  v_club_role := public.get_effective_club_role(p_user_id, p_club_id);
  -- Strictly require active club membership for both club-wide and per-event permissions
  IF v_club_role IS NULL THEN
    RETURN FALSE;
  END IF;

  IF public.permission_matches_club_role(v_club_role, p_permission) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.events e
    JOIN public.event_assignments ea
      ON ea.event_id = e.id AND ea.club_id = e.club_id
    WHERE e.id = p_event_id
      AND e.club_id = p_club_id
      AND ea.user_id = p_user_id
      AND public.permission_matches_event_assignment_role(ea.role, p_permission)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_is_event_organizer(p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_club_id UUID;
BEGIN
  IF p_event_id IS NULL OR p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_caller IS NOT NULL AND p_user_id IS DISTINCT FROM v_caller
     AND auth.role() <> 'service_role'
     AND NOT public.check_is_platform_admin(v_caller) THEN
    RETURN FALSE;
  END IF;

  IF public.check_is_platform_admin(p_user_id) THEN
    RETURN TRUE;
  END IF;

  SELECT club_id INTO v_club_id FROM public.events WHERE id = p_event_id;
  IF v_club_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Strictly verify management permissions (passive viewers & legacy check-in staff return FALSE)
  RETURN public.has_event_permission(p_user_id, v_club_id, p_event_id, 'events.edit')
      OR public.has_event_permission(p_user_id, v_club_id, p_event_id, 'registrations.manage');
END;
$$;

CREATE OR REPLACE FUNCTION public.check_user_owns_event(p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_club_id UUID;
BEGIN
  IF p_event_id IS NULL OR p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  SELECT club_id INTO v_club_id FROM public.events WHERE id = p_event_id;
  IF v_club_id IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN public.has_event_permission(p_user_id, v_club_id, p_event_id, 'events.view');
END;
$$;

CREATE OR REPLACE FUNCTION public.check_student_registered_for_organizer(p_student_id UUID, p_organizer_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_student_id IS NULL OR p_organizer_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.registrations r
    JOIN public.events e ON e.id = r.event_id
    WHERE r.student_id = p_student_id
      AND (
        public.has_event_permission(p_organizer_id, e.club_id, e.id, 'registrations.view')
        OR public.has_event_permission(p_organizer_id, e.club_id, e.id, 'payments.view')
        OR public.has_event_permission(p_organizer_id, e.club_id, e.id, 'reports.view')
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_club_member_profile(p_target_user_id UUID, p_viewer_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_target_user_id IS NULL OR p_viewer_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.club_members target_cm
    JOIN public.club_members viewer_cm
      ON viewer_cm.club_id = target_cm.club_id
    WHERE target_cm.user_id = p_target_user_id
      AND viewer_cm.user_id = p_viewer_id
      AND viewer_cm.status = 'active'
  ) OR EXISTS (
    SELECT 1
    FROM public.club_invitations ci
    WHERE ci.invited_by = p_target_user_id
      AND public.has_club_permission(p_viewer_id, ci.club_id, 'members.view')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_effective_club_role(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_club_permission(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_event_permission(UUID, UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_is_event_organizer(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_user_owns_event(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_student_registered_for_organizer(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_club_member_profile(UUID, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_effective_club_role(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_club_permission(UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_event_permission(UUID, UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_is_event_organizer(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_user_owns_event(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_student_registered_for_organizer(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_club_member_profile(UUID, UUID) TO authenticated, service_role;

-- ─── 3. Security Triggers on profiles, club_profiles & event_assignments ───────

CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_is_privileged BOOLEAN := (v_caller IS NULL OR auth.role() = 'service_role' OR public.check_is_platform_admin(v_caller));
BEGIN
  IF NOT v_is_privileged THEN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      RAISE EXCEPTION 'Unauthorized: Users cannot modify their account role directly.';
    END IF;
    IF OLD.email IS DISTINCT FROM NEW.email THEN
      RAISE EXCEPTION 'Unauthorized: Account email cannot be spoofed outside verified authentication.';
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status
       OR OLD.suspension_reason IS DISTINCT FROM NEW.suspension_reason
       OR OLD.suspended_at IS DISTINCT FROM NEW.suspended_at
       OR OLD.suspended_by IS DISTINCT FROM NEW.suspended_by THEN
      RAISE EXCEPTION 'Unauthorized: Only platform administrators can change account moderation status.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_role_escalation();

CREATE OR REPLACE FUNCTION public.prevent_club_verification_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_is_privileged BOOLEAN := (v_caller IS NULL OR auth.role() = 'service_role' OR public.check_is_platform_admin(v_caller));
BEGIN
  IF NOT v_is_privileged THEN
    IF OLD.is_verified IS DISTINCT FROM NEW.is_verified
       OR OLD.status IS DISTINCT FROM NEW.status
       OR OLD.verified_at IS DISTINCT FROM NEW.verified_at
       OR OLD.verified_by IS DISTINCT FROM NEW.verified_by
       OR OLD.verification_notes IS DISTINCT FROM NEW.verification_notes
       OR OLD.suspension_reason IS DISTINCT FROM NEW.suspension_reason THEN
      RAISE EXCEPTION 'Unauthorized: Only platform administrators can change club verification or suspension status.';
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

CREATE OR REPLACE FUNCTION public.validate_event_assignment_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_club_id UUID;
BEGIN
  SELECT club_id INTO v_event_club_id FROM public.events WHERE id = NEW.event_id;
  IF v_event_club_id IS NULL THEN
    RAISE EXCEPTION 'Target event does not exist.';
  END IF;
  IF v_event_club_id IS DISTINCT FROM NEW.club_id THEN
    RAISE EXCEPTION 'Cross-club assignment mismatch: event belongs to another club.';
  END IF;
  IF NEW.role NOT IN ('event_manager', 'registration_manager', 'finance_manager', 'content_manager') THEN
    RAISE EXCEPTION 'Deprecated or invalid event assignment role: %.', NEW.role;
  END IF;
  IF public.get_effective_club_role(NEW.user_id, NEW.club_id) IS NULL THEN
    RAISE EXCEPTION 'Event assignments require an active club_members record for that organization.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_event_assignment_integrity ON public.event_assignments;
CREATE TRIGGER trg_validate_event_assignment_integrity
BEFORE INSERT OR UPDATE ON public.event_assignments
FOR EACH ROW
EXECUTE FUNCTION public.validate_event_assignment_integrity();

-- ─── 4. RLS Policy Overhaul Across All Club, Event, Payment & Workflow Tables ─

-- 4A. club_members
DROP POLICY IF EXISTS "Club members viewable by authorized members" ON public.club_members;
DROP POLICY IF EXISTS "Club members manageable by club administrators" ON public.club_members;

CREATE POLICY "Club members viewable by authorized members"
  ON public.club_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_club_permission(auth.uid(), club_id, 'members.view')
    OR public.check_is_platform_admin(auth.uid())
  );

CREATE POLICY "Club members insertable by authorized managers"
  ON public.club_members FOR INSERT
  TO authenticated
  WITH CHECK (
    public.check_is_platform_admin(auth.uid())
    OR (
      role IN ('admin', 'event_manager', 'payment_reviewer', 'viewer')
      AND public.has_club_permission(auth.uid(), club_id, 'members.manage')
      AND public.club_role_rank(public.get_effective_club_role(auth.uid(), club_id)) > public.club_role_rank(role)
    )
  );

CREATE POLICY "Club members updatable by authorized managers"
  ON public.club_members FOR UPDATE
  TO authenticated
  USING (
    public.check_is_platform_admin(auth.uid())
    OR (
      user_id <> auth.uid()
      AND public.has_club_permission(auth.uid(), club_id, 'members.manage')
      AND public.club_role_rank(public.get_effective_club_role(auth.uid(), club_id)) > public.club_role_rank(role)
    )
  )
  WITH CHECK (
    public.check_is_platform_admin(auth.uid())
    OR (
      user_id <> auth.uid()
      AND role IN ('admin', 'event_manager', 'payment_reviewer', 'viewer')
      AND public.has_club_permission(auth.uid(), club_id, 'members.manage')
      AND public.club_role_rank(public.get_effective_club_role(auth.uid(), club_id)) > public.club_role_rank(role)
    )
  );

CREATE POLICY "Club members removable by authorized managers"
  ON public.club_members FOR DELETE
  TO authenticated
  USING (
    public.check_is_platform_admin(auth.uid())
    OR (
      user_id <> auth.uid()
      AND public.has_club_permission(auth.uid(), club_id, 'members.manage')
      AND public.club_role_rank(public.get_effective_club_role(auth.uid(), club_id)) > public.club_role_rank(role)
    )
  );

-- 4B. club_invitations (JWT email checked cleanly, hierarchy enforced)
DROP POLICY IF EXISTS "Invitations viewable by club admins and recipient" ON public.club_invitations;
DROP POLICY IF EXISTS "Invitations manageable by club admins" ON public.club_invitations;

CREATE POLICY "Invitations viewable by club admins and recipient"
  ON public.club_invitations FOR SELECT
  TO authenticated
  USING (
    public.has_club_permission(auth.uid(), club_id, 'members.view')
    OR (
      status = 'pending'
      AND lower(trim(email)) = lower(trim(COALESCE(auth.jwt() ->> 'email', '')))
    )
    OR public.check_is_platform_admin(auth.uid())
  );

CREATE POLICY "Invitations insertable by authorized inviters"
  ON public.club_invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    public.check_is_platform_admin(auth.uid())
    OR (
      role IN ('admin', 'event_manager', 'payment_reviewer', 'viewer')
      AND invited_by = auth.uid()
      AND public.has_club_permission(auth.uid(), club_id, 'members.invite')
      AND public.club_role_rank(public.get_effective_club_role(auth.uid(), club_id)) > public.club_role_rank(role)
    )
  );

CREATE POLICY "Invitations updatable by authorized inviters"
  ON public.club_invitations FOR UPDATE
  TO authenticated
  USING (
    public.check_is_platform_admin(auth.uid())
    OR (
      public.has_club_permission(auth.uid(), club_id, 'members.invite')
      AND public.club_role_rank(public.get_effective_club_role(auth.uid(), club_id)) > public.club_role_rank(role)
    )
  )
  WITH CHECK (
    public.check_is_platform_admin(auth.uid())
    OR (
      role IN ('admin', 'event_manager', 'payment_reviewer', 'viewer', 'checkin_staff')
      AND public.has_club_permission(auth.uid(), club_id, 'members.invite')
      AND public.club_role_rank(public.get_effective_club_role(auth.uid(), club_id)) > public.club_role_rank(role)
    )
  );

CREATE POLICY "Invitations deletable by authorized managers"
  ON public.club_invitations FOR DELETE
  TO authenticated
  USING (
    public.check_is_platform_admin(auth.uid())
    OR (
      public.has_club_permission(auth.uid(), club_id, 'members.manage')
      AND public.club_role_rank(public.get_effective_club_role(auth.uid(), club_id)) > public.club_role_rank(role)
    )
  );

-- 4C. club_audit_logs
DROP POLICY IF EXISTS "Audit logs viewable by club managers" ON public.club_audit_logs;
CREATE POLICY "Audit logs viewable by club managers"
  ON public.club_audit_logs FOR SELECT
  TO authenticated
  USING (
    public.has_club_permission(auth.uid(), club_id, 'members.view')
    OR public.check_is_platform_admin(auth.uid())
  );

-- 4D. event_assignments (delegation restricted to roles.assign = owner/admin only)
DROP POLICY IF EXISTS "club staff can view event assignments" ON public.event_assignments;
DROP POLICY IF EXISTS "club admins can manage event assignments" ON public.event_assignments;

CREATE POLICY "club staff can view event assignments"
  ON public.event_assignments FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_club_permission(auth.uid(), club_id, 'members.view')
    OR public.has_event_permission(auth.uid(), club_id, event_id, 'events.edit')
    OR public.check_is_platform_admin(auth.uid())
  );

CREATE POLICY "club admins can manage event assignments"
  ON public.event_assignments FOR ALL
  TO authenticated
  USING (
    public.has_club_permission(auth.uid(), club_id, 'roles.assign')
    OR public.check_is_platform_admin(auth.uid())
  )
  WITH CHECK (
    (
      public.has_club_permission(auth.uid(), club_id, 'roles.assign')
      AND role IN ('event_manager', 'registration_manager', 'finance_manager', 'content_manager')
    )
    OR public.check_is_platform_admin(auth.uid())
  );

-- 4E. club_profiles
DROP POLICY IF EXISTS "club members can read own club profile" ON public.club_profiles;
DROP POLICY IF EXISTS "club organizers can insert own club profile" ON public.club_profiles;
DROP POLICY IF EXISTS "club members can update own club profile" ON public.club_profiles;

CREATE POLICY "club organizers can insert own club profile"
  ON public.club_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "club members can update own club profile"
  ON public.club_profiles FOR UPDATE
  TO authenticated
  USING (
    public.has_club_permission(auth.uid(), profile_id, 'club.manage')
    OR public.check_is_platform_admin(auth.uid())
  )
  WITH CHECK (
    public.has_club_permission(auth.uid(), profile_id, 'club.manage')
    OR public.check_is_platform_admin(auth.uid())
  );

-- 4F. club_payment_settings
DROP POLICY IF EXISTS "Club owner insert payment settings" ON public.club_payment_settings;
DROP POLICY IF EXISTS "Club owner update payment settings" ON public.club_payment_settings;

CREATE POLICY "Club owner insert payment settings"
  ON public.club_payment_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_club_permission(auth.uid(), club_id, 'payments.settings')
    OR public.check_is_platform_admin(auth.uid())
  );

CREATE POLICY "Club owner update payment settings"
  ON public.club_payment_settings FOR UPDATE
  TO authenticated
  USING (
    public.has_club_permission(auth.uid(), club_id, 'payments.settings')
    OR public.check_is_platform_admin(auth.uid())
  )
  WITH CHECK (
    public.has_club_permission(auth.uid(), club_id, 'payments.settings')
    OR public.check_is_platform_admin(auth.uid())
  );

-- 4G. events
DROP POLICY IF EXISTS "clubs can view own events" ON public.events;
DROP POLICY IF EXISTS "clubs can create own events" ON public.events;
DROP POLICY IF EXISTS "clubs can update own events" ON public.events;
DROP POLICY IF EXISTS "clubs can delete own events" ON public.events;

CREATE POLICY "clubs can view own events"
  ON public.events FOR SELECT
  TO authenticated
  USING (
    public.has_event_permission(auth.uid(), club_id, id, 'events.view')
    OR public.check_is_platform_admin(auth.uid())
  );

CREATE POLICY "clubs can create own events"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (
    public.check_is_platform_admin(auth.uid())
    OR (
      public.has_club_permission(auth.uid(), club_id, 'events.create')
      AND (
        status <> 'published'
        OR public.has_club_permission(auth.uid(), club_id, 'events.publish')
      )
    )
  );

CREATE POLICY "clubs can update own events"
  ON public.events FOR UPDATE
  TO authenticated
  USING (
    public.has_event_permission(auth.uid(), club_id, id, 'events.edit')
    OR public.has_event_permission(auth.uid(), club_id, id, 'events.publish')
    OR public.has_event_permission(auth.uid(), club_id, id, 'events.cancel')
    OR public.check_is_platform_admin(auth.uid())
  )
  WITH CHECK (
    public.check_is_platform_admin(auth.uid())
    OR (
      (status = 'cancelled' AND public.has_event_permission(auth.uid(), club_id, id, 'events.cancel'))
      OR (status = 'published' AND (
        public.has_event_permission(auth.uid(), club_id, id, 'events.publish')
        OR public.has_event_permission(auth.uid(), club_id, id, 'events.edit')
      ))
      OR (status = 'draft' AND public.has_event_permission(auth.uid(), club_id, id, 'events.edit'))
    )
  );

CREATE POLICY "clubs can delete own events"
  ON public.events FOR DELETE
  TO authenticated
  USING (
    public.has_event_permission(auth.uid(), club_id, id, 'events.cancel')
    OR public.check_is_platform_admin(auth.uid())
  );

-- 4H. registrations
DROP POLICY IF EXISTS "clubs can view registrations for their events" ON public.registrations;
DROP POLICY IF EXISTS "clubs can update registrations for their events" ON public.registrations;

CREATE POLICY "clubs can view registrations for their events"
  ON public.registrations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = registrations.event_id
        AND (
          public.has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.view')
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'payments.view')
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'reports.view')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );

CREATE POLICY "clubs can update registrations for their events"
  ON public.registrations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = registrations.event_id
        AND (
          public.has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.manage')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = registrations.event_id
        AND (
          public.has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.manage')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );

-- 4I. payment_submissions, payment_orders, payment_audit_logs, payment_dispute_reviews, payment_refund_requests
DROP POLICY IF EXISTS "Club organizers can view event payment submissions" ON public.payment_submissions;
CREATE POLICY "Club organizers can view event payment submissions"
  ON public.payment_submissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = payment_submissions.event_id
        AND (
          public.has_event_permission(auth.uid(), e.club_id, e.id, 'payments.view')
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'reports.view')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Club organizers can view event payment orders" ON public.payment_orders;
CREATE POLICY "Club organizers can view event payment orders"
  ON public.payment_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = payment_orders.event_id
        AND (
          public.has_event_permission(auth.uid(), e.club_id, e.id, 'payments.view')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Organizers can view audit logs for their events" ON public.payment_audit_logs;
CREATE POLICY "Organizers can view audit logs for their events"
  ON public.payment_audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = payment_audit_logs.event_id
        AND (
          public.has_event_permission(auth.uid(), e.club_id, e.id, 'payments.view')
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'reports.view')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Organizers view payment reviews for their events" ON public.payment_dispute_reviews;
DROP POLICY IF EXISTS "Organizers update payment reviews for their events" ON public.payment_dispute_reviews;
CREATE POLICY "Organizers view payment reviews for their events"
  ON public.payment_dispute_reviews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = payment_dispute_reviews.event_id
        AND (
          public.has_event_permission(auth.uid(), e.club_id, e.id, 'payments.view')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );
CREATE POLICY "Organizers update payment reviews for their events"
  ON public.payment_dispute_reviews FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = payment_dispute_reviews.event_id
        AND (
          public.has_event_permission(auth.uid(), e.club_id, e.id, 'payments.verify')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = payment_dispute_reviews.event_id
        AND (
          public.has_event_permission(auth.uid(), e.club_id, e.id, 'payments.verify')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Organizers view refund requests for their events" ON public.payment_refund_requests;
DROP POLICY IF EXISTS "Organizers can update refund requests" ON public.payment_refund_requests;
CREATE POLICY "Organizers view refund requests for their events"
  ON public.payment_refund_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = payment_refund_requests.event_id
        AND (
          public.has_event_permission(auth.uid(), e.club_id, e.id, 'payments.view')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );
CREATE POLICY "Organizers can update refund requests"
  ON public.payment_refund_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = payment_refund_requests.event_id
        AND (
          public.has_event_permission(auth.uid(), e.club_id, e.id, 'payments.verify')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = payment_refund_requests.event_id
        AND (
          public.has_event_permission(auth.uid(), e.club_id, e.id, 'payments.verify')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );

-- 4J. club_event_automations & event_coupons
DROP POLICY IF EXISTS "Organizers can manage club event automations" ON public.club_event_automations;
CREATE POLICY "Organizers can manage club event automations"
  ON public.club_event_automations FOR ALL
  TO authenticated
  USING (
    public.has_event_permission(auth.uid(), club_id, event_id, 'events.edit')
    OR public.check_is_platform_admin(auth.uid())
  )
  WITH CHECK (
    public.has_event_permission(auth.uid(), club_id, event_id, 'events.edit')
    OR public.check_is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS "organizers can view club coupons" ON public.event_coupons;
DROP POLICY IF EXISTS "organizers can insert club coupons" ON public.event_coupons;
DROP POLICY IF EXISTS "organizers can update club coupons" ON public.event_coupons;
DROP POLICY IF EXISTS "organizers can delete club coupons" ON public.event_coupons;

CREATE POLICY "organizers can view club coupons"
  ON public.event_coupons FOR SELECT
  TO authenticated
  USING (
    public.check_is_platform_admin(auth.uid())
    OR (
      event_id IS NULL
      AND (
        public.has_club_permission(auth.uid(), club_id, 'events.edit')
        OR public.has_club_permission(auth.uid(), club_id, 'payments.view')
      )
    )
    OR (
      event_id IS NOT NULL
      AND (
        public.has_event_permission(auth.uid(), club_id, event_id, 'events.edit')
        OR public.has_event_permission(auth.uid(), club_id, event_id, 'payments.view')
      )
    )
  );

CREATE POLICY "organizers can insert club coupons"
  ON public.event_coupons FOR INSERT
  TO authenticated
  WITH CHECK (
    public.check_is_platform_admin(auth.uid())
    OR (
      event_id IS NULL AND public.has_club_permission(auth.uid(), club_id, 'events.edit')
    )
    OR (
      event_id IS NOT NULL AND public.has_event_permission(auth.uid(), club_id, event_id, 'events.edit')
    )
  );

CREATE POLICY "organizers can update club coupons"
  ON public.event_coupons FOR UPDATE
  TO authenticated
  USING (
    public.check_is_platform_admin(auth.uid())
    OR (event_id IS NULL AND public.has_club_permission(auth.uid(), club_id, 'events.edit'))
    OR (event_id IS NOT NULL AND public.has_event_permission(auth.uid(), club_id, event_id, 'events.edit'))
  )
  WITH CHECK (
    public.check_is_platform_admin(auth.uid())
    OR (event_id IS NULL AND public.has_club_permission(auth.uid(), club_id, 'events.edit'))
    OR (event_id IS NOT NULL AND public.has_event_permission(auth.uid(), club_id, event_id, 'events.edit'))
  );

CREATE POLICY "organizers can delete club coupons"
  ON public.event_coupons FOR DELETE
  TO authenticated
  USING (
    public.check_is_platform_admin(auth.uid())
    OR (event_id IS NULL AND public.has_club_permission(auth.uid(), club_id, 'events.edit'))
    OR (event_id IS NOT NULL AND public.has_event_permission(auth.uid(), club_id, event_id, 'events.edit'))
  );

-- 4K. Event Sub-resources (tiers, addons, announcements, gallery, leaderboard, schedules, speakers, waitlists)
DROP POLICY IF EXISTS "Organizers can insert event ticket tiers" ON public.event_ticket_tiers;
DROP POLICY IF EXISTS "Organizers can update event ticket tiers" ON public.event_ticket_tiers;
DROP POLICY IF EXISTS "Organizers can delete event ticket tiers" ON public.event_ticket_tiers;
DROP POLICY IF EXISTS "Organizers can manage event ticket tiers" ON public.event_ticket_tiers;
CREATE POLICY "Organizers can manage event ticket tiers"
  ON public.event_ticket_tiers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_ticket_tiers.event_id
        AND (public.has_event_permission(auth.uid(), e.club_id, e.id, 'events.edit') OR public.check_is_platform_admin(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_ticket_tiers.event_id
        AND (public.has_event_permission(auth.uid(), e.club_id, e.id, 'events.edit') OR public.check_is_platform_admin(auth.uid()))
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
        AND (public.has_event_permission(auth.uid(), e.club_id, e.id, 'events.edit') OR public.check_is_platform_admin(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_addons.event_id
        AND (public.has_event_permission(auth.uid(), e.club_id, e.id, 'events.edit') OR public.check_is_platform_admin(auth.uid()))
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
        AND (public.has_event_permission(auth.uid(), e.club_id, e.id, 'events.edit') OR public.check_is_platform_admin(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_announcements.event_id
        AND (public.has_event_permission(auth.uid(), e.club_id, e.id, 'events.edit') OR public.check_is_platform_admin(auth.uid()))
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
        AND (public.has_event_permission(auth.uid(), e.club_id, e.id, 'events.edit') OR public.check_is_platform_admin(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_gallery_images.event_id
        AND (public.has_event_permission(auth.uid(), e.club_id, e.id, 'events.edit') OR public.check_is_platform_admin(auth.uid()))
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
        AND (public.has_event_permission(auth.uid(), e.club_id, e.id, 'events.edit') OR public.check_is_platform_admin(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_leaderboard_entries.event_id
        AND (public.has_event_permission(auth.uid(), e.club_id, e.id, 'events.edit') OR public.check_is_platform_admin(auth.uid()))
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
        AND (public.has_event_permission(auth.uid(), e.club_id, e.id, 'events.edit') OR public.check_is_platform_admin(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_schedules.event_id
        AND (public.has_event_permission(auth.uid(), e.club_id, e.id, 'events.edit') OR public.check_is_platform_admin(auth.uid()))
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
        AND (public.has_event_permission(auth.uid(), e.club_id, e.id, 'events.edit') OR public.check_is_platform_admin(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_speakers.event_id
        AND (public.has_event_permission(auth.uid(), e.club_id, e.id, 'events.edit') OR public.check_is_platform_admin(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Organizers can manage event waitlists" ON public.event_waitlists;
CREATE POLICY "Organizers can manage event waitlists"
  ON public.event_waitlists FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_waitlists.event_id
        AND (
          public.has_event_permission(auth.uid(), e.club_id, e.id, 'events.edit')
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.manage')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_waitlists.event_id
        AND (
          public.has_event_permission(auth.uid(), e.club_id, e.id, 'events.edit')
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.manage')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Organizers can view event waitlist entries" ON public.event_waitlist_entries;
DROP POLICY IF EXISTS "Organizers can update event waitlist entries" ON public.event_waitlist_entries;
CREATE POLICY "Organizers can view event waitlist entries"
  ON public.event_waitlist_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_waitlist_entries.event_id
        AND (
          public.has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.view')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );
CREATE POLICY "Organizers can update event waitlist entries"
  ON public.event_waitlist_entries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_waitlist_entries.event_id
        AND (
          public.has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.manage')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );

-- 4L. Cancellation, Edit, Team Change & Workflow Logs
DROP POLICY IF EXISTS "Organizers can view cancellation requests for their events" ON public.registration_cancellation_requests;
CREATE POLICY "Organizers can view cancellation requests for their events"
  ON public.registration_cancellation_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = registration_cancellation_requests.event_id
        AND (
          public.has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.view')
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'payments.view')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Organizers view edit requests for their events" ON public.registration_edit_requests;
CREATE POLICY "Organizers view edit requests for their events"
  ON public.registration_edit_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = registration_edit_requests.event_id
        AND (
          public.has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.view')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Organizers view team change requests for their events" ON public.team_change_requests;
CREATE POLICY "Organizers view team change requests for their events"
  ON public.team_change_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = team_change_requests.event_id
        AND (
          public.has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.view')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Organizers view audit logs for their events" ON public.workflow_audit_logs;
CREATE POLICY "Organizers view audit logs for their events"
  ON public.workflow_audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = workflow_audit_logs.event_id
        AND (
          public.has_event_permission(auth.uid(), e.club_id, e.id, 'reports.view')
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.view')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );

-- 4M. teams, team_members, email_outbox, check_ins, discussions, club_announcements, profiles
DROP POLICY IF EXISTS "Organizers can view teams in their events" ON public.teams;
CREATE POLICY "Organizers can view teams in their events"
  ON public.teams FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = teams.event_id
        AND (
          public.has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.view')
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'payments.view')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Organizers can view team members in their events" ON public.team_members;
CREATE POLICY "Organizers can view team members in their events"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = team_members.event_id
        AND (
          public.has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.view')
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'payments.view')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Organizers can view event email outbox records" ON public.email_outbox;
CREATE POLICY "Organizers can view event email outbox records"
  ON public.email_outbox FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = email_outbox.event_id
        AND (
          public.has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.view')
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'events.edit')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "Organizers can view event check-ins" ON public.check_ins;
CREATE POLICY "Organizers can view event check-ins"
  ON public.check_ins FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = check_ins.event_id
        AND (
          public.has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.view')
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'reports.view')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "delete own comments or organizer delete" ON public.event_discussions;
CREATE POLICY "delete own comments or organizer delete"
  ON public.event_discussions FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_discussions.event_id
        AND (
          public.has_event_permission(auth.uid(), e.club_id, e.id, 'events.edit')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "view public club announcements" ON public.club_announcements;
DROP POLICY IF EXISTS "club leads can create announcements" ON public.club_announcements;
DROP POLICY IF EXISTS "club leads can update announcements" ON public.club_announcements;
DROP POLICY IF EXISTS "club leads can delete announcements" ON public.club_announcements;

CREATE POLICY "view public club announcements"
  ON public.club_announcements FOR SELECT
  TO authenticated
  USING (
    is_members_only = false
    OR public.get_effective_club_role(auth.uid(), club_id) IS NOT NULL
    OR public.check_is_platform_admin(auth.uid())
  );

CREATE POLICY "club leads can create announcements"
  ON public.club_announcements FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_club_permission(auth.uid(), club_id, 'events.edit')
    OR public.has_club_permission(auth.uid(), club_id, 'club.manage')
    OR public.check_is_platform_admin(auth.uid())
  );

CREATE POLICY "club leads can update announcements"
  ON public.club_announcements FOR UPDATE
  TO authenticated
  USING (
    public.has_club_permission(auth.uid(), club_id, 'events.edit')
    OR public.has_club_permission(auth.uid(), club_id, 'club.manage')
    OR public.check_is_platform_admin(auth.uid())
  )
  WITH CHECK (
    public.has_club_permission(auth.uid(), club_id, 'events.edit')
    OR public.has_club_permission(auth.uid(), club_id, 'club.manage')
    OR public.check_is_platform_admin(auth.uid())
  );

CREATE POLICY "club leads can delete announcements"
  ON public.club_announcements FOR DELETE
  TO authenticated
  USING (
    public.has_club_permission(auth.uid(), club_id, 'events.edit')
    OR public.has_club_permission(auth.uid(), club_id, 'club.manage')
    OR public.check_is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS "organizers can view registered student profiles" ON public.profiles;
DROP POLICY IF EXISTS "club managers can view active teammate profiles" ON public.profiles;

CREATE POLICY "organizers can view registered student profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.check_student_registered_for_organizer(profiles.id, auth.uid())
    OR public.check_is_platform_admin(auth.uid())
  );

CREATE POLICY "club managers can view active teammate profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.can_view_club_member_profile(profiles.id, auth.uid())
  );

-- 4N. storage.objects (event-posters, club-payment-qrs, payment-proofs)
DROP POLICY IF EXISTS "authenticated clubs can upload event posters" ON storage.objects;
DROP POLICY IF EXISTS "clubs can update own event posters" ON storage.objects;
DROP POLICY IF EXISTS "clubs can delete own event posters" ON storage.objects;
DROP POLICY IF EXISTS "Club organizers can manage own payment QRs" ON storage.objects;
DROP POLICY IF EXISTS "Club organizers can update own payment QRs" ON storage.objects;
DROP POLICY IF EXISTS "Club organizers can delete own payment QRs" ON storage.objects;
DROP POLICY IF EXISTS "Users can read authorized payment proofs" ON storage.objects;

CREATE POLICY "authenticated clubs can upload event posters"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-posters'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND (
      public.has_club_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'events.create')
      OR public.has_club_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'events.edit')
    )
  );

CREATE POLICY "clubs can update own event posters"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'event-posters'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND public.has_club_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'events.edit')
  );

CREATE POLICY "clubs can delete own event posters"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'event-posters'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND public.has_club_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'events.edit')
  );

CREATE POLICY "Club organizers can manage own payment QRs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'club-payment-qrs'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND public.has_club_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'payments.settings')
  );

CREATE POLICY "Club organizers can update own payment QRs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'club-payment-qrs'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND public.has_club_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'payments.settings')
  );

CREATE POLICY "Club organizers can delete own payment QRs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'club-payment-qrs'
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    AND public.has_club_permission(auth.uid(), ((storage.foldername(name))[1])::uuid, 'payments.settings')
  );

CREATE POLICY "Users can read authorized payment proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-proofs' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1
        FROM public.payment_submissions ps
        JOIN public.events e ON e.id = ps.event_id
        WHERE ps.student_id::text = (storage.foldername(name))[1]
          AND public.has_event_permission(auth.uid(), e.club_id, e.id, 'payments.view')
      )
      OR EXISTS (
        SELECT 1
        FROM public.registrations r
        JOIN public.events e ON e.id = r.event_id
        WHERE r.student_id::text = (storage.foldername(name))[1]
          AND public.has_event_permission(auth.uid(), e.club_id, e.id, 'payments.view')
      )
      OR public.check_is_platform_admin(auth.uid())
    )
  );

-- ─── 5. Hardened Club Member & Invitation RPCs ───────────────────────────────

CREATE OR REPLACE FUNCTION public.invite_club_member(
  p_club_id UUID,
  p_email TEXT,
  p_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_actor_role TEXT;
  v_clean_email TEXT := lower(trim(COALESCE(p_email, '')));
  v_token TEXT;
  v_expires_at TIMESTAMPTZ := now() + interval '7 days';
  v_inv RECORD;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Authentication required.');
  END IF;

  IF v_clean_email = '' OR v_clean_email NOT LIKE '%@%.%' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_EMAIL', 'message', 'Please provide a valid email address.');
  END IF;

  v_actor_role := public.get_effective_club_role(v_caller_id, p_club_id);
  IF v_actor_role IS NULL OR NOT public.permission_matches_club_role(v_actor_role, 'members.invite') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INSUFFICIENT_PERMISSIONS', 'message', 'You do not have permission to invite club members.');
  END IF;

  IF p_role NOT IN ('admin', 'event_manager', 'payment_reviewer', 'viewer') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_ROLE', 'message', 'Role is retired or cannot be invited directly.');
  END IF;

  IF public.club_role_rank(v_actor_role) <= public.club_role_rank(p_role) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ROLE_ESCALATION_DENIED', 'message', format('Role %s cannot assign role %s.', v_actor_role, p_role));
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.club_members cm
    JOIN public.profiles p ON p.id = cm.user_id
    WHERE cm.club_id = p_club_id
      AND cm.status = 'active'
      AND lower(trim(p.email)) = v_clean_email
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'DUPLICATE_MEMBERSHIP', 'message', format('%s is already an active member of this club.', v_clean_email));
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.club_invitations ci
    WHERE ci.club_id = p_club_id
      AND lower(trim(ci.email)) = v_clean_email
      AND ci.status = 'pending'
      AND ci.expires_at > now()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'PENDING_INVITATION_EXISTS', 'message', format('An active invitation is already pending for %s.', v_clean_email));
  END IF;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  INSERT INTO public.club_invitations (
    club_id, email, role, invited_by, token, status, expires_at
  ) VALUES (
    p_club_id, v_clean_email, p_role, v_caller_id, v_token, 'pending', v_expires_at
  ) RETURNING * INTO v_inv;

  INSERT INTO public.club_audit_logs (
    club_id, actor_id, action, target_email, new_value, details
  ) VALUES (
    p_club_id, v_caller_id, 'member_invited', v_clean_email, p_role,
    jsonb_build_object('invitation_id', v_inv.id, 'role', p_role, 'expires_at', v_expires_at)
  );

  RETURN jsonb_build_object(
    'success', true,
    'invitation', to_jsonb(v_inv),
    'message', format('Invitation sent to %s.', v_clean_email)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_club_invitation(
  p_invitation_id UUID,
  p_club_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_actor_role TEXT;
  v_inv RECORD;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
  END IF;

  SELECT * INTO v_inv FROM public.club_invitations WHERE id = p_invitation_id AND club_id = p_club_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Invitation not found.');
  END IF;

  v_actor_role := public.get_effective_club_role(v_caller_id, p_club_id);
  IF v_actor_role IS NULL OR NOT public.permission_matches_club_role(v_actor_role, 'members.invite') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'Insufficient permissions to revoke invitations.');
  END IF;

  IF public.club_role_rank(v_actor_role) <= public.club_role_rank(v_inv.role) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'Cannot revoke an invitation of equal or higher tier.');
  END IF;

  UPDATE public.club_invitations
  SET status = 'revoked', updated_at = now()
  WHERE id = p_invitation_id;

  INSERT INTO public.club_audit_logs (
    club_id, actor_id, action, target_id, target_email, details
  ) VALUES (
    p_club_id, v_caller_id, 'invitation_revoked', p_invitation_id::text, v_inv.email,
    jsonb_build_object('revoked_at', now())
  );

  RETURN jsonb_build_object('success', true, 'message', 'Invitation has been revoked.');
END;
$$;

CREATE OR REPLACE FUNCTION public.resend_club_invitation(
  p_invitation_id UUID,
  p_club_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_actor_role TEXT;
  v_inv RECORD;
  v_new_token TEXT;
  v_new_expires TIMESTAMPTZ := now() + interval '7 days';
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
  END IF;

  SELECT * INTO v_inv FROM public.club_invitations WHERE id = p_invitation_id AND club_id = p_club_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Invitation record not found.');
  END IF;

  IF v_inv.status = 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_ACCEPTED', 'message', 'Invitation has already been accepted.');
  END IF;

  v_actor_role := public.get_effective_club_role(v_caller_id, p_club_id);
  IF v_actor_role IS NULL OR NOT public.permission_matches_club_role(v_actor_role, 'members.invite') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'Insufficient permissions to resend invitations.');
  END IF;

  IF public.club_role_rank(v_actor_role) <= public.club_role_rank(v_inv.role) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'Cannot resend an invitation for equal or higher tier.');
  END IF;

  v_new_token := encode(extensions.gen_random_bytes(32), 'hex');

  UPDATE public.club_invitations
  SET token = v_new_token,
      status = 'pending',
      expires_at = v_new_expires,
      updated_at = now()
  WHERE id = p_invitation_id
  RETURNING * INTO v_inv;

  INSERT INTO public.club_audit_logs (
    club_id, actor_id, action, target_id, target_email, details
  ) VALUES (
    p_club_id, v_caller_id, 'invitation_resent', p_invitation_id::text, v_inv.email,
    jsonb_build_object('new_expires_at', v_new_expires)
  );

  RETURN jsonb_build_object(
    'success', true,
    'invitation', to_jsonb(v_inv),
    'message', format('Invitation renewed for %s.', v_inv.email)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_club_member_role(
  p_member_id UUID,
  p_club_id UUID,
  p_new_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_actor_role TEXT;
  v_target RECORD;
  v_active_owners INT;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
  END IF;

  SELECT * INTO v_target FROM public.club_members WHERE id = p_member_id AND club_id = p_club_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Member record not found.');
  END IF;

  v_actor_role := public.get_effective_club_role(v_caller_id, p_club_id);
  IF v_actor_role IS NULL OR NOT public.permission_matches_club_role(v_actor_role, 'members.manage') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INSUFFICIENT_PERMISSIONS', 'message', 'Unauthorized to manage team roles.');
  END IF;

  IF v_target.user_id = v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'SELF_MODIFICATION_DENIED', 'message', 'Cannot modify your own organization role directly.');
  END IF;

  IF p_new_role NOT IN ('admin', 'event_manager', 'payment_reviewer', 'viewer') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_ROLE', 'message', 'Selected role is retired or must be granted via ownership transfer.');
  END IF;

  IF public.club_role_rank(v_actor_role) <= public.club_role_rank(v_target.role) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'HIERARCHY_DENIED', 'message', 'Cannot modify a member of equal or higher hierarchy rank.');
  END IF;

  IF public.club_role_rank(v_actor_role) <= public.club_role_rank(p_new_role) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ROLE_ESCALATION_DENIED', 'message', 'Cannot assign a role equal to or higher than your own rank.');
  END IF;

  IF v_target.role = 'owner' THEN
    SELECT COUNT(*) INTO v_active_owners
    FROM public.club_members
    WHERE club_id = p_club_id AND role = 'owner' AND status = 'active' AND id <> p_member_id;

    IF v_active_owners = 0 THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'CANNOT_DEMOTE_SOLE_OWNER', 'message', 'Cannot demote the sole club owner. Transfer ownership first.');
    END IF;
  END IF;

  UPDATE public.club_members
  SET role = p_new_role, updated_at = now()
  WHERE id = p_member_id;

  INSERT INTO public.club_audit_logs (
    club_id, actor_id, action, target_id, old_value, new_value
  ) VALUES (
    p_club_id, v_caller_id, 'role_updated', v_target.user_id::text, v_target.role, p_new_role
  );

  RETURN jsonb_build_object('success', true, 'message', format('Member role updated to %s.', p_new_role));
END;
$$;

DROP FUNCTION IF EXISTS public.remove_club_member(UUID, UUID, UUID);
CREATE FUNCTION public.remove_club_member(
  p_member_id UUID,
  p_actor_id UUID DEFAULT NULL,
  p_club_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_target RECORD;
  v_actor_role TEXT;
  v_club_id UUID;
  v_active_owners INT;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
  END IF;

  IF p_actor_id IS NOT NULL AND p_actor_id <> v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'Caller identity mismatch.');
  END IF;

  SELECT * INTO v_target FROM public.club_members WHERE id = p_member_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Member record not found.');
  END IF;

  v_club_id := COALESCE(p_club_id, v_target.club_id);
  IF v_target.club_id <> v_club_id THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'CLUB_MISMATCH', 'message', 'Member does not belong to specified club.');
  END IF;

  v_actor_role := public.get_effective_club_role(v_caller_id, v_club_id);
  IF v_actor_role IS NULL OR NOT public.permission_matches_club_role(v_actor_role, 'members.manage') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INSUFFICIENT_PERMISSIONS', 'message', 'Permission to manage members is required.');
  END IF;

  IF v_target.role = 'owner' THEN
    SELECT COUNT(*) INTO v_active_owners
    FROM public.club_members
    WHERE club_id = v_club_id AND role = 'owner' AND status = 'active' AND id <> p_member_id;

    IF v_active_owners = 0 THEN
      RETURN jsonb_build_object('success', false, 'error_code', 'CANNOT_REMOVE_SOLE_OWNER', 'message', 'Cannot remove the sole club owner. Transfer ownership first.');
    END IF;
  END IF;

  IF v_target.user_id = v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'CANNOT_REMOVE_SELF', 'message', 'Cannot remove your own membership directly.');
  END IF;

  IF public.club_role_rank(v_actor_role) <= public.club_role_rank(v_target.role) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INSUFFICIENT_PERMISSIONS', 'message', 'Cannot remove a member holding an equal or higher role.');
  END IF;

  DELETE FROM public.event_assignments WHERE club_id = v_club_id AND user_id = v_target.user_id;
  DELETE FROM public.club_members WHERE id = p_member_id;

  INSERT INTO public.club_audit_logs (
    club_id, actor_id, action, target_id, old_value, details
  ) VALUES (
    v_club_id, v_caller_id, 'member_removed', v_target.user_id::text, v_target.role,
    jsonb_build_object('removed_user_id', v_target.user_id)
  );

  RETURN jsonb_build_object('success', true, 'message', 'Member access has been revoked and removed.');
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_club_ownership(
  p_club_id UUID,
  p_new_owner_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_actor_role TEXT;
  v_target RECORD;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
  END IF;

  IF p_new_owner_id = v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'SAME_OWNER', 'message', 'Target user is already the current owner.');
  END IF;

  v_actor_role := public.get_effective_club_role(v_caller_id, p_club_id);
  IF v_actor_role IS NULL OR NOT public.permission_matches_club_role(v_actor_role, 'club.transfer_ownership') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'Only the primary club owner can transfer club ownership.');
  END IF;

  SELECT * INTO v_target
  FROM public.club_members
  WHERE club_id = p_club_id AND user_id = p_new_owner_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_ACTIVE_MEMBER', 'message', 'Designated owner must be an active member of this organization.');
  END IF;

  PERFORM set_config('festflow.allow_owner_transfer', 'on', true);

  INSERT INTO public.club_members (club_id, user_id, role, status, updated_at)
  VALUES (p_club_id, v_caller_id, 'admin', 'active', now())
  ON CONFLICT (club_id, user_id)
  DO UPDATE SET role = 'admin', status = 'active', updated_at = now();

  UPDATE public.club_members
  SET role = 'owner', status = 'active', updated_at = now()
  WHERE id = v_target.id;

  INSERT INTO public.club_audit_logs (
    club_id, actor_id, action, target_id, details
  ) VALUES (
    p_club_id, v_caller_id, 'ownership_transferred', p_new_owner_id::text,
    jsonb_build_object('transferred_from', v_caller_id, 'transferred_to', p_new_owner_id)
  );

  RETURN jsonb_build_object('success', true, 'message', 'Club ownership has been transferred successfully.');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_club_invitation_preview(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation RECORD;
  v_club_name TEXT;
  v_inviter_name TEXT;
  v_caller_id UUID;
  v_caller_email TEXT;
  v_is_matched BOOLEAN := FALSE;
  v_masked_email TEXT;
  v_safe_email TEXT;
  v_email_parts TEXT[];
  v_local_part TEXT;
  v_domain_part TEXT;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TOKEN', 'message', 'Invalid or malformed invitation token.');
  END IF;

  SELECT id, club_id, email, role, status, expires_at, invited_by
  INTO v_invitation
  FROM public.club_invitations
  WHERE token = trim(p_token);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVITATION_NOT_FOUND', 'message', 'Invitation not found or invalid link.');
  END IF;

  IF v_invitation.status = 'revoked' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVITATION_REVOKED', 'status', 'revoked', 'message', 'This invitation has been revoked by the club organizer.');
  END IF;

  IF v_invitation.status = 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_ACCEPTED', 'status', 'accepted', 'message', 'This invitation has already been accepted.');
  END IF;

  IF v_invitation.expires_at < now() OR v_invitation.status = 'expired' THEN
    IF v_invitation.status = 'pending' THEN
      UPDATE public.club_invitations SET status = 'expired', updated_at = now() WHERE id = v_invitation.id;
    END IF;
    RETURN jsonb_build_object('success', false, 'error_code', 'INVITATION_EXPIRED', 'status', 'expired', 'message', 'This invitation has expired.');
  END IF;

  SELECT club_name INTO v_club_name FROM public.club_profiles WHERE profile_id = v_invitation.club_id;
  IF v_club_name IS NULL THEN
    SELECT display_name INTO v_club_name FROM public.profiles WHERE id = v_invitation.club_id;
  END IF;

  SELECT display_name INTO v_inviter_name FROM public.profiles WHERE id = v_invitation.invited_by;

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

  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL THEN
    v_caller_email := COALESCE(
      NULLIF(trim(COALESCE(auth.jwt() ->> 'email', '')), ''),
      (SELECT email FROM public.profiles WHERE id = v_caller_id)
    );

    IF v_caller_email IS NOT NULL AND lower(trim(v_caller_email)) = lower(trim(v_invitation.email)) THEN
      v_is_matched := TRUE;
      v_safe_email := v_invitation.email;
    ELSIF public.has_club_permission(v_caller_id, v_invitation.club_id, 'members.invite') THEN
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

CREATE OR REPLACE FUNCTION public.accept_club_invitation(
  p_token TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_user_email TEXT;
  v_email_confirmed_at TIMESTAMPTZ;
  v_invitation RECORD;
  v_existing_role TEXT;
  v_club_name TEXT;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_TOKEN', 'message', 'Invalid or missing invitation token.');
  END IF;

  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    IF current_setting('request.jwt.claim.role', true) = 'service_role' OR auth.role() = 'service_role' THEN
      v_caller_id := p_user_id;
    END IF;
  END IF;

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Authentication required. Please sign in to accept this invitation.');
  END IF;

  IF p_user_id IS NOT NULL AND p_user_id <> v_caller_id AND auth.role() <> 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'Caller identity mismatch. Cannot accept invitations on behalf of another user.');
  END IF;

  SELECT email, email_confirmed_at
  INTO v_user_email, v_email_confirmed_at
  FROM auth.users
  WHERE id = v_caller_id;

  IF v_user_email IS NULL THEN
    SELECT email INTO v_user_email FROM public.profiles WHERE id = v_caller_id;
  END IF;

  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'USER_NOT_FOUND', 'message', 'User account record not found.');
  END IF;

  IF v_email_confirmed_at IS NULL AND auth.role() <> 'service_role' AND EXISTS (SELECT 1 FROM auth.users WHERE id = v_caller_id) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'EMAIL_NOT_VERIFIED', 'message', 'Please verify your email address before accepting this invitation.');
  END IF;

  SELECT * INTO v_invitation FROM public.club_invitations WHERE token = trim(p_token) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVITATION_NOT_FOUND', 'message', 'Invitation not found or invalid link.');
  END IF;

  IF v_invitation.status = 'revoked' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVITATION_REVOKED', 'message', 'This invitation has been revoked by the club organizer.');
  END IF;

  IF v_invitation.status = 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_ACCEPTED', 'message', 'This invitation has already been accepted.');
  END IF;

  IF v_invitation.expires_at < now() OR v_invitation.status = 'expired' THEN
    UPDATE public.club_invitations SET status = 'expired', updated_at = now() WHERE id = v_invitation.id;
    RETURN jsonb_build_object('success', false, 'error_code', 'INVITATION_EXPIRED', 'message', 'This invitation has expired.');
  END IF;

  IF lower(trim(v_user_email)) <> lower(trim(v_invitation.email)) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'EMAIL_MISMATCH', 'message', 'This invitation was issued to a different email address.');
  END IF;

  IF v_invitation.role NOT IN ('admin', 'event_manager', 'payment_reviewer', 'viewer') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_ROLE', 'message', 'Invitation specifies a retired or unauthorized club role.');
  END IF;

  SELECT role INTO v_existing_role
  FROM public.club_members
  WHERE club_id = v_invitation.club_id AND user_id = v_caller_id AND status = 'active';

  IF v_existing_role IS NOT NULL THEN
    UPDATE public.club_invitations
    SET status = 'accepted', accepted_at = now(), accepted_by = v_caller_id, updated_at = now()
    WHERE id = v_invitation.id;

    RETURN jsonb_build_object(
      'success', true,
      'club_id', v_invitation.club_id,
      'invited_by', v_invitation.invited_by,
      'role', v_existing_role,
      'message', format('You are already an active member of this organization with the role %s.', v_existing_role)
    );
  END IF;

  INSERT INTO public.club_members (club_id, user_id, role, status, updated_at)
  VALUES (v_invitation.club_id, v_caller_id, v_invitation.role, 'active', now())
  ON CONFLICT (club_id, user_id)
  DO UPDATE SET role = EXCLUDED.role, status = 'active', updated_at = now();

  UPDATE public.club_invitations
  SET status = 'accepted', accepted_at = now(), accepted_by = v_caller_id, updated_at = now()
  WHERE id = v_invitation.id;

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

  SELECT club_name INTO v_club_name FROM public.club_profiles WHERE profile_id = v_invitation.club_id;

  BEGIN
    INSERT INTO public.in_app_notifications (user_id, title, message, type, link, is_read)
    VALUES (
      v_invitation.invited_by,
      'Staff Invitation Accepted',
      format('%s accepted the invitation to join %s as %s.', v_user_email, COALESCE(v_club_name, 'your organization'), v_invitation.role),
      'club_invitation_accepted',
      '/club/members',
      false
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'club_id', v_invitation.club_id,
    'club_name', COALESCE(v_club_name, 'Campus Organization'),
    'invited_by', v_invitation.invited_by,
    'role', v_invitation.role,
    'message', format('Welcome! Successfully joined as %s.', v_invitation.role)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_event_coupon(
  p_code TEXT,
  p_event_id UUID,
  p_ticket_price NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_norm TEXT := UPPER(TRIM(COALESCE(p_code, '')));
  v_event RECORD;
  v_coupon RECORD;
  v_discount NUMERIC := 0;
  v_final NUMERIC := COALESCE(p_ticket_price, 0);
BEGIN
  IF v_norm = '' THEN
    RETURN jsonb_build_object('valid', false, 'discountAmount', 0, 'finalPrice', v_final, 'error', 'Please enter a coupon code.');
  END IF;

  SELECT id, club_id INTO v_event FROM public.events WHERE id = p_event_id AND status = 'published';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'discountAmount', 0, 'finalPrice', v_final, 'error', 'Invalid or unavailable event.');
  END IF;

  SELECT * INTO v_coupon
  FROM public.event_coupons
  WHERE code = v_norm
    AND club_id = v_event.club_id
    AND is_active = true
    AND (event_id IS NULL OR event_id = p_event_id)
  ORDER BY event_id NULLS LAST
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'discountAmount', 0, 'finalPrice', v_final, 'error', 'Invalid or inactive coupon code.');
  END IF;

  IF v_coupon.valid_from IS NOT NULL AND v_coupon.valid_from > now() THEN
    RETURN jsonb_build_object('valid', false, 'discountAmount', 0, 'finalPrice', v_final, 'error', 'This coupon code is not active yet.');
  END IF;

  IF v_coupon.valid_until IS NOT NULL AND v_coupon.valid_until < now() THEN
    RETURN jsonb_build_object('valid', false, 'discountAmount', 0, 'finalPrice', v_final, 'error', 'This coupon code has expired.');
  END IF;

  IF v_coupon.max_uses IS NOT NULL AND COALESCE(v_coupon.used_count, 0) >= v_coupon.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'discountAmount', 0, 'finalPrice', v_final, 'error', 'This coupon has reached its maximum redemption limit.');
  END IF;

  IF v_coupon.min_purchase_amount IS NOT NULL AND v_final < v_coupon.min_purchase_amount THEN
    RETURN jsonb_build_object('valid', false, 'discountAmount', 0, 'finalPrice', v_final, 'error', format('Minimum pass price of ₹%s required.', v_coupon.min_purchase_amount));
  END IF;

  IF v_coupon.discount_type = 'percentage' THEN
    v_discount := ROUND((v_final * v_coupon.discount_value) / 100.0);
    IF v_coupon.max_discount_amount IS NOT NULL AND v_discount > v_coupon.max_discount_amount THEN
      v_discount := v_coupon.max_discount_amount;
    END IF;
  ELSE
    v_discount := v_coupon.discount_value;
  END IF;

  v_discount := LEAST(v_discount, v_final);
  v_final := GREATEST(0, v_final - v_discount);

  RETURN jsonb_build_object(
    'valid', true,
    'discountAmount', v_discount,
    'finalPrice', v_final,
    'coupon', jsonb_build_object(
      'id', v_coupon.id,
      'club_id', v_coupon.club_id,
      'event_id', v_coupon.event_id,
      'code', v_coupon.code,
      'discount_type', v_coupon.discount_type,
      'discount_value', v_coupon.discount_value
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.invite_club_member(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_club_invitation(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resend_club_invitation(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_club_member_role(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_club_member(UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transfer_club_ownership(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_club_invitation_preview(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_club_invitation(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_event_coupon(TEXT, UUID, NUMERIC) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.invite_club_member(UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_club_invitation(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resend_club_invitation(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_club_member_role(UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_club_member(UUID, UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transfer_club_ownership(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_club_invitation_preview(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_club_invitation(TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_event_coupon(TEXT, UUID, NUMERIC) TO anon, authenticated, service_role;

-- ─── 6. Harden Payment & Event Workflow RPCs (Preserving 052 256-bit QR Tokens) ─

-- 6A. review_payment_submission (052 exact 256-bit QR logic + has_event_permission 'payments.verify')
CREATE OR REPLACE FUNCTION public.review_payment_submission(
    p_payment_id UUID,
    p_decision TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_reviewer_id UUID;
    v_sub RECORD;
    v_reg RECORD;
    v_event RECORD;
    v_issued_ticket_code TEXT;
    v_leader_qr_token TEXT;
    v_leader_qr_hash TEXT;
    v_clean_notes TEXT;
    v_now TIMESTAMPTZ := now();
    v_member_rec RECORD;
    v_member_reg RECORD;
    v_member_idx INT := 0;
    v_member_ticket_code TEXT;
    v_member_qr_token TEXT;
    v_member_qr_hash TEXT;
    v_final_member_qr TEXT;
    v_final_member_hash TEXT;
    v_synced_members_count INT := 0;
BEGIN
    v_reviewer_id := auth.uid();
    IF v_reviewer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'You must be signed in to review payment submissions.');
    END IF;

    IF p_decision NOT IN ('approved', 'rejected') THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DECISION', 'message', 'Decision must be either "approved" or "rejected".');
    END IF;

    v_clean_notes := TRIM(COALESCE(p_notes, ''));
    IF p_decision = 'rejected' AND v_clean_notes = '' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'REJECTION_REASON_REQUIRED', 'message', 'A clear reason for rejection is required to inform the student.');
    END IF;

    SELECT * INTO v_sub FROM public.payment_submissions WHERE id = p_payment_id FOR UPDATE;
    IF v_sub.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Payment submission not found.');
    END IF;

    IF v_sub.status <> 'pending_review' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_REVIEWED', 'message', 'This payment has already been ' || v_sub.status || '.');
    END IF;

    SELECT * INTO v_reg FROM public.registrations WHERE id = v_sub.registration_id FOR UPDATE;
    IF v_reg.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'REGISTRATION_NOT_FOUND', 'message', 'Associated registration record could not be found.');
    END IF;

    SELECT * INTO v_event FROM public.events WHERE id = v_sub.event_id;
    IF v_event.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'EVENT_NOT_FOUND', 'message', 'Target event could not be found.');
    END IF;

    -- Granular authorization: checks active club_members role, per-event finance_manager delegation, or platform_admin
    IF NOT (
      public.has_event_permission(v_reviewer_id, v_event.club_id, v_event.id, 'payments.verify')
      OR public.check_is_platform_admin(v_reviewer_id)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'You do not have permission to review payments for this event.');
    END IF;

    IF v_reg.status = 'cancelled' THEN
        UPDATE public.payment_submissions
        SET status = 'rejected', reviewer_id = v_reviewer_id, reviewed_at = v_now,
            review_notes = 'Registration was cancelled prior to review.', updated_at = v_now
        WHERE id = p_payment_id;
        RETURN jsonb_build_object('success', false, 'error_code', 'REGISTRATION_CANCELLED', 'message', 'Registration was cancelled by the student.');
    END IF;

    IF p_decision = 'approved' THEN
        v_issued_ticket_code := COALESCE(
            NULLIF(v_reg.ticket_code, ''),
            'TKT-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8)) || '-' || TO_CHAR(v_now, 'MIIS')
        );
        v_leader_qr_token := COALESCE(
            NULLIF(TRIM(v_reg.qr_token), ''),
            'FFQ_' || UPPER(encode(extensions.gen_random_bytes(32), 'hex'))
        );
        v_leader_qr_hash := encode(extensions.digest(UPPER(TRIM(v_leader_qr_token)), 'sha256'), 'hex');

        UPDATE public.payment_submissions
        SET status = 'approved',
            reviewer_id = v_reviewer_id,
            reviewed_at = v_now,
            review_notes = CASE WHEN v_clean_notes <> '' THEN v_clean_notes ELSE 'Payment verified and approved by organizer.' END,
            updated_at = v_now
        WHERE id = p_payment_id;

        UPDATE public.registrations
        SET status = 'confirmed',
            ticket_code = v_issued_ticket_code,
            qr_token = v_leader_qr_token,
            qr_token_hash = v_leader_qr_hash,
            ticket_issued_at = COALESCE(ticket_issued_at, v_now),
            rejection_reason = NULL,
            updated_at = v_now
        WHERE id = v_sub.registration_id;

        IF v_reg.team_id IS NOT NULL AND (v_reg.team_role = 'leader' OR v_event.participation_type = 'team') THEN
            FOR v_member_rec IN
                SELECT tm.*, p.display_name, p.email AS profile_email
                FROM public.team_members tm
                LEFT JOIN public.profiles p ON p.id = tm.user_id
                WHERE tm.team_id = v_reg.team_id
                  AND tm.status = 'accepted'
                  AND tm.user_id <> v_reg.student_id
                ORDER BY tm.created_at ASC
            LOOP
                v_member_idx := v_member_idx + 1;
                v_member_ticket_code := format('%s-M%s', v_issued_ticket_code, v_member_idx);
                v_member_qr_token := 'FFQ_' || UPPER(encode(extensions.gen_random_bytes(32), 'hex'));
                v_member_qr_hash := encode(extensions.digest(UPPER(TRIM(v_member_qr_token)), 'sha256'), 'hex');

                SELECT * INTO v_member_reg
                FROM public.registrations
                WHERE event_id = v_event.id AND student_id = v_member_rec.user_id
                FOR UPDATE;

                IF v_member_reg.id IS NOT NULL THEN
                    v_final_member_qr := COALESCE(NULLIF(TRIM(v_member_reg.qr_token), ''), v_member_qr_token);
                    v_final_member_hash := encode(extensions.digest(UPPER(TRIM(v_final_member_qr)), 'sha256'), 'hex');

                    UPDATE public.registrations
                    SET status = 'confirmed',
                        ticket_code = COALESCE(NULLIF(ticket_code, ''), v_member_ticket_code),
                        qr_token = v_final_member_qr,
                        qr_token_hash = v_final_member_hash,
                        ticket_issued_at = COALESCE(ticket_issued_at, v_now),
                        team_id = v_reg.team_id,
                        team_name = v_reg.team_name,
                        team_role = 'member',
                        rejection_reason = NULL,
                        updated_at = v_now
                    WHERE id = v_member_reg.id;
                ELSE
                    INSERT INTO public.registrations (
                        event_id, student_id, status, ticket_code, qr_token, qr_token_hash,
                        ticket_issued_at, team_name, team_id, team_role, participant_details,
                        approval_status, created_at, updated_at
                    ) VALUES (
                        v_event.id, v_member_rec.user_id, 'confirmed', v_member_ticket_code,
                        v_member_qr_token, v_member_qr_hash, v_now, v_reg.team_name, v_reg.team_id,
                        'member',
                        jsonb_build_object(
                            'student_name', COALESCE(v_member_rec.display_name, 'Squad Member'),
                            'email', COALESCE(v_member_rec.profile_email, '')
                        ),
                        'approved', v_now, v_now
                    ) RETURNING * INTO v_member_reg;
                END IF;

                UPDATE public.team_members SET registration_id = v_member_reg.id, updated_at = v_now WHERE id = v_member_rec.id;

                INSERT INTO public.in_app_notifications (user_id, title, message, type, link)
                VALUES (
                    v_member_rec.user_id,
                    'Team Pass Ready! 🎉',
                    'Payment for your team (' || COALESCE(v_reg.team_name, 'Squad') || ') for ' || v_event.title || ' has been approved. Your pass is now active!',
                    'ticket_issued',
                    '/student/tickets/' || v_member_reg.id
                );

                v_synced_members_count := v_synced_members_count + 1;
            END LOOP;
        END IF;

        INSERT INTO public.payment_audit_logs (
            payment_submission_id, registration_id, event_id, action, actor_id, actor_role,
            previous_status, new_status, notes, metadata
        ) VALUES (
            p_payment_id, v_sub.registration_id, v_sub.event_id, 'approved', v_reviewer_id, 'organizer',
            'pending_review', 'approved', v_clean_notes,
            jsonb_build_object('ticket_code', v_issued_ticket_code, 'utr', v_sub.transaction_reference, 'amount', v_sub.amount, 'squad_members_activated', v_synced_members_count)
        );

        INSERT INTO public.in_app_notifications (user_id, title, message, type, link)
        VALUES (
            v_sub.student_id,
            'Payment Approved! 🎉',
            'Your payment of ' || v_sub.currency || ' ' || v_sub.amount::text || ' for ' || v_event.title || ' has been approved. Your digital entry pass is now ready!',
            'payment_approved',
            '/student/tickets/' || v_sub.registration_id
        );

        RETURN jsonb_build_object(
            'success', true,
            'status', 'approved',
            'ticket_code', v_issued_ticket_code,
            'registration_id', v_sub.registration_id,
            'squad_members_activated', v_synced_members_count,
            'message', 'Payment approved successfully. Entry pass issued.'
        );
    ELSE
        UPDATE public.payment_submissions
        SET status = 'rejected', reviewer_id = v_reviewer_id, reviewed_at = v_now, review_notes = v_clean_notes, updated_at = v_now
        WHERE id = p_payment_id;

        UPDATE public.registrations
        SET status = 'rejected', rejection_reason = v_clean_notes, updated_at = v_now
        WHERE id = v_sub.registration_id;

        IF v_reg.team_id IS NOT NULL AND (v_reg.team_role = 'leader' OR v_event.participation_type = 'team') THEN
            UPDATE public.registrations
            SET status = 'rejected', rejection_reason = v_clean_notes, updated_at = v_now
            WHERE team_id = v_reg.team_id AND id <> v_sub.registration_id;

            INSERT INTO public.in_app_notifications (user_id, title, message, type, link)
            SELECT tm.user_id,
                   'Team Payment Issue',
                   'The organizer could not verify payment for ' || v_event.title || ': ' || v_clean_notes,
                   'payment_rejected',
                   '/student/dashboard?tab=cancelled'
            FROM public.team_members tm
            WHERE tm.team_id = v_reg.team_id AND tm.status = 'accepted' AND tm.user_id <> v_reg.student_id;
        END IF;

        INSERT INTO public.payment_audit_logs (
            payment_submission_id, registration_id, event_id, action, actor_id, actor_role,
            previous_status, new_status, notes, metadata
        ) VALUES (
            p_payment_id, v_sub.registration_id, v_sub.event_id, 'rejected', v_reviewer_id, 'organizer',
            'pending_review', 'rejected', v_clean_notes,
            jsonb_build_object('utr', v_sub.transaction_reference, 'amount', v_sub.amount, 'rejection_reason', v_clean_notes)
        );

        INSERT INTO public.in_app_notifications (user_id, title, message, type, link)
        VALUES (
            v_sub.student_id,
            'Payment Verification Issue',
            'Your payment reference for ' || v_event.title || ' could not be verified: ' || v_clean_notes || '. Please check your transaction details and resubmit.',
            'payment_rejected',
            '/student/payments/' || v_sub.registration_id
        );

        RETURN jsonb_build_object('success', true, 'status', 'rejected', 'message', 'Payment rejected. Student notified to resubmit.');
    END IF;
END;
$$;

-- 6B. review_registration_application
CREATE OR REPLACE FUNCTION public.review_registration_application(
  p_registration_id uuid,
  p_decision text,
  p_rejection_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_reg record;
  v_event record;
  v_new_status registration_status;
  v_new_approval text;
  v_issued_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
  END IF;

  SELECT * INTO v_reg FROM public.registrations WHERE id = p_registration_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Registration not found.');
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = v_reg.event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Event not found.');
  END IF;

  IF NOT (
    public.has_event_permission(v_user_id, v_event.club_id, v_event.id, 'registrations.manage')
    OR public.check_is_platform_admin(v_user_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'Insufficient permissions to review registration applications.');
  END IF;

  IF v_reg.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_CANCELLED', 'message', 'Cannot review a cancelled registration.');
  END IF;

  IF p_decision = 'approved' THEN
    v_new_approval := 'approved';
    IF v_event.is_free THEN
      v_new_status := 'confirmed'::registration_status;
      v_issued_at := now();
    ELSE
      v_new_status := 'pending_payment'::registration_status;
      v_issued_at := NULL;
    END IF;
  ELSIF p_decision = 'rejected' THEN
    v_new_approval := 'rejected';
    v_new_status := 'rejected'::registration_status;
    v_issued_at := NULL;
  ELSE
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DECISION', 'message', 'Decision must be approved or rejected.');
  END IF;

  UPDATE public.registrations
  SET approval_status = v_new_approval,
      status = v_new_status,
      ticket_issued_at = COALESCE(v_issued_at, ticket_issued_at),
      rejection_reason = CASE WHEN p_decision = 'rejected' THEN p_rejection_reason ELSE NULL END,
      updated_at = now()
  WHERE id = p_registration_id;

  RETURN jsonb_build_object(
    'success', true,
    'registration_id', p_registration_id,
    'status', v_new_status,
    'approval_status', v_new_approval,
    'message', CASE
      WHEN p_decision = 'approved' AND v_event.is_free THEN 'Application approved. Free pass issued!'
      WHEN p_decision = 'approved' THEN 'Application approved. Awaiting student payment.'
      ELSE 'Application rejected.'
    END
  );
END;
$$;

-- 6C. review_registration_cancellation, review_registration_edit, offer_waitlist_slot, cancel_event_by_organizer, cancel_registration_with_policy
CREATE OR REPLACE FUNCTION public.review_registration_cancellation(
    p_request_id UUID,
    p_decision TEXT,
    p_decision_notes TEXT DEFAULT NULL,
    p_refund_status TEXT DEFAULT 'not_applicable',
    p_refund_amount NUMERIC DEFAULT 0,
    p_refund_ref TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_req RECORD;
    v_reg RECORD;
    v_event RECORD;
    v_now TIMESTAMPTZ := now();
    v_clean_decision TEXT;
    v_clean_notes TEXT;
    v_clean_refund_status TEXT;
BEGIN
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
    END IF;

    v_clean_decision := LOWER(TRIM(COALESCE(p_decision, '')));
    IF v_clean_decision NOT IN ('approved', 'rejected') THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DECISION', 'message', 'Decision must be approved or rejected.');
    END IF;

    v_clean_notes := TRIM(COALESCE(p_decision_notes, ''));
    v_clean_refund_status := LOWER(TRIM(COALESCE(p_refund_status, 'not_applicable')));

    SELECT * INTO v_req FROM public.registration_cancellation_requests WHERE id = p_request_id FOR UPDATE;
    IF v_req.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Cancellation request not found.');
    END IF;

    IF v_req.status <> 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_REVIEWED', 'message', 'This cancellation request has already been reviewed.');
    END IF;

    SELECT * INTO v_event FROM public.events WHERE id = v_req.event_id;
    IF NOT (
      public.has_event_permission(v_caller_id, v_event.club_id, v_event.id, 'registrations.manage')
      OR public.check_is_platform_admin(v_caller_id)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'Insufficient permissions to review cancellation requests.');
    END IF;

    SELECT * INTO v_reg FROM public.registrations WHERE id = v_req.registration_id FOR UPDATE;

    IF v_clean_decision = 'approved' THEN
        UPDATE public.registration_cancellation_requests
        SET status = 'approved', reviewed_by = v_caller_id, reviewed_at = v_now,
            decision_notes = v_clean_notes, refund_status = v_clean_refund_status,
            refund_amount = COALESCE(p_refund_amount, v_req.refund_amount),
            refund_transaction_ref = p_refund_ref, updated_at = v_now
        WHERE id = v_req.id;

        UPDATE public.registrations
        SET status = 'cancelled'::registration_status, cancellation_request_status = 'approved',
            cancelled_at = v_now, refund_status = v_clean_refund_status,
            refund_amount = COALESCE(p_refund_amount, v_req.refund_amount),
            refund_transaction_ref = p_refund_ref, updated_at = v_now
        WHERE id = v_reg.id;

        IF v_reg.team_id IS NOT NULL THEN
            UPDATE public.team_members
            SET status = 'cancelled', updated_at = v_now
            WHERE (registration_id = v_reg.id OR user_id = v_reg.student_id) AND team_id = v_reg.team_id;
        END IF;
    ELSE
        UPDATE public.registration_cancellation_requests
        SET status = 'rejected', reviewed_by = v_caller_id, reviewed_at = v_now,
            decision_notes = v_clean_notes, updated_at = v_now
        WHERE id = v_req.id;

        UPDATE public.registrations
        SET cancellation_request_status = 'rejected', updated_at = v_now
        WHERE id = v_reg.id;
    END IF;

    INSERT INTO public.workflow_audit_logs (
        actor_id, actor_role, action, target_entity, target_record_id, event_id,
        registration_id, team_id, previous_state, new_state, decision_notes
    ) VALUES (
        v_caller_id, 'organizer',
        CASE WHEN v_clean_decision = 'approved' THEN 'cancellation_approved' ELSE 'cancellation_rejected' END,
        'registration_cancellation_requests', v_req.id::text, v_req.event_id, v_reg.id, v_reg.team_id,
        jsonb_build_object('status', v_reg.status, 'cancellation_request_status', 'pending'),
        jsonb_build_object('status', CASE WHEN v_clean_decision = 'approved' THEN 'cancelled' ELSE v_reg.status::text END, 'cancellation_request_status', v_clean_decision, 'refund_status', v_clean_refund_status),
        v_clean_notes
    );

    RETURN jsonb_build_object(
        'success', true,
        'decision', v_clean_decision,
        'message', CASE
            WHEN v_clean_decision = 'approved' THEN 'Cancellation approved. Registration has been cancelled.'
            ELSE 'Cancellation rejected. Registration remains active.'
        END
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.review_registration_edit(
    p_request_id UUID,
    p_decision TEXT,
    p_decision_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_req RECORD;
    v_reg RECORD;
    v_event RECORD;
    v_clean_decision TEXT;
    v_clean_notes TEXT;
    v_new_details JSONB;
BEGIN
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
    END IF;

    v_clean_decision := LOWER(TRIM(COALESCE(p_decision, '')));
    IF v_clean_decision NOT IN ('approved', 'rejected') THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DECISION', 'message', 'Decision must be approved or rejected.');
    END IF;

    v_clean_notes := TRIM(COALESCE(p_decision_notes, ''));

    SELECT * INTO v_req FROM public.registration_edit_requests WHERE id = p_request_id FOR UPDATE;
    IF v_req.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Edit request not found.');
    END IF;

    IF v_req.status <> 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ALREADY_REVIEWED', 'message', 'This edit request has already been reviewed.');
    END IF;

    SELECT * INTO v_event FROM public.events WHERE id = v_req.event_id;
    IF NOT (
      public.has_event_permission(v_caller_id, v_event.club_id, v_event.id, 'registrations.manage')
      OR public.check_is_platform_admin(v_caller_id)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'Insufficient permissions to review edit requests.');
    END IF;

    SELECT * INTO v_reg FROM public.registrations WHERE id = v_req.registration_id FOR UPDATE;

    IF v_clean_decision = 'approved' THEN
        v_new_details := COALESCE(v_reg.participant_details, '{}'::jsonb);
        IF v_req.proposed_changes ? 'student_name' THEN
            v_new_details := jsonb_set(v_new_details, '{student_name}', v_req.proposed_changes -> 'student_name');
        END IF;
        IF v_req.proposed_changes ? 'phone' THEN
            v_new_details := jsonb_set(v_new_details, '{phone}', v_req.proposed_changes -> 'phone');
        END IF;
        IF v_req.proposed_changes ? 'college' THEN
            v_new_details := jsonb_set(v_new_details, '{college_name}', v_req.proposed_changes -> 'college');
        END IF;

        UPDATE public.registrations
        SET participant_details = v_new_details,
            team_name = CASE WHEN v_req.proposed_changes ? 'team_name' THEN v_req.proposed_changes ->> 'team_name' ELSE team_name END,
            updated_at = now()
        WHERE id = v_reg.id;

        IF v_req.proposed_changes ? 'team_name' AND v_reg.team_id IS NOT NULL THEN
            UPDATE public.teams SET name = v_req.proposed_changes ->> 'team_name', updated_at = now() WHERE id = v_reg.team_id;
        END IF;

        UPDATE public.registration_edit_requests
        SET status = 'approved', reviewed_by = v_caller_id, reviewed_at = now(), decision_notes = v_clean_notes, updated_at = now()
        WHERE id = v_req.id;
    ELSE
        UPDATE public.registration_edit_requests
        SET status = 'rejected', reviewed_by = v_caller_id, reviewed_at = now(), decision_notes = v_clean_notes, updated_at = now()
        WHERE id = v_req.id;
    END IF;

    INSERT INTO public.workflow_audit_logs (
        actor_id, actor_role, action, target_entity, target_record_id, event_id,
        registration_id, team_id, previous_state, new_state, decision_notes
    ) VALUES (
        v_caller_id, 'organizer',
        CASE WHEN v_clean_decision = 'approved' THEN 'edit_approved' ELSE 'edit_rejected' END,
        'registration_edit_requests', v_req.id::text, v_req.event_id, v_reg.id, v_reg.team_id,
        v_req.previous_values, v_req.proposed_changes, v_clean_notes
    );

    RETURN jsonb_build_object(
        'success', true,
        'decision', v_clean_decision,
        'message', CASE
            WHEN v_clean_decision = 'approved' THEN 'Edit request approved and registration updated.'
            ELSE 'Edit request rejected.'
        END
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.offer_waitlist_slot(
    p_registration_id UUID,
    p_expires_hours INT DEFAULT 24
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_reg RECORD;
    v_event RECORD;
    v_expires_at TIMESTAMPTZ;
BEGIN
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
    END IF;

    SELECT * INTO v_reg FROM public.registrations WHERE id = p_registration_id FOR UPDATE;
    IF v_reg.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Registration not found.');
    END IF;

    SELECT * INTO v_event FROM public.events WHERE id = v_reg.event_id;
    IF NOT (
      public.has_event_permission(v_caller_id, v_event.club_id, v_event.id, 'registrations.manage')
      OR public.check_is_platform_admin(v_caller_id)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'Only authorized event staff can offer waitlist slots.');
    END IF;

    IF v_reg.status <> 'waitlisted' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_WAITLISTED', 'message', 'Registration is not currently waitlisted.');
    END IF;

    v_expires_at := now() + (COALESCE(p_expires_hours, 24) * interval '1 hour');

    UPDATE public.registrations
    SET waitlist_offered_at = now(), waitlist_offer_expires_at = v_expires_at, updated_at = now()
    WHERE id = v_reg.id;

    INSERT INTO public.workflow_audit_logs (
        actor_id, actor_role, action, target_entity, target_record_id, event_id, registration_id, new_state
    ) VALUES (
        v_caller_id, 'organizer', 'waitlist_slot_offered', 'registrations', v_reg.id::text, v_reg.event_id, v_reg.id,
        jsonb_build_object('offered_at', now(), 'expires_at', v_expires_at)
    );

    RETURN jsonb_build_object(
        'success', true,
        'offer_expires_at', v_expires_at,
        'message', format('Slot offered to student. Offer expires in %s hours.', COALESCE(p_expires_hours, 24))
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_event_by_organizer(
    p_event_id UUID,
    p_cancellation_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_event RECORD;
    v_clean_reason TEXT;
    v_now TIMESTAMPTZ := now();
    v_affected_count INT := 0;
BEGIN
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
    END IF;

    v_clean_reason := TRIM(COALESCE(p_cancellation_reason, ''));
    IF v_clean_reason = '' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_REASON', 'message', 'Please specify a reason for event cancellation.');
    END IF;

    SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR UPDATE;
    IF v_event.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Event not found.');
    END IF;

    IF NOT (
      public.has_event_permission(v_caller_id, v_event.club_id, v_event.id, 'events.cancel')
      OR public.check_is_platform_admin(v_caller_id)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'You do not have permission to cancel this event.');
    END IF;

    UPDATE public.events
    SET status = 'cancelled'::event_status,
        description = COALESCE(description, '') || E'\n\n[EVENT CANCELLED BY ORGANIZER: ' || v_clean_reason || ']',
        updated_at = v_now
    WHERE id = p_event_id;

    UPDATE public.registrations
    SET status = 'cancelled'::registration_status,
        cancellation_request_status = 'approved',
        cancelled_at = v_now,
        refund_status = CASE WHEN NOT v_event.is_free AND v_event.price > 0 THEN 'refund_requested' ELSE refund_status END,
        refund_amount = CASE WHEN NOT v_event.is_free AND v_event.price > 0 THEN v_event.price ELSE refund_amount END,
        updated_at = v_now
    WHERE event_id = p_event_id AND status NOT IN ('cancelled', 'rejected');

    GET DIAGNOSTICS v_affected_count = ROW_COUNT;

    INSERT INTO public.workflow_audit_logs (
        actor_id, actor_role, action, target_entity, target_record_id, event_id, reason, metadata
    ) VALUES (
        v_caller_id, 'organizer', 'event_cancelled', 'events', p_event_id::text, p_event_id, v_clean_reason,
        jsonb_build_object('affected_registrations', v_affected_count)
    );

    RETURN jsonb_build_object(
        'success', true,
        'affected_registrations', v_affected_count,
        'message', format('Event cancelled successfully. %s registrations marked cancelled with refund review queued.', v_affected_count)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_registration_with_policy(
    p_registration_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_reg RECORD;
    v_event RECORD;
    v_is_manager BOOLEAN := false;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Sign in required.');
    END IF;

    SELECT * INTO v_reg FROM public.registrations WHERE id = p_registration_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Registration not found.');
    END IF;

    SELECT * INTO v_event FROM public.events WHERE id = v_reg.event_id;
    v_is_manager := public.has_event_permission(v_user_id, v_event.club_id, v_event.id, 'registrations.manage')
                    OR public.check_is_platform_admin(v_user_id);

    IF NOT v_is_manager THEN
        RETURN public.request_registration_cancellation(
            p_registration_id,
            COALESCE(NULLIF(TRIM(p_reason), ''), 'unable_to_attend'),
            p_reason
        );
    END IF;

    UPDATE public.registrations
    SET status = 'cancelled',
        cancelled_at = NOW(),
        ticket_issued_at = NULL,
        cancellation_request_status = 'approved',
        updated_at = NOW()
    WHERE id = p_registration_id;

    RETURN jsonb_build_object('success', true, 'message', 'Registration cancelled by organizer.');
END;
$$;

-- 6D. send_event_reminders, resend_registration_pass, resend_outbox_email, sync_team_member_registration, get_event_meeting_details
CREATE OR REPLACE FUNCTION public.send_event_reminders(
    p_event_id UUID,
    p_custom_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_event RECORD;
    v_reg RECORD;
    v_count INT := 0;
    v_date_str TEXT;
    v_idempotency TEXT;
BEGIN
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'You must be signed in.');
    END IF;

    SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
    IF v_event.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Event not found.');
    END IF;

    IF NOT (
      public.has_event_permission(v_caller_id, v_event.club_id, v_event.id, 'events.edit')
      OR public.has_event_permission(v_caller_id, v_event.club_id, v_event.id, 'registrations.manage')
      OR public.check_is_platform_admin(v_caller_id)
    ) THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHORIZED', 'message', 'Insufficient permissions to send event reminders.');
    END IF;

    v_date_str := TO_CHAR(now(), 'YYYYMMDD');

    FOR v_reg IN
        SELECT r.id AS reg_id, r.ticket_code, p.id AS student_id, p.display_name, p.email
        FROM public.registrations r
        JOIN public.profiles p ON p.id = r.student_id
        WHERE r.event_id = p_event_id AND r.status = 'confirmed'
    LOOP
        v_idempotency := 'remind-' || p_event_id::text || '-' || v_reg.reg_id::text || '-' || v_date_str;

        IF NOT EXISTS (SELECT 1 FROM public.email_outbox WHERE idempotency_key = v_idempotency) THEN
            INSERT INTO public.email_outbox (
                recipient_email, recipient_name, template_type, subject, payload, idempotency_key, event_id, registration_id, user_id, status
            ) VALUES (
                v_reg.email, v_reg.display_name, 'event_reminder', 'Reminder: ' || v_event.title || ' is coming up!',
                jsonb_build_object(
                    'event_title', v_event.title, 'start_date', v_event.start_date, 'venue_name', v_event.venue_name,
                    'ticket_code', v_reg.ticket_code, 'custom_message', p_custom_message, 'ticket_link', '/student/tickets/' || v_reg.reg_id::text
                ),
                v_idempotency, p_event_id, v_reg.reg_id, v_reg.student_id, 'pending'
            );

            INSERT INTO public.in_app_notifications (user_id, title, message, type, link)
            VALUES (
                v_reg.student_id,
                'Event Reminder: ' || v_event.title,
                'Upcoming event: ' || v_event.title || ' on ' || TO_CHAR(v_event.start_date, 'Mon DD') || ' at ' || v_event.venue_name || '.' ||
                CASE WHEN p_custom_message IS NOT NULL AND p_custom_message <> '' THEN ' Note from organizer: ' || p_custom_message ELSE '' END,
                'event_reminder',
                '/student/tickets/' || v_reg.reg_id::text
            );

            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'reminders_queued', v_count, 'message', v_count || ' event reminders successfully queued.');
END;
$$;

CREATE OR REPLACE FUNCTION public.resend_registration_pass(p_registration_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_reg RECORD;
    v_event RECORD;
    v_student RECORD;
    v_idempotency_key TEXT;
    v_outbox_id UUID;
BEGIN
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Authentication required.');
    END IF;

    SELECT * INTO v_reg FROM public.registrations WHERE id = p_registration_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Registration not found.');
    END IF;

    SELECT * INTO v_event FROM public.events WHERE id = v_reg.event_id;

    IF v_reg.student_id <> v_caller_id
       AND NOT public.has_event_permission(v_caller_id, v_event.club_id, v_event.id, 'registrations.manage')
       AND NOT public.check_is_platform_admin(v_caller_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'You do not have permission to resend this pass.');
    END IF;

    IF v_reg.status <> 'confirmed' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Digital pass cannot be sent because registration status is "' || v_reg.status || '". Only confirmed registrations have active passes.');
    END IF;

    SELECT display_name, email INTO v_student FROM public.profiles WHERE id = v_reg.student_id;
    IF v_student.email IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Student has no registered email address.');
    END IF;

    v_idempotency_key := 'resend_pass_' || v_reg.id::text || '_' || TO_CHAR(now(), 'YYYYMMDDHH24MI');

    INSERT INTO public.email_outbox (
        recipient_email, recipient_name, template_type, subject, payload, idempotency_key,
        event_id, registration_id, user_id, status, created_at, updated_at
    ) VALUES (
        TRIM(v_student.email), TRIM(COALESCE(v_student.display_name, 'Student Attendee')),
        'registration_confirmed', 'Your Digital Pass: ' || v_event.title,
        jsonb_build_object(
            'event_title', v_event.title, 'ticket_code', v_reg.ticket_code, 'qr_token', v_reg.qr_token,
            'start_date', v_event.start_date, 'venue_name', v_event.venue_name, 'team_name', v_reg.team_name, 'is_resend', true
        ),
        v_idempotency_key, v_event.id, v_reg.id, v_reg.student_id, 'pending', now(), now()
    )
    ON CONFLICT (idempotency_key) DO UPDATE SET updated_at = now()
    RETURNING id INTO v_outbox_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Pass email queued successfully for ' || v_student.email,
        'recipient_email', v_student.email,
        'ticket_code', v_reg.ticket_code,
        'outbox_id', v_outbox_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.resend_outbox_email(p_outbox_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_email TEXT := auth.jwt()->>'email';
  v_outbox RECORD;
  v_event RECORD;
  v_now TIMESTAMPTZ := now();
  v_wait_seconds INT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'You must be signed in to request an email resend.');
  END IF;

  SELECT * INTO v_outbox FROM public.email_outbox WHERE id = p_outbox_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'NOT_FOUND', 'message', 'Email record could not be found.');
  END IF;

  IF v_outbox.user_id IS DISTINCT FROM v_user_id
     AND lower(COALESCE(v_outbox.recipient_email, '')) != lower(COALESCE(v_user_email, '')) THEN
    IF v_outbox.event_id IS NOT NULL THEN
      SELECT * INTO v_event FROM public.events WHERE id = v_outbox.event_id;
      IF NOT FOUND OR NOT (
        public.has_event_permission(v_user_id, v_event.club_id, v_event.id, 'registrations.manage')
        OR public.has_event_permission(v_user_id, v_event.club_id, v_event.id, 'events.edit')
        OR public.check_is_platform_admin(v_user_id)
      ) THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'You are not authorized to resend this notification.');
      END IF;
    ELSE
      RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'You are not authorized to resend this notification.');
    END IF;
  END IF;

  IF v_outbox.retry_count >= v_outbox.max_retries THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'MAX_RETRIES_EXCEEDED', 'message', format('Maximum retry limit (%s) has been reached for this email.', v_outbox.max_retries));
  END IF;

  IF v_outbox.last_attempt_at IS NOT NULL AND (v_now - v_outbox.last_attempt_at) < INTERVAL '60 seconds' THEN
    v_wait_seconds := EXTRACT(SECOND FROM (INTERVAL '60 seconds' - (v_now - v_outbox.last_attempt_at)))::INT;
    RETURN jsonb_build_object('success', false, 'error_code', 'RATE_LIMITED', 'message', format('Please wait %s seconds before resending this email.', GREATEST(v_wait_seconds, 1)));
  END IF;

  UPDATE public.email_outbox
  SET status = 'pending', retry_count = v_outbox.retry_count + 1, last_attempt_at = v_now, updated_at = v_now
  WHERE id = p_outbox_id;

  RETURN jsonb_build_object('success', true, 'message', 'Email queued for resending.', 'outbox_id', p_outbox_id, 'retry_count', v_outbox.retry_count + 1);
END;
$$;

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
SET search_path = pg_catalog, extensions, public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_profile RECORD;
  v_caller_auth_email TEXT;
  v_caller_confirmed_at TIMESTAMPTZ;
  v_target_profile RECORD;
  v_target_auth_email TEXT;
  v_target_confirmed_at TIMESTAMPTZ;
  v_team RECORD;
  v_event RECORD;
  v_team_member_rec RECORD;
  v_leader_reg RECORD;
  v_member_reg RECORD;
  v_member_index INT;
  v_member_ticket_code TEXT;
  v_member_qr_token TEXT;
  v_now TIMESTAMPTZ := now();
  v_is_self BOOLEAN := false;
  v_is_leader BOOLEAN := false;
  v_is_organizer BOOLEAN := false;
  v_is_admin BOOLEAN := false;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'outcome', 'UNAUTHENTICATED', 'message', 'You must be signed in to synchronize team registrations.');
  END IF;

  SELECT email, email_confirmed_at INTO v_caller_auth_email, v_caller_confirmed_at FROM auth.users WHERE id = v_caller_id;
  IF v_caller_auth_email IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'outcome', 'UNAUTHENTICATED', 'message', 'Caller account not found in authentication provider.');
  END IF;
  IF v_caller_confirmed_at IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'outcome', 'UNVERIFIED_EMAIL', 'message', 'Please verify your student email address before synchronizing your event pass.');
  END IF;

  SELECT * INTO v_team FROM public.teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'outcome', 'NOT_FOUND', 'message', 'Team not found.');
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = v_team.event_id;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'outcome', 'NOT_FOUND', 'message', 'Associated event not found.');
  END IF;

  SELECT * INTO v_caller_profile FROM public.profiles WHERE id = v_caller_id;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'outcome', 'UNAUTHENTICATED', 'message', 'Caller profile not found.');
  END IF;

  v_is_self := (v_caller_id = p_member_user_id);
  v_is_leader := (v_caller_id = v_team.leader_id);
  v_is_organizer := public.has_event_permission(v_caller_id, v_event.club_id, v_event.id, 'registrations.manage');
  v_is_admin := public.check_is_platform_admin(v_caller_id);

  IF NOT (v_is_self OR v_is_leader OR v_is_organizer OR v_is_admin) THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'outcome', 'FORBIDDEN', 'message', 'Access denied. You are not authorized to synchronize registrations for this team.');
  END IF;

  SELECT * INTO v_team_member_rec FROM public.team_members WHERE team_id = v_team.id AND user_id = p_member_user_id;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'outcome', 'FORBIDDEN', 'message', 'Target user is not an assigned member of this team.');
  END IF;

  IF v_team_member_rec.status IS DISTINCT FROM 'accepted' THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'outcome', 'FORBIDDEN', 'status', v_team_member_rec.status, 'message', 'Team membership is not accepted.');
  END IF;

  IF v_is_self THEN
    IF LOWER(TRIM(v_team_member_rec.email)) IS DISTINCT FROM LOWER(TRIM(v_caller_auth_email)) THEN
      RETURN pg_catalog.jsonb_build_object('success', false, 'outcome', 'FORBIDDEN', 'message', 'Authenticated user verified email does not match accepted team membership record.');
    END IF;
    IF p_member_email IS NOT NULL AND NULLIF(TRIM(p_member_email), '') IS NOT NULL THEN
      IF LOWER(TRIM(p_member_email)) IS DISTINCT FROM LOWER(TRIM(v_caller_auth_email)) THEN
        RETURN pg_catalog.jsonb_build_object('success', false, 'outcome', 'FORBIDDEN', 'message', 'Supplied member email does not match authenticated profile email.');
      END IF;
    END IF;
  ELSE
    SELECT * INTO v_target_profile FROM public.profiles WHERE id = p_member_user_id;
    IF NOT FOUND THEN
      RETURN pg_catalog.jsonb_build_object('success', false, 'outcome', 'FORBIDDEN', 'message', 'Target member profile not found.');
    END IF;
    SELECT email, email_confirmed_at INTO v_target_auth_email, v_target_confirmed_at FROM auth.users WHERE id = p_member_user_id;
    IF v_target_auth_email IS NULL OR v_target_confirmed_at IS NULL THEN
      RETURN pg_catalog.jsonb_build_object('success', false, 'outcome', 'UNVERIFIED_EMAIL', 'message', 'Target member email is unverified.');
    END IF;
    IF LOWER(TRIM(v_team_member_rec.email)) IS DISTINCT FROM LOWER(TRIM(v_target_auth_email)) THEN
      RETURN pg_catalog.jsonb_build_object('success', false, 'outcome', 'FORBIDDEN', 'message', 'Target member verified email mismatch.');
    END IF;
  END IF;

  SELECT * INTO v_leader_reg FROM public.registrations WHERE id = v_team.registration_id;
  IF NOT FOUND THEN
    SELECT * INTO v_leader_reg FROM public.registrations WHERE event_id = v_team.event_id AND student_id = v_team.leader_id ORDER BY created_at DESC LIMIT 1;
  END IF;

  SELECT * INTO v_member_reg FROM public.registrations WHERE event_id = v_team.event_id AND student_id = p_member_user_id;
  IF FOUND THEN
    UPDATE public.registrations
    SET team_id = v_team.id, team_name = v_team.name,
        status = COALESCE(v_leader_reg.status, status),
        ticket_issued_at = CASE WHEN COALESCE(v_leader_reg.status, status) = 'confirmed' THEN COALESCE(ticket_issued_at, v_now) ELSE NULL END,
        updated_at = v_now
    WHERE id = v_member_reg.id;

    UPDATE public.team_members SET registration_id = v_member_reg.id, updated_at = v_now WHERE team_id = v_team.id AND user_id = p_member_user_id;

    RETURN pg_catalog.jsonb_build_object('success', true, 'outcome', 'SYNCHRONIZED', 'registration_id', v_member_reg.id, 'ticket_code', v_member_reg.ticket_code, 'is_new', false);
  END IF;

  SELECT count(*) + 1 INTO v_member_index FROM public.registrations WHERE team_id = v_team.id AND student_id != v_team.leader_id;
  IF v_leader_reg.ticket_code IS NOT NULL THEN
    v_member_ticket_code := format('%s-M%s', v_leader_reg.ticket_code, v_member_index);
  ELSE
    v_member_ticket_code := format('FF-%s', upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8)));
  END IF;

  v_member_qr_token := 'FFQ_' || UPPER(encode(extensions.gen_random_bytes(32), 'hex'));

  INSERT INTO public.registrations (
    event_id, student_id, status, ticket_code, qr_token, ticket_issued_at,
    team_name, team_id, team_members, participant_details, approval_status, created_at, updated_at
  ) VALUES (
    v_team.event_id, p_member_user_id, COALESCE(v_leader_reg.status, 'confirmed'),
    v_member_ticket_code, v_member_qr_token,
    CASE WHEN COALESCE(v_leader_reg.status, 'confirmed') = 'confirmed' THEN v_now ELSE NULL END,
    v_team.name, v_team.id, COALESCE(v_leader_reg.team_members, '[]'::jsonb), p_participant_details,
    COALESCE(v_leader_reg.approval_status, 'approved'), v_now, v_now
  ) RETURNING * INTO v_member_reg;

  UPDATE public.team_members SET registration_id = v_member_reg.id, updated_at = v_now WHERE team_id = v_team.id AND user_id = p_member_user_id;

  RETURN pg_catalog.jsonb_build_object('success', true, 'outcome', 'CREATED', 'registration_id', v_member_reg.id, 'ticket_code', v_member_reg.ticket_code, 'is_new', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_event_meeting_details(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_event RECORD;
  v_reg RECORD;
  v_now TIMESTAMPTZ := now();
  v_access_start TIMESTAMPTZ;
  v_is_organizer BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('accessible', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Please sign in to access session meeting credentials.');
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('accessible', false, 'error_code', 'NOT_FOUND', 'message', 'Event not found.');
  END IF;

  -- Active club staff/viewer OR delegated staff for this event OR platform admin
  v_is_organizer := public.has_event_permission(v_user_id, v_event.club_id, v_event.id, 'events.view')
                    OR public.check_is_platform_admin(v_user_id);

  IF NOT v_is_organizer THEN
    SELECT * INTO v_reg FROM public.registrations
    WHERE event_id = p_event_id AND student_id = v_user_id AND status = 'confirmed';

    IF NOT FOUND THEN
      RETURN jsonb_build_object('accessible', false, 'error_code', 'REGISTRATION_REQUIRED', 'message', 'Meeting links are restricted to confirmed registered attendees.');
    END IF;

    v_access_start := v_event.start_date - (COALESCE(v_event.access_window_minutes, 30) || ' minutes')::interval;
    IF v_now < v_access_start THEN
      RETURN jsonb_build_object('accessible', false, 'error_code', 'WINDOW_NOT_OPEN', 'message', format('Meeting link unlocks %s minutes before session start.', COALESCE(v_event.access_window_minutes, 30)), 'unlocks_at', v_access_start);
    END IF;

    IF v_event.end_date IS NOT NULL AND v_now > v_event.end_date THEN
      RETURN jsonb_build_object('accessible', false, 'error_code', 'EVENT_CONCLUDED', 'message', 'This session has already concluded.');
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

-- ─── 7. Close Unauthenticated / Missing-Auth Gaps in Legacy Security Definer RPCs ──

CREATE OR REPLACE FUNCTION public.sync_team_payment_approval(
  p_registration_id UUID,
  p_decision TEXT,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_lead_reg RECORD;
  v_event RECORD;
  v_now TIMESTAMPTZ := now();
  v_new_status TEXT;
  v_updated_count INT := 0;
BEGIN
  IF v_caller_id IS NULL AND auth.role() <> 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Authentication required.');
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'INVALID_DECISION', 'message', 'Invalid decision.');
  END IF;

  SELECT * INTO v_lead_reg FROM public.registrations WHERE id = p_registration_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Registration not found.');
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = v_lead_reg.event_id;
  IF auth.role() <> 'service_role' AND NOT (
    public.has_event_permission(v_caller_id, v_event.club_id, v_event.id, 'payments.verify')
    OR public.check_is_platform_admin(v_caller_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'Insufficient permissions to synchronize team payment status.');
  END IF;

  v_new_status := CASE WHEN p_decision = 'approved' THEN 'confirmed' ELSE 'rejected' END;

  UPDATE public.registrations
  SET status = v_new_status::public.registration_status,
      qr_token = CASE
        WHEN v_new_status = 'confirmed' AND NULLIF(TRIM(qr_token), '') IS NULL
          THEN 'FFQ_' || UPPER(encode(extensions.gen_random_bytes(32), 'hex'))
        ELSE qr_token
      END,
      ticket_issued_at = CASE WHEN v_new_status = 'confirmed' THEN COALESCE(ticket_issued_at, v_now) ELSE NULL END,
      rejection_reason = CASE WHEN v_new_status = 'rejected' THEN COALESCE(p_rejection_reason, rejection_reason) ELSE NULL END,
      updated_at = v_now
  WHERE id = p_registration_id;

  v_updated_count := 1;

  IF v_lead_reg.team_id IS NOT NULL THEN
    UPDATE public.registrations
    SET status = v_new_status::public.registration_status,
        qr_token = CASE
          WHEN v_new_status = 'confirmed' AND NULLIF(TRIM(qr_token), '') IS NULL
            THEN 'FFQ_' || UPPER(encode(extensions.gen_random_bytes(32), 'hex'))
          ELSE qr_token
        END,
        ticket_issued_at = CASE WHEN v_new_status = 'confirmed' THEN COALESCE(ticket_issued_at, v_now) ELSE NULL END,
        rejection_reason = CASE WHEN v_new_status = 'rejected' THEN COALESCE(p_rejection_reason, rejection_reason) ELSE NULL END,
        updated_at = v_now
    WHERE team_id = v_lead_reg.team_id AND id != p_registration_id;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    v_updated_count := v_updated_count + 1;
  END IF;

  RETURN jsonb_build_object('success', true, 'status', v_new_status, 'registrations_updated', v_updated_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_waitlist_attendee(p_waitlist_entry_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_entry RECORD;
  v_event RECORD;
  v_current_count INT;
BEGIN
  IF v_caller_id IS NULL AND auth.role() <> 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED');
  END IF;

  SELECT * INTO v_entry FROM public.event_waitlist_entries WHERE id = p_waitlist_entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'WAITLIST_ENTRY_NOT_FOUND');
  END IF;

  IF v_entry.status NOT IN ('waiting', 'offered') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS', 'current_status', v_entry.status);
  END IF;

  SELECT id, club_id, capacity, title INTO v_event FROM public.events WHERE id = v_entry.event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'EVENT_NOT_FOUND');
  END IF;

  IF auth.role() <> 'service_role' AND NOT (
    public.has_event_permission(v_caller_id, v_event.club_id, v_event.id, 'registrations.manage')
    OR public.check_is_platform_admin(v_caller_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
  END IF;

  SELECT COUNT(*) INTO v_current_count FROM public.registrations WHERE event_id = v_entry.event_id AND status = 'confirmed';
  IF v_event.capacity IS NOT NULL AND v_current_count >= v_event.capacity THEN
    RETURN jsonb_build_object('success', false, 'error', 'CAPACITY_REACHED', 'capacity', v_event.capacity, 'current', v_current_count);
  END IF;

  UPDATE public.event_waitlist_entries SET status = 'claimed', updated_at = now() WHERE id = p_waitlist_entry_id;

  RETURN jsonb_build_object(
    'success', true,
    'entry_id', v_entry.id,
    'event_id', v_entry.event_id,
    'student_id', v_entry.student_id,
    'event_title', v_event.title
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_automation_queue_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_queued_emails INT := 0;
  v_sent_emails INT := 0;
  v_failed_emails INT := 0;
  v_push_subs_count INT := 0;
  v_waitlist_count INT := 0;
  v_active_automations INT := 0;
BEGIN
  IF (v_caller_id IS NULL OR NOT public.check_is_platform_admin(v_caller_id)) AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Forbidden: Platform administrator privileges required.';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_outbox') THEN
    SELECT COUNT(*) INTO v_queued_emails FROM public.email_outbox WHERE status IN ('pending', 'queued', 'retry');
    SELECT COUNT(*) INTO v_sent_emails FROM public.email_outbox WHERE status = 'sent';
    SELECT COUNT(*) INTO v_failed_emails FROM public.email_outbox WHERE status = 'failed';
  END IF;

  SELECT COUNT(*) INTO v_push_subs_count FROM public.push_subscriptions;
  SELECT COUNT(*) INTO v_waitlist_count FROM public.event_waitlist_entries WHERE status IN ('waiting', 'offered');
  SELECT COUNT(*) INTO v_active_automations FROM public.club_event_automations WHERE is_enabled = true;

  RETURN jsonb_build_object(
    'emails_queued', v_queued_emails,
    'emails_sent', v_sent_emails,
    'emails_failed', v_failed_emails,
    'push_subscriptions_count', v_push_subs_count,
    'waitlist_active_count', v_waitlist_count,
    'active_automations_count', v_active_automations
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_event_attendance_stats(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_event RECORD;
  v_capacity INT;
  v_confirmed_count INT := 0;
  v_checked_in_count INT := 0;
  v_pending_payment_count INT := 0;
  v_cancelled_count INT := 0;
BEGIN
  SELECT id, club_id, capacity INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'EVENT_NOT_FOUND');
  END IF;

  IF auth.role() <> 'service_role' AND (
    v_caller_id IS NULL
    OR NOT (
      public.has_event_permission(v_caller_id, v_event.club_id, v_event.id, 'reports.view')
      OR public.has_event_permission(v_caller_id, v_event.club_id, v_event.id, 'registrations.view')
      OR public.check_is_platform_admin(v_caller_id)
    )
  ) THEN
    RETURN jsonb_build_object('error', 'FORBIDDEN', 'message', 'Insufficient permissions to inspect event attendance statistics.');
  END IF;

  v_capacity := v_event.capacity;

  SELECT
    COUNT(*) FILTER (WHERE status IN ('confirmed', 'attended')),
    COUNT(*) FILTER (WHERE status = 'pending_payment'),
    COUNT(*) FILTER (WHERE status = 'cancelled')
  INTO v_confirmed_count, v_pending_payment_count, v_cancelled_count
  FROM public.registrations
  WHERE event_id = p_event_id;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'check_ins') THEN
    SELECT COUNT(DISTINCT registration_id) INTO v_checked_in_count FROM public.check_ins WHERE event_id = p_event_id;
  END IF;

  RETURN jsonb_build_object(
    'capacity', COALESCE(v_capacity, 0),
    'confirmed_count', v_confirmed_count,
    'checked_in_count', v_checked_in_count,
    'pending_payment_count', v_pending_payment_count,
    'cancelled_count', v_cancelled_count,
    'remaining_capacity', GREATEST(0, COALESCE(v_capacity, 0) - v_confirmed_count)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_payment_failure(
    p_order_id UUID,
    p_error_code TEXT,
    p_error_description TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_student_id UUID := auth.uid();
    v_order RECORD;
    v_event RECORD;
BEGIN
    IF v_student_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'UNAUTHENTICATED', 'message', 'Authentication required.');
    END IF;

    SELECT * INTO v_order FROM public.payment_orders WHERE id = p_order_id FOR UPDATE;
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ORDER_NOT_FOUND', 'message', 'Payment order record was not found.');
    END IF;

    SELECT * INTO v_event FROM public.events WHERE id = v_order.event_id;
    IF v_order.student_id IS DISTINCT FROM v_student_id
       AND NOT public.has_event_permission(v_student_id, v_event.club_id, v_event.id, 'payments.verify')
       AND NOT public.check_is_platform_admin(v_student_id) THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'FORBIDDEN', 'message', 'Unauthorized to modify this payment order.');
    END IF;

    IF v_order.status = 'paid' THEN
        RETURN jsonb_build_object('success', false, 'error_code', 'ORDER_ALREADY_PAID', 'message', 'Cannot fail an already paid order.');
    END IF;

    UPDATE public.payment_orders
    SET status = 'failed', error_code = COALESCE(p_error_code, 'PAYMENT_FAILED'), error_description = p_error_description, updated_at = now()
    WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true, 'message', 'Payment failure recorded.', 'order_id', p_order_id, 'status', 'failed');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_college_verification(
  p_college_id UUID,
  p_new_status TEXT,
  p_authority TEXT,
  p_source_reference TEXT,
  p_academic_year TEXT DEFAULT '2024-2025',
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_admin_email TEXT;
  v_prev_status TEXT;
  v_college RECORD;
BEGIN
  IF v_admin_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Sign in required.');
  END IF;

  IF NOT public.check_is_platform_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN', 'message', 'Only platform admins can change verification status.');
  END IF;

  SELECT email INTO v_admin_email FROM public.profiles WHERE id = v_admin_id;
  SELECT * INTO v_college FROM public.colleges WHERE id = p_college_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Institution not found.');
  END IF;

  v_prev_status := v_college.verification_status;

  UPDATE public.colleges
  SET verification_status = p_new_status,
      verification_authority = COALESCE(p_authority, verification_authority),
      source_reference = COALESCE(p_source_reference, source_reference),
      academic_year = COALESCE(p_academic_year, academic_year),
      verification_notes = COALESCE(p_notes, verification_notes),
      verified_at = CASE WHEN p_new_status = 'verified' THEN now() ELSE verified_at END,
      verified_by = CASE WHEN p_new_status = 'verified' THEN v_admin_id ELSE verified_by END,
      last_reviewed_at = now(),
      updated_at = now()
  WHERE id = p_college_id;

  INSERT INTO public.college_verification_history (
    college_id, action, previous_status, new_status,
    verification_authority, source_reference, academic_year, notes,
    verified_by, verified_by_email, created_at
  ) VALUES (
    p_college_id, 'status_changed', v_prev_status, p_new_status,
    p_authority, p_source_reference, p_academic_year, p_notes,
    v_admin_id, COALESCE(v_admin_email, 'platform-admin@festflow'), now()
  );

  RETURN jsonb_build_object('success', true, 'college_id', p_college_id, 'previous_status', v_prev_status, 'new_status', p_new_status);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_team_payment_approval(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.promote_waitlist_attendee(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_automation_queue_metrics() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_event_attendance_stats(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_payment_failure(UUID, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sync_team_payment_approval(UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.promote_waitlist_attendee(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_automation_queue_metrics() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_event_attendance_stats(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_payment_failure(UUID, TEXT, TEXT) TO authenticated, service_role;

-- ─── 8. Real-time Publication Registration for Instant Role & Revocation Sync ─

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'club_members'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.club_members;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'club_invitations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.club_invitations;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'event_assignments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.event_assignments;
    END IF;
  END IF;
END $$;
