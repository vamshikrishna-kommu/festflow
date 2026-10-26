import { supabase, supabasePublic, isSupabaseConfigured } from '@/lib/supabase'
import type { EventRecord, EventInsert, EventUpdate, EventWithClub, Event, EventCategory } from '@/types'
import { MOCK_EVENTS } from '@/lib/mock-data'

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

// ── Initial Mock Seeding for Simulation Mode ─────────────────────────────────
function getInitialLocalEvents(): EventRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_EVENTS_KEY)
    if (raw) return JSON.parse(raw) as EventRecord[]
  } catch {
    // fallback
  }

  // Pre-seed mock events into records so organizers have real data to view & manage
  const now = new Date()
  const seeded: EventRecord[] = MOCK_EVENTS.map((m, idx) => {
    const startDate = new Date(now.getTime() + (idx + 2) * 86400000 * 3)
    const endDate = new Date(startDate.getTime() + 4 * 3600000)
    const regClose = new Date(startDate.getTime() - 86400000)

    return {
      id: m.id,
      slug: m.slug,
      club_id: 'demo_club_member_default',
      title: m.title,
      summary: m.description.slice(0, 140) + '...',
      description: m.description,
      category: m.category,
      poster_url: m.coverImage,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      venue_name: m.venue,
      venue_address: m.location,
      event_type: 'offline',
      registration_opens_at: now.toISOString(),
      registration_closes_at: regClose.toISOString(),
      capacity: m.capacity,
      is_free: m.isFree,
      price: m.price || 0,
      currency: 'INR',
      eligibility: 'Open to all college students with valid student ID.',
      rules: '1. Please bring your college ID.\n2. Respect campus venue safety protocols.\n3. Arrive 15 minutes prior to start time for check-in.',
      contact_email: 'festflow.council@campus.edu',
      contact_phone: '+91 98765 43210',
      online_meeting_url: null,
      timezone: 'Asia/Kolkata',
      approval_type: 'automatic',
      participation_type: idx === 1 ? 'team' : 'individual',
      min_team_size: idx === 1 ? 2 : 1,
      max_team_size: idx === 1 ? 4 : 1,
      leader_counts_towards_size: true,
      team_registration_mode: 'leader_adds_members',
      require_team_name: idx === 1,
      allowed_colleges: null,
      allowed_departments: null,
      allowed_years: null,
      custom_questions: [
        {
          id: 'q_roll_no',
          label: 'Student Roll / Registration Number',
          type: 'text',
          required: true,
          placeholder: 'e.g. 21BCE1024',
        },
      ],
      participant_fields: {
        require_college: true,
        require_phone: true,
        require_grad_year: true,
        require_id_card: false,
      },
      status: 'published',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }
  })

  // Add one draft and one cancelled for realistic testing
  seeded.push({
    id: 'evt_draft_sample',
    slug: 'annual-robotics-summit-draft',
    club_id: 'demo_club_member_default',
    title: 'Annual Robotics & Autonomous Systems Summit',
    summary: 'A 2-day national summit featuring workshops, bot races, and industry keynotes.',
    description: 'Join us for the flagship campus robotics conference. Features live hardware exhibitions, keynote speakers from top aerospace companies, and a 12-hour build challenge.',
    category: 'tech',
    poster_url: CATEGORY_POSTERS.tech,
    start_date: new Date(now.getTime() + 14 * 86400000).toISOString(),
    end_date: new Date(now.getTime() + 15 * 86400000).toISOString(),
    venue_name: 'Main Auditorium & Innovation Lab',
    venue_address: 'Block C, Technology Campus',
    event_type: 'offline',
    registration_opens_at: now.toISOString(),
    registration_closes_at: new Date(now.getTime() + 13 * 86400000).toISOString(),
    capacity: 250,
    is_free: false,
    price: 350,
    currency: 'INR',
    eligibility: 'Open to engineering and design students.',
    rules: 'No unauthorized wireless transmitters allowed in the arena.',
    contact_email: 'robotics@campus.edu',
    contact_phone: '+91 98765 12345',
    online_meeting_url: null,
    timezone: 'Asia/Kolkata',
    approval_type: 'manual',
    participation_type: 'team',
    min_team_size: 2,
    max_team_size: 4,
    leader_counts_towards_size: true,
    team_registration_mode: 'leader_adds_members',
    require_team_name: true,
    allowed_colleges: null,
    allowed_departments: ['Computer Science', 'Mechanical', 'Electrical'],
    allowed_years: [2, 3, 4],
    custom_questions: [
      {
        id: 'q_tshirt',
        label: 'T-Shirt Size',
        type: 'select',
        required: true,
        options: ['S', 'M', 'L', 'XL', 'XXL'],
      },
    ],
    participant_fields: {
      require_college: true,
      require_phone: true,
      require_grad_year: true,
      require_id_card: true,
    },
    status: 'draft',
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  })

  try {
    localStorage.setItem(LOCAL_STORAGE_EVENTS_KEY, JSON.stringify(seeded))
  } catch {
    // Ignore storage quota
  }

  return seeded
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
  updates: EventUpdate
): Promise<{ event: EventRecord | null; error: string | null }> {
  if (isSupabaseConfigured) {
    try {
      const { data: updated, error } = await supabase
        .from('events')
        .update(updates as never)
        .eq('id', id)
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
    const idx = current.findIndex((e) => e.id === id)
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
      // Use supabasePublic to prevent user-session RLS recursion, with fallback to supabase
      let { data, error } = await supabasePublic
        .from('events')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error && !error.message.includes('infinite recursion')) {
        const retry = await supabase
          .from('events')
          .select('*')
          .eq('id', id)
          .maybeSingle()
        if (!retry.error) {
          data = retry.data
          error = null
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
      const selectClause = `
        *,
        club:club_id (
          display_name,
          avatar_url,
          club_profiles (*)
        )
      `
      // Prefer unauthenticated client for public event details to avoid user session RLS recursion
      let { data, error } = await supabasePublic
        .from('events')
        .select(selectClause)
        .eq('slug', slug)
        .maybeSingle()

      if (error && !error.message.includes('infinite recursion')) {
        const retry = await supabase
          .from('events')
          .select(selectClause)
          .eq('slug', slug)
          .maybeSingle()
        if (!retry.error) {
          data = retry.data
          error = null
        }
      }

      if (error) return { event: null, error: error.message }
      if (!data) return { event: null, error: 'Event not found' }

      const raw = data as Record<string, unknown>
      const clubObj = raw.club as Record<string, unknown> | null

      const mapped: EventWithClub = {
        ...(data as unknown as EventRecord),
        club: clubObj
          ? {
              display_name: (clubObj.display_name as string) || 'Campus Club',
              avatar_url: (clubObj.avatar_url as string) || null,
              club_profile: Array.isArray(clubObj.club_profiles)
                ? clubObj.club_profiles[0]
                : (clubObj.club_profiles as EventWithClub['club'] extends { club_profile?: infer P } ? P : null),
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
    // In local simulation mode, return all managed local events
    const current = getInitialLocalEvents()
    return { events: current, error: null }
  }
}

// ── List Published Events (Discover Page) ────────────────────────────────────
export async function listPublishedEvents(params?: {
  category?: string
  search?: string
  limit?: number
  offset?: number
}): Promise<{ events: EventWithClub[]; count: number; error: string | null }> {
  if (isSupabaseConfigured) {
    try {
      const executeQuery = (client: typeof supabase) => {
        let q = client
          .from('events')
          .select(
            `
            *,
            club:club_id (
              display_name,
              avatar_url,
              club_profiles (*)
            )
          `,
            { count: 'exact' }
          )
          .eq('status', 'published')
          .order('start_date', { ascending: true })

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

      // Try with supabasePublic first to prevent user session RLS recursion loops
      let { data, count, error } = await executeQuery(supabasePublic)

      // Fallback to standard client if public client failed (unless failure was infinite recursion)
      if (error && !error.message.includes('infinite recursion')) {
        const fallbackRes = await executeQuery(supabase)
        if (!fallbackRes.error) {
          data = fallbackRes.data
          count = fallbackRes.count
          error = null
        }
      }

      if (error) {
        if (error.message.includes('infinite recursion')) {
          console.warn('[FestFlow] RLS recursion detected on events relation, please ensure migration 016 is applied:', error.message)
        }
        return { events: [], count: 0, error: error.message }
      }

      const mapped: EventWithClub[] = ((data as unknown as Record<string, unknown>[]) || []).map((row) => {
        const clubObj = row.club as Record<string, unknown> | null
        return {
          ...(row as unknown as EventRecord),
          club: clubObj
            ? {
                display_name: (clubObj.display_name as string) || 'Campus Club',
                avatar_url: (clubObj.avatar_url as string) || null,
                club_profile: Array.isArray(clubObj.club_profiles)
                  ? clubObj.club_profiles[0]
                  : null,
              }
            : undefined,
        }
      })

      return { events: mapped, count: count || 0, error: null }
    } catch (err) {
      return { events: [], count: 0, error: err instanceof Error ? err.message : 'Failed to query events' }
    }
  } else {
    // Local simulation search & filter
    const current = getInitialLocalEvents()
    let filtered = current.filter((e) => e.status === 'published')

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
