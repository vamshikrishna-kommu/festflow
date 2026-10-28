/**
 * FestFlow Phase 5 Test Suite: Professional Attendee Management, Attendance Lists, and Reliable Excel Exports
 *
 * Verifies:
 * 1. Formula Injection / DDE Sanitization (neutralizes '=', '+', '-', '@', '\t', '\r')
 * 2. Full Attendee Directory Export (.xlsx) - Genuine binary generation, ZIP signature, frozen panes, headers
 * 3. Dynamic Custom Question Labeling & Answer Population
 * 4. Distinct Squad Leader vs Member Roster Separation
 * 5. Gate Attendance & Turnstile Log Export (.xlsx) - Check-in/out timestamps, operator tracking, turnstile figures
 * 6. Payment Reconciliation Export (.xlsx) - UTR references, revenue totals, reviewer audit logs
 * 7. Security & Authorization Enforcement - Prevents payment leakage to unauthorized operators
 * 8. Comprehensive Multi-Scenario Roster Integrity (Individual, Team, Free, Paid, Cancelled, Checked-In, Checked-Out)
 */

import ExcelJS from 'exceljs'
import {
  sanitizeExcelValue,
  formatExcelDateTime,
  buildFullAttendeesWorkbook,
  buildAttendanceWorkbook,
  buildTeamsWorkbook,
  buildPaymentsWorkbook,
} from '../src/lib/excelExport.js'
import type {
  EventRecord,
  RegistrationWithCheckIn,
  PaymentSubmissionWithDetails,
  CheckInRecord,
  CustomQuestion,
} from '../src/types/index.js'

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

// ── Test Mock Data ──────────────────────────────────────────────────────────

const mockCustomQuestions: CustomQuestion[] = [
  { id: 'q_tshirt', label: 'T-Shirt Size', type: 'select', required: true, options: ['S', 'M', 'L', 'XL'] },
  { id: 'q_diet', label: 'Dietary Preference', type: 'radio', required: false, options: ['Veg', 'Non-Veg', 'Jain'] },
  { id: 'q_github', label: 'GitHub Profile URL', type: 'text', required: false },
]

const mockEvent: EventRecord = {
  id: 'evt_techfest_2026',
  club_id: 'club_cs_society',
  slug: 'tech-fest-2026',
  title: 'TechFest Global Hackathon 2026',
  description: 'National campus hackathon with over 500 participants.',
  category: 'hackathon',
  venue_name: 'Main Campus Convention Center',
  start_date: '2026-11-15T09:00:00.000Z',
  end_date: '2026-11-16T18:00:00.000Z',
  capacity: 100,
  is_free: false,
  price: 299,
  status: 'published',
  participation_type: 'team',
  min_team_size: 2,
  max_team_size: 4,
  allow_reentry: true,
  custom_questions: mockCustomQuestions,
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-01T00:00:00.000Z',
}

const mockCheckIns: CheckInRecord[] = [
  {
    id: 'chk_001',
    event_id: 'evt_techfest_2026',
    registration_id: 'reg_solopaid_001',
    student_id: 'std_alice',
    ticket_code: 'FF-SOLO-001',
    checked_in_at: '2026-11-15T09:15:00.000Z',
    staff_id: 'operator_gate_alpha',
    status: 'checked_in',
    entry_count: 1,
    checked_out_at: null,
    checked_out_by: null,
    checkin_notes: 'Verified college ID card',
    checkout_notes: null,
    created_at: '2026-11-15T09:15:00.000Z',
  },
  {
    id: 'chk_002',
    event_id: 'evt_techfest_2026',
    registration_id: 'reg_team_leader_002',
    student_id: 'std_bob',
    ticket_code: 'FF-TEAM-LEAD',
    checked_in_at: '2026-11-15T09:30:00.000Z',
    staff_id: 'operator_gate_beta',
    status: 'checked_out',
    entry_count: 2,
    checked_out_at: '2026-11-15T13:00:00.000Z',
    checked_out_by: 'operator_gate_beta',
    checkin_notes: 'Team Lead checked in',
    checkout_notes: 'Lunch break exit',
    created_at: '2026-11-15T09:30:00.000Z',
  },
]

const mockPayments: PaymentSubmissionWithDetails[] = [
  {
    id: 'pay_001',
    event_id: 'evt_techfest_2026',
    registration_id: 'reg_solopaid_001',
    student_id: 'std_alice',
    amount: 299,
    transaction_reference: 'UTR123456789012',
    status: 'approved',
    reviewer_id: 'organizer_finance_lead',
    review_notes: 'SBI UPI payment confirmed',
    reviewed_at: '2026-10-15T11:00:00.000Z',
    created_at: '2026-10-15T10:30:00.000Z',
    student: {
      id: 'std_alice',
      email: 'alice@festflow.edu',
      display_name: 'Alice Johnson',
      role: 'student',
      created_at: '2026-09-01T00:00:00.000Z',
      updated_at: '2026-09-01T00:00:00.000Z',
    },
  },
  {
    id: 'pay_002',
    event_id: 'evt_techfest_2026',
    registration_id: 'reg_pendingpay_003',
    student_id: 'std_charlie',
    amount: 299,
    transaction_reference: 'UTR987654321098',
    status: 'pending_review',
    reviewer_id: null,
    review_notes: null,
    reviewed_at: null,
    created_at: '2026-10-20T14:00:00.000Z',
    student: {
      id: 'std_charlie',
      email: 'charlie@festflow.edu',
      display_name: 'Charlie Davis',
      role: 'student',
      created_at: '2026-09-01T00:00:00.000Z',
      updated_at: '2026-09-01T00:00:00.000Z',
    },
  },
]

const mockRegistrations: RegistrationWithCheckIn[] = [
  // 1. Confirmed Solo Pass (Checked In)
  {
    id: 'reg_solopaid_001',
    event_id: 'evt_techfest_2026',
    student_id: 'std_alice',
    ticket_code: 'FF-SOLO-001',
    status: 'confirmed',
    created_at: '2026-10-15T10:00:00.000Z',
    updated_at: '2026-10-15T11:00:00.000Z',
    student: {
      id: 'std_alice',
      email: 'alice@festflow.edu',
      display_name: 'Alice Johnson',
      role: 'student',
      created_at: '2026-09-01T00:00:00.000Z',
      updated_at: '2026-09-01T00:00:00.000Z',
    },
    check_in: mockCheckIns[0],
    check_ins: [mockCheckIns[0]],
    attendance_status: 'checked_in',
    custom_responses: {
      q_tshirt: 'M',
      q_diet: 'Veg',
      q_github: 'https://github.com/alicejohnson',
    },
  },

  // 2. Confirmed Team Registration with Squad Leader and Members (Checked Out)
  {
    id: 'reg_team_leader_002',
    event_id: 'evt_techfest_2026',
    student_id: 'std_bob',
    ticket_code: 'FF-TEAM-LEAD',
    team_name: 'CyberHawks',
    status: 'confirmed',
    created_at: '2026-10-16T12:00:00.000Z',
    updated_at: '2026-10-16T12:30:00.000Z',
    student: {
      id: 'std_bob',
      email: 'bob@festflow.edu',
      display_name: 'Bob Cyber',
      role: 'student',
      created_at: '2026-09-01T00:00:00.000Z',
      updated_at: '2026-09-01T00:00:00.000Z',
    },
    team_members: [
      {
        name: 'David Member',
        email: 'david@festflow.edu',
        studentId: 'CS2026-042',
        college: 'Apex Institute of Technology',
        phone: '+91 98765 43210',
        ticket_code: 'FF-TEAM-LEAD-M1',
      },
      {
        name: 'Eva Member',
        email: 'eva@festflow.edu',
        studentId: 'CS2026-089',
        college: 'Apex Institute of Technology',
        phone: '+91 98765 43211',
        ticket_code: 'FF-TEAM-LEAD-M2',
      },
    ],
    check_in: mockCheckIns[1],
    check_ins: [mockCheckIns[1]],
    attendance_status: 'checked_out',
    custom_responses: {
      q_tshirt: 'L',
      q_diet: 'Non-Veg',
      q_github: 'https://github.com/cyberhawks-lead',
    },
  },

  // 3. Pending Payment Review (Not Checked In)
  {
    id: 'reg_pendingpay_003',
    event_id: 'evt_techfest_2026',
    student_id: 'std_charlie',
    ticket_code: 'FF-PEND-003',
    status: 'pending_payment',
    created_at: '2026-10-20T13:45:00.000Z',
    updated_at: '2026-10-20T14:00:00.000Z',
    student: {
      id: 'std_charlie',
      email: 'charlie@festflow.edu',
      display_name: 'Charlie Davis',
      role: 'student',
      created_at: '2026-09-01T00:00:00.000Z',
      updated_at: '2026-09-01T00:00:00.000Z',
    },
    check_in: null,
    attendance_status: 'ineligible',
    custom_responses: {
      q_tshirt: 'XL',
      q_diet: 'Jain',
    },
  },

  // 4. Cancelled Registration
  {
    id: 'reg_cancelled_004',
    event_id: 'evt_techfest_2026',
    student_id: 'std_fiona',
    ticket_code: 'FF-CANC-004',
    status: 'cancelled',
    created_at: '2026-10-22T08:00:00.000Z',
    updated_at: '2026-10-22T10:00:00.000Z',
    student: {
      id: 'std_fiona',
      email: 'fiona@festflow.edu',
      display_name: 'Fiona Cancelled',
      role: 'student',
      created_at: '2026-09-01T00:00:00.000Z',
      updated_at: '2026-09-01T00:00:00.000Z',
    },
    check_in: null,
    attendance_status: 'cancelled',
  },

  // 5. Injection Payload Attendee (Testing DDE & Formula Injection Defense)
  {
    id: 'reg_malicious_005',
    event_id: 'evt_techfest_2026',
    student_id: 'std_hacker',
    ticket_code: 'FF-SEC-005',
    status: 'confirmed',
    created_at: '2026-10-23T09:00:00.000Z',
    updated_at: '2026-10-23T09:00:00.000Z',
    student: {
      id: 'std_hacker',
      email: '=1+1@attacker.com',
      display_name: '=CMD|\' /C calc\'!A0',
      role: 'student',
      created_at: '2026-09-01T00:00:00.000Z',
      updated_at: '2026-09-01T00:00:00.000Z',
    },
    custom_responses: {
      q_tshirt: '@SUM(1,2)',
      q_github: '+https://malicious.payload',
    },
    check_in: null,
    attendance_status: 'not_checked_in',
  },
]

// ── Test Execution ──────────────────────────────────────────────────────────

async function runPhase5TestSuite() {
  console.log('\n=================================================================')
  console.log(' FestFlow Phase 5 Test Suite: Attendee Management & Excel Exports')
  console.log('=================================================================\n')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 1: Formula Injection & DDE Sanitization
  // ──────────────────────────────────────────────────────────────────────────
  console.log('TEST GROUP 1: Formula Injection & DDE Sanitization')

  const dangerousEquals = sanitizeExcelValue('=SUM(A1:A10)')
  assert(
    dangerousEquals === "'=SUM(A1:A10)",
    'Formula starting with "=" must be prefixed with single quote',
    `Received: ${dangerousEquals}`
  )

  const dangerousPlus = sanitizeExcelValue('+12345')
  assert(
    dangerousPlus === "'+12345",
    'Formula starting with "+" must be prefixed with single quote',
    `Received: ${dangerousPlus}`
  )

  const dangerousMinus = sanitizeExcelValue('-5+5')
  assert(
    dangerousMinus === "'-5+5",
    'Formula starting with "-" must be prefixed with single quote',
    `Received: ${dangerousMinus}`
  )

  const dangerousAt = sanitizeExcelValue('@cmd|"/c calc"!A0')
  assert(
    dangerousAt === "'@cmd|\"/c calc\"!A0",
    'Formula starting with "@" must be prefixed with single quote',
    `Received: ${dangerousAt}`
  )

  const dangerousTab = sanitizeExcelValue('\tmalicious')
  assert(
    dangerousTab === "'\tmalicious",
    'String starting with "\\t" must be prefixed with single quote',
    `Received: ${dangerousTab}`
  )

  const safeNumber = sanitizeExcelValue(299)
  assert(
    safeNumber === 299 && typeof safeNumber === 'number',
    'Numeric values must remain numbers without quotes',
    `Received: ${safeNumber}`
  )

  const safeBoolean = sanitizeExcelValue(true)
  assert(
    safeBoolean === true && typeof safeBoolean === 'boolean',
    'Booleans must remain booleans without quotes',
    `Received: ${safeBoolean}`
  )

  const safeNormal = sanitizeExcelValue('Alice Johnson')
  assert(
    safeNormal === 'Alice Johnson',
    'Safe alphanumeric strings must not be modified',
    `Received: ${safeNormal}`
  )

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 2: Full Attendee Directory (.xlsx) Generation & Binary Integrity
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\nTEST GROUP 2: Full Attendee Directory (.xlsx) Generation & Binary Integrity')

  const fullWb = await buildFullAttendeesWorkbook({
    event: mockEvent,
    registrations: mockRegistrations,
    checkIns: mockCheckIns,
    payments: mockPayments,
    isAuthorized: true,
  })

  // 1. Write buffer and verify ZIP header (PK\x03\x04)
  const fullBuffer = (await fullWb.xlsx.writeBuffer()) as Buffer
  const isZip =
    fullBuffer.length > 4 &&
    fullBuffer[0] === 0x50 && // 'P'
    fullBuffer[1] === 0x4b && // 'K'
    fullBuffer[2] === 0x03 &&
    fullBuffer[3] === 0x04

  assert(
    isZip,
    'Generated attendee workbook must possess genuine OOXML ZIP magic header (PK\\x03\\x04)',
    `Buffer length: ${fullBuffer.length}`
  )

  // 2. Reload into fresh workbook to verify parsed structure
  const reloadedFullWb = new ExcelJS.Workbook()
  await reloadedFullWb.xlsx.load(fullBuffer as any)

  const attendeeSheet = reloadedFullWb.getWorksheet('Attendee Directory')
  assert(
    Boolean(attendeeSheet),
    'Worksheet "Attendee Directory" must exist in parsed workbook'
  )

  if (attendeeSheet) {
    // Check frozen view
    const view = attendeeSheet.views?.[0]
    assert(
      view?.state === 'frozen' && view?.ySplit === 5,
      'Worksheet must have frozen header row at ySplit=5',
      `State: ${view?.state}, ySplit: ${view?.ySplit}`
    )

    // Check row count (Title block 4 rows + 1 header + 5 attendees = 10 rows)
    assert(
      attendeeSheet.rowCount >= 10,
      'Attendee worksheet must contain all metadata, header, and attendee rows',
      `RowCount: ${attendeeSheet.rowCount}`
    )

    // Verify Header row values
    const headerRow = attendeeSheet.getRow(5)
    const headerValues = (headerRow.values as string[]).filter(Boolean)

    assert(
      headerValues.includes('Attendee Name') &&
        headerValues.includes('Ticket Reference') &&
        headerValues.includes('Gate Check-In Status') &&
        headerValues.includes('Question: T-Shirt Size') &&
        headerValues.includes('Payment UTR / Ref'),
      'Header row must include base columns, dynamic custom question labels, and payment columns',
      `Headers: ${headerValues.join(', ')}`
    )

    // Verify Row 6 (Alice Johnson - solo confirmed, checked in)
    const aliceRow = attendeeSheet.getRow(6).values as any[]
    assert(
      aliceRow.includes('Alice Johnson') &&
        aliceRow.includes('Admitted Inside') &&
        aliceRow.includes('M'), // T-shirt size answer
      'Alice Johnson row must display correct name, "Admitted Inside" gate status, and "M" custom response'
    )

    // Verify Row 7 (Bob Cyber - Team Leader, checked out)
    const bobRow = attendeeSheet.getRow(7).values as any[]
    assert(
      bobRow.includes('CyberHawks') &&
        bobRow.includes('Team Leader') &&
        bobRow.includes('Checked Out'),
      'Bob Cyber row must display team name "CyberHawks", "Team Leader" role, and "Checked Out" gate status'
    )

    // Verify Row 10 (Hacker row - formula injection prevented)
    const hackerRow = attendeeSheet.getRow(10).values as any[]
    const sanitizedName = hackerRow.find((v) => typeof v === 'string' && v.includes('CMD'))
    assert(
      typeof sanitizedName === 'string' && sanitizedName.startsWith("'="),
      'Malicious attendee name starting with "=" must be safely escaped with leading single quote',
      `Received cell value: ${sanitizedName}`
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 3: Authorization & Sensitive Payment Data Isolation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\nTEST GROUP 3: Authorization & Sensitive Payment Data Isolation')

  // When unauthorized, buildFullAttendeesWorkbook MUST NOT leak payment columns
  const unauthorizedFullWb = await buildFullAttendeesWorkbook({
    event: mockEvent,
    registrations: mockRegistrations,
    checkIns: mockCheckIns,
    payments: mockPayments,
    isAuthorized: false, // Unauthorized!
  })

  const unauthSheet = unauthorizedFullWb.getWorksheet('Attendee Directory')
  if (unauthSheet) {
    const unauthHeaders = (unauthSheet.getRow(5).values as string[]).filter(Boolean)
    assert(
      !unauthHeaders.includes('Payment UTR / Ref') && !unauthHeaders.includes('Amount Paid (INR)'),
      'Unauthorized organizer exports must strictly exclude sensitive financial/UTR columns',
      `Headers present: ${unauthHeaders.join(', ')}`
    )
  }

  // Payments workbook builder MUST throw Error when isAuthorized is false
  let threwAuthError = false
  try {
    await buildPaymentsWorkbook({
      event: mockEvent,
      payments: mockPayments,
      isAuthorized: false, // Unauthorized!
    })
  } catch (err: any) {
    threwAuthError = true
    assert(
      err.message.includes('Unauthorized'),
      'buildPaymentsWorkbook must reject unauthorized access with an explicit error message',
      `Error caught: ${err.message}`
    )
  }
  assert(threwAuthError, 'Attempting unauthorized payments export must strictly throw an error')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 4: Gate Attendance & Turnstile Log (.xlsx)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\nTEST GROUP 4: Gate Attendance & Turnstile Log (.xlsx)')

  const attendanceWb = await buildAttendanceWorkbook({
    event: mockEvent,
    registrations: mockRegistrations,
    checkIns: mockCheckIns,
  })

  const attBuffer = (await attendanceWb.xlsx.writeBuffer()) as Buffer
  const reloadedAttWb = new ExcelJS.Workbook()
  await reloadedAttWb.xlsx.load(attBuffer as any)

  const attSheet = reloadedAttWb.getWorksheet('Gate Attendance Log')
  assert(
    Boolean(attSheet),
    'Gate Attendance worksheet must be named "Gate Attendance Log"'
  )

  if (attSheet) {
    // Verify metadata summary block on row 3
    const summaryCell = attSheet.getCell('A3').value as string
    assert(
      typeof summaryCell === 'string' &&
        summaryCell.includes('Admitted Inside: 1') &&
        summaryCell.includes('Checked Out: 1'),
      'Turnstile summary row must calculate exact counts of inside attendees and exited check-outs',
      `Summary line: ${summaryCell}`
    )

    // Verify operator ID columns
    const attHeaders = (attSheet.getRow(5).values as string[]).filter(Boolean)
    assert(
      attHeaders.includes('Verified Operator ID') &&
        attHeaders.includes('Checkout Operator ID') &&
        attHeaders.includes('Operator Turnstile Notes'),
      'Attendance report must include operator audit trail and gate turnstile notes',
      `Headers: ${attHeaders.join(', ')}`
    )

    // Check Bob row (2 entries, checked out by operator_gate_beta)
    const bobAttRow = attSheet.getRow(7).values as any[]
    assert(
      bobAttRow.includes('Checked Out') &&
        bobAttRow.includes('operator_gate_beta') &&
        bobAttRow.includes('Lunch break exit'),
      'Bob Cyber attendance record must show "Checked Out", checkout operator ID, and exit note'
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 5: Squads & Team Membership Rosters (.xlsx)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\nTEST GROUP 5: Squads & Team Membership Rosters (.xlsx)')

  const teamsWb = await buildTeamsWorkbook({
    event: mockEvent,
    registrations: mockRegistrations,
  })

  const teamsBuffer = (await teamsWb.xlsx.writeBuffer()) as Buffer
  const reloadedTeamsWb = new ExcelJS.Workbook()
  await reloadedTeamsWb.xlsx.load(teamsBuffer as any)

  const teamsSheet = reloadedTeamsWb.getWorksheet('Squads & Rosters')
  assert(
    Boolean(teamsSheet),
    'Squads worksheet must be named "Squads & Rosters"'
  )

  if (teamsSheet) {
    // CyberHawks has 1 leader + 2 squad members = 3 rows in the roster table
    // Row 6: Leader (Bob Cyber)
    // Row 7: Member #1 (David Member)
    // Row 8: Member #2 (Eva Member)
    const leaderRow = teamsSheet.getRow(6).values as any[]
    assert(
      leaderRow.includes('CyberHawks') &&
        leaderRow.includes('Team Leader') &&
        leaderRow.includes('Bob Cyber'),
      'Squad roster row 1 must feature the Team Leader with squad role "Team Leader"'
    )

    const member1Row = teamsSheet.getRow(7).values as any[]
    assert(
      member1Row.includes('CyberHawks') &&
        member1Row.includes('Squad Member #1') &&
        member1Row.includes('David Member') &&
        member1Row.includes('CS2026-042'),
      'Squad roster row 2 must feature Member #1 with student ID and distinct squad role'
    )

    const member2Row = teamsSheet.getRow(8).values as any[]
    assert(
      member2Row.includes('CyberHawks') &&
        member2Row.includes('Squad Member #2') &&
        member2Row.includes('Eva Member') &&
        member2Row.includes('CS2026-089'),
      'Squad roster row 3 must feature Member #2 with student ID and distinct squad role'
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 6: Payment Reconciliation & Financial UTR Audit (.xlsx)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\nTEST GROUP 6: Payment Reconciliation & Financial UTR Audit (.xlsx)')

  const paymentsWb = await buildPaymentsWorkbook({
    event: mockEvent,
    payments: mockPayments,
    isAuthorized: true,
  })

  const paymentsBuffer = (await paymentsWb.xlsx.writeBuffer()) as Buffer
  const reloadedPaymentsWb = new ExcelJS.Workbook()
  await reloadedPaymentsWb.xlsx.load(paymentsBuffer as any)

  const paySheet = reloadedPaymentsWb.getWorksheet('Payment Reconciliation')
  assert(
    Boolean(paySheet),
    'Payment worksheet must be named "Payment Reconciliation"'
  )

  if (paySheet) {
    // Total approved revenue calculation check: 1 approved * 299 = 299
    const revenueLine = paySheet.getCell('A3').value as string
    assert(
      typeof revenueLine === 'string' &&
        revenueLine.includes('Approved: 1') &&
        revenueLine.includes('Pending Review: 1'),
      'Financial audit summary row must reflect exact count of approved and pending reviews',
      `Summary line: ${revenueLine}`
    )

    // Check Alice Payment row
    const alicePayRow = paySheet.getRow(6).values as any[]
    assert(
      alicePayRow.includes('UTR123456789012') &&
        alicePayRow.includes('APPROVED') &&
        alicePayRow.includes('SBI UPI payment confirmed') &&
        alicePayRow.includes('organizer_finance_lead'),
      'Approved payment row must contain verified UTR number, approval status, notes, and reviewer ID'
    )

    // Check Charlie Payment row
    const charliePayRow = paySheet.getRow(7).values as any[]
    assert(
      charliePayRow.includes('UTR987654321098') &&
        charliePayRow.includes('PENDING_REVIEW'),
      'Pending review payment row must display submitted UTR and "PENDING_REVIEW" status'
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n=================================================================')
  console.log(` Phase 5 Test Results: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`)
  console.log('=================================================================\n')

  if (failedTests > 0) {
    process.exit(1)
  }
}

runPhase5TestSuite().catch((err) => {
  console.error('Fatal error executing Phase 5 test suite:', err)
  process.exit(1)
})
