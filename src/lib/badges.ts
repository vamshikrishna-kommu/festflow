import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getEventLifecyclePhase } from '@/lib/events'
import type { StudentBadgeRecord } from '@/types'

const LOCAL_STORAGE_KEY = 'festflow_local_student_badges'

export interface BadgeDefinition {
  key: string
  title: string
  description: string
  iconName: string
  category: 'attendance' | 'awards' | 'participation' | 'mastery'
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
  threshold: number
  evaluate: (stats: StudentStats) => { isUnlocked: boolean; progress: number; total: number }
}

export interface StudentStats {
  attendedCount: number
  totalRegistrations: number
  distinctClubsCount: number
  teamEventsCount: number
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    key: 'first_event_attended',
    title: 'First Step on Campus',
    description: 'Participated in your first campus event registered through FestFlow.',
    iconName: 'Ticket',
    category: 'attendance',
    tier: 'bronze',
    threshold: 1,
    evaluate: (s) => ({
      isUnlocked: s.attendedCount >= 1,
      progress: Math.min(s.attendedCount, 1),
      total: 1,
    }),
  },
  {
    key: 'active_participant',
    title: 'Active Explorer',
    description: 'Attended 3 verified campus events with confirmed FestFlow passes.',
    iconName: 'Zap',
    category: 'attendance',
    tier: 'bronze',
    threshold: 3,
    evaluate: (s) => ({
      isUnlocked: s.attendedCount >= 3,
      progress: Math.min(s.attendedCount, 3),
      total: 3,
    }),
  },
  {
    key: 'events_attended_5',
    title: 'Campus Regular',
    description: 'Attended 5 verified campus events across tech, cultural, or sports domains.',
    iconName: 'Compass',
    category: 'attendance',
    tier: 'silver',
    threshold: 5,
    evaluate: (s) => ({
      isUnlocked: s.attendedCount >= 5,
      progress: Math.min(s.attendedCount, 5),
      total: 5,
    }),
  },
  {
    key: 'events_attended_10',
    title: 'Campus Pioneer',
    description: 'Reached a remarkable milestone of 10 verified campus event attendances.',
    iconName: 'Award',
    category: 'attendance',
    tier: 'gold',
    threshold: 10,
    evaluate: (s) => ({
      isUnlocked: s.attendedCount >= 10,
      progress: Math.min(s.attendedCount, 10),
      total: 10,
    }),
  },
  {
    key: 'events_attended_25',
    title: 'Campus Legend',
    description: 'Attended 25+ campus events. An extraordinary pillar of student community engagement.',
    iconName: 'Crown',
    category: 'attendance',
    tier: 'diamond',
    threshold: 25,
    evaluate: (s) => ({
      isUnlocked: s.attendedCount >= 25,
      progress: Math.min(s.attendedCount, 25),
      total: 25,
    }),
  },
  {
    key: 'active_campus_explorer',
    title: 'Campus Explorer',
    description: 'Explored and registered for 3 or more campus events on FestFlow.',
    iconName: 'Compass',
    category: 'participation',
    tier: 'bronze',
    threshold: 3,
    evaluate: (s) => ({
      isUnlocked: s.totalRegistrations >= 3,
      progress: Math.min(s.totalRegistrations, 3),
      total: 3,
    }),
  },
  {
    key: 'dedicated_attendee',
    title: 'Dedicated Attendee',
    description: 'Participated in 3 or more completed or verified campus events.',
    iconName: 'Award',
    category: 'attendance',
    tier: 'silver',
    threshold: 3,
    evaluate: (s) => ({
      isUnlocked: s.attendedCount >= 3,
      progress: Math.min(s.attendedCount, 3),
      total: 3,
    }),
  },
  {
    key: 'consistent_participant',
    title: 'Universal Networker',
    description: 'Participated in events organized by at least 2 distinct student organizations.',
    iconName: 'Network',
    category: 'participation',
    tier: 'silver',
    threshold: 2,
    evaluate: (s) => ({
      isUnlocked: s.distinctClubsCount >= 2,
      progress: Math.min(s.distinctClubsCount, 2),
      total: 2,
    }),
  },
  {
    key: 'squad_champion',
    title: 'Squad Collaborator',
    description: 'Registered and competed as part of a collaborative squad or team roster.',
    iconName: 'Users',
    category: 'participation',
    tier: 'bronze',
    threshold: 1,
    evaluate: (s) => ({
      isUnlocked: s.teamEventsCount >= 1,
      progress: Math.min(s.teamEventsCount, 1),
      total: 1,
    }),
  },
]

function getLocalBadges(): StudentBadgeRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
}

function saveLocalBadges(badges: StudentBadgeRecord[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(badges))
  } catch {
    // ignore
  }
}

/**
 * Calculates current student stats from actual database records.
 * NEVER invents fake attendance or registration figures.
 */
export async function calculateStudentStats(studentId: string): Promise<StudentStats> {
  let attendedCount = 0
  let totalRegistrations = 0
  let distinctClubs = new Set<string>()
  let teamEventsCount = 0

  if (isSupabaseConfigured) {
    try {
      // 1. Query student's registrations with event lifecycle metadata
      const { data: regs } = await (supabase.from('registrations') as any)
        .select('id, event_id, status, team_id, team_name, events(club_id, status, start_date, end_date, timezone)')
        .eq('student_id', studentId)

      if (regs) {
        totalRegistrations = regs.length
        const attendedRegIds = new Set<string>()
        for (const r of regs) {
          if (r.team_id || r.team_name) teamEventsCount++
          if (r.events?.club_id) distinctClubs.add(r.events.club_id)
          if (r.status === 'confirmed' && r.events && getEventLifecyclePhase(r.events) === 'completed') {
            attendedRegIds.add(r.id)
          }
        }

        // Preserve historical check-in records without requiring live scanning
        const regIds = regs.map((r: any) => r.id)
        if (regIds.length > 0) {
          const { data: checkInRows } = await (supabase.from('check_ins') as any)
            .select('registration_id')
            .in('registration_id', regIds)
            .in('status', ['checked_in', 'checked_out'])

          for (const ci of checkInRows || []) {
            if (ci.registration_id) attendedRegIds.add(ci.registration_id)
          }
        }
        attendedCount = attendedRegIds.size
      }
    } catch {
      // ignore
    }
  } else {
    // Local / Simulation Mode
    try {
      const mockRegs = JSON.parse(localStorage.getItem('festflow_mock_registrations') || '[]')
      const userRegs = mockRegs.filter((r: any) => r.student_id === studentId || r.user_id === studentId)
      totalRegistrations = userRegs.length
      attendedCount = userRegs.filter(
        (r: any) =>
          r.attendance_status === 'checked_in' ||
          r.attendance_status === 'checked_out' ||
          (r.status === 'confirmed' && r.event && getEventLifecyclePhase(r.event) === 'completed')
      ).length
      for (const r of userRegs) {
        if (r.team_id || r.team_name) teamEventsCount++
        if (r.club_id || r.event?.club_id) distinctClubs.add(r.club_id || r.event.club_id)
      }
    } catch {
      // ignore
    }
  }

  return {
    attendedCount,
    totalRegistrations,
    distinctClubsCount: distinctClubs.size,
    teamEventsCount,
  }
}

/**
 * Evaluates and awards all earned badges for a student.
 * Recalculates dynamically and persists idempotently.
 */
export async function evaluateAndAwardStudentBadges(studentId: string): Promise<{
  badges: Array<BadgeDefinition & { isUnlocked: boolean; progress: number; total: number; earnedAt?: string; isPinned: boolean; isPublic: boolean }>
  newlyAwardedCount: number
}> {
  if (!studentId) return { badges: [], newlyAwardedCount: 0 }

  const stats = await calculateStudentStats(studentId)

  // Fetch already recorded badges from DB
  let existingBadgeMap = new Map<string, StudentBadgeRecord>()
  if (isSupabaseConfigured) {
    try {
      const { data } = await (supabase.from('student_badges') as any)
        .select('*')
        .eq('student_id', studentId)

      if (data) {
        for (const b of data) {
          existingBadgeMap.set(b.badge_key, b as StudentBadgeRecord)
        }
      }
    } catch {
      // ignore
    }
  } else {
    for (const b of getLocalBadges().filter((x) => x.student_id === studentId)) {
      existingBadgeMap.set(b.badge_key, b)
    }
  }

  let newlyAwardedCount = 0
  const combined = []

  for (const def of BADGE_DEFINITIONS) {
    const evalResult = def.evaluate(stats)
    const existing = existingBadgeMap.get(def.key)

    if (evalResult.isUnlocked && !existing) {
      // Award badge
      newlyAwardedCount++
      const now = new Date().toISOString()
      const newBadgeRecord: StudentBadgeRecord = {
        id: `bdg_${Date.now()}_${def.key}`,
        student_id: studentId,
        badge_key: def.key,
        title: def.title,
        description: def.description,
        icon_name: def.iconName,
        category: def.category,
        tier: def.tier,
        earned_at: now,
        is_pinned: false,
        is_public: true,
        created_at: now,
      }

      if (isSupabaseConfigured) {
        try {
          await (supabase.from('student_badges') as any)
            .insert(newBadgeRecord)
        } catch {
          // ignore
        }
      } else {
        const local = getLocalBadges()
        local.push(newBadgeRecord)
        saveLocalBadges(local)
      }

      combined.push({
        ...def,
        isUnlocked: true,
        progress: evalResult.total,
        total: evalResult.total,
        earnedAt: now,
        isPinned: false,
        isPublic: true,
      })
    } else {
      combined.push({
        ...def,
        isUnlocked: Boolean(existing) || evalResult.isUnlocked,
        progress: evalResult.progress,
        total: evalResult.total,
        earnedAt: existing?.earned_at,
        isPinned: existing?.is_pinned ?? false,
        isPublic: existing?.is_public ?? true,
      })
    }
  }

  return { badges: combined, newlyAwardedCount }
}

/**
 * Toggles badge pinned status on student profile.
 */
export async function toggleBadgePin(
  studentId: string,
  badgeKey: string,
  isPinned: boolean
): Promise<{ success: boolean }> {
  if (isSupabaseConfigured) {
    try {
      await (supabase.from('student_badges') as any)
        .update({ is_pinned: isPinned })
        .eq('student_id', studentId)
        .eq('badge_key', badgeKey)
      return { success: true }
    } catch {
      // ignore
    }
  }

  const local = getLocalBadges()
  const b = local.find((x) => x.student_id === studentId && x.badge_key === badgeKey)
  if (b) {
    b.is_pinned = isPinned
    saveLocalBadges(local)
  }
  return { success: true }
}

/**
 * Toggles badge public visibility on public profiles.
 */
export async function toggleBadgePrivacy(
  studentId: string,
  badgeKey: string,
  isPublic: boolean
): Promise<{ success: boolean }> {
  if (isSupabaseConfigured) {
    try {
      await (supabase.from('student_badges') as any)
        .update({ is_public: isPublic })
        .eq('student_id', studentId)
        .eq('badge_key', badgeKey)
      return { success: true }
    } catch {
      // ignore
    }
  }

  const local = getLocalBadges()
  const b = local.find((x) => x.student_id === studentId && x.badge_key === badgeKey)
  if (b) {
    b.is_public = isPublic
    saveLocalBadges(local)
  }
  return { success: true }
}

/**
 * Retrieves all stored badge records for a student.
 */
export async function getStudentBadges(studentId: string): Promise<StudentBadgeRecord[]> {
  if (!studentId) return []
  if (isSupabaseConfigured) {
    try {
      const { data } = await (supabase.from('student_badges') as any)
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
      if (data) return data as StudentBadgeRecord[]
    } catch {
      // ignore
    }
  }
  return getLocalBadges().filter((x) => x.student_id === studentId)
}

