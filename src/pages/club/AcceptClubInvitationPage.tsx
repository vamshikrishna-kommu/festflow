import { useState, useEffect, useMemo } from 'react'
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
  LogOut,
  ShieldCheck,
  User,
} from 'lucide-react'
import { Button, Badge, Card, Logo, Alert } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/context/AuthContext'
import {
  getInvitationByToken,
  acceptClubInvitation,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
} from '@/lib/clubMembers'
import { getRolePermissions, PERMISSION_DESCRIPTIONS } from '@/lib/rbac'
import { formatExcelDateTime } from '@/lib/excelExport'
import { fadeIn } from '@/lib/animations'
import type { ClubInvitationRecord } from '@/types'

const PENDING_TOKEN_STORAGE_KEY = 'festflow_pending_club_invitation_token'

export default function AcceptClubInvitationPage() {
  const { token: routeToken } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user, profile, refreshProfile, refreshMemberships, switchActiveClub, signOut } = useAuth()

  // Token resolution with sessionStorage backup
  const activeToken = useMemo(() => {
    if (routeToken && routeToken.trim()) {
      const decoded = decodeURIComponent(routeToken.trim())
      try {
        sessionStorage.setItem(PENDING_TOKEN_STORAGE_KEY, decoded)
      } catch {
        // ignore storage errors
      }
      return decoded
    }
    try {
      return sessionStorage.getItem(PENDING_TOKEN_STORAGE_KEY) || ''
    } catch {
      return ''
    }
  }, [routeToken])

  const [invitation, setInvitation] = useState<ClubInvitationRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [switchingAccount, setSwitchingAccount] = useState(false)
  const [notice, setNotice] = useState<{ message: string; isError?: boolean } | null>(null)
  const [acceptedSuccess, setAcceptedSuccess] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function fetchInvitation() {
      if (!activeToken) {
        if (isMounted) setLoading(false)
        return
      }
      if (isMounted) setLoading(true)
      const res = await getInvitationByToken(activeToken)
      if (!isMounted) return

      setLoading(false)
      if (res.invitation) {
        setInvitation(res.invitation)
      } else {
        setInvitation(null)
      }
    }

    fetchInvitation()

    return () => {
      isMounted = false
    }
  }, [activeToken])

  const handleAccept = async () => {
    if (!activeToken || !user || !invitation) return
    setAccepting(true)
    setNotice(null)

    const res = await acceptClubInvitation(activeToken, {
      id: user.id,
      email: user.email || '',
      display_name: profile?.display_name || user.email?.split('@')[0],
    })

    setAccepting(false)
    if (res.success) {
      try {
        sessionStorage.removeItem(PENDING_TOKEN_STORAGE_KEY)
      } catch {
        // ignore storage errors
      }

      setAcceptedSuccess(true)

      // Refresh auth profile and active club memberships immediately
      try {
        await refreshProfile()
        await refreshMemberships()
        if (invitation.club_id) {
          await switchActiveClub(invitation.club_id)
        }
      } catch (err) {
        console.warn('[FestFlow] Failed to refresh profile/memberships after acceptance:', err)
      }

      setTimeout(() => {
        navigate('/club/dashboard')
      }, 2000)
    } else {
      setNotice({ message: res.message, isError: true })
    }
  }

  const handleSignOutAndSwitch = async () => {
    setSwitchingAccount(true)
    try {
      await signOut()
      const redirectParam = encodeURIComponent(`/club/invitations/${activeToken}`)
      navigate(`/student/login?redirect=${redirectParam}`)
    } catch (err) {
      console.error('[FestFlow] Sign out error:', err)
      setNotice({ message: 'Failed to sign out. Please try again.', isError: true })
    } finally {
      setSwitchingAccount(false)
    }
  }

  if (loading) {
    return (
      <PageShell>
        <div className="min-h-[70vh] flex flex-col items-center justify-center text-center">
          <div className="w-9 h-9 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin mb-3" />
          <span className="text-xs text-gray-500 font-medium">
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
          <Card className="max-w-md w-full p-8 text-center flex flex-col items-center border-rose-200 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-4">
              <XCircle size={28} />
            </div>
            <h2 className="text-xl font-bold font-display text-gray-900 mb-2">
              Invitation Not Found
            </h2>
            <p className="text-xs text-gray-600 leading-relaxed mb-6">
              This invitation link is invalid, expired, or was already accepted. Please ask your club administrator to issue a fresh invitation.
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
  const displayedEmail = invitation.masked_email || invitation.email
  const isEmailMatching =
    isAuthenticated &&
    (invitation.is_recipient_matched === true ||
      (Boolean(invitation.email && !invitation.email.includes('*')) &&
        user?.email?.trim().toLowerCase() === invitation.email?.trim().toLowerCase()))

  const permissionsList = getRolePermissions(invitation.role)
  const clubDisplayName = invitation.club_name || 'Organization'

  return (
    <PageShell>
      <div className="min-h-[75vh] flex flex-col items-center justify-center px-4 py-12">
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="w-full max-w-lg"
        >
          <Card className="p-6 sm:p-8 flex flex-col gap-6 border-gray-200 shadow-sm relative overflow-hidden text-left">
            {/* Header Icon & Brand */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                  <Building size={24} />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider block">
                    Staff Invitation
                  </span>
                  <h1 className="text-xl sm:text-2xl font-bold font-display text-gray-900">
                    Join {clubDisplayName}
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
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-800">
                <Clock size={18} className="shrink-0 text-amber-600 mt-0.5" />
                <div className="space-y-1">
                  <strong className="font-semibold block text-amber-900">
                    Invitation Expired
                  </strong>
                  <p className="leading-relaxed">
                    This staff invitation expired on {formatExcelDateTime(invitation.expires_at)}. Please request a renewed link from {clubDisplayName}.
                  </p>
                </div>
              </div>
            )}

            {/* Revoked State */}
            {isRevoked && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-800">
                <AlertTriangle size={18} className="shrink-0 text-rose-600 mt-0.5" />
                <div className="space-y-1">
                  <strong className="font-semibold block text-rose-900">
                    Invitation Revoked
                  </strong>
                  <p className="leading-relaxed">
                    This invitation was cancelled by the club administrator. Please check with your team lead for assistance.
                  </p>
                </div>
              </div>
            )}

            {/* Already Accepted / Success State */}
            {isAlreadyAccepted && (
              <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 size={26} />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-base text-gray-900">
                    Welcome to {clubDisplayName}!
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    You have joined as an active <strong className="text-gray-900 capitalize">{ROLE_LABELS[invitation.role]}</strong>. You now have staff access to event management and operations.
                  </p>
                </div>
                <Link to="/club/dashboard" className="w-full mt-2">
                  <Button variant="primary" size="sm" className="w-full justify-center">
                    Open Club Dashboard
                  </Button>
                </Link>
              </div>
            )}

            {/* Active Valid State */}
            {!isExpired && !isRevoked && !isAlreadyAccepted && (
              <div className="flex flex-col gap-5">
                {/* Invited Details Card */}
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                    <span className="text-gray-500">Organization:</span>
                    <strong className="text-gray-900 font-semibold text-xs">
                      {clubDisplayName}
                    </strong>
                  </div>

                  {invitation.inviter_name && (
                    <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                      <span className="text-gray-500">Invited By:</span>
                      <span className="text-gray-900 font-medium">
                        {invitation.inviter_name}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5 pb-2 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Designated Role:</span>
                      <Badge variant="indigo" className="capitalize text-[10px]">
                        {ROLE_LABELS[invitation.role]}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-gray-600 leading-relaxed italic">
                      {ROLE_DESCRIPTIONS[invitation.role]}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                    <span className="text-gray-500">Recipient Email:</span>
                    <strong className="text-gray-900 font-mono text-[11px]">
                      {displayedEmail}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Valid Until:</span>
                    <span className="text-gray-700">
                      {formatExcelDateTime(invitation.expires_at)}
                    </span>
                  </div>
                </div>

                {/* Role Permissions Preview */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-blue-600" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                      Granted Permissions ({permissionsList.length})
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-2 text-xs">
                    {permissionsList.map((perm) => (
                      <div key={perm} className="flex items-center gap-2 text-gray-700">
                        <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                        <span>{PERMISSION_DESCRIPTIONS[perm] || perm}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Area based on Auth State */}
                {!isAuthenticated ? (
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                    <div className="text-xs text-gray-600 leading-relaxed">
                      You must authenticate with the invited account (<strong className="text-gray-900">{displayedEmail}</strong>) to accept this staff invitation.
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <Link
                        to={`/student/login?redirect=${encodeURIComponent(`/club/invitations/${activeToken}`)}`}
                        className="w-full"
                      >
                        <Button variant="outline" size="sm" className="w-full justify-center" leftIcon={<LogIn size={14} />}>
                          Log In to Accept
                        </Button>
                      </Link>
                      <Link
                        to={`/student/signup?redirect=${encodeURIComponent(`/club/invitations/${activeToken}`)}`}
                        className="w-full"
                      >
                        <Button variant="primary" size="sm" className="w-full justify-center" leftIcon={<UserPlus size={14} />}>
                          Create Account
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : !isEmailMatching ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3 text-xs">
                    <div className="flex items-start gap-2.5 text-amber-800">
                      <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
                      <div className="leading-relaxed">
                        You are currently signed in as <strong className="text-gray-900">{user?.email}</strong>. This invitation was sent specifically to <strong className="text-gray-900">{displayedEmail}</strong>.
                      </div>
                    </div>
                    <div className="pt-1 flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSignOutAndSwitch}
                        isLoading={switchingAccount}
                        disabled={switchingAccount}
                        leftIcon={<LogOut size={13} />}
                        className="text-xs"
                      >
                        Sign Out & Switch Account
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 px-1 text-xs text-gray-600">
                      <User size={13} className="text-emerald-600" />
                      <span>
                        Verified as <strong className="text-gray-900">{user?.email}</strong>
                      </span>
                    </div>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={handleAccept}
                      isLoading={accepting}
                      disabled={accepting}
                      rightIcon={<ArrowRight size={15} />}
                      className="w-full justify-center font-semibold py-3"
                    >
                      Accept Invitation & Join {clubDisplayName}
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
