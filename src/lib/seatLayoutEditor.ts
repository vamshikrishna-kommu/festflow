/**
 * seatLayoutEditor.ts — Utilities for the organizer layout editor
 */
import type { LayoutEditorConfig, LayoutEditorRow, LayoutEditorSeat, StagePosition } from '@/types/seating'

export { validateLayout } from '@/lib/seating'

/** Generate a client-side temporary ID */
export function generateTempId(): string {
  return `temp_${Math.random().toString(36).slice(2)}_${Date.now()}`
}

/** Create a default row of seats */
export function createDefaultRow(
  rowIdentifier: string,
  seatCount: number,
  categoryId: string | null = null
): LayoutEditorRow {
  const seats: LayoutEditorSeat[] = []
  for (let col = 1; col <= seatCount; col++) {
    seats.push({
      tempId: generateTempId(),
      row_identifier: rowIdentifier,
      column_position: col,
      display_label: `${rowIdentifier}${col}`,
      section: '',
      category_id: categoryId,
      is_blocked: false,
      is_accessible: false,
      is_aisle_gap: false,
    })
  }
  return { row_identifier: rowIdentifier, seats }
}

/** Create an aisle gap placeholder */
export function createAisleGap(
  rowIdentifier: string,
  columnPosition: number
): LayoutEditorSeat {
  return {
    tempId: generateTempId(),
    row_identifier: rowIdentifier,
    column_position: columnPosition,
    display_label: '',
    section: '',
    category_id: null,
    is_blocked: false,
    is_accessible: false,
    is_aisle_gap: true,
  }
}

/** Re-number column positions within a row after insertions/deletions */
export function renumberRow(row: LayoutEditorRow): LayoutEditorRow {
  return {
    ...row,
    seats: row.seats.map((seat, idx) => ({
      ...seat,
      column_position: idx + 1,
      display_label: seat.is_aisle_gap ? '' : `${row.row_identifier}${idx + 1}`,
    })),
  }
}

/** Create a default empty layout config */
export function createDefaultLayoutConfig(): LayoutEditorConfig {
  const tempCatId = generateTempId()
  return {
    name: 'Main Hall',
    venue_description: '',
    hold_duration_minutes: 10,
    max_seats_per_registration: 1,
    allow_multi_seat: false,
    stage_position: 'front' as StagePosition,
    rows: [
      createDefaultRow('A', 10, tempCatId),
      createDefaultRow('B', 10, tempCatId),
      createDefaultRow('C', 10, tempCatId),
    ],
    categories: [
      {
        tempId: tempCatId,
        name: 'Standard',
        color: '#18CFFC',
        price: 0,
        description: '',
        sort_order: 0,
      },
    ],
  }
}

/** Add a new row after the last row */
export function addRow(config: LayoutEditorConfig, seatsPerRow: number): LayoutEditorConfig {
  const existingRowIds = config.rows.map((r) => r.row_identifier)
  const nextRowId = getNextRowIdentifier(existingRowIds)
  const defaultCatId = config.categories[0]?.tempId ?? null
  return {
    ...config,
    rows: [...config.rows, createDefaultRow(nextRowId, seatsPerRow, defaultCatId)],
  }
}

/** Remove a row by identifier */
export function removeRow(config: LayoutEditorConfig, rowIdentifier: string): LayoutEditorConfig {
  return {
    ...config,
    rows: config.rows.filter((r) => r.row_identifier !== rowIdentifier),
  }
}

/** Add a seat to a specific row */
export function addSeatToRow(
  config: LayoutEditorConfig,
  rowIdentifier: string
): LayoutEditorConfig {
  return {
    ...config,
    rows: config.rows.map((row) => {
      if (row.row_identifier !== rowIdentifier) return row
      const nextCol = row.seats.length + 1
      const defaultCatId = config.categories[0]?.tempId ?? null
      const newSeat: LayoutEditorSeat = {
        tempId: generateTempId(),
        row_identifier: rowIdentifier,
        column_position: nextCol,
        display_label: `${rowIdentifier}${nextCol}`,
        section: '',
        category_id: defaultCatId,
        is_blocked: false,
        is_accessible: false,
        is_aisle_gap: false,
      }
      return { ...row, seats: [...row.seats, newSeat] }
    }),
  }
}

/** Remove a seat by tempId */
export function removeSeat(
  config: LayoutEditorConfig,
  tempId: string
): LayoutEditorConfig {
  return {
    ...config,
    rows: config.rows.map((row) => renumberRow({
      ...row,
      seats: row.seats.filter((s) => s.tempId !== tempId),
    })),
  }
}

/** Update a specific seat property */
export function updateSeat(
  config: LayoutEditorConfig,
  tempId: string,
  patch: Partial<LayoutEditorSeat>
): LayoutEditorConfig {
  return {
    ...config,
    rows: config.rows.map((row) => ({
      ...row,
      seats: row.seats.map((seat) =>
        seat.tempId === tempId ? { ...seat, ...patch } : seat
      ),
    })),
  }
}

/** Insert an aisle gap after a specific seat */
export function insertAisleAfter(
  config: LayoutEditorConfig,
  rowIdentifier: string,
  afterTempId: string
): LayoutEditorConfig {
  return {
    ...config,
    rows: config.rows.map((row) => {
      if (row.row_identifier !== rowIdentifier) return row
      const idx = row.seats.findIndex((s) => s.tempId === afterTempId)
      if (idx === -1) return row
      const newSeats = [...row.seats]
      newSeats.splice(idx + 1, 0, createAisleGap(rowIdentifier, idx + 2))
      return renumberRow({ ...row, seats: newSeats })
    }),
  }
}

/** Get total real seat count (excluding aisles and blocked) */
export function getTotalCapacity(config: LayoutEditorConfig): number {
  return config.rows.flatMap((r) => r.seats).filter((s) => !s.is_aisle_gap && !s.is_blocked).length
}

/** Generate next row letter/number identifier */
function getNextRowIdentifier(existing: string[]): string {
  if (existing.length === 0) return 'A'
  const last = existing[existing.length - 1]
  // Try alphabetic
  if (/^[A-Z]+$/.test(last)) {
    return incrementAlpha(last)
  }
  // Numeric fallback
  const n = parseInt(last, 10)
  return isNaN(n) ? `Row${existing.length + 1}` : String(n + 1)
}

function incrementAlpha(str: string): string {
  const chars = str.split('')
  let i = chars.length - 1
  while (i >= 0) {
    if (chars[i] < 'Z') {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1)
      return chars.join('')
    }
    chars[i] = 'A'
    i--
  }
  return 'A' + chars.join('')
}

/** Brand colors for category color picker */
export const CATEGORY_PRESET_COLORS = [
  '#18CFFC', // Neon Cyan
  '#07A4FC', // Sky Blue
  '#0D56FB', // Royal Cobalt
  '#7F1AFB', // Vibrant Violet
  '#ED47FC', // Radiant Magenta
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#6366F1', // Indigo
  '#EC4899', // Pink
]
