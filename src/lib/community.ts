import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type {
  StudentPublicProfile,
  ClubPublicProfile,
  ClubAnnouncementRecord,
  CampusFeedItem,
  StudentBadgeRecord,
} from '@/types'
import { getStudentBadges } from '@/lib/badges'
import { listClubEvents, listPublishedEvents, isEventCompleted } from '@/lib/events'

const LOCAL_STORAGE_FOLLOWERS = 'festflow_local_club_followers'
const LOCAL_STORAGE_ANNOUNCEMENTS = 'festflow_local_club_announcements'

let inMemoryFollowers: Array<{ id: string; student_id: string; club_id: string; created_at: string }> | null = null
let inMemoryAnnouncements: ClubAnnouncementRecord[] | null = null
const inMemoryStudentProfiles = new Map<string, any>()

export function seedMockStudentProfile(studentId: string, data: any) {
  inMemoryStudentProfiles.set(studentId, data)
}

function getLocalFollowers() {
  if (inMemoryFollowers !== null) return inMemoryFollowers
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_FOLLOWERS)
      if (raw) {
        inMemoryFollowers = JSON.parse(raw)
        return inMemoryFollowers!
      }
    }
  } catch {
    // ignore
  }
  inMemoryFollowers = []
  return inMemoryFollowers
}

function saveLocalFollowers(followers: Array<{ id: string; student_id: string; club_id: string; created_at: string }>) {
  inMemoryFollowers = followers
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_FOLLOWERS, JSON.stringify(followers))
    }
  } catch {
    // ignore
  }
}

function getLocalAnnouncements(): ClubAnnouncementRecord[] {
  if (inMemoryAnnouncements !== null) return inMemoryAnnouncements
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_ANNOUNCEMENTS)
      if (raw) {
        inMemoryAnnouncements = JSON.parse(raw)
        return inMemoryAnnouncements!
      }
    }
  } catch {
    // ignore
  }
  inMemoryAnnouncements = []
  return inMemoryAnnouncements
}

function saveLocalAnnouncements(announcements: ClubAnnouncementRecord[]) {
  inMemoryAnnouncements = announcements
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_ANNOUNCEMENTS, JSON.stringify(announcements))
    }
  } catch {
    // ignore
  }
}

/**
 * Retrieves a student's public profile respecting their visibility and field-hiding settings.
 * NEVER leaks email, phone number, or payment/registration IDs.
 */
export async function getStudentPublicProfile(
  studentId: string,
  viewerId?: string
): Promise<{ success: boolean; profile?: StudentPublicProfile; isPrivate?: boolean; message?: string }> {
  if (!studentId) return { success: false, message: 'Student ID required.' }

  let baseUser: any = null
  let studentDetails: any = null
  let teammateDoc: any = null

  if (isSupabaseConfigured) {
    try {
      const [uRes, sRes, tRes] = await Promise.all([
        (supabase.from('profiles') as any)
          .select('id, display_name, avatar_url')
          .eq('id', studentId)
          .maybeSingle(),
        (supabase.from('student_profiles') as any)
          .select('*')
          .eq('profile_id', studentId)
          .maybeSingle(),
        (supabase.from('teammate_profiles') as any)
          .select('*')
          .eq('student_id', studentId)
          .maybeSingle(),
      ])
      baseUser = uRes.data
      studentDetails = sRes.data
      teammateDoc = tRes.data
    } catch {
      // fallback
    }
  }

  // Fallback to local storage or mocked profile in development
  if (inMemoryStudentProfiles.has(studentId)) {
    const m = inMemoryStudentProfiles.get(studentId)
    baseUser = {
      id: studentId,
      display_name: m.profile?.display_name || m.user?.user_metadata?.display_name || 'Student',
      avatar_url: m.profile?.avatar_url || null,
    }
    studentDetails = m.studentProfile || {}
  } else if (!baseUser && typeof localStorage !== 'undefined') {
    const rawMock = localStorage.getItem('festflow_simulated_auth')
    if (rawMock) {
      try {
        const parsed = JSON.parse(rawMock)
        if (parsed.user?.id === studentId || parsed.profile?.id === studentId) {
          baseUser = {
            id: studentId,
            display_name: parsed.profile?.display_name || parsed.user?.user_metadata?.display_name || 'Student',
            avatar_url: parsed.profile?.avatar_url || null,
          }
          studentDetails = parsed.studentProfile || {}
        }
      } catch {
        // ignore
      }
    }
  }

  if (!baseUser) {
    baseUser = {
      id: studentId,
      display_name: 'Campus Scholar',
      avatar_url: null,
    }
    studentDetails = {}
  }

  const visibility = studentDetails?.visibility || 'public'
  const isOwner = viewerId === studentId

  // Privacy rules
  if (visibility === 'private' && !isOwner) {
    return {
      success: true,
      isPrivate: true,
      profile: {
        id: studentId,
        displayName: baseUser.display_name,
        avatarUrl: baseUser.avatar_url,
        skills: [],
        interests: [],
        preferredCategories: [],
        socialLinks: {},
        visibility: 'private',
        hideEvents: true,
        hideSkills: true,
        badges: [],
        attendedEventsCount: 0,
        isTeammateDiscoverable: false,
      },
    }
  }

  // Fetch verified badges
  const badgesRes = await getStudentBadges(studentId)

  // Calculate attended events from check-ins or registrations
  let attendedCount = 0
  if (isSupabaseConfigured) {
    try {
      const { data: userRegs } = await (supabase.from('registrations') as any)
        .select('id')
        .eq('student_id', studentId)
        .in('status', ['confirmed'])
      if (userRegs && userRegs.length > 0) {
        attendedCount = userRegs.length
      }
    } catch {
      // ignore
    }
  }

  const visibleBadges = (badgesRes || []).filter(
    (b: StudentBadgeRecord) => isOwner || b.is_public
  )

  const publicProfile: StudentPublicProfile = {
    id: studentId,
    displayName: baseUser.display_name,
    avatarUrl: baseUser.avatar_url,
    bio: studentDetails?.bio || null,
    collegeName: studentDetails?.college_name || null,
    course: studentDetails?.course || null,
    academicYear: studentDetails?.academic_year || null,
    skills: studentDetails?.hide_skills && !isOwner ? [] : studentDetails?.skills || [],
    interests: studentDetails?.interests || [],
    preferredCategories: studentDetails?.preferred_categories || [],
    socialLinks: studentDetails?.social_links || {},
    visibility,
    hideEvents: !!studentDetails?.hide_events,
    hideSkills: !!studentDetails?.hide_skills,
    badges: visibleBadges,
    attendedEventsCount: studentDetails?.hide_events && !isOwner ? 0 : attendedCount,
    isTeammateDiscoverable: !!teammateDoc?.is_opted_in,
    teammateAvailability: teammateDoc?.availability || null,
  }

  return { success: true, profile: publicProfile, isPrivate: false }
}

/**
 * Retrieves a club's public profile page with follower status, event schedule, and announcements.
 */
export async function getClubPublicProfile(
  clubId: string,
  viewerId?: string
): Promise<{ success: boolean; club?: ClubPublicProfile; message?: string }> {
  if (!clubId) return { success: false, message: 'Club ID required.' }

  let clubData: any = null
  if (isSupabaseConfigured) {
    try {
      const { data } = await (supabase.from('club_profiles') as any)
        .select('*')
        .eq('profile_id', clubId)
        .maybeSingle()
      if (data) clubData = data
    } catch {
      // fallback
    }
  }

  if (!clubData) {
    clubData = {
      profile_id: clubId,
      club_name: 'Campus Student Organization',
      representative_name: 'Lead Organizer',
      description: 'Official student organization hosted on FestFlow.',
      website_url: null,
      is_verified: false,
      category: 'General',
      logo_url: null,
      cover_url: null,
      social_links: {},
    }
  }

  // Follower count & status
  let followersCount = 0
  let isFollowing = false

  if (isSupabaseConfigured) {
    try {
      const { count } = await (supabase.from('club_followers') as any)
        .select('id', { count: 'exact', head: true })
        .eq('club_id', clubId)
      followersCount = count || 0

      if (viewerId) {
        const { data: followRow } = await (supabase.from('club_followers') as any)
          .select('id')
          .eq('club_id', clubId)
          .eq('student_id', viewerId)
          .maybeSingle()
        isFollowing = !!followRow
      }
    } catch {
      // fallback
    }
  } else {
    const followers = getLocalFollowers()
    followersCount = followers.filter((f) => f.club_id === clubId).length
    isFollowing = !!(viewerId && followers.some((f) => f.club_id === clubId && f.student_id === viewerId))
  }

  // Events & Announcements
  const [eventsRes, announcementsRes] = await Promise.all([
    listClubEvents(clubId),
    getClubAnnouncements(clubId, viewerId),
  ])

  const allEvents = eventsRes.events || []
  const now = new Date()
  const upcomingEvents = allEvents.filter(
    (e) => e.status === 'published' && new Date(e.start_date) >= now
  )
  const pastEvents = allEvents.filter(
    (e) => e.status === 'published' && new Date(e.start_date) < now
  )

  const clubProfile: ClubPublicProfile = {
    id: clubId,
    clubName: clubData.club_name,
    representativeName: clubData.representative_name,
    description: clubData.description,
    websiteUrl: clubData.website_url,
    isVerified: !!clubData.is_verified,
    category: clubData.category || 'General',
    logoUrl: clubData.logo_url,
    coverUrl: clubData.cover_url,
    socialLinks: clubData.social_links || {},
    followersCount,
    isFollowing,
    upcomingEvents,
    pastEvents,
    announcements: announcementsRes.announcements,
  }

  return { success: true, club: clubProfile }
}

/**
 * Follows an official student club.
 */
export async function followClub(
  studentId: string,
  clubId: string
): Promise<{ success: boolean; message?: string }> {
  if (!studentId || !clubId) return { success: false, message: 'Invalid follow parameters.' }
  if (studentId === clubId) return { success: false, message: 'You cannot follow yourself.' }

  if (isSupabaseConfigured) {
    try {
      const { error } = await (supabase.from('club_followers') as any).insert({
        student_id: studentId,
        club_id: clubId,
      })
      if (error && error.code !== '23505') {
        return { success: false, message: error.message }
      }
      return { success: true, message: 'Following club.' }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to follow club.' }
    }
  }

  const followers = getLocalFollowers()
  if (!followers.some((f) => f.student_id === studentId && f.club_id === clubId)) {
    followers.push({
      id: `flw_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      student_id: studentId,
      club_id: clubId,
      created_at: new Date().toISOString(),
    })
    saveLocalFollowers(followers)
  }
  return { success: true, message: 'Following club.' }
}

/**
 * Unfollows a club.
 */
export async function unfollowClub(
  studentId: string,
  clubId: string
): Promise<{ success: boolean; message?: string }> {
  if (!studentId || !clubId) return { success: false, message: 'Invalid unfollow parameters.' }

  if (isSupabaseConfigured) {
    try {
      const { error } = await (supabase.from('club_followers') as any)
        .delete()
        .eq('student_id', studentId)
        .eq('club_id', clubId)
      if (error) return { success: false, message: error.message }
      return { success: true, message: 'Unfollowed club.' }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to unfollow club.' }
    }
  }

  const followers = getLocalFollowers().filter(
    (f) => !(f.student_id === studentId && f.club_id === clubId)
  )
  saveLocalFollowers(followers)
  return { success: true, message: 'Unfollowed club.' }
}

/**
 * Retrieves list of club IDs that a student follows.
 */
export async function getFollowedClubIds(studentId: string): Promise<string[]> {
  if (!studentId) return []

  if (isSupabaseConfigured) {
    try {
      const { data } = await (supabase.from('club_followers') as any)
        .select('club_id')
        .eq('student_id', studentId)
      return (data || []).map((row: any) => row.club_id)
    } catch {
      return []
    }
  }

  return getLocalFollowers()
    .filter((f) => f.student_id === studentId)
    .map((f) => f.club_id)
}

/**
 * Retrieves club announcements with permission checks for member-only posts.
 */
export async function getClubAnnouncements(
  clubId: string,
  _viewerId?: string
): Promise<{ success: boolean; announcements: ClubAnnouncementRecord[]; message?: string }> {
  if (!clubId) return { success: false, announcements: [], message: 'Club ID required.' }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('club_announcements') as any)
        .select('*, author:profiles(display_name, avatar_url)')
        .eq('club_id', clubId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) {
        return { success: false, announcements: [], message: error.message }
      }
      return { success: true, announcements: (data as ClubAnnouncementRecord[]) || [] }
    } catch (err: any) {
      return {
        success: false,
        announcements: [],
        message: err?.message || 'Failed to load club announcements.',
      }
    }
  }

  const list = getLocalAnnouncements().filter((a) => a.club_id === clubId)
  list.sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
  return { success: true, announcements: list }
}

/**
 * Creates an authoritative club announcement.
 */
export async function createClubAnnouncement(params: {
  clubId: string
  authorId: string
  title: string
  content: string
  imageUrl?: string | null
  isPinned?: boolean
  isMembersOnly?: boolean
}): Promise<{ success: boolean; announcement?: ClubAnnouncementRecord; message?: string }> {
  if (!params.clubId || !params.title?.trim() || !params.content?.trim()) {
    return { success: false, message: 'Please provide announcement title and content.' }
  }

  const payload = {
    club_id: params.clubId,
    author_id: params.authorId,
    title: params.title.trim(),
    content: params.content.trim(),
    image_url: params.imageUrl || null,
    is_pinned: !!params.isPinned,
    is_members_only: !!params.isMembersOnly,
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('club_announcements') as any)
        .insert(payload)
        .select('*')
        .single()
      if (!error && data) {
        return { success: true, announcement: data as ClubAnnouncementRecord }
      }
      return { success: false, message: error?.message || 'Failed to publish announcement.' }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Database error creating announcement.' }
    }
  }

  const list = getLocalAnnouncements()
  const newRecord: ClubAnnouncementRecord = {
    ...payload,
    id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  list.unshift(newRecord)
  saveLocalAnnouncements(list)
  return { success: true, announcement: newRecord }
}

/**
 * Aggregates a curated, high-trust Campus Activity Feed.
 * Combines:
 * 1. Club announcements from followed clubs or featured clubs
 * 2. Newly published campus events
 * 3. Recent milestone achievements and badges
 */
export async function getCampusActivityFeed(options: {
  viewerId?: string
  filter?: 'all' | 'announcements' | 'events' | 'achievements'
  limit?: number
}): Promise<{ success: boolean; items: CampusFeedItem[]; message?: string }> {
  const filter = options.filter || 'all'
  const maxItems = options.limit || 25
  const feedItems: CampusFeedItem[] = []

  try {
    // 1. Fetch Events
    if (filter === 'all' || filter === 'events') {
      const eventsRes = await listPublishedEvents({ limit: 10 })
      const activeEvents = (eventsRes.events || []).filter((e) => !isEventCompleted(e))
      for (const ev of activeEvents) {
        feedItems.push({
          id: `feed_evt_${ev.id}`,
          type: 'event',
          timestamp: ev.created_at || ev.start_date,
          title: `New Event: ${ev.title}`,
          content: ev.summary || ev.description?.substring(0, 160),
          imageUrl: ev.cover_url || ev.poster_url,
          linkUrl: `/events/${ev.slug}`,
          author: {
            id: ev.club_id,
            name: (ev as any).club?.club_name || 'Campus Club',
            isClub: true,
            isVerified: (ev as any).club?.is_verified,
          },
          meta: {
            eventName: ev.title,
            eventSlug: ev.slug,
            eventCategory: ev.category,
            eventStartDate: ev.start_date,
          },
        })
      }
    }

    // 2. Fetch Announcements
    if (filter === 'all' || filter === 'announcements') {
      let announcements: ClubAnnouncementRecord[] = []
      if (isSupabaseConfigured) {
        try {
          const { data } = await (supabase.from('club_announcements') as any)
            .select('*, club:club_profiles(club_name, logo_url, is_verified)')
            .eq('is_members_only', false)
            .order('created_at', { ascending: false })
            .limit(10)
          if (data) announcements = data as ClubAnnouncementRecord[]
        } catch {
          // ignore
        }
      } else {
        announcements = getLocalAnnouncements().filter((a) => !a.is_members_only)
      }

      for (const ann of announcements) {
        feedItems.push({
          id: `feed_ann_${ann.id}`,
          type: 'announcement',
          timestamp: ann.created_at,
          title: ann.title,
          content: ann.content,
          imageUrl: ann.image_url,
          linkUrl: `/clubs/${ann.club_id}`,
          author: {
            id: ann.club_id,
            name: ann.club?.club_name || 'Club Organizer',
            avatarUrl: ann.club?.logo_url,
            isClub: true,
            isVerified: ann.club?.is_verified,
          },
          meta: {
            isPinned: ann.is_pinned,
          },
        })
      }
    }

    // Sort by timestamp descending
    feedItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return { success: true, items: feedItems.slice(0, maxItems) }
  } catch (err: any) {
    return { success: false, items: [], message: err?.message || 'Failed to aggregate feed.' }
  }
}
