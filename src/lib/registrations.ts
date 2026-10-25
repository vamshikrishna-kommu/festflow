import { supabase, isSupabaseConfigured, isProduction } from '@/lib/supabase'
import type {
  RegistrationRecord,
  RegistrationWithEvent,
  RegistrationWithStudent,
  RegistrationResponse,
} from '@/types'
import { getEventById } from '@/lib/events'

const LOCAL_STORAGE_REGISTRATIONS_KEY = 'festflow_local_registrations'

// Initial seed registrations for local simulation mode
function getInitialLocalRegistrations(): RegistrationRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_REGISTRATIONS_KEY)
    if (raw) return JSON.parse(raw) as RegistrationRecord[]
  } catch {
    // ignore
  }

  const now = new Date()
  const sampleRegistrations: RegistrationRecord[] = [
    {
      id: 'reg_sample_1',
      event_id: 'evt-1',
      student_id: 'demo_student_default',
      ticket_code: 'FF-884A2C91',
      status: 'confirmed',
      created_at: new Date(now.getTime() - 2 * 86400000).toISOString(),
      ticket_issued_at: new Date(now.getTime() - 2 * 86400000).toISOString(),
      cancelled_at: null,
      updated_at: new Date(now.getTime() - 2 * 86400000).toISOString(),
    },
    {
      id: 'reg_sample_2',
      event_id: 'evt-2',
      student_id: 'demo_student_default',
      ticket_code: 'FF-19DF7B03',
      status: 'pending_payment',
      created_at: new Date(now.getTime() - 1 * 86400000).toISOString(),
      ticket_issued_at: null,
      cancelled_at: null,
      updated_at: new Date(now.getTime() - 1 * 86400000).toISOString(),
    },
    {
      id: 'reg_sample_3',
      event_id: 'evt-3',
      student_id: 'student_other_1',
      ticket_code: 'FF-62BA994F',
      status: 'confirmed',
      created_at: new Date(now.getTime() - 3 * 86400000).toISOString(),
      ticket_issued_at: new Date(now.getTime() - 3 * 86400000).toISOString(),
      cancelled_at: null,
      updated_at: new Date(now.getTime() - 3 * 86400000).toISOString(),
    },
  ]

  try {
    localStorage.setItem(LOCAL_STORAGE_REGISTRATIONS_KEY, JSON.stringify(sampleRegistrations))
  } catch {
    // ignore
  }

  return sampleRegistrations
}

function saveLocalRegistrations(regs: RegistrationRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_REGISTRATIONS_KEY, JSON.stringify(regs))
  } catch {
    // ignore
  }
}

// ── Register for Event (RPC / Atomic) ────────────────────────────────────────
export async function registerForEvent(
  eventId: string,
  studentId: string
): Promise<RegistrationResponse> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('register_for_event', {
        p_event_id: eventId,
      })

      if (error) {
        return {
          success: false,
          error_code: 'RPC_ERROR',
          message: error.message,
        }
      }

      const res = data as RegistrationResponse
      return res
    } catch (err) {
      return {
        success: false,
        error_code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Registration request failed.',
      }
    }
  } else {
    // In production, block mock registrations if Supabase is unconfigured
    if (isProduction) {
      return {
        success: false,
        error_code: 'UNCONFIGURED_PRODUCTION',
        message: 'Production Configuration Error: Registrations are disabled until live Supabase backend is configured.',
      }
    }

    // Local Simulation (Development only)
    await new Promise((r) => setTimeout(r, 600)) // natural transition delay
    const eventRes = await getEventById(eventId)
    const event = eventRes.event

    if (!event) {
      return { success: false, error_code: 'EVENT_NOT_FOUND', message: 'Event could not be found.' }
    }

    if (event.status !== 'published') {
      return {
        success: false,
        error_code: 'EVENT_NOT_PUBLISHED',
        message: 'This event is not published for registration.',
      }
    }

    const now = new Date()
    if (new Date(event.start_date) <= now) {
      return {
        success: false,
        error_code: 'EVENT_ALREADY_STARTED',
        message: 'Registration is closed because the event has already started.',
      }
    }

    if (event.registration_closes_at && new Date(event.registration_closes_at) < now) {
      return {
        success: false,
        error_code: 'REGISTRATION_DEADLINE_PASSED',
        message: 'The registration deadline has passed for this event.',
      }
    }

    const currentRegs = getInitialLocalRegistrations()
    const existing = currentRegs.find(
      (r) => r.event_id === eventId && r.student_id === studentId && r.status !== 'cancelled'
    )

    if (existing) {
      return {
        success: false,
        error_code: 'ALREADY_REGISTERED',
        message: 'You already have an active registration for this event.',
        registration_id: existing.id,
        ticket_code: existing.ticket_code,
        status: existing.status,
      }
    }

    // Capacity check
    const activeCount = currentRegs.filter(
      (r) => r.event_id === eventId && (r.status === 'confirmed' || r.status === 'pending_payment')
    ).length

    if (activeCount >= event.capacity) {
      return {
        success: false,
        error_code: 'CAPACITY_REACHED',
        message: 'This event has reached full capacity. No seats remaining.',
      }
    }

    const ticketCode = 'FF-' + Math.random().toString(36).substring(2, 10).toUpperCase()
    const isFree = event.is_free

    const newReg: RegistrationRecord = {
      id: 'reg_' + Date.now(),
      event_id: eventId,
      student_id: studentId,
      ticket_code: ticketCode,
      status: isFree ? 'confirmed' : 'pending_payment',
      created_at: now.toISOString(),
      ticket_issued_at: isFree ? now.toISOString() : null,
      cancelled_at: null,
      updated_at: now.toISOString(),
    }

    currentRegs.unshift(newReg)
    saveLocalRegistrations(currentRegs)

    return {
      success: true,
      registration_id: newReg.id,
      ticket_code: ticketCode,
      status: newReg.status,
      is_free: isFree,
      ticket_issued: isFree,
      message: isFree
        ? 'Registration confirmed! Your digital entry ticket has been issued.'
        : 'Registration received! Payment verification will be approved in Phase 5.',
    }
  }
}

// ── Cancel Registration ──────────────────────────────────────────────────────
export async function cancelRegistration(
  registrationId: string
): Promise<{ success: boolean; message: string }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('cancel_registration', {
        p_registration_id: registrationId,
      })

      if (error) {
        return { success: false, message: error.message }
      }

      const res = data as { success: boolean; message: string }
      return res
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Cancellation failed.',
      }
    }
  } else {
    await new Promise((r) => setTimeout(r, 400))
    const current = getInitialLocalRegistrations()
    const idx = current.findIndex((r) => r.id === registrationId)
    if (idx === -1) {
      return { success: false, message: 'Registration not found.' }
    }

    current[idx] = {
      ...current[idx],
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    saveLocalRegistrations(current)
    return { success: true, message: 'Registration cancelled successfully.' }
  }
}

// ── Check if Student has Active Registration for Event ───────────────────────
export async function checkStudentRegistrationForEvent(
  eventId: string,
  studentId: string
): Promise<{ registered: boolean; registration: RegistrationRecord | null }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .eq('event_id', eventId)
        .eq('student_id', studentId)
        .neq('status', 'cancelled')
        .maybeSingle()

      if (error || !data) return { registered: false, registration: null }
      return { registered: true, registration: data as unknown as RegistrationRecord }
    } catch {
      return { registered: false, registration: null }
    }
  } else {
    const current = getInitialLocalRegistrations()
    const found = current.find(
      (r) => r.event_id === eventId && r.student_id === studentId && r.status !== 'cancelled'
    )
    return { registered: Boolean(found), registration: found || null }
  }
}

// ── Get Single Registration by ID (with Event & Student Profile) ────────────
export async function getRegistrationById(
  id: string
): Promise<{ registration: RegistrationWithEvent | null; error: string | null }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select(
          `
          *,
          event:event_id (
            *,
            club:club_id (
              display_name,
              club_profiles (*)
            )
          )
        `
        )
      let regData = data
      if (!regData) {
        const { data: codeData } = await supabase
          .from('registrations')
          .select(
            `
            *,
            event:event_id (
              *,
              club:club_id (
                display_name,
                club_profiles (*)
              )
            )
          `
          )
          .eq('ticket_code', id.toUpperCase().trim())
          .maybeSingle()
        regData = codeData
      }

      if (error && !regData) return { registration: null, error: error.message }
      if (!regData) return { registration: null, error: 'Registration not found' }

      return { registration: regData as unknown as RegistrationWithEvent, error: null }
    } catch (err) {
      return {
        registration: null,
        error: err instanceof Error ? err.message : 'Failed to fetch registration',
      }
    }
  } else {
    const cleanId = id.toUpperCase().trim()
    const current = getInitialLocalRegistrations()
    const found = current.find((r) => r.id === id || (r.ticket_code && r.ticket_code.toUpperCase() === cleanId))
    if (!found) return { registration: null, error: 'Registration not found' }

    const eventRes = await getEventById(found.event_id)
    if (!eventRes.event) return { registration: null, error: 'Associated event not found' }

    const withEvent: RegistrationWithEvent = {
      ...found,
      event: {
        ...eventRes.event,
        club: {
          display_name: 'Campus Organization',
          club_profiles: null,
        },
      },
    }
    return { registration: withEvent, error: null }
  }
}

// ── Get All Registrations for a Student (Student Dashboard) ──────────────────
export async function getStudentRegistrations(
  studentId: string
): Promise<{ registrations: RegistrationWithEvent[]; error: string | null }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select(
          `
          *,
          event:event_id (
            *,
            club:club_id (
              display_name,
              club_profiles (*)
            )
          )
        `
        )
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })

      if (error) return { registrations: [], error: error.message }
      return {
        registrations: (data as unknown as RegistrationWithEvent[]) || [],
        error: null,
      }
    } catch (err) {
      return {
        registrations: [],
        error: err instanceof Error ? err.message : 'Failed to load tickets',
      }
    }
  } else {
    const current = getInitialLocalRegistrations()
    // In demo mode, load user's tickets (or all sample tickets for demo viewing)
    const userRegs = current.filter(
      (r) => r.student_id === studentId || r.student_id === 'demo_student_default'
    )

    const list: RegistrationWithEvent[] = []
    for (const reg of userRegs) {
      const eventRes = await getEventById(reg.event_id)
      if (eventRes.event) {
        list.push({
          ...reg,
          event: {
            ...eventRes.event,
            club: {
              display_name: 'Campus Club',
              club_profiles: null,
            },
          },
        })
      }
    }

    return { registrations: list, error: null }
  }
}

// ── Get Registrations for an Event (Club Management Page) ────────────────────
export async function getEventRegistrations(
  eventId: string
): Promise<{ registrations: RegistrationWithStudent[]; error: string | null }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select(
          `
          *,
          student:student_id (
            display_name,
            email,
            avatar_url
          )
        `
        )
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

      if (error) return { registrations: [], error: error.message }
      return {
        registrations: (data as unknown as RegistrationWithStudent[]) || [],
        error: null,
      }
    } catch (err) {
      return {
        registrations: [],
        error: err instanceof Error ? err.message : 'Failed to load registrations',
      }
    }
  } else {
    const current = getInitialLocalRegistrations()
    const matching = current.filter((r) => r.event_id === eventId)

    const list: RegistrationWithStudent[] = matching.map((r, i) => ({
      ...r,
      student: {
        display_name: i === 0 ? 'Alex Rivera' : `Student Attendee #${i + 1}`,
        email: i === 0 ? 'alex.rivera@campus.edu' : `attendee${i + 1}@college.edu`,
        avatar_url: null,
      },
    }))

    // Add a couple extra demo attendees if empty for rich testing of club attendee list
    if (list.length === 0) {
      list.push(
        {
          id: 'demo_reg_1',
          event_id: eventId,
          student_id: 'std_demo_1',
          ticket_code: 'FF-A189C2',
          status: 'confirmed',
          created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
          ticket_issued_at: new Date(Date.now() - 3600000 * 5).toISOString(),
          cancelled_at: null,
          updated_at: new Date().toISOString(),
          student: {
            display_name: 'Jordan Lee',
            email: 'jordan.lee@university.edu',
            avatar_url: null,
          },
        },
        {
          id: 'demo_reg_2',
          event_id: eventId,
          student_id: 'std_demo_2',
          ticket_code: 'FF-D54F91',
          status: 'pending_payment',
          created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
          ticket_issued_at: null,
          cancelled_at: null,
          updated_at: new Date().toISOString(),
          student: {
            display_name: 'Priya Sharma',
            email: 'priya.s@tech.edu',
            avatar_url: null,
          },
        }
      )
    }

    return { registrations: list, error: null }
  }
}
