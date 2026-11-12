// Seating system types for FestFlow cinema-style seat booking
// These types mirror the database schema defined in migration 054_seat_booking_system.sql

// ── Enums & Literals ─────────────────────────────────────────────────────────

/** Status of an individual seat in the student-facing availability map */
export type SeatStatus =
  | 'available'
  | 'held'            // held by another user
  | 'selected'        // selected by current user (UI-only, not in DB)
  | 'my_hold'         // held by current user
  | 'payment_submitted'
  | 'payment_under_review'
  | 'confirmed'
  | 'blocked'
  | 'aisle_gap'

/** Stage/screen position for the room layout */
export type StagePosition = 'front' | 'back' | 'left' | 'right'

/** Registration mode for an event */
export type RegistrationMode = 'standard' | 'reserved_seating'

// ── Database Row Types ────────────────────────────────────────────────────────

export interface SeatLayout {
  id: string
  event_id: string
  name: string
  venue_description: string | null
  total_capacity: number
  hold_duration_minutes: number
  max_seats_per_registration: number
  allow_multi_seat: boolean
  stage_position: StagePosition
  is_published: boolean
  version: number
  created_at: string
  updated_at: string
}

export interface SeatCategory {
  id: string
  layout_id: string
  name: string
  color: string
  price: number
  description: string | null
  sort_order: number
  created_at: string
}

export interface Seat {
  id: string
  layout_id: string
  category_id: string | null
  row_identifier: string
  column_position: number
  display_label: string
  section: string | null
  is_blocked: boolean
  is_accessible: boolean
  is_aisle_gap: boolean
  description: string | null
  created_at: string
}

export interface SeatReservation {
  id: string
  event_id: string
  seat_id: string
  registration_id: string | null
  student_id: string
  status: 'held' | 'payment_submitted' | 'payment_under_review' | 'confirmed' | 'cancelled' | 'expired' | 'released'
  held_until: string | null
  confirmed_at: string | null
  released_at: string | null
  payment_submission_id: string | null
  idempotency_key: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ── Composed / UI Types ───────────────────────────────────────────────────────

/** Full layout with categories and seats loaded */
export interface SeatLayoutFull extends SeatLayout {
  categories: SeatCategory[]
  seats: SeatWithAvailability[]
}

/** A seat enriched with live availability status */
export interface SeatWithAvailability extends Seat {
  status: SeatStatus
  held_until?: string | null
  is_mine?: boolean
  category?: SeatCategory | null
}

/** Map from seat_id → SeatStatus for fast lookup */
export type SeatAvailabilityMap = Record<string, {
  status: SeatStatus
  held_until?: string | null
  is_mine?: boolean
}>

/** Grouped rows for the seat map grid */
export interface SeatRow {
  row_identifier: string
  seats: SeatWithAvailability[]
}

// ── RPC Result Types ──────────────────────────────────────────────────────────

export interface ReserveSeatItem {
  seat_id: string
  display_label: string
  category_name: string
  category_color: string
  price: number
}

export interface ReserveSeatsSuccess {
  success: true
  idempotent?: boolean
  reservation_ids: string[]
  held_until: string
  total_price: number
  seats: ReserveSeatItem[]
}

export type ReserveSeatsErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'NO_SEATS'
  | 'EVENT_NOT_FOUND'
  | 'EVENT_NOT_OPEN'
  | 'NOT_RESERVED_SEATING'
  | 'NO_LAYOUT'
  | 'TOO_MANY_SEATS'
  | 'ALREADY_HAS_RESERVATION'
  | 'SEAT_BLOCKED'
  | 'SEAT_TAKEN'
  | 'INVALID_SEAT'
  | 'UNKNOWN'

export interface ReserveSeatsFailure {
  success: false
  error_code: ReserveSeatsErrorCode
  message: string
}

export type ReserveSeatsResult = ReserveSeatsSuccess | ReserveSeatsFailure

// ── Layout Editor Types ───────────────────────────────────────────────────────

export interface LayoutEditorSeat {
  /** Temporary client-side ID (UUID or placeholder) */
  tempId: string
  /** DB id if already persisted */
  id?: string
  row_identifier: string
  column_position: number
  display_label: string
  section: string
  category_id: string | null
  is_blocked: boolean
  is_accessible: boolean
  is_aisle_gap: boolean
}

export interface LayoutEditorRow {
  row_identifier: string
  seats: LayoutEditorSeat[]
}

export interface LayoutEditorConfig {
  name: string
  venue_description: string
  hold_duration_minutes: number
  max_seats_per_registration: number
  allow_multi_seat: boolean
  stage_position: StagePosition
  rows: LayoutEditorRow[]
  categories: Array<{
    tempId: string
    id?: string
    name: string
    color: string
    price: number
    description: string
    sort_order: number
  }>
}

export interface LayoutValidationError {
  field: string
  message: string
}
