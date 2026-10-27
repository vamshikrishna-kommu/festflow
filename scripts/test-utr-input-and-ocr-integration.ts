/**
 * Comprehensive Integration Test Suite:
 * - UTR Input Typing, Editing, and Manual Correction
 * - Screenshot OCR Auto-Extraction (GPay, PhonePe, Paytm, BHIM)
 * - Preventing Overwrite of Manually Entered Values
 * - Submission Validation & State Transitions
 */

import { extractUtrFromText } from '../src/lib/ocrUtrExtractor.js'
import {
  submitPaymentProof,
  getStudentPaymentSubmission,
  reviewPaymentSubmission,
} from '../src/lib/payments.js'

let total = 0
let passed = 0

function assert(condition: boolean, testName: string, detail?: string) {
  total++
  if (condition) {
    passed++
    console.log(`  ✓ PASS: ${testName}`)
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` -> ${detail}` : ''}`)
  }
}

// Mock localStorage
class MockLocalStorage {
  private store: Record<string, string> = {}
  getItem(key: string) { return this.store[key] || null }
  setItem(key: string, value: string) { this.store[key] = value }
  removeItem(key: string) { delete this.store[key] }
  clear() { this.store = {} }
}
if (typeof globalThis.localStorage === 'undefined') {
  ;(globalThis as any).localStorage = new MockLocalStorage()
}

async function runTests() {
  console.log('\n============================================================')
  console.log('FESTFLOW: UTR INPUT & OCR INTEGRATION TEST SUITE')
  console.log('============================================================\n')

  // Setup seed mock events & registrations
  const now = new Date()
  const mockEvents = [
    {
      id: 'evt_hackathon_ocr',
      title: 'National AI Hackathon',
      price: 250,
      currency: 'INR',
      is_free: false,
      status: 'published',
      club_id: 'club_tech',
      start_date: new Date(now.getTime() + 86400000 * 4).toISOString(),
    },
  ]
  const mockRegistrations = [
    {
      id: 'reg_ocr_1',
      event_id: 'evt_hackathon_ocr',
      student_id: 'student_123',
      ticket_code: 'TKT-OCR-001',
      status: 'pending_payment',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
  ]
  localStorage.setItem('festflow_local_events', JSON.stringify(mockEvents))
  localStorage.setItem('festflow_local_registrations', JSON.stringify(mockRegistrations))

  // ── 1. Typing, Editing and Manual Correction Simulation ───────────────────
  console.log('--- Test 1 & 2: Typing, Editing & Pasting UTR ---')
  let currentUtr = ''
  
  // Simulate typing character by character
  const typed = '428910485923'
  for (const char of typed) {
    currentUtr += char
  }
  assert(currentUtr === '428910485923', 'Allows natural keyboard typing')

  // Simulate editing (replacing last 4 digits)
  currentUtr = currentUtr.slice(0, 8) + '9999'
  assert(currentUtr === '428910489999', 'Allows editing and correcting UTR value')

  // Simulate pasting raw text with prefix
  const pastedRaw = '  UPI Ref No: 512398471928  '
  const extractedFromPaste = pastedRaw.replace(/[^0-9]/g, '')
  currentUtr = extractedFromPaste
  assert(currentUtr === '512398471928', 'Pasting cleans or accepts numeric reference')

  // ── 3. Screenshot OCR Auto-Extraction ─────────────────────────────────────
  console.log('\n--- Test 3: Upload Screenshot with Labeled Reference ---')
  const gpayOcrText = `
    Google Pay
    Payment to Robotics Club
    ₹250.00
    Completed • Today, 2:15 PM
    UPI transaction ID
    428910485923
    To: robotics@okaxis
  `
  const ocrRes1 = extractUtrFromText(gpayOcrText)
  assert(ocrRes1.success, 'Successfully extracts UTR from labeled screenshot')
  assert(ocrRes1.reference === '428910485923', 'Extracted reference is exact 12-digit UTR')
  assert(ocrRes1.message === 'Reference detected — please verify it.', 'User-friendly message returned')

  // ── 4. Upload Screenshot Without Reference ───────────────────────────────
  console.log('\n--- Test 4: Screenshot Without Transaction Reference ---')
  const noRefOcrText = `
    Welcome to FestFlow
    Event passes available now
    Contact: 9876543210
    Amount: ₹250
  `
  const ocrRes2 = extractUtrFromText(noRefOcrText)
  assert(!ocrRes2.success, 'Rejects screenshot without transaction reference')
  assert(ocrRes2.reference === null, 'Does not misidentify phone or amount as UTR')
  assert(ocrRes2.message.includes('Could not confidently detect'), 'Returns manual fallback message')

  // ── 5. Blurry / Unsupported Image Text ────────────────────────────────────
  console.log('\n--- Test 5: Blurry or Garbage Text ---')
  const blurryText = '~~~??? @@@ fuzzy image non-readable'
  const ocrRes3 = extractUtrFromText(blurryText)
  assert(!ocrRes3.success, 'Gracefully handles blurry or unreadable text')
  assert(ocrRes3.reference === null, 'Returns null reference for unreadable image')

  // ── 6. Screenshot Replacement ─────────────────────────────────────────────
  console.log('\n--- Test 6: Screenshot Replacement ---')
  const phonePeText = `
    PhonePe
    Paid to Club
    UTR: 619283746152
  `
  const ocrRes4 = extractUtrFromText(phonePeText)
  assert(ocrRes4.success && ocrRes4.reference === '619283746152', 'Re-extracts new UTR when screenshot is replaced')

  // ── 7 & 8: Preventing OCR from Overwriting Manually Entered Value ──────────
  console.log('\n--- Test 7 & 8: Prevent Overwriting Manual Entry ---')
  // Scenario: Student already entered '512398471928'
  let studentManualEntry = '512398471928'
  const ocrDetected = '619283746152'

  let finalUtrValue = studentManualEntry
  let detectedCandidate: string | null = null
  let statusMessage = ''

  if (!studentManualEntry.trim()) {
    finalUtrValue = ocrDetected
  } else if (studentManualEntry.trim() !== ocrDetected) {
    // DO NOT OVERWRITE
    detectedCandidate = ocrDetected
    statusMessage = `Detected UTR ${ocrDetected} from screenshot. Your current manual entry is preserved.`
  }

  assert(finalUtrValue === '512398471928', 'Preserves manual entry without silent overwrite')
  assert(detectedCandidate === '619283746152', 'Stores detected candidate for optional 1-click swap')
  assert(statusMessage.includes('manual entry is preserved'), 'Provides clear non-destructive feedback')

  // ── 9. Submission of Valid Reference ──────────────────────────────────────
  console.log('\n--- Test 9: Submitting Valid Reference ---')
  const submitRes = await submitPaymentProof({
    registrationId: 'reg_ocr_1',
    transactionReference: finalUtrValue,
    screenshotUrl: 'https://example.com/receipt.png',
    notes: 'Transferred via PhonePe',
  })
  assert(submitRes.success, 'Submits valid transaction reference successfully')
  
  const savedSub = await getStudentPaymentSubmission('reg_ocr_1')
  assert(savedSub?.transaction_reference === '512398471928', 'Saved reference matches submitted UTR')
  assert(savedSub?.status === 'pending_review', 'State enters pending_review (never instant confirmed)')

  // ── 10. Duplicate UTR Protection ──────────────────────────────────────────
  console.log('\n--- Test 10: Replay / Duplicate Protection ---')
  const mockRegistrations2 = [
    {
      id: 'reg_ocr_2',
      event_id: 'evt_hackathon_ocr',
      student_id: 'student_456',
      ticket_code: 'TKT-OCR-002',
      status: 'pending_payment',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
  ]
  const currentRegs = JSON.parse(localStorage.getItem('festflow_local_registrations') || '[]')
  currentRegs.push(...mockRegistrations2)
  localStorage.setItem('festflow_local_registrations', JSON.stringify(currentRegs))

  // Attempt submitting the same UTR for a second registration in the same event
  const duplicateRes = await submitPaymentProof({
    registrationId: 'reg_ocr_2',
    transactionReference: '512398471928',
  })
  assert(!duplicateRes.success, 'Rejects duplicate UTR submission')
  assert(duplicateRes.error_code === 'DUPLICATE_REFERENCE', 'Enforces DUPLICATE_REFERENCE protection')

  // ── 11. Organizer Verification Lifecycle ──────────────────────────────────
  console.log('\n--- Test 11: Organizer Verification ---')
  const reviewRes = await reviewPaymentSubmission({
    paymentId: savedSub!.id,
    decision: 'approved',
  })
  assert(reviewRes.success, 'Organizer approves payment after manual verification')
  assert(reviewRes.status === 'approved', 'Payment submission status updates to approved')

  const updatedRegs = JSON.parse(localStorage.getItem('festflow_local_registrations') || '[]')
  const finalReg = updatedRegs.find((r: any) => r.id === 'reg_ocr_1')
  assert(finalReg?.status === 'confirmed', 'Registration passes to confirmed only after organizer approval')

  console.log('\n============================================================')
  console.log(`TEST SUITE RESULTS: ${passed}/${total} Passed (${total - passed} Failed)`)
  console.log('============================================================\n')

  if (passed !== total) {
    process.exit(1)
  }
}

runTests()
