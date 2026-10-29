import { useState, useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import {
  Users,
  Crown,
  UserCheck,
  Mail,
  Copy,
  Check,
  Share2,
  Send,
  RotateCw,
  Trash2,
  Plus,
  X,
} from 'lucide-react'
import { Button, Badge, Alert } from '@/components/ui'
import {
  getTeamDetails,
  inviteTeamMember,
  resendTeamInvitation,
  revokeTeamInvitation,
  buildTeamInviteLink,
} from '@/lib/teams'
import { subscribeToStatusChanges } from '@/lib/sync'
import type { TeamDetails } from '@/types'
import { useAuth } from '@/context/AuthContext'

interface TeamManageModalProps {
  isOpen: boolean
  onClose: () => void
  teamId: string
  onTeamUpdated?: () => void
}

export function TeamManageModal({
  isOpen,
  onClose,
  teamId,
  onTeamUpdated,
}: TeamManageModalProps) {
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState<TeamDetails | null>(null)
  const [errorNotice, setErrorNotice] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  // Invite member form state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [isInviting, setIsInviting] = useState(false)

  // Resend / Revoke action loading maps
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  const loadTeam = useCallback(async () => {
    if (!teamId) return
    setLoading(true)
    setErrorNotice(null)
    const res = await getTeamDetails(teamId, user?.id)
    setLoading(false)

    if (res.success && res.team) {
      setTeam(res.team)
    } else {
      setErrorNotice(res.message || 'Failed to load team roster.')
    }
  }, [teamId, user?.id])

  useEffect(() => {
    if (isOpen) {
      loadTeam()
      setSuccessNotice(null)
      setErrorNotice(null)
      setInviteEmail('')
      setInviteName('')

      const unsubscribe = subscribeToStatusChanges(
        ['team_updated', 'invitation_accepted', 'reconnect'],
        (event) => {
          if (!event.teamId || event.teamId === teamId) {
            loadTeam()
          }
        }
      )
      return () => unsubscribe()
    }
  }, [isOpen, loadTeam, teamId])

  const isLeader = team?.leader_id === user?.id
  const acceptedMembers = team?.members?.filter((m) => m.status === 'accepted') || []
  const pendingInvites = team?.invitations?.filter((i) => i.status === 'pending') || []
  const maxSize = team?.event?.max_team_size || 5
  const isTeamFull = acceptedMembers.length >= maxSize

  const inviteLink = team && team.event?.slug
    ? buildTeamInviteLink(team.event.slug, team.invite_code)
    : ''

  const handleCopyCode = () => {
    if (!team) return
    navigator.clipboard.writeText(team.invite_code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleCopyLink = () => {
    if (!inviteLink) return
    navigator.clipboard.writeText(inviteLink)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleShare = async () => {
    if (!team || !inviteLink) return
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Join my squad "${team.name}" on FestFlow!`,
          text: `Join my team "${team.name}" for ${team.event?.title || 'the event'}. Use code ${team.invite_code} or open link:`,
          url: inviteLink,
        })
        return
      } catch {
        // User cancelled or share failed, fallback to copy
      }
    }
    handleCopyLink()
  }

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!team || !user) return

    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      setErrorNotice('Please enter a valid email address.')
      return
    }

    setIsInviting(true)
    setErrorNotice(null)
    setSuccessNotice(null)

    const res = await inviteTeamMember({
      teamId: team.id,
      email: inviteEmail.trim(),
      name: inviteName.trim() || undefined,
      leaderId: user.id,
    })

    setIsInviting(false)

    if (res.success) {
      if (res.invitation_created_email_failed) {
        setErrorNotice(
          `Invitation created in roster for ${inviteEmail.trim()}, but email delivery failed (${res.email_dispatch_error || 'provider error'}). You can share your squad invite code ${team.invite_code} or the invite link with them directly.`
        )
      } else {
        setSuccessNotice(`Invitation email successfully dispatched to ${inviteEmail.trim()}`)
      }
      setInviteEmail('')
      setInviteName('')
      loadTeam()
      if (onTeamUpdated) onTeamUpdated()
    } else {
      setErrorNotice(res.message)
    }
  }

  const handleResend = async (invitationId: string) => {
    if (!user) return
    setResendingId(invitationId)
    setErrorNotice(null)
    setSuccessNotice(null)

    const res = await resendTeamInvitation({
      invitationId,
      leaderId: user.id,
    })

    setResendingId(null)

    if (res.success) {
      setSuccessNotice('Invitation email resent successfully.')
      loadTeam()
    } else {
      setErrorNotice(res.message)
    }
  }

  const handleRevoke = async (invitationId: string) => {
    if (!user) return
    setRevokingId(invitationId)
    setErrorNotice(null)
    setSuccessNotice(null)

    const res = await revokeTeamInvitation({
      invitationId,
      leaderId: user.id,
    })

    setRevokingId(null)

    if (res.success) {
      setSuccessNotice('Invitation revoked.')
      loadTeam()
      if (onTeamUpdated) onTeamUpdated()
    } else {
      setErrorNotice(res.message)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-xl rounded-3xl glass border border-[oklch(100%_0_0_/_0.15)] shadow-2xl bg-gradient-to-b from-[var(--color-surface-1)] to-[var(--color-surface-0)] text-left relative overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--color-surface-3)] shrink-0 bg-[var(--color-surface-1)]/80 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[var(--color-brand-purple)]/20 to-[var(--color-brand-cyan)]/20 text-[var(--color-brand-purple)]">
              <Users size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-base text-[var(--color-text-primary)]">
                  {team?.name || 'Squad Roster'}
                </h3>
                <Badge variant={isTeamFull ? 'success' : 'purple'}>
                  {acceptedMembers.length}/{maxSize} Confirmed
                </Badge>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] truncate max-w-xs">
                {team?.event?.title || 'Event Team'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 flex flex-col gap-5 max-h-[75vh] overflow-y-auto">
          {errorNotice && (
            <Alert variant="error" dismissible onDismiss={() => setErrorNotice(null)}>
              {errorNotice}
            </Alert>
          )}

          {successNotice && (
            <Alert variant="success" dismissible onDismiss={() => setSuccessNotice(null)}>
              {successNotice}
            </Alert>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-xs text-[var(--color-text-muted)]">
              <div className="w-6 h-6 rounded-full border-2 border-[var(--color-brand-purple)] border-t-transparent animate-spin" />
              <span>Loading squad information…</span>
            </div>
          ) : team ? (
            <>
              {/* ── Share Code & Link Banner ─────────────────────────────────── */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-[var(--color-surface-2)] to-[var(--color-surface-3)]/40 border border-[oklch(100%_0_0_/_0.08)] flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-[var(--color-text-muted)] tracking-wider">
                      Squad Invitation Code
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono font-bold text-lg text-[var(--color-brand-cyan)] tracking-wider">
                        {team.invite_code}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="p-1 rounded-lg hover:bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors text-xs flex items-center gap-1 cursor-pointer"
                        title="Copy code"
                      >
                        {copiedCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopyLink}
                      leftIcon={copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    >
                      {copiedLink ? 'Link Copied!' : 'Copy Link'}
                    </Button>

                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleShare}
                      leftIcon={<Share2 size={14} />}
                    >
                      Share Invite
                    </Button>
                  </div>
                </div>

                <div className="w-full bg-[var(--color-surface-3)] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-[var(--color-brand-purple)] to-[var(--color-brand-cyan)] h-full transition-all duration-300 rounded-full"
                    style={{ width: `${Math.min(100, (acceptedMembers.length / maxSize) * 100)}%` }}
                  />
                </div>
              </div>

              {/* ── Confirmed Squad Roster ───────────────────────────────────── */}
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center justify-between">
                  <span>Confirmed Members ({acceptedMembers.length}/{maxSize})</span>
                  {isTeamFull && (
                    <span className="text-[11px] text-emerald-400 font-normal">Squad Full</span>
                  )}
                </h4>

                <div className="flex flex-col gap-1.5">
                  {acceptedMembers.map((member) => (
                    <div
                      key={member.id}
                      className="p-3 rounded-xl bg-[var(--color-surface-2)]/80 border border-[oklch(100%_0_0_/_0.06)] flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            member.role === 'leader'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-emerald-500/15 text-emerald-400'
                          }`}
                        >
                          {member.role === 'leader' ? <Crown size={15} /> : <UserCheck size={15} />}
                        </div>
                        <div className="truncate">
                          <strong className="text-[var(--color-text-primary)] font-semibold truncate block">
                            {member.name}
                          </strong>
                          <span className="text-[11px] text-[var(--color-text-muted)] truncate block">
                            {member.college || member.email}
                          </span>
                        </div>
                      </div>

                      <Badge variant={member.role === 'leader' ? 'amber' : 'success'}>
                        {member.role === 'leader' ? 'Leader' : 'Confirmed'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Pending Invitations Section (Leaders only) ───────────────── */}
              {isLeader && pendingInvites.length > 0 && (
                <div className="flex flex-col gap-2 pt-2 border-t border-[var(--color-surface-3)]">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center justify-between">
                    <span>Pending Invitations ({pendingInvites.length})</span>
                    <span className="text-[11px] text-[var(--color-text-muted)] font-normal">
                      Awaiting recipient confirmation
                    </span>
                  </h4>

                  <div className="flex flex-col gap-2">
                    {pendingInvites.map((invite) => (
                      <div
                        key={invite.id}
                        className="p-3 rounded-xl bg-[var(--color-surface-2)]/50 border border-[oklch(100%_0_0_/_0.05)] flex items-center justify-between text-xs flex-wrap gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Mail size={15} className="text-amber-400 shrink-0" />
                          <div className="truncate">
                            <span className="font-mono text-[var(--color-text-primary)] truncate block">
                              {invite.email}
                            </span>
                            <span className="text-[10px] text-[var(--color-text-muted)]">
                              Expires in 7 days • Sent {new Date(invite.last_sent_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-[11px] h-7 px-2.5"
                            onClick={() => handleResend(invite.id)}
                            isLoading={resendingId === invite.id}
                            disabled={resendingId === invite.id}
                            leftIcon={<RotateCw size={12} />}
                          >
                            Resend
                          </Button>

                          <button
                            type="button"
                            onClick={() => handleRevoke(invite.id)}
                            disabled={revokingId === invite.id}
                            className="p-1.5 rounded-lg hover:bg-rose-500/15 text-rose-400 hover:text-rose-300 transition-colors text-xs cursor-pointer"
                            title="Revoke invitation"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Leader Invite Form ───────────────────────────────────────── */}
              {isLeader && !isTeamFull && (
                <div className="pt-2 border-t border-[var(--color-surface-3)]">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2 flex items-center gap-1.5">
                    <Plus size={14} /> Invite New Teammate
                  </h4>

                  <form onSubmit={handleSendInvite} className="flex flex-col gap-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="teammate@college.edu"
                        className="px-3.5 py-2 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.1)] text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-purple)]"
                      />
                      <input
                        type="text"
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        placeholder="Student name (optional)"
                        className="px-3.5 py-2 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.1)] text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-purple)]"
                      />
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      isLoading={isInviting}
                      disabled={!inviteEmail.trim() || isInviting}
                      leftIcon={<Send size={13} />}
                      className="self-end"
                    >
                      Dispatch Email Invitation
                    </Button>
                  </form>
                </div>
              )}
            </>
          ) : null}
        </div>
      </motion.div>
    </div>
  )
}
