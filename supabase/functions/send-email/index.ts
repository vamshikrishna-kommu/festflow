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
  | 'club_member_invitation'

export const VALID_TEMPLATES = new Set<string>([
  'registration_confirmed',
  'application_submitted',
  'payment_received',
  'payment_approved',
  'payment_rejected',
  'team_invitation',
  'team_invitation_accepted',
  'ticket_issued',
  'ticket_updated',
  'registration_cancelled',
  'registration_waitlisted',
  'event_updated',
  'event_cancelled',
  'checkin_confirmed',
  'event_reminder',
  'club_member_invitation',
])

export interface EmailRequest {
  template: EmailTemplateType
  to: string
  name?: string
  payload: Record<string, any>
  outbox_id?: string
  event_id?: string
  registration_id?: string
  club_id?: string
  user_id?: string
}

// In-memory sliding window rate limiter: max 30 emails / 60 seconds per user or IP
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(key: string, limit = 30, windowMs = 60000): { allowed: boolean; remaining: number; resetInSec: number } {
  const now = Date.now()
  const record = rateLimitStore.get(key)
  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetInSec: Math.ceil(windowMs / 1000) }
  }
  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetInSec: Math.max(1, Math.ceil((record.resetAt - now) / 1000)) }
  }
  record.count += 1
  return { allowed: true, remaining: limit - record.count, resetInSec: Math.ceil((record.resetAt - now) / 1000) }
}

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

export function isValidEmail(email: unknown): boolean {
  if (!email || typeof email !== 'string') return false
  const trimmed = email.trim()
  if (trimmed.length > 254) return false
  return EMAIL_REGEX.test(trimmed)
}

export function sanitizeText(str: unknown): string {
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

/**
 * Validates and sanitizes URLs embedded in HTML emails.
 * Only permits valid HTTPS URLs belonging to the application's trusted domains (or local dev origins).
 * Rejects javascript:, data:, and arbitrary malicious phishing domains.
 */
export function sanitizeSafeUrl(url: unknown, fallback = 'https://festflow.online'): string {
  if (!url || typeof url !== 'string') return fallback
  const trimmed = url.trim()
  try {
    const parsed = new URL(trimmed)
    const isLocal =
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
      (parsed.protocol === 'http:' || parsed.protocol === 'https:')
    const isHttpsAllowed =
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'festflow.online' ||
        parsed.hostname.endsWith('.festflow.online') ||
        parsed.hostname === 'festflow.com' ||
        parsed.hostname.endsWith('.festflow.com') ||
        parsed.hostname === 'festflow.app' ||
        parsed.hostname.endsWith('.festflow.app'))

    if (isLocal || isHttpsAllowed) {
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

export function generateEmailHtml(template: EmailTemplateType, name: string, payload: Record<string, any>): { subject: string; html: string; text: string } {
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
    case 'club_member_invitation': {
      const clubName = sanitizeText(payload.club_name || 'Campus Club')
      const inviterName = sanitizeText(payload.inviter_name || 'Club Administrator')
      const role = sanitizeText(payload.role || 'Member')
      const expiresAt = sanitizeText(payload.expires_at || '7 days')
      const safeInvitationUrl = sanitizeSafeUrl(payload.invitation_url, 'https://festflow.online')

      subject = `Staff Invitation: Join ${clubName} on FestFlow`
      textFallback = `Hello ${recipient},\n\n${inviterName} has invited you to join ${clubName} as ${role} on FestFlow.\n\nAccept your invitation and join the club team:\n${safeInvitationUrl}\n\nNote: This invitation expires on ${expiresAt}.\nIf you did not expect this invitation, you can safely ignore this email.\n\nFestFlow Team`
      bodyContent = `
        <h2 style="color: ${brandCyan}; margin-top: 0;">🏛️ Club Staff Invitation</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, you have been invited by <strong>${inviterName}</strong> to join the organizing team of <strong>${clubName}</strong> on FestFlow.
        </p>
        <div style="background: rgba(6, 182, 212, 0.08); border: 1px solid rgba(6, 182, 212, 0.25); border-radius: 12px; padding: 18px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">🏛️ <strong>Club:</strong> ${clubName}</p>
          <p style="margin: 4px 0; color: ${textWhite};">🛡️ <strong>Assigned Role:</strong> <span style="background: rgba(124, 58, 237, 0.3); border: 1px solid rgba(124, 58, 237, 0.5); padding: 2px 8px; border-radius: 6px; font-weight: bold; color: #c4b5fd;">${role}</span></p>
          <p style="margin: 4px 0; color: ${textMuted}; font-size: 13px;">⏰ <strong>Expires:</strong> ${expiresAt}</p>
        </div>
        <p style="color: ${textMuted}; font-size: 14px; line-height: 1.5;">
          As a member with the <strong>${role}</strong> role, you will be able to access club administrative functions according to your assigned permissions.
        </p>
        <p style="text-align: center; margin: 25px 0;">
          <a href="${safeInvitationUrl}" style="background: linear-gradient(135deg, ${brandPurple}, ${brandCyan}); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">Accept Club Invitation</a>
        </p>
        <p style="color: ${textMuted}; font-size: 12px; text-align: center; margin-top: 15px;">
          If you don't know the sender or did not expect this invite, you can safely ignore this email.
        </p>
      `
      break
    }

    case 'application_submitted': {
      const safeStatusUrl = sanitizeSafeUrl(payload.status_url, 'https://festflow.online/student/dashboard')
      subject = `Application Received: ${eventTitle}`
      textFallback = `Hello ${recipient},\n\nYour registration application for ${eventTitle} has been received and is currently under organizer review.\nReference Code: ${ticketCode}\n\nTrack your application status here: ${safeStatusUrl}`
      bodyContent = `
        <h2 style="color: #a78bfa; margin-top: 0;">⏳ Application Under Review</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, we received your registration application for <strong>${eventTitle}</strong>.
        </p>
        <div style="background: rgba(167, 139, 250, 0.08); border: 1px solid rgba(167, 139, 250, 0.25); border-radius: 12px; padding: 18px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">📅 <strong>Event Date:</strong> ${sanitizeText(payload.start_date || 'Check dashboard')}</p>
          <p style="margin: 4px 0; color: ${textWhite};">📍 <strong>Venue:</strong> ${venueName}</p>
          <p style="margin: 4px 0; color: ${textWhite};">🔖 <strong>Application Ref:</strong> <span style="font-family: monospace; font-size: 15px; font-weight: bold; color: #a78bfa;">${ticketCode}</span></p>
        </div>
        <p style="color: ${textMuted}; font-size: 13px;">
          The event organizer is currently reviewing attendee applications. You will receive an instant notification once your pass has been approved.
        </p>
        <p style="text-align: center; margin: 25px 0;">
          <a href="${safeStatusUrl}" style="background: linear-gradient(135deg, ${brandPurple}, ${brandCyan}); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">Track Application Status</a>
        </p>
      `
      break
    }

    case 'registration_confirmed': {
      const safeTicketUrl = sanitizeSafeUrl(payload.ticket_url, 'https://festflow.online/student/dashboard')
      subject = payload.is_resend
        ? `[Pass Resend] Entry Ticket: ${eventTitle}`
        : `Registration Confirmed: ${eventTitle}`
      textFallback = `Hello ${recipient},\n\nYour registration for ${eventTitle} is confirmed!\nDate: ${sanitizeText(payload.start_date)}\nVenue: ${venueName}\nTicket Code: ${ticketCode}\n\nAccess your digital ticket here: ${safeTicketUrl}`
      bodyContent = `
        <h2 style="color: ${brandCyan}; margin-top: 0;">🎉 You're In!</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, your spot for <strong>${eventTitle}</strong> has been secured.
        </p>
        <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 18px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">📅 <strong>Date:</strong> ${sanitizeText(payload.start_date || 'Check dashboard')}</p>
          <p style="margin: 4px 0; color: ${textWhite};">📍 <strong>Venue:</strong> ${venueName}</p>
          <p style="margin: 4px 0; color: ${textWhite};">🎟️ <strong>Ticket Code:</strong> <span style="font-family: monospace; font-size: 16px; font-weight: bold; color: ${brandCyan};">${ticketCode}</span></p>
          ${teamName ? `<p style="margin: 4px 0; color: #a78bfa;">🛡️ <strong>Squad:</strong> ${teamName}</p>` : ''}
        </div>
        <p style="text-align: center; margin: 25px 0;">
          <a href="${safeTicketUrl}" style="background: linear-gradient(135deg, ${brandPurple}, ${brandCyan}); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">View Digital Pass & QR</a>
        </p>
      `
      break
    }

    case 'payment_received': {
      subject = `Payment Submitted: ${eventTitle}`
      textFallback = `Hello ${recipient},\n\nYour payment reference (${sanitizeText(payload.transaction_reference)}) for ${eventTitle} has been submitted for organizer review. A confirmed ticket will be generated once verified.`
      bodyContent = `
        <h2 style="color: #fbbf24; margin-top: 0;">⏳ Payment Submitted for Review</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, we received your payment submission for <strong>${eventTitle}</strong>.
        </p>
        <div style="background: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.25); border-radius: 12px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">💳 <strong>Amount:</strong> ₹${sanitizeText(String(payload.amount || '0'))}</p>
          <p style="margin: 4px 0; color: ${textWhite};">🔢 <strong>Transaction UTR:</strong> <span style="font-family: monospace; font-weight: bold;">${sanitizeText(payload.transaction_reference || '')}</span></p>
        </div>
        <p style="color: ${textMuted}; font-size: 13px;">
          The club organizer is reviewing your transaction. You will receive an instant notification as soon as verification is complete.
        </p>
      `
      break
    }

    case 'payment_approved': {
      const safeTicketUrl = sanitizeSafeUrl(payload.ticket_url, 'https://festflow.online/student/dashboard')
      subject = `Payment Approved! Your Ticket for ${eventTitle}`
      textFallback = `Hello ${recipient},\n\nYour payment for ${eventTitle} has been verified and approved!\nYour ticket code is: ${ticketCode}\nView your pass: ${safeTicketUrl}`
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
          <a href="${safeTicketUrl}" style="background: #34d399; color: #000; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">Access Digital QR Pass</a>
        </p>
      `
      break
    }

    case 'payment_rejected': {
      subject = `Payment Verification Issue: ${eventTitle}`
      textFallback = `Hello ${recipient},\n\nYour payment submission for ${eventTitle} could not be verified by the organizers.\nReason: ${sanitizeText(payload.reason || 'Transaction could not be matched.')}\nPlease resubmit with your correct 12-digit UTR.`
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
    }

    case 'team_invitation': {
      const safeJoinUrl = sanitizeSafeUrl(payload.join_url, 'https://festflow.online/join-team')
      subject = `Squad Invitation: Join "${teamName}" for ${eventTitle}`
      textFallback = `Hello ${recipient},\n\n${sanitizeText(payload.leader_name || 'A team leader')} has invited you to join "${teamName}" for ${eventTitle}.\nTeam Invite Code: ${sanitizeText(payload.invite_code)}\n\nAccept your invitation and claim your ticket: ${safeJoinUrl}`
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
          <a href="${safeJoinUrl}" style="background: linear-gradient(135deg, ${brandPurple}, ${brandCyan}); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">Accept Squad Invitation</a>
        </p>
      `
      break
    }

    case 'team_invitation_accepted': {
      const safeDashboardUrl = sanitizeSafeUrl(payload.dashboard_url, 'https://festflow.online/student/dashboard')
      subject = `Squad Update: ${sanitizeText(payload.member_name || 'A member')} joined "${teamName}"`
      textFallback = `Hello ${recipient},\n\nGreat news! ${sanitizeText(payload.member_name || 'A teammate')} has accepted your invitation and joined "${teamName}" for ${eventTitle}.\nView squad roster: ${safeDashboardUrl}`
      bodyContent = `
        <h2 style="color: #34d399; margin-top: 0;">🤝 New Teammate Joined!</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, <strong>${sanitizeText(payload.member_name || 'A new member')}</strong> has accepted your invitation to join <strong>"${teamName}"</strong> for <strong>${eventTitle}</strong>.
        </p>
        <div style="background: rgba(52, 211, 153, 0.08); border: 1px solid rgba(52, 211, 153, 0.25); border-radius: 12px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">👥 <strong>Member:</strong> ${sanitizeText(payload.member_name || 'Teammate')} (${sanitizeText(payload.member_email || '')})</p>
          <p style="margin: 4px 0; color: ${textWhite};">🛡️ <strong>Current Squad Size:</strong> ${sanitizeText(String(payload.current_size || 'Updated'))} members</p>
        </div>
      `
      break
    }

    case 'ticket_issued': {
      const safeTicketUrl = sanitizeSafeUrl(payload.ticket_url, 'https://festflow.online/student/dashboard')
      subject = `Your Digital Pass for ${eventTitle} is Ready`
      textFallback = `Hello ${recipient},\n\nYour individual entry ticket for ${eventTitle} has been issued!\nTicket Code: ${ticketCode}\nAccess Pass: ${safeTicketUrl}`
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
          <a href="${safeTicketUrl}" style="background: linear-gradient(135deg, ${brandPurple}, ${brandCyan}); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">Open Pass & QR Code</a>
        </p>
      `
      break
    }

    case 'ticket_updated': {
      subject = `Ticket Updated: ${eventTitle}`
      textFallback = `Hello ${recipient},\n\nYour ticket for ${eventTitle} has been updated.\nTicket Code: ${ticketCode}\nDetails: ${sanitizeText(payload.update_summary || 'Event details updated.')}`
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
    }

    case 'registration_cancelled': {
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
    }

    case 'registration_waitlisted': {
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
    }

    case 'event_updated': {
      subject = `Event Announcement: ${eventTitle}`
      textFallback = `Hello ${recipient},\n\nThe organizers of ${eventTitle} have posted an announcement:\n${sanitizeText(payload.announcement || 'Please check the event page for details.')}`
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
    }

    case 'event_cancelled': {
      subject = `Event Cancelled: ${eventTitle}`
      textFallback = `Hello ${recipient},\n\nWe regret to inform you that ${eventTitle} has been cancelled by the organizers.\nReason: ${sanitizeText(payload.reason || 'Event cancelled')}`
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
    }

    case 'checkin_confirmed': {
      subject = `Gate Check-In Confirmed: ${eventTitle}`
      textFallback = `Hello ${recipient},\n\nYour pass for ${eventTitle} was checked in successfully at ${sanitizeText(payload.checked_in_at || 'the gate')}.\nEnjoy the event!`
      bodyContent = `
        <h2 style="color: #34d399; margin-top: 0;">✅ Gate Check-In Confirmed</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, you have been checked in for <strong>${eventTitle}</strong>.
        </p>
        <div style="background: rgba(52, 211, 153, 0.08); border: 1px solid rgba(52, 211, 153, 0.25); border-radius: 12px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">🎟️ <strong>Ticket:</strong> ${ticketCode}</p>
          <p style="margin: 4px 0; color: ${textWhite};">⏰ <strong>Time:</strong> ${sanitizeText(payload.checked_in_at || 'Just now')}</p>
        </div>
      `
      break
    }

    case 'event_reminder': {
      const safeTicketUrl = sanitizeSafeUrl(payload.ticket_url, 'https://festflow.online/student/dashboard')
      subject = `Reminder: ${eventTitle} is Coming Up!`
      textFallback = `Hello ${recipient},\n\nReminder that ${eventTitle} starts on ${sanitizeText(payload.start_date)} at ${venueName}.\nTicket Code: ${ticketCode}`
      bodyContent = `
        <h2 style="color: ${brandCyan}; margin-top: 0;">⏰ Event Reminder</h2>
        <p style="color: ${textWhite}; font-size: 15px; line-height: 1.6;">
          Hi <strong>${recipient}</strong>, your upcoming campus event <strong>${eventTitle}</strong> is happening soon!
        </p>
        <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0; color: ${textWhite};">📅 <strong>Date:</strong> ${sanitizeText(payload.start_date)}</p>
          <p style="margin: 4px 0; color: ${textWhite};">📍 <strong>Venue:</strong> ${venueName}</p>
          <p style="margin: 4px 0; color: ${textWhite};">🎟️ <strong>Pass:</strong> <span style="font-family: monospace; font-weight: bold;">${ticketCode}</span></p>
        </div>
        <p style="text-align: center; margin: 25px 0;">
          <a href="${safeTicketUrl}" style="background: linear-gradient(135deg, ${brandPurple}, ${brandCyan}); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block;">Open Pass for Gate Entry</a>
        </p>
      `
      break
    }

    default:
      throw new Error(`Unsupported email template: ${template}`)
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

/**
 * Server-side authorization check to prevent arbitrary email dispatch abuse.
 * Validates caller identity, recipient association, and organizer permissions against trusted database records.
 */
export async function authorizeEmailDispatch(params: {
  template: EmailTemplateType
  caller: { id: string; email?: string }
  to: string
  body: EmailRequest
  supabaseAdmin?: any
}): Promise<{ authorized: boolean; reason?: string }> {
  const { template, caller, to, body, supabaseAdmin } = params
  const callerEmail = (caller.email || '').toLowerCase().trim()
  const targetEmail = (to || '').toLowerCase().trim()
  const payload = body.payload || {}

  // 1. Self-directed notifications (isSelfAction: attendee's own ticket, confirmation, receipts)
  const isSelfAction = Boolean(callerEmail && callerEmail === targetEmail)
  if (isSelfAction) {
    return { authorized: true }
  }

  // 2. Authoritative Database Verification (When connected to Supabase)
  if (supabaseAdmin) {
    // ── FIX 1: Club Member Invitation ──────────────────────────────────────
    if (template === 'club_member_invitation') {
      const clubId = body.club_id || payload?.club_id
      let isClubAuthorized = false

      if (clubId) {
        // Direct club owner check (clubId is primary owner profile id)
        if (clubId === caller.id) {
          isClubAuthorized = true
        } else {
          // Check public.club_members table for active membership with manage_members permission (roles: owner, admin)
          const { data: memberRecord } = await supabaseAdmin
            .from('club_members')
            .select('role, status')
            .eq('club_id', clubId)
            .eq('user_id', caller.id)
            .eq('status', 'active')
            .maybeSingle()

          const role = memberRecord?.role
          if (role === 'owner' || role === 'admin') {
            isClubAuthorized = true
          }
        }
      }

      // Verify that the recipient email is tied to a legitimate, active pending invitation
      let invQuery = supabaseAdmin
        .from('club_invitations')
        .select('id, email, club_id')
        .ilike('email', targetEmail)
        .eq('status', 'pending')

      if (clubId) {
        invQuery = invQuery.eq('club_id', clubId)
      } else {
        invQuery = invQuery.eq('invited_by', caller.id)
      }

      const { data: invRecords } = await invQuery.limit(1)

      if (!invRecords || invRecords.length === 0) {
        return {
          authorized: false,
          reason: 'No pending invitation found for this recipient in the target organization.',
        }
      }

      if (isClubAuthorized || invRecords[0].club_id === clubId) {
        return { authorized: true }
      }

      return { authorized: false, reason: 'Caller does not have active owner or admin permissions for this club.' }
    }

    // ── FIX 3: Team Invitation Accepted (Member notifies team leader) ────────
    if (template === 'team_invitation_accepted') {
      const teamId = body.payload?.team_id || body.payload?.teamId
      if (!teamId) {
        return { authorized: false, reason: 'Missing required team_id in payload.' }
      }

      // Query database for team record
      const { data: teamRecord } = await supabaseAdmin
        .from('teams')
        .select('id, leader_id, name')
        .eq('id', teamId)
        .single()

      if (!teamRecord) {
        return { authorized: false, reason: 'Team record not found in database.' }
      }

      // Verify caller is an accepted member of this team
      const { data: memberRecord } = await supabaseAdmin
        .from('team_members')
        .select('id, status, role')
        .eq('team_id', teamId)
        .eq('user_id', caller.id)
        .single()

      if (!memberRecord || memberRecord.status !== 'accepted') {
        return { authorized: false, reason: 'Caller is not an accepted member of this team.' }
      }

      // Verify recipient 'to' is the verified team leader
      const { data: leaderProfile } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('id', teamRecord.leader_id)
        .single()

      if (!leaderProfile || (leaderProfile.email || '').toLowerCase().trim() !== targetEmail) {
        const { data: leaderMember } = await supabaseAdmin
          .from('team_members')
          .select('email')
          .eq('team_id', teamId)
          .eq('role', 'leader')
          .single()

        if (!leaderMember || (leaderMember.email || '').toLowerCase().trim() !== targetEmail) {
          return { authorized: false, reason: 'Recipient is not the verified leader of this team.' }
        }
      }

      return { authorized: true }
    }

    // ── Team Invitation (Team leader invites a student) ────────────────────
    if (template === 'team_invitation') {
      const eventId = body.event_id || payload?.event_id
      const teamName = payload?.teamName || payload?.team_name
      if (eventId && teamName) {
        const { data: teamRecord } = await supabaseAdmin
          .from('teams')
          .select('id, leader_id')
          .eq('event_id', eventId)
          .eq('name', teamName)
          .single()

        if (teamRecord?.leader_id === caller.id) {
          return { authorized: true }
        }
      }
      return { authorized: false, reason: 'Caller is not the leader of this team.' }
    }

    // ── FIX 2: Organizer Actions on Attendees & Events ─────────────────────
    if (
      template === 'registration_confirmed' ||
      template === 'registration_cancelled' ||
      template === 'registration_waitlisted' ||
      template === 'ticket_updated' ||
      template === 'ticket_issued' ||
      template === 'payment_approved' ||
      template === 'payment_rejected' ||
      template === 'checkin_confirmed' ||
      template === 'event_updated' ||
      template === 'event_cancelled' ||
      template === 'event_reminder'
    ) {
      let eventId = body.event_id || payload?.event_id
      const registrationId = body.registration_id || payload?.registration_id

      // 1. If registrationId is present, verify registration exists and belongs to targetEmail
      if (registrationId) {
        const { data: regRecord } = await supabaseAdmin
          .from('registrations')
          .select('id, event_id, student_id, participant_details')
          .eq('id', registrationId)
          .single()

        if (!regRecord) {
          return { authorized: false, reason: 'Registration record not found.' }
        }

        // Verify recipient matches registration email (from participant_details or profiles table)
        let regEmail = (regRecord.participant_details?.email || '').toLowerCase().trim()
        if (!regEmail && regRecord.student_id) {
          const { data: studentProfile } = await supabaseAdmin
            .from('profiles')
            .select('email')
            .eq('id', regRecord.student_id)
            .single()
          regEmail = (studentProfile?.email || '').toLowerCase().trim()
        }

        if (regEmail && regEmail !== targetEmail) {
          return { authorized: false, reason: 'Recipient email does not match registered attendee.' }
        }

        eventId = eventId || regRecord.event_id
      } else if (
        // For per-attendee templates without registrationId, verify registration by eventId + email
        template === 'registration_confirmed' ||
        template === 'registration_cancelled' ||
        template === 'registration_waitlisted' ||
        template === 'ticket_updated' ||
        template === 'payment_approved' ||
        template === 'payment_rejected' ||
        template === 'checkin_confirmed'
      ) {
        if (eventId) {
          const { data: regByEmail } = await supabaseAdmin
            .from('registrations')
            .select('id, participant_details, student_id')
            .eq('event_id', eventId)
            .limit(50)

          const hasMatchingReg = (regByEmail || []).some((r: any) => {
            const pEmail = (r.participant_details?.email || '').toLowerCase().trim()
            return pEmail === targetEmail
          })

          if (!hasMatchingReg) {
            const { data: profileRecord } = await supabaseAdmin
              .from('profiles')
              .select('id')
              .ilike('email', targetEmail)
              .single()

            if (profileRecord) {
              const { data: regByStudentId } = await supabaseAdmin
                .from('registrations')
                .select('id')
                .eq('event_id', eventId)
                .eq('student_id', profileRecord.id)
                .limit(1)

              if (!regByStudentId || regByStudentId.length === 0) {
                return { authorized: false, reason: 'No matching attendee registration found for this recipient.' }
              }
            } else {
              return { authorized: false, reason: 'No matching attendee registration found for this recipient.' }
            }
          }
        }
      }

      if (!eventId) {
        return { authorized: false, reason: 'Missing event_id for organizer action.' }
      }

      // 2. Query event to find owning club
      const { data: eventRecord } = await supabaseAdmin
        .from('events')
        .select('club_id')
        .eq('id', eventId)
        .single()

      if (!eventRecord) {
        return { authorized: false, reason: 'Event not found.' }
      }

      const clubId = eventRecord.club_id

      // 3. Primary club owner verification (club_id matches profile id)
      if (clubId === caller.id) {
        return { authorized: true }
      }

      // 4. Club staff role permission verification against granular least-privilege matrix
      const { data: staffRecord } = await supabaseAdmin
        .from('club_members')
        .select('role, status')
        .eq('club_id', clubId)
        .eq('user_id', caller.id)
        .eq('status', 'active')
        .single()

      if (!staffRecord) {
        return { authorized: false, reason: 'Caller is not an active staff member of this event organizing club.' }
      }

      const role = staffRecord.role
      if (template === 'payment_approved' || template === 'payment_rejected') {
        if (role === 'owner' || role === 'admin' || role === 'payment_reviewer') {
          return { authorized: true }
        }
      } else if (template === 'checkin_confirmed') {
        if (role === 'owner' || role === 'admin' || role === 'checkin_staff' || role === 'event_manager') {
          return { authorized: true }
        }
      } else {
        // registration_confirmed, registration_cancelled, registration_waitlisted, ticket_updated, ticket_issued, event_updated, event_cancelled, event_reminder
        if (role === 'owner' || role === 'admin' || role === 'event_manager') {
          return { authorized: true }
        }
      }

      return { authorized: false, reason: `Role "${role}" does not have permission to trigger ${template}.` }
    }

    return { authorized: false, reason: 'Unsupported action for third-party recipient.' }
  }

  // 3. Simulation mode (fallback when running in mock local environment without database connection)
  if (template === 'club_member_invitation') {
    const clubId = body.club_id || payload?.club_id
    if (clubId && (payload?.inviter_name || body.name)) {
      return { authorized: true }
    }
    return { authorized: false, reason: 'Missing club context in simulation mode.' }
  }

  if (template === 'team_invitation') {
    if (payload?.teamName && payload?.invite_code) {
      return { authorized: true }
    }
    return { authorized: false, reason: 'Missing team context in simulation mode.' }
  }

  if (template === 'team_invitation_accepted') {
    if (payload?.team_name && payload?.member_email && payload.member_email.toLowerCase() === callerEmail) {
      return { authorized: true }
    }
    return { authorized: false, reason: 'Caller email does not match accepted member email in simulation mode.' }
  }

  if (
    template === 'registration_confirmed' ||
    template === 'registration_cancelled' ||
    template === 'registration_waitlisted' ||
    template === 'ticket_updated' ||
    template === 'payment_approved' ||
    template === 'payment_rejected' ||
    template === 'ticket_issued' ||
    template === 'checkin_confirmed' ||
    template === 'event_updated' ||
    template === 'event_cancelled' ||
    template === 'event_reminder'
  ) {
    const eventId = body.event_id || payload?.event_id
    if (eventId && (body.registration_id || payload?.registration_id || payload?.event_title)) {
      return { authorized: true }
    }
    return { authorized: false, reason: 'Missing event/registration context in simulation mode.' }
  }

  return { authorized: false, reason: 'Unauthorized third-party dispatch in simulation mode.' }
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
    let authenticatedUser: any = null

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
      authenticatedUser = user
    }

    // Rate Limiting per caller (user.id or client IP)
    const clientIdentifier = isServiceRole
      ? 'service-role'
      : authenticatedUser?.id || req.headers.get('x-forwarded-for') || 'anon'

    if (!isServiceRole) {
      const rateCheck = checkRateLimit(clientIdentifier, 30, 60000)
      if (!rateCheck.allowed) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Rate limit exceeded: Please wait ${rateCheck.resetInSec}s before sending more emails.`,
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const body: EmailRequest = await req.json()
    const { template, to, name, payload, outbox_id } = body

    // 1. Validate template type (Reject unknown templates with 400 Bad Request)
    if (!template || !VALID_TEMPLATES.has(template)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid or unsupported email template: ${sanitizeText(String(template || ''))}`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Validate recipient email format (Reject malformed emails with 400 Bad Request)
    if (!isValidEmail(to)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid recipient email format.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Server-side authorization check: Prevent arbitrary-recipient abuse
    if (!isServiceRole && authenticatedUser) {
      const supabaseAdmin = (supabaseUrl && supabaseServiceKey)
        ? createClient(supabaseUrl, supabaseServiceKey)
        : undefined

      const authCheck = await authorizeEmailDispatch({
        template,
        caller: authenticatedUser,
        to,
        body,
        supabaseAdmin,
      })

      if (!authCheck.authorized) {
        const forbiddenReason = authCheck.reason
          ? `Forbidden: ${authCheck.reason}`
          : 'Forbidden: You are not authorized to dispatch emails to this recipient.'
        return new Response(
          JSON.stringify({
            success: false,
            error: forbiddenReason || 'Forbidden: You are not authorized to dispatch emails to this recipient.',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 4. Idempotency Check: Avoid duplicate sends if outbox record has already been fulfilled
    if (outbox_id && supabaseUrl && supabaseServiceKey) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
      const { data: existingOutbox } = await supabaseAdmin
        .from('email_outbox')
        .select('id, status, provider_message_id')
        .eq('id', outbox_id)
        .single()

      if (existingOutbox && existingOutbox.status === 'sent') {
        return new Response(
          JSON.stringify({
            success: true,
            configured: true,
            id: existingOutbox.provider_message_id,
            message: 'Email already dispatched under this outbox record (idempotent).',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 5. Sender Configuration (Verified domain defaults with Gmail reply-to)
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'festflow.events@festflow.online'
    const fromName = Deno.env.get('RESEND_FROM_NAME') || 'FestFlow'
    const replyToEmail = Deno.env.get('RESEND_REPLY_TO') || 'festflow.events@gmail.com'

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
    const resendPayload: Record<string, any> = {
      from: `${fromName} <${fromEmail}>`,
      to: [to.trim()],
      subject,
      html,
      text,
    }
    if (replyToEmail) {
      resendPayload.reply_to = replyToEmail
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(resendPayload),
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
        message: 'Email accepted by delivery provider (Resend).',
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
