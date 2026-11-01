import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { EventFeedbackRecord } from '@/types'

const LOCAL_STORAGE_FEEDBACK_KEY = 'festflow_local_event_feedback'

function getLocalFeedback(): EventFeedbackRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_FEEDBACK_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // fallback
  }
  return []
}

function saveLocalFeedback(feedbacks: EventFeedbackRecord[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_FEEDBACK_KEY, JSON.stringify(feedbacks))
  } catch {
    // fallback
  }
}

export interface FeedbackSummary {
  averageRating: number
  totalReviews: number
  ratingCounts: { [stars: number]: number }
  recommendationPercentage: number
}

/**
 * Get all feedback for an event, masking user identity if is_anonymous is true
 */
export async function getEventFeedback(
  eventId: string
): Promise<{ feedback: EventFeedbackRecord[]; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('event_feedback') as any)
        .select(`
          *,
          user:user_id (
            id,
            display_name,
            avatar_url
          )
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        // Sanitize anonymous reviews
        const sanitized = data.map((fb: any) => {
          if (fb.is_anonymous) {
            return {
              ...fb,
              user: {
                id: 'anonymous',
                display_name: 'Verified Attendee (Anonymous)',
                avatar_url: null,
              },
            }
          }
          return fb
        })
        return { feedback: sanitized }
      }
    } catch (e: any) {
      console.warn('[FestFlow Feedback] Query note:', e.message)
    }
  }

  const local = getLocalFeedback()
    .filter((fb) => fb.event_id === eventId)
    .map((fb) => {
      if (fb.is_anonymous) {
        return {
          ...fb,
          user: {
            id: 'anonymous',
            display_name: 'Verified Attendee (Anonymous)',
            avatar_url: null,
          } as any,
        }
      }
      return fb
    })

  return { feedback: local }
}

/**
 * Submit post-event attendee feedback
 */
export async function submitEventFeedback(params: {
  eventId: string
  userId: string
  rating: number
  comment?: string
  isAnonymous?: boolean
}): Promise<{ feedback?: EventFeedbackRecord; error?: string }> {
  if (params.rating < 1 || params.rating > 5) {
    return { error: 'Rating must be between 1 and 5 stars.' }
  }

  const newRecord: EventFeedbackRecord = {
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    event_id: params.eventId,
    user_id: params.userId,
    rating: params.rating,
    comment: params.comment?.trim() || null,
    is_anonymous: Boolean(params.isAnonymous),
    created_at: new Date().toISOString(),
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('event_feedback') as any)
        .insert({
          event_id: newRecord.event_id,
          user_id: newRecord.user_id,
          rating: newRecord.rating,
          comment: newRecord.comment,
          is_anonymous: newRecord.is_anonymous,
        })
        .select()
        .single()

      if (!error && data) {
        return { feedback: data }
      }
    } catch (e: any) {
      console.warn('[FestFlow Feedback] Insert note, persisting locally:', e.message)
    }
  }

  const local = getLocalFeedback()
  // Replace if existing
  const existingIndex = local.findIndex(
    (fb) => fb.event_id === params.eventId && fb.user_id === params.userId
  )
  if (existingIndex >= 0) {
    local[existingIndex] = newRecord
  } else {
    local.unshift(newRecord)
  }
  saveLocalFeedback(local)

  return { feedback: newRecord }
}

/**
 * Calculate summary statistics for an event's ratings
 */
export async function getEventFeedbackSummary(
  eventId: string
): Promise<FeedbackSummary> {
  const { feedback } = await getEventFeedback(eventId)
  if (feedback.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingCounts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      recommendationPercentage: 0,
    }
  }

  const counts: { [stars: number]: number } = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  let sum = 0
  let positiveCount = 0

  for (const item of feedback) {
    const r = Math.min(5, Math.max(1, Math.round(item.rating)))
    counts[r] = (counts[r] || 0) + 1
    sum += item.rating
    if (item.rating >= 4) positiveCount++
  }

  const avg = Number((sum / feedback.length).toFixed(1))
  const recPct = Math.round((positiveCount / feedback.length) * 100)

  return {
    averageRating: avg,
    totalReviews: feedback.length,
    ratingCounts: counts,
    recommendationPercentage: recPct,
  }
}

