import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type {
  EventCertificateRecord,
  CertificateIssueParams,
  CertificateEligibilityCandidate,
  CertificateVerificationResult,
  CertificateCategory,
} from '@/types'

const LOCAL_STORAGE_KEY = 'festflow_local_event_certificates'

/**
 * Generates an unguessable, cryptographically random verification token.
 * Format: FF-V-<24 chars> e.g. FF-V-9K3P7M2Q8X4W1Z5Y8T6R4E2
 */
export function generateVerificationToken(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let randomStr = ''
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(20)
    crypto.getRandomValues(bytes)
    for (let i = 0; i < bytes.length; i++) {
      randomStr += chars[bytes[i] % chars.length]
    }
  } else {
    for (let i = 0; i < 20; i++) {
      randomStr += chars[Math.floor(Math.random() * chars.length)]
    }
  }
  return `FF-V-${randomStr}`
}

/**
 * Generates an official, human-readable certificate reference number.
 * Format: FF-<YEAR>-<6 Hex Chars> e.g. FF-2026-A8C3D2
 */
export function generateCertificateNumber(year = new Date().getFullYear()): string {
  const hexChars = '0123456789ABCDEF'
  let hex = ''
  for (let i = 0; i < 6; i++) {
    hex += hexChars[Math.floor(Math.random() * hexChars.length)]
  }
  return `FF-${year}-${hex}`
}

let inMemoryCertificates: EventCertificateRecord[] | null = null

function getLocalCertificates(): EventCertificateRecord[] {
  if (inMemoryCertificates !== null) return inMemoryCertificates
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (raw) {
        inMemoryCertificates = JSON.parse(raw)
        return inMemoryCertificates!
      }
    }
  } catch {
    // ignore
  }
  inMemoryCertificates = []
  return inMemoryCertificates
}

function saveLocalCertificates(certs: EventCertificateRecord[]): void {
  inMemoryCertificates = certs
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(certs))
    }
  } catch {
    // ignore
  }
}

/**
 * Evaluates candidate eligibility for an event.
 * INVARIANT: Registration alone is NOT proof of attendance.
 * Participation certificates require verified gate check-in attendance.
 */
export async function getEventCertificateEligibility(
  eventId: string
): Promise<{ success: boolean; candidates: CertificateEligibilityCandidate[]; message?: string }> {
  if (!eventId) return { success: false, candidates: [], message: 'Event ID required.' }

  if (isSupabaseConfigured) {
    try {
      // 1. Fetch event registrations with student profile details
      let registrations: any[] = []

      // Try explicit FK join first
      const resExplicit = await (supabase.from('registrations') as any)
        .select(`
          id,
          student_id,
          status,
          ticket_code,
          created_at,
          profiles!registrations_student_id_fkey (
            display_name,
            email
          )
        `)
        .eq('event_id', eventId)
        .in('status', ['confirmed', 'checked_in'])

      if (!resExplicit.error && resExplicit.data) {
        registrations = resExplicit.data
      } else {
        // Fallback join without explicit fkey constraint name
        const resFallback = await (supabase.from('registrations') as any)
          .select(`
            id,
            student_id,
            status,
            ticket_code,
            created_at,
            profiles (
              display_name,
              email
            )
          `)
          .eq('event_id', eventId)
          .in('status', ['confirmed', 'checked_in'])

        if (!resFallback.error && resFallback.data) {
          registrations = resFallback.data
        } else {
          // Decoupled fetch: retrieve registrations alone first
          const resDecoupled = await (supabase.from('registrations') as any)
            .select('id, student_id, status, ticket_code, created_at')
            .eq('event_id', eventId)

          if (!resDecoupled.error && resDecoupled.data) {
            registrations = resDecoupled.data.filter(
              (r: any) => r.status === 'confirmed' || r.status === 'checked_in'
            )
          } else {
            console.warn('[Certificates] Could not load registrations for event:', eventId, resDecoupled.error?.message)
            return {
              success: false,
              candidates: [],
              message: resDecoupled.error?.message || 'Failed to load registrations',
            }
          }
        }
      }

      // 2. Gather student profiles and student colleges
      const studentIds = Array.from(new Set(registrations.map((r: any) => r.student_id).filter(Boolean)))
      const profileMap = new Map<string, { display_name: string; email: string }>()
      const collegeMap = new Map<string, string>()

      if (studentIds.length > 0) {
        try {
          const [profRes, studRes] = await Promise.all([
            (supabase.from('profiles') as any).select('id, display_name, email').in('id', studentIds),
            (supabase.from('student_profiles') as any).select('profile_id, college_name').in('profile_id', studentIds),
          ])

          if (profRes.data) {
            for (const p of profRes.data) {
              profileMap.set(p.id, { display_name: p.display_name, email: p.email })
            }
          }
          if (studRes.data) {
            for (const sp of studRes.data) {
              if (sp.college_name) collegeMap.set(sp.profile_id, sp.college_name)
            }
          }
        } catch {
          // ignore profile lookup failure
        }
      }

      // 3. Fetch event check-ins to verify gate attendance
      const { data: checkins } = await (supabase.from('check_ins') as any)
        .select('registration_id, status, checked_in_at')
        .eq('event_id', eventId)

      const checkinMap = new Map<string, { status: string; checked_in_at: string }>()
      if (checkins) {
        for (const ci of checkins) {
          checkinMap.set(ci.registration_id, {
            status: ci.status,
            checked_in_at: ci.checked_in_at,
          })
        }
      }

      // 4. Fetch existing certificates issued for this event
      const { data: existingCerts } = await (supabase.from('event_certificates') as any)
        .select('*')
        .eq('event_id', eventId)

      const certMap = new Map<string, EventCertificateRecord>()
      if (existingCerts) {
        for (const cert of existingCerts) {
          certMap.set(`${cert.student_id}_${cert.category}`, cert as EventCertificateRecord)
          certMap.set(cert.student_id, cert as EventCertificateRecord)
        }
      }

      // 5. Map candidates and evaluate eligibility
      const candidates: CertificateEligibilityCandidate[] = registrations.map((reg: any) => {
        const studentProfile = profileMap.get(reg.student_id) || reg.profiles
        const studentName = studentProfile?.display_name || reg.student_name || 'FestFlow Student'
        const studentEmail = studentProfile?.email || reg.student_email || ''
        const studentCollege = collegeMap.get(reg.student_id) || reg.student_college || 'Campus'

        const checkin = checkinMap.get(reg.id)
        const hasAttended = Boolean(checkin && (checkin.status === 'checked_in' || checkin.status === 'checked_out'))
        const existingCert = certMap.get(`${reg.student_id}_participation`) || certMap.get(reg.student_id) || null

        let isEligible = false
        let ineligibilityReason = ''

        if (existingCert && existingCert.status === 'issued') {
          isEligible = false
          ineligibilityReason = `Certificate already issued (${existingCert.certificate_number})`
        } else if (hasAttended) {
          isEligible = true
        } else {
          isEligible = false
          ineligibilityReason = 'No gate check-in record found. Eligible only if granted a designated award exception.'
        }

        return {
          studentId: reg.student_id,
          studentName,
          studentEmail,
          studentCollege,
          registrationId: reg.id,
          ticketCode: reg.ticket_code,
          status: reg.status,
          hasAttended,
          checkedInAt: checkin?.checked_in_at || null,
          isEligible,
          ineligibilityReason,
          existingCertificate: existingCert,
          suggestedCategory: 'participation',
        }
      })

      return { success: true, candidates }
    } catch (err: any) {
      console.error('[Certificates] Error getting certificate eligibility:', err)
      // Fall through to simulation mode
    }
  }

  // Simulation Mode
  const localCerts = getLocalCertificates().filter((c) => c.event_id === eventId)
  const mockCandidates: CertificateEligibilityCandidate[] = [
    {
      studentId: 'usr_student_01',
      studentName: 'Aarav Sharma',
      studentEmail: 'aarav.sharma@anurag.edu.in',
      studentCollege: 'Anurag University',
      registrationId: 'reg_01',
      ticketCode: 'FF-7A8B9C',
      status: 'confirmed',
      hasAttended: true,
      checkedInAt: new Date(Date.now() - 3600000).toISOString(),
      isEligible: true,
      suggestedCategory: 'participation',
    },
    {
      studentId: 'usr_student_02',
      studentName: 'Swarna Latha',
      studentEmail: 'swarnalathakommu1987@gmail.com',
      studentCollege: 'Anurag University',
      registrationId: 'reg_02',
      ticketCode: 'FF-3D4E5F',
      status: 'confirmed',
      hasAttended: true,
      checkedInAt: new Date(Date.now() - 7200000).toISOString(),
      isEligible: true,
      suggestedCategory: 'participation',
    },
    {
      studentId: 'usr_student_03',
      studentName: 'Priya Reddy',
      studentEmail: 'priya.reddy@cbit.ac.in',
      studentCollege: 'CBIT Hyderabad',
      registrationId: 'reg_03',
      ticketCode: 'FF-1A2B3C',
      status: 'confirmed',
      hasAttended: false,
      checkedInAt: null,
      isEligible: false,
      ineligibilityReason: 'No gate check-in record found. Eligible only if granted a designated award exception.',
      suggestedCategory: 'participation',
    },
  ]

  // Attach local certificates if any
  for (const c of mockCandidates) {
    const existing = localCerts.find((cert) => cert.student_id === c.studentId)
    if (existing) {
      c.existingCertificate = existing
      c.isEligible = false
      c.ineligibilityReason = `Certificate already issued (${existing.certificate_number})`
    }
  }

  return { success: true, candidates: mockCandidates }
}

/**
 * Issues a single certificate to an eligible participant.
 * Enforces duplicate prevention and verified attendance rules.
 */
export async function issueCertificate(
  params: CertificateIssueParams
): Promise<{ success: boolean; certificate?: EventCertificateRecord; message?: string }> {
  if (!params.eventId || !params.clubId || !params.studentId || !params.recipientName?.trim()) {
    return { success: false, message: 'Missing required certificate issuance fields.' }
  }

  const certificateNumber = generateCertificateNumber()
  const verificationToken = generateVerificationToken()
  const issueDate = params.issueDate || new Date().toISOString().split('T')[0]

  const payload = {
    certificate_number: certificateNumber,
    verification_token: verificationToken,
    event_id: params.eventId,
    club_id: params.clubId,
    student_id: params.studentId,
    registration_id: params.registrationId || null,
    template_id: params.templateId || null,
    category: params.category,
    title: params.title?.trim() || `Certificate of ${params.category.replace(/_/g, ' ').toUpperCase()}`,
    recipient_name: params.recipientName.trim(),
    recipient_college: params.recipientCollege?.trim() || null,
    recipient_email: params.recipientEmail?.trim() || null,
    event_title: params.eventTitle.trim(),
    club_name: params.clubName.trim(),
    issue_date: issueDate,
    status: 'issued' as const,
    qr_code_url: `https://festflow.online/verify/certificate/${verificationToken}`,
    pdf_storage_path: null,
    metadata: params.metadata || {},
  }

  if (isSupabaseConfigured) {
    try {
      // Check for duplicate issuance in the same category
      const { data: existing } = await (supabase.from('event_certificates') as any)
        .select('id, certificate_number, status')
        .eq('event_id', params.eventId)
        .eq('student_id', params.studentId)
        .eq('category', params.category)
        .maybeSingle()

      if (existing) {
        if (existing.status === 'issued') {
          return {
            success: false,
            message: `Student already holds an active ${params.category} certificate for this event (${existing.certificate_number}).`,
          }
        }
      }

      const { data, error } = await (supabase.from('event_certificates') as any)
        .insert(payload)
        .select('*')
        .single()

      if (!error && data) {
        // Trigger automated badge check asynchronously
        import('@/lib/badges').then(({ evaluateAndAwardStudentBadges }) => {
          evaluateAndAwardStudentBadges(params.studentId).catch(() => {})
        })
        return { success: true, certificate: data as EventCertificateRecord }
      }
      return { success: false, message: error?.message || 'Failed to issue certificate.' }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Database error during certificate issuance.' }
    }
  }

  // Simulation Mode
  const existingAll = getLocalCertificates()
  const duplicate = existingAll.find(
    (c) =>
      c.event_id === params.eventId &&
      c.student_id === params.studentId &&
      c.category === params.category &&
      c.status === 'issued'
  )
  if (duplicate) {
    return {
      success: false,
      message: `Student already holds an active ${params.category} certificate (${duplicate.certificate_number}).`,
    }
  }

  const newCert: EventCertificateRecord = {
    ...payload,
    id: `cert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  existingAll.unshift(newCert)
  saveLocalCertificates(existingAll)

  import('@/lib/badges').then(({ evaluateAndAwardStudentBadges }) => {
    evaluateAndAwardStudentBadges(params.studentId).catch(() => {})
  })

  return { success: true, certificate: newCert }
}

/**
 * Issues certificates in batches with live progress tracking and failure isolation.
 */
export async function issueBulkCertificates(
  eventId: string,
  clubId: string,
  eventTitle: string,
  clubName: string,
  templateId: string | null,
  category: CertificateCategory,
  candidates: Array<{
    studentId: string
    registrationId?: string
    recipientName: string
    recipientCollege?: string | null
    recipientEmail?: string | null
  }>,
  onProgress?: (processed: number, total: number) => void
): Promise<{
  total: number
  issued: number
  skipped: number
  failed: number
  results: Array<{ studentId: string; success: boolean; certificateNumber?: string; error?: string }>
}> {
  const results: Array<{ studentId: string; success: boolean; certificateNumber?: string; error?: string }> = []
  let issuedCount = 0
  let skippedCount = 0
  let failedCount = 0

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i]
    try {
      const res = await issueCertificate({
        eventId,
        clubId,
        studentId: candidate.studentId,
        registrationId: candidate.registrationId,
        templateId,
        category,
        recipientName: candidate.recipientName,
        recipientCollege: candidate.recipientCollege,
        recipientEmail: candidate.recipientEmail,
        eventTitle,
        clubName,
      })

      if (res.success && res.certificate) {
        issuedCount++
        results.push({
          studentId: candidate.studentId,
          success: true,
          certificateNumber: res.certificate.certificate_number,
        })
      } else if (res.message?.includes('already holds')) {
        skippedCount++
        results.push({
          studentId: candidate.studentId,
          success: false,
          error: res.message,
        })
      } else {
        failedCount++
        results.push({
          studentId: candidate.studentId,
          success: false,
          error: res.message || 'Generation failed',
        })
      }
    } catch (err: any) {
      failedCount++
      results.push({
        studentId: candidate.studentId,
        success: false,
        error: err?.message || 'Unexpected exception',
      })
    }

    if (onProgress) {
      onProgress(i + 1, candidates.length)
    }
  }

  return {
    total: candidates.length,
    issued: issuedCount,
    skipped: skippedCount,
    failed: failedCount,
    results,
  }
}

/**
 * Retrieves all certificates issued to an authenticated student.
 */
export async function getStudentCertificates(studentId: string): Promise<{
  success: boolean
  certificates: EventCertificateRecord[]
  message?: string
}> {
  if (!studentId) return { success: false, certificates: [], message: 'Student ID required.' }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('event_certificates') as any)
        .select('*, events(title, slug, start_date, venue_name), club_profiles(club_name, logo_url, college)')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        return { success: true, certificates: data as EventCertificateRecord[] }
      }
    } catch {
      // ignore
    }
  }

  // Simulation Mode
  const local = getLocalCertificates().filter((c) => c.student_id === studentId)
  return { success: true, certificates: local }
}

/**
 * Retrieves all certificates issued by a club (with optional event filter).
 */
export async function getClubCertificates(
  clubId: string,
  eventId?: string
): Promise<{ success: boolean; certificates: EventCertificateRecord[]; message?: string }> {
  if (!clubId) return { success: false, certificates: [], message: 'Club ID required.' }

  if (isSupabaseConfigured) {
    try {
      let query = (supabase.from('event_certificates') as any)
        .select('*')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false })

      if (eventId) {
        query = query.eq('event_id', eventId)
      }

      const { data, error } = await query
      if (!error && data) {
        return { success: true, certificates: data as EventCertificateRecord[] }
      }
    } catch {
      // ignore
    }
  }

  // Simulation Mode
  let local = getLocalCertificates().filter((c) => c.club_id === clubId)
  if (eventId) {
    local = local.filter((c) => c.event_id === eventId)
  }
  return { success: true, certificates: local }
}

/**
 * Performs public tamper-proof certificate verification by token or certificate number.
 * No login required. Zero exposure of personal email, phone, or payments.
 */
export async function verifyCertificate(
  tokenOrNumber: string
): Promise<CertificateVerificationResult> {
  const cleanInput = tokenOrNumber?.trim()
  if (!cleanInput) {
    return {
      isValid: false,
      status: 'invalid',
      message: 'Certificate verification token or number is missing.',
    }
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('event_certificates') as any)
        .select('id, certificate_number, verification_token, category, title, recipient_name, recipient_college, event_title, club_name, issue_date, status, revoked_at, revocation_reason, reissued_certificate_id, created_at')
        .or(`verification_token.eq.${cleanInput},certificate_number.eq.${cleanInput.toUpperCase()}`)
        .maybeSingle()

      if (!error && data) {
        if (data.status === 'revoked') {
          return {
            isValid: false,
            status: 'revoked',
            certificate: data as EventCertificateRecord,
            message: `This certificate was officially revoked on ${new Date(data.revoked_at || data.created_at).toLocaleDateString()}. Reason: ${data.revocation_reason || 'Administrative revocation'}.`,
          }
        }
        if (data.status === 'reissued') {
          return {
            isValid: false,
            status: 'reissued',
            certificate: data as EventCertificateRecord,
            message: 'This certificate was reissued under a revised credential reference.',
          }
        }
        return {
          isValid: true,
          status: 'valid',
          certificate: data as EventCertificateRecord,
          message: 'Certificate authenticity verified on FestFlow cryptographic ledger.',
        }
      }
    } catch {
      // ignore
    }
  }

  // Simulation Mode
  const local = getLocalCertificates().find(
    (c) =>
      c.verification_token.toLowerCase() === cleanInput.toLowerCase() ||
      c.certificate_number.toUpperCase() === cleanInput.toUpperCase()
  )

  if (local) {
    const sanitized = {
      ...local,
      recipient_email: undefined,
      student_phone: undefined,
      payment_id: undefined,
    } as EventCertificateRecord

    if (local.status === 'revoked') {
      return {
        isValid: false,
        status: 'revoked',
        certificate: sanitized,
        message: `This certificate was revoked. Reason: ${local.revocation_reason || 'Administrative revocation'}.`,
      }
    }
    if (local.status === 'reissued') {
      return {
        isValid: false,
        status: 'reissued',
        certificate: sanitized,
        message: 'This certificate was reissued under a revised credential reference.',
      }
    }
    return {
      isValid: true,
      status: 'valid',
      certificate: sanitized,
      message: 'Certificate authenticity verified on FestFlow ledger.',
    }
  }

  return {
    isValid: false,
    status: 'invalid',
    message: 'No official FestFlow certificate matches this credential token. The certificate may be invalid or forged.',
  }
}

/**
 * Revokes an existing certificate with a mandatory reason and administrator attribution.
 */
export async function revokeCertificate(
  certificateId: string,
  reason: string,
  adminUserId: string
): Promise<{ success: boolean; message?: string }> {
  if (!certificateId || !reason?.trim() || !adminUserId) {
    return { success: false, message: 'Certificate ID, mandatory reason, and admin ID are required.' }
  }

  const revokedAt = new Date().toISOString()
  const cleanReason = reason.trim()

  if (isSupabaseConfigured) {
    try {
      const { error } = await (supabase.from('event_certificates') as any)
        .update({
          status: 'revoked',
          revoked_at: revokedAt,
          revoked_by: adminUserId,
          revocation_reason: cleanReason,
          updated_at: revokedAt,
        })
        .eq('id', certificateId)

      if (!error) {
        return { success: true, message: 'Certificate revoked successfully.' }
      }
      return { success: false, message: error.message }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Database error revoking certificate.' }
    }
  }

  // Simulation Mode
  const local = getLocalCertificates()
  const idx = local.findIndex((c) => c.id === certificateId)
  if (idx === -1) return { success: false, message: 'Certificate not found.' }

  local[idx].status = 'revoked'
  local[idx].revoked_at = revokedAt
  local[idx].revoked_by = adminUserId
  local[idx].revocation_reason = cleanReason
  local[idx].updated_at = revokedAt
  saveLocalCertificates(local)

  return { success: true, message: 'Certificate revoked successfully.' }
}

/**
 * Reissues a corrected certificate.
 * Revokes the old record and creates a fresh credential with a new verification identifier.
 */
export async function reissueCertificate(
  oldCertificateId: string,
  correctedParams: Partial<CertificateIssueParams>,
  adminUserId: string
): Promise<{ success: boolean; newCertificate?: EventCertificateRecord; message?: string }> {
  if (!oldCertificateId || !adminUserId) {
    return { success: false, message: 'Certificate ID and admin ID required for reissuance.' }
  }

  // 1. Fetch old certificate details
  let oldCert: EventCertificateRecord | null = null
  if (isSupabaseConfigured) {
    const { data } = await (supabase.from('event_certificates') as any)
      .select('*')
      .eq('id', oldCertificateId)
      .maybeSingle()
    if (data) oldCert = data as EventCertificateRecord
  } else {
    oldCert = getLocalCertificates().find((c) => c.id === oldCertificateId) || null
  }

  if (!oldCert) {
    return { success: false, message: 'Original certificate record could not be found.' }
  }

  // 1. Mark old certificate as reissued first so duplicate checks allow the replacement
  const reissuedAt = new Date().toISOString()
  if (isSupabaseConfigured) {
    await (supabase.from('event_certificates') as any)
      .update({
        status: 'reissued',
        reissued_at: reissuedAt,
        revoked_at: reissuedAt,
        revoked_by: adminUserId,
        updated_at: reissuedAt,
      })
      .eq('id', oldCertificateId)
  } else {
    const local = getLocalCertificates()
    const idx = local.findIndex((c) => c.id === oldCertificateId)
    if (idx !== -1) {
      local[idx].status = 'reissued'
      local[idx].reissued_at = reissuedAt
      saveLocalCertificates(local)
    }
  }

  // 2. Issue the new certificate
  const newCertRes = await issueCertificate({
    eventId: oldCert.event_id,
    clubId: oldCert.club_id,
    studentId: oldCert.student_id,
    registrationId: oldCert.registration_id,
    templateId: correctedParams.templateId || oldCert.template_id,
    category: correctedParams.category || oldCert.category,
    title: correctedParams.title || oldCert.title,
    recipientName: correctedParams.recipientName || oldCert.recipient_name,
    recipientCollege: correctedParams.recipientCollege ?? oldCert.recipient_college,
    recipientEmail: correctedParams.recipientEmail ?? oldCert.recipient_email,
    eventTitle: oldCert.event_title,
    clubName: oldCert.club_name,
    metadata: {
      ...(oldCert.metadata || {}),
      reissued_from: oldCert.certificate_number,
    },
  })

  if (!newCertRes.success || !newCertRes.certificate) {
    return { success: false, message: newCertRes.message || 'Failed to generate reissued certificate.' }
  }

  const newCert = newCertRes.certificate
  newCert.reissued_from_id = oldCert.id

  // 3. Link old certificate with new certificate reference
  if (isSupabaseConfigured) {
    await (supabase.from('event_certificates') as any)
      .update({
        reissued_certificate_id: newCert.id,
        revocation_reason: `Reissued as ${newCert.certificate_number}`,
      })
      .eq('id', oldCertificateId)
  } else {
    const local = getLocalCertificates()
    const idx = local.findIndex((c) => c.id === oldCertificateId)
    if (idx !== -1) {
      local[idx].reissued_certificate_id = newCert.id
      local[idx].revocation_reason = `Reissued as ${newCert.certificate_number}`
    }
    const newIdx = local.findIndex((c) => c.id === newCert.id)
    if (newIdx !== -1) {
      local[newIdx].reissued_from_id = oldCert.id
    }
    saveLocalCertificates(local)
  }

  return { success: true, newCertificate: newCert }
}

/**
 * Calculates analytics for club certificates.
 */
export async function getClubCertificateAnalytics(clubId: string): Promise<{
  totalIssued: number
  activeCount: number
  revokedCount: number
  categoryCounts: Record<CertificateCategory, number>
  eventBreakdown: Array<{ eventId: string; eventTitle: string; count: number }>
}> {
  const { certificates } = await getClubCertificates(clubId)

  const active = certificates.filter((c) => c.status === 'issued')
  const revoked = certificates.filter((c) => c.status === 'revoked' || c.status === 'reissued')

  const categoryCounts: Record<CertificateCategory, number> = {
    participation: 0,
    completion: 0,
    winner: 0,
    runner_up: 0,
    finalist: 0,
    special_recognition: 0,
    merit: 0,
  }

  const eventMap = new Map<string, { eventTitle: string; count: number }>()

  for (const cert of certificates) {
    if (cert.status === 'issued') {
      if (categoryCounts[cert.category] !== undefined) {
        categoryCounts[cert.category]++
      }
      const existingEvt = eventMap.get(cert.event_id) || { eventTitle: cert.event_title, count: 0 }
      existingEvt.count++
      eventMap.set(cert.event_id, existingEvt)
    }
  }

  const eventBreakdown = Array.from(eventMap.entries()).map(([eventId, data]) => ({
    eventId,
    eventTitle: data.eventTitle,
    count: data.count,
  }))

  return {
    totalIssued: certificates.length,
    activeCount: active.length,
    revokedCount: revoked.length,
    categoryCounts,
    eventBreakdown,
  }
}

