/**
 * src/lib/sync.ts
 *
 * Realtime Status Synchronization Hub for FestFlow (Phase 3):
 * - Authoritative backend-driven status synchronization
 * - Supabase Realtime channel subscriptions with graceful fallback
 * - Multi-tab synchronization via BroadcastChannel
 * - Window focus and network reconnect recovery
 * - Anti-stale request sequencing to prevent race conditions
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export type StatusChangeType =
  | 'registration_updated'
  | 'payment_submitted'
  | 'payment_reviewed'
  | 'team_updated'
  | 'invitation_accepted'
  | 'ticket_updated'
  | 'checkin_recorded'
  | 'reconnect'

export interface StatusChangeEvent {
  type: StatusChangeType
  eventId?: string
  registrationId?: string
  teamId?: string
  studentId?: string
  clubId?: string
  timestamp: number
  source?: 'local' | 'broadcast' | 'realtime' | 'system'
  payload?: any
}

const BROADCAST_CHANNEL_NAME = 'festflow_sync_channel'
const WINDOW_EVENT_NAME = 'festflow:status-change'

// Cross-tab broadcast channel instance (browser environments only)
let broadcastChannel: BroadcastChannel | null = null
if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
  try {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
  } catch {
    broadcastChannel = null
  }
}

// Internal listener set for reliable execution across browser and testing runtimes
type StatusListener = (event: StatusChangeEvent) => void
const internalListeners = new Set<StatusListener>()

/**
 * Dispatches a status change across local components, other browser tabs, and Realtime channels.
 */
export function broadcastStatusChange(
  event: Omit<StatusChangeEvent, 'timestamp' | 'source'>
): void {
  const fullEvent: StatusChangeEvent = {
    ...event,
    timestamp: Date.now(),
    source: 'local',
  }

  // 1. Dispatch to internal subscribers
  internalListeners.forEach((listener) => {
    try {
      listener(fullEvent)
    } catch (err) {
      console.warn('[FestFlow Sync] Listener execution error:', err)
    }
  })

  // 2. Dispatch in current window for DOM components
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(WINDOW_EVENT_NAME, { detail: fullEvent }))
    } catch {
      // ignore
    }
  }

  // 3. Broadcast across tabs
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({ ...fullEvent, source: 'broadcast' })
    } catch {
      // ignore
    }
  }

  // 4. Supabase Realtime Broadcast (if live backend configured)
  if (isSupabaseConfigured) {
    try {
      const channel = supabase.channel('festflow-global-sync')
      channel.send({
        type: 'broadcast',
        event: fullEvent.type,
        payload: fullEvent,
      }).catch(() => {})
    } catch {
      // ignore
    }
  }
}

/**
 * Subscribes a view to specified status change types.
 * Returns an unsubscription cleanup function.
 */
export function subscribeToStatusChanges(
  types: StatusChangeType[],
  callback: (event: StatusChangeEvent) => void
): () => void {
  const allowed = new Set(types)

  // Internal subscriber
  const internalSubscriber: StatusListener = (event) => {
    if (allowed.has(event.type)) {
      callback(event)
    }
  }
  internalListeners.add(internalSubscriber)

  // A. Local window event listener
  const handleWindowEvent = (e: Event) => {
    const detail = (e as CustomEvent<StatusChangeEvent>).detail
    if (detail && allowed.has(detail.type)) {
      callback(detail)
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener(WINDOW_EVENT_NAME, handleWindowEvent)
  }

  // B. Cross-tab BroadcastChannel listener
  const handleBroadcastMessage = (e: MessageEvent<StatusChangeEvent>) => {
    const event = e.data
    if (event && allowed.has(event.type)) {
      callback(event)
    }
  }

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleBroadcastMessage)
  }

  // C. Tab focus and online reconnect recovery
  const handleReconnect = () => {
    if (allowed.has('reconnect')) {
      callback({
        type: 'reconnect',
        timestamp: Date.now(),
        source: 'system',
      })
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('focus', handleReconnect)
    window.addEventListener('online', handleReconnect)
  }

  // D. Supabase Realtime Postgres Changes Subscription
  let realtimeChannel: any = null
  if (isSupabaseConfigured) {
    try {
      const channelName = `realtime-sync-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
      realtimeChannel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'registrations' },
          (payload) => {
            const row: any = payload.new || payload.old
            if (allowed.has('registration_updated')) {
              callback({
                type: 'registration_updated',
                registrationId: row?.id,
                eventId: row?.event_id,
                studentId: row?.student_id,
                timestamp: Date.now(),
                source: 'realtime',
                payload: row,
              })
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'payment_submissions' },
          (payload) => {
            const row: any = payload.new || payload.old
            if (allowed.has('payment_reviewed') || allowed.has('payment_submitted')) {
              callback({
                type: row?.status === 'pending_review' ? 'payment_submitted' : 'payment_reviewed',
                registrationId: row?.registration_id,
                eventId: row?.event_id,
                studentId: row?.student_id,
                timestamp: Date.now(),
                source: 'realtime',
                payload: row,
              })
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'team_members' },
          (payload) => {
            const row: any = payload.new || payload.old
            if (allowed.has('team_updated') || allowed.has('invitation_accepted')) {
              callback({
                type: 'team_updated',
                teamId: row?.team_id,
                eventId: row?.event_id,
                studentId: row?.user_id,
                timestamp: Date.now(),
                source: 'realtime',
                payload: row,
              })
            }
          }
        )
        .subscribe()
    } catch {
      realtimeChannel = null
    }
  }

  // Cleanup handler
  return () => {
    internalListeners.delete(internalSubscriber)
    if (typeof window !== 'undefined') {
      window.removeEventListener(WINDOW_EVENT_NAME, handleWindowEvent)
      window.removeEventListener('focus', handleReconnect)
      window.removeEventListener('online', handleReconnect)
    }
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleBroadcastMessage)
    }
    if (realtimeChannel && isSupabaseConfigured) {
      try {
        supabase.removeChannel(realtimeChannel)
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Creates an Anti-Stale Request Guard to ensure delayed network responses
 * do not overwrite newer status updates.
 */
export function createAntiStaleGuard() {
  let latestSeq = 0
  let latestTimestamp = 0

  return {
    /**
     * Call before dispatching an async request to get an issued request ticket.
     */
    startRequest: () => {
      latestSeq += 1
      latestTimestamp = Date.now()
      return latestSeq
    },
    /**
     * Check if the returned response is still the latest before applying state.
     */
    isFresh: (ticket: number) => {
      return ticket >= latestSeq
    },
    /**
     * Explicitly update the freshness ceiling (e.g. on incoming realtime event).
     */
    touch: (timestamp?: number) => {
      latestSeq += 1
      latestTimestamp = timestamp || Date.now()
    },
    /**
     * Returns the timestamp of the latest request or touch.
     */
    getLatestTimestamp: () => latestTimestamp,
    /**
     * Returns the current monotonic sequence counter.
     */
    getLatestSeq: () => latestSeq,
  }
}
