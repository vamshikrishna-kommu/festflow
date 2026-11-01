import type { Event, RegistrationWithEvent } from '@/types'

export interface RecommendedEvent extends Event {
  recommendationReason: string
  recommendationScore: number
}

// Map user interest strings to matching event categories & keywords
const INTEREST_CATEGORY_MAP: Record<string, { categories: string[]; keywords: string[] }> = {
  Technology: { categories: ['tech', 'hackathon', 'workshop', 'seminar'], keywords: ['tech', 'software', 'developer', 'hardware', 'cloud'] },
  Coding: { categories: ['tech', 'hackathon'], keywords: ['code', 'coding', 'programming', 'python', 'java', 'react', 'algorithm', 'dsa'] },
  Hackathons: { categories: ['hackathon', 'tech'], keywords: ['hackathon', 'build', 'prototype', 'hack', 'innovate', 'sprint'] },
  'Artificial Intelligence': { categories: ['tech', 'seminar', 'workshop'], keywords: ['ai', 'ml', 'machine learning', 'deep learning', 'llm', 'gpt', 'neural'] },
  Gaming: { categories: ['gaming', 'sports'], keywords: ['gaming', 'esports', 'lan', 'fifa', 'valorant', 'bgmi', 'tournament'] },
  Music: { categories: ['music', 'cultural'], keywords: ['music', 'band', 'concert', 'singing', 'acoustic', 'dj', 'rhythm'] },
  Dance: { categories: ['cultural'], keywords: ['dance', 'choreography', 'hip hop', 'classical', 'western'] },
  Sports: { categories: ['sports'], keywords: ['sports', 'cricket', 'football', 'badminton', 'basketball', 'chess', 'athletics'] },
  Entrepreneurship: { categories: ['seminar', 'workshop', 'social'], keywords: ['startup', 'pitch', 'business', 'founder', 'venture', 'incubator', 'shark'] },
  Business: { categories: ['seminar', 'workshop'], keywords: ['business', 'marketing', 'finance', 'case study', 'consulting', 'management'] },
  Design: { categories: ['art', 'workshop', 'tech'], keywords: ['design', 'ui', 'ux', 'figma', 'graphic', 'photoshop', 'illustrator'] },
  Photography: { categories: ['art', 'cultural'], keywords: ['photo', 'photography', 'videography', 'film', 'camera', 'visual'] },
  'Cultural Events': { categories: ['cultural', 'music', 'art'], keywords: ['cultural', 'fest', 'drama', 'theatre', 'fashion', 'talent'] },
  Workshops: { categories: ['workshop', 'seminar'], keywords: ['workshop', 'hands-on', 'bootcamp', 'training', 'masterclass'] },
  'Career Development': { categories: ['seminar', 'workshop'], keywords: ['career', 'interview', 'resume', 'internship', 'placement', 'soft skills'] },
}

/**
 * Calculates smart personalized recommendations based on:
 * 1. Student interest profile
 * 2. Categories of past registrations / attendance
 * 3. Saved events (wishlist)
 * 4. Event popularity and available seats
 * Excludes already-registered events and past events.
 */
export function getSmartRecommendations(params: {
  allEvents: Event[]
  studentInterests?: string[] | null
  registrations?: RegistrationWithEvent[]
  wishlistIds?: string[]
  limit?: number
}): RecommendedEvent[] {
  const { allEvents, studentInterests = [], registrations = [], wishlistIds = [], limit = 6 } = params

  const now = new Date()
  const registeredEventIds = new Set(registrations.map((r) => r.event_id).filter(Boolean))

  // 1. Gather historical categories from registrations
  const historicalCategories = new Map<string, number>()
  registrations.forEach((r) => {
    if (r.event?.category) {
      historicalCategories.set(r.event.category, (historicalCategories.get(r.event.category) || 0) + 1)
    }
  })

  // 2. Filter valid upcoming events that the student has not yet registered for
  const candidateEvents = allEvents.filter((evt) => {
    if (registeredEventIds.has(evt.id)) return false
    if (evt.status === 'cancelled' || evt.status === 'draft' || evt.status === 'completed') return false

    const startDate = evt.startDate || evt.date
    if (startDate && new Date(startDate) < now) return false

    return true
  })

  // 3. Score each candidate event
  const scoredEvents: RecommendedEvent[] = candidateEvents.map((evt) => {
    let score = 0
    let primaryReason = 'Popular upcoming event on campus'

    const titleLower = evt.title.toLowerCase()
    const descLower = (evt.description || '').toLowerCase()
    const category = evt.category

    // Factor A: Student Selected Interests Match (+45 to +60 points)
    if (studentInterests && studentInterests.length > 0) {
      for (const interest of studentInterests) {
        const mapping = INTEREST_CATEGORY_MAP[interest]
        if (!mapping) continue

        const isCatMatch = mapping.categories.includes(category)
        const isKeywordMatch = mapping.keywords.some(
          (kw) => titleLower.includes(kw) || descLower.includes(kw)
        )

        if (isCatMatch || isKeywordMatch) {
          score += isCatMatch ? 50 : 35
          primaryReason = `Matches your interest in ${interest}`
          break
        }
      }
    }

    // Factor B: Category Affinity from Past Registrations (+30 points)
    const pastCount = historicalCategories.get(category) || 0
    if (pastCount > 0) {
      score += Math.min(pastCount * 15, 30)
      if (score < 40) {
        primaryReason = `Because you attended ${category} events`
      }
    }

    // Factor C: Wishlist category affinity (+20 points)
    const isWishlisted = wishlistIds.includes(evt.id)
    if (isWishlisted) {
      score += 25
      primaryReason = 'Saved in your wishlist'
    }

    // Factor D: Popularity / Capacity fill velocity (+10 to +25 points)
    const regCount = typeof evt.registeredCount === 'number' ? evt.registeredCount : 0
    const cap = typeof evt.capacity === 'number' ? evt.capacity : 0
    if (cap > 0) {
      const fillRatio = regCount / cap
      if (fillRatio >= 0.5 && fillRatio < 1.0) {
        score += 20
        if (score < 30) primaryReason = 'Trending with high student demand'
      }
    }

    // Factor E: Upcoming Proximity (within next 7-14 days)
    const start = evt.startDate || evt.date
    if (start) {
      const daysUntil = (new Date(start).getTime() - now.getTime()) / (1000 * 3600 * 24)
      if (daysUntil > 0 && daysUntil <= 10) {
        score += 15
      }
    }

    // Fallback reason for new students
    if (score === 0 || primaryReason.startsWith('Popular upcoming')) {
      if (evt.isFree) {
        primaryReason = 'Free entry for all campus students'
      } else {
        primaryReason = `Top pick in ${category.toUpperCase()}`
      }
    }

    return {
      ...evt,
      recommendationReason: primaryReason,
      recommendationScore: score,
    }
  })

  // 4. Sort by highest recommendation score, then by upcoming date
  scoredEvents.sort((a, b) => {
    if (b.recommendationScore !== a.recommendationScore) {
      return b.recommendationScore - a.recommendationScore
    }
    const dateA = new Date(a.startDate || a.date).getTime()
    const dateB = new Date(b.startDate || b.date).getTime()
    return dateA - dateB
  })

  return scoredEvents.slice(0, limit)
}

