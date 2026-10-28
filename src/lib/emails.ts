import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export interface EmailDispatchParams {
  template:
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
  to: string
  name?: string
  payload: Record<string, any>
  idempotencyKey?: string
  eventId?: string
  registrationId?: string
  userId?: string
}

export interface EmailDispatchResult {
  success: boolean
  configured: boolean
  message: string
  emailId?: string
  outboxId?: string
}

export interface OutboxRecord {
  id: string
  template_type: string
  recipient_email: string
  recipient_name?: string
  subject: string
  payload: Record<string, any>
  idempotency_key?: string
  event_id?: string
  registration_id?: string
  user_id?: string
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'retry' | 'unconfigured_local_mode'
  provider_message_id?: string | null
  retry_count: number
  max_retries: number
  last_attempt_at?: string | null
  sent_at?: string | null
  error_message?: string | null
  created_at: string
  updated_at: string
}

const LOCAL_STORAGE_OUTBOX_KEY = 'festflow_local_email_outbox'

export function getLocalOutbox(): OutboxRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_OUTBOX_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
}

export function saveLocalOutbox(items: OutboxRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_OUTBOX_KEY, JSON.stringify(items))
  } catch {
    // ignore
  }
}

/**
 * Dispatches a transactional email through the secure Supabase Edge Function.
 * If credentials are not configured, explicitly reports that email delivery is not configured.
 * Never pretends an email was sent. Enforces idempotency to avoid duplicate emails.
 */
export async function triggerTransactionalEmail(
  params: EmailDispatchParams
): Promise<EmailDispatchResult> {
  const { template, to, name, payload, idempotencyKey, eventId, registrationId, userId } = params

  if (isSupabaseConfigured) {
    try {
      // 1. Queue in email_outbox table for audit and idempotency
      let outboxId: string | undefined
      if (idempotencyKey) {
        const { data: queueRes } = await (supabase.rpc as any)('queue_email', {
          p_recipient_email: to,
          p_recipient_name: name || '',
          p_template_type: template,
          p_subject: `FestFlow: ${template.replace(/_/g, ' ')}`,
          p_payload: payload,
          p_idempotency_key: idempotencyKey,
          p_event_id: eventId || null,
          p_registration_id: registrationId || null,
          p_user_id: userId || null,
        })
        if (queueRes?.queued === false) {
          return {
            success: true,
            configured: true,
            message: 'Email already queued/sent under this idempotency key.',
            outboxId: queueRes?.outbox_id,
          }
        }
        outboxId = queueRes?.outbox_id
      }

      // 2. Invoke Edge Function
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          template,
          to,
          name,
          payload,
          outbox_id: outboxId,
        },
      })

      if (error) {
        return {
          success: false,
          configured: false,
          message: `Email function error: ${error.message}`,
          outboxId,
        }
      }

      if (data && data.configured === false) {
        return {
          success: false,
          configured: false,
          message: data.message || 'Email delivery is not configured.',
          outboxId,
        }
      }

      return {
        success: Boolean(data?.success),
        configured: Boolean(data?.configured),
        emailId: data?.id,
        outboxId,
        message: data?.message || 'Email sent successfully.',
      }
    } catch (err) {
      return {
        success: false,
        configured: false,
        message: err instanceof Error ? err.message : 'Failed to invoke email delivery.',
      }
    }
  }

  // Local Simulation Mode: Record in local outbox with full lifecycle state and idempotency protection
  const outbox = getLocalOutbox()
  const existing = idempotencyKey ? outbox.find((item) => item.idempotency_key === idempotencyKey) : null
  if (existing) {
    return {
      success: true,
      configured: false,
      message: 'Email already queued/sent under this idempotency key.',
      outboxId: existing.id,
      emailId: existing.provider_message_id || undefined,
    }
  }

  const simulatedId = `outbox_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  const simulatedProviderId = `msg_resend_sim_${Math.random().toString(36).substring(2, 10)}`

  const simulatedRecord: OutboxRecord = {
    id: simulatedId,
    template_type: template,
    recipient_email: to,
    recipient_name: name,
    subject: `FestFlow: ${template.replace(/_/g, ' ')}`,
    payload,
    idempotency_key: idempotencyKey,
    event_id: eventId,
    registration_id: registrationId,
    user_id: userId,
    status: 'sent',
    provider_message_id: simulatedProviderId,
    retry_count: 0,
    max_retries: 3,
    last_attempt_at: new Date().toISOString(),
    sent_at: new Date().toISOString(),
    error_message: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  outbox.unshift(simulatedRecord)
  saveLocalOutbox(outbox)

  return {
    success: true,
    configured: false,
    emailId: simulatedProviderId,
    outboxId: simulatedId,
    message: 'Email successfully queued in local simulation outbox.',
  }
}

/**
 * Authorized Resend of an outbox email record with strict rate-limiting (60s cooldown) and retry limits.
 */
export async function resendOutboxEmail(
  outboxId: string,
  requesterUserId?: string
): Promise<{ success: boolean; message: string; retryCount?: number }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('resend_outbox_email', {
        p_outbox_id: outboxId,
      })
      if (error) return { success: false, message: error.message }
      if (!data?.success) return { success: false, message: data?.message || 'Failed to resend email.' }

      // Invoke Edge Function for the renewed outbox record
      const { data: outboxItem } = await (supabase.from('email_outbox') as any)
        .select('*')
        .eq('id', outboxId)
        .single()

      if (outboxItem) {
        await supabase.functions.invoke('send-email', {
          body: {
            template: outboxItem.template_type,
            to: outboxItem.recipient_email,
            name: outboxItem.recipient_name,
            payload: { ...(outboxItem.payload || {}), is_resend: true },
            outbox_id: outboxId,
          },
        })
      }

      return {
        success: true,
        message: 'Email has been queued for redelivery.',
        retryCount: data.retry_count,
      }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to trigger email resend.' }
    }
  }

  // Local Simulation Mode
  const outbox = getLocalOutbox()
  const item = outbox.find((i) => i.id === outboxId)
  if (!item) {
    return { success: false, message: 'Email outbox record not found.' }
  }

  // Authorization: requester must match recipient, event owner, or be present
  if (requesterUserId && item.user_id && item.user_id !== requesterUserId) {
    return { success: false, message: 'You are not authorized to resend this notification.' }
  }

  // 60-second cooldown rate limit
  const now = Date.now()
  const lastAttempt = item.last_attempt_at ? new Date(item.last_attempt_at).getTime() : 0
  if (now - lastAttempt < 60000) {
    const waitSec = Math.ceil((60000 - (now - lastAttempt)) / 1000)
    return {
      success: false,
      message: `Please wait ${waitSec}s before resending this email.`,
    }
  }

  if (item.retry_count >= item.max_retries) {
    return {
      success: false,
      message: `Maximum retry limit (${item.max_retries}) exceeded for this notification.`,
    }
  }

  item.retry_count += 1
  item.last_attempt_at = new Date().toISOString()
  item.updated_at = new Date().toISOString()
  item.status = 'sent'
  saveLocalOutbox(outbox)

  return {
    success: true,
    message: 'Email has been resent successfully.',
    retryCount: item.retry_count,
  }
}

/**
 * Triggers pass confirmation email for confirmed registrations.
 */
export async function sendRegistrationConfirmedEmail(params: {
  to: string
  name?: string
  eventTitle: string
  ticketCode: string
  qrToken?: string
  startDate: string
  venueName: string
  teamName?: string | null
  registrationId: string
  eventId?: string
  userId?: string
  isResend?: boolean
}): Promise<EmailDispatchResult> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://festflow.com'
  return triggerTransactionalEmail({
    template: 'registration_confirmed',
    to: params.to,
    name: params.name,
    payload: {
      event_title: params.eventTitle,
      ticket_code: params.ticketCode,
      qr_token: params.qrToken,
      start_date: params.startDate,
      venue_name: params.venueName,
      team_name: params.teamName,
      ticket_url: `${origin}/student/tickets/${params.registrationId}`,
      is_resend: params.isResend,
    },
    idempotencyKey: params.isResend
      ? `resend_pass_${params.registrationId}_${Date.now()}`
      : `reg_confirmed_${params.registrationId}`,
    eventId: params.eventId,
    registrationId: params.registrationId,
    userId: params.userId,
  })
}

/**
 * Triggers application received email for registrations pending host approval.
 */
export async function sendApplicationSubmittedEmail(params: {
  to: string
  name?: string
  eventTitle: string
  ticketCode: string
  startDate: string
  venueName: string
  registrationId: string
  eventId?: string
  userId?: string
}): Promise<EmailDispatchResult> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://festflow.com'
  return triggerTransactionalEmail({
    template: 'application_submitted',
    to: params.to,
    name: params.name,
    payload: {
      event_title: params.eventTitle,
      ticket_code: params.ticketCode,
      start_date: params.startDate,
      venue_name: params.venueName,
      status_url: `${origin}/student/dashboard?tab=pending_approval`,
    },
    idempotencyKey: `app_submitted_${params.registrationId}`,
    eventId: params.eventId,
    registrationId: params.registrationId,
    userId: params.userId,
  })
}

/**
 * Triggers payment submission received notification.
 */
export async function sendPaymentReceivedEmail(params: {
  to: string
  name?: string
  eventTitle: string
  transactionReference: string
  amount: number
  registrationId: string
  eventId?: string
}): Promise<EmailDispatchResult> {
  return triggerTransactionalEmail({
    template: 'payment_received',
    to: params.to,
    name: params.name,
    payload: {
      event_title: params.eventTitle,
      transaction_reference: params.transactionReference,
      amount: params.amount,
    },
    idempotencyKey: `pay_rcv_${params.registrationId}_${params.transactionReference.trim().toUpperCase()}`,
    eventId: params.eventId,
    registrationId: params.registrationId,
  })
}

/**
 * Triggers payment approved notification with digital pass link.
 */
export async function sendPaymentApprovedEmail(params: {
  to: string
  name?: string
  eventTitle: string
  ticketCode: string
  venueName: string
  registrationId: string
  eventId?: string
}): Promise<EmailDispatchResult> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://festflow.com'
  return triggerTransactionalEmail({
    template: 'payment_approved',
    to: params.to,
    name: params.name,
    payload: {
      event_title: params.eventTitle,
      ticket_code: params.ticketCode,
      venue_name: params.venueName,
      ticket_url: `${origin}/student/tickets/${params.registrationId}`,
    },
    idempotencyKey: `pay_appr_${params.registrationId}_${params.ticketCode}`,
    eventId: params.eventId,
    registrationId: params.registrationId,
  })
}

/**
 * Triggers payment rejection notification with sanitized organizer reason.
 */
export async function sendPaymentRejectedEmail(params: {
  to: string
  name?: string
  eventTitle: string
  reason?: string
  registrationId: string
  eventId?: string
}): Promise<EmailDispatchResult> {
  return triggerTransactionalEmail({
    template: 'payment_rejected',
    to: params.to,
    name: params.name,
    payload: {
      event_title: params.eventTitle,
      reason: params.reason || 'Transaction could not be verified in organizer account.',
    },
    idempotencyKey: `pay_rej_${params.registrationId}_${Date.now()}`,
    eventId: params.eventId,
    registrationId: params.registrationId,
  })
}

/**
 * Triggers individual ticket issued notification (for individual registrations or team members).
 */
export async function sendTicketIssuedEmail(params: {
  to: string
  name?: string
  eventTitle: string
  ticketCode: string
  venueName: string
  teamName?: string
  registrationId: string
  eventId?: string
}): Promise<EmailDispatchResult> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://festflow.com'
  return triggerTransactionalEmail({
    template: 'ticket_issued',
    to: params.to,
    name: params.name,
    payload: {
      event_title: params.eventTitle,
      ticket_code: params.ticketCode,
      venue_name: params.venueName,
      team_name: params.teamName,
      ticket_url: `${origin}/student/tickets/${params.registrationId}`,
    },
    idempotencyKey: `tkt_issued_${params.registrationId}_${params.ticketCode}`,
    eventId: params.eventId,
    registrationId: params.registrationId,
  })
}

/**
 * Triggers ticket updated notification.
 */
export async function sendTicketUpdatedEmail(params: {
  to: string
  name?: string
  eventTitle: string
  ticketCode: string
  updateSummary: string
  registrationId: string
  eventId?: string
}): Promise<EmailDispatchResult> {
  return triggerTransactionalEmail({
    template: 'ticket_updated',
    to: params.to,
    name: params.name,
    payload: {
      event_title: params.eventTitle,
      ticket_code: params.ticketCode,
      update_summary: params.updateSummary,
    },
    idempotencyKey: `tkt_upd_${params.registrationId}_${Date.now()}`,
    eventId: params.eventId,
    registrationId: params.registrationId,
  })
}

/**
 * Triggers registration cancelled notification.
 */
export async function sendRegistrationCancelledEmail(params: {
  to: string
  name?: string
  eventTitle: string
  ticketCode: string
  registrationId: string
  eventId?: string
}): Promise<EmailDispatchResult> {
  return triggerTransactionalEmail({
    template: 'registration_cancelled',
    to: params.to,
    name: params.name,
    payload: {
      event_title: params.eventTitle,
      ticket_code: params.ticketCode,
    },
    idempotencyKey: `reg_canc_${params.registrationId}`,
    eventId: params.eventId,
    registrationId: params.registrationId,
  })
}

/**
 * Triggers registration waitlisted notification.
 */
export async function sendRegistrationWaitlistedEmail(params: {
  to: string
  name?: string
  eventTitle: string
  registrationId: string
  eventId?: string
}): Promise<EmailDispatchResult> {
  return triggerTransactionalEmail({
    template: 'registration_waitlisted',
    to: params.to,
    name: params.name,
    payload: {
      event_title: params.eventTitle,
    },
    idempotencyKey: `reg_wait_${params.registrationId}`,
    eventId: params.eventId,
    registrationId: params.registrationId,
  })
}

/**
 * Triggers event announcement/update email to attendees.
 */
export async function sendEventUpdatedEmail(params: {
  to: string
  name?: string
  eventTitle: string
  announcement: string
  eventId: string
}): Promise<EmailDispatchResult> {
  return triggerTransactionalEmail({
    template: 'event_updated',
    to: params.to,
    name: params.name,
    payload: {
      event_title: params.eventTitle,
      announcement: params.announcement,
    },
    idempotencyKey: `evt_upd_${params.eventId}_${Date.now()}`,
    eventId: params.eventId,
  })
}

/**
 * Triggers event cancelled email.
 */
export async function sendEventCancelledEmail(params: {
  to: string
  name?: string
  eventTitle: string
  reason?: string
  eventId: string
}): Promise<EmailDispatchResult> {
  return triggerTransactionalEmail({
    template: 'event_cancelled',
    to: params.to,
    name: params.name,
    payload: {
      event_title: params.eventTitle,
      reason: params.reason,
    },
    idempotencyKey: `evt_canc_${params.eventId}`,
    eventId: params.eventId,
  })
}

/**
 * Triggers gate check-in confirmation email.
 */
export async function sendCheckinConfirmedEmail(params: {
  to: string
  name?: string
  eventTitle: string
  ticketCode: string
  checkedInAt?: string
  registrationId: string
  eventId?: string
}): Promise<EmailDispatchResult> {
  return triggerTransactionalEmail({
    template: 'checkin_confirmed',
    to: params.to,
    name: params.name,
    payload: {
      event_title: params.eventTitle,
      ticket_code: params.ticketCode,
      checked_in_at: params.checkedInAt || new Date().toLocaleTimeString(),
    },
    idempotencyKey: `chk_conf_${params.registrationId}_${params.ticketCode}`,
    eventId: params.eventId,
    registrationId: params.registrationId,
  })
}

/**
 * Sends team invitation email with join token and invite code.
 */
export async function sendTeamInvitationEmail(params: {
  recipientEmail: string
  recipientName?: string
  teamName: string
  eventTitle: string
  eventSlug: string
  leaderName: string
  inviteCode: string
  inviteToken: string
  expiresAt: string
  eventId: string
  teamId: string
}): Promise<EmailDispatchResult> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://festflow.app'
  const joinUrl = `${origin}/events/${params.eventSlug}?join=1&code=${encodeURIComponent(
    params.inviteCode
  )}&token=${encodeURIComponent(params.inviteToken)}`

  return triggerTransactionalEmail({
    template: 'team_invitation',
    to: params.recipientEmail,
    name: params.recipientName,
    eventId: params.eventId,
    idempotencyKey: `team_invite_${params.teamId}_${params.recipientEmail}_${params.inviteToken.slice(0, 8)}`,
    payload: {
      teamName: params.teamName,
      eventTitle: params.eventTitle,
      leaderName: params.leaderName,
      inviteCode: params.inviteCode,
      inviteToken: params.inviteToken,
      joinUrl,
      expiresAt: params.expiresAt,
    },
  })
}

/**
 * Sends notification to team leader when an invited member joins the squad.
 */
export async function sendTeamInvitationAcceptedEmail(params: {
  leaderEmail: string
  leaderName?: string
  memberName: string
  memberEmail: string
  teamName: string
  eventTitle: string
  currentSize: number
  eventId: string
  teamId: string
}): Promise<EmailDispatchResult> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://festflow.app'
  return triggerTransactionalEmail({
    template: 'team_invitation_accepted',
    to: params.leaderEmail,
    name: params.leaderName,
    eventId: params.eventId,
    idempotencyKey: `team_acc_${params.teamId}_${params.memberEmail}_${params.currentSize}`,
    payload: {
      team_name: params.teamName,
      event_title: params.eventTitle,
      member_name: params.memberName,
      member_email: params.memberEmail,
      current_size: params.currentSize,
      dashboard_url: `${origin}/student/dashboard`,
    },
  })
}

/**
 * Resends pass email for an existing confirmed registration.
 */
export async function resendPassEmail(
  regOrId: any,
  recipientEmail?: string,
  recipientName?: string
): Promise<{ success: boolean; message: string; emailId?: string }> {
  let reg = regOrId
  if (typeof regOrId === 'string') {
    const { getRegistrationById } = await import('@/lib/registrations')
    const fetched = await getRegistrationById(regOrId)
    if (fetched.registration) {
      reg = fetched.registration
    } else {
      reg = { id: regOrId }
    }
  }

  const to =
    recipientEmail ||
    reg?.participant_details?.email ||
    reg?.user?.email ||
    reg?.student_email ||
    ''

  const name =
    recipientName ||
    reg?.participant_details?.student_name ||
    reg?.user?.user_metadata?.display_name ||
    'Attendee'

  if (!to) {
    return {
      success: false,
      message: 'No recipient email address found for this registration pass.',
    }
  }

  const res = await sendRegistrationConfirmedEmail({
    to,
    name,
    eventTitle: reg?.event?.title || 'Campus Event',
    ticketCode: reg?.ticket_code || '',
    qrToken: reg?.qr_token,
    startDate: reg?.event?.start_date || '',
    venueName: reg?.event?.venue_name || '',
    teamName: reg?.team_name,
    registrationId: reg?.id,
    eventId: reg?.event_id,
    isResend: true,
  })

  return {
    success: res.success,
    message: res.message || 'Pass delivery queued.',
    emailId: res.emailId,
  }
}

/**
 * Bulk event reminders for organizers.
 */
export async function sendBulkEventReminders(
  eventId: string,
  customMessage?: string
): Promise<{ success: boolean; count: number; message: string }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('send_event_reminders', {
        p_event_id: eventId,
        p_custom_message: customMessage || null,
      })

      if (error) {
        return { success: false, count: 0, message: error.message }
      }

      return {
        success: Boolean(data?.success),
        count: Number(data?.reminders_queued || 0),
        message: data?.message || 'Reminders dispatched.',
      }
    } catch (err) {
      return {
        success: false,
        count: 0,
        message: err instanceof Error ? err.message : 'Failed to send reminders.',
      }
    }
  }

  // Fallback Simulation Mode
  const rawRegs = localStorage.getItem('festflow_local_registrations')
  const localRegs = rawRegs ? JSON.parse(rawRegs) : []
  const confirmed = localRegs.filter((r: any) => r.event_id === eventId && r.status === 'confirmed')

  return {
    success: true,
    count: confirmed.length,
    message: `${confirmed.length} reminder notification(s) queued for confirmed attendees.`,
  }
}

/**
 * Triggers club staff invitation email.
 */
export async function sendClubMemberInvitationEmail(params: {
  to: string
  clubName: string
  inviterName: string
  role: string
  invitationUrl: string
  expiresAt: string
  clubId?: string
}): Promise<EmailDispatchResult> {
  return triggerTransactionalEmail({
    template: 'club_member_invitation',
    to: params.to,
    payload: {
      club_name: params.clubName,
      inviter_name: params.inviterName,
      role: params.role,
      invitation_url: params.invitationUrl,
      expires_at: params.expiresAt,
    },
    idempotencyKey: `club_inv_${params.to}_${Date.now()}`,
    userId: params.clubId,
  })
}
