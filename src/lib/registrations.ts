import { supabase, supabasePublic, isSupabaseConfigured, isProduction } from '@/lib/supabase'
import type {
  RegistrationRecord,
  RegistrationWithEvent,
  RegistrationWithStudent,
  RegistrationResponse,
  RegistrationStatus,
  TeamMember,
} from '@/types'
import { getEventById } from '@/lib/events'
import {
  sendRegistrationConfirmedEmail,
  sendApplicationSubmittedEmail,
  sendPaymentRejectedEmail,
  sendRegistrationCancelledEmail,
  sendTeamMemberAddedEmail,
  resendPassEmail,
} from '@/lib/emails'
import { createTeam, getLocalTeamMembers, saveLocalTeamMembers, getLocalTeams } from '@/lib/teams'
import { broadcastStatusChange } from '@/lib/sync'

export { resendPassEmail }

const LOCAL_STORAGE_REGISTRATIONS_KEY = 'festflow_local_registrations'

// Local Storage fallback for offline / development
export function getInitialLocalRegistrations(): RegistrationRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_REGISTRATIONS_KEY)
    if (raw) return JSON.parse(raw) as RegistrationRecord[]
  } catch {
    // ignore
  }
  return []
}

export function saveLocalRegistrations(regs: RegistrationRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_REGISTRATIONS_KEY, JSON.stringify(regs))
  } catch {
    // ignore
  }
}

// ── Register for Event (RPC / Atomic) ────────────────────────────────────────
export async function registerForEvent(
  eventId: string,
  studentId: string,
  options?: {
    teamName?: string
    teamMembers?: TeamMember[]
    customResponses?: Record<string, any>
    participantDetails?: Record<string, any>
  }
): Promise<RegistrationResponse> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('register_for_event', {
        p_event_id: eventId,
        p_team_name: options?.teamName || null,
        p_team_members: options?.teamMembers || [],
        p_custom_responses: options?.customResponses || {},
        p_participant_details: options?.participantDetails || {},
      })

      if (error) {
        return {
          success: false,
          error_code: 'RPC_ERROR',
          message: error.message,
        }
      }

      const res = data as RegistrationResponse
      if (res.success && options?.teamName && res.registration_id) {
        try {
          const teamRes = await createTeam({
            eventId,
            leaderId: studentId,
            leaderName: options.participantDetails?.student_name || 'Team Leader',
            leaderEmail: options.participantDetails?.email || '',
            teamName: options.teamName,
            registrationId: res.registration_id,
            initialMembers: options.teamMembers,
          })
          if (teamRes.success && teamRes.team) {
            res.team_id = teamRes.team.id
            res.invite_code = teamRes.inviteCode
          }
        } catch {
          // ignore
        }
      }

      // Dispatch lifecycle transactional emails on successful registration
      if (res.success && res.registration_id) {
        try {
          let studentEmail = options?.participantDetails?.email || ''
          let studentName = options?.participantDetails?.student_name || ''
          if (!studentEmail) {
            const { data: authData } = await supabase.auth.getUser()
            studentEmail = authData?.user?.email || ''
            studentName = studentName || authData?.user?.user_metadata?.display_name || 'FestFlow Attendee'
          }

          if (studentEmail) {
            const eventRes = await getEventById(eventId)
            const event = eventRes?.event

            if (res.status === 'confirmed') {
              sendRegistrationConfirmedEmail({
                to: studentEmail,
                name: studentName || 'FestFlow Attendee',
                eventTitle: event?.title || 'Campus Event',
                ticketCode: res.ticket_code || '',
                qrToken: res.qr_token,
                startDate: event?.start_date || '',
                venueName: event?.venue_name || '',
                teamName: options?.teamName,
                registrationId: res.registration_id,
                eventId,
                userId: studentId,
              }).catch(() => {})
            } else if (res.status === 'pending_approval') {
              sendApplicationSubmittedEmail({
                to: studentEmail,
                name: studentName || 'FestFlow Student',
                eventTitle: event?.title || 'Campus Event',
                ticketCode: res.ticket_code || '',
                startDate: event?.start_date || '',
                venueName: event?.venue_name || '',
                registrationId: res.registration_id,
                eventId,
                userId: studentId,
              }).catch(() => {})
            }
          }
        } catch {
          // non-blocking
        }
      }

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

    if (event.registration_opens_at && new Date(event.registration_opens_at) > now) {
      return {
        success: false,
        error_code: 'REGISTRATION_NOT_OPEN',
        message: 'Registration for this event has not opened yet.',
      }
    }

    if (event.registration_closes_at && new Date(event.registration_closes_at) < now) {
      return {
        success: false,
        error_code: 'REGISTRATION_DEADLINE_PASSED',
        message: 'The registration deadline has passed for this event.',
      }
    }

    // Team requirements and size limits validation
    if (event.participation_type === 'team') {
      if (event.require_team_name && (!options?.teamName || !options.teamName.trim())) {
        return {
          success: false,
          error_code: 'TEAM_NAME_REQUIRED',
          message: 'A team name is required to register for this event.',
        }
      }

      const membersCount = options?.teamMembers?.length || 0
      const totalTeamSize = membersCount + (event.leader_counts_towards_size ? 1 : 0)

      if (totalTeamSize < event.min_team_size) {
        const isInviteMode = event.team_registration_mode === 'members_join_with_code'
        if (!(isInviteMode && totalTeamSize >= 1)) {
          return {
            success: false,
            error_code: 'TEAM_TOO_SMALL',
            message: `This event requires a minimum of ${event.min_team_size} team members (currently ${totalTeamSize}).`,
          }
        }
      }

      if (totalTeamSize > event.max_team_size) {
        return {
          success: false,
          error_code: 'TEAM_TOO_LARGE',
          message: `This event allows a maximum of ${event.max_team_size} team members (currently ${totalTeamSize}).`,
        }
      }

      // Check duplicate member emails
      if (options?.teamMembers && options.teamMembers.length > 0) {
        const emails = options.teamMembers.map((m) => m.email.trim().toLowerCase())
        const uniqueEmails = new Set(emails)
        if (uniqueEmails.size !== emails.length) {
          return {
            success: false,
            error_code: 'DUPLICATE_TEAM_MEMBER',
            message: 'Duplicate email addresses found within the team member list.',
          }
        }
      }
    }

    // Participant fields requirements validation
    if (event.participant_fields && options?.participantDetails) {
      const pFields = event.participant_fields
      const pDetails = options.participantDetails
      if (pFields.require_college && (!pDetails.college_name || !pDetails.college_name.trim())) {
        return {
          success: false,
          error_code: 'FIELD_REQUIRED',
          message: 'College name is required for registration by the event organizer.',
        }
      }
      if (pFields.require_phone && (!pDetails.phone || !pDetails.phone.trim())) {
        return {
          success: false,
          error_code: 'FIELD_REQUIRED',
          message: 'Contact phone number is required for registration by the event organizer.',
        }
      }
      if (pFields.require_grad_year && (!pDetails.grad_year || !String(pDetails.grad_year).trim())) {
        return {
          success: false,
          error_code: 'FIELD_REQUIRED',
          message: 'Graduation / passing year is required for registration by the event organizer.',
        }
      }
      if (pFields.require_id_card && (!pDetails.id_card_number || !pDetails.id_card_number.trim())) {
        return {
          success: false,
          error_code: 'FIELD_REQUIRED',
          message: 'Student ID card number is required for registration by the event organizer.',
        }
      }
    }

    // Custom organizer questions validation
    if (event.custom_questions && Array.isArray(event.custom_questions)) {
      const answers = options?.customResponses || {}
      for (const q of event.custom_questions) {
        if (q.required) {
          const val = answers[q.id]
          if (q.type === 'checkbox') {
            if (!val) {
              return {
                success: false,
                error_code: 'QUESTION_REQUIRED',
                message: `Required agreement missing: ${q.label}`,
              }
            }
          } else {
            if (!val || !String(val).trim()) {
              return {
                success: false,
                error_code: 'QUESTION_REQUIRED',
                message: `Please answer the required question: ${q.label}`,
              }
            }
          }
        }
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
      (r) => r.event_id === eventId && (r.status === 'confirmed' || r.status === 'pending_payment' || r.status === 'pending_approval')
    ).length

    if (activeCount >= event.capacity) {
      return {
        success: false,
        error_code: 'CAPACITY_REACHED',
        message: 'This event has reached full capacity. No seats remaining.',
      }
    }

    const ticketCode = 'FF-' + Math.random().toString(36).substring(2, 10).toUpperCase()
    const qrToken = 'FFQ_' + Math.random().toString(36).substring(2, 10).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase()
    const isFree = event.is_free
    const isManualApproval = event.approval_type === 'manual'

    let initialStatus: RegistrationStatus
    let approvalStatus: 'pending' | 'approved' | 'rejected'
    let issuedAt: string | null = null
    let successMessage = ''

    if (isManualApproval) {
      initialStatus = 'pending_approval'
      approvalStatus = 'pending'
      issuedAt = null
      successMessage = 'Application submitted! The organizer will review your registration before issuing entry tickets.'
    } else if (isFree) {
      initialStatus = 'confirmed'
      approvalStatus = 'approved'
      issuedAt = now.toISOString()
      successMessage = 'Registration confirmed! Your digital entry ticket has been issued.'
    } else {
      initialStatus = 'pending_payment'
      approvalStatus = 'approved'
      issuedAt = null
      successMessage = 'Application accepted! Please submit payment to confirm your pass.'
    }

    const newReg: RegistrationRecord = {
      id: 'reg_' + Date.now(),
      event_id: eventId,
      student_id: studentId,
      ticket_code: ticketCode,
      qr_token: qrToken,
      status: initialStatus,
      created_at: now.toISOString(),
      ticket_issued_at: issuedAt,
      cancelled_at: null,
      updated_at: now.toISOString(),
      team_name: options?.teamName || null,
      team_role: 'leader',
      team_id: null,
      team_members: (options?.teamMembers as any) || [],
      custom_responses: options?.customResponses || {},
      participant_details: options?.participantDetails || {},
      approval_status: approvalStatus,
      rejection_reason: null,
    }

    currentRegs.unshift(newReg)
    saveLocalRegistrations(currentRegs)

    let createdTeamId: string | undefined
    let createdInviteCode: string | undefined
    if (options?.teamName) {
      const teamRes = await createTeam({
        eventId: event.id,
        leaderId: studentId,
        leaderName: options.participantDetails?.student_name || 'Team Leader',
        leaderEmail: options.participantDetails?.email || 'leader@campus.edu',
        teamName: options.teamName,
        registrationId: newReg.id,
        initialMembers: options.teamMembers,
      })
      if (teamRes.success && teamRes.team) {
        newReg.team_id = teamRes.team.id
        createdTeamId = teamRes.team.id
        createdInviteCode = teamRes.inviteCode
        saveLocalRegistrations(currentRegs)
      }
    }

    // Trigger transactional email at correct lifecycle stage with dynamic recipient
    const recipientEmail = options?.participantDetails?.email || 'student@campus.edu'
    const recipientName = options?.participantDetails?.student_name || 'FestFlow Student'

    if (initialStatus === 'confirmed') {
      sendRegistrationConfirmedEmail({
        to: recipientEmail,
        name: recipientName,
        eventTitle: event.title,
        ticketCode: ticketCode,
        qrToken: qrToken,
        startDate: event.start_date,
        venueName: event.venue_name,
        teamName: options?.teamName,
        registrationId: newReg.id,
        eventId: event.id,
      }).catch(() => {})
    } else if (initialStatus === 'pending_approval') {
      sendApplicationSubmittedEmail({
        to: recipientEmail,
        name: recipientName,
        eventTitle: event.title,
        ticketCode: ticketCode,
        startDate: event.start_date,
        venueName: event.venue_name,
        registrationId: newReg.id,
        eventId: event.id,
      }).catch(() => {})
    }

    // Notify registered squad members when leader directly registers them
    if (options?.teamMembers && Array.isArray(options.teamMembers) && options.teamName) {
      for (const tm of options.teamMembers) {
        if (tm.email && tm.email.includes('@')) {
          sendTeamMemberAddedEmail({
            to: tm.email,
            name: tm.name,
            teamName: options.teamName,
            eventTitle: event.title,
            leaderName: options.participantDetails?.student_name || 'Team Leader',
            startDate: event.start_date,
            venueName: event.venue_name,
            eventId: event.id,
            teamId: createdTeamId,
            isPaid: !isFree,
          }).catch(() => {})
        }
      }
    }

    broadcastStatusChange({
      type: 'registration_updated',
      eventId: event.id,
      registrationId: newReg.id,
      studentId,
      teamId: createdTeamId,
    })

    return {
      success: true,
      registration_id: newReg.id,
      ticket_code: ticketCode,
      qr_token: qrToken,
      status: newReg.status,
      approval_status: approvalStatus,
      is_free: isFree,
      ticket_issued: Boolean(newReg.ticket_issued_at),
      team_id: createdTeamId,
      invite_code: createdInviteCode,
      message: successMessage,
    }
  }
}

// ── Review Registration Application (Host Approval / Rejection) ─────────────
export async function reviewRegistrationApplication(
  registrationId: string,
  decision: 'approved' | 'rejected',
  rejectionReason?: string
): Promise<{ success: boolean; status?: RegistrationStatus; message: string }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('review_registration_application', {
        p_registration_id: registrationId,
        p_decision: decision,
        p_rejection_reason: rejectionReason || null,
      })

      if (error) {
        return { success: false, message: error.message }
      }

      return data as { success: boolean; status?: RegistrationStatus; message: string }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Application review failed.',
      }
    }
  } else {
    await new Promise((r) => setTimeout(r, 400))
    const current = getInitialLocalRegistrations()
    const idx = current.findIndex((r) => r.id === registrationId)
    if (idx === -1) {
      return { success: false, message: 'Registration not found.' }
    }

    const reg = current[idx]
    if (reg.status === 'cancelled') {
      return { success: false, message: 'Cannot review a cancelled registration.' }
    }

    const eventRes = await getEventById(reg.event_id)
    const event = eventRes.event
    const isFree = event?.is_free ?? true

    if (decision === 'approved') {
      reg.approval_status = 'approved'
      if (isFree) {
        reg.status = 'confirmed'
        reg.ticket_issued_at = new Date().toISOString()
      } else {
        reg.status = 'pending_payment'
        reg.ticket_issued_at = null
      }
      reg.rejection_reason = null
    } else {
      reg.approval_status = 'rejected'
      reg.status = 'rejected'
      reg.ticket_issued_at = null
      reg.rejection_reason = rejectionReason || 'Application declined by organizer.'
    }

    reg.updated_at = new Date().toISOString()
    current[idx] = reg
    saveLocalRegistrations(current)

    // Trigger lifecycle emails
    if (decision === 'approved' && isFree && eventRes.event) {
      sendRegistrationConfirmedEmail({
        to: 'student@campus.edu',
        name: 'FestFlow Student',
        eventTitle: eventRes.event.title,
        ticketCode: reg.ticket_code,
        qrToken: reg.qr_token,
        startDate: eventRes.event.start_date,
        venueName: eventRes.event.venue_name,
        teamName: reg.team_name,
        registrationId: reg.id,
        eventId: reg.event_id,
      }).catch(() => {})
    } else if (decision === 'rejected' && eventRes.event) {
      sendPaymentRejectedEmail({
        to: 'student@campus.edu',
        name: 'FestFlow Student',
        eventTitle: eventRes.event.title,
        reason: rejectionReason || 'Application declined by organizer.',
        registrationId: reg.id,
        eventId: reg.event_id,
      }).catch(() => {})
    }

    return {
      success: true,
      status: reg.status,
      message: decision === 'approved'
        ? (isFree ? 'Application approved! Digital pass issued.' : 'Application approved! Awaiting student payment.')
        : 'Application rejected.',
    }
  }
}

// ── Cancel Registration ──────────────────────────────────────────────────────
export async function cancelRegistration(
  registrationId: string,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  if (isSupabaseConfigured) {
    try {
      // First try enhanced RPC cancel_registration_with_policy
      let res: any = null
      const { data, error } = await (supabase.rpc as any)('cancel_registration_with_policy', {
        p_registration_id: registrationId,
        p_reason: reason || null,
      })

      if (error) {
        // Fallback to legacy cancel_registration RPC if needed
        const fallback = await (supabase.rpc as any)('cancel_registration', {
          p_registration_id: registrationId,
        })
        if (fallback.error) {
          return { success: false, message: fallback.error.message || error.message }
        }
        res = fallback.data
      } else {
        res = data
      }

      if (res && res.success) {
        broadcastStatusChange({
          type: 'registration_updated',
          registrationId,
        })
      }
      return res as { success: boolean; message: string }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Cancellation failed.',
      }
    }
  } else {
    await new Promise((r) => setTimeout(r, 100))
    const current = getInitialLocalRegistrations()
    const idx = current.findIndex((r) => r.id === registrationId)
    if (idx === -1) {
      return { success: false, message: 'Registration not found.' }
    }

    const reg = current[idx]
    if (reg.status === 'cancelled') {
      return { success: false, message: 'Registration is already cancelled.' }
    }

    // 1. Gate Check: Cannot cancel if ticket has already been used for check-in
    try {
      const rawCheckins = localStorage.getItem('festflow_local_checkins')
      if (rawCheckins) {
        const checkins = JSON.parse(rawCheckins)
        const hasCheckin = checkins.some((c: any) => c.registration_id === registrationId)
        if (hasCheckin) {
          return {
            success: false,
            message: 'Cannot cancel a pass that has already been verified at the entry gate.',
          }
        }
      }
    } catch {
      // ignore
    }

    // 2. Policy Check: Cannot cancel if event already started
    const eventRes = await getEventById(reg.event_id)
    const event = eventRes.event
    if (event) {
      if (new Date(event.start_date) <= new Date()) {
        return { success: false, message: 'Pass cannot be cancelled because the event has already started.' }
      }

      // 3. Cutoff Check: Cannot cancel if cutoff deadline passed
      const cutoffHours = (event as any).cancellation_cutoff_hours
      if (cutoffHours && cutoffHours > 0) {
        const cutoffMs = cutoffHours * 3600000
        const eventStartMs = new Date(event.start_date).getTime()
        if (Date.now() >= eventStartMs - cutoffMs) {
          return {
            success: false,
            message: `Cancellation deadline has passed. Registrations cannot be cancelled within ${cutoffHours} hours of event start.`,
          }
        }
      }
    }

    current[idx] = {
      ...current[idx],
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    saveLocalRegistrations(current)

    broadcastStatusChange({
      type: 'registration_updated',
      registrationId: reg.id,
      eventId: reg.event_id,
    })

    if (eventRes.event) {
      const recipientEmail =
        reg.participant_details?.email ||
        (reg as any).student?.email ||
        'student@campus.edu'
      const recipientName =
        reg.participant_details?.student_name ||
        (reg as any).student?.display_name ||
        'Attendee'

      sendRegistrationCancelledEmail({
        to: recipientEmail,
        name: recipientName,
        eventTitle: eventRes.event.title,
        ticketCode: reg.ticket_code,
        registrationId: reg.id,
        eventId: reg.event_id,
      }).catch(() => {})
    }

    return { success: true, message: 'Registration cancelled successfully. Your seat has been released.' }
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
        .select('*, check_ins(*)')
        .eq('event_id', eventId)
        .eq('student_id', studentId)
        .neq('status', 'cancelled')
        .maybeSingle()

      if (error || !data) return { registered: false, registration: null }
      const reg = { ...(data as Record<string, any>) } as any
      if (Array.isArray(reg.check_ins) && reg.check_ins.length > 0) {
        const lastCheckIn = reg.check_ins[reg.check_ins.length - 1]
        reg.attendance_status = lastCheckIn.status === 'checked_out' ? 'checked_out' : 'checked_in'
      } else {
        reg.attendance_status = 'not_checked_in'
      }
      return { registered: true, registration: reg as unknown as RegistrationRecord }
    } catch {
      return { registered: false, registration: null }
    }
  } else {
    const current = getInitialLocalRegistrations()
    const found = current.find(
      (r) => r.event_id === eventId && r.student_id === studentId && r.status !== 'cancelled'
    )
    if (!found) return { registered: false, registration: null }
    const copy = { ...found } as any
    try {
      const rawCheckins = localStorage.getItem('festflow_local_checkins')
      if (rawCheckins) {
        const checkins = JSON.parse(rawCheckins)
        const match = checkins.find((c: any) => c.registration_id === found.id)
        if (match) {
          copy.attendance_status = match.status === 'checked_out' ? 'checked_out' : 'checked_in'
        } else {
          copy.attendance_status = 'not_checked_in'
        }
      } else {
        copy.attendance_status = 'not_checked_in'
      }
    } catch {
      copy.attendance_status = 'not_checked_in'
    }
    return { registered: true, registration: copy }
  }
}

// ── Get Single Registration by ID (with Event & Student Profile) ────────────
export async function getRegistrationById(
  id: string
): Promise<{ registration: RegistrationWithEvent | null; error: string | null }> {
  if (isSupabaseConfigured) {
    try {
      const cleanId = id.trim()
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId)

      const selectClause = `
        *,
        check_ins (*),
        event:event_id (
          *,
          club:club_id (
            display_name,
            club_profiles (*)
          )
        )
      `

      const queryRes: any = isUuid
        ? await supabase.from('registrations').select(selectClause).eq('id', cleanId).maybeSingle()
        : await supabase.from('registrations').select(selectClause).eq('ticket_code', cleanId.toUpperCase()).maybeSingle()

      let data: any = queryRes.data
      let error: any = queryRes.error

      if (!data && !isUuid) {
        const idFallback: any = await supabase
          .from('registrations')
          .select(selectClause)
          .eq('id', cleanId)
          .maybeSingle()
        if (idFallback.data) {
          data = idFallback.data
        }
      }

      // If relational join encountered infinite recursion, recover via decoupled fetch
      if (error && error.message.includes('infinite recursion')) {
        console.warn('[FestFlow] RLS recursion detected in getRegistrationById, performing decoupled fetch')
        const regRes: any = isUuid
          ? await supabase.from('registrations').select('*, check_ins(*)').eq('id', cleanId).maybeSingle()
          : await supabase.from('registrations').select('*, check_ins(*)').eq('ticket_code', cleanId.toUpperCase()).maybeSingle()

        if (!regRes.error && regRes.data) {
          const rawItem = regRes.data as Record<string, any>
          const eventRes = await getEventById(rawItem.event_id)
          data = {
            ...rawItem,
            event: eventRes.event || null,
          }
          error = null
        }
      }

      if (error && !data) return { registration: null, error: error.message }
      if (!data) return { registration: null, error: 'Registration not found' }

      if (data) {
        const regObj = data as any
        if (Array.isArray(regObj.check_ins) && regObj.check_ins.length > 0) {
          const lastCheckIn = regObj.check_ins[regObj.check_ins.length - 1]
          regObj.attendance_status = lastCheckIn.status === 'checked_out' ? 'checked_out' : 'checked_in'
        } else if (!regObj.attendance_status) {
          regObj.attendance_status = 'not_checked_in'
        }
      }

      return { registration: data as unknown as RegistrationWithEvent, error: null }
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

    let attendance_status: 'not_checked_in' | 'checked_in' | 'checked_out' = 'not_checked_in'
    try {
      const rawCheckins = localStorage.getItem('festflow_local_checkins')
      if (rawCheckins) {
        const checkins = JSON.parse(rawCheckins)
        const match = checkins.find((c: any) => c.registration_id === found.id)
        if (match) {
          attendance_status = match.status === 'checked_out' ? 'checked_out' : 'checked_in'
        }
      }
    } catch {
      // ignore
    }

    const withEvent: RegistrationWithEvent = {
      ...found,
      attendance_status,
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
      let data: any = null
      let queryError: string | null = null

      // Primary query using explicit foreign key relationship
      const resExplicit = await supabase
        .from('registrations')
        .select(
          `
          *,
          event:events!registrations_event_id_fkey (
            *,
            club:profiles!events_club_id_fkey (
              display_name,
              club_profiles (*)
            )
          )
        `
        )
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })

      if (!resExplicit.error) {
        data = resExplicit.data
      } else {
        // Fallback query without explicit constraint alias
        const resFallback = await supabase
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

        if (!resFallback.error) {
          data = resFallback.data
        } else if (
          resExplicit.error.message.includes('infinite recursion') ||
          resFallback.error?.message.includes('infinite recursion')
        ) {
          // Fallback: 2-step query to decouple registrations and events
          console.warn('[FestFlow] RLS recursion detected in registrations query, performing 2-step fetch')
          const { data: rawRegs, error: regErr } = await supabase
            .from('registrations')
            .select('*')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false })

          if (!regErr && rawRegs) {
            const eventIds = Array.from(new Set(rawRegs.map((r: any) => r.event_id).filter(Boolean)))
            let eventsMap: Record<string, any> = {}
            if (eventIds.length > 0) {
              const { data: eventsData } = await supabasePublic
                .from('events')
                .select(
                  `
                  *,
                  club:club_id (
                    display_name,
                    avatar_url,
                    club_profiles (*)
                  )
                `
                )
                .in('id', eventIds)

              if (eventsData) {
                eventsMap = Object.fromEntries(eventsData.map((e: any) => [e.id, e]))
              }
            }

            data = rawRegs.map((r: any) => ({
              ...r,
              event: eventsMap[r.event_id] || null,
            }))
            queryError = null
          } else {
            queryError = regErr?.message || 'Failed to load tickets'
          }
        } else {
          queryError = resExplicit.error.message || resFallback.error?.message || 'Failed to load tickets'
        }
      }

      if (queryError) return { registrations: [], error: queryError }

      // Map registrations and preserve genuine records even when related event is unavailable/archived
      const normalized: RegistrationWithEvent[] = ((data || []) as any[]).map((r) => ({
        ...r,
        event: r.event || null,
      }))

      return {
        registrations: normalized,
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
    const userRegs = current.filter((r) => r.student_id === studentId)

    // Check if user is an accepted member of any team whose registration needs syncing
    const members = getLocalTeamMembers()
    const acceptedSlots = members.filter((m) => m.user_id === studentId && m.status === 'accepted')
    const existingEventIds = new Set(userRegs.map((r) => r.event_id))

    let updatedStorage = false
    for (const slot of acceptedSlots) {
      if (!existingEventIds.has(slot.event_id)) {
        // Find team and leader registration to determine status
        const teams = getLocalTeams()
        const team = teams.find((t) => t.id === slot.team_id)
        const leaderReg = current.find(
          (r) => r.id === team?.registration_id || (r.event_id === slot.event_id && r.student_id === team?.leader_id)
        )
        const eventRes = await getEventById(slot.event_id)
        const event = eventRes.event

        const isFree = Boolean(event?.is_free)
        const isLeaderConfirmed = leaderReg?.status === 'confirmed' && Boolean(leaderReg.ticket_issued_at)
        const isConfirmed = isFree || isLeaderConfirmed

        const memberIndex = members.filter((m) => m.team_id === slot.team_id && m.status === 'accepted').length
        const ticketCode = leaderReg?.ticket_code
          ? `${leaderReg.ticket_code}-M${memberIndex}`
          : `FF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
        const qrToken = `FFQ_${Math.random().toString(36).substring(2, 12).toUpperCase()}`

        const newMemberReg: RegistrationRecord = {
          id: `reg_tm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          event_id: slot.event_id,
          student_id: studentId,
          status: isConfirmed ? 'confirmed' : 'pending_payment',
          ticket_code: ticketCode,
          qr_token: qrToken,
          ticket_issued_at: isConfirmed ? new Date().toISOString() : null,
          cancelled_at: null,
          team_name: team?.name || null,
          team_id: slot.team_id,
          team_role: 'member',
          team_members: leaderReg?.team_members || [],
          custom_responses: {},
          participant_details: { student_name: slot.name, email: slot.email },
          approval_status: isConfirmed ? 'approved' : 'pending',
          rejection_reason: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        current.push(newMemberReg)
        userRegs.push(newMemberReg)
        existingEventIds.add(slot.event_id)
        slot.registration_id = newMemberReg.id
        updatedStorage = true
      }
    }

    if (updatedStorage) {
      saveLocalRegistrations(current)
      saveLocalTeamMembers(members)
    }

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
      // First attempt query with explicit foreign key relation to profiles table
      let data: any = null
      let queryError: string | null = null

      const resExplicit = await supabase
        .from('registrations')
        .select(
          `
          *,
          student:profiles!registrations_student_id_fkey (
            display_name,
            email,
            avatar_url
          )
        `
        )
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

      if (!resExplicit.error) {
        data = resExplicit.data
      } else {
        // Fallback query joining by column name or direct relationship
        const resFallback = await supabase
          .from('registrations')
          .select(
            `
            *,
            student:profiles (
              display_name,
              email,
              avatar_url
            )
          `
          )
          .eq('event_id', eventId)
          .order('created_at', { ascending: false })

        if (!resFallback.error) {
          data = resFallback.data
        } else {
          // Second fallback to student_id relation if configured
          const resLegacy = await supabase
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

          if (!resLegacy.error) {
            data = resLegacy.data
          } else {
            queryError = resExplicit.error.message || resLegacy.error?.message || 'Failed to query registrations'
          }
        }
      }

      if (queryError) return { registrations: [], error: queryError }

      // Map registrations and ensure genuine attendee data is preserved.
      // If student profile relation is null (e.g. deleted user, missing profile row, or RLS block),
      // provide safe non-null fallback object so downstream consumers do not crash.
      const normalizedRegistrations: RegistrationWithStudent[] = (data || []).map((r: any) => {
        const fallbackName = r.team_name ? `Team ${r.team_name}` : 'Student Attendee'
        return {
          ...r,
          student: r.student
            ? {
                display_name: r.student.display_name || fallbackName,
                email: r.student.email || '',
                avatar_url: r.student.avatar_url || null,
              }
            : {
                display_name: fallbackName,
                email: '',
                avatar_url: null,
              },
        }
      })

      return {
        registrations: normalizedRegistrations,
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
        display_name: (r.participant_details as any)?.full_name || `Attendee #${i + 1}`,
        email: (r.participant_details as any)?.email || `attendee${i + 1}@campus.edu`,
        avatar_url: null,
      },
    }))

    return { registrations: list, error: null }
  }
}
