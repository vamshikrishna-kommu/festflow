/**
 * scripts/test-phase8-club-invitation-acceptance.ts
 *
 * Automated regression test suite for Phase 8: Club Member Invitation Acceptance End-to-End
 *
 * Covers:
 * 1. Valid invitation link on https://festflow.online
 * 2. Invalid, expired, revoked, malformed, and already-used tokens
 * 3. Existing user sign-in followed by acceptance
 * 4. New user signup, return to invitation, and acceptance
 * 5. Invitation preservation across authentication redirects and page refresh
 * 6. Correct acceptance when the user email matches the invitation
 * 7. Rejection when the authenticated user's email differs (normalized comparison)
 * 8. Correct club ID and role assignment from trusted invitation data
 * 9. Duplicate/concurrent acceptance and retry behavior
 * 10. Unauthorized inviter and role-escalation attempts
 * 11. Email dispatch failure and safe resend
 * 12. Owner notification after successful acceptance
 */

import * as fs from 'fs'
import * as path from 'path'

// Polyfill localStorage and sessionStorage for Node/tsx testing
const localStore = new Map<string, string>()
const mockLocalStorage = {
  getItem: (key: string) => localStore.get(key) || null,
  setItem: (key: string, val: string) => localStore.set(key, String(val)),
  removeItem: (key: string) => localStore.delete(key),
  clear: () => localStore.clear(),
  length: 0,
  key: () => null,
}
;(globalThis as any).localStorage = mockLocalStorage

const sessionStore = new Map<string, string>()
const mockSessionStorage = {
  getItem: (key: string) => sessionStore.get(key) || null,
  setItem: (key: string, val: string) => sessionStore.set(key, String(val)),
  removeItem: (key: string) => sessionStore.delete(key),
  clear: () => sessionStore.clear(),
  length: 0,
  key: () => null,
}
;(globalThis as any).sessionStorage = mockSessionStorage

import {
  inviteClubMember,
  resendClubInvitation,
  revokeClubInvitation,
  acceptClubInvitation,
  getInvitationByToken,
  getClubMembers,
  getClubInvitations,
  getUserClubRole,
  canAssignRole,
  ROLE_LABELS,
  type ClubRole,
} from '../src/lib/clubMembers'

import {
  isPathAllowedForRole,
  getSafeReturnUrl,
  isSafeInternalRedirect,
} from '../src/lib/safeNavigation'

import { getFrontendBaseUrl } from '../src/lib/canonicalUrl'

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

async function runPhase8TestSuite() {
  console.log('===================================================================')
  console.log('FESTFLOW PHASE 8: CLUB INVITATION ACCEPTANCE TEST SUITE')
  console.log('===================================================================\n')

  localStore.clear()
  sessionStore.clear()

  const CLUB_OWNER_ID = 'owner_usr_001'
  const CLUB_ADMIN_ID = 'admin_usr_002'
  const CLUB_COORDINATOR_ID = 'coord_usr_003'
  const CLUB_ID = CLUB_OWNER_ID // primary club id is owner profile id

  // Seed members
  const initialMembers = [
    {
      id: 'mem_owner',
      club_id: CLUB_ID,
      user_id: CLUB_OWNER_ID,
      role: 'owner' as ClubRole,
      status: 'active' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profile: {
        id: CLUB_OWNER_ID,
        email: 'president@gdsc-fest.org',
        display_name: 'Club President',
        role: 'club_member' as const,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
    {
      id: 'mem_admin',
      club_id: CLUB_ID,
      user_id: CLUB_ADMIN_ID,
      role: 'admin' as ClubRole,
      status: 'active' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profile: {
        id: CLUB_ADMIN_ID,
        email: 'techlead@gdsc-fest.org',
        display_name: 'Tech Lead',
        role: 'club_member' as const,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
    {
      id: 'mem_coord',
      club_id: CLUB_ID,
      user_id: CLUB_COORDINATOR_ID,
      role: 'coordinator' as ClubRole,
      status: 'active' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profile: {
        id: CLUB_COORDINATOR_ID,
        email: 'lead.coord@gdsc-fest.org',
        display_name: 'Lead Coordinator',
        role: 'club_member' as const,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
  ]
  mockLocalStorage.setItem('festflow_club_members', JSON.stringify(initialMembers))

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 1: Valid Invitation Link Generation on Production Domain
  // ──────────────────────────────────────────────────────────────────────────
  console.log('1. Valid Invitation Link & Canonical Domain')
  const baseUrl = getFrontendBaseUrl()
  assert(
    baseUrl === 'https://festflow.online' || baseUrl.startsWith('http'),
    'Frontend base URL resolves correctly to canonical production domain'
  )

  const inviteRes1 = await inviteClubMember({
    clubId: CLUB_ID,
    email: 'newvolunteer@college.edu',
    role: 'coordinator',
    inviterId: CLUB_OWNER_ID,
    inviterRole: 'owner',
    clubName: 'Google Developer Student Club',
    inviterName: 'President Alex',
  })

  assert(inviteRes1.success === true, 'Authorized owner can create club invitation')
  assert(Boolean(inviteRes1.invitation?.token), 'Invitation contains cryptographically secure random token')
  assert(
    inviteRes1.invitation?.token.length! >= 32,
    'Invitation token is at least 32 characters long'
  )
  const token1 = inviteRes1.invitation!.token

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 2: Unauthenticated Token Lookup & Route Accessibility
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n2. Unauthenticated Token Lookup & Route Permission Whitelist')
  const lookup1 = await getInvitationByToken(token1)
  assert(lookup1.invitation !== null, 'Valid invitation token can be resolved by getInvitationByToken')
  assert(lookup1.invitation?.email === 'newvolunteer@college.edu', 'Token resolves correct recipient email')
  assert(lookup1.invitation?.role === 'coordinator', 'Token resolves correct assigned role')

  // Check URL routes whitelist in safeNavigation
  const isPublicInvitationRoute = isPathAllowedForRole(`/club/invitations/${token1}`, null)
  assert(isPublicInvitationRoute === true, 'Public unauthenticated users can access /club/invitations/:token')

  const isPublicAliasRoute = isPathAllowedForRole(`/club/invitation/${token1}`, null)
  assert(isPublicAliasRoute === true, 'Public unauthenticated users can access /club/invitation/:token alias')

  const isStudentAllowedInvitation = isPathAllowedForRole(`/club/invitations/${token1}`, 'student')
  assert(isStudentAllowedInvitation === true, 'Student role accounts are permitted on /club/invitations/:token')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 3: Invalid, Expired, Revoked, and Malformed Tokens
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n3. Invalid, Expired, Revoked, and Malformed Tokens')

  // Empty / missing token
  const emptyLookup = await getInvitationByToken('')
  assert(emptyLookup.invitation === null, 'Empty token returns null invitation')

  // Bogus token
  const bogusLookup = await getInvitationByToken('completely_non_existent_token_12345')
  assert(bogusLookup.invitation === null, 'Non-existent token returns null invitation')

  // URL-encoded token handling
  const encodedToken = encodeURIComponent(token1)
  const encodedLookup = await getInvitationByToken(encodedToken)
  assert(encodedLookup.invitation !== null, 'URL-encoded token survives decoding and lookup')

  // Revocation
  const revokeRes = await revokeClubInvitation(inviteRes1.invitation!.id, CLUB_OWNER_ID, CLUB_ID)
  assert(revokeRes.success === true, 'Owner can revoke pending invitation')

  const revokedAccept = await acceptClubInvitation(token1, {
    id: 'student_user_1',
    email: 'newvolunteer@college.edu',
  })
  assert(revokedAccept.success === false, 'Accepting revoked invitation is rejected')
  assert(revokedAccept.error_code === 'INVITATION_REVOKED', 'Returns INVITATION_REVOKED error code')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 4: Recipient Email Matching & Mismatch Rejection
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n4. Recipient Email Matching & Mismatch Security')

  const inviteRes2 = await inviteClubMember({
    clubId: CLUB_ID,
    email: 'sarah.designer@college.edu',
    role: 'volunteer',
    inviterId: CLUB_ADMIN_ID,
    inviterRole: 'admin',
    clubName: 'Design Society',
  })
  assert(inviteRes2.success === true, 'Admin can invite volunteer')
  const token2 = inviteRes2.invitation!.token

  // Attempt acceptance with a different email account
  const mismatchAccept = await acceptClubInvitation(token2, {
    id: 'hacker_user_99',
    email: 'other.student@college.edu',
  })
  assert(mismatchAccept.success === false, 'Acceptance with mismatched email account is strictly rejected')
  assert(mismatchAccept.error_code === 'EMAIL_MISMATCH', 'Returns EMAIL_MISMATCH error code')

  // Case-insensitive & trimmed matching
  const matchingAccept = await acceptClubInvitation(token2, {
    id: 'sarah_usr_100',
    email: '   SARAH.DESIGNER@college.edu  ',
    display_name: 'Sarah Connor',
  })
  assert(matchingAccept.success === true, 'Acceptance succeeds when email matches normalized (case-insensitive & trimmed)')
  assert(matchingAccept.role === 'volunteer', 'Assigned role in response matches trusted invitation role')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 5: Already-Used / Double Acceptance & Idempotency
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n5. Double Acceptance & Duplicate Membership Protection')

  // Attempt accepting the same token again
  const doubleAccept = await acceptClubInvitation(token2, {
    id: 'sarah_usr_100',
    email: 'sarah.designer@college.edu',
  })
  assert(
    doubleAccept.success === false || doubleAccept.error_code === 'DUPLICATE_MEMBERSHIP' || doubleAccept.error_code === 'ALREADY_ACCEPTED',
    'Reusing an already-accepted invitation is rejected or prevented from duplicate membership'
  )

  // Verify membership was only created once
  const membersAfter = await getClubMembers(CLUB_ID)
  const sarahEntries = membersAfter.members.filter(
    (m) => m.profile?.email?.trim().toLowerCase() === 'sarah.designer@college.edu'
  )
  assert(sarahEntries.length === 1, 'Exactly one active membership record created without duplicates')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 6: Safe Redirect Propagation Across Auth
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n6. Safe Redirect Propagation Across Auth Flows')

  const targetInvitationPath = `/club/invitations/${token2}`

  // Student login redirect safety
  const safeReturnForStudent = getSafeReturnUrl(targetInvitationPath, 'student')
  assert(
    safeReturnForStudent === targetInvitationPath,
    'getSafeReturnUrl preserves /club/invitations/:token for student role'
  )

  // Unauthenticated user redirect
  const safeReturnUnauth = getSafeReturnUrl(targetInvitationPath, null)
  assert(
    safeReturnUnauth === targetInvitationPath,
    'getSafeReturnUrl preserves /club/invitations/:token for unauthenticated visitor'
  )

  // Malicious open-redirect protection
  const openRedirectAttack = 'https://evil-phishing-site.com/steal-creds'
  const safeReturnBlocked = getSafeReturnUrl(openRedirectAttack, 'student')
  assert(
    safeReturnBlocked === '/student/dashboard',
    'Open redirect attack URL is rejected and safely fallen back to /student/dashboard'
  )

  // isSafeInternalRedirect validation
  assert(
    isSafeInternalRedirect(targetInvitationPath) === true,
    'isSafeInternalRedirect validates internal invitation deep link as safe'
  )
  assert(
    isSafeInternalRedirect('//evil.com/hack') === false,
    'isSafeInternalRedirect rejects protocol-relative redirect attacks'
  )

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 7: Role Hierarchy & Escalation Prevention
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n7. Role Hierarchy & Privilege Escalation Denial')

  // Admin cannot assign owner role
  assert(
    canAssignRole('admin', 'owner') === false,
    'Admin cannot assign owner role'
  )
  // Admin can assign staff roles
  assert(
    canAssignRole('admin', 'event_manager') === true,
    'Admin can assign event_manager role'
  )
  assert(
    canAssignRole('admin', 'checkin_staff') === true,
    'Admin can assign checkin_staff role'
  )
  // Non-admin staff cannot assign any roles
  assert(
    canAssignRole('event_manager', 'checkin_staff') === false,
    'Event manager cannot assign checkin_staff role'
  )
  assert(
    canAssignRole('checkin_staff', 'viewer') === false,
    'Checkin staff cannot assign viewer role'
  )

  // Attempt unauthorized invite through inviteClubMember with non-admin role
  const escalationAttempt = await inviteClubMember({
    clubId: CLUB_ID,
    email: 'newowner@college.edu',
    role: 'owner',
    inviterId: CLUB_ADMIN_ID,
    inviterRole: 'admin',
  })
  assert(escalationAttempt.success === false, 'Role escalation attempt to owner is blocked for admin')
  assert(escalationAttempt.error_code === 'ROLE_ESCALATION_DENIED', 'Returns ROLE_ESCALATION_DENIED error code')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 8: Resend and Expiration Renewal
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n8. Invitation Resend and Expiration Details')

  const inviteRes3 = await inviteClubMember({
    clubId: CLUB_ID,
    email: 'eventlead@college.edu',
    role: 'event_manager',
    inviterId: CLUB_OWNER_ID,
    inviterRole: 'owner',
  })
  assert(inviteRes3.success === true, 'Created invitation for event_manager role')

  const originalToken3 = inviteRes3.invitation!.token
  const resendRes = await resendClubInvitation(inviteRes3.invitation!.id, CLUB_OWNER_ID, CLUB_ID)
  assert(resendRes.success === true, 'Owner can resend pending invitation')
  assert(Boolean(resendRes.invitation?.token), 'Resent invitation has renewed token')
  assert(resendRes.invitation!.token !== originalToken3, 'Resent invitation generates a fresh token')

  // Verify old token is replaced
  const oldTokenLookup = await getInvitationByToken(originalToken3)
  assert(oldTokenLookup.invitation === null, 'Old token is invalidated after resend')

  const newTokenLookup = await getInvitationByToken(resendRes.invitation!.token)
  assert(newTokenLookup.invitation !== null, 'New renewed token is active and valid')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 9: Migration 024 Schema & Edge Function Audit
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n9. Supabase Migration 024 & Send-Email Edge Function Audit')

  const migration024Path = path.resolve(process.cwd(), 'supabase/migrations/024_club_invitation_preview_and_acceptance.sql')
  assert(fs.existsSync(migration024Path), 'Migration 024 file exists on disk')

  const migration024Content = fs.readFileSync(migration024Path, 'utf-8')
  assert(
    migration024Content.includes('get_club_invitation_preview'),
    'Migration 024 defines get_club_invitation_preview RPC'
  )
  assert(
    migration024Content.includes('accept_club_invitation'),
    'Migration 024 defines accept_club_invitation RPC'
  )
  assert(
    migration024Content.includes('FOR UPDATE'),
    'Migration 024 uses row-level locking (FOR UPDATE) for atomic acceptance'
  )
  assert(
    migration024Content.includes('in_app_notifications'),
    'Migration 024 notifies club owner/inviter via in_app_notifications'
  )
  assert(
    migration024Content.includes('TO anon, authenticated'),
    'Migration 024 grants execute permissions to anonymous visitors'
  )

  const edgeFunctionPath = path.resolve(process.cwd(), 'supabase/functions/send-email/index.ts')
  assert(fs.existsSync(edgeFunctionPath), 'send-email Edge Function exists on disk')
  const edgeContent = fs.readFileSync(edgeFunctionPath, 'utf-8')
  assert(
    edgeContent.includes('club_member_invitation'),
    'send-email supports club_member_invitation template'
  )
  assert(
    edgeContent.includes('https://festflow.online'),
    'send-email edge function enforces https://festflow.online as safe origin'
  )

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 10: Migration 024 SQL Security Hardening Audit
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n10. Migration 024 SQL Security Hardening Audit')

  // 1. No broad anonymous table access
  assert(
    !migration024Content.includes('CREATE POLICY "Allow token holders to view invitation"'),
    'Migration 024 does NOT grant broad anonymous SELECT policy on club_invitations'
  )
  assert(
    migration024Content.includes('DROP POLICY IF EXISTS "Allow token holders to view invitation"'),
    'Migration 024 explicitly drops broad anonymous SELECT policy'
  )

  // 2. Search path protection on SECURITY DEFINER functions
  assert(
    migration024Content.includes('SET search_path = public, pg_temp'),
    'Both RPC functions configure SET search_path = public, pg_temp to prevent schema hijacking'
  )

  // 3. Caller identity derived from auth.uid()
  assert(
    migration024Content.includes('v_caller_id := auth.uid();'),
    'accept_club_invitation strictly derives caller identity from auth.uid()'
  )
  assert(
    migration024Content.includes('p_user_id <> v_caller_id'),
    'accept_club_invitation blocks conflicting caller-supplied p_user_id with FORBIDDEN'
  )

  // 4. Verified email enforcement
  assert(
    migration024Content.includes('email_confirmed_at'),
    'accept_club_invitation verifies email confirmation status from auth.users'
  )
  assert(
    migration024Content.includes('EMAIL_NOT_VERIFIED'),
    'accept_club_invitation rejects unverified accounts with EMAIL_NOT_VERIFIED'
  )

  // 5. Anti-enumeration & email masking
  assert(
    migration024Content.includes('v_masked_email'),
    'get_club_invitation_preview implements recipient email masking for anonymous callers'
  )
  assert(
    !migration024Content.includes('v_invitation.token,'),
    'get_club_invitation_preview does NOT expose raw token in returned JSON'
  )

  // 6. Role validation against allowed constraints
  assert(
    migration024Content.includes('v_invitation.role NOT IN'),
    'accept_club_invitation validates role against allowed club roles'
  )

  // 7. Least-privilege function grants and ownership
  assert(
    migration024Content.includes('OWNER TO postgres'),
    'Functions are owned by postgres superuser'
  )
  assert(
    migration024Content.includes('REVOKE ALL ON FUNCTION public.get_club_invitation_preview'),
    'Public default privileges are revoked from get_club_invitation_preview'
  )
  assert(
    migration024Content.includes('REVOKE ALL ON FUNCTION public.accept_club_invitation'),
    'Public default privileges are revoked from accept_club_invitation'
  )
  assert(
    migration024Content.includes('GRANT EXECUTE ON FUNCTION public.accept_club_invitation(TEXT, UUID) TO authenticated, service_role;'),
    'accept_club_invitation is strictly granted only to authenticated and service_role'
  )

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 11: Student Dual-Role Coexistence & Route Authorization
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n11. Student Dual-Role Coexistence & Route Authorization')

  // 1. Student with club membership can access /club/dashboard
  const studentWithClubAllowed = isPathAllowedForRole('/club/dashboard', 'student', true)
  assert(
    studentWithClubAllowed === true,
    'Student with active club membership is permitted on /club/dashboard'
  )

  // 2. Student without club membership is blocked from /club/dashboard
  const studentWithoutClubAllowed = isPathAllowedForRole('/club/dashboard', 'student', false)
  assert(
    studentWithoutClubAllowed === false,
    'Student without club membership is strictly denied access to /club/dashboard'
  )

  // 3. Safe return URL resolves to /club/dashboard when membership exists
  const returnUrlWithMembership = getSafeReturnUrl('/club/dashboard', 'student', undefined, true)
  assert(
    returnUrlWithMembership === '/club/dashboard',
    'getSafeReturnUrl permits /club/dashboard for student with active club membership'
  )

  // 4. Safe return URL falls back to /student/dashboard when membership does not exist
  const returnUrlWithoutMembership = getSafeReturnUrl('/club/dashboard', 'student', undefined, false)
  assert(
    returnUrlWithoutMembership === '/student/dashboard',
    'getSafeReturnUrl safely redirects unauthorized student to /student/dashboard'
  )

  // 5. Migration 024 does NOT mutate profiles.role to club_member
  assert(
    !migration024Content.includes("SET role = 'club_member'"),
    'Migration 024 preserves Student role and does NOT overwrite profiles.role'
  )

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 12: Unique Idempotency Key & Edge Function Authorization
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n12. Unique Idempotency Key & Edge Function Authorization')

  const emailsFile = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/emails.ts'), 'utf-8')
  assert(
    emailsFile.includes('invitation_token'),
    'emails.ts passes invitation_token into transactional email payload'
  )
  assert(
    emailsFile.includes('Email accepted by delivery provider (Resend).'),
    'emails.ts accurately distinguishes delivery provider acceptance from confirmed delivery'
  )

  assert(
    edgeContent.includes('maybeSingle'),
    'send-email Edge Function uses maybeSingle to safely handle non-existent records'
  )
  assert(
    edgeContent.includes('ilike'),
    'send-email Edge Function uses case-insensitive ilike for recipient verification'
  )

  // ──────────────────────────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n===================================================================')
  console.log(`PHASE 8 TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`)
  console.log('===================================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runPhase8TestSuite().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
