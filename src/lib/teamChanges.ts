/**
 * src/lib/teamChanges.ts
 *
 * Controlled Team Member Change Request Architecture for FestFlow:
 * - Request to remove a team member
 * - Request to replace a team member
 * - Request to leave a team
 * - Request to change team leader
 * - Strict Club Organizer Review with Audit Trails
 * - Prevents stealth member modifications or unauthorized identity transfers
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { TeamChangeRequestRecord } from '@/types'
import { broadcastStatusChange } from '@/lib/sync'
import { getLocalTeamMembers, saveLocalTeamMembers } from '@/lib/teams'

const LOCAL_STORAGE_TEAM_CHANGES_KEY = 'festflow_local_team_changes'

export function getLocalTeamChanges(): TeamChangeRequestRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TEAM_CHANGES_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
}

export function saveLocalTeamChanges(reqs: TeamChangeRequestRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_TEAM_CHANGES_KEY, JSON.stringify(reqs))
  } catch {
    // ignore
  }
}

// ── Submit Team Change Request ──────────────────────────────────────────────
export async function requestTeamChange(params: {
  teamId: string
  eventId: string
  requestedBy: string
  requestType: 'remove_member' | 'replace_member' | 'leave_team' | 'change_leader'
  targetMemberId?: string
  targetEmail?: string
  replacementEmail?: string
  reason: string
}): Promise<{
  success: boolean
  message: string
  requestId?: string
  error_code?: string
}> {
  const { teamId, eventId, requestedBy, requestType, targetMemberId, targetEmail, replacementEmail, reason } = params

  if (!reason || !reason.trim()) {
    return { success: false, error_code: 'INVALID_REASON', message: 'Please specify the reason for the team change request.' }
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('team_change_requests' as any) as any)
        .insert({
          team_id: teamId,
          event_id: eventId,
          requested_by: requestedBy,
          request_type: requestType,
          target_member_id: targetMemberId || null,
          target_email: targetEmail || null,
          replacement_email: replacementEmail || null,
          reason: reason.trim(),
          status: 'pending',
        })
        .select()
        .single()

      if (error) {
        return { success: false, error_code: 'DB_ERROR', message: error.message }
      }

      return {
        success: true,
        requestId: data?.id,
        message: 'Team change request submitted for club review.',
      }
    } catch (err: any) {
      return { success: false, error_code: 'NETWORK_ERROR', message: err?.message || 'Failed to submit team change request.' }
    }
  }

  // ── Simulation Mode ────────────────────────────────────────────────────────
  await new Promise((r) => setTimeout(r, 150))
  const requestId = `tc_req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const changes = getLocalTeamChanges()

  const newReq: TeamChangeRequestRecord = {
    id: requestId,
    team_id: teamId,
    event_id: eventId,
    requested_by: requestedBy,
    request_type: requestType,
    target_member_id: targetMemberId || null,
    target_email: targetEmail || null,
    replacement_email: replacementEmail || null,
    reason: reason.trim(),
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    decision_notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  changes.unshift(newReq)
  saveLocalTeamChanges(changes)

  broadcastStatusChange({ type: 'team_updated', teamId })

  return {
    success: true,
    requestId,
    message: 'Team change request submitted for organizer review.',
  }
}

// ── Review Team Change Request (Club Organizer) ─────────────────────────────
export async function reviewTeamChange(params: {
  requestId: string
  decision: 'approved' | 'rejected'
  decisionNotes?: string
  reviewerId?: string
}): Promise<{
  success: boolean
  message: string
  error_code?: string
}> {
  const { requestId, decision, decisionNotes } = params

  if (isSupabaseConfigured) {
    try {
      const { data: reqRec, error: fetchErr } = await (supabase.from('team_change_requests' as any) as any)
        .select('*')
        .eq('id', requestId)
        .single()

      if (fetchErr || !reqRec) {
        return { success: false, error_code: 'NOT_FOUND', message: 'Team change request not found.' }
      }

      const { error: updateErr } = await (supabase.from('team_change_requests' as any) as any)
        .update({
          status: decision,
          reviewed_by: params.reviewerId,
          reviewed_at: new Date().toISOString(),
          decision_notes: decisionNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)

      if (updateErr) {
        return { success: false, error_code: 'UPDATE_FAILED', message: updateErr.message }
      }

      // If approved and request is to remove member, revoke their membership
      if (decision === 'approved' && reqRec.request_type === 'remove_member' && reqRec.target_member_id) {
        await (supabase.from('team_members' as any) as any)
          .update({ status: 'removed', updated_at: new Date().toISOString() })
          .eq('team_id', reqRec.team_id)
          .eq('user_id', reqRec.target_member_id)
      }

      broadcastStatusChange({ type: 'team_updated', teamId: reqRec.team_id })
      return { success: true, message: `Team change request ${decision}.` }
    } catch (err: any) {
      return { success: false, error_code: 'NETWORK_ERROR', message: err?.message || 'Review failed.' }
    }
  }

  // ── Simulation Mode ────────────────────────────────────────────────────────
  await new Promise((r) => setTimeout(r, 150))
  const changes = getLocalTeamChanges()
  const req = changes.find((c) => c.id === requestId)

  if (!req) {
    return { success: false, error_code: 'NOT_FOUND', message: 'Team change request not found.' }
  }

  req.status = decision
  req.reviewed_by = params.reviewerId || 'club_reviewer'
  req.reviewed_at = new Date().toISOString()
  req.decision_notes = decisionNotes || null
  req.updated_at = new Date().toISOString()
  saveLocalTeamChanges(changes)

  if (decision === 'approved' && (req.request_type === 'remove_member' || req.request_type === 'leave_team')) {
    const members = getLocalTeamMembers()
    const targetIdx = members.findIndex(
      (m) => m.team_id === req.team_id && (m.user_id === req.target_member_id || (req.target_email && m.email.toLowerCase() === req.target_email.toLowerCase()))
    )
    if (targetIdx >= 0) {
      members[targetIdx].status = 'removed'
      members[targetIdx].updated_at = new Date().toISOString()
      saveLocalTeamMembers(members)
    }
  }

  broadcastStatusChange({ type: 'team_updated', teamId: req.team_id })

  return {
    success: true,
    message: `Team change request ${decision}.`,
  }
}

// ── Query Team Changes ───────────────────────────────────────────────────────
export async function getTeamChangeRequests(
  teamId: string
): Promise<{ success: boolean; requests: TeamChangeRequestRecord[] }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('team_change_requests')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        return { success: true, requests: data as TeamChangeRequestRecord[] }
      }
    } catch {
      // fallback
    }
  }

  const requests = getLocalTeamChanges().filter((c) => c.team_id === teamId)
  return { success: true, requests }
}
