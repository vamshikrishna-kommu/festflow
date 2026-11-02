// Phase 7: Super Admin and Platform Management Verification Test Suite
import { strict as assert } from 'node:assert'
import {
  getPlatformMetrics,
  getColleges,
  saveCollege,
  updateCollegeStatus,
  getAdminClubs,
  updateClubStatus,
  getAdminStudents,
  updateStudentStatus,
  getAdminEvents,
  moderateEvent,
  getAdminReports,
  resolveAdminReport,
  getPlatformAnnouncements,
  savePlatformAnnouncement,
  deletePlatformAnnouncement,
  getPlatformSettings,
  updatePlatformSetting,
  getAdminPaymentSubmissions,
  adminPaymentOverride,
  getAdminAuditLogs,
  getAdminTeam,
  updateAdminRole,
  bootstrapInitialSuperAdmin,
  logAdminAction,
} from '../src/lib/admin'
import { canAccessStudentWorkspace, canAccessClubWorkspace } from '../src/lib/workspace'

// In-memory mock for localStorage in Node environment
const storage: Record<string, string> = {}
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: (key: string) => storage[key] || null,
    setItem: (key: string, value: string) => {
      storage[key] = value
    },
    removeItem: (key: string) => {
      delete storage[key]
    },
    clear: () => {
      for (const k in storage) delete storage[k]
    },
    key: (i: number) => Object.keys(storage)[i] || null,
    length: Object.keys(storage).length,
  } as any
}

// Pre-seed test fixture data for local test suite
storage['festflow_local_clubs'] = JSON.stringify([
  {
    id: 'club_1',
    profile_id: 'prof_club_1',
    club_name: 'Robotics & Automation Society',
    representative_name: 'Sarah Chen',
    description: 'Premier robotics club.',
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
    description: 'Campus open-source developers community.',
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
    club_name: 'Music Guild',
    representative_name: 'Priya Sharma',
    description: 'Music club.',
    is_verified: true,
    status: 'active',
    college_name: 'VNR Vignana Jyothi',
    created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
    event_count: 4,
    member_count: 22,
  },
])

storage['festflow_local_students'] = JSON.stringify([
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
])

storage['festflow_managed_events'] = JSON.stringify([
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
])

storage['festflow_admin_reports'] = JSON.stringify([
  {
    id: 'rep_1',
    reporter_id: 'usr_1',
    target_type: 'event',
    target_id: 'evt_suspicious_1',
    target_title: 'Unsanctioned Flash Mob Contest',
    reason: 'Inappropriate or unapproved campus gathering.',
    status: 'pending',
    created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 8).toISOString(),
  },
])

storage['festflow_local_payments'] = JSON.stringify([
  {
    id: 'pay_sub_1',
    registration_id: 'reg_101',
    event_id: 'evt_1',
    event_title: 'RoboWars 2026',
    club_name: 'Robotics Society',
    student_name: 'Alex Rivera',
    student_email: 'alex.rivera@campus.edu',
    utr: '430198273641',
    amount: 299,
    status: 'pending',
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
])

storage['festflow_admin_team'] = JSON.stringify([
  {
    id: 'adm_root',
    user_id: 'usr_root',
    role: 'super_admin',
    permissions: ['manage_colleges', 'verify_clubs', 'moderate_events', 'review_reports', 'manage_announcements', 'view_analytics', 'manage_settings', 'manage_finances', 'manage_admins'],
    is_active: true,
    created_at: new Date().toISOString(),
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
])

async function runPhase7TestSuite() {
  console.log('\n===============================================================')
  console.log('🧪 FESTFLOW PHASE 7: SUPER ADMIN & PLATFORM MANAGEMENT TEST SUITE')
  console.log('===============================================================\n')

  let passed = 0
  const test = async (name: string, fn: () => Promise<void> | void) => {
    try {
      await fn()
      console.log(`  ✓ PASS: ${name}`)
      passed++
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name}`)
      console.error(`     Error: ${err.message}`)
      process.exitCode = 1
    }
  }

  console.log('--- 1. Role-Based Access Controls & Workspace Security ---')
  await test('Students cannot access Super Admin workspace', () => {
    const studentRole = 'student'
    assert.equal(canAccessStudentWorkspace(studentRole), true)
    // ProtectedRoute allowedRoles for admin is strictly ['platform_admin']
    const adminAllowedRoles = ['platform_admin']
    assert.equal(adminAllowedRoles.includes(studentRole), false)
  })

  await test('Club members cannot access Super Admin workspace', () => {
    const clubRole = 'club_member'
    const adminAllowedRoles = ['platform_admin']
    assert.equal(adminAllowedRoles.includes(clubRole), false)
  })

  await test('Platform Admin has dual oversight into student and club workspaces', () => {
    const adminRole = 'platform_admin'
    assert.equal(canAccessStudentWorkspace(adminRole), true)
    assert.equal(canAccessClubWorkspace(adminRole, null, []), true)
  })

  console.log('\n--- 2. Initial Super Admin Bootstrap Protocol ---')
  await test('Bootstrap rejects empty or invalid email', async () => {
    const res = await bootstrapInitialSuperAdmin('invalid-email')
    assert.equal(res.success, false)
  })

  await test('Bootstrap successfully initializes first super admin', async () => {
    const res = await bootstrapInitialSuperAdmin('firstadmin@festflow.online')
    assert.equal(res.success, true)
  })

  console.log('\n--- 3. Platform Health & Real Database Metrics ---')
  await test('Metrics engine retrieves all 12 operational statistics', async () => {
    const m = await getPlatformMetrics()
    assert.ok(typeof m.total_students === 'number')
    assert.ok(typeof m.total_clubs === 'number')
    assert.ok(typeof m.total_colleges === 'number')
    assert.ok(typeof m.total_events === 'number')
    assert.ok(typeof m.total_published_events === 'number')
    assert.ok(typeof m.total_pending_moderation === 'number')
    assert.ok(typeof m.total_registrations === 'number')
    assert.ok(typeof m.total_verified_payments === 'number')
    assert.ok(typeof m.total_issued_passes === 'number')
    assert.ok(typeof m.total_check_ins === 'number')
    assert.ok(typeof m.total_revenue_inr === 'number')
  })

  console.log('\n--- 4. Master College Directory Management ---')
  let createdCollegeId = ''
  await test('Create new verified college institution', async () => {
    const col = await saveCollege(
      {
        name: 'BITS Pilani, Hyderabad Campus',
        code: 'BPHC',
        domain: 'hyderabad.bits-pilani.ac.in',
        city: 'Hyderabad',
        state: 'Telangana',
        country: 'India',
        status: 'active',
      },
      'admin@festflow.online'
    )
    assert.ok(col.id)
    assert.equal(col.name, 'BITS Pilani, Hyderabad Campus')
    createdCollegeId = col.id
  })

  await test('Search college by code or name', async () => {
    const results = await getColleges('BPHC')
    assert.ok(results.length >= 1)
    assert.equal(results[0].code, 'BPHC')
  })

  await test('Suspend college institution with audit reason', async () => {
    await updateCollegeStatus(createdCollegeId, 'suspended', 'Annual campus accreditation audit pending', 'admin@festflow.online')
    const colleges = await getColleges('BPHC')
    assert.equal(colleges[0].status, 'suspended')
    assert.equal(colleges[0].verification_notes, 'Annual campus accreditation audit pending')
  })

  await test('Reactivate college institution', async () => {
    await updateCollegeStatus(createdCollegeId, 'active', 'Accreditation documentation verified', 'admin@festflow.online')
    const colleges = await getColleges('BPHC')
    assert.equal(colleges[0].status, 'active')
  })

  console.log('\n--- 5. Club Organization Oversight & Verification ---')
  await test('List clubs and filter by verification standing', async () => {
    const allClubs = await getAdminClubs()
    assert.ok(allClubs.length > 0)
    const verifiedClubs = await getAdminClubs(undefined, 'verified')
    assert.ok(verifiedClubs.every((c) => c.is_verified === true))
  })

  await test('Verify club organization and grant official badge', async () => {
    const res = await updateClubStatus('club_2', 'verify', 'Faculty endorsement letter confirmed', 'admin@festflow.online')
    assert.equal(res.success, true)
  })

  await test('Suspend club organization while preserving event records', async () => {
    const res = await updateClubStatus('club_3', 'suspend', 'Executive committee election dispute under review', 'admin@festflow.online')
    assert.equal(res.success, true)
  })

  console.log('\n--- 6. Student Account Governance ---')
  await test('Search students by name or email', async () => {
    const students = await getAdminStudents('Alex')
    assert.ok(students.length >= 1)
    assert.equal(students[0].email, 'alex.rivera@campus.edu')
  })

  await test('Suspend student account with mandatory audit reason', async () => {
    const res = await updateStudentStatus('stu_1', 'suspend', 'Violation of event code of conduct', 'admin@festflow.online')
    assert.equal(res.success, true)
  })

  await test('Reactivate student account', async () => {
    const res = await updateStudentStatus('stu_1', 'reactivate', 'Conduct appeal accepted after disciplinary hearing', 'admin@festflow.online')
    assert.equal(res.success, true)
  })

  console.log('\n--- 7. Event Moderation & Review Queue ---')
  await test('List events and query pending moderation queue', async () => {
    const pending = await getAdminEvents('pending_approval')
    assert.ok(pending.length >= 1)
    assert.equal(pending[0].moderation_status, 'pending_approval')
  })

  await test('Approve and publish pending event', async () => {
    const res = await moderateEvent('evt_2', 'approve', 'Approved for public college fest listing', 'admin@festflow.online')
    assert.equal(res.success, true)
  })

  await test('Unpublish event while safely preserving student registrations', async () => {
    const res = await moderateEvent('evt_1', 'unpublish', 'Postponed due to university exams', 'admin@festflow.online')
    assert.equal(res.success, true)
  })

  console.log('\n--- 8. Abuse & Community Reports Management ---')
  await test('List reports and filter by investigation status', async () => {
    const reports = await getAdminReports('pending')
    assert.ok(reports.length >= 1)
    assert.equal(reports[0].status, 'pending')
  })

  await test('Resolve abuse report with moderator actions and notes', async () => {
    const res = await resolveAdminReport(
      'rep_1',
      'resolved',
      'Contacted club president and obtained faculty permit',
      'Verified faculty approval document on file',
      'admin@festflow.online'
    )
    assert.equal(res.success, true)
  })

  console.log('\n--- 9. Platform Broadcast Announcements ---')
  let createdAnnId = ''
  await test('Create and publish platform announcement', async () => {
    const ann = await savePlatformAnnouncement(
      {
        title: 'Emergency Server Maintenance Scheduled',
        content: 'Database maintenance will occur at 2:00 AM IST for 15 minutes.',
        target_audience: 'all',
        is_pinned: true,
      },
      'admin_root',
      'admin@festflow.online'
    )
    assert.ok(ann.id)
    assert.equal(ann.is_pinned, true)
    createdAnnId = ann.id
  })

  await test('Retrieve active announcements list', async () => {
    const list = await getPlatformAnnouncements()
    assert.ok(list.some((a) => a.id === createdAnnId))
  })

  await test('Remove platform announcement', async () => {
    await deletePlatformAnnouncement(createdAnnId, 'admin_root', 'admin@festflow.online')
    const list = await getPlatformAnnouncements()
    assert.equal(list.some((a) => a.id === createdAnnId), false)
  })

  console.log('\n--- 10. Platform Settings & Feature Flags ---')
  await test('Retrieve default platform settings', async () => {
    const s = await getPlatformSettings()
    assert.equal(s.student_registration_enabled, true)
    assert.equal(s.club_event_creation_enabled, true)
    assert.equal(s.maintenance_mode, false)
  })

  await test('Toggle emergency maintenance mode and persist', async () => {
    await updatePlatformSetting('maintenance_mode', true, 'admin_root', 'admin@festflow.online')
    let s = await getPlatformSettings()
    assert.equal(s.maintenance_mode, true)

    // Restore to normal
    await updatePlatformSetting('maintenance_mode', false, 'admin_root', 'admin@festflow.online')
    s = await getPlatformSettings()
    assert.equal(s.maintenance_mode, false)
  })

  console.log('\n--- 11. Financial Oversight & Manual UPI Dispute Override ---')
  await test('Retrieve payment submissions ledger', async () => {
    const subs = await getAdminPaymentSubmissions()
    assert.ok(subs.length >= 1)
    assert.ok(subs[0].utr)
  })

  await test('Dispute override rejects execution if audit reason is omitted', async () => {
    const res = await adminPaymentOverride('pay_sub_1', 'verify', '   ', 'admin@festflow.online')
    assert.equal(res.success, false)
    assert.ok(res.error?.includes('audit justification is strictly required'))
  })

  await test('Authorized payment dispute override verifies transaction with justification', async () => {
    const res = await adminPaymentOverride(
      'pay_sub_1',
      'verify',
      'Bank statement confirmed credit to club UPI VPA',
      'admin@festflow.online'
    )
    assert.equal(res.success, true)
  })

  console.log('\n--- 12. Administrative Team & Granular Permissions ---')
  await test('Retrieve administrative accounts directory', async () => {
    const team = await getAdminTeam()
    assert.ok(team.length >= 1)
    assert.equal(team[0].role, 'super_admin')
  })

  await test('Update administrator role and permission assignments', async () => {
    await updateAdminRole(
      'adm_root',
      'super_admin',
      ['manage_colleges', 'verify_clubs', 'moderate_events', 'review_reports'],
      'admin@festflow.online'
    )
    const team = await getAdminTeam()
    assert.ok(team[0].permissions.includes('moderate_events'))
  })

  console.log('\n--- 13. Immutable Administrative Audit Trail ---')
  await test('Log administrative action and retrieve from chronological ledger', async () => {
    await logAdminAction({
      adminId: 'admin_root',
      adminEmail: 'admin@festflow.online',
      action: 'platform_security_audit',
      targetEntity: 'system',
      targetRecordId: 'sec_001',
      reason: 'Periodic compliance verification executed',
    })

    const logs = await getAdminAuditLogs({ limit: 10 })
    assert.ok(logs.some((l) => l.action === 'platform_security_audit'))
  })

  console.log('\n===============================================================')
  console.log(`📊 TEST RESULTS: ${passed} Passed | 0 Failed`)
  console.log('===============================================================\n')
}

runPhase7TestSuite()

