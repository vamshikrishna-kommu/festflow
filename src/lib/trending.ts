import type { Event } from '@/types'

export interface TrendingEvent extends Event {
  trendingScore: number
  trendingRank: number
  velocityLabel: string
}

/**
 * Calculates trending campus events based on real registration velocity and proximity.
 * Does not expose private participant info.
 */
export function calculateTrendingEvents(events: Event[], limit = 6): TrendingEvent[] {
  const now = new Date()

  const validEvents = events.filter((evt) => {
    if (evt.status === 'cancelled' || evt.status === 'draft' || evt.status === 'completed') {
      return false
    }
    const start = evt.startDate || evt.date
    if (start && new Date(start) < now) return false
    return true
  })

  const scored = validEvents.map((evt) => {
    const registered = typeof evt.registeredCount === 'number' ? evt.registeredCount : 0
    const capacity = typeof evt.capacity === 'number' && evt.capacity > 0 ? evt.capacity : 100
    const fillRatio = Math.min(registered / capacity, 1.0)

    // Base score from registered headcount
    let score = registered * 3

    // Velocity multiplier: higher fill percentage = higher urgency
    score += fillRatio * 60

    // Proximity factor: events happening in next 1 to 14 days get a bump
    const start = evt.startDate || evt.date
    if (start) {
      const days = (new Date(start).getTime() - now.getTime()) / (1000 * 3600 * 24)
      if (days >= 0 && days <= 7) score += 40
      else if (days > 7 && days <= 14) score += 20
    }

    // Determine clean label
    let velocityLabel = 'Trending on Campus'
    if (fillRatio >= 0.85) {
      velocityLabel = `${Math.round(fillRatio * 100)}% Booked`
    } else if (fillRatio >= 0.6) {
      velocityLabel = 'High Student Demand'
    } else if (registered > 10) {
      velocityLabel = `${registered}+ Registered`
    }

    return {
      ...evt,
      trendingScore: Math.round(score),
      trendingRank: 0,
      velocityLabel,
    }
  })

  scored.sort((a, b) => b.trendingScore - a.trendingScore)

  return scored.slice(0, limit).map((evt, idx) => ({
    ...evt,
    trendingRank: idx + 1,
  }))
}

