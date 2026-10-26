// Polyfill localStorage for testing in Node/tsx environment
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

import { registerForEvent, reviewRegistrationApplication, cancelRegistration } from '../src/lib/registrations'
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

console.log('\n============================================================')
console.log('FESTFLOW PHASE 3: STUDENT APPLICATIONS & REGISTRATION TESTS')
console.log('============================================================\n')

const LOCAL_STORAGE_EVENTS_KEY = 'festflow_managed_events'
const LOCAL_STORAGE_REGISTRATIONS_KEY = 'festflow_local_registrations'

const now = new Date()
const futureDate = new Date(now.getTime() + 86400000 * 7).toISOString()
const futureEndDate = new Date(now.getTime() + 86400000 * 8).toISOString()

// Pre-seed test events
const testEvents: EventRecord[] = [
  // 1. Free Individual Event, Auto-Approval
  {
    id: 'evt-test-free-auto',
    slug: 'free-workshop-2026',
    club_id: 'club-test-1',
    title: 'Free AI Workshop',
    summary: 'A free workshop on machine learning fundamentals',
    description: 'Detailed description of AI workshop.',
    category: 'workshop',
    poster_url: 'https://example.com/poster.jpg',
    start_date: futureDate,
    end_date: futureEndDate,
    registration_opens_at: null,
    registration_closes_at: null,
    venue_name: 'Seminar Hall B',
    venue_address: 'CS Dept, 2nd Floor',
    capacity: 50,
    is_free: true,
    price: 0,
    currency: 'INR',
    status: 'published',
    participation_type: 'individual',
    min_team_size: 1,
    max_team_size: 1,
    leader_counts_towards_size: true,
    team_registration_mode: 'leader_adds_members',
    require_team_name: false,
    approval_type: 'automatic',
    timezone: 'Asia/Kolkata',
    rules: 'Bring laptop',
    contact_email: 'ai@college.edu',
    contact_phone: '+91 9999999999',
    custom_questions: [],
    participant_fields: { require_college: true },
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  },
  // 2. Paid Individual Event, Auto-Approval
  {
    id: 'evt-test-paid-auto',
    slug: 'pro-concert-pass-2026',
    club_id: 'club-test-1',
    title: 'Annual Musical Concert',
    summary: 'Live concert pass',
    description: 'Detailed concert info.',
    category: 'music',
    poster_url: 'https://example.com/poster.jpg',
    start_date: futureDate,
    end_date: futureEndDate,
    registration_opens_at: null,
    registration_closes_at: null,
    venue_name: 'Open Air Amphitheatre',
    venue_address: 'Campus Grounds',
    capacity: 100,
    is_free: false,
    price: 250,
    currency: 'INR',
    status: 'published',
    participation_type: 'individual',
    min_team_size: 1,
    max_team_size: 1,
    leader_counts_towards_size: true,
    team_registration_mode: 'leader_adds_members',
    require_team_name: false,
    approval_type: 'automatic',
    timezone: 'Asia/Kolkata',
    rules: 'No outside food',
    contact_email: 'music@college.edu',
    contact_phone: '+91 9999999999',
    custom_questions: [],
    participant_fields: {},
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  },
  // 3. Free Event, Manual Approval Required
  {
    id: 'evt-test-free-manual',
    slug: 'scholars-symposium-2026',
    club_id: 'club-test-2',
    title: 'Scholars Symposium',
    summary: 'Competitive research symposium',
    description: 'Detailed symposium info.',
    category: 'seminar',
    poster_url: 'https://example.com/poster.jpg',
    start_date: futureDate,
    end_date: futureEndDate,
    registration_opens_at: null,
    registration_closes_at: null,
    venue_name: 'Conference Hall A',
    venue_address: 'Academic Block',
    capacity: 30,
    is_free: true,
    price: 0,
    currency: 'INR',
    status: 'published',
    participation_type: 'individual',
    min_team_size: 1,
    max_team_size: 1,
    leader_counts_towards_size: true,
    team_registration_mode: 'leader_adds_members',
    require_team_name: false,
    approval_type: 'manual',
    timezone: 'Asia/Kolkata',
    rules: 'Research abstract required',
    contact_email: 'symposium@college.edu',
    contact_phone: '+91 9999999999',
    custom_questions: [],
    participant_fields: {},
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  },
  // 4. Paid Team Event, Manual Approval Required
  {
    id: 'evt-test-team-paid-manual',
    slug: 'hackfest-championship-2026',
    club_id: 'club-test-2',
    title: 'Campus HackFest 2026',
    summary: '24-hour national hackathon',
    description: 'Hackathon description.',
    category: 'hackathon',
    poster_url: 'https://example.com/poster.jpg',
    start_date: futureDate,
    end_date: futureEndDate,
    registration_opens_at: null,
    registration_closes_at: null,
    venue_name: 'Tech Labs Complex',
    venue_address: 'Block C',
    capacity: 20,
    is_free: false,
    price: 500,
    currency: 'INR',
    status: 'published',
    participation_type: 'team',
    min_team_size: 2,
    max_team_size: 4,
    leader_counts_towards_size: true,
    team_registration_mode: 'leader_adds_members',
    require_team_name: true,
    approval_type: 'manual',
    timezone: 'Asia/Kolkata',
    rules: 'Code must be written on-site',
    contact_email: 'hack@college.edu',
    contact_phone: '+91 9999999999',
    custom_questions: [],
    participant_fields: {},
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  },
  // 5. Team Event without leader counted
  {
    id: 'evt-test-team-no-leader-count',
    slug: 'sports-relay-2026',
    club_id: 'club-test-3',
    title: 'Track Relay Challenge',
    summary: 'Relay race team',
    description: 'Relay challenge.',
    category: 'sports',
    poster_url: 'https://example.com/poster.jpg',
    start_date: futureDate,
    end_date: futureEndDate,
    registration_opens_at: null,
    registration_closes_at: null,
    venue_name: 'Athletics Ground',
    venue_address: 'Sports Pavilion',
    capacity: 10,
    is_free: true,
    price: 0,
    currency: 'INR',
    status: 'published',
    participation_type: 'team',
    min_team_size: 2,
    max_team_size: 3,
    leader_counts_towards_size: false, // Leader does not count towards size
    team_registration_mode: 'leader_adds_members',
    require_team_name: true,
    approval_type: 'automatic',
    timezone: 'Asia/Kolkata',
    rules: 'Sports gear required',
    contact_email: 'sports@college.edu',
    contact_phone: '+91 9999999999',
    custom_questions: [],
    participant_fields: {},
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  },
  // 6. Tight Capacity Event (capacity = 2)
  {
    id: 'evt-test-tight-capacity',
    slug: 'exclusive-masterclass-2026',
    club_id: 'club-test-1',
    title: 'Exclusive Robotics Masterclass',
    summary: 'Very limited seats masterclass',
    description: 'Robotics hands-on.',
    category: 'tech',
    poster_url: 'https://example.com/poster.jpg',
    start_date: futureDate,
    end_date: futureEndDate,
    registration_opens_at: null,
    registration_closes_at: null,
    venue_name: 'Robotics Lab 1',
    venue_address: 'Lab Block',
    capacity: 2,
    is_free: true,
    price: 0,
    currency: 'INR',
    status: 'published',
    participation_type: 'individual',
    min_team_size: 1,
    max_team_size: 1,
    leader_counts_towards_size: true,
    team_registration_mode: 'leader_adds_members',
    require_team_name: false,
    approval_type: 'automatic',
    timezone: 'Asia/Kolkata',
    rules: 'Strict attendance',
    contact_email: 'robo@college.edu',
    contact_phone: '+91 9999999999',
    custom_questions: [],
    participant_fields: {},
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  },
  // 7. Expired / Past Event
  {
    id: 'evt-test-past',
    slug: 'past-symposium-2025',
    club_id: 'club-test-1',
    title: 'Past Symposium',
    summary: 'Past event',
    description: 'Already completed.',
    category: 'seminar',
    poster_url: 'https://example.com/poster.jpg',
    start_date: new Date(now.getTime() - 86400000 * 2).toISOString(),
    end_date: new Date(now.getTime() - 86400000 * 1).toISOString(),
    registration_opens_at: null,
    registration_closes_at: null,
    venue_name: 'Hall C',
    venue_address: 'Campus',
    capacity: 50,
    is_free: true,
    price: 0,
    currency: 'INR',
    status: 'published',
    participation_type: 'individual',
    min_team_size: 1,
    max_team_size: 1,
    leader_counts_towards_size: true,
    team_registration_mode: 'leader_adds_members',
    require_team_name: false,
    approval_type: 'automatic',
    timezone: 'Asia/Kolkata',
    rules: '',
    contact_email: '',
    contact_phone: '',
    custom_questions: [],
    participant_fields: {},
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  },
]

async function runTests() {
  // Reset localStorage
  store.clear()
  mockLocalStorage.setItem(LOCAL_STORAGE_EVENTS_KEY, JSON.stringify(testEvents))
  mockLocalStorage.setItem(LOCAL_STORAGE_REGISTRATIONS_KEY, JSON.stringify([]))

  // -------------------------------------------------------------
  // TEST SUITE 1: Individual Applications
  // -------------------------------------------------------------
  console.log('--- Test Suite 1: Individual Applications ---')

  {
    const res = await registerForEvent('evt-test-free-auto', 'student_1')
    assert(res.success === true, 'Free event + auto approval: Registration succeeds')
    assert(res.status === 'confirmed', 'Free event + auto approval: Initial status is "confirmed"')
    assert(res.ticket_issued === true, 'Free event + auto approval: Ticket is immediately issued')
    assert(Boolean(res.ticket_code && res.ticket_code.startsWith('FF-')), 'Ticket code format is valid (FF-XXXXXXXX)')
  }

  {
    const res = await registerForEvent('evt-test-paid-auto', 'student_1')
    assert(res.success === true, 'Paid event + auto approval: Registration succeeds')
    assert(res.status === 'pending_payment', 'Paid event + auto approval: Initial status is "pending_payment"')
    assert(res.ticket_issued === false, 'Paid event: Ticket is NOT issued before payment verification')
  }

  {
    const res = await registerForEvent('evt-test-free-manual', 'student_1')
    assert(res.success === true, 'Free event + manual review: Registration succeeds')
    assert(res.status === 'pending_approval', 'Free event + manual review: Initial status is "pending_approval"')
    assert(res.approval_status === 'pending', 'Approval status is "pending"')
    assert(res.ticket_issued === false, 'Manual review: Ticket is NOT issued before host approval')
  }

  // -------------------------------------------------------------
  // TEST SUITE 2: Team Applications & Team Member Validation
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 2: Team Applications & Roster Rules ---')

  {
    // Missing team name when required
    const res = await registerForEvent('evt-test-team-paid-manual', 'student_lead_1', {
      teamName: '',
      teamMembers: [{ name: 'Member Two', email: 'two@college.edu' }],
    })
    assert(res.success === false, 'Fails when required team name is blank')
    assert(res.error_code === 'TEAM_NAME_REQUIRED', 'Error code is TEAM_NAME_REQUIRED')
  }

  {
    // Team too small (min 2, but leader counted and 0 members added -> total 1)
    const res = await registerForEvent('evt-test-team-paid-manual', 'student_lead_1', {
      teamName: 'Solo Wolf',
      teamMembers: [],
    })
    assert(res.success === false, 'Fails when team size is below min_team_size')
    assert(res.error_code === 'TEAM_TOO_SMALL', 'Error code is TEAM_TOO_SMALL')
  }

  {
    // Team too large (max 4, leader counted + 4 members = 5)
    const res = await registerForEvent('evt-test-team-paid-manual', 'student_lead_1', {
      teamName: 'Mega Squad',
      teamMembers: [
        { name: 'M1', email: 'm1@college.edu' },
        { name: 'M2', email: 'm2@college.edu' },
        { name: 'M3', email: 'm3@college.edu' },
        { name: 'M4', email: 'm4@college.edu' },
      ],
    })
    assert(res.success === false, 'Fails when team size exceeds max_team_size')
    assert(res.error_code === 'TEAM_TOO_LARGE', 'Error code is TEAM_TOO_LARGE')
  }

  {
    // Duplicate member email in team roster
    const res = await registerForEvent('evt-test-team-paid-manual', 'student_lead_1', {
      teamName: 'Dupe Squad',
      teamMembers: [
        { name: 'M1', email: 'clone@college.edu' },
        { name: 'M2', email: 'clone@college.edu' },
      ],
    })
    assert(res.success === false, 'Fails when duplicate email addresses exist in team roster')
    assert(res.error_code === 'DUPLICATE_TEAM_MEMBER', 'Error code is DUPLICATE_TEAM_MEMBER')
  }

  {
    // Leader does not count towards team size (min 2, max 3)
    // 1 member added -> total 1 < 2 -> fails
    const failRes = await registerForEvent('evt-test-team-no-leader-count', 'student_lead_2', {
      teamName: 'Relay Duo',
      teamMembers: [{ name: 'Runner 1', email: 'r1@college.edu' }],
    })
    assert(failRes.error_code === 'TEAM_TOO_SMALL', 'Correctly calculates team size when leader does NOT count towards size')

    // 2 members added -> total 2 -> passes!
    const passRes = await registerForEvent('evt-test-team-no-leader-count', 'student_lead_2', {
      teamName: 'Relay Duo',
      teamMembers: [
        { name: 'Runner 1', email: 'r1@college.edu' },
        { name: 'Runner 2', email: 'r2@college.edu' },
      ],
    })
    assert(passRes.success === true, 'Passes when non-leader team members satisfy min_team_size')
  }

  // -------------------------------------------------------------
  // TEST SUITE 3: Duplicate Registration Prevention
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 3: Duplicate Registration Prevention ---')

  {
    // Student 1 is already registered for evt-test-free-auto from Test Suite 1
    const res = await registerForEvent('evt-test-free-auto', 'student_1')
    assert(res.success === false, 'Duplicate application by same student is blocked')
    assert(res.error_code === 'ALREADY_REGISTERED', 'Error code is ALREADY_REGISTERED')
    assert(Boolean(res.ticket_code), 'Returns existing active ticket code to the user')
  }

  // -------------------------------------------------------------
  // TEST SUITE 4: Event Capacity Enforcement
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 4: Event Capacity Enforcement ---')

  {
    // evt-test-tight-capacity has capacity = 2
    const res1 = await registerForEvent('evt-test-tight-capacity', 'student_cap_1')
    assert(res1.success === true, 'Seat 1/2 claimed successfully')

    const res2 = await registerForEvent('evt-test-tight-capacity', 'student_cap_2')
    assert(res2.success === true, 'Seat 2/2 claimed successfully')

    const res3 = await registerForEvent('evt-test-tight-capacity', 'student_cap_3')
    assert(res3.success === false, 'Registration blocked when capacity is full')
    assert(res3.error_code === 'CAPACITY_REACHED', 'Error code is CAPACITY_REACHED')
  }

  // -------------------------------------------------------------
  // TEST SUITE 5: Lifecycle & Deadline Rules
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 5: Lifecycle & Deadline Rules ---')

  {
    const res = await registerForEvent('evt-test-past', 'student_late')
    assert(res.success === false, 'Registration blocked for past / already started event')
    assert(res.error_code === 'EVENT_ALREADY_STARTED', 'Error code is EVENT_ALREADY_STARTED')
  }

  // -------------------------------------------------------------
  // TEST SUITE 6: Organizer Application Review (Approve / Reject)
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 6: Organizer Application Review Workflow ---')

  let manualFreeRegId = ''
  let manualPaidRegId = ''

  {
    // Student registers for manual free event
    const regFree = await registerForEvent('evt-test-free-manual', 'student_applicant_free')
    manualFreeRegId = regFree.registration_id!
    assert(regFree.status === 'pending_approval', 'Application submitted with pending_approval')

    // Host approves free event application -> should become confirmed & issue ticket
    const reviewRes = await reviewRegistrationApplication(manualFreeRegId, 'approved')
    assert(reviewRes.success === true, 'Host approval action succeeds')
    assert(reviewRes.status === 'confirmed', 'Free event application transitions to "confirmed" upon host approval')
  }

  {
    // Student registers for manual paid event
    const regPaid = await registerForEvent('evt-test-team-paid-manual', 'student_applicant_paid', {
      teamName: 'Cyber Pioneers',
      teamMembers: [
        { name: 'Dev 1', email: 'dev1@college.edu' },
        { name: 'Dev 2', email: 'dev2@college.edu' },
      ],
    })
    manualPaidRegId = regPaid.registration_id!
    assert(regPaid.status === 'pending_approval', 'Paid team application submitted with pending_approval')

    // Host approves paid event application -> should become pending_payment (NOT confirmed until paid)
    const reviewRes = await reviewRegistrationApplication(manualPaidRegId, 'approved')
    assert(reviewRes.success === true, 'Host approval of paid application succeeds')
    assert(reviewRes.status === 'pending_payment', 'Paid event transitions to "pending_payment" (ticket remains locked)')
  }

  {
    // Host rejects an application with a reason
    const regToReject = await registerForEvent('evt-test-free-manual', 'student_to_reject')
    assert(regToReject.status === 'pending_approval', 'Application submitted for rejection test')

    const rejectRes = await reviewRegistrationApplication(
      regToReject.registration_id!,
      'rejected',
      'Team members do not meet college eligibility prerequisites.'
    )
    assert(rejectRes.success === true, 'Host rejection succeeds')
    assert(rejectRes.status === 'rejected', 'Application transitions to "rejected"')

    // Verify rejection reason persisted in database/storage
    const currentRegs = JSON.parse(mockLocalStorage.getItem(LOCAL_STORAGE_REGISTRATIONS_KEY)!)
    const found = currentRegs.find((r: any) => r.id === regToReject.registration_id)
    assert(
      found.rejection_reason === 'Team members do not meet college eligibility prerequisites.',
      'Rejection reason is recorded and accessible to the student'
    )
  }

  // -------------------------------------------------------------
  // TEST SUITE 7: Cancellation & Capacity Recovery Rules
  // -------------------------------------------------------------
  console.log('\n--- Test Suite 7: Cancellation & Capacity Recovery ---')

  {
    // Cancel the registration from student_cap_1 on evt-test-tight-capacity
    const currentRegs = JSON.parse(mockLocalStorage.getItem(LOCAL_STORAGE_REGISTRATIONS_KEY)!)
    const capReg = currentRegs.find((r: any) => r.event_id === 'evt-test-tight-capacity' && r.student_id === 'student_cap_1')

    const cancelRes = await cancelRegistration(capReg.id)
    assert(cancelRes.success === true, 'Active registration cancelled successfully')

    // Capacity should now have a free seat! student_cap_3 should be able to register now
    const retryRes = await registerForEvent('evt-test-tight-capacity', 'student_cap_3')
    assert(retryRes.success === true, 'Capacity seat is restored and can be claimed after pass cancellation')
  }

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n============================================================')
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`)
  console.log('============================================================\n')

  if (passedTests === totalTests) {
    console.log('🎉 ALL PHASE 3 APPLICATION & REGISTRATION TESTS PASSED!\n')
    process.exit(0)
  } else {
    console.error(`❌ ${totalTests - passedTests} TESTS FAILED\n`)
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('Fatal error running tests:', err)
  process.exit(1)
})
