import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { EventDiscussionRecord } from '@/types'

const LOCAL_STORAGE_DISCUSSIONS = 'festflow_local_event_discussions'

let inMemoryDiscussions: EventDiscussionRecord[] | null = null

function getLocalDiscussions(): EventDiscussionRecord[] {
  if (inMemoryDiscussions !== null) return inMemoryDiscussions
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_DISCUSSIONS)
      if (raw) {
        inMemoryDiscussions = JSON.parse(raw)
        return inMemoryDiscussions!
      }
    }
  } catch {
    // ignore
  }
  inMemoryDiscussions = []
  return inMemoryDiscussions
}

function saveLocalDiscussions(discussions: EventDiscussionRecord[]) {
  inMemoryDiscussions = discussions
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_DISCUSSIONS, JSON.stringify(discussions))
    }
  } catch {
    // ignore
  }
}

/**
 * Retrieves threaded Q&A discussions for a specific event.
 */
export async function getEventDiscussions(
  eventId: string
): Promise<{ success: boolean; discussions: EventDiscussionRecord[]; message?: string }> {
  if (!eventId) return { success: false, discussions: [], message: 'Event ID required.' }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('event_discussions') as any)
        .select('*, author:profiles(id, display_name, avatar_url, role)')
        .eq('event_id', eventId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: true })

      if (!error && data) {
        // Assemble tree: Top-level questions and nested replies
        const all = data as EventDiscussionRecord[]
        const rootItems = all.filter((d) => !d.parent_id)
        const replies = all.filter((d) => !!d.parent_id)

        for (const root of rootItems) {
          root.replies = replies.filter((r) => r.parent_id === root.id)
        }
        return { success: true, discussions: rootItems }
      }
    } catch {
      // fallback
    }
  }

  const all = getLocalDiscussions().filter((d) => d.event_id === eventId && !d.is_hidden)
  const rootItems = all.filter((d) => !d.parent_id)
  const replies = all.filter((d) => !!d.parent_id)

  for (const root of rootItems) {
    root.replies = replies.filter((r) => r.parent_id === root.id)
  }

  rootItems.sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return { success: true, discussions: rootItems }
}

/**
 * Posts a new question or reply in an event discussion thread.
 */
export async function postEventComment(params: {
  eventId: string
  userId?: string
  authorId?: string
  content: string
  parentId?: string | null
  isOrganizerResponse?: boolean
  isOrganizer?: boolean
}): Promise<{ success: boolean; comment?: EventDiscussionRecord; message?: string }> {
  const cleanContent = params.content?.trim()
  const uid = params.userId || params.authorId || ''
  if (!params.eventId || !uid || !cleanContent) {
    return { success: false, message: 'Please provide valid comment content.' }
  }

  const isOrg = !!(params.isOrganizerResponse || params.isOrganizer)

  const payload = {
    event_id: params.eventId,
    user_id: uid,
    content: cleanContent,
    parent_id: params.parentId || null,
    is_organizer_response: isOrg,
    is_pinned: false,
    is_hidden: false,
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('event_discussions') as any)
        .insert(payload)
        .select('*, author:profiles(id, display_name, avatar_url, role)')
        .single()

      if (!error && data) {
        const enriched = {
          ...data,
          is_organizer: data.is_organizer_response,
        }
        return { success: true, comment: enriched as EventDiscussionRecord }
      }
      return { success: false, message: error?.message || 'Failed to post comment.' }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Database error posting comment.' }
    }
  }

  const discussions = getLocalDiscussions()
  const newRecord: EventDiscussionRecord = {
    ...payload,
    is_organizer: isOrg,
    id: `disc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    replies: [],
  }
  discussions.push(newRecord)
  saveLocalDiscussions(discussions)

  return { success: true, comment: newRecord }
}

/**
 * Deletes a comment (by author or event organizer).
 */
export async function deleteEventComment(
  commentId: string,
  userId: string
): Promise<{ success: boolean; message?: string }> {
  if (!commentId || !userId) return { success: false, message: 'Invalid delete parameters.' }

  if (isSupabaseConfigured) {
    try {
      const { error } = await (supabase.from('event_discussions') as any)
        .delete()
        .eq('id', commentId)
      if (error) return { success: false, message: error.message }
      return { success: true, message: 'Comment deleted.' }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to delete comment.' }
    }
  }

  const list = getLocalDiscussions().filter((d) => d.id !== commentId && d.parent_id !== commentId)
  saveLocalDiscussions(list)
  return { success: true, message: 'Comment deleted.' }
}

/**
 * Organizers can pin or unpin an important Q&A answer.
 */
export async function togglePinEventComment(
  commentId: string,
  isPinned: boolean
): Promise<{ success: boolean; message?: string }> {
  if (!commentId) return { success: false, message: 'Comment ID required.' }

  if (isSupabaseConfigured) {
    try {
      const { error } = await (supabase.from('event_discussions') as any)
        .update({ is_pinned: isPinned, updated_at: new Date().toISOString() })
        .eq('id', commentId)
      if (error) return { success: false, message: error.message }
      return { success: true, message: isPinned ? 'Answer pinned to top.' : 'Answer unpinned.' }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to toggle pin.' }
    }
  }

  const list = getLocalDiscussions()
  const item = list.find((d) => d.id === commentId)
  if (item) {
    item.is_pinned = isPinned
    item.updated_at = new Date().toISOString()
    saveLocalDiscussions(list)
  }
  return { success: true, message: isPinned ? 'Answer pinned.' : 'Answer unpinned.' }
}

/**
 * Organizers can hide inappropriate or resolved comments.
 */
export async function toggleHideEventComment(
  commentId: string,
  isHidden: boolean
): Promise<{ success: boolean; message?: string }> {
  if (!commentId) return { success: false, message: 'Comment ID required.' }

  if (isSupabaseConfigured) {
    try {
      const { error } = await (supabase.from('event_discussions') as any)
        .update({ is_hidden: isHidden, updated_at: new Date().toISOString() })
        .eq('id', commentId)
      if (error) return { success: false, message: error.message }
      return { success: true, message: isHidden ? 'Comment hidden.' : 'Comment unhidden.' }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to toggle comment visibility.' }
    }
  }

  const list = getLocalDiscussions()
  const item = list.find((d) => d.id === commentId)
  if (item) {
    item.is_hidden = isHidden
    item.updated_at = new Date().toISOString()
    saveLocalDiscussions(list)
  }
  return { success: true, message: isHidden ? 'Comment hidden.' : 'Comment unhidden.' }
}
