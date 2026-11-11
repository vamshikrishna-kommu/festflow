import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { EventAssignmentRecord, EventAssignmentRole } from '@/types'
import {
  ASSIGNABLE_EVENT_ASSIGNMENT_ROLES,
  ASSIGNMENT_ROLE_DESCRIPTIONS,
  ASSIGNMENT_ROLE_LABELS,
  isAssignableEventAssignmentRole,
} from '@/lib/rbac'
import { broadcastStatusChange } from '@/lib/sync'

export {
  ASSIGNABLE_EVENT_ASSIGNMENT_ROLES,
  ASSIGNMENT_ROLE_DESCRIPTIONS,
  ASSIGNMENT_ROLE_LABELS,
  isAssignableEventAssignmentRole,
}

const LOCAL_STORAGE_ASSIGNMENTS_KEY = 'festflow_local_event_assignments'

function getLocalAssignments(): EventAssignmentRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ASSIGNMENTS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // fallback
  }
  return []
}

function saveLocalAssignments(assignments: EventAssignmentRecord[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_ASSIGNMENTS_KEY, JSON.stringify(assignments))
  } catch {
    // fallback
  }
}

/**
 * Get all staff members assigned to a specific event
 */
export async function getEventAssignments(
  eventId: string
): Promise<{ assignments: EventAssignmentRecord[]; error?: string }> {
  if (!eventId) return { assignments: [] }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('event_assignments') as any)
        .select(
          `
          *,
          user:user_id (
            id,
            display_name,
            email,
            avatar_url
          )
        `
        )
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })

      if (error) {
        return { assignments: [], error: error.message }
      }
      return { assignments: (data as EventAssignmentRecord[]) || [] }
    } catch (e) {
      return {
        assignments: [],
        error: e instanceof Error ? e.message : 'Failed to load event assignments.',
      }
    }
  }

  const local = getLocalAssignments().filter((a) => a.event_id === eventId)
  return { assignments: local }
}

/**
 * Load all active event-scoped assignments for a user (optionally scoped to one club)
 */
export async function getUserEventAssignments(
  userId: string,
  clubId?: string | null
): Promise<{ assignments: EventAssignmentRecord[]; error?: string }> {
  if (!userId) return { assignments: [] }

  if (isSupabaseConfigured) {
    try {
      let query = (supabase.from('event_assignments') as any)
        .select('*')
        .eq('user_id', userId)

      if (clubId) {
        query = query.eq('club_id', clubId)
      }

      const { data, error } = await query
      if (error) {
        return { assignments: [], error: error.message }
      }
      return { assignments: (data as EventAssignmentRecord[]) || [] }
    } catch (e) {
      return {
        assignments: [],
        error: e instanceof Error ? e.message : 'Failed to load user event assignments.',
      }
    }
  }

  const local = getLocalAssignments().filter(
    (a) => a.user_id === userId && (!clubId || a.club_id === clubId)
  )
  return { assignments: local }
}

/**
 * Assign a club team member to a specific event responsibility
 */
export async function assignMemberToEvent(params: {
  eventId: string
  clubId: string
  userId: string
  role: EventAssignmentRole
  assignedBy: string
  userProfile?: { display_name?: string; email?: string }
}): Promise<{ assignment?: EventAssignmentRecord; error?: string }> {
  if (!params.eventId || !params.clubId || !params.userId || !params.assignedBy) {
    return { error: 'Missing required event assignment parameters.' }
  }

  if (!isAssignableEventAssignmentRole(params.role)) {
    return {
      error: `Role "${params.role}" is retired and cannot be used for new event delegations.`,
    }
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('event_assignments') as any)
        .insert({
          event_id: params.eventId,
          club_id: params.clubId,
          user_id: params.userId,
          role: params.role,
          assigned_by: params.assignedBy,
        })
        .select(
          `
          *,
          user:user_id (
            id,
            display_name,
            email,
            avatar_url
          )
        `
        )
        .single()

      if (error) {
        return { error: error.message }
      }

      broadcastStatusChange({
        type: 'team_updated',
        clubId: params.clubId,
        eventId: params.eventId,
      })

      return { assignment: data as EventAssignmentRecord }
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : 'Failed to assign member to event.',
      }
    }
  }

  const newRecord: EventAssignmentRecord = {
    id: `asg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    event_id: params.eventId,
    club_id: params.clubId,
    user_id: params.userId,
    role: params.role,
    assigned_by: params.assignedBy,
    created_at: new Date().toISOString(),
    user: params.userProfile
      ? {
          id: params.userId,
          display_name: params.userProfile.display_name || 'Team Member',
          email: params.userProfile.email || '',
          avatar_url: null,
          role: 'club_member',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      : null,
  }

  const local = getLocalAssignments()
  const existingIdx = local.findIndex(
    (a) =>
      a.event_id === params.eventId &&
      a.user_id === params.userId &&
      a.role === params.role
  )
  if (existingIdx >= 0) {
    local[existingIdx] = newRecord
  } else {
    local.push(newRecord)
  }
  saveLocalAssignments(local)

  broadcastStatusChange({
    type: 'team_updated',
    clubId: params.clubId,
    eventId: params.eventId,
  })

  return { assignment: newRecord }
}

/**
 * Remove an event delegation assignment
 */
export async function removeEventAssignment(
  assignmentId: string,
  clubId?: string
): Promise<{ success: boolean; error?: string }> {
  if (!assignmentId) {
    return { success: false, error: 'Missing assignment identifier.' }
  }

  if (isSupabaseConfigured) {
    try {
      let query = (supabase.from('event_assignments') as any)
        .delete()
        .eq('id', assignmentId)
      if (clubId) {
        query = query.eq('club_id', clubId)
      }
      const { error } = await query
      if (error) {
        return { success: false, error: error.message }
      }

      broadcastStatusChange({
        type: 'team_updated',
        clubId,
      })

      return { success: true }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Failed to remove event assignment.',
      }
    }
  }

  const local = getLocalAssignments().filter((a) => a.id !== assignmentId)
  saveLocalAssignments(local)
  broadcastStatusChange({
    type: 'team_updated',
    clubId,
  })
  return { success: true }
}
