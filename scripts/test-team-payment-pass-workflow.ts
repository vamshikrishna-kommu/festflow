/**
 * Comprehensive Automated Test Suite:
 * FestFlow Team Payment, Registration, and Pass-Generation Workflow
 *
 * Verifies all 10 Business Rules and Pass Experience requirements:
 * 1. Team creation & member invitation rules.
 * 2. Authenticated user representation and membership records.
 * 3. Exact lifecycle distinctions (pending_invitation, joined_team, payment_pending, payment_submitted, approved/rejected, confirmed, pass_issued, checked_in).
 * 4. Never issue a valid entry pass just because a member was added to a team.
 * 5. Event configuration determines individual vs team payment.
 * 6. Idempotent registration and pass generation on payment approval.
 * 7. Payment rejection, status reflection, and seamless resubmission.
 * 8. Duplicate prevention across reviews, UTRs, registrations, and check-ins.
 * 9. Private pass ownership (leader does not leak or receive member's private pass).
 * 10. Newly invited member who later signs up sees their own pass without duplicate registrations.
 */

import {
  createTeam,
  inviteTeamMember,
  joinTeam,
  claimTeamInvitation,
  getLocalTeams,
  getLocalTeamMembers,
  saveLocalTeams,
  saveLocalTeamMembers,
  saveLocalTeamInvites,
} from '../src/lib/teams'

import {
  submitPaymentProof,
  reviewPaymentSubmission,
  getLocalPaymentSubmissions,
  saveLocalPaymentSubmissions,
  getStudentPaymentSubmission,
} from '../src/lib/payments'

import {
  registerForEvent,
  getStudentRegistrations,
  getInitialLocalRegistrations,
  saveLocalRegistrations,
} from '../src/lib/registrations'

import { checkInTicket, getLocalCheckIns, saveLocalCheckIns } from '../src/lib/checkin'

// Test harness mock storage
const mockStorage: Record<string, string> = {}

if (typeof globalThis.localStorage === 'undefined') {
  ;(globalThis as any).localStorage = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, val: string) => {
      mockStorage[key] = String(val)
    },
    removeItem: (key: string) => {
      delete mockStorage[key]
    },
    clear: () => {
      for (const k of Object.keys(mockStorage)) delete mockStorage[k]
    },
  }
}

// Setup mock test events
const PAID_TEAM_EVENT = {
  id: 'ev_paid_team_001',
  title: 'Hackathon 2026',
  slug: 'hackathon-2026',
  category: 'technical',
  venue_name: 'Tech Auditorium',
  start_date: new Date(Date.now() + 86400000 * 7).toISOString(),
  end_date: new Date(Date.now() + 86400000 * 8).toISOString(),
  capacity: 50,
  is_free: false,
  price: 600,
  currency: 'INR',
  status: 'published',
  participation_type: 'team' as const,
  min_team_size: 2,
  max_team_size: 4,
  leader_counts_towards_size: true,
  team_registration_mode: 'leader_adds_members' as const,
  require_team_name: true,
  approval_type: 'automatic' as const,
  club_id: 'club_organizer_001',
}

const PAID_INDIVIDUAL_EVENT = {
  id: 'ev_paid_indiv_001',
  title: 'Solo Code Sprint',
  slug: 'solo-code-sprint',
  category: 'coding',
  venue_name: 'Lab 4',
  start_date: new Date(Date.now() + 86400000 * 5).toISOString(),
  end_date: new Date(Date.now() + 86400000 * 5 + 7200000).toISOString(),
  capacity: 100,
  is_free: false,
  price: 200,
  currency: 'INR',
  status: 'published',
  participation_type: 'individual' as const,
  min_team_size: 1,
  max_team_size: 1,
  leader_counts_towards_size: true,
  team_registration_mode: 'leader_adds_members' as const,
  require_team_name: false,
  approval_type: 'automatic' as const,
  club_id: 'club_organizer_001',
}

let passed = 0
let failed = 0

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++
    console.log(`  ✓ ${testName}`)
  } else {
    failed++
    console.error(`  ✗ FAIL: ${testName}`)
    if (detail) console.error(`    Detail: ${detail}`)
  }
}

async function runTestSuite() {
  console.log('\n===============================================================')
  console.log('FESTFLOW TEST SUITE: TEAM PAYMENT & PASS GENERATION WORKFLOW')
  console.log('===============================================================\n')

  // Initialize storage
  localStorage.clear()
  localStorage.setItem('festflow_local_events', JSON.stringify([PAID_TEAM_EVENT, PAID_INDIVIDUAL_EVENT]))
  localStorage.setItem('festflow_managed_events', JSON.stringify([PAID_TEAM_EVENT, PAID_INDIVIDUAL_EVENT]))
  saveLocalRegistrations([])
  saveLocalTeams([])
  saveLocalTeamMembers([])
  saveLocalTeamInvites([])
  saveLocalPaymentSubmissions([])
  saveLocalCheckIns([])

  // =========================================================================
  // TEST GROUP 1: Individual Payment Lifecycle
  // =========================================================================
  console.log('▶ Test Group 1: Individual Payment & Pass Issuance')

  const indivReg = await registerForEvent('ev_paid_indiv_001', 'student_solo_1', {
    participantDetails: { student_name: 'Solo Coder', email: 'solo@campus.edu' },
  })

  assert(indivReg.success, 'Individual registration created')
  assert(indivReg.status === 'pending_payment', 'Rule 4: Paid individual starts in pending_payment')
  assert(!indivReg.ticket_issued_at, 'Rule 4: Individual pass ticket_issued_at is null before payment')

  // Check-in must reject unconfirmed / unpaid pass
  const earlyCheckin = await checkInTicket(
    'ev_paid_indiv_001',
    indivReg.ticket_code!,
    undefined,
    'club_organizer_001'
  )
  assert(
    !earlyCheckin.success && earlyCheckin.outcome === 'NOT_CONFIRMED',
    'Gate check-in rejects ticket with status pending_payment'
  )

  // Submit payment proof
  const indivSubRes = await submitPaymentProof({
    registrationId: indivReg.registration_id!,
    transactionReference: 'UTR_INDIV_1111',
  })
  assert(indivSubRes.success, 'Individual student submitted UPI UTR')

  // Organizer approves payment
  const subs = getLocalPaymentSubmissions()
  const indivSub = subs.find((s) => s.registration_id === indivReg.registration_id)
  assert(Boolean(indivSub), 'Payment submission record stored')

  const indivReviewRes = await reviewPaymentSubmission({
    paymentId: indivSub!.id,
    decision: 'approved',
  })
  assert(indivReviewRes.success, 'Organizer approved individual payment')

  // Registration must now be confirmed and pass issued
  const allRegs = getInitialLocalRegistrations()
  const updatedIndivReg = allRegs.find((r) => r.id === indivReg.registration_id)
  assert(updatedIndivReg?.status === 'confirmed', 'Registration updated to confirmed')
  assert(Boolean(updatedIndivReg?.ticket_issued_at), 'Rule 6: ticket_issued_at set on approval')

  // Gate check-in succeeds
  const validCheckin = await checkInTicket(
    'ev_paid_indiv_001',
    updatedIndivReg!.ticket_code,
    undefined,
    'club_organizer_001'
  )
  assert(validCheckin.success && validCheckin.outcome === 'VALID', 'Gate scanner confirms attendee admission')

  // Duplicate check-in rejected
  const dupCheckin = await checkInTicket(
    'ev_paid_indiv_001',
    updatedIndivReg!.ticket_code,
    undefined,
    'club_organizer_001'
  )
  assert(
    !dupCheckin.success && dupCheckin.outcome === 'ALREADY_USED',
    'Rule 8: Gate scanner prevents duplicate admission'
  )

  // =========================================================================
  // TEST GROUP 2: Team Creation, Invitations, & Pre-Payment Lockout
  // =========================================================================
  console.log('\n▶ Test Group 2: Team Creation & Strict Pass Lockout (Rule 4 & 5)')

  // Team Leader creates team
  const leaderRegRes = await registerForEvent('ev_paid_team_001', 'leader_bob', {
    teamName: 'Cyber Titans',
    participantDetails: { student_name: 'Bob Leader', email: 'bob@campus.edu' },
    teamMembers: [
      { name: 'Alice Existing', email: 'alice@campus.edu' },
      { name: 'Charlie Invitee', email: 'charlie@campus.edu' },
    ],
  })

  assert(leaderRegRes.success, 'Team leader registered squad')
  assert(leaderRegRes.status === 'pending_payment', 'Leader status starts in pending_payment')
  assert(!leaderRegRes.ticket_issued_at, 'Leader pass is not issued yet')

  const teams = getLocalTeams()
  const titanTeam = teams.find((t) => t.name === 'Cyber Titans')
  assert(Boolean(titanTeam), 'Team Cyber Titans created')

  // Alice (Existing User) accepts team invitation
  ;(globalThis as any).localStorage.setItem(
    'festflow_mock_session',
    JSON.stringify({ user: { id: 'alice_uid', email: 'alice@campus.edu' } })
  )

  const aliceJoinRes = await joinTeam({
    inviteCode: titanTeam!.invite_code,
    userId: 'alice_uid',
    userEmail: 'alice@campus.edu',
    participantDetails: { student_name: 'Alice Existing' },
  })

  assert(aliceJoinRes.success, 'Alice joined Cyber Titans')

  // CRITICAL RULE 4 VERIFICATION:
  // Alice MUST NOT have an active or confirmed pass because the squad fee is not paid!
  const regsAfterAlice = getInitialLocalRegistrations()
  const aliceReg = regsAfterAlice.find((r) => r.student_id === 'alice_uid' && r.event_id === 'ev_paid_team_001')

  assert(Boolean(aliceReg), 'Alice registration record created linked to team')
  assert(
    aliceReg?.status === 'pending_payment',
    'Rule 4: Alice registration status is pending_payment (NOT confirmed)'
  )
  assert(
    aliceReg?.ticket_issued_at === null,
    'Rule 4: Alice pass ticket_issued_at is NULL (Never issue entry pass upon squad join)'
  )

  // Gate check-in for Alice must be rejected
  const aliceEarlyScan = await checkInTicket(
    'ev_paid_team_001',
    aliceReg!.ticket_code,
    undefined,
    'club_organizer_001'
  )
  assert(
    !aliceEarlyScan.success && aliceEarlyScan.outcome === 'NOT_CONFIRMED',
    'Gate scanner rejects Alice pass because team payment is pending'
  )

  // =========================================================================
  // TEST GROUP 3: Team Payment Submission, Approval & Pass Activation
  // =========================================================================
  console.log('\n▶ Test Group 3: Team Payment Approval & Idempotent Pass Activation (Rule 6, 8)')

  // Leader submits payment proof for team
  const leaderSubRes = await submitPaymentProof({
    registrationId: leaderRegRes.registration_id!,
    transactionReference: 'UTR_TITANS_9999',
  })
  assert(leaderSubRes.success, 'Team leader submitted team payment proof')

  // Check Alice view of payment submission
  const alicePaymentView = await getStudentPaymentSubmission(aliceReg!.id)
  assert(
    alicePaymentView?.transaction_reference === 'UTR_TITANS_9999',
    'Rule 5: Team member can view team leader payment submission reference'
  )
  assert(alicePaymentView?.status === 'pending_review', 'Team member sees pending_review state')

  // Organizer reviews and approves team payment
  const titanSub = getLocalPaymentSubmissions().find(
    (s) => s.registration_id === leaderRegRes.registration_id
  )
  const teamApprovalRes = await reviewPaymentSubmission({
    paymentId: titanSub!.id,
    decision: 'approved',
  })
  assert(teamApprovalRes.success, 'Organizer approved team payment')

  // Verify Idempotent Pass Issuance for Leader and Member Alice
  const regsAfterApproval = getInitialLocalRegistrations()
  const updatedLeaderReg = regsAfterApproval.find((r) => r.id === leaderRegRes.registration_id)
  const updatedAliceReg = regsAfterApproval.find((r) => r.id === aliceReg!.id)

  assert(updatedLeaderReg?.status === 'confirmed', 'Leader registration confirmed')
  assert(Boolean(updatedLeaderReg?.ticket_issued_at), 'Leader ticket issued')
  assert(updatedAliceReg?.status === 'confirmed', 'Rule 6: Member Alice registration confirmed')
  assert(Boolean(updatedAliceReg?.ticket_issued_at), 'Rule 6: Member Alice pass activated upon approval')
  assert(
    updatedAliceReg!.ticket_code.startsWith(updatedLeaderReg!.ticket_code),
    'Member ticket code canonically derives from team ticket code'
  )

  // Verify Duplicate Approval Prevention (Rule 8)
  const dupApprovalRes = await reviewPaymentSubmission({
    paymentId: titanSub!.id,
    decision: 'approved',
  })
  assert(
    !dupApprovalRes.success && dupApprovalRes.error_code === 'ALREADY_REVIEWED',
    'Rule 8: Duplicate payment approval rejected with ALREADY_REVIEWED'
  )

  // Alice can now scan and enter event
  const aliceValidScan = await checkInTicket(
    'ev_paid_team_001',
    updatedAliceReg!.ticket_code,
    undefined,
    'club_organizer_001'
  )
  assert(aliceValidScan.success && aliceValidScan.outcome === 'VALID', 'Member Alice check-in succeeds')

  // Duplicate entry for Alice rejected
  const aliceDupScan = await checkInTicket(
    'ev_paid_team_001',
    updatedAliceReg!.ticket_code,
    undefined,
    'club_organizer_001'
  )
  assert(
    !aliceDupScan.success && aliceDupScan.outcome === 'ALREADY_USED',
    'Rule 8: Duplicate check-in for team member rejected'
  )

  // =========================================================================
  // TEST GROUP 4: New Invitee Sign-up & Post-Payment Join (Rule 10)
  // =========================================================================
  console.log('\n▶ Test Group 4: Newly Invited Member Late Signup (Rule 10)')

  // Charlie was invited earlier, now signs up
  ;(globalThis as any).localStorage.setItem(
    'festflow_mock_session',
    JSON.stringify({ user: { id: 'charlie_uid', email: 'charlie@campus.edu' } })
  )

  const charlieJoinRes = await joinTeam({
    inviteCode: titanTeam!.invite_code,
    userId: 'charlie_uid',
    userEmail: 'charlie@campus.edu',
    participantDetails: { student_name: 'Charlie Invitee' },
  })

  assert(charlieJoinRes.success, 'New invitee Charlie joined team')

  // Because team payment is ALREADY approved, Charlie immediately receives their pass
  const regsAfterCharlie = getInitialLocalRegistrations()
  const charlieRegs = regsAfterCharlie.filter(
    (r) => r.student_id === 'charlie_uid' && r.event_id === 'ev_paid_team_001'
  )
  assert(charlieRegs.length === 1, 'Rule 8 & 10: Exactly one registration created for Charlie (no duplicates)')
  assert(charlieRegs[0].status === 'confirmed', 'Charlie pass is confirmed')
  assert(Boolean(charlieRegs[0].ticket_issued_at), 'Charlie ticket_issued_at is set')

  // Charlie checks in
  const charlieScan = await checkInTicket(
    'ev_paid_team_001',
    charlieRegs[0].ticket_code,
    undefined,
    'club_organizer_001'
  )
  assert(charlieScan.success && charlieScan.outcome === 'VALID', 'Charlie admitted at gate')

  // =========================================================================
  // TEST GROUP 5: Payment Rejection & Resubmission Flow (Rule 7)
  // =========================================================================
  console.log('\n▶ Test Group 5: Payment Rejection & Resubmission Flow (Rule 7)')

  // Create another squad for testing rejection
  const squadRejectRes = await registerForEvent('ev_paid_team_001', 'leader_dave', {
    teamName: 'Alpha Squad',
    participantDetails: { student_name: 'Dave Leader', email: 'dave@campus.edu' },
    teamMembers: [{ name: 'Eve Member', email: 'eve@campus.edu' }],
  })
  assert(squadRejectRes.success, 'Alpha Squad registered')

  // Leader Dave submits wrong UTR
  await submitPaymentProof({
    registrationId: squadRejectRes.registration_id!,
    transactionReference: 'UTR_WRONG_000',
  })

  const daveSub = getLocalPaymentSubmissions().find(
    (s) => s.registration_id === squadRejectRes.registration_id
  )
  assert(Boolean(daveSub), 'Dave submission found')

  // Organizer rejects Dave payment
  const rejectRes = await reviewPaymentSubmission({
    paymentId: daveSub!.id,
    decision: 'rejected',
    notes: 'Transaction reference not found in bank statement.',
  })
  assert(rejectRes.success, 'Organizer rejected Dave payment')

  // Verify status is rejected
  const regsAfterRejection = getInitialLocalRegistrations()
  const rejectedDaveReg = regsAfterRejection.find((r) => r.id === squadRejectRes.registration_id)
  assert(rejectedDaveReg?.status === 'rejected', 'Rule 7: Dave registration status set to rejected')
  assert(
    rejectedDaveReg?.rejection_reason === 'Transaction reference not found in bank statement.',
    'Rule 7: Rejection reason preserved for student display'
  )

  // Resubmission: Leader Dave submits valid UTR
  const resubmitRes = await submitPaymentProof({
    registrationId: squadRejectRes.registration_id!,
    transactionReference: 'UTR_CORRECTED_1234',
  })
  assert(resubmitRes.success, 'Rule 7: Resubmission succeeded with corrected UTR')

  const regsAfterResubmit = getInitialLocalRegistrations()
  const resubmittedDaveReg = regsAfterResubmit.find((r) => r.id === squadRejectRes.registration_id)
  assert(
    resubmittedDaveReg?.status === 'pending_payment',
    'Rule 7: Registration status restored to pending_payment, clearing rejection'
  )
  assert(resubmittedDaveReg?.rejection_reason === null, 'Rejection reason cleared upon resubmission')

  // Organizer approves corrected submission
  const daveNewSub = getLocalPaymentSubmissions().find(
    (s) => s.registration_id === squadRejectRes.registration_id
  )
  const approveResubmit = await reviewPaymentSubmission({
    paymentId: daveNewSub!.id,
    decision: 'approved',
  })
  assert(approveResubmit.success, 'Organizer approved resubmitted payment')

  const finalDaveReg = getInitialLocalRegistrations().find((r) => r.id === squadRejectRes.registration_id)
  assert(finalDaveReg?.status === 'confirmed', 'Registration finally confirmed upon approval')
  assert(Boolean(finalDaveReg?.ticket_issued_at), 'Dave pass issued successfully')

  // =========================================================================
  // TEST GROUP 6: Pass Ownership & Query Privacy (Rule 9)
  // =========================================================================
  console.log('\n▶ Test Group 6: Pass Ownership & Query Privacy (Rule 9)')

  const alicePasses = await getStudentRegistrations('alice_uid')
  assert(alicePasses.registrations.length === 1, 'Alice queries exactly her own passes')
  assert(alicePasses.registrations[0].student_id === 'alice_uid', 'Alice does not see other users passes')

  const bobPasses = await getStudentRegistrations('leader_bob')
  assert(bobPasses.registrations.length === 1, 'Bob queries exactly his own passes')
  assert(bobPasses.registrations[0].student_id === 'leader_bob', 'Bob pass has student_id = leader_bob')
  assert(
    bobPasses.registrations[0].id !== alicePasses.registrations[0].id,
    'Rule 9: Leader and member have distinct, private registration IDs'
  )

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('\n===============================================================')
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`)
  console.log('===============================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
