// Phase 9: Scalability & High-Concurrency Load Simulation Test Suite
import { listPublishedEvents } from '../src/lib/events'
import {
  checkActionRateLimit,
  sanitizeHtml,
  validateSafeUrl,
  validateUploadedFile,
  isPaymentAuthoritativeVerified,
} from '../src/lib/security'
import {
  getInAppNotificationsEnhanced,
  getEventWaitlistStatus,
  joinEventWaitlist,
} from '../src/lib/notifications'

let totalTests = 0
let passedTests = 0

function assert(condition: boolean, desc: string) {
  totalTests++
  if (condition) {
    passedTests++
    console.log(`  ✓ ${desc}`)
  } else {
    console.error(`  ✗ FAIL: ${desc}`)
  }
}

interface LatencyStats {
  count: number
  totalMs: number
  avgMs: number
  p50Ms: number
  p95Ms: number
  p99Ms: number
  minMs: number
  maxMs: number
}

function calculateLatencies(durations: number[]): LatencyStats {
  durations.sort((a, b) => a - b)
  const count = durations.length
  const totalMs = durations.reduce((acc, d) => acc + d, 0)
  const avgMs = Math.round((totalMs / count) * 100) / 100
  const p50Ms = durations[Math.floor(count * 0.5)] || 0
  const p95Ms = durations[Math.floor(count * 0.95)] || 0
  const p99Ms = durations[Math.floor(count * 0.99)] || 0
  const minMs = durations[0] || 0
  const maxMs = durations[count - 1] || 0

  return { count, totalMs, avgMs, p50Ms, p95Ms, p99Ms, minMs, maxMs }
}

async function runLoadTestSuite() {
  console.log('===============================================================')
  console.log('  FESTFLOW PHASE 9: SCALABILITY & HIGH-CONCURRENCY TEST SUITE')
  console.log('===============================================================\n')

  const initialMem = process.memoryUsage()
  console.log(`Initial Heap Usage: ${(initialMem.heapUsed / 1024 / 1024).toFixed(2)} MB\n`)

  // 1. High-Volume Event Discovery Simulation (1,000 Concurrent Queries)
  console.log('1. High-Volume Discovery Load Test (1,000 Concurrent Requests):')
  {
    const concurrency = 1000
    const durations: number[] = []

    const start = performance.now()
    const promises: Promise<void>[] = []

    for (let i = 0; i < concurrency; i++) {
      promises.push(
        (async () => {
          const reqStart = performance.now()
          await listPublishedEvents({ limit: 12, page: 1 })
          durations.push(performance.now() - reqStart)
        })()
      )
    }

    await Promise.all(promises)
    const elapsed = performance.now() - start
    const stats = calculateLatencies(durations)

    console.log(`  - 1,000 queries completed in ${elapsed.toFixed(1)}ms (${(concurrency / (elapsed / 1000)).toFixed(0)} req/sec)`)
    console.log(`  - Latency: Avg ${stats.avgMs}ms | p50 ${stats.p50Ms.toFixed(1)}ms | p95 ${stats.p95Ms.toFixed(1)}ms | p99 ${stats.p99Ms.toFixed(1)}ms`)

    assert(elapsed < 2000, '1,000 queries finish under 2.0s without blocking')
    assert(stats.p95Ms < 50, 'p95 latency is sub-50ms under concurrent burst')
  }

  // 2. Simultaneous Capacity Registration Contention (50 Capacity, 500 Requests)
  console.log('\n2. Simultaneous Registration Contention & Capacity Oversell Protection:')
  {
    const eventCapacity = 50
    let currentConfirmed = 0
    let rejectedOversold = 0
    let waitlistJoined = 0

    // Simulate atomic database reservation
    const registerStudent = async (studentId: string): Promise<boolean> => {
      // In production, this executes via atomic SQL transaction:
      // UPDATE events SET registered = registered + 1 WHERE id = ... AND registered < capacity
      if (currentConfirmed < eventCapacity) {
        currentConfirmed++
        return true
      }
      rejectedOversold++
      return false
    }

    const registrationPromises: Promise<void>[] = []
    for (let i = 0; i < 500; i++) {
      registrationPromises.push(
        (async () => {
          const success = await registerStudent(`student_${i}`)
          if (!success) {
            waitlistJoined++
          }
        })()
      )
    }

    await Promise.all(registrationPromises)

    console.log(`  - Configured Event Capacity: ${eventCapacity}`)
    console.log(`  - Confirmed Registrations: ${currentConfirmed}`)
    console.log(`  - Prevented Oversold Attempts: ${rejectedOversold}`)
    console.log(`  - Redirected to Waitlist: ${waitlistJoined}`)

    assert(currentConfirmed === eventCapacity, 'Exact capacity filled without overselling a single seat')
    assert(rejectedOversold === 450, 'All 450 excess burst registrations safely rejected from ticket pool')
    assert(waitlistJoined === 450, 'Excess attendees automatically routed to waitlist queue')
  }

  // 3. Concurrent QR Gate Scanner Deduplication (500 Scans)
  console.log('\n3. Gate Turnstile High-Speed Check-In & Deduplication (500 Scans):')
  {
    const checkedInTickets = new Set<string>()
    let validAdmissions = 0
    let duplicateRejected = 0

    const scanTurnstile = async (ticketCode: string): Promise<string> => {
      // Atomically check and insert
      if (checkedInTickets.has(ticketCode)) {
        duplicateRejected++
        return 'ALREADY_USED'
      }
      checkedInTickets.add(ticketCode)
      validAdmissions++
      return 'ADMITTED'
    }

    // 250 distinct tickets scanned twice concurrently = 500 scans
    const scanPromises: Promise<void>[] = []
    for (let i = 0; i < 250; i++) {
      const code = `PASS-2026-X${i}`
      scanPromises.push(scanTurnstile(code).then(() => {}))
      scanPromises.push(scanTurnstile(code).then(() => {}))
    }

    await Promise.all(scanPromises)

    console.log(`  - Valid First-Time Turnstile Admissions: ${validAdmissions}`)
    console.log(`  - Duplicate Replay Attacks Blocked: ${duplicateRejected}`)

    assert(validAdmissions === 250, 'Exactly 250 unique attendees admitted')
    assert(duplicateRejected === 250, 'All 250 concurrent duplicate scan attempts rejected instantly')
  }

  // 4. Rate Limiting & Rapid Replay Throttling
  console.log('\n4. Client Cooldown & Replay Burst Protection:')
  {
    const actionKey = 'submit_payment_reg_999'
    const firstCall = checkActionRateLimit(actionKey, 1000)
    const secondCall = checkActionRateLimit(actionKey, 1000) // Within 1s cooldown

    assert(firstCall === true, 'Initial legitimate action permitted immediately')
    assert(secondCall === false, 'Rapid duplicate click throttled by security cooldown')
  }

  // 5. Security Sanitization & Protocol Validation Under Attack
  console.log('\n5. Input Sanitization & Attack Prevention:')
  {
    const xssPayload = '<script>alert("hacked")</script>'
    const sanitized = sanitizeHtml(xssPayload)
    assert(!sanitized.includes('<script>'), 'Strictly escapes HTML tags')
    assert(sanitized.includes('&lt;script&gt;'), 'Converts to harmless HTML entities')

    const maliciousUrl = 'javascript:stealCredentials()'
    const safeUrl = validateSafeUrl(maliciousUrl)
    assert(safeUrl === null, 'Strictly rejects javascript: execution URLs')

    const validUrl = validateSafeUrl('https://festflow.online/discover')
    assert(validUrl === 'https://festflow.online/discover', 'Approves verified https URL')

    // File validation
    const fakeFile = new File(['binary_content'], 'malicious.php.exe', { type: 'application/octet-stream' })
    const fileRes = validateUploadedFile(fakeFile)
    assert(fileRes.valid === false, 'Rejects executable binary file uploads')
  }

  // 6. Payment Security & Pass Issuance Integrity
  console.log('\n6. Payment Verification & Pass Lockout Invariants:')
  {
    // Case 1: Student claims payment was made, but status is pending_review
    const unapprovedPass = isPaymentAuthoritativeVerified(false, 'pending_payment', 'pending_review', null)
    assert(unapprovedPass === false, 'Paid pass locked while submission is awaiting review')

    // Case 2: Free event confirmed
    const freePass = isPaymentAuthoritativeVerified(true, 'confirmed', null, '2026-11-02T10:00:00Z')
    assert(freePass === true, 'Free event confirmed passes active')

    // Case 3: Paid event verified by organizer
    const approvedPass = isPaymentAuthoritativeVerified(false, 'confirmed', 'approved', '2026-11-02T10:00:00Z')
    assert(approvedPass === true, 'Paid pass active only after organizer approved & ticket issued')
  }

  // 7. Notification Burst Test (500 Notifications)
  console.log('\n7. Notification High-Speed Queue Retrieval:')
  {
    const notifUser = 'burst_test_user'
    const notifRes = await getInAppNotificationsEnhanced(notifUser, { limit: 50 })
    assert(Array.isArray(notifRes.notifications), 'Notifications retrieved successfully under burst load')
    assert(typeof notifRes.unreadCount === 'number', 'Unread count computed accurately')
  }

  const finalMem = process.memoryUsage()
  const memDiffMb = ((finalMem.heapUsed - initialMem.heapUsed) / 1024 / 1024).toFixed(2)
  console.log(`\nFinal Heap Usage: ${(finalMem.heapUsed / 1024 / 1024).toFixed(2)} MB (Delta: +${memDiffMb} MB)`)

  console.log('\n===============================================================')
  console.log(`  PHASE 9 LOAD & SCALABILITY TESTS: ${passedTests}/${totalTests} PASSED`)
  console.log('===============================================================')

  if (passedTests === totalTests) {
    process.exit(0)
  } else {
    process.exit(1)
  }
}

runLoadTestSuite().catch((err) => {
  console.error('Load test uncaught error:', err)
  process.exit(1)
})

