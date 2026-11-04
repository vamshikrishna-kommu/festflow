/**
 * src/lib/editRequests.ts
 *
 * Controlled Registration Details Edit Requests for FestFlow:
 * - Allows students to request corrections for non-sensitive fields:
 *   (student_name, phone, college, team_name)
 * - Prohibits unauthorized editing of sensitive fields (ticket tokens, payment status, ownership)
 * - Side-by-side diff tracking (previous_values vs proposed_changes)
 * - Club Organizer Review & Approval Workflow
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { RegistrationEditRequestRecord, RegistrationRecord } from '@/types'
import { broadcastStatusChange } from '@/lib/sync'

const LOCAL_STORAGE_EDIT_REQUESTS_KEY = 'festflow_local_edit_requests'
const LOCAL_STORAGE_REGISTRATIONS_KEY = 'festflow_local_registrations'

export function getLocalEditRequests(): RegistrationEditRequestRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_EDIT_REQUESTS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
}

export function saveLocalEditRequests(reqs: RegistrationEditRequestRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_EDIT_REQUESTS_KEY, JSON.stringify(reqs))
  } catch {
    // ignore
  }
}

// ── Submit Edit Request ──────────────────────────────────────────────────────
export async function requestRegistrationEdit(params: {
  registrationId: string
  proposedChanges: {
    student_name?: string
    phone?: string
    college?: string
    team_name?: string
  }
  reason: string
  studentId?: string
}): Promise<{
  success: boolean
  message: string
  requestId?: string
  error_code?: string
}> {
  const { registrationId, proposedChanges, reason } = params

  if (!reason || !reason.trim()) {
    return {
      success: false,
      error_code: 'INVALID_REASON',
      message: 'Please provide a reason explaining the requested change.',
    }
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('request_registration_edit', {
        p_registration_id: registrationId,
        p_proposed_changes: proposedChanges,
        p_reason: reason.trim(),
      })

      if (error) {
        return {
          success: false,
          error_code: 'RPC_ERROR',
          message: error.message,
        }
      }

      return data
    } catch (err: any) {
      return {
        success: false,
        error_code: 'NETWORK_ERROR',
        message: err?.message || 'Failed to submit edit request.',
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

  if (reg.status === 'cancelled' || reg.status === 'rejected') {
    return { success: false, error_code: 'INVALID_STATUS', message: 'Cannot edit a cancelled or rejected registration.' }
  }

  const previousValues: Record<string, any> = {
    student_name: reg.participant_details?.student_name || '',
    phone: reg.participant_details?.phone || '',
    college: reg.participant_details?.college_name || '',
    team_name: reg.team_name || '',
  }

  const requestId = `edit_req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const requests = getLocalEditRequests()

  const newRequest: RegistrationEditRequestRecord = {
    id: requestId,
    registration_id: reg.id,
    event_id: reg.event_id,
    student_id: reg.student_id,
    proposed_changes: proposedChanges,
    previous_values: previousValues,
    reason: reason.trim(),
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    decision_notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  requests.unshift(newRequest)
  saveLocalEditRequests(requests)

  broadcastStatusChange({
    type: 'registration_updated',
    registrationId,
    eventId: reg.event_id,
  })

  return {
    success: true,
    requestId,
    message: 'Edit request submitted for organizer review.',
  }
}

// ── Review Edit Request (Club Organizer) ────────────────────────────────────
export async function reviewRegistrationEdit(params: {
  requestId: string
  decision: 'approved' | 'rejected'
  decisionNotes?: string
  reviewerId?: string
}): Promise<{
  success: boolean
  message: string
  decision?: string
  error_code?: string
}> {
  const { requestId, decision, decisionNotes } = params

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('review_registration_edit', {
        p_request_id: requestId,
        p_decision: decision,
        p_decision_notes: decisionNotes || null,
      })

      if (error) {
        return {
          success: false,
          error_code: 'RPC_ERROR',
          message: error.message,
        }
      }

      return data
    } catch (err: any) {
      return {
        success: false,
        error_code: 'NETWORK_ERROR',
        message: err?.message || 'Failed to review edit request.',
      }
    }
  }

  // ── Simulation Mode ────────────────────────────────────────────────────────
  await new Promise((r) => setTimeout(r, 150))
  const requests = getLocalEditRequests()
  const req = requests.find((rq) => rq.id === requestId)

  if (!req) {
    return { success: false, error_code: 'NOT_FOUND', message: 'Edit request not found.' }
  }

  if (req.status !== 'pending') {
    return { success: false, error_code: 'ALREADY_REVIEWED', message: 'This edit request has already been reviewed.' }
  }

  const now = new Date().toISOString()
  req.status = decision
  req.reviewed_by = params.reviewerId || 'club_reviewer'
  req.reviewed_at = now
  req.decision_notes = decisionNotes || null
  req.updated_at = now
  saveLocalEditRequests(requests)

  if (decision === 'approved') {
    const rawRegs = localStorage.getItem(LOCAL_STORAGE_REGISTRATIONS_KEY)
    const localRegs: RegistrationRecord[] = rawRegs ? JSON.parse(rawRegs) : []
    const reg = localRegs.find((r) => r.id === req.registration_id)

    if (reg) {
      reg.participant_details = {
        ...reg.participant_details,
        ...(req.proposed_changes.student_name && { student_name: req.proposed_changes.student_name }),
        ...(req.proposed_changes.phone && { phone: req.proposed_changes.phone }),
        ...(req.proposed_changes.college && { college_name: req.proposed_changes.college }),
      }

      if (req.proposed_changes.team_name) {
        reg.team_name = req.proposed_changes.team_name
        try {
          const rawTeams = localStorage.getItem('festflow_local_teams')
          if (rawTeams && reg.team_id) {
            const teams = JSON.parse(rawTeams)
            const team = teams.find((t: any) => t.id === reg.team_id)
            if (team) {
              team.name = req.proposed_changes.team_name
              localStorage.setItem('festflow_local_teams', JSON.stringify(teams))
            }
          }
        } catch {
          // ignore
        }
      }

      reg.updated_at = now
      localStorage.setItem(LOCAL_STORAGE_REGISTRATIONS_KEY, JSON.stringify(localRegs))
    }
  }

  broadcastStatusChange({
    type: 'registration_updated',
    registrationId: req.registration_id,
    eventId: req.event_id,
  })

  return {
    success: true,
    decision,
    message: decision === 'approved'
      ? 'Edit request approved and registration updated.'
      : 'Edit request rejected.',
  }
}

// ── Query Edit Requests ──────────────────────────────────────────────────────
export async function getStudentEditRequests(
  studentId: string
): Promise<{ success: boolean; requests: RegistrationEditRequestRecord[] }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('registration_edit_requests')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        return { success: true, requests: data as RegistrationEditRequestRecord[] }
      }
    } catch {
      // fallback
    }
  }

  const requests = getLocalEditRequests().filter((rq) => rq.student_id === studentId)
  return { success: true, requests }
}

export async function getEventEditRequests(
  eventId: string
): Promise<{ success: boolean; requests: RegistrationEditRequestRecord[] }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('registration_edit_requests')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        return { success: true, requests: data as RegistrationEditRequestRecord[] }
      }
    } catch {
      // fallback
    }
  }

  const requests = getLocalEditRequests().filter((rq) => rq.event_id === eventId)
  return { success: true, requests }
}

