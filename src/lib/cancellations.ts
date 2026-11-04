/**
 * src/lib/cancellations.ts
 *
 * Registration Cancellation Request and Organizer Review Architecture for FestFlow:
 * - Controlled Student Cancellation Requests with Mandatory Reason Selection
 * - Duplicate Active Request Prevention
 * - Club Organizer Approval / Rejection Workflow with Decision Notes
 * - Independent Manual UPI Refund Tracking (Status, Amount, Transaction Ref)
 * - Cascading Ticket Invalidation on Approval (Blocking Gate Entry)
 * - Capacity Release and Real-Time State Synchronization
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type {
  RegistrationCancellationRequestRecord,
  CancellationReasonType,
  RefundStatus,
  RegistrationRecord,
} from '@/types'
import { broadcastStatusChange } from '@/lib/sync'
import { getEventById } from '@/lib/events'

const LOCAL_STORAGE_CANCELLATION_REQUESTS_KEY = 'festflow_local_cancellation_requests'
const LOCAL_STORAGE_REGISTRATIONS_KEY = 'festflow_local_registrations'

export function getLocalCancellationRequests(): RegistrationCancellationRequestRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CANCELLATION_REQUESTS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
}

export function saveLocalCancellationRequests(reqs: RegistrationCancellationRequestRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_CANCELLATION_REQUESTS_KEY, JSON.stringify(reqs))
  } catch {
    // ignore
  }
}

// ── Submit Cancellation Request (Student Workflow) ──────────────────────────
export async function requestRegistrationCancellation(params: {
  registrationId: string
  reason: CancellationReasonType | string
  explanation?: string
  studentId?: string
}): Promise<{
  success: boolean
  message: string
  requestId?: string
  error_code?: string
}> {
  const { registrationId, reason, explanation } = params

  if (!reason || !reason.trim()) {
    return {
      success: false,
      error_code: 'INVALID_REASON',
      message: 'Please select a reason for your cancellation request.',
    }
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('request_registration_cancellation', {
        p_registration_id: registrationId,
        p_reason: reason,
        p_explanation: explanation || null,
      })

      if (error) {
        return {
          success: false,
          error_code: 'RPC_ERROR',
          message: error.message,
        }
      }

      if (data && data.success) {
        broadcastStatusChange({
          type: 'registration_updated',
          registrationId,
        })
      }

      return data
    } catch (err: any) {
      return {
        success: false,
        error_code: 'NETWORK_ERROR',
        message: err?.message || 'Failed to submit cancellation request.',
      }
    }
  }

  // ── Simulation Mode ────────────────────────────────────────────────────────
  await new Promise((r) => setTimeout(r, 150))
  const rawRegs = localStorage.getItem(LOCAL_STORAGE_REGISTRATIONS_KEY)
  const localRegs: RegistrationRecord[] = rawRegs ? JSON.parse(rawRegs) : []
  const reg = localRegs.find((r) => r.id === registrationId)

  if (!reg) {
    return { success: false, error_code: 'NOT_FOUND', message: 'Registration not found.' }
  }

  if (reg.status === 'cancelled') {
    return { success: false, error_code: 'ALREADY_CANCELLED', message: 'This registration is already cancelled.' }
  }

  // Check checkin
  try {
    const rawCheckins = localStorage.getItem('festflow_local_checkins')
    if (rawCheckins) {
      const checkins = JSON.parse(rawCheckins)
      if (checkins.some((c: any) => c.registration_id === registrationId)) {
        return {
          success: false,
          error_code: 'ALREADY_CHECKED_IN',
          message: 'Cannot cancel a pass that has already been verified at entry.',
        }
      }
    }
  } catch {
    // ignore
  }

  // Check event start
  const eventRes = await getEventById(reg.event_id)
  if (eventRes.event && new Date(eventRes.event.start_date) <= new Date()) {
    return {
      success: false,
      error_code: 'EVENT_STARTED',
      message: 'Cancellation requests cannot be submitted after the event has started.',
    }
  }

  // Prevent duplicate active request
  const requests = getLocalCancellationRequests()
  const existing = requests.find((rq) => rq.registration_id === registrationId && rq.status === 'pending')
  if (existing) {
    return {
      success: false,
      error_code: 'REQUEST_EXISTS',
      message: 'A cancellation request is already pending review by the club organizer.',
    }
  }

  const isPaid = !eventRes.event?.is_free && (eventRes.event?.price ?? 0) > 0
  const requestId = `cancel_req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  const newRequest: RegistrationCancellationRequestRecord = {
    id: requestId,
    registration_id: reg.id,
    event_id: reg.event_id,
    student_id: reg.student_id,
    reason,
    explanation: explanation || null,
    status: 'pending',
    refund_applicable: isPaid,
    refund_status: isPaid ? 'refund_requested' : 'not_applicable',
    refund_amount: isPaid ? (eventRes.event?.price ?? 0) : 0,
    refund_notes: null,
    refund_transaction_ref: null,
    reviewed_by: null,
    reviewed_at: null,
    decision_notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  requests.unshift(newRequest)
  saveLocalCancellationRequests(requests)

  reg.cancellation_request_status = 'pending'
  reg.updated_at = new Date().toISOString()
  localStorage.setItem(LOCAL_STORAGE_REGISTRATIONS_KEY, JSON.stringify(localRegs))

  broadcastStatusChange({
    type: 'registration_updated',
    registrationId,
    eventId: reg.event_id,
  })

  return {
    success: true,
    requestId,
    message: 'Cancellation request submitted successfully. The club organizer will review your request.',
  }
}

// ── Review Cancellation Request (Club Organizer Workflow) ───────────────────
export async function reviewRegistrationCancellation(params: {
  requestId: string
  decision: 'approved' | 'rejected'
  decisionNotes?: string
  refundStatus?: RefundStatus
  refundAmount?: number
  refundTransactionRef?: string
  reviewerId?: string
}): Promise<{
  success: boolean
  message: string
  decision?: string
  error_code?: string
}> {
  const {
    requestId,
    decision,
    decisionNotes,
    refundStatus = 'not_applicable',
    refundAmount = 0,
    refundTransactionRef,
  } = params

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('review_registration_cancellation', {
        p_request_id: requestId,
        p_decision: decision,
        p_decision_notes: decisionNotes || null,
        p_refund_status: refundStatus,
        p_refund_amount: refundAmount,
        p_refund_ref: refundTransactionRef || null,
      })

      if (error) {
        return {
          success: false,
          error_code: 'RPC_ERROR',
          message: error.message,
        }
      }

      broadcastStatusChange({
        type: 'registration_updated',
        payload: { requestId, decision },
      })

      return data
    } catch (err: any) {
      return {
        success: false,
        error_code: 'NETWORK_ERROR',
        message: err?.message || 'Failed to review cancellation request.',
      }
    }
  }

  // ── Simulation Mode ────────────────────────────────────────────────────────
  await new Promise((r) => setTimeout(r, 150))
  const requests = getLocalCancellationRequests()
  const req = requests.find((rq) => rq.id === requestId)

  if (!req) {
    return { success: false, error_code: 'NOT_FOUND', message: 'Cancellation request not found.' }
  }

  if (req.status !== 'pending') {
    return { success: false, error_code: 'ALREADY_REVIEWED', message: 'This cancellation request has already been reviewed.' }
  }

  const now = new Date().toISOString()
  req.status = decision
  req.reviewed_by = params.reviewerId || 'club_reviewer'
  req.reviewed_at = now
  req.decision_notes = decisionNotes || null
  req.refund_status = refundStatus
  req.refund_amount = refundAmount
  req.refund_transaction_ref = refundTransactionRef || null
  req.updated_at = now
  saveLocalCancellationRequests(requests)

  const rawRegs = localStorage.getItem(LOCAL_STORAGE_REGISTRATIONS_KEY)
  const localRegs: RegistrationRecord[] = rawRegs ? JSON.parse(rawRegs) : []
  const reg = localRegs.find((r) => r.id === req.registration_id)

  if (reg) {
    if (decision === 'approved') {
      reg.status = 'cancelled'
      reg.cancellation_request_status = 'approved'
      reg.cancelled_at = now
      reg.refund_status = refundStatus
      reg.refund_amount = refundAmount
      reg.refund_transaction_ref = refundTransactionRef || null
      reg.updated_at = now

      // Invalidate ticket pass
      reg.ticket_issued_at = null

      // If team registration, update team_members record status to cancelled
      if (reg.team_id) {
        try {
          const rawMembers = localStorage.getItem('festflow_local_team_members')
          if (rawMembers) {
            const members = JSON.parse(rawMembers)
            for (const m of members) {
              if ((m.registration_id === reg.id || m.user_id === reg.student_id) && m.team_id === reg.team_id) {
                m.status = 'cancelled'
                m.updated_at = now
              }
            }
            localStorage.setItem('festflow_local_team_members', JSON.stringify(members))
          }
        } catch {
          // ignore
        }
      }
    } else {
      reg.cancellation_request_status = 'rejected'
      reg.updated_at = now
    }
    localStorage.setItem(LOCAL_STORAGE_REGISTRATIONS_KEY, JSON.stringify(localRegs))
  }

  broadcastStatusChange({
    type: 'registration_updated',
    registrationId: req.registration_id,
    eventId: req.event_id,
    payload: { requestId, decision },
  })

  return {
    success: true,
    decision,
    message: decision === 'approved'
      ? 'Cancellation approved. Pass has been cancelled.'
      : 'Cancellation rejected. Pass remains active.',
  }
}

// ── Query Cancellation Requests ──────────────────────────────────────────────
export async function getStudentCancellationRequests(
  studentId: string
): Promise<{ success: boolean; requests: RegistrationCancellationRequestRecord[] }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('registration_cancellation_requests')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        return { success: true, requests: data as RegistrationCancellationRequestRecord[] }
      }
    } catch {
      // fallback
    }
  }

  const requests = getLocalCancellationRequests().filter((rq) => rq.student_id === studentId)
  return { success: true, requests }
}

export async function getEventCancellationRequests(
  eventId: string
): Promise<{ success: boolean; requests: RegistrationCancellationRequestRecord[] }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('registration_cancellation_requests')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        return { success: true, requests: data as RegistrationCancellationRequestRecord[] }
      }
    } catch {
      // fallback
    }
  }

  const requests = getLocalCancellationRequests().filter((rq) => rq.event_id === eventId)
  return { success: true, requests }
}

