/**
 * api/send-email.ts
 *
 * Vercel Serverless Function for transactional email delivery:
 * - Native serverless execution on Vercel (same-origin, zero CORS issues)
 * - Directly dispatches emails via Resend API (https://api.resend.com/emails)
 * - Graceful provider configuration check (reports configured: false when RESEND_API_KEY is unset)
 * - Auto-fallback to onboarding@resend.dev if custom domain is pending DNS verification
 * - Generates responsive HTML templates with FestFlow 2.0 branding
 */

interface EmailPayload {
  template: string
  to: string
  name?: string
  payload?: Record<string, any>
  outbox_id?: string
  event_id?: string
  registration_id?: string
  user_id?: string
  club_id?: string
}

function sanitizeText(str: unknown): string {
  if (!str || typeof str !== 'string') return ''
  return str.replace(/[<>&"']/g, (m) => {
    switch (m) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
      case '"': return '&quot;'
      case "'": return '&#39;'
      default: return m
    }
  })
}

function sanitizeSafeUrl(url: unknown, fallback = 'https://festflow.online'): string {
  if (!url || typeof url !== 'string') return fallback
  const trimmed = url.trim()
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return trimmed
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    }
  } catch {
    // Malformed URL
  }
  return fallback
}

function generateEmailContent(
  template: string,
  name: string,
  payload: Record<string, any>
): { subject: string; html: string; text: string } {
  const recipient = sanitizeText(name || 'FestFlow Member')
  const brandPurple = '#7c3aed'
  const brandCyan = '#06b6d4'
  const textWhite = '#ffffff'
  const textMuted = '#94a3b8'

  const eventTitle = sanitizeText(payload.event_title || payload.eventTitle || 'FestFlow Campus Event')
  const venueName = sanitizeText(payload.venue_name || payload.venueName || 'Campus Venue')
  const ticketCode = sanitizeText(payload.ticket_code || payload.ticketCode || '')
  const teamName = sanitizeText(payload.team_name || payload.teamName || '')

  let subject = 'FestFlow Event Notification'
  let bodyContent = ''
  let textFallback = ''

  switch (template) {
    case 'team_invitation': {
      const safeJoinUrl = sanitizeSafeUrl(payload.join_url || payload.joinUrl, 'https://festflow.online/discover')
      const invCode = sanitizeText(payload.invite_code || payload.inviteCode || '')
      const ldrName = sanitizeText(payload.leader_name || payload.leaderName || 'Your team leader')

      subject = `Squad Invitation: Join "${teamName}" for ${eventTitle}`
      textFallback = `Hello ${recipient},\n\n${ldrName} has invited you to join "${teamName}" for ${eventTitle}.\n\nSquad Invitation Code: ${invCode}\n\nAccept your invitation and claim your pass:\n${safeJoinUrl}\n\nFestFlow Team`
      bodyContent = `
        <h2 style="color: ${brandCyan}; margin-top: 0;">🛡️ You're Invited to Join a Squad!</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, <strong>${ldrName}</strong> invited you to join <strong>"${teamName}"</strong> for <strong>${eventTitle}</strong>.
        </p>
        <div style="background: rgba(6, 182, 212, 0.08); border: 1px solid rgba(6, 182, 212, 0.25); border-radius: 12px; padding: 18px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">🛡️ <strong>Squad:</strong> ${teamName}</p>
          <p style="margin: 4px 0; color: ${textWhite};">🎟️ <strong>Invite Code:</strong> <span style="font-family: monospace; font-size: 16px; font-weight: bold; color: ${brandCyan};">${invCode}</span></p>
          <p style="margin: 4px 0; color: ${textMuted}; font-size: 13px;">⏰ Expires in 7 days</p>
        </div>
        <p style="text-align: center; margin: 25px 0;">
          <a href="${safeJoinUrl}" style="background: linear-gradient(135deg, ${brandPurple}, ${brandCyan}); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">Accept Squad Invitation</a>
        </p>
      `
      break
    }

    case 'team_invitation_accepted': {
      const safeDashboardUrl = sanitizeSafeUrl(payload.dashboard_url, 'https://festflow.online/student/dashboard')
      const memberName = sanitizeText(payload.member_name || payload.memberName || 'A member')
      subject = `Squad Update: ${memberName} joined "${teamName}"`
      textFallback = `Hello ${recipient},\n\nGreat news! ${memberName} has accepted your invitation and joined "${teamName}" for ${eventTitle}.\n\nView squad roster:\n${safeDashboardUrl}`
      bodyContent = `
        <h2 style="color: #34d399; margin-top: 0;">🤝 New Teammate Joined!</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, <strong>${memberName}</strong> has accepted your invitation to join <strong>"${teamName}"</strong> for <strong>${eventTitle}</strong>.
        </p>
        <div style="background: rgba(52, 211, 153, 0.08); border: 1px solid rgba(52, 211, 153, 0.25); border-radius: 16px; padding: 18px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">👥 <strong>Member:</strong> ${memberName}</p>
          <p style="margin: 4px 0; color: ${textWhite};">🛡️ <strong>Squad:</strong> ${teamName}</p>
        </div>
        <p style="text-align: center; margin: 25px 0;">
          <a href="${safeDashboardUrl}" style="background: linear-gradient(135deg, ${brandPurple}, ${brandCyan}); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">View Squad in Dashboard</a>
        </p>
      `
      break
    }

    case 'ticket_issued':
    case 'registration_confirmed': {
      const safeTicketUrl = sanitizeSafeUrl(payload.ticket_url || payload.ticketUrl, 'https://festflow.online/student/dashboard')
      subject = payload.is_resend
        ? `[Pass Resend] Digital Entry Ticket: ${eventTitle}`
        : `Your Digital Pass: ${eventTitle}`
      textFallback = `Hello ${recipient},\n\nYour spot for ${eventTitle} is ready!\nDate: ${sanitizeText(payload.start_date || 'Check pass')}\nVenue: ${venueName}\nTicket Code: ${ticketCode}\n\nAccess your digital pass and QR code:\n${safeTicketUrl}`
      bodyContent = `
        <h2 style="color: ${brandCyan}; margin-top: 0;">🎟️ Your Digital Entry Pass is Ready!</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, your entry ticket for <strong>${eventTitle}</strong> has been issued.
        </p>
        <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 20px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">📅 <strong>Date:</strong> ${sanitizeText(payload.start_date || 'Check pass')}</p>
          <p style="margin: 4px 0; color: ${textWhite};">📍 <strong>Venue:</strong> ${venueName}</p>
          <p style="margin: 4px 0; color: ${textWhite};">🎟️ <strong>Ticket Code:</strong> <span style="font-family: monospace; font-size: 18px; font-weight: bold; color: ${brandCyan};">${ticketCode}</span></p>
          ${teamName ? `<p style="margin: 4px 0; color: #a78bfa;">🛡️ <strong>Squad:</strong> ${teamName}</p>` : ''}
        </div>
        <p style="text-align: center; margin: 25px 0;">
          <a href="${safeTicketUrl}" style="background: linear-gradient(135deg, ${brandPurple}, ${brandCyan}); color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; display: inline-block;">View Digital Pass & QR Code</a>
        </p>
      `
      break
    }

    case 'payment_approved': {
      const safeTicketUrl = sanitizeSafeUrl(payload.ticket_url || payload.ticketUrl, 'https://festflow.online/student/dashboard')
      subject = `Payment Verified: ${eventTitle}`
      textFallback = `Hello ${recipient},\n\nYour payment for ${eventTitle} has been verified and approved by the organizer!\nTicket Code: ${ticketCode}\n\nAccess your digital pass:\n${safeTicketUrl}`
      bodyContent = `
        <h2 style="color: #34d399; margin-top: 0;">✅ Payment Verified & Pass Issued!</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, your payment for <strong>${eventTitle}</strong> has been verified by the organizers.
        </p>
        <div style="background: rgba(52, 211, 153, 0.08); border: 1px solid rgba(52, 211, 153, 0.25); border-radius: 16px; padding: 18px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">🎟️ <strong>Ticket Code:</strong> <span style="font-family: monospace; font-size: 16px; font-weight: bold; color: #34d399;">${ticketCode}</span></p>
          <p style="margin: 4px 0; color: ${textWhite};">📍 <strong>Venue:</strong> ${venueName}</p>
        </div>
        <p style="text-align: center; margin: 25px 0;">
          <a href="${safeTicketUrl}" style="background: #34d399; color: #000; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">View Confirmed Gate Pass</a>
        </p>
      `
      break
    }

    case 'club_member_invitation': {
      const clubName = sanitizeText(payload.club_name || 'Campus Club')
      const inviterName = sanitizeText(payload.inviter_name || 'Club Organizer')
      const role = sanitizeText(payload.role || 'Member')
      const safeInvitationUrl = sanitizeSafeUrl(payload.invitation_url, 'https://festflow.online')

      subject = `Staff Invitation: Join ${clubName} on FestFlow`
      textFallback = `Hello ${recipient},\n\n${inviterName} has invited you to join ${clubName} as ${role} on FestFlow.\n\nAccept your staff invitation:\n${safeInvitationUrl}`
      bodyContent = `
        <h2 style="color: ${brandCyan}; margin-top: 0;">🏛️ Club Staff Invitation</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, you have been invited by <strong>${inviterName}</strong> to join the organizing team of <strong>${clubName}</strong> on FestFlow.
        </p>
        <div style="background: rgba(6, 182, 212, 0.08); border: 1px solid rgba(6, 182, 212, 0.25); border-radius: 16px; padding: 18px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">🏛️ <strong>Club:</strong> ${clubName}</p>
          <p style="margin: 4px 0; color: ${textWhite};">🛡️ <strong>Role:</strong> ${role}</p>
        </div>
        <p style="text-align: center; margin: 25px 0;">
          <a href="${safeInvitationUrl}" style="background: linear-gradient(135deg, ${brandPurple}, ${brandCyan}); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">Accept Staff Invitation</a>
        </p>
      `
      break
    }

    default: {
      subject = `FestFlow Notification: ${eventTitle}`
      textFallback = `Hello ${recipient},\n\nYou have an update regarding ${eventTitle}.\nVisit: https://festflow.online/student/dashboard`
      bodyContent = `
        <h2 style="color: ${brandCyan}; margin-top: 0;">FestFlow Event Update</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, you have an update regarding <strong>${eventTitle}</strong>.
        </p>
        <p style="text-align: center; margin: 25px 0;">
          <a href="https://festflow.online/student/dashboard" style="background: linear-gradient(135deg, ${brandPurple}, ${brandCyan}); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">Open FestFlow Dashboard</a>
        </p>
      `
    }
  }

  const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #08080a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #08080a; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #0e0e12; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 24px 30px; background: linear-gradient(135deg, rgba(24, 207, 252, 0.15), rgba(127, 26, 251, 0.1)); border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
              <span style="font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">FestFlow</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 30px;">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #08080a; border-top: 1px solid rgba(255, 255, 255, 0.05); text-align: center;">
              <p style="margin: 0; color: #71717a; font-size: 12px;">
                FestFlow • Intelligent Campus Event Experience • <a href="https://festflow.online" style="color: ${brandCyan}; text-decoration: none;">festflow.online</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  return { subject, html: fullHtml, text: textFallback }
}

export default async function handler(req: Request): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: corsHeaders }
    )
  }

  try {
    const body: EmailPayload = await req.json()
    const { template, to, name, payload } = body || {}

    if (!template || !to || typeof to !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters: template and to.' }),
        { status: 400, headers: corsHeaders }
      )
    }

    const cleanTo = to.trim().toLowerCase()
    const resendApiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'festflow.events@festflow.online'
    const fromName = process.env.RESEND_FROM_NAME || 'FestFlow'
    const replyToEmail = process.env.RESEND_REPLY_TO || 'festflow.events@gmail.com'

    // If no Resend API key is provided, report configured: false gracefully
    if (!resendApiKey || resendApiKey === 'your-resend-api-key-here') {
      return new Response(
        JSON.stringify({
          success: false,
          configured: false,
          message: 'Transactional email delivery is not configured. RESEND_API_KEY environment variable is required.',
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    const { subject, html, text } = generateEmailContent(template, name || '', payload || {})

    // Attempt 1: Send via configured sender address
    let resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [cleanTo],
        subject,
        html,
        text,
        reply_to: replyToEmail || undefined,
      }),
    })

    let resendData = await resendRes.json().catch(() => ({}))

    // Fallback attempt: If custom domain is not yet verified on Resend, retry with onboarding@resend.dev
    if (!resendRes.ok && resendData?.message?.includes('not verified')) {
      console.warn('[FestFlow Email] Custom domain unverified, retrying with onboarding@resend.dev sandbox...')
      resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `FestFlow <onboarding@resend.dev>`,
          to: [cleanTo],
          subject: `[Sandbox] ${subject}`,
          html,
          text,
          reply_to: replyToEmail || undefined,
        }),
      })
      resendData = await resendRes.json().catch(() => ({}))
    }

    if (!resendRes.ok) {
      console.warn('[FestFlow Email API] Resend rejection:', resendData)
      return new Response(
        JSON.stringify({
          success: false,
          configured: true,
          error: resendData?.message || 'Email delivery provider rejected request.',
          message: resendData?.message || 'Email delivery provider rejected request.',
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        configured: true,
        id: resendData?.id,
        message: 'Email dispatched successfully via Resend.',
      }),
      { status: 200, headers: corsHeaders }
    )
  } catch (err: any) {
    console.error('[FestFlow Email API] Exception:', err)
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || 'Internal error processing transactional email.',
      }),
      { status: 500, headers: corsHeaders }
    )
  }
}
