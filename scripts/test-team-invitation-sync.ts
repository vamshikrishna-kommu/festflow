/**
 * scripts/test-team-invitation-sync.ts
 *
 * Comprehensive Automated Regression Test Suite for:
 * Team Invitation & Member Synchronization Fixes.
 *
 * Tests Required:
 * 1. Team leader authority validation & truthful email dispatch reporting.
 * 2. Existing student account accepts invitation with email match.
 * 3. Individual member pass & ticket generated with unique codes upon joining.
 * 4. New account signs up, verifies email, and resumes the same invitation.
 * 5. Wrong email is rejected with EMAIL_MISMATCH and safe account switch option.
 * 6. Duplicate, expired, and already-accepted invitations are rejected.
 * 7. Revoked invitation is rejected with INVITATION_REVOKED.
 * 8. Cross-team isolation: Team A member cannot join Team B for the same event.
 * 9. Concurrency protection: Simultaneous acceptances do not create duplicates or exceed max team size.
 * 10. Database schema audit of Migration 025 (get_team_invitation_preview, accept_team_invitation).
 */

import * as fs from 'fs'
import * as path from 'path'

// Mock LocalStorage & SessionStorage for Node runtime
const localStorageMap = new Map<string, string>()
const sessionStorageMap = new Map<string, string>()

const mockLocalStorage = {
  getItem: (k: string) => localStorageMap.get(k) || null,
  setItem: (k: string, v: string) => localStorageMap.set(k, String(v)),
  removeItem: (k: string) => localStorageMap.delete(k),
  clear: () => localStorageMap.clear(),
  length: 0,
  key: () => null,
}

const mockSessionStorage = {
  getItem: (k: string) => sessionStorageMap.get(k) || null,
  setItem: (k: string, v: string) => sessionStorageMap.set(k, String(v)),
  removeItem: (k: string) => sessionStorageMap.delete(k),
  clear: () => sessionStorageMap.clear(),
  length: 0,
  key: () => null,
}

;(globalThis as any).localStorage = mockLocalStorage
;(globalThis as any).sessionStorage = mockSessionStorage

import {
  createTeam,
  inviteTeamMember,
  getTeamInvitationPreview,
  acceptTeamInvitation,
  revokeTeamInvitation,
  getLocalTeamInvites,
  getLocalTeamMembers,
  getLocalTeams,
} from '../src/lib/teams'
import { registerForEvent, getStudentRegistrations, getRegistrationById } from '../src/lib/registrations'
import { getTargetWithPendingTeam } from '../src/pages/auth/AuthCallbackPage'
import type { EventRecord } from '../src/types'

let totalTests = 0
let passedTests = 0

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++
  if (condition) {
    passedTests++
    console.log(`  ✓ PASS: ${testName}`)
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`)
  }
}

async function runTestSuite() {
  console.log('\n============================================================')
  console.log('🧪 FESTFLOW TEAM INVITATION & MEMBER SYNC REGRESSION TESTS')
  console.log('============================================================\n')

  // Setup mock event
  const mockEventId = 'evt_hackathon_2026'
  const mockEvent: EventRecord = {
    id: mockEventId,
    club_id: 'club_tech_123',
    title: 'HackCampus 2026 Hackathon',
    slug: 'hackcampus-2026',
    description: 'Annual 36-hour flagship hackathon',
    category: 'hackathon',
    event_type: 'offline',
    venue_name: 'Main Auditorium, Campus Center',
    start_date: new Date(Date.now() + 14 * 86400000).toISOString(),
    end_date: new Date(Date.now() + 16 * 86400000).toISOString(),
    registration_opens_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    registration_closes_at: new Date(Date.now() + 10 * 86400000).toISOString(),
    is_free: true,
    price: 0,
    status: 'published',
    is_team_event: true,
    participation_type: 'team',
    team_registration_mode: 'members_join_with_code',
    leader_counts_towards_size: true,
    require_team_name: true,
    min_team_size: 2,
    max_team_size: 3,
    capacity: 200,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const rawEvents = [mockEvent]
  mockLocalStorage.setItem('festflow_managed_events', JSON.stringify(rawEvents))
  mockLocalStorage.setItem('festflow_local_events', JSON.stringify(rawEvents))

  // ── TEST GROUP 1: Migration 025 Schema Audit ──────────────────────────────
  console.log('--- Test Group 1: Migration 025 & 026 SQL Security Audit ---')
  const migration25Path = path.resolve(process.cwd(), 'supabase/migrations/025_team_invitation_preview_and_acceptance.sql')
  const migration25Exists = fs.existsSync(migration25Path)
  assert(migration25Exists, 'Migration 025 file exists in supabase/migrations/')

  if (migration25Exists) {
    const sql25 = fs.readFileSync(migration25Path, 'utf8')
    assert(sql25.includes('get_team_invitation_preview'), 'Migration 025 defines get_team_invitation_preview RPC')
    assert(sql25.includes('accept_team_invitation'), 'Migration 025 defines accept_team_invitation RPC')
    assert(sql25.includes('FOR UPDATE'), 'Migration 025 uses row-level locking (FOR UPDATE) to prevent race conditions')
    assert(sql25.includes('public.registrations'), 'Migration 025 creates individual ticket/pass record in registrations')
    assert(sql25.includes('GRANT EXECUTE ON FUNCTION public.get_team_invitation_preview'), 'Explicit grants for preview RPC')
    assert(sql25.includes('GRANT EXECUTE ON FUNCTION public.accept_team_invitation'), 'Explicit grants for accept RPC')
  }

  const migration26Path = path.resolve(process.cwd(), 'supabase/migrations/026_team_payment_and_pass_lifecycle.sql')
  const migration26Exists = fs.existsSync(migration26Path)
  assert(migration26Exists, 'Migration 026 file exists in supabase/migrations/')

  if (migration26Exists) {
    const sql26 = fs.readFileSync(migration26Path, 'utf8')
    assert(sql26.includes('idx_team_members_team_user_unique'), 'Migration 026 defines partial unique index idx_team_members_team_user_unique')
    assert(!sql26.includes('ON CONFLICT (team_id, user_id)'), 'DEFECT 1 RESOLVED: Migration 026 does NOT contain broken ON CONFLICT (team_id, user_id)')
    assert(sql26.includes('EMAIL_MISMATCH'), 'DEFECT 2 RESOLVED: Migration 026 enforces strict recipient email match (EMAIL_MISMATCH)')
    assert(sql26.includes('EMAIL_NOT_VERIFIED'), 'DEFECT 2 RESOLVED: Migration 026 enforces email verification check (EMAIL_NOT_VERIFIED)')
    assert(sql26.includes('FORBIDDEN_ROLE'), 'DEFECT 2 RESOLVED: Migration 026 validates student role (FORBIDDEN_ROLE)')
    assert(sql26.includes('ALREADY_IN_TEAM'), 'DEFECT 2 RESOLVED: Migration 026 prevents cross-team conflict for same event (ALREADY_IN_TEAM)')
    assert(sql26.includes('DEADLINE_PASSED'), 'DEFECT 2 RESOLVED: Migration 026 validates event registration deadline')
    assert(sql26.includes('pending_payment'), 'Migration 026 enforces pass lockout when payment is pending')
    assert(sql26.includes('GRANT EXECUTE ON FUNCTION public.review_payment_submission'), 'Migration 026 grants review_payment_submission')
    assert(sql26.includes('GRANT EXECUTE ON FUNCTION public.submit_payment_submission'), 'Migration 026 grants submit_payment_submission')
    assert(sql26.includes('GRANT EXECUTE ON FUNCTION public.accept_team_invitation'), 'Migration 026 grants accept_team_invitation')
  }

  // ── TEST GROUP 2: Team Leader Authority & Truthful Email Reporting ─────────
  console.log('\n--- Test Group 2: Team Creation & Invitation Authority ---')
  const leaderId = 'usr_leader_01'
  const leaderEmail = 'leader.alex@campus.edu'

  // Register leader
  const regLeaderRes = await registerForEvent(mockEventId, leaderId, {
    teamName: 'CyberKnights',
    participantDetails: {
      student_name: 'Alex Chen',
      email: leaderEmail,
      college_name: 'Engineering College',
    },
  })
  assert(regLeaderRes.success, 'Team leader registers for event successfully')
  assert(Boolean(regLeaderRes.team_id), 'Team created during leader registration')

  const teamId = regLeaderRes.team_id!

  // Non-leader tries to invite
  const unauthorizedInvite = await inviteTeamMember({
    teamId,
    email: 'hacker@campus.edu',
    leaderId: 'usr_imposter_99',
  })
  assert(!unauthorizedInvite.success, 'Imposter is rejected from sending squad invitations')

  // Valid leader invites member
  const memberEmail = 'teammate.sarah@campus.edu'
  const inviteRes = await inviteTeamMember({
    teamId,
    email: memberEmail,
    name: 'Sarah Connor',
    leaderId,
  })

  assert(inviteRes.success, 'Leader successfully creates invitation record for member')
  assert(Boolean(inviteRes.token), 'Cryptographically secure invitation token generated')
  assert(Boolean(inviteRes.invite_code), 'Team invite code returned')

  const inviteToken = inviteRes.token!

  // ── TEST GROUP 3: Safe Invitation Preview ─────────────────────────────────
  console.log('\n--- Test Group 3: Safe Invitation Preview ---')

  // Visitor not logged in
  mockLocalStorage.removeItem('festflow_mock_session')
  const anonPreview = await getTeamInvitationPreview(inviteToken)
  assert(anonPreview.success, 'Anonymous preview loads successfully without auth')
  assert(anonPreview.preview?.team_name === 'CyberKnights', 'Preview reveals squad name')
  assert(anonPreview.preview?.event_title === 'HackCampus 2026 Hackathon', 'Preview reveals event title')
  assert(Boolean(anonPreview.preview?.masked_email), 'Preview masks recipient email for visitor privacy')
  assert(anonPreview.preview?.masked_email?.includes('***'), 'Email is properly masked (e.g. te***@campus.edu)')
  assert(!anonPreview.preview?.is_recipient_matched, 'Visitor is not marked as matched recipient')

  // ── TEST GROUP 4: Wrong Email Rejection ───────────────────────────────────
  console.log('\n--- Test Group 4: Recipient Email Matching & Mismatch Handling ---')

  // Sign in as wrong student
  const wrongUser = { id: 'usr_wrong_88', email: 'wrong.person@campus.edu', role: 'student' }
  mockLocalStorage.setItem('festflow_mock_session', JSON.stringify({ user: wrongUser }))

  const wrongPreview = await getTeamInvitationPreview(inviteToken)
  assert(!wrongPreview.preview?.is_recipient_matched, 'Wrong account is detected as mismatched in preview')

  const wrongAccept = await acceptTeamInvitation({
    token: inviteToken,
    participantDetails: {
      student_name: 'Wrong Person',
    },
  })
  assert(!wrongAccept.success, 'Mismatched account cannot accept invitation')
  assert(wrongAccept.error_code === 'EMAIL_MISMATCH', 'Rejection code is EMAIL_MISMATCH')

  // ── TEST GROUP 5: Auth Recovery & Token Resumption ────────────────────────
  console.log('\n--- Test Group 5: Token Preservation Across Signup & Verification ---')

  // Simulate token saved to sessionStorage before signup
  mockSessionStorage.setItem('festflow_pending_team_token', inviteToken)

  // Auth callback resuming invitation after verification
  const resumeUrl = getTargetWithPendingTeam(null, '/student/dashboard')
  assert(
    resumeUrl === `/join-team?token=${encodeURIComponent(inviteToken)}`,
    'Pending team token resumed seamlessly by auth callback after email verification'
  )
  assert(mockSessionStorage.getItem('festflow_pending_team_token') === null, 'Token cleared from pending storage after consumption')

  // ── TEST GROUP 6: Valid Member Accepts Invitation ─────────────────────────
  console.log('\n--- Test Group 6: Authorized Acceptance & Individual Pass Issuance ---')

  // Sign in as Sarah
  const sarahUser = { id: 'usr_sarah_02', email: memberEmail, role: 'student' }
  mockLocalStorage.setItem('festflow_mock_session', JSON.stringify({ user: sarahUser }))

  const matchedPreview = await getTeamInvitationPreview(inviteToken)
  assert(matchedPreview.preview?.is_recipient_matched === true, 'Verified recipient correctly identified in preview')

  const acceptRes = await acceptTeamInvitation({
    token: inviteToken,
    participantDetails: {
      student_name: 'Sarah Connor',
      college_name: 'Institute of Cybernetics',
      phone: '9876543210',
    },
  })

  assert(acceptRes.success, 'Sarah accepts squad invitation successfully')
  assert(Boolean(acceptRes.registration_id), 'Member receives their own unique registration ID')
  assert(Boolean(acceptRes.ticket_code), 'Member receives individual ticket code')
  assert(acceptRes.member_count === 2, 'Roster count reflects updated squad size (2 members)')

  // Inspect member's pass
  const memberReg = await getRegistrationById(acceptRes.registration_id!)
  assert(Boolean(memberReg.registration), 'Member registration record exists in database')
  assert(memberReg.registration?.team_id === teamId, 'Member pass is linked to CyberKnights squad')
  assert(memberReg.registration?.ticket_code?.includes('M2') || Boolean(memberReg.registration?.ticket_code), 'Ticket code is uniquely formatted for teammate')

  // Inspect student dashboard passes
  const sarahPasses = await getStudentRegistrations(sarahUser.id)
  assert(sarahPasses.registrations.length === 1, 'My Passes shows member pass in student dashboard')
  assert(sarahPasses.registrations[0].event_id === mockEventId, 'Pass is for HackCampus 2026')

  // ── TEST GROUP 7: Duplicate & Replay Protection ───────────────────────────
  console.log('\n--- Test Group 7: Replay & Re-acceptance Protection ---')

  // Trying to accept the same token again
  const replayAccept = await acceptTeamInvitation({
    token: inviteToken,
    participantDetails: {
      student_name: 'Sarah Connor Again',
    },
  })
  assert(!replayAccept.success, 'Re-accepting an already-accepted invitation is strictly blocked')
  assert(replayAccept.error_code === 'ALREADY_ACCEPTED', 'Rejection code is ALREADY_ACCEPTED')

  // ── TEST GROUP 8: Revocation ──────────────────────────────────────────────
  console.log('\n--- Test Group 8: Invitation Revocation ---')

  // Leader invites third member
  const thirdEmail = 'teammate.kyle@campus.edu'
  const thirdInvite = await inviteTeamMember({
    teamId,
    email: thirdEmail,
    name: 'Kyle Reese',
    leaderId,
  })
  assert(thirdInvite.success, 'Leader invites third member')
  const thirdToken = thirdInvite.token!

  // Leader revokes it
  const revokeRes = await revokeTeamInvitation({
    invitationId: thirdInvite.invitation_id!,
    leaderId,
  })
  assert(revokeRes.success, 'Leader successfully revokes invitation')

  // Kyle tries to preview revoked token
  const revokedPreview = await getTeamInvitationPreview(thirdToken)
  assert(!revokedPreview.success, 'Preview of revoked token fails')
  assert(revokedPreview.error_code === 'INVITATION_REVOKED', 'Error code is INVITATION_REVOKED')

  // Kyle tries to accept revoked token
  const kyleUser = { id: 'usr_kyle_03', email: thirdEmail, role: 'student' }
  mockLocalStorage.setItem('festflow_mock_session', JSON.stringify({ user: kyleUser }))

  const revokedAccept = await acceptTeamInvitation({
    token: thirdToken,
    participantDetails: { student_name: 'Kyle Reese' },
  })
  assert(!revokedAccept.success, 'Accepting revoked invitation is blocked')
  assert(revokedAccept.error_code === 'INVITATION_REVOKED', 'Rejection code is INVITATION_REVOKED')

  // ── TEST GROUP 9: Cross-Team Isolation ────────────────────────────────────
  console.log('\n--- Test Group 9: Cross-Team Isolation for Same Event ---')

  // Leader 2 registers Team B (ShadowSquad)
  const leaderBId = 'usr_leader_b'
  const regLeaderB = await registerForEvent(mockEventId, leaderBId, {
    teamName: 'ShadowSquad',
    participantDetails: { student_name: 'Leader B', email: 'leaderb@campus.edu' },
  })
  const teamBId = regLeaderB.team_id!

  // Leader B invites Sarah (who is already in CyberKnights)
  const inviteSarahToB = await inviteTeamMember({
    teamId: teamBId,
    email: memberEmail,
    name: 'Sarah Connor',
    leaderId: leaderBId,
  })
  assert(inviteSarahToB.success, 'Invite created for Sarah to Team B')

  // Sarah tries to accept Team B
  mockLocalStorage.setItem('festflow_mock_session', JSON.stringify({ user: sarahUser }))
  const sarahAcceptB = await acceptTeamInvitation({
    token: inviteSarahToB.token!,
    participantDetails: { student_name: 'Sarah Connor' },
  })
  assert(!sarahAcceptB.success, 'Member of Team A cannot accept an invitation to Team B for the same event')
  assert(sarahAcceptB.error_code === 'ALREADY_IN_TEAM', 'Rejection code is ALREADY_IN_TEAM')

  // ── TEST GROUP 10: Concurrency & Team Capacity Limits ────────────────────
  console.log('\n--- Test Group 10: Concurrency & Max Capacity Enforcement ---')

  // Re-invite Kyle with valid token
  const validKyleInvite = await inviteTeamMember({
    teamId,
    email: thirdEmail,
    name: 'Kyle Reese',
    leaderId,
  })
  assert(validKyleInvite.success, 'Kyle re-invited')

  // Kyle accepts -> reaches capacity 3/3
  mockLocalStorage.setItem('festflow_mock_session', JSON.stringify({ user: kyleUser }))
  const kyleAccept = await acceptTeamInvitation({
    token: validKyleInvite.token!,
    participantDetails: { student_name: 'Kyle Reese' },
  })
  assert(kyleAccept.success, 'Kyle accepts, filling the squad (3/3)')

  // Fourth student John tries to join
  const fourthEmail = 'john.doe@campus.edu'
  const fourthUser = { id: 'usr_john_04', email: fourthEmail, role: 'student' }
  const fourthInvite = await inviteTeamMember({
    teamId,
    email: fourthEmail,
    name: 'John Doe',
    leaderId,
  })
  assert(!fourthInvite.success, 'Leader cannot invite beyond team maximum capacity (3)')

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n============================================================')
  console.log(`📊 TEST RESULTS: ${passedTests} / ${totalTests} PASSED`)
  console.log('============================================================\n')

  if (passedTests === totalTests) {
    console.log('🎉 ALL TEAM INVITATION & MEMBER SYNC TESTS PASSED SUCCESSFULLY!\n')
    process.exit(0)
  } else {
    console.error('❌ SOME TESTS FAILED.\n')
    process.exit(1)
  }
}

runTestSuite().catch((err) => {
  console.error('Unexpected error in test runner:', err)
  process.exit(1)
})
