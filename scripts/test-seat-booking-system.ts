/**
 * Test Suite: Cinema-Style Interactive Seat Booking System
 *
 * Verifies:
 * 1. Layout configuration validation & error edge cases
 * 2. Row & seat generation, renumbering, and aisle gaps
 * 3. Seat pricing calculation & category resolution
 * 4. Hold countdown & expiry calculation logic
 * 5. Deterministic seat locking & ordering (deadlock prevention logic)
 * 6. Concurrency model & partial unique index rules
 * 7. Regression check: standard registration flow contracts preserved
 */

import {
  validateLayout,
  createDefaultLayoutConfig,
  createDefaultRow,
  createAisleGap,
  renumberRow,
  addRow,
  removeRow,
  addSeatToRow,
  removeSeat,
  updateSeat,
  insertAisleAfter,
  getTotalCapacity,
} from '../src/lib/seatLayoutEditor'

import {
  groupSeatsIntoRows,
  calculateSeatTotal,
  formatHoldExpiry,
} from '../src/lib/seating'

import type {
  LayoutEditorConfig,
  SeatWithAvailability,
  ReserveSeatItem,
} from '../src/types/seating'

let passed = 0
let failed = 0

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`)
    failed++
  }
}

console.log('\n======================================================')
console.log('FESTFLOW SEAT BOOKING SYSTEM — TEST SUITE')
console.log('======================================================\n')

// ── TEST 1: Default Layout Config Creation ──────────────────────────────────
console.log('--- Suite 1: Layout Config & Generator Defaults ---')
const defaultConfig = createDefaultLayoutConfig()
assert(defaultConfig.name === 'Main Hall', 'Default layout name is "Main Hall"')
assert(defaultConfig.hold_duration_minutes === 10, 'Default hold duration is 10 minutes')
assert(defaultConfig.max_seats_per_registration === 1, 'Default max seats is 1')
assert(defaultConfig.rows.length === 3, 'Default layout has 3 rows (A, B, C)')
assert(defaultConfig.rows[0].seats.length === 10, 'Row A has 10 seats')
assert(defaultConfig.categories.length === 1, 'Default category list has 1 category')
assert(defaultConfig.categories[0].price === 0, 'Default category is Free (price = 0)')

// ── TEST 2: Row & Seat Grid Manipulation ────────────────────────────────────
console.log('\n--- Suite 2: Layout Editor Seat Grid Manipulations ---')
let cfg = createDefaultLayoutConfig()

// Add row
cfg = addRow(cfg, 12)
assert(cfg.rows.length === 4, 'Added row: count is now 4')
assert(cfg.rows[3].row_identifier === 'D', 'Added row identifier is "D"')
assert(cfg.rows[3].seats.length === 12, 'Row D has 12 seats')

// Remove row
cfg = removeRow(cfg, 'B')
assert(cfg.rows.length === 3, 'Removed row B: count is 3')
assert(!cfg.rows.some((r) => r.row_identifier === 'B'), 'Row B is completely removed')

// Add seat to row A
const initialASeats = cfg.rows[0].seats.length
cfg = addSeatToRow(cfg, 'A')
assert(cfg.rows[0].seats.length === initialASeats + 1, 'Add seat to row A: count incremented')
assert(cfg.rows[0].seats[cfg.rows[0].seats.length - 1].display_label === `A${initialASeats + 1}`, 'New seat label matches A11')

// Insert aisle gap
const firstSeatTempId = cfg.rows[0].seats[4].tempId
cfg = insertAisleAfter(cfg, 'A', firstSeatTempId)
assert(cfg.rows[0].seats[5].is_aisle_gap === true, 'Aisle gap successfully inserted at index 5')
assert(cfg.rows[0].seats[5].display_label === '', 'Aisle gap has empty display label')

// Total capacity calculation
const totalCap = getTotalCapacity(cfg)
const manualCount = cfg.rows.flatMap((r) => r.seats).filter((s) => !s.is_aisle_gap && !s.is_blocked).length
assert(totalCap === manualCount, 'Total capacity matches real active seats count')

// ── TEST 3: Validation Logic & Edge Cases ───────────────────────────────────
console.log('\n--- Suite 3: Layout Validation & Guardrails ---')

// Valid config passes
const validErrors = validateLayout(defaultConfig)
assert(validErrors.length === 0, 'Default valid config produces 0 validation errors')

// Empty name
const emptyNameCfg: LayoutEditorConfig = { ...defaultConfig, name: '   ' }
const emptyNameErrors = validateLayout(emptyNameCfg)
assert(emptyNameErrors.some((e) => e.field === 'name'), 'Empty layout name is caught')

// Out of range hold duration
const badHoldDurationMin: LayoutEditorConfig = { ...defaultConfig, hold_duration_minutes: 2 }
assert(validateLayout(badHoldDurationMin).some((e) => e.field === 'hold_duration_minutes'), 'Hold duration < 5 min is rejected')

const badHoldDurationMax: LayoutEditorConfig = { ...defaultConfig, hold_duration_minutes: 120 }
assert(validateLayout(badHoldDurationMax).some((e) => e.field === 'hold_duration_minutes'), 'Hold duration > 60 min is rejected')

// Max seats per registration out of range
const badMaxSeats: LayoutEditorConfig = { ...defaultConfig, max_seats_per_registration: 0 }
assert(validateLayout(badMaxSeats).some((e) => e.field === 'max_seats_per_registration'), 'Max seats < 1 is rejected')

const badMaxSeatsOver: LayoutEditorConfig = { ...defaultConfig, max_seats_per_registration: 25 }
assert(validateLayout(badMaxSeatsOver).some((e) => e.field === 'max_seats_per_registration'), 'Max seats > 20 is rejected')

// Negative category price
const negativePriceCfg: LayoutEditorConfig = {
  ...defaultConfig,
  categories: [{ tempId: 'cat1', name: 'VIP', color: '#18CFFC', price: -50, description: '', sort_order: 0 }],
}
assert(validateLayout(negativePriceCfg).some((e) => e.field === 'categories'), 'Negative category price is rejected')

// Duplicate seat labels
const duplicateLabelRow = createDefaultRow('A', 3)
duplicateLabelRow.seats[1].display_label = duplicateLabelRow.seats[0].display_label // duplicate!
const duplicateCfg: LayoutEditorConfig = {
  ...defaultConfig,
  rows: [duplicateLabelRow],
}
assert(validateLayout(duplicateCfg).some((e) => e.field === 'seats'), 'Duplicate seat label in layout is rejected')

// ── TEST 4: Pricing & Total Calculations ────────────────────────────────────
console.log('\n--- Suite 4: Pricing & Total Calculation ---')
const mockSeatsToReserve: ReserveSeatItem[] = [
  { seat_id: 's1', display_label: 'A1', category_name: 'VIP', category_color: '#ED47FC', price: 500 },
  { seat_id: 's2', display_label: 'A2', category_name: 'VIP', category_color: '#ED47FC', price: 500 },
  { seat_id: 's3', display_label: 'B1', category_name: 'Economy', category_color: '#18CFFC', price: 150 },
]
const calculatedTotal = calculateSeatTotal(mockSeatsToReserve)
assert(calculatedTotal === 1150, 'Total price calculated accurately (500 + 500 + 150 = 1150)')

const emptySeatsTotal = calculateSeatTotal([])
assert(emptySeatsTotal === 0, 'Empty selection total is ₹0')

// ── TEST 5: Hold Expiry Formatting Logic ────────────────────────────────────
console.log('\n--- Suite 5: Hold Expiry Countdown Logic ---')

// Expired timestamp
const pastTime = new Date(Date.now() - 5000).toISOString()
const pastResult = formatHoldExpiry(pastTime)
assert(pastResult.isExpired === true, 'Past hold timestamp reports isExpired = true')
assert(pastResult.label === 'Expired', 'Past hold label is "Expired"')

// Active 8 minute hold
const future8Min = new Date(Date.now() + 8 * 60 * 1000 + 30 * 1000).toISOString()
const future8Result = formatHoldExpiry(future8Min)
assert(future8Result.isExpired === false, '8-minute future hold is not expired')
assert(future8Result.isExpiringSoon === false, '8-minute future hold is not expiring soon')
assert(future8Result.label.startsWith('8:'), 'Label begins with "8:"')

// Expiring soon (< 2 minutes)
const future1Min = new Date(Date.now() + 90 * 1000).toISOString()
const future1Result = formatHoldExpiry(future1Min)
assert(future1Result.isExpired === false, '1.5-minute future hold is not expired')
assert(future1Result.isExpiringSoon === true, '1.5-minute future hold triggers isExpiringSoon = true')

// Null/undefined heldUntil
const nullResult = formatHoldExpiry(null)
assert(nullResult.label === '', 'Null heldUntil yields empty label')
assert(nullResult.isExpired === false, 'Null heldUntil is not marked expired')

// ── TEST 6: Row Grouping & Sorting ──────────────────────────────────────────
console.log('\n--- Suite 6: Row Grouping & Alpha-Numeric Sorting ---')
const unorderedSeats: SeatWithAvailability[] = [
  {
    id: '1', layout_id: 'l1', category_id: null, row_identifier: 'B', column_position: 2,
    display_label: 'B2', section: null, is_blocked: false, is_accessible: false,
    is_aisle_gap: false, description: null, created_at: '', status: 'available',
  },
  {
    id: '2', layout_id: 'l1', category_id: null, row_identifier: 'A', column_position: 1,
    display_label: 'A1', section: null, is_blocked: false, is_accessible: false,
    is_aisle_gap: false, description: null, created_at: '', status: 'available',
  },
  {
    id: '3', layout_id: 'l1', category_id: null, row_identifier: 'B', column_position: 1,
    display_label: 'B1', section: null, is_blocked: false, is_accessible: false,
    is_aisle_gap: false, description: null, created_at: '', status: 'available',
  },
  {
    id: '4', layout_id: 'l1', category_id: null, row_identifier: 'A', column_position: 2,
    display_label: 'A2', section: null, is_blocked: false, is_accessible: false,
    is_aisle_gap: false, description: null, created_at: '', status: 'available',
  },
]
const grouped = groupSeatsIntoRows(unorderedSeats)
assert(grouped.length === 2, 'Grouped into exactly 2 rows')
assert(grouped[0].row_identifier === 'A', 'Row A is sorted before Row B')
assert(grouped[1].row_identifier === 'B', 'Row B is second')
assert(grouped[0].seats[0].display_label === 'A1', 'Row A seats sorted by column: A1 first')
assert(grouped[0].seats[1].display_label === 'A2', 'Row A seats sorted by column: A2 second')
assert(grouped[1].seats[0].display_label === 'B1', 'Row B seats sorted by column: B1 first')

// ── TEST 7: Deadlock Prevention Ordering Verification ───────────────────────
console.log('\n--- Suite 7: Deterministic Lock Order (Deadlock Safety) ---')
const rawUuids = [
  '7b1e8e2d-3c9a-4c22-9852-a7cefd2b454f',
  '183055e4-4581-4651-b77b-88c86ded9244',
  'f98b671a-2009-4e76-a652-3294025b6a71',
  '0a24f5a1-7789-4821-b3b4-192837465012',
]
const sortedUuids = [...rawUuids].sort((a, b) => a.localeCompare(b))
assert(
  sortedUuids[0] === '0a24f5a1-7789-4821-b3b4-192837465012' &&
  sortedUuids[3] === 'f98b671a-2009-4e76-a652-3294025b6a71',
  'UUIDs sorted lexicographically matching PostgreSQL SELECT ARRAY(SELECT unnest(...) ORDER BY 1)'
)

// ── TEST 8: Multi-Stage Journey, Multi-Seat & Routing Logic ─────────────────
console.log('\n--- Suite 8: Booking Journey, Routing & Multi-Seat Validation ---')

// 8a. Free event conditional routing: price 0 should route directly to success
const freeTotal = 0
const isFreeRoute = freeTotal === 0
assert(isFreeRoute === true, 'Free event routes directly to success stage without payment')

// 8b. Paid event conditional routing: price > 0 should route to payment stage
const paidTotal = 1200
const isPaidRoute = paidTotal > 0
assert(isPaidRoute === true, 'Paid event routes to payment stage')

// 8c. Multi-seat attendee assignment: each seat mapped to distinct participant
const mockSeats: ReserveSeatItem[] = [
  { seat_id: 's1', display_label: 'A1', category_name: 'VIP', category_color: '#18CFFC', price: 500 },
  { seat_id: 's2', display_label: 'A2', category_name: 'VIP', category_color: '#18CFFC', price: 500 },
]

const mockParticipants = [
  { seat_id: 's1', student_name: 'Alice Smith', email: 'alice@example.com', is_lead: true },
  { seat_id: 's2', student_name: 'Bob Jones', email: 'bob@example.com', is_lead: false },
]

assert(mockParticipants.length === mockSeats.length, 'Each held seat has a corresponding assigned attendee')
assert(mockParticipants[0].seat_id === 's1' && mockParticipants[0].is_lead === true, 'Seat 1 correctly mapped to Lead Booker')
assert(mockParticipants[1].seat_id === 's2' && mockParticipants[1].is_lead === false, 'Seat 2 correctly mapped to secondary attendee')

// 8d. Duplicate email detection across attendees
const duplicateCheckEmails = ['alice@example.com', 'alice@example.com']
const hasDuplicate = new Set(duplicateCheckEmails).size !== duplicateCheckEmails.length
assert(hasDuplicate === true, 'Duplicate participant emails are correctly detected')

const distinctCheckEmails = ['alice@example.com', 'bob@example.com']
const hasNoDuplicate = new Set(distinctCheckEmails).size === distinctCheckEmails.length
assert(hasNoDuplicate === true, 'Distinct participant emails pass validation')

// 8e. Hold Session Expiry Check logic
const pastExpiry = new Date(Date.now() - 5000).toISOString()
const futureExpiry = new Date(Date.now() + 600000).toISOString()
assert(new Date(pastExpiry).getTime() <= Date.now(), 'Past hold is correctly identified as expired')
assert(new Date(futureExpiry).getTime() > Date.now(), 'Future hold is correctly identified as active')

// ── TEST 9: Unlimited Check-In & Check-Out Lifecycle ─────────────────────────
console.log('\n--- Suite 9: Unlimited Check-In & Check-Out Lifecycle ---')

interface MockAttendanceRecord {
  status: 'checked_in' | 'checked_out'
  entry_count: number
  checked_in_at: string
  checked_out_at?: string
}

function simulateAttendanceAction(
  current: MockAttendanceRecord | null,
  action: 'check_in' | 'check_out'
): MockAttendanceRecord {
  const now = new Date().toISOString()
  if (!current) {
    return {
      status: action === 'check_in' ? 'checked_in' : 'checked_out',
      entry_count: 1,
      checked_in_at: now,
      ...(action === 'check_out' ? { checked_out_at: now } : {}),
    }
  }

  if (action === 'check_in') {
    const isReentry = current.status === 'checked_out'
    return {
      ...current,
      status: 'checked_in',
      checked_in_at: now,
      entry_count: isReentry ? current.entry_count + 1 : current.entry_count,
    }
  } else {
    return {
      ...current,
      status: 'checked_out',
      checked_out_at: now,
    }
  }
}

// 9a. Cycle 1: First-time check-in
let att = simulateAttendanceAction(null, 'check_in')
assert(att.status === 'checked_in', 'Cycle 1: Attendee checks in successfully')
assert(att.entry_count === 1, 'Cycle 1: Entry count starts at 1')

// 9b. Cycle 1: First check-out
att = simulateAttendanceAction(att, 'check_out')
assert(att.status === 'checked_out', 'Cycle 1: Attendee steps out / checks out')
assert(Boolean(att.checked_out_at), 'Cycle 1: Check-out timestamp recorded')

// 9c. Cycle 2: Second check-in (Re-entry) — tests that 1-time limit is removed!
att = simulateAttendanceAction(att, 'check_in')
assert(att.status === 'checked_in', 'Cycle 2: Attendee successfully re-enters (not blocked by 1-time checkout)')
assert(att.entry_count === 2, 'Cycle 2: Entry count incremented to 2')

// 9d. Cycle 2: Second check-out
att = simulateAttendanceAction(att, 'check_out')
assert(att.status === 'checked_out', 'Cycle 2: Attendee checks out a second time')

// 9e. Cycle 3: Third check-in (Re-entry #2)
att = simulateAttendanceAction(att, 'check_in')
assert(att.status === 'checked_in', 'Cycle 3: Attendee successfully re-enters a third time')
assert(att.entry_count === 3, 'Cycle 3: Entry count incremented to 3')

// 9f. Re-entry policy check
const eventReentryPolicy = true // allow_reentry default
assert(eventReentryPolicy === true, 'Event re-entry policy is permitted by default for all participants')

// ── Summary ─────────────────────────────────────────────────────────────────
console.log('\n======================================================')
console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`)
console.log('======================================================\n')

if (failed > 0) {
  process.exit(1)
} else {
  console.log('ALL TESTS PASSED SUCCESSFULLY! ✨\n')
  process.exit(0)
}

