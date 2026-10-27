// ============================================================================
// FestFlow Supabase Edge Function: payment-webhook (Decommissioned)
// ============================================================================
// Razorpay and asynchronous gateway webhooks have been decommissioned.
// FestFlow strictly uses Direct Organizer UPI payments with UTR verification.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  return new Response(
    JSON.stringify({
      success: false,
      error_code: 'WEBHOOK_DECOMMISSIONED',
      message: 'Razorpay payment webhooks have been decommissioned. FestFlow uses direct organizer UPI payments with UTR verification.',
    }),
    {
      status: 410,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
})
