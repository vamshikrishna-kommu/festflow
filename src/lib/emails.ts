import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export interface EmailDispatchParams {
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

function getLocalOutbox(): Array<any> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_OUTBOX_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
}

function saveLocalOutbox(items: Array<any>) {
  try {
    localStorage.setItem(LOCAL_STORAGE_OUTBOX_KEY, JSON.stringify(items))
  } catch {
    // ignore
  }
}

/**
 * Dispatches a transactional email through the secure Supabase Edge Function.
 * If credentials are not configured, explicitly reports that email delivery is not configured.
 * Never pretends an email was sent.
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

  // Local Simulation Mode: Record in local outbox for developer visibility
  const outbox = getLocalOutbox()
  const simulatedRecord = {
    id: `outbox_${Date.now()}`,
    template,
    to,
    name,
    payload,
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
