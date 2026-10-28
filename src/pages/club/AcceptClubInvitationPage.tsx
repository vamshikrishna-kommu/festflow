import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import { motion } from 'motion/react'
import {
  Building,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  LogIn,
  UserPlus,
  Clock,
  XCircle,
} from 'lucide-react'
import { Button, Badge, Card, Logo, Alert } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/context/AuthContext'
import {
  getInvitationByToken,
  acceptClubInvitation,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_PERMISSIONS,
} from '@/lib/clubMembers'
import { formatExcelDateTime } from '@/lib/excelExport'
import { fadeIn } from '@/lib/animations'
import type { ClubInvitationRecord, ClubPermission } from '@/types'

const PERMISSION_LABELS: Record<ClubPermission, string> = {
  manage_club: 'Organization profile and general settings',
  manage_members: 'Invite and manage club staff members',
  manage_events: 'Create, edit, and publish club events',
  view_attendees: 'Inspect registrant rosters and attendee profiles',
  gate_checkin: 'Gate check-in and QR ticket scanner access',
  review_payments: 'Review UPI payment submissions and verify UTRs',
  view_reports: 'Download analytics spreadsheets and attendee reports',
}

export default function AcceptClubInvitationPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [invitation, setInvitation] = useState<ClubInvitationRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [notice, setNotice] = useState<{ message: string; isError?: boolean } | null>(null)
  const [acceptedSuccess, setAcceptedSuccess] = useState(false)

  useEffect(() => {
    async function fetchInvitation() {
      if (!token) {
        setLoading(false)
        return
      }
      setLoading(true)
      const res = await getInvitationByToken(token)
      setLoading(false)
      if (res.invitation) {
        setInvitation(res.invitation)
      }
    }

    fetchInvitation()
  }, [token])

  const handleAccept = async () => {
    if (!token || !user || !invitation) return
    setAccepting(true)
    setNotice(null)

    const res = await acceptClubInvitation(token, {
      id: user.id,
      email: user.email || '',
      display_name: profile?.display_name || user.email?.split('@')[0],
    })

    setAccepting(false)
    if (res.success) {
      setAcceptedSuccess(true)
      setTimeout(() => {
        navigate('/club/dashboard')
      }, 1500)
    } else {
      setNotice({ message: res.message, isError: true })
    }
  }

  if (loading) {
    return (
      <PageShell>
        <div className="min-h-[70vh] flex flex-col items-center justify-center text-center">
          <div className="w-9 h-9 rounded-full border-2 border-[var(--color-surface-3)] border-t-[var(--color-brand-purple)] animate-spin mb-3" />
          <span className="text-xs text-[var(--color-text-muted)] font-medium">
            Verifying staff invitation credentials…
          </span>
        </div>
      </PageShell>
    )
  }

  if (!invitation) {
    return (
      <PageShell>
        <div className="min-h-[70vh] flex flex-col items-center justify-center px-4">
          <Card className="max-w-md w-full p-8 text-center flex flex-col items-center border-rose-500/20 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 flex items-center justify-center text-rose-400 mb-4">
              <XCircle size={28} />
            </div>
            <h2 className="text-xl font-bold font-display text-[var(--color-text-primary)] mb-2">
              Invitation Not Found
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-6">
              This invitation link is invalid or has expired. Please ask the club administrator to generate a fresh invitation.
            </p>
            <Link to="/discover">
              <Button variant="outline" size="sm">
                Explore FestFlow Events
              </Button>
            </Link>
          </Card>
        </div>
      </PageShell>
    )
  }

  const isExpired = new Date(invitation.expires_at) < new Date() || invitation.status === 'expired'
  const isRevoked = invitation.status === 'revoked'
  const isAlreadyAccepted = invitation.status === 'accepted' || acceptedSuccess

  const isAuthenticated = Boolean(user && user.email)
  const isEmailMatching = isAuthenticated && user?.email?.toLowerCase() === invitation.email.toLowerCase()

  const permissionsList = ROLE_PERMISSIONS[invitation.role] || []

  return (
    <PageShell>
      <div className="min-h-[75vh] flex flex-col items-center justify-center px-4 py-12">
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="w-full max-w-lg"
        >
          <Card className="p-6 sm:p-8 flex flex-col gap-6 border-[var(--color-surface-3)] shadow-2xl relative overflow-hidden text-left">
            {/* Header Icon & Brand */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[oklch(100%_0_0_/_0.06)]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[var(--color-brand-purple)]/15 border border-[var(--color-brand-purple)]/30 flex items-center justify-center text-[var(--color-brand-purple)] shrink-0">
                  <Building size={24} />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--color-brand-purple)] tracking-wider block">
                    Staff Invitation
                  </span>
                  <h1 className="text-xl sm:text-2xl font-bold font-display text-[var(--color-text-primary)]">
                    Join Organization Team
                  </h1>
                </div>
              </div>
              <Logo variant="navbar" />
            </div>

            {notice && (
              <Alert
                variant={notice.isError ? 'error' : 'success'}
                dismissible
                onDismiss={() => setNotice(null)}
              >
                {notice.message}
              </Alert>
            )}

            {/* Expired State */}
            {isExpired && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3 text-xs text-amber-200">
                <Clock size={18} className="shrink-0 text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <strong className="font-semibold block text-amber-300">
                    Invitation Expired
                  </strong>
                  <p className="leading-relaxed">
                    This staff invitation expired on {formatExcelDateTime(invitation.expires_at)}. Please request a renewed link from your club organizer.
                  </p>
                </div>
              </div>
            )}

            {/* Revoked State */}
            {isRevoked && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-3 text-xs text-rose-200">
                <AlertTriangle size={18} className="shrink-0 text-rose-400 mt-0.5" />
                <div className="space-y-1">
                  <strong className="font-semibold block text-rose-300">
                    Invitation Revoked
                  </strong>
                  <p className="leading-relaxed">
                    This invitation was cancelled by the club administrator. Please check with your team lead for assistance.
                  </p>
                </div>
              </div>
            )}

            {/* Already Accepted State */}
            {isAlreadyAccepted && (
              <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 size={26} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-base text-[var(--color-text-primary)]">
                    Invitation Accepted!
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    You are now an active staff member of this organization. Head over to your club dashboard to get started.
                  </p>
                </div>
                <Link to="/club/dashboard" className="w-full mt-2">
                  <Button variant="primary" size="sm" className="w-full justify-center">
                    Go to Club Dashboard
                  </Button>
                </Link>
              </div>
            )}

            {/* Active Valid State */}
            {!isExpired && !isRevoked && !isAlreadyAccepted && (
              <div className="flex flex-col gap-5">
                {/* Invited Details Card */}
                <div className="p-4 rounded-2xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.06)] space-y-3 text-xs">
                  <div className="flex flex-col gap-1.5 pb-2 border-b border-[oklch(100%_0_0_/_0.06)]">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--color-text-muted)]">Designated Role:</span>
                      <Badge variant="purple" className="capitalize text-[10px]">
                        {ROLE_LABELS[invitation.role]}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed italic">
                      {ROLE_DESCRIPTIONS[invitation.role]}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-[oklch(100%_0_0_/_0.06)]">
                    <span className="text-[var(--color-text-muted)]">Recipient Email:</span>
                    <strong className="text-[var(--color-text-primary)] font-mono text-[11px]">
                      {invitation.email}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-text-muted)]">Valid Until:</span>
                    <span className="text-[var(--color-text-secondary)]">
                      {formatExcelDateTime(invitation.expires_at)}
                    </span>
                  </div>
                </div>

                {/* Role Permissions Preview */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">
                    Granted Permissions ({permissionsList.length})
                  </span>
                  <div className="p-3.5 rounded-2xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.06)] space-y-2 text-xs">
                    {permissionsList.map((perm) => (
                      <div key={perm} className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                        <span>{PERMISSION_LABELS[perm]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Area based on Auth State */}
                {!isAuthenticated ? (
                  <div className="p-4 rounded-2xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.06)] space-y-3">
                    <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                      You must authenticate with <strong className="text-[var(--color-text-primary)]">{invitation.email}</strong> to accept this team invitation.
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <Link to={`/student/login?redirect=/club/invitations/${token}`} className="w-full">
                        <Button variant="outline" size="sm" className="w-full justify-center" leftIcon={<LogIn size={14} />}>
                          Log In to Accept
                        </Button>
                      </Link>
                      <Link to={`/student/signup?redirect=/club/invitations/${token}`} className="w-full">
                        <Button variant="primary" size="sm" className="w-full justify-center" leftIcon={<UserPlus size={14} />}>
                          Create Account
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : !isEmailMatching ? (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-3 text-xs">
                    <div className="flex items-start gap-2.5 text-amber-300">
                      <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        You are currently signed in as <strong className="text-white">{user?.email}</strong>. This invitation was sent specifically to <strong className="text-white">{invitation.email}</strong>.
                      </div>
                    </div>
                    <div className="pt-1">
                      <Link to={`/student/login?redirect=/club/invitations/${token}`}>
                        <Button variant="outline" size="sm" className="text-xs">
                          Switch to {invitation.email}
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2">
                    <Button
                      variant="primary"
                      size="md"
                      onClick={handleAccept}
                      isLoading={accepting}
                      disabled={accepting}
                      rightIcon={<ArrowRight size={15} />}
                      className="w-full justify-center bg-[var(--color-brand-purple)] hover:bg-purple-600 text-white font-semibold py-3 shadow-lg shadow-purple-600/20"
                    >
                      Accept Invitation & Join Staff
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </motion.div>
      </div>
    </PageShell>
  )
}
