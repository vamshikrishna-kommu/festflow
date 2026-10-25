// Follow this setup guide to deploy: https://supabase.com/docs/guides/functions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  template:
    | 'registration_confirmed'
    | 'payment_received'
    | 'payment_approved'
    | 'payment_rejected'
    | 'event_cancelled'
    | 'event_reminder'
  to: string
  name?: string
  payload: Record<string, any>
  outbox_id?: string
}

function generateEmailHtml(template: string, name: string, payload: Record<string, any>): { subject: string; html: string; text: string } {
  const recipient = name || 'Student'
  const brandPurple = '#7c3aed'
  const brandCyan = '#06b6d4'
  const bgDark = '#0a0a0f'
  const cardBg = '#12121c'
  const textMuted = '#94a3b8'
  const textWhite = '#ffffff'

  let subject = 'FestFlow Event Notification'
  let bodyContent = ''
  let textFallback = ''

  if (template === 'registration_confirmed') {
    subject = `Registration Confirmed: ${payload.event_title || 'Campus Event'}`
    textFallback = `Hello ${recipient},\n\nYour registration for ${payload.event_title} is confirmed!\nDate: ${payload.start_date}\nVenue: ${payload.venue_name}\nTicket Code: ${payload.ticket_code}\n\nAccess your digital ticket here: ${payload.ticket_url || 'https://festflow.com/student/dashboard'}`
    bodyContent = `
      <h2 style="color: ${brandCyan}; margin-top: 0;">🎉 You're In!</h2>
      <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
        Hi <strong>${recipient}</strong>, your spot for <strong>${payload.event_title}</strong> has been secured.
      </p>
      <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 18px; margin: 20px 0;">
        <p style="margin: 4px 0; color: ${textWhite};">📅 <strong>Date:</strong> ${payload.start_date || 'Check dashboard'}</p>
        <p style="margin: 4px 0; color: ${textWhite};">📍 <strong>Venue:</strong> ${payload.venue_name || 'Campus Venue'}</p>
        <p style="margin: 4px 0; color: ${textWhite};">🎟️ <strong>Ticket Code:</strong> <span style="font-family: monospace; font-size: 16px; font-weight: bold; color: ${brandCyan};">${payload.ticket_code}</span></p>
      </div>
      <p style="text-align: center; margin: 25px 0;">
        <a href="${payload.ticket_url || '#'}" style="background: linear-gradient(135deg, ${brandPurple}, ${brandCyan}); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">View Digital Pass & QR</a>
      </p>
    `
  } else if (template === 'payment_received') {
    subject = `Payment Submitted: ${payload.event_title || 'Campus Event'}`
    textFallback = `Hello ${recipient},\n\nYour payment reference (${payload.transaction_reference}) for ${payload.event_title} has been submitted for organizer review. A confirmed ticket will be generated once verified.`
    bodyContent = `
      <h2 style="color: #fbbf24; margin-top: 0;">⏳ Payment Submitted for Review</h2>
      <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
        Hi <strong>${recipient}</strong>, we received your payment submission for <strong>${payload.event_title}</strong>.
      </p>
      <div style="background: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.25); border-radius: 12px; padding: 16px; margin: 20px 0;">
        <p style="margin: 4px 0; color: ${textWhite};">💳 <strong>Amount:</strong> ₹${payload.amount}</p>
        <p style="margin: 4px 0; color: ${textWhite};">🔢 <strong>Transaction UTR:</strong> <span style="font-family: monospace; font-weight: bold;">${payload.transaction_reference}</span></p>
      </div>
      <p style="color: ${textMuted}; font-size: 13px;">
        The club organizer is reviewing your transaction. You will receive an instant notification as soon as verification is complete.
      </p>
    `
  } else if (template === 'payment_approved') {
    subject = `Payment Approved! Your Ticket for ${payload.event_title || 'Campus Event'}`
    textFallback = `Hello ${recipient},\n\nYour payment for ${payload.event_title} has been verified and approved!\nYour ticket code is: ${payload.ticket_code}\nView your pass: ${payload.ticket_url || 'https://festflow.com/student/dashboard'}`
    bodyContent = `
      <h2 style="color: #34d399; margin-top: 0;">✅ Payment Verified & Ticket Ready!</h2>
      <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
        Great news <strong>${recipient}</strong>! Your payment for <strong>${payload.event_title}</strong> has been confirmed by the organizers.
      </p>
      <div style="background: rgba(52, 211, 153, 0.08); border: 1px solid rgba(52, 211, 153, 0.25); border-radius: 12px; padding: 18px; margin: 20px 0;">
        <p style="margin: 4px 0; color: ${textWhite};">🎟️ <strong>Ticket Code:</strong> <span style="font-family: monospace; font-size: 16px; font-weight: bold; color: #34d399;">${payload.ticket_code}</span></p>
        <p style="margin: 4px 0; color: ${textWhite};">📍 <strong>Venue:</strong> ${payload.venue_name}</p>
      </div>
      <p style="text-align: center; margin: 25px 0;">
        <a href="${payload.ticket_url || '#'}" style="background: #34d399; color: #000; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">Access Digital QR Pass</a>
      </p>
    `
  } else if (template === 'payment_rejected') {
    subject = `Payment Verification Issue: ${payload.event_title || 'Campus Event'}`
    textFallback = `Hello ${recipient},\n\nYour payment submission for ${payload.event_title} could not be verified by the organizers.\nReason: ${payload.reason || 'Transaction could not be matched.'}\nPlease resubmit with your correct 12-digit UTR.`
    bodyContent = `
      <h2 style="color: #f87171; margin-top: 0;">⚠️ Payment Verification Issue</h2>
      <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
        Hi <strong>${recipient}</strong>, the organizers could not verify your payment submission for <strong>${payload.event_title}</strong>.
      </p>
      <div style="background: rgba(248, 113, 113, 0.08); border: 1px solid rgba(248, 113, 113, 0.25); border-radius: 12px; padding: 16px; margin: 20px 0;">
        <p style="margin: 4px 0; color: #fca5a5;"><strong>Organizer Reason:</strong></p>
        <p style="margin: 4px 0; color: ${textWhite}; font-style: italic;">"${payload.reason || 'Transaction reference not found in statement'}"</p>
      </div>
      <p style="color: ${textMuted}; font-size: 13px;">
        Please check your bank/UPI app statement for the 12-digit UTR number and resubmit your details to unlock your ticket.
      </p>
    `
  } else if (template === 'event_reminder') {
    subject = `Reminder: ${payload.event_title || 'Campus Event'} is Coming Up!`
    textFallback = `Hello ${recipient},\n\nReminder that ${payload.event_title} starts on ${payload.start_date} at ${payload.venue_name}.\nTicket Code: ${payload.ticket_code}\n${payload.custom_message ? `\nNote from organizer: ${payload.custom_message}` : ''}`
    bodyContent = `
      <h2 style="color: ${brandCyan}; margin-top: 0;">⏰ Event Reminder</h2>
      <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
        Hi <strong>${recipient}</strong>, your upcoming campus event <strong>${payload.event_title}</strong> is happening soon!
      </p>
      <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 16px; margin: 20px 0;">
        <p style="margin: 4px 0; color: ${textWhite};">📅 <strong>Date:</strong> ${payload.start_date}</p>
        <p style="margin: 4px 0; color: ${textWhite};">📍 <strong>Venue:</strong> ${payload.venue_name}</p>
        <p style="margin: 4px 0; color: ${textWhite};">🎟️ <strong>Pass:</strong> <span style="font-family: monospace; font-weight: bold;">${payload.ticket_code}</span></p>
        ${payload.custom_message ? `<p style="margin-top: 10px; color: #cbd5e1; font-style: italic; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 8px;">"${payload.custom_message}"</p>` : ''}
      </div>
      <p style="text-align: center; margin: 25px 0;">
        <a href="${payload.ticket_url || '#'}" style="background: linear-gradient(135deg, ${brandPurple}, ${brandCyan}); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">Open Pass for Gate Entry</a>
      </p>
    `
  } else if (template === 'event_cancelled') {
    subject = `Event Cancelled: ${payload.event_title || 'Campus Event'}`
    textFallback = `Hello ${recipient},\n\nWe regret to inform you that ${payload.event_title} has been cancelled by the organizers.\nReason: ${payload.reason || 'Event cancelled'}`
    bodyContent = `
      <h2 style="color: #f87171; margin-top: 0;">Event Cancelled</h2>
      <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
        Hi <strong>${recipient}</strong>, <strong>${payload.event_title}</strong> has been cancelled by the organizers.
      </p>
      <div style="background: rgba(248, 113, 113, 0.08); border: 1px solid rgba(248, 113, 113, 0.25); border-radius: 12px; padding: 16px; margin: 20px 0;">
        <p style="margin: 4px 0; color: ${textWhite};">Reason: ${payload.reason || 'Cancelled by organizing team'}</p>
      </div>
    `
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="margin: 0; padding: 20px; background-color: ${bgDark}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; margin: 0 auto; background-color: ${cardBg}; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; overflow: hidden;">
          <tr>
            <td style="padding: 24px 30px; border-bottom: 1px solid rgba(255,255,255,0.08); background: linear-gradient(135deg, rgba(124,58,237,0.2), rgba(6,182,212,0.2));">
              <span style="font-size: 20px; font-weight: bold; color: ${textWhite}; letter-spacing: -0.5px;">FestFlow</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              ${bodyContent}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 30px; border-top: 1px solid rgba(255,255,255,0.08); text-align: center; color: ${textMuted}; font-size: 12px;">
              <p style="margin: 0 0 4px 0;">FestFlow — College Event Platform</p>
              <p style="margin: 0;">This is an automated transactional notification. You can manage your event passes in your dashboard.</p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `

  return { subject, html, text: textFallback }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'notifications@festflow.com'
    const fromName = Deno.env.get('RESEND_FROM_NAME') || 'FestFlow Events'

    const body: EmailRequest = await req.json()
    const { template, to, name, payload, outbox_id } = body

    if (!to) {
      return new Response(
        JSON.stringify({ success: false, error: 'Recipient "to" email is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Explicit check: Never pretend an email was sent if Resend key is unconfigured
    if (!resendApiKey || resendApiKey === 'your-resend-api-key-here') {
      return new Response(
        JSON.stringify({
          success: false,
          configured: false,
          message: 'Transactional email delivery is not configured. RESEND_API_KEY secret is required.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { subject, html, text } = generateEmailHtml(template, name || '', payload || {})

    // Send via Resend API
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject,
        html,
        text,
      }),
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, error: resendData }),
        { status: resendResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Optional: Update outbox record in database if Supabase env is accessible
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (outbox_id && supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      await supabase
        .from('email_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', outbox_id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        configured: true,
        id: resendData.id,
        message: 'Email delivered successfully via Resend.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
