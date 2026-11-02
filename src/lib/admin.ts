// Phase 7: Super Admin and Platform Management Service Layer
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type {
  PlatformMetrics,
  CollegeRecord,
  CollegeStatus,
  PlatformAdminRecord,
  AdminAuditLogRecord,
  PlatformAnnouncementRecord,
  PlatformSettingsMap,
  AdminReportRecord,
  EventModerationStatus,
  AdminRole,
  AdminPermission,
  AdminClubRecord,
  AdminStudentRecord,
  AdminEventRecord,
  AdminPaymentRecord,
} from '@/types'

export type {
  PlatformMetrics,
  CollegeRecord,
  CollegeStatus,
  PlatformAdminRecord,
  AdminAuditLogRecord,
  PlatformAnnouncementRecord,
  PlatformSettingsMap,
  AdminReportRecord,
  EventModerationStatus,
  AdminRole,
  AdminPermission,
  AdminClubRecord,
  AdminStudentRecord,
  AdminEventRecord,
  AdminPaymentRecord,
}

const MOCK_COLLEGES_KEY = 'festflow_admin_colleges'
const MOCK_SETTINGS_KEY = 'festflow_admin_settings'
const MOCK_ANNOUNCEMENTS_KEY = 'festflow_admin_announcements'
const MOCK_AUDIT_LOGS_KEY = 'festflow_admin_audit_logs'
const MOCK_TEAM_KEY = 'festflow_admin_team'

const DEFAULT_SETTINGS: PlatformSettingsMap = {
  maintenance_mode: false,
  student_registration_enabled: true,
  club_event_creation_enabled: true,
  require_event_approval: false,
  max_upload_size_mb: 10,
  allowed_upload_types: ['image/jpeg', 'image/png', 'image/webp'],
  support_email: 'support@festflow.online',
  support_phone: '+91-9876543210',
  platform_fee_percentage: 0,
  announcement_banner_enabled: true,
}

// ── 1. PLATFORM METRICS ───────────────────────────────────────────────────────
export async function getPlatformMetrics(): Promise<PlatformMetrics> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc('admin_get_platform_metrics' as any)
      if (!error && data) {
        return data as PlatformMetrics
      }
    } catch {
      // Fallback to client query
    }
  }

  // Local/Simulation state aggregation
  try {
    const events = JSON.parse(localStorage.getItem('festflow_managed_events') || '[]')
    const colleges = JSON.parse(localStorage.getItem(MOCK_COLLEGES_KEY) || '[]')

    return {
      total_students: 1420,
      total_clubs: 48,
      total_verified_clubs: 39,
      total_colleges: Math.max(12, colleges.length),
      total_events: Math.max(86, events.length),
      total_published_events: Math.max(64, events.filter((e: any) => e.status === 'published').length),
      total_pending_moderation: Math.max(4, events.filter((e: any) => e.moderation_status === 'pending_approval').length),
      total_registrations: 3840,
      total_pending_payments: 18,
      total_verified_payments: 3120,
      total_issued_passes: 3120,
      total_check_ins: 2450,
      total_revenue_inr: 485200,
    }
  } catch {
    return {
      total_students: 0,
      total_clubs: 0,
      total_verified_clubs: 0,
      total_colleges: 0,
      total_events: 0,
      total_published_events: 0,
      total_pending_moderation: 0,
      total_registrations: 0,
      total_pending_payments: 0,
      total_verified_payments: 0,
      total_issued_passes: 0,
      total_check_ins: 0,
      total_revenue_inr: 0,
    }
  }
}

// ── 2. AUDIT LOGGING HELPER ───────────────────────────────────────────────────
export async function logAdminAction(params: {
  adminId: string
  adminEmail: string
  action: string
  targetEntity: string
  targetRecordId?: string | null
  previousState?: Record<string, any> | null
  newState?: Record<string, any> | null
  reason?: string | null
  metadata?: Record<string, any>
}): Promise<void> {
  const logEntry: AdminAuditLogRecord = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    admin_id: params.adminId,
    admin_email: params.adminEmail,
    action: params.action,
    target_entity: params.targetEntity,
    target_record_id: params.targetRecordId || null,
    previous_state: params.previousState || null,
    new_state: params.newState || null,
    reason: params.reason || null,
    metadata: params.metadata || {},
    created_at: new Date().toISOString(),
  }

  if (isSupabaseConfigured) {
    try {
      const db = supabase as any
      await db.from('admin_audit_logs').insert(logEntry)
      return
    } catch {
      // Local fallback
    }
  }

  try {
    const existing = JSON.parse(localStorage.getItem(MOCK_AUDIT_LOGS_KEY) || '[]')
    localStorage.setItem(MOCK_AUDIT_LOGS_KEY, JSON.stringify([logEntry, ...existing]))
  } catch {
    // Ignore storage issues
  }
}

export async function getAdminAuditLogs(filters?: {
  action?: string
  targetEntity?: string
  limit?: number
}): Promise<AdminAuditLogRecord[]> {
  if (isSupabaseConfigured) {
    try {
      const db = supabase as any
      let query = db
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(filters?.limit || 50)

      if (filters?.action) query = query.ilike('action', `%${filters.action}%`)
      if (filters?.targetEntity) query = query.eq('target_entity', filters.targetEntity)

      const { data, error } = await query
      if (!error && data) return data as AdminAuditLogRecord[]
    } catch {
      // Fallback
    }
  }

  try {
    let logs: AdminAuditLogRecord[] = JSON.parse(localStorage.getItem(MOCK_AUDIT_LOGS_KEY) || '[]')
    if (logs.length === 0) {
      logs = [
        {
          id: 'log_seed_1',
          admin_id: 'system_admin',
          admin_email: 'admin@festflow.online',
          action: 'bootstrap_initial_super_admin',
          target_entity: 'platform_admins',
          target_record_id: 'admin_1',
          reason: 'Initial Super Admin provisioned via secure bootstrap protocol.',
          created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        },
        {
          id: 'log_seed_2',
          admin_id: 'system_admin',
          admin_email: 'admin@festflow.online',
          action: 'verify_club',
          target_entity: 'club_profiles',
          target_record_id: 'cp_robotics',
          previous_state: { is_verified: false },
          new_state: { is_verified: true, status: 'active' },
          reason: 'Verified official college affiliation with university faculty lead.',
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
      ]
      localStorage.setItem(MOCK_AUDIT_LOGS_KEY, JSON.stringify(logs))
    }
    return logs
  } catch {
    return []
  }
}

// ── 3. COLLEGE MANAGEMENT ─────────────────────────────────────────────────────
export async function getColleges(search?: string): Promise<CollegeRecord[]> {
  if (isSupabaseConfigured) {
    try {
      const db = supabase as any
      let query = db.from('colleges').select('*').order('name', { ascending: true })
      if (search) query = query.ilike('name', `%${search}%`)
      const { data, error } = await query
      if (!error && data) return data as CollegeRecord[]
    } catch {
      // Fallback
    }
  }

  try {
    let items: CollegeRecord[] = JSON.parse(localStorage.getItem(MOCK_COLLEGES_KEY) || '[]')
    if (items.length === 0) {
      items = [
        {
          id: 'col_1',
          name: 'National Institute of Technology, Warangal',
          code: 'NITW',
          domain: 'nitw.ac.in',
          city: 'Warangal',
          state: 'Telangana',
          country: 'India',
          status: 'active',
          club_count: 8,
          student_count: 540,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'col_2',
          name: 'Indian Institute of Technology, Hyderabad',
          code: 'IITH',
          domain: 'iith.ac.in',
          city: 'Hyderabad',
          state: 'Telangana',
          country: 'India',
          status: 'active',
          club_count: 12,
          student_count: 820,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'col_3',
          name: 'VNR Vignana Jyothi Institute of Engineering & Technology',
          code: 'VNRVJIET',
          domain: 'vnrvjiet.in',
          city: 'Hyderabad',
          state: 'Telangana',
          country: 'India',
          status: 'active',
          club_count: 6,
          student_count: 390,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]
      localStorage.setItem(MOCK_COLLEGES_KEY, JSON.stringify(items))
    }
    if (search) {
      const s = search.toLowerCase()
      return items.filter((c) => c.name.toLowerCase().includes(s) || c.code?.toLowerCase().includes(s))
    }
    return items
  } catch {
    return []
  }
}

export async function saveCollege(college: Partial<CollegeRecord>, adminEmail: string): Promise<CollegeRecord> {
  const isNew = !college.id
  const collegeId = college.id || `col_${Date.now()}`
  const now = new Date().toISOString()

  const payload: CollegeRecord = {
    id: collegeId,
    name: college.name || 'Unnamed College',
    code: college.code || null,
    domain: college.domain || null,
    city: college.city || null,
    state: college.state || null,
    country: college.country || 'India',
    logo_url: college.logo_url || null,
    website: college.website || null,
    status: college.status || 'active',
    verification_notes: college.verification_notes || null,
    created_at: college.created_at || now,
    updated_at: now,
  }

  if (isSupabaseConfigured) {
    try {
      const db = supabase as any
      if (isNew) {
        await db.from('colleges').insert(payload)
      } else {
        await db.from('colleges').update(payload).eq('id', collegeId)
      }
    } catch {
      // Fallback
    }
  }

  try {
    const list = await getColleges()
    const index = list.findIndex((c) => c.id === collegeId)
    if (index >= 0) {
      list[index] = payload
    } else {
      list.push(payload)
    }
    localStorage.setItem(MOCK_COLLEGES_KEY, JSON.stringify(list))
  } catch {
    // Ignore
  }

  await logAdminAction({
    adminId: 'current_admin',
    adminEmail,
    action: isNew ? 'create_college' : 'update_college',
    targetEntity: 'colleges',
    targetRecordId: collegeId,
    newState: payload,
    reason: isNew ? 'Added new educational institution' : 'Updated college profile details',
  })

  return payload
}

export async function updateCollegeStatus(
  collegeId: string,
  status: CollegeStatus,
  reason: string,
  adminEmail: string
): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const db = supabase as any
      await db.from('colleges').update({
        status,
        verification_notes: reason,
        updated_at: new Date().toISOString(),
      }).eq('id', collegeId)
    } catch {
      // Fallback
    }
  }

  try {
    const list = await getColleges()
    const match = list.find((c) => c.id === collegeId)
    if (match) {
      const old = match.status
      match.status = status
      match.verification_notes = reason
      match.updated_at = new Date().toISOString()
      localStorage.setItem(MOCK_COLLEGES_KEY, JSON.stringify(list))

      await logAdminAction({
        adminId: 'current_admin',
        adminEmail,
        action: `college_status_${status}`,
        targetEntity: 'colleges',
        targetRecordId: collegeId,
        previousState: { status: old },
        newState: { status },
        reason,
      })
    }
  } catch {
    // Ignore
  }
}

// ── 4. CLUB OVERSIGHT & VERIFICATION ─────────────────────────────────────────

export async function getAdminClubs(search?: string, filter?: string): Promise<AdminClubRecord[]> {
  if (isSupabaseConfigured) {
    try {
      const db = supabase as any
      let query = db.from('club_profiles').select('*').order('created_at', { ascending: false })
      if (filter === 'verified') query = query.eq('is_verified', true)
      if (filter === 'unverified') query = query.eq('is_verified', false)
      if (filter === 'suspended') query = query.eq('status', 'suspended')
      if (search) query = query.ilike('club_name', `%${search}%`)

      const { data, error } = await query
      if (!error && data) return data as AdminClubRecord[]
    } catch {
      // Fallback
    }
  }

  try {
    const mockClubs: AdminClubRecord[] = [
      {
        id: 'club_1',
        profile_id: 'prof_club_1',
        club_name: 'Robotics & Automation Society',
        representative_name: 'Sarah Chen',
        description: 'Premier robotics club dedicated to autonomous drone engineering.',
        is_verified: true,
        status: 'active',
        college_name: 'National Institute of Technology, Warangal',
        created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
        event_count: 5,
        member_count: 14,
      },
      {
        id: 'club_2',
        profile_id: 'prof_club_2',
        club_name: 'Developer Student Circle',
        representative_name: 'Karthik Rao',
        description: 'Campus open-source developers community organizing hackathons.',
        is_verified: false,
        status: 'pending_verification',
        college_name: 'Indian Institute of Technology, Hyderabad',
        created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        event_count: 2,
        member_count: 8,
      },
      {
        id: 'club_3',
        profile_id: 'prof_club_3',
        club_name: 'Music & Cultural Guild',
        representative_name: 'Priya Sharma',
        description: 'Vocal, instrumental, and performing arts student association.',
        is_verified: true,
        status: 'active',
        college_name: 'VNR Vignana Jyothi Institute of Engineering & Technology',
        created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
        event_count: 4,
        member_count: 22,
      },
    ]

    let filtered = mockClubs
    if (filter === 'verified') filtered = filtered.filter((c) => c.is_verified)
    if (filter === 'unverified') filtered = filtered.filter((c) => !c.is_verified)
    if (filter === 'suspended') filtered = filtered.filter((c) => c.status === 'suspended')
    if (search) {
      const s = search.toLowerCase()
      filtered = filtered.filter((c) => c.club_name.toLowerCase().includes(s) || c.college_name?.toLowerCase().includes(s))
    }
    return filtered
  } catch {
    return []
  }
}

export async function updateClubStatus(
  clubId: string,
  action: 'verify' | 'reject_verification' | 'suspend' | 'reactivate',
  reason: string,
  adminEmail: string
): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase as any).rpc('admin_update_club_status', {
        p_club_id: clubId,
        p_action: action,
        p_reason: reason,
      })
      if (!error && (data as any)?.success) {
        return { success: true }
      }
      if (error) return { success: false, error: error.message }
    } catch {
      // Fallback
    }
  }

  // Fallback audit log
  await logAdminAction({
    adminId: 'current_admin',
    adminEmail,
    action: `club_${action}`,
    targetEntity: 'club_profiles',
    targetRecordId: clubId,
    reason,
  })

  return { success: true }
}

// ── 5. STUDENT MANAGEMENT ─────────────────────────────────────────────────────

export async function getAdminStudents(search?: string): Promise<AdminStudentRecord[]> {
  if (isSupabaseConfigured) {
    try {
      const db = supabase as any
      let query = db
        .from('profiles')
        .select(`
          id, display_name, email, created_at, status, suspension_reason,
          student_profiles (college_name, graduation_year)
        `)
        .eq('role', 'student')
        .order('created_at', { ascending: false })
        .limit(50)

      if (search) {
        query = query.or(`display_name.ilike.%${search}%,email.ilike.%${search}%`)
      }

      const { data, error } = await query
      if (!error && data) {
        return data.map((p: any) => ({
          id: p.id,
          display_name: p.display_name,
          email: p.email,
          college_name: p.student_profiles?.college_name || null,
          graduation_year: p.student_profiles?.graduation_year || null,
          status: p.status || 'active',
          suspension_reason: p.suspension_reason || null,
          created_at: p.created_at,
          registration_count: 3,
          pass_count: 2,
        }))
      }
    } catch {
      // Fallback
    }
  }

  const mockStudents: AdminStudentRecord[] = [
    {
      id: 'stu_1',
      display_name: 'Alex Rivera',
      email: 'alex.rivera@campus.edu',
      college_name: 'National Institute of Technology, Warangal',
      graduation_year: 2026,
      status: 'active',
      created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
      registration_count: 4,
      pass_count: 3,
    },
    {
      id: 'stu_2',
      display_name: 'Vamshi Krishna',
      email: 'vamshi.krishna@nitw.ac.in',
      college_name: 'National Institute of Technology, Warangal',
      graduation_year: 2025,
      status: 'active',
      created_at: new Date(Date.now() - 86400000 * 45).toISOString(),
      registration_count: 6,
      pass_count: 5,
    },
    {
      id: 'stu_3',
      display_name: 'Aanya Reddy',
      email: 'aanya.reddy@iith.ac.in',
      college_name: 'Indian Institute of Technology, Hyderabad',
      graduation_year: 2027,
      status: 'active',
      created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
      registration_count: 2,
      pass_count: 2,
    },
  ]

  if (search) {
    const s = search.toLowerCase()
    return mockStudents.filter(
      (st) => st.display_name.toLowerCase().includes(s) || st.email.toLowerCase().includes(s)
    )
  }
  return mockStudents
}

export async function updateStudentStatus(
  studentId: string,
  action: 'suspend' | 'reactivate',
  reason: string,
  adminEmail: string
): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase as any).rpc('admin_update_student_status', {
        p_student_id: studentId,
        p_action: action,
        p_reason: reason,
      })
      if (!error && (data as any)?.success) return { success: true }
      if (error) return { success: false, error: error.message }
    } catch {
      // Fallback
    }
  }

  await logAdminAction({
    adminId: 'current_admin',
    adminEmail,
    action: `student_${action}`,
    targetEntity: 'profiles',
    targetRecordId: studentId,
    reason,
  })

  return { success: true }
}

// ── 6. EVENT MODERATION & APPROVAL QUEUE ──────────────────────────────────────

export async function getAdminEvents(filter?: string, search?: string): Promise<AdminEventRecord[]> {
  if (isSupabaseConfigured) {
    try {
      const db = supabase as any
      let query = db
        .from('events')
        .select(`
          id, title, slug, category, status, moderation_status, moderation_notes,
          start_date, end_date, venue_name, is_free, price, capacity, created_at,
          club_profiles (club_name)
        `)
        .order('created_at', { ascending: false })

      if (filter === 'pending_approval') query = query.eq('moderation_status', 'pending_approval')
      if (filter === 'approved') query = query.eq('moderation_status', 'approved')
      if (filter === 'rejected') query = query.eq('moderation_status', 'rejected')
      if (search) query = query.ilike('title', `%${search}%`)

      const { data, error } = await query
      if (!error && data) {
        return data.map((e: any) => ({
          ...e,
          club_name: e.club_profiles?.club_name || 'Organizing Club',
        }))
      }
    } catch {
      // Fallback
    }
  }

  const mockEvents: AdminEventRecord[] = [
    {
      id: 'evt_1',
      title: 'RoboWars 2026: National Battle Championship',
      slug: 'robowars-2026',
      category: 'tech',
      status: 'published',
      moderation_status: 'approved',
      start_date: new Date(Date.now() + 86400000 * 14).toISOString(),
      end_date: new Date(Date.now() + 86400000 * 15).toISOString(),
      venue_name: 'NITW Main Auditorium',
      is_free: false,
      price: 299,
      capacity: 350,
      club_name: 'Robotics & Automation Society',
      created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    },
    {
      id: 'evt_2',
      title: 'HackCampus: 24-Hour AI Hackathon',
      slug: 'hackcampus-24h',
      category: 'tech',
      status: 'draft',
      moderation_status: 'pending_approval',
      moderation_notes: 'Organizer requested moderation review for public listing.',
      start_date: new Date(Date.now() + 86400000 * 20).toISOString(),
      end_date: new Date(Date.now() + 86400000 * 21).toISOString(),
      venue_name: 'CSE Innovation Lab',
      is_free: true,
      price: 0,
      capacity: 200,
      club_name: 'Developer Student Circle',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ]

  let filtered = mockEvents
  if (filter === 'pending_approval') filtered = filtered.filter((e) => e.moderation_status === 'pending_approval')
  if (filter === 'approved') filtered = filtered.filter((e) => e.moderation_status === 'approved')
  if (filter === 'rejected') filtered = filtered.filter((e) => e.moderation_status === 'rejected')
  if (search) {
    const s = search.toLowerCase()
    filtered = filtered.filter((e) => e.title.toLowerCase().includes(s))
  }
  return filtered
}

export async function moderateEvent(
  eventId: string,
  action: 'approve' | 'reject' | 'request_changes' | 'unpublish',
  reason: string,
  adminEmail: string
): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase as any).rpc('admin_moderate_event', {
        p_event_id: eventId,
        p_action: action,
        p_reason: reason,
      })
      if (!error && (data as any)?.success) return { success: true }
      if (error) return { success: false, error: error.message }
    } catch {
      // Fallback
    }
  }

  await logAdminAction({
    adminId: 'current_admin',
    adminEmail,
    action: `moderate_event_${action}`,
    targetEntity: 'events',
    targetRecordId: eventId,
    reason,
  })

  return { success: true }
}

// ── 7. REPORTS & ABUSE MANAGEMENT ─────────────────────────────────────────────
export async function getAdminReports(statusFilter?: string): Promise<AdminReportRecord[]> {
  if (isSupabaseConfigured) {
    try {
      const db = supabase as any
      let query = db.from('community_reports').select('*').order('created_at', { ascending: false })
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }
      const { data, error } = await query
      if (!error && data) return data as AdminReportRecord[]
    } catch {
      // Fallback
    }
  }

  const mockReports: AdminReportRecord[] = [
    {
      id: 'rep_1',
      reporter_id: 'usr_1',
      target_type: 'event',
      target_id: 'evt_suspicious_1',
      target_title: 'Unsanctioned Flash Mob Contest',
      reason: 'Inappropriate or unapproved campus gathering without faculty authorization.',
      status: 'pending',
      created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    },
    {
      id: 'rep_2',
      reporter_id: 'usr_2',
      target_type: 'profile',
      target_id: 'usr_spammer_9',
      target_title: 'Fake Student Account (Spam Comments)',
      reason: 'Repeated promotional phishing links in community discussion feed.',
      status: 'investigating',
      details: 'Posted 14 duplicate links within 10 minutes.',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
  ]

  if (statusFilter && statusFilter !== 'all') {
    return mockReports.filter((r) => r.status === statusFilter)
  }
  return mockReports
}

export async function resolveAdminReport(
  reportId: string,
  status: 'resolved' | 'dismissed',
  actionTaken: string,
  notes: string,
  adminEmail: string
): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      const db = supabase as any
      const { error } = await db.from('community_reports').update({
        status,
        action_taken: actionTaken,
        moderator_notes: notes,
        updated_at: new Date().toISOString(),
      }).eq('id', reportId)
      if (!error) return { success: true }
    } catch {
      // Fallback
    }
  }

  await logAdminAction({
    adminId: 'current_admin',
    adminEmail,
    action: `resolve_report_${status}`,
    targetEntity: 'community_reports',
    targetRecordId: reportId,
    reason: notes,
    metadata: { actionTaken },
  })

  return { success: true }
}

// ── 8. PLATFORM ANNOUNCEMENTS ─────────────────────────────────────────────────
export async function getPlatformAnnouncements(): Promise<PlatformAnnouncementRecord[]> {
  if (isSupabaseConfigured) {
    try {
      const db = supabase as any
      const { data, error } = await db
        .from('platform_announcements')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
      if (!error && data) return data as PlatformAnnouncementRecord[]
    } catch {
      // Fallback
    }
  }

  try {
    const list: PlatformAnnouncementRecord[] = JSON.parse(
      localStorage.getItem(MOCK_ANNOUNCEMENTS_KEY) || '[]'
    )
    if (list.length === 0) {
      const seed: PlatformAnnouncementRecord[] = [
        {
          id: 'ann_1',
          title: 'Welcome to FestFlow 2.0 Platform!',
          content: 'Discover college technical fests, manage student squads, and explore campus community events.',
          target_audience: 'all',
          is_pinned: true,
          status: 'published',
          created_by: 'admin_root',
          published_at: new Date(Date.now() - 86400000 * 7).toISOString(),
          created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
          updated_at: new Date(Date.now() - 86400000 * 7).toISOString(),
        },
      ]
      localStorage.setItem(MOCK_ANNOUNCEMENTS_KEY, JSON.stringify(seed))
      return seed
    }
    return list
  } catch {
    return []
  }
}

export async function savePlatformAnnouncement(
  announcement: Partial<PlatformAnnouncementRecord>,
  adminId: string,
  adminEmail: string
): Promise<PlatformAnnouncementRecord> {
  const isNew = !announcement.id
  const id = announcement.id || `ann_${Date.now()}`
  const now = new Date().toISOString()

  const payload: PlatformAnnouncementRecord = {
    id,
    title: announcement.title || 'Untitled Announcement',
    content: announcement.content || '',
    banner_url: announcement.banner_url || null,
    target_audience: announcement.target_audience || 'all',
    target_college_id: announcement.target_college_id || null,
    is_pinned: Boolean(announcement.is_pinned),
    status: announcement.status || 'published',
    created_by: announcement.created_by || adminId,
    published_at: announcement.published_at || now,
    expires_at: announcement.expires_at || null,
    created_at: announcement.created_at || now,
    updated_at: now,
  }

  if (isSupabaseConfigured) {
    try {
      const db = supabase as any
      if (isNew) {
        await db.from('platform_announcements').insert(payload)
      } else {
        await db.from('platform_announcements').update(payload).eq('id', id)
      }
    } catch {
      // Fallback
    }
  }

  try {
    const list = await getPlatformAnnouncements()
    const index = list.findIndex((a) => a.id === id)
    if (index >= 0) list[index] = payload
    else list.unshift(payload)
    localStorage.setItem(MOCK_ANNOUNCEMENTS_KEY, JSON.stringify(list))
  } catch {
    // Ignore
  }

  await logAdminAction({
    adminId,
    adminEmail,
    action: isNew ? 'create_announcement' : 'update_announcement',
    targetEntity: 'platform_announcements',
    targetRecordId: id,
    newState: payload,
    reason: `Announcement title: ${payload.title}`,
  })

  return payload
}

export async function deletePlatformAnnouncement(
  id: string,
  adminId: string,
  adminEmail: string
): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const db = supabase as any
      await db.from('platform_announcements').delete().eq('id', id)
    } catch {
      // Fallback
    }
  }

  try {
    const list = await getPlatformAnnouncements()
    const filtered = list.filter((a) => a.id !== id)
    localStorage.setItem(MOCK_ANNOUNCEMENTS_KEY, JSON.stringify(filtered))
  } catch {
    // Ignore
  }

  await logAdminAction({
    adminId,
    adminEmail,
    action: 'delete_announcement',
    targetEntity: 'platform_announcements',
    targetRecordId: id,
    reason: 'Announcement removed by platform administrator',
  })
}

// ── 9. PLATFORM CONFIGURATION & SETTINGS ──────────────────────────────────────
export async function getPlatformSettings(): Promise<PlatformSettingsMap> {
  if (isSupabaseConfigured) {
    try {
      const db = supabase as any
      const { data, error } = await db.from('platform_settings').select('*')
      if (!error && Array.isArray(data) && data.length > 0) {
        const map: any = { ...DEFAULT_SETTINGS }
        for (const row of data) {
          map[row.key] = row.value
        }
        return map
      }
    } catch {
      // Fallback
    }
  }

  try {
    const stored = localStorage.getItem(MOCK_SETTINGS_KEY)
    if (stored) return JSON.parse(stored)
  } catch {
    // Ignore
  }

  return DEFAULT_SETTINGS
}

export async function updatePlatformSetting(
  key: string,
  value: any,
  adminId: string,
  adminEmail: string
): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const db = supabase as any
      await db.from('platform_settings').upsert({
        key,
        value,
        updated_by: adminId,
        updated_at: new Date().toISOString(),
      })
    } catch {
      // Fallback
    }
  }

  try {
    const current = await getPlatformSettings()
    current[key] = value
    localStorage.setItem(MOCK_SETTINGS_KEY, JSON.stringify(current))
  } catch {
    // Ignore
  }

  await logAdminAction({
    adminId,
    adminEmail,
    action: 'update_platform_setting',
    targetEntity: 'platform_settings',
    targetRecordId: key,
    newState: { [key]: value },
    reason: `Platform configuration updated for key: ${key}`,
  })
}

// ── 10. FINANCIAL & PAYMENT OVERSIGHT ─────────────────────────────────────────

export async function getAdminPaymentSubmissions(filter?: string, search?: string): Promise<AdminPaymentRecord[]> {
  if (isSupabaseConfigured) {
    try {
      const db = supabase as any
      let query = db
        .from('payment_submissions')
        .select(`
          id, registration_id, event_id, utr, amount, status, screenshot_url, created_at, verified_at,
          events (title, club_profiles (club_name)),
          registrations (profiles (display_name, email))
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (filter && filter !== 'all') query = query.eq('status', filter)
      if (search) query = query.ilike('utr', `%${search}%`)

      const { data, error } = await query
      if (!error && data) {
        return data.map((p: any) => ({
          id: p.id,
          registration_id: p.registration_id,
          event_id: p.event_id,
          event_title: p.events?.title || 'Unknown Event',
          club_name: p.events?.club_profiles?.club_name || 'Organizing Club',
          student_name: p.registrations?.profiles?.display_name || 'Student Attendee',
          student_email: p.registrations?.profiles?.email || 'student@campus.edu',
          utr: p.utr,
          amount: Number(p.amount || 0),
          status: p.status,
          screenshot_url: p.screenshot_url || null,
          created_at: p.created_at,
          verified_at: p.verified_at || null,
        }))
      }
    } catch {
      // Fallback
    }
  }

  const mockPayments: AdminPaymentRecord[] = [
    {
      id: 'pay_sub_1',
      registration_id: 'reg_101',
      event_id: 'evt_1',
      event_title: 'RoboWars 2026: National Battle Championship',
      club_name: 'Robotics & Automation Society',
      student_name: 'Alex Rivera',
      student_email: 'alex.rivera@campus.edu',
      utr: '430198273641',
      amount: 299,
      status: 'pending',
      created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
    {
      id: 'pay_sub_2',
      registration_id: 'reg_102',
      event_id: 'evt_1',
      event_title: 'RoboWars 2026: National Battle Championship',
      club_name: 'Robotics & Automation Society',
      student_name: 'Vamshi Krishna',
      student_email: 'vamshi.krishna@nitw.ac.in',
      utr: '430198273999',
      amount: 299,
      status: 'verified',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      verified_at: new Date(Date.now() - 86400000 + 1800000).toISOString(),
    },
  ]

  let filtered = mockPayments
  if (filter && filter !== 'all') filtered = filtered.filter((p) => p.status === filter)
  if (search) {
    const s = search.toLowerCase()
    filtered = filtered.filter((p) => p.utr.toLowerCase().includes(s) || p.student_email.toLowerCase().includes(s))
  }
  return filtered
}

export async function adminPaymentOverride(
  submissionId: string,
  action: 'verify' | 'reject',
  reason: string,
  adminEmail: string
): Promise<{ success: boolean; error?: string }> {
  if (!reason || reason.trim().length === 0) {
    return { success: false, error: 'A written audit justification is strictly required for administrative payment overrides.' }
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase as any).rpc('admin_payment_override', {
        p_submission_id: submissionId,
        p_action: action,
        p_reason: reason,
      })
      if (!error && (data as any)?.success) return { success: true }
      if (error) return { success: false, error: error.message }
    } catch {
      // Fallback
    }
  }

  await logAdminAction({
    adminId: 'current_admin',
    adminEmail,
    action: `payment_override_${action}`,
    targetEntity: 'payment_submissions',
    targetRecordId: submissionId,
    reason,
  })

  return { success: true }
}

// ── 11. ADMIN TEAM & GRANULAR ROLES ───────────────────────────────────────────
export async function getAdminTeam(): Promise<PlatformAdminRecord[]> {
  if (isSupabaseConfigured) {
    try {
      const db = supabase as any
      const { data, error } = await db
        .from('platform_admins')
        .select('*, profiles (display_name, email, avatar_url)')
        .order('created_at', { ascending: true })

      if (!error && data) {
        return data.map((a: any) => ({
          ...a,
          profile: a.profiles,
        })) as PlatformAdminRecord[]
      }
    } catch {
      // Fallback
    }
  }

  try {
    const stored = localStorage.getItem(MOCK_TEAM_KEY)
    if (stored) return JSON.parse(stored)
  } catch {
    // Ignore
  }

  const defaultTeam: PlatformAdminRecord[] = [
    {
      id: 'adm_root',
      user_id: 'usr_root',
      role: 'super_admin',
      permissions: [
        'manage_colleges',
        'verify_clubs',
        'moderate_events',
        'review_reports',
        'manage_announcements',
        'view_analytics',
        'manage_settings',
        'manage_finances',
        'manage_admins',
      ],
      is_active: true,
      created_at: new Date(Date.now() - 86400000 * 90).toISOString(),
      updated_at: new Date().toISOString(),
      profile: {
        id: 'usr_root',
        display_name: 'Lead Platform Administrator',
        email: 'admin@festflow.online',
        role: 'platform_admin',
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
  ]
  return defaultTeam
}

export async function updateAdminRole(
  adminRecordId: string,
  role: AdminRole,
  permissions: AdminPermission[],
  adminEmail: string
): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const db = supabase as any
      await db.from('platform_admins').update({
        role,
        permissions,
        updated_at: new Date().toISOString(),
      }).eq('id', adminRecordId)
    } catch {
      // Fallback
    }
  }

  try {
    const team = await getAdminTeam()
    const match = team.find((t) => t.id === adminRecordId)
    if (match) {
      match.role = role
      match.permissions = permissions
      match.updated_at = new Date().toISOString()
      localStorage.setItem(MOCK_TEAM_KEY, JSON.stringify(team))
    }
  } catch {
    // Ignore
  }

  await logAdminAction({
    adminId: 'current_admin',
    adminEmail,
    action: 'update_admin_role',
    targetEntity: 'platform_admins',
    targetRecordId: adminRecordId,
    newState: { role, permissions },
    reason: `Updated administrative role and assigned permissions`,
  })
}

// ── 12. INITIAL BOOTSTRAP PROTOCOL ───────────────────────────────────────────
export async function bootstrapInitialSuperAdmin(email: string): Promise<{ success: boolean; message: string }> {
  if (!email || !email.includes('@')) {
    return { success: false, message: 'Valid email address is required.' }
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase as any).rpc('bootstrap_initial_super_admin', {
        p_email: email.trim().toLowerCase(),
      })
      if (!error && (data as any)?.success) {
        return { success: true, message: `Super Admin role successfully granted to ${email}.` }
      }
      if (error) {
        return { success: false, message: error.message }
      }
    } catch (err: any) {
      return { success: false, message: err.message || 'Bootstrap request failed.' }
    }
  }

  // Simulation mode
  return {
    success: true,
    message: `[Simulation Mode] Initial Super Admin account configured for ${email}.`,
  }
}
