import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { EventAssignmentRecord, EventAssignmentRole } from '@/types'

const LOCAL_STORAGE_ASSIGNMENTS_KEY = 'festflow_local_event_assignments'

export const ASSIGNMENT_ROLE_LABELS: Record<EventAssignmentRole, string> = {
  event_manager: 'Event Manager',
  registration_manager: 'Registration Manager',
  finance_manager: 'Finance Manager',
  checkin_staff: 'Check-In Lead',
  content_manager: 'Content & Media Manager',
}

export const ASSIGNMENT_ROLE_DESCRIPTIONS: Record<EventAssignmentRole, string> = {
  event_manager: 'Oversees schedule, venue setup, and overall execution of this event.',
  registration_manager: 'Manages attendees, reviews custom application forms, and exports rosters.',
  finance_manager: 'Verifies UPI receipts, tracks ticket revenues, and manages event coupons.',
  checkin_staff: 'Directs gate operations, scans QR passes, and monitors live check-in turnstile.',
  content_manager: 'Designs the visual event detail page, uploads photos/speakers, and manages FAQs.',
}

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
 * Get all staff members assigned to an event
 */
export async function getEventAssignments(
  eventId: string
): Promise<{ assignments: EventAssignmentRecord[]; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('event_assignments') as any)
        .select(`
          *,
          user:user_id (
            id,
            display_name,
            email,
            avatar_url
          )
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })

      if (!error && data) {
        return { assignments: data as EventAssignmentRecord[] }
      }
    } catch (e: any) {
      console.warn('[FestFlow Assignments] Query note:', e.message)
    }
  }

  const local = getLocalAssignments().filter((a) => a.event_id === eventId)
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

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('event_assignments') as any)
        .insert({
          event_id: newRecord.event_id,
          club_id: newRecord.club_id,
          user_id: newRecord.user_id,
          role: newRecord.role,
          assigned_by: newRecord.assigned_by,
        })
        .select(`
          *,
          user:user_id (
            id,
            display_name,
            email,
            avatar_url
          )
        `)
        .single()

      if (!error && data) {
        return { assignment: data as EventAssignmentRecord }
      }
    } catch (e: any) {
      console.warn('[FestFlow Assignments] Insert note, persisting locally:', e.message)
    }
  }

  const local = getLocalAssignments()
  // Replace if existing for same (event, user, role)
  const existingIdx = local.findIndex(
    (a) => a.event_id === params.eventId && a.user_id === params.userId && a.role === params.role
  )
  if (existingIdx >= 0) {
    local[existingIdx] = newRecord
  } else {
    local.push(newRecord)
  }
  saveLocalAssignments(local)

  return { assignment: newRecord }
}

/**
 * Remove an event delegation assignment
 */
export async function removeEventAssignment(
  assignmentId: string
): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      await (supabase.from('event_assignments') as any).delete().eq('id', assignmentId)
    } catch (e: any) {
      console.warn('[FestFlow Assignments] Delete note:', e.message)
    }
  }

  const local = getLocalAssignments().filter((a) => a.id !== assignmentId)
  saveLocalAssignments(local)
  return { success: true }
}

