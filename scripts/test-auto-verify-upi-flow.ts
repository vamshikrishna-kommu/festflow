import { autoVerifyAndIssuePass } from '../src/lib/payments'
import { registerForEvent, getRegistrationById } from '../src/lib/registrations'
import { checkInTicket } from '../src/lib/checkin'

// Mock browser localStorage for Node/tsx testing environment
class MockLocalStorage {
  private store: Record<string, string> = {}
  getItem(key: string) {
    return this.store[key] || null
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value)
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

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`)
    throw new Error(msg)
  }
  console.log(`  ✓ PASS: ${msg}`)
}

async function runTestSuite() {
  console.log('\n============================================================')
  console.log('FESTFLOW: UPI APP AUTO-VERIFICATION & NO-UTR/SCREENSHOT TEST')
  console.log('============================================================\n')

  // Setup local mock events in localStorage
  const mockEvents = [
    {
      id: 'evt_autoverify_test',
      title: 'RoboWars 2026',
      club_id: 'club_tech',
      status: 'published',
      approval_type: 'automatic',
      is_free: false,
      price: 250,
      currency: 'INR',
      capacity: 50,
      start_date: new Date(Date.now() + 86400000).toISOString(),
      end_date: new Date(Date.now() + 172800000).toISOString(),
      venue_name: 'Main Arena',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]
  localStorage.setItem('festflow_managed_events', JSON.stringify(mockEvents))

  // 1. Student registers for a paid event
  console.log('--- 1. Student Registration for Paid Event ---')
  const regRes = await registerForEvent('evt_autoverify_test', 'student_mohan_yadav', {
    participantDetails: {
      student_name: 'Mohan Yadav',
      email: 'mohan.yadav@campus.edu',
    },
  })
  assert(regRes.success === true, 'Student registration created successfully')
  assert(regRes.status === 'pending_payment', 'Initial registration status is pending_payment')
  assert(regRes.ticket_issued === false, 'Pass is locked before payment')

  const regId = regRes.registration_id!

  // 2. Student is unable to enter UTR and unable to submit screenshot
  console.log('\n--- 2. Auto-Verify Payment Without Manual UTR or Screenshot ---')
  const autoVerifyRes = await autoVerifyAndIssuePass({
    registrationId: regId,
    transactionReference: null, // Student has no UTR!
    screenshotUrl: null,        // Student has no screenshot!
    notes: 'Paid via PhonePe App',
  })

  assert(autoVerifyRes.success === true, 'Auto-verification succeeds without manual UTR or screenshot')
  assert(Boolean(autoVerifyRes.ticket_code && autoVerifyRes.ticket_code.startsWith('FF-')), 'Ticket code auto-generated')
  assert(Boolean(autoVerifyRes.qr_token && autoVerifyRes.qr_token.startsWith('FFQ_')), 'Cryptographic QR token auto-generated')

  // 3. Verify Registration Status is atomically Confirmed without club approval
  console.log('\n--- 3. Registration Record Verification ---')
  const fetched = await getRegistrationById(regId)
  assert(Boolean(fetched.registration), 'Registration record retrieved')
  assert(fetched.registration?.status === 'confirmed', 'Registration status is immediately "confirmed" without club approval')
  assert(Boolean(fetched.registration?.ticket_issued_at), 'ticket_issued_at timestamp recorded')
  assert(fetched.registration?.ticket_code === autoVerifyRes.ticket_code, 'Issued ticket code matches registration')

  // 4. Verify Gate Turnstile Scanner Admission
  console.log('\n--- 4. Turnstile Gate Check-In Validation ---')
  const qrUri = `festflow://pass/${fetched.registration?.qr_token}`
  const checkinRes = await checkInTicket('evt_autoverify_test', qrUri)
  assert(checkinRes.success === true, 'Gate turnstile grants admission with auto-verified pass')
  assert(checkinRes.outcome === 'VALID', 'Gate check-in outcome is VALID')
  assert(checkinRes.student_name === 'Mohan Yadav', 'Attendee name resolved accurately at gate')

  // 5. Verify Duplicate Turnstile Scan Prevention
  console.log('\n--- 5. Turnstile Replay Protection ---')
  const duplicateCheckin = await checkInTicket('evt_autoverify_test', qrUri)
  assert(duplicateCheckin.success === false, 'Duplicate turnstile scan rejected')
  assert(duplicateCheckin.outcome === 'ALREADY_USED', 'Outcome is ALREADY_USED')

  console.log('\n============================================================')
  console.log('RESULTS: ALL 11 TESTS PASSED! AUTO-VERIFY WORKFLOW VERIFIED.')
  console.log('============================================================\n')
}

runTestSuite().catch((err) => {
  console.error('Test failed with error:', err)
  process.exit(1)
})
