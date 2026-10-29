/**
 * src/lib/teams.ts
 *
 * Core Team Management, Registration, and Member Invitations for FestFlow (Phase 2):
 * - Secure Team creation during or after event registration
 * - Safe preview of teams by invite code without leaking private data
 * - Atomic concurrency-safe team joining (RPC with row-locking in DB + atomic simulation)
 * - Expiring single-use invitation tokens with email delivery
 * - Resend & Revocation with rate-limiting
 * - Real-time roster and status tracking for leaders and members
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type {
  TeamRecord,
  TeamMemberRecord,
  TeamInvitationRecord,
  TeamPreview,
  TeamInvitationPreview,
  TeamJoinResponse,
  TeamInviteResponse,
  TeamDetails,
  TeamMember,
} from '@/types'
import { getEventById } from '@/lib/events'
import {
  sendTeamInvitationEmail,
  sendTeamInvitationAcceptedEmail,
  sendTicketIssuedEmail,
} from '@/lib/emails'
import { broadcastStatusChange } from '@/lib/sync'
import { getFrontendBaseUrl } from '@/lib/canonicalUrl'

const LOCAL_STORAGE_TEAMS_KEY = 'festflow_local_teams'
const LOCAL_STORAGE_MEMBERS_KEY = 'festflow_local_team_members'
const LOCAL_STORAGE_INVITES_KEY = 'festflow_local_team_invitations'

// ── Local Storage Helpers (Offline / Development Simulation) ────────────────
export function getLocalTeams(): TeamRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_TEAMS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
}

export function saveLocalTeams(teams: TeamRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_TEAMS_KEY, JSON.stringify(teams))
  } catch {
    // ignore
  }
}

export function getLocalTeamMembers(): TeamMemberRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_MEMBERS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
}

export function saveLocalTeamMembers(members: TeamMemberRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_MEMBERS_KEY, JSON.stringify(members))
  } catch {
    // ignore
  }
}

export function getLocalTeamInvites(): TeamInvitationRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_INVITES_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
}

export function saveLocalTeamInvites(invites: TeamInvitationRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_INVITES_KEY, JSON.stringify(invites))
  } catch {
    // ignore
  }
}

// ── Generate Safe Invite Code ──────────────────────────────────────────────
export function generateInviteCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let res = ''
  for (let i = 0; i < 6; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `TF-${res}`
}

export function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

export function buildTeamInviteLink(eventSlug: string, inviteCode: string, token?: string): string {
  const origin = getFrontendBaseUrl()
  let url = `${origin}/events/${eventSlug}?join=1&code=${encodeURIComponent(inviteCode)}`
  if (token) {
    url += `&token=${encodeURIComponent(token)}`
  }
  return url
}

// ── Create Team ────────────────────────────────────────────────────────────
export async function createTeam(params: {
  eventId: string
  leaderId: string
  leaderName: string
  leaderEmail: string
  teamName: string
  registrationId?: string
  initialMembers?: TeamMember[]
}): Promise<{ success: boolean; message: string; team?: TeamRecord; inviteCode?: string }> {
  const cleanTeamName = params.teamName.trim()
  if (!cleanTeamName) {
    return { success: false, message: 'Please provide a team name.' }
  }

  const inviteCode = generateInviteCode()

  if (isSupabaseConfigured) {
    try {
      const { data: teamData, error: teamErr } = await (supabase.from('teams') as any)
        .insert({
          event_id: params.eventId,
          leader_id: params.leaderId,
          registration_id: params.registrationId || null,
          name: cleanTeamName,
          invite_code: inviteCode,
          status: 'forming',
        })
        .select('*')
        .single()

      if (teamErr) {
        if (teamErr.code === '23505') {
          return {
            success: false,
            message: 'A team with this name already exists for this event, or you already lead a team.',
          }
        }
        return { success: false, message: teamErr.message }
      }

      const team = teamData as TeamRecord

      // Insert leader into team_members
      await (supabase.from('team_members') as any).insert({
        team_id: team.id,
        event_id: params.eventId,
        user_id: params.leaderId,
        registration_id: params.registrationId || null,
        name: params.leaderName,
        email: params.leaderEmail.toLowerCase().trim(),
        role: 'leader',
        status: 'accepted',
        joined_at: new Date().toISOString(),
      })

      // Add initial pending members if provided
      if (params.initialMembers && params.initialMembers.length > 0) {
        for (const m of params.initialMembers) {
          if (m.email && m.email.includes('@')) {
            await inviteTeamMember({
              teamId: team.id,
              email: m.email,
              name: m.name,
              leaderId: params.leaderId,
            })
          }
        }
      }

      return { success: true, message: 'Team created successfully!', team, inviteCode }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to create team.' }
    }
  }

  // Simulation Mode
  const teams = getLocalTeams()
  const existingSameName = teams.find(
    (t) => t.event_id === params.eventId && t.name.toLowerCase() === cleanTeamName.toLowerCase()
  )
  if (existingSameName) {
    return { success: false, message: 'A team with this name already exists for this event.' }
  }

  const existingLeader = teams.find(
    (t) => t.event_id === params.eventId && t.leader_id === params.leaderId && t.status !== 'disbanded'
  )
  if (existingLeader) {
    return { success: false, message: 'You already lead a team for this event.' }
  }

  const newTeam: TeamRecord = {
    id: `team_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    event_id: params.eventId,
    leader_id: params.leaderId,
    registration_id: params.registrationId || null,
    name: cleanTeamName,
    invite_code: inviteCode,
    status: 'forming',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  teams.push(newTeam)
  saveLocalTeams(teams)

  // Seed leader in members
  const members = getLocalTeamMembers()
  const leaderMember: TeamMemberRecord = {
    id: `tm_${Date.now()}_lead`,
    team_id: newTeam.id,
    event_id: params.eventId,
    user_id: params.leaderId,
    registration_id: params.registrationId || null,
    invitation_id: null,
    name: params.leaderName,
    email: params.leaderEmail.toLowerCase().trim(),
    role: 'leader',
    status: 'accepted',
    college: null,
    student_id_card: null,
    phone: null,
    joined_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  members.push(leaderMember)
  saveLocalTeamMembers(members)

  // Process initial invited members in simulation
  if (params.initialMembers && params.initialMembers.length > 0) {
    for (const m of params.initialMembers) {
      if (m.email && m.email.includes('@')) {
        await inviteTeamMember({
          teamId: newTeam.id,
          email: m.email,
          name: m.name,
          leaderId: params.leaderId,
        })
      }
    }
  }

  return { success: true, message: 'Team created successfully!', team: newTeam, inviteCode }
}

// ── Get Public Safe Team Preview ───────────────────────────────────────────
export async function getTeamPreview(
  inviteCode: string
): Promise<{ success: boolean; preview?: TeamPreview; message?: string }> {
  const cleanCode = inviteCode.trim().toUpperCase()
  if (!cleanCode) {
    return { success: false, message: 'Please enter a valid team invitation code.' }
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('get_team_preview_by_code', {
        p_invite_code: cleanCode,
      })
      if (error) {
        return { success: false, message: error.message }
      }
      if (!data?.success) {
        return { success: false, message: data?.message || 'Invalid or expired invitation code.' }
      }
      return { success: true, preview: data as TeamPreview }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Could not verify team code.' }
    }
  }

  // Simulation Mode
  const teams = getLocalTeams()
  const team = teams.find((t) => t.invite_code.toUpperCase() === cleanCode && t.status !== 'disbanded')
  if (!team) {
    return { success: false, message: 'Team invitation code is invalid or has expired.' }
  }

  const eventRes = await getEventById(team.event_id)
  const event = eventRes.event
  if (!event) {
    return { success: false, message: 'Event for this team could not be found.' }
  }

  const now = new Date()
  const isOpen =
    event.status === 'published' &&
    (!event.registration_opens_at || new Date(event.registration_opens_at) <= now) &&
    (!event.registration_closes_at || new Date(event.registration_closes_at) > now) &&
    new Date(event.start_date) > now

  const members = getLocalTeamMembers().filter((m) => m.team_id === team.id && m.status === 'accepted')
  const maxSize = event.max_team_size || 5
  const minSize = event.min_team_size || 2

  // Leader display name from mock auth or members
  const leaderMem = members.find((m) => m.role === 'leader')
  const leaderName = leaderMem?.name || 'Team Leader'

  const preview: TeamPreview = {
    team_id: team.id,
    team_name: team.name,
    event_id: event.id,
    event_title: event.title,
    event_slug: event.slug,
    event_category: event.category,
    event_poster: event.poster_url,
    start_date: event.start_date,
    venue_name: event.venue_name,
    is_free: event.is_free,
    price: event.price,
    leader_name: leaderName,
    current_size: members.length,
    min_size: minSize,
    max_size: maxSize,
    is_full: members.length >= maxSize,
    is_open: isOpen,
    require_team_name: Boolean(event.require_team_name),
  }

  return { success: true, preview }
}

// ── Get Team Invitation Preview (Token-based) ──────────────────────────────
export async function getTeamInvitationPreview(
  token: string
): Promise<{ success: boolean; preview?: TeamInvitationPreview; message?: string; error_code?: string }> {
  const cleanToken = (token || '').trim()
  if (!cleanToken || cleanToken.length < 8) {
    return { success: false, message: 'Invalid or missing invitation token.', error_code: 'INVALID_TOKEN' }
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('get_team_invitation_preview', {
        p_token: cleanToken,
      })
      if (error) {
        return { success: false, message: error.message, error_code: 'RPC_ERROR' }
      }
      if (!data?.success) {
        return {
          success: false,
          message: data?.message || 'Invitation not found or expired.',
          error_code: data?.error_code || 'INVITATION_NOT_FOUND',
        }
      }
      return { success: true, preview: data.invitation }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to inspect invitation.', error_code: 'NETWORK_ERROR' }
    }
  }

  // Simulation mode
  const invites = getLocalTeamInvites()
  const inv = invites.find((i) => i.token === cleanToken)
  if (!inv) {
    return { success: false, message: 'Invitation not found or link has expired.', error_code: 'INVITATION_NOT_FOUND' }
  }

  if (inv.status === 'revoked') {
    return { success: false, message: 'This squad invitation has been revoked by the team leader.', error_code: 'INVITATION_REVOKED' }
  }

  if (inv.status === 'accepted') {
    return { success: false, message: 'This squad invitation has already been accepted and claimed.', error_code: 'ALREADY_ACCEPTED' }
  }

  if (new Date(inv.expires_at) < new Date()) {
    return { success: false, message: 'This squad invitation has expired.', error_code: 'INVITATION_EXPIRED' }
  }

  const teams = getLocalTeams()
  const team = teams.find((t) => t.id === inv.team_id)
  if (!team || team.status === 'disbanded') {
    return { success: false, message: 'This squad is no longer active.', error_code: 'TEAM_NOT_FOUND' }
  }

  const eventRes = await getEventById(inv.event_id)
  const event = eventRes.event
  if (!event) {
    return { success: false, message: 'Event associated with this invitation was not found.', error_code: 'EVENT_NOT_FOUND' }
  }

  const members = getLocalTeamMembers().filter((m) => m.team_id === team.id && m.status === 'accepted')
  const maxSize = event.max_team_size || 5

  // Mask email
  const emailParts = inv.email.split('@')
  const localPart = emailParts[0] || ''
  const domainPart = emailParts[1] || ''
  const maskedLocal = localPart.length > 2 ? localPart.substring(0, 2) + '***' : localPart.substring(0, 1) + '***'
  const maskedEmail = `${maskedLocal}@${domainPart}`

  // Check current session email if available
  let isMatched = false
  let safeEmail = ''
  try {
    const rawAuth = localStorage.getItem('festflow_mock_session') || localStorage.getItem('sb-current-user')
    if (rawAuth) {
      const parsed = JSON.parse(rawAuth)
      const callerEmail = parsed?.user?.email || parsed?.email
      if (callerEmail && callerEmail.toLowerCase().trim() === inv.email.toLowerCase().trim()) {
        isMatched = true
        safeEmail = inv.email
      }
    }
  } catch {
    // ignore
  }

  const preview: TeamInvitationPreview = {
    id: inv.id,
    team_id: team.id,
    team_name: team.name,
    event_id: event.id,
    event_title: event.title,
    event_slug: event.slug,
    event_category: event.category,
    venue_name: event.venue_name,
    start_date: event.start_date,
    is_free: event.is_free,
    price: event.price,
    leader_name: 'Team Leader',
    invite_code: team.invite_code,
    recipient_email: safeEmail,
    masked_email: maskedEmail,
    is_recipient_matched: isMatched,
    status: inv.status,
    expires_at: inv.expires_at,
    current_size: members.length,
    max_size: maxSize,
    is_full: members.length >= maxSize,
  }

  return { success: true, preview }
}

// ── Join Team With Code ────────────────────────────────────────────────────
export async function joinTeam(params: {
  inviteCode: string
  userId: string
  userEmail: string
  participantDetails: {
    student_name: string
    college_name?: string
    phone?: string
    id_card_number?: string
  }
}): Promise<TeamJoinResponse> {
  const cleanCode = params.inviteCode.trim().toUpperCase()

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('join_team_with_code', {
        p_invite_code: cleanCode,
        p_participant_details: params.participantDetails,
      })
      if (error) {
        return { success: false, message: error.message, error_code: 'RPC_ERROR' }
      }

      // Sync individual member registration in PostgreSQL
      try {
        await (supabase.rpc as any)('sync_team_member_registration', {
          p_team_id: data.team_id,
          p_member_user_id: params.userId,
          p_member_email: params.userEmail,
          p_member_name: params.participantDetails.student_name,
          p_participant_details: params.participantDetails,
        })
      } catch {
        // non-fatal
      }

      broadcastStatusChange({
        type: 'team_updated',
        eventId: (data as any)?.event_id,
        teamId: data.team_id,
        studentId: params.userId,
      })
      broadcastStatusChange({
        type: 'invitation_accepted',
        eventId: (data as any)?.event_id,
        teamId: data.team_id,
        studentId: params.userId,
      })

      return data as TeamJoinResponse
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to join team.', error_code: 'NETWORK_ERROR' }
    }
  }

  // Simulation Mode
  const teams = getLocalTeams()
  const team = teams.find((t) => t.invite_code.toUpperCase() === cleanCode && t.status !== 'disbanded')
  if (!team) {
    return { success: false, message: 'Invalid team invitation code or team is no longer active.', error_code: 'INVALID_CODE' }
  }

  const eventRes = await getEventById(team.event_id)
  const event = eventRes.event
  if (!event || event.status !== 'published') {
    return { success: false, message: 'Registration for this event is closed or not available.', error_code: 'EVENT_NOT_OPEN' }
  }

  const now = new Date()
  if (event.registration_closes_at && new Date(event.registration_closes_at) < now) {
    return { success: false, message: 'Registration deadline for this event has passed.', error_code: 'DEADLINE_PASSED' }
  }

  if (new Date(event.start_date) <= now) {
    return { success: false, message: 'This event has already started.', error_code: 'EVENT_STARTED' }
  }

  if (team.leader_id === params.userId) {
    return { success: false, message: 'You are already the leader of this team.', error_code: 'ALREADY_LEADER' }
  }

  const members = getLocalTeamMembers()
  const cleanEmail = params.userEmail.toLowerCase().trim()

  // Prevent joining multiple teams for the same event
  const existingInEvent = members.find(
    (m) =>
      m.event_id === team.event_id &&
      (m.user_id === params.userId || m.email.toLowerCase() === cleanEmail) &&
      m.status === 'accepted'
  )
  if (existingInEvent) {
    return {
      success: false,
      message: 'You are already an active member of a team for this event.',
      error_code: 'ALREADY_IN_TEAM',
    }
  }

  // Prevent joining if user already has active individual registration
  const rawRegs = localStorage.getItem('festflow_local_registrations')
  const localRegs = rawRegs ? JSON.parse(rawRegs) : []
  const existingReg = localRegs.find(
    (r: any) =>
      r.event_id === team.event_id &&
      r.student_id === params.userId &&
      ['confirmed', 'pending_approval', 'pending_payment'].includes(r.status) &&
      r.team_id !== team.id
  )
  if (existingReg) {
    return {
      success: false,
      message: 'You already have an active standalone registration for this event.',
      error_code: 'ALREADY_REGISTERED',
    }
  }

  // Capacity check
  const acceptedMembers = members.filter((m) => m.team_id === team.id && m.status === 'accepted')
  const maxSize = event.max_team_size || 5
  if (acceptedMembers.length >= maxSize) {
    return {
      success: false,
      message: `This team is already full (${acceptedMembers.length}/${maxSize} members).`,
      error_code: 'TEAM_FULL',
    }
  }

  // Update or insert member record
  const existingSlotIdx = members.findIndex(
    (m) => m.team_id === team.id && (m.email.toLowerCase() === cleanEmail || m.user_id === params.userId)
  )

  if (existingSlotIdx >= 0) {
    members[existingSlotIdx] = {
      ...members[existingSlotIdx],
      user_id: params.userId,
      name: params.participantDetails.student_name,
      email: cleanEmail,
      college: params.participantDetails.college_name || members[existingSlotIdx].college,
      phone: params.participantDetails.phone || members[existingSlotIdx].phone,
      student_id_card: params.participantDetails.id_card_number || members[existingSlotIdx].student_id_card,
      status: 'accepted',
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  } else {
    members.push({
      id: `tm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      team_id: team.id,
      event_id: team.event_id,
      user_id: params.userId,
      registration_id: team.registration_id,
      invitation_id: null,
      name: params.participantDetails.student_name,
      email: cleanEmail,
      role: 'member',
      status: 'accepted',
      college: params.participantDetails.college_name || null,
      phone: params.participantDetails.phone || null,
      student_id_card: params.participantDetails.id_card_number || null,
      joined_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }
  saveLocalTeamMembers(members)

  // Mark pending invites as accepted
  const invites = getLocalTeamInvites()
  for (const inv of invites) {
    if (inv.team_id === team.id && inv.email.toLowerCase() === cleanEmail && inv.status === 'pending') {
      inv.status = 'accepted'
      inv.accepted_by = params.userId
      inv.accepted_at = new Date().toISOString()
      inv.updated_at = new Date().toISOString()
    }
  }
  saveLocalTeamInvites(invites)

  // Update team status if full
  if (acceptedMembers.length + 1 >= maxSize) {
    team.status = 'complete'
    team.updated_at = new Date().toISOString()
    saveLocalTeams(teams)
  }

  // Locate team leader's registration record
  const leaderReg = localRegs.find(
    (r: any) => r.id === team.registration_id || (r.event_id === team.event_id && r.student_id === team.leader_id)
  )

  // Locate or create member's individual registration
  let memberReg = localRegs.find(
    (r: any) => r.event_id === team.event_id && r.student_id === params.userId
  )

  const memberIndex = acceptedMembers.length + 1
  const memberTicketCode = leaderReg?.ticket_code
    ? `${leaderReg.ticket_code}-M${memberIndex}`
    : `FF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
  const memberQrToken = `FFQ_${Math.random().toString(36).substring(2, 12).toUpperCase()}`
  const isFree = Boolean(event.is_free)
  const isLeaderConfirmed = leaderReg?.status === 'confirmed' && Boolean(leaderReg.ticket_issued_at)
  const isApproved = isFree || isLeaderConfirmed

  let memberStatus = isApproved ? 'confirmed' : 'pending_payment'
  if (isFree && event.approval_type === 'manual' && leaderReg?.status === 'pending_approval') {
    memberStatus = 'pending_approval'
  }
  const memberTicketIssuedAt = memberStatus === 'confirmed' ? new Date().toISOString() : null

  if (!memberReg) {
    memberReg = {
      id: `reg_tm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      event_id: team.event_id,
      student_id: params.userId,
      status: memberStatus,
      ticket_code: memberTicketCode,
      qr_token: memberQrToken,
      ticket_issued_at: memberTicketIssuedAt,
      team_name: team.name,
      team_id: team.id,
      team_role: 'member',
      team_members: leaderReg?.team_members || [],
      participant_details: params.participantDetails,
      approval_status: memberStatus === 'confirmed' ? 'approved' : 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    localRegs.push(memberReg)
  } else {
    // If existing registration, update squad linkage
    memberReg.team_id = team.id
    memberReg.team_name = team.name
    memberReg.team_role = 'member'
    memberReg.status = memberStatus
    memberReg.ticket_issued_at = memberStatus === 'confirmed' ? (memberReg.ticket_issued_at || new Date().toISOString()) : null
    memberReg.updated_at = new Date().toISOString()
  }

  // Update member slot's registration_id with their own individual registration
  if (existingSlotIdx >= 0) {
    members[existingSlotIdx].registration_id = memberReg.id
  } else if (members.length > 0) {
    members[members.length - 1].registration_id = memberReg.id
  }
  saveLocalTeamMembers(members)

  // Sync leader's registration record team_members JSONB
  if (leaderReg) {
    leaderReg.team_members = members
      .filter((m) => m.team_id === team.id && m.role === 'member')
      .map((m) => ({
        name: m.name,
        email: m.email,
        college: m.college,
        studentId: m.student_id_card,
        phone: m.phone,
        user_id: m.user_id,
        status: m.status,
      }))
  }
  localStorage.setItem('festflow_local_registrations', JSON.stringify(localRegs))

  // Dispatch individual ticket email to member if ticket is active
  if (memberReg.status === 'confirmed') {
    sendTicketIssuedEmail({
      to: cleanEmail,
      name: params.participantDetails.student_name,
      eventTitle: event.title,
      ticketCode: memberReg.ticket_code,
      venueName: event.venue_name,
      teamName: team.name,
      registrationId: memberReg.id,
      eventId: team.event_id,
    }).catch(() => {})
  }

  // Notify team leader that member accepted invitation
  const leaderMem = members.find((m) => m.role === 'leader')
  if (leaderMem?.email) {
    sendTeamInvitationAcceptedEmail({
      leaderEmail: leaderMem.email,
      leaderName: leaderMem.name,
      memberName: params.participantDetails.student_name,
      memberEmail: cleanEmail,
      teamName: team.name,
      eventTitle: event.title,
      currentSize: acceptedMembers.length + 1,
      eventId: team.event_id,
      teamId: team.id,
    }).catch(() => {})
  }

  // Broadcast Realtime & Cross-tab status changes
  broadcastStatusChange({
    type: 'team_updated',
    eventId: team.event_id,
    teamId: team.id,
    studentId: params.userId,
  })
  broadcastStatusChange({
    type: 'invitation_accepted',
    eventId: team.event_id,
    teamId: team.id,
    studentId: params.userId,
  })
  broadcastStatusChange({
    type: 'registration_updated',
    eventId: team.event_id,
    registrationId: memberReg.id,
    studentId: params.userId,
  })

  return {
    success: true,
    message: `Successfully joined ${team.name}! Your spot is confirmed.`,
    team_id: team.id,
    team_name: team.name,
    registration_id: memberReg.id,
    ticket_code: memberReg.ticket_code,
    member_count: acceptedMembers.length + 1,
  }
}

// ── Accept Team Invitation (Token-based) ───────────────────────────────────
export async function acceptTeamInvitation(params: {
  token: string
  participantDetails: {
    student_name: string
    college_name?: string
    phone?: string
    id_card_number?: string
  }
}): Promise<TeamJoinResponse> {
  const cleanToken = (params.token || '').trim()
  if (!cleanToken || cleanToken.length < 8) {
    return { success: false, message: 'Invalid or missing invitation token.', error_code: 'INVALID_TOKEN' }
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('accept_team_invitation', {
        p_token: cleanToken,
        p_participant_details: params.participantDetails,
      })

      if (error) {
        return { success: false, message: error.message, error_code: 'RPC_ERROR' }
      }

      if (!data?.success) {
        return {
          success: false,
          message: data?.message || 'Failed to accept invitation.',
          error_code: data?.error_code || 'ACCEPT_FAILED',
        }
      }

      // Broadcast changes to real-time sync
      broadcastStatusChange({
        type: 'team_updated',
        teamId: data.team_id,
      })
      broadcastStatusChange({
        type: 'invitation_accepted',
        teamId: data.team_id,
      })
      broadcastStatusChange({
        type: 'registration_updated',
        teamId: data.team_id,
        registrationId: data.registration_id,
      })

      return data as TeamJoinResponse
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to accept invitation.', error_code: 'NETWORK_ERROR' }
    }
  }

  // Simulation Mode
  const invites = getLocalTeamInvites()
  const inv = invites.find((i) => i.token === cleanToken)
  if (!inv) {
    return { success: false, message: 'Invitation not found or link has expired.', error_code: 'INVITATION_NOT_FOUND' }
  }

  if (inv.status === 'revoked') {
    return { success: false, message: 'This squad invitation has been revoked by the team leader.', error_code: 'INVITATION_REVOKED' }
  }

  if (inv.status === 'accepted') {
    return { success: false, message: 'This squad invitation has already been accepted and claimed.', error_code: 'ALREADY_ACCEPTED' }
  }

  if (new Date(inv.expires_at) < new Date()) {
    return { success: false, message: 'This squad invitation has expired.', error_code: 'INVITATION_EXPIRED' }
  }

  // Caller identity check in simulation mode
  let callerId = ''
  let callerEmail = ''
  try {
    const rawAuth = localStorage.getItem('festflow_mock_session') || localStorage.getItem('sb-current-user')
    if (rawAuth) {
      const parsed = JSON.parse(rawAuth)
      callerId = parsed?.user?.id || parsed?.id || ''
      callerEmail = (parsed?.user?.email || parsed?.email || '').toLowerCase().trim()
    }
  } catch {
    // ignore
  }

  if (!callerEmail) {
    return { success: false, message: 'You must be signed in to accept an invitation.', error_code: 'UNAUTHENTICATED' }
  }

  if (callerEmail !== inv.email.toLowerCase().trim()) {
    return {
      success: false,
      message: `This invitation was issued to ${inv.email}. You are currently signed in as ${callerEmail}.`,
      error_code: 'EMAIL_MISMATCH',
    }
  }

  const teams = getLocalTeams()
  const team = teams.find((t) => t.id === inv.team_id)
  if (!team || team.status === 'disbanded') {
    return { success: false, message: 'This squad is no longer active.', error_code: 'TEAM_NOT_FOUND' }
  }

  if (team.leader_id === callerId) {
    return { success: false, message: 'You are the leader of this team and cannot accept your own invitation.', error_code: 'ALREADY_LEADER' }
  }

  const eventRes = await getEventById(team.event_id)
  const event = eventRes.event
  if (!event || event.status !== 'published') {
    return { success: false, message: 'Registration for this event is closed or not available.', error_code: 'EVENT_NOT_OPEN' }
  }

  const now = new Date()
  if (event.registration_closes_at && new Date(event.registration_closes_at) < now) {
    return { success: false, message: 'Registration deadline for this event has passed.', error_code: 'DEADLINE_PASSED' }
  }

  if (new Date(event.start_date) <= now) {
    return { success: false, message: 'This event has already started.', error_code: 'EVENT_STARTED' }
  }

  const members = getLocalTeamMembers()
  const existingInEvent = members.find(
    (m) =>
      m.event_id === team.event_id &&
      (m.user_id === callerId || m.email.toLowerCase() === callerEmail) &&
      m.status === 'accepted'
  )
  if (existingInEvent) {
    return { success: false, message: 'You are already an active member of a team for this event.', error_code: 'ALREADY_IN_TEAM' }
  }

  const acceptedMembers = members.filter((m) => m.team_id === team.id && m.status === 'accepted')
  const maxSize = event.max_team_size || 5
  if (acceptedMembers.length >= maxSize) {
    return { success: false, message: `This team is already full (${acceptedMembers.length}/${maxSize} members).`, error_code: 'TEAM_FULL' }
  }

  // Update invite status
  inv.status = 'accepted'
  inv.accepted_by = callerId
  inv.accepted_at = new Date().toISOString()
  inv.updated_at = new Date().toISOString()
  saveLocalTeamInvites(invites)

  // Update or insert member record
  const existingSlotIdx = members.findIndex(
    (m) => m.team_id === team.id && (m.email.toLowerCase() === callerEmail || m.invitation_id === inv.id)
  )

  const rawRegs = localStorage.getItem('festflow_local_registrations')
  const localRegs = rawRegs ? JSON.parse(rawRegs) : []
  const leaderReg = localRegs.find(
    (r: any) => r.id === team.registration_id || (r.event_id === team.event_id && r.student_id === team.leader_id)
  )

  const memberIndex = acceptedMembers.length + 1
  const memberTicketCode = leaderReg?.ticket_code
    ? `${leaderReg.ticket_code}-M${memberIndex}`
    : `FF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
  const memberQrToken = `FFQ_${Math.random().toString(36).substring(2, 12).toUpperCase()}`
  const isFree = Boolean(event.is_free)
  const isLeaderConfirmed = leaderReg?.status === 'confirmed' && Boolean(leaderReg.ticket_issued_at)
  const isApproved = isFree || isLeaderConfirmed

  let memberStatus = isApproved ? 'confirmed' : 'pending_payment'
  if (isFree && event.approval_type === 'manual' && leaderReg?.status === 'pending_approval') {
    memberStatus = 'pending_approval'
  }
  const memberTicketIssuedAt = memberStatus === 'confirmed' ? new Date().toISOString() : null

  let memberReg = localRegs.find((r: any) => r.event_id === team.event_id && r.student_id === callerId)
  if (!memberReg) {
    memberReg = {
      id: `reg_tm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      event_id: team.event_id,
      student_id: callerId,
      status: memberStatus,
      ticket_code: memberTicketCode,
      qr_token: memberQrToken,
      ticket_issued_at: memberTicketIssuedAt,
      team_name: team.name,
      team_id: team.id,
      team_role: 'member',
      team_members: leaderReg?.team_members || [],
      participant_details: params.participantDetails,
      approval_status: memberStatus === 'confirmed' ? 'approved' : 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    localRegs.push(memberReg)
  } else {
    memberReg.team_id = team.id
    memberReg.team_name = team.name
    memberReg.team_role = 'member'
    memberReg.status = memberStatus
    memberReg.ticket_issued_at = memberStatus === 'confirmed' ? (memberReg.ticket_issued_at || new Date().toISOString()) : null
    memberReg.updated_at = new Date().toISOString()
  }

  if (existingSlotIdx >= 0) {
    members[existingSlotIdx] = {
      ...members[existingSlotIdx],
      user_id: callerId,
      registration_id: memberReg.id,
      name: params.participantDetails.student_name,
      email: callerEmail,
      college: params.participantDetails.college_name || members[existingSlotIdx].college,
      phone: params.participantDetails.phone || members[existingSlotIdx].phone,
      student_id_card: params.participantDetails.id_card_number || members[existingSlotIdx].student_id_card,
      status: 'accepted',
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  } else {
    members.push({
      id: `tm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      team_id: team.id,
      event_id: team.event_id,
      user_id: callerId,
      registration_id: memberReg.id,
      invitation_id: inv.id,
      name: params.participantDetails.student_name,
      email: callerEmail,
      role: 'member',
      status: 'accepted',
      college: params.participantDetails.college_name || null,
      phone: params.participantDetails.phone || null,
      student_id_card: params.participantDetails.id_card_number || null,
      joined_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }
  saveLocalTeamMembers(members)

  if (acceptedMembers.length + 1 >= maxSize) {
    team.status = 'complete'
    team.updated_at = new Date().toISOString()
    saveLocalTeams(teams)
  }

  if (leaderReg) {
    leaderReg.team_members = members
      .filter((m) => m.team_id === team.id && m.role === 'member')
      .map((m) => ({
        name: m.name,
        email: m.email,
        college: m.college,
        studentId: m.student_id_card,
        phone: m.phone,
        user_id: m.user_id,
        status: m.status,
      }))
  }
  localStorage.setItem('festflow_local_registrations', JSON.stringify(localRegs))

  broadcastStatusChange({
    type: 'team_updated',
    eventId: team.event_id,
    teamId: team.id,
    studentId: callerId,
  })
  broadcastStatusChange({
    type: 'invitation_accepted',
    eventId: team.event_id,
    teamId: team.id,
    studentId: callerId,
  })
  broadcastStatusChange({
    type: 'registration_updated',
    eventId: team.event_id,
    teamId: team.id,
    studentId: callerId,
    registrationId: memberReg.id,
  })

  // Dispatch individual ticket email to member if ticket is active
  if (memberReg.status === 'confirmed') {
    sendTicketIssuedEmail({
      to: callerEmail,
      name: params.participantDetails.student_name,
      eventTitle: event.title,
      ticketCode: memberReg.ticket_code,
      venueName: event.venue_name,
      teamName: team.name,
      registrationId: memberReg.id,
      eventId: team.event_id,
    }).catch(() => {})
  }

  // Notify team leader that member accepted invitation
  const leaderMem = members.find((m) => m.role === 'leader')
  if (leaderMem?.email) {
    sendTeamInvitationAcceptedEmail({
      leaderEmail: leaderMem.email,
      leaderName: leaderMem.name,
      memberName: params.participantDetails.student_name,
      memberEmail: callerEmail,
      teamName: team.name,
      eventTitle: event.title,
      currentSize: acceptedMembers.length + 1,
      eventId: team.event_id,
      teamId: team.id,
    }).catch(() => {})
  }

  return {
    success: true,
    message: `Successfully joined ${team.name}! Your spot and digital pass are confirmed.`,
    team_id: team.id,
    team_name: team.name,
    registration_id: memberReg.id,
    ticket_code: memberReg.ticket_code,
    member_count: acceptedMembers.length + 1,
  }
}

// ── Invite Team Member by Email ────────────────────────────────────────────
export async function inviteTeamMember(params: {
  teamId: string
  email: string
  name?: string
  leaderId: string
}): Promise<TeamInviteResponse> {
  const cleanEmail = params.email.trim().toLowerCase()
  if (!cleanEmail || !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(cleanEmail)) {
    return { success: false, message: 'Please provide a valid email address.' }
  }

  const token = generateToken()

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('invite_team_member', {
        p_team_id: params.teamId,
        p_email: cleanEmail,
        p_name: params.name || null,
      })
      if (error) {
        return { success: false, message: error.message }
      }
      if (!data?.success) {
        return { success: false, message: data?.message || 'Failed to send invitation.' }
      }

      // Fetch team & event info for email
      const { data: teamRec } = await (supabase.from('teams') as any)
        .select('name, invite_code, event_id, events(title, slug, club_id)')
        .eq('id', params.teamId)
        .single()

      let emailSent = false
      let emailError: string | undefined

      if (teamRec) {
        const emailRes = await sendTeamInvitationEmail({
          recipientEmail: cleanEmail,
          recipientName: params.name,
          teamName: teamRec.name,
          eventTitle: teamRec.events?.title || 'FestFlow Event',
          eventSlug: teamRec.events?.slug || '',
          leaderName: 'Team Leader',
          inviteCode: data.invite_code || teamRec.invite_code,
          inviteToken: data.token,
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
          eventId: teamRec.event_id,
          teamId: params.teamId,
        })
        emailSent = emailRes.success
        emailError = emailRes.error
      }

      if (!emailSent) {
        return {
          success: true,
          invitation_created_email_failed: true,
          email_dispatch_error: emailError || 'Email provider could not deliver message.',
          message: `Invitation saved for ${cleanEmail}, but email dispatch failed: ${emailError || 'Provider unreachable'}. You can share the link or invite code directly.`,
          invitation_id: data.invitation_id,
          token: data.token,
          invite_code: data.invite_code,
          email: cleanEmail,
        }
      }

      return {
        success: true,
        message: `Invitation sent to ${cleanEmail}`,
        invitation_id: data.invitation_id,
        token: data.token,
        invite_code: data.invite_code,
        email: cleanEmail,
      }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to create invitation.' }
    }
  }

  // Simulation Mode
  const teams = getLocalTeams()
  const team = teams.find((t) => t.id === params.teamId)
  if (!team || team.leader_id !== params.leaderId) {
    return { success: false, message: 'Only team leaders can send invitations.' }
  }

  const members = getLocalTeamMembers()
  const currentAccepted = members.filter((m) => m.team_id === team.id && m.status === 'accepted')
  const eventRes = await getEventById(team.event_id)
  const event = eventRes.event
  const maxSize = event?.max_team_size || 5

  if (currentAccepted.length >= maxSize) {
    return { success: false, message: 'This team has already reached maximum capacity.' }
  }

  const alreadyAccepted = members.find(
    (m) => m.team_id === team.id && m.email.toLowerCase() === cleanEmail && m.status === 'accepted'
  )
  if (alreadyAccepted) {
    return { success: false, message: 'This student is already a confirmed member of your team.' }
  }

  const invites = getLocalTeamInvites()
  const existingInvite = invites.find(
    (i) => i.team_id === team.id && i.email.toLowerCase() === cleanEmail && i.status === 'pending'
  )

  let invitationId = existingInvite?.id || `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString()

  if (existingInvite) {
    existingInvite.token = token
    existingInvite.last_sent_at = new Date().toISOString()
    existingInvite.resend_count += 1
    existingInvite.expires_at = expiresAt
    existingInvite.updated_at = new Date().toISOString()
  } else {
    invites.push({
      id: invitationId,
      team_id: team.id,
      event_id: team.event_id,
      inviter_id: params.leaderId,
      email: cleanEmail,
      token,
      status: 'pending',
      expires_at: expiresAt,
      accepted_by: null,
      accepted_at: null,
      last_sent_at: new Date().toISOString(),
      resend_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }
  saveLocalTeamInvites(invites)

  // Ensure pending slot exists in team_members
  const existingMemIdx = members.findIndex(
    (m) => m.team_id === team.id && m.email.toLowerCase() === cleanEmail
  )
  if (existingMemIdx >= 0) {
    members[existingMemIdx].invitation_id = invitationId
    members[existingMemIdx].updated_at = new Date().toISOString()
  } else {
    members.push({
      id: `tm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      team_id: team.id,
      event_id: team.event_id,
      user_id: null,
      registration_id: team.registration_id,
      invitation_id: invitationId,
      name: params.name || cleanEmail.split('@')[0],
      email: cleanEmail,
      role: 'member',
      status: 'pending',
      college: null,
      phone: null,
      student_id_card: null,
      joined_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }
  saveLocalTeamMembers(members)

  // Queue simulated email
  let simEmailSent = false
  let simEmailError: string | undefined
  try {
    const emailRes = await sendTeamInvitationEmail({
      recipientEmail: cleanEmail,
      recipientName: params.name,
      teamName: team.name,
      eventTitle: event?.title || 'FestFlow Squad Event',
      eventSlug: event?.slug || '',
      leaderName: 'Team Leader',
      inviteCode: team.invite_code,
      inviteToken: token,
      expiresAt,
      eventId: team.event_id,
      teamId: team.id,
    })
    simEmailSent = emailRes.success
    simEmailError = emailRes.error
  } catch (err: any) {
    simEmailSent = false
    simEmailError = err?.message || 'Email delivery failed'
  }

  if (!simEmailSent) {
    return {
      success: true,
      invitation_created_email_failed: true,
      email_dispatch_error: simEmailError || 'Email provider could not deliver message',
      message: `Invitation saved for ${cleanEmail}, but email dispatch failed: ${simEmailError || 'Provider unreachable'}. You can share the link or invite code directly.`,
      invitation_id: invitationId,
      token,
      invite_code: team.invite_code,
      email: cleanEmail,
    }
  }

  return {
    success: true,
    message: `Invitation sent to ${cleanEmail}`,
    invitation_id: invitationId,
    token,
    invite_code: team.invite_code,
    email: cleanEmail,
  }
}

// ── Resend Team Invitation ─────────────────────────────────────────────────
export async function resendTeamInvitation(
  arg1: string | { invitationId: string; leaderId: string },
  arg2?: string
): Promise<{ success: boolean; message: string }> {
  const invitationId = typeof arg1 === 'string' ? arg1 : arg1.invitationId
  const leaderId = typeof arg1 === 'string' ? (arg2 || '') : arg1.leaderId

  if (isSupabaseConfigured) {
    // RPC or query
    const { data: inv, error: findErr } = await (supabase.from('team_invitations') as any)
      .select('*, teams(name, invite_code, leader_id, events(title, slug))')
      .eq('id', invitationId)
      .single()

    if (findErr || !inv) {
      return { success: false, message: 'Invitation not found.' }
    }

    if (inv.teams?.leader_id !== leaderId) {
      return { success: false, message: 'Only team leaders can resend invitations.' }
    }

    // Rate-limiting: minimum 60 seconds between resends
    const lastSent = new Date(inv.last_sent_at).getTime()
    if (Date.now() - lastSent < 60000) {
      const waitSec = Math.ceil((60000 - (Date.now() - lastSent)) / 1000)
      return { success: false, message: `Please wait ${waitSec}s before resending this invitation.` }
    }

    const newToken = generateToken()
    await (supabase.from('team_invitations') as any)
      .update({
        token: newToken,
        last_sent_at: new Date().toISOString(),
        resend_count: inv.resend_count + 1,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      })
      .eq('id', invitationId)

    await sendTeamInvitationEmail({
      recipientEmail: inv.email,
      teamName: inv.teams?.name || 'Your Squad',
      eventTitle: inv.teams?.events?.title || 'FestFlow Event',
      eventSlug: inv.teams?.events?.slug || '',
      leaderName: 'Team Leader',
      inviteCode: inv.teams?.invite_code || '',
      inviteToken: newToken,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      eventId: inv.event_id,
      teamId: inv.team_id,
    })

    return { success: true, message: 'Invitation resent successfully.' }
  }

  // Simulation Mode
  const invites = getLocalTeamInvites()
  const inv = invites.find((i) => i.id === invitationId)
  if (!inv) return { success: false, message: 'Invitation not found.' }

  if (inv.inviter_id !== leaderId) {
    return { success: false, message: 'Only team leaders can resend invitations.' }
  }

  // Rate-limiting
  const lastSent = new Date(inv.last_sent_at).getTime()
  if (Date.now() - lastSent < 60000) {
    const waitSec = Math.ceil((60000 - (Date.now() - lastSent)) / 1000)
    return { success: false, message: `Please wait ${waitSec}s before resending this invitation.` }
  }

  const teams = getLocalTeams()
  const team = teams.find((t) => t.id === inv.team_id)
  const eventRes = await getEventById(inv.event_id)

  const newToken = generateToken()
  inv.token = newToken
  inv.last_sent_at = new Date().toISOString()
  inv.resend_count += 1
  inv.expires_at = new Date(Date.now() + 7 * 86400000).toISOString()
  saveLocalTeamInvites(invites)

  await sendTeamInvitationEmail({
    recipientEmail: inv.email,
    teamName: team?.name || 'Your Squad',
    eventTitle: eventRes.event?.title || 'FestFlow Event',
    eventSlug: eventRes.event?.slug || '',
    leaderName: 'Team Leader',
    inviteCode: team?.invite_code || '',
    inviteToken: newToken,
    expiresAt: inv.expires_at,
    eventId: inv.event_id,
    teamId: inv.team_id,
  })

  return { success: true, message: 'Invitation resent successfully.' }
}

// ── Revoke Team Invitation ─────────────────────────────────────────────────
export async function revokeTeamInvitation(
  arg1: string | { invitationId: string; leaderId: string },
  arg2?: string
): Promise<{ success: boolean; message: string }> {
  const invitationId = typeof arg1 === 'string' ? arg1 : arg1.invitationId
  const leaderId = typeof arg1 === 'string' ? (arg2 || '') : arg1.leaderId

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('revoke_team_invitation', {
        p_invitation_id: invitationId,
      })
      if (error) return { success: false, message: error.message }
      return { success: Boolean(data?.success), message: data?.message || 'Invitation revoked.' }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to revoke invitation.' }
    }
  }

  // Simulation Mode
  const invites = getLocalTeamInvites()
  const inv = invites.find((i) => i.id === invitationId)
  if (!inv) return { success: false, message: 'Invitation not found.' }

  if (inv.inviter_id !== leaderId) {
    return { success: false, message: 'Only team leaders can revoke invitations.' }
  }

  inv.status = 'revoked'
  inv.updated_at = new Date().toISOString()
  saveLocalTeamInvites(invites)

  const members = getLocalTeamMembers()
  const remaining = members.filter(
    (m) => !(m.team_id === inv.team_id && m.email.toLowerCase() === inv.email.toLowerCase() && m.status === 'pending')
  )
  saveLocalTeamMembers(remaining)

  return { success: true, message: 'Invitation has been revoked.' }
}

// ── Get Complete Team Details (Leader / Member Dashboard Roster) ───────────
export async function getTeamDetails(
  teamId: string,
  userId?: string
): Promise<{ success: boolean; team?: TeamDetails; message?: string }> {
  if (isSupabaseConfigured) {
    try {
      const { data: teamRec, error: tErr } = await (supabase.from('teams') as any)
        .select('*, events(*)')
        .eq('id', teamId)
        .single()

      if (tErr || !teamRec) {
        return { success: false, message: tErr?.message || 'Team not found.' }
      }

      const { data: memberList } = await (supabase.from('team_members') as any)
        .select('*')
        .eq('team_id', teamId)
        .order('role', { ascending: true }) // leader first
        .order('joined_at', { ascending: true })

      const { data: inviteList } = await (supabase.from('team_invitations') as any)
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })

      const isLeader = teamRec.leader_id === userId
      const userRole = isLeader ? 'leader' : 'member'

      const details: TeamDetails = {
        ...teamRec,
        event: teamRec.events || null,
        members: memberList || [],
        invitations: isLeader ? inviteList || [] : [], // Only leader sees unaccepted invitation list
        userRole,
      }

      return { success: true, team: details }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to fetch team details.' }
    }
  }

  // Simulation Mode
  const teams = getLocalTeams()
  const team = teams.find((t) => t.id === teamId)
  if (!team) return { success: false, message: 'Team not found.' }

  const eventRes = await getEventById(team.event_id)
  const allMembers = getLocalTeamMembers().filter((m) => m.team_id === team.id)
  const allInvites = getLocalTeamInvites().filter((i) => i.team_id === team.id)

  const isLeader = team.leader_id === userId
  const details: TeamDetails = {
    ...team,
    event: eventRes.event || null,
    members: allMembers,
    invitations: isLeader ? allInvites : [],
    userRole: isLeader ? 'leader' : 'member',
  }

  return { success: true, team: details }
}

// ── Find Team by User and Event ────────────────────────────────────────────
export async function getTeamByEventAndUser(
  eventId: string,
  userId: string,
  userEmail?: string
): Promise<TeamRecord | null> {
  if (isSupabaseConfigured) {
    try {
      // 1. Check if user is leader
      const { data: leadTeam } = await (supabase.from('teams') as any)
        .select('*')
        .eq('event_id', eventId)
        .eq('leader_id', userId)
        .maybeSingle()

      if (leadTeam) return leadTeam as TeamRecord

      // 2. Check if user is member
      const { data: memberRec } = await (supabase.from('team_members') as any)
        .select('team_id, teams(*)')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .eq('status', 'accepted')
        .maybeSingle()

      if (memberRec?.teams) return memberRec.teams as TeamRecord

      return null
    } catch {
      return null
    }
  }

  // Simulation Mode
  const teams = getLocalTeams()
  // Check leader
  const leadTeam = teams.find(
    (t) => t.event_id === eventId && t.leader_id === userId && t.status !== 'disbanded'
  )
  if (leadTeam) return leadTeam

  // Check member
  const cleanEmail = userEmail?.toLowerCase().trim()
  const members = getLocalTeamMembers()
  const memberRec = members.find(
    (m) =>
      m.event_id === eventId &&
      (m.user_id === userId || (cleanEmail && m.email.toLowerCase() === cleanEmail)) &&
      m.status === 'accepted'
  )
  if (memberRec) {
    return teams.find((t) => t.id === memberRec.team_id) || null
  }

  return null
}
