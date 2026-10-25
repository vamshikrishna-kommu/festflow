import { supabase, isSupabaseConfigured, isProduction } from '@/lib/supabase'
import type {
  CheckInRecord,
  CheckInResponse,
  CheckInOutcome,
  CheckInStats,
  RegistrationWithCheckIn,
  RegistrationWithStudent,
} from '@/types'
import { getEventRegistrations } from '@/lib/registrations'
import { getEventById } from '@/lib/events'

const LOCAL_STORAGE_CHECKINS_KEY = 'festflow_local_checkins'

// ── Clean & Extract Ticket Code ─────────────────────────────────────────────
export function cleanTicketPayload(raw: string): string {
  if (!raw) return ''
  let cleaned = raw.trim()
  if (cleaned.toLowerCase().startsWith('festflow://ticket/')) {
    cleaned = cleaned.substring(18)
  } else if (cleaned.includes('/ticket/')) {
    cleaned = cleaned.substring(cleaned.indexOf('/ticket/') + 8)
  }
  return cleaned.trim().toUpperCase()
}

// ── Scan Feedback (Haptic + Web Audio Synth) ─────────────────────────────────
export function triggerScanFeedback(outcome: CheckInOutcome) {
  // 1. Haptic feedback if supported
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (outcome === 'VALID') {
        navigator.vibrate([60, 40, 60])
      } else if (outcome === 'ALREADY_USED') {
        navigator.vibrate([100, 50, 100])
      } else {
        navigator.vibrate([150, 60, 150, 60, 150])
      }
    } catch {
      // ignore
    }
  }

  // 2. Audio feedback using Web Audio API synthesis (no external mp3 files needed)
  if (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new AudioCtx()

      if (outcome === 'VALID') {
        // High dual-tone success chime
        const now = ctx.currentTime
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        const gain = ctx.createGain()

        osc1.type = 'sine'
        osc2.type = 'sine'
        osc1.frequency.setValueAtTime(587.33, now) // D5
        osc2.frequency.setValueAtTime(880, now + 0.08) // A5

        gain.gain.setValueAtTime(0.12, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)

        osc1.connect(gain)
        osc2.connect(gain)
        gain.connect(ctx.destination)

        osc1.start(now)
        osc1.stop(now + 0.08)
        osc2.start(now + 0.08)
        osc2.stop(now + 0.25)
      } else {
        // Low double buzz for warning / invalid
        const now = ctx.currentTime
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(180, now)

        gain.gain.setValueAtTime(0.15, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(now)
        osc.stop(now + 0.28)
      }
    } catch {
      // Audio autoplay policy or background suppression
    }
  }
}

// ── Local Storage Helpers ───────────────────────────────────────────────────
function getLocalCheckIns(): CheckInRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CHECKINS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return [
    {
      id: 'chk_sample_1',
      registration_id: 'reg_sample_1',
      event_id: 'evt_sample_1',
      ticket_code: 'TKT-INNOVATE-2026',
      staff_id: 'demo_club_member_default',
      checked_in_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      checkin_notes: 'Gate 1 scan',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
  ]
}

function saveLocalCheckIns(checkins: CheckInRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_CHECKINS_KEY, JSON.stringify(checkins))
  } catch {
    // ignore
  }
}

// ── Check-In RPC / Client Call ───────────────────────────────────────────────
export async function checkInTicket(
  eventId: string,
  ticketCodeOrPayload: string,
  notes?: string
): Promise<CheckInResponse> {
  const cleanCode = cleanTicketPayload(ticketCodeOrPayload)

  if (!cleanCode || cleanCode.length < 4) {
    return {
      success: false,
      outcome: 'INVALID_TICKET',
      message: 'Invalid ticket reference. Please enter a valid ticket code.',
    }
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('check_in_ticket', {
        p_event_id: eventId,
        p_ticket_code_or_payload: cleanCode,
        p_notes: notes || null,
      })

      if (error) {
        return {
          success: false,
          outcome: 'UNAUTHORIZED',
          message: error.message,
        }
      }

      const res = data as CheckInResponse
      triggerScanFeedback(res.outcome)
      return res
    } catch (err) {
      return {
        success: false,
        outcome: 'UNAUTHORIZED',
        message: err instanceof Error ? err.message : 'Check-in request failed.',
      }
    }
  }

  // In production, block mock check-in authorization
  if (isProduction) {
    return {
      success: false,
      outcome: 'UNAUTHORIZED',
      message: 'Production Security Safeguard: Live Supabase database connection required. Event entry cannot be authorized in simulation mode.',
    }
  }

  // ── Local Fallback Simulation Mode (Development only) ─────────────────────
  const rawRegs = localStorage.getItem('festflow_local_registrations')
  const localRegs = rawRegs ? JSON.parse(rawRegs) : []
  const allCheckins = getLocalCheckIns()

  // Find registration by ticket code
  const reg = localRegs.find(
    (r: any) => (r.ticket_code || '').toUpperCase() === cleanCode
  )

  if (!reg) {
    const res: CheckInResponse = {
      success: false,
      outcome: 'INVALID_TICKET',
      ticket_code: cleanCode,
      message: 'No registration was found matching this ticket code.',
    }
    triggerScanFeedback(res.outcome)
    return res
  }

  // Check event match
  if (reg.event_id !== eventId) {
    const res: CheckInResponse = {
      success: false,
      outcome: 'WRONG_EVENT',
      ticket_code: cleanCode,
      message: 'This ticket was issued for a different event.',
    }
    triggerScanFeedback(res.outcome)
    return res
  }

  // Check status
  if (reg.status === 'cancelled') {
    const res: CheckInResponse = {
      success: false,
      outcome: 'CANCELLED',
      student_name: 'Campus Student',
      ticket_code: cleanCode,
      message: 'This registration has been cancelled and is void for entry.',
    }
    triggerScanFeedback(res.outcome)
    return res
  }

  if (reg.status !== 'confirmed') {
    const res: CheckInResponse = {
      success: false,
      outcome: 'NOT_CONFIRMED',
      student_name: 'Campus Student',
      ticket_code: cleanCode,
      message: `Registration status is "${reg.status}". Payment must be verified before entry is permitted.`,
    }
    triggerScanFeedback(res.outcome)
    return res
  }

  // Check already used
  const existing = allCheckins.find((c) => c.registration_id === reg.id)
  if (existing) {
    const res: CheckInResponse = {
      success: false,
      outcome: 'ALREADY_USED',
      student_name: 'Campus Student',
      ticket_code: cleanCode,
      checked_in_at: existing.checked_in_at,
      message: `Ticket was already checked in at ${new Date(
        existing.checked_in_at
      ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
    }
    triggerScanFeedback(res.outcome)
    return res
  }

  // Insert successful check-in
  const now = new Date().toISOString()
  const newCheckIn: CheckInRecord = {
    id: `chk_${Date.now()}`,
    registration_id: reg.id,
    event_id: eventId,
    ticket_code: cleanCode,
    staff_id: 'demo_club_member_default',
    checked_in_at: now,
    checkin_notes: notes || null,
    created_at: now,
  }

  allCheckins.unshift(newCheckIn)
  saveLocalCheckIns(allCheckins)

  const eventRes = await getEventById(eventId)

  const res: CheckInResponse = {
    success: true,
    outcome: 'VALID',
    student_name: 'Priya Sharma',
    ticket_code: cleanCode,
    checked_in_at: now,
    event_title: eventRes.event?.title || 'Campus Event',
    message: 'Entry granted! Ticket verified successfully.',
  }

  triggerScanFeedback(res.outcome)
  return res
}

// ── Query Event Check-Ins ───────────────────────────────────────────────────
export async function getEventCheckIns(eventId: string): Promise<CheckInRecord[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('check_ins')
        .select('*')
        .eq('event_id', eventId)
        .order('checked_in_at', { ascending: false })

      if (error) {
        console.warn('Error fetching event check-ins:', error.message)
        return []
      }
      return (data || []) as CheckInRecord[]
    } catch (err) {
      console.warn('Check-ins query exception:', err)
      return []
    }
  }

  const checkins = getLocalCheckIns()
  return checkins.filter((c) => c.event_id === eventId)
}

// ── Compute Event Check-In Statistics ───────────────────────────────────────
export function computeCheckInStats(params: {
  capacity: number
  confirmedCount: number
  checkInsCount: number
}): CheckInStats {
  const { capacity, confirmedCount, checkInsCount } = params
  const remainingExpected = Math.max(0, confirmedCount - checkInsCount)
  const attendancePercentage =
    confirmedCount > 0 ? Math.round((checkInsCount / confirmedCount) * 100) : 0

  return {
    totalCapacity: capacity,
    confirmedRegistrations: confirmedCount,
    successfulCheckIns: checkInsCount,
    remainingExpected,
    attendancePercentage,
  }
}

// ── Query Event Registrations With Check-In Status ──────────────────────────
export async function getEventRegistrationsWithCheckIn(
  eventId: string
): Promise<{
  registrations: RegistrationWithCheckIn[]
  checkIns: CheckInRecord[]
  stats: CheckInStats
}> {
  const [regRes, eventRes, checkIns] = await Promise.all([
    getEventRegistrations(eventId),
    getEventById(eventId),
    getEventCheckIns(eventId),
  ])

  const checkInMap = new Map<string, CheckInRecord>()
  checkIns.forEach((c) => checkInMap.set(c.registration_id, c))

  const regs = (regRes.registrations || []) as RegistrationWithStudent[]
  const enriched: RegistrationWithCheckIn[] = regs.map((r) => ({
    ...r,
    check_in: checkInMap.get(r.id) || null,
  }))

  const confirmedCount = regs.filter((r) => r.status === 'confirmed').length
  const capacity = eventRes.event?.capacity || 100
  const stats = computeCheckInStats({
    capacity,
    confirmedCount,
    checkInsCount: checkIns.length,
  })

  return {
    registrations: enriched,
    checkIns,
    stats,
  }
}
