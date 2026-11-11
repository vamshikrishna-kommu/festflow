import { useState, useEffect, useMemo } from 'react'
import { motion } from 'motion/react'
import {
  Users,
  UserPlus,
  ShieldCheck,
  Mail,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  History,
  Crown,
} from 'lucide-react'
import { Button, Badge, Card, PageHeader, Modal, ModalBody, ModalFooter, EmptyState, Alert } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/context/AuthContext'
import { getFrontendBaseUrl } from '@/lib/canonicalUrl'
import {
  ASSIGNABLE_CLUB_ROLES,
  canAssignRole,
  canManageMember,
  canTransferOwnership,
  getAssignableRoles,
} from '@/lib/rbac'
import {
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  getClubMembers,
  getClubInvitations,
  getClubAuditLogs,
  getUserClubRole,
  inviteClubMember,
  revokeClubInvitation,
  resendClubInvitation,
  updateClubMemberRole,
  removeClubMember,
  transferClubOwnership,
} from '@/lib/clubMembers'
import { formatExcelDateTime } from '@/lib/excelExport'
import { ResourceOwnerGuard } from '@/components/auth/ResourceOwnerGuard'
import { staggerContainer } from '@/lib/animations'
import type {
  ClubRole,
  ClubMemberRecord,
  ClubInvitationRecord,
  ClubAuditLogRecord,
} from '@/types'

export default function ClubMembersPage() {
  const {
    user,
    profile,
    activeClubId,
    activeClubRole,
    activeClubProfile,
    isRoleLoading,
    hasClubPermission,
    refreshMemberships,
    role: globalRole,
  } = useAuth()
  const clubId = activeClubId || ''
  const clubName = activeClubProfile?.club_name || profile?.display_name || 'Organization'

  const [members, setMembers] = useState<ClubMemberRecord[]>([])
  const [invitations, setInvitations] = useState<ClubInvitationRecord[]>([])
  const [auditLogs, setAuditLogs] = useState<ClubAuditLogRecord[]>([])
  const [userRole, setUserRole] = useState<ClubRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Tab State
  const [activeTab, setActiveTab] = useState<'members' | 'invitations' | 'audit'>('members')

  // Invite Modal State
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<ClubRole>('event_manager')
  const [inviting, setInviting] = useState(false)

  // Remove Modal State
  const [removingMember, setRemovingMember] = useState<ClubMemberRecord | null>(null)
  const [removing, setRemoving] = useState(false)

  // Role Edit State
  const [editingMember, setEditingMember] = useState<ClubMemberRecord | null>(null)
  const [selectedNewRole, setSelectedNewRole] = useState<ClubRole>('event_manager')
  const [updatingRole, setUpdatingRole] = useState(false)

  // Transfer Ownership State
  const [transferTarget, setTransferTarget] = useState<ClubMemberRecord | null>(null)
  const [transferring, setTransferring] = useState(false)

  // Clipboard Notification
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [notice, setNotice] = useState<{
    message: string
    isError?: boolean
    variant?: 'info' | 'success' | 'warning' | 'error' | 'neutral'
  } | null>(null)

  const effectiveUserRole: ClubRole | null =
    userRole ?? activeClubRole ?? (globalRole === 'platform_admin' ? 'owner' : null)

  const canViewMembers = useMemo(
    () => globalRole === 'platform_admin' || hasClubPermission('members.view'),
    [globalRole, hasClubPermission]
  )

  const canInviteMembers = useMemo(
    () => globalRole === 'platform_admin' || hasClubPermission('members.invite'),
    [globalRole, hasClubPermission]
  )

  const canManageMembers = useMemo(
    () => globalRole === 'platform_admin' || hasClubPermission('members.manage'),
    [globalRole, hasClubPermission]
  )

  const canAssignRoles = useMemo(
    () => globalRole === 'platform_admin' || hasClubPermission('roles.assign'),
    [globalRole, hasClubPermission]
  )

  const canTransfer = useMemo(
    () => canTransferOwnership(userRole ?? activeClubRole),
    [userRole, activeClubRole]
  )

  const assignableRoles = useMemo(
    () =>
      globalRole === 'platform_admin'
        ? ASSIGNABLE_CLUB_ROLES
        : getAssignableRoles(effectiveUserRole),
    [globalRole, effectiveUserRole]
  )

  const loadData = async (silent = false) => {
    if (isRoleLoading) return
    if (!clubId || !user || !canViewMembers) {
      setUserRole(activeClubRole)
      setMembers([])
      setInvitations([])
      setAuditLogs([])
      setLoading(false)
      setRefreshing(false)
      return
    }
    if (!silent) setLoading(true)
    else setRefreshing(true)

    const roleRes = await getUserClubRole(clubId, user.id)
    const resolvedRole = roleRes || activeClubRole || (globalRole === 'platform_admin' ? 'owner' : null)
    setUserRole(resolvedRole)

    if (!resolvedRole && globalRole !== 'platform_admin') {
      setMembers([])
      setInvitations([])
      setAuditLogs([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    const [membersRes, invitesRes, logsRes] = await Promise.all([
      getClubMembers(clubId),
      canInviteMembers ? getClubInvitations(clubId) : Promise.resolve({ invitations: [] }),
      getClubAuditLogs(clubId),
    ])

    if (!silent) setLoading(false)
    else setRefreshing(false)

    setMembers(membersRes.members)
    setInvitations(invitesRes.invitations)
    setAuditLogs(logsRes.logs)
  }

  useEffect(() => {
    if (isRoleLoading) return
    loadData()
  }, [clubId, user?.id, isRoleLoading, canViewMembers, canInviteMembers, activeClubRole, globalRole])

  useEffect(() => {
    if (!canInviteMembers && activeTab === 'invitations') {
      setActiveTab('members')
    }
  }, [canInviteMembers, activeTab])

  // Handle Send Invite
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !clubId || !canInviteMembers || !effectiveUserRole) return
    if (globalRole !== 'platform_admin' && !canAssignRole(effectiveUserRole, inviteRole)) {
      setNotice({
        message: 'You are not authorized to invite a member with the selected role.',
        isError: true,
        variant: 'error',
      })
      return
    }
    setInviting(true)
    setNotice(null)

    const res = await inviteClubMember({
      clubId,
      email: inviteEmail.trim(),
      role: inviteRole,
      inviterId: user.id,
      inviterRole: effectiveUserRole,
      clubName,
      inviterName: profile?.display_name || 'Administrator',
    })

    setInviting(false)
    if (res.success) {
      const emailFailed = res.emailDelivery && !res.emailDelivery.success
      setNotice({
        message: res.message,
        isError: false,
        variant: emailFailed ? 'warning' : 'success',
      })
      setInviteEmail('')
      setInviteModalOpen(false)
      loadData(true)
    } else {
      setNotice({ message: res.message, isError: true, variant: 'error' })
    }
  }

  // Handle Remove Member
  const handleRemoveMember = async () => {
    if (!removingMember || !user || !clubId || !canManageMembers) return
    if (
      globalRole !== 'platform_admin' &&
      !canManageMember(effectiveUserRole, user.id, removingMember)
    ) {
      setNotice({
        message: 'You cannot remove a member with an equal or higher role.',
        isError: true,
        variant: 'error',
      })
      setRemovingMember(null)
      return
    }
    setRemoving(true)
    const res = await removeClubMember(removingMember.id, user.id, clubId)
    setRemoving(false)
    setRemovingMember(null)

    if (res.success) {
      setNotice({ message: res.message, isError: false })
      await refreshMemberships()
      await loadData(true)
    } else {
      setNotice({ message: res.message, isError: true })
    }
  }

  // Handle Update Role
  const handleUpdateRole = async () => {
    if (!editingMember || !user || !clubId || !canAssignRoles) return
    if (
      globalRole !== 'platform_admin' &&
      !canManageMember(effectiveUserRole, user.id, editingMember, selectedNewRole)
    ) {
      setNotice({
        message: 'You are not authorized to perform this role assignment.',
        isError: true,
        variant: 'error',
      })
      setEditingMember(null)
      return
    }
    setUpdatingRole(true)
    const res = await updateClubMemberRole(editingMember.id, selectedNewRole, user.id, clubId)
    setUpdatingRole(false)
    setEditingMember(null)

    if (res.success) {
      setNotice({ message: res.message, isError: false })
      await refreshMemberships()
      await loadData(true)
    } else {
      setNotice({ message: res.message, isError: true })
    }
  }

  // Handle Ownership Transfer
  const handleTransferOwnership = async () => {
    if (
      !transferTarget ||
      !user ||
      !clubId ||
      !canTransfer ||
      transferTarget.status !== 'active' ||
      transferTarget.user_id === user.id
    ) {
      return
    }
    setTransferring(true)
    const res = await transferClubOwnership(clubId, transferTarget.user_id, user.id)
    setTransferring(false)
    setTransferTarget(null)

    if (res.success) {
      setNotice({ message: res.message, isError: false, variant: 'success' })
      await refreshMemberships()
      await loadData(true)
    } else {
      setNotice({ message: res.message, isError: true, variant: 'error' })
    }
  }

  // Handle Revoke Invite
  const handleRevokeInvite = async (invitationId: string) => {
    if (!user || !clubId || !canInviteMembers) return
    const res = await revokeClubInvitation(invitationId, user.id, clubId)
    if (res.success) {
      setNotice({ message: res.message, isError: false })
      loadData(true)
    } else {
      setNotice({ message: res.message, isError: true })
    }
  }

  // Handle Resend Invite
  const handleResendInvite = async (invitationId: string) => {
    if (!user || !clubId || !canInviteMembers) return
    const res = await resendClubInvitation(invitationId, user.id, clubId, clubName)
    if (res.success) {
      const emailFailed = res.emailDelivery && !res.emailDelivery.success
      setNotice({
        message: res.message,
        isError: false,
        variant: emailFailed ? 'warning' : 'success',
      })
      loadData(true)
    } else {
      setNotice({ message: res.message, isError: true, variant: 'error' })
    }
  }

  const handleCopyLink = (token: string) => {
    if (!canInviteMembers) return
    const origin = getFrontendBaseUrl()
    const url = `${origin}/club/invitations/${token}`
    navigator.clipboard.writeText(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  if (loading || isRoleLoading) {
    return (
      <PageShell>
        <div className="py-24 flex flex-col items-center justify-center text-center">
          <div className="w-9 h-9 rounded-full border-2 border-[var(--color-surface-3)] border-t-[#18CFFC] animate-spin mb-3" />
          <span className="text-xs text-[var(--color-text-muted)] font-medium">
            Loading team roster and role authorization…
          </span>
        </div>
      </PageShell>
    )
  }

  // Authorization check
  const isAuthorized = Boolean(
    clubId && canViewMembers && (effectiveUserRole || globalRole === 'platform_admin')
  )
  if (!isAuthorized) {
    return (
      <PageShell>
        <ResourceOwnerGuard
          isAuthorized={false}
          denialTitle="Team Access Required"
          denialMessage="Only authorized club staff members and administrators can inspect this organization's team roster."
          fallbackUrl="/club/dashboard"
          fallbackLabel="Back to Club Dashboard"
        >
          <div />
        </ResourceOwnerGuard>
      </PageShell>
    )
  }

  const pendingCount = canInviteMembers
    ? invitations.filter((i) => i.status === 'pending').length
    : 0
  const actorRoleForChecks: ClubRole | null =
    globalRole === 'platform_admin' ? 'owner' : effectiveUserRole

  const getRoleBadgeVariant = (role: ClubRole): 'purple' | 'cyan' | 'pink' | 'amber' | 'success' | 'outline' => {
    switch (role) {
      case 'owner': return 'purple'
      case 'admin': return 'cyan'
      case 'event_manager': return 'pink'
      case 'payment_reviewer': return 'amber'
      case 'checkin_staff': return 'success'
      case 'viewer': return 'outline'
    }
  }

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 text-left">
        {/* Page Header */}
        <PageHeader
          breadcrumbs={[
            { label: 'Club Dashboard', href: '/club/dashboard' },
            { label: 'Team & Staff' },
          ]}
          title="Organization Staff & Team Management"
          badge={effectiveUserRole ? ROLE_LABELS[effectiveUserRole] : 'Restricted'}
          badgeVariant={effectiveUserRole ? getRoleBadgeVariant(effectiveUserRole) : 'outline'}
          subtitle={`Manage team roles, staff invitations, and security access controls for ${clubName}.`}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadData(true)}
                isLoading={refreshing}
                leftIcon={<RefreshCw size={14} />}
              >
                Refresh
              </Button>
              {canInviteMembers && assignableRoles.length > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setInviteEmail('')
                    setInviteRole(
                      assignableRoles.includes('event_manager')
                        ? 'event_manager'
                        : assignableRoles[0] || 'viewer'
                    )
                    setInviteModalOpen(true)
                  }}
                  leftIcon={<UserPlus size={14} />}
                  className="bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] hover:brightness-110 text-white font-medium shadow-[0_4px_16px_rgba(24,207,252,0.3)]"
                >
                  Invite Staff Member
                </Button>
              )}
            </div>
          }
        />

        {/* Temporary Notification Notice */}
        {notice && (
          <Alert
            variant={notice.variant || (notice.isError ? 'error' : 'success')}
            dismissible
            onDismiss={() => setNotice(null)}
          >
            {notice.message}
          </Alert>
        )}

        {/* Metrics Overview Grid */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4"
        >
          <Card className="p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-xs text-[var(--color-text-muted)] font-medium block mb-1">
              Active Team Members
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold font-display text-emerald-400">
                {members.length}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                Authorized staff
              </span>
            </div>
            <span className="text-[11px] text-[var(--color-text-muted)] mt-2">
              Assigned least-privilege roles
            </span>
          </Card>

          <Card className="p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-xs text-[var(--color-text-muted)] font-medium block mb-1">
              Pending Invitations
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold font-display text-amber-400">
                {pendingCount}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                Awaiting acceptance
              </span>
            </div>
            <span className="text-[11px] text-[var(--color-text-muted)] mt-2">
              Valid for 7 days from dispatch
            </span>
          </Card>

          <Card className="p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-xs text-[var(--color-text-muted)] font-medium block mb-1">
              Your Permission Tier
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-bold font-display text-[#18CFFC] truncate">
                {effectiveUserRole ? ROLE_LABELS[effectiveUserRole] : 'Restricted'}
              </span>
              <ShieldCheck size={18} className="text-[#18CFFC] shrink-0" />
            </div>
            <span className="text-[11px] text-[var(--color-text-muted)] mt-2 truncate">
              {effectiveUserRole
                ? ROLE_DESCRIPTIONS[effectiveUserRole]
                : 'No active organization role assigned.'}
            </span>
          </Card>
        </motion.div>

        {/* Tab Navigation Controls */}
        <div className="flex items-center gap-1.5 p-1 bg-[var(--color-surface-2)] rounded-xl border border-[oklch(100%_0_0_/_0.06)] w-fit text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'members'
                ? 'bg-[var(--color-surface-3)] text-white font-semibold shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-white'
            }`}
          >
            <Users size={14} />
            <span>Active Staff ({members.length})</span>
          </button>

          {canInviteMembers && (
            <button
              type="button"
              onClick={() => setActiveTab('invitations')}
              className={`px-3.5 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'invitations'
                  ? 'bg-[var(--color-surface-3)] text-white font-semibold shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-white'
              }`}
            >
              <Mail size={14} />
              <span>Invitations ({invitations.length})</span>
              {pendingCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'bg-[var(--color-surface-3)] text-white font-semibold shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-white'
            }`}
          >
            <History size={14} />
            <span>Security Audit Log ({auditLogs.length})</span>
          </button>
        </div>

        {/* ── Tab 1: Active Members ─────────────────────────────────────────── */}
        {activeTab === 'members' && (
          <div className="flex flex-col gap-3">
            {members.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No Team Members Found"
                description="Your organization has no additional staff members yet. Send an invitation to collaborate on event management, attendee coordination, or payment reviews."
                action={
                  canInviteMembers && assignableRoles.length > 0 ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setInviteEmail('')
                        setInviteRole(
                          assignableRoles.includes('event_manager')
                            ? 'event_manager'
                            : assignableRoles[0] || 'viewer'
                        )
                        setInviteModalOpen(true)
                      }}
                      leftIcon={<UserPlus size={14} />}
                    >
                      Invite Staff Member
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {members.map((member) => {
                  const isSelf = member.user_id === user?.id
                  const memberName = member.profile?.display_name || member.profile?.email?.split('@')[0] || 'Club Staff'
                  const memberEmail = member.profile?.email || '—'

                  return (
                    <Card
                      key={member.id}
                      className="p-4 flex flex-col justify-between gap-3 border-[var(--color-surface-3)] hover:border-[#18CFFC]/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-10 h-10 rounded-full bg-[#1E1E26] text-xs font-bold font-display flex items-center justify-center text-[#18CFFC] border border-white/10 shrink-0">
                            {memberName.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-sm text-[var(--color-text-primary)] truncate block">
                                {memberName}
                              </span>
                              {isSelf && (
                                <span className="text-[10px] px-1 rounded bg-[var(--color-surface-3)] text-[var(--color-text-muted)]">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-[var(--color-text-muted)] truncate block">
                              {memberEmail}
                            </span>
                          </div>
                        </div>

                        <Badge
                          variant={getRoleBadgeVariant(member.role)}
                          className="capitalize text-[10px] shrink-0"
                        >
                          {ROLE_LABELS[member.role]}
                        </Badge>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
                        <p>{ROLE_DESCRIPTIONS[member.role]}</p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[var(--color-surface-3)] text-[11px] text-[var(--color-text-muted)] gap-2">
                        <span>Joined: {formatExcelDateTime(member.created_at)}</span>

                        {!isSelf && (
                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            {canTransfer && member.status === 'active' && member.role !== 'owner' && (
                              <button
                                type="button"
                                onClick={() => setTransferTarget(member)}
                                className="text-amber-300 hover:text-amber-200 px-2 py-1 rounded hover:bg-amber-500/10 transition-colors flex items-center gap-1"
                                title="Transfer primary club ownership to this staff member"
                              >
                                <Crown size={11} />
                                <span>Make Owner</span>
                              </button>
                            )}
                            {canAssignRoles &&
                              (globalRole === 'platform_admin' ||
                                canManageMember(actorRoleForChecks, user?.id, member)) &&
                              assignableRoles.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMember(member)
                                    setSelectedNewRole(
                                      (assignableRoles as readonly ClubRole[]).includes(member.role)
                                        ? member.role
                                        : assignableRoles[0] || 'viewer'
                                    )
                                  }}
                                  className="text-[var(--color-text-secondary)] hover:text-white px-2 py-1 rounded hover:bg-[var(--color-surface-3)] transition-colors"
                                >
                                  Edit Role
                                </button>
                              )}
                            {canManageMembers &&
                              (globalRole === 'platform_admin' ||
                                canManageMember(actorRoleForChecks, user?.id, member)) && (
                                <button
                                  type="button"
                                  onClick={() => setRemovingMember(member)}
                                  className="text-rose-400 hover:text-rose-300 px-2 py-1 rounded hover:bg-rose-500/10 transition-colors"
                                  title="Revoke access and remove from team"
                                >
                                  Remove
                                </button>
                              )}
                          </div>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab 2: Invitations ────────────────────────────────────────────── */}
        {activeTab === 'invitations' && canInviteMembers && (
          <div className="flex flex-col gap-3">
            {invitations.length === 0 ? (
              <EmptyState
                icon={Mail}
                title="No Invitations Sent"
                description="You haven't sent any invitations yet. Invite your colleagues and event managers to collaborate securely."
                action={
                  canInviteMembers && assignableRoles.length > 0 ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setInviteEmail('')
                        setInviteRole(
                          assignableRoles.includes('event_manager')
                            ? 'event_manager'
                            : assignableRoles[0] || 'viewer'
                        )
                        setInviteModalOpen(true)
                      }}
                      leftIcon={<UserPlus size={14} />}
                    >
                      Invite Staff Member
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="glass rounded-2xl border border-[oklch(100%_0_0_/_0.08)] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--color-surface-3)] bg-[var(--color-surface-2)]/60 text-[var(--color-text-muted)] uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-4 font-semibold">Recipient Email</th>
                        <th className="py-3 px-4 font-semibold">Designated Role</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold">Dispatched At</th>
                        <th className="py-3 px-4 font-semibold">Expires At</th>
                        <th className="py-3 px-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-surface-3)]">
                      {invitations.map((inv) => {
                        const isPending = inv.status === 'pending'
                        const isAccepted = inv.status === 'accepted'
                        const isExpired = inv.status === 'expired'
                        const isRevoked = inv.status === 'revoked'

                        return (
                          <tr key={inv.id} className="hover:bg-white/[0.03] transition-colors">
                            <td className="py-3 px-4 font-medium text-[var(--color-text-primary)]">
                              <div className="flex items-center gap-2">
                                <Mail size={13} className="text-[#18CFFC]" />
                                <span>{inv.email}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant={getRoleBadgeVariant(inv.role)} className="capitalize text-[10px]">
                                {ROLE_LABELS[inv.role]}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <Badge
                                variant={
                                  isAccepted
                                    ? 'success'
                                    : isPending
                                    ? 'amber'
                                    : isExpired
                                    ? 'outline'
                                    : 'danger'
                                }
                                className="capitalize text-[10px] inline-flex items-center gap-1"
                              >
                                {isPending && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                                {inv.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-[var(--color-text-muted)]">
                              {formatExcelDateTime(inv.created_at)}
                            </td>
                            <td className="py-3 px-4 text-[var(--color-text-muted)]">
                              {isPending ? formatExcelDateTime(inv.expires_at) : '—'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isPending && canInviteMembers && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyLink(inv.token)}
                                      className="text-[11px] text-[var(--color-text-secondary)] hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors flex items-center gap-1"
                                      title="Copy invitation acceptance link"
                                    >
                                      {copiedToken === inv.token ? (
                                        <>
                                          <Check size={12} className="text-emerald-400" />
                                          <span className="text-emerald-400">Copied</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy size={12} />
                                          <span>Copy Link</span>
                                        </>
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleResendInvite(inv.id)}
                                      className="text-[11px] text-[#18CFFC] hover:text-[#18CFFC] hover:underline px-2 py-1 transition-colors"
                                    >
                                      Resend
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRevokeInvite(inv.id)}
                                      className="text-[11px] text-rose-400 hover:text-rose-300 px-2 py-1 rounded hover:bg-rose-500/10 transition-colors"
                                    >
                                      Revoke
                                    </button>
                                  </>
                                )}

                                {(isExpired || isRevoked) && canInviteMembers && (
                                  <button
                                    type="button"
                                    onClick={() => handleResendInvite(inv.id)}
                                    className="text-[11px] text-[#18CFFC] hover:text-[#18CFFC] hover:underline px-2 py-1 transition-colors"
                                  >
                                    Renew & Resend
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab 3: Security & Audit Log ──────────────────────────────────── */}
        {activeTab === 'audit' && (
          <div className="flex flex-col gap-3">
            {auditLogs.length === 0 ? (
              <EmptyState
                icon={History}
                title="No Security Logs Recorded"
                description="Staff invitations, role changes, and removals will be recorded in this tamper-evident audit history."
              />
            ) : (
              <div className="glass rounded-2xl border border-[oklch(100%_0_0_/_0.08)] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--color-surface-3)] bg-[var(--color-surface-2)]/60 text-[var(--color-text-muted)] uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-4 font-semibold">Timestamp</th>
                        <th className="py-3 px-4 font-semibold">Action</th>
                        <th className="py-3 px-4 font-semibold">Target / Details</th>
                        <th className="py-3 px-4 font-semibold">Actor ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-surface-3)]">
                      {auditLogs.map((log) => {
                        return (
                          <tr key={log.id} className="hover:bg-[var(--color-surface-2)]/40 transition-colors">
                            <td className="py-3 px-4 text-[var(--color-text-muted)] font-mono text-[11px]">
                              {formatExcelDateTime(log.created_at)}
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="purple" className="capitalize text-[10px]">
                                {log.action.replace('_', ' ')}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-[var(--color-text-primary)]">
                              <div className="flex flex-col">
                                {log.target_email && (
                                  <span className="font-semibold text-xs">{log.target_email}</span>
                                )}
                                {log.new_value && (
                                  <span className="text-[11px] text-[var(--color-text-muted)]">
                                    Role: {ROLE_LABELS[log.new_value as ClubRole] || log.new_value}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-[var(--color-text-muted)]">
                              {log.actor_id.slice(0, 8)}…
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Modal: Invite Staff Member ───────────────────────────────────── */}
        <Modal
          isOpen={inviteModalOpen}
          onClose={() => setInviteModalOpen(false)}
          title="Invite Staff Member"
          size="md"
        >
          <form onSubmit={handleInvite}>
            <ModalBody>
              <div className="flex flex-col gap-4 text-left">
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Send a secure, expiring invitation link to a verified student or collaborator. Recipients authenticate with their own FestFlow account upon acceptance.
                </p>

                <div>
                  <label htmlFor="invite_email" className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5">
                    Recipient Email Address
                  </label>
                  <input
                    id="invite_email"
                    type="email"
                    required
                    placeholder="e.g. colleague@festflow.edu"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-surface-2)] border border-white/10 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5">
                    Designated Least-Privilege Role
                  </label>
                  <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                    {ASSIGNABLE_CLUB_ROLES.map((r) => {
                      const allowed =
                        globalRole === 'platform_admin' || canAssignRole(actorRoleForChecks, r)
                      const isSelected = inviteRole === r

                      return (
                        <label
                          key={r}
                          className={`p-3 rounded-xl border text-xs cursor-pointer flex items-start gap-2.5 transition-all ${
                            !allowed
                              ? 'opacity-40 cursor-not-allowed bg-[var(--color-surface-2)]/40 border-transparent'
                              : isSelected
                              ? 'bg-[#18CFFC]/10 border-[#18CFFC] text-white'
                              : 'bg-[var(--color-surface-2)] border-[oklch(100%_0_0_/_0.06)] hover:bg-[var(--color-surface-3)]/60'
                          }`}
                        >
                          <input
                            type="radio"
                            name="invite_role"
                            value={r}
                            disabled={!allowed}
                            checked={isSelected}
                            onChange={() => setInviteRole(r)}
                            className="mt-0.5 text-[#18CFFC]"
                          />
                          <div className="min-w-0">
                            <strong className="font-semibold block text-sm">
                              {ROLE_LABELS[r]}
                            </strong>
                            <span className="text-[11px] text-[var(--color-text-muted)] block mt-0.5 leading-relaxed">
                              {ROLE_DESCRIPTIONS[r]}
                            </span>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={inviting}
                onClick={() => setInviteModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={inviting || !inviteEmail.trim()}
                isLoading={inviting}
                leftIcon={<Mail size={14} />}
                className="bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] hover:brightness-110 text-white font-medium shadow-[0_4px_16px_rgba(24,207,252,0.3)]"
              >
                Send Invitation
              </Button>
            </ModalFooter>
          </form>
        </Modal>

        {/* ── Modal: Edit Member Role ──────────────────────────────────────── */}
        <Modal
          isOpen={Boolean(editingMember)}
          onClose={() => setEditingMember(null)}
          title="Update Member Role"
          size="sm"
        >
          <ModalBody>
            {editingMember && (
              <div className="flex flex-col gap-3 text-left">
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Adjust permissions for <strong className="text-[var(--color-text-primary)]">{editingMember.profile?.display_name || editingMember.profile?.email}</strong>.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase mb-1">
                    Select New Role
                  </label>
                  <select
                    value={selectedNewRole}
                    onChange={(e) => setSelectedNewRole(e.target.value as ClubRole)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.08)] text-xs text-[var(--color-text-primary)] outline-none"
                  >
                    {assignableRoles.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              size="sm"
              disabled={updatingRole}
              onClick={() => setEditingMember(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={updatingRole}
              isLoading={updatingRole}
              onClick={handleUpdateRole}
            >
              Save Role
            </Button>
          </ModalFooter>
        </Modal>

        {/* ── Modal: Remove Member Confirmation ────────────────────────────── */}
        <Modal
          isOpen={Boolean(removingMember)}
          onClose={() => setRemovingMember(null)}
          title="Revoke Member Access"
          size="sm"
        >
          <ModalBody>
            <div className="flex flex-col gap-3 text-left">
              <div className="flex items-center gap-3 text-rose-400">
                <div className="p-2.5 rounded-xl bg-rose-500/15">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[var(--color-text-primary)]">
                    Remove Staff Member
                  </h4>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Revokes all administrative access immediately.
                  </p>
                </div>
              </div>

              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mt-1">
                Are you sure you want to remove{' '}
                <strong className="text-[var(--color-text-primary)]">
                  {removingMember?.profile?.display_name || removingMember?.profile?.email}
                </strong>{' '}
                (Role: {removingMember && ROLE_LABELS[removingMember.role]})?
                They will no longer be able to manage events, view attendee rosters, or inspect financial records.
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              size="sm"
              disabled={removing}
              onClick={() => setRemovingMember(null)}
            >
              Keep Member
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={removing}
              isLoading={removing}
              onClick={handleRemoveMember}
            >
              Confirm Removal
            </Button>
          </ModalFooter>
        </Modal>

        {/* ── Modal: Transfer Ownership Confirmation ───────────────────────── */}
        <Modal
          isOpen={Boolean(transferTarget)}
          onClose={() => setTransferTarget(null)}
          title="Transfer Club Ownership"
          size="sm"
        >
          <ModalBody>
            <div className="flex flex-col gap-3 text-left">
              <div className="flex items-center gap-3 text-amber-300">
                <div className="p-2.5 rounded-xl bg-amber-500/15">
                  <Crown size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[var(--color-text-primary)]">
                    Promote New Club Owner
                  </h4>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Reassigns primary ownership for {clubName}.
                  </p>
                </div>
              </div>

              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mt-1">
                Are you sure you want to transfer primary club ownership to{' '}
                <strong className="text-[var(--color-text-primary)]">
                  {transferTarget?.profile?.display_name || transferTarget?.profile?.email}
                </strong>
                ? Your role will be updated to <strong>{ROLE_LABELS.admin}</strong>, and only the new owner can assign administrators or transfer ownership again.
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              size="sm"
              disabled={transferring}
              onClick={() => setTransferTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={transferring}
              isLoading={transferring}
              onClick={handleTransferOwnership}
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold"
            >
              Confirm Transfer
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    </PageShell>
  )
}
