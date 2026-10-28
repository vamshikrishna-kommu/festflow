// Follow this setup guide to deploy: https://supabase.com/docs/guides/functions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export type EmailTemplateType =
  | 'registration_confirmed'
  | 'application_submitted'
  | 'payment_received'
  | 'payment_approved'
  | 'payment_rejected'
  | 'team_invitation'
  | 'team_invitation_accepted'
  | 'ticket_issued'
  | 'ticket_updated'
  | 'registration_cancelled'
  | 'registration_waitlisted'
  | 'event_updated'
  | 'event_cancelled'
  | 'checkin_confirmed'
  | 'event_reminder'

interface EmailRequest {
  template: EmailTemplateType
  to: string
  name?: string
  payload: Record<string, any>
  outbox_id?: string
}

function sanitizeText(str: string): string {
  if (!str) return ''
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

function generateEmailHtml(template: EmailTemplateType, name: string, payload: Record<string, any>): { subject: string; html: string; text: string } {
  const recipient = sanitizeText(name || 'FestFlow Attendee')
  const brandPurple = '#7c3aed'
  const brandCyan = '#06b6d4'
  const bgDark = '#0a0a0f'
  const cardBg = '#12121c'
  const textMuted = '#94a3b8'
  const textWhite = '#ffffff'

  let subject = 'FestFlow Event Notification'
  let bodyContent = ''
  let textFallback = ''

  const eventTitle = sanitizeText(payload.event_title || 'Campus Event')
  const venueName = sanitizeText(payload.venue_name || 'Campus Venue')
  const ticketCode = sanitizeText(payload.ticket_code || '')
  const teamName = sanitizeText(payload.team_name || '')

  switch (template) {
    case 'application_submitted':
      subject = `Application Received: ${eventTitle}`
      textFallback = `Hello ${recipient},\n\nYour registration application for ${eventTitle} has been received and is currently under organizer review.\nReference Code: ${ticketCode}\n\nTrack your application status here: ${payload.status_url || 'https://festflow.com/student/dashboard'}`
      bodyContent = `
        <h2 style="color: #a78bfa; margin-top: 0;">⏳ Application Under Review</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, we received your registration application for <strong>${eventTitle}</strong>.
        </p>
        <div style="background: rgba(167, 139, 250, 0.08); border: 1px solid rgba(167, 139, 250, 0.25); border-radius: 12px; padding: 18px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">📅 <strong>Event Date:</strong> ${payload.start_date || 'Check dashboard'}</p>
          <p style="margin: 4px 0; color: ${textWhite};">📍 <strong>Venue:</strong> ${venueName}</p>
          <p style="margin: 4px 0; color: ${textWhite};">🔖 <strong>Application Ref:</strong> <span style="font-family: monospace; font-size: 15px; font-weight: bold; color: #a78bfa;">${ticketCode}</span></p>
        </div>
        <p style="color: ${textMuted}; font-size: 13px;">
          The event organizer is currently reviewing attendee applications. You will receive an instant notification once your pass has been approved.
        </p>
        <p style="text-align: center; margin: 25px 0;">
          <a href="${payload.status_url || 'https://festflow.com/student/dashboard'}" style="background: linear-gradient(135deg, ${brandPurple}, ${brandCyan}); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">Track Application Status</a>
        </p>
      `
      break

    case 'registration_confirmed':
      subject = payload.is_resend
        ? `[Pass Resend] Entry Ticket: ${eventTitle}`
        : `Registration Confirmed: ${eventTitle}`
      textFallback = `Hello ${recipient},\n\nYour registration for ${eventTitle} is confirmed!\nDate: ${payload.start_date}\nVenue: ${venueName}\nTicket Code: ${ticketCode}\n\nAccess your digital ticket here: ${payload.ticket_url || 'https://festflow.com/student/dashboard'}`
      bodyContent = `
        <h2 style="color: ${brandCyan}; margin-top: 0;">🎉 You're In!</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, your spot for <strong>${eventTitle}</strong> has been secured.
        </p>
        <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 18px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">📅 <strong>Date:</strong> ${payload.start_date || 'Check dashboard'}</p>
          <p style="margin: 4px 0; color: ${textWhite};">📍 <strong>Venue:</strong> ${venueName}</p>
          <p style="margin: 4px 0; color: ${textWhite};">🎟️ <strong>Ticket Code:</strong> <span style="font-family: monospace; font-size: 16px; font-weight: bold; color: ${brandCyan};">${ticketCode}</span></p>
          ${teamName ? `<p style="margin: 4px 0; color: #a78bfa;">🛡️ <strong>Squad:</strong> ${teamName}</p>` : ''}
        </div>
        <p style="text-align: center; margin: 25px 0;">
          <a href="${payload.ticket_url || '#'}" style="background: linear-gradient(135deg, ${brandPurple}, ${brandCyan}); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">View Digital Pass & QR</a>
        </p>
      `
      break

    case 'payment_received':
      subject = `Payment Submitted: ${eventTitle}`
      textFallback = `Hello ${recipient},\n\nYour payment reference (${payload.transaction_reference}) for ${eventTitle} has been submitted for organizer review. A confirmed ticket will be generated once verified.`
      bodyContent = `
        <h2 style="color: #fbbf24; margin-top: 0;">⏳ Payment Submitted for Review</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, we received your payment submission for <strong>${eventTitle}</strong>.
        </p>
        <div style="background: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.25); border-radius: 12px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">💳 <strong>Amount:</strong> ₹${payload.amount}</p>
          <p style="margin: 4px 0; color: ${textWhite};">🔢 <strong>Transaction UTR:</strong> <span style="font-family: monospace; font-weight: bold;">${sanitizeText(payload.transaction_reference || '')}</span></p>
        </div>
        <p style="color: ${textMuted}; font-size: 13px;">
          The club organizer is reviewing your transaction. You will receive an instant notification as soon as verification is complete.
        </p>
      `
      break

    case 'payment_approved':
      subject = `Payment Approved! Your Ticket for ${eventTitle}`
      textFallback = `Hello ${recipient},\n\nYour payment for ${eventTitle} has been verified and approved!\nYour ticket code is: ${ticketCode}\nView your pass: ${payload.ticket_url || 'https://festflow.com/student/dashboard'}`
      bodyContent = `
        <h2 style="color: #34d399; margin-top: 0;">✅ Payment Verified & Ticket Ready!</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Great news <strong>${recipient}</strong>! Your payment for <strong>${eventTitle}</strong> has been confirmed by the organizers.
        </p>
        <div style="background: rgba(52, 211, 153, 0.08); border: 1px solid rgba(52, 211, 153, 0.25); border-radius: 12px; padding: 18px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">🎟️ <strong>Ticket Code:</strong> <span style="font-family: monospace; font-size: 16px; font-weight: bold; color: #34d399;">${ticketCode}</span></p>
          <p style="margin: 4px 0; color: ${textWhite};">📍 <strong>Venue:</strong> ${venueName}</p>
        </div>
        <p style="text-align: center; margin: 25px 0;">
          <a href="${payload.ticket_url || '#'}" style="background: #34d399; color: #000; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">Access Digital QR Pass</a>
        </p>
      `
      break

    case 'payment_rejected':
      subject = `Payment Verification Issue: ${eventTitle}`
      textFallback = `Hello ${recipient},\n\nYour payment submission for ${eventTitle} could not be verified by the organizers.\nReason: ${payload.reason || 'Transaction could not be matched.'}\nPlease resubmit with your correct 12-digit UTR.`
      bodyContent = `
        <h2 style="color: #f87171; margin-top: 0;">⚠️ Payment Verification Issue</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, the organizers could not verify your payment submission for <strong>${eventTitle}</strong>.
        </p>
        <div style="background: rgba(248, 113, 113, 0.08); border: 1px solid rgba(248, 113, 113, 0.25); border-radius: 12px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0; color: #fca5a5;"><strong>Organizer Reason:</strong></p>
          <p style="margin: 4px 0; color: ${textWhite}; font-style: italic;">"${sanitizeText(payload.reason || 'Transaction reference not found in statement')}"</p>
        </div>
        <p style="color: ${textMuted}; font-size: 13px;">
          Please check your bank/UPI app statement for the 12-digit UTR number and resubmit your details to unlock your ticket.
        </p>
      `
      break

    case 'team_invitation':
      subject = `Squad Invitation: Join "${teamName}" for ${eventTitle}`
      textFallback = `Hello ${recipient},\n\n${payload.leader_name || 'A team leader'} has invited you to join "${teamName}" for ${eventTitle}.\nTeam Invite Code: ${payload.invite_code}\n\nAccept your invitation and claim your ticket: ${payload.join_url || 'https://festflow.com/join-team'}`
      bodyContent = `
        <h2 style="color: ${brandCyan}; margin-top: 0;">🛡️ You're Invited to Join a Squad!</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, <strong>${sanitizeText(payload.leader_name || 'Your teammate')}</strong> invited you to join <strong>"${teamName}"</strong> for <strong>${eventTitle}</strong>.
        </p>
        <div style="background: rgba(6, 182, 212, 0.08); border: 1px solid rgba(6, 182, 212, 0.25); border-radius: 12px; padding: 18px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">🛡️ <strong>Squad:</strong> ${teamName}</p>
          <p style="margin: 4px 0; color: ${textWhite};">🎟️ <strong>Invite Code:</strong> <span style="font-family: monospace; font-size: 16px; font-weight: bold; color: ${brandCyan};">${sanitizeText(payload.invite_code || '')}</span></p>
          <p style="margin: 4px 0; color: ${textMuted}; font-size: 13px;">Expires in 7 days</p>
        </div>
        <p style="text-align: center; margin: 25px 0;">
          <a href="${payload.join_url || '#'}" style="background: linear-gradient(135deg, ${brandPurple}, ${brandCyan}); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">Accept Squad Invitation</a>
        </p>
      `
      break

    case 'team_invitation_accepted':
      subject = `Squad Update: ${payload.member_name || 'A member'} joined "${teamName}"`
      textFallback = `Hello ${recipient},\n\nGreat news! ${payload.member_name || 'A teammate'} has accepted your invitation and joined "${teamName}" for ${eventTitle}.\nView squad roster: ${payload.dashboard_url || 'https://festflow.com/student/dashboard'}`
      bodyContent = `
        <h2 style="color: #34d399; margin-top: 0;">🤝 New Teammate Joined!</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, <strong>${sanitizeText(payload.member_name || 'A new member')}</strong> has accepted your invitation to join <strong>"${teamName}"</strong> for <strong>${eventTitle}</strong>.
        </p>
        <div style="background: rgba(52, 211, 153, 0.08); border: 1px solid rgba(52, 211, 153, 0.25); border-radius: 12px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">👥 <strong>Member:</strong> ${sanitizeText(payload.member_name || 'Teammate')} (${sanitizeText(payload.member_email || '')})</p>
          <p style="margin: 4px 0; color: ${textWhite};">🛡️ <strong>Current Squad Size:</strong> ${payload.current_size || 'Updated'} members</p>
        </div>
      `
      break

    case 'ticket_issued':
      subject = `Your Digital Pass for ${eventTitle} is Ready`
      textFallback = `Hello ${recipient},\n\nYour individual entry ticket for ${eventTitle} has been issued!\nTicket Code: ${ticketCode}\nAccess Pass: ${payload.ticket_url || 'https://festflow.com/student/dashboard'}`
      bodyContent = `
        <h2 style="color: ${brandCyan}; margin-top: 0;">🎟️ Your Individual Pass is Ready!</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, your individual event ticket for <strong>${eventTitle}</strong> is active and ready for gate admission.
        </p>
        <div style="background: rgba(6, 182, 212, 0.08); border: 1px solid rgba(6, 182, 212, 0.25); border-radius: 12px; padding: 18px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">🎟️ <strong>Ticket Identifier:</strong> <span style="font-family: monospace; font-size: 16px; font-weight: bold; color: ${brandCyan};">${ticketCode}</span></p>
          <p style="margin: 4px 0; color: ${textWhite};">📍 <strong>Venue:</strong> ${venueName}</p>
          ${teamName ? `<p style="margin: 4px 0; color: #a78bfa;">🛡️ <strong>Squad:</strong> ${teamName}</p>` : ''}
        </div>
        <p style="text-align: center; margin: 25px 0;">
          <a href="${payload.ticket_url || '#'}" style="background: linear-gradient(135deg, ${brandPurple}, ${brandCyan}); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">Open Pass & QR Code</a>
        </p>
      `
      break

    case 'ticket_updated':
      subject = `Ticket Updated: ${eventTitle}`
      textFallback = `Hello ${recipient},\n\nYour ticket for ${eventTitle} has been updated.\nTicket Code: ${ticketCode}\nDetails: ${payload.update_summary || 'Event details updated.'}`
      bodyContent = `
        <h2 style="color: #a78bfa; margin-top: 0;">ℹ️ Ticket Details Updated</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, updates have been made to your registration pass for <strong>${eventTitle}</strong>.
        </p>
        <div style="background: rgba(167, 139, 250, 0.08); border: 1px solid rgba(167, 139, 250, 0.25); border-radius: 12px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">🎟️ <strong>Ticket Code:</strong> <span style="font-family: monospace;">${ticketCode}</span></p>
          <p style="margin: 4px 0; color: ${textWhite};">📝 <strong>Notice:</strong> ${sanitizeText(payload.update_summary || 'Details updated by organizer.')}</p>
        </div>
      `
      break

    case 'registration_cancelled':
      subject = `Registration Cancelled: ${eventTitle}`
      textFallback = `Hello ${recipient},\n\nYour registration for ${eventTitle} has been cancelled.\nReference: ${ticketCode}\nThis ticket has been revoked and is void for gate admission.`
      bodyContent = `
        <h2 style="color: #f87171; margin-top: 0;">Registration Cancelled</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, your pass registration for <strong>${eventTitle}</strong> has been cancelled.
        </p>
        <div style="background: rgba(248, 113, 113, 0.08); border: 1px solid rgba(248, 113, 113, 0.25); border-radius: 12px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">🎟️ <strong>Ticket Code:</strong> <span style="font-family: monospace; font-weight: bold;">${ticketCode}</span></p>
          <p style="margin: 4px 0; color: #fca5a5;">Status: Void / Revoked</p>
        </div>
      `
      break

    case 'registration_waitlisted':
      subject = `Waitlist Status: ${eventTitle}`
      textFallback = `Hello ${recipient},\n\nYou have been placed on the waitlist for ${eventTitle}.\nIf a seat becomes available, you will receive an automatic ticket confirmation.`
      bodyContent = `
        <h2 style="color: #fbbf24; margin-top: 0;">⏳ Added to Waitlist</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, this event has reached full capacity. You are currently on the waitlist for <strong>${eventTitle}</strong>.
        </p>
        <div style="background: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.25); border-radius: 12px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">Position: Waitlisted attendee</p>
          <p style="margin: 4px 0; color: ${textMuted}; font-size: 13px;">If an attendee cancels, available spots are allocated automatically in order of submission.</p>
        </div>
      `
      break

    case 'event_updated':
      subject = `Event Announcement: ${eventTitle}`
      textFallback = `Hello ${recipient},\n\nThe organizers of ${eventTitle} have posted an announcement:\n${payload.announcement || 'Please check the event page for details.'}`
      bodyContent = `
        <h2 style="color: ${brandCyan}; margin-top: 0;">📢 Event Announcement</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, an important update was posted for <strong>${eventTitle}</strong>.
        </p>
        <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite}; font-style: italic;">"${sanitizeText(payload.announcement || 'Schedule or venue update')}"</p>
        </div>
      `
      break

    case 'event_cancelled':
      subject = `Event Cancelled: ${eventTitle}`
      textFallback = `Hello ${recipient},\n\nWe regret to inform you that ${eventTitle} has been cancelled by the organizers.\nReason: ${payload.reason || 'Event cancelled'}`
      bodyContent = `
        <h2 style="color: #f87171; margin-top: 0;">Event Cancelled</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, <strong>${eventTitle}</strong> has been cancelled by the organizers.
        </p>
        <div style="background: rgba(248, 113, 113, 0.08); border: 1px solid rgba(248, 113, 113, 0.25); border-radius: 12px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">Reason: ${sanitizeText(payload.reason || 'Cancelled by organizing team')}</p>
        </div>
      `
      break

    case 'checkin_confirmed':
      subject = `Gate Check-In Confirmed: ${eventTitle}`
      textFallback = `Hello ${recipient},\n\nYour pass for ${eventTitle} was checked in successfully at ${payload.checked_in_at || 'the gate'}.\nEnjoy the event!`
      bodyContent = `
        <h2 style="color: #34d399; margin-top: 0;">✅ Gate Check-In Confirmed</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, you have been checked in for <strong>${eventTitle}</strong>.
        </p>
        <div style="background: rgba(52, 211, 153, 0.08); border: 1px solid rgba(52, 211, 153, 0.25); border-radius: 12px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">🎟️ <strong>Ticket:</strong> ${ticketCode}</p>
          <p style="margin: 4px 0; color: ${textWhite};">⏰ <strong>Time:</strong> ${payload.checked_in_at || 'Just now'}</p>
        </div>
      `
      break

    case 'event_reminder':
    default:
      subject = `Reminder: ${eventTitle} is Coming Up!`
      textFallback = `Hello ${recipient},\n\nReminder that ${eventTitle} starts on ${payload.start_date} at ${venueName}.\nTicket Code: ${ticketCode}`
      bodyContent = `
        <h2 style="color: ${brandCyan}; margin-top: 0;">⏰ Event Reminder</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, your upcoming campus event <strong>${eventTitle}</strong> is happening soon!
        </p>
        <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">📅 <strong>Date:</strong> ${payload.start_date}</p>
          <p style="margin: 4px 0; color: ${textWhite};">📍 <strong>Venue:</strong> ${venueName}</p>
          <p style="margin: 4px 0; color: ${textWhite};">🎟️ <strong>Pass:</strong> <span style="font-family: monospace; font-weight: bold;">${ticketCode}</span></p>
        </div>
        <p style="text-align: center; margin: 25px 0;">
          <a href="${payload.ticket_url || '#'}" style="background: linear-gradient(135deg, ${brandPurple}, ${brandCyan}); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">Open Pass for Gate Entry</a>
        </p>
      `
      break
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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Missing Authorization header.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''

    const isServiceRole = Boolean(supabaseServiceKey && token === supabaseServiceKey)

    if (!isServiceRole) {
      if (!supabaseUrl) {
        return new Response(
          JSON.stringify({ success: false, error: 'Server configuration error: missing SUPABASE_URL.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey)
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)

      if (authError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized: Valid authenticated session is required.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

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

    // Never pretend an email was sent if Resend key is unconfigured
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

    // Update outbox record in database if Supabase env is accessible
    if (outbox_id && supabaseUrl && supabaseServiceKey) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
      if (resendResponse.ok) {
        await supabaseAdmin
          .from('email_outbox')
          .update({
            status: 'sent',
            provider_message_id: resendData.id || null,
            sent_at: new Date().toISOString(),
            last_attempt_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('id', outbox_id)
      } else {
        await supabaseAdmin
          .from('email_outbox')
          .update({
            status: 'failed',
            last_attempt_at: new Date().toISOString(),
            error_message: sanitizeText(resendData?.message || 'Email dispatch failed at provider.'),
          })
          .eq('id', outbox_id)
      }
    }

    if (!resendResponse.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          configured: true,
          error: sanitizeText(resendData?.message || 'Email delivery failed at provider.'),
        }),
        { status: resendResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
