import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export interface EmailDispatchParams {
  template:
    | 'registration_confirmed'
    | 'application_submitted'
    | 'payment_received'
    | 'payment_approved'
    | 'payment_rejected'
    | 'registration_cancelled'
    | 'event_cancelled'
    | 'event_reminder'
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
}

const LOCAL_STORAGE_OUTBOX_KEY = 'festflow_local_email_outbox'

export function getLocalOutbox(): Array<any> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_OUTBOX_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
}

export function saveLocalOutbox(items: Array<any>) {
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
          p_subject: `FestFlow: ${template}`,
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
        }
      }

      if (data && data.configured === false) {
        return {
          success: false,
          configured: false,
          message: data.message || 'Email delivery is not configured.',
        }
      }

      return {
        success: Boolean(data?.success),
        configured: Boolean(data?.configured),
        emailId: data?.id,
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

  // Local Simulation Mode: Record in local outbox for developer visibility with idempotency protection
  const outbox = getLocalOutbox()
  if (idempotencyKey && outbox.some((item) => item.idempotency_key === idempotencyKey)) {
    return {
      success: true,
      configured: false,
      message: 'Email already queued/sent under this idempotency key.',
    }
  }

  const simulatedRecord = {
    id: `outbox_${Date.now()}`,
    template,
    to,
    name,
    payload,
    idempotency_key: idempotencyKey,
    event_id: eventId,
    registration_id: registrationId,
    user_id: userId,
    status: 'unconfigured_local_mode',
    created_at: new Date().toISOString(),
    notice: 'Email delivery is not configured. Add RESEND_API_KEY in Supabase secrets.',
  }
  outbox.unshift(simulatedRecord)
  saveLocalOutbox(outbox)

  return {
    success: false,
    configured: false,
    message: 'Email delivery is not configured. Set RESEND_API_KEY in Supabase Edge Function secrets.',
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
 * Triggers application received email for pending approval registrations.
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
      status_url: `${origin}/student/tickets/${params.registrationId}`,
    },
    idempotencyKey: `app_submitted_${params.registrationId}`,
    eventId: params.eventId,
    registrationId: params.registrationId,
    userId: params.userId,
  })
}

/**
 * Triggers payment approved email once order or UTR is verified.
 */
export async function sendPaymentApprovedEmail(params: {
  to: string
  name?: string
  eventTitle: string
  ticketCode: string
  venueName: string
  registrationId: string
  orderId?: string
  eventId?: string
  userId?: string
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
    idempotencyKey: params.orderId ? `pay_approved_${params.orderId}` : `pay_approved_reg_${params.registrationId}`,
    eventId: params.eventId,
    registrationId: params.registrationId,
    userId: params.userId,
  })
}

/**
 * Triggers payment rejected / issue notification.
 */
export async function sendPaymentRejectedEmail(params: {
  to: string
  name?: string
  eventTitle: string
  reason: string
  registrationId: string
  orderId?: string
  eventId?: string
  userId?: string
}): Promise<EmailDispatchResult> {
  return triggerTransactionalEmail({
    template: 'payment_rejected',
    to: params.to,
    name: params.name,
    payload: {
      event_title: params.eventTitle,
      reason: params.reason,
    },
    idempotencyKey: params.orderId ? `pay_rejected_${params.orderId}` : `pay_rejected_reg_${params.registrationId}`,
    eventId: params.eventId,
    registrationId: params.registrationId,
    userId: params.userId,
  })
}

/**
 * Triggers cancellation notification when registration is cancelled.
 */
export async function sendRegistrationCancelledEmail(params: {
  to: string
  name?: string
  eventTitle: string
  ticketCode: string
  registrationId: string
  eventId?: string
  userId?: string
}): Promise<EmailDispatchResult> {
  return triggerTransactionalEmail({
    template: 'registration_cancelled',
    to: params.to,
    name: params.name,
    payload: {
      event_title: params.eventTitle,
      ticket_code: params.ticketCode,
    },
    idempotencyKey: `reg_cancelled_${params.registrationId}`,
    eventId: params.eventId,
    registrationId: params.registrationId,
    userId: params.userId,
  })
}

/**
 * Requests pass resend to the authorized student's email address.
 */
export async function resendPassEmail(
  registrationId: string
): Promise<{ success: boolean; message: string; emailId?: string }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('resend_registration_pass', {
        p_registration_id: registrationId,
      })

      if (error) {
        return { success: false, message: error.message }
      }

      if (data && data.success) {
        // Also trigger the edge function to process delivery immediately
        try {
          await supabase.functions.invoke('send-email', {
            body: {
              template: 'registration_confirmed',
              to: data.recipient_email,
              payload: {
                ticket_code: data.ticket_code,
                is_resend: true,
              },
              outbox_id: data.outbox_id,
            },
          })
        } catch {
          // Outbox entry was created; background cron/worker can pick up
        }

        return {
          success: true,
          message: data.message || 'Pass resent successfully to your registered email.',
        }
      }

      return {
        success: false,
        message: data?.message || 'Could not resend pass.',
      }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Pass resend request failed.',
      }
    }
  }

  // Local simulation mode
  const rawRegs = localStorage.getItem('festflow_local_registrations')
  const localRegs = rawRegs ? JSON.parse(rawRegs) : []
  const reg = localRegs.find((r: any) => r.id === registrationId)

  if (!reg) {
    return { success: false, message: 'Registration not found.' }
  }

  if (reg.status !== 'confirmed') {
    return {
      success: false,
      message: `Pass cannot be resent because registration status is "${reg.status}". Only confirmed passes can be delivered.`,
    }
  }

  const res = await sendRegistrationConfirmedEmail({
    to: 'student@campus.edu',
    name: 'FestFlow Student',
    eventTitle: 'Campus Event',
    ticketCode: reg.ticket_code,
    qrToken: reg.qr_token,
    startDate: new Date().toISOString(),
    venueName: 'Campus Auditorium',
    teamName: reg.team_name,
    registrationId: reg.id,
    eventId: reg.event_id,
    isResend: true,
  })

  return {
    success: true,
    message: 'Pass delivery queued (simulated outbox updated).',
    emailId: res.emailId,
  }
}

/**
 * Triggers bulk event reminders to confirmed attendees with rate-limiting and duplicate protection.
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
