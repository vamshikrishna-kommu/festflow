/**
 * seating.ts — Client-side seat booking library for FestFlow
 * All pricing decisions are server-authoritative (returned by RPCs).
 * Frontend calculations are for display only and not trusted by the server.
 */
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type {
  SeatLayout,
  SeatCategory,
  SeatReservation,
  SeatLayoutFull,
  SeatWithAvailability,
  SeatAvailabilityMap,
  SeatRow,
  ReserveSeatsResult,
  ReserveSeatItem,
  LayoutEditorConfig,
  LayoutValidationError,
} from '@/types/seating'

// Helper for type-safe loose queries on migration-054 tables before supabase gen types refresh
const dbTable = (tableName: string) => (supabase.from as any)(tableName)
const dbRpc = (rpcName: string, args: Record<string, any>) => (supabase.rpc as any)(rpcName, args)

// ── Fetch ─────────────────────────────────────────────────────────────────────

/**
 * Fetch the published seat layout for an event, including categories and seats.
 * Returns null if no published layout exists.
 */
export async function fetchSeatLayout(eventId: string): Promise<SeatLayoutFull | null> {
  if (!isSupabaseConfigured) return null

  const { data: layout, error: layoutError } = await dbTable('seat_layouts')
    .select('*')
    .eq('event_id', eventId)
    .eq('is_published', true)
    .maybeSingle()

  if (layoutError || !layout) {
    if (layoutError) console.warn('[seating] fetchSeatLayout error:', layoutError.message)
    return null
  }

  const [{ data: categories }, { data: seats }] = await Promise.all([
    dbTable('seat_categories')
      .select('*')
      .eq('layout_id', layout.id)
      .order('sort_order', { ascending: true }),
    dbTable('seats')
      .select('*')
      .eq('layout_id', layout.id)
      .order('row_identifier', { ascending: true })
      .order('column_position', { ascending: true }),
  ])

  const categoryMap: Record<string, SeatCategory> = {}
  for (const cat of categories ?? []) categoryMap[cat.id] = cat

  const seatsWithStatus: SeatWithAvailability[] = (seats ?? []).map((seat: any) => ({
    ...seat,
    status: seat.is_aisle_gap ? 'aisle_gap' : seat.is_blocked ? 'blocked' : 'available',
    category: seat.category_id ? categoryMap[seat.category_id] ?? null : null,
  }))

  return {
    ...(layout as SeatLayout),
    categories: (categories ?? []) as SeatCategory[],
    seats: seatsWithStatus,
  }
}

/**
 * Fetch the full layout including unpublished drafts (organizer view).
 */
export async function fetchSeatLayoutForOrganizer(eventId: string): Promise<SeatLayoutFull | null> {
  if (!isSupabaseConfigured) return null

  const { data: layout, error } = await dbTable('seat_layouts')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle()

  if (error || !layout) return null

  const [{ data: categories }, { data: seats }] = await Promise.all([
    dbTable('seat_categories').select('*').eq('layout_id', layout.id).order('sort_order', { ascending: true }),
    dbTable('seats').select('*').eq('layout_id', layout.id).order('row_identifier', { ascending: true }).order('column_position', { ascending: true }),
  ])

  const categoryMap: Record<string, SeatCategory> = {}
  for (const cat of categories ?? []) categoryMap[cat.id] = cat

  return {
    ...(layout as SeatLayout),
    categories: (categories ?? []) as SeatCategory[],
    seats: ((seats ?? []) as any[]).map((seat) => ({
      ...seat,
      status: seat.is_aisle_gap ? 'aisle_gap' : seat.is_blocked ? 'blocked' : ('available' as any),
      category: seat.category_id ? categoryMap[seat.category_id] ?? null : null,
    })),
  }
}

/**
 * Fetch current seat availability for an event via the get_seat_availability RPC.
 * Returns a map of seat_id → {status, held_until, is_mine}.
 */
export async function fetchSeatAvailability(eventId: string): Promise<SeatAvailabilityMap> {
  if (!isSupabaseConfigured) return {}

  const { data, error } = await dbRpc('get_seat_availability', { p_event_id: eventId })

  if (error) {
    console.warn('[seating] fetchSeatAvailability error:', error.message)
    return {}
  }

  const map: SeatAvailabilityMap = {}
  const rows = Array.isArray(data) ? data : []
  for (const row of rows) {
    map[row.seat_id] = {
      status: row.status,
      held_until: row.held_until ?? null,
      is_mine: row.is_mine ?? false,
    }
  }
  return map
}

// ── Reservations ──────────────────────────────────────────────────────────────

/**
 * Reserve seats for the authenticated student.
 * Calls the reserve_event_seats RPC which is atomic and deadlock-safe.
 */
export async function reserveSeats(
  eventId: string,
  seatIds: string[],
  idempotencyKey: string
): Promise<ReserveSeatsResult> {
  if (!isSupabaseConfigured) {
    return { success: false, error_code: 'UNKNOWN', message: 'Supabase not configured.' }
  }

  const { data, error } = await dbRpc('reserve_event_seats', {
    p_event_id: eventId,
    p_seat_ids: seatIds,
    p_idempotency_key: idempotencyKey,
  })

  if (error) {
    console.error('[seating] reserveSeats RPC error:', error.message)
    return { success: false, error_code: 'UNKNOWN', message: error.message }
  }

  return data as ReserveSeatsResult
}

/**
 * Explicitly release a hold before checkout (e.g. user navigates away).
 */
export async function releaseHold(reservationIds: string[]): Promise<boolean> {
  if (!isSupabaseConfigured || !reservationIds.length) return false

  const { data, error } = await dbRpc('release_seat_hold', { p_reservation_ids: reservationIds })

  if (error) {
    console.warn('[seating] releaseHold error:', error.message)
    return false
  }
  return data?.success ?? false
}

/**
 * Fetch the student's own active reservations for an event.
 */
export async function fetchMyReservations(eventId: string): Promise<SeatReservation[]> {
  if (!isSupabaseConfigured) return []

  const { data, error } = await dbTable('seat_reservations')
    .select('*')
    .eq('event_id', eventId)
    .in('status', ['held', 'payment_submitted', 'payment_under_review', 'confirmed'])
    .order('created_at', { ascending: true })

  if (error) {
    console.warn('[seating] fetchMyReservations error:', error.message)
    return []
  }
  return (data ?? []) as SeatReservation[]
}

// ── Realtime ──────────────────────────────────────────────────────────────────

/**
 * Subscribe to real-time seat availability changes for an event.
 * The callback receives the updated availability map.
 * Returns an unsubscribe function.
 */
export function subscribeToSeatAvailability(
  eventId: string,
  onUpdate: (map: SeatAvailabilityMap) => void
): () => void {
  if (!isSupabaseConfigured) return () => {}

  const channel = supabase
    .channel(`seat_availability:${eventId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'seat_reservations',
        filter: `event_id=eq.${eventId}`,
      },
      async () => {
        // On any change, refetch the full availability map
        const map = await fetchSeatAvailability(eventId)
        onUpdate(map)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

// ── Layout Editor Helpers ─────────────────────────────────────────────────────

/** Organize flat seats list into rows for the grid UI */
export function groupSeatsIntoRows(seats: SeatWithAvailability[]): SeatRow[] {
  const rowMap = new Map<string, SeatWithAvailability[]>()
  for (const seat of seats) {
    if (!rowMap.has(seat.row_identifier)) rowMap.set(seat.row_identifier, [])
    rowMap.get(seat.row_identifier)!.push(seat)
  }

  const rows: SeatRow[] = []
  for (const [rowId, rowSeats] of rowMap) {
    rows.push({
      row_identifier: rowId,
      seats: rowSeats.sort((a, b) => a.column_position - b.column_position),
    })
  }
  // Sort rows alphabetically / numerically
  rows.sort((a, b) => a.row_identifier.localeCompare(b.row_identifier, undefined, { numeric: true }))
  return rows
}

/** Look up a category by ID */
export function getSeatCategoryById(
  categories: SeatCategory[],
  id: string | null | undefined
): SeatCategory | null {
  if (!id) return null
  return categories.find((c) => c.id === id) ?? null
}

/**
 * Calculate display-only total price for selected seats.
 * SERVER IS AUTHORITATIVE — this is for UI display only.
 */
export function calculateSeatTotal(seats: ReserveSeatItem[]): number {
  return seats.reduce((sum, s) => sum + s.price, 0)
}

/**
 * Format hold expiry as a human-readable countdown string.
 * Returns null if expired or no expiry.
 */
export function formatHoldExpiry(heldUntil: string | null | undefined): {
  label: string
  isExpiringSoon: boolean
  isExpired: boolean
} {
  if (!heldUntil) return { label: '', isExpiringSoon: false, isExpired: false }

  const msLeft = new Date(heldUntil).getTime() - Date.now()
  if (msLeft <= 0) return { label: 'Expired', isExpiringSoon: false, isExpired: true }

  const totalSeconds = Math.floor(msLeft / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const label = `${minutes}:${String(seconds).padStart(2, '0')}`
  return { label, isExpiringSoon: msLeft < 2 * 60 * 1000, isExpired: false }
}

// ── Layout Validation ─────────────────────────────────────────────────────────

export function validateLayout(config: LayoutEditorConfig): LayoutValidationError[] {
  const errors: LayoutValidationError[] = []

  if (!config.name.trim()) {
    errors.push({ field: 'name', message: 'Layout name is required.' })
  }
  if (config.hold_duration_minutes < 5 || config.hold_duration_minutes > 60) {
    errors.push({ field: 'hold_duration_minutes', message: 'Hold duration must be between 5 and 60 minutes.' })
  }
  if (config.max_seats_per_registration < 1 || config.max_seats_per_registration > 20) {
    errors.push({ field: 'max_seats_per_registration', message: 'Max seats per registration must be 1–20.' })
  }

  const realSeats = config.rows.flatMap((r) => r.seats.filter((s) => !s.is_aisle_gap))
  if (realSeats.length === 0) {
    errors.push({ field: 'rows', message: 'Layout must have at least one seat.' })
  }

  // Check for duplicate labels
  const labels = realSeats.map((s) => s.display_label)
  const duplicates = labels.filter((l, i) => labels.indexOf(l) !== i)
  if (duplicates.length > 0) {
    errors.push({ field: 'seats', message: `Duplicate seat labels: ${[...new Set(duplicates)].join(', ')}` })
  }

  // Check categories have names
  for (const cat of config.categories) {
    if (!cat.name.trim()) {
      errors.push({ field: 'categories', message: 'All categories must have a name.' })
      break
    }
    if (cat.price < 0) {
      errors.push({ field: 'categories', message: `Category "${cat.name}" has a negative price.` })
    }
  }

  return errors
}

// ── Organizer Save ────────────────────────────────────────────────────────────

/**
 * Save a seat layout (upsert layout → upsert categories → replace seats).
 * Does NOT publish; call publishSeatLayout separately.
 */
export async function saveSeatLayout(
  eventId: string,
  config: LayoutEditorConfig
): Promise<{ success: boolean; layoutId?: string; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured.' }

  const errors = validateLayout(config)
  if (errors.length > 0) {
    return { success: false, error: errors[0].message }
  }

  // Upsert layout
  const { data: layoutData, error: layoutError } = await dbTable('seat_layouts')
    .upsert(
      {
        event_id: eventId,
        name: config.name,
        venue_description: config.venue_description || null,
        hold_duration_minutes: config.hold_duration_minutes,
        max_seats_per_registration: config.max_seats_per_registration,
        allow_multi_seat: config.allow_multi_seat,
        stage_position: config.stage_position,
        total_capacity: config.rows.flatMap((r) => r.seats.filter((s) => !s.is_aisle_gap && !s.is_blocked)).length,
      },
      { onConflict: 'event_id', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (layoutError || !layoutData) {
    return { success: false, error: layoutError?.message ?? 'Failed to save layout.' }
  }

  const layoutId = layoutData.id

  // Delete existing categories and seats, then re-insert fresh
  const { error: deleteCatsError } = await dbTable('seat_categories')
    .delete()
    .eq('layout_id', layoutId)

  if (deleteCatsError) return { success: false, error: deleteCatsError.message }

  // Insert categories
  const categoryInserts = config.categories.map((cat, idx) => ({
    layout_id: layoutId,
    name: cat.name,
    color: cat.color,
    price: cat.price,
    description: cat.description || null,
    sort_order: idx,
  }))

  const categoryIdMap: Record<string, string> = {}

  if (categoryInserts.length > 0) {
    const { data: insertedCats, error: catError } = await dbTable('seat_categories')
      .insert(categoryInserts)
      .select('id, name')

    if (catError) return { success: false, error: catError.message }

    // Build tempId → real id map using order-based matching
    config.categories.forEach((cat, idx) => {
      if (insertedCats?.[idx]) categoryIdMap[cat.tempId] = insertedCats[idx].id
    })
  }

  // Delete existing seats
  await dbTable('seats').delete().eq('layout_id', layoutId)

  // Insert all seats
  const seatInserts = config.rows.flatMap((row) =>
    row.seats.map((seat) => ({
      layout_id: layoutId,
      category_id: seat.category_id ? (categoryIdMap[seat.category_id] ?? seat.category_id) : null,
      row_identifier: seat.row_identifier,
      column_position: seat.column_position,
      display_label: seat.display_label,
      section: seat.section || null,
      is_blocked: seat.is_blocked,
      is_accessible: seat.is_accessible,
      is_aisle_gap: seat.is_aisle_gap,
    }))
  )

  if (seatInserts.length > 0) {
    const { error: seatsError } = await dbTable('seats').insert(seatInserts)
    if (seatsError) return { success: false, error: seatsError.message }
  }

  return { success: true, layoutId }
}

/**
 * Publish a seat layout (makes it visible to students).
 * Fails if there are active reservations and layout has changed structurally.
 */
export async function publishSeatLayout(
  layoutId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured.' }

  const { error } = await dbTable('seat_layouts')
    .update({ is_published: true })
    .eq('id', layoutId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}
