import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type {
  CheckInRecord,
  CheckInStats,
  RegistrationWithCheckIn,
  RegistrationWithStudent,
} from '@/types'
import { getEventRegistrations } from '@/lib/registrations'
import { getEventById } from '@/lib/events'

const LOCAL_STORAGE_CHECKINS_KEY = 'festflow_local_checkins'

// ── Local Storage Helpers (Read-Only Historical Archive) ────────────────────
export function getLocalCheckIns(): CheckInRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CHECKINS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
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
  checkInsCount?: number
  checkIns?: CheckInRecord[]
}): CheckInStats {
  const { capacity, confirmedCount } = params
  const checkInsList = params.checkIns || []
  const totalScans = params.checkInsCount !== undefined ? params.checkInsCount : checkInsList.length

  const checkedInCount = checkInsList.filter((c) => c.status !== 'checked_out').length
  const checkedOutCount = checkInsList.filter((c) => c.status === 'checked_out').length
  const effectiveInside = params.checkIns ? checkedInCount : totalScans
  const notCheckedInCount = Math.max(0, confirmedCount - totalScans)
  const remainingExpected = notCheckedInCount
  const attendancePercentage =
    confirmedCount > 0 ? Math.round((effectiveInside / confirmedCount) * 100) : 0

  return {
    totalCapacity: capacity,
    confirmedRegistrations: confirmedCount,
    checkedInCount: effectiveInside,
    checkedOutCount,
    notCheckedInCount,
    successfulCheckIns: totalScans,
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
    const latestCheckIn = rCheckIns[0] || null

    let attendanceStatus: 'not_checked_in' | 'checked_in' | 'checked_out' | 'cancelled' | 'ineligible' = 'not_checked_in'
    if (r.status === 'cancelled') {
      attendanceStatus = 'cancelled'
    } else if (r.status === 'rejected' || r.status === 'pending_approval' || r.status === 'pending_payment') {
      attendanceStatus = 'ineligible'
    } else if (latestCheckIn) {
      attendanceStatus = latestCheckIn.status === 'checked_out' ? 'checked_out' : 'checked_in'
    } else {
      attendanceStatus = 'not_checked_in'
    }

    return {
      ...r,
      check_in: latestCheckIn,
      check_ins: rCheckIns,
      attendance_status: attendanceStatus,
    }
  })

  const confirmedCount = regs.filter((r) => r.status === 'confirmed').length
  const capacity = eventRes.event?.capacity || 100
  const stats = computeCheckInStats({
    capacity,
    confirmedCount,
    checkIns,
  })

  return {
    registrations: enriched,
    checkIns,
    stats,
  }
}
