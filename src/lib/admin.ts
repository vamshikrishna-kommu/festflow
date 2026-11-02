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
      // Fallback to direct client table counts
    }

    try {
      const [
        studentsRes,
        clubsRes,
        verifiedClubsRes,
        collegesRes,
        eventsRes,
        publishedEventsRes,
        pendingModRes,
        registrationsRes,
        pendingPaymentsRes,
        verifiedPaymentsRes,
        checkInsRes,
        revenueRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'club_member'),
        supabase.from('club_profiles').select('*', { count: 'exact', head: true }).eq('is_verified', true),
        (supabase as any).from('colleges').select('*', { count: 'exact', head: true }),
        supabase.from('events').select('*', { count: 'exact', head: true }),
        supabase.from('events').select('*', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('events').select('*', { count: 'exact', head: true }).eq('moderation_status', 'pending_approval'),
        supabase.from('registrations').select('*', { count: 'exact', head: true }),
        supabase.from('payment_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
        supabase.from('payment_submissions').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('check_ins').select('*', { count: 'exact', head: true }),
        supabase.from('payment_submissions').select('amount').eq('status', 'approved'),
      ])

      const totalRevenue = revenueRes.data?.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0) || 0

      return {
        total_students: studentsRes.count ?? 0,
        total_clubs: clubsRes.count ?? 0,
        total_verified_clubs: verifiedClubsRes.count ?? 0,
        total_colleges: collegesRes.count ?? 0,
        total_events: eventsRes.count ?? 0,
        total_published_events: publishedEventsRes.count ?? 0,
        total_pending_moderation: pendingModRes.count ?? 0,
        total_registrations: registrationsRes.count ?? 0,
        total_pending_payments: pendingPaymentsRes.count ?? 0,
        total_verified_payments: verifiedPaymentsRes.count ?? 0,
        total_issued_passes: verifiedPaymentsRes.count ?? 0,
        total_check_ins: checkInsRes.count ?? 0,
        total_revenue_inr: Math.round(totalRevenue),
      }
    } catch (err) {
      console.warn('[AdminMetrics] Live query warning:', err)
    }
  }

  // Local/Simulation state aggregation (real counts from actual local storage only)
  try {
    const events = JSON.parse(localStorage.getItem('festflow_managed_events') || '[]')
    const colleges = JSON.parse(localStorage.getItem(MOCK_COLLEGES_KEY) || '[]')
    const clubs = JSON.parse(localStorage.getItem('festflow_local_clubs') || '[]')
    const registrations = JSON.parse(localStorage.getItem('festflow_local_registrations') || '[]')
    const payments = JSON.parse(localStorage.getItem('festflow_local_payments') || '[]')

    const verifiedPayments = payments.filter((p: any) => p.status === 'approved')
    const totalRev = verifiedPayments.reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0)

    return {
      total_students: registrations.length,
      total_clubs: clubs.length,
      total_verified_clubs: clubs.filter((c: any) => c.is_verified).length,
      total_colleges: colleges.length,
      total_events: events.length,
      total_published_events: events.filter((e: any) => e.status === 'published').length,
      total_pending_moderation: events.filter((e: any) => e.moderation_status === 'pending_approval').length,
      total_registrations: registrations.length,
      total_pending_payments: payments.filter((p: any) => p.status === 'pending_review').length,
      total_verified_payments: verifiedPayments.length,
      total_issued_passes: verifiedPayments.length,
      total_check_ins: 0,
      total_revenue_inr: Math.round(totalRev),
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
    return []
  }

  try {
    const logs: AdminAuditLogRecord[] = JSON.parse(localStorage.getItem(MOCK_AUDIT_LOGS_KEY) || '[]')
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
    return []
  }

  try {
    const items: CollegeRecord[] = JSON.parse(localStorage.getItem(MOCK_COLLEGES_KEY) || '[]')
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
      if (!error && data) {
        return data.map((c: any) => ({
          id: c.id,
          profile_id: c.profile_id || c.id,
          club_name: c.club_name,
          representative_name: c.club_name || 'Organizer',
          description: c.description || '',
          is_verified: Boolean(c.is_verified),
          status: c.status || (c.is_verified ? 'active' : 'pending_verification'),
          college_name: c.college_name || 'Campus Organization',
          created_at: c.created_at,
          event_count: 0,
          member_count: 1,
        }))
      }
    } catch {
      // Fallback
    }
    return []
  }

  try {
    const localClubs: AdminClubRecord[] = JSON.parse(localStorage.getItem('festflow_local_clubs') || '[]')
    let filtered = localClubs
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
        query = query.or(`email.ilike.%${search}%`)
      }

      const { data, error } = await query
      if (!error && data) {
        return data.map((p: any) => ({
          id: p.id,
          display_name: p.display_name || p.full_name || p.email?.split('@')[0] || 'Student',
          email: p.email,
          college_name: p.student_profiles?.college_name || null,
          graduation_year: p.student_profiles?.graduation_year || null,
          status: p.status || 'active',
          suspension_reason: p.suspension_reason || null,
          created_at: p.created_at,
          registration_count: 0,
          pass_count: 0,
        }))
      }
    } catch {
      // Fallback
    }
    return []
  }

  try {
    const list: AdminStudentRecord[] = JSON.parse(localStorage.getItem('festflow_local_students') || '[]')
    if (search) {
      const s = search.toLowerCase()
      return list.filter(
        (st) => st.display_name.toLowerCase().includes(s) || st.email.toLowerCase().includes(s)
      )
    }
    return list
  } catch {
    return []
  }
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
    return []
  }

  try {
    const events: AdminEventRecord[] = JSON.parse(localStorage.getItem('festflow_managed_events') || '[]')
    let filtered = events
    if (filter === 'pending_approval') filtered = filtered.filter((e) => e.moderation_status === 'pending_approval')
    if (filter === 'approved') filtered = filtered.filter((e) => e.moderation_status === 'approved')
    if (filter === 'rejected') filtered = filtered.filter((e) => e.moderation_status === 'rejected')
    if (search) {
      const s = search.toLowerCase()
      filtered = filtered.filter((e) => e.title.toLowerCase().includes(s))
    }
    return filtered
  } catch {
    return []
  }
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
    return []
  }

  try {
    const list: AdminReportRecord[] = JSON.parse(localStorage.getItem('festflow_admin_reports') || '[]')
    if (statusFilter && statusFilter !== 'all') {
      return list.filter((r) => r.status === statusFilter)
    }
    return list
  } catch {
    return []
  }
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
    return []
  }

  try {
    const list: PlatformAnnouncementRecord[] = JSON.parse(
      localStorage.getItem(MOCK_ANNOUNCEMENTS_KEY) || '[]'
    )
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
    return []
  }

  try {
    const list: AdminPaymentRecord[] = JSON.parse(localStorage.getItem('festflow_local_payments') || '[]')
    let filtered = list
    if (filter && filter !== 'all') filtered = filtered.filter((p) => p.status === filter)
    if (search) {
      const s = search.toLowerCase()
      filtered = filtered.filter((p) => p.utr?.toLowerCase().includes(s) || p.student_email?.toLowerCase().includes(s))
    }
    return filtered
  } catch {
    return []
  }
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

      if (!error && data && data.length > 0) {
        return data.map((a: any) => ({
          ...a,
          profile: a.profiles,
        })) as PlatformAdminRecord[]
      }

      // If platform_admins table hasn't been populated yet, fetch from profiles table directly
      const directProfiles = await db
        .from('profiles')
        .select('id, email, display_name, avatar_url, role, created_at')
        .eq('role', 'platform_admin')

      if (directProfiles.data && directProfiles.data.length > 0) {
        return directProfiles.data.map((p: any) => ({
          id: `adm_${p.id}`,
          user_id: p.id,
          role: 'super_admin' as const,
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
          created_at: p.created_at,
          updated_at: p.created_at,
          profile: {
            id: p.id,
            display_name: p.display_name || p.email?.split('@')[0] || 'Administrator',
            email: p.email,
            role: 'platform_admin' as const,
            avatar_url: p.avatar_url || null,
            created_at: p.created_at,
            updated_at: p.created_at,
          },
        }))
      }

      // Check for platform owner/admin account if not yet marked as platform_admin
      const { data: ownerProfile } = await db
        .from('profiles')
        .select('id, email, display_name, avatar_url, role, created_at')
        .eq('email', 'vamshikrishnakommu0908@gmail.com')
        .maybeSingle()

      if (ownerProfile) {
        return [{
          id: `adm_${ownerProfile.id}`,
          user_id: ownerProfile.id,
          role: 'super_admin' as const,
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
          created_at: ownerProfile.created_at,
          updated_at: ownerProfile.created_at,
          profile: {
            id: ownerProfile.id,
            display_name: ownerProfile.display_name || 'Vamshi Krishna (Super Admin)',
            email: ownerProfile.email,
            role: 'platform_admin' as const,
            avatar_url: ownerProfile.avatar_url || null,
            created_at: ownerProfile.created_at,
            updated_at: ownerProfile.created_at,
          },
        }]
      }
    } catch {
      // Fallback
    }
    return []
  }

  try {
    const stored = localStorage.getItem(MOCK_TEAM_KEY)
    if (stored) return JSON.parse(stored)
  } catch {
    // Ignore
  }

  return []
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
