import { supabase, isSupabaseConfigured } from './supabase'
import { mapRecordToUiEvent } from './events'
import type { Event, EventRecord } from '@/types'

const LOCAL_STORAGE_PREFIX = 'festflow_wishlist_'

function getLocalWishlistIds(userId: string): string[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${userId}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalWishlistIds(userId: string, ids: string[]): void {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${userId}`, JSON.stringify(ids))
    window.dispatchEvent(new CustomEvent('festflow:wishlist-updated', { detail: { userId, count: ids.length } }))
  } catch {
    // ignore
  }
}

/**
 * Retrieves all saved event IDs for the authenticated student.
 */
export async function getStudentWishlistIds(userId: string): Promise<string[]> {
  if (!userId) return []

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('student_wishlists' as any)
        .select('event_id')
        .eq('user_id', userId)

      if (!error && data) {
        const ids = (data as any[]).map((r) => r.event_id)
        saveLocalWishlistIds(userId, ids)
        return ids
      }
    } catch {
      // fallback to local storage
    }
  }

  return getLocalWishlistIds(userId)
}

/**
 * Retrieves full Event objects in the student's wishlist.
 */
export async function getStudentWishlistEvents(userId: string): Promise<Event[]> {
  if (!userId) return []

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('student_wishlists' as any)
        .select(`
          event_id,
          events (*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        const events: Event[] = []
        const ids: string[] = []
        for (const row of data as any[]) {
          if (row.events) {
            events.push(mapRecordToUiEvent(row.events as EventRecord))
            ids.push(row.event_id)
          }
        }
        saveLocalWishlistIds(userId, ids)
        return events
      }
    } catch {
      // fallback to local cache lookup
    }
  }

  // Local fallback: fetch IDs and match
  const ids = getLocalWishlistIds(userId)
  if (ids.length === 0) return []

  try {
    const { data } = await supabase
      .from('events')
      .select('*')
      .in('id', ids)
    if (data) {
      return (data as EventRecord[]).map(mapRecordToUiEvent)
    }
  } catch {
    // ignore
  }
  return []
}

/**
 * Toggles an event in the student's wishlist (save if absent, remove if present).
 * Returns { saved: boolean } indicating the new state.
 */
export async function toggleWishlist(
  userId: string,
  eventId: string
): Promise<{ saved: boolean; error?: string }> {
  if (!userId || !eventId) {
    return { saved: false, error: 'User ID and Event ID are required.' }
  }

  const currentIds = getLocalWishlistIds(userId)
  const isAlreadySaved = currentIds.includes(eventId)
  const nextSaved = !isAlreadySaved

  // 1. Optimistically update local cache
  const updatedIds = nextSaved
    ? [...currentIds, eventId]
    : currentIds.filter((id) => id !== eventId)
  saveLocalWishlistIds(userId, updatedIds)

  // 2. Persist in Supabase DB if connected
  if (isSupabaseConfigured) {
    try {
      if (nextSaved) {
        const { error: insertErr } = await (supabase.from('student_wishlists') as any)
          .insert({
            user_id: userId,
            event_id: eventId,
          })
        if (insertErr && !insertErr.message.includes('duplicate')) {
          console.warn('[FestFlow Wishlist] Supabase insert note:', insertErr.message)
        }
      } else {
        const { error: delErr } = await (supabase.from('student_wishlists') as any)
          .delete()
          .eq('user_id', userId)
          .eq('event_id', eventId)
        if (delErr) {
          console.warn('[FestFlow Wishlist] Supabase delete note:', delErr.message)
        }
      }
    } catch (err: any) {
      console.warn('[FestFlow Wishlist] Supabase sync fallback:', err?.message)
    }
  }

  return { saved: nextSaved }
}

/**
 * Check if a specific event is in the student's local wishlist cache.
 */
export function isEventSavedSync(userId: string, eventId: string): boolean {
  if (!userId || !eventId) return false
  return getLocalWishlistIds(userId).includes(eventId)
}
