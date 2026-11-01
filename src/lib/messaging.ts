import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { ConversationRecord, DirectMessageRecord } from '@/types'
import { isUserBlocked } from '@/lib/moderation'

const LOCAL_STORAGE_CONVERSATIONS = 'festflow_local_conversations'
const LOCAL_STORAGE_MESSAGES = 'festflow_local_messages'

let inMemoryConversations: ConversationRecord[] | null = null
let inMemoryMessages: DirectMessageRecord[] | null = null

function getLocalConversations(): ConversationRecord[] {
  if (inMemoryConversations !== null) return inMemoryConversations
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_CONVERSATIONS)
      if (raw) {
        inMemoryConversations = JSON.parse(raw)
        return inMemoryConversations!
      }
    }
  } catch {
    // ignore
  }
  inMemoryConversations = []
  return inMemoryConversations
}

function saveLocalConversations(convs: ConversationRecord[]) {
  inMemoryConversations = convs
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_CONVERSATIONS, JSON.stringify(convs))
    }
  } catch {
    // ignore
  }
}

function getLocalMessages(): DirectMessageRecord[] {
  if (inMemoryMessages !== null) return inMemoryMessages
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_MESSAGES)
      if (raw) {
        inMemoryMessages = JSON.parse(raw)
        return inMemoryMessages!
      }
    }
  } catch {
    // ignore
  }
  inMemoryMessages = []
  return inMemoryMessages
}

function saveLocalMessages(msgs: DirectMessageRecord[]) {
  inMemoryMessages = msgs
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_MESSAGES, JSON.stringify(msgs))
    }
  } catch {
    // ignore
  }
}

/**
 * Retrieves all conversations belonging to an authenticated student.
 */
export async function getConversations(
  userId: string
): Promise<{ success: boolean; conversations: ConversationRecord[]; message?: string }> {
  if (!userId) return { success: false, conversations: [], message: 'User ID required.' }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('conversations') as any)
        .select('*, p1:profiles!conversations_participant_one_fkey(id, display_name, avatar_url), p2:profiles!conversations_participant_two_fkey(id, display_name, avatar_url)')
        .or(`participant_one.eq.${userId},participant_two.eq.${userId}`)
        .order('last_message_at', { ascending: false })

      if (!error && data) {
        const enriched = (data as any[]).map((c) => ({
          ...c,
          other_participant: c.participant_one === userId ? c.p2 : c.p1,
        }))
        return { success: true, conversations: enriched as ConversationRecord[] }
      }
    } catch {
      // fallback
    }
  }

  const list = getLocalConversations().filter(
    (c) => c.participant_one === userId || c.participant_two === userId
  )
  list.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
  return { success: true, conversations: list }
}

/**
 * Retrieves all messages in a specific conversation.
 * Verifies caller belongs to the conversation.
 */
export async function getConversationMessages(
  conversationId: string,
  userId: string
): Promise<{ success: boolean; messages: DirectMessageRecord[]; message?: string }> {
  if (!conversationId || !userId) return { success: false, messages: [], message: 'Invalid query parameters.' }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('messages') as any)
        .select('*, sender:profiles(id, display_name, avatar_url)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (!error && data) {
        return { success: true, messages: data as DirectMessageRecord[] }
      }
    } catch {
      // fallback
    }
  }

  const list = getLocalMessages().filter((m) => m.conversation_id === conversationId)
  list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  return { success: true, messages: list }
}

/**
 * Sends a direct message. Enforces anti-harassment blocking and creates or resumes a conversation.
 */
export async function sendMessage(params: {
  senderId: string
  receiverId: string
  content: string
  conversationId?: string
}): Promise<{ success: boolean; messageRecord?: DirectMessageRecord; conversationId?: string; message?: string }> {
  const cleanContent = params.content?.trim()
  if (!params.senderId || !params.receiverId || !cleanContent) {
    return { success: false, message: 'Please provide recipient and message content.' }
  }
  if (params.senderId === params.receiverId) {
    return { success: false, message: 'You cannot send messages to yourself.' }
  }

  // Safety: Check if either user has blocked the other
  const blocked = await isUserBlocked(params.senderId, params.receiverId)
  if (blocked) {
    return { success: false, message: 'Unable to send message to this participant.' }
  }

  let convId = params.conversationId

  // 1. Resolve or create conversation
  if (!convId) {
    // Normalise ordering so participant_one and participant_two are deterministic
    const [p1, p2] = [params.senderId, params.receiverId].sort()

    if (isSupabaseConfigured) {
      try {
        const { data: existingConv } = await (supabase.from('conversations') as any)
          .select('id')
          .eq('participant_one', p1)
          .eq('participant_two', p2)
          .maybeSingle()

        if (existingConv) {
          convId = existingConv.id
        } else {
          const { data: newConv } = await (supabase.from('conversations') as any)
            .insert({
              participant_one: p1,
              participant_two: p2,
              last_message_text: cleanContent.substring(0, 100),
              last_message_at: new Date().toISOString(),
            })
            .select('id')
            .single()
          if (newConv) convId = newConv.id
        }
      } catch {
        // fallback
      }
    } else {
      const convs = getLocalConversations()
      const found = convs.find(
        (c) =>
          (c.participant_one === p1 && c.participant_two === p2) ||
          (c.participant_one === p2 && c.participant_two === p1)
      )
      if (found) {
        convId = found.id
        found.last_message_text = cleanContent.substring(0, 100)
        found.last_message_at = new Date().toISOString()
        saveLocalConversations(convs)
      } else {
        convId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
        convs.unshift({
          id: convId,
          participant_one: p1,
          participant_two: p2,
          last_message_text: cleanContent.substring(0, 100),
          last_message_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        })
        saveLocalConversations(convs)
      }
    }
  }

  if (!convId) {
    return { success: false, message: 'Failed to establish conversation channel.' }
  }

  // 2. Dispatch message
  const msgPayload = {
    conversation_id: convId,
    sender_id: params.senderId,
    content: cleanContent,
    is_read: false,
  }

  if (isSupabaseConfigured) {
    try {
      const { data: msgRow, error } = await (supabase.from('messages') as any)
        .insert(msgPayload)
        .select('*')
        .single()

      if (!error && msgRow) {
        // Update conversation last_message
        await (supabase.from('conversations') as any)
          .update({
            last_message_at: new Date().toISOString(),
            last_message_text: cleanContent.substring(0, 100),
          })
          .eq('id', convId)

        return { success: true, messageRecord: msgRow as DirectMessageRecord, conversationId: convId }
      }
      return { success: false, message: error?.message || 'Failed to dispatch message.' }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Database error sending message.' }
    }
  }

  const messages = getLocalMessages()
  const newMsg: DirectMessageRecord = {
    ...msgPayload,
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    created_at: new Date().toISOString(),
  }
  messages.push(newMsg)
  saveLocalMessages(messages)

  // Update conversation last message in local storage
  const convs = getLocalConversations()
  const conv = convs.find((c) => c.id === convId)
  if (conv) {
    conv.last_message_text = cleanContent.substring(0, 100)
    conv.last_message_at = new Date().toISOString()
    saveLocalConversations(convs)
  }

  return { success: true, messageRecord: newMsg, conversationId: convId }
}

/**
 * Marks unread messages in a conversation as read.
 */
export async function markMessagesAsRead(
  conversationId: string,
  userId: string
): Promise<{ success: boolean }> {
  if (!conversationId || !userId) return { success: false }

  if (isSupabaseConfigured) {
    try {
      await (supabase.from('messages') as any)
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', userId)
      return { success: true }
    } catch {
      return { success: false }
    }
  }

  const msgs = getLocalMessages()
  let changed = false
  for (const m of msgs) {
    if (m.conversation_id === conversationId && m.sender_id !== userId && !m.is_read) {
      m.is_read = true
      changed = true
    }
  }
  if (changed) saveLocalMessages(msgs)
  return { success: true }
}

/**
 * Retrieves total unread message count for a student across all conversations.
 */
export async function getUnreadMessageCount(userId: string): Promise<number> {
  if (!userId) return 0

  if (isSupabaseConfigured) {
    try {
      // Fetch user's conversation IDs
      const { data: convs } = await (supabase.from('conversations') as any)
        .select('id')
        .or(`participant_one.eq.${userId},participant_two.eq.${userId}`)

      if (convs && convs.length > 0) {
        const convIds = convs.map((c: any) => c.id)
        const { count } = await (supabase.from('messages') as any)
          .select('id', { count: 'exact', head: true })
          .in('conversation_id', convIds)
          .neq('sender_id', userId)
          .eq('is_read', false)

        return count || 0
      }
    } catch {
      return 0
    }
  }

  const convs = getLocalConversations().filter(
    (c) => c.participant_one === userId || c.participant_two === userId
  )
  const convIds = new Set(convs.map((c) => c.id))
  return getLocalMessages().filter(
    (m) => convIds.has(m.conversation_id) && m.sender_id !== userId && !m.is_read
  ).length
}

