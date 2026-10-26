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

  // 1. Try parsing JSON string if payload was encoded as JSON
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    try {
      const parsed = JSON.parse(cleaned)
      if (parsed.qr_token) return cleanTicketPayload(String(parsed.qr_token))
      if (parsed.token) return cleanTicketPayload(String(parsed.token))
      if (parsed.ticket_code) return cleanTicketPayload(String(parsed.ticket_code))
      if (parsed.code) return cleanTicketPayload(String(parsed.code))
    } catch {
      // not valid JSON, proceed with string parsing
    }
  }

  // 2. Strip URI prefixes
  const lower = cleaned.toLowerCase()
  if (lower.startsWith('festflow://pass/')) {
    cleaned = cleaned.substring(16)
  } else if (lower.startsWith('festflow://ticket/')) {
    cleaned = cleaned.substring(18)
  } else if (lower.includes('/pass/')) {
    cleaned = cleaned.substring(lower.indexOf('/pass/') + 6)
  } else if (lower.includes('/ticket/')) {
    cleaned = cleaned.substring(lower.indexOf('/ticket/') + 8)
  }

  // 3. Extract query param if full URL passed (e.g. ?token=FFQ_123 or ?code=TKT-123)
  if (cleaned.includes('?')) {
    try {
      const queryStr = cleaned.substring(cleaned.indexOf('?') + 1)
      const params = new URLSearchParams(queryStr)
      const paramVal = params.get('token') || params.get('code') || params.get('qr') || params.get('t')
      if (paramVal) {
        cleaned = paramVal
      } else {
        // Strip query string from path
        cleaned = cleaned.substring(0, cleaned.indexOf('?'))
      }
    } catch {
      cleaned = cleaned.substring(0, cleaned.indexOf('?'))
    }
  }

  // 4. Strip trailing slashes
  cleaned = cleaned.replace(/\/+$/, '')

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
      member_index: 0,
      member_name: null,
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

// In-memory mutex for local simulation concurrency serialization (mirrors Postgres FOR UPDATE)
const activeSimulationLocks = new Set<string>()

// ── Check-In RPC / Client Call ───────────────────────────────────────────────
export async function checkInTicket(
  eventId: string,
  ticketCodeOrPayload: string,
  notes?: string
): Promise<CheckInResponse> {
  const cleanCode = cleanTicketPayload(ticketCodeOrPayload)

  if (!cleanCode || cleanCode.length < 3) {
    return {
      success: false,
      outcome: 'INVALID_TICKET',
      message: 'Invalid ticket reference. Please provide a valid ticket code or pass QR.',
    }
  }

  if (isSupabaseConfigured) {
    try {
      // Check offline network state if running in browser
      if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) {
        return {
          success: false,
          outcome: 'UNAUTHORIZED',
          isNetworkError: true,
          message: 'Network offline. Please verify internet connection and retry.',
        }
      }

      const { data, error } = await (supabase.rpc as any)('check_in_ticket', {
        p_event_id: eventId,
        p_ticket_code_or_payload: cleanCode,
        p_notes: notes || null,
      })

      if (error) {
        const errMsg = error.message || ''
        const isNetwork =
          errMsg.toLowerCase().includes('failed to fetch') ||
          errMsg.toLowerCase().includes('network') ||
          errMsg.toLowerCase().includes('timeout')
        return {
          success: false,
          outcome: 'UNAUTHORIZED',
          isNetworkError: isNetwork,
          message: isNetwork
            ? 'Network connectivity issue. Please check your connection and retry.'
            : errMsg,
        }
      }

      const res = data as CheckInResponse
      triggerScanFeedback(res.outcome)
      return res
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Check-in request failed.'
      const isNetwork =
        msg.toLowerCase().includes('failed to fetch') ||
        msg.toLowerCase().includes('network') ||
        msg.toLowerCase().includes('timeout')
      return {
        success: false,
        outcome: 'UNAUTHORIZED',
        isNetworkError: isNetwork,
        message: isNetwork
          ? 'Network connectivity issue. Please check your connection and retry.'
          : msg,
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

  // Detect member sub-token suffix (e.g., "-M1", "-M2")
  let memberIndex = 0
  let baseCode = cleanCode
  const memberMatch = cleanCode.match(/(-M[0-9]+)$/i)
  if (memberMatch) {
    memberIndex = parseInt(memberMatch[1].substring(2), 10)
    baseCode = cleanCode.substring(0, cleanCode.length - memberMatch[1].length)
  }

  // Concurrency serialization lock (mirrors PostgreSQL FOR UPDATE lock on registration row)
  const lockKey = `${eventId}_${baseCode}_${memberIndex}`
  while (activeSimulationLocks.has(lockKey)) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  activeSimulationLocks.add(lockKey)

  try {
    // Fetch event details to check if cancelled
    const eventRes = await getEventById(eventId)
    if (eventRes.event && eventRes.event.status === 'cancelled') {
      const res: CheckInResponse = {
        success: false,
        outcome: 'CANCELLED',
        ticket_code: cleanCode,
        message: 'This event has been cancelled by organizers. Gate entry is closed.',
      }
      triggerScanFeedback(res.outcome)
      return res
    }

    // Find registration by ticket code or qr_token
    const reg = localRegs.find((r: any) => {
      const tCode = (r.ticket_code || '').toUpperCase()
      const qToken = (r.qr_token || '').toUpperCase()
      return (
        tCode === baseCode ||
        qToken === baseCode ||
        tCode === cleanCode ||
        qToken === cleanCode
      )
    })

    if (!reg) {
      const res: CheckInResponse = {
        success: false,
        outcome: 'INVALID_TICKET',
        ticket_code: cleanCode,
        message: 'No registration was found matching this pass token.',
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
        message: 'This ticket belongs to a different event.',
      }
      triggerScanFeedback(res.outcome)
      return res
    }

    // Resolve attendee / member display name
    let memberName: string | undefined = undefined
    if (memberIndex > 0 && Array.isArray(reg.team_members) && reg.team_members.length >= memberIndex) {
      const memberObj = reg.team_members[memberIndex - 1]
      memberName = memberObj?.name || `Team Member #${memberIndex}`
    }

    const primaryName =
      reg.student?.display_name ||
      (reg.team_name ? `Team ${reg.team_name}` : 'Student Attendee')

    // Check status & eligibility
    if (reg.status === 'cancelled') {
      const res: CheckInResponse = {
        success: false,
        outcome: 'CANCELLED',
        student_name: memberName || primaryName,
        ticket_code: cleanCode,
        message: 'This registration has been cancelled. This pass is void for entry.',
      }
      triggerScanFeedback(res.outcome)
      return res
    }

    if (reg.status === 'rejected') {
      const res: CheckInResponse = {
        success: false,
        outcome: 'CANCELLED',
        student_name: memberName || primaryName,
        ticket_code: cleanCode,
        message: 'Registration was declined by organizers. Pass is invalid.',
      }
      triggerScanFeedback(res.outcome)
      return res
    }

    if (reg.status === 'pending_approval') {
      const res: CheckInResponse = {
        success: false,
        outcome: 'NOT_CONFIRMED',
        student_name: memberName || primaryName,
        ticket_code: cleanCode,
        message: 'Application under review. Pass has not been approved for admission yet.',
      }
      triggerScanFeedback(res.outcome)
      return res
    }

    if (reg.status === 'pending_payment') {
      const res: CheckInResponse = {
        success: false,
        outcome: 'NOT_CONFIRMED',
        student_name: memberName || primaryName,
        ticket_code: cleanCode,
        message: 'Payment verification pending. Attendee ticket fee must be verified before entry is permitted.',
      }
      triggerScanFeedback(res.outcome)
      return res
    }

    if (reg.status === 'waitlisted') {
      const res: CheckInResponse = {
        success: false,
        outcome: 'NOT_CONFIRMED',
        student_name: memberName || primaryName,
        ticket_code: cleanCode,
        message: 'Registration is on the waitlist. Pass is not confirmed for admission.',
      }
      triggerScanFeedback(res.outcome)
      return res
    }

    if (reg.status !== 'confirmed') {
      const res: CheckInResponse = {
        success: false,
        outcome: 'NOT_CONFIRMED',
        student_name: memberName || primaryName,
        ticket_code: cleanCode,
        message: `Registration status is "${reg.status}". Attendee pass is not confirmed.`,
      }
      triggerScanFeedback(res.outcome)
      return res
    }

    // Read fresh check-ins from storage inside the mutex
    const allCheckins = getLocalCheckIns()

    // Check already used for this specific member index
    const existing = allCheckins.find(
      (c) => c.registration_id === reg.id && ((c as any).member_index || 0) === memberIndex
    )
    if (existing) {
      const res: CheckInResponse = {
        success: false,
        outcome: 'ALREADY_USED',
        student_name: memberName || primaryName,
        ticket_code: cleanCode,
        member_index: memberIndex,
        checked_in_at: existing.checked_in_at,
        message: memberName
          ? `Team member (${memberName}) was already checked in.`
          : `Ticket was already checked in at ${new Date(existing.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
      }
      triggerScanFeedback(res.outcome)
      return res
    }

    // Insert successful check-in
    const now = new Date().toISOString()
    const newCheckIn: CheckInRecord = {
      id: `chk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      registration_id: reg.id,
      event_id: eventId,
      ticket_code: reg.ticket_code || cleanCode,
      staff_id: 'demo_club_member_default',
      checked_in_at: now,
      checkin_notes: notes || null,
      member_index: memberIndex,
      member_name: memberName || null,
      created_at: now,
    }

    allCheckins.unshift(newCheckIn)
    saveLocalCheckIns(allCheckins)

    const res: CheckInResponse = {
      success: true,
      outcome: 'VALID',
      student_name: memberName || primaryName,
      team_name: reg.team_name || undefined,
      member_index: memberIndex,
      member_name: memberName,
      ticket_code: reg.ticket_code || cleanCode,
      checked_in_at: now,
      event_title: eventRes.event?.title || 'Campus Event',
      message: memberName
        ? `Team member ${memberName} checked in successfully!`
        : reg.team_name
        ? `Team ${reg.team_name} pass verified! Entry granted.`
        : 'Entry granted! Ticket verified successfully.',
    }

    triggerScanFeedback(res.outcome)
    return res
  } finally {
    activeSimulationLocks.delete(lockKey)
  }
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

  // Map all check-ins by registration_id
  const checkInMap = new Map<string, CheckInRecord[]>()
  checkIns.forEach((c) => {
    const list = checkInMap.get(c.registration_id) || []
    list.push(c)
    checkInMap.set(c.registration_id, list)
  })

  const regs = (regRes.registrations || []) as RegistrationWithStudent[]
  const enriched: RegistrationWithCheckIn[] = regs.map((r) => {
    const rCheckIns = checkInMap.get(r.id) || []
    return {
      ...r,
      check_in: rCheckIns[0] || null,
      check_ins: rCheckIns,
    }
  })

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
