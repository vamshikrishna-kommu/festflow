-- =============================================================================
-- FestFlow — Migration 061: Fix Registrations Column-Level SELECT Grants & RLS
-- =============================================================================
-- Root Cause:
--   Migration 046 revoked table-level SELECT on public.registrations and
--   granted column-level SELECT only on the 22 columns that existed at the time,
--   explicitly excluding bearer credentials (qr_token, qr_token_hash).
--   Subsequent migrations (049, 054, 057) added new non-secret operational
--   columns (such as cancellation_request_status, refund_status, refund_amount,
--   refund_transaction_ref, waitlist_position, waitlist_offered_at, and
--   seat_reservation_id) without granting column-level SELECT on them to the
--   `authenticated` role.
--   Because PostgreSQL checks column privileges before RLS predicates, queries
--   referencing ungranted columns or wildcards immediately failed with:
--     SQLSTATE 42501: permission denied for table registrations
--
-- Security Model Preserved:
--   1. Row Level Security remains strictly ENABLED on registrations,
--      payment_submissions, and seat_reservations.
--   2. Table-level SELECT on public.registrations remains REVOKED from
--      authenticated, anon, and PUBLIC.
--   3. Sensitive credential columns (qr_token, qr_token_hash) remain strictly
--      REVOKED from authenticated, anon, and PUBLIC; student owners continue to
--      fetch their own pass credentials solely via SECURITY DEFINER RPC
--      public.get_student_ticket_pass(UUID).
--   4. Authenticated users receive column-level SELECT ONLY on non-secret
--      operational columns; row visibility continues to be enforced strictly by
--      least-privilege RLS policies (student owns row, authorized club member
--      with registrations.view / payments.view / reports.view, or platform admin).
--   5. Additive and idempotent: safe to run repeatedly on any schema revision.
-- =============================================================================

-- 1. Ensure expected optional columns exist safely (idempotent)
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS seat_reservation_id UUID;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS cancellation_request_status TEXT;

-- 2. Enforce least-privilege column-level SELECT on public.registrations
DO $$
DECLARE
  v_safe_columns TEXT;
BEGIN
  -- Keep table-wide SELECT revoked from all client roles
  REVOKE SELECT ON public.registrations FROM authenticated, anon, PUBLIC;

  -- Explicitly keep bearer credentials revoked from all client roles
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'registrations' AND column_name = 'qr_token'
  ) THEN
    EXECUTE 'REVOKE SELECT (qr_token) ON public.registrations FROM authenticated, anon, PUBLIC';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'registrations' AND column_name = 'qr_token_hash'
  ) THEN
    EXECUTE 'REVOKE SELECT (qr_token_hash) ON public.registrations FROM authenticated, anon, PUBLIC';
  END IF;

  -- Grant SELECT to authenticated strictly on non-secret operational columns
  SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
  INTO v_safe_columns
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'registrations'
    AND c.column_name NOT IN ('qr_token', 'qr_token_hash');

  IF v_safe_columns IS NOT NULL AND length(trim(v_safe_columns)) > 0 THEN
    EXECUTE format('GRANT SELECT (%s) ON public.registrations TO authenticated', v_safe_columns);
  END IF;
END $$;

-- 3. Ensure related tables keep RLS enabled and non-secret authenticated grants
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.payment_submissions') IS NOT NULL THEN
    ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.payment_submissions FROM anon;
    GRANT SELECT ON public.payment_submissions TO authenticated;
  END IF;

  IF to_regclass('public.seat_reservations') IS NOT NULL THEN
    ALTER TABLE public.seat_reservations ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.seat_reservations FROM anon;
    GRANT SELECT ON public.seat_reservations TO authenticated;
  END IF;
END $$;

-- 4. Re-verify least-privilege RLS policies on public.registrations
DROP POLICY IF EXISTS "students can view own registrations" ON public.registrations;
CREATE POLICY "students can view own registrations"
  ON public.registrations FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "clubs can view registrations for their events" ON public.registrations;
CREATE POLICY "clubs can view registrations for their events"
  ON public.registrations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = registrations.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.club_profiles cp
            WHERE cp.profile_id = e.club_id
              AND cp.profile_id = auth.uid()
          )
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.view')
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'payments.view')
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'reports.view')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS "clubs can update registrations for their events" ON public.registrations;
CREATE POLICY "clubs can update registrations for their events"
  ON public.registrations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = registrations.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.club_profiles cp
            WHERE cp.profile_id = e.club_id
              AND cp.profile_id = auth.uid()
          )
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.manage')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = registrations.event_id
        AND (
          e.club_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.club_profiles cp
            WHERE cp.profile_id = e.club_id
              AND cp.profile_id = auth.uid()
          )
          OR public.has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.manage')
          OR public.check_is_platform_admin(auth.uid())
        )
    )
  );

-- 5. Ensure RBAC helper execution grants exist for authenticated RLS checks
DO $$
BEGIN
  IF to_regprocedure('public.has_club_permission(uuid, uuid, text)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.has_club_permission(UUID, UUID, TEXT) TO authenticated, service_role;
  END IF;

  IF to_regprocedure('public.has_event_permission(uuid, uuid, uuid, text)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.has_event_permission(UUID, UUID, UUID, TEXT) TO authenticated, service_role;
  END IF;

  IF to_regprocedure('public.check_is_platform_admin(uuid)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.check_is_platform_admin(UUID) TO authenticated, service_role;
  END IF;

  IF to_regprocedure('public.get_student_ticket_pass(uuid)') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.get_student_ticket_pass(UUID) TO authenticated, service_role;
  END IF;
END $$;
