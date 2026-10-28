/**
 * scripts/test-phase3-ticket-delivery-and-email-sync.ts
 *
 * Automated regression test suite for FestFlow Phase 3:
 * Reliable Individual Ticket Delivery, Email Notifications, Resend Functionality & Realtime Sync.
 *
 * Covers:
 * 1. Migration 021 & SQL architecture audit (email outbox, individual member tickets, Realtime publications)
 * 2. Individual team member tickets (separate registration, unique ticket code, ownership, no duplicate passes)
 * 3. Payment approval synchronization across team registrations (all member passes activated consistently)
 * 4. Transactional email templates, outbox tracking, idempotency, and 60-second resend rate-limiting
 * 5. Realtime status synchronization, cross-tab events, and anti-stale request guarding
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
  createTeam,
  joinTeam,
  getTeamDetails,
} from '../src/lib/teams'
import {
  registerForEvent,
  getStudentRegistrations,
  getRegistrationById,
} from '../src/lib/registrations'
import {
  submitPaymentProof,
  reviewPaymentSubmission,
} from '../src/lib/payments'
import {
  triggerTransactionalEmail,
  resendOutboxEmail,
  getLocalOutbox,
  sendTicketIssuedEmail,
  sendTeamInvitationAcceptedEmail,
  sendPaymentApprovedEmail,
} from '../src/lib/emails'
import {
  broadcastStatusChange,
  subscribeToStatusChanges,
  createAntiStaleGuard,
  type StatusChangeEvent,
} from '../src/lib/sync'
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

async function runPhase3Suite() {
  console.log('\n============================================================')
  console.log('🧪 FESTFLOW PHASE 3: TICKET DELIVERY, EMAILS & REALTIME SYNC')
  console.log('============================================================\n')

  mockLocalStorage.clear()

  // -------------------------------------------------------------------------
  // SUITE 1: Migration 021 & SQL Architecture Audit
  // -------------------------------------------------------------------------
  console.log('--- 1. Migration 021 & Database Outbox Audit ---')
  const migrationPath = path.resolve('supabase/migrations/021_email_outbox_and_team_tickets.sql')
  assert(fs.existsSync(migrationPath), 'Migration 021 exists on disk')

  const sqlContent = fs.readFileSync(migrationPath, 'utf-8').toLowerCase()

  assert(
    sqlContent.includes('provider_message_id') &&
      sqlContent.includes('retry_count') &&
      sqlContent.includes('max_retries') &&
      sqlContent.includes('last_attempt_at'),
    'Migration 021 enhances email_outbox with retry counts, limits, and provider message IDs'
  )

  assert(
    sqlContent.includes('resend_outbox_email') &&
      sqlContent.includes("interval '60 seconds'"),
    'resend_outbox_email RPC enforces 60-second rate-limiting between resend attempts'
  )

  assert(
    sqlContent.includes('sync_team_member_registration') &&
      sqlContent.includes('insert into public.registrations'),
    'sync_team_member_registration creates an individual registration record for every team member'
  )

  assert(
    sqlContent.includes('sync_team_payment_approval'),
    'sync_team_payment_approval RPC synchronizes payment status across all registrations sharing team_id'
  )

  assert(
    sqlContent.includes('alter publication supabase_realtime add table public.registrations') &&
      sqlContent.includes('alter publication supabase_realtime add table public.payment_submissions'),
    'Supabase Realtime publication enables live postgres replication for registrations and payments'
  )

  // -------------------------------------------------------------------------
  // SUITE 2: Individual Tickets for Team Members
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Individual Team Member Tickets & Pass Isolation ---')

  const now = new Date()
  const futureStart = new Date(now.getTime() + 86400000 * 5).toISOString()
  const futureEnd = new Date(now.getTime() + 86400000 * 6).toISOString()

  const freeTeamEvent: EventRecord = {
    id: 'evt-ai-sprint-2026',
    slug: 'ai-sprint-2026',
    club_id: 'club-ai-1',
    title: 'AI Innovation Sprint',
    summary: 'Team Hackathon for campus innovators',
    description: 'Sprint to build AI prototypes.',
    category: 'hackathon',
    poster_url: 'https://example.com/poster.jpg',
    start_date: futureStart,
    end_date: futureEnd,
    registration_opens_at: null,
    registration_closes_at: null,
    venue_name: 'CS Lab 4',
    venue_address: 'Tech Block 1',
    capacity: 50,
    is_free: true,
    price: 0,
    currency: 'INR',
    eligibility: null,
    rules: 'Teams of 2 to 4 students.',
    event_type: 'offline',
    participation_type: 'team',
    min_team_size: 2,
    max_team_size: 4,
    leader_counts_towards_size: true,
    team_registration_mode: 'members_join_with_code',
    require_team_name: true,
    timezone: 'Asia/Kolkata',
    approval_type: 'automatic',
    status: 'published',
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    custom_questions: [],
    allowed_colleges: null,
    allowed_departments: null,
    allowed_years: null,
    contact_email: 'ai@campus.edu',
    contact_phone: '+91 9888888888',
    online_meeting_url: null,
    participant_fields: {
      require_college: true,
      require_phone: true,
      require_grad_year: true,
      require_id_card: false,
    },
  }

  mockLocalStorage.setItem('festflow_managed_events', JSON.stringify([freeTeamEvent]))

  // 1. Leader registers for free team event
  const leaderReg = await registerForEvent(
    freeTeamEvent.id,
    'user-lead-1',
    {
      teamName: 'NeuralKnights',
      participantDetails: {
        student_name: 'Liam Leader',
        email: 'liam@campus.edu',
        phone: '9876543210',
        college_name: 'Campus Tech',
        grad_year: '2027',
      },
    }
  )

  assert(leaderReg.success, 'Leader registered successfully')
  const leaderTicketCode = leaderReg.ticket_code!
  const teamInviteCode = leaderReg.invite_code!
  const teamId = leaderReg.team_id!

  // 2. Member (Maya) joins team
  const mayaJoin = await joinTeam({
    inviteCode: teamInviteCode,
    userId: 'user-maya-2',
    userEmail: 'maya@campus.edu',
    participantDetails: {
      student_name: 'Maya Member',
      college_name: 'Campus Tech',
      phone: '9123456789',
    },
  })

  assert(mayaJoin.success, 'Maya joined NeuralKnights squad')
  assert(Boolean(mayaJoin.registration_id), 'Member received an individual registration_id')

  // 3. Verify member has their OWN individual registration record
  const mayaRegRes = await getRegistrationById(mayaJoin.registration_id!)
  assert(mayaRegRes.registration !== null, 'Member individual registration retrieved successfully')

  const mayaReg = mayaRegRes.registration!
  assert(mayaReg.student_id === 'user-maya-2', 'Member registration has student_id matching Maya (not leader)')
  assert(mayaReg.status === 'confirmed', 'Member status is confirmed for free auto-approved event')
  assert(Boolean(mayaReg.ticket_code), 'Member has an individual ticket code')
  assert(
    mayaReg.ticket_code !== leaderTicketCode,
    'Member ticket code is distinct from leader ticket code'
  )
  assert(
    mayaReg.ticket_code?.includes(leaderTicketCode) || mayaReg.ticket_code?.startsWith('FF-'),
    'Member ticket follows standard sub-identifier format'
  )
  assert(
    Boolean(mayaReg.ticket_issued_at),
    'Member ticket is active with issued timestamp'
  )

  // 4. Verify member sees their pass in their account via getStudentRegistrations
  const mayaDashboardRegs = await getStudentRegistrations('user-maya-2')
  assert(
    mayaDashboardRegs.registrations.some((r) => r.id === mayaReg.id),
    'Member sees their individual pass in their student dashboard'
  )

  // 5. Verify pass privacy / ownership isolation: Unrelated user cannot view member ticket
  const unrelatedRegs = await getStudentRegistrations('user-stranger-9')
  assert(
    !unrelatedRegs.registrations.some((r) => r.id === mayaReg.id),
    'Unrelated user dashboard does NOT expose member private pass'
  )

  // 6. Idempotency: Member joining again reuses existing registration without duplicate tickets
  const duplicateJoin = await joinTeam({
    inviteCode: teamInviteCode,
    userId: 'user-maya-2',
    userEmail: 'maya@campus.edu',
    participantDetails: {
      student_name: 'Maya Member',
    },
  })
  assert(!duplicateJoin.success, 'Duplicate join by already accepted member is safely blocked')

  // -------------------------------------------------------------------------
  // SUITE 3: Squad Payment Approval & Ticket Consistency
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Squad Payment Approval & Ticket Consistency ---')

  const paidTeamEvent: EventRecord = {
    ...freeTeamEvent,
    id: 'evt-code-jam-paid',
    slug: 'code-jam-paid',
    title: 'Code Jam Pro (Team Pass)',
    is_free: false,
    price: 300,
  }
  mockLocalStorage.setItem(
    'festflow_managed_events',
    JSON.stringify([freeTeamEvent, paidTeamEvent])
  )

  // Leader registers for paid event
  const paidLeaderReg = await registerForEvent(
    paidTeamEvent.id,
    'user-lead-paid',
    {
      teamName: 'ByteBusters',
      participantDetails: {
        student_name: 'Peter Parker',
        email: 'peter@campus.edu',
        phone: '9888877777',
        college_name: 'Tech University',
        grad_year: '2026',
      },
    }
  )

  assert(paidLeaderReg.success, 'Paid team leader registered successfully')
  assert(
    paidLeaderReg.status === 'pending_payment',
    'Paid event initial status is "pending_payment"'
  )
  assert(
    !paidLeaderReg.ticket_issued,
    'Paid event: Ticket is NOT issued before payment verification'
  )

  // Member (Ned) joins ByteBusters before payment is verified
  const nedJoin = await joinTeam({
    inviteCode: paidLeaderReg.invite_code!,
    userId: 'user-ned-3',
    userEmail: 'ned@campus.edu',
    participantDetails: {
      student_name: 'Ned Leeds',
    },
  })

  assert(nedJoin.success, 'Ned joined ByteBusters')
  const nedRegRes = await getRegistrationById(nedJoin.registration_id!)
  assert(
    nedRegRes.registration?.status === 'pending_payment',
    'Member registration matches squad pending_payment status'
  )
  assert(
    nedRegRes.registration?.ticket_issued_at === null,
    'Member ticket is NOT activated while payment is pending'
  )

  // Leader submits UPI payment
  const paymentRes = await submitPaymentProof({
    registrationId: paidLeaderReg.registration_id!,
    eventId: paidTeamEvent.id,
    studentId: 'user-lead-paid',
    transactionReference: '123456789012',
    amount: 300,
    currency: 'INR',
  })
  assert(paymentRes.success, 'Payment UTR submitted successfully')

  // Organizer reviews and APPROVES payment
  const reviewRes = await reviewPaymentSubmission({
    paymentId: paymentRes.submission_id!,
    decision: 'approved',
    notes: 'Verified in SBI statement.',
  })
  assert(reviewRes.success, 'Organizer approved payment')

  // Verify BOTH leader registration AND member registration are now confirmed & tickets active!
  const updatedLeaderReg = await getRegistrationById(paidLeaderReg.registration_id!)
  const updatedNedReg = await getRegistrationById(nedJoin.registration_id!)

  assert(
    updatedLeaderReg.registration?.status === 'confirmed',
    'Leader registration transitioned to "confirmed"'
  )
  assert(
    Boolean(updatedLeaderReg.registration?.ticket_issued_at),
    'Leader ticket is now active'
  )
  assert(
    updatedNedReg.registration?.status === 'confirmed',
    'Squad member (Ned) registration automatically transitioned to "confirmed"'
  )
  assert(
    Boolean(updatedNedReg.registration?.ticket_issued_at),
    'Squad member (Ned) individual ticket is now active'
  )

  // -------------------------------------------------------------------------
  // SUITE 4: Email Notification Workflow, Outbox Tracking & Resend Cooldown
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Email Templates, Outbox State & Resend Rate-Limiting ---')

  // 1. Verify send-email Edge Function has all required templates
  const edgeFunctionPath = path.resolve('supabase/functions/send-email/index.ts')
  assert(fs.existsSync(edgeFunctionPath), 'send-email Edge Function exists')
  const edgeCode = fs.readFileSync(edgeFunctionPath, 'utf-8')

  const requiredTemplates = [
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
  ]

  const missingTemplates = requiredTemplates.filter((t) => !edgeCode.includes(t))
  assert(
    missingTemplates.length === 0,
    `Edge Function supports all required templates (missing: ${missingTemplates.join(', ') || 'none'})`
  )

  // 2. Dispatch a ticket issued email with idempotency key
  const dispatchRes = await sendTicketIssuedEmail({
    to: 'maya@campus.edu',
    name: 'Maya Member',
    eventTitle: freeTeamEvent.title,
    ticketCode: mayaReg.ticket_code!,
    venueName: freeTeamEvent.venue_name,
    teamName: 'NeuralKnights',
    registrationId: mayaReg.id,
    eventId: freeTeamEvent.id,
  })

  assert(dispatchRes.success, 'Ticket email dispatch succeeded')
  assert(Boolean(dispatchRes.outboxId), 'Outbox ID returned for dispatched email')
  assert(Boolean(dispatchRes.emailId), 'Provider message ID tracked')

  const outbox = getLocalOutbox()
  const outboxItem = outbox.find((i) => i.id === dispatchRes.outboxId)
  assert(outboxItem !== undefined, 'Outbox item persisted in storage')
  assert(outboxItem?.template_type === 'ticket_issued', 'Outbox template_type is ticket_issued')
  assert(outboxItem?.status === 'sent', 'Outbox status recorded as sent')

  // 3. Idempotency test: Re-dispatching with identical key is detected
  const duplicateDispatch = await sendTicketIssuedEmail({
    to: 'maya@campus.edu',
    name: 'Maya Member',
    eventTitle: freeTeamEvent.title,
    ticketCode: mayaReg.ticket_code!,
    venueName: freeTeamEvent.venue_name,
    registrationId: mayaReg.id,
    eventId: freeTeamEvent.id,
  })
  assert(
    duplicateDispatch.success && duplicateDispatch.message.includes('already'),
    'Idempotency key prevents duplicate email dispatches'
  )

  // 4. Rate-limiting check: Immediate resend blocked by 60s cooldown
  const rapidResend = await resendOutboxEmail(dispatchRes.outboxId!, 'user-maya-2')
  assert(
    !rapidResend.success,
    'Immediate email resend blocked by 60-second cooldown rate-limiting'
  )
  assert(
    rapidResend.message.includes('wait'),
    'Clear cooldown feedback message provided'
  )

  // 5. Authorization check: Unauthorized user cannot resend someone else's email
  const unauthorizedResend = await resendOutboxEmail(dispatchRes.outboxId!, 'user-stranger-9')
  assert(
    !unauthorizedResend.success,
    'Unauthorized user cannot trigger email resends'
  )

  // -------------------------------------------------------------------------
  // SUITE 5: Realtime & Cross-Tab Application Synchronization
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Realtime Status Synchronization & Anti-Stale Guards ---')

  let receivedEvent: StatusChangeEvent | null = null

  // Subscribe to status changes
  const unsubscribe = subscribeToStatusChanges(
    ['payment_reviewed', 'registration_updated', 'team_updated', 'reconnect'],
    (event) => {
      receivedEvent = event
    }
  )

  // Dispatch a status change
  broadcastStatusChange({
    type: 'payment_reviewed',
    registrationId: paidLeaderReg.registration_id!,
    eventId: paidTeamEvent.id,
    studentId: 'user-lead-paid',
  })

  assert(receivedEvent !== null, 'Status change event was received by subscriber')
  assert(
    receivedEvent?.type === 'payment_reviewed',
    'Received event matches type "payment_reviewed"'
  )
  assert(
    receivedEvent?.registrationId === paidLeaderReg.registration_id,
    'Event contains target registrationId'
  )

  // Clean up subscription
  unsubscribe()

  // Test Anti-Stale Guard
  const guard = createAntiStaleGuard()
  const req1 = guard.startRequest()
  const req2 = guard.startRequest()

  assert(
    !guard.isFresh(req1),
    'Anti-Stale Guard rejects earlier request (req1) when newer request (req2) was initiated'
  )
  assert(
    guard.isFresh(req2),
    'Anti-Stale Guard accepts newest request (req2)'
  )

  console.log('\n============================================================')
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} tests passed`)
  if (passedTests === totalTests) {
    console.log('🎉 ALL PHASE 3 TICKET, EMAIL & REALTIME TESTS PASSED!')
    console.log('============================================================\n')
    process.exit(0)
  } else {
    console.error(`❌ ${totalTests - passedTests} tests failed.`)
    console.log('============================================================\n')
    process.exit(1)
  }
}

runPhase3Suite().catch((err) => {
  console.error('Fatal test runner error:', err)
  process.exit(1)
})
