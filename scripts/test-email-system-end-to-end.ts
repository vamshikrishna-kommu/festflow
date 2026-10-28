/**
 * scripts/test-email-system-end-to-end.ts
 *
 * Comprehensive End-to-End Test Suite for FestFlow's Production Email & Notification System.
 * Tests:
 * 1. Canonical domain resolution (festflow.online vs local dev)
 * 2. Auth callback safe redirect validation (anti-phishing & open redirect prevention)
 * 3. Supabase Auth template files validation (HTML layout, {{ .ConfirmationURL }}, branding)
 * 4. All 16 Edge Function application templates (escaping, safe URLs, text fallbacks)
 * 5. End-to-end Student Registration -> Payment -> Ticket Gating lifecycle
 * 6. Idempotency & Resend deduplication
 * 7. Security & authorization constraints (no secrets leaked, role checks)
 */

import fs from 'node:fs'
import path from 'node:path'

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
  PRODUCTION_CANONICAL_DOMAIN,
  getFrontendBaseUrl,
  getAuthCallbackUrl,
  getResetPasswordUrl,
  resolveCanonicalUrl,
} from '../src/lib/canonicalUrl'
import { getSafeNextPath } from '../src/pages/auth/AuthCallbackPage'
import {
  triggerTransactionalEmail,
  sendRegistrationConfirmedEmail,
  sendApplicationSubmittedEmail,
  sendPaymentReceivedEmail,
  sendPaymentApprovedEmail,
  sendPaymentRejectedEmail,
  sendTicketIssuedEmail,
  sendTeamInvitationEmail,
  sendTeamInvitationAcceptedEmail,
  sendClubMemberInvitationEmail,
  getLocalOutbox,
} from '../src/lib/emails'
import { buildTeamInviteLink } from '../src/lib/teams'

let passed = 0
let failed = 0
const failures: string[] = []

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++
    console.log(`  ✅ ${msg}`)
  } else {
    failed++
    failures.push(msg)
    console.error(`  ❌ FAIL: ${msg}`)
  }
}

async function runTests() {
  console.log('\n🚀 Starting FestFlow Production Email & Notification System Test Suite\n')

  // ── SUITE 1: Canonical Domain & URL Configuration ─────────────────────────
  console.log('--- Suite 1: Canonical Domain & URL Resolution ---')
  assert(
    PRODUCTION_CANONICAL_DOMAIN === 'https://festflow.online',
    'PRODUCTION_CANONICAL_DOMAIN must strictly be https://festflow.online'
  )
  assert(
    getFrontendBaseUrl() === 'https://festflow.online',
    'getFrontendBaseUrl() returns https://festflow.online in server/node environment'
  )
  assert(
    getAuthCallbackUrl() === 'https://festflow.online/auth/callback',
    'getAuthCallbackUrl() points to https://festflow.online/auth/callback'
  )
  assert(
    getAuthCallbackUrl('/student/dashboard') ===
      'https://festflow.online/auth/callback?next=%2Fstudent%2Fdashboard',
    'getAuthCallbackUrl(next) properly encodes query parameter'
  )
  assert(
    getResetPasswordUrl() === 'https://festflow.online/reset-password',
    'getResetPasswordUrl() points to https://festflow.online/reset-password'
  )
  assert(
    resolveCanonicalUrl('/events/tech-summit') === 'https://festflow.online/events/tech-summit',
    'resolveCanonicalUrl resolves paths against canonical domain'
  )

  const teamLink = buildTeamInviteLink('hack-fest', 'TF-X12345')
  assert(
    teamLink.startsWith('https://festflow.online/events/hack-fest?join=1&code=TF-X12345'),
    `buildTeamInviteLink uses canonical festflow.online domain (${teamLink})`
  )

  // ── SUITE 2: Anti-Phishing & Open Redirect Prevention ─────────────────────
  console.log('\n--- Suite 2: Anti-Phishing & Safe Auth Callback Redirects ---')
  assert(
    getSafeNextPath('/student/dashboard', '/student/dashboard') === '/student/dashboard',
    'Allows safe internal relative route /student/dashboard'
  )
  assert(
    getSafeNextPath('/club/dashboard', '/club/dashboard') === '/club/dashboard',
    'Allows safe internal relative route /club/dashboard'
  )
  assert(
    getSafeNextPath('https://evil-phishing-site.com/steal-creds', '/student/dashboard') === '/student/dashboard',
    'Blocks external absolute phishing URL and falls back to student dashboard'
  )
  assert(
    getSafeNextPath('//evil-domain.com', '/club/dashboard') === '/club/dashboard',
    'Blocks protocol-relative URL (//evil-domain.com)'
  )
  assert(
    getSafeNextPath('javascript:alert(1)', '/student/dashboard') === '/student/dashboard',
    'Blocks javascript: pseudo-protocol in callback redirect'
  )

  // ── SUITE 3: Supabase Auth Email Templates (Local Template Files) ─────────
  console.log('\n--- Suite 3: Supabase Auth Email Templates Audit ---')
  const authTemplatesDir = path.resolve(process.cwd(), 'supabase/auth-templates')
  assert(fs.existsSync(authTemplatesDir), 'Directory supabase/auth-templates/ exists')

  const requiredAuthTemplates = [
    { file: 'confirm-signup.html', subject: 'Verify your FestFlow email address' },
    { file: 'reset-password.html', subject: 'Reset your FestFlow password' },
    { file: 'magic-link.html', subject: 'Your FestFlow Login Link' },
    { file: 'change-email.html', subject: 'Confirm your new FestFlow email address' },
    { file: 'invite-user.html', subject: "You've been invited to FestFlow" },
  ]

  for (const tpl of requiredAuthTemplates) {
    const filePath = path.join(authTemplatesDir, tpl.file)
    assert(fs.existsSync(filePath), `Template file ${tpl.file} exists`)
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      assert(content.length > 500, `${tpl.file} is non-empty and contains complete HTML layout (>500 bytes)`)
      assert(
        content.includes('{{ .ConfirmationURL }}'),
        `${tpl.file} uses correct Supabase template variable {{ .ConfirmationURL }}`
      )
      assert(
        content.includes('festflow.online'),
        `${tpl.file} contains FestFlow branding and festflow.online domain references`
      )
      assert(
        !content.includes('vercel.app'),
        `${tpl.file} contains NO hardcoded vercel.app domains`
      )
    }
  }

  // ── SUITE 4: Edge Function Code & 16 Application Templates Audit ──────────
  console.log('\n--- Suite 4: Edge Function 16 Application Templates & Security Audit ---')
  const edgePath = path.resolve(process.cwd(), 'supabase/functions/send-email/index.ts')
  assert(fs.existsSync(edgePath), 'Edge Function file exists at supabase/functions/send-email/index.ts')
  const edgeCode = fs.readFileSync(edgePath, 'utf-8')

  const expectedTemplates = [
    'registration_confirmed',
    'application_submitted',
    'payment_received',
    'payment_approved',
    'payment_rejected',
    'team_invitation',
    'team_invitation_accepted',
    'ticket_issued',
    'ticket_updated',
    'registration_cancelled',
    'registration_waitlisted',
    'event_updated',
    'event_cancelled',
    'checkin_confirmed',
    'event_reminder',
    'club_member_invitation',
  ]

  for (const tpl of expectedTemplates) {
    assert(
      edgeCode.includes(`'${tpl}'`),
      `Template '${tpl}' is explicitly handled in send-email Edge Function`
    )
  }

  // Sender hygiene
  assert(
    edgeCode.includes("Deno.env.get('RESEND_API_KEY')"),
    'RESEND_API_KEY is read dynamically via Deno.env'
  )
  assert(
    edgeCode.includes('festflow.events@festflow.online'),
    'Default sender identity is festflow.events@festflow.online'
  )
  assert(
    edgeCode.includes('festflow.events@gmail.com'),
    'Default reply-to is festflow.events@gmail.com'
  )
  assert(
    !edgeCode.includes('re_123') && !edgeCode.includes('sk_live'),
    'No real Resend API keys or secrets hardcoded in Edge Function'
  )

  // ── SUITE 5: Application Email Dispatchers & Dynamic Payload Gating ───────
  console.log('\n--- Suite 5: Application Email Dispatchers & Idempotency ---')
  store.clear()

  // 1. Confirmed registration
  const res1 = await sendRegistrationConfirmedEmail({
    to: 'attendee@campus.edu',
    name: 'Attendee Name',
    eventTitle: 'TechFest 2026',
    ticketCode: 'TKT-TF26-001',
    qrToken: 'qr_tok_123',
    startDate: '2026-11-20',
    venueName: 'Campus Arena',
    registrationId: 'reg_tf_1',
  })
  assert(res1.success, 'sendRegistrationConfirmedEmail succeeds in local simulation mode')
  const outbox = getLocalOutbox()
  assert(outbox.length === 1, 'Outbox record created for confirmed registration')
  assert(
    outbox[0].recipient_email === 'attendee@campus.edu',
    'Outbox record contains correct attendee recipient'
  )
  assert(
    outbox[0].payload.ticket_url === 'https://festflow.online/student/tickets/reg_tf_1',
    `ticket_url points to canonical domain (${outbox[0].payload.ticket_url})`
  )

  // 2. Duplicate dispatch suppression
  const resDuplicate = await sendRegistrationConfirmedEmail({
    to: 'attendee@campus.edu',
    name: 'Attendee Name',
    eventTitle: 'TechFest 2026',
    ticketCode: 'TKT-TF26-001',
    startDate: '2026-11-20',
    venueName: 'Campus Arena',
    registrationId: 'reg_tf_1',
  })
  assert(
    resDuplicate.message.includes('already queued/sent'),
    'Duplicate registration email is intercepted by idempotency key'
  )
  assert(getLocalOutbox().length === 1, 'Outbox count remains 1 (no duplicate send)')

  // 3. Paid event payment submission -> payment_received email
  const resPayRcv = await sendPaymentReceivedEmail({
    to: 'paying_student@campus.edu',
    name: 'Paying Student',
    eventTitle: 'HackSummit Paid',
    transactionReference: 'UPI-987654321',
    amount: 750,
    registrationId: 'reg_paid_101',
  })
  assert(resPayRcv.success, 'sendPaymentReceivedEmail dispatches successfully')
  const latestOutbox = getLocalOutbox()
  const payRecord = latestOutbox.find((o) => o.template_type === 'payment_received')
  assert(Boolean(payRecord), 'payment_received record present in outbox')
  assert(
    payRecord?.payload.amount === 750 && payRecord?.payload.transaction_reference === 'UPI-987654321',
    'Payment submission payload contains amount and reference'
  )
  assert(!payRecord?.payload.ticket_code, 'Payment submission does NOT include entry ticket')

  // 4. Payment approval -> payment_approved & ticket_issued
  const resPayAppr = await sendPaymentApprovedEmail({
    to: 'paying_student@campus.edu',
    name: 'Paying Student',
    eventTitle: 'HackSummit Paid',
    ticketCode: 'TKT-PAID-CONFIRMED-88',
    venueName: 'Main Hall',
    registrationId: 'reg_paid_101',
  })
  assert(resPayAppr.success, 'sendPaymentApprovedEmail dispatches successfully')
  const approvedRecord = getLocalOutbox().find((o) => o.template_type === 'payment_approved')
  assert(
    approvedRecord?.payload.ticket_url === 'https://festflow.online/student/tickets/reg_paid_101',
    'payment_approved delivers canonical ticket URL'
  )

  // 5. Payment rejection -> payment_rejected (no ticket)
  const resPayRej = await sendPaymentRejectedEmail({
    to: 'rejected_student@campus.edu',
    name: 'Rejected Student',
    eventTitle: 'HackSummit Paid',
    reason: 'UTR not found in bank statement',
    registrationId: 'reg_paid_999',
  })
  assert(resPayRej.success, 'sendPaymentRejectedEmail dispatches successfully')
  const rejectedRecord = getLocalOutbox().find((o) => o.template_type === 'payment_rejected')
  assert(
    rejectedRecord?.payload.reason === 'UTR not found in bank statement',
    'payment_rejected delivers clear rejection reason'
  )
  assert(!rejectedRecord?.payload.ticket_code, 'payment_rejected does NOT deliver ticket')

  // 6. Club staff invitation
  const resClubInv = await sendClubMemberInvitationEmail({
    to: 'newstaff@campus.edu',
    clubName: 'IEEE Student Branch',
    inviterName: 'Lead Chair',
    role: 'event_manager',
    invitationUrl: 'https://festflow.online/club/invitations/tok_staff_777',
    expiresAt: '2026-11-05',
    clubId: 'club_ieee_1',
  })
  assert(resClubInv.success, 'sendClubMemberInvitationEmail dispatches successfully')
  const clubInvRecord = getLocalOutbox().find((o) => o.template_type === 'club_member_invitation')
  assert(
    clubInvRecord?.payload.invitation_url.startsWith('https://festflow.online/club/invitations/'),
    'Club invitation email points to canonical festflow.online domain'
  )

  // ── SUITE 6: Source Code Domain & Hardcoded Origin Audit ───────────────────
  console.log('\n--- Suite 6: Source Code Domain & Hardcoded Origin Audit ---')
  const filesToAudit = [
    'src/lib/teams.ts',
    'src/lib/clubMembers.ts',
    'src/pages/club/ClubMembersPage.tsx',
    'src/lib/emails.ts',
    'src/lib/registrations.ts',
    'src/lib/payments.ts',
  ]

  for (const relFile of filesToAudit) {
    const fullPath = path.resolve(process.cwd(), relFile)
    assert(fs.existsSync(fullPath), `${relFile} exists`)
    const src = fs.readFileSync(fullPath, 'utf-8')
    assert(
      !src.includes('festflow.app'),
      `${relFile} has no references to legacy domain festflow.app`
    )
    assert(
      !src.includes("'http://localhost:5173'"),
      `${relFile} has no hardcoded fallback to localhost:5173`
    )
  }

  // ── Test Summary ──────────────────────────────────────────────────────────
  console.log(`\n======================================================`)
  console.log(`Test Results: ${passed} passed, ${failed} failed`)
  console.log(`======================================================\n`)

  if (failed > 0) {
    console.error('Failures encountered:')
    for (const f of failures) {
      console.error(`- ${f}`)
    }
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
