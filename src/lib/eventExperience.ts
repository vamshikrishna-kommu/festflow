import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { isEventCompleted } from '@/lib/events'
import type {
  EventTicketTier,
  EventScheduleItem,
  EventSpeaker,
  EventGalleryImage,
  EventAnnouncement,
  EventLeaderboardEntry,
  EventAddon,
  EventOnlineDetails,
  RelatedEventSummary,
} from '@/types'

const db = supabase as any

// ── Local Storage Fallback Keys ───────────────────────────────────────────────
const STORAGE_TIERS_KEY = 'festflow_event_ticket_tiers'
const STORAGE_SCHEDULES_KEY = 'festflow_event_schedules'
const STORAGE_SPEAKERS_KEY = 'festflow_event_speakers'
const STORAGE_GALLERY_KEY = 'festflow_event_gallery'
const STORAGE_ANNOUNCEMENTS_KEY = 'festflow_event_announcements'
const STORAGE_LEADERBOARD_KEY = 'festflow_event_leaderboard'
const STORAGE_ADDONS_KEY = 'festflow_event_addons'

function getLocalStore<T>(key: string): T[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function setLocalStore<T>(key: string, data: T[]) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // ignore
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. TICKET CATEGORIES & TIERS
// ══════════════════════════════════════════════════════════════════════════════
export async function getEventTicketTiers(eventId: string): Promise<EventTicketTier[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await db.from('event_ticket_tiers')
        .select('*')
        .eq('event_id', eventId)
        .order('sort_order', { ascending: true })
        .order('price', { ascending: true })

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((t: any) => ({
          ...t,
          perks: Array.isArray(t.perks) ? t.perks : typeof t.perks === 'string' ? JSON.parse(t.perks) : [],
        }))
      }
    } catch {
      // fallback to local storage
    }
  }

  const all = getLocalStore<EventTicketTier>(STORAGE_TIERS_KEY)
  const filtered = all.filter((t) => t.event_id === eventId)
  if (filtered.length > 0) return filtered

  return []
}

export async function saveTicketTier(
  tier: Partial<EventTicketTier> & { event_id: string; name: string }
): Promise<{ success: boolean; tier?: EventTicketTier; error?: string }> {
  const id = tier.id || crypto.randomUUID()
  const now = new Date().toISOString()
  const payload: EventTicketTier = {
    id,
    event_id: tier.event_id,
    name: tier.name.trim(),
    tier_type: tier.tier_type || 'standard',
    description: tier.description?.trim() || null,
    price: Number(tier.price) >= 0 ? Number(tier.price) : 0,
    original_price: tier.original_price ? Number(tier.original_price) : null,
    capacity: Number(tier.capacity) > 0 ? Number(tier.capacity) : 100,
    sold_count: Number(tier.sold_count) || 0,
    available_from: tier.available_from || null,
    available_until: tier.available_until || null,
    perks: Array.isArray(tier.perks) ? tier.perks : [],
    is_active: tier.is_active ?? true,
    max_per_order: Number(tier.max_per_order) > 0 ? Number(tier.max_per_order) : 1,
    eligibility: tier.eligibility?.trim() || null,
    sort_order: Number(tier.sort_order) || 0,
    created_at: tier.created_at || now,
    updated_at: now,
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await db.from('event_ticket_tiers')
        .upsert(payload)
        .select()
        .single()

      if (!error && data) {
        return { success: true, tier: data as EventTicketTier }
      }
      if (error) {
        console.warn('Supabase tier save error:', error.message)
      }
    } catch (e: any) {
      console.warn('Supabase tier save exception:', e?.message)
    }
  }

  // Local fallback
  const all = getLocalStore<EventTicketTier>(STORAGE_TIERS_KEY)
  const idx = all.findIndex((t) => t.id === id)
  if (idx >= 0) {
    all[idx] = payload
  } else {
    all.push(payload)
  }
  setLocalStore(STORAGE_TIERS_KEY, all)
  return { success: true, tier: payload }
}

export async function deleteTicketTier(tierId: string): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await db.from('event_ticket_tiers').delete().eq('id', tierId)
      if (error) return { success: false, error: error.message }
    } catch {
      // proceed to fallback
    }
  }

  const all = getLocalStore<EventTicketTier>(STORAGE_TIERS_KEY).filter((t) => t.id !== tierId)
  setLocalStore(STORAGE_TIERS_KEY, all)
  return { success: true }
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. EVENT SCHEDULE & TIMELINE
// ══════════════════════════════════════════════════════════════════════════════
export async function getEventSchedules(eventId: string): Promise<EventScheduleItem[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await db.from('event_schedules')
        .select('*')
        .eq('event_id', eventId)
        .order('day_number', { ascending: true })
        .order('start_time', { ascending: true })
        .order('sort_order', { ascending: true })

      if (!error && Array.isArray(data) && data.length > 0) {
        return data as EventScheduleItem[]
      }
    } catch {
      // fallback
    }
  }

  const all = getLocalStore<EventScheduleItem>(STORAGE_SCHEDULES_KEY)
  const filtered = all.filter((s) => s.event_id === eventId)
  return filtered.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
}

export async function saveEventSchedule(
  item: Partial<EventScheduleItem> & { event_id: string; title: string; start_time: string }
): Promise<{ success: boolean; item?: EventScheduleItem; error?: string }> {
  const id = item.id || crypto.randomUUID()
  const now = new Date().toISOString()
  const payload: EventScheduleItem = {
    id,
    event_id: item.event_id,
    day_number: item.day_number || 1,
    start_time: item.start_time,
    end_time: item.end_time || null,
    title: item.title.trim(),
    description: item.description?.trim() || null,
    speaker_name: item.speaker_name?.trim() || null,
    venue_stage: item.venue_stage?.trim() || null,
    category: item.category || 'general',
    sort_order: Number(item.sort_order) || 0,
    created_at: item.created_at || now,
    updated_at: now,
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await db.from('event_schedules')
        .upsert(payload)
        .select()
        .single()

      if (!error && data) {
        return { success: true, item: data as EventScheduleItem }
      }
    } catch (e: any) {
      console.warn('Schedule save exception:', e?.message)
    }
  }

  const all = getLocalStore<EventScheduleItem>(STORAGE_SCHEDULES_KEY)
  const idx = all.findIndex((s) => s.id === id)
  if (idx >= 0) all[idx] = payload
  else all.push(payload)
  setLocalStore(STORAGE_SCHEDULES_KEY, all)
  return { success: true, item: payload }
}

export async function deleteEventSchedule(scheduleId: string): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await db.from('event_schedules').delete().eq('id', scheduleId)
      if (error) return { success: false, error: error.message }
    } catch {
      // fallback
    }
  }

  const all = getLocalStore<EventScheduleItem>(STORAGE_SCHEDULES_KEY).filter((s) => s.id !== scheduleId)
  setLocalStore(STORAGE_SCHEDULES_KEY, all)
  return { success: true }
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. SPEAKER & JUDGE PROFILES
// ══════════════════════════════════════════════════════════════════════════════
export async function getEventSpeakers(eventId: string): Promise<EventSpeaker[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await db.from('event_speakers')
        .select('*')
        .eq('event_id', eventId)
        .order('sort_order', { ascending: true })

      if (!error && Array.isArray(data) && data.length > 0) {
        return data as EventSpeaker[]
      }
    } catch {
      // fallback
    }
  }

  const all = getLocalStore<EventSpeaker>(STORAGE_SPEAKERS_KEY)
  return all.filter((s) => s.event_id === eventId).sort((a, b) => a.sort_order - b.sort_order)
}

export async function saveEventSpeaker(
  speaker: Partial<EventSpeaker> & { event_id: string; name: string }
): Promise<{ success: boolean; speaker?: EventSpeaker; error?: string }> {
  const id = speaker.id || crypto.randomUUID()
  const now = new Date().toISOString()
  const payload: EventSpeaker = {
    id,
    event_id: speaker.event_id,
    name: speaker.name.trim(),
    designation: speaker.designation?.trim() || null,
    organization: speaker.organization?.trim() || null,
    bio: speaker.bio?.trim() || null,
    avatar_url: speaker.avatar_url || null,
    role: speaker.role || 'speaker',
    social_links: speaker.social_links || {},
    sort_order: Number(speaker.sort_order) || 0,
    created_at: speaker.created_at || now,
    updated_at: now,
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await db.from('event_speakers')
        .upsert(payload)
        .select()
        .single()

      if (!error && data) {
        return { success: true, speaker: data as EventSpeaker }
      }
    } catch (e: any) {
      console.warn('Speaker save exception:', e?.message)
    }
  }

  const all = getLocalStore<EventSpeaker>(STORAGE_SPEAKERS_KEY)
  const idx = all.findIndex((s) => s.id === id)
  if (idx >= 0) all[idx] = payload
  else all.push(payload)
  setLocalStore(STORAGE_SPEAKERS_KEY, all)
  return { success: true, speaker: payload }
}

export async function deleteEventSpeaker(speakerId: string): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await db.from('event_speakers').delete().eq('id', speakerId)
      if (error) return { success: false, error: error.message }
    } catch {
      // fallback
    }
  }

  const all = getLocalStore<EventSpeaker>(STORAGE_SPEAKERS_KEY).filter((s) => s.id !== speakerId)
  setLocalStore(STORAGE_SPEAKERS_KEY, all)
  return { success: true }
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. EVENT GALLERIES
// ══════════════════════════════════════════════════════════════════════════════
export async function getEventGallery(eventId: string): Promise<EventGalleryImage[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await db.from('event_gallery_images')
        .select('*')
        .eq('event_id', eventId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })

      if (!error && Array.isArray(data) && data.length > 0) {
        return data as EventGalleryImage[]
      }
    } catch {
      // fallback
    }
  }

  const all = getLocalStore<EventGalleryImage>(STORAGE_GALLERY_KEY)
  return all.filter((g) => g.event_id === eventId)
}

export async function uploadEventGalleryImage(
  eventId: string,
  imageUrl: string,
  caption?: string,
  tags?: string[]
): Promise<{ success: boolean; image?: EventGalleryImage; error?: string }> {
  const id = crypto.randomUUID()
  const payload: EventGalleryImage = {
    id,
    event_id: eventId,
    image_url: imageUrl,
    caption: caption?.trim() || null,
    tags: Array.isArray(tags) ? tags : [],
    sort_order: 0,
    created_at: new Date().toISOString(),
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await db.from('event_gallery_images')
        .insert(payload)
        .select()
        .single()

      if (!error && data) {
        return { success: true, image: data as EventGalleryImage }
      }
    } catch (e: any) {
      console.warn('Gallery save exception:', e?.message)
    }
  }

  const all = getLocalStore<EventGalleryImage>(STORAGE_GALLERY_KEY)
  all.unshift(payload)
  setLocalStore(STORAGE_GALLERY_KEY, all)
  return { success: true, image: payload }
}

export async function deleteEventGalleryImage(imageId: string): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await db.from('event_gallery_images').delete().eq('id', imageId)
      if (error) return { success: false, error: error.message }
    } catch {
      // fallback
    }
  }

  const all = getLocalStore<EventGalleryImage>(STORAGE_GALLERY_KEY).filter((img) => img.id !== imageId)
  setLocalStore(STORAGE_GALLERY_KEY, all)
  return { success: true }
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. LIVE EVENT ANNOUNCEMENTS
// ══════════════════════════════════════════════════════════════════════════════
export async function getEventAnnouncements(eventId: string): Promise<EventAnnouncement[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await db.from('event_announcements')
        .select('*')
        .eq('event_id', eventId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })

      if (!error && Array.isArray(data) && data.length > 0) {
        return data as EventAnnouncement[]
      }
    } catch {
      // fallback
    }
  }

  const all = getLocalStore<EventAnnouncement>(STORAGE_ANNOUNCEMENTS_KEY)
  return all
    .filter((a) => a.event_id === eventId)
    .sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export async function publishEventAnnouncement(
  announcement: Partial<EventAnnouncement> & { event_id: string; club_id: string; title: string; content: string }
): Promise<{ success: boolean; announcement?: EventAnnouncement; error?: string }> {
  const id = announcement.id || crypto.randomUUID()
  const now = new Date().toISOString()
  const payload: EventAnnouncement = {
    id,
    event_id: announcement.event_id,
    club_id: announcement.club_id,
    author_id: announcement.author_id || null,
    title: announcement.title.trim(),
    content: announcement.content.trim(),
    priority: announcement.priority || 'normal',
    is_pinned: announcement.is_pinned ?? false,
    created_at: announcement.created_at || now,
    updated_at: now,
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await db.from('event_announcements')
        .upsert(payload)
        .select()
        .single()

      if (!error && data) {
        // Dispatch in-app notifications to all registered students of this event
        try {
          const { data: attendees } = await db.from('registrations')
            .select('student_id')
            .eq('event_id', announcement.event_id)
            .in('status', ['confirmed', 'pending_payment', 'pending_approval'])

          if (Array.isArray(attendees) && attendees.length > 0) {
            const notifs = attendees.map((att: any) => ({
              user_id: att.student_id,
              title: `📢 Event Update: ${payload.title}`,
              message: payload.content.length > 140 ? `${payload.content.slice(0, 137)}...` : payload.content,
              type: 'event_announcement',
              link: `/events/${announcement.event_id}`,
              is_read: false,
              created_at: now,
            }))
            await db.from('in_app_notifications').insert(notifs)
          }
        } catch {
          // ignore notification failure
        }

        return { success: true, announcement: data as EventAnnouncement }
      }
    } catch (e: any) {
      console.warn('Announcement save exception:', e?.message)
    }
  }

  const all = getLocalStore<EventAnnouncement>(STORAGE_ANNOUNCEMENTS_KEY)
  const idx = all.findIndex((a) => a.id === id)
  if (idx >= 0) all[idx] = payload
  else all.unshift(payload)
  setLocalStore(STORAGE_ANNOUNCEMENTS_KEY, all)
  return { success: true, announcement: payload }
}

export async function deleteEventAnnouncement(announcementId: string): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await db.from('event_announcements').delete().eq('id', announcementId)
      if (error) return { success: false, error: error.message }
    } catch {
      // fallback
    }
  }

  const all = getLocalStore<EventAnnouncement>(STORAGE_ANNOUNCEMENTS_KEY).filter((a) => a.id !== announcementId)
  setLocalStore(STORAGE_ANNOUNCEMENTS_KEY, all)
  return { success: true }
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. COMPETITION LEADERBOARDS
// ══════════════════════════════════════════════════════════════════════════════
export async function getEventLeaderboard(eventId: string): Promise<EventLeaderboardEntry[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await db.from('event_leaderboard_entries')
        .select('*')
        .eq('event_id', eventId)
        .order('rank', { ascending: true })
        .order('score', { ascending: false })

      if (!error && Array.isArray(data) && data.length > 0) {
        return data as EventLeaderboardEntry[]
      }
    } catch {
      // fallback
    }
  }

  const all = getLocalStore<EventLeaderboardEntry>(STORAGE_LEADERBOARD_KEY)
  return all
    .filter((e) => e.event_id === eventId)
    .sort((a, b) => (a.rank || 999) - (b.rank || 999) || b.score - a.score)
}

export async function saveLeaderboardEntry(
  entry: Partial<EventLeaderboardEntry> & { event_id: string; participant_name: string; score: number }
): Promise<{ success: boolean; entry?: EventLeaderboardEntry; error?: string }> {
  const id = entry.id || crypto.randomUUID()
  const now = new Date().toISOString()
  const payload: EventLeaderboardEntry = {
    id,
    event_id: entry.event_id,
    participant_id: entry.participant_id || null,
    team_id: entry.team_id || null,
    participant_name: entry.participant_name.trim(),
    team_name: entry.team_name?.trim() || null,
    score: Number(entry.score) || 0,
    rank: entry.rank ? Number(entry.rank) : null,
    submission_status: entry.submission_status || 'submitted',
    notes: entry.notes?.trim() || null,
    created_at: entry.created_at || now,
    updated_at: now,
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await db.from('event_leaderboard_entries')
        .upsert(payload)
        .select()
        .single()

      if (!error && data) {
        return { success: true, entry: data as EventLeaderboardEntry }
      }
    } catch (e: any) {
      console.warn('Leaderboard save exception:', e?.message)
    }
  }

  const all = getLocalStore<EventLeaderboardEntry>(STORAGE_LEADERBOARD_KEY)
  const idx = all.findIndex((e) => e.id === id)
  if (idx >= 0) all[idx] = payload
  else all.push(payload)
  setLocalStore(STORAGE_LEADERBOARD_KEY, all)
  return { success: true, entry: payload }
}

export async function deleteLeaderboardEntry(entryId: string): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await db.from('event_leaderboard_entries').delete().eq('id', entryId)
      if (error) return { success: false, error: error.message }
    } catch {
      // fallback
    }
  }

  const all = getLocalStore<EventLeaderboardEntry>(STORAGE_LEADERBOARD_KEY).filter((e) => e.id !== entryId)
  setLocalStore(STORAGE_LEADERBOARD_KEY, all)
  return { success: true }
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. EVENT MERCHANDISE & ADD-ONS
// ══════════════════════════════════════════════════════════════════════════════
export async function getEventAddons(eventId: string): Promise<EventAddon[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await db.from('event_addons')
        .select('*')
        .eq('event_id', eventId)
        .order('price', { ascending: true })

      if (!error && Array.isArray(data) && data.length > 0) {
        return data as EventAddon[]
      }
    } catch {
      // fallback
    }
  }

  const all = getLocalStore<EventAddon>(STORAGE_ADDONS_KEY)
  return all.filter((a) => a.event_id === eventId)
}

export async function saveEventAddon(
  addon: Partial<EventAddon> & { event_id: string; name: string; price: number }
): Promise<{ success: boolean; addon?: EventAddon; error?: string }> {
  const id = addon.id || crypto.randomUUID()
  const now = new Date().toISOString()
  const payload: EventAddon = {
    id,
    event_id: addon.event_id,
    name: addon.name.trim(),
    description: addon.description?.trim() || null,
    image_url: addon.image_url || null,
    price: Number(addon.price) >= 0 ? Number(addon.price) : 0,
    stock_quantity: Number(addon.stock_quantity) >= 0 ? Number(addon.stock_quantity) : 100,
    sold_quantity: Number(addon.sold_quantity) || 0,
    is_active: addon.is_active ?? true,
    max_per_user: Number(addon.max_per_user) > 0 ? Number(addon.max_per_user) : 2,
    created_at: addon.created_at || now,
    updated_at: now,
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await db.from('event_addons')
        .upsert(payload)
        .select()
        .single()

      if (!error && data) {
        return { success: true, addon: data as EventAddon }
      }
    } catch (e: any) {
      console.warn('Addon save exception:', e?.message)
    }
  }

  const all = getLocalStore<EventAddon>(STORAGE_ADDONS_KEY)
  const idx = all.findIndex((a) => a.id === id)
  if (idx >= 0) all[idx] = payload
  else all.push(payload)
  setLocalStore(STORAGE_ADDONS_KEY, all)
  return { success: true, addon: payload }
}

export async function deleteEventAddon(addonId: string): Promise<{ success: boolean; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await db.from('event_addons').delete().eq('id', addonId)
      if (error) return { success: false, error: error.message }
    } catch {
      // fallback
    }
  }

  const all = getLocalStore<EventAddon>(STORAGE_ADDONS_KEY).filter((a) => a.id !== addonId)
  setLocalStore(STORAGE_ADDONS_KEY, all)
  return { success: true }
}

// ══════════════════════════════════════════════════════════════════════════════
// 8. SECURE VIRTUAL/HYBRID MEETING DETAILS (ATTENDEE ACCESS GATE)
// ══════════════════════════════════════════════════════════════════════════════
export async function getEventMeetingDetails(
  eventId: string,
  eventData?: {
    start_date?: string
    end_date?: string
    access_window_minutes?: number
    meeting_platform?: string | null
    meeting_url?: string | null
    joining_instructions?: string | null
    club_id?: string
  },
  userId?: string,
  isConfirmedAttendee?: boolean
): Promise<EventOnlineDetails> {
  // If Supabase is active, call server-side RPC for cryptographically secure access gate
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('get_event_meeting_details', {
        p_event_id: eventId,
      })
      if (!error && data) {
        return data as EventOnlineDetails
      }
    } catch {
      // fallback
    }
  }

  // Local / Client Verification Gate
  if (!userId) {
    return {
      accessible: false,
      error_code: 'UNAUTHENTICATED',
      message: 'Sign in to access virtual session link.',
    }
  }

  const isOrganizer = Boolean(eventData?.club_id && eventData.club_id === userId)
  if (isOrganizer) {
    return {
      accessible: true,
      platform: eventData?.meeting_platform || 'virtual',
      meeting_url: eventData?.meeting_url || null,
      joining_instructions: eventData?.joining_instructions || null,
      is_organizer: true,
    }
  }

  if (!isConfirmedAttendee) {
    return {
      accessible: false,
      error_code: 'REGISTRATION_REQUIRED',
      message: 'Meeting link unlocks exclusively for confirmed pass holders.',
    }
  }

  const now = Date.now()
  const windowMinutes = eventData?.access_window_minutes ?? 30
  const startTime = eventData?.start_date ? new Date(eventData.start_date).getTime() : 0
  const endTime = eventData?.end_date ? new Date(eventData.end_date).getTime() : 0
  const unlockTime = startTime - windowMinutes * 60 * 1000

  if (startTime > 0 && now < unlockTime) {
    return {
      accessible: false,
      error_code: 'WINDOW_NOT_OPEN',
      message: `Virtual link opens ${windowMinutes} minutes before session start.`,
      unlocks_at: new Date(unlockTime).toISOString(),
    }
  }

  if (endTime > 0 && now > endTime) {
    return {
      accessible: false,
      error_code: 'EVENT_CONCLUDED',
      message: 'This virtual session has concluded.',
    }
  }

  return {
    accessible: true,
    platform: eventData?.meeting_platform || 'virtual',
    meeting_url: eventData?.meeting_url || null,
    joining_instructions: eventData?.joining_instructions || null,
    is_organizer: false,
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 9. RELATED EVENTS RECOMMENDATION
// ══════════════════════════════════════════════════════════════════════════════
export async function getRelatedEvents(
  currentEventId: string,
  category: string,
  limit = 3
): Promise<RelatedEventSummary[]> {
  if (isSupabaseConfigured) {
    try {
      const nowIso = new Date().toISOString()
      const { data, error } = await db.from('events')
        .select('id, slug, title, category, poster_url, cover_url, start_date, end_date, status, venue_name, is_free, price, participation_type')
        .eq('status', 'published')
        .neq('id', currentEventId)
        .eq('category', category)
        .or(`start_date.gte.${nowIso},end_date.gte.${nowIso}`)
        .order('start_date', { ascending: true })
        .limit(limit)

      if (!error && Array.isArray(data) && data.length > 0) {
        const filtered = data.filter((e: any) => !isEventCompleted(e))
        if (filtered.length > 0) return filtered as RelatedEventSummary[]
      }

      // If not enough events in same category, query general upcoming events
      const { data: generalData } = await db.from('events')
        .select('id, slug, title, category, poster_url, cover_url, start_date, end_date, status, venue_name, is_free, price, participation_type')
        .eq('status', 'published')
        .neq('id', currentEventId)
        .or(`start_date.gte.${nowIso},end_date.gte.${nowIso}`)
        .order('start_date', { ascending: true })
        .limit(limit)

      if (Array.isArray(generalData) && generalData.length > 0) {
        const filteredGeneral = generalData.filter((e: any) => !isEventCompleted(e))
        return filteredGeneral as RelatedEventSummary[]
      }
    } catch {
      // fallback
    }
  }

  return []
}

