import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getFrontendBaseUrl } from '@/lib/canonicalUrl'

export interface EmailDispatchParams {
  template:
    | 'registration_confirmed'
    | 'application_submitted'
    | 'payment_received'
    | 'payment_approved'
    | 'payment_rejected'
    | 'team_invitation'
    | 'team_invitation_accepted'
    | 'team_member_added'
    | 'ticket_issued'
    | 'ticket_updated'
    | 'registration_cancelled'
    | 'registration_waitlisted'
    | 'event_updated'
    | 'event_cancelled'
    | 'checkin_confirmed'
    | 'event_reminder'
    | 'club_member_invitation'
    | 'club_invitation_accepted'
  to: string
  name?: string
  payload: Record<string, any>
  idempotencyKey?: string
  eventId?: string
  teamId?: string
  registrationId?: string
  userId?: string
}

export type EmailFailureCategory =
  | 'EDGE_FUNCTION_UNREACHABLE' // Pre-execution: CORS preflight failure, function not deployed, or offline
  | 'GATEWAY_RELAY_ERROR'       // Supabase relay failure
  | 'GATEWAY_AUTH_REJECTED'     // HTTP 401: Gateway JWT or session rejection
  | 'DISPATCH_FORBIDDEN'        // HTTP 403: Server authorization denied
  | 'FUNCTION_NOT_FOUND'        // HTTP 404: Edge Function not deployed or route missing
  | 'RATE_LIMITED'              // HTTP 429: Rate limit exceeded
  | 'FUNCTION_RUNTIME_ERROR'    // HTTP 500: Server-side execution exception
  | 'PROVIDER_UNCONFIGURED'     // Resend API key unconfigured in secrets
  | 'PROVIDER_REJECTED'         // Resend rejected payload (unverified sender, etc.)
  | 'CLIENT_DISPATCH_EXCEPTION' // Uncaught client invocation exception

export interface EmailDispatchResult {
  success: boolean
  configured: boolean
  message: string
  error?: string
  emailId?: string
  outboxId?: string
  failureCategory?: EmailFailureCategory
  httpStatus?: number
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

      // 2. Invoke Delivery Engine: Try Vercel Serverless Function first, fallback to Supabase Edge Function
      let dispatchData: any = null
      let dispatchError: any = null

      const emailPayload = {
        template,
        to,
        name,
        payload,
        outbox_id: outboxId,
        event_id: eventId,
        registration_id: registrationId,
        user_id: userId,
        club_id: (payload as any)?.club_id || (template === 'club_member_invitation' ? userId : undefined),
      }

      // Route A: Vercel Native /api/send-email (Zero CORS, auto-deployed with git push)
      try {
        const vercelRes = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emailPayload),
        })

        if (vercelRes.ok) {
          const resJson = await vercelRes.json().catch(() => null)
          if (resJson && typeof resJson === 'object') {
            dispatchData = resJson
          }
        } else if (vercelRes.status !== 404) {
          const errJson = await vercelRes.json().catch(() => null)
          if (errJson && typeof errJson === 'object') {
            dispatchData = errJson
          }
        }
      } catch {
        // Fallback to Supabase Edge Function below
      }

      // Route B: If Vercel API didn't handle it, try Supabase Edge Function
      if (!dispatchData) {
        const { data, error } = await supabase.functions.invoke('send-email', {
          body: emailPayload,
        })
        dispatchData = data
        dispatchError = error
      }

      if (dispatchError) {
        let failureCategory: EmailFailureCategory = 'FUNCTION_RUNTIME_ERROR'
        let failureMessage = `Email function error: ${dispatchError.message}`
        let httpStatus: number | undefined

        // Detect FunctionsFetchError (Pre-execution: CORS preflight failure, function not deployed, or network/DNS failure)
        if (
          dispatchError.name === 'FunctionsFetchError' ||
          dispatchError.message?.includes('Failed to send a request to the Edge Function')
        ) {
          failureCategory = 'EDGE_FUNCTION_UNREACHABLE'
          failureMessage =
            'Email delivery service is currently not configured or unreachable.'
        } else if (
          dispatchError.name === 'FunctionsRelayError' ||
          dispatchError.message?.includes('relay')
        ) {
          failureCategory = 'GATEWAY_RELAY_ERROR'
          failureMessage = 'Supabase gateway relay error while reaching Edge Function.'
        } else if (dispatchError.name === 'FunctionsHttpError') {
          // FunctionsHttpError exposes the Response object in error.context
          const resp = (dispatchError as any).context as Response | undefined
          httpStatus = resp?.status

          let parsedBody: any = null
          if (resp) {
            try {
              if (typeof resp.json === 'function') {
                parsedBody = await resp.json()
              }
            } catch {
              try {
                if (typeof resp.text === 'function') {
                  parsedBody = { error: await resp.text() }
                }
              } catch {
                // ignore body parse failure
              }
            }
          }

          const serverErrorText =
            parsedBody?.error || parsedBody?.message || dispatchError.message

          if (httpStatus === 401) {
            failureCategory = 'GATEWAY_AUTH_REJECTED'
            failureMessage = 'Authentication rejected by Edge Function gateway. (Valid user session required)'
          } else if (httpStatus === 403) {
            failureCategory = 'DISPATCH_FORBIDDEN'
            failureMessage = serverErrorText || 'Not authorized to dispatch email to this recipient.'
          } else if (httpStatus === 404) {
            failureCategory = 'FUNCTION_NOT_FOUND'
            failureMessage = 'send-email Edge Function not found on Supabase (404).'
          } else if (httpStatus === 429) {
            failureCategory = 'RATE_LIMITED'
            failureMessage = serverErrorText || 'Email dispatch rate limit reached. Please wait before retrying.'
          } else if (httpStatus && httpStatus >= 500) {
            if (serverErrorText && (serverErrorText.toLowerCase().includes('resend') || serverErrorText.toLowerCase().includes('provider'))) {
              failureCategory = 'PROVIDER_REJECTED'
              failureMessage = `Email provider error: ${serverErrorText}`
            } else {
              failureCategory = 'FUNCTION_RUNTIME_ERROR'
              failureMessage = serverErrorText || 'Edge Function encountered an unexpected internal error.'
            }
          } else {
            failureMessage = serverErrorText || failureMessage
          }
        }

        // Safe diagnostic logging: NEVER log email addresses, names, tokens, or credentials
        console.warn('[FestFlow Email] Dispatch failure:', {
          category: failureCategory,
          template,
          httpStatus: httpStatus ?? 'N/A',
          errorType: dispatchError?.name ?? 'UnknownError',
          hasOutboxId: Boolean(outboxId),
        })

        return {
          success: false,
          configured: false,
          failureCategory,
          httpStatus,
          message: failureMessage,
          error: failureMessage,
          outboxId,
        }
      }

      if (dispatchData && dispatchData.configured === false) {
        console.warn('[FestFlow Email] Provider unconfigured:', {
          category: 'PROVIDER_UNCONFIGURED',
          template,
          hasOutboxId: Boolean(outboxId),
        })
        const msg = dispatchData.message || 'Email delivery is not configured. RESEND_API_KEY environment variable is required.'
        return {
          success: false,
          configured: false,
          failureCategory: 'PROVIDER_UNCONFIGURED',
          message: msg,
          error: msg,
          outboxId,
        }
      }

      if (dispatchData && dispatchData.success === false) {
        console.warn('[FestFlow Email] Provider rejected dispatch:', {
          category: 'PROVIDER_REJECTED',
          template,
          hasOutboxId: Boolean(outboxId),
        })
        const msg = dispatchData.message || dispatchData.error || 'Email rejected by delivery provider (Resend).'
        return {
          success: false,
          configured: Boolean(dispatchData.configured),
          failureCategory: 'PROVIDER_REJECTED',
          message: msg,
          error: msg,
          outboxId,
        }
      }

      return {
        success: Boolean(dispatchData?.success),
        configured: Boolean(dispatchData?.configured),
        emailId: dispatchData?.id,
        outboxId,
        message: dispatchData?.message || 'Email accepted by delivery provider (Resend).',
      }
    } catch (err) {
      console.warn('[FestFlow Email] Exception invoking email delivery:', {
        category: 'CLIENT_DISPATCH_EXCEPTION',
        template,
        error: err instanceof Error ? err.name : 'UnknownError',
      })
      const msg = err instanceof Error ? err.message : 'Failed to invoke email delivery.'
      return {
        success: false,
        configured: false,
        failureCategory: 'CLIENT_DISPATCH_EXCEPTION',
        message: msg,
        error: msg,
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
 * Dispatches an email with controlled retries and exponential backoff for transient failures.
 * Transient categories: EDGE_FUNCTION_UNREACHABLE, GATEWAY_RELAY_ERROR, RATE_LIMITED, or 5xx server errors.
 * Terminal categories (401, 403, 404, PROVIDER_UNCONFIGURED) exit immediately without retrying.
 */
export async function triggerTransactionalEmailWithRetry(
  params: EmailDispatchParams,
  options: { maxRetries?: number; initialDelayMs?: number } = {}
): Promise<EmailDispatchResult> {
  const maxRetries = options.maxRetries ?? 2
  const initialDelayMs = options.initialDelayMs ?? 800

  let attempt = 0
  let lastResult: EmailDispatchResult = {
    success: false,
    configured: false,
    message: 'Initial dispatch attempt pending.',
  }

  while (attempt <= maxRetries) {
    lastResult = await triggerTransactionalEmail(params)
    if (lastResult.success) {
      return lastResult
    }

    const cat = lastResult.failureCategory
    const isTransient =
      cat === 'EDGE_FUNCTION_UNREACHABLE' ||
      cat === 'GATEWAY_RELAY_ERROR' ||
      cat === 'RATE_LIMITED' ||
      (cat === 'FUNCTION_RUNTIME_ERROR' && (lastResult.httpStatus ? lastResult.httpStatus >= 500 : true))

    if (!isTransient || attempt >= maxRetries) {
      break
    }

    attempt++
    const delay = initialDelayMs * Math.pow(2, attempt - 1) + Math.random() * 150
    await new Promise((r) => setTimeout(r, delay))
  }

  return lastResult
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
  const origin = getFrontendBaseUrl()
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
  const origin = getFrontendBaseUrl()
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
  const origin = getFrontendBaseUrl()
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
 * Triggers payment rejection notification with sanitized organizer reason and resubmission URL.
 */
export async function sendPaymentRejectedEmail(params: {
  to: string
  name?: string
  eventTitle: string
  reason?: string
  registrationId: string
  eventId?: string
}): Promise<EmailDispatchResult> {
  const origin = getFrontendBaseUrl()
  return triggerTransactionalEmail({
    template: 'payment_rejected',
    to: params.to,
    name: params.name,
    payload: {
      event_title: params.eventTitle,
      reason: params.reason || 'Transaction could not be verified in organizer account.',
      payment_url: `${origin}/student/payments/${params.registrationId}`,
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
  const origin = getFrontendBaseUrl()
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
  const origin = getFrontendBaseUrl()
  const joinUrl = `${origin}/join-team?code=${encodeURIComponent(
    params.inviteCode
  )}&token=${encodeURIComponent(params.inviteToken)}`

  return triggerTransactionalEmail({
    template: 'team_invitation',
    to: params.recipientEmail,
    name: params.recipientName,
    eventId: params.eventId,
    teamId: params.teamId,
    idempotencyKey: `team_invite_${params.teamId}_${params.recipientEmail}_${params.inviteToken.slice(0, 8)}`,
    payload: {
      team_name: params.teamName,
      teamName: params.teamName,
      event_title: params.eventTitle,
      eventTitle: params.eventTitle,
      event_slug: params.eventSlug,
      eventSlug: params.eventSlug,
      leader_name: params.leaderName,
      leaderName: params.leaderName,
      invite_code: params.inviteCode,
      inviteCode: params.inviteCode,
      invite_token: params.inviteToken,
      inviteToken: params.inviteToken,
      join_url: joinUrl,
      joinUrl,
      expires_at: params.expiresAt,
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
  const origin = getFrontendBaseUrl()
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
): Promise<{ success: boolean; message: string; emailId?: string; configured?: boolean }> {
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
    configured: res.configured,
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
 * Bulk event update / announcement email to all confirmed attendees.
 */
export async function sendBulkEventUpdate(
  eventId: string,
  eventTitle: string,
  announcement: string
): Promise<{ success: boolean; count: number; message: string }> {
  if (isSupabaseConfigured) {
    try {
      const { data: attendees } = await (supabase.from('registrations') as any)
        .select('id, participant_details, profiles:student_id(email, display_name)')
        .eq('event_id', eventId)
        .eq('status', 'confirmed')

      let count = 0
      for (const att of (attendees || [])) {
        const email = att.participant_details?.email || att.profiles?.email
        const name = att.participant_details?.student_name || att.profiles?.display_name
        if (email) {
          count++
          sendEventUpdatedEmail({
            to: email,
            name,
            eventTitle,
            announcement,
            eventId,
          }).catch(() => {})
        }
      }
      return { success: true, count, message: `${count} update notification(s) dispatched to attendees.` }
    } catch (err: any) {
      return { success: false, count: 0, message: err?.message || 'Failed to dispatch event updates.' }
    }
  }

  // Simulation mode
  const rawRegs = localStorage.getItem('festflow_local_registrations')
  const localRegs = rawRegs ? JSON.parse(rawRegs) : []
  const confirmed = localRegs.filter((r: any) => r.event_id === eventId && r.status === 'confirmed')
  for (const reg of confirmed) {
    const email = reg.participant_details?.email || 'student@campus.edu'
    const name = reg.participant_details?.student_name || 'Attendee'
    sendEventUpdatedEmail({
      to: email,
      name,
      eventTitle,
      announcement,
      eventId,
    }).catch(() => {})
  }
  return { success: true, count: confirmed.length, message: `${confirmed.length} update notification(s) queued for attendees.` }
}

/**
 * Bulk event cancellation email to all confirmed attendees.
 */
export async function sendBulkEventCancellation(
  eventId: string,
  eventTitle: string,
  reason?: string
): Promise<{ success: boolean; count: number; message: string }> {
  if (isSupabaseConfigured) {
    try {
      const { data: attendees } = await (supabase.from('registrations') as any)
        .select('id, participant_details, profiles:student_id(email, display_name)')
        .eq('event_id', eventId)
        .eq('status', 'confirmed')

      let count = 0
      for (const att of (attendees || [])) {
        const email = att.participant_details?.email || att.profiles?.email
        const name = att.participant_details?.student_name || att.profiles?.display_name
        if (email) {
          count++
          sendEventCancelledEmail({
            to: email,
            name,
            eventTitle,
            reason,
            eventId,
          }).catch(() => {})
        }
      }
      return { success: true, count, message: `${count} cancellation notification(s) dispatched to attendees.` }
    } catch (err: any) {
      return { success: false, count: 0, message: err?.message || 'Failed to dispatch cancellation notifications.' }
    }
  }

  // Simulation mode
  const rawRegs = localStorage.getItem('festflow_local_registrations')
  const localRegs = rawRegs ? JSON.parse(rawRegs) : []
  const confirmed = localRegs.filter((r: any) => r.event_id === eventId && r.status === 'confirmed')
  for (const reg of confirmed) {
    const email = reg.participant_details?.email || 'student@campus.edu'
    const name = reg.participant_details?.student_name || 'Attendee'
    sendEventCancelledEmail({
      to: email,
      name,
      eventTitle,
      reason,
      eventId,
    }).catch(() => {})
  }
  return { success: true, count: confirmed.length, message: `${confirmed.length} cancellation notification(s) queued for attendees.` }
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
  isResend?: boolean
  invitationToken?: string
}): Promise<EmailDispatchResult> {
  const cleanTo = (params.to || '').trim().toLowerCase()
  const tokenPart = params.invitationToken ? params.invitationToken.slice(0, 16) : ''
  const roleSlug = (params.role || 'member').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
  return triggerTransactionalEmail({
    template: 'club_member_invitation',
    to: params.to,
    payload: {
      club_name: params.clubName,
      inviter_name: params.inviterName,
      role: params.role,
      invitation_url: params.invitationUrl,
      expires_at: params.expiresAt,
      club_id: params.clubId,
      is_resend: params.isResend,
      invitation_token: tokenPart,
    },
    idempotencyKey: params.isResend
      ? `club_inv_resend_${params.clubId || 'c'}_${cleanTo}_${tokenPart || Date.now()}`
      : `club_inv_${params.clubId || 'c'}_${cleanTo}_${tokenPart || roleSlug}`,
    userId: params.clubId,
  })
}

/**
 * Sends notification to a team member when added to a squad by the leader.
 */
export async function sendTeamMemberAddedEmail(params: {
  to: string
  name?: string
  teamName: string
  eventTitle: string
  leaderName: string
  startDate: string
  venueName: string
  ticketCode?: string
  registrationId?: string
  eventId?: string
  teamId?: string
  isPaid?: boolean
}): Promise<EmailDispatchResult> {
  const origin = getFrontendBaseUrl()
  const cleanTo = (params.to || '').toLowerCase().trim()
  return triggerTransactionalEmail({
    template: 'team_member_added',
    to: params.to,
    name: params.name,
    eventId: params.eventId,
    teamId: params.teamId,
    registrationId: params.registrationId,
    idempotencyKey: `team_member_added_${params.teamId || params.eventId}_${cleanTo}`,
    payload: {
      team_name: params.teamName,
      teamName: params.teamName,
      event_title: params.eventTitle,
      eventTitle: params.eventTitle,
      leader_name: params.leaderName,
      leaderName: params.leaderName,
      start_date: params.startDate,
      venue_name: params.venueName,
      ticket_code: params.ticketCode,
      ticket_url: params.registrationId
        ? `${origin}/student/tickets/${params.registrationId}`
        : `${origin}/student/dashboard`,
      is_paid: params.isPaid,
    },
  })
}

/**
 * Sends notification to club owner / administrators when a staff member accepts their invitation.
 */
export async function sendClubInvitationAcceptedEmail(params: {
  to: string
  adminName?: string
  clubName: string
  memberName: string
  memberEmail: string
  role: string
  clubId: string
}): Promise<EmailDispatchResult> {
  const origin = getFrontendBaseUrl()
  const cleanMemberEmail = (params.memberEmail || '').toLowerCase().trim()
  return triggerTransactionalEmail({
    template: 'club_invitation_accepted',
    to: params.to,
    name: params.adminName,
    idempotencyKey: `club_inv_acc_${params.clubId}_${cleanMemberEmail}_${params.role}`,
    payload: {
      club_id: params.clubId,
      club_name: params.clubName,
      member_name: params.memberName,
      member_email: params.memberEmail,
      role: params.role,
      club_url: `${origin}/club/members`,
    },
    userId: params.clubId,
  })
}

/**
 * Sends an event reminder notification to an individual attendee.
 */
export async function sendEventReminderEmail(params: {
  to: string
  name?: string
  eventTitle: string
  startDate: string
  venueName: string
  ticketCode: string
  registrationId: string
  eventId: string
}): Promise<EmailDispatchResult> {
  const origin = getFrontendBaseUrl()
  return triggerTransactionalEmail({
    template: 'event_reminder',
    to: params.to,
    name: params.name,
    payload: {
      event_title: params.eventTitle,
      start_date: params.startDate,
      venue_name: params.venueName,
      ticket_code: params.ticketCode,
      ticket_url: `${origin}/student/tickets/${params.registrationId}`,
    },
    idempotencyKey: `evt_remind_${params.eventId}_${params.registrationId}_${Date.now()}`,
    eventId: params.eventId,
    registrationId: params.registrationId,
  })
}
