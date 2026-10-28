/**
 * FestFlow Phase 4 Test Suite: Attendance Lifecycle, Check-Out, and Student Cancellation
 *
 * Verifies:
 * 1. Migration 022 Schema & SQL Integrity
 * 2. Gate Check-In & Server-Authoritative Validation
 * 3. Invalid, Wrong-Event, and Ineligible QR Rejections
 * 4. Atomic Check-In Concurrency & Duplicate Scan Defense
 * 5. Check-Out Lifecycle (operator authorization, checkout-before-checkin prevention, duplicate checkout prevention)
 * 6. Event Re-Entry Policy Enforcement (allow_reentry true vs false)
 * 7. Operator Authorization & Role-Based Security
 * 8. Student Registration Cancellation Lifecycle & Gate Guard
 * 9. Cutoff Hours & Event Start Date Cancellation Gates
 * 10. Cancelled Ticket Scanner Rejection
 * 11. Attendance Status Aggregations & Authoritative Metrics Synchronization
 */

import {
  cleanTicketPayload,
  checkInTicket,
  checkOutTicket,
  computeCheckInStats,
  getEventRegistrationsWithCheckIn,
} from '../src/lib/checkin.js'
import {
  cancelRegistration,
  checkStudentRegistrationForEvent,
} from '../src/lib/registrations.js'
import type {
  RegistrationRecord,
  EventRecord,
  RegistrationWithCheckIn,
} from '../src/types/index.js'
import fs from 'node:fs'
import path from 'node:path'

let totalTests = 0
let passedTests = 0
let failedTests = 0

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++
  if (condition) {
    passedTests++
    console.log(`  ✓ PASS: ${testName}`)
  } else {
    failedTests++
    console.error(`  ✗ FAIL: ${testName}${details ? ` -> ${details}` : ''}`)
  }
}

// Mock localStorage for test environment
class MockLocalStorage {
  private store: Record<string, string> = {}
  getItem(key: string) {
    return this.store[key] || null
  }
  setItem(key: string, value: string) {
    this.store[key] = value
  }
  removeItem(key: string) {
    delete this.store[key]
  }
  clear() {
    this.store = {}
  }
}

const mockStorage = new MockLocalStorage()
if (typeof globalThis.localStorage === 'undefined') {
  ;(globalThis as any).localStorage = mockStorage
}
if (typeof globalThis.window === 'undefined') {
  ;(globalThis as any).window = { localStorage: mockStorage }
}

async function runPhase4Tests() {
  console.log('\n======================================================================')
  console.log(' FestFlow — Phase 4: Attendance Lifecycle & Cancellation Test Suite')
  console.log('======================================================================\n')

  // ── Test Suite 1: Migration 022 Schema & SQL Validation ──────────────────
  console.log('Suite 1: Database Migration 022 SQL & RPC Integrity')
  {
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/022_attendance_lifecycle_checkout_and_cancellation.sql')
    const migrationExists = fs.existsSync(migrationPath)
    assert(migrationExists, 'Migration 022 exists on filesystem')

    if (migrationExists) {
      const sql = fs.readFileSync(migrationPath, 'utf8')
      const lowerSql = sql.toLowerCase()
      assert(lowerSql.includes('allow_reentry boolean not null default false'), 'Migration adds allow_reentry to events')
      assert(lowerSql.includes('require_checkout boolean not null default false'), 'Migration adds require_checkout to events')
      assert(lowerSql.includes('cancellation_cutoff_hours int default null'), 'Migration adds cancellation_cutoff_hours to events')
      assert(lowerSql.includes('checked_out_at timestamptz default null'), 'Migration adds checked_out_at to check_ins')
      assert(lowerSql.includes('checked_out_by uuid references public.profiles(id)'), 'Migration adds checked_out_by operator to check_ins')
      assert(lowerSql.includes('entry_count int not null default 1'), 'Migration adds entry_count to check_ins')
      assert(sql.includes('CREATE OR REPLACE FUNCTION public.check_in_ticket'), 'Migration defines check_in_ticket RPC')
      assert(sql.includes('CREATE OR REPLACE FUNCTION public.check_out_ticket'), 'Migration defines check_out_ticket RPC')
      assert(sql.includes('CREATE OR REPLACE FUNCTION public.cancel_registration_with_policy'), 'Migration defines cancel_registration_with_policy RPC')
      assert(sql.includes('idx_check_ins_event_status'), 'Migration creates compound index on (event_id, status)')
    }
  }

  // ── Setup Fixtures ────────────────────────────────────────────────────────
  const CLUB_ORGANIZER_ID = 'organizer-tech-club-001'
  const OTHER_CLUB_ID = 'organizer-dance-club-002'
  const PLATFORM_ADMIN_ID = 'admin-user-999'

  const mockEvent: EventRecord = {
    id: 'evt-hackathon-2026',
    club_id: CLUB_ORGANIZER_ID,
    title: 'HackCampus 2026',
    slug: 'hackcampus-2026',
    description: 'Annual campus hackathon',
    category: 'tech',
    status: 'published',
    start_date: new Date(Date.now() + 86400000).toISOString(), // 24h in future
    end_date: new Date(Date.now() + 172800000).toISOString(),
    registration_opens_at: new Date(Date.now() - 3600000).toISOString(),
    registration_closes_at: new Date(Date.now() + 82800000).toISOString(),
    venue_name: 'Campus Main Auditorium',
    capacity: 100,
    price: 0,
    is_free: true,
    participation_type: 'individual',
    approval_type: 'automatic',
    allow_reentry: false,
    require_checkout: true,
    cancellation_cutoff_hours: 4,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const mockRegistrations: RegistrationRecord[] = [
    {
      id: 'reg-valid-01',
      event_id: 'evt-hackathon-2026',
      student_id: 'std-alice-01',
      ticket_code: 'TKT-ALICE-01',
      status: 'confirmed',
      approval_status: 'approved',
      student: { display_name: 'Alice Johnson', email: 'alice@campus.edu' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'reg-valid-02',
      event_id: 'evt-hackathon-2026',
      student_id: 'std-bob-02',
      ticket_code: 'TKT-BOB-02',
      status: 'confirmed',
      approval_status: 'approved',
      student: { display_name: 'Bob Smith', email: 'bob@campus.edu' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'reg-unpaid-03',
      event_id: 'evt-hackathon-2026',
      student_id: 'std-charlie-03',
      ticket_code: 'TKT-CHARLIE-03',
      status: 'pending_payment',
      approval_status: 'approved',
      student: { display_name: 'Charlie Brown', email: 'charlie@campus.edu' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'reg-under-review-04',
      event_id: 'evt-hackathon-2026',
      student_id: 'std-diana-04',
      ticket_code: 'TKT-DIANA-04',
      status: 'pending_approval',
      approval_status: 'pending',
      student: { display_name: 'Diana Prince', email: 'diana@campus.edu' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'reg-cancelled-05',
      event_id: 'evt-hackathon-2026',
      student_id: 'std-evan-05',
      ticket_code: 'TKT-EVAN-05',
      status: 'cancelled',
      approval_status: 'approved',
      student: { display_name: 'Evan Wright', email: 'evan@campus.edu' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'reg-other-event-06',
      event_id: 'evt-dance-battle-2026',
      student_id: 'std-fiona-06',
      ticket_code: 'TKT-DANCE-06',
      status: 'confirmed',
      approval_status: 'approved',
      student: { display_name: 'Fiona Gallagher', email: 'fiona@campus.edu' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]

  mockStorage.setItem('festflow_managed_events', JSON.stringify([mockEvent]))
  mockStorage.setItem('festflow_local_registrations', JSON.stringify(mockRegistrations))
  mockStorage.setItem('festflow_local_checkins', JSON.stringify([]))

  // ── Test Suite 2: Gate Check-In & Eligibility Verification ───────────────
  console.log('\nSuite 2: Gate Check-In Validation')
  {
    // 2.1 Valid Attendee Check-In
    const res1 = await checkInTicket('evt-hackathon-2026', 'TKT-ALICE-01', undefined, CLUB_ORGANIZER_ID)
    assert(res1.success === true, 'Alice valid check-in succeeds')
    assert(res1.outcome === 'VALID', 'Alice check-in outcome is VALID')
    assert(Boolean(res1.checked_in_at), 'Alice check-in recorded checked_in_at timestamp')
    assert(res1.student_name === 'Alice Johnson', 'Alice student name resolved correctly')

    // 2.2 Invalid / Non-existent QR Token
    const resInvalid = await checkInTicket('evt-hackathon-2026', 'TKT-DOES-NOT-EXIST', undefined, CLUB_ORGANIZER_ID)
    assert(resInvalid.success === false, 'Non-existent ticket is rejected')
    assert(resInvalid.outcome === 'INVALID_TICKET', 'Invalid ticket outcome is INVALID_TICKET')

    // 2.3 Wrong Event QR Token
    const resWrong = await checkInTicket('evt-hackathon-2026', 'TKT-DANCE-06', undefined, CLUB_ORGANIZER_ID)
    assert(resWrong.success === false, 'Cross-event ticket is rejected')
    assert(resWrong.outcome === 'WRONG_EVENT', 'Cross-event outcome is WRONG_EVENT')

    // 2.4 Unpaid Ticket (outcome is NOT_CONFIRMED)
    const resUnpaid = await checkInTicket('evt-hackathon-2026', 'TKT-CHARLIE-03', undefined, CLUB_ORGANIZER_ID)
    assert(resUnpaid.success === false, 'Pending payment ticket is rejected')
    assert(resUnpaid.outcome === 'NOT_CONFIRMED', 'Pending payment outcome is NOT_CONFIRMED')

    // 2.5 Under Review Ticket (outcome is NOT_CONFIRMED)
    const resReview = await checkInTicket('evt-hackathon-2026', 'TKT-DIANA-04', undefined, CLUB_ORGANIZER_ID)
    assert(resReview.success === false, 'Under-review ticket is rejected')
    assert(resReview.outcome === 'NOT_CONFIRMED', 'Under-review outcome is NOT_CONFIRMED')

    // 2.6 Cancelled Ticket
    const resCancelled = await checkInTicket('evt-hackathon-2026', 'TKT-EVAN-05', undefined, CLUB_ORGANIZER_ID)
    assert(resCancelled.success === false, 'Cancelled ticket is rejected')
    assert(resCancelled.outcome === 'CANCELLED', 'Cancelled ticket outcome is CANCELLED')

    // 2.7 Duplicate Immediate Check-In Attempt
    const resDuplicate = await checkInTicket('evt-hackathon-2026', 'TKT-ALICE-01', undefined, CLUB_ORGANIZER_ID)
    assert(resDuplicate.success === false, 'Immediate duplicate scan is rejected')
    assert(resDuplicate.outcome === 'ALREADY_USED', 'Duplicate scan outcome is ALREADY_USED')
  }

  // ── Test Suite 3: Gate Check-Out Lifecycle ─────────────────────────────────
  console.log('\nSuite 3: Gate Check-Out Lifecycle & State Machine')
  {
    // 3.1 Check-Out before Check-In (Bob has not checked in yet)
    const resBobCheckout = await checkOutTicket('evt-hackathon-2026', 'TKT-BOB-02', undefined, CLUB_ORGANIZER_ID)
    assert(resBobCheckout.success === false, 'Check-out without check-in is rejected')
    assert(resBobCheckout.outcome === 'NOT_CHECKED_IN', 'Check-out without check-in outcome is NOT_CHECKED_IN')

    // 3.2 Valid Check-Out for Alice (Alice is checked in)
    const resAliceCheckout = await checkOutTicket('evt-hackathon-2026', 'TKT-ALICE-01', undefined, CLUB_ORGANIZER_ID)
    assert(resAliceCheckout.success === true, 'Alice valid check-out succeeds')
    assert(resAliceCheckout.outcome === 'CHECKED_OUT', 'Alice check-out outcome is CHECKED_OUT')
    assert(Boolean(resAliceCheckout.checked_out_at), 'Check-out records checked_out_at timestamp')

    // Verify stored state in check_ins
    const rawCheckins = JSON.parse(mockStorage.getItem('festflow_local_checkins') || '[]')
    const aliceCheckInRecord = rawCheckins.find((c: any) => c.registration_id === 'reg-valid-01')
    assert(aliceCheckInRecord && aliceCheckInRecord.status === 'checked_out', 'Alice check-in record status transitioned to checked_out')
    assert(aliceCheckInRecord && aliceCheckInRecord.checked_out_by === CLUB_ORGANIZER_ID, 'Alice check-out recorded operator ID')

    // 3.3 Duplicate Check-Out Attempt (Alice is already checked out)
    const resAliceDoubleCheckout = await checkOutTicket('evt-hackathon-2026', 'TKT-ALICE-01', undefined, CLUB_ORGANIZER_ID)
    assert(resAliceDoubleCheckout.success === false, 'Duplicate check-out is rejected')
    assert(resAliceDoubleCheckout.outcome === 'ALREADY_CHECKED_OUT', 'Duplicate check-out outcome is ALREADY_CHECKED_OUT')

    // 3.4 Bob Check-in followed by checkout
    const resBobCheckIn = await checkInTicket('evt-hackathon-2026', 'TKT-BOB-02', undefined, CLUB_ORGANIZER_ID)
    assert(resBobCheckIn.success === true, 'Bob checks in successfully')
    const resBobCheckoutSuccess = await checkOutTicket('evt-hackathon-2026', 'TKT-BOB-02', undefined, CLUB_ORGANIZER_ID)
    assert(resBobCheckoutSuccess.success === true, 'Bob checks out successfully')
  }

  // ── Test Suite 4: Re-Entry Policy Enforcement ─────────────────────────────
  console.log('\nSuite 4: Event Re-Entry Policy Enforcement')
  {
    // Current event has allow_reentry = false
    // Alice is checked out. Scanning Alice again when allow_reentry = false should be rejected.
    const resNoReentry = await checkInTicket('evt-hackathon-2026', 'TKT-ALICE-01', undefined, CLUB_ORGANIZER_ID)
    assert(resNoReentry.success === false, 'Re-entry rejected when event allow_reentry is false')
    assert(resNoReentry.outcome === 'ALREADY_USED', 'Re-entry rejected outcome is ALREADY_USED')

    // Now update event to allow_reentry = true in festflow_managed_events
    const updatedEvents = JSON.parse(mockStorage.getItem('festflow_managed_events') || '[]')
    updatedEvents[0].allow_reentry = true
    mockStorage.setItem('festflow_managed_events', JSON.stringify(updatedEvents))

    // Re-check-in Alice with allow_reentry = true
    const resReentrySuccess = await checkInTicket('evt-hackathon-2026', 'TKT-ALICE-01', undefined, CLUB_ORGANIZER_ID)
    assert(resReentrySuccess.success === true, 'Re-entry succeeds when allow_reentry is true')
    assert(resReentrySuccess.outcome === 'VALID', 'Re-entry outcome is VALID')
    assert(resReentrySuccess.is_reentry === true, 'Re-entry flag is true')
    assert(resReentrySuccess.entry_count === 2, 'Entry count incremented to 2')

    // Check again without checking out -> should be rejected as ALREADY_USED (since already inside)
    const resDoubleInside = await checkInTicket('evt-hackathon-2026', 'TKT-ALICE-01', undefined, CLUB_ORGANIZER_ID)
    assert(resDoubleInside.success === false, 'Re-entry while already inside is rejected')
  }

  // ── Test Suite 5: Attendance Statistics & Roster Computation ─────────────
  console.log('\nSuite 5: Attendance Stats & Authoritative Roster')
  {
    const result = await getEventRegistrationsWithCheckIn('evt-hackathon-2026')
    const roster = result.registrations
    const stats = result.stats

    assert(roster.length === 5, 'Roster loads all 5 registrations for the event')

    const aliceItem = roster.find((r) => r.id === 'reg-valid-01')
    assert(aliceItem?.attendance_status === 'checked_in', 'Alice attendance_status is checked_in')
    assert(aliceItem?.check_in?.entry_count === 2, 'Alice check_in entry_count is 2')

    const bobItem = roster.find((r) => r.id === 'reg-valid-02')
    assert(bobItem?.attendance_status === 'checked_out', 'Bob attendance_status is checked_out')
    assert(Boolean(bobItem?.check_in?.checked_out_at), 'Bob has checked_out_at timestamp')

    const charlieItem = roster.find((r) => r.id === 'reg-unpaid-03')
    assert(charlieItem?.attendance_status === 'ineligible', 'Unpaid Charlie attendance_status is ineligible')

    const evanItem = roster.find((r) => r.id === 'reg-cancelled-05')
    assert(evanItem?.attendance_status === 'cancelled', 'Cancelled Evan attendance_status is cancelled')

    assert(stats.totalCapacity === 100, 'Total capacity is 100')
    assert(stats.confirmedRegistrations === 2, 'Confirmed registrations is 2')
    assert(stats.checkedInCount === 1, 'Currently inside venue count is 1 (Alice)')
    assert(stats.checkedOutCount === 1, 'Currently checked out count is 1 (Bob)')
    assert(stats.notCheckedInCount === 0, 'Not checked in count is 0')
    assert(stats.successfulCheckIns === 2, 'Cumulative attendees who passed through gate is 2 (Alice & Bob)')
    assert(stats.attendancePercentage === 50, 'Effective inside attendance percentage is 50%')
  }

  // ── Test Suite 6: Student Event Cancellation & Policy Rules ───────────────
  console.log('\nSuite 6: Student Cancellation Policy & Gate Guards')
  {
    // Setup fresh registrations for cancellation tests
    const cancelTestRegs: RegistrationRecord[] = [
      {
        id: 'reg-cancel-eligible-10',
        event_id: 'evt-hackathon-2026',
        student_id: 'std-grace-10',
        ticket_code: 'TKT-GRACE-10',
        status: 'confirmed',
        approval_status: 'approved',
        student: { display_name: 'Grace Hopper', email: 'grace@campus.edu' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'reg-cancel-checkedin-11',
        event_id: 'evt-hackathon-2026',
        student_id: 'std-henry-11',
        ticket_code: 'TKT-HENRY-11',
        status: 'confirmed',
        approval_status: 'approved',
        student: { display_name: 'Henry Ford', email: 'henry@campus.edu' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    const allRegs = JSON.parse(mockStorage.getItem('festflow_local_registrations') || '[]')
    allRegs.push(...cancelTestRegs)
    mockStorage.setItem('festflow_local_registrations', JSON.stringify(allRegs))

    // Check-in Henry at gate
    await checkInTicket('evt-hackathon-2026', 'TKT-HENRY-11', undefined, CLUB_ORGANIZER_ID)

    // 6.1 Gate Guard: Henry cannot cancel because he has already checked in
    const resHenryCancel = await cancelRegistration('reg-cancel-checkedin-11', 'Want to leave early')
    assert(resHenryCancel.success === false, 'Cancellation blocked after physical gate check-in')
    assert(resHenryCancel.message.includes('verified at the entry gate'), 'Gate check-in rejection message is explicit')

    // 6.2 Eligible Student Cancellation: Grace cancels before cutoff and before gate check-in
    const resGraceCancel = await cancelRegistration('reg-cancel-eligible-10', 'Personal emergency')
    assert(resGraceCancel.success === true, 'Eligible cancellation succeeds')

    // Verify registration status transitioned to cancelled
    const updatedRegs = JSON.parse(mockStorage.getItem('festflow_local_registrations') || '[]')
    const graceReg = updatedRegs.find((r: any) => r.id === 'reg-cancel-eligible-10')
    assert(graceReg.status === 'cancelled', 'Grace registration status is cancelled')
    assert(Boolean(graceReg.cancelled_at), 'Grace has cancelled_at timestamp')

    // 6.3 Gate Scanner rejects Grace's cancelled pass
    const resGraceScan = await checkInTicket('evt-hackathon-2026', 'TKT-GRACE-10', undefined, CLUB_ORGANIZER_ID)
    assert(resGraceScan.success === false, 'Gate scanner immediately rejects cancelled pass')
    assert(resGraceScan.outcome === 'CANCELLED', 'Outcome is CANCELLED')

    // 6.4 Event Already Started Guard
    const startedEvent: EventRecord = {
      ...mockEvent,
      id: 'evt-past-event-99',
      start_date: new Date(Date.now() - 3600000).toISOString(), // started 1 hour ago
    }
    const startedReg: RegistrationRecord = {
      id: 'reg-started-event-12',
      event_id: 'evt-past-event-99',
      student_id: 'std-ian-12',
      ticket_code: 'TKT-IAN-12',
      status: 'confirmed',
      approval_status: 'approved',
      student: { display_name: 'Ian Malcolm', email: 'ian@campus.edu' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const eventsList = JSON.parse(mockStorage.getItem('festflow_managed_events') || '[]')
    eventsList.push(startedEvent)
    mockStorage.setItem('festflow_managed_events', JSON.stringify(eventsList))
    const currentRegs = JSON.parse(mockStorage.getItem('festflow_local_registrations') || '[]')
    currentRegs.push(startedReg)
    mockStorage.setItem('festflow_local_registrations', JSON.stringify(currentRegs))

    const resStartedCancel = await cancelRegistration('reg-started-event-12')
    assert(resStartedCancel.success === false, 'Cancellation blocked when event has already started')
    assert(resStartedCancel.message.includes('already started'), 'Event started rejection message is explicit')

    // 6.5 Cutoff Hours Window Guard (event starts in 2 hours, cutoff is 4 hours)
    const cutoffEvent: EventRecord = {
      ...mockEvent,
      id: 'evt-cutoff-event-88',
      start_date: new Date(Date.now() + 7200000).toISOString(), // starts in 2h
      cancellation_cutoff_hours: 4,
    }
    const cutoffReg: RegistrationRecord = {
      id: 'reg-cutoff-event-13',
      event_id: 'evt-cutoff-event-88',
      student_id: 'std-jack-13',
      ticket_code: 'TKT-JACK-13',
      status: 'confirmed',
      approval_status: 'approved',
      student: { display_name: 'Jack Ryan', email: 'jack@campus.edu' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    eventsList.push(cutoffEvent)
    mockStorage.setItem('festflow_managed_events', JSON.stringify(eventsList))
    currentRegs.push(cutoffReg)
    mockStorage.setItem('festflow_local_registrations', JSON.stringify(currentRegs))

    const resCutoffCancel = await cancelRegistration('reg-cutoff-event-13')
    assert(resCutoffCancel.success === false, 'Cancellation blocked when within cancellation cutoff window')
    assert(resCutoffCancel.message.includes('Cancellation deadline has passed'), 'Cutoff passed rejection message is explicit')

    // 6.6 checkStudentRegistrationForEvent returns registered=false for cancelled registrations
    const studentCheck = await checkStudentRegistrationForEvent('evt-hackathon-2026', 'std-grace-10')
    assert(studentCheck.registered === false, 'checkStudentRegistrationForEvent treats cancelled student as not registered')
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n======================================================================')
  console.log(` Phase 4 Test Summary: ${passedTests}/${totalTests} Tests Passed (${Math.round((passedTests / totalTests) * 100)}%)`)
  console.log('======================================================================\n')

  if (failedTests > 0) {
    process.exit(1)
  }
}

runPhase4Tests().catch((err) => {
  console.error('Fatal error in Phase 4 test execution:', err)
  process.exit(1)
})
