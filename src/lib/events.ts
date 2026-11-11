import { supabase, supabasePublic, isSupabaseConfigured } from '@/lib/supabase'
import type { EventRecord, EventInsert, EventUpdate, EventWithClub, Event, EventCategory } from '@/types'

const LOCAL_STORAGE_EVENTS_KEY = 'festflow_managed_events'

// Category-based fallback posters
export const CATEGORY_POSTERS: Record<EventCategory, string> = {
  tech: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80',
  cultural: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&auto=format&fit=crop&q=80',
  sports: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop&q=80',
  workshop: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&auto=format&fit=crop&q=80',
  seminar: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&auto=format&fit=crop&q=80',
  hackathon: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&auto=format&fit=crop&q=80',
  music: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80',
  art: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800&auto=format&fit=crop&q=80',
  gaming: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80',
  social: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&auto=format&fit=crop&q=80',
}

export function getDefaultPoster(category: EventCategory): string {
  return CATEGORY_POSTERS[category] || CATEGORY_POSTERS.tech
}

export function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const randomSuffix = Math.random().toString(36).substring(2, 6)
  return `${base || 'event'}-${randomSuffix}`
}

export const DEFAULT_EVENT_TIMEZONE = 'Asia/Kolkata'

export type EventLifecyclePhase =
  | 'upcoming'
  | 'ongoing'
  | 'completed'
  | 'draft'
  | 'cancelled'
  | 'registration_closed'

export interface EventLifecycleInput {
  status?: string | null
  end_date?: string | null
  start_date?: string | null
  date?: string | null
  startDate?: string | null
  endDate?: string | null
  timezone?: string | null
}

/**
 * Validates and resolves an IANA timezone string, defaulting cleanly to Asia/Kolkata.
 */
export function resolveEventTimezone(timeZone?: string | null): string {
  const candidate = (timeZone || '').trim() || DEFAULT_EVENT_TIMEZONE
  try {
    Intl.DateTimeFormat('en-US', { timeZone: candidate })
    return candidate
  } catch {
    return DEFAULT_EVENT_TIMEZONE
  }
}

function getZonedDateParts(date: Date, timeZone: string): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
} {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  })
  const map: Record<string, string> = {}
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value
  }
  const rawHour = Number(map.hour ?? '0')
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: rawHour === 24 ? 0 : rawHour,
    minute: Number(map.minute ?? '0'),
    second: Number(map.second ?? '0'),
  }
}

function getTimezoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = getZonedDateParts(new Date(utcMs), timeZone)
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0
  )
  return zonedAsUtc - utcMs
}

/**
 * Converts a YYYY-MM-DDTHH:mm wall-clock string interpreted in `timeZone` into an ISO UTC timestamp.
 */
export function zonedDatetimeInputToIso(val: string, timeZone?: string | null): string {
  if (!val || !val.trim()) return ''
  const trimmed = val.trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed)
  if (!match) {
    const parsed = new Date(trimmed)
    return isNaN(parsed.getTime()) ? '' : parsed.toISOString()
  }
  const tz = resolveEventTimezone(timeZone)
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6] || '0')

  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, 0)
  const guess = wallAsUtc - getTimezoneOffsetMs(wallAsUtc, tz)
  const refined = wallAsUtc - getTimezoneOffsetMs(guess, tz)
  return new Date(refined).toISOString()
}

/**
 * Formats an ISO UTC timestamp as YYYY-MM-DDTHH:mm in `timeZone` for datetime-local inputs.
 */
export function isoToZonedDatetimeInput(isoStr?: string | null, timeZone?: string | null): string {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return ''
  const tz = resolveEventTimezone(timeZone)
  const p = getZonedDateParts(d, tz)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`
}

/**
 * Formats an event timestamp in the event's configured timezone.
 */
export function formatEventDate(
  isoStr?: string | null,
  timeZone?: string | null,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
): string {
  if (!isoStr) return 'Date TBA'
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return 'Date TBA'
  return d.toLocaleDateString('en-IN', {
    ...options,
    timeZone: resolveEventTimezone(timeZone),
  })
}

/**
 * Formats an event time string in the event's configured timezone.
 */
export function formatEventTime(
  isoStr?: string | null,
  timeZone?: string | null,
  options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true }
): string {
  if (!isoStr) return 'Time TBA'
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return 'Time TBA'
  return d.toLocaleTimeString('en-IN', {
    ...options,
    timeZone: resolveEventTimezone(timeZone),
  })
}

/**
 * Resolves the authoritative end timestamp (UTC ms) of an event:
 * - Uses `end_date` / `endDate` directly when provided.
 * - If `end_date` is missing/null, treats the end of `start_date`'s calendar day
 *   (23:59:59.999) in `event.timezone` as the conclusion boundary so ongoing
 *   same-day events do not appear completed immediately at start time.
 */
export function getEffectiveEventEndMs(event: EventLifecycleInput): number | null {
  const endIso = event.end_date || event.endDate
  if (endIso) {
    const endMs = new Date(endIso).getTime()
    if (!isNaN(endMs)) return endMs
  }

  const startIso = event.start_date || event.startDate || event.date
  if (!startIso) return null
  const startDate = new Date(startIso)
  if (isNaN(startDate.getTime())) return null

  const tz = resolveEventTimezone(event.timezone)
  const p = getZonedDateParts(startDate, tz)
  const pad = (n: number) => String(n).padStart(2, '0')
  const eodIso = zonedDatetimeInputToIso(`${p.year}-${pad(p.month)}-${pad(p.day)}T23:59:59`, tz)
  const eodMs = eodIso ? new Date(eodIso).getTime() + 999 : startDate.getTime()
  return isNaN(eodMs) ? null : eodMs
}

/**
 * Determines the exact lifecycle phase of an event:
 * - Cancelled events stay 'cancelled' (NEVER reclassified as 'completed').
 * - Draft events stay 'draft' unless explicitly updated by organizer/admin.
 * - Explicitly 'completed' events OR events past their end boundary resolve to 'completed'.
 * - Events currently between start_date and effective end boundary resolve to 'ongoing'.
 */
export function getEventLifecyclePhase(
  event: EventLifecycleInput,
  referenceNow = Date.now()
): EventLifecyclePhase {
  const rawStatus = (event.status || '').toLowerCase()

  if (rawStatus === 'cancelled') return 'cancelled'
  if (rawStatus === 'draft') return 'draft'
  if (rawStatus === 'completed') return 'completed'

  const effectiveEndMs = getEffectiveEventEndMs(event)
  if (effectiveEndMs !== null && effectiveEndMs <= referenceNow) {
    return 'completed'
  }

  const startIso = event.start_date || event.startDate || event.date
  if (startIso) {
    const startMs = new Date(startIso).getTime()
    if (!isNaN(startMs) && startMs <= referenceNow) {
      return 'ongoing'
    }
  }

  if (rawStatus === 'registration_closed') return 'registration_closed'
  return 'upcoming'
}

/**
 * Returns true strictly when an event has concluded (explicitly 'completed' or
 * its end time / start calendar day in event timezone has elapsed).
 * Cancelled and draft events return false.
 */
export function isEventCompleted(event: EventLifecycleInput, referenceNow = Date.now()): boolean {
  return getEventLifecyclePhase(event, referenceNow) === 'completed'
}

/**
 * Returns true when an active event has started and not yet reached its end boundary.
 */
export function isEventOngoing(event: EventLifecycleInput, referenceNow = Date.now()): boolean {
  return getEventLifecyclePhase(event, referenceNow) === 'ongoing'
}

/**
 * Returns true when an event is either completed or cancelled (excluded from public discovery
 * and read-only / locked against organizer lifecycle mutations).
 */
export function isEventConcludedOrCancelled(
  event: EventLifecycleInput,
  referenceNow = Date.now()
): boolean {
  const phase = getEventLifecyclePhase(event, referenceNow)
  return phase === 'completed' || phase === 'cancelled'
}

/**
 * Returns true if organizers may edit schedule/details, publish, cancel, or dispatch
 * pre-event automations/reminders. Platform admins retain separate moderation override paths.
 */
export function canClubMutateEvent(
  event: EventLifecycleInput,
  referenceNow = Date.now()
): boolean {
  return !isEventConcludedOrCancelled(event, referenceNow)
}

export const LIFECYCLE_BADGE_META: Record<
  EventLifecyclePhase,
  { label: string; variant: 'cyan' | 'success' | 'neutral' | 'amber' | 'danger' | 'purple' }
> = {
  upcoming: { label: 'Upcoming', variant: 'cyan' },
  ongoing: { label: 'Live Now', variant: 'success' },
  completed: { label: 'Completed', variant: 'neutral' },
  draft: { label: 'Draft', variant: 'amber' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
  registration_closed: { label: 'Reg Closed', variant: 'purple' },
}

// ── Local Storage Helper for Offline / Fallback ──────────────────────────────
function getInitialLocalEvents(): EventRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_EVENTS_KEY)
    if (raw) return JSON.parse(raw) as EventRecord[]
  } catch {
    // fallback
  }
  return []
}

function saveLocalEvents(events: EventRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_EVENTS_KEY, JSON.stringify(events))
  } catch {
    // Ignore
  }
}

// ── Upload Poster to Supabase Storage ────────────────────────────────────────
export async function uploadEventPoster(
  file: File,
  clubId: string
): Promise<{ url: string | null; error: string | null }> {
  if (file.size > 5 * 1024 * 1024) {
    return { url: null, error: 'File size must be 5MB or less' }
  }

  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!validTypes.includes(file.type)) {
    return { url: null, error: 'Only JPEG, PNG, WEBP, or GIF images are allowed' }
  }

  if (isSupabaseConfigured) {
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const filePath = `${clubId}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('event-posters')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        return { url: null, error: uploadError.message }
      }

      const { data } = supabase.storage.from('event-posters').getPublicUrl(filePath)
      return { url: data.publicUrl, error: null }
    } catch (err) {
      return { url: null, error: err instanceof Error ? err.message : 'Upload failed' }
    }
  } else {
    // Simulation fallback: read as data URL
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve({ url: reader.result as string, error: null })
      reader.onerror = () => resolve({ url: null, error: 'Failed to read file locally' })
      reader.readAsDataURL(file)
    })
  }
}

// ── Validation: Event Configuration Validator ────────────────────────────────
export function validateEventConfig(
  data: Partial<EventInsert>,
  action: 'save_draft' | 'publish'
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {}

  if (!data.title || !data.title.trim()) {
    errors.title = 'Event title is required.'
  }

  if (action === 'publish') {
    if (!data.summary || data.summary.trim().length < 15) {
      errors.summary = 'Short summary must be at least 15 characters to publish.'
    }
    if (!data.description || data.description.trim().length < 30) {
      errors.description = 'Detailed description must be at least 30 characters to publish.'
    }
  }

  // Location / format validation
  if (data.event_type === 'offline') {
    if (!data.venue_name || !data.venue_name.trim()) {
      errors.venue_name = 'Campus venue name or hall is required for in-person events.'
    }
  } else if (data.event_type === 'online') {
    if (!data.online_meeting_url?.trim() && !data.venue_name?.trim()) {
      errors.online_meeting_url = 'Virtual meeting platform URL or instructions are required.'
    }
  } else if (data.event_type === 'hybrid') {
    if (!data.venue_name || !data.venue_name.trim()) {
      errors.venue_name = 'Physical campus venue is required for hybrid events.'
    }
  }

  // Dates validation
  if (!data.start_date) {
    errors.start_date = 'Event start date & time is required.'
  }
  if (!data.end_date) {
    errors.end_date = 'Event end date & time is required.'
  }

  if (data.start_date && data.end_date) {
    const startMs = new Date(data.start_date).getTime()
    const endMs = new Date(data.end_date).getTime()
    if (isNaN(startMs)) errors.start_date = 'Invalid start date format.'
    if (isNaN(endMs)) errors.end_date = 'Invalid end date format.'
    if (endMs <= startMs) {
      errors.end_date = 'Event end time must be after the start time.'
    }
  }

  if (data.start_date && data.registration_closes_at) {
    const startMs = new Date(data.start_date).getTime()
    const closeMs = new Date(data.registration_closes_at).getTime()
    if (!isNaN(startMs) && !isNaN(closeMs) && closeMs > startMs) {
      errors.registration_closes_at = 'Registration deadline cannot be after the event starts.'
    }
  }

  // Capacity validation
  if (data.capacity === undefined || data.capacity === null || Number(data.capacity) <= 0) {
    errors.capacity = 'Capacity must be at least 1 attendee or team.'
  }

  // Pricing validation
  if (!data.is_free) {
    const priceNum = Number(data.price)
    if (isNaN(priceNum) || priceNum <= 0) {
      errors.price = 'Paid events must specify a ticket fee greater than 0.'
    }
  }

  // Team validation
  if (data.participation_type === 'team') {
    const minSize = Number(data.min_team_size ?? 1)
    const maxSize = Number(data.max_team_size ?? 1)
    if (minSize < 1) {
      errors.min_team_size = 'Minimum team size must be at least 1.'
    }
    if (maxSize < minSize) {
      errors.max_team_size = 'Maximum team size cannot be smaller than minimum team size.'
    }
  }

  // Custom questions validation
  if (data.custom_questions && Array.isArray(data.custom_questions)) {
    data.custom_questions.forEach((q, idx) => {
      if (!q.label || !q.label.trim()) {
        errors[`question_${idx}`] = `Question #${idx + 1} must have a prompt/label.`
      }
      if ((q.type === 'select' || q.type === 'radio') && (!q.options || q.options.length < 2)) {
        errors[`question_${idx}_options`] = `Question #${idx + 1} (${q.type}) must have at least 2 options.`
      }
    })
  }

  return { isValid: Object.keys(errors).length === 0, errors }
}

// ── Create Event ─────────────────────────────────────────────────────────────
export async function createEvent(
  data: Omit<EventInsert, 'id' | 'created_at' | 'updated_at'>,
  action: 'save_draft' | 'publish' = 'publish'
): Promise<{ event: EventRecord | null; error: string | null; errors?: Record<string, string> }> {
  // Validate on client before submitting
  const { isValid, errors } = validateEventConfig(data, action)
  if (!isValid) {
    const firstError = Object.values(errors)[0]
    return { event: null, error: firstError, errors }
  }

  const normalizedPayload = {
    ...data,
    rules: data.rules?.trim() || null,
    contact_email: data.contact_email?.trim() || null,
    contact_phone: data.contact_phone?.trim() || null,
    online_meeting_url: data.online_meeting_url?.trim() || null,
    timezone: data.timezone || 'Asia/Kolkata',
    approval_type: data.approval_type || 'automatic',
    participation_type: data.participation_type || 'individual',
    min_team_size: data.participation_type === 'team' ? Number(data.min_team_size || 1) : 1,
    max_team_size: data.participation_type === 'team' ? Number(data.max_team_size || 1) : 1,
    leader_counts_towards_size: data.leader_counts_towards_size ?? true,
    team_registration_mode: data.team_registration_mode || 'leader_adds_members',
    require_team_name: Boolean(data.require_team_name),
    custom_questions: data.custom_questions || [],
    participant_fields: data.participant_fields || {
      require_college: true,
      require_phone: true,
      require_grad_year: true,
      require_id_card: false,
    },
  }

  if (isSupabaseConfigured) {
    try {
      const { data: inserted, error } = await supabase
        .from('events')
        .insert(normalizedPayload as never)
        .select('*')
        .single()

      if (error) return { event: null, error: error.message }
      return { event: inserted as unknown as EventRecord, error: null }
    } catch (err) {
      return { event: null, error: err instanceof Error ? err.message : 'Failed to create event' }
    }
  } else {
    await new Promise((r) => setTimeout(r, 400))
    const now = new Date().toISOString()
    const newRecord: EventRecord = {
      ...normalizedPayload,
      id: 'evt_' + Date.now(),
      poster_url: data.poster_url || getDefaultPoster(data.category),
      venue_address: data.venue_address || null,
      event_type: data.event_type || 'offline',
      registration_opens_at: data.registration_opens_at || null,
      registration_closes_at: data.registration_closes_at || null,
      is_free: data.is_free ?? true,
      price: data.price ?? 0,
      currency: data.currency || 'INR',
      eligibility: data.eligibility || null,
      allowed_colleges: data.allowed_colleges || null,
      allowed_departments: data.allowed_departments || null,
      allowed_years: data.allowed_years || null,
      status: action === 'publish' ? 'published' : 'draft',
      created_at: now,
      updated_at: now,
    }

    const current = getInitialLocalEvents()
    current.unshift(newRecord)
    saveLocalEvents(current)
    return { event: newRecord, error: null }
  }
}

// ── Update Event ─────────────────────────────────────────────────────────────
export async function updateEvent(
  id: string,
  updates: EventUpdate,
  clubId?: string
): Promise<{ event: EventRecord | null; error: string | null }> {
  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from('events')
        .update(updates as never)
        .eq('id', id)

      if (clubId) {
        query = query.eq('club_id', clubId)
      }

      const { data: updated, error } = await query
        .select('*')
        .single()

      if (error) return { event: null, error: error.message }
      return { event: updated as unknown as EventRecord, error: null }
    } catch (err) {
      return { event: null, error: err instanceof Error ? err.message : 'Failed to update event' }
    }
  } else {
    await new Promise((r) => setTimeout(r, 400))
    const current = getInitialLocalEvents()
    const idx = current.findIndex((e) => e.id === id && (!clubId || e.club_id === clubId))
    if (idx === -1) return { event: null, error: 'Event not found' }

    const updatedRecord: EventRecord = {
      ...current[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    }
    current[idx] = updatedRecord
    saveLocalEvents(current)
    return { event: updatedRecord, error: null }
  }
}

// ── Get Event by ID ──────────────────────────────────────────────────────────
export async function getEventById(
  id: string
): Promise<{ event: EventRecord | null; error: string | null }> {
  if (isSupabaseConfigured) {
    try {
      // Try public client first for published events, then authenticated client for club drafts/cancelled events
      let { data, error } = await supabasePublic
        .from('events')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if ((!data && !error) || (error && !error.message.includes('infinite recursion'))) {
        const retry = await supabase
          .from('events')
          .select('*')
          .eq('id', id)
          .maybeSingle()
        if (!retry.error && retry.data) {
          data = retry.data
          error = null
        } else if (retry.error && error) {
          error = retry.error
        }
      }

      if (error) return { event: null, error: error.message }
      return { event: data as unknown as EventRecord | null, error: null }
    } catch (err) {
      return { event: null, error: err instanceof Error ? err.message : 'Failed to load event' }
    }
  } else {
    const current = getInitialLocalEvents()
    const found = current.find((e) => e.id === id) || null
    return { event: found, error: null }
  }
}

// ── Get Event by Slug (Public / Details) ──────────────────────────────────────
export async function getEventBySlug(
  slug: string
): Promise<{ event: EventWithClub | null; error: string | null }> {
  if (isSupabaseConfigured) {
    try {
      const selectClauseSimple = `
        *,
        club:club_id (
          display_name,
          avatar_url
        )
      `

      // 1. Fetch event with club profile information directly (decoupled to prevent PostgREST embed ambiguity)
      let res = await supabasePublic
        .from('events')
        .select(selectClauseSimple)
        .eq('slug', slug)
        .maybeSingle()

      // 2. Fallback to authenticated client if needed
      if (res.error && !res.error.message.includes('infinite recursion')) {
        const retry = await supabase
          .from('events')
          .select(selectClauseSimple)
          .eq('slug', slug)
          .maybeSingle()
        if (!retry.error) {
          res = retry
        }
      }

      if (res.error) return { event: null, error: res.error.message }
      if (!res.data) return { event: null, error: 'Event not found' }

      const raw = res.data as Record<string, unknown>
      const clubObj = raw.club as Record<string, unknown> | null
      let clubProfileObj = Array.isArray(clubObj?.club_profiles)
        ? clubObj.club_profiles[0]
        : ((clubObj?.club_profiles as any) || null)

      // If club_profile was not embedded (via simple clause), fetch it directly
      if (!clubProfileObj && raw.club_id) {
        try {
          const { data: cpData } = await supabasePublic
            .from('club_profiles')
            .select('*')
            .eq('profile_id', raw.club_id)
            .maybeSingle()
          if (cpData) clubProfileObj = cpData
        } catch {
          // ignore
        }
      }

      const mapped: EventWithClub = {
        ...(res.data as unknown as EventRecord),
        club: clubObj
          ? {
              display_name: (clubObj.display_name as string) || 'Campus Club',
              avatar_url: (clubObj.avatar_url as string) || null,
              club_profile: clubProfileObj,
            }
          : undefined,
      }
      return { event: mapped, error: null }
    } catch (err) {
      return { event: null, error: err instanceof Error ? err.message : 'Failed to load event details' }
    }
  } else {
    const current = getInitialLocalEvents()
    const found = current.find((e) => e.slug === slug)
    if (!found) return { event: null, error: 'Event not found' }

    const mapped: EventWithClub = {
      ...found,
      club: {
        display_name: 'Campus Organization',
        avatar_url: null,
        club_profile: {
          id: 'cp_demo',
          profile_id: found.club_id,
          club_name: 'Campus Organization',
          representative_name: 'Lead Organizer',
          website_url: null,
          description: 'Verified student organization.',
          is_verified: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
    }
    return { event: mapped, error: null }
  }
}

// ── List Events Owned by Club ────────────────────────────────────────────────
export async function listClubEvents(
  clubId: string
): Promise<{ events: EventRecord[]; error: string | null }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false })

      if (error) return { events: [], error: error.message }
      return { events: (data as unknown as EventRecord[]) || [], error: null }
    } catch (err) {
      return { events: [], error: err instanceof Error ? err.message : 'Failed to list club events' }
    }
  } else {
    // In local simulation mode, isolate events to the requested club
    const current = getInitialLocalEvents()
    const filtered = clubId ? current.filter((e) => e.club_id === clubId) : current
    return { events: filtered, error: null }
  }
}

// ── List Published Events (Discover Page) ────────────────────────────────────
export async function listPublishedEvents(params?: {
  category?: string
  search?: string
  limit?: number
  offset?: number
  includeCompleted?: boolean
}): Promise<{ events: EventWithClub[]; count: number; error: string | null }> {
  if (isSupabaseConfigured) {
    try {
      const executeQuery = (client: typeof supabase, selectClause: string) => {
        let q = client
          .from('events')
          .select(selectClause, { count: 'exact' })
          .eq('status', 'published')
          .order('start_date', { ascending: true })

        // Unless explicitly requested, exclude events whose effective end has passed
        // Include a 24h lookback window for start_date so ongoing same-day events with null end_date
        // are retained from PostgREST before client timezone-aware phase filtering runs.
        if (!params?.includeCompleted) {
          const nowMs = Date.now()
          const nowIso = new Date(nowMs).toISOString()
          const lookbackIso = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString()
          q = q.or(`start_date.gte.${lookbackIso},end_date.gte.${nowIso}`)
        }

        if (params?.category && params.category !== 'all') {
          q = q.eq('category', params.category)
        }

        if (params?.search && params.search.trim() !== '') {
          const searchPattern = params.search.trim()
          q = q.or(`title.ilike.%${searchPattern}%,summary.ilike.%${searchPattern}%,description.ilike.%${searchPattern}%`)
        }

        if (params?.limit) {
          const from = params.offset || 0
          const to = from + params.limit - 1
          q = q.range(from, to)
        }
        return q
      }

      const selectSimple = `
        *,
        club:club_id (
          display_name,
          avatar_url
        )
      `

      // 1. Fetch events with simple join to prevent PostgREST reverse-relationship embedding errors
      let { data, count, error } = await executeQuery(supabasePublic, selectSimple)

      // 2. Fallback to standard authenticated client if public client failed
      if (error && !error.message.includes('infinite recursion')) {
        const fallbackRes = await executeQuery(supabase, selectSimple)
        if (!fallbackRes.error) {
          data = fallbackRes.data
          count = fallbackRes.count
          error = null
        }
      }

      if (error) {
        if (error.message.includes('infinite recursion')) {
          console.warn('[FestFlow] RLS recursion detected on events relation:', error.message)
        }
        return { events: [], count: 0, error: error.message }
      }

      let rawEvents = (data as unknown as Record<string, unknown>[]) || []

      // Defensive filtering: Ensure no concluded or cancelled events remain
      if (!params?.includeCompleted) {
        rawEvents = rawEvents.filter((row) => !isEventConcludedOrCancelled(row as any))
      }

      // If any clubs don't have club_profile populated, batch fetch them directly by profile_id
      const missingClubIds = Array.from(
        new Set(
          rawEvents
            .filter((row) => {
              const clubObj = row.club as Record<string, unknown> | null
              return !clubObj || !clubObj.club_profiles
            })
            .map((row) => row.club_id as string)
            .filter(Boolean)
        )
      )

      let fetchedClubProfiles: Record<string, any> = {}
      if (missingClubIds.length > 0) {
        try {
          const { data: cpData } = await (supabasePublic as any)
            .from('club_profiles')
            .select('*')
            .in('profile_id', missingClubIds)
          if (cpData && Array.isArray(cpData)) {
            for (const cp of cpData as any[]) {
              if (cp && cp.profile_id) {
                fetchedClubProfiles[cp.profile_id] = cp
              }
            }
          }
        } catch {
          // ignore
        }
      }

      const mapped: EventWithClub[] = rawEvents.map((row) => {
        const clubObj = row.club as Record<string, unknown> | null
        const clubId = row.club_id as string
        const embeddedCp = Array.isArray(clubObj?.club_profiles)
          ? clubObj.club_profiles[0]
          : (clubObj?.club_profiles as any) || fetchedClubProfiles[clubId] || null

        return {
          ...(row as unknown as EventRecord),
          club: clubObj
            ? {
                display_name: (clubObj.display_name as string) || 'Campus Club',
                avatar_url: (clubObj.avatar_url as string) || null,
                club_profile: embeddedCp,
              }
            : undefined,
        }
      })

      return { events: mapped, count: count || mapped.length, error: null }
    } catch (err) {
      return { events: [], count: 0, error: err instanceof Error ? err.message : 'Failed to query events' }
    }
  } else {
    // Local simulation search & filter
    const current = getInitialLocalEvents()
    let filtered = current.filter((e) => {
      if (e.status !== 'published') return false
      if (!params?.includeCompleted && isEventConcludedOrCancelled(e)) return false
      return true
    })

    if (params?.category && params.category !== 'all') {
      filtered = filtered.filter((e) => e.category === params.category)
    }

    if (params?.search && params.search.trim() !== '') {
      const q = params.search.trim().toLowerCase()
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.summary.toLowerCase().includes(q) ||
          e.venue_name.toLowerCase().includes(q)
      )
    }

    // Sort by start_date ascending (upcoming)
    filtered.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())

    const total = filtered.length
    if (params?.limit) {
      const offset = params.offset || 0
      filtered = filtered.slice(offset, offset + params.limit)
    }

    const mapped: EventWithClub[] = filtered.map((e) => ({
      ...e,
      club: {
        display_name: 'Campus Club',
        avatar_url: null,
        club_profile: {
          id: 'cp_demo',
          profile_id: e.club_id,
          club_name: 'Campus Club',
          representative_name: 'Organizer',
          website_url: null,
          description: null,
          is_verified: true,
          created_at: e.created_at,
          updated_at: e.updated_at,
        },
      },
    }))

    return { events: mapped, count: total, error: null }
  }
}

// ── Helper to convert EventRecord or EventWithClub into UI Event ─────────────
export function mapRecordToUiEvent(record: EventRecord | EventWithClub): Event {
  const startDate = record.start_date ? new Date(record.start_date) : null
  const timeFormatted = startDate
    ? startDate.toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : 'Time TBA'

  const clubName =
    'club' in record && record.club?.club_profile?.club_name
      ? record.club.club_profile.club_name
      : 'club' in record && record.club?.display_name
      ? record.club.display_name
      : 'Campus Organizer'

  return {
    id: record.id,
    title: record.title,
    slug: record.slug,
    clubName,
    clubAvatar:
      'club' in record && record.club?.avatar_url
        ? record.club.avatar_url
        : `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(clubName)}`,
    category: record.category,
    tags: [record.category, record.event_type],
    date: record.start_date,
    time: timeFormatted,
    location: record.venue_address || 'Campus Campus',
    venue: record.venue_name,
    coverImage: record.poster_url || getDefaultPoster(record.category),
    description: record.description,
    isFree: record.is_free,
    price: record.is_free ? undefined : Number(record.price),
    capacity: record.capacity,
    registeredCount: 0, // In Phase 3, default registrations count
    isFeatured: false,
    status: record.status,
    summary: record.summary,
    eventType: record.event_type,
    venueAddress: record.venue_address,
    startDate: record.start_date,
    endDate: record.end_date,
    registrationDeadline: record.registration_closes_at,
    eligibility: record.eligibility,
    rules: record.rules,
    contactEmail: record.contact_email,
    contactPhone: record.contact_phone,
    onlineMeetingUrl: record.online_meeting_url,
    timezone: record.timezone,
    approvalType: record.approval_type,
    participationType: record.participation_type,
    minTeamSize: record.min_team_size,
    maxTeamSize: record.max_team_size,
    leaderCountsTowardsSize: record.leader_counts_towards_size,
    teamRegistrationMode: record.team_registration_mode,
    requireTeamName: record.require_team_name,
    allowedColleges: record.allowed_colleges,
    allowedDepartments: record.allowed_departments,
    allowedYears: record.allowed_years,
    customQuestions: record.custom_questions,
    participantFields: record.participant_fields,
    clubId: record.club_id,
  }
}

// ── Cancel Event By Organizer (Module 7) ────────────────────────────────────
export async function cancelEventByOrganizer(params: {
  eventId: string
  cancellationReason: string
  _organizerId?: string
}): Promise<{ success: boolean; message: string; affectedRegistrations?: number; error_code?: string }> {
  const { eventId, cancellationReason } = params

  if (!cancellationReason || !cancellationReason.trim()) {
    return { success: false, error_code: 'INVALID_REASON', message: 'Please provide a reason for cancelling this event.' }
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('cancel_event_by_organizer', {
        p_event_id: eventId,
        p_cancellation_reason: cancellationReason.trim(),
      })

      if (error) {
        return { success: false, error_code: 'RPC_ERROR', message: error.message }
      }

      return data
    } catch (err: any) {
      return { success: false, error_code: 'NETWORK_ERROR', message: err?.message || 'Failed to cancel event.' }
    }
  }

  // Simulation Mode
  const events = getInitialLocalEvents()
  const ev = events.find((e) => e.id === eventId)
  if (!ev) {
    return { success: false, error_code: 'NOT_FOUND', message: 'Event not found.' }
  }

  ev.status = 'cancelled'
  ev.description = `${ev.description || ''}\n\n[EVENT CANCELLED BY ORGANIZER: ${cancellationReason.trim()}]`
  ev.updated_at = new Date().toISOString()
  saveLocalEvents(events)

  // Invalidate registrations and setup refund request
  let affected = 0
  try {
    const rawRegs = localStorage.getItem('festflow_local_registrations')
    if (rawRegs) {
      const regs = JSON.parse(rawRegs)
      for (const r of regs) {
        if (r.event_id === eventId && r.status !== 'cancelled' && r.status !== 'rejected') {
          r.status = 'cancelled'
          r.cancellation_request_status = 'approved'
          r.cancelled_at = new Date().toISOString()
          r.ticket_issued_at = null
          if (!ev.is_free && Number(ev.price) > 0) {
            r.refund_status = 'refund_requested'
            r.refund_amount = Number(ev.price)
          }
          r.updated_at = new Date().toISOString()
          affected++
        }
      }
      localStorage.setItem('festflow_local_registrations', JSON.stringify(regs))
    }
  } catch {
    // ignore
  }

  return {
    success: true,
    affectedRegistrations: affected,
    message: `Event cancelled successfully. ${affected} registrations marked cancelled with refund review queued.`,
  }
}
