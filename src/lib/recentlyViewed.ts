import { supabase, isSupabaseConfigured } from './supabase'
import { mapRecordToUiEvent } from './events'
import type { Event, EventRecord } from '@/types'

const LOCAL_STORAGE_PREFIX = 'festflow_recently_viewed_'
const MAX_RECENT_ITEMS = 10

interface CachedViewItem {
  id: string
  viewedAt: number
  event: Event
}

function getLocalRecent(userId: string): CachedViewItem[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${userId}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalRecent(userId: string, items: CachedViewItem[]): void {
  try {
    localStorage.setItem(
      `${LOCAL_STORAGE_PREFIX}${userId}`,
      JSON.stringify(items.slice(0, MAX_RECENT_ITEMS))
    )
  } catch {
    // ignore
  }
}

/**
 * Records an event view for the authenticated student.
 * Deduplicates and moves to the top of the list.
 */
export async function recordRecentlyViewed(userId: string, event: Event): Promise<void> {
  if (!userId || !event?.id) return

  // 1. Optimistic local cache update
  const current = getLocalRecent(userId)
  const filtered = current.filter((item) => item.id !== event.id)
  const updated: CachedViewItem[] = [
    { id: event.id, viewedAt: Date.now(), event },
    ...filtered,
  ].slice(0, MAX_RECENT_ITEMS)
  saveLocalRecent(userId, updated)

  // 2. Persist in Supabase DB if available
  if (isSupabaseConfigured) {
    try {
      await (supabase.from('recently_viewed_events') as any).upsert(
          {
            user_id: userId,
            event_id: event.id,
            viewed_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,event_id' }
        )
    } catch {
      // non-blocking fallback
    }
  }
}

/**
 * Retrieves the student's recently viewed events.
 */
export async function getRecentlyViewedEvents(userId: string): Promise<Event[]> {
  if (!userId) return []

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('recently_viewed_events' as any)
        .select(`
          event_id,
          viewed_at,
          events (*)
        `)
        .eq('user_id', userId)
        .order('viewed_at', { ascending: false })
        .limit(MAX_RECENT_ITEMS)

      if (!error && data && data.length > 0) {
        const events: Event[] = []
        for (const row of data as any[]) {
          if (row.events) {
            events.push(mapRecordToUiEvent(row.events as EventRecord))
          }
        }
        return events
      }
    } catch {
      // fallback to local storage
    }
  }

  // Fallback to local storage
  return getLocalRecent(userId).map((item) => item.event)
}

/**
 * Clears recently viewed event history for the student.
 */
export async function clearRecentlyViewedEvents(userId: string): Promise<void> {
  if (!userId) return

  // 1. Clear local cache
  try {
    localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${userId}`)
  } catch {
    // ignore
  }

  // 2. Clear from Supabase
  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('recently_viewed_events' as any)
        .delete()
        .eq('user_id', userId)
    } catch {
      // ignore
    }
  }
}
