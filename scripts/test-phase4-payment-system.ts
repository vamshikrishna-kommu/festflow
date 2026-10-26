/**
 * FestFlow Phase 4: Payment System & Checkout Verification Suite
 * Tests order creation, free/paid separation, verification, idempotency, failure recovery,
 * and state synchronization without live credit card charges.
 */

import {
  createPaymentOrder,
  verifyPaymentOrder,
  recordPaymentFailure,
  getStudentPaymentOrder,
  isRazorpayConfigured,
} from '../src/lib/payments.js'

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

// Mock browser localStorage for Node/tsx testing environment
class MockLocalStorage {
  private store: Record<string, string> = {}
  getItem(key: string) {
    return this.store[key] || null
  }
  setItem(key: string, value: string) {
    this.store[key] = value
  }
  removeItem(key: string) {
    delete this.store[key]
  }
  clear() {
    this.store = {}
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  ;(globalThis as any).localStorage = new MockLocalStorage()
}

async function runPhase4Tests() {
  console.log('\n============================================================')
  console.log('FESTFLOW PHASE 4: REPAIR THE REAL PAYMENT SYSTEM TESTS')
  console.log('============================================================\n')

  // Setup seed mock events & registrations in localStorage
  const now = new Date()
  const mockEvents = [
    {
      id: 'evt_free_tech',
      title: 'Free Open Source Workshop',
      slug: 'free-open-source',
      price: 0,
      currency: 'INR',
      is_free: true,
      approval_type: 'automatic',
      status: 'published',
      club_id: 'club_dev_council',
      start_date: new Date(now.getTime() + 86400000 * 3).toISOString(),
    },
    {
      id: 'evt_paid_hackathon',
      title: 'National Hackathon 2026',
      slug: 'national-hackathon-2026',
      price: 499,
      currency: 'INR',
      is_free: false,
      approval_type: 'automatic',
      status: 'published',
      club_id: 'club_tech_council',
      start_date: new Date(now.getTime() + 86400000 * 5).toISOString(),
    },
    {
      id: 'evt_paid_curated',
      title: 'VIP Masterclass',
      slug: 'vip-masterclass',
      price: 1200,
      currency: 'INR',
      is_free: false,
      approval_type: 'manual',
      status: 'published',
      club_id: 'club_tech_council',
      start_date: new Date(now.getTime() + 86400000 * 6).toISOString(),
    },
  ]

  const mockRegistrations = [
    {
      id: 'reg_free_1',
      event_id: 'evt_free_tech',
      student_id: 'student_test_1',
      status: 'confirmed',
      ticket_code: 'FF-FREE-001',
      created_at: now.toISOString(),
      ticket_issued_at: now.toISOString(),
    },
    {
      id: 'reg_paid_payable',
      event_id: 'evt_paid_hackathon',
      student_id: 'student_test_1',
      status: 'pending_payment',
      ticket_code: 'FF-HACK-PENDING',
      created_at: now.toISOString(),
      ticket_issued_at: null,
    },
    {
      id: 'reg_paid_curated_locked',
      event_id: 'evt_paid_curated',
      student_id: 'student_test_1',
      status: 'pending_approval',
      ticket_code: 'FF-VIP-PENDING',
      created_at: now.toISOString(),
      ticket_issued_at: null,
    },
    {
      id: 'reg_paid_cancelled',
      event_id: 'evt_paid_hackathon',
      student_id: 'student_test_2',
      status: 'cancelled',
      ticket_code: 'FF-CANCELLED',
      created_at: now.toISOString(),
      ticket_issued_at: null,
    },
  ]

  localStorage.setItem('festflow_managed_events', JSON.stringify(mockEvents))
  localStorage.setItem('festflow_local_registrations', JSON.stringify(mockRegistrations))
  localStorage.setItem('festflow_local_payment_orders', JSON.stringify([]))

  // ── Test Suite 1: Free vs Paid Event Distinction ─────────────────────────
  console.log('--- Test Suite 1: Free vs Paid Event Order Validation ---')
  const freeOrderRes = await createPaymentOrder('reg_free_1')
  assert(!freeOrderRes.success, 'Free event payment order creation is rejected')
  assert(freeOrderRes.error_code === 'ALREADY_CONFIRMED' || freeOrderRes.error_code === 'FREE_EVENT', 'Error code identifies free event or already confirmed pass')

  const paidOrderRes = await createPaymentOrder('reg_paid_payable')
  assert(paidOrderRes.success, 'Paid event payment order creation succeeds')
  assert(paidOrderRes.order?.amount === 499, 'Order amount matches server-stored event price (₹499)')
  assert(paidOrderRes.order?.currency === 'INR', 'Order currency matches event currency (INR)')
  assert(Boolean(paidOrderRes.order?.order_reference.startsWith('ORD-')), 'Generates unique order reference with ORD- prefix')

  // ── Test Suite 2: Registration State & Security Guards ────────────────────
  console.log('\n--- Test Suite 2: Registration State & Eligibility Guards ---')
  const lockedOrderRes = await createPaymentOrder('reg_paid_curated_locked')
  assert(!lockedOrderRes.success, 'Rejects payment order when application is under host review (pending_approval)')
  assert(lockedOrderRes.error_code === 'APPROVAL_REQUIRED', 'Error code is APPROVAL_REQUIRED')

  const cancelledOrderRes = await createPaymentOrder('reg_paid_cancelled')
  assert(!cancelledOrderRes.success, 'Rejects payment order for cancelled registrations')
  assert(cancelledOrderRes.error_code === 'REGISTRATION_CANCELLED', 'Error code is REGISTRATION_CANCELLED')

  const nonExistentOrderRes = await createPaymentOrder('reg_does_not_exist_999')
  assert(!nonExistentOrderRes.success, 'Rejects non-existent registration IDs')
  assert(nonExistentOrderRes.error_code === 'REGISTRATION_NOT_FOUND', 'Error code is REGISTRATION_NOT_FOUND')

  // ── Test Suite 3: Idempotency & Duplicate Order Prevention ────────────────
  console.log('\n--- Test Suite 3: Idempotency & Duplicate Order Prevention ---')
  const duplicateOrderRes = await createPaymentOrder('reg_paid_payable')
  assert(duplicateOrderRes.success, 'Repeated order creation request is safely handled')
  assert(duplicateOrderRes.order?.id === paidOrderRes.order?.id, 'Returns existing active order instead of creating duplicates')
  assert(duplicateOrderRes.order?.order_reference === paidOrderRes.order?.order_reference, 'Retains same order reference')

  // ── Test Suite 4: Failure & Bank Decline Handling ────────────────────────
  console.log('\n--- Test Suite 4: Payment Failure & Decline Handling ---')
  const failRes = await recordPaymentFailure({
    orderId: paidOrderRes.order!.id,
    errorCode: 'BANK_DECLINED',
    errorDescription: 'Card balance insufficient.',
  })
  assert(failRes.success, 'Recording payment failure succeeds')

  const failedOrder = await getStudentPaymentOrder('reg_paid_payable')
  assert(failedOrder?.status === 'failed', 'Order status transitions to "failed"')
  assert(failedOrder?.error_code === 'BANK_DECLINED', 'Error code is persisted on the order')

  // Verify registration remains payable so user can retry
  const rawRegs = JSON.parse(localStorage.getItem('festflow_local_registrations') || '[]')
  const currentReg = rawRegs.find((r: any) => r.id === 'reg_paid_payable')
  assert(currentReg?.status === 'pending_payment', 'Registration remains payable in pending_payment state after failure')

  // Safe retry test: can create/retry a fresh order after failure
  const retryOrderRes = await createPaymentOrder('reg_paid_payable')
  assert(retryOrderRes.success, 'Student can initiate a fresh retry order after failure')
  assert(retryOrderRes.order?.status === 'created', 'Retry order status is "created"')

  // ── Test Suite 5: Payment Verification & Ticket Issuance ──────────────────
  console.log('\n--- Test Suite 5: Payment Verification & Gate Pass Confirmation ---')
  const mockPaymentId = `pay_rzp_${Date.now().toString(36)}`
  const mockSignature = `sig_valid_${Date.now().toString(36)}`

  const verifyRes = await verifyPaymentOrder({
    orderId: retryOrderRes.order!.id,
    providerPaymentId: mockPaymentId,
    providerSignature: mockSignature,
  })

  assert(verifyRes.success, 'Valid payment verification succeeds')
  assert(verifyRes.status === 'paid', 'Order status transitions to "paid"')
  assert(Boolean(verifyRes.ticket_code), 'Official confirmed ticket code is returned')

  // Verify registration state is confirmed
  const updatedRegs = JSON.parse(localStorage.getItem('festflow_local_registrations') || '[]')
  const verifiedReg = updatedRegs.find((r: any) => r.id === 'reg_paid_payable')
  assert(verifiedReg?.status === 'confirmed', 'Registration status transitions to "confirmed"')
  assert(Boolean(verifiedReg?.ticket_issued_at), 'Pass timestamp ticket_issued_at is set')

  // ── Test Suite 6: Idempotent Verification & Repeated Callbacks ────────────
  console.log('\n--- Test Suite 6: Idempotent Callback Protection ---')
  const repeatVerifyRes = await verifyPaymentOrder({
    orderId: retryOrderRes.order!.id,
    providerPaymentId: mockPaymentId,
    providerSignature: mockSignature,
  })

  assert(repeatVerifyRes.success, 'Repeated verification callback succeeds idempotently')
  assert(repeatVerifyRes.ticket_code === verifyRes.ticket_code, 'Returns the exact same confirmed ticket code')

  // Attempting to create an order for an already confirmed registration is blocked
  const postPaidOrderRes = await createPaymentOrder('reg_paid_payable')
  assert(!postPaidOrderRes.success, 'Order creation blocked for confirmed registrations')
  assert(postPaidOrderRes.error_code === 'ALREADY_CONFIRMED', 'Error code is ALREADY_CONFIRMED')

  // ── Test Suite 7: Invalid Callbacks & Tampering Resistance ────────────────
  console.log('\n--- Test Suite 7: Invalid Callbacks & Tampering Resistance ---')
  const emptyPaymentRes = await verifyPaymentOrder({
    orderId: retryOrderRes.order!.id,
    providerPaymentId: '   ',
    providerSignature: 'dummy',
  })
  assert(!emptyPaymentRes.success, 'Rejects blank / invalid provider payment transaction IDs')
  assert(emptyPaymentRes.error_code === 'INVALID_PAYMENT_ID', 'Error code is INVALID_PAYMENT_ID')

  const nonExistentOrderVerify = await verifyPaymentOrder({
    orderId: 'ord_ghost_999999',
    providerPaymentId: 'pay_123456',
    providerSignature: 'sig_123456',
  })
  assert(!nonExistentOrderVerify.success, 'Rejects verification for non-existent order IDs')
  assert(nonExistentOrderVerify.error_code === 'ORDER_NOT_FOUND', 'Error code is ORDER_NOT_FOUND')

  // Provider configuration detection
  console.log('\n--- Test Suite 8: Provider Gateway Configuration Detection ---')
  console.log(`  ℹ Razorpay Configured in environment: ${isRazorpayConfigured ? 'YES (Live Keys Found)' : 'NO (Using Secure Interactive Sandbox)'}`)
  assert(typeof isRazorpayConfigured === 'boolean', 'Payment gateway configuration check returns boolean status')

  console.log('\n============================================================')
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`)
  console.log('============================================================\n')

  if (failedTests > 0) {
    process.exit(1)
  }
}

runPhase4Tests().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
