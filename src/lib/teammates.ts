import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type {
  TeammateProfileRecord,
  TeammateRequestRecord,
  TeammateAvailability,
} from '@/types'
import { isUserBlocked } from '@/lib/moderation'

const LOCAL_STORAGE_PROFILES = 'festflow_local_teammate_profiles'
const LOCAL_STORAGE_REQUESTS = 'festflow_local_teammate_requests'

let inMemoryProfiles: TeammateProfileRecord[] | null = null
let inMemoryRequests: TeammateRequestRecord[] | null = null

function getLocalProfiles(): TeammateProfileRecord[] {
  if (inMemoryProfiles !== null) return inMemoryProfiles
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_PROFILES)
      if (raw) {
        inMemoryProfiles = JSON.parse(raw)
        return inMemoryProfiles!
      }
    }
  } catch {
    // ignore
  }
  inMemoryProfiles = []
  return inMemoryProfiles
}

function saveLocalProfiles(profiles: TeammateProfileRecord[]) {
  inMemoryProfiles = profiles
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_PROFILES, JSON.stringify(profiles))
    }
  } catch {
    // ignore
  }
}

function getLocalRequests(): TeammateRequestRecord[] {
  if (inMemoryRequests !== null) return inMemoryRequests
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_REQUESTS)
      if (raw) {
        inMemoryRequests = JSON.parse(raw)
        return inMemoryRequests!
      }
    }
  } catch {
    // ignore
  }
  inMemoryRequests = []
  return inMemoryRequests
}

function saveLocalRequests(requests: TeammateRequestRecord[]) {
  inMemoryRequests = requests
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_REQUESTS, JSON.stringify(requests))
    }
  } catch {
    // ignore
  }
}

/**
 * Retrieves a student's teammate discovery profile.
 */
export async function getTeammateDiscoveryProfile(
  studentId: string
): Promise<{ success: boolean; profile?: TeammateProfileRecord | null; message?: string }> {
  if (!studentId) return { success: false, message: 'Student ID required.' }

  if (isSupabaseConfigured) {
    try {
      const { data } = await (supabase.from('teammate_profiles') as any)
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle()
      return { success: true, profile: data as TeammateProfileRecord | null }
    } catch {
      // fallback
    }
  }

  const found = getLocalProfiles().find((p) => p.student_id === studentId) || null
  return { success: true, profile: found }
}

/**
 * Creates or updates a student's teammate discovery settings.
 */
export async function saveTeammateDiscoveryProfile(params: {
  studentId: string
  headline?: string
  bio?: string
  skills?: string[]
  preferredCategories?: string[]
  lookingFor?: string
  availability?: TeammateAvailability
  isOptedIn?: boolean
}): Promise<{ success: boolean; profile?: TeammateProfileRecord; message?: string }> {
  if (!params.studentId) return { success: false, message: 'Student ID required.' }

  const payload = {
    student_id: params.studentId,
    headline: params.headline?.trim() || null,
    bio: params.bio?.trim() || null,
    skills: params.skills || [],
    preferred_categories: params.preferredCategories || [],
    looking_for: params.lookingFor?.trim() || null,
    availability: params.availability || 'actively_looking',
    is_opted_in: params.isOptedIn !== undefined ? params.isOptedIn : true,
    updated_at: new Date().toISOString(),
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('teammate_profiles') as any)
        .upsert(payload, { onConflict: 'student_id' })
        .select('*')
        .single()

      if (!error && data) {
        return { success: true, profile: data as TeammateProfileRecord }
      }
      return { success: false, message: error?.message || 'Failed to save teammate discovery profile.' }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Database error updating teammate profile.' }
    }
  }

  const profiles = getLocalProfiles()
  const idx = profiles.findIndex((p) => p.student_id === params.studentId)
  let updatedRecord: TeammateProfileRecord

  if (idx !== -1) {
    updatedRecord = {
      ...profiles[idx],
      ...payload,
    }
    profiles[idx] = updatedRecord
  } else {
    updatedRecord = {
      ...payload,
      id: `tprof_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      created_at: new Date().toISOString(),
    }
    profiles.push(updatedRecord)
  }

  saveLocalProfiles(profiles)
  return { success: true, profile: updatedRecord }
}

/**
 * Searches for discoverable teammates based on skills, preferred event categories, and availability.
 */
export async function searchTeammates(filters?: {
  skills?: string[]
  category?: string
  query?: string
  availability?: TeammateAvailability
  viewerId?: string
}): Promise<{ success: boolean; candidates: TeammateProfileRecord[]; message?: string }> {
  const viewerId = filters?.viewerId

  if (isSupabaseConfigured) {
    try {
      let q = (supabase.from('teammate_profiles') as any)
        .select('*, student:profiles(id, display_name, avatar_url), student_profile:student_profiles(college_name, course, graduation_year)')
        .eq('is_opted_in', true)

      if (viewerId) {
        q = q.neq('student_id', viewerId)
      }
      if (filters?.availability) {
        q = q.eq('availability', filters.availability)
      }

      const { data, error } = await q.order('updated_at', { ascending: false })
      if (!error && data) {
        let results = data as TeammateProfileRecord[]
        // Apply client-side skill and category filters if specified
        if (filters?.skills && filters.skills.length > 0) {
          const reqSkills = filters.skills.map((s) => s.toLowerCase())
          results = results.filter((p) =>
            p.skills.some((s) => reqSkills.includes(s.toLowerCase()))
          )
        }
        if (filters?.category) {
          results = results.filter((p) =>
            p.preferred_categories.includes(filters.category!)
          )
        }
        if (filters?.query?.trim()) {
          const qText = filters.query.trim().toLowerCase()
          results = results.filter(
            (p) =>
              p.headline?.toLowerCase().includes(qText) ||
              p.student?.display_name?.toLowerCase().includes(qText) ||
              p.skills.some((s) => s.toLowerCase().includes(qText))
          )
        }
        return { success: true, candidates: results }
      }
    } catch {
      // fallback
    }
  }

  let candidates = getLocalProfiles().filter(
    (p) => p.is_opted_in !== false && (!viewerId || p.student_id !== viewerId)
  )

  if (filters?.availability) {
    candidates = candidates.filter((p) => p.availability === filters.availability)
  }
  if (filters?.skills && filters.skills.length > 0) {
    const reqSkills = filters.skills.map((s) => s.toLowerCase())
    candidates = candidates.filter((p) =>
      p.skills.some((s) => reqSkills.includes(s.toLowerCase()))
    )
  }
  if (filters?.category) {
    candidates = candidates.filter((p) =>
      p.preferred_categories.includes(filters.category!)
    )
  }
  if (filters?.query?.trim()) {
    const qText = filters.query.trim().toLowerCase()
    candidates = candidates.filter(
      (p) =>
        p.headline?.toLowerCase().includes(qText) ||
        p.skills.some((s) => s.toLowerCase().includes(qText))
    )
  }

  return { success: true, candidates }
}

/**
 * Sends a teammate connection request.
 * Enforces self-request, duplicate, and blocked-user safeguards.
 */
export async function sendTeammateRequest(params: {
  senderId: string
  receiverId: string
  eventId?: string | null
  message: string
}): Promise<{ success: boolean; request?: TeammateRequestRecord; message?: string }> {
  if (!params.senderId || !params.receiverId || !params.message?.trim()) {
    return { success: false, message: 'Please provide receiver and message.' }
  }
  if (params.senderId === params.receiverId) {
    return { success: false, message: 'You cannot send a teammate request to yourself.' }
  }

  // Safety: Check if either user has blocked the other
  const blocked = await isUserBlocked(params.senderId, params.receiverId)
  if (blocked) {
    return { success: false, message: 'Unable to dispatch request to this participant.' }
  }

  // Duplicate check: Check for an active pending request between these two
  const existingRequests = getLocalRequests()
  const duplicate = existingRequests.find(
    (r) =>
      r.sender_id === params.senderId &&
      r.receiver_id === params.receiverId &&
      r.status === 'pending'
  )
  if (duplicate) {
    return { success: false, message: 'A teammate request is already pending for this student.' }
  }

  const payload = {
    sender_id: params.senderId,
    receiver_id: params.receiverId,
    event_id: params.eventId || null,
    message: params.message.trim(),
    status: 'pending' as const,
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('teammate_requests') as any)
        .insert(payload)
        .select('*')
        .single()

      if (!error && data) {
        return { success: true, request: data as TeammateRequestRecord }
      }
      return { success: false, message: error?.message || 'Failed to dispatch teammate request.' }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Database error creating teammate request.' }
    }
  }

  const newRecord: TeammateRequestRecord = {
    ...payload,
    id: `treq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  existingRequests.unshift(newRecord)
  saveLocalRequests(existingRequests)

  return { success: true, request: newRecord }
}

/**
 * Responds to a teammate request (accepted / declined).
 */
export async function respondToTeammateRequest(
  requestId: string,
  receiverId: string,
  status: 'accepted' | 'declined'
): Promise<{ success: boolean; message?: string }> {
  if (!requestId || !receiverId) return { success: false, message: 'Invalid response parameters.' }

  if (isSupabaseConfigured) {
    try {
      const { error } = await (supabase.from('teammate_requests') as any)
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', requestId)
        .eq('receiver_id', receiverId)

      if (error) return { success: false, message: error.message }
      return { success: true, message: `Teammate request ${status}.` }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to update request.' }
    }
  }

  const list = getLocalRequests()
  const req = list.find((r) => r.id === requestId && r.receiver_id === receiverId)
  if (req) {
    req.status = status
    req.updated_at = new Date().toISOString()
    saveLocalRequests(list)
    return { success: true, message: `Teammate request ${status}.` }
  }
  return { success: false, message: 'Request could not be found.' }
}

/**
 * Withdraws a previously sent pending teammate request.
 */
export async function withdrawTeammateRequest(
  requestId: string,
  senderId: string
): Promise<{ success: boolean; message?: string }> {
  if (!requestId || !senderId) return { success: false, message: 'Invalid withdrawal parameters.' }

  if (isSupabaseConfigured) {
    try {
      const { error } = await (supabase.from('teammate_requests') as any)
        .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
        .eq('id', requestId)
        .eq('sender_id', senderId)

      if (error) return { success: false, message: error.message }
      return { success: true, message: 'Teammate request withdrawn.' }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to withdraw request.' }
    }
  }

  const list = getLocalRequests()
  const req = list.find((r) => r.id === requestId && r.sender_id === senderId)
  if (req) {
    req.status = 'withdrawn'
    req.updated_at = new Date().toISOString()
    saveLocalRequests(list)
    return { success: true, message: 'Teammate request withdrawn.' }
  }
  return { success: false, message: 'Request could not be found.' }
}

/**
 * Retrieves all sent and received teammate requests for a student.
 */
export async function getStudentTeammateRequests(
  studentId: string
): Promise<{
  success: boolean
  sent: TeammateRequestRecord[]
  received: TeammateRequestRecord[]
  incoming?: TeammateRequestRecord[]
  outgoing?: TeammateRequestRecord[]
  message?: string
}> {
  if (!studentId) return { success: false, sent: [], received: [], message: 'Student ID required.' }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('teammate_requests') as any)
        .select('*, sender:profiles!teammate_requests_sender_id_fkey(id, display_name, avatar_url), receiver:profiles!teammate_requests_receiver_id_fkey(id, display_name, avatar_url), event:events(id, title, slug)')
        .or(`sender_id.eq.${studentId},receiver_id.eq.${studentId}`)
        .order('created_at', { ascending: false })

      if (!error && data) {
        const all = data as TeammateRequestRecord[]
        return {
          success: true,
          sent: all.filter((r) => r.sender_id === studentId),
          received: all.filter((r) => r.receiver_id === studentId),
        }
      }
    } catch {
      // fallback
    }
  }

  const all = getLocalRequests()
  const sent = all.filter((r) => r.sender_id === studentId)
  const received = all.filter((r) => r.receiver_id === studentId)
  return {
    success: true,
    sent,
    received,
    incoming: received,
    outgoing: sent,
  }
}

export const getTeammateProfile = getTeammateDiscoveryProfile
export const saveTeammateProfile = saveTeammateDiscoveryProfile

export async function getTeammateRequests(studentId: string) {
  const res = await getStudentTeammateRequests(studentId)
  return {
    ...res,
    incoming: res.received || [],
    outgoing: res.sent || [],
  }
}

export async function acceptTeammateRequest(requestId: string, receiverId: string) {
  return respondToTeammateRequest(requestId, receiverId, 'accepted')
}

export async function declineTeammateRequest(requestId: string, receiverId: string) {
  return respondToTeammateRequest(requestId, receiverId, 'declined')
}

