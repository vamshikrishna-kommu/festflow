import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { broadcastStatusChange } from '@/lib/sync'
import type { RegistrationRecord, RegistrationWithStudent } from '@/types'

const LOCAL_STORAGE_REG_KEY = 'festflow_local_registrations'

function getLocalRegistrations(): any[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_REG_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // fallback
  }
  return []
}

function saveLocalRegistrations(regs: any[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_REG_KEY, JSON.stringify(regs))
  } catch {
    // fallback
  }
}

/**
 * Get all waitlisted students for an event, ordered by waitlist position (FCFS)
 */
export async function getEventWaitlist(
  eventId: string
): Promise<{ waitlist: RegistrationWithStudent[]; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('registrations') as any)
        .select(`
          *,
          student:student_id (
            id,
            display_name,
            email,
            avatar_url
          )
        `)
        .eq('event_id', eventId)
        .eq('status', 'waitlisted')
        .order('created_at', { ascending: true })

      if (!error && data) {
        return { waitlist: data as RegistrationWithStudent[] }
      }
    } catch (e: any) {
      console.warn('[FestFlow Waitlist] Supabase query note:', e.message)
    }
  }

  const local = getLocalRegistrations().filter(
    (r) => r.event_id === eventId && r.status === 'waitlisted'
  )
  return { waitlist: local }
}

/**
 * Join event waitlist when capacity is full
 */
export async function joinEventWaitlist(params: {
  eventId: string
  studentId: string
  participantDetails?: Record<string, any>
  teamName?: string
}): Promise<{ registration?: RegistrationRecord; error?: string }> {
  const newReg: RegistrationRecord = {
    id: `reg_wl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    event_id: params.eventId,
    student_id: params.studentId,
    ticket_code: `WL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    qr_token: `QR_WL_${Math.random().toString(36).slice(2, 9)}`,
    status: 'waitlisted',
    team_name: params.teamName || null,
    team_role: null,
    team_id: null,
    team_members: null,
    custom_responses: null,
    participant_details: params.participantDetails || {},
    approval_status: 'approved',
    rejection_reason: null,
    ticket_issued_at: null,
    cancelled_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('registrations') as any)
        .insert({
          event_id: newReg.event_id,
          student_id: newReg.student_id,
          ticket_code: newReg.ticket_code,
          status: 'waitlisted',
          team_name: newReg.team_name,
          participant_details: newReg.participant_details,
        })
        .select()
        .single()

      if (!error && data) {
        broadcastStatusChange({
          type: 'registration_updated',
          eventId: params.eventId,
          registrationId: data.id,
        })
        return { registration: data }
      }
    } catch (e: any) {
      console.warn('[FestFlow Waitlist] Insert note, persisting locally:', e.message)
    }
  }

  const local = getLocalRegistrations()
  local.push(newReg)
  saveLocalRegistrations(local)

  broadcastStatusChange({
    type: 'registration_updated',
    eventId: params.eventId,
    registrationId: newReg.id,
  })

  return { registration: newReg }
}

/**
 * Promote a waitlisted attendee when a slot opens up
 */
export async function promoteWaitlistStudent(
  registrationId: string,
  isFreeEvent: boolean = true,
  offerHours: number = 24
): Promise<{ success: boolean; error?: string }> {
  const expiresAt = new Date(Date.now() + offerHours * 3600 * 1000).toISOString()
  const nextStatus = isFreeEvent ? 'confirmed' : 'pending_payment'

  if (isSupabaseConfigured) {
    try {
      const { error } = await (supabase.from('registrations') as any)
        .update({
          status: nextStatus,
          waitlist_offer_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', registrationId)

      if (!error) {
        broadcastStatusChange({
          type: 'registration_updated',
          registrationId,
        })
        return { success: true }
      }
    } catch (e: any) {
      console.warn('[FestFlow Waitlist] Promote note:', e.message)
    }
  }

  const local = getLocalRegistrations()
  const found = local.find((r) => r.id === registrationId)
  if (found) {
    found.status = nextStatus
    found.waitlist_offer_expires_at = expiresAt
    found.updated_at = new Date().toISOString()
    saveLocalRegistrations(local)
    broadcastStatusChange({
      type: 'registration_updated',
      registrationId,
    })
  }

  return { success: true }
}

/**
 * Automatically promote the earliest waitlisted attendees up to availableSlots
 */
export async function autoPromoteWaitlist(
  eventId: string,
  availableSlots: number,
  isFreeEvent: boolean = true
): Promise<{ promotedCount: number }> {
  if (availableSlots <= 0) return { promotedCount: 0 }

  const { waitlist } = await getEventWaitlist(eventId)
  const toPromote = waitlist.slice(0, availableSlots)
  let count = 0

  for (const reg of toPromote) {
    const res = await promoteWaitlistStudent(reg.id, isFreeEvent, 24)
    if (res.success) {
      count++
    }
  }

  return { promotedCount: count }
}

