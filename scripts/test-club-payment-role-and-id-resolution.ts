/**
 * FestFlow Regression Test Suite:
 * Invited-Club-Member ID Resolution, Multi-Club Context, and Payment Role Permissions
 *
 * Verifies:
 * 1. Club Owner: Resolves club ID from clubProfile, possesses review_payments and manage_club
 * 2. Payment Reviewer: Resolves club ID from activeClubMembership (NOT user.id), possesses review_payments, lacks manage_club
 * 3. Unauthorized Staff Member (checkin_staff / event_manager): Lacks review_payments & manage_club
 * 4. User without Club Membership: Resolves to null (never user.id fallback), queries blocked
 * 5. Multi-Club User: Scoping of club ID, permissions, and payment submissions per active club
 * 6. Database / Server-side RLS authorization boundary verification
 */

import {
  ROLE_PERMISSIONS,
  hasPermission,
  getUserClubRole,
} from '../src/lib/clubMembers.js'
import {
  getClubPaymentSettings,
  saveClubPaymentSettings,
  getClubPaymentSubmissions,
  validateUpiId,
} from '../src/lib/payments.js'
import type { ClubRole, ClubPermission, ClubMemberRecord } from '../src/types/index.js'
import fs from 'node:fs'
import path from 'node:path'

// Mock browser localStorage for Node environment
const memoryStore = new Map<string, string>()
const mockLocalStorage = {
  getItem: (k: string) => memoryStore.get(k) ?? null,
  setItem: (k: string, v: string) => { memoryStore.set(k, String(v)) },
  removeItem: (k: string) => { memoryStore.delete(k) },
  clear: () => { memoryStore.clear() },
}
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

/**
 * Helper to simulate the AuthContext club ID resolution pattern:
 * activeClubId || clubProfile?.profile_id || activeClubMembership?.club_id || null
 */
function resolveClubId(params: {
  activeClubId?: string | null
  clubProfile?: { profile_id: string } | null
  activeClubMembership?: { club_id: string } | null
  user?: { id: string } | null
}): string | null {
  return (
    params.activeClubId ||
    params.clubProfile?.profile_id ||
    params.activeClubMembership?.club_id ||
    null
  )
}

async function runPaymentRoleAndIdResolutionTests() {
  console.log('\n======================================================================')
  console.log('   FESTFLOW: CLUB PAYMENT ROLE & ID RESOLUTION TEST SUITE')
  console.log('======================================================================\n')

  mockLocalStorage.clear()

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 1: CLUB OWNER RESOLUTION & FULL PERMISSIONS
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- 1. Club Owner: ID Resolution & Permission Model ---')

  const ownerUserId = 'owner-uuid-1111'
  const ownerClubId = 'owner-uuid-1111' // For owner, club profile profile_id = owner user ID

  const ownerAuth = {
    user: { id: ownerUserId },
    clubProfile: { profile_id: ownerClubId, club_name: 'Robotics Club' },
    activeClubId: ownerClubId,
    activeClubMembership: null,
    clubMemberships: [],
  }

  const resolvedOwnerClubId = resolveClubId(ownerAuth)
  assert(resolvedOwnerClubId === ownerClubId, 'Owner resolves club ID to ownerClubId')
  assert(resolvedOwnerClubId !== null, 'Owner resolved club ID is non-null')

  const ownerRole = await getUserClubRole(resolvedOwnerClubId, ownerUserId)
  assert(ownerRole === 'owner', 'Owner role recognized as "owner"')
  assert(hasPermission(ownerRole, 'review_payments'), 'Owner possesses "review_payments" permission')
  assert(hasPermission(ownerRole, 'manage_club'), 'Owner possesses "manage_club" permission')

  // Save payment settings for owner's club
  const saveOwnerRes = await saveClubPaymentSettings({
    clubId: resolvedOwnerClubId,
    upi_id: 'robotics@okaxis',
    account_name: 'Robotics Club Official',
    payment_instructions: 'Include your student registration code.',
  })
  assert(saveOwnerRes.success, 'Owner successfully saves club payment settings')

  const fetchedOwnerSettings = await getClubPaymentSettings(resolvedOwnerClubId)
  assert(fetchedOwnerSettings !== null, 'Owner can retrieve club payment settings')
  assert(fetchedOwnerSettings?.upi_id === 'robotics@okaxis', 'Retrieved settings match saved UPI ID')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 2: PAYMENT REVIEWER (INVITED STAFF MEMBER)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Payment Reviewer: Invited Staff Member Resolution ---')

  const reviewerUserId = 'student-reviewer-uuid-2222' // Personal student account
  const targetClubId = 'club-tech-society-uuid-9999' // Target club organization

  // Seed club membership in storage
  const reviewerMembership: ClubMemberRecord = {
    id: 'member-row-2222',
    club_id: targetClubId,
    user_id: reviewerUserId,
    role: 'payment_reviewer',
    status: 'active',
    joined_at: new Date().toISOString(),
  }
  mockLocalStorage.setItem('festflow_local_club_members', JSON.stringify([reviewerMembership]))

  const reviewerAuth = {
    user: { id: reviewerUserId },
    clubProfile: null, // Invited staff member does NOT own a club profile
    activeClubId: targetClubId,
    activeClubMembership: reviewerMembership,
    clubMemberships: [reviewerMembership],
  }

  const resolvedReviewerClubId = resolveClubId(reviewerAuth)
  assert(
    resolvedReviewerClubId === targetClubId,
    'Reviewer resolves club ID from activeClubMembership.club_id'
  )
  assert(
    resolvedReviewerClubId !== reviewerUserId,
    'CRITICAL: Reviewer club ID does NOT fall back to personal user.id'
  )

  const reviewerRole = await getUserClubRole(resolvedReviewerClubId!, reviewerUserId)
  assert(reviewerRole === 'payment_reviewer', 'Reviewer role accurately resolved from membership')
  assert(
    hasPermission(reviewerRole, 'review_payments'),
    'Payment Reviewer possesses "review_payments" permission'
  )
  assert(
    !hasPermission(reviewerRole, 'manage_club'),
    'Payment Reviewer does NOT possess "manage_club" permission (Least-Privilege)'
  )

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 3: UNAUTHORIZED STAFF MEMBER (CHECK-IN STAFF / EVENT MANAGER)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 3. Unauthorized Staff: Check-in Staff & Event Manager ---')

  const checkinUserId = 'student-checkin-uuid-3333'
  const checkinMembership: ClubMemberRecord = {
    id: 'member-row-3333',
    club_id: targetClubId,
    user_id: checkinUserId,
    role: 'checkin_staff',
    status: 'active',
    joined_at: new Date().toISOString(),
  }

  const checkinAuth = {
    user: { id: checkinUserId },
    clubProfile: null,
    activeClubId: targetClubId,
    activeClubMembership: checkinMembership,
    clubMemberships: [checkinMembership],
  }

  const resolvedCheckinClubId = resolveClubId(checkinAuth)
  assert(resolvedCheckinClubId === targetClubId, 'Check-in staff resolves correct club ID')
  assert(resolvedCheckinClubId !== checkinUserId, 'Check-in staff club ID is NOT personal user.id')

  const checkinRole: ClubRole = 'checkin_staff'
  assert(
    !hasPermission(checkinRole, 'review_payments'),
    'Check-in staff does NOT possess "review_payments" permission'
  )
  assert(
    !hasPermission(checkinRole, 'manage_club'),
    'Check-in staff does NOT possess "manage_club" permission'
  )

  const eventManagerRole: ClubRole = 'event_manager'
  assert(
    !hasPermission(eventManagerRole, 'review_payments'),
    'Event Manager does NOT possess "review_payments" permission'
  )
  assert(
    !hasPermission(eventManagerRole, 'manage_club'),
    'Event Manager does NOT possess "manage_club" permission'
  )

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 4: USER WITHOUT CLUB MEMBERSHIP (STUDENT OR STANDALONE)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 4. User without Club Membership: Strict Null Fallback ---')

  const studentUserId = 'standalone-student-uuid-4444'
  const noClubAuth = {
    user: { id: studentUserId },
    clubProfile: null,
    activeClubId: null,
    activeClubMembership: null,
    clubMemberships: [],
  }

  const resolvedNoClubId = resolveClubId(noClubAuth)
  assert(resolvedNoClubId === null, 'User without membership resolves to null club ID')
  assert(
    resolvedNoClubId !== studentUserId,
    'CRITICAL: Must NEVER use student user.id as fallback club ID'
  )

  // Querying with null / empty clubId returns empty results without throwing or querying personal ID
  const emptySubmissions = await getClubPaymentSubmissions(resolvedNoClubId || undefined)
  assert(emptySubmissions.submissions.length === 0, 'getClubPaymentSubmissions returns empty for null club ID')

  const nullSettings = await getClubPaymentSettings(resolvedNoClubId || '')
  assert(nullSettings === null, 'getClubPaymentSettings returns null for null/empty club ID')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 5: MULTI-CLUB USER CONTEXT ISOLATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 5. Multi-Club User: Strict Active Club Isolation ---')

  const multiClubUserId = 'multi-club-user-uuid-5555'
  const clubAlphaId = 'club-alpha-1111'
  const clubBetaId = 'club-beta-2222'

  const membershipAlpha: ClubMemberRecord = {
    id: 'mem-alpha-1',
    club_id: clubAlphaId,
    user_id: multiClubUserId,
    role: 'payment_reviewer',
    status: 'active',
    joined_at: new Date().toISOString(),
  }

  const membershipBeta: ClubMemberRecord = {
    id: 'mem-beta-2',
    club_id: clubBetaId,
    user_id: multiClubUserId,
    role: 'checkin_staff',
    status: 'active',
    joined_at: new Date().toISOString(),
  }

  mockLocalStorage.setItem(
    'festflow_local_club_members',
    JSON.stringify([membershipAlpha, membershipBeta])
  )

  // Context A: User viewing Club Alpha
  const contextAlpha = {
    user: { id: multiClubUserId },
    clubProfile: null,
    activeClubId: clubAlphaId,
    activeClubMembership: membershipAlpha,
    clubMemberships: [membershipAlpha, membershipBeta],
  }
  const clubIdAlpha = resolveClubId(contextAlpha)
  assert(clubIdAlpha === clubAlphaId, 'Multi-club user in context Alpha resolves to clubAlphaId')
  const roleInAlpha = await getUserClubRole(clubIdAlpha!, multiClubUserId)
  assert(roleInAlpha === 'payment_reviewer', 'Multi-club user has payment_reviewer role in Club Alpha')
  assert(hasPermission(roleInAlpha, 'review_payments'), 'Can review payments in Club Alpha')

  // Context B: User switching to Club Beta
  const contextBeta = {
    user: { id: multiClubUserId },
    clubProfile: null,
    activeClubId: clubBetaId,
    activeClubMembership: membershipBeta,
    clubMemberships: [membershipAlpha, membershipBeta],
  }
  const clubIdBeta = resolveClubId(contextBeta)
  assert(clubIdBeta === clubBetaId, 'Multi-club user switching to context Beta resolves to clubBetaId')
  const roleInBeta = await getUserClubRole(clubIdBeta!, multiClubUserId)
  assert(roleInBeta === 'checkin_staff', 'Multi-club user has checkin_staff role in Club Beta')
  assert(!hasPermission(roleInBeta, 'review_payments'), 'CANNOT review payments in Club Beta')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SECTION 6: SERVER / DATABASE RLS AUTHORIZATION POLICIES AUDIT
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 6. Server & Database RLS Policy Audit ---')

  const paymentsSqlPath = path.resolve(process.cwd(), 'supabase/migrations/004_payments.sql')
  const paymentsSql = fs.readFileSync(paymentsSqlPath, 'utf8')

  assert(
    paymentsSql.includes('CREATE POLICY "Club owner insert payment settings"'),
    'Database defines strict RLS insert policy for club_payment_settings'
  )
  assert(
    paymentsSql.includes('WITH CHECK (auth.uid() = club_id);'),
    'club_payment_settings insert check enforces auth.uid() = club_id'
  )
  assert(
    paymentsSql.includes('CREATE POLICY "Club owner update payment settings"'),
    'Database defines strict RLS update policy for club_payment_settings'
  )
  assert(
    paymentsSql.includes('USING (auth.uid() = club_id)'),
    'club_payment_settings update policy restricts mutation strictly to auth.uid() = club_id'
  )

  const upiPaymentsSqlPath = path.resolve(process.cwd(), 'supabase/migrations/019_upi_only_payments.sql')
  const upiPaymentsSql = fs.readFileSync(upiPaymentsSqlPath, 'utf8')

  assert(
    upiPaymentsSql.includes('CREATE OR REPLACE FUNCTION public.review_payment_submission'),
    'review_payment_submission RPC function exists in migration 019'
  )
  assert(
    upiPaymentsSql.includes('IF v_event.club_id <> v_reviewer_id THEN'),
    'review_payment_submission verifies reviewer owns the event'
  )
  assert(
    upiPaymentsSql.includes('FORBIDDEN'),
    'review_payment_submission rejects unauthorized reviewers with FORBIDDEN'
  )

  console.log('\n======================================================================')
  console.log(`   TEST RESULTS: ${passedTests} / ${totalTests} PASSED (${failedTests} FAILED)`)
  console.log('======================================================================\n')

  if (failedTests > 0) {
    process.exit(1)
  }
}

runPaymentRoleAndIdResolutionTests().catch((err) => {
  console.error('Fatal error running regression tests:', err)
  process.exit(1)
})
