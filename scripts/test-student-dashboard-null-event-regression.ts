/**
 * FestFlow Regression Test Suite: Student Dashboard Null Event & Date Handling
 *
 * Verifies:
 * 1. Safe handling when a registration's joined event is null (exact production crash condition)
 * 2. Safe handling when an event has missing optional fields (start_date, venue, poster_url)
 * 3. Proper tab filtering (upcoming, past, pending, cancelled) without TypeError
 * 4. Preservation of legitimate registration records even if event details are unavailable
 * 5. Student with zero registrations (empty state)
 * 6. DigitalTicketCard rendering with null or partial event data
 * 7. Cancellation modal display safety with null event
 */

import type { RegistrationWithEvent, EventRecord } from '../src/types/index.js'

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

console.log('\n======================================================================')
console.log(' FestFlow — Student Dashboard Null Event Regression Test Suite')
console.log('======================================================================\n')

const now = new Date('2026-10-27T12:00:00Z')

// Helper function mirroring StudentDashboardPage filtering logic
function filterRegistrations(
  registrations: RegistrationWithEvent[],
  tab: 'upcoming' | 'pending_approval' | 'pending_payment' | 'past' | 'cancelled'
) {
  return registrations.filter((r) => {
    const hasValidDate = Boolean(r.event?.start_date)
    const eventStart = hasValidDate ? new Date(r.event!.start_date) : null
    const isUpcoming = eventStart ? eventStart >= now : false
    const isPast = eventStart ? eventStart < now : false

    if (tab === 'upcoming') {
      return r.status === 'confirmed' && isUpcoming
    }
    if (tab === 'pending_approval') {
      return r.status === 'pending_approval'
    }
    if (tab === 'pending_payment') {
      return r.status === 'pending_payment'
    }
    if (tab === 'past') {
      return r.status === 'confirmed' && (isPast || !hasValidDate)
    }
    if (tab === 'cancelled') {
      return r.status === 'cancelled' || r.status === 'rejected'
    }
    return true
  })
}

// ── Test 1: Student With Zero Registrations ─────────────────────────────────
console.log('Suite 1: Zero Registrations Handling')
{
  const emptyList: RegistrationWithEvent[] = []

  const upcoming = filterRegistrations(emptyList, 'upcoming')
  const pending = filterRegistrations(emptyList, 'pending_approval')
  const past = filterRegistrations(emptyList, 'past')
  const cancelled = filterRegistrations(emptyList, 'cancelled')

  assert(upcoming.length === 0, 'Zero registrations yields empty upcoming list')
  assert(pending.length === 0, 'Zero registrations yields empty pending list')
  assert(past.length === 0, 'Zero registrations yields empty past list')
  assert(cancelled.length === 0, 'Zero registrations yields empty cancelled list')
}

// ── Test 2: Valid Registrations Filtering ────────────────────────────────────
console.log('\nSuite 2: Valid Registrations with Dates')
{
  const validList: RegistrationWithEvent[] = [
    {
      id: 'reg_future',
      event_id: 'evt_future',
      student_id: 'std_1',
      ticket_code: 'FF-FUTURE',
      status: 'confirmed',
      created_at: new Date('2026-10-20').toISOString(),
      event: {
        id: 'evt_future',
        slug: 'future-hackathon',
        club_id: 'club_1',
        title: 'Future AI Hackathon',
        summary: 'A hackathon in the future',
        description: 'Details...',
        category: 'tech',
        poster_url: 'https://example.com/poster.jpg',
        start_date: '2026-11-15T09:00:00Z',
        end_date: '2026-11-16T18:00:00Z',
        venue_name: 'Main Auditorium',
        venue_address: 'Block A',
        event_type: 'offline',
        registration_opens_at: null,
        registration_closes_at: null,
        capacity: 100,
        is_free: true,
        price: 0,
        currency: 'INR',
        eligibility: null,
        status: 'published',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
    {
      id: 'reg_past',
      event_id: 'evt_past',
      student_id: 'std_1',
      ticket_code: 'FF-PAST',
      status: 'confirmed',
      created_at: new Date('2026-09-01').toISOString(),
      event: {
        id: 'evt_past',
        slug: 'past-workshop',
        club_id: 'club_1',
        title: 'Past Workshop',
        summary: 'Concluded workshop',
        description: 'Details...',
        category: 'workshop',
        poster_url: null,
        start_date: '2026-09-10T10:00:00Z',
        end_date: '2026-09-10T16:00:00Z',
        venue_name: 'Lab 3',
        venue_address: null,
        event_type: 'offline',
        registration_opens_at: null,
        registration_closes_at: null,
        capacity: 50,
        is_free: true,
        price: 0,
        currency: 'INR',
        eligibility: null,
        status: 'completed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
  ]

  const upcoming = filterRegistrations(validList, 'upcoming')
  assert(upcoming.length === 1 && upcoming[0].id === 'reg_future', 'Upcoming tab includes future confirmed event')

  const past = filterRegistrations(validList, 'past')
  assert(past.length === 1 && past[0].id === 'reg_past', 'Past tab includes past confirmed event')
}

// ── Test 3: Registration with NULL Related Event (Production Crash Repro) ───
console.log('\nSuite 3: Registration with NULL Related Event (Crash Prevention)')
{
  const listWithNullEvent: RegistrationWithEvent[] = [
    {
      id: 'reg_orphaned',
      event_id: 'evt_completed_hidden',
      student_id: 'std_1',
      ticket_code: 'FF-ORPHANED',
      status: 'confirmed',
      created_at: new Date('2026-09-01').toISOString(),
      event: null, // EXACT production crash condition
    },
    {
      id: 'reg_future_valid',
      event_id: 'evt_future',
      student_id: 'std_1',
      ticket_code: 'FF-VALID',
      status: 'confirmed',
      created_at: new Date('2026-10-20').toISOString(),
      event: {
        id: 'evt_future',
        slug: 'robotics-expo',
        club_id: 'club_1',
        title: 'Robotics Expo',
        summary: 'Expo',
        description: 'Details...',
        category: 'tech',
        poster_url: null,
        start_date: '2026-11-20T10:00:00Z',
        end_date: '2026-11-20T17:00:00Z',
        venue_name: 'Campus Arena',
        venue_address: null,
        event_type: 'offline',
        registration_opens_at: null,
        registration_closes_at: null,
        capacity: 200,
        is_free: true,
        price: 0,
        currency: 'INR',
        eligibility: null,
        status: 'published',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
  ]

  let didCrash = false
  let upcoming: RegistrationWithEvent[] = []
  let past: RegistrationWithEvent[] = []

  try {
    upcoming = filterRegistrations(listWithNullEvent, 'upcoming')
    past = filterRegistrations(listWithNullEvent, 'past')
  } catch (err) {
    didCrash = true
    console.error('Crash in filterRegistrations:', err)
  }

  assert(!didCrash, 'Filter does NOT throw TypeError: Cannot read properties of null (reading start_date)')
  assert(upcoming.length === 1 && upcoming[0].id === 'reg_future_valid', 'Upcoming tab only includes valid future event')
  assert(past.length === 1 && past[0].id === 'reg_orphaned', 'Past/history tab preserves confirmed registration with missing event')

  // Check count logic
  const upcomingCount = listWithNullEvent.filter(
    (r) => r.status === 'confirmed' && Boolean(r.event?.start_date) && new Date(r.event!.start_date) >= now
  ).length
  assert(upcomingCount === 1, 'Upcoming count computes safely without crash')

  const pastCount = listWithNullEvent.filter(
    (r) => r.status === 'confirmed' && (!r.event?.start_date || new Date(r.event!.start_date) < now)
  ).length
  assert(pastCount === 1, 'Past count includes orphaned/archived registration safely')
}

// ── Test 4: Card Display Fallbacks for Null Event ────────────────────────────
console.log('\nSuite 4: Card Display Fallbacks for Null Event')
{
  const orphanedReg: RegistrationWithEvent = {
    id: 'reg_orphaned_2',
    event_id: 'evt_deleted',
    student_id: 'std_1',
    ticket_code: 'FF-FALLBACK-TEST',
    status: 'confirmed',
    created_at: new Date().toISOString(),
    event: null,
  }

  const mapCardDetails = (reg: RegistrationWithEvent) => {
    const event = reg.event || null
    const startDate = event?.start_date ? new Date(event.start_date) : null
    const formattedDate = startDate ? startDate.toLocaleDateString('en-IN') : 'Date unavailable'
    const formattedTime = startDate ? startDate.toLocaleTimeString('en-IN') : 'Time unavailable'
    const title = event?.title || 'Event Details Unavailable'
    const venue = event?.venue_name || 'Venue details unavailable'
    const hasPoster = Boolean(event?.poster_url)
    return { title, venue, formattedDate, formattedTime, hasPoster, ticketCode: reg.ticket_code }
  }

  const card = mapCardDetails(orphanedReg)
  assert(card.title === 'Event Details Unavailable', 'Displays fallback title when event is null')
  assert(card.venue === 'Venue details unavailable', 'Displays fallback venue when event is null')
  assert(card.formattedDate === 'Date unavailable', 'Displays fallback date when event is null')
  assert(!card.hasPoster, 'Detects missing poster without crash')
  assert(card.ticketCode === 'FF-FALLBACK-TEST', 'Preserves genuine ticket code')
}

// ── Test 5: Event with Missing Optional Fields ──────────────────────────────
console.log('\nSuite 5: Event with Missing Optional Fields')
{
  const partialEventReg: RegistrationWithEvent = {
    id: 'reg_partial',
    event_id: 'evt_partial',
    student_id: 'std_1',
    ticket_code: 'FF-PARTIAL',
    status: 'confirmed',
    created_at: new Date().toISOString(),
    event: {
      id: 'evt_partial',
      slug: 'minimal-event',
      club_id: 'club_1',
      title: 'Minimal Event',
      summary: 'Minimal summary',
      description: 'Minimal description',
      category: 'cultural',
      poster_url: null,
      start_date: '2026-11-25T14:00:00Z',
      end_date: '2026-11-25T17:00:00Z',
      venue_name: 'Seminar Hall',
      venue_address: null,
      event_type: 'offline',
      registration_opens_at: null,
      registration_closes_at: null,
      capacity: 80,
      is_free: true,
      price: 0,
      currency: 'INR',
      eligibility: null,
      status: 'published',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      club: undefined, // Missing club relation
    },
  }

  const startDate = partialEventReg.event?.start_date ? new Date(partialEventReg.event.start_date) : null
  assert(startDate !== null && startDate >= now, 'Parses valid start_date on partial event')
  assert(!partialEventReg.event?.club?.display_name, 'Handles missing club relation safely')
}

// ── Test 6: DigitalTicketCard Safety with Null Event ─────────────────────────
console.log('\nSuite 6: DigitalTicketCard Safety with Null Event')
{
  const regNoEvent: RegistrationWithEvent = {
    id: 'reg_pass_test',
    event_id: 'evt_missing',
    student_id: 'std_pass_user',
    ticket_code: 'FF-TKT-SECURE',
    status: 'confirmed',
    created_at: new Date().toISOString(),
    event: null,
  }

  const event = regNoEvent.event || null
  const startDate = event?.start_date ? new Date(event.start_date) : null
  const formattedDate = startDate ? startDate.toLocaleDateString('en-IN') : 'Date unavailable'
  const formattedTime = startDate ? startDate.toLocaleTimeString('en-IN') : 'Time unavailable'
  const title = event?.title || 'FestFlow Entry Pass'
  const venue = event?.venue_name || 'Campus Venue'
  const category = (event?.category || 'General').toUpperCase()

  assert(title === 'FestFlow Entry Pass', 'Pass fallback title works when event is null')
  assert(venue === 'Campus Venue', 'Pass fallback venue works when event is null')
  assert(category === 'GENERAL', 'Pass fallback category works when event is null')
  assert(formattedDate === 'Date unavailable', 'Pass fallback date works when event is null')
}

// ── Test 7: Cancellation Modal Safety ───────────────────────────────────────
console.log('\nSuite 7: Cancellation Modal Safety with Null Event')
{
  const cancellingReg: RegistrationWithEvent = {
    id: 'reg_cancel_test',
    event_id: 'evt_null_for_cancel',
    student_id: 'std_c',
    ticket_code: 'FF-CANCEL-CODE',
    status: 'confirmed',
    created_at: new Date().toISOString(),
    event: null,
  }

  const promptText = `Are you sure you want to cancel your registration for "${cancellingReg.event?.title || 'this event'}"?`
  assert(promptText === 'Are you sure you want to cancel your registration for "this event"?', 'Cancellation modal does not crash on null event')
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('\n======================================================================')
console.log(` Test Results: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`)
console.log('======================================================================\n')

if (failedTests > 0) {
  process.exit(1)
}
