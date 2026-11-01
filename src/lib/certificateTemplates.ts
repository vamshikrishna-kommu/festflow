import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type {
  CertificateTemplateRecord,
  CertificateTemplateInsert,
  CertificateTheme,
  CertificateBorderStyle,
} from '@/types'

const LOCAL_STORAGE_KEY = 'festflow_local_certificate_templates'

export const DEFAULT_STARTER_TEMPLATES: Array<Omit<CertificateTemplateRecord, 'club_id'>> = [
  {
    id: 'tpl_obsidian_excellence',
    name: 'Obsidian & Gold Distinction',
    description: 'High-contrast dark obsidian luxury theme with gold borders and royal purple accents. Perfect for hackathons and flagships.',
    layout: 'landscape',
    theme: 'obsidian_gold',
    title_text: 'CERTIFICATE OF EXCELLENCE',
    subtitle_text: 'This prestigious accolade is proudly conferred upon',
    body_template: 'for demonstrating exceptional technical mastery, innovation, and leadership during {event_title}, organized by {club_name} on {event_date}.',
    signatory_1_name: 'Dr. Sarah Mitchell',
    signatory_1_role: 'Faculty Convener & Head of Council',
    signatory_1_signature_url: null,
    signatory_2_name: 'Alex Rivera',
    signatory_2_role: 'Club President & Lead Organizer',
    signatory_2_signature_url: null,
    club_logo_url: null,
    border_style: 'classic_gold',
    is_default: true,
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tpl_cyan_tech_neon',
    name: 'Cyberpunk Neon Cyan',
    description: 'Futuristic technical certificate featuring FestFlow neon cyan & sky blue guilloche borders and microtext.',
    layout: 'landscape',
    theme: 'cyan_cobalt',
    title_text: 'CERTIFICATE OF ACHIEVEMENT',
    subtitle_text: 'In recognition of outstanding performance and contribution, presented to',
    body_template: 'for competitive excellence, collaborative problem-solving, and active completion of {event_title} presented by {club_name} on {event_date}.',
    signatory_1_name: 'Prof. K. Venkatesh',
    signatory_1_role: 'Dean of Student Affairs',
    signatory_1_signature_url: null,
    signatory_2_name: 'Rohan Sharma',
    signatory_2_role: 'Technical Secretary',
    signatory_2_signature_url: null,
    club_logo_url: null,
    border_style: 'tech_neon',
    is_default: false,
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tpl_royal_violet_workshop',
    name: 'Royal Violet Participation',
    description: 'Elegant academic royal violet certificate designed for hands-on bootcamps, masterclasses, and seminars.',
    layout: 'landscape',
    theme: 'royal_violet',
    title_text: 'CERTIFICATE OF PARTICIPATION',
    subtitle_text: 'This is to officially certify that',
    body_template: 'has actively attended and successfully completed all hands-on coursework and practical evaluations for {event_title} conducted by {club_name} on {event_date}.',
    signatory_1_name: 'Aishwarya Nair',
    signatory_1_role: 'Program Director',
    signatory_1_signature_url: null,
    signatory_2_name: 'Vikram Joshi',
    signatory_2_role: 'Club Vice President',
    signatory_2_signature_url: null,
    club_logo_url: null,
    border_style: 'modern_double',
    is_default: false,
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'tpl_radiant_winner',
    name: 'Radiant Laureate (Winner Award)',
    description: 'Celebratory radiant magenta certificate for championship winners, first-place hackathon teams, and podium finishers.',
    layout: 'landscape',
    theme: 'radiant_magenta',
    title_text: 'CERTIFICATE OF MERIT & VICTORY',
    subtitle_text: 'Awarded with highest honors to',
    body_template: 'in proud recognition of securing the Winner position at {event_title}, displaying unmatched ingenuity and peerless execution under {club_name} on {event_date}.',
    signatory_1_name: 'Dr. Ramesh Sundaram',
    signatory_1_role: 'Chief Jury & Evaluation Chair',
    signatory_1_signature_url: null,
    signatory_2_name: 'Sneha Patel',
    signatory_2_role: 'Club Organizing Chairperson',
    signatory_2_signature_url: null,
    club_logo_url: null,
    border_style: 'classic_gold',
    is_default: false,
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
]

function getLocalTemplates(): CertificateTemplateRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
}

function saveLocalTemplates(templates: CertificateTemplateRecord[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(templates))
  } catch {
    // ignore
  }
}

/**
 * Retrieves all certificate templates belonging to a specific club.
 * Seeds starter templates automatically if none exist.
 */
export async function getClubCertificateTemplates(clubId: string): Promise<{
  success: boolean
  templates: CertificateTemplateRecord[]
  message?: string
}> {
  if (!clubId) return { success: false, templates: [], message: 'Club ID required' }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('certificate_templates') as any)
        .select('*')
        .eq('club_id', clubId)
        .eq('is_archived', false)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })

      if (!error && data && data.length > 0) {
        return { success: true, templates: data as CertificateTemplateRecord[] }
      }

      // If no templates created yet, seed the default starter templates for this club
      if (!error && (!data || data.length === 0)) {
        const seeded: CertificateTemplateRecord[] = []
        for (const [index, tpl] of DEFAULT_STARTER_TEMPLATES.entries()) {
          const { data: newTpl } = await (supabase.from('certificate_templates') as any)
            .insert({
              ...tpl,
              id: undefined,
              club_id: clubId,
              is_default: index === 0,
            })
            .select('*')
            .single()

          if (newTpl) seeded.push(newTpl as CertificateTemplateRecord)
        }
        if (seeded.length > 0) {
          return { success: true, templates: seeded }
        }
      }
    } catch {
      // Fall through to local simulation
    }
  }

  // Simulation Mode
  let local = getLocalTemplates().filter((t) => t.club_id === clubId && !t.is_archived)
  if (local.length === 0) {
    const seeded = DEFAULT_STARTER_TEMPLATES.map((tpl, i) => ({
      ...tpl,
      id: `tpl_${clubId}_${i}`,
      club_id: clubId,
      is_default: i === 0,
    }))
    const all = [...getLocalTemplates(), ...seeded]
    saveLocalTemplates(all)
    local = seeded
  }

  return { success: true, templates: local }
}

/**
 * Retrieves a single certificate template by ID.
 */
export async function getCertificateTemplateById(templateId: string): Promise<CertificateTemplateRecord | null> {
  if (!templateId) return null

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('certificate_templates') as any)
        .select('*')
        .eq('id', templateId)
        .maybeSingle()

      if (!error && data) return data as CertificateTemplateRecord
    } catch {
      // ignore
    }
  }

  const local = getLocalTemplates().find((t) => t.id === templateId)
  if (local) return local

  const starter = DEFAULT_STARTER_TEMPLATES.find((t) => t.id === templateId)
  if (starter) return { ...starter, club_id: 'default' }
  return null
}

/**
 * Creates a new custom certificate template for a club.
 */
export async function createCertificateTemplate(
  params: CertificateTemplateInsert
): Promise<{ success: boolean; template?: CertificateTemplateRecord; message?: string }> {
  if (!params.club_id || !params.name?.trim()) {
    return { success: false, message: 'Template name and issuing club are required.' }
  }

  const payload = {
    club_id: params.club_id,
    name: params.name.trim(),
    description: params.description?.trim() || null,
    layout: params.layout || 'landscape',
    theme: (params.theme as CertificateTheme) || 'obsidian_gold',
    title_text: params.title_text?.trim() || 'CERTIFICATE OF PARTICIPATION',
    subtitle_text: params.subtitle_text?.trim() || 'This is proudly presented to',
    body_template:
      params.body_template?.trim() ||
      'for outstanding participation and successful completion of {event_title} organized by {club_name} on {event_date}.',
    signatory_1_name: params.signatory_1_name?.trim() || null,
    signatory_1_role: params.signatory_1_role?.trim() || null,
    signatory_1_signature_url: params.signatory_1_signature_url || null,
    signatory_2_name: params.signatory_2_name?.trim() || null,
    signatory_2_role: params.signatory_2_role?.trim() || null,
    signatory_2_signature_url: params.signatory_2_signature_url || null,
    club_logo_url: params.club_logo_url || null,
    border_style: (params.border_style as CertificateBorderStyle) || 'modern_double',
    is_default: Boolean(params.is_default),
    is_archived: false,
  }

  if (isSupabaseConfigured) {
    try {
      // If setting as default, unset previous default
      if (payload.is_default) {
        await (supabase.from('certificate_templates') as any)
          .update({ is_default: false })
          .eq('club_id', params.club_id)
      }

      const { data, error } = await (supabase.from('certificate_templates') as any)
        .insert(payload)
        .select('*')
        .single()

      if (!error && data) {
        return { success: true, template: data as CertificateTemplateRecord }
      }
      return { success: false, message: error?.message || 'Failed to create certificate template.' }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Database error creating template.' }
    }
  }

  // Simulation Mode
  const id = `tpl_custom_${Date.now()}`
  const newTpl: CertificateTemplateRecord = {
    ...payload,
    id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const existing = getLocalTemplates()
  if (payload.is_default) {
    for (const t of existing) {
      if (t.club_id === params.club_id) t.is_default = false
    }
  }
  existing.unshift(newTpl)
  saveLocalTemplates(existing)

  return { success: true, template: newTpl }
}

/**
 * Updates an existing certificate template.
 */
export async function updateCertificateTemplate(
  templateId: string,
  updates: Partial<CertificateTemplateInsert>
): Promise<{ success: boolean; template?: CertificateTemplateRecord; message?: string }> {
  if (!templateId) return { success: false, message: 'Template ID required.' }

  if (isSupabaseConfigured) {
    try {
      if (updates.is_default && updates.club_id) {
        await (supabase.from('certificate_templates') as any)
          .update({ is_default: false })
          .eq('club_id', updates.club_id)
      }

      const { data, error } = await (supabase.from('certificate_templates') as any)
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', templateId)
        .select('*')
        .single()

      if (!error && data) {
        return { success: true, template: data as CertificateTemplateRecord }
      }
      return { success: false, message: error?.message || 'Failed to update certificate template.' }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Database error updating template.' }
    }
  }

  // Simulation Mode
  const existing = getLocalTemplates()
  const idx = existing.findIndex((t) => t.id === templateId)
  if (idx === -1) return { success: false, message: 'Template not found.' }

  if (updates.is_default && existing[idx].club_id) {
    for (const t of existing) {
      if (t.club_id === existing[idx].club_id) t.is_default = false
    }
  }

  existing[idx] = {
    ...existing[idx],
    ...updates,
    updated_at: new Date().toISOString(),
  }
  saveLocalTemplates(existing)

  return { success: true, template: existing[idx] }
}

/**
 * Archives a certificate template safely without deleting historical references.
 */
export async function archiveCertificateTemplate(templateId: string): Promise<{ success: boolean; message?: string }> {
  return updateCertificateTemplate(templateId, { is_archived: true })
}

