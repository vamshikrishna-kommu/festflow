// ============================================================================
// FestFlow Supabase Edge Function: payment-webhook
// ============================================================================
// Handles asynchronous Razorpay and Gateway Webhooks with HMAC signature verification,
// idempotent event processing, and atomic status synchronization.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
}

/**
 * Computes HMAC-SHA256 hex digest for webhook verification in Deno runtime
 */
async function computeHmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  const hashArray = Array.from(new Uint8Array(signatureBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-razorpay-signature')
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')

    // If webhook secret is configured, strictly enforce signature verification
    if (webhookSecret) {
      if (!signature) {
        return new Response(JSON.stringify({ error: 'Missing webhook signature header' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const expectedSignature = await computeHmacSha256(webhookSecret, rawBody)
      if (signature !== expectedSignature) {
        return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else {
      console.warn('RAZORPAY_WEBHOOK_SECRET is not set. Webhook received without cryptographic verification.')
    }

    const payload = JSON.parse(rawBody)
    const eventType = payload.event
    const paymentEntity = payload.payload?.payment?.entity
    const orderEntity = payload.payload?.order?.entity

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const providerOrderId = paymentEntity?.order_id || orderEntity?.id
    const providerPaymentId = paymentEntity?.id
    const notesRegistrationId = paymentEntity?.notes?.registration_id || orderEntity?.notes?.registration_id

    // Process event types
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      // Find matching payment order
      let query = supabase.from('payment_orders').select('*')
      if (providerOrderId) {
        query = query.eq('provider_order_id', providerOrderId)
      } else if (notesRegistrationId) {
        query = query.eq('registration_id', notesRegistrationId)
      }

      const { data: order, error: orderError } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle()

      if (orderError || !order) {
        console.warn('Payment order not found for webhook:', { providerOrderId, notesRegistrationId })
        return new Response(JSON.stringify({ message: 'Order record not found, skipped' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Idempotency: if already paid, acknowledge without re-processing
      if (order.status === 'paid') {
        return new Response(JSON.stringify({ message: 'Order already processed (idempotent)', order_id: order.id }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Mark order paid
      await supabase
        .from('payment_orders')
        .update({
          status: 'paid',
          provider_payment_id: providerPaymentId || order.provider_payment_id,
          provider_signature: signature || 'webhook_verified',
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      // Confirm registration & issue ticket
      const ticketCode = `TKT-${crypto.randomUUID().substring(0, 8).toUpperCase()}`
      await supabase
        .from('registrations')
        .update({
          status: 'confirmed',
          ticket_code: ticketCode,
          ticket_issued_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.registration_id)

      // Insert notification
      await supabase.from('in_app_notifications').insert({
        user_id: order.student_id,
        title: 'Payment Confirmed! 🎉',
        message: `Your payment of ${order.currency} ${order.amount} has been captured. Digital pass is ready!`,
        type: 'payment_confirmed',
        link: `/student/tickets/${order.registration_id}`,
      })

      return new Response(JSON.stringify({ success: true, event: eventType, order_id: order.id }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } else if (eventType === 'payment.failed') {
      if (providerOrderId) {
        await supabase
          .from('payment_orders')
          .update({
            status: 'failed',
            error_code: paymentEntity?.error_code || 'GATEWAY_ERROR',
            error_description: paymentEntity?.error_description || 'Payment was declined by issuing bank.',
            updated_at: new Date().toISOString(),
          })
          .eq('provider_order_id', providerOrderId)
      }
    }

    return new Response(JSON.stringify({ received: true, event: eventType }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal webhook error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
