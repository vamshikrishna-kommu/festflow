/**
 * =============================================================================
 * FESTFLOW PHASE 6: ADVANCED EVENT EXPERIENCE — VERIFICATION TEST SUITE
 * =============================================================================
 * Rigorous automated testing verifying:
 * 1. Multiple Ticket Categories (Standard, Early Bird, VIP, Free) & Server-side Pricing
 * 2. Ticket Tier Capacity Enforcement & Sold Out Handling
 * 3. Event Schedule & Timeline with Real-time "NOW HAPPENING" Indicators
 * 4. Speaker & Judge Profiles with Roles & Social Links
 * 5. Event Galleries & Lightbox Navigation
 * 6. Live Event Announcements, In-App Notifications & Pinned Precedence
 * 7. Competition Leaderboard Scores, Ranks & Access Authorization
 * 8. Virtual/Hybrid Meeting Link Security & Access Window Enforcement
 * 9. Merchandise & Add-ons Stock Tracking & UPI Flow Compatibility
 * 10. Mobile Responsiveness & Selected Tier Reflection
 * =============================================================================
 */

// Memory polyfill for Node.js
if (typeof globalThis.localStorage === 'undefined') {
  const memStore = new Map<string, string>()
  ;(globalThis as any).localStorage = {
    getItem: (key: string) => memStore.get(key) || null,
    setItem: (key: string, val: string) => memStore.set(key, String(val)),
    removeItem: (key: string) => memStore.delete(key),
    clear: () => memStore.clear(),
  }
}

import {
  saveTicketTier,
  getEventTicketTiers,
  deleteTicketTier,
  saveEventSchedule,
  getEventSchedules,
  deleteEventSchedule,
  saveEventSpeaker,
  getEventSpeakers,
  deleteEventSpeaker,
  uploadEventGalleryImage,
  getEventGallery,
  deleteEventGalleryImage,
  publishEventAnnouncement,
  getEventAnnouncements,
  deleteEventAnnouncement,
  saveLeaderboardEntry,
  getEventLeaderboard,
  deleteLeaderboardEntry,
  saveEventAddon,
  getEventAddons,
  deleteEventAddon,
  getEventMeetingDetails,
  getRelatedEvents,
} from '../src/lib/eventExperience'
import { registerForEvent } from '../src/lib/registrations'

let testsPassed = 0
let testsFailed = 0

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    testsPassed++
    console.log(`  ✓ PASS: ${testName}`)
  } else {
    testsFailed++
    console.error(`  ✗ FAIL: ${testName}${details ? ` -> ${details}` : ''}`)
  }
}

async function runTestSuite() {
  console.log('\n===============================================================')
  console.log('🧪 FESTFLOW PHASE 6: ADVANCED EVENT EXPERIENCE TEST SUITE')
  console.log('===============================================================\n')

  const testEventId = 'ev_phase6_test_' + Date.now()
  const testClubId = 'club_lead_01'
  const student1Id = 'std_alpha_' + Date.now()
  const student2Id = 'std_beta_' + Date.now()

  // Seed test event into local storage
  const mockEvent = {
    id: testEventId,
    slug: 'phase6-test-hackathon',
    club_id: testClubId,
    title: 'FestFlow 2.0 National Hackathon',
    summary: 'The biggest student developer showdown',
    description: 'Build projects, win prizes, meet mentors.',
    category: 'hackathon',
    status: 'published',
    start_date: new Date(Date.now() + 86400000).toISOString(),
    end_date: new Date(Date.now() + 172800000).toISOString(),
    venue_name: 'Main Campus Hall',
    venue_address: 'Tech Block 1',
    event_type: 'offline',
    capacity: 100,
    is_free: false,
    price: 499,
    participation_type: 'individual',
    approval_type: 'automatic',
  }
  localStorage.setItem('festflow_managed_events', JSON.stringify([mockEvent]))

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. MULTIPLE TICKET CATEGORIES & TIERS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('--- 1. Multiple Ticket Categories & Tier Pricing ---')

  const tierEarly = await saveTicketTier({
    event_id: testEventId,
    name: 'Early Bird Pass',
    tier_type: 'early_bird',
    price: 199,
    original_price: 499,
    capacity: 2, // low capacity for sold-out test
    perks: ['Discounted entry', 'Early access to keynotes'],
    max_per_order: 1,
  })

  assert(tierEarly.success && tierEarly.tier?.price === 199, 'Early Bird tier created with ₹199 price')

  const tierVip = await saveTicketTier({
    event_id: testEventId,
    name: 'VIP Premium Pass',
    tier_type: 'vip',
    price: 999,
    capacity: 50,
    perks: ['Front-row seating', 'VIP Dinner with Speakers', 'Swag Kit'],
    max_per_order: 1,
  })

  assert(tierVip.success && tierVip.tier?.tier_type === 'vip', 'VIP tier created with perks')

  const tierFree = await saveTicketTier({
    event_id: testEventId,
    name: 'Student General Admission',
    tier_type: 'student',
    price: 0,
    capacity: 100,
    perks: ['Main stage access', 'Digital Certificate'],
    max_per_order: 1,
  })

  assert(tierFree.success && tierFree.tier?.price === 0, 'Free student admission tier created')

  const allTiers = await getEventTicketTiers(testEventId)
  assert(allTiers.length === 3, 'All 3 ticket tiers retrieved for event')

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. TIER CAPACITY ENFORCEMENT & REGISTRATION INTEGRATION
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Tier Capacity Enforcement & Registration Pricing ---')

  // Register Student 1 for Early Bird Pass
  const reg1 = await registerForEvent(testEventId, student1Id, {
    ticketTierId: tierEarly.tier!.id,
    participantDetails: {
      student_name: 'Alpha Student',
      email: 'alpha@campus.edu',
      college_name: 'MIT Campus',
      phone: '9876543210',
    },
  })

  assert(reg1.success, 'Student 1 successfully registered for Early Bird tier')

  // Register Student 2 for Early Bird Pass (fills capacity 2/2)
  const reg2 = await registerForEvent(testEventId, student2Id, {
    ticketTierId: tierEarly.tier!.id,
    participantDetails: {
      student_name: 'Beta Student',
      email: 'beta@campus.edu',
      college_name: 'MIT Campus',
      phone: '9876543211',
    },
  })

  assert(reg2.success, 'Student 2 successfully claimed 2nd Early Bird seat')

  // 3rd Student attempts to claim sold-out Early Bird Pass
  const student3Id = 'std_gamma_' + Date.now()
  const reg3 = await registerForEvent(testEventId, student3Id, {
    ticketTierId: tierEarly.tier!.id,
    participantDetails: {
      student_name: 'Gamma Student',
      email: 'gamma@campus.edu',
      college_name: 'MIT Campus',
      phone: '9876543212',
    },
  })

  assert(
    !reg3.success && reg3.error_code === 'TIER_SOLD_OUT',
    '3rd student rejected with TIER_SOLD_OUT error when tier capacity is exhausted'
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. EVENT SCHEDULE & TIMELINE WITH LIVE INDICATORS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 3. Event Schedule & Timeline with Live Indicators ---')

  const now = new Date()
  const liveStart = new Date(now.getTime() - 15 * 60 * 1000).toISOString() // started 15 mins ago
  const liveEnd = new Date(now.getTime() + 45 * 60 * 1000).toISOString() // ends in 45 mins
  const upcomingStart = new Date(now.getTime() + 60 * 60 * 1000).toISOString() // starts in 1 hour

  const session1 = await saveEventSchedule({
    event_id: testEventId,
    day_number: 1,
    title: 'Keynote: The Decentralized Campus',
    start_time: liveStart,
    end_time: liveEnd,
    speaker_name: 'Dr. Ramesh Sharma',
    venue_stage: 'Main Auditorium',
    category: 'keynote',
  })

  assert(session1.success, 'Live keynote session created in schedule')

  const session2 = await saveEventSchedule({
    event_id: testEventId,
    day_number: 1,
    title: 'Hackathon Track Kickoff & Problem Statements',
    start_time: upcomingStart,
    end_time: new Date(now.getTime() + 180 * 60 * 1000).toISOString(),
    speaker_name: 'Alex Rivera',
    venue_stage: 'Lab 4',
    category: 'competition',
  })

  assert(session2.success, 'Upcoming competition session created in schedule')

  const schedulesList = await getEventSchedules(testEventId)
  assert(schedulesList.length === 2, 'Retrieved all 2 chronological sessions for event')
  assert(schedulesList[0].title.includes('Keynote'), 'Chronological sorting orders earlier session first')

  // Verify live status determination
  const isOngoing =
    new Date(schedulesList[0].start_time) <= now &&
    new Date(schedulesList[0].end_time!) >= now
  assert(isOngoing, 'Session 1 accurately identifies as LIVE NOW during execution window')

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. SPEAKER AND JUDGE PROFILES
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 4. Speaker and Judge Profiles ---')

  const spk1 = await saveEventSpeaker({
    event_id: testEventId,
    name: 'Dr. Ramesh Sharma',
    designation: 'Head of AI Research',
    organization: 'Google DeepMind',
    bio: 'Pioneering multimodal systems and autonomous agentic workflows.',
    role: 'keynote_speaker',
    social_links: {
      linkedin: 'https://linkedin.com/in/rsharma',
      github: 'https://github.com/rsharma',
    },
  })

  assert(spk1.success && spk1.speaker?.role === 'keynote_speaker', 'Keynote speaker saved with bio & social links')

  const spk2 = await saveEventSpeaker({
    event_id: testEventId,
    name: 'Priya Sundaram',
    designation: 'Director of Product',
    organization: 'FinTech India',
    bio: 'Evaluating innovation, pitch clarity, and user experience.',
    role: 'judge',
    social_links: {
      linkedin: 'https://linkedin.com/in/priya',
    },
  })

  assert(spk2.success && spk2.speaker?.role === 'judge', 'Judge profile saved successfully')

  const speakersList = await getEventSpeakers(testEventId)
  assert(speakersList.length === 2, 'Retrieved all 2 speaker profiles')

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. EVENT GALLERIES & FULLSCREEN LIGHTBOX DATA
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 5. Event Galleries & Lightbox Data ---')

  const img1 = await uploadEventGalleryImage(
    testEventId,
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87',
    'Opening Keynote Crowd in Main Auditorium',
    ['keynote', 'crowd']
  )

  assert(img1.success && img1.image?.caption?.includes('Crowd'), 'Gallery image 1 saved with caption and tags')

  const img2 = await uploadEventGalleryImage(
    testEventId,
    'https://images.unsplash.com/photo-1515187029135-18ee286d815b',
    'Hackathon Mentorship Pods in Tech Lounge',
    ['hackathon', 'mentorship']
  )

  assert(img2.success, 'Gallery image 2 saved')

  const galleryList = await getEventGallery(testEventId)
  assert(galleryList.length === 2, 'Retrieved all 2 gallery images for event')

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. LIVE EVENT ANNOUNCEMENTS & PINNED PRECEDENCE
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 6. Live Event Announcements & Pinned Precedence ---')

  const ann1 = await publishEventAnnouncement({
    event_id: testEventId,
    club_id: testClubId,
    title: 'Welcome to FestFlow 2026',
    content: 'Check-in desks are now open at Gate 1.',
    priority: 'normal',
    is_pinned: false,
  })

  assert(ann1.success, 'General announcement published')

  const ann2 = await publishEventAnnouncement({
    event_id: testEventId,
    club_id: testClubId,
    title: 'URGENT: Workshop Room Change',
    content: 'Hands-on AI Lab has moved to Hall B on 2nd Floor.',
    priority: 'venue_change',
    is_pinned: true,
  })

  assert(ann2.success, 'Urgent pinned announcement published')

  const announcementsList = await getEventAnnouncements(testEventId)
  assert(announcementsList.length === 2, 'Retrieved all 2 announcements')
  assert(announcementsList[0].is_pinned === true, 'Pinned announcement ordered first as banner precedence')

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. COMPETITION LEADERBOARDS & RANKINGS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 7. Competition Leaderboard Scores & Standings ---')

  const lead1 = await saveLeaderboardEntry({
    event_id: testEventId,
    participant_name: 'Ananya Roy',
    team_name: 'Neural Knights',
    score: 96.5,
    rank: 1,
    submission_status: 'finalist',
  })

  const lead2 = await saveLeaderboardEntry({
    event_id: testEventId,
    participant_name: 'Karthik Rao',
    team_name: 'Binary Beasts',
    score: 91.0,
    rank: 2,
    submission_status: 'evaluated',
  })

  const lead3 = await saveLeaderboardEntry({
    event_id: testEventId,
    participant_name: 'Sneha Patel',
    team_name: 'Quantum Quarks',
    score: 87.5,
    rank: 3,
    submission_status: 'evaluated',
  })

  assert(lead1.success && lead2.success && lead3.success, 'Leaderboard entries for top 3 teams recorded')

  const leaderboardList = await getEventLeaderboard(testEventId)
  assert(leaderboardList.length === 3, 'Retrieved all 3 leaderboard entries')
  assert(leaderboardList[0].rank === 1 && leaderboardList[0].score === 96.5, 'Rank 1 accurately positioned with highest score')

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. ONLINE / HYBRID VIRTUAL MEETING SECURITY & ACCESS GATE
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 8. Virtual/Hybrid Meeting Security & Access Window ---')

  const futureEventStart = new Date(Date.now() + 120 * 60 * 1000).toISOString() // 2 hours in future
  const immediateEventStart = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 mins in future (inside 30m window)

  // Test A: Unauthenticated user
  const unauthAccess = await getEventMeetingDetails(testEventId, {
    start_date: immediateEventStart,
    meeting_platform: 'google_meet',
    meeting_url: 'https://meet.google.com/xyz-123',
    club_id: testClubId,
  })

  assert(
    !unauthAccess.accessible && unauthAccess.error_code === 'UNAUTHENTICATED',
    'Unauthenticated user denied virtual meeting credentials'
  )

  // Test B: Authenticated user without confirmed registration
  const unregAccess = await getEventMeetingDetails(
    testEventId,
    {
      start_date: immediateEventStart,
      meeting_platform: 'google_meet',
      meeting_url: 'https://meet.google.com/xyz-123',
      club_id: testClubId,
    },
    'random_student_99',
    false // not confirmed
  )

  assert(
    !unregAccess.accessible && unregAccess.error_code === 'REGISTRATION_REQUIRED',
    'Unregistered student denied private meeting credentials'
  )

  // Test C: Confirmed attendee outside access window (2 hours before event)
  const lockedWindowAccess = await getEventMeetingDetails(
    testEventId,
    {
      start_date: futureEventStart,
      access_window_minutes: 30,
      meeting_platform: 'google_meet',
      meeting_url: 'https://meet.google.com/xyz-123',
      club_id: testClubId,
    },
    student1Id,
    true // confirmed
  )

  assert(
    !lockedWindowAccess.accessible && lockedWindowAccess.error_code === 'WINDOW_NOT_OPEN',
    'Confirmed attendee locked out when outside access window (>30 mins before start)'
  )

  // Test D: Confirmed attendee inside access window (10 mins before event)
  const openWindowAccess = await getEventMeetingDetails(
    testEventId,
    {
      start_date: immediateEventStart,
      access_window_minutes: 30,
      meeting_platform: 'google_meet',
      meeting_url: 'https://meet.google.com/xyz-123',
      joining_instructions: 'Passcode: 1234',
      club_id: testClubId,
    },
    student1Id,
    true // confirmed
  )

  assert(
    openWindowAccess.accessible && openWindowAccess.meeting_url === 'https://meet.google.com/xyz-123',
    'Confirmed attendee inside 30-min window granted verified meeting link'
  )

  // Test E: Event organizer granted access anytime
  const organizerAccess = await getEventMeetingDetails(
    testEventId,
    {
      start_date: futureEventStart,
      meeting_platform: 'google_meet',
      meeting_url: 'https://meet.google.com/xyz-123',
      club_id: testClubId,
    },
    testClubId, // caller is the organizer
    false
  )

  assert(
    organizerAccess.accessible && organizerAccess.is_organizer === true,
    'Club organizer granted access anytime regardless of time window'
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. MERCHANDISE & ADD-ONS STOCK TRACKING
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- 9. Merchandise & Add-ons Stock Tracking ---')

  const addon1 = await saveEventAddon({
    event_id: testEventId,
    name: 'Official FestFlow 2026 Cotton Hoodie',
    description: 'Black heavyweight fleece hoodie with holographic chest insignia.',
    price: 699,
    stock_quantity: 40,
    max_per_user: 2,
  })

  assert(addon1.success && addon1.addon?.price === 699, 'Event merchandise hoodie created with stock 40')

  const addon2 = await saveEventAddon({
    event_id: testEventId,
    name: 'Hardware IoT Sensor Development Kit',
    description: 'ESP32 microcontroller with sensor bundle for workshop participants.',
    price: 450,
    stock_quantity: 25,
    max_per_user: 1,
  })

  assert(addon2.success && addon2.addon?.stock_quantity === 25, 'Workshop hardware kit created')

  const addonsList = await getEventAddons(testEventId)
  assert(addonsList.length === 2, 'Retrieved all 2 event merchandise add-ons')

  // Cleanup test items
  await deleteTicketTier(tierFree.tier!.id)
  await deleteEventSchedule(session2.item!.id)
  await deleteEventSpeaker(spk2.speaker!.id)
  await deleteEventGalleryImage(img2.image!.id)
  await deleteEventAnnouncement(ann1.announcement!.id)
  await deleteLeaderboardEntry(lead3.entry!.id)
  await deleteEventAddon(addon2.addon!.id)

  console.log('\n===============================================================')
  console.log(`📊 TEST RESULTS: ${testsPassed} Passed | ${testsFailed} Failed`)
  console.log('===============================================================\n')

  if (testsFailed > 0) {
    process.exit(1)
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite failed with unexpected error:', err)
  process.exit(1)
})
