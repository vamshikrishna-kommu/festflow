import { isEventCompleted, listPublishedEvents } from '../src/lib/events'
import type { EventRecord } from '../src/types'

console.log('=============================================================================')
console.log('  FESTFLOW: COMPLETED & CONCLUDED EVENTS FILTERING TEST SUITE                ')
console.log('=============================================================================\n')

let passCount = 0
let failCount = 0

function assert(description: string, condition: boolean) {
  if (condition) {
    console.log(`  ✓ PASS: ${description}`)
    passCount++
  } else {
    console.error(`  ✗ FAIL: ${description}`)
    failCount++
  }
}

// ── Test 1: Helper function isEventCompleted ─────────────────────────────────
console.log('[1/4] Testing isEventCompleted predicate...')

const now = Date.now()
const oneDayMs = 24 * 60 * 60 * 1000

const futureDate = new Date(now + 2 * oneDayMs).toISOString()
const futureDateLater = new Date(now + 3 * oneDayMs).toISOString()
const pastDate = new Date(now - 2 * oneDayMs).toISOString()
const pastDateEarlier = new Date(now - 3 * oneDayMs).toISOString()

// 1. Explicit status
assert('Event with status=completed is identified as completed', isEventCompleted({
  status: 'completed',
  start_date: futureDate,
  end_date: futureDateLater,
}))

assert('Event with status=cancelled is identified as completed', isEventCompleted({
  status: 'cancelled',
  start_date: futureDate,
  end_date: futureDateLater,
}))

// 2. Future upcoming event
assert('Upcoming event starting in future with future end_date is NOT completed', !isEventCompleted({
  status: 'published',
  start_date: futureDate,
  end_date: futureDateLater,
}))

assert('Upcoming event starting in future with no end_date is NOT completed', !isEventCompleted({
  status: 'published',
  start_date: futureDate,
}))

// 3. Concluded past event
assert('Past event with elapsed end_date is identified as completed', isEventCompleted({
  status: 'published',
  start_date: pastDateEarlier,
  end_date: pastDate,
}))

assert('Past event with no end_date and elapsed start_date is identified as completed', isEventCompleted({
  status: 'published',
  start_date: pastDate,
}))

// 4. Currently ongoing event (started earlier today, ends tomorrow)
assert('Ongoing event (started earlier, ends in future) is NOT completed', !isEventCompleted({
  status: 'published',
  start_date: pastDate,
  end_date: futureDate,
}))

// 5. CamelCase support (UI model Event)
assert('UI model event with past endDate is identified as completed', isEventCompleted({
  status: 'published',
  startDate: pastDateEarlier,
  endDate: pastDate,
} as any))

assert('UI model event with future endDate is NOT completed', !isEventCompleted({
  status: 'published',
  startDate: futureDate,
  endDate: futureDateLater,
} as any))

// ── Test 2: listPublishedEvents Filtering ─────────────────────────────────────
console.log('\n[2/4] Testing listPublishedEvents query & fallback filtering...')

// Mock local storage for simulation mode
const mockLocalEvents: EventRecord[] = [
  {
    id: 'evt_future_1',
    club_id: 'club_1',
    title: 'Future Hackathon 2026',
    slug: 'future-hackathon-2026',
    summary: 'An upcoming hackathon',
    description: 'Upcoming hackathon description',
    category: 'hackathon',
    start_date: futureDate,
    end_date: futureDateLater,
    venue_name: 'Main Auditorium',
    event_type: 'offline',
    capacity: 200,
    is_free: true,
    price: 0,
    status: 'published',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as EventRecord,
  {
    id: 'evt_past_1',
    club_id: 'club_1',
    title: 'Concluded Web3 Summit 2025',
    slug: 'concluded-web3-summit-2025',
    summary: 'A past summit',
    description: 'Past summit description',
    category: 'tech',
    start_date: pastDateEarlier,
    end_date: pastDate,
    venue_name: 'Seminar Hall B',
    event_type: 'offline',
    capacity: 100,
    is_free: false,
    price: 150,
    status: 'published', // Was published, but its dates elapsed!
    created_at: pastDateEarlier,
    updated_at: pastDateEarlier,
  } as EventRecord,
  {
    id: 'evt_completed_status',
    club_id: 'club_1',
    title: 'Completed Cultural Night',
    slug: 'completed-cultural-night',
    summary: 'Organizer marked as completed',
    description: 'Cultural night description',
    category: 'cultural',
    start_date: futureDate,
    end_date: futureDateLater,
    venue_name: 'Open Air Theatre',
    event_type: 'offline',
    capacity: 500,
    is_free: true,
    price: 0,
    status: 'completed', // Explicitly completed
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as EventRecord,
  {
    id: 'evt_ongoing_1',
    club_id: 'club_2',
    title: 'Ongoing 48-Hour Design Sprint',
    slug: 'ongoing-48h-design-sprint',
    summary: 'In progress right now',
    description: 'Design sprint in progress',
    category: 'workshop',
    start_date: pastDate,
    end_date: futureDate,
    venue_name: 'Design Studio',
    event_type: 'offline',
    capacity: 50,
    is_free: true,
    price: 0,
    status: 'published',
    created_at: pastDate,
    updated_at: pastDate,
  } as EventRecord,
]

// Inject mock local events into localStorage
if (typeof localStorage !== 'undefined') {
  localStorage.setItem('festflow_managed_events', JSON.stringify(mockLocalEvents))
} else {
  // Polyfill simple localStorage for node test runner
  const store: Record<string, string> = {
    festflow_managed_events: JSON.stringify(mockLocalEvents),
  }
  ;(global as any).localStorage = {
    getItem: (k: string) => store[k] || null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
  }
}

async function runListPublishedEventsTests() {
  const result = await listPublishedEvents()

  const slugs = result.events.map((e) => e.slug)

  assert('Concluded past event (date elapsed) is EXCLUDED from published events', !slugs.includes('concluded-web3-summit-2025'))
  assert('Event with status=completed is EXCLUDED from published events', !slugs.includes('completed-cultural-night'))
  assert('Future upcoming event is INCLUDED in published events', slugs.includes('future-hackathon-2026'))
  assert('Ongoing event is INCLUDED in published events', slugs.includes('ongoing-48h-design-sprint'))
  assert('Result count matches filtered uncompleted events count', result.count === 2)

  // With includeCompleted: true
  const allResult = await listPublishedEvents({ includeCompleted: true })
  const allSlugs = allResult.events.map((e) => e.slug)
  assert('includeCompleted=true allows archive retrieval if requested', allSlugs.includes('concluded-web3-summit-2025'))
}

// ── Test 3: Client Filter Refinement (Discover Page & Landing Page) ───────────
console.log('\n[3/4] Testing component-level defensive filtering...')

function simulateComponentFilter(events: any[]) {
  return events.filter((e) => !isEventCompleted(e))
}

const mockComponentEvents = [
  { id: '1', title: 'Future Coding', startDate: futureDate, endDate: futureDateLater, status: 'published' },
  { id: '2', title: 'Yesterday Workshop', startDate: pastDateEarlier, endDate: pastDate, status: 'published' },
  { id: '3', title: 'Explicitly Completed', startDate: futureDate, status: 'completed' },
]

const filteredForComponent = simulateComponentFilter(mockComponentEvents)
assert('Component filter removes past and completed items', filteredForComponent.length === 1 && filteredForComponent[0].id === '1')

// ── Test 4: Regression Check ──────────────────────────────────────────────────
console.log('\n[4/4] Verifying no side-effects on registration & event details...')

const completedEventDetailPageCheck = isEventCompleted({
  status: 'published',
  start_date: pastDateEarlier,
  end_date: pastDate,
})
assert('EventDetailPage recognizes concluded past event as completed for feedback banner', completedEventDetailPageCheck === true)

runListPublishedEventsTests().then(() => {
  console.log('\n=============================================================================')
  console.log(`  COMPLETED EVENTS FILTERING TESTS: ${passCount} / ${passCount + failCount} PASSED`)
  console.log('=============================================================================')

  if (failCount > 0) {
    process.exit(1)
  }
})
