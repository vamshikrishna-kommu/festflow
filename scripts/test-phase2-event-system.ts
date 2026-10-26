import { validateEventConfig } from '../src/lib/events'
import type { EventInsert } from '../src/types'

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
console.log('FESTFLOW PHASE 2: PROFESSIONAL EVENT CREATION SYSTEM TESTS')
console.log('============================================================\n')

// Base valid event template
const validBaseEvent: Omit<EventInsert, 'id' | 'created_at' | 'updated_at'> = {
  club_id: 'club_test_123',
  title: 'Annual Tech Hackathon 2026',
  slug: 'annual-tech-hackathon-2026',
  summary: 'Compete in a 24-hour campus hackathon',
  description: 'Full description of the tech hackathon with details, tracks, and prizes.',
  category: 'hackathon',
  event_type: 'offline',
  poster_url: 'https://example.com/poster.jpg',
  start_date: new Date(Date.now() + 86400000 * 7).toISOString(),
  end_date: new Date(Date.now() + 86400000 * 8).toISOString(),
  registration_opens_at: new Date(Date.now() - 86400000).toISOString(),
  registration_closes_at: new Date(Date.now() + 86400000 * 6).toISOString(),
  venue_name: 'Main Auditorium',
  venue_address: 'Engineering Campus Block A',
  capacity: 200,
  is_free: true,
  price: 0,
  currency: 'INR',
  status: 'draft',
  participation_type: 'individual',
  min_team_size: 1,
  max_team_size: 1,
  leader_counts_towards_size: true,
  team_registration_mode: 'leader_adds_members',
  require_team_name: false,
  approval_type: 'automatic',
  timezone: 'Asia/Kolkata',
  rules: '1. Maintain code integrity. 2. College ID required.',
  contact_email: 'fest@campus.edu',
  contact_phone: '+91 9876543210',
  custom_questions: [
    {
      id: 'q1',
      label: 'GitHub Profile or Portfolio Link',
      type: 'text',
      required: true,
      placeholder: 'https://github.com/...',
    },
    {
      id: 'q2',
      label: 'Dietary Preference',
      type: 'select',
      required: false,
      options: ['Vegetarian', 'Non-Vegetarian', 'Jain', 'Vegan'],
    },
  ],
  participant_fields: {
    require_college: true,
    require_phone: true,
    require_grad_year: true,
    require_id_card: false,
  },
}

// -------------------------------------------------------------
// TEST SUITE 1: Valid Individual & Team Events
// -------------------------------------------------------------
console.log('--- Test Suite 1: Valid Configurations ---')

{
  const { isValid, errors } = validateEventConfig(validBaseEvent, 'publish')
  assert(isValid && Object.keys(errors).length === 0, 'Valid individual event passes with 0 errors')
}

{
  const teamEvent: typeof validBaseEvent = {
    ...validBaseEvent,
    participation_type: 'team',
    min_team_size: 2,
    max_team_size: 5,
    leader_counts_towards_size: true,
    require_team_name: true,
    team_registration_mode: 'leader_adds_members',
  }
  const { isValid, errors } = validateEventConfig(teamEvent, 'publish')
  assert(isValid && Object.keys(errors).length === 0, 'Valid team event (2-5 members, leader counted) passes with 0 errors')
}

// -------------------------------------------------------------
// TEST SUITE 2: Team Size and Participation Validation
// -------------------------------------------------------------
console.log('\n--- Test Suite 2: Team Size & Limits Validation ---')

{
  const invalidTeamSize: typeof validBaseEvent = {
    ...validBaseEvent,
    participation_type: 'team',
    min_team_size: 5,
    max_team_size: 2, // Max < Min
  }
  const { isValid, errors } = validateEventConfig(invalidTeamSize, 'publish')
  assert(
    !isValid && Boolean(errors.max_team_size),
    'Rejects team when max_team_size is less than min_team_size'
  )
}

{
  const zeroMinTeamSize: typeof validBaseEvent = {
    ...validBaseEvent,
    participation_type: 'team',
    min_team_size: 0,
    max_team_size: 4,
  }
  const { isValid, errors } = validateEventConfig(zeroMinTeamSize, 'publish')
  assert(
    !isValid && Boolean(errors.min_team_size),
    'Rejects team when min_team_size is less than 1'
  )
}

// -------------------------------------------------------------
// TEST SUITE 3: Required Fields Validation
// -------------------------------------------------------------
console.log('\n--- Test Suite 3: Required Fields Validation ---')

{
  const missingTitle: typeof validBaseEvent = {
    ...validBaseEvent,
    title: '   ',
  }
  const { isValid, errors } = validateEventConfig(missingTitle, 'publish')
  assert(
    !isValid && Boolean(errors.title),
    'Rejects empty or whitespace-only event title'
  )
}

{
  const shortSummaryOnPublish: typeof validBaseEvent = {
    ...validBaseEvent,
    summary: 'Too short',
  }
  const { isValid, errors } = validateEventConfig(shortSummaryOnPublish, 'publish')
  assert(
    !isValid && Boolean(errors.summary),
    'Rejects event with insufficient summary length on publish'
  )
}

{
  const missingVenue: typeof validBaseEvent = {
    ...validBaseEvent,
    event_type: 'offline',
    venue_name: '',
  }
  const { isValid, errors } = validateEventConfig(missingVenue, 'publish')
  assert(
    !isValid && Boolean(errors.venue_name),
    'Rejects offline event with missing venue name'
  )
}

{
  const zeroCapacity: typeof validBaseEvent = {
    ...validBaseEvent,
    capacity: 0,
  }
  const { isValid, errors } = validateEventConfig(zeroCapacity, 'publish')
  assert(
    !isValid && Boolean(errors.capacity),
    'Rejects capacity less than 1'
  )
}

// -------------------------------------------------------------
// TEST SUITE 4: Invalid Dates & Schedule Constraints
// -------------------------------------------------------------
console.log('\n--- Test Suite 4: Date & Schedule Constraints ---')

{
  const endBeforeStart: typeof validBaseEvent = {
    ...validBaseEvent,
    start_date: new Date(Date.now() + 86400000 * 5).toISOString(),
    end_date: new Date(Date.now() + 86400000 * 3).toISOString(), // End before start
  }
  const { isValid, errors } = validateEventConfig(endBeforeStart, 'publish')
  assert(
    !isValid && Boolean(errors.end_date),
    'Rejects event where end date is before start date'
  )
}

{
  const regCloseAfterStart: typeof validBaseEvent = {
    ...validBaseEvent,
    start_date: new Date(Date.now() + 86400000 * 2).toISOString(),
    end_date: new Date(Date.now() + 86400000 * 3).toISOString(),
    registration_closes_at: new Date(Date.now() + 86400000 * 4).toISOString(), // After start date
  }
  const { isValid, errors } = validateEventConfig(regCloseAfterStart, 'publish')
  assert(
    !isValid && Boolean(errors.registration_closes_at),
    'Rejects event where registration closing deadline is after event starts'
  )
}

// -------------------------------------------------------------
// TEST SUITE 5: Free vs Paid Setup Validation
// -------------------------------------------------------------
console.log('\n--- Test Suite 5: Free vs Paid Ticket Configuration ---')

{
  const negativePrice: typeof validBaseEvent = {
    ...validBaseEvent,
    is_free: false,
    price: -100,
  }
  const { isValid, errors } = validateEventConfig(negativePrice, 'publish')
  assert(
    !isValid && Boolean(errors.price),
    'Rejects paid event with negative price'
  )
}

{
  const zeroPricePaid: typeof validBaseEvent = {
    ...validBaseEvent,
    is_free: false,
    price: 0,
  }
  const { isValid, errors } = validateEventConfig(zeroPricePaid, 'publish')
  assert(
    !isValid && Boolean(errors.price),
    'Rejects paid event configured with ₹0 ticket price'
  )
}

{
  const validPaidEvent: typeof validBaseEvent = {
    ...validBaseEvent,
    is_free: false,
    price: 250,
  }
  const { isValid, errors } = validateEventConfig(validPaidEvent, 'publish')
  assert(
    !errors.price,
    'Accepts valid ticketed price (₹250)'
  )
}

// -------------------------------------------------------------
// TEST SUITE 6: Custom Question Validation
// -------------------------------------------------------------
console.log('\n--- Test Suite 6: Custom Questions Form Builder ---')

{
  const emptyQuestionLabel: typeof validBaseEvent = {
    ...validBaseEvent,
    custom_questions: [
      {
        id: 'q_empty',
        label: '   ',
        type: 'text',
        required: true,
      },
    ],
  }
  const { isValid, errors } = validateEventConfig(emptyQuestionLabel, 'publish')
  assert(
    !isValid && Object.keys(errors).some((k) => k.startsWith('question_')),
    'Rejects custom question with blank question label'
  )
}

{
  const selectQuestionWithoutOptions: typeof validBaseEvent = {
    ...validBaseEvent,
    custom_questions: [
      {
        id: 'q_select',
        label: 'T-Shirt Size',
        type: 'select',
        required: true,
        options: ['Only One Option'],
      },
    ],
  }
  const { isValid, errors } = validateEventConfig(selectQuestionWithoutOptions, 'publish')
  assert(
    !isValid && Object.keys(errors).some((k) => k.includes('_options')),
    'Rejects select/dropdown question without at least 2 option choices'
  )
}

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log('\n============================================================')
console.log(`TEST RESULTS: ${passedTests}/${totalTests} Passed`)
console.log('============================================================\n')

if (passedTests === totalTests) {
  process.exit(0)
} else {
  process.exit(1)
}
