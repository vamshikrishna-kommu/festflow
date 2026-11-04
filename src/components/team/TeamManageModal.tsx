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
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react'
import { Button, Badge, Alert, Modal } from '@/components/ui'
import {
  getTeamDetails,
  inviteTeamMember,
  resendTeamInvitation,
  revokeTeamInvitation,
  buildTeamInviteLink,
  buildIndividualInviteLink,
} from '@/lib/teams'
import { subscribeToStatusChanges } from '@/lib/sync'
import type { TeamDetails, TeamInvitationRecord } from '@/types'
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
  const [cancellingInvite, setCancellingInvite] = useState<TeamInvitationRecord | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null)

  // Filter for invitations table
  const [inviteFilter, setInviteFilter] = useState<'all' | 'pending' | 'accepted' | 'declined' | 'expired'>('all')

  const loadTeam = useCallback(
    async (silent = false) => {
      if (!teamId) return
      if (!silent) setLoading(true)
      setErrorNotice(null)
      const res = await getTeamDetails(teamId, user?.id)
      if (!silent) setLoading(false)

      if (res.success && res.team) {
        setTeam(res.team)
      } else {
        setErrorNotice(res.message || 'Failed to load team roster.')
      }
    },
    [teamId, user?.id]
  )

  useEffect(() => {
    if (isOpen) {
      loadTeam()
      setSuccessNotice(null)
      setErrorNotice(null)
      setInviteEmail('')
      setInviteName('')

      const unsubscribe = subscribeToStatusChanges(
        ['team_updated', 'invitation_accepted'],
        (event) => {
          if (!event.teamId || event.teamId === teamId) {
            loadTeam(true)
          }
        }
      )
      return () => unsubscribe()
    }
  }, [isOpen, loadTeam, teamId])

  const isLeader = team?.leader_id === user?.id
  const acceptedMembers = team?.members?.filter((m) => m.status === 'accepted') || []
  const allInvitations = team?.invitations || []
  const pendingInvites = allInvitations.filter((i) => i.status === 'pending')
  const maxSize = team?.event?.max_team_size || 5
  const isTeamFull = acceptedMembers.length >= maxSize
  const availableSlots = Math.max(0, maxSize - acceptedMembers.length)

  const filteredInvitations = allInvitations.filter((inv) => {
    if (inviteFilter === 'all') return true
    return inv.status === inviteFilter
  })

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

  const handleCopyIndividualInvite = (token: string, id: string) => {
    const link = buildIndividualInviteLink(token)
    navigator.clipboard.writeText(link)
    setCopiedInviteId(id)
    setTimeout(() => setCopiedInviteId(null), 2000)
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

    const cleanEmail = inviteEmail.trim().toLowerCase()
    if (!cleanEmail || !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(cleanEmail)) {
      setErrorNotice('Please enter a valid student email address.')
      return
    }

    // Prevent leader from inviting themselves
    if (cleanEmail === (user.email || '').toLowerCase().trim()) {
      setErrorNotice('You are already the leader of this squad and cannot invite yourself.')
      return
    }

    // Check if already in confirmed members
    const isAlreadyAccepted = acceptedMembers.some(
      (m) => m.email?.toLowerCase() === cleanEmail
    )
    if (isAlreadyAccepted) {
      setErrorNotice(`${cleanEmail} is already a confirmed member of this squad.`)
      return
    }

    // Check if already in pending invitations
    const isAlreadyPending = pendingInvites.some(
      (inv) => inv.email?.toLowerCase() === cleanEmail
    )
    if (isAlreadyPending) {
      setErrorNotice(`An active invitation for ${cleanEmail} is already pending. You can resend or copy the link below.`)
      return
    }

    if (isTeamFull) {
      setErrorNotice(`Your squad has reached its maximum size of ${maxSize} members.`)
      return
    }

    setIsInviting(true)
    setErrorNotice(null)
    setSuccessNotice(null)

    try {
      const res = await inviteTeamMember({
        teamId: team.id,
        email: cleanEmail,
        name: inviteName.trim() || undefined,
        leaderId: user.id,
      })

      if (res.success) {
        setSuccessNotice(`Invitation sent to ${cleanEmail}! The recipient must sign in to accept.`)
        setInviteEmail('')
        setInviteName('')
        loadTeam(true)
        if (onTeamUpdated) onTeamUpdated()
      } else {
        setErrorNotice(res.message)
      }
    } catch (err: any) {
      setErrorNotice(err?.message || 'Failed to dispatch squad invitation.')
    } finally {
      setIsInviting(false)
    }
  }

  const handleResend = async (invitationId: string) => {
    if (!user) return
    setResendingId(invitationId)
    setErrorNotice(null)
    setSuccessNotice(null)

    try {
      const res = await resendTeamInvitation({
        invitationId,
        leaderId: user.id,
      })

      if (res.success) {
        setSuccessNotice('Invitation email resent successfully.')
        loadTeam()
      } else {
        setErrorNotice(res.message)
      }
    } catch (err: any) {
      setErrorNotice(err?.message || 'Failed to resend invitation.')
    } finally {
      setResendingId(null)
    }
  }

  const handleConfirmCancel = async () => {
    if (!user || !cancellingInvite) return
    setIsCancelling(true)
    setErrorNotice(null)
    setSuccessNotice(null)

    try {
      const res = await revokeTeamInvitation({
        invitationId: cancellingInvite.id,
        leaderId: user.id,
      })

      if (res.success) {
        setSuccessNotice(`Invitation for ${cancellingInvite.email} has been cancelled.`)
        setCancellingInvite(null)
        loadTeam()
        if (onTeamUpdated) onTeamUpdated()
      } else {
        setErrorNotice(res.message)
      }
    } catch (err: any) {
      setErrorNotice(err?.message || 'Failed to cancel invitation.')
    } finally {
      setIsCancelling(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-2xl rounded-3xl border border-white/10 shadow-2xl bg-[#0E0E12] text-left relative overflow-hidden my-auto"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-white/[0.08] shrink-0 bg-[#14141A]/90 backdrop-blur-md flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-gradient-to-br from-[#18CFFC]/20 to-[#7F1AFB]/20 text-[#18CFFC] shadow-md">
                <Users size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-bold text-base sm:text-lg text-white">
                    {team?.name || 'Squad Roster'}
                  </h3>
                  <Badge variant={isTeamFull ? 'success' : 'purple'} className="text-[10px]">
                    {acceptedMembers.length}/{maxSize} Confirmed
                  </Badge>
                </div>
                <p className="text-xs text-zinc-400 truncate max-w-sm font-sans mt-0.5">
                  {team?.event?.title || 'Event Squad'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6 flex flex-col gap-5 max-h-[78vh] overflow-y-auto">
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
              <div className="py-14 flex flex-col items-center justify-center gap-3 text-xs text-[var(--color-text-muted)]">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--color-brand-cyan)] border-t-transparent animate-spin" />
                <span>Loading squad information…</span>
              </div>
            ) : team ? (
              <>
                {/* ── KPI Summary Cards ────────────────────────────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-2xl bg-[#14141A] border border-white/[0.08] flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                      Confirmed
                    </span>
                    <span className="text-xl font-bold font-mono text-emerald-400 mt-1">
                      {acceptedMembers.length}
                    </span>
                    <span className="text-[9px] text-zinc-500 mt-0.5">Accepted passes</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#14141A] border border-white/[0.08] flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                      Pending
                    </span>
                    <span className="text-xl font-bold font-mono text-amber-400 mt-1">
                      {pendingInvites.length}
                    </span>
                    <span className="text-[9px] text-zinc-500 mt-0.5">Awaiting accept</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#14141A] border border-white/[0.08] flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                      Open Slots
                    </span>
                    <span className="text-xl font-bold font-mono text-[#18CFFC] mt-1">
                      {availableSlots}
                    </span>
                    <span className="text-[9px] text-zinc-500 mt-0.5">Remaining spots</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#14141A] border border-white/[0.08] flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                      Max Team
                    </span>
                    <span className="text-xl font-bold font-mono text-white mt-1">
                      {maxSize}
                    </span>
                    <span className="text-[9px] text-zinc-500 mt-0.5">Total limit</span>
                  </div>
                </div>

                {/* ── Share Code & Link Banner ─────────────────────────────────── */}
                <div className="p-4 rounded-2xl bg-[#14141A] border border-[#18CFFC]/20 flex flex-col gap-3 shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#18CFFC] tracking-wider">
                        Squad Code & General Link
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono font-bold text-lg text-white tracking-wider">
                          {team.invite_code}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors text-xs flex items-center gap-1 cursor-pointer"
                          title="Copy code"
                        >
                          {copiedCode ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
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
                        className="text-xs min-h-[36px]"
                      >
                        {copiedLink ? 'Link Copied!' : 'Copy General Link'}
                      </Button>

                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleShare}
                        leftIcon={<Share2 size={14} />}
                        className="text-xs min-h-[36px]"
                      >
                        Share
                      </Button>
                    </div>
                  </div>

                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] h-full transition-all duration-300 rounded-full"
                      style={{ width: `${Math.min(100, (acceptedMembers.length / maxSize) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* ── Leader Invite Form (Leaders only) ────────────────────────── */}
                {isLeader && !isTeamFull && (
                  <div className="p-4 rounded-2xl bg-[#14141A] border border-white/[0.08] flex flex-col gap-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                      <Plus size={14} className="text-[#18CFFC]" /> Invite New Teammate
                    </h4>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Enter teammate&apos;s email address. An invitation email and unique secure link will be sent.
                      The student must sign in to explicitly accept.
                    </p>

                    <form onSubmit={handleSendInvite} className="flex flex-col gap-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="teammate@college.edu *"
                          className="px-3.5 py-2.5 rounded-xl bg-[#0E0E12] border border-white/10 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#18CFFC] min-h-[40px]"
                        />
                        <input
                          type="text"
                          value={inviteName}
                          onChange={(e) => setInviteName(e.target.value)}
                          placeholder="Student name (optional)"
                          className="px-3.5 py-2.5 rounded-xl bg-[#0E0E12] border border-white/10 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#18CFFC] min-h-[40px]"
                        />
                      </div>

                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        isLoading={isInviting}
                        disabled={!inviteEmail.trim() || isInviting}
                        leftIcon={<Send size={13} />}
                        className="self-end min-h-[38px] px-4 font-semibold"
                      >
                        Send Squad Invitation
                      </Button>
                    </form>
                  </div>
                )}

                {/* ── Confirmed Squad Roster ───────────────────────────────────── */}
                <div className="flex flex-col gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center justify-between">
                    <span>Confirmed Members ({acceptedMembers.length}/{maxSize})</span>
                    {isTeamFull && (
                      <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                        <ShieldCheck size={13} /> Squad Full
                      </span>
                    )}
                  </h4>

                  <div className="flex flex-col gap-2">
                    {acceptedMembers.map((member) => (
                      <div
                        key={member.id}
                        className="p-3.5 rounded-2xl bg-[#14141A] border border-white/[0.06] flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              member.role === 'leader'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {member.role === 'leader' ? <Crown size={16} /> : <UserCheck size={16} />}
                          </div>
                          <div className="truncate">
                            <strong className="text-white font-semibold truncate block">
                              {member.name} {member.role === 'leader' && '(Leader)'}
                            </strong>
                            <span className="text-[11px] text-zinc-400 truncate block mt-0.5">
                              {member.email} {member.college ? `• ${member.college}` : ''}
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

                {/* ── Invitations Management Section (Leaders only) ───────────── */}
                {isLeader && allInvitations.length > 0 && (
                  <div className="flex flex-col gap-3 pt-3 border-t border-white/[0.08]">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                        Invitations Log ({allInvitations.length})
                      </h4>

                      <div className="flex items-center gap-1">
                        {(['all', 'pending', 'accepted', 'declined', 'expired'] as const).map((filter) => (
                          <button
                            key={filter}
                            type="button"
                            onClick={() => setInviteFilter(filter)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-medium capitalize transition-colors ${
                              inviteFilter === filter
                                ? 'bg-[#18CFFC]/20 text-[#18CFFC] border border-[#18CFFC]/30'
                                : 'text-zinc-400 hover:text-white bg-white/5'
                            }`}
                          >
                            {filter}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {filteredInvitations.length === 0 ? (
                        <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-xs text-zinc-500">
                          No invitations matching &quot;{inviteFilter}&quot;.
                        </div>
                      ) : (
                        filteredInvitations.map((invite) => {
                          const isPending = invite.status === 'pending'
                          const isAccepted = invite.status === 'accepted'
                          const isDeclined = invite.status === 'declined'
                          const isExpired = invite.status === 'expired'

                          return (
                            <div
                              key={invite.id}
                              className="p-3.5 rounded-2xl bg-[#14141A] border border-white/[0.06] flex items-center justify-between text-xs flex-wrap gap-2.5"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="p-1.5 rounded-lg bg-white/5 text-zinc-400 shrink-0">
                                  <Mail size={15} />
                                </div>
                                <div className="truncate">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-white font-medium truncate">
                                      {invite.email}
                                    </span>
                                    <Badge
                                      variant={
                                        isAccepted
                                          ? 'success'
                                          : isPending
                                            ? 'amber'
                                            : isDeclined
                                              ? 'danger'
                                              : 'outline'
                                      }
                                      className="text-[9px] uppercase px-1.5 py-0"
                                    >
                                      {invite.status}
                                    </Badge>
                                  </div>
                                  <span className="text-[10px] text-zinc-400 block mt-0.5">
                                    Invited {new Date(invite.last_sent_at || invite.created_at).toLocaleDateString()}
                                    {isAccepted && invite.accepted_at && (
                                      ` • Accepted ${new Date(invite.accepted_at).toLocaleDateString()}`
                                    )}
                                    {isDeclined && invite.declined_at && (
                                      ` • Declined ${new Date(invite.declined_at).toLocaleDateString()}`
                                    )}
                                    {isPending && (
                                      ` • Expires in ${Math.max(0, Math.ceil((new Date(invite.expires_at).getTime() - Date.now()) / 86400000))}d`
                                    )}
                                  </span>
                                </div>
                              </div>

                              {/* Action Buttons for Pending / Expired Invitations */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isPending && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="text-[10px] h-7 px-2"
                                    onClick={() => handleCopyIndividualInvite(invite.token, invite.id)}
                                    leftIcon={
                                      copiedInviteId === invite.id ? (
                                        <Check size={12} className="text-emerald-400" />
                                      ) : (
                                        <Copy size={12} />
                                      )
                                    }
                                  >
                                    {copiedInviteId === invite.id ? 'Copied!' : 'Copy Link'}
                                  </Button>
                                )}

                                {(isPending || isExpired) && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="text-[10px] h-7 px-2"
                                    onClick={() => handleResend(invite.id)}
                                    isLoading={resendingId === invite.id}
                                    disabled={resendingId === invite.id}
                                    leftIcon={<RotateCw size={12} />}
                                  >
                                    Resend
                                  </Button>
                                )}

                                {isPending && (
                                  <button
                                    type="button"
                                    onClick={() => setCancellingInvite(invite)}
                                    className="p-1.5 rounded-lg hover:bg-rose-500/15 text-rose-400 hover:text-rose-300 transition-colors text-xs cursor-pointer"
                                    title="Cancel invitation"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </motion.div>
      </div>

      {/* ── Cancel Confirmation Modal ────────────────────────────────────── */}
      {cancellingInvite && (
        <Modal
          isOpen={Boolean(cancellingInvite)}
          onClose={() => setCancellingInvite(null)}
          title="Cancel Squad Invitation"
          size="sm"
        >
          <div className="flex flex-col gap-4 text-left">
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3">
              <AlertTriangle className="text-rose-400 shrink-0 mt-0.5" size={18} />
              <div className="text-xs text-rose-200 space-y-1">
                <p className="font-semibold text-rose-300">
                  Are you sure you want to cancel this invitation?
                </p>
                <p>
                  Invitation for <strong className="text-white font-mono">{cancellingInvite.email}</strong> will be revoked.
                  Their invitation link will immediately stop working.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCancellingInvite(null)}
                disabled={isCancelling}
              >
                Keep Invitation
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleConfirmCancel}
                isLoading={isCancelling}
                disabled={isCancelling}
              >
                Yes, Cancel Invitation
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
