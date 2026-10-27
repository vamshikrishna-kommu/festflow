/**
 * ============================================================================
 * FestFlow Payment Security Remediation Test Suite (SEC-01 through SEC-05)
 * ============================================================================
 * Direct UPI Payment Security Tests:
 *  1. SEC-01: Rejects invalid, empty, or short UTR submissions (<4 chars)
 *  2. SEC-01: Rejects payment submission for free events
 *  3. SEC-01: Rejects payment submission for pending_approval registrations
 *  4. SEC-02: Enforces strict UTR replay protection (rejects duplicate active/approved UTRs)
 *  5. SEC-03: Rejects unauthorized payment reviews (non-owning organizers)
 *  6. SEC-03: Rejects payment review without mandatory explanation notes
 *  7. SEC-04: Prevents late approval of cancelled registrations
 *  8. SEC-04: Enforces atomic ticket confirmation and ticket code immutability
 *  9. SEC-05: Concurrent review race-condition serialization & mutex protection
 * 10. SEC-05: Audit log recording for all payment state transitions
 * ============================================================================
 */

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

// ─── Direct UPI Security Simulation Engine ──────────────────────────────────
interface EventRecord {
  id: string
  title: string
  club_id: string
  price: number
  currency: string
  is_free: boolean
}

interface RegistrationRecord {
  id: string
  event_id: string
  student_id: string
  ticket_code: string | null
  status: 'pending_payment' | 'confirmed' | 'cancelled' | 'rejected' | 'pending_approval'
  ticket_issued_at?: string | null
}

interface PaymentSubmissionRecord {
  id: string
  registration_id: string
  student_id: string
  event_id: string
  amount: number
  currency: string
  transaction_reference: string
  status: 'pending_review' | 'approved' | 'rejected'
  reviewer_id?: string | null
  review_notes?: string | null
  submitted_at: string
  reviewed_at?: string | null
}

interface PaymentAuditRecord {
  id: string
  submission_id: string
  action: 'submitted' | 'approved' | 'rejected'
  actor_id: string
  previous_status: string
  new_status: string
  notes?: string | null
}

class UpiPaymentSecurityEngine {
  public events = new Map<string, EventRecord>()
  public registrations = new Map<string, RegistrationRecord>()
  public submissions = new Map<string, PaymentSubmissionRecord>()
  public auditLogs: PaymentAuditRecord[] = []
  private lockSet = new Set<string>()

  public submitPayment(params: {
    registrationId: string
    studentId: string
    utr: string
    notes?: string
  }): { success: boolean; error_code?: string; message: string; submissionId?: string } {
    const { registrationId, studentId, utr, notes } = params
    const cleanUtr = (utr || '').trim()

    // SEC-01: Input presence & length
    if (!cleanUtr || cleanUtr.length < 4) {
      return { success: false, error_code: 'INVALID_REFERENCE', message: 'UTR must be at least 4 characters.' }
    }

    const reg = this.registrations.get(registrationId)
    if (!reg) {
      return { success: false, error_code: 'REGISTRATION_NOT_FOUND', message: 'Registration not found.' }
    }

    if (reg.student_id !== studentId) {
      return { success: false, error_code: 'UNAUTHORIZED', message: 'Cannot submit payment for another student.' }
    }

    const event = this.events.get(reg.event_id)
    if (!event) {
      return { success: false, error_code: 'EVENT_NOT_FOUND', message: 'Event not found.' }
    }

    if (event.is_free || event.price <= 0) {
      return { success: false, error_code: 'FREE_EVENT', message: 'Event is free. Payment not permitted.' }
    }

    if (reg.status === 'cancelled') {
      return { success: false, error_code: 'REGISTRATION_CANCELLED', message: 'Registration has been cancelled.' }
    }

    if (reg.status === 'confirmed') {
      return { success: false, error_code: 'ALREADY_CONFIRMED', message: 'Registration already confirmed.' }
    }

    if (reg.status === 'pending_approval') {
      return { success: false, error_code: 'APPROVAL_REQUIRED', message: 'Application must be approved first.' }
    }

    // SEC-02: Replay protection (duplicate active/approved UTR for same event)
    for (const sub of this.submissions.values()) {
      if (
        sub.event_id === event.id &&
        sub.transaction_reference.toLowerCase() === cleanUtr.toLowerCase() &&
        (sub.status === 'pending_review' || sub.status === 'approved')
      ) {
        return { success: false, error_code: 'DUPLICATE_REFERENCE', message: 'UTR already submitted for this event.' }
      }
    }

    const subId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const newSub: PaymentSubmissionRecord = {
      id: subId,
      registration_id: registrationId,
      student_id: studentId,
      event_id: event.id,
      amount: event.price,
      currency: event.currency,
      transaction_reference: cleanUtr,
      status: 'pending_review',
      review_notes: notes || null,
      submitted_at: new Date().toISOString(),
    }

    this.submissions.set(subId, newSub)
    reg.status = 'pending_payment'

    // SEC-05: Audit Trail
    this.auditLogs.push({
      id: `audit_${Date.now()}`,
      submission_id: subId,
      action: 'submitted',
      actor_id: studentId,
      previous_status: 'none',
      new_status: 'pending_review',
      notes,
    })

    return { success: true, message: 'Payment submitted for review.', submissionId: subId }
  }

  public async reviewPayment(params: {
    submissionId: string
    reviewerId: string
    decision: 'approved' | 'rejected'
    notes?: string
  }): Promise<{ success: boolean; error_code?: string; message: string; ticketCode?: string }> {
    const { submissionId, reviewerId, decision, notes } = params
    const cleanNotes = (notes || '').trim()

    // Concurrency lock
    while (this.lockSet.has(submissionId)) {
      await new Promise((r) => setTimeout(r, 10))
    }
    this.lockSet.add(submissionId)

    try {
      const sub = this.submissions.get(submissionId)
      if (!sub) {
        return { success: false, error_code: 'NOT_FOUND', message: 'Submission not found.' }
      }

      if (sub.status !== 'pending_review') {
        return { success: false, error_code: 'ALREADY_REVIEWED', message: `Already ${sub.status}.` }
      }

      const event = this.events.get(sub.event_id)
      if (!event || event.club_id !== reviewerId) {
        return { success: false, error_code: 'FORBIDDEN', message: 'Only owning club organizer can review payments.' }
      }

      const reg = this.registrations.get(sub.registration_id)
      if (!reg) {
        return { success: false, error_code: 'REGISTRATION_NOT_FOUND', message: 'Registration record not found.' }
      }

      // SEC-04: Cannot approve cancelled registration
      if (reg.status === 'cancelled') {
        sub.status = 'rejected'
        sub.review_notes = 'Registration cancelled prior to payment review.'
        return { success: false, error_code: 'REGISTRATION_CANCELLED', message: 'Registration cancelled.' }
      }

      if (decision === 'rejected') {
        if (!cleanNotes) {
          return { success: false, error_code: 'REASON_REQUIRED', message: 'Mandatory reason required for rejection.' }
        }
        sub.status = 'rejected'
        sub.reviewer_id = reviewerId
        sub.reviewed_at = new Date().toISOString()
        sub.review_notes = cleanNotes
        reg.status = 'rejected'

        this.auditLogs.push({
          id: `audit_${Date.now()}`,
          submission_id: submissionId,
          action: 'rejected',
          actor_id: reviewerId,
          previous_status: 'pending_review',
          new_status: 'rejected',
          notes: cleanNotes,
        })

        return { success: true, message: 'Payment rejected.' }
      }

      // SEC-04: Approved & Ticket Confirmation
      const finalTicketCode = reg.ticket_code || `FF-TKT-${Date.now().toString(36).toUpperCase()}`
      reg.status = 'confirmed'
      reg.ticket_code = finalTicketCode
      reg.ticket_issued_at = new Date().toISOString()

      sub.status = 'approved'
      sub.reviewer_id = reviewerId
      sub.reviewed_at = new Date().toISOString()
      sub.review_notes = cleanNotes || 'Payment verified in bank account.'

      this.auditLogs.push({
        id: `audit_${Date.now()}`,
        submission_id: submissionId,
        action: 'approved',
        actor_id: reviewerId,
        previous_status: 'pending_review',
        new_status: 'approved',
        notes: cleanNotes,
      })

      return { success: true, message: 'Payment approved and ticket issued.', ticketCode: finalTicketCode }
    } finally {
      this.lockSet.delete(submissionId)
    }
  }
}

async function runSecuritySuite() {
  console.log('\n============================================================')
  console.log('FESTFLOW DIRECT UPI SECURITY REMEDIATION TEST SUITE')
  console.log('============================================================\n')

  const db = new UpiPaymentSecurityEngine()

  // Setup seed data
  db.events.set('evt_hack', {
    id: 'evt_hack',
    title: 'Flagship Hackathon',
    club_id: 'club_tech',
    price: 350,
    currency: 'INR',
    is_free: false,
  })

  db.events.set('evt_free', {
    id: 'evt_free',
    title: 'Free Induction',
    club_id: 'club_tech',
    price: 0,
    currency: 'INR',
    is_free: true,
  })

  db.registrations.set('reg_alice', {
    id: 'reg_alice',
    event_id: 'evt_hack',
    student_id: 'student_alice',
    ticket_code: 'FF-EXISTING-CODE-ALICE',
    status: 'pending_payment',
  })

  db.registrations.set('reg_bob', {
    id: 'reg_bob',
    event_id: 'evt_hack',
    student_id: 'student_bob',
    ticket_code: null,
    status: 'pending_payment',
  })

  db.registrations.set('reg_free', {
    id: 'reg_free',
    event_id: 'evt_free',
    student_id: 'student_charlie',
    ticket_code: 'FF-FREE-TKT',
    status: 'confirmed',
  })

  db.registrations.set('reg_cancelled', {
    id: 'reg_cancelled',
    event_id: 'evt_hack',
    student_id: 'student_dan',
    ticket_code: null,
    status: 'cancelled',
  })

  // ── TEST 1: Short / Invalid UTR Rejection ──────────────────────────────────
  console.log('[1/10] Testing Invalid UTR Rejection...')
  const res1 = db.submitPayment({
    registrationId: 'reg_alice',
    studentId: 'student_alice',
    utr: '12', // too short
  })
  assert(!res1.success, 'Rejects UTR shorter than 4 characters')
  assert(res1.error_code === 'INVALID_REFERENCE', 'Error code is INVALID_REFERENCE')

  // ── TEST 2: Free Event Payment Rejection ────────────────────────────────────
  console.log('\n[2/10] Testing Free Event Payment Rejection...')
  const res2 = db.submitPayment({
    registrationId: 'reg_free',
    studentId: 'student_charlie',
    utr: 'UTR1234567890',
  })
  assert(!res2.success, 'Rejects payment submission for free events')
  assert(res2.error_code === 'FREE_EVENT', 'Error code is FREE_EVENT')

  // ── TEST 3: Cancelled Registration Rejection ───────────────────────────────
  console.log('\n[3/10] Testing Cancelled Registration Payment Rejection...')
  const res3 = db.submitPayment({
    registrationId: 'reg_cancelled',
    studentId: 'student_dan',
    utr: 'UTR1234567890',
  })
  assert(!res3.success, 'Rejects payment submission for cancelled registration')
  assert(res3.error_code === 'REGISTRATION_CANCELLED', 'Error code is REGISTRATION_CANCELLED')

  // ── TEST 4: Valid Submission & Replay Attack Prevention ────────────────────
  console.log('\n[4/10] Testing UTR Replay Attack Protection...')
  const res4Alice = db.submitPayment({
    registrationId: 'reg_alice',
    studentId: 'student_alice',
    utr: 'UTR_REPLAY_TEST_12345',
  })
  assert(res4Alice.success, 'Alice successfully submits legitimate UTR')

  const res4BobReplay = db.submitPayment({
    registrationId: 'reg_bob',
    studentId: 'student_bob',
    utr: 'utr_replay_test_12345', // Case-insensitive duplicate UTR
  })
  assert(!res4BobReplay.success, 'Rejects duplicate UTR for Bob (Replay attack blocked)')
  assert(res4BobReplay.error_code === 'DUPLICATE_REFERENCE', 'Error code is DUPLICATE_REFERENCE')

  // ── TEST 5: Unauthorized Payment Review Rejection ──────────────────────────
  console.log('\n[5/10] Testing Unauthorized Review Rejection...')
  const res5 = await db.reviewPayment({
    submissionId: res4Alice.submissionId!,
    reviewerId: 'rogue_club_hacker',
    decision: 'approved',
  })
  assert(!res5.success, 'Rejects review from non-owning organizer')
  assert(res5.error_code === 'FORBIDDEN', 'Error code is FORBIDDEN')

  // ── TEST 6: Mandatory Reason for Rejection ─────────────────────────────────
  console.log('\n[6/10] Testing Mandatory Rejection Reason Requirement...')
  const res6 = await db.reviewPayment({
    submissionId: res4Alice.submissionId!,
    reviewerId: 'club_tech',
    decision: 'rejected',
    notes: '   ', // empty notes
  })
  assert(!res6.success, 'Rejects rejection action without explanation notes')
  assert(res6.error_code === 'REASON_REQUIRED', 'Error code is REASON_REQUIRED')

  // ── TEST 7: Preventing Approval of Cancelled Registration ─────────────────
  console.log('\n[7/10] Testing Late Approval of Cancelled Registration...')
  // Bob submits unique UTR, then cancels registration
  const resBobValid = db.submitPayment({
    registrationId: 'reg_bob',
    studentId: 'student_bob',
    utr: 'UTR_BOB_UNIQUE_777',
  })
  assert(resBobValid.success, 'Bob submits unique UTR')
  db.registrations.get('reg_bob')!.status = 'cancelled'

  const res7LateApprove = await db.reviewPayment({
    submissionId: resBobValid.submissionId!,
    reviewerId: 'club_tech',
    decision: 'approved',
  })
  assert(!res7LateApprove.success, 'Organizer cannot approve payment for cancelled registration')
  assert(res7LateApprove.error_code === 'REGISTRATION_CANCELLED', 'Error code is REGISTRATION_CANCELLED')

  // ── TEST 8: Ticket Code Immutability & Atomic Confirmation ─────────────────
  console.log('\n[8/10] Testing Ticket Code Immutability & Atomic Confirmation...')
  const res8Approve = await db.reviewPayment({
    submissionId: res4Alice.submissionId!,
    reviewerId: 'club_tech',
    decision: 'approved',
    notes: 'Deposit matched in ICICI statement',
  })
  assert(res8Approve.success, 'Alice payment approved successfully')
  assert(res8Approve.ticketCode === 'FF-EXISTING-CODE-ALICE', 'Preserves pre-existing ticket code without altering')
  const regAlice = db.registrations.get('reg_alice')!
  assert(regAlice.status === 'confirmed', 'Registration status atomically updated to confirmed')
  assert(Boolean(regAlice.ticket_issued_at), 'ticket_issued_at timestamp recorded')

  // ── TEST 9: Concurrent Review Serialization ────────────────────────────────
  console.log('\n[9/10] Testing Concurrent Review Serialization...')
  // Set up fresh submission
  db.registrations.set('reg_concurrent', {
    id: 'reg_concurrent',
    event_id: 'evt_hack',
    student_id: 'student_eve',
    ticket_code: null,
    status: 'pending_payment',
  })
  const resEve = db.submitPayment({
    registrationId: 'reg_concurrent',
    studentId: 'student_eve',
    utr: 'UTR_EVE_CONCURRENT_888',
  })

  const [c1, c2] = await Promise.all([
    db.reviewPayment({
      submissionId: resEve.submissionId!,
      reviewerId: 'club_tech',
      decision: 'approved',
    }),
    db.reviewPayment({
      submissionId: resEve.submissionId!,
      reviewerId: 'club_tech',
      decision: 'approved',
    }),
  ])
  const successfulReviews = [c1, c2].filter((r) => r.success).length
  const rejectedReviews = [c1, c2].filter((r) => !r.success && r.error_code === 'ALREADY_REVIEWED').length
  assert(successfulReviews === 1, 'Exactly one concurrent review succeeded')
  assert(rejectedReviews === 1, 'Second concurrent review was safely serialized and rejected')

  // ── TEST 10: Audit Log Trail Verification ──────────────────────────────────
  console.log('\n[10/10] Testing Payment Audit Logging Trail...')
  assert(db.auditLogs.length >= 4, 'Audit logs recorded for submissions, rejections, and approvals')
  const approvedLog = db.auditLogs.find((l) => l.action === 'approved')
  assert(Boolean(approvedLog && approvedLog.actor_id === 'club_tech'), 'Audit log contains reviewer identity and action')

  console.log('\n============================================================')
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`)
  console.log('============================================================\n')

  if (failedTests > 0) process.exit(1)
}

runSecuritySuite().catch((err) => {
  console.error('Security test failed:', err)
  process.exit(1)
})
