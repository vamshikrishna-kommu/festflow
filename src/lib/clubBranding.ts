import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { ClubProfile, ClubSocialLinks } from '@/types'

const LOCAL_STORAGE_CLUB_BRANDING_KEY = 'festflow_local_club_branding'

function getLocalClubBranding(): Record<string, Partial<ClubProfile & { logo_url?: string; cover_url?: string; category?: string; social_links?: ClubSocialLinks }>> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CLUB_BRANDING_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // fallback
  }
  return {}
}

function saveLocalClubBranding(data: Record<string, any>): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_CLUB_BRANDING_KEY, JSON.stringify(data))
  } catch {
    // fallback
  }
}

export async function getClubBranding(clubId: string): Promise<{
  profile?: ClubProfile & {
    logo_url?: string
    cover_url?: string
    category?: string
    social_links?: ClubSocialLinks
  }
  error?: string
}> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('club_profiles') as any)
        .select('*')
        .eq('profile_id', clubId)
        .maybeSingle()

      if (error) {
        return { error: error.message }
      }
      return { profile: data || undefined }
    } catch (e: any) {
      return { error: e?.message || 'Failed to load club branding.' }
    }
  }

  const local = getLocalClubBranding()
  if (local[clubId]) {
    return { profile: local[clubId] as any }
  }

  return {
    profile: {
      id: `cp_${clubId}`,
      profile_id: clubId,
      club_name: 'Campus Organization',
      representative_name: 'Lead Organizer',
      website_url: null,
      description: 'Official student organization powering premier campus hackathons, technical conferences, and cultural fests.',
      is_verified: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      category: 'Technical & Engineering',
      logo_url: null,
      cover_url: null,
      social_links: {
        instagram: '',
        linkedin: '',
        twitter: '',
        discord: '',
        website: '',
      },
    } as any,
  }
}

export async function updateClubBranding(
  clubId: string,
  updates: {
    club_name?: string
    representative_name?: string
    description?: string
    website_url?: string
    category?: string
    logo_url?: string
    cover_url?: string
    social_links?: ClubSocialLinks
  }
): Promise<{ success: boolean; error?: string }> {
  const payload = {
    ...updates,
    updated_at: new Date().toISOString(),
  }

  if (isSupabaseConfigured) {
    try {
      const { error } = await (supabase.from('club_profiles') as any)
        .update(payload)
        .eq('profile_id', clubId)

      if (error) {
        return { success: false, error: error.message }
      }
      return { success: true }
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || 'Failed to update club branding.',
      }
    }
  }

  const local = getLocalClubBranding()
  local[clubId] = {
    ...(local[clubId] || {}),
    ...payload,
  }
  saveLocalClubBranding(local)

  return { success: true }
}

