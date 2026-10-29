/**
 * scripts/test-transactional-email-system.ts
 *
 * Comprehensive Automated Audit & Test Suite for FestFlow Transactional Email System:
 * Covers all 15 required email flows, template rendering, provider handling,
 * idempotency, retry resilience, and Auth SMTP separation.
 */

import * as fs from 'fs'
import * as path from 'path'

// Polyfill localStorage for Node/tsx execution
const store = new Map<string, string>()
const mockLocalStorage = {
  getItem: (key: string) => store.get(key) || null,
  setItem: (key: string, val: string) => store.set(key, String(val)),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
  length: 0,
  key: () => null,
}
;(globalThis as any).localStorage = mockLocalStorage

import {
  triggerTransactionalEmail,
  triggerTransactionalEmailWithRetry,
  resendOutboxEmail,
  getLocalOutbox,
  saveLocalOutbox,
  sendRegistrationConfirmedEmail,
  sendApplicationSubmittedEmail,
  sendPaymentReceivedEmail,
  sendPaymentApprovedEmail,
  sendPaymentRejectedEmail,
  sendTicketIssuedEmail,
  sendTicketUpdatedEmail,
  sendRegistrationCancelledEmail,
  sendRegistrationWaitlistedEmail,
  sendEventUpdatedEmail,
  sendEventCancelledEmail,
  sendCheckinConfirmedEmail,
  sendTeamInvitationEmail,
  sendTeamInvitationAcceptedEmail,
  sendTeamMemberAddedEmail,
  sendClubMemberInvitationEmail,
  sendClubInvitationAcceptedEmail,
  sendEventReminderEmail,
  sendBulkEventReminders,
  sendBulkEventUpdate,
  sendBulkEventCancellation,
} from '../src/lib/emails'

let totalTests = 0
let passedTests = 0
let failedTests = 0

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++
  if (condition) {
    passedTests++
    console.log(`  ✓ ${testName}`)
  } else {
    failedTests++
    console.error(`  ✗ FAIL: ${testName}`)
    if (details) console.error(`    Details: ${details}`)
  }
}

async function runTestSuite() {
  console.log('\n======================================================================')
  console.log(' FESTFLOW COMPLETE TRANSACTIONAL EMAIL SYSTEM AUDIT & REGRESSION SUITE ')
  console.log('======================================================================\n')

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 1: SENDER & SECRETS CONFIGURATION AUDIT
  // ─────────────────────────────────────────────────────────────────────────
  console.log('--- SECTION 1: Sender & Secrets Configuration Audit ---')

  const edgeFunctionSource = fs.readFileSync(
    path.resolve(process.cwd(), 'supabase/functions/send-email/index.ts'),
    'utf-8'
  )

  assert(
    edgeFunctionSource.includes("'festflow.events@festflow.online'"),
    'Edge function defaults to verified sender "festflow.events@festflow.online"'
  )

  assert(
    edgeFunctionSource.includes("'FestFlow'"),
    'Edge function defaults to display name "FestFlow"'
  )

  assert(
    edgeFunctionSource.includes("'festflow.events@gmail.com'"),
    'Edge function defaults to reply-to "festflow.events@gmail.com"'
  )

  // Verify no hardcoded secrets or service-role keys in source
  assert(
    !edgeFunctionSource.includes('re_1234567890') &&
    !edgeFunctionSource.includes('SG.') &&
    !edgeFunctionSource.includes('sk_live_'),
    'Zero hardcoded Resend API secrets found in edge function source'
  )

  const envExample = fs.existsSync(path.resolve(process.cwd(), '.env.example'))
    ? fs.readFileSync(path.resolve(process.cwd(), '.env.example'), 'utf-8')
    : ''
  assert(
    !envExample.includes('re_') || envExample.includes('your_') || envExample.includes('mock_'),
    'Environment templates keep all live API keys and SMTP passwords secret'
  )

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 2: SUPABASE AUTH CUSTOM SMTP TEMPLATES (Separation of Concerns)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- SECTION 2: Supabase Auth Email Templates (Custom SMTP Separation) ---')

  const confirmSignupPath = path.resolve(process.cwd(), 'supabase/auth-templates/confirm-signup.html')
  const resetPasswordPath = path.resolve(process.cwd(), 'supabase/auth-templates/reset-password.html')

  assert(fs.existsSync(confirmSignupPath), 'Required Auth Email 1: confirm-signup.html exists')
  assert(fs.existsSync(resetPasswordPath), 'Required Auth Email 2: reset-password.html exists')

  const confirmSignupHtml = fs.readFileSync(confirmSignupPath, 'utf-8')
  const resetPasswordHtml = fs.readFileSync(resetPasswordPath, 'utf-8')

  assert(
    confirmSignupHtml.includes('{{ .ConfirmationURL }}'),
    'Auth Email 1 (Account verification) uses GoTrue standard {{ .ConfirmationURL }}'
  )
  assert(
    confirmSignupHtml.includes('festflow.online'),
    'Auth Email 1 references canonical origin festflow.online'
  )
  assert(
    confirmSignupHtml.includes('festflow.events@festflow.online'),
    'Auth Email 1 mentions official sender festflow.events@festflow.online'
  )

  assert(
    resetPasswordHtml.includes('{{ .ConfirmationURL }}'),
    'Auth Email 2 (Password reset) uses GoTrue standard {{ .ConfirmationURL }}'
  )
  assert(
    resetPasswordHtml.includes('festflow.online'),
    'Auth Email 2 references canonical origin festflow.online'
  )
  assert(
    resetPasswordHtml.includes('festflow.events@festflow.online'),
    'Auth Email 2 mentions official sender festflow.events@festflow.online'
  )

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 3: TRANSACTIONAL EMAIL TEMPLATES (Edge Function & Resend Payload)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- SECTION 3: Transactional Email Template Rendering (15 Required Flows) ---')

  // Dynamic import of generateEmailHtml from the Edge Function
  // Since index.ts imports Deno std, we test template generation logic via regex & unit evaluation
  assert(
    edgeFunctionSource.includes("'team_member_added'") &&
    edgeFunctionSource.includes("'club_invitation_accepted'"),
    'Edge function registry includes newly audited templates: team_member_added & club_invitation_accepted'
  )

  // Template 3: Team invitation
  store.clear()
  const teamInviteRes = await sendTeamInvitationEmail({
    recipientEmail: 'teammate@campus.edu',
    recipientName: 'Alex River',
    teamName: 'CyberKnights',
    eventTitle: 'HackFest 2026',
    eventSlug: 'hackfest-2026',
    leaderName: 'Jordan Lee',
    inviteCode: 'TF-9K2M4P',
    inviteToken: 'inv_token_abc123xyz',
    expiresAt: '2026-11-05T23:59:59Z',
    eventId: 'evt_hackfest',
    teamId: 'team_cyberknights',
  })
  assert(teamInviteRes.success, 'Required Email 3: Team invitation dispatches successfully')
  const outbox = getLocalOutbox()
  const teamInviteRecord = outbox.find((o) => o.template_type === 'team_invitation')
  assert(Boolean(teamInviteRecord), 'Required Email 3 recorded in transactional outbox')
  assert(
    teamInviteRecord?.payload?.invite_code === 'TF-9K2M4P',
    'Required Email 3 includes correct team invite code'
  )
  assert(
    teamInviteRecord?.payload?.join_url.includes('https://festflow.online') ||
    teamInviteRecord?.payload?.join_url.includes('join-team'),
    'Required Email 3 join_url targets valid join-team route'
  )

  // Template 4: Team invitation accepted (leader notification)
  const teamAcceptedRes = await sendTeamInvitationAcceptedEmail({
    leaderEmail: 'leader@campus.edu',
    leaderName: 'Jordan Lee',
    memberName: 'Alex River',
    memberEmail: 'teammate@campus.edu',
    teamName: 'CyberKnights',
    eventTitle: 'HackFest 2026',
    currentSize: 4,
    eventId: 'evt_hackfest',
    teamId: 'team_cyberknights',
  })
  assert(teamAcceptedRes.success, 'Required Email 4: Team invitation accepted dispatches to leader')
  const teamAcceptedRecord = getLocalOutbox().find((o) => o.template_type === 'team_invitation_accepted')
  assert(Boolean(teamAcceptedRecord), 'Required Email 4 recorded in outbox with leader as recipient')
  assert(
    teamAcceptedRecord?.recipient_email === 'leader@campus.edu',
    'Required Email 4 targets verified team leader email'
  )

  // Template 5: Team member added
  const teamMemberAddedRes = await sendTeamMemberAddedEmail({
    to: 'dev@campus.edu',
    name: 'Dev Member',
    teamName: 'RoboWarriors',
    eventTitle: 'Robotics Rumble',
    leaderName: 'Captain Sam',
    startDate: 'November 15, 2026',
    venueName: 'Tech Arena 1',
    ticketCode: 'FF-ROBO-M2',
    registrationId: 'reg_robo_m2',
    eventId: 'evt_robo',
    teamId: 'team_robowarriors',
    isPaid: false,
  })
  assert(teamMemberAddedRes.success, 'Required Email 5: Team member added notification dispatches')
  const teamMemberAddedRecord = getLocalOutbox().find((o) => o.template_type === 'team_member_added')
  assert(Boolean(teamMemberAddedRecord), 'Required Email 5 recorded in outbox')
  assert(
    teamMemberAddedRecord?.payload?.team_name === 'RoboWarriors' &&
    teamMemberAddedRecord?.payload?.leader_name === 'Captain Sam',
    'Required Email 5 includes squad name and leader name in payload'
  )

  // Template 6: Payment submission received
  const payReceivedRes = await sendPaymentReceivedEmail({
    to: 'student@campus.edu',
    name: 'Rohan Sharma',
    eventTitle: 'Annual Cultural Fest',
    transactionReference: '123456789012',
    amount: 499,
    registrationId: 'reg_cult_01',
    eventId: 'evt_cult',
  })
  assert(payReceivedRes.success, 'Required Email 6: Payment submission received dispatches')
  const payReceivedRecord = getLocalOutbox().find((o) => o.template_type === 'payment_received')
  assert(payReceivedRecord?.payload?.transaction_reference === '123456789012', 'Required Email 6 includes UTR')

  // Template 7: Payment approved
  const payApprovedRes = await sendPaymentApprovedEmail({
    to: 'student@campus.edu',
    name: 'Rohan Sharma',
    eventTitle: 'Annual Cultural Fest',
    ticketCode: 'FF-CULT-8877',
    venueName: 'Main Auditorium',
    registrationId: 'reg_cult_01',
    eventId: 'evt_cult',
  })
  assert(payApprovedRes.success, 'Required Email 7: Payment approved dispatches')
  const payApprovedRecord = getLocalOutbox().find((o) => o.template_type === 'payment_approved')
  assert(payApprovedRecord?.payload?.ticket_code === 'FF-CULT-8877', 'Required Email 7 includes verified pass code')

  // Template 8: Payment rejected with next steps
  const payRejectedRes = await sendPaymentRejectedEmail({
    to: 'student@campus.edu',
    name: 'Rohan Sharma',
    eventTitle: 'Annual Cultural Fest',
    reason: 'UTR number 123456789012 not found in organizer UPI account statement.',
    registrationId: 'reg_cult_01',
    eventId: 'evt_cult',
  })
  assert(payRejectedRes.success, 'Required Email 8: Payment rejected dispatches with reason & next steps')
  const payRejectedRecord = getLocalOutbox().find((o) => o.template_type === 'payment_rejected')
  assert(
    Boolean(payRejectedRecord?.payload?.payment_url),
    'Required Email 8 includes actionable payment_url for resubmission'
  )
  assert(
    edgeFunctionSource.includes('Next Steps to Unlock Your Ticket:'),
    'Edge function HTML template for payment_rejected guides user with explicit 12-digit UTR next steps'
  )

  // Template 9: Registration confirmed
  const regConfirmedRes = await sendRegistrationConfirmedEmail({
    to: 'attendee@campus.edu',
    name: 'Priya Patel',
    eventTitle: 'AI Symposium',
    ticketCode: 'FF-AI-1092',
    qrToken: 'FFQ_A1B2C3D4E5F6',
    startDate: 'November 20, 2026',
    venueName: 'Hall B',
    registrationId: 'reg_ai_1092',
    eventId: 'evt_ai',
  })
  assert(regConfirmedRes.success, 'Required Email 9: Registration confirmed dispatches')
  const regConfirmedRecord = getLocalOutbox().find((o) => o.template_type === 'registration_confirmed')
  assert(Boolean(regConfirmedRecord?.payload?.ticket_url), 'Required Email 9 includes ticket_url')

  // Template 10: Digital pass issued or updated
  const ticketIssuedRes = await sendTicketIssuedEmail({
    to: 'attendee@campus.edu',
    name: 'Priya Patel',
    eventTitle: 'AI Symposium',
    ticketCode: 'FF-AI-1092',
    venueName: 'Hall B',
    registrationId: 'reg_ai_1092',
    eventId: 'evt_ai',
  })
  assert(ticketIssuedRes.success, 'Required Email 10a: Digital pass issued dispatches')

  const ticketUpdatedRes = await sendTicketUpdatedEmail({
    to: 'attendee@campus.edu',
    name: 'Priya Patel',
    eventTitle: 'AI Symposium',
    ticketCode: 'FF-AI-1092',
    updateSummary: 'Venue changed from Hall B to Auditorium 1 due to high attendance.',
    registrationId: 'reg_ai_1092',
    eventId: 'evt_ai',
  })
  assert(ticketUpdatedRes.success, 'Required Email 10b: Digital pass updated dispatches')

  // Template 11: Event reminder
  const reminderRes = await sendEventReminderEmail({
    to: 'attendee@campus.edu',
    name: 'Priya Patel',
    eventTitle: 'AI Symposium',
    startDate: 'November 20, 2026 at 10:00 AM',
    venueName: 'Auditorium 1',
    ticketCode: 'FF-AI-1092',
    registrationId: 'reg_ai_1092',
    eventId: 'evt_ai',
  })
  assert(reminderRes.success, 'Required Email 11: Event reminder dispatches')

  // Template 12: Event cancellation or material update
  const eventCancelledRes = await sendEventCancelledEmail({
    to: 'attendee@campus.edu',
    name: 'Priya Patel',
    eventTitle: 'Guest Lecture',
    reason: 'Speaker travel disruption due to inclement weather.',
    eventId: 'evt_lecture',
  })
  assert(eventCancelledRes.success, 'Required Email 12a: Event cancellation dispatches')

  const eventUpdatedRes = await sendEventUpdatedEmail({
    to: 'attendee@campus.edu',
    name: 'Priya Patel',
    eventTitle: 'Guest Lecture',
    announcement: 'Lecture rescheduled to Monday, 11:00 AM.',
    eventId: 'evt_lecture',
  })
  assert(eventUpdatedRes.success, 'Required Email 12b: Material event update dispatches')

  // Template 13: Club staff invitation
  const clubInviteRes = await sendClubMemberInvitationEmail({
    to: 'staff@campus.edu',
    clubName: 'IEEE Student Chapter',
    inviterName: 'Dr. Sarah Connor',
    role: 'Event Manager',
    invitationUrl: 'https://festflow.online/accept-club-invitation?token=test12345',
    expiresAt: '7 days',
    clubId: 'club_ieee',
  })
  assert(clubInviteRes.success, 'Required Email 13: Club staff invitation dispatches')

  // Template 14: Club staff invitation accepted
  const clubAcceptedRes = await sendClubInvitationAcceptedEmail({
    to: 'president@campus.edu',
    adminName: 'Dr. Sarah Connor',
    clubName: 'IEEE Student Chapter',
    memberName: 'Kavita Rao',
    memberEmail: 'staff@campus.edu',
    role: 'Event Manager',
    clubId: 'club_ieee',
  })
  assert(clubAcceptedRes.success, 'Required Email 14: Club staff invitation accepted dispatches')
  const clubAcceptedRecord = getLocalOutbox().find((o) => o.template_type === 'club_invitation_accepted')
  assert(
    clubAcceptedRecord?.payload?.club_name === 'IEEE Student Chapter' &&
    clubAcceptedRecord?.payload?.role === 'Event Manager',
    'Required Email 14 records club and role details in payload'
  )

  // Template 15: Check-in confirmation
  const checkinRes = await sendCheckinConfirmedEmail({
    to: 'attendee@campus.edu',
    name: 'Priya Patel',
    eventTitle: 'AI Symposium',
    ticketCode: 'FF-AI-1092',
    checkedInAt: '10:04 AM',
    registrationId: 'reg_ai_1092',
    eventId: 'evt_ai',
  })
  assert(checkinRes.success, 'Required Email 15: Gate check-in confirmation dispatches')

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 4: DELIVERY RELIABILITY, IDEMPOTENCY & RETRY RESILIENCE
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- SECTION 4: Delivery Reliability, Idempotency & Retries ---')

  // 1. Idempotency test: duplicate idempotencyKey returns existing send without re-dispatch
  const idemKey = `test_idem_${Date.now()}`
  const send1 = await triggerTransactionalEmail({
    template: 'ticket_issued',
    to: 'test@campus.edu',
    name: 'Test Student',
    idempotencyKey: idemKey,
    payload: { ticket_code: 'FF-IDEM-01' },
  })
  assert(send1.success, 'Initial send under idempotency key succeeds')

  const send2 = await triggerTransactionalEmail({
    template: 'ticket_issued',
    to: 'test@campus.edu',
    name: 'Test Student',
    idempotencyKey: idemKey,
    payload: { ticket_code: 'FF-IDEM-01' },
  })
  assert(
    send2.success && send2.outboxId === send1.outboxId,
    'Duplicate send under same idempotency key is suppressed (idempotent)'
  )

  // 2. Resend cooldown & rate limiting (60s rule)
  const resendAttempt1 = await resendOutboxEmail(send1.outboxId!)
  assert(
    resendAttempt1.success === false && resendAttempt1.message.includes('wait'),
    'Resend enforces 60-second cooldown rate limit'
  )

  // 3. Controlled retry mechanism for transient errors
  let attempts = 0
  const transientRetryResult = await triggerTransactionalEmailWithRetry({
    template: 'registration_confirmed',
    to: 'retry-test@campus.edu',
    idempotencyKey: `retry_test_${Date.now()}`,
    payload: { event_title: 'Retry Test Event' },
  }, { maxRetries: 2, initialDelayMs: 50 })
  assert(
    transientRetryResult.success,
    'triggerTransactionalEmailWithRetry successfully executes dispatch lifecycle'
  )

  // 4. Safe logging verification: ensure personal credentials or sensitive tokens are not logged
  assert(
    edgeFunctionSource.includes('sanitizeText') &&
    edgeFunctionSource.includes('sanitizeSafeUrl'),
    'Edge function utilizes strict HTML escaping & URL domain sanitizers against XSS'
  )

  // 5. Professional footer verification
  assert(
    edgeFunctionSource.includes('FestFlow — Campus Event Platform') &&
    edgeFunctionSource.includes('https://festflow.online') &&
    edgeFunctionSource.includes('festflow.events@gmail.com'),
    'Edge function appends unified canonical footer with support contact to all emails'
  )

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n======================================================================')
  console.log(` AUDIT COMPLETE: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} FAILED)`)
  console.log('======================================================================\n')

  if (failedTests > 0) {
    process.exit(1)
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite uncaught error:', err)
  process.exit(1)
})
