/**
 * FestFlow Phase 4: Direct UPI Payments & Verification Test Suite
 * Tests direct UPI settings, UTR submissions, duplicate replay protection,
 * organizer review (approval/rejection), ticket activation, and lifecycle security.
 */

import {
  validateUpiId,
  getClubPaymentSettings,
  saveClubPaymentSettings,
  submitPaymentProof,
  reviewPaymentSubmission,
  getStudentPaymentSubmission,
} from '../src/lib/payments.js'

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

async function runPhase4Tests() {
  console.log('\n============================================================')
  console.log('FESTFLOW: DIRECT UPI PAYMENTS & VERIFICATION TEST SUITE')
  console.log('============================================================\n')

  // Setup seed mock events & registrations in localStorage
  const now = new Date()
  const mockEvents = [
    {
      id: 'evt_free_tech',
      title: 'Free Open Source Workshop',
      slug: 'free-open-source',
      price: 0,
      currency: 'INR',
      is_free: true,
      approval_type: 'automatic',
      status: 'published',
      club_id: 'club_dev_council',
      start_date: new Date(now.getTime() + 86400000 * 3).toISOString(),
    },
    {
      id: 'evt_paid_hackathon',
      title: 'National Hackathon 2026',
      slug: 'national-hackathon-2026',
      price: 499,
      currency: 'INR',
      is_free: false,
      approval_type: 'automatic',
      status: 'published',
      club_id: 'club_tech_council',
      start_date: new Date(now.getTime() + 86400000 * 5).toISOString(),
    },
  ]

  const mockRegistrations = [
    {
      id: 'reg_free_1',
      event_id: 'evt_free_tech',
      student_id: 'std_alice',
      ticket_code: 'TKT-FREE-001',
      status: 'confirmed',
      approval_status: 'approved',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    {
      id: 'reg_paid_1',
      event_id: 'evt_paid_hackathon',
      student_id: 'std_bob',
      ticket_code: 'TKT-PENDING-001',
      status: 'pending_payment',
      approval_status: 'approved',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    {
      id: 'reg_paid_2',
      event_id: 'evt_paid_hackathon',
      student_id: 'std_charlie',
      ticket_code: 'TKT-PENDING-002',
      status: 'pending_payment',
      approval_status: 'approved',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
  ]

  localStorage.setItem('festflow_local_events', JSON.stringify(mockEvents))
  localStorage.setItem('festflow_local_registrations', JSON.stringify(mockRegistrations))

  // --- Suite 1: UPI ID Validation ---
  console.log('--- Test Suite 1: UPI ID Validation ---')
  assert(validateUpiId('techfest@okaxis'), 'Valid standard UPI ID (techfest@okaxis)')
  assert(validateUpiId('robotics.club@icici'), 'Valid dotted UPI ID (robotics.club@icici)')
  assert(!validateUpiId(''), 'Rejects empty UPI ID')
  assert(!validateUpiId('invalid-upi'), 'Rejects UPI ID without handle (@bank)')
  assert(!validateUpiId('@bank'), 'Rejects UPI ID missing username prefix')

  // --- Suite 2: Organizer UPI Settings ---
  console.log('\n--- Test Suite 2: Organizer UPI Settings Configuration ---')
  const saveRes = await saveClubPaymentSettings({
    clubId: 'club_tech_council',
    upi_id: 'techcouncil@okaxis',
    account_name: 'Tech Council Official',
    payment_instructions: 'Include student ID in transfer remarks.',
  })
  assert(saveRes.success, 'Organizer can successfully save UPI payment settings')
  const retrievedSettings = await getClubPaymentSettings('club_tech_council')
  assert(retrievedSettings?.upi_id === 'techcouncil@okaxis', 'Retrieved UPI settings match saved details')
  assert(retrievedSettings?.account_name === 'Tech Council Official', 'Retrieved payee name matches')

  // --- Suite 3: Student UTR Submission ---
  console.log('\n--- Test Suite 3: Student UPI UTR Submission & Validation ---')
  const invalidRefRes = await submitPaymentProof({
    registrationId: 'reg_paid_1',
    transactionReference: '12', // too short
  })
  assert(!invalidRefRes.success, 'Rejects UTR shorter than 4 characters')

  const validSubmissionRes = await submitPaymentProof({
    registrationId: 'reg_paid_1',
    transactionReference: '428910485923',
    notes: 'Paid via Google Pay from HDFC',
  })
  assert(validSubmissionRes.success, 'Student successfully submits valid 12-digit UTR')
  assert(validSubmissionRes.status === 'pending_review', 'Submission enters pending_review state')

  const studentSub = await getStudentPaymentSubmission('reg_paid_1')
  assert(studentSub?.transaction_reference === '428910485923', 'Submitted UTR recorded accurately')
  assert(studentSub?.status === 'pending_review', 'Payment submission is under review')

  // --- Suite 4: Replay Protection & Duplicate UTR Rejection ---
  console.log('\n--- Test Suite 4: Replay Protection (Duplicate UTR Detection) ---')
  const duplicateRes = await submitPaymentProof({
    registrationId: 'reg_paid_2',
    transactionReference: '428910485923', // duplicate UTR
  })
  assert(!duplicateRes.success, 'Prevents duplicate UTR submission for an active event registration')
  assert(duplicateRes.error_code === 'DUPLICATE_REFERENCE', 'Returns DUPLICATE_REFERENCE error code')

  // --- Suite 5: Organizer Rejection Flow with Mandatory Reason ---
  console.log('\n--- Test Suite 5: Organizer Rejection with Feedback ---')
  const rejectWithoutReason = await reviewPaymentSubmission({
    paymentId: validSubmissionRes.submission_id!,
    decision: 'rejected',
    notes: '', // empty
  })
  assert(!rejectWithoutReason.success, 'Rejects payment review without stated rejection reason')
  assert(rejectWithoutReason.error_code === 'REASON_REQUIRED', 'Enforces REASON_REQUIRED error')

  const rejectWithReason = await reviewPaymentSubmission({
    paymentId: validSubmissionRes.submission_id!,
    decision: 'rejected',
    notes: 'Transaction reference not found in bank account statement for that amount.',
  })
  assert(rejectWithReason.success, 'Organizer successfully rejects submission with clear explanation')
  assert(rejectWithReason.status === 'rejected', 'Payment submission marked as rejected')

  // Verify registration is marked rejected so student can resubmit
  const regsAfterReject = JSON.parse(localStorage.getItem('festflow_local_registrations') || '[]')
  const targetRegAfterReject = regsAfterReject.find((r: any) => r.id === 'reg_paid_1')
  assert(targetRegAfterReject.status === 'rejected', 'Registration status set to rejected allowing student resubmission')

  // --- Suite 6: Student Resubmission Flow ---
  console.log('\n--- Test Suite 6: Student Resubmission with Corrected UTR ---')
  const correctedSubmission = await submitPaymentProof({
    registrationId: 'reg_paid_1',
    transactionReference: '998877665544',
    notes: 'Resubmitting with correct UTR from receipt',
  })
  assert(correctedSubmission.success, 'Student successfully resubmits corrected UTR')
  assert(correctedSubmission.status === 'pending_review', 'Resubmitted payment returns to pending_review')

  // --- Suite 7: Organizer Approval & Ticket Confirmation ---
  console.log('\n--- Test Suite 7: Organizer Approval & Ticket Issuance ---')
  const approveRes = await reviewPaymentSubmission({
    paymentId: correctedSubmission.submission_id!,
    decision: 'approved',
    notes: 'Deposit verified in club bank account.',
  })
  assert(approveRes.success, 'Organizer successfully verifies and approves payment')
  assert(approveRes.status === 'approved', 'Payment status marked as approved')
  assert(Boolean(approveRes.ticket_code), 'Valid entry ticket code issued upon approval')

  const regsAfterApprove = JSON.parse(localStorage.getItem('festflow_local_registrations') || '[]')
  const confirmedReg = regsAfterApprove.find((r: any) => r.id === 'reg_paid_1')
  assert(confirmedReg.status === 'confirmed', 'Registration atomically confirmed upon payment verification')
  assert(Boolean(confirmedReg.ticket_issued_at), 'ticket_issued_at timestamp set upon confirmation')

  // --- Suite 8: Ticket Activation Guard ---
  console.log('\n--- Test Suite 8: Security Guard (No Ticket Confirmation Before Payment) ---')
  const pendingReg = regsAfterApprove.find((r: any) => r.id === 'reg_paid_2')
  assert(pendingReg.status === 'pending_payment', 'Unverified registration remains pending_payment (no ticket confirmed)')

  console.log('\n============================================================')
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`)
  console.log('============================================================\n')

  if (failedTests > 0) {
    process.exit(1)
  }
}

runPhase4Tests().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
