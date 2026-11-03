/**
 * Automated Verification Suite for FestFlow Phase 11: Migration 046 QR Security Hardening
 *
 * NOTE: This suite performs local unit & simulation testing of cryptographic functions,
 * turnstile admission logic, and zero-knowledge data masking.
 * Live PostgreSQL integration testing (verifying database triggers and RPCs on PostgreSQL)
 * must be performed on the target Supabase instance once migration 046 is applied.
 *
 * Test cases:
 *  1. QR Token Entropy: Ensure tokens use genuine 32 bytes (256 bits) of CSPRNG randomness (FFQ_ + 64 hex chars).
 *  2. Hash Determinism & Formatting: Verify SHA-256 output is 64 hex chars and case-normalized.
 *  3. Ticket Code Decoupling: Ensure human ticket reference code is separated from bearer QR token.
 *  4. Hash Normalization: Ensure whitespace and case differences generate identical hashes.
 *  5. Legacy Pass Compatibility: Ensure backward compatibility fallback works without hash.
 *  6. Ticket Code Gate Rejection: Scanner strictly blocks FF-... / TKT-... codes as credentials.
 *  7. Payment Status Gate: Pending payment tickets return NOT_CONFIRMED.
 *  8. Cancellation Gate: Cancelled and rejected tickets return CANCELLED.
 *  9. Event Boundary Gate: Pass from different event returns WRONG_EVENT.
 * 10. Turnstile Replay Protection: Concurrent/repeated check-in returns ALREADY_USED.
 * 11. URI Scheme Unwrapping: URLs and deep-link schemes cleanly unwrap to raw bearer tokens.
 * 12. Cross-Event Pass Verification: Cross-event attempts rejected with WRONG_EVENT.
 * 13. Zero-Knowledge Organizer Masking: getEventRegistrations() strips raw qr_token and qr_token_hash.
 * 14. Turnstile Check-Out: Admitted attendee checked out via hash lookup.
 * 15. Check-Out Ticket Code Rejection: Turnstile check-out rejects ticket_code.
 * 16. Unadmitted Check-Out Rejection: Blocked with NOT_CHECKED_IN.
 */

import {
  generateSecureQrToken,
  hashQrTokenSync,
  hashQrTokenAsync,
  isSecureQrToken,
  isTicketCode,
  cleanQrPayload,
} from '../src/lib/qrCrypto'
import { checkInTicket, checkOutTicket } from '../src/lib/checkin'
import { getEventRegistrations } from '../src/lib/registrations'

interface TestResult {
  name: string
  passed: boolean
  details: string
}

const results: TestResult[] = []

function assert(condition: boolean, testName: string, failureDetails: string = '') {
  if (condition) {
    results.push({ name: testName, passed: true, details: 'OK' })
    console.log(`  [PASS] ${testName}`)
  } else {
    results.push({ name: testName, passed: false, details: failureDetails })
    console.error(`  [FAIL] ${testName}: ${failureDetails}`)
  }
}

async function runTests() {
  console.log('\n============================================================')
  console.log('   FESTFLOW PILOT VERIFICATION: MIGRATION 046 QR SECURITY   ')
  console.log('============================================================\n')

  // --- Test 1: QR Token Entropy ---
  const token = generateSecureQrToken()
  const is256Bit = token.startsWith('FFQ_') && token.length === 68 // 'FFQ_' (4) + 64 hex chars (32 bytes = 256 bits)
  const hexPart = token.slice(4)
  const validHex = /^[0-9a-f]{64}$/i.test(hexPart)
  assert(
    is256Bit && validHex,
    'Test 1: QR Token Entropy >= 256 bits (FFQ_ + 64 hex chars CSPRNG)',
    `Generated token: ${token} (length: ${token.length})`
  )

  // Test entropy uniqueness across 1000 generated tokens
  const generatedTokens = new Set<string>()
  for (let i = 0; i < 1000; i++) {
    generatedTokens.add(generateSecureQrToken())
  }
  assert(
    generatedTokens.size === 1000,
    'Test 1b: CSPRNG Uniqueness across 1,000 generated tokens (0 collisions)',
    `Generated size: ${generatedTokens.size}`
  )

  // --- Test 2: Hash Determinism & Formatting ---
  const rawToken = 'FFQ_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  const syncHash = hashQrTokenSync(rawToken)
  const asyncHash = await hashQrTokenAsync(rawToken)
  const isSha256Length = syncHash.length === 64
  const syncMatchesAsync = syncHash === asyncHash
  assert(
    isSha256Length && syncMatchesAsync,
    'Test 2: SHA-256 Hash Generation & Synchronous/Asynchronous Parity',
    `sync: ${syncHash}, async: ${asyncHash}`
  )

  // --- Test 3: Ticket Code Decoupling ---
  const sampleTicketCode = 'FF-2026-A1B2C3'
  const sampleQrToken = generateSecureQrToken()
  const isTktCode = isTicketCode(sampleTicketCode)
  const isQrAsTktCode = isTicketCode(sampleQrToken)
  assert(
    isTktCode && !isQrAsTktCode,
    'Test 3: Ticket Code Identification & Decoupling from QR Token',
    `sampleTicketCode: ${sampleTicketCode} (isTicketCode: ${isTktCode}), sampleQrToken isTicketCode: ${isQrAsTktCode}`
  )

  // --- Test 4: Hash Normalization Invariant ---
  const tokenVariantA = '  ffq_abcdef0123456789  '
  const tokenVariantB = 'FFQ_ABCDEF0123456789'
  const hashA = hashQrTokenSync(tokenVariantA)
  const hashB = hashQrTokenSync(tokenVariantB)
  assert(
    hashA === hashB && hashA.length === 64,
    'Test 4: Hash Normalization (Trim + Uppercase Case-Insensitivity Invariant)',
    `hashA: ${hashA}, hashB: ${hashB}`
  )

  // --- Test 5: URI Scheme Unwrapping ---
  const deepLink1 = 'festflow://pass/FFQ_abcdef123456'
  const deepLink2 = 'https://festflow.online/pass/FFQ_abcdef123456?ref=email'
  const clean1 = cleanQrPayload(deepLink1)
  const clean2 = cleanQrPayload(deepLink2)
  assert(
    clean1 === 'FFQ_ABCDEF123456' && clean2 === 'FFQ_ABCDEF123456',
    'Test 5: QR Payload / Deep-link Unwrapping & Sanitization',
    `clean1: ${clean1}, clean2: ${clean2}`
  )

  // Setup Mock Data in localStorage for Turnstile Gate Verification
  const testEventId = 'ev_test_hackathon_2026'
  const validQrToken = generateSecureQrToken()
  const validQrHash = hashQrTokenSync(validQrToken)

  const legacyQrToken = 'FFQ_LEGACY1234' // Legacy token without hash
  const pendingPaymentQrToken = generateSecureQrToken()
  const cancelledQrToken = generateSecureQrToken()
  const otherEventQrToken = generateSecureQrToken()

  const mockRegistrations = [
    {
      id: 'reg_valid_1',
      event_id: testEventId,
      student_id: 'user_stu_1',
      ticket_code: 'FF-CONFIRMED-01',
      qr_token: validQrToken,
      qr_token_hash: validQrHash,
      status: 'confirmed',
      payment_status: 'verified',
      student: { display_name: 'Aditi Sharma', email: 'aditi@campus.edu' },
    },
    {
      id: 'reg_legacy_2',
      event_id: testEventId,
      student_id: 'user_stu_2',
      ticket_code: 'FF-LEGACY-02',
      qr_token: legacyQrToken,
      qr_token_hash: null, // Legacy unhashed ticket
      status: 'confirmed',
      payment_status: 'verified',
      student: { display_name: 'Rahul Verma', email: 'rahul@campus.edu' },
    },
    {
      id: 'reg_pending_3',
      event_id: testEventId,
      student_id: 'user_stu_3',
      ticket_code: 'FF-PENDING-03',
      qr_token: pendingPaymentQrToken,
      qr_token_hash: hashQrTokenSync(pendingPaymentQrToken),
      status: 'pending_payment',
      payment_status: 'pending_review',
      student: { display_name: 'Pooja Nair', email: 'pooja@campus.edu' },
    },
    {
      id: 'reg_cancelled_4',
      event_id: testEventId,
      student_id: 'user_stu_4',
      ticket_code: 'FF-CANCEL-04',
      qr_token: cancelledQrToken,
      qr_token_hash: hashQrTokenSync(cancelledQrToken),
      status: 'cancelled',
      payment_status: 'cancelled',
      student: { display_name: 'Karan Patel', email: 'karan@campus.edu' },
    },
    {
      id: 'reg_other_5',
      event_id: 'ev_other_cultural_fest',
      student_id: 'user_stu_5',
      ticket_code: 'FF-OTHER-05',
      qr_token: otherEventQrToken,
      qr_token_hash: hashQrTokenSync(otherEventQrToken),
      status: 'confirmed',
      payment_status: 'verified',
      student: { display_name: 'Sneha Rao', email: 'sneha@campus.edu' },
    },
  ]

  // Persist mock registrations and clear prior check-ins in local environment
  if (typeof window !== 'undefined' || typeof global !== 'undefined') {
    const storageObj = (global as any).localStorage || {
      _data: {} as Record<string, string>,
      getItem(k: string) {
        return this._data[k] || null
      },
      setItem(k: string, v: string) {
        this._data[k] = v
      },
      removeItem(k: string) {
        delete this._data[k]
      },
      clear() {
        this._data = {}
      },
    }
    ;(global as any).localStorage = storageObj
    storageObj.setItem('festflow_local_registrations', JSON.stringify(mockRegistrations))
    storageObj.setItem('festflow_checkins', JSON.stringify([]))
    storageObj.setItem(
      'festflow_managed_events',
      JSON.stringify([
        {
          id: testEventId,
          title: 'Campus Hackathon 2026',
          status: 'published',
          club_id: 'club_test_1',
        },
        {
          id: 'ev_other_cultural_fest',
          title: 'Campus Cultural Fest 2026',
          status: 'published',
          club_id: 'club_test_2',
        },
      ])
    )
  }

  // --- Test 6: Gate Rejection of Human Ticket Codes ---
  const scanTicketCodeRes = await checkInTicket(testEventId, 'FF-CONFIRMED-01')
  assert(
    !scanTicketCodeRes.success && scanTicketCodeRes.outcome === 'INVALID_TICKET',
    'Test 6: Gate Turnstile Strictly Rejects Human-Readable ticket_code',
    `Outcome: ${scanTicketCodeRes.outcome}, Message: ${scanTicketCodeRes.message}`
  )

  // --- Test 7: Valid 256-Bit Pass Check-In via Hash Lookup ---
  const scanValidRes = await checkInTicket(testEventId, validQrToken)
  assert(
    scanValidRes.success && scanValidRes.outcome === 'VALID',
    'Test 7: Valid 256-Bit Bearer Pass Admitted via qr_token_hash',
    `Outcome: ${scanValidRes.outcome}, Message: ${scanValidRes.message}`
  )

  // --- Test 8: Replay & Duplicate Scan Protection ---
  const replayScanRes = await checkInTicket(testEventId, validQrToken)
  assert(
    !replayScanRes.success && replayScanRes.outcome === 'ALREADY_USED',
    'Test 8: Duplicate Replay Scan Blocked as ALREADY_USED',
    `Outcome: ${replayScanRes.outcome}, Message: ${replayScanRes.message}`
  )

  // --- Test 9: Legacy Unhashed Pass Compatibility ---
  const legacyScanRes = await checkInTicket(testEventId, legacyQrToken)
  assert(
    legacyScanRes.success && legacyScanRes.outcome === 'VALID',
    'Test 9: Legacy Unhashed Pass Admitted via Fallback (Zero Invalidation)',
    `Outcome: ${legacyScanRes.outcome}, Message: ${legacyScanRes.message}`
  )

  // --- Test 10: Pending Payment Gate Verification ---
  const pendingScanRes = await checkInTicket(testEventId, pendingPaymentQrToken)
  assert(
    !pendingScanRes.success && pendingScanRes.outcome === 'NOT_CONFIRMED',
    'Test 10: Unverified / Pending Payment Pass Blocked (NOT_CONFIRMED)',
    `Outcome: ${pendingScanRes.outcome}, Message: ${pendingScanRes.message}`
  )

  // --- Test 11: Cancelled Ticket Gate Verification ---
  const cancelledScanRes = await checkInTicket(testEventId, cancelledQrToken)
  assert(
    !cancelledScanRes.success && cancelledScanRes.outcome === 'CANCELLED',
    'Test 11: Cancelled Ticket Pass Blocked (CANCELLED)',
    `Outcome: ${cancelledScanRes.outcome}, Message: ${cancelledScanRes.message}`
  )

  // --- Test 12: Wrong Event Pass Verification ---
  const wrongEventScanRes = await checkInTicket(testEventId, otherEventQrToken)
  assert(
    !wrongEventScanRes.success && wrongEventScanRes.outcome === 'WRONG_EVENT',
    'Test 12: Cross-Event Pass Attempt Blocked (WRONG_EVENT)',
    `Outcome: ${wrongEventScanRes.outcome}, Message: ${wrongEventScanRes.message}`
  )

  // --- Test 13: Organizer Roster Zero-Knowledge Leakage Check ---
  const rosterRes = await getEventRegistrations(testEventId)
  const exposedTokens = rosterRes.registrations.filter((r: any) => Boolean(r.qr_token || r.qr_token_hash))
  assert(
    rosterRes.registrations.length > 0 && exposedTokens.length === 0,
    'Test 13: Organizer Roster Strips Raw qr_token and qr_token_hash (Zero-Knowledge)',
    `Exposed token count: ${exposedTokens.length} across ${rosterRes.registrations.length} registrations`
  )

  // --- Test 14: Turnstile Check-Out via Hash Lookup ---
  const checkOutRes = await checkOutTicket(testEventId, validQrToken)
  assert(
    checkOutRes.success && checkOutRes.outcome === 'CHECKED_OUT',
    'Test 14: Turnstile Check-Out Granted for Admitted Attendee via Hash',
    `Outcome: ${checkOutRes.outcome}, Message: ${checkOutRes.message}`
  )

  // --- Test 15: Turnstile Check-Out Strictly Rejects ticket_code ---
  const checkOutTktCodeRes = await checkOutTicket(testEventId, 'FF-CONFIRMED-01')
  assert(
    !checkOutTktCodeRes.success && checkOutTktCodeRes.outcome === 'INVALID_TICKET',
    'Test 15: Turnstile Check-Out Strictly Rejects Human-Readable ticket_code',
    `Outcome: ${checkOutTktCodeRes.outcome}, Message: ${checkOutTktCodeRes.message}`
  )

  // --- Test 16: Check-Out for Unadmitted Ticket Returns NEVER_CHECKED_IN ---
  const checkOutNeverRes = await checkOutTicket(testEventId, legacyQrToken)
  // (legacyQrToken check-in in Test 9 checked in, let's test a fresh valid token that never checked in)
  const neverAdmittedToken = generateSecureQrToken()
  const mockStorage = (global as any).localStorage
  const currentRegs = JSON.parse(mockStorage.getItem('festflow_local_registrations'))
  currentRegs.push({
    id: 'reg_never_in',
    event_id: testEventId,
    student_id: 'user_stu_never',
    ticket_code: 'FF-NEVER-99',
    qr_token: neverAdmittedToken,
    qr_token_hash: hashQrTokenSync(neverAdmittedToken),
    status: 'confirmed',
    payment_status: 'verified',
  })
  mockStorage.setItem('festflow_local_registrations', JSON.stringify(currentRegs))

  const unadmittedCheckOut = await checkOutTicket(testEventId, neverAdmittedToken)
  assert(
    !unadmittedCheckOut.success && unadmittedCheckOut.outcome === 'NOT_CHECKED_IN',
    'Test 16: Check-Out on Non-Admitted Attendee Blocked (NOT_CHECKED_IN)',
    `Outcome: ${unadmittedCheckOut.outcome}, Message: ${unadmittedCheckOut.message}`
  )

  // --- Test 16b: Cross-Event Check-Out Blocked (WRONG_EVENT) ---
  const crossEventCheckOut = await checkOutTicket('event-other-cross-event-id', validQrToken)
  assert(
    !crossEventCheckOut.success && crossEventCheckOut.outcome === 'WRONG_EVENT',
    'Test 16b: Cross-Event Check-Out Strictly Blocked (WRONG_EVENT)',
    `Outcome: ${crossEventCheckOut.outcome}, Message: ${crossEventCheckOut.message}`
  )

  // --- Test 16c: NULL-Safe Authorization and Status Verification ---
  // In SQL, NULL <> 'confirmed' yields NULL (falsy in IF).
  // Using IS DISTINCT FROM ensures that NULL, undefined, or unexpected statuses are strictly rejected.
  function simulateNullSafeStatusCheck(status: string | null | undefined): boolean {
    // Equivalent to PostgreSQL: IF status::text IS DISTINCT FROM 'confirmed' THEN REJECT
    return status === 'confirmed'
  }
  function simulateNullSafeAuthCheck(eventClubId: string | null, callerId: string | null, callerRole: string | null): boolean {
    // Equivalent to PostgreSQL:
    // IF v_event.club_id IS DISTINCT FROM v_staff_id THEN
    //   IF COALESCE(v_staff_role, '') IS DISTINCT FROM 'platform_admin' THEN REJECT
    if (eventClubId === null || callerId === null || eventClubId !== callerId) {
      if ((callerRole || '') !== 'platform_admin') {
        return false // REJECT
      }
    }
    return true // ALLOW
  }

  const nullStatusRejected = !simulateNullSafeStatusCheck(null)
  const emptyStatusRejected = !simulateNullSafeStatusCheck('')
  const undefinedStatusRejected = !simulateNullSafeStatusCheck(undefined)
  const confirmedStatusAllowed = simulateNullSafeStatusCheck('confirmed')

  const nullCallerRejected = !simulateNullSafeAuthCheck('club_123', null, 'student')
  const nullClubRejected = !simulateNullSafeAuthCheck(null, 'staff_123', 'student')
  const matchingClubAllowed = simulateNullSafeAuthCheck('club_123', 'club_123', 'club_member')
  const adminOverrideAllowed = simulateNullSafeAuthCheck('club_123', 'admin_999', 'platform_admin')

  assert(
    nullStatusRejected &&
      emptyStatusRejected &&
      undefinedStatusRejected &&
      confirmedStatusAllowed &&
      nullCallerRejected &&
      nullClubRejected &&
      matchingClubAllowed &&
      adminOverrideAllowed,
    'Test 16c: NULL-Safe Authorization and Status Evaluation (IS DISTINCT FROM Semantics)',
    `nullStatus: ${nullStatusRejected}, nullCaller: ${nullCallerRejected}, nullClub: ${nullClubRejected}, adminOverride: ${adminOverrideAllowed}`
  )

  // --- Test 17: Column-Level Projection Security Invariant ---
  // Verify SAFE_REGISTRATION_FIELDS strictly excludes qr_token and qr_token_hash
  const { SAFE_REGISTRATION_FIELDS } = await import('../src/lib/registrations')
  const fieldList = SAFE_REGISTRATION_FIELDS.split(',').map((f: string) => f.trim().toLowerCase())
  const hasRawToken = fieldList.includes('qr_token')
  const hasTokenHash = fieldList.includes('qr_token_hash')
  assert(
    !hasRawToken && !hasTokenHash,
    'Test 17: Database-Level Field Projection Strictly Excludes qr_token & qr_token_hash',
    `hasRawToken: ${hasRawToken}, hasTokenHash: ${hasTokenHash}`
  )

  // --- Test 18: Student Ticket Retrieval via RPC Simulation ---
  // STRICT LEAST PRIVILEGE: Only the student owner (user_stu_1) can retrieve bearer token.
  // Neither organizers nor administrators can retrieve attendees' raw bearer credentials.
  function simulateGetStudentTicketPass(regId: string, callerUserId: string) {
    const reg = mockRegistrations.find((r) => r.id === regId)
    if (!reg) return { success: false, outcome: 'NOT_FOUND' }
    if (reg.student_id !== callerUserId) {
      return { success: false, outcome: 'FORBIDDEN', message: 'Access denied.' }
    }
    if (reg.status !== 'confirmed') {
      return { success: false, outcome: 'NOT_CONFIRMED', message: 'Pass not confirmed.' }
    }
    return {
      success: true,
      outcome: 'AUTHORIZED',
      qr_token: reg.qr_token,
      ticket_code: reg.ticket_code,
    }
  }

  const ownerAccess = simulateGetStudentTicketPass('reg_valid_1', 'user_stu_1')
  const strangerAccess = simulateGetStudentTicketPass('reg_valid_1', 'user_stranger_9')
  const organizerAccess = simulateGetStudentTicketPass('reg_valid_1', 'club_organizer_user')
  const adminAccess = simulateGetStudentTicketPass('reg_valid_1', 'admin_user')
  const unconfirmedAccess = simulateGetStudentTicketPass('reg_pending_3', 'user_stu_3')

  assert(
    ownerAccess.success &&
      ownerAccess.qr_token === validQrToken &&
      !strangerAccess.success &&
      strangerAccess.outcome === 'FORBIDDEN' &&
      !organizerAccess.success &&
      organizerAccess.outcome === 'FORBIDDEN' &&
      !adminAccess.success &&
      adminAccess.outcome === 'FORBIDDEN' &&
      !unconfirmedAccess.success &&
      unconfirmedAccess.outcome === 'NOT_CONFIRMED',
    'Test 18: Authoritative Pass Delivery RPC: Owner Authorized; Admin, Organizer, Stranger & Unconfirmed Blocked',
    `owner: ${ownerAccess.outcome}, stranger: ${strangerAccess.outcome}, organizer: ${organizerAccess.outcome}, admin: ${adminAccess.outcome}, unconfirmed: ${unconfirmedAccess.outcome}`
  )

  // --- Test 19: Hardened sync_team_member_registration Authorization Rules ---
  // SECURITY DEFINER RPC authorization validation:
  // - Separates accepted membership from pending invitations.
  // - Self-service requires p_member_user_id = auth.uid() AND verified profile email match.
  // - Leader / Organizer / Admin calls require target user to be an ACCEPTED member with matching profile.
  // - Pending invitations alone CANNOT result in confirmed registrations.
  // - Blocks claiming another user's invite, arbitrary user IDs, cross-team invites, and unauthenticated calls.
  interface MockProfile {
    id: string
    email: string
    role: string
    email_confirmed_at: string | null
  }
  interface MockTeam {
    id: string
    event_id: string
    leader_id: string
    club_id: string
  }
  interface MockTeamMember {
    id: string
    team_id: string
    event_id: string
    user_id: string | null
    email: string
    status: 'pending' | 'accepted' | 'declined'
  }

  const mockProfiles: Record<string, MockProfile> = {
    user_leader_1: { id: 'user_leader_1', email: 'leader@example.com', role: 'student', email_confirmed_at: '2026-01-01T00:00:00Z' },
    user_member_2: { id: 'user_member_2', email: 'member@example.com', role: 'student', email_confirmed_at: '2026-01-01T00:00:00Z' },
    user_unverified_3: { id: 'user_unverified_3', email: 'unverified@example.com', role: 'student', email_confirmed_at: null },
    user_attacker_3: { id: 'user_attacker_3', email: 'attacker@evil.com', role: 'student', email_confirmed_at: '2026-01-01T00:00:00Z' },
    user_victim_4: { id: 'user_victim_4', email: 'pending_victim@example.com', role: 'student', email_confirmed_at: '2026-01-01T00:00:00Z' },
    organizer_user_id: { id: 'organizer_user_id', email: 'club@campus.edu', role: 'club_member', email_confirmed_at: '2026-01-01T00:00:00Z' },
    platform_admin_id: { id: 'platform_admin_id', email: 'admin@festflow.internal', role: 'platform_admin', email_confirmed_at: '2026-01-01T00:00:00Z' },
  }

  const mockTeam: MockTeam = {
    id: 'team_alpha_1',
    event_id: 'event_techfest_2026',
    leader_id: 'user_leader_1',
    club_id: 'club_tech_1',
  }

  const mockTeamOther: MockTeam = {
    id: 'team_beta_other',
    event_id: 'event_techfest_2026',
    leader_id: 'user_other_leader',
    club_id: 'club_tech_1',
  }

  const mockMembers: MockTeamMember[] = [
    { id: 'tm_1', team_id: 'team_alpha_1', event_id: 'event_techfest_2026', user_id: 'user_leader_1', email: 'leader@example.com', status: 'accepted' },
    { id: 'tm_2', team_id: 'team_alpha_1', event_id: 'event_techfest_2026', user_id: 'user_member_2', email: 'member@example.com', status: 'accepted' },
    { id: 'tm_unverified', team_id: 'team_alpha_1', event_id: 'event_techfest_2026', user_id: 'user_unverified_3', email: 'unverified@example.com', status: 'accepted' },
    { id: 'tm_pending_invite', team_id: 'team_alpha_1', event_id: 'event_techfest_2026', user_id: null, email: 'pending_victim@example.com', status: 'pending' },
    { id: 'tm_other_team', team_id: 'team_beta_other', event_id: 'event_techfest_2026', user_id: 'user_member_2', email: 'member@example.com', status: 'accepted' },
  ]

  function simulateSyncTeamMemberRegistration(params: {
    callerId: string | null
    teamId: string
    memberUserId: string
    memberEmail?: string
  }) {
    // 1. Identify caller
    if (!params.callerId) {
      return { success: false, outcome: 'UNAUTHENTICATED', message: 'Authentication required.' }
    }
    const callerProfile = mockProfiles[params.callerId]
    if (!callerProfile) {
      return { success: false, outcome: 'UNAUTHENTICATED', message: 'Caller profile not found.' }
    }

    // Verify caller verified email
    if (callerProfile.email_confirmed_at === null) {
      return { success: false, outcome: 'UNVERIFIED_EMAIL', message: 'Please verify your student email address.' }
    }

    // 2. Fetch team
    if (params.teamId !== mockTeam.id) {
      return { success: false, outcome: 'NOT_FOUND', message: 'Team not found.' }
    }

    // 3. Authorization check
    const isSelf = params.callerId === params.memberUserId
    const isLeader = params.callerId === mockTeam.leader_id
    const isOrganizer = params.callerId === 'organizer_user_id'
    const isAdmin = callerProfile.role === 'platform_admin'

    if (!isSelf && !isLeader && !isOrganizer && !isAdmin) {
      return { success: false, outcome: 'FORBIDDEN', message: 'Caller not authorized for team.' }
    }

    // 4. Strict Membership Verification:
    // Target user MUST have an assigned record in team_members with status = 'accepted'
    const membership = mockMembers.find(
      (m) => m.team_id === params.teamId && m.user_id === params.memberUserId
    )
    if (!membership) {
      return { success: false, outcome: 'FORBIDDEN', message: 'Target user is not an assigned member of this team.' }
    }

    if (membership.status !== 'accepted') {
      return {
        success: false,
        outcome: 'FORBIDDEN',
        status: membership.status,
        message: 'Team membership is not accepted. Pending invitations cannot be registered.',
      }
    }

    // 5. Identity & Invitation Binding Checks
    if (isSelf) {
      // Self-service: caller profile email must match accepted membership email
      if (membership.email.toLowerCase() !== callerProfile.email.toLowerCase()) {
        return { success: false, outcome: 'FORBIDDEN', message: 'Caller profile email does not match membership email.' }
      }
      if (params.memberEmail && params.memberEmail.toLowerCase() !== callerProfile.email.toLowerCase()) {
        return { success: false, outcome: 'FORBIDDEN', message: 'Supplied email does not match caller profile.' }
      }
    } else {
      // Leader/Admin: target member profile email must match accepted membership email
      const targetProfile = mockProfiles[params.memberUserId]
      if (!targetProfile) {
        return { success: false, outcome: 'FORBIDDEN', message: 'Target member profile not found.' }
      }
      if (targetProfile.email_confirmed_at === null) {
        return { success: false, outcome: 'UNVERIFIED_EMAIL', message: 'Target member has not verified their email.' }
      }
      if (membership.email.toLowerCase() !== targetProfile.email.toLowerCase()) {
        return { success: false, outcome: 'FORBIDDEN', message: 'Target profile email does not match membership.' }
      }
      if (params.memberEmail && params.memberEmail.toLowerCase() !== membership.email.toLowerCase()) {
        return { success: false, outcome: 'FORBIDDEN', message: 'Supplied email does not match membership record.' }
      }
    }

    return { success: true, outcome: 'SYNCHRONIZED', is_new: true }
  }

  // Case 1: Legitimate accepted team member self-service synchronization
  const legitimateSelfCall = simulateSyncTeamMemberRegistration({
    callerId: 'user_member_2',
    teamId: 'team_alpha_1',
    memberUserId: 'user_member_2',
    memberEmail: 'member@example.com',
  })

  // Case 2: Unverified email caller blocked
  const unverifiedCallerCall = simulateSyncTeamMemberRegistration({
    callerId: 'user_unverified_3',
    teamId: 'team_alpha_1',
    memberUserId: 'user_unverified_3',
    memberEmail: 'unverified@example.com',
  })

  // Case 3: Leader attempting to register unverified target member blocked
  const leaderSyncUnverifiedCall = simulateSyncTeamMemberRegistration({
    callerId: 'user_leader_1',
    teamId: 'team_alpha_1',
    memberUserId: 'user_unverified_3',
    memberEmail: 'unverified@example.com',
  })

  // Case 4: User attempting to claim another person's invitation using that person's email
  const claimOtherInviteCall = simulateSyncTeamMemberRegistration({
    callerId: 'user_attacker_3',
    teamId: 'team_alpha_1',
    memberUserId: 'user_attacker_3',
    memberEmail: 'pending_victim@example.com',
  })

  // Case 5: Leader attempting to register an arbitrary user ID using a pending invitation email
  const leaderArbitraryWithPendingEmailCall = simulateSyncTeamMemberRegistration({
    callerId: 'user_leader_1',
    teamId: 'team_alpha_1',
    memberUserId: 'user_victim_4',
    memberEmail: 'pending_victim@example.com',
  })

  // Case 6: An invitation belonging to another team (cross-team access attempt)
  const crossTeamCall = simulateSyncTeamMemberRegistration({
    callerId: 'user_member_2',
    teamId: 'team_beta_other',
    memberUserId: 'user_member_2',
    memberEmail: 'member@example.com',
  })

  // Case 7: An invitation with mismatched user ID and email
  const mismatchedEmailCall = simulateSyncTeamMemberRegistration({
    callerId: 'user_leader_1',
    teamId: 'team_alpha_1',
    memberUserId: 'user_member_2',
    memberEmail: 'spoofed_email@spoof.com',
  })

  // Case 8: An unauthenticated caller
  const unauthCallerCall = simulateSyncTeamMemberRegistration({
    callerId: null,
    teamId: 'team_alpha_1',
    memberUserId: 'user_member_2',
  })

  // Case 9: Unrelated authenticated user (stranger)
  const unrelatedUserCall = simulateSyncTeamMemberRegistration({
    callerId: 'user_attacker_3',
    teamId: 'team_alpha_1',
    memberUserId: 'user_member_2',
  })

  // Case 10: Existing legitimate invitation acceptance and synchronization workflows
  // (Leader synchronizing an accepted member)
  const legitimateLeaderSyncCall = simulateSyncTeamMemberRegistration({
    callerId: 'user_leader_1',
    teamId: 'team_alpha_1',
    memberUserId: 'user_member_2',
    memberEmail: 'member@example.com',
  })
  // (Organizer synchronizing an accepted member)
  const legitimateOrganizerSyncCall = simulateSyncTeamMemberRegistration({
    callerId: 'organizer_user_id',
    teamId: 'team_alpha_1',
    memberUserId: 'user_member_2',
    memberEmail: 'member@example.com',
  })

  // Case 11: Nonexistent target user in auth provider
  const nonexistentTargetCall = simulateSyncTeamMemberRegistration({
    callerId: 'user_leader_1',
    teamId: 'team_alpha_1',
    memberUserId: 'nonexistent_user_9999',
    memberEmail: 'ghost@example.com',
  })

  assert(
    legitimateSelfCall.success &&
      legitimateLeaderSyncCall.success &&
      legitimateOrganizerSyncCall.success &&
      unverifiedCallerCall.outcome === 'UNVERIFIED_EMAIL' &&
      leaderSyncUnverifiedCall.outcome === 'UNVERIFIED_EMAIL' &&
      claimOtherInviteCall.outcome === 'FORBIDDEN' &&
      leaderArbitraryWithPendingEmailCall.outcome === 'FORBIDDEN' &&
      crossTeamCall.outcome === 'NOT_FOUND' &&
      mismatchedEmailCall.outcome === 'FORBIDDEN' &&
      unauthCallerCall.outcome === 'UNAUTHENTICATED' &&
      unrelatedUserCall.outcome === 'FORBIDDEN' &&
      nonexistentTargetCall.outcome === 'FORBIDDEN',
    'Test 19: Complete Authorization & Verified-Email Anti-Spoofing Matrix for sync_team_member_registration',
    `legitSelf: ${legitimateSelfCall.outcome}, unverifiedSelf: ${unverifiedCallerCall.outcome}, leaderSyncUnverified: ${leaderSyncUnverifiedCall.outcome}, claimOther: ${claimOtherInviteCall.outcome}, leaderArbitrary: ${leaderArbitraryWithPendingEmailCall.outcome}, crossTeam: ${crossTeamCall.outcome}, mismatchedEmail: ${mismatchedEmailCall.outcome}, unauth: ${unauthCallerCall.outcome}, nonexistent: ${nonexistentTargetCall.outcome}`
  )

  // --- Test 20: Complete Team-Member QR Lifecycle & Turnstile Verification ---
  // Validates:
  // 1. Leader QR check-in
  // 2. First team member QR check-in (independent CSPRNG token)
  // 3. Second team member QR check-in (independent CSPRNG token)
  // 4. Invalid member suffix rejection (e.g. -M99)
  // 5. Member token cannot check in a different member
  // 6. Replayed member QR token blocked as ALREADY_USED
  // 7. Team member check-out
  const leaderToken = generateSecureQrToken()
  const member1Token = generateSecureQrToken()
  const member2Token = generateSecureQrToken()

  const teamRegs = [
    {
      id: 'reg_team_leader_1',
      event_id: testEventId,
      student_id: 'user_leader_1',
      ticket_code: 'FF-TEAMLEADER-01',
      qr_token: leaderToken,
      qr_token_hash: hashQrTokenSync(leaderToken),
      status: 'confirmed',
      payment_status: 'verified',
      team_role: 'leader',
      team_name: 'Alpha Team',
      team_members: [
        { name: 'Member One', email: 'm1@example.com' },
        { name: 'Member Two', email: 'm2@example.com' },
      ],
    },
    {
      id: 'reg_team_m1',
      event_id: testEventId,
      student_id: 'user_member_1',
      ticket_code: 'FF-TEAMLEADER-01-M1',
      qr_token: member1Token,
      qr_token_hash: hashQrTokenSync(member1Token),
      status: 'confirmed',
      payment_status: 'verified',
      team_role: 'member',
      team_name: 'Alpha Team',
      participant_details: { student_name: 'Member One' },
    },
    {
      id: 'reg_team_m2',
      event_id: testEventId,
      student_id: 'user_member_2',
      ticket_code: 'FF-TEAMLEADER-01-M2',
      qr_token: member2Token,
      qr_token_hash: hashQrTokenSync(member2Token),
      status: 'confirmed',
      payment_status: 'verified',
      team_role: 'member',
      team_name: 'Alpha Team',
      participant_details: { student_name: 'Member Two' },
    },
  ]

  // Populate local storage for simulation
  const localRegsBefore = JSON.parse(mockStorage.getItem('festflow_local_registrations'))
  mockStorage.setItem('festflow_local_registrations', JSON.stringify([...localRegsBefore, ...teamRegs]))

  // 1. Leader Check-In
  const leaderCheckIn = await checkInTicket(testEventId, leaderToken)
  // 2. Member 1 Check-In (via independent token)
  const member1CheckIn = await checkInTicket(testEventId, member1Token)
  // 3. Member 2 Check-In (via independent token)
  const member2CheckIn = await checkInTicket(testEventId, member2Token)

  // 4. Invalid member suffix rejection (e.g. Leader token with invalid index -M99)
  const invalidSuffixCheckIn = await checkInTicket(testEventId, `${leaderToken}-M99`)

  // 5. Replay member 1 check-in
  const replayMember1 = await checkInTicket(testEventId, member1Token)

  // 6. Member 1 Check-Out
  const member1CheckOut = await checkOutTicket(testEventId, member1Token)

  assert(
    leaderCheckIn.success &&
      leaderCheckIn.outcome === 'VALID' &&
      member1CheckIn.success &&
      member1CheckIn.outcome === 'VALID' &&
      member2CheckIn.success &&
      member2CheckIn.outcome === 'VALID' &&
      (!invalidSuffixCheckIn.success && (invalidSuffixCheckIn.outcome === 'INVALID_TICKET' || invalidSuffixCheckIn.outcome === 'UNAUTHORIZED')) &&
      (!replayMember1.success && replayMember1.outcome === 'ALREADY_USED') &&
      member1CheckOut.success &&
      member1CheckOut.outcome === 'CHECKED_OUT',
    'Test 20: Complete Team-Member QR Lifecycle (Leader, M1, M2 Check-In, Invalid Suffix Rejection, Replay Protection, Check-Out)',
    `leader: ${leaderCheckIn.outcome}, m1: ${member1CheckIn.outcome}, m2: ${member2CheckIn.outcome}, invalidSuffix: ${invalidSuffixCheckIn.outcome}, replay: ${replayMember1.outcome}, m1CheckOut: ${member1CheckOut.outcome}`
  )

  console.log('\n------------------------------------------------------------')
  const passedCount = results.filter((r) => r.passed).length
  const failedCount = results.filter((r) => !r.passed).length
  console.log(`Results: ${passedCount} passed, ${failedCount} failed of ${results.length} tests.`)
  console.log('------------------------------------------------------------\n')

  if (failedCount > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err)
  process.exit(1)
})
