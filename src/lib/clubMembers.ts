import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type {
  ClubAuditLogRecord,
  ClubInvitationRecord,
  ClubMemberRecord,
  ClubRole,
} from '@/types'
import {
  ALL_CLUB_ROLES,
  ASSIGNABLE_CLUB_ROLES,
  CANONICAL_CLUB_PERMISSIONS,
  EVENT_ASSIGNMENT_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  ROLE_RANK,
  canAssignRole,
  canManageMember,
  canTransferOwnership,
  getAssignableRoles,
  getRolePermissions,
  hasAllPermissions,
  hasAnyEventPermission,
  hasAnyPermission,
  hasEventPermission,
  hasPermission,
  isAssignableClubRole,
  isValidClubRole,
  normalizeClubPermission,
  resolveClubId,
  resolveEffectiveEventPermissions,
} from '@/lib/rbac'
import {
  sendClubInvitationAcceptedEmail,
  sendClubMemberInvitationEmail,
  type EmailDispatchResult,
} from '@/lib/emails'
import { broadcastStatusChange } from '@/lib/sync'
import { getFrontendBaseUrl } from '@/lib/canonicalUrl'

export {
  ALL_CLUB_ROLES,
  ASSIGNABLE_CLUB_ROLES,
  CANONICAL_CLUB_PERMISSIONS,
  EVENT_ASSIGNMENT_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  ROLE_RANK,
  canAssignRole,
  canManageMember,
  canTransferOwnership,
  getAssignableRoles,
  getRolePermissions,
  hasAllPermissions,
  hasAnyEventPermission,
  hasAnyPermission,
  hasEventPermission,
  hasPermission,
  isAssignableClubRole,
  isValidClubRole,
  normalizeClubPermission,
  resolveClubId,
  resolveEffectiveEventPermissions,
}

const LOCAL_STORAGE_MEMBERS_KEY = 'festflow_local_club_members'
const LOCAL_STORAGE_INVITATIONS_KEY = 'festflow_local_club_invitations'
const LOCAL_STORAGE_AUDIT_LOGS_KEY = 'festflow_local_club_audit_logs'
const LOCAL_STORAGE_ASSIGNMENTS_KEY = 'festflow_local_event_assignments'

// ── Local Storage Simulation Helpers (only used when Supabase is unconfigured) ─

function getLocalMembers(): ClubMemberRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_MEMBERS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore storage parse failure
  }
  return []
}

function saveLocalMembers(members: ClubMemberRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_MEMBERS_KEY, JSON.stringify(members))
  } catch {
    // ignore storage quota failure
  }
}

function getLocalInvitations(): ClubInvitationRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_INVITATIONS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
}

function saveLocalInvitations(invites: ClubInvitationRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_INVITATIONS_KEY, JSON.stringify(invites))
  } catch {
    // ignore
  }
}

function getLocalAuditLogs(): ClubAuditLogRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_AUDIT_LOGS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
}

function saveLocalAuditLogs(logs: ClubAuditLogRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_AUDIT_LOGS_KEY, JSON.stringify(logs))
  } catch {
    // ignore
  }
}

function appendLocalAuditLog(entry: ClubAuditLogRecord) {
  const logs = getLocalAuditLogs()
  logs.unshift(entry)
  saveLocalAuditLogs(logs)
}

function removeLocalAssignmentsForUser(clubId: string, userId: string) {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_ASSIGNMENTS_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Array<{ club_id?: string; user_id?: string }>
    const filtered = parsed.filter(
      (a) => !(a.club_id === clubId && a.user_id === userId)
    )
    localStorage.setItem(LOCAL_STORAGE_ASSIGNMENTS_KEY, JSON.stringify(filtered))
  } catch {
    // ignore
  }
}

function generateSecureToken(): string {
  try {
    if (typeof crypto !== 'undefined') {
      if (typeof crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(32)
        crypto.getRandomValues(bytes)
        return Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
      }
      if (typeof crypto.randomUUID === 'function') {
        return `${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`
      }
    }
  } catch {
    // ignore
  }
  return `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
}

// ── Query Members ───────────────────────────────────────────────────────────

export async function getClubMembers(
  clubId: string
): Promise<{ members: ClubMemberRecord[]; error?: string }> {
  if (!clubId) return { members: [] }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('club_members') as any)
        .select(
          `
          *,
          profile:profiles!user_id (*)
        `
        )
        .eq('club_id', clubId)
        .eq('status', 'active')
        .order('created_at', { ascending: true })

      if (error) {
        return { members: [], error: error.message }
      }
      return { members: (data as ClubMemberRecord[]) || [] }
    } catch (err) {
      return {
        members: [],
        error: err instanceof Error ? err.message : 'Failed to load club members.',
      }
    }
  }

  const localMembers = getLocalMembers().filter(
    (m) => m.club_id === clubId && m.status === 'active'
  )
  return { members: localMembers }
}

// ── Query Pending & Past Invitations ────────────────────────────────────────

export async function getClubInvitations(
  clubId: string
): Promise<{ invitations: ClubInvitationRecord[]; error?: string }> {
  if (!clubId) return { invitations: [] }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('club_invitations') as any)
        .select(
          `
          *,
          inviter:profiles!invited_by (*)
        `
        )
        .eq('club_id', clubId)
        .order('created_at', { ascending: false })

      if (error) {
        return { invitations: [], error: error.message }
      }

      const now = new Date()
      const resolved = ((data as ClubInvitationRecord[]) || []).map((inv) => {
        if (inv.status === 'pending' && new Date(inv.expires_at) < now) {
          return { ...inv, status: 'expired' as const }
        }
        return inv
      })
      return { invitations: resolved }
    } catch (err) {
      return {
        invitations: [],
        error: err instanceof Error ? err.message : 'Failed to load invitations.',
      }
    }
  }

  const now = new Date()
  const localInvites = getLocalInvitations()
    .filter((inv) => inv.club_id === clubId)
    .map((inv) => {
      if (inv.status === 'pending' && new Date(inv.expires_at) < now) {
        return { ...inv, status: 'expired' as const }
      }
      return inv
    })

  return { invitations: localInvites }
}

// ── Query Audit Logs ────────────────────────────────────────────────────────

export async function getClubAuditLogs(
  clubId: string
): Promise<{ logs: ClubAuditLogRecord[]; error?: string }> {
  if (!clubId) return { logs: [] }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('club_audit_logs') as any)
        .select(
          `
          *,
          actor:profiles!actor_id (*)
        `
        )
        .eq('club_id', clubId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        return { logs: [], error: error.message }
      }
      return { logs: (data as ClubAuditLogRecord[]) || [] }
    } catch (err) {
      return {
        logs: [],
        error: err instanceof Error ? err.message : 'Failed to load audit logs.',
      }
    }
  }

  const localLogs = getLocalAuditLogs().filter((l) => l.club_id === clubId)
  return { logs: localLogs }
}

// ── Query User Role in Club ─────────────────────────────────────────────────

export async function getUserClubRole(
  clubId: string,
  userId: string
): Promise<ClubRole | null> {
  if (!clubId || !userId) return null

  if (isSupabaseConfigured) {
    try {
      // 1. Authoritative club_members lookup (honors role changes, suspensions, and ownership transfers)
      const { data, error } = await (supabase.from('club_members') as any)
        .select('role, status')
        .eq('club_id', clubId)
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        return null
      }

      if (data) {
        if (data.status !== 'active') return null
        return isValidClubRole(data.role) ? data.role : null
      }

      // 2. Legacy compatibility ONLY when userId === clubId and club has no active owner row yet
      if (clubId === userId) {
        const [{ data: existingOwners, error: ownersErr }, { data: clubRow, error: clubErr }] =
          await Promise.all([
            (supabase.from('club_members') as any)
              .select('id')
              .eq('club_id', clubId)
              .eq('role', 'owner')
              .eq('status', 'active')
              .limit(1),
            (supabase.from('club_profiles') as any)
              .select('profile_id')
              .eq('profile_id', clubId)
              .maybeSingle(),
          ])

        if (!ownersErr && !clubErr && clubRow && (!existingOwners || existingOwners.length === 0)) {
          return 'owner'
        }
      }

      return null
    } catch {
      return null
    }
  }

  // Simulation mode: inspect local membership records first so demotions/transfers apply even if clubId === userId
  const localMembers = getLocalMembers()
  const existingRow = localMembers.find(
    (m) => m.club_id === clubId && m.user_id === userId
  )
  if (existingRow) {
    return existingRow.status === 'active' && isValidClubRole(existingRow.role)
      ? existingRow.role
      : null
  }

  if (clubId === userId) {
    const hasTransferredOwner = localMembers.some(
      (m) => m.club_id === clubId && m.role === 'owner' && m.status === 'active'
    )
    if (!hasTransferredOwner) {
      return 'owner'
    }
  }

  return null
}

// ── Send Member Invitation ──────────────────────────────────────────────────

export async function inviteClubMember(params: {
  clubId: string
  email: string
  role: ClubRole
  inviterId: string
  inviterRole?: ClubRole | null
  clubName?: string
  inviterName?: string
}): Promise<{
  success: boolean
  message: string
  invitation?: ClubInvitationRecord
  error_code?: string
  emailDelivery?: EmailDispatchResult
}> {
  const {
    clubId,
    email,
    role,
    inviterId,
    clubName = 'Campus Club',
    inviterName = 'Organizer',
  } = params

  if (!clubId || !inviterId) {
    return {
      success: false,
      message: 'Organization and authenticated inviter context are required.',
      error_code: 'INVALID_CONTEXT',
    }
  }

  if (!email || !email.includes('@')) {
    return {
      success: false,
      message: 'Please provide a valid recipient email address.',
      error_code: 'INVALID_EMAIL',
    }
  }

  const cleanEmail = email.trim().toLowerCase()

  // Resolve authoritative role without defaulting to 'owner'
  let resolvedInviterRole: ClubRole | null = null
  if (isSupabaseConfigured) {
    resolvedInviterRole = (await getUserClubRole(clubId, inviterId)) ?? params.inviterRole ?? null
  } else {
    const memberRow = getLocalMembers().find(
      (m) => m.club_id === clubId && m.user_id === inviterId
    )
    if (memberRow) {
      resolvedInviterRole = memberRow.status === 'active' ? memberRow.role : null
    } else if (params.inviterRole !== undefined) {
      resolvedInviterRole = params.inviterRole
    } else {
      resolvedInviterRole = await getUserClubRole(clubId, inviterId)
    }
  }

  if (!resolvedInviterRole || !hasPermission(resolvedInviterRole, 'members.invite')) {
    return {
      success: false,
      message: `Unauthorized: Your current role${resolvedInviterRole ? ` (${ROLE_LABELS[resolvedInviterRole]})` : ''} cannot invite organization members.`,
      error_code: 'INSUFFICIENT_PERMISSIONS',
    }
  }

  if (!canAssignRole(resolvedInviterRole, role)) {
    return {
      success: false,
      message: `Unauthorized: ${ROLE_LABELS[resolvedInviterRole]} cannot assign the role of ${ROLE_LABELS[role] || role}.`,
      error_code: 'ROLE_ESCALATION_DENIED',
    }
  }

  let savedInvitation: ClubInvitationRecord

  if (isSupabaseConfigured) {
    try {
      const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)(
        'invite_club_member',
        {
          p_club_id: clubId,
          p_email: cleanEmail,
          p_role: role,
        }
      )

      if (rpcErr) {
        return {
          success: false,
          message: `Failed to create invitation: ${rpcErr.message}`,
          error_code: 'RPC_FAILED',
        }
      }

      if (!rpcData?.success || !rpcData?.invitation) {
        return {
          success: false,
          message: rpcData?.message || 'Unable to send club invitation.',
          error_code: rpcData?.error_code || 'INVITE_REJECTED',
        }
      }

      savedInvitation = rpcData.invitation as ClubInvitationRecord
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Database error creating invitation.',
        error_code: 'RPC_EXCEPTION',
      }
    }
  } else {
    const membersRes = await getClubMembers(clubId)
    const isAlreadyMember = membersRes.members.some(
      (m) => m.profile?.email?.toLowerCase() === cleanEmail
    )
    if (isAlreadyMember) {
      return {
        success: false,
        message: `The user (${cleanEmail}) is already an active member of this organization.`,
        error_code: 'DUPLICATE_MEMBERSHIP',
      }
    }

    const invitesRes = await getClubInvitations(clubId)
    const existingPending = invitesRes.invitations.find(
      (inv) => inv.email.toLowerCase() === cleanEmail && inv.status === 'pending'
    )
    if (existingPending) {
      return {
        success: false,
        message: `An active invitation has already been sent to ${cleanEmail}. You can resend or revoke it from the invitations list.`,
        error_code: 'PENDING_INVITATION_EXISTS',
      }
    }

    const token = generateSecureToken()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    savedInvitation = {
      id: `cinv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      club_id: clubId,
      email: cleanEmail,
      role,
      invited_by: inviterId,
      token,
      status: 'pending',
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const localInvites = getLocalInvitations()
    localInvites.unshift(savedInvitation)
    saveLocalInvitations(localInvites)

    appendLocalAuditLog({
      id: `caudit_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      club_id: clubId,
      actor_id: inviterId,
      action: 'member_invited',
      target_email: cleanEmail,
      new_value: role,
      details: { role, invited_email: cleanEmail, expires_at: expiresAt },
      created_at: new Date().toISOString(),
    })
  }

  const origin = getFrontendBaseUrl()
  const invitationUrl = `${origin}/club/invitations/${savedInvitation.token}`

  const emailRes = await sendClubMemberInvitationEmail({
    to: cleanEmail,
    clubName,
    inviterName,
    role: ROLE_LABELS[role],
    invitationUrl,
    expiresAt: savedInvitation.expires_at,
    clubId,
    invitationToken: savedInvitation.token,
  })

  broadcastStatusChange({
    type: 'team_updated',
    clubId,
  })

  const emailAccepted = emailRes.success
  let feedbackMessage = `Invitation successfully sent to ${cleanEmail} for the role of ${ROLE_LABELS[role]}.`

  if (!emailAccepted) {
    if (emailRes.failureCategory === 'EDGE_FUNCTION_UNREACHABLE') {
      feedbackMessage = `Invitation created and active! However, automated email could not be sent because the send-email Edge Function is unreachable (not deployed to Supabase). You can copy the invitation link directly from the list below.`
    } else if (emailRes.failureCategory === 'PROVIDER_UNCONFIGURED') {
      feedbackMessage = `Invitation created and active! However, automated email delivery is not configured (missing RESEND_API_KEY). You can copy the invitation link directly from the list below.`
    } else if (emailRes.failureCategory === 'GATEWAY_AUTH_REJECTED') {
      feedbackMessage = `Invitation created and active! However, email gateway authentication failed. You can copy the invitation link directly from the list below.`
    } else {
      feedbackMessage = `Invitation created and active! However, email dispatch failed (${emailRes.message || 'delivery issue'}). You can copy and share the invitation link directly.`
    }
  }

  return {
    success: true,
    message: feedbackMessage,
    invitation: savedInvitation,
    emailDelivery: emailRes,
  }
}

// ── Accept Club Invitation ──────────────────────────────────────────────────

export async function acceptClubInvitation(
  token: string,
  user: { id: string; email: string; display_name?: string }
): Promise<{
  success: boolean
  message: string
  clubId?: string
  role?: ClubRole
  error_code?: string
}> {
  if (!token) {
    return {
      success: false,
      message: 'Invalid or missing invitation token.',
      error_code: 'INVALID_TOKEN',
    }
  }
  if (!user || !user.email) {
    return {
      success: false,
      message: 'Authentication required. Please sign in to accept this invitation.',
      error_code: 'UNAUTHENTICATED',
    }
  }

  const cleanToken = decodeURIComponent(token).trim()
  const cleanUserEmail = user.email.trim().toLowerCase()

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('accept_club_invitation', {
        p_token: cleanToken,
        p_user_id: user.id,
      })

      if (error) {
        return {
          success: false,
          message: error.message || 'Failed to accept invitation.',
          error_code: 'RPC_FAILED',
        }
      }

      if (!data?.success) {
        return {
          success: false,
          message: data?.message || 'Failed to accept invitation.',
          error_code: data?.error_code || 'RPC_REJECTED',
        }
      }

      const clubId = data.club_id as string
      const acceptedRole = data.role as ClubRole

      broadcastStatusChange({
        type: 'team_updated',
        clubId,
      })

      try {
        const [{ data: inviterProfile }, { data: clubProfile }] = await Promise.all([
          data.invited_by
            ? (supabase.from('profiles') as any)
                .select('email, display_name')
                .eq('id', data.invited_by)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          (supabase.from('club_profiles') as any)
            .select('club_name')
            .eq('profile_id', clubId)
            .maybeSingle(),
        ])

        const inviterEmail = inviterProfile?.email || ''
        const resolvedClubName = clubProfile?.club_name || 'Campus Club'
        if (inviterEmail) {
          sendClubInvitationAcceptedEmail({
            to: inviterEmail,
            clubName: resolvedClubName,
            memberName: user.display_name || cleanUserEmail.split('@')[0],
            memberEmail: cleanUserEmail,
            role: ROLE_LABELS[acceptedRole] || acceptedRole,
            clubId,
          }).catch(() => {})
        }
      } catch {
        // non-blocking notification failure
      }

      return {
        success: true,
        message: data.message || 'Successfully joined organization team.',
        clubId,
        role: acceptedRole,
      }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Unable to accept invitation.',
        error_code: 'RPC_EXCEPTION',
      }
    }
  }

  // Simulation mode fallback
  const invitation = getLocalInvitations().find((i) => i.token === cleanToken) || null
  if (!invitation) {
    return {
      success: false,
      message: 'Invitation not found or invalid link.',
      error_code: 'INVITATION_NOT_FOUND',
    }
  }

  if (invitation.status === 'revoked') {
    return {
      success: false,
      message: 'This invitation has been revoked by the club organizer.',
      error_code: 'INVITATION_REVOKED',
    }
  }
  if (invitation.status === 'accepted') {
    return {
      success: false,
      message: 'This invitation has already been accepted.',
      error_code: 'ALREADY_ACCEPTED',
    }
  }
  if (new Date(invitation.expires_at) < new Date() || invitation.status === 'expired') {
    return {
      success: false,
      message:
        'This invitation has expired. Please ask the organizer to send a new invite.',
      error_code: 'INVITATION_EXPIRED',
    }
  }
  if (invitation.email.trim().toLowerCase() !== cleanUserEmail) {
    return {
      success: false,
      message: `This invitation was issued to ${invitation.email}. You are currently signed in as ${user.email}. Please switch to the invited account.`,
      error_code: 'EMAIL_MISMATCH',
    }
  }

  const currentRole = await getUserClubRole(invitation.club_id, user.id)
  if (currentRole) {
    return {
      success: false,
      message: `You are already an active member (${ROLE_LABELS[currentRole]}) of this organization.`,
      error_code: 'DUPLICATE_MEMBERSHIP',
    }
  }

  const newMember: ClubMemberRecord = {
    id: `cmbr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    club_id: invitation.club_id,
    user_id: user.id,
    role: invitation.role,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    profile: {
      id: user.id,
      email: cleanUserEmail,
      display_name: user.display_name || cleanUserEmail.split('@')[0],
      role: 'club_member',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  }

  const localMembers = getLocalMembers()
  localMembers.push(newMember)
  saveLocalMembers(localMembers)

  const localInvites = getLocalInvitations().map((inv) =>
    inv.id === invitation.id
      ? {
          ...inv,
          status: 'accepted' as const,
          accepted_at: new Date().toISOString(),
          accepted_by: user.id,
        }
      : inv
  )
  saveLocalInvitations(localInvites)

  appendLocalAuditLog({
    id: `caudit_${Date.now()}`,
    club_id: invitation.club_id,
    actor_id: user.id,
    action: 'invitation_accepted',
    target_id: user.id,
    target_email: user.email,
    new_value: invitation.role,
    details: { accepted_at: new Date().toISOString() },
    created_at: new Date().toISOString(),
  })

  broadcastStatusChange({
    type: 'team_updated',
    clubId: invitation.club_id,
  })

  return {
    success: true,
    message: `Welcome to the team! You have successfully joined as ${ROLE_LABELS[invitation.role]}.`,
    clubId: invitation.club_id,
    role: invitation.role,
  }
}

// ── Revoke Club Invitation ──────────────────────────────────────────────────

export async function revokeClubInvitation(
  invitationId: string,
  actorId: string,
  clubId: string
): Promise<{ success: boolean; message: string }> {
  if (!invitationId || !actorId || !clubId) {
    return { success: false, message: 'Invalid invitation context.' }
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('revoke_club_invitation', {
        p_invitation_id: invitationId,
        p_club_id: clubId,
      })

      if (error) {
        return { success: false, message: error.message }
      }
      if (!data?.success) {
        return {
          success: false,
          message: data?.message || 'Unable to revoke invitation.',
        }
      }

      broadcastStatusChange({
        type: 'team_updated',
        clubId,
      })
      return { success: true, message: data.message || 'Invitation has been revoked.' }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to revoke invitation.',
      }
    }
  }

  const actorRole = await getUserClubRole(clubId, actorId)
  if (!hasPermission(actorRole, 'members.invite')) {
    return {
      success: false,
      message: 'Unauthorized: Permission to invite/manage invitations is required.',
    }
  }

  const localInvites = getLocalInvitations().map((inv) =>
    inv.id === invitationId && inv.club_id === clubId
      ? { ...inv, status: 'revoked' as const }
      : inv
  )
  saveLocalInvitations(localInvites)

  appendLocalAuditLog({
    id: `caudit_${Date.now()}`,
    club_id: clubId,
    actor_id: actorId,
    action: 'invitation_revoked',
    target_id: invitationId,
    details: { revoked_at: new Date().toISOString() },
    created_at: new Date().toISOString(),
  })

  broadcastStatusChange({
    type: 'team_updated',
    clubId,
  })

  return { success: true, message: 'Invitation has been revoked.' }
}

// ── Resend Club Invitation ──────────────────────────────────────────────────

export async function resendClubInvitation(
  invitationId: string,
  actorId: string,
  clubId: string,
  clubName = 'Campus Club'
): Promise<{
  success: boolean
  message: string
  invitation?: ClubInvitationRecord
  emailDelivery?: EmailDispatchResult
}> {
  if (!invitationId || !actorId || !clubId) {
    return { success: false, message: 'Invalid invitation context.' }
  }

  let updatedInvitation: ClubInvitationRecord

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('resend_club_invitation', {
        p_invitation_id: invitationId,
        p_club_id: clubId,
      })

      if (error) {
        return { success: false, message: error.message }
      }
      if (!data?.success || !data?.invitation) {
        return {
          success: false,
          message: data?.message || 'Unable to renew invitation.',
        }
      }
      updatedInvitation = data.invitation as ClubInvitationRecord
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to renew invitation.',
      }
    }
  } else {
    const actorRole = await getUserClubRole(clubId, actorId)
    if (!hasPermission(actorRole, 'members.invite')) {
      return {
        success: false,
        message: 'Unauthorized: Permission to manage invitations is required.',
      }
    }

    const invitesRes = await getClubInvitations(clubId)
    const existing = invitesRes.invitations.find((i) => i.id === invitationId)
    if (!existing) {
      return { success: false, message: 'Invitation record not found.' }
    }
    if (!canAssignRole(actorRole, existing.role)) {
      return {
        success: false,
        message: `Unauthorized: Your role cannot reissue invitations for ${ROLE_LABELS[existing.role]}.`,
      }
    }

    const newToken = generateSecureToken()
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    updatedInvitation = {
      ...existing,
      token: newToken,
      status: 'pending',
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    }

    const localInvites = getLocalInvitations().map((inv) =>
      inv.id === invitationId ? updatedInvitation : inv
    )
    saveLocalInvitations(localInvites)

    appendLocalAuditLog({
      id: `caudit_${Date.now()}`,
      club_id: clubId,
      actor_id: actorId,
      action: 'invitation_resent',
      target_id: invitationId,
      target_email: existing.email,
      details: { new_expires_at: newExpiresAt },
      created_at: new Date().toISOString(),
    })
  }

  const origin = getFrontendBaseUrl()
  const invitationUrl = `${origin}/club/invitations/${updatedInvitation.token}`

  const emailRes = await sendClubMemberInvitationEmail({
    to: updatedInvitation.email,
    clubName,
    inviterName: 'Club Administrator',
    role: ROLE_LABELS[updatedInvitation.role],
    invitationUrl,
    expiresAt: updatedInvitation.expires_at,
    clubId,
    isResend: true,
    invitationToken: updatedInvitation.token,
  })

  broadcastStatusChange({
    type: 'team_updated',
    clubId,
  })

  let feedbackMessage = `Invitation renewed and sent to ${updatedInvitation.email}.`
  if (!emailRes.success) {
    if (emailRes.failureCategory === 'EDGE_FUNCTION_UNREACHABLE') {
      feedbackMessage = `Invitation renewed and active! However, automated email could not be sent because the send-email Edge Function is unreachable (not deployed to Supabase). Share the link directly.`
    } else if (emailRes.failureCategory === 'PROVIDER_UNCONFIGURED') {
      feedbackMessage = `Invitation renewed and active! However, automated email delivery is not configured (missing RESEND_API_KEY). Share the link directly.`
    } else {
      feedbackMessage = `Invitation renewed, but email dispatch failed (${emailRes.message || 'delivery issue'}). Share the link directly.`
    }
  }

  return {
    success: true,
    message: feedbackMessage,
    invitation: updatedInvitation,
    emailDelivery: emailRes,
  }
}

// ── Update Member Role ──────────────────────────────────────────────────────

export async function updateClubMemberRole(
  memberId: string,
  newRole: ClubRole,
  actorId: string,
  clubId: string
): Promise<{ success: boolean; message: string }> {
  const membersRes = await getClubMembers(clubId)
  if (membersRes.error) {
    return { success: false, message: membersRes.error }
  }
  const targetMember = membersRes.members.find((m) => m.id === memberId)
  if (!targetMember) {
    return { success: false, message: 'Member record not found.' }
  }

  const actorRole = await getUserClubRole(clubId, actorId)
  if (!actorRole || !hasPermission(actorRole, 'members.manage')) {
    return {
      success: false,
      message: 'Unauthorized: You do not have permission to manage team roles.',
    }
  }

  if (targetMember.user_id === actorId) {
    return {
      success: false,
      message: 'You cannot modify your own organization role directly.',
    }
  }

  if (targetMember.role === 'owner' && newRole !== 'owner') {
    const activeOwners = membersRes.members.filter(
      (m) => m.role === 'owner' && m.status === 'active'
    )
    if (activeOwners.length <= 1) {
      return {
        success: false,
        message:
          'Cannot demote the sole club owner. Transfer primary ownership first.',
      }
    }
  }

  if (!canAssignRole(actorRole, newRole)) {
    return {
      success: false,
      message: `Unauthorized: ${ROLE_LABELS[actorRole]} cannot assign the role of ${ROLE_LABELS[newRole] || newRole}.`,
    }
  }

  if (!canManageMember(actorRole, actorId, targetMember, newRole)) {
    return {
      success: false,
      message: `Unauthorized: ${ROLE_LABELS[actorRole]} cannot modify a member holding the ${ROLE_LABELS[targetMember.role]} role.`,
    }
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('update_club_member_role', {
        p_member_id: memberId,
        p_club_id: clubId,
        p_new_role: newRole,
      })

      if (error) {
        return { success: false, message: error.message }
      }
      if (!data?.success) {
        return {
          success: false,
          message: data?.message || 'Unable to update member role.',
        }
      }

      broadcastStatusChange({
        type: 'team_updated',
        clubId,
      })

      return {
        success: true,
        message: data.message || `Member role updated to ${ROLE_LABELS[newRole]}.`,
      }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to update member role.',
      }
    }
  }

  const localMembers = getLocalMembers().map((m) =>
    m.id === memberId && m.club_id === clubId
      ? { ...m, role: newRole, updated_at: new Date().toISOString() }
      : m
  )
  saveLocalMembers(localMembers)

  appendLocalAuditLog({
    id: `caudit_${Date.now()}`,
    club_id: clubId,
    actor_id: actorId,
    action: 'role_updated',
    target_id: targetMember.user_id,
    old_value: targetMember.role,
    new_value: newRole,
    created_at: new Date().toISOString(),
  })

  broadcastStatusChange({
    type: 'team_updated',
    clubId,
  })

  return { success: true, message: `Member role updated to ${ROLE_LABELS[newRole]}.` }
}

// ── Remove Club Member ──────────────────────────────────────────────────────

export async function removeClubMember(
  memberId: string,
  actorId: string,
  clubId: string
): Promise<{ success: boolean; message: string; error_code?: string }> {
  const membersRes = await getClubMembers(clubId)
  if (membersRes.error) {
    return { success: false, message: membersRes.error }
  }
  const targetMember = membersRes.members.find((m) => m.id === memberId)
  if (!targetMember) {
    return { success: false, message: 'Member record not found.' }
  }

  const actorRole = await getUserClubRole(clubId, actorId)
  if (!actorRole || !hasPermission(actorRole, 'members.manage')) {
    return {
      success: false,
      message: 'Unauthorized: Permission to manage members is required.',
      error_code: 'INSUFFICIENT_PERMISSIONS',
    }
  }

  if (targetMember.role === 'owner') {
    const activeOwners = membersRes.members.filter(
      (m) => m.role === 'owner' && m.status === 'active'
    )
    if (activeOwners.length <= 1) {
      return {
        success: false,
        message:
          'Cannot remove the sole club owner. You must transfer primary ownership first.',
        error_code: 'CANNOT_REMOVE_SOLE_OWNER',
      }
    }
  }

  if (targetMember.user_id === actorId) {
    return {
      success: false,
      message: 'You cannot remove your own membership from the roster.',
      error_code: 'CANNOT_REMOVE_SELF',
    }
  }

  if (!canManageMember(actorRole, actorId, targetMember)) {
    return {
      success: false,
      message: 'Administrators cannot remove other administrators or club owners.',
      error_code: 'INSUFFICIENT_PERMISSIONS',
    }
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('remove_club_member', {
        p_member_id: memberId,
        p_actor_id: actorId,
        p_club_id: clubId,
      })

      if (error) {
        return { success: false, message: error.message, error_code: 'RPC_FAILED' }
      }
      if (!data?.success) {
        return {
          success: false,
          message: data?.message || 'Unable to remove team member.',
          error_code: data?.error_code || 'REMOVE_REJECTED',
        }
      }

      broadcastStatusChange({
        type: 'team_updated',
        clubId,
      })
      return {
        success: true,
        message: data.message || 'Member access has been revoked and removed.',
      }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to remove member.',
        error_code: 'RPC_EXCEPTION',
      }
    }
  }

  const localMembers = getLocalMembers().filter(
    (m) => !(m.id === memberId && m.club_id === clubId)
  )
  saveLocalMembers(localMembers)
  removeLocalAssignmentsForUser(clubId, targetMember.user_id)

  appendLocalAuditLog({
    id: `caudit_${Date.now()}`,
    club_id: clubId,
    actor_id: actorId,
    action: 'member_removed',
    target_id: targetMember.user_id,
    old_value: targetMember.role,
    details: { removed_user_id: targetMember.user_id },
    created_at: new Date().toISOString(),
  })

  broadcastStatusChange({
    type: 'team_updated',
    clubId,
  })

  return { success: true, message: 'Member access has been revoked and removed.' }
}

// ── Transfer Club Ownership ─────────────────────────────────────────────────

export async function transferClubOwnership(
  clubId: string,
  newOwnerUserId: string,
  currentOwnerId: string
): Promise<{ success: boolean; message: string }> {
  if (!clubId || !newOwnerUserId || !currentOwnerId) {
    return { success: false, message: 'Invalid ownership transfer parameters.' }
  }
  if (newOwnerUserId === currentOwnerId) {
    return {
      success: false,
      message: 'Selected member is already the current club owner.',
    }
  }

  const currentRole = await getUserClubRole(clubId, currentOwnerId)
  if (!canTransferOwnership(currentRole)) {
    return {
      success: false,
      message: 'Only the current club owner can transfer primary ownership.',
    }
  }

  const membersRes = await getClubMembers(clubId)
  if (membersRes.error) {
    return { success: false, message: membersRes.error }
  }
  const target = membersRes.members.find(
    (m) => m.user_id === newOwnerUserId && m.status === 'active'
  )
  if (!target) {
    return {
      success: false,
      message:
        'The designated new owner must be an active member of this organization.',
    }
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('transfer_club_ownership', {
        p_club_id: clubId,
        p_new_owner_id: newOwnerUserId,
      })

      if (error) {
        return { success: false, message: error.message }
      }
      if (!data?.success) {
        return {
          success: false,
          message: data?.message || 'Unable to transfer club ownership.',
        }
      }

      broadcastStatusChange({
        type: 'team_updated',
        clubId,
      })

      return {
        success: true,
        message:
          data.message || 'Club ownership has been successfully transferred.',
      }
    } catch (err) {
      return {
        success: false,
        message:
          err instanceof Error ? err.message : 'Failed to transfer ownership.',
      }
    }
  }

  const now = new Date().toISOString()
  let updatedOldOwner = false
  const localMembers = getLocalMembers().map((m) => {
    if (m.club_id === clubId) {
      if (m.user_id === newOwnerUserId) {
        return { ...m, role: 'owner' as const, updated_at: now }
      }
      if (m.user_id === currentOwnerId) {
        updatedOldOwner = true
        return { ...m, role: 'admin' as const, updated_at: now }
      }
    }
    return m
  })
  if (!updatedOldOwner) {
    localMembers.push({
      id: `cmbr_${Date.now()}_prev_owner`,
      club_id: clubId,
      user_id: currentOwnerId,
      role: 'admin',
      status: 'active',
      created_at: now,
      updated_at: now,
    })
  }
  saveLocalMembers(localMembers)

  appendLocalAuditLog({
    id: `caudit_${Date.now()}`,
    club_id: clubId,
    actor_id: currentOwnerId,
    action: 'ownership_transferred',
    target_id: newOwnerUserId,
    details: { transferred_from: currentOwnerId, transferred_to: newOwnerUserId },
    created_at: now,
  })

  broadcastStatusChange({
    type: 'team_updated',
    clubId,
  })

  return {
    success: true,
    message: 'Club ownership has been successfully transferred.',
  }
}

// ── Query Invitation by Token ───────────────────────────────────────────────

export async function getInvitationByToken(
  token: string
): Promise<{ invitation: ClubInvitationRecord | null; error?: string }> {
  if (!token) return { invitation: null }
  const cleanToken = decodeURIComponent(token).trim()

  if (isSupabaseConfigured) {
    try {
      const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)(
        'get_club_invitation_preview',
        { p_token: cleanToken }
      )

      if (rpcErr) {
        return { invitation: null, error: rpcErr.message }
      }
      if (rpcData?.success && rpcData?.invitation) {
        return { invitation: rpcData.invitation as ClubInvitationRecord }
      }
      return {
        invitation: null,
        error: rpcData?.message || 'Invitation not found or inaccessible.',
      }
    } catch (err) {
      return {
        invitation: null,
        error:
          err instanceof Error ? err.message : 'Unable to verify invitation token.',
      }
    }
  }

  const localInvites = getLocalInvitations()
  const found = localInvites.find((i) => i.token === cleanToken)
  return { invitation: found || null }
}
