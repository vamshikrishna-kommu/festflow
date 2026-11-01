import type { DynamicEventStatus } from '@/types'

export interface EventStatusDetails {
  status: DynamicEventStatus
  label: string
  color: 'emerald' | 'amber' | 'rose' | 'cyan' | 'purple' | 'zinc'
  isRegisterable: boolean
  remainingSpots: number | null
  fillPercentage: number
}

/**
 * Calculates accurate real-time dynamic event status based on:
 * - Published state / draft / cancelled / completed
 * - Capacity vs real-time registeredCount
 * - Event start & end dates
 * - Registration open and close deadlines
 */
export function calculateEventStatus(event: {
  status?: string
  startDate?: string
  endDate?: string
  date?: string
  registrationDeadline?: string | null
  registration_opens_at?: string | null
  registration_closes_at?: string | null
  start_date?: string
  end_date?: string
  capacity?: number
  registeredCount?: number
}): EventStatusDetails {
  const rawStatus = (event.status || 'published').toLowerCase()

  // 1. Explicit cancellation or draft
  if (rawStatus === 'cancelled') {
    return {
      status: 'cancelled',
      label: 'Cancelled',
      color: 'rose',
      isRegisterable: false,
      remainingSpots: 0,
      fillPercentage: 0,
    }
  }

  const now = new Date()
  const startIso = event.startDate || event.start_date || event.date
  const endIso = event.endDate || event.end_date
  const regCloseIso = event.registrationDeadline || event.registration_closes_at
  const regOpenIso = event.registration_opens_at

  const startDate = startIso ? new Date(startIso) : null
  const endDate = endIso ? new Date(endIso) : null
  const regCloseDate = regCloseIso ? new Date(regCloseIso) : null
  const regOpenDate = regOpenIso ? new Date(regOpenIso) : null

  // 2. Completed / Past
  if (rawStatus === 'completed' || (endDate && endDate < now)) {
    return {
      status: 'completed',
      label: 'Completed',
      color: 'zinc',
      isRegisterable: false,
      remainingSpots: 0,
      fillPercentage: 100,
    }
  }

  // 3. Live now
  if (startDate && startDate <= now && (!endDate || endDate >= now)) {
    return {
      status: 'live',
      label: 'Live Now',
      color: 'emerald',
      isRegisterable: false,
      remainingSpots: 0,
      fillPercentage: 100,
    }
  }

  // Capacity calculations
  const capacity = typeof event.capacity === 'number' && event.capacity > 0 ? event.capacity : 0
  const registered = typeof event.registeredCount === 'number' ? event.registeredCount : 0
  const remaining = capacity > 0 ? Math.max(capacity - registered, 0) : null
  const fillPct = capacity > 0 ? Math.min(Math.round((registered / capacity) * 100), 100) : 0

  // 4. Registration not open yet
  if (regOpenDate && regOpenDate > now) {
    return {
      status: 'upcoming',
      label: 'Opens Soon',
      color: 'cyan',
      isRegisterable: false,
      remainingSpots: remaining,
      fillPercentage: fillPct,
    }
  }

  // 5. Registration deadline passed or event already started
  if ((regCloseDate && regCloseDate < now) || (startDate && startDate < now)) {
    return {
      status: 'registration_closed',
      label: 'Registration Closed',
      color: 'zinc',
      isRegisterable: false,
      remainingSpots: remaining,
      fillPercentage: fillPct,
    }
  }

  // 6. Capacity status
  if (capacity > 0 && remaining !== null && remaining <= 0) {
    return {
      status: 'sold_out',
      label: 'Sold Out',
      color: 'rose',
      isRegisterable: false,
      remainingSpots: 0,
      fillPercentage: 100,
    }
  }

  if (capacity > 0 && fillPct >= 90) {
    return {
      status: 'almost_full',
      label: `Almost Full (${remaining} left)`,
      color: 'rose',
      isRegisterable: true,
      remainingSpots: remaining,
      fillPercentage: fillPct,
    }
  }

  if (capacity > 0 && fillPct >= 65) {
    return {
      status: 'filling_fast',
      label: 'Filling Fast',
      color: 'amber',
      isRegisterable: true,
      remainingSpots: remaining,
      fillPercentage: fillPct,
    }
  }

  return {
    status: 'open',
    label: 'Registration Open',
    color: 'emerald',
    isRegisterable: true,
    remainingSpots: remaining,
    fillPercentage: fillPct,
  }
}
