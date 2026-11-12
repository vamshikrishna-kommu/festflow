-- Migration 055: Fix register_for_event function overloading ambiguity
-- Created: 2026-11-13
-- Resolves PostgreSQL error:
-- "Could not choose the best candidate function between:
--  public.register_for_event(p_event_id => uuid, p_team_name => text, p_team_members => jsonb, p_custom_responses => jsonb, p_participant_details => jsonb),
--  public.register_for_event(p_event_id => uuid, p_team_name => text, p_team_members => jsonb, p_custom_responses => jsonb, p_participant_details => jsonb, p_ticket_tier_id => uuid)"
--
-- Root Cause:
-- Both the 5-parameter version and the 6-parameter compatibility wrapper had default arguments.
-- When a client invoked register_for_event with 5 named parameters, PostgreSQL could not determine
-- whether to invoke the 5-parameter version or the 6-parameter version with p_ticket_tier_id defaulted to NULL.
--
-- Solution:
-- 1. Drop the ambiguous 6-parameter overload with DEFAULT NULL.
-- 2. Grant explicit execute privileges on the canonical 5-parameter version.
-- 3. Provide a strict 6-parameter compatibility wrapper without defaults, ensuring unambiguous resolution.

-- ── 1. Drop the ambiguous 6-parameter overload ─────────────────────────────
DROP FUNCTION IF EXISTS public.register_for_event(uuid, text, jsonb, jsonb, jsonb, uuid);

-- ── 2. Explicit grants on canonical 5-parameter register_for_event ─────────
GRANT EXECUTE ON FUNCTION public.register_for_event(uuid, text, jsonb, jsonb, jsonb) TO authenticated, service_role;

-- ── 3. Unambiguous 6-parameter compatibility wrapper (no default on p_ticket_tier_id) ─
-- Callers passing 5 parameters will match ONLY the 5-parameter function.
-- Callers passing 6 parameters (including p_ticket_tier_id) will match ONLY this wrapper.
CREATE OR REPLACE FUNCTION public.register_for_event(
  p_event_id uuid,
  p_team_name text,
  p_team_members jsonb,
  p_custom_responses jsonb,
  p_participant_details jsonb,
  p_ticket_tier_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.register_for_event(
    p_event_id,
    p_team_name,
    p_team_members,
    p_custom_responses,
    CASE 
      WHEN p_ticket_tier_id IS NOT NULL THEN
        jsonb_set(COALESCE(p_participant_details, '{}'::jsonb), '{ticket_tier_id}', to_jsonb(p_ticket_tier_id::text))
      ELSE
        COALESCE(p_participant_details, '{}'::jsonb)
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_for_event(uuid, text, jsonb, jsonb, jsonb, uuid) TO authenticated, service_role;

