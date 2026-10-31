/**
 * api/send-email.ts
 *
 * Vercel Serverless & Edge Function for transactional email delivery:
 * - Edge runtime enabled for sub-millisecond execution and zero cold-start delay
 * - Universal runtime adapter: seamlessly handles both Web Request/Response and Node (req, res)
 * - Directly dispatches emails via Resend API (https://api.resend.com/emails) with 4s timeout
 * - Graceful provider configuration check (reports configured: false when RESEND_API_KEY is unset)
 * - Auto-fallback to onboarding@resend.dev if custom domain is pending DNS verification
 * - Generates responsive HTML templates with FestFlow 2.0 branding
 */

export const config = {
  runtime: 'edge',
}

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

    case 'registration_confirmed':
    case 'ticket_issued': {
      const safeTicketUrl = sanitizeSafeUrl(payload.ticket_url || payload.ticketUrl, 'https://festflow.online/student/dashboard')
      subject = `Entry Pass Confirmed: ${eventTitle} [${ticketCode || 'FestFlow'}]`
      textFallback = `Hello ${recipient},\n\nYour entry pass for ${eventTitle} has been confirmed!\n\nPass Code: ${ticketCode}\nVenue: ${venueName}\n\nView and download your digital pass:\n${safeTicketUrl}\n\nFestFlow Team`
      bodyContent = `
        <h2 style="color: ${brandCyan}; margin-top: 0;">🎟️ Your Campus Event Pass is Confirmed!</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, your spot for <strong>${eventTitle}</strong> is locked in.
        </p>
        <div style="background: rgba(124, 58, 237, 0.1); border: 1px solid rgba(124, 58, 237, 0.3); border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
          <p style="color: ${textMuted}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px 0;">Gate Admission Code</p>
          <p style="font-family: monospace; font-size: 26px; font-weight: bold; letter-spacing: 3px; color: ${brandCyan}; margin: 0;">${ticketCode}</p>
          <p style="color: ${textMuted}; font-size: 13px; margin: 12px 0 0 0;">📍 ${venueName}</p>
        </div>
        <p style="text-align: center; margin: 25px 0;">
          <a href="${safeTicketUrl}" style="background: linear-gradient(135deg, ${brandPurple}, ${brandCyan}); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">Open Digital Entry Pass</a>
        </p>
      `
      break
    }

    case 'team_invitation_accepted': {
      const memberName = sanitizeText(payload.member_name || payload.memberName || 'A student')
      const currentSize = sanitizeText(payload.current_size || payload.currentSize || '2')
      subject = `Squad Update: ${memberName} joined "${teamName}"`
      textFallback = `Hello ${recipient},\n\n${memberName} has accepted your invitation and joined "${teamName}" for ${eventTitle}.\nCurrent Squad Size: ${currentSize}.\n\nFestFlow Team`
      bodyContent = `
        <h2 style="color: ${brandCyan}; margin-top: 0;">⚔️ Squad Member Joined!</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, <strong>${memberName}</strong> just accepted your invitation and joined squad <strong>"${teamName}"</strong>!
        </p>
        <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 12px; padding: 18px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">🛡️ <strong>Squad:</strong> ${teamName}</p>
          <p style="margin: 4px 0; color: ${textWhite};">👥 <strong>Confirmed Members:</strong> ${currentSize}</p>
        </div>
      `
      break
    }

    case 'club_member_invitation': {
      const clubName = sanitizeText(payload.club_name || payload.clubName || 'FestFlow Club')
      const role = sanitizeText(payload.role || 'Member')
      const safeAcceptUrl = sanitizeSafeUrl(payload.accept_url || payload.acceptUrl, 'https://festflow.online/club')
      subject = `Invitation: Join ${clubName} Team on FestFlow`
      textFallback = `Hello ${recipient},\n\nYou have been invited to join ${clubName} as ${role}.\n\nAccept your role:\n${safeAcceptUrl}\n\nFestFlow Team`
      bodyContent = `
        <h2 style="color: ${brandCyan}; margin-top: 0;">🏛️ You're Invited to Join an Organizer Team</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, you have been invited to join <strong>${clubName}</strong> as a <strong>${role}</strong>.
        </p>
        <p style="text-align: center; margin: 25px 0;">
          <a href="${safeAcceptUrl}" style="background: linear-gradient(135deg, ${brandPurple}, ${brandCyan}); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">Accept Organizer Invitation</a>
        </p>
      `
      break
    }

    default: {
      subject = sanitizeText(payload.subject || 'FestFlow Campus Notification')
      bodyContent = `
        <h2 style="color: ${brandCyan}; margin-top: 0;">FestFlow Campus Notification</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, you have a new update regarding <strong>${eventTitle}</strong>.
        </p>
      `
      textFallback = `Hello ${recipient},\n\nYou have an update regarding ${eventTitle}.\n\nFestFlow Team`
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
<body style="margin: 0; padding: 20px; background-color: #0B0B0F; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #121218; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1); overflow: hidden;">
    <tr>
      <td style="padding: 28px 32px; background: linear-gradient(135deg, rgba(124, 58, 237, 0.25), rgba(6, 182, 212, 0.25)); border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td>
              <span style="font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">⚡ Fest<span style="color: ${brandCyan};">Flow</span></span>
            </td>
            <td align="right">
              <span style="font-size: 12px; color: ${textMuted}; text-transform: uppercase; letter-spacing: 1px;">Official Campus Pass</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        ${bodyContent}
      </td>
    </tr>
    <tr>
      <td style="padding: 20px 32px; background-color: #0e0e13; border-top: 1px solid rgba(255, 255, 255, 0.06); text-align: center;">
        <p style="margin: 0; font-size: 12px; color: ${textMuted};">
          FestFlow Campus OS • Automated Transactional Gateway<br>
          <a href="https://festflow.online" style="color: ${brandCyan}; text-decoration: none;">festflow.online</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  return { subject, html: fullHtml, text: textFallback }
}

export default async function handler(req: any, res?: any): Promise<Response | void> {
  const isNode = res && typeof res.status === 'function'

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  const sendResponse = (status: number, data: any) => {
    if (isNode) {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      res.setHeader('Content-Type', 'application/json')
      return res.status(status).json(data)
    }
    return new Response(JSON.stringify(data), {
      status,
      headers: corsHeaders,
    })
  }

  if (req.method === 'OPTIONS') {
    if (isNode) {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type')
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      return res.status(200).send('ok')
    }
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return sendResponse(405, { success: false, error: 'Method not allowed' })
  }

  try {
    let body: EmailPayload
    if (typeof req.json === 'function') {
      body = await req.json().catch(() => ({}))
    } else if (req.body && typeof req.body === 'object') {
      body = req.body
    } else if (typeof req.body === 'string') {
      try {
        body = JSON.parse(req.body)
      } catch {
        body = {} as any
      }
    } else {
      body = {} as any
    }

    const { template, to, name, payload } = body || {}

    if (!template || !to || typeof to !== 'string') {
      return sendResponse(400, {
        success: false,
        error: 'Missing required parameters: template and to.',
      })
    }

    const cleanTo = to.trim().toLowerCase()
    const resendApiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'festflow.events@festflow.online'
    const fromName = process.env.RESEND_FROM_NAME || 'FestFlow'
    const replyToEmail = process.env.RESEND_REPLY_TO || 'festflow.events@gmail.com'

    // If no Resend API key is provided, report configured: false gracefully
    if (!resendApiKey || resendApiKey === 'your-resend-api-key-here') {
      return sendResponse(200, {
        success: false,
        configured: false,
        message: 'Transactional email delivery is not configured. RESEND_API_KEY environment variable is required on Vercel.',
      })
    }

    const { subject, html, text } = generateEmailContent(template, name || '', payload || {})

    // Attempt 1: Send via configured sender address with 4000ms strict timeout
    const fetchWithTimeout = async (url: string, options: any, timeoutMs = 4000) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const response = await fetch(url, { ...options, signal: controller.signal })
        clearTimeout(timer)
        return response
      } catch (err) {
        clearTimeout(timer)
        throw err
      }
    }

    let resendRes: any = null
    try {
      resendRes = await fetchWithTimeout('https://api.resend.com/emails', {
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
      }, 4000)
    } catch (e: any) {
      console.warn('[FestFlow Email API] Primary dispatch fetch error:', e?.message)
    }

    let resendData = resendRes ? await resendRes.json().catch(() => ({})) : {}

    // Fallback attempt: If custom domain is not yet verified on Resend, retry with onboarding@resend.dev
    if ((!resendRes || !resendRes.ok) && resendData?.message?.includes('not verified')) {
      console.warn('[FestFlow Email] Custom domain unverified, retrying with onboarding@resend.dev sandbox...')
      try {
        resendRes = await fetchWithTimeout('https://api.resend.com/emails', {
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
        }, 4000)
        resendData = resendRes ? await resendRes.json().catch(() => ({})) : {}
      } catch {
        // Fall through
      }
    }

    if (!resendRes || !resendRes.ok) {
      const errDetail = resendData?.message || 'Email delivery provider rejected request or timed out.'
      console.warn('[FestFlow Email API] Resend rejection:', errDetail)
      return sendResponse(200, {
        success: false,
        configured: true,
        error: errDetail,
        message: errDetail,
      })
    }

    return sendResponse(200, {
      success: true,
      configured: true,
      id: resendData?.id,
      message: 'Email dispatched successfully via Resend.',
    })
  } catch (err: any) {
    console.error('[FestFlow Email API] Exception:', err)
    return sendResponse(200, {
      success: false,
      configured: false,
      error: err?.message || 'Internal error processing transactional email.',
      message: err?.message || 'Internal error processing transactional email.',
    })
  }
}
