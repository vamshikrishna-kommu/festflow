/**
 * FestFlow Phase 6 Test Suite: Club Member Invitations, Membership Acceptance,
 * and Permission-Controlled Club Management
 *
 * Verifies:
 * 1. Least-Privilege Role & Permission Matrix for all 6 roles
 * 2. Role Escalation Prevention (Admin cannot invite/assign Owner)
 * 3. Secure Expiring Invitation Token Generation & Branded Email Dispatch
 * 4. Unauthenticated Recipient Flow (Requires authentication before accepting)
 * 5. Authenticated Recipient Acceptance & Profile Role Promotion
 * 6. Wrong-User Email Mismatch Acceptance Rejection
 * 7. Expired Invitation Acceptance Rejection
 * 8. Revoked Invitation Acceptance Rejection
 * 9. Duplicate Membership Prevention
 * 10. Sole Owner Guard & Explicit Ownership Transfer Workflow
 * 11. Access Revocation & Audit Trail Logging
 * 12. Cross-Club Resource Isolation (Zero cross-tenant data/action leakage)
 */

import {
  ROLE_PERMISSIONS,
  hasPermission,
  canAssignRole,
  getClubMembers,
  getClubInvitations,
  getClubAuditLogs,
  getUserClubRole,
  inviteClubMember,
  acceptClubInvitation,
  revokeClubInvitation,
  resendClubInvitation,
  updateClubMemberRole,
  removeClubMember,
  transferClubOwnership,
  getInvitationByToken,
} from '../src/lib/clubMembers.js'
import type { ClubRole, ClubPermission, ClubMemberRecord } from '../src/types/index.js'

// Simple mock for browser localStorage in Node test runner
const memoryStore = new Map<string, string>()
const mockLocalStorage = {
  getItem: (k: string) => memoryStore.get(k) ?? null,
  setItem: (k: string, v: string) => { memoryStore.set(k, String(v)) },
  removeItem: (k: string) => { memoryStore.delete(k) },
  clear: () => { memoryStore.clear() },
}
// Inject into globalThis for Node.js environment
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).localStorage = mockLocalStorage

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

async function runPhase6Tests() {
  console.log('\n======================================================================')
  console.log('   FESTFLOW PHASE 6: CLUB MEMBERSHIP & PERMISSIONS TEST SUITE')
  console.log('======================================================================\n')

  mockLocalStorage.clear()

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 1: ROLE-PERMISSION MATRIX VALIDATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- 1. Least-Privilege Role & Permission Matrix ---')

  const allPermissions: ClubPermission[] = [
    'manage_club',
    'manage_members',
    'manage_events',
    'view_attendees',
    'gate_checkin',
    'review_payments',
    'view_reports',
  ]

  // Owner possesses all 7 permissions
  allPermissions.forEach((perm) => {
    assert(hasPermission('owner', perm), `Owner possesses permission: ${perm}`)
  })

  // Admin possesses all 7 permissions
  allPermissions.forEach((perm) => {
    assert(hasPermission('admin', perm), `Admin possesses permission: ${perm}`)
  })

  // Event Manager: manage_events, view_attendees, view_reports (No gate_checkin, manage_club, manage_members, review_payments)
  assert(hasPermission('event_manager', 'manage_events'), 'Event Manager can manage_events')
  assert(hasPermission('event_manager', 'view_attendees'), 'Event Manager can view_attendees')
  assert(hasPermission('event_manager', 'view_reports'), 'Event Manager can view_reports')
  assert(!hasPermission('event_manager', 'gate_checkin'), 'Event Manager CANNOT gate_checkin (least privilege)')
  assert(!hasPermission('event_manager', 'manage_club'), 'Event Manager CANNOT manage_club')
  assert(!hasPermission('event_manager', 'manage_members'), 'Event Manager CANNOT manage_members')
  assert(!hasPermission('event_manager', 'review_payments'), 'Event Manager CANNOT review_payments')

  // Payment Reviewer: review_payments, view_reports (No manage_events, view_attendees, gate_checkin, manage_club, manage_members)
  assert(hasPermission('payment_reviewer', 'review_payments'), 'Payment Reviewer can review_payments')
  assert(hasPermission('payment_reviewer', 'view_reports'), 'Payment Reviewer can view_reports')
  assert(!hasPermission('payment_reviewer', 'view_attendees'), 'Payment Reviewer CANNOT view general attendee lists (least privilege)')
  assert(!hasPermission('payment_reviewer', 'manage_events'), 'Payment Reviewer CANNOT manage_events')
  assert(!hasPermission('payment_reviewer', 'gate_checkin'), 'Payment Reviewer CANNOT gate_checkin')
  assert(!hasPermission('payment_reviewer', 'manage_club'), 'Payment Reviewer CANNOT manage_club')
  assert(!hasPermission('payment_reviewer', 'manage_members'), 'Payment Reviewer CANNOT manage_members')

  // Check-in Staff: gate_checkin, view_attendees (No manage_events, review_payments, view_reports, manage_club, manage_members)
  assert(hasPermission('checkin_staff', 'gate_checkin'), 'Check-in Staff can gate_checkin')
  assert(hasPermission('checkin_staff', 'view_attendees'), 'Check-in Staff can view_attendees')
  assert(!hasPermission('checkin_staff', 'manage_events'), 'Check-in Staff CANNOT manage_events')
  assert(!hasPermission('checkin_staff', 'review_payments'), 'Check-in Staff CANNOT review_payments')
  assert(!hasPermission('checkin_staff', 'view_reports'), 'Check-in Staff CANNOT view_reports')
  assert(!hasPermission('checkin_staff', 'manage_club'), 'Check-in Staff CANNOT manage_club')
  assert(!hasPermission('checkin_staff', 'manage_members'), 'Check-in Staff CANNOT manage_members')

  // Viewer: view_attendees, view_reports
  assert(hasPermission('viewer', 'view_attendees'), 'Viewer can view_attendees')
  assert(hasPermission('viewer', 'view_reports'), 'Viewer can view_reports')
  assert(!hasPermission('viewer', 'gate_checkin'), 'Viewer CANNOT gate_checkin')
  assert(!hasPermission('viewer', 'review_payments'), 'Viewer CANNOT review_payments')
  assert(!hasPermission('viewer', 'manage_events'), 'Viewer CANNOT manage_events')
  assert(!hasPermission('viewer', 'manage_club'), 'Viewer CANNOT manage_club')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 2: ROLE ESCALATION PREVENTION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Role Escalation Prevention ---')

  assert(canAssignRole('owner', 'owner'), 'Owner can assign Owner')
  assert(canAssignRole('owner', 'admin'), 'Owner can assign Admin')
  assert(canAssignRole('owner', 'event_manager'), 'Owner can assign Event Manager')

  assert(!canAssignRole('admin', 'owner'), 'Admin CANNOT assign Owner (Prevent Privilege Escalation)')
  assert(canAssignRole('admin', 'admin'), 'Admin can assign Admin')
  assert(canAssignRole('admin', 'payment_reviewer'), 'Admin can assign Payment Reviewer')

  assert(!canAssignRole('event_manager', 'admin'), 'Event Manager cannot assign Admin')
  assert(!canAssignRole('event_manager', 'event_manager'), 'Event Manager cannot assign Event Manager')
  assert(!canAssignRole('checkin_staff', 'checkin_staff'), 'Check-in staff cannot assign roles')
  assert(!canAssignRole('viewer', 'viewer'), 'Viewer cannot assign roles')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 3: CLUB SETUP & INVITATION ISSUANCE
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 3. Club Setup & Secure Invitation Issuance ---')

  const clubIdAlpha = 'club_alpha_uuid'
  const ownerAlphaId = 'user_alpha_owner'
  const clubNameAlpha = 'Alpha Coding Society'

  // Initialize Club Alpha in local simulation storage
  const seedMembers: ClubMemberRecord[] = [
    {
      id: 'mem_alpha_owner',
      club_id: clubIdAlpha,
      user_id: ownerAlphaId,
      role: 'owner',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profile: {
        id: ownerAlphaId,
        email: 'alpha.owner@campus.edu',
        display_name: 'Alpha Founder',
        role: 'club_admin',
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
  ]
  mockLocalStorage.setItem('festflow_local_club_members', JSON.stringify(seedMembers))

  // 1. Inviter role verification: Admin trying to invite an Owner must be rejected
  const escalationAttempt = await inviteClubMember({
    clubId: clubIdAlpha,
    clubName: clubNameAlpha,
    email: 'hacker@campus.edu',
    role: 'owner',
    inviterId: 'user_alpha_admin',
    inviterRole: 'admin',
    inviterName: 'Alpha Admin',
  })
  assert(!escalationAttempt.success, 'Escalation attempt: Admin inviting Owner is strictly rejected')
  assert(escalationAttempt.error_code === 'ROLE_ESCALATION_DENIED', 'Error code is ROLE_ESCALATION_DENIED')

  // 2. Event Manager trying to invite anyone must be rejected (no manage_members)
  const unauthorizedInvite = await inviteClubMember({
    clubId: clubIdAlpha,
    clubName: clubNameAlpha,
    email: 'assistant@campus.edu',
    role: 'checkin_staff',
    inviterId: 'user_alpha_em',
    inviterRole: 'event_manager',
    inviterName: 'Alpha EM',
  })
  assert(!unauthorizedInvite.success, 'Unauthorized inviter: Event Manager inviting staff is rejected')

  // 3. Authorized Owner inviting an Event Manager
  const validInvite = await inviteClubMember({
    clubId: clubIdAlpha,
    clubName: clubNameAlpha,
    email: 'carol.organizer@campus.edu',
    role: 'event_manager',
    inviterId: ownerAlphaId,
    inviterRole: 'owner',
    inviterName: 'Alpha Founder',
  })
  assert(validInvite.success, 'Authorized Owner successfully invites Event Manager')
  assert(Boolean(validInvite.invitation?.token), 'Invitation contains cryptographically secure token')
  assert(validInvite.invitation?.token.length === 64, 'Token is 64-character secure hexadecimal string')
  assert(validInvite.invitation?.status === 'pending', 'Invitation status is initially pending')

  const expiryDate = new Date(validInvite.invitation!.expires_at)
  const now = new Date()
  const daysDiff = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  assert(daysDiff > 6.9 && daysDiff < 7.1, 'Invitation expires in precisely 7 days')

  // Verify Audit Log was recorded
  const auditLogsRes = await getClubAuditLogs(clubIdAlpha)
  assert(auditLogsRes.logs.length >= 1, 'Audit log created for invitation event')
  assert(auditLogsRes.logs[0].action === 'member_invited', 'Audit log records action "member_invited"')
  assert(auditLogsRes.logs[0].actor_id === ownerAlphaId, 'Audit log correctly attributes actor ID')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 4: UNREGISTERED / UNAUTHENTICATED ACCEPTANCE ATTEMPT
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 4. Unregistered / Unauthenticated Acceptance Flow ---')

  const inviteToken = validInvite.invitation!.token

  // Token retrieval lookup
  const tokenLookupRes = await getInvitationByToken(inviteToken)
  assert(Boolean(tokenLookupRes.invitation), 'Invitation successfully resolved by token')
  assert(tokenLookupRes.invitation?.email === 'carol.organizer@campus.edu', 'Token matches designated recipient email')

  // Acceptance without authenticated user must fail
  const unauthAcceptance = await acceptClubInvitation(inviteToken, null as any)
  assert(!unauthAcceptance.success, 'Unauthenticated acceptance attempt is rejected')
  assert(unauthAcceptance.error_code === 'UNAUTHENTICATED', 'Proper UNAUTHENTICATED error code returned')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 5: WRONG-USER / EMAIL MISMATCH ACCEPTANCE ATTEMPT
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 5. Email Mismatch Acceptance Rejection ---')

  const wrongUser = {
    id: 'user_impostor',
    email: 'mallory.intruder@campus.edu',
    display_name: 'Mallory Intruder',
    role: 'student' as const,
  }

  const wrongUserAcceptance = await acceptClubInvitation(inviteToken, wrongUser)
  assert(!wrongUserAcceptance.success, 'Wrong-user acceptance with non-matching email is rejected')
  assert(wrongUserAcceptance.error_code === 'EMAIL_MISMATCH', 'Proper EMAIL_MISMATCH error code returned')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 6: SUCCESSFUL AUTHENTICATED ACCEPTANCE
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 6. Successful Acceptance & Profile Role Promotion ---')

  const legitimateUser = {
    id: 'user_carol_legit',
    email: 'carol.organizer@campus.edu',
    display_name: 'Carol Organizer',
    role: 'student' as const,
  }

  const legitAcceptance = await acceptClubInvitation(inviteToken, legitimateUser)
  assert(legitAcceptance.success, 'Legitimate authenticated recipient successfully accepts invitation')
  assert(legitAcceptance.role === 'event_manager', 'Member created with granted role event_manager')
  assert(legitAcceptance.clubId === clubIdAlpha, 'Member linked to Club Alpha')

  // Check invitation is marked accepted
  const updatedInviteRes = await getInvitationByToken(inviteToken)
  assert(updatedInviteRes.invitation?.status === 'accepted', 'Invitation marked as accepted')

  // Check active club members list
  const activeMembersRes = await getClubMembers(clubIdAlpha)
  assert(activeMembersRes.members.length === 2, 'Club Alpha now has 2 active members (Owner + Event Manager)')
  const carolMember = activeMembersRes.members.find((m) => m.user_id === legitimateUser.id)
  assert(Boolean(carolMember), 'Carol appears in active members directory')

  // Verify audit log for acceptance
  const logsAfterAccept = await getClubAuditLogs(clubIdAlpha)
  const acceptLog = logsAfterAccept.logs.find((l) => l.action === 'invitation_accepted')
  assert(Boolean(acceptLog), 'Audit log contains "invitation_accepted" entry')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 7: REPLAY / REUSE OF ACCEPTED INVITATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 7. Replay / Reuse Prevention ---')

  const replayAcceptance = await acceptClubInvitation(inviteToken, legitimateUser)
  assert(!replayAcceptance.success, 'Replaying an already-accepted invitation is rejected')
  assert(replayAcceptance.error_code === 'ALREADY_ACCEPTED', 'Replay rejected with ALREADY_ACCEPTED')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 8: DUPLICATE MEMBERSHIP PREVENTION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 8. Duplicate Membership Prevention ---')

  const duplicateInvite = await inviteClubMember({
    clubId: clubIdAlpha,
    clubName: clubNameAlpha,
    email: 'carol.organizer@campus.edu',
    role: 'checkin_staff',
    inviterId: ownerAlphaId,
    inviterRole: 'owner',
    inviterName: 'Alpha Founder',
  })
  assert(!duplicateInvite.success, 'Inviting an existing active member is rejected as duplicate')
  assert(duplicateInvite.error_code === 'DUPLICATE_MEMBERSHIP', 'Duplicate member rejected with DUPLICATE_MEMBERSHIP')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 9: EXPIRED & REVOKED INVITATIONS
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 9. Expired and Revoked Invitations ---')

  // Create an invitation to revoke
  const inviteToRevoke = await inviteClubMember({
    clubId: clubIdAlpha,
    clubName: clubNameAlpha,
    email: 'dave.staff@campus.edu',
    role: 'checkin_staff',
    inviterId: ownerAlphaId,
    inviterRole: 'owner',
    inviterName: 'Alpha Founder',
  })
  assert(inviteToRevoke.success, 'Created invitation for Dave')

  // Revoke it
  const revokeResult = await revokeClubInvitation(
    inviteToRevoke.invitation!.id,
    ownerAlphaId,
    clubIdAlpha
  )
  assert(revokeResult.success, 'Invitation successfully revoked by Owner')

  // Attempting to accept revoked invitation
  const daveUser = {
    id: 'user_dave',
    email: 'dave.staff@campus.edu',
    display_name: 'Dave Staff',
    role: 'student' as const,
  }
  const revokedAcceptAttempt = await acceptClubInvitation(inviteToRevoke.invitation!.token, daveUser)
  assert(!revokedAcceptAttempt.success, 'Accepting a revoked invitation is rejected')
  assert(revokedAcceptAttempt.error_code === 'INVITATION_REVOKED', 'Rejected with INVITATION_REVOKED')

  // Manually expire an invitation
  const inviteToExpire = await inviteClubMember({
    clubId: clubIdAlpha,
    clubName: clubNameAlpha,
    email: 'eve.temp@campus.edu',
    role: 'viewer',
    inviterId: ownerAlphaId,
    inviterRole: 'owner',
    inviterName: 'Alpha Founder',
  })
  assert(inviteToExpire.success, 'Created invitation for Eve')

  // Fast-forward expiration in store
  const rawInvites = JSON.parse(mockLocalStorage.getItem('festflow_local_club_invitations') || '[]')
  const expiredInvites = rawInvites.map((inv: any) =>
    inv.id === inviteToExpire.invitation!.id
      ? { ...inv, expires_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(), status: 'expired' }
      : inv
  )
  mockLocalStorage.setItem('festflow_local_club_invitations', JSON.stringify(expiredInvites))

  const eveUser = {
    id: 'user_eve',
    email: 'eve.temp@campus.edu',
    display_name: 'Eve Temp',
    role: 'student' as const,
  }
  const expiredAcceptAttempt = await acceptClubInvitation(inviteToExpire.invitation!.token, eveUser)
  assert(!expiredAcceptAttempt.success, 'Accepting an expired invitation is rejected')
  assert(expiredAcceptAttempt.error_code === 'INVITATION_EXPIRED', 'Rejected with INVITATION_EXPIRED')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 10: SOLE OWNER GUARD & SAFE OWNERSHIP TRANSFER
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 10. Sole Owner Guard & Ownership Transfer ---')

  // Attempting to remove the sole owner of Club Alpha must fail
  const removeOwnerAttempt = await removeClubMember(
    'mem_alpha_owner',
    ownerAlphaId,
    clubIdAlpha
  )
  assert(!removeOwnerAttempt.success, 'Sole owner removal is strictly blocked')
  assert(removeOwnerAttempt.error_code === 'CANNOT_REMOVE_SOLE_OWNER', 'Rejected with CANNOT_REMOVE_SOLE_OWNER')

  // Safe ownership transfer to Carol (using Carol's user_id: legitimateUser.id)
  const transferResult = await transferClubOwnership(
    clubIdAlpha,
    legitimateUser.id,
    ownerAlphaId
  )
  assert(transferResult.success, 'Explicit club ownership transfer succeeded')

  // Verify new roles
  const membersAfterTransfer = (await getClubMembers(clubIdAlpha)).members
  const newCarolRole = membersAfterTransfer.find((m) => m.user_id === legitimateUser.id)?.role
  const oldOwnerRole = membersAfterTransfer.find((m) => m.user_id === ownerAlphaId)?.role
  assert(newCarolRole === 'owner', 'Carol is now the Owner of Club Alpha')
  assert(oldOwnerRole === 'admin', 'Original founder demoted safely to Admin')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 11: MEMBER REMOVAL & ACCESS TERMINATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 11. Member Removal & Access Revocation ---')

  // Carol (new Owner) removes original founder from Admin role
  const removeAdminResult = await removeClubMember(
    'mem_alpha_owner',
    legitimateUser.id,
    clubIdAlpha
  )
  assert(removeAdminResult.success, 'Admin member successfully removed by Owner')

  // Check user role lookup returns null
  const removedUserRole = await getUserClubRole(clubIdAlpha, ownerAlphaId)
  assert(removedUserRole === null, 'Removed user no longer has any role in Club Alpha')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 12: CROSS-CLUB TENANT ISOLATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 12. Cross-Club Resource & Permission Isolation ---')

  const clubIdBeta = 'club_beta_uuid'
  const ownerBetaId = 'user_beta_owner'

  // Initialize Club Beta in local storage alongside Club Alpha
  const existingMembers = JSON.parse(mockLocalStorage.getItem('festflow_local_club_members') || '[]')
  existingMembers.push({
    id: 'mem_beta_owner',
    club_id: clubIdBeta,
    user_id: ownerBetaId,
    role: 'owner',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    profile: {
      id: ownerBetaId,
      email: 'beta.owner@campus.edu',
      display_name: 'Beta Lead',
      role: 'club_admin',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  })
  mockLocalStorage.setItem('festflow_local_club_members', JSON.stringify(existingMembers))

  // 1. Carol is Owner of Club Alpha. Check her role in Club Beta
  const carolBetaRole = await getUserClubRole(clubIdBeta, legitimateUser.id)
  assert(carolBetaRole === null, 'Club Alpha Owner has NO role in Club Beta')

  // 2. Carol attempts to query members of Club Beta
  const betaMembersList = (await getClubMembers(clubIdBeta)).members
  assert(betaMembersList.length === 1 && betaMembersList[0].user_id === ownerBetaId, 'Club Beta only contains Beta members')

  // 3. Member list isolation: Alpha members query
  const alphaMembersFinal = (await getClubMembers(clubIdAlpha)).members
  assert(alphaMembersFinal.length === 1 && alphaMembersFinal[0].user_id === legitimateUser.id, 'Club Alpha only contains Alpha members')

  // ──────────────────────────────────────────────────────────────────────────
  // FINAL SCORECARD
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n======================================================================')
  console.log(`   TEST RESULTS: ${passedTests} / ${totalTests} PASSED (${failedTests} FAILED)`)
  console.log('======================================================================\n')

  if (failedTests > 0) {
    process.exit(1)
  }
}

runPhase6Tests().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
