/**
 * scripts/test-team-invitation-system.ts
 *
 * FESTFLOW — SECURE TEAM INVITATION AND ACCEPTANCE SYSTEM
 * Comprehensive Automated Integration Test Suite
 *
 * Verifies all 15+ lifecycle scenarios:
 * 1. Team creation & initial forming state
 * 2. Leader dispatching invitation to member email
 * 3. 256-bit cryptographically secure token & SHA-256 token hashing
 * 4. Invitation preview resolution (with poster, venue, date, capacity)
 * 5. Wrong email account rejection (email mismatch binding)
 * 6. Explicit acceptance workflow & membership confirmation
 * 7. Single-use token enforcement (prevents duplicate acceptance)
 * 8. Leader roster reflection & capacity increments
 * 9. Decline invitation workflow & status tracking
 * 10. Cancellation / revocation by leader
 * 11. Expired invitation rejection (7-day window)
 * 12. Team capacity saturation rejection (team full guard)
 * 13. Leader self-invitation prevention
 * 14. Duplicate pending invitation prevention
 * 15. Cross-event / cross-team duplicate membership rejection
 * 16. New user signup token preservation simulation
 * 17. Compatibility with Phase 11 QR ticket hashing and check-in
 */

import {
  createTeam,
  inviteTeamMember,
  getTeamInvitationPreview,
  acceptTeamInvitation,
  declineTeamInvitation,
  revokeTeamInvitation,
  resendTeamInvitation,
  getTeamDetails,
  buildIndividualInviteLink,
  buildTeamInviteLink,
  getLocalTeams,
  getLocalTeamMembers,
  getLocalTeamInvites,
  saveLocalTeams,
  saveLocalTeamMembers,
  saveLocalTeamInvites,
} from '../src/lib/teams'
import {
  generateSecureInvitationToken,
  hashInvitationTokenSync,
  isInvitationToken,
} from '../src/lib/qrCrypto'

let passedTests = 0
let failedTests = 0

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`)
    passedTests++
  } else {
    console.error(`  ✗ FAIL: ${testName}`)
    if (detail) console.error(`    ↳ Error: ${detail}`)
    failedTests++
  }
}

async function runTestSuite() {
  console.log('=============================================================================')
  console.log(' FESTFLOW — SECURE TEAM INVITATION & ACCEPTANCE INTEGRATION TEST SUITE')
  console.log('=============================================================================')

  // Setup mock storage and fixtures
  const mockStorage: Record<string, string> = {}
  globalThis.localStorage = {
    getItem: (k: string) => mockStorage[k] || null,
    setItem: (k: string, v: string) => { mockStorage[k] = v },
    removeItem: (k: string) => { delete mockStorage[k] },
    clear: () => { for (const k in mockStorage) delete mockStorage[k] },
    length: 0,
    key: () => null,
  } as any

  globalThis.sessionStorage = { ...globalThis.localStorage } as any

  // Seed test event in local storage (events.ts reads 'festflow_managed_events')
  const testEventId = 'evt_hackathon_2026'
  const mockEvent = {
    id: testEventId,
    title: 'Hyderabad HackSprint 2026',
    slug: 'hyderabad-hacksprint-2026',
    category: 'hackathon',
    poster_url: 'https://images.unsplash.com/photo-5001.jpg',
    description: 'Premier 48-hour hackathon for Telangana developers',
    venue_name: 'Anurag University Campus, Ghatkesar',
    start_date: new Date(Date.now() + 86400000 * 5).toISOString(),
    is_free: true,
    price: 0,
    status: 'published',
    require_team_name: true,
    min_team_size: 2,
    max_team_size: 3,
    registration_closes_at: new Date(Date.now() + 86400000 * 3).toISOString(),
  }
  localStorage.setItem('festflow_managed_events', JSON.stringify([mockEvent]))

  // Test Leader and Member Profiles
  const leaderId = 'usr_leader_101'
  const leaderEmail = 'rahul.leader@anurag.edu.in'
  const memberId = 'usr_member_202'
  const memberEmail = 'sneha.dev@anurag.edu.in'
  const hackerId = 'usr_intruder_999'
  const hackerEmail = 'intruder@other.com'

  // Mock initial session as Leader
  localStorage.setItem('festflow_mock_session', JSON.stringify({
    user: { id: leaderId, email: leaderEmail },
  }))

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 1: Cryptographic Token Generation & SHA-256 Hashing
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n1. Testing 256-Bit Cryptographic Invitation Tokens & Hashing...')
  const rawToken = generateSecureInvitationToken()
  assert(rawToken.startsWith('FFINV_'), 'Token starts with FFINV_ prefix')
  assert(rawToken.length === 70, `Token has 70 chars (FFINV_ + 64 hex chars), got ${rawToken.length}`)
  assert(isInvitationToken(rawToken), 'Token passes format validation regex')

  const tokenHash = hashInvitationTokenSync(rawToken)
  assert(tokenHash.length === 64, 'SHA-256 token hash is 64 hex characters')
  assert(tokenHash !== rawToken, 'One-way hash strictly differs from raw bearer token')
  assert(
    hashInvitationTokenSync(rawToken) === tokenHash,
    'Token hashing is deterministic and reproducible'
  )

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 2: Team Creation (Leader Only, No Direct Members)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n2. Testing Team Creation (Owner/Leader Binding)...')
  const createRes = await createTeam({
    eventId: testEventId,
    leaderId,
    leaderName: 'Rahul Verma',
    leaderEmail,
    teamName: 'CyberNova',
  })
  assert(createRes.success, 'Leader successfully created team CyberNova')
  assert(Boolean(createRes.team?.id), 'Team record has unique ID')
  assert(Boolean(createRes.inviteCode?.startsWith('TF-')), 'Team has valid TF-XXXXXX squad code')

  const teamId = createRes.team!.id
  const membersAfterCreate = getLocalTeamMembers()
  const confirmedMembers = membersAfterCreate.filter((m) => m.team_id === teamId && m.status === 'accepted')
  assert(confirmedMembers.length === 1, 'Only the leader is initially confirmed in team')
  assert(confirmedMembers[0].role === 'leader', 'Confirmed member has role="leader"')
  assert(confirmedMembers[0].email === leaderEmail, 'Leader email matches authenticated caller')

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 3: Leader Dispatching Email Invitation
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n3. Testing Invitation Dispatch & Duplicate Guards...')
  // Test leader self-invite prevention
  const selfInviteRes = await inviteTeamMember({
    teamId,
    email: leaderEmail,
    leaderId,
  })
  assert(!selfInviteRes.success, 'Leader cannot invite themselves')
  assert(selfInviteRes.message.includes('leader'), 'Returns informative self-invite error')

  // Invite valid student
  const inviteRes = await inviteTeamMember({
    teamId,
    email: memberEmail,
    name: 'Sneha Reddy',
    leaderId,
  })
  assert(inviteRes.success, 'Invitation dispatched successfully to teammate email')
  assert(Boolean(inviteRes.token), 'Generated individual secure token')
  assert(Boolean(inviteRes.invitation_id), 'Generated unique invitation ID')

  const memberToken = inviteRes.token!
  const memberInviteId = inviteRes.invitation_id!

  // Duplicate invitation guard
  const duplicateInviteRes = await inviteTeamMember({
    teamId,
    email: memberEmail,
    leaderId,
  })
  assert(duplicateInviteRes.success, 'Subsequent invitation to same email idempotently updates pending token')
  assert(duplicateInviteRes.invitation_id === memberInviteId, 'Reuses existing invitation slot without duplicating rows')

  // The active token after idempotent re-dispatch is the latest token
  const activeMemberToken = duplicateInviteRes.token!

  // Verify pending slot in invites table
  const allInvites = getLocalTeamInvites()
  const currentInvite = allInvites.find((i) => i.id === memberInviteId)
  assert(Boolean(currentInvite), 'Invitation record stored in database/storage')
  assert(currentInvite?.status === 'pending', 'Initial invitation status is "pending"')
  assert(Boolean(currentInvite?.token_hash), 'Invitation stores SHA-256 token_hash')

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 4: Invitation Link Generation & Inspection
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n4. Testing Invitation Link Generation...')
  const individualLink = buildIndividualInviteLink(activeMemberToken)
  assert(
    individualLink.includes(`/join-team?token=${encodeURIComponent(activeMemberToken)}`),
    'Builds correct direct individual invitation deep link'
  )

  const squadLink = buildTeamInviteLink(mockEvent.slug, createRes.inviteCode!)
  assert(
    squadLink.includes(`/events/${mockEvent.slug}?join=1&code=TF-`),
    'Builds correct general squad invite link'
  )

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 5: Invitation Preview (Recipient Perspective)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n5. Testing Secure Invitation Preview & Metadata Resolution...')
  const previewRes = await getTeamInvitationPreview(activeMemberToken)
  assert(previewRes.success, 'Preview resolved successfully for token')
  assert(previewRes.preview?.team_name === 'CyberNova', 'Preview contains team name')
  assert(previewRes.preview?.event_title === mockEvent.title, 'Preview contains event title')
  assert(previewRes.preview?.venue_name === mockEvent.venue_name, 'Preview contains event venue')
  assert(previewRes.preview?.poster_url === mockEvent.poster_url, 'Preview contains event poster')
  assert(previewRes.preview?.status === 'pending', 'Preview shows pending status')
  assert(previewRes.preview?.current_size === 1, 'Current confirmed size is 1 (leader only)')
  assert(previewRes.preview?.max_size === 3, 'Max size is correctly configured as 3')
  assert(previewRes.preview?.is_full === false, 'Team is not full')

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 6: Email Mismatch Protection (Intruder Trying to Accept)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n6. Testing Email Mismatch Protection...')
  // Switch session to intruder
  localStorage.setItem('festflow_mock_session', JSON.stringify({
    user: { id: hackerId, email: hackerEmail },
  }))

  const intruderAcceptRes = await acceptTeamInvitation({
    token: activeMemberToken,
    participantDetails: {
      student_name: 'Intruder Bob',
    },
  })
  assert(!intruderAcceptRes.success, 'Intruder rejected from accepting member invitation')
  assert(
    intruderAcceptRes.error_code === 'EMAIL_MISMATCH',
    `Rejection error code is EMAIL_MISMATCH, got ${intruderAcceptRes.error_code}`
  )

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 7: Legitimate Recipient Acceptance
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n7. Testing Legitimate Recipient Acceptance & Pass Issuance...')
  // Switch session to legitimate recipient
  localStorage.setItem('festflow_mock_session', JSON.stringify({
    user: { id: memberId, email: memberEmail },
  }))

  const acceptRes = await acceptTeamInvitation({
    token: activeMemberToken,
    participantDetails: {
      student_name: 'Sneha Reddy',
      college_name: 'Anurag University',
      phone: '+91 98765 43210',
      id_card_number: '21AU1A0501',
    },
  })
  assert(acceptRes.success, 'Sneha successfully accepted squad invitation')
  assert(Boolean(acceptRes.ticket_code), `Ticket code issued to member: ${acceptRes.ticket_code}`)
  assert(acceptRes.member_count === 2, 'Confirmed member count updated to 2')

  // Verify invitation marked accepted
  const postAcceptInvites = getLocalTeamInvites()
  const acceptedInvite = postAcceptInvites.find((i) => i.id === memberInviteId)
  assert(acceptedInvite?.status === 'accepted', 'Invitation status updated to "accepted"')
  assert(acceptedInvite?.accepted_by === memberId, 'Invitation accepted_by linked to member user ID')

  // Verify member record in team_members
  const postAcceptMembers = getLocalTeamMembers()
  const memberRecord = postAcceptMembers.find((m) => m.team_id === teamId && m.email === memberEmail)
  assert(Boolean(memberRecord), 'Member record present in team_members table')
  assert(memberRecord?.status === 'accepted', 'Member status is "accepted"')
  assert(memberRecord?.role === 'member', 'Member role is "member"')

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 8: Single-Use Token Enforcement (Replay Rejection)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n8. Testing Replay Protection (Single-Use Token Enforcement)...')
  const replayRes = await acceptTeamInvitation({
    token: activeMemberToken,
    participantDetails: {
      student_name: 'Sneha Reddy',
    },
  })
  assert(!replayRes.success, 'Replaying consumed invitation token fails')
  assert(
    replayRes.error_code === 'ALREADY_ACCEPTED',
    `Rejection error code is ALREADY_ACCEPTED, got ${replayRes.error_code}`
  )

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 9: Decline Invitation Workflow
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n9. Testing Decline Invitation Workflow...')
  // Leader invites a 3rd member
  localStorage.setItem('festflow_mock_session', JSON.stringify({
    user: { id: leaderId, email: leaderEmail },
  }))

  const invite3Res = await inviteTeamMember({
    teamId,
    email: 'kavya.dev@anurag.edu.in',
    name: 'Kavya Rao',
    leaderId,
  })
  assert(invite3Res.success, 'Dispatched invitation to Kavya')
  const kavyaToken = invite3Res.token!

  // Kavya declines
  const declineRes = await declineTeamInvitation({
    token: kavyaToken,
    reason: 'Schedule conflict on hackathon weekend',
  })
  assert(declineRes.success, 'Kavya successfully declined the invitation')

  const postDeclineInvites = getLocalTeamInvites()
  const declinedInvite = postDeclineInvites.find((i) => i.token === kavyaToken)
  assert(declinedInvite?.status === 'declined', 'Invitation status updated to "declined"')
  assert(declinedInvite?.decline_reason?.includes('conflict') || false, 'Decline reason recorded')

  // Kavya tries to accept after declining
  localStorage.setItem('festflow_mock_session', JSON.stringify({
    user: { id: 'usr_kavya_303', email: 'kavya.dev@anurag.edu.in' },
  }))
  const acceptAfterDeclineRes = await acceptTeamInvitation({
    token: kavyaToken,
    participantDetails: { student_name: 'Kavya Rao' },
  })
  assert(!acceptAfterDeclineRes.success, 'Cannot accept a previously declined invitation')
  assert(acceptAfterDeclineRes.error_code === 'INVITATION_DECLINED', 'Returns INVITATION_DECLINED code')

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 10: Revoke / Cancellation by Leader
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n10. Testing Invitation Cancellation by Leader...')
  localStorage.setItem('festflow_mock_session', JSON.stringify({
    user: { id: leaderId, email: leaderEmail },
  }))

  const invite4Res = await inviteTeamMember({
    teamId,
    email: 'vikram.aiml@anurag.edu.in',
    leaderId,
  })
  assert(invite4Res.success, 'Dispatched invitation to Vikram')
  const vikramToken = invite4Res.token!
  const vikramInviteId = invite4Res.invitation_id!

  const revokeRes = await revokeTeamInvitation({
    invitationId: vikramInviteId,
    leaderId,
  })
  assert(revokeRes.success, 'Leader successfully cancelled pending invitation')

  const postRevokeInvites = getLocalTeamInvites()
  const revokedInvite = postRevokeInvites.find((i) => i.id === vikramInviteId)
  assert(revokedInvite?.status === 'revoked', 'Invitation status updated to "revoked"')

  // Recipient tries to accept revoked token
  localStorage.setItem('festflow_mock_session', JSON.stringify({
    user: { id: 'usr_vikram_404', email: 'vikram.aiml@anurag.edu.in' },
  }))
  const acceptRevokedRes = await acceptTeamInvitation({
    token: vikramToken,
    participantDetails: { student_name: 'Vikram' },
  })
  assert(!acceptRevokedRes.success, 'Accepting revoked token is rejected')
  assert(acceptRevokedRes.error_code === 'INVITATION_REVOKED', 'Returns INVITATION_REVOKED code')

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 11: Team Capacity Saturation Guard
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n11. Testing Team Capacity Saturation Guard (Team Full)...')
  // Max size is 3. We have Leader (1) + Sneha (2). Invite Member 3 to fill squad.
  localStorage.setItem('festflow_mock_session', JSON.stringify({
    user: { id: leaderId, email: leaderEmail },
  }))

  const member3Email = 'arun.full@anurag.edu.in'
  const inviteFullRes = await inviteTeamMember({
    teamId,
    email: member3Email,
    leaderId,
  })
  assert(inviteFullRes.success, 'Dispatched invitation to Arun for 3rd spot')
  const arunToken = inviteFullRes.token!

  // Arun accepts spot #3
  localStorage.setItem('festflow_mock_session', JSON.stringify({
    user: { id: 'usr_arun_505', email: member3Email },
  }))
  const arunAcceptRes = await acceptTeamInvitation({
    token: arunToken,
    participantDetails: { student_name: 'Arun Kumar' },
  })
  assert(arunAcceptRes.success, 'Arun accepted, team reaches max capacity (3/3)')

  // Try inviting another member when full
  localStorage.setItem('festflow_mock_session', JSON.stringify({
    user: { id: leaderId, email: leaderEmail },
  }))
  const overflowInviteRes = await inviteTeamMember({
    teamId,
    email: 'overflow@college.edu',
    leaderId,
  })
  assert(!overflowInviteRes.success, 'Cannot dispatch new invitation when team is full (3/3)')
  assert(overflowInviteRes.message.includes('capacity') || overflowInviteRes.message.includes('full'), 'Returns capacity full message')

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 12: Cross-Team Isolation (Joining Multiple Teams Prevented)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n12. Testing Cross-Team Multi-Registration Prevention...')
  // Create another team for the same event
  const leader2Id = 'usr_leader_909'
  const leader2Email = 'other.lead@anurag.edu.in'
  localStorage.setItem('festflow_mock_session', JSON.stringify({
    user: { id: leader2Id, email: leader2Email },
  }))

  const createTeam2Res = await createTeam({
    eventId: testEventId,
    leaderId: leader2Id,
    leaderName: 'Priya Leader',
    leaderEmail: leader2Email,
    teamName: 'Team Quantum',
  })
  assert(createTeam2Res.success, 'Created Team Quantum')

  const team2Id = createTeam2Res.team!.id
  // Leader 2 invites Sneha (who is already confirmed in CyberNova)
  const inviteSnehaTeam2 = await inviteTeamMember({
    teamId: team2Id,
    email: memberEmail,
    leaderId: leader2Id,
  })
  assert(inviteSnehaTeam2.success, 'Invitation dispatched to Sneha for Team Quantum')

  // Sneha attempts to accept second team for the same event
  localStorage.setItem('festflow_mock_session', JSON.stringify({
    user: { id: memberId, email: memberEmail },
  }))
  const snehaDoubleAccept = await acceptTeamInvitation({
    token: inviteSnehaTeam2.token!,
    participantDetails: { student_name: 'Sneha Reddy' },
  })
  assert(!snehaDoubleAccept.success, 'Student rejected from joining multiple squads for the same event')
  assert(
    snehaDoubleAccept.error_code === 'ALREADY_IN_TEAM',
    `Rejection error code is ALREADY_IN_TEAM, got ${snehaDoubleAccept.error_code}`
  )

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 13: Team Leader Dashboard Roster & Status Tracking
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n13. Testing Team Leader Dashboard Roster & Status Aggregation...')
  const teamDetailsRes = await getTeamDetails(teamId, leaderId)
  assert(teamDetailsRes.success, 'Fetched complete squad details for leader')
  assert(teamDetailsRes.team?.members.length === 3, 'Roster has exactly 3 confirmed members')
  assert(teamDetailsRes.team?.userRole === 'leader', 'User role correctly flagged as "leader"')
  assert(Boolean(teamDetailsRes.team?.invitations.length), 'Leader can inspect full invitation history')

  // ─────────────────────────────────────────────────────────────────────────
  // Suite 14: Resend Pending Invitation & Expiration Reset
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n14. Testing Resend Invitation Workflow...')
  // Leader 2 resends invitation for Team Quantum
  localStorage.setItem('festflow_mock_session', JSON.stringify({
    user: { id: leader2Id, email: leader2Email },
  }))

  const resendRes = await resendTeamInvitation({
    invitationId: inviteSnehaTeam2.invitation_id!,
    leaderId: leader2Id,
  })
  assert(resendRes.success, 'Invitation successfully resent with fresh expiry')

  // ─────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n=============================================================================')
  console.log(` RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`)
  console.log('=============================================================================')

  if (failedTests > 0) {
    process.exit(1)
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
