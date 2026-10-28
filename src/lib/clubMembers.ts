import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type {
  ClubRole,
  ClubPermission,
  ClubMemberRecord,
  ClubInvitationRecord,
  ClubAuditLogRecord,
} from '@/types'
import { sendClubMemberInvitationEmail } from '@/lib/emails'
import { broadcastStatusChange } from '@/lib/sync'

const LOCAL_STORAGE_MEMBERS_KEY = 'festflow_local_club_members'
const LOCAL_STORAGE_INVITATIONS_KEY = 'festflow_local_club_invitations'
const LOCAL_STORAGE_AUDIT_LOGS_KEY = 'festflow_local_club_audit_logs'

// ── Least-Privilege Role Permission Matrix ──────────────────────────────────
export const ROLE_PERMISSIONS: Record<ClubRole, ClubPermission[]> = {
  owner: [
    'manage_club',
    'manage_members',
    'manage_events',
    'view_attendees',
    'gate_checkin',
    'review_payments',
    'view_reports',
  ],
  admin: [
    'manage_club',
    'manage_members',
    'manage_events',
    'view_attendees',
    'gate_checkin',
    'review_payments',
    'view_reports',
  ],
  event_manager: [
    'manage_events',
    'view_attendees',
    'view_reports',
  ],
  payment_reviewer: [
    'review_payments',
    'view_reports',
  ],
  checkin_staff: [
    'gate_checkin',
    'view_attendees',
  ],
  viewer: [
    'view_attendees',
    'view_reports',
  ],
}

export const ROLE_LABELS: Record<ClubRole, string> = {
  owner: 'Club Owner',
  admin: 'Administrator',
  event_manager: 'Event Manager',
  payment_reviewer: 'Payment Reviewer',
  checkin_staff: 'Gate Staff (Check-In)',
  viewer: 'Viewer / Reporter',
}

export const ROLE_DESCRIPTIONS: Record<ClubRole, string> = {
  owner: 'Full authority over organization profile, settings, member roster, and all events.',
  admin: 'Manages events, attendees, gate access, payments, and invites staff below Owner tier.',
  event_manager: 'Creates and edits events, monitors registrant rosters, and downloads reports.',
  payment_reviewer: 'Reviews student UPI payment submissions, inspects UTRs, and approves/rejects fees.',
  checkin_staff: 'Gate admission operator: validates tickets, admits attendees, and logs turnstile entry/exit.',
  viewer: 'Read-only access to published event details, attendee numbers, and basic reports.',
}

// Role hierarchy rank for escalation prevention
const ROLE_RANK: Record<ClubRole, number> = {
  owner: 6,
  admin: 5,
  event_manager: 4,
  payment_reviewer: 3,
  checkin_staff: 2,
  viewer: 1,
}

/**
 * Checks if a specific role possesses the requested permission.
 */
export function hasPermission(
  role: ClubRole | null | undefined,
  permission: ClubPermission
): boolean {
  if (!role) return false
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

/**
 * Validates that an inviter cannot grant a role higher than their own hierarchy level.
 */
export function canAssignRole(
  inviterRole: ClubRole | null | undefined,
  targetRole: ClubRole
): boolean {
  if (!inviterRole) return false
  if (inviterRole === 'owner') return true
  // Admin cannot assign 'owner'
  if (inviterRole === 'admin') {
    return targetRole !== 'owner'
  }
  return false
}

// ── Local Storage Simulation Helpers ────────────────────────────────────────

function getLocalMembers(): ClubMemberRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_MEMBERS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
}

function saveLocalMembers(members: ClubMemberRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_MEMBERS_KEY, JSON.stringify(members))
  } catch {
    // ignore
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
  return `inv_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`
}

// ── Query Members ───────────────────────────────────────────────────────────

export async function getClubMembers(
  clubId: string
): Promise<{ members: ClubMemberRecord[]; error?: string }> {
  if (!clubId) return { members: [] }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('club_members') as any)
        .select(`
          *,
          profile:profiles!user_id (*)
        `)
        .eq('club_id', clubId)
        .order('created_at', { ascending: true })

      if (error) {
        // Fallback to local storage if table not yet migrated
        console.warn('[FestFlow ClubMembers] Supabase query fallback to local:', error.message)
      } else if (data) {
        return { members: data as ClubMemberRecord[] }
      }
    } catch {
      // ignore
    }
  }

  // Simulation mode
  const localMembers = getLocalMembers().filter((m) => m.club_id === clubId && m.status === 'active')
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
        .select(`
          *,
          inviter:profiles!invited_by (*)
        `)
        .eq('club_id', clubId)
        .order('created_at', { ascending: false })

      if (error) {
        console.warn('[FestFlow ClubMembers] Supabase query fallback to local:', error.message)
      } else if (data) {
        // Mark expired records on the fly
        const now = new Date()
        const resolved = (data as ClubInvitationRecord[]).map((inv) => {
          if (inv.status === 'pending' && new Date(inv.expires_at) < now) {
            return { ...inv, status: 'expired' as const }
          }
          return inv
        })
        return { invitations: resolved }
      }
    } catch {
      // ignore
    }
  }

  // Simulation mode
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
        .select(`
          *,
          actor:profiles!actor_id (*)
        `)
        .eq('club_id', clubId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.warn('[FestFlow ClubMembers] Supabase audit log query fallback to local:', error.message)
      } else if (data) {
        return { logs: data as ClubAuditLogRecord[] }
      }
    } catch {
      // ignore
    }
  }

  // Simulation mode
  const localLogs = getLocalAuditLogs().filter((l) => l.club_id === clubId)
  return { logs: localLogs }
}

// ── Query User Role in Club ─────────────────────────────────────────────────

export async function getUserClubRole(
  clubId: string,
  userId: string
): Promise<ClubRole | null> {
  if (!clubId || !userId) return null

  // 1. Primary Owner check: clubId matches user's ID
  if (clubId === userId) {
    return 'owner'
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('club_members') as any)
        .select('role')
        .eq('club_id', clubId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle()

      if (!error && data?.role) {
        return data.role as ClubRole
      }
    } catch {
      // ignore
    }
  }

  // Simulation mode
  const member = getLocalMembers().find(
    (m) => m.club_id === clubId && m.user_id === userId && m.status === 'active'
  )
  return member ? member.role : null
}

// ── Send Member Invitation ──────────────────────────────────────────────────

export async function inviteClubMember(params: {
  clubId: string
  email: string
  role: ClubRole
  inviterId: string
  inviterRole?: ClubRole
  clubName?: string
  inviterName?: string
}): Promise<{
  success: boolean
  message: string
  invitation?: ClubInvitationRecord
  error_code?: string
}> {
  const { clubId, email, role, inviterId, inviterRole = 'owner', clubName = 'Campus Club', inviterName = 'Organizer' } = params

  if (!email || !email.includes('@')) {
    return { success: false, message: 'Please provide a valid recipient email address.', error_code: 'INVALID_EMAIL' }
  }

  const cleanEmail = email.trim().toLowerCase()

  // 1. Hierarchy & Escalation Check: Inviter cannot assign role higher than or equal to their rank (unless owner)
  if (!canAssignRole(inviterRole, role)) {
    return {
      success: false,
      message: `Unauthorized: Your role (${ROLE_LABELS[inviterRole]}) cannot assign the role of ${ROLE_LABELS[role]}.`,
      error_code: 'ROLE_ESCALATION_DENIED',
    }
  }

  // 2. Check for duplicate active membership
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

  // 3. Check for existing active pending invitation
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
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days expiration
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
  const invitationUrl = `${origin}/club/invitations/${token}`

  const newInvitation: ClubInvitationRecord = {
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

  // Try Supabase RPC or insert if available
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('club_invitations') as any)
        .insert({
          club_id: clubId,
          email: cleanEmail,
          role,
          invited_by: inviterId,
          token,
          status: 'pending',
          expires_at: expiresAt,
        })
        .select()
        .single()

      if (!error && data) {
        newInvitation.id = data.id
      }
    } catch {
      // ignore
    }
  }

  // Persist local simulation
  const localInvites = getLocalInvitations()
  localInvites.unshift(newInvitation)
  saveLocalInvitations(localInvites)

  // Record Audit Trail
  const auditLog: ClubAuditLogRecord = {
    id: `caudit_${Date.now()}`,
    club_id: clubId,
    actor_id: inviterId,
    action: 'member_invited',
    target_email: cleanEmail,
    new_value: role,
    details: { role, invited_email: cleanEmail, expires_at: expiresAt },
    created_at: new Date().toISOString(),
  }
  const localLogs = getLocalAuditLogs()
  localLogs.unshift(auditLog)
  saveLocalAuditLogs(localLogs)

  // Dispatch Transactional Email
  await sendClubMemberInvitationEmail({
    to: cleanEmail,
    clubName,
    inviterName,
    role: ROLE_LABELS[role],
    invitationUrl,
    expiresAt,
    clubId,
  })

  broadcastStatusChange({
    type: 'team_updated',
    clubId,
  })

  return {
    success: true,
    message: `Invitation successfully sent to ${cleanEmail} for the role of ${ROLE_LABELS[role]}.`,
    invitation: newInvitation,
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
    return { success: false, message: 'Invalid or missing invitation token.', error_code: 'INVALID_TOKEN' }
  }
  if (!user || !user.email) {
    return { success: false, message: 'Authentication required. Please sign in to accept this invitation.', error_code: 'UNAUTHENTICATED' }
  }

  let invitation: ClubInvitationRecord | null = null

  if (isSupabaseConfigured) {
    try {
      const { data } = await (supabase.from('club_invitations') as any)
        .select('*')
        .eq('token', token)
        .maybeSingle()

      if (data) invitation = data as ClubInvitationRecord
    } catch {
      // ignore
    }
  }

  if (!invitation) {
    invitation = getLocalInvitations().find((i) => i.token === token) || null
  }

  if (!invitation) {
    return { success: false, message: 'Invitation not found or invalid link.', error_code: 'INVITATION_NOT_FOUND' }
  }

  // 1. Status checks
  if (invitation.status === 'revoked') {
    return { success: false, message: 'This invitation has been revoked by the club organizer.', error_code: 'INVITATION_REVOKED' }
  }
  if (invitation.status === 'accepted') {
    return { success: false, message: 'This invitation has already been accepted.', error_code: 'ALREADY_ACCEPTED' }
  }

  // 2. Expiration check
  if (new Date(invitation.expires_at) < new Date() || invitation.status === 'expired') {
    return { success: false, message: 'This invitation has expired. Please ask the organizer to send a new invite.', error_code: 'INVITATION_EXPIRED' }
  }

  // 3. Verified Email Matching: Recipient must be authenticated as the invited email
  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    return {
      success: false,
      message: `This invitation was issued to ${invitation.email}. You are currently signed in as ${user.email}. Please switch to the invited account.`,
      error_code: 'EMAIL_MISMATCH',
    }
  }

  // 4. Duplicate Membership Check
  const currentRole = await getUserClubRole(invitation.club_id, user.id)
  if (currentRole) {
    return {
      success: false,
      message: `You are already an active member (${ROLE_LABELS[currentRole]}) of this organization.`,
      error_code: 'DUPLICATE_MEMBERSHIP',
    }
  }

  // 5. Create active membership
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
      email: user.email,
      display_name: user.display_name || user.email.split('@')[0],
      role: 'club_member',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  }

  if (isSupabaseConfigured) {
    try {
      await (supabase.from('club_members') as any).insert({
        club_id: invitation.club_id,
        user_id: user.id,
        role: invitation.role,
        status: 'active',
      })

      await (supabase.from('club_invitations') as any)
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          accepted_by: user.id,
        })
        .eq('id', invitation.id)

      // Ensure user profile role is club_member so protected club routes grant access
      await (supabase.from('profiles') as any)
        .update({ role: 'club_member' })
        .eq('id', user.id)
        .eq('role', 'student')
    } catch {
      // ignore
    }
  }

  // Update local storage simulation
  const localMembers = getLocalMembers()
  localMembers.push(newMember)
  saveLocalMembers(localMembers)

  const localInvites = getLocalInvitations().map((inv) => {
    if (inv.id === invitation!.id) {
      return {
        ...inv,
        status: 'accepted' as const,
        accepted_at: new Date().toISOString(),
        accepted_by: user.id,
      }
    }
    return inv
  })
  saveLocalInvitations(localInvites)

  // Audit Log
  const auditLog: ClubAuditLogRecord = {
    id: `caudit_${Date.now()}`,
    club_id: invitation.club_id,
    actor_id: user.id,
    action: 'invitation_accepted',
    target_id: user.id,
    target_email: user.email,
    new_value: invitation.role,
    details: { accepted_at: new Date().toISOString() },
    created_at: new Date().toISOString(),
  }
  const localLogs = getLocalAuditLogs()
  localLogs.unshift(auditLog)
  saveLocalAuditLogs(localLogs)

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
  if (isSupabaseConfigured) {
    try {
      await (supabase.from('club_invitations') as any)
        .update({ status: 'revoked' })
        .eq('id', invitationId)
        .eq('club_id', clubId)
    } catch {
      // ignore
    }
  }

  const localInvites = getLocalInvitations().map((inv) => {
    if (inv.id === invitationId && inv.club_id === clubId) {
      return { ...inv, status: 'revoked' as const }
    }
    return inv
  })
  saveLocalInvitations(localInvites)

  // Audit log
  const auditLog: ClubAuditLogRecord = {
    id: `caudit_${Date.now()}`,
    club_id: clubId,
    actor_id: actorId,
    action: 'invitation_revoked',
    target_id: invitationId,
    details: { revoked_at: new Date().toISOString() },
    created_at: new Date().toISOString(),
  }
  const localLogs = getLocalAuditLogs()
  localLogs.unshift(auditLog)
  saveLocalAuditLogs(localLogs)

  return { success: true, message: 'Invitation has been revoked.' }
}

// ── Resend Club Invitation ──────────────────────────────────────────────────

export async function resendClubInvitation(
  invitationId: string,
  actorId: string,
  clubId: string,
  clubName = 'Campus Club'
): Promise<{ success: boolean; message: string; invitation?: ClubInvitationRecord }> {
  const invitesRes = await getClubInvitations(clubId)
  const existing = invitesRes.invitations.find((i) => i.id === invitationId)

  if (!existing) {
    return { success: false, message: 'Invitation record not found.' }
  }

  const newToken = generateSecureToken()
  const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
  const invitationUrl = `${origin}/club/invitations/${newToken}`

  const updated: ClubInvitationRecord = {
    ...existing,
    token: newToken,
    status: 'pending',
    expires_at: newExpiresAt,
    updated_at: new Date().toISOString(),
  }

  if (isSupabaseConfigured) {
    try {
      await (supabase.from('club_invitations') as any)
        .update({
          token: newToken,
          status: 'pending',
          expires_at: newExpiresAt,
        })
        .eq('id', invitationId)
    } catch {
      // ignore
    }
  }

  const localInvites = getLocalInvitations().map((inv) => (inv.id === invitationId ? updated : inv))
  saveLocalInvitations(localInvites)

  // Audit log
  const auditLog: ClubAuditLogRecord = {
    id: `caudit_${Date.now()}`,
    club_id: clubId,
    actor_id: actorId,
    action: 'invitation_resent',
    target_id: invitationId,
    target_email: existing.email,
    details: { new_expires_at: newExpiresAt },
    created_at: new Date().toISOString(),
  }
  const localLogs = getLocalAuditLogs()
  localLogs.unshift(auditLog)
  saveLocalAuditLogs(localLogs)

  await sendClubMemberInvitationEmail({
    to: existing.email,
    clubName,
    inviterName: 'Club Administrator',
    role: ROLE_LABELS[existing.role],
    invitationUrl,
    expiresAt: newExpiresAt,
    clubId,
    isResend: true,
  })

  return { success: true, message: `Invitation renewed and sent to ${existing.email}.`, invitation: updated }
}

// ── Update Member Role ──────────────────────────────────────────────────────

export async function updateClubMemberRole(
  memberId: string,
  newRole: ClubRole,
  actorId: string,
  clubId: string
): Promise<{ success: boolean; message: string }> {
  const membersRes = await getClubMembers(clubId)
  const targetMember = membersRes.members.find((m) => m.id === memberId)

  if (!targetMember) {
    return { success: false, message: 'Member record not found.' }
  }

  const actorRole = await getUserClubRole(clubId, actorId)
  if (!actorRole || !hasPermission(actorRole, 'manage_members')) {
    return { success: false, message: 'Unauthorized: You do not have permission to manage team roles.' }
  }

  // Safeguard: Cannot promote above own rank
  if (ROLE_RANK[newRole] > ROLE_RANK[actorRole]) {
    return { success: false, message: `You cannot assign a role higher than your own tier (${ROLE_LABELS[actorRole]}).` }
  }

  // Sole Owner Safeguard: Cannot demote the only remaining owner
  if (targetMember.role === 'owner' && newRole !== 'owner') {
    const activeOwners = membersRes.members.filter((m) => m.role === 'owner' && m.status === 'active')
    if (activeOwners.length <= 1) {
      return {
        success: false,
        message: 'Cannot demote the sole club owner. You must transfer primary ownership first.',
      }
    }
  }

  if (isSupabaseConfigured) {
    try {
      await (supabase.from('club_members') as any)
        .update({ role: newRole })
        .eq('id', memberId)
        .eq('club_id', clubId)
    } catch {
      // ignore
    }
  }

  const localMembers = getLocalMembers().map((m) => {
    if (m.id === memberId && m.club_id === clubId) {
      return { ...m, role: newRole, updated_at: new Date().toISOString() }
    }
    return m
  })
  saveLocalMembers(localMembers)

  // Audit log
  const auditLog: ClubAuditLogRecord = {
    id: `caudit_${Date.now()}`,
    club_id: clubId,
    actor_id: actorId,
    action: 'role_updated',
    target_id: targetMember.user_id,
    old_value: targetMember.role,
    new_value: newRole,
    created_at: new Date().toISOString(),
  }
  const localLogs = getLocalAuditLogs()
  localLogs.unshift(auditLog)
  saveLocalAuditLogs(localLogs)

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
  const targetMember = membersRes.members.find((m) => m.id === memberId)

  if (!targetMember) {
    return { success: false, message: 'Member record not found.' }
  }

  const actorRole = await getUserClubRole(clubId, actorId)
  if (!actorRole || !hasPermission(actorRole, 'manage_members')) {
    return { success: false, message: 'Unauthorized: Permission to manage members is required.' }
  }

  // Sole Owner Safeguard
  if (targetMember.role === 'owner') {
    const activeOwners = membersRes.members.filter((m) => m.role === 'owner' && m.status === 'active')
    if (activeOwners.length <= 1) {
      return {
        success: false,
        message: 'Cannot remove the sole club owner. You must transfer primary ownership first.',
        error_code: 'CANNOT_REMOVE_SOLE_OWNER',
      }
    }
  }

  // Non-owner admin cannot remove another admin or owner
  if (actorRole === 'admin' && (targetMember.role === 'admin' || targetMember.role === 'owner')) {
    return {
      success: false,
      message: 'Administrators cannot remove other administrators or club owners.',
      error_code: 'INSUFFICIENT_PERMISSIONS',
    }
  }

  if (isSupabaseConfigured) {
    try {
      await (supabase.from('club_members') as any)
        .delete()
        .eq('id', memberId)
        .eq('club_id', clubId)
    } catch {
      // ignore
    }
  }

  const localMembers = getLocalMembers().filter((m) => !(m.id === memberId && m.club_id === clubId))
  saveLocalMembers(localMembers)

  // Audit log
  const auditLog: ClubAuditLogRecord = {
    id: `caudit_${Date.now()}`,
    club_id: clubId,
    actor_id: actorId,
    action: 'member_removed',
    target_id: targetMember.user_id,
    old_value: targetMember.role,
    details: { removed_user_id: targetMember.user_id },
    created_at: new Date().toISOString(),
  }
  const localLogs = getLocalAuditLogs()
  localLogs.unshift(auditLog)
  saveLocalAuditLogs(localLogs)

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
  const currentRole = await getUserClubRole(clubId, currentOwnerId)
  if (currentRole !== 'owner') {
    return { success: false, message: 'Only the current club owner can transfer primary ownership.' }
  }

  const membersRes = await getClubMembers(clubId)
  const target = membersRes.members.find((m) => m.user_id === newOwnerUserId && m.status === 'active')
  if (!target) {
    return { success: false, message: 'The designated new owner must be an active member of this organization.' }
  }

  if (isSupabaseConfigured) {
    try {
      await (supabase.from('club_members') as any)
        .update({ role: 'owner' })
        .eq('id', target.id)

      await (supabase.from('club_members') as any)
        .update({ role: 'admin' })
        .eq('club_id', clubId)
        .eq('user_id', currentOwnerId)
    } catch {
      // ignore
    }
  }

  const localMembers = getLocalMembers().map((m) => {
    if (m.club_id === clubId) {
      if (m.user_id === newOwnerUserId) return { ...m, role: 'owner' as const }
      if (m.user_id === currentOwnerId) return { ...m, role: 'admin' as const }
    }
    return m
  })
  saveLocalMembers(localMembers)

  // Audit log
  const auditLog: ClubAuditLogRecord = {
    id: `caudit_${Date.now()}`,
    club_id: clubId,
    actor_id: currentOwnerId,
    action: 'ownership_transferred',
    target_id: newOwnerUserId,
    details: { transferred_from: currentOwnerId, transferred_to: newOwnerUserId },
    created_at: new Date().toISOString(),
  }
  const localLogs = getLocalAuditLogs()
  localLogs.unshift(auditLog)
  saveLocalAuditLogs(localLogs)

  return { success: true, message: 'Club ownership has been successfully transferred.' }
}

// ── Query Invitation by Token ───────────────────────────────────────────────

export async function getInvitationByToken(
  token: string
): Promise<{ invitation: ClubInvitationRecord | null; error?: string }> {
  if (!token) return { invitation: null }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('club_invitations') as any)
        .select(`
          *,
          inviter:profiles!invited_by (*),
          club:club_profiles!club_id (*)
        `)
        .eq('token', token)
        .maybeSingle()

      if (!error && data) {
        return { invitation: data as ClubInvitationRecord }
      }
    } catch {
      // ignore
    }
  }

  // Simulation mode
  const localInvites = getLocalInvitations()
  const found = localInvites.find((i) => i.token === token)
  return { invitation: found || null }
}
