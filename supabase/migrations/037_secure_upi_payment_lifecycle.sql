-- =============================================================================
-- FESTFLOW DATABASE MIGRATION 037: SECURE UPI PAYMENT LIFECYCLE HARDENING
-- =============================================================================
-- Revokes and drops the client-side auto-verify RPC function.
-- FestFlow enforces that all manual UPI payment submissions must be reviewed
-- and verified by the host club organizer via `public.review_payment_submission`
-- before entry passes are activated.
-- =============================================================================

-- 1. Drop the insecure client-callable auto_verify RPC
DROP FUNCTION IF EXISTS public.auto_verify_upi_payment(UUID, TEXT, TEXT, TEXT);

-- 2. Ensure RLS on payment_submissions is strictly enforced
ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;

-- 3. Document the authoritative UPI payment state machine:
--    a) Registration created for paid event -> registrations.status = 'pending_payment'
--    b) Student pays via UPI app & submits reference ->
--       payment_submissions: status = 'pending_review',
--       registrations: status = 'pending_approval' (or pending_payment with active submission)
--    c) Club Organizer reviews -> calls review_payment_submission(p_payment_id, 'approved'/'rejected', p_notes)
--       - IF approved: payment_submissions.status = 'approved',
--                      registrations.status = 'confirmed',
--                      registrations.ticket_issued_at = now()
--       - IF rejected: payment_submissions.status = 'rejected',
--                      registrations.status = 'rejected',
--                      registrations.rejection_reason = p_notes
--    d) Passes are strictly locked until registrations.status = 'confirmed' AND ticket_issued_at IS NOT NULL.
-- =============================================================================

