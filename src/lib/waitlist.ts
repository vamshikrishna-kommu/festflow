import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { broadcastStatusChange } from '@/lib/sync'
import { generateSecureQrToken, hashQrTokenSync } from '@/lib/qrCrypto'
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
          id,
          event_id,
          student_id,
          ticket_code,
          status,
          team_name,
          team_id,
          team_members,
          participant_details,
          approval_status,
          waitlist_offer_expires_at,
          created_at,
          updated_at,
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
  const qrToken = generateSecureQrToken()
  const newReg: RegistrationRecord = {
    id: `reg_wl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    event_id: params.eventId,
    student_id: params.studentId,
    ticket_code: `WL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    qr_token: qrToken,
    qr_token_hash: hashQrTokenSync(qrToken),
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
 * Offer an available slot to a waitlisted student with an expiration window
 */
export async function offerWaitlistSlot(params: {
  registrationId: string
  expiresHours?: number
}): Promise<{ success: boolean; message: string; offerExpiresAt?: string; error_code?: string }> {
  const { registrationId, expiresHours = 24 } = params

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('offer_waitlist_slot', {
        p_registration_id: registrationId,
        p_expires_hours: expiresHours,
      })

      if (error) {
        return { success: false, error_code: 'RPC_ERROR', message: error.message }
      }

      broadcastStatusChange({ type: 'registration_updated', registrationId })
      return data
    } catch (err: any) {
      return { success: false, error_code: 'NETWORK_ERROR', message: err?.message || 'Failed to offer waitlist slot.' }
    }
  }

  // Simulation Mode
  const local = getLocalRegistrations()
  const reg = local.find((r) => r.id === registrationId)
  if (!reg) return { success: false, error_code: 'NOT_FOUND', message: 'Registration not found.' }
  if (reg.status !== 'waitlisted') {
    return { success: false, error_code: 'NOT_WAITLISTED', message: 'Registration is not currently waitlisted.' }
  }

  const expiresAt = new Date(Date.now() + expiresHours * 3600000).toISOString()
  reg.waitlist_offered_at = new Date().toISOString()
  reg.waitlist_offer_expires_at = expiresAt
  reg.updated_at = new Date().toISOString()
  saveLocalRegistrations(local)

  broadcastStatusChange({ type: 'registration_updated', registrationId })

  return {
    success: true,
    offerExpiresAt: expiresAt,
    message: `Slot offered to student. Offer expires in ${expiresHours} hours.`,
  }
}

/**
 * Student accepts/claims an active waitlist offer
 */
export async function claimWaitlistOffer(
  registrationId: string
): Promise<{ success: boolean; status?: string; message: string; error_code?: string }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('claim_waitlist_offer', {
        p_registration_id: registrationId,
      })

      if (error) {
        return { success: false, error_code: 'RPC_ERROR', message: error.message }
      }

      broadcastStatusChange({ type: 'registration_updated', registrationId })
      return data
    } catch (err: any) {
      return { success: false, error_code: 'NETWORK_ERROR', message: err?.message || 'Failed to claim offer.' }
    }
  }

  // Simulation Mode
  const local = getLocalRegistrations()
  const reg = local.find((r) => r.id === registrationId)
  if (!reg) return { success: false, error_code: 'NOT_FOUND', message: 'Registration not found.' }
  if (reg.status !== 'waitlisted') {
    return { success: false, error_code: 'NOT_WAITLISTED', message: 'Registration is not currently waitlisted.' }
  }
  if (!reg.waitlist_offer_expires_at) {
    return { success: false, error_code: 'NO_ACTIVE_OFFER', message: 'No active offer found for this registration.' }
  }
  if (new Date(reg.waitlist_offer_expires_at) < new Date()) {
    return { success: false, error_code: 'OFFER_EXPIRED', message: 'This waitlist offer has expired.' }
  }

  reg.status = 'confirmed'
  reg.waitlist_offered_at = null
  reg.waitlist_offer_expires_at = null
  reg.ticket_issued_at = new Date().toISOString()
  reg.updated_at = new Date().toISOString()
  saveLocalRegistrations(local)

  broadcastStatusChange({ type: 'registration_updated', registrationId })

  return {
    success: true,
    status: 'confirmed',
    message: 'Offer accepted! Your pass is confirmed.',
  }
}

/**
 * Student declines a waitlist offer
 */
export async function declineWaitlistOffer(
  registrationId: string
): Promise<{ success: boolean; message: string }> {
  const local = getLocalRegistrations()
  const reg = local.find((r) => r.id === registrationId)
  if (reg) {
    reg.status = 'cancelled'
    reg.waitlist_offered_at = null
    reg.waitlist_offer_expires_at = null
    reg.cancelled_at = new Date().toISOString()
    reg.updated_at = new Date().toISOString()
    saveLocalRegistrations(local)
    broadcastStatusChange({ type: 'registration_updated', registrationId })
  }
  return { success: true, message: 'Waitlist offer declined.' }
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

