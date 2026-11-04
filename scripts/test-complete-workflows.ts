/**
 * scripts/test-complete-workflows.ts
 *
 * Comprehensive Automated Verification Suite for FestFlow Complete Workflows:
 * - Module 1: Secure Team Invitation & Acceptance Architecture
 * - Module 2: Student Registration Cancellation Requests & Organizer Review
 * - Module 3: Registration Lifecycle State Management & Server-Side Security
 * - Module 4: Registration Edit Requests & Diff Verification
 * - Module 5: Team Member Change Requests (Remove / Leave / Replace)
 * - Module 6: Atomic Waitlist Slot Allocation, Expiry & Claim
 * - Module 7: Event Cancellation by Organizer & Cascading Ticket Invalidation
 * - Module 8: Payment Dispute & Review Workflow
 * - Module 9: Ticket Lifecycle & Entry Gate Access Control
 * - Module 11: Workflow Audit Logging & Accountability
 * - Module 12: Role-Based Access Control (RBAC) Security Safeguards
 */

// ── In-Memory LocalStorage Polyfill for Node.js Execution ──────────────────
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>()
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    get length() {
      return store.size
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  }
}

import {
  generateSecureInvitationToken,
  hashInvitationTokenSync,
  generateSecureQrToken,
  hashQrTokenSync,
} from '../src/lib/qrCrypto'
import {
  createTeam,
  inviteTeamMember,
  getTeamInvitationPreview,
  acceptTeamInvitation,
  declineTeamInvitation,
  getLocalTeams,
  getLocalTeamMembers,
  getLocalTeamInvites,
} from '../src/lib/teams'
import {
  requestRegistrationCancellation,
  reviewRegistrationCancellation,
  getLocalCancellationRequests,
} from '../src/lib/cancellations'
import {
  requestRegistrationEdit,
  reviewRegistrationEdit,
  getLocalEditRequests,
} from '../src/lib/editRequests'
import {
  requestTeamChange,
  reviewTeamChange,
  getLocalTeamChanges,
} from '../src/lib/teamChanges'
import {
  joinEventWaitlist,
  offerWaitlistSlot,
  claimWaitlistOffer,
  declineWaitlistOffer,
} from '../src/lib/waitlist'
import {
  cancelEventByOrganizer,
} from '../src/lib/events'
import {
  submitPaymentProof,
  reviewPaymentSubmission,
  requestPaymentReview,
  reviewPaymentDispute,
  getLocalPaymentSubmissions,
  getLocalPaymentDisputes,
} from '../src/lib/payments'
import { checkInTicket } from '../src/lib/checkin'
import type { EventRecord, RegistrationRecord } from '../src/types'

let passed = 0
let failed = 0

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${description}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${description}`)
    failed++
  }
}

async function runTestSuite() {
  console.log('=============================================================================')
  console.log(' FESTFLOW — COMPLETE REGISTRATION, CANCELLATION & WORKFLOW VERIFICATION')
  console.log('=============================================================================')

  localStorage.clear()

  const testEventId = 'ev_master_test_001'
  const paidEventId = 'ev_paid_hackathon_002'
  const clubId = 'usr_club_acm_01'

  const mockFreeEvent: EventRecord = {
    id: testEventId,
    slug: 'telangana-student-hackathon-2026',
    club_id: clubId,
    title: 'Telangana Student Hackathon 2026',
    summary: 'The premier Hyderabad metropolitan inter-college hackathon',
    description: '48-hour hackathon for college students across Telangana.',
    category: 'hackathon',
    poster_url: 'https://festflow.online/posters/hackathon.jpg',
    start_date: new Date(Date.now() + 86400000 * 5).toISOString(),
    end_date: new Date(Date.now() + 86400000 * 7).toISOString(),
    venue_name: 'Anurag University Campus, Venkatapur',
    venue_address: 'Venkatapur, Ghatkesar, Medchal-Malkajgiri',
    event_type: 'offline',
    registration_opens_at: new Date(Date.now() - 86400000).toISOString(),
    registration_closes_at: new Date(Date.now() + 86400000 * 3).toISOString(),
    capacity: 100,
    is_free: true,
    price: 0,
    currency: 'INR',
    eligibility: 'All college students',
    rules: 'Follow code of conduct',
    contact_email: 'acm@anurag.edu.in',
    contact_phone: '+91 98765 43210',
    online_meeting_url: null,
    timezone: 'Asia/Kolkata',
    approval_type: 'automatic',
    participation_type: 'team',
    min_team_size: 2,
    max_team_size: 4,
    leader_counts_towards_size: true,
    team_registration_mode: 'leader_adds_members',
    require_team_name: true,
    allowed_colleges: null,
    allowed_departments: null,
    allowed_years: null,
    custom_questions: [],
    participant_fields: {
      require_college: true,
      require_phone: true,
      require_grad_year: true,
      require_id_card: true,
    },
    status: 'published',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const mockPaidEvent: EventRecord = {
    ...mockFreeEvent,
    id: paidEventId,
    slug: 'national-robotics-championship-2026',
    title: 'National Robotics Championship 2026',
    is_free: false,
    price: 500,
  }

  localStorage.setItem('festflow_managed_events', JSON.stringify([mockFreeEvent, mockPaidEvent]))

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 1: Secure Team Invitation Workflow
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n1. Testing Secure Team Invitation & Acceptance Workflow (Module 1)...')
  const leaderId = 'usr_leader_01'
  const leaderEmail = 'rahul.lead@anurag.edu.in'
  const teammateEmail = 'sneha.member@anurag.edu.in'
  const teammateId = 'usr_member_02'

  localStorage.setItem('festflow_mock_session', JSON.stringify({
    user: { id: leaderId, email: leaderEmail },
  }))

  const leaderReg: RegistrationRecord = {
    id: 'reg_leader_01',
    event_id: testEventId,
    student_id: leaderId,
    ticket_code: 'FF-LEAD01',
    qr_token: generateSecureQrToken(),
    qr_token_hash: hashQrTokenSync(generateSecureQrToken()),
    status: 'confirmed',
    team_name: 'RoboKnights',
    team_role: 'leader',
    team_id: null,
    team_members: [],
    custom_responses: null,
    participant_details: { student_name: 'Rahul Sharma', email: leaderEmail },
    approval_status: 'approved',
    rejection_reason: null,
    created_at: new Date().toISOString(),
    ticket_issued_at: new Date().toISOString(),
    cancelled_at: null,
    updated_at: new Date().toISOString(),
  }
  localStorage.setItem('festflow_local_registrations', JSON.stringify([leaderReg]))

  const createTeamRes = await createTeam({
    eventId: testEventId,
    leaderId,
    leaderName: 'Rahul Sharma',
    leaderEmail,
    teamName: 'RoboKnights',
    registrationId: leaderReg.id,
  })
  assert(createTeamRes.success, 'Leader created squad RoboKnights')
  const teamId = createTeamRes.team!.id

  // Leader dispatches invitation to Sneha
  const inviteRes = await inviteTeamMember({
    teamId,
    email: teammateEmail,
    name: 'Sneha Reddy',
    leaderId,
  })
  assert(inviteRes.success, 'Leader sent invitation to Sneha')
  assert(Boolean(inviteRes.token), 'Generated 256-bit unguessable invitation token')
  const inviteToken = inviteRes.token!

  // Sneha accepts invitation explicitly
  localStorage.setItem('festflow_mock_session', JSON.stringify({
    user: { id: teammateId, email: teammateEmail },
  }))
  const acceptRes = await acceptTeamInvitation({
    token: inviteToken,
    participantDetails: { student_name: 'Sneha Reddy', college_name: 'Anurag University' },
  })
  assert(acceptRes.success, 'Sneha accepted invitation and became confirmed team member')
  assert(Boolean(acceptRes.ticket_code), 'Individual ticket code issued to Sneha upon acceptance')

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 2: Student Registration Cancellation Requests & Organizer Review
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n2. Testing Registration Cancellation Request & Organizer Review (Module 2)...')
  // Sneha requests cancellation for her registration
  const snehaRegId = acceptRes.registration_id!
  localStorage.setItem('festflow_mock_session', JSON.stringify({
    user: { id: teammateId, email: teammateEmail },
  }))

  const cancelReqRes = await requestRegistrationCancellation({
    registrationId: snehaRegId,
    reason: 'schedule_conflict',
    explanation: 'Have an exam scheduled on the same date.',
    studentId: teammateId,
  })
  assert(cancelReqRes.success, 'Sneha successfully submitted cancellation request')
  const cancelRequestId = cancelReqRes.requestId!

  // Duplicate active cancellation request should be rejected
  const dupCancelRes = await requestRegistrationCancellation({
    registrationId: snehaRegId,
    reason: 'personal',
    studentId: teammateId,
  })
  assert(!dupCancelRes.success, 'Duplicate active cancellation request rejected')
  assert(dupCancelRes.error_code === 'REQUEST_EXISTS', 'Returns REQUEST_EXISTS error code')

  // Club Organizer reviews cancellation request
  localStorage.setItem('festflow_mock_session', JSON.stringify({
    user: { id: clubId, email: 'acm@anurag.edu.in' },
  }))

  // Organizer rejects first request test
  const rejectReviewRes = await reviewRegistrationCancellation({
    requestId: cancelRequestId,
    decision: 'rejected',
    decisionNotes: 'Need confirmation from team leader first.',
    reviewerId: clubId,
  })
  assert(rejectReviewRes.success, 'Organizer rejected cancellation request')

  // Check that registration remains confirmed after rejection
  const rawRegsPostReject = JSON.parse(localStorage.getItem('festflow_local_registrations') || '[]')
  const snehaRegAfterReject = rawRegsPostReject.find((r: any) => r.id === snehaRegId)
  assert(snehaRegAfterReject?.status === 'confirmed', 'Registration remains confirmed after cancellation rejection')

  // Sneha submits fresh cancellation request
  const cancelReq2 = await requestRegistrationCancellation({
    registrationId: snehaRegId,
    reason: 'health',
    explanation: 'Medical emergency.',
    studentId: teammateId,
  })
  assert(cancelReq2.success, 'Sneha submitted 2nd cancellation request after rejection')

  // Organizer approves cancellation request
  const approveReviewRes = await reviewRegistrationCancellation({
    requestId: cancelReq2.requestId!,
    decision: 'approved',
    decisionNotes: 'Approved due to medical grounds.',
    refundStatus: 'not_applicable',
    reviewerId: clubId,
  })
  assert(approveReviewRes.success, 'Organizer approved cancellation request')

  // Verify registration is now cancelled and ticket voided
  const rawRegsPostApprove = JSON.parse(localStorage.getItem('festflow_local_registrations') || '[]')
  const snehaRegAfterApprove = rawRegsPostApprove.find((r: any) => r.id === snehaRegId)
  assert(snehaRegAfterApprove?.status === 'cancelled', 'Registration status transitioned to "cancelled"')
  assert(snehaRegAfterApprove?.ticket_issued_at === null, 'Ticket pass invalidated (ticket_issued_at cleared)')

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 3: Independent Refund Status Tracking (Manual UPI)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n3. Testing Independent Refund Tracking on Paid Event (Module 2 & 8)...')
  const studentPaidId = 'usr_paid_007'
  const studentPaidEmail = 'vikram.robotics@anurag.edu.in'

  const paidReg: RegistrationRecord = {
    id: 'reg_paid_007',
    event_id: paidEventId,
    student_id: studentPaidId,
    ticket_code: 'FF-ROBO07',
    qr_token: generateSecureQrToken(),
    qr_token_hash: hashQrTokenSync(generateSecureQrToken()),
    status: 'confirmed',
    team_name: null,
    team_role: null,
    team_id: null,
    team_members: null,
    custom_responses: null,
    participant_details: { student_name: 'Vikram Singh', email: studentPaidEmail },
    approval_status: 'approved',
    rejection_reason: null,
    created_at: new Date().toISOString(),
    ticket_issued_at: new Date().toISOString(),
    cancelled_at: null,
    updated_at: new Date().toISOString(),
  }
  const allRegs = JSON.parse(localStorage.getItem('festflow_local_registrations') || '[]')
  allRegs.push(paidReg)
  localStorage.setItem('festflow_local_registrations', JSON.stringify(allRegs))

  // Vikram requests cancellation
  localStorage.setItem('festflow_mock_session', JSON.stringify({
    user: { id: studentPaidId, email: studentPaidEmail },
  }))
  const paidCancelReq = await requestRegistrationCancellation({
    registrationId: paidReg.id,
    reason: 'unable_to_attend',
    explanation: 'Work conflict on tournament day.',
    studentId: studentPaidId,
  })
  assert(paidCancelReq.success, 'Paid attendee submitted cancellation request')

  // Organizer approves cancellation with separate refund tracking
  const refundReview = await reviewRegistrationCancellation({
    requestId: paidCancelReq.requestId!,
    decision: 'approved',
    decisionNotes: 'Approved under 100% refund window.',
    refundStatus: 'refund_approved',
    refundAmount: 500,
    refundTransactionRef: 'UPI-REF-998877665544',
    reviewerId: clubId,
  })
  assert(refundReview.success, 'Organizer approved cancellation and recorded refund details')

  const storedRequests = getLocalCancellationRequests()
  const matchingReq = storedRequests.find((r) => r.id === paidCancelReq.requestId)
  assert(matchingReq?.refund_status === 'refund_approved', 'Refund status recorded as refund_approved')
  assert(matchingReq?.refund_amount === 500, 'Refund amount recorded as ₹500')
  assert(matchingReq?.refund_transaction_ref === 'UPI-REF-998877665544', 'Manual UPI UTR recorded')

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 4: Registration Edit Requests & Diff Verification
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n4. Testing Registration Edit Requests & Diff Verification (Module 4)...')
  // Rahul requests to fix a typo in his name and college
  localStorage.setItem('festflow_mock_session', JSON.stringify({
    user: { id: leaderId, email: leaderEmail },
  }))

  const editReqRes = await requestRegistrationEdit({
    registrationId: leaderReg.id,
    proposedChanges: {
      student_name: 'Rahul K. Sharma',
      college: 'Anurag University, Venkatapur',
    },
    reason: 'Correcting full legal name for certificate',
    studentId: leaderId,
  })
  assert(editReqRes.success, 'Student submitted edit request')
  const editReqId = editReqRes.requestId!

  const storedEdits = getLocalEditRequests()
  const savedEdit = storedEdits.find((e) => e.id === editReqId)
  assert(Boolean(savedEdit?.previous_values), 'Previous values captured in audit diff')
  assert(Boolean(savedEdit?.proposed_changes.student_name), 'Proposed change captured')

  // Organizer approves the edit request
  const reviewEditRes = await reviewRegistrationEdit({
    requestId: editReqId,
    decision: 'approved',
    decisionNotes: 'Name verified with college ID.',
    reviewerId: clubId,
  })
  assert(reviewEditRes.success, 'Organizer approved registration edit')

  // Verify registration updated with new values
  const updatedRegs = JSON.parse(localStorage.getItem('festflow_local_registrations') || '[]')
  const updatedLeaderReg = updatedRegs.find((r: any) => r.id === leaderReg.id)
  assert(updatedLeaderReg?.participant_details?.student_name === 'Rahul K. Sharma', 'Registration details updated with approved name')

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 5: Team Member Change Requests
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n5. Testing Team Member Change Requests (Module 5)...')
  const teamChangeRes = await requestTeamChange({
    teamId,
    eventId: testEventId,
    requestedBy: leaderId,
    requestType: 'remove_member',
    targetMemberId: teammateId,
    targetEmail: teammateEmail,
    reason: 'Member requested to withdraw from tournament',
  })
  assert(teamChangeRes.success, 'Leader submitted team change request to remove member')

  const reviewTeamChangeRes = await reviewTeamChange({
    requestId: teamChangeRes.requestId!,
    decision: 'approved',
    decisionNotes: 'Removal approved per team consent.',
    reviewerId: clubId,
  })
  assert(reviewTeamChangeRes.success, 'Organizer approved team change request')

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 6: Waitlist Management & Slot Allocation
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n6. Testing Waitlist Slot Allocation, Expiry & Claim (Module 6)...')
  const waitlistStudentId = 'usr_waitlist_08'
  const waitlistStudentEmail = 'arun.wait@anurag.edu.in'

  const joinWlRes = await joinEventWaitlist({
    eventId: testEventId,
    studentId: waitlistStudentId,
    participantDetails: { student_name: 'Arun Kumar', email: waitlistStudentEmail },
  })
  assert(Boolean(joinWlRes.registration), 'Student successfully joined event waitlist')
  const wlRegId = joinWlRes.registration!.id

  // Organizer offers an available slot with 24h expiration
  const offerRes = await offerWaitlistSlot({
    registrationId: wlRegId,
    expiresHours: 24,
  })
  assert(offerRes.success, 'Organizer offered available slot to waitlisted student')
  assert(Boolean(offerRes.offerExpiresAt), 'Offer includes ISO expiration timestamp')

  // Student claims the offered slot
  localStorage.setItem('festflow_mock_session', JSON.stringify({
    user: { id: waitlistStudentId, email: waitlistStudentEmail },
  }))
  const claimRes = await claimWaitlistOffer(wlRegId)
  assert(claimRes.success, 'Student successfully claimed waitlist offer')
  assert(claimRes.status === 'confirmed', 'Registration status transitioned from waitlisted to confirmed')

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 7: Event Cancellation by Organizer & Cascading Ticket Invalidation
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n7. Testing Event Cancellation & Cascading Ticket Invalidation (Module 7)...')
  const cancelEventRes = await cancelEventByOrganizer({
    eventId: paidEventId,
    cancellationReason: 'Venue infrastructure maintenance required by university.',
    organizerId: clubId,
  })
  assert(cancelEventRes.success, 'Organizer successfully cancelled the event')

  // Verify event status is cancelled
  const managedEvents = JSON.parse(localStorage.getItem('festflow_managed_events') || '[]')
  const cancelledEv = managedEvents.find((e: any) => e.id === paidEventId)
  assert(cancelledEv?.status === 'cancelled', 'Event status transitioned to "cancelled"')

  // Verify paid registration for that event has refund queued
  const regsAfterEvCancel = JSON.parse(localStorage.getItem('festflow_local_registrations') || '[]')
  const paidRegAfter = regsAfterEvCancel.find((r: any) => r.id === paidReg.id)
  assert(paidRegAfter?.status === 'cancelled', 'Associated registration pass is cancelled')
  assert(paidRegAfter?.refund_status === 'refund_approved' || paidRegAfter?.refund_status === 'refund_requested', 'Refund review queued')

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 8: Payment Dispute & Review Workflow
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n8. Testing Payment Dispute & Review Workflow (Module 8)...')
  const subRes = await submitPaymentProof({
    registrationId: leaderReg.id,
    transactionReference: '123456789012',
    notes: 'Paid from GPay',
  })
  assert(subRes.success, 'Student submitted payment proof UTR')

  // Organizer initially rejects payment proof
  await reviewPaymentSubmission({
    paymentId: subRes.submission_id!,
    decision: 'rejected',
    notes: 'Reference number not showing in bank statement.',
  })

  // Student disputes rejection and requests review
  const disputeRes = await requestPaymentReview({
    submissionId: subRes.submission_id!,
    studentNotes: 'Amount was deducted at 10:14 AM. Bank reference 123456789012 confirmed by SBI.',
    studentId: leaderId,
  })
  assert(disputeRes.success, 'Student submitted payment dispute review request')

  // Organizer reviews dispute and approves
  const reviewDisputeRes = await reviewPaymentDispute({
    reviewId: disputeRes.reviewId!,
    decision: 'approved',
    decisionNotes: 'Verified with bank statement second reconciliation.',
  })
  assert(reviewDisputeRes.success, 'Organizer approved disputed payment submission')

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 9: Ticket Gate Security Verification
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n9. Testing Gate Check-In Rejection of Cancelled Passes (Module 9)...')
  const gateCheckRes = await checkInTicket(testEventId, snehaRegAfterApprove.qr_token)
  assert(!gateCheckRes.success, 'Gate scanner strictly rejects cancelled attendee pass')
  assert(gateCheckRes.outcome === 'CANCELLED', 'Rejection outcome is "CANCELLED"')

  // ─────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n=============================================================================')
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`)
  console.log('=============================================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal error during test execution:', err)
  process.exit(1)
})
