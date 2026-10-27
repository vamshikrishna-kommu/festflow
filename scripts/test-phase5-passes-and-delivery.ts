/**
 * FestFlow Phase 5: Digital Passes, QR Codes & Email Delivery Test Suite
 *
 * Verifies:
 * 1. Free-event digital pass issuance (no payment required)
 * 2. Paid-event pass locking (unpaid/unverified payment does not issue valid pass)
 * 3. Pending-approval state (shows pending status, not confirmed entry pass)
 * 4. Verified payment pass activation (pass confirmed only after trusted payment)
 * 5. Failed payment behavior (entry remains locked, student can retry)
 * 6. QR Token opacity & privacy (no PII, credentials, or secrets in QR token)
 * 7. Team events: team pass vs individual member passes and check-ins
 * 8. Pass revocation & invalidation (cancelled or rejected registrations void for entry)
 * 9. Transactional email lifecycle & outbox logging
 * 10. Duplicate callback & idempotency protection
 * 11. Pass resend functionality & validation
 */

import {
  registerForEvent,
  reviewRegistrationApplication,
  cancelRegistration,
} from '../src/lib/registrations.js'
import {
  submitPaymentProof,
  reviewPaymentSubmission,
} from '../src/lib/payments.js'
import {
  checkInTicket,
  cleanTicketPayload,
} from '../src/lib/checkin.js'
import {
  triggerTransactionalEmail,
  sendRegistrationConfirmedEmail,
  sendApplicationSubmittedEmail,
  resendPassEmail,
  getLocalOutbox,
} from '../src/lib/emails.js'
import type { EventRecord } from '../src/types/index.js'

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

// Mock browser localStorage for Node/tsx testing environment
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

if (typeof globalThis.localStorage === 'undefined') {
  ;(globalThis as any).localStorage = new MockLocalStorage()
}

// Mock window.location for email URLs
if (typeof globalThis.window === 'undefined') {
  ;(globalThis as any).window = {
    location: { origin: 'https://festflow.com' },
  }
}

// Seed mock events for tests
const mockEvents: EventRecord[] = [
  {
    id: 'evt-free-auto',
    slug: 'open-source-summit',
    club_id: 'club-1',
    title: 'Open Source Campus Summit',
    summary: 'A free community tech summit.',
    description: 'Learn open source and contribute.',
    category: 'tech',
    poster_url: null,
    start_date: new Date(Date.now() + 86400000 * 5).toISOString(),
    end_date: new Date(Date.now() + 86400000 * 5 + 3600000 * 4).toISOString(),
    venue_name: 'Tech Auditorium',
    venue_address: 'Block A, Main Campus',
    event_type: 'in_person',
    registration_opens_at: null,
    registration_closes_at: null,
    capacity: 200,
    is_free: true,
    price: 0,
    currency: 'INR',
    eligibility: null,
    rules: null,
    contact_email: 'tech@campus.edu',
    contact_phone: null,
    online_meeting_url: null,
    timezone: 'Asia/Kolkata',
    approval_type: 'automatic',
    participation_type: 'individual',
    min_team_size: 1,
    max_team_size: 1,
    leader_counts_towards_size: true,
    team_registration_mode: 'leader_submits_all',
    require_team_name: false,
    allowed_colleges: null,
    allowed_departments: null,
    allowed_years: null,
    custom_questions: [],
    participant_fields: { require_phone: false, require_college: false, require_department: false, require_year: false, require_student_id: false },
    status: 'published',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'evt-paid-online',
    slug: 'robotics-masterclass',
    club_id: 'club-1',
    title: 'Robotics Bootcamp & Kit',
    summary: 'Hands-on robotics masterclass.',
    description: 'Hardware kit included.',
    category: 'workshop',
    poster_url: null,
    start_date: new Date(Date.now() + 86400000 * 6).toISOString(),
    end_date: new Date(Date.now() + 86400000 * 6 + 3600000 * 5).toISOString(),
    venue_name: 'Robotics Lab 3',
    venue_address: 'Robotics Wing',
    event_type: 'in_person',
    registration_opens_at: null,
    registration_closes_at: null,
    capacity: 50,
    is_free: false,
    price: 499,
    currency: 'INR',
    eligibility: null,
    rules: null,
    contact_email: 'robotics@campus.edu',
    contact_phone: null,
    online_meeting_url: null,
    timezone: 'Asia/Kolkata',
    approval_type: 'automatic',
    participation_type: 'individual',
    min_team_size: 1,
    max_team_size: 1,
    leader_counts_towards_size: true,
    team_registration_mode: 'leader_submits_all',
    require_team_name: false,
    allowed_colleges: null,
    allowed_departments: null,
    allowed_years: null,
    custom_questions: [],
    participant_fields: { require_phone: false, require_college: false, require_department: false, require_year: false, require_student_id: false },
    status: 'published',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'evt-manual-review',
    slug: 'leadership-fellowship',
    club_id: 'club-1',
    title: 'Campus Leadership Fellowship',
    summary: 'Competitive selective program.',
    description: 'Organizer approval required.',
    category: 'cultural',
    poster_url: null,
    start_date: new Date(Date.now() + 86400000 * 7).toISOString(),
    end_date: new Date(Date.now() + 86400000 * 7 + 3600000 * 4).toISOString(),
    venue_name: 'Council Hall',
    venue_address: 'Student Centre',
    event_type: 'in_person',
    registration_opens_at: null,
    registration_closes_at: null,
    capacity: 30,
    is_free: true,
    price: 0,
    currency: 'INR',
    eligibility: null,
    rules: null,
    contact_email: 'council@campus.edu',
    contact_phone: null,
    online_meeting_url: null,
    timezone: 'Asia/Kolkata',
    approval_type: 'manual',
    participation_type: 'individual',
    min_team_size: 1,
    max_team_size: 1,
    leader_counts_towards_size: true,
    team_registration_mode: 'leader_submits_all',
    require_team_name: false,
    allowed_colleges: null,
    allowed_departments: null,
    allowed_years: null,
    custom_questions: [],
    participant_fields: { require_phone: false, require_college: false, require_department: false, require_year: false, require_student_id: false },
    status: 'published',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'evt-team-hackathon',
    slug: 'campus-hackathon-2026',
    club_id: 'club-1',
    title: 'FestFlow Campus Hackathon 2026',
    summary: '24-hour team hackathon.',
    description: 'Teams of 2 to 4 students.',
    category: 'hackathon',
    poster_url: null,
    start_date: new Date(Date.now() + 86400000 * 10).toISOString(),
    end_date: new Date(Date.now() + 86400000 * 11).toISOString(),
    venue_name: 'Main Innovation Hall',
    venue_address: 'Campus IT Park',
    event_type: 'in_person',
    registration_opens_at: null,
    registration_closes_at: null,
    capacity: 100,
    is_free: true,
    price: 0,
    currency: 'INR',
    eligibility: null,
    rules: null,
    contact_email: 'hackathon@campus.edu',
    contact_phone: null,
    online_meeting_url: null,
    timezone: 'Asia/Kolkata',
    approval_type: 'automatic',
    participation_type: 'team',
    min_team_size: 2,
    max_team_size: 4,
    leader_counts_towards_size: true,
    team_registration_mode: 'leader_submits_all',
    require_team_name: true,
    allowed_colleges: null,
    allowed_departments: null,
    allowed_years: null,
    custom_questions: [],
    participant_fields: { require_phone: false, require_college: false, require_department: false, require_year: false, require_student_id: false },
    status: 'published',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

localStorage.setItem('festflow_managed_events', JSON.stringify(mockEvents))

async function runPhase5TestSuite() {
  console.log('\n======================================================================')
  console.log('FESTFLOW PHASE 5: DIGITAL PASSES, QR CODES & EMAIL DELIVERY TEST SUITE')
  console.log('======================================================================\n')

  // ── TEST 1: Free-Event Digital Pass Generation ───────────────────────────
  console.log('[1/11] Testing Free-Event Pass Issuance & QR Token Generation...')
  const freeRegRes = await registerForEvent('evt-free-auto', 'student_free_user')
  assert(freeRegRes.success === true, 'Free event registration succeeds')
  assert(freeRegRes.status === 'confirmed', 'Free event pass status is immediately "confirmed"')
  assert(Boolean(freeRegRes.ticket_code && freeRegRes.ticket_code.startsWith('FF-')), 'Unique ticket code generated (FF-...)')
  assert(Boolean(freeRegRes.qr_token && freeRegRes.qr_token.startsWith('FFQ_')), 'Secure unpredictable QR token generated (FFQ_...)')
  assert(freeRegRes.ticket_issued === true, 'Digital pass issued without payment')

  // ── TEST 2: QR Token Opacity & Privacy ───────────────────────────────────
  console.log('\n[2/11] Testing QR Token Privacy & Cryptographic Opacity...')
  const qrToken = freeRegRes.qr_token!
  const qrUri = `festflow://pass/${qrToken}`
  assert(!qrUri.includes('@'), 'QR payload contains NO email address')
  assert(!qrUri.includes('phone') && !qrUri.includes('+91'), 'QR payload contains NO phone number')
  assert(!qrUri.includes('secret') && !qrUri.includes('rzp_'), 'QR payload contains NO payment secrets or API keys')
  assert(qrUri.startsWith('festflow://pass/FFQ_'), 'QR payload uses standardized opaque protocol (festflow://pass/FFQ_...)')

  // ── TEST 3: Free Pass Check-In Verification ──────────────────────────────
  console.log('\n[3/11] Testing Gate Scanner Check-In with Free Pass QR Token...')
  const checkinFree = await checkInTicket('evt-free-auto', qrUri)
  assert(checkinFree.success === true, 'Scanner verifies confirmed free event pass')
  assert(checkinFree.outcome === 'VALID', 'Check-in outcome is VALID')

  // Duplicate scan check
  const duplicateFreeScan = await checkInTicket('evt-free-auto', qrUri)
  assert(duplicateFreeScan.success === false, 'Duplicate scan is rejected')
  assert(duplicateFreeScan.outcome === 'ALREADY_USED', 'Duplicate outcome is ALREADY_USED')

  // ── TEST 4: Paid-Event Pass Lockout (Unpaid) ─────────────────────────────
  console.log('\n[4/11] Testing Paid-Event Pass Lockout (Payment Pending)...')
  const paidRegRes = await registerForEvent('evt-paid-online', 'student_paid_user')
  assert(paidRegRes.success === true, 'Paid event application accepted')
  assert(paidRegRes.status === 'pending_payment', 'Paid event status is "pending_payment"')
  assert(paidRegRes.ticket_issued === false, 'Pass is NOT issued while payment is pending')

  // Gate entry check-in with unpaid ticket must be blocked
  const checkinUnpaid = await checkInTicket('evt-paid-online', paidRegRes.ticket_code!)
  assert(checkinUnpaid.success === false, 'Unpaid ticket scan is rejected at gate')
  assert(checkinUnpaid.outcome === 'NOT_CONFIRMED', 'Outcome is NOT_CONFIRMED (payment required)')

  // ── TEST 5: Pending Approval Registration Lockout ─────────────────────────
  console.log('\n[5/11] Testing Host Approval Review State Lockout...')
  const reviewRegRes = await registerForEvent('evt-manual-review', 'student_applicant')
  assert(reviewRegRes.success === true, 'Application submitted for host review')
  assert(reviewRegRes.status === 'pending_approval', 'Status is "pending_approval"')
  assert(reviewRegRes.ticket_issued === false, 'Pass is NOT issued while under review')

  // Gate entry check-in with unapproved application must be blocked
  const checkinPendingApproval = await checkInTicket('evt-manual-review', reviewRegRes.ticket_code!)
  assert(checkinPendingApproval.success === false, 'Unapproved application scan is rejected')
  assert(checkinPendingApproval.outcome === 'NOT_CONFIRMED', 'Outcome is NOT_CONFIRMED')

  // Organizer approves registration
  const approveRes = await reviewRegistrationApplication(reviewRegRes.registration_id!, 'approved')
  assert(approveRes.success === true, 'Organizer successfully approves application')
  assert(approveRes.status === 'confirmed', 'Application becomes "confirmed" after approval (free event)')

  // Gate entry now succeeds
  const checkinAfterApproval = await checkInTicket('evt-manual-review', reviewRegRes.ticket_code!)
  assert(checkinAfterApproval.success === true, 'Pass unlocks for entry after host approval')
  assert(checkinAfterApproval.outcome === 'VALID', 'Check-in outcome is now VALID')

  // ── TEST 6: Verified UPI Payment Pass Activation ─────────────────────────
  console.log('\n[6/11] Testing Paid Event Pass Activation After Payment Verification...')
  const subRes = await submitPaymentProof({
    registrationId: paidRegRes.registration_id!,
    transactionReference: '428910485923',
    notes: 'Paid via PhonePe',
  })
  assert(subRes.success === true, 'UPI payment proof submitted for paid registration')

  // Verify and approve payment submission
  const reviewRes = await reviewPaymentSubmission({
    paymentId: subRes.submission_id!,
    decision: 'approved',
    notes: 'Payment verified in bank account',
  })
  assert(reviewRes.success === true, 'Payment verified and approved successfully')
  assert(reviewRes.status === 'approved', 'Payment submission marked as approved')

  // Gate check-in with confirmed paid pass
  const checkinPaidConfirmed = await checkInTicket('evt-paid-online', paidRegRes.ticket_code!)
  assert(checkinPaidConfirmed.success === true, 'Paid pass unlocks for gate entry after verification')
  assert(checkinPaidConfirmed.outcome === 'VALID', 'Check-in outcome is VALID')

  // ── TEST 7: Rejected Payment Behavior ────────────────────────────────────
  console.log('\n[7/11] Testing Rejected Payment Behavior...')
  const failedRegRes = await registerForEvent('evt-paid-online', 'student_failed_pay_user')
  const failedSubRes = await submitPaymentProof({
    registrationId: failedRegRes.registration_id!,
    transactionReference: '000000000000',
    notes: 'Bogus transaction',
  })
  assert(failedSubRes.success === true, 'Submission recorded for rejection test')

  const rejectRes = await reviewPaymentSubmission({
    paymentId: failedSubRes.submission_id!,
    decision: 'rejected',
    notes: 'Invalid UTR, no transaction found in bank statement.',
  })
  assert(rejectRes.success === true, 'Payment rejection recorded safely with reason')

  // Ticket remains rejected (gate entry is NOT granted)
  const checkinFailed = await checkInTicket('evt-paid-online', failedRegRes.ticket_code!)
  assert(checkinFailed.success === false, 'Entry pass remains locked after payment rejection')
  assert(checkinFailed.outcome === 'CANCELLED', 'Outcome is CANCELLED')

  // ── TEST 8: Team Events & Individual Member Passes ────────────────────────
  console.log('\n[8/11] Testing Team Passes & Individual Member Check-Ins...')
  const teamRegRes = await registerForEvent('evt-team-hackathon', 'team_captain_user', {
    teamName: 'CyberKnights',
    teamMembers: [
      { name: 'Rohan Verma', email: 'rohan@college.edu', studentId: 'CS2026-01' },
      { name: 'Ananya Sen', email: 'ananya@college.edu', studentId: 'CS2026-02' },
    ],
  })
  assert(teamRegRes.success === true, 'Team registration created')
  assert(teamRegRes.status === 'confirmed', 'Free hackathon registration confirmed')

  // Check-in member 1 individually using member sub-pass token (-M1)
  const member1Token = `festflow://pass/${teamRegRes.qr_token}-M1`
  const member1Checkin = await checkInTicket('evt-team-hackathon', member1Token)
  assert(member1Checkin.success === true, 'Individual team member 1 checked in successfully')
  assert(member1Checkin.member_index === 1, 'Check-in records member_index = 1')
  assert(member1Checkin.student_name === 'Rohan Verma', 'Check-in identifies member name: Rohan Verma')

  // Member 1 duplicate scan rejected
  const member1Dupe = await checkInTicket('evt-team-hackathon', member1Token)
  assert(member1Dupe.success === false, 'Duplicate scan for Member 1 rejected')
  assert(member1Dupe.outcome === 'ALREADY_USED', 'Outcome is ALREADY_USED')

  // Member 2 can still check in independently
  const member2Token = `festflow://pass/${teamRegRes.qr_token}-M2`
  const member2Checkin = await checkInTicket('evt-team-hackathon', member2Token)
  assert(member2Checkin.success === true, 'Member 2 checks in independently without leader')
  assert(member2Checkin.member_index === 2, 'Check-in records member_index = 2')
  assert(member2Checkin.student_name === 'Ananya Sen', 'Check-in identifies member name: Ananya Sen')

  // ── TEST 9: Pass Revocation & Invalidation ────────────────────────────────
  console.log('\n[9/11] Testing Pass Revocation (Cancelled / Rejected)...')
  const toCancelReg = await registerForEvent('evt-free-auto', 'student_to_cancel')
  assert(toCancelReg.success === true, 'Initial registration confirmed')

  // Student cancels registration
  const cancelRes = await cancelRegistration(toCancelReg.registration_id!)
  assert(cancelRes.success === true, 'Registration successfully cancelled')

  // Attempt entry with revoked ticket
  const checkinCancelled = await checkInTicket('evt-free-auto', toCancelReg.ticket_code!)
  assert(checkinCancelled.success === false, 'Gate scanner rejects cancelled pass')
  assert(checkinCancelled.outcome === 'CANCELLED', 'Outcome is CANCELLED (ticket void)')

  // Rejection check: create and reject an application
  const toRejectReg = await registerForEvent('evt-manual-review', 'student_to_reject')
  await reviewRegistrationApplication(toRejectReg.registration_id!, 'rejected', 'Ineligible college branch.')
  const checkinRejected = await checkInTicket('evt-manual-review', toRejectReg.ticket_code!)
  assert(checkinRejected.success === false, 'Gate scanner rejects rejected application')
  assert(checkinRejected.outcome === 'CANCELLED', 'Outcome is CANCELLED')

  // ── TEST 10: Email Delivery Lifecycle & Outbox Logging ───────────────────
  console.log('\n[10/11] Testing Transactional Email Outbox & Idempotency...')
  const emailRes1 = await sendRegistrationConfirmedEmail({
    to: 'attendee@campus.edu',
    name: 'Student Attendee',
    eventTitle: 'Tech Summit 2026',
    ticketCode: 'FF-P5-EMAIL-01',
    qrToken: 'FFQ_EMAIL_P5_01',
    startDate: new Date().toISOString(),
    venueName: 'Main Auditorium',
    registrationId: 'reg_email_test_1',
    eventId: 'evt-free-auto',
  })
  assert(typeof emailRes1.message === 'string', 'Email dispatch execution returned result')

  // Verify outbox record exists
  const outbox = getLocalOutbox()
  const outboxEntry = outbox.find((item) => item.registration_id === 'reg_email_test_1')
  assert(Boolean(outboxEntry), 'Email outbox record logged in database/storage')
  assert(outboxEntry?.template === 'registration_confirmed', 'Logged correct template type')
  assert(outboxEntry?.idempotency_key === 'reg_confirmed_reg_email_test_1', 'Idempotency key recorded')

  // Duplicate email dispatch with same idempotency key must not duplicate
  const outboxLenBefore = outbox.length
  const dupeEmailRes = await sendRegistrationConfirmedEmail({
    to: 'attendee@campus.edu',
    name: 'Student Attendee',
    eventTitle: 'Tech Summit 2026',
    ticketCode: 'FF-P5-EMAIL-01',
    qrToken: 'FFQ_EMAIL_P5_01',
    startDate: new Date().toISOString(),
    venueName: 'Main Auditorium',
    registrationId: 'reg_email_test_1',
    eventId: 'evt-free-auto',
  })
  assert(dupeEmailRes.message.includes('already queued/sent'), 'Duplicate email caught by idempotency key')
  const outboxLenAfter = getLocalOutbox().length
  assert(outboxLenAfter === outboxLenBefore, 'Outbox did NOT insert duplicate email')

  // ── TEST 11: Authorized Pass Resend Action ────────────────────────────────
  console.log('\n[11/11] Testing Authorized Pass Resend Action...')
  // Resend confirmed pass
  const resendConfirmed = await resendPassEmail(freeRegRes.registration_id!)
  assert(resendConfirmed.success === true, 'Resend pass succeeds for confirmed registration')

  // Resend unconfirmed/cancelled pass must fail
  const resendCancelled = await resendPassEmail(toCancelReg.registration_id!)
  assert(resendCancelled.success === false, 'Resend pass fails for cancelled/unconfirmed registration')
  assert(resendCancelled.message.includes('Only confirmed passes can be delivered') || resendCancelled.message.includes('cancelled'), 'Helpful rejection message returned')

  // ── SUMMARY REPORT ────────────────────────────────────────────────────────
  console.log('\n======================================================================')
  console.log(`TEST SUITE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`)
  console.log('======================================================================')

  if (failedTests > 0) {
    console.error(`\n❌ FAILED: ${failedTests} test(s) failed.\n`)
    process.exit(1)
  } else {
    console.log('\n🎉 ALL PHASE 5 TESTS PASSED PERFECTLY!\n')
    process.exit(0)
  }
}

runPhase5TestSuite().catch((err) => {
  console.error('Test execution error:', err)
  process.exit(1)
})
