import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import {
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Ticket,
  Calendar,
  Clock,
  ArrowLeft,
  Mail,
  ShieldCheck,
  AlertTriangle,
  LogOut,
  MapPin,
  XCircle,
} from 'lucide-react'
import { Button, Badge, Alert, Card, Modal } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { CollegeSearchCombobox } from '@/components/colleges/CollegeSearchCombobox'
import {
  getTeamPreview,
  getTeamInvitationPreview,
  joinTeam,
  acceptTeamInvitation,
  declineTeamInvitation,
} from '@/lib/teams'
import type { TeamPreview, TeamInvitationPreview, TeamJoinResponse } from '@/types'
import { useAuth } from '@/context/AuthContext'

export default function JoinTeamPage() {
  const { code: routeCode } = useParams<{ code?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, profile, studentProfile, signOut } = useAuth()

  const initialCode = (routeCode || searchParams.get('code') || '').toUpperCase().trim()
  const tokenParam = (searchParams.get('token') || '').trim()

  const [code, setCode] = useState(initialCode)
  const [token, setToken] = useState(tokenParam)

  // Token-based preview state
  const [tokenPreview, setTokenPreview] = useState<TeamInvitationPreview | null>(null)
  const [tokenLoading, setTokenLoading] = useState(Boolean(tokenParam))
  const [tokenError, setTokenError] = useState<{ message: string; code?: string } | null>(null)

  // Code-based preview state (fallback)
  const [loadingCodePreview, setLoadingCodePreview] = useState(false)
  const [codePreview, setCodePreview] = useState<TeamPreview | null>(null)
  const [codePreviewError, setCodePreviewError] = useState<string | null>(null)

  // Participant form fields
  const [studentName, setStudentName] = useState('')
  const [collegeName, setCollegeName] = useState('')
  const [collegeId, setCollegeId] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [idCardNumber, setIdCardNumber] = useState('')

  // Submit states
  const [isJoining, setIsJoining] = useState(false)
  const [joinResult, setJoinResult] = useState<TeamJoinResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Decline states
  const [declined, setDeclined] = useState(false)
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false)
  const [isDeclining, setIsDeclining] = useState(false)

  // ── 1. Fetch Token Preview ───────────────────────────────────────────────
  const fetchTokenPreview = useCallback(async (tokenToVerify: string) => {
    if (!tokenToVerify) return
    setTokenLoading(true)
    setTokenError(null)
    setErrorMessage(null)

    // Preserve token in sessionStorage for sign-in / sign-up recovery
    try {
      sessionStorage.setItem('festflow_pending_team_token', tokenToVerify)
    } catch {
      // ignore
    }

    const res = await getTeamInvitationPreview(tokenToVerify)
    setTokenLoading(false)

    if (res.success && res.preview) {
      setTokenPreview(res.preview)
    } else {
      setTokenPreview(null)
      setTokenError({
        message: res.message || 'Invalid or expired squad invitation link.',
        code: res.error_code,
      })
    }
  }, [])

  // ── 2. Fetch Code Preview (Manual Code Entry) ────────────────────────────
  const verifyCode = useCallback(async (codeToVerify: string) => {
    const clean = codeToVerify.trim().toUpperCase()
    if (!clean) return

    setLoadingCodePreview(true)
    setCodePreviewError(null)
    setErrorMessage(null)

    try {
      sessionStorage.setItem('festflow_pending_join_code', clean)
    } catch {
      // ignore
    }

    const res = await getTeamPreview(clean)
    setLoadingCodePreview(false)

    if (res.success && res.preview) {
      setCodePreview(res.preview)
    } else {
      setCodePreview(null)
      setCodePreviewError(res.message || 'Invalid or expired team invitation code.')
    }
  }, [])

  // ── 3. Initialize & Populate User Defaults ──────────────────────────────
  useEffect(() => {
    setStudentName(profile?.display_name || user?.user_metadata?.display_name || '')
    setCollegeName(studentProfile?.college_name || user?.user_metadata?.college || '')
    setCollegeId((studentProfile as any)?.college_id || (user?.user_metadata as any)?.college_id || null)
    setPhone(user?.user_metadata?.phone || '')

    if (tokenParam) {
      setToken(tokenParam)
      fetchTokenPreview(tokenParam)
    } else if (initialCode) {
      setCode(initialCode)
      verifyCode(initialCode)
    }
  }, [fetchTokenPreview, initialCode, profile, studentProfile, tokenParam, user, verifyCode])

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    verifyCode(code)
  }

  // ── 4. Determine Active Preview & Recipient Match ─────────────────────────
  const activePreview = tokenPreview || codePreview
  const userEmail = (user?.email || '').toLowerCase().trim()
  const recipientEmail = (tokenPreview?.recipient_email || '').toLowerCase().trim()

  const isEmailMatched = Boolean(
    !tokenPreview ||
    tokenPreview.is_recipient_matched ||
    (userEmail && recipientEmail && userEmail === recipientEmail)
  )

  const hasEmailMismatch = Boolean(
    user &&
    tokenPreview &&
    !isEmailMatched &&
    (tokenPreview.recipient_email || tokenPreview.masked_email)
  )

  const handleSwitchAccount = async () => {
    await signOut()
    const redirectUrl = window.location.pathname + window.location.search
    navigate(`/student/login?redirect=${encodeURIComponent(redirectUrl)}`)
  }

  // ── 5. Handle Join / Accept ──────────────────────────────────────────────
  const handleJoin = async () => {
    const currentRedirect = window.location.pathname + window.location.search

    if (!user) {
      if (token) {
        sessionStorage.setItem('festflow_pending_team_token', token)
      } else if (code) {
        sessionStorage.setItem('festflow_pending_join_code', code)
      }
      navigate(`/student/login?redirect=${encodeURIComponent(currentRedirect)}`)
      return
    }

    if (hasEmailMismatch) {
      setErrorMessage(
        `This invitation was issued to ${tokenPreview?.recipient_email || tokenPreview?.masked_email}. Please switch to that account to accept.`
      )
      return
    }

    if (!studentName.trim()) {
      setErrorMessage('Please enter your full student name.')
      return
    }

    if (phone.trim() && !/^[0-9+\-\s]{8,15}$/.test(phone.trim())) {
      setErrorMessage('Please enter a valid phone number (8-15 digits).')
      return
    }

    setIsJoining(true)
    setErrorMessage(null)

    const participantDetails = {
      student_name: studentName.trim(),
      college_name: collegeName.trim() || undefined,
      college_id: collegeId || undefined,
      phone: phone.trim() || undefined,
      id_card_number: idCardNumber.trim() || undefined,
    }

    let res: TeamJoinResponse

    if (token) {
      // Secure, single-use token acceptance via Migration 025 RPC
      res = await acceptTeamInvitation({
        token,
        participantDetails,
      })
    } else {
      // Code-based join fallback
      res = await joinTeam({
        inviteCode: code,
        userId: user.id,
        userEmail: user.email || '',
        participantDetails,
      })
    }

    setIsJoining(false)

    if (res.success) {
      setJoinResult(res)
      try {
        sessionStorage.removeItem('festflow_pending_team_token')
        sessionStorage.removeItem('festflow_pending_join_code')
      } catch {
        // ignore
      }
    } else {
      setErrorMessage(res.message || 'Failed to join team.')
    }
  }

  // ── 6. Handle Decline ────────────────────────────────────────────────────
  const handleDecline = async () => {
    if (!token) return
    setIsDeclining(true)
    setErrorMessage(null)

    const res = await declineTeamInvitation({ token })
    setIsDeclining(false)

    if (res.success) {
      setDeclined(true)
      setShowDeclineConfirm(false)
      try {
        sessionStorage.removeItem('festflow_pending_team_token')
      } catch {
        // ignore
      }
    } else {
      setErrorMessage(res.message || 'Failed to decline squad invitation.')
    }
  }

  return (
    <PageShell>
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6 text-left">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Link
            to="/discover"
            className="hover:text-gray-900 transition-colors flex items-center gap-1"
          >
            <ArrowLeft size={14} /> Discover
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Join Event Squad</span>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
            <Users size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-gray-900">
              {token ? 'Squad Invitation' : 'Join an Event Squad'}
            </h1>
            <p className="text-xs text-gray-600 mt-0.5">
              {token
                ? 'Review your team invitation details and claim your digital pass'
                : 'Enter your squad invitation code to verify your team and claim your pass'}
            </p>
          </div>
        </div>

        {errorMessage && (
          <Alert variant="error" dismissible onDismiss={() => setErrorMessage(null)}>
            {errorMessage}
          </Alert>
        )}

        {/* ── State 1: Token Loading ──────────────────────────────────────── */}
        {tokenLoading && (
          <Card className="p-8 flex flex-col items-center justify-center text-center gap-3 bg-white border border-gray-200 rounded-2xl">
            <div className="w-10 h-10 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            <p className="text-xs text-gray-500">Verifying squad invitation link...</p>
          </Card>
        )}

        {/* ── State 2: Token Error (Revoked / Expired / Reused / Invalid) ──── */}
        {!tokenLoading && tokenError && (
          <Card className="p-6 sm:p-8 flex flex-col items-center text-center gap-4 bg-white border border-rose-200 shadow-xs rounded-2xl">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
              <AlertCircle size={30} />
            </div>

            <div>
              <h2 className="text-lg font-bold font-display text-gray-900">
                {tokenError.code === 'INVITATION_REVOKED'
                  ? 'Invitation Revoked'
                  : tokenError.code === 'ALREADY_ACCEPTED'
                    ? 'Invitation Already Claimed'
                    : tokenError.code === 'INVITATION_EXPIRED'
                      ? 'Invitation Expired'
                      : 'Invalid Invitation'}
              </h2>
              <p className="text-xs text-gray-600 mt-1.5 max-w-md leading-relaxed">
                {tokenError.message}
              </p>
            </div>

            <div className="w-full flex flex-col sm:flex-row gap-3 pt-2">
              <Link to="/discover" className="flex-1">
                <Button variant="primary" size="md" className="w-full">
                  Browse Events
                </Button>
              </Link>
              <Button
                variant="outline"
                size="md"
                className="flex-1"
                onClick={() => {
                  setToken('')
                  setTokenError(null)
                  navigate('/join-team', { replace: true })
                }}
              >
                Enter Code Manually
              </Button>
            </div>
          </Card>
        )}

        {/* ── State 3: Successfully Joined Confirmation ──────────────────── */}
        {joinResult && (
          <Card className="p-6 sm:p-8 flex flex-col items-center text-center gap-4 bg-white border border-gray-200 shadow-xs rounded-2xl">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
              <CheckCircle2 size={34} />
            </div>

            <div>
              <h2 className="text-xl font-bold font-display text-gray-900">
                You're in the squad!
              </h2>
              <p className="text-xs text-gray-600 mt-1">
                Your spot in <strong className="text-blue-600">{joinResult.team_name}</strong> is confirmed.
              </p>
            </div>

            <div className="w-full p-4 rounded-xl bg-gray-50 border border-gray-200 flex flex-col gap-2.5 text-xs text-left">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Squad Name:</span>
                <span className="font-bold text-gray-900">{joinResult.team_name}</span>
              </div>
              {activePreview?.event_title && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Event:</span>
                  <span className="text-gray-900 font-medium truncate max-w-[220px]">
                    {activePreview.event_title}
                  </span>
                </div>
              )}
              {joinResult.ticket_code && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Your Digital Pass:</span>
                  <span className="font-mono font-bold text-blue-600">
                    {joinResult.ticket_code}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Confirmed Members:</span>
                <Badge variant="indigo">{joinResult.member_count} Members</Badge>
              </div>
            </div>

            <div className="w-full flex flex-col sm:flex-row gap-3 pt-2">
              {joinResult.registration_id ? (
                <Link to={`/student/tickets/${joinResult.registration_id}`} className="flex-1">
                  <Button variant="primary" size="lg" className="w-full" leftIcon={<Ticket size={16} />}>
                    View Digital Pass
                  </Button>
                </Link>
              ) : (
                <Link to="/student/dashboard" className="flex-1">
                  <Button variant="primary" size="lg" className="w-full">
                    Go to Dashboard
                  </Button>
                </Link>
              )}

              {activePreview?.event_slug && (
                <Link to={`/events/${activePreview.event_slug}`} className="flex-1">
                  <Button variant="outline" size="lg" className="w-full">
                    Event Details
                  </Button>
                </Link>
              )}
            </div>
          </Card>
        )}

        {/* ── State 3B: Declined Confirmation ───────────────────────────── */}
        {declined && (
          <Card className="p-6 sm:p-8 flex flex-col items-center text-center gap-4 bg-white border border-gray-200 shadow-xs rounded-2xl">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
              <XCircle size={34} />
            </div>

            <div>
              <h2 className="text-xl font-bold font-display text-gray-900">
                Squad Invitation Declined
              </h2>
              <p className="text-xs text-gray-600 mt-1.5 max-w-sm leading-relaxed">
                You have declined the squad invitation for <strong className="text-gray-900">{activePreview?.team_name || 'the team'}</strong>.
                The squad leader has been notified. You can still discover and register for other exciting campus events.
              </p>
            </div>

            <div className="w-full flex flex-col sm:flex-row gap-3 pt-2">
              <Link to="/discover" className="flex-1">
                <Button variant="primary" size="md" className="w-full">
                  Browse Events
                </Button>
              </Link>
              <Link to="/student/dashboard" className="flex-1">
                <Button variant="outline" size="md" className="w-full">
                  Student Dashboard
                </Button>
              </Link>
            </div>
          </Card>
        )}

        {/* ── State 4: Normal Invitation / Verification Form ─────────────── */}
        {!tokenLoading && !tokenError && !joinResult && !declined && (
          <div className="p-5 sm:p-6 bg-white border border-gray-200 shadow-xs rounded-2xl flex flex-col gap-5">
            {/* If NO token provided, allow code input */}
            {!token && (
              <form onSubmit={handleVerifySubmit} className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-900 flex items-center justify-between">
                  <span>Invitation Code</span>
                  <span className="text-[11px] text-gray-500 font-normal">
                    Format: TF-XXXXXX
                  </span>
                </label>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. TF-8K9N2P"
                    maxLength={15}
                    className="flex-1 px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 font-mono text-base tracking-wider uppercase placeholder:normal-case placeholder:tracking-normal placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-all min-h-[44px]"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    className="w-full sm:w-auto shrink-0 min-h-[44px]"
                    isLoading={loadingCodePreview}
                    disabled={!code.trim() || loadingCodePreview}
                  >
                    Verify Code
                  </Button>
                </div>

                {codePreviewError && (
                  <p className="text-xs text-rose-600 flex items-center gap-1.5 mt-1">
                    <AlertCircle size={13} /> {codePreviewError}
                  </p>
                )}
              </form>
            )}

            {/* Team Safe Preview */}
            <AnimatePresence>
              {activePreview && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-xl bg-gray-50 border border-blue-200 flex flex-col overflow-hidden"
                >
                  {/* Event Poster Card if available */}
                  {activePreview.poster_url && (
                    <div className="relative w-full h-44 sm:h-52 bg-gray-100 overflow-hidden">
                      <img
                        src={activePreview.poster_url}
                        alt={activePreview.event_title}
                        className="w-full h-full object-cover object-center"
                      />
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs">
                        <Badge variant="info" className="text-[10px] uppercase font-bold py-0.5 shadow-sm">
                          {activePreview.event_category || 'Featured Event'}
                        </Badge>
                        {activePreview.venue_name && (
                          <span className="flex items-center gap-1 text-[11px] text-gray-900 bg-white/95 border border-gray-200 px-2.5 py-1 rounded-full shadow-xs">
                            <MapPin size={12} className="text-blue-600" />
                            {activePreview.venue_name}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="p-4 sm:p-5 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-600">
                          Verified Squad Invitation
                        </span>
                        <h3 className="text-lg font-bold text-gray-900 font-heading mt-0.5">
                          {activePreview.team_name}
                        </h3>
                        <p className="text-xs text-gray-600 mt-0.5 font-sans">
                          Invited by Team Leader <strong className="text-gray-900">{activePreview.leader_name}</strong>
                        </p>
                      </div>

                      <Badge variant={activePreview.is_full ? 'danger' : 'success'}>
                        {activePreview.is_full ? 'Team Full' : `${activePreview.current_size}/${activePreview.max_size} Joined`}
                      </Badge>
                    </div>

                    <div className="pt-2 border-t border-gray-200 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500 flex items-center gap-1 mb-0.5">
                          <Ticket size={12} className="text-blue-600" /> Event
                        </span>
                        <span className="font-medium text-gray-900 truncate block">
                          {activePreview.event_title}
                        </span>
                      </div>

                      <div>
                        <span className="text-gray-500 flex items-center gap-1 mb-0.5">
                          <Calendar size={12} className="text-blue-600" /> Pass Status
                        </span>
                        <span className="font-medium text-gray-900">
                          {activePreview.is_free ? 'Free Entry' : `₹${activePreview.price} Pass`}
                        </span>
                      </div>
                    </div>

                    {activePreview.venue_name && !activePreview.poster_url && (
                      <div className="pt-2 border-t border-gray-200 text-xs">
                        <span className="text-gray-500 flex items-center gap-1 mb-0.5">
                          <MapPin size={12} className="text-blue-600" /> Venue
                        </span>
                        <span className="font-medium text-gray-900">
                          {activePreview.venue_name}
                        </span>
                      </div>
                    )}

                    {/* Recipient Context if Token Preview */}
                    {tokenPreview && (
                      <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-xs">
                        <span className="text-gray-500 flex items-center gap-1.5">
                          <Mail size={12} /> Recipient
                        </span>
                        <span className="font-medium text-gray-900">
                          {tokenPreview.recipient_email || tokenPreview.masked_email}
                        </span>
                      </div>
                    )}

                    {activePreview.is_full && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                        <AlertCircle size={15} />
                        <span>This squad has reached its maximum size of {activePreview.max_size} members.</span>
                      </div>
                    )}

                    {'is_open' in activePreview && !activePreview.is_open && (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                        <Clock size={15} />
                        <span>Registration for this event is closed or past the deadline.</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Recipient Account Mismatch Warning */}
            {hasEmailMismatch && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col gap-3 text-xs text-amber-800">
                <div className="flex items-center gap-2 font-semibold text-amber-900">
                  <AlertTriangle size={16} />
                  <span>Account Mismatch</span>
                </div>
                <p className="leading-relaxed">
                  This squad invitation was sent to{' '}
                  <strong className="text-gray-900">
                    {tokenPreview?.recipient_email || tokenPreview?.masked_email}
                  </strong>
                  . You are currently signed in as <strong className="text-gray-900">{user?.email}</strong>.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSwitchAccount}
                    leftIcon={<LogOut size={13} />}
                  >
                    Switch Account
                  </Button>
                </div>
              </div>
            )}

            {/* Attendee Form / Join Action */}
            {activePreview && !activePreview.is_full && (
              <div className="flex flex-col gap-3 pt-2 border-t border-gray-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600">
                  Your Attendee Information
                </h4>

                {!user ? (
                  <div className="p-5 rounded-xl bg-gray-50 border border-gray-200 flex flex-col items-center text-center gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        Sign in to claim your spot
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        Sign in with your student account to join{' '}
                        <strong className="text-blue-600">{activePreview.team_name}</strong>.
                      </p>
                    </div>

                    <div className="w-full flex flex-col sm:flex-row gap-2.5">
                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        className="flex-1"
                        onClick={handleJoin}
                        rightIcon={<ArrowRight size={14} />}
                      >
                        Sign In as Student
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        className="flex-1"
                        onClick={() => {
                          const currentRedirect = window.location.pathname + window.location.search
                          if (token) {
                            sessionStorage.setItem('festflow_pending_team_token', token)
                          }
                          navigate(`/student/signup?redirect=${encodeURIComponent(currentRedirect)}`)
                        }}
                      >
                        Create Student Account
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Signed-in verified status badge */}
                    {isEmailMatched && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
                        <ShieldCheck size={15} />
                        <span>
                          Signed in as <strong>{user.email}</strong> (Verified recipient)
                        </span>
                      </div>
                    )}

                    <div>
                      <label className="text-xs text-gray-700 font-medium mb-1 block">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="Your full student name"
                        disabled={hasEmailMismatch}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <CollegeSearchCombobox
                        label="College / Institute"
                        placeholder="Search verified college (e.g. Anurag, CBIT, VNR, JNTUH)..."
                        selectedCollegeId={collegeId}
                        selectedCollegeName={collegeName}
                        disabled={hasEmailMismatch}
                        required={false}
                        onSelect={(col, rawName) => {
                          if (col) {
                            setCollegeId(col.id)
                            setCollegeName(col.official_name || col.name)
                          } else {
                            setCollegeId(null)
                            setCollegeName(rawName || '')
                          }
                        }}
                        helperText="Search from verified Telangana higher education directory or enter custom"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-700 font-medium mb-1 block">
                          Contact Phone
                        </label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Phone number"
                          disabled={hasEmailMismatch}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 disabled:opacity-50"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-gray-700 font-medium mb-1 block">
                          Student ID / Roll Number
                        </label>
                        <input
                          type="text"
                          value={idCardNumber}
                          onChange={(e) => setIdCardNumber(e.target.value)}
                          placeholder="Campus ID / Roll number"
                          disabled={hasEmailMismatch}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 disabled:opacity-50"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="lg"
                        className="flex-1"
                        isLoading={isJoining}
                        disabled={isJoining || hasEmailMismatch}
                        onClick={handleJoin}
                        rightIcon={<CheckCircle2 size={16} />}
                      >
                        {token ? 'Accept Invitation & Claim Pass' : 'Confirm & Join Squad'}
                      </Button>

                      {token && (
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 text-xs sm:w-auto"
                          disabled={isJoining || isDeclining}
                          onClick={() => setShowDeclineConfirm(true)}
                        >
                          Decline
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Decline Confirmation Modal ─────────────────────────────────── */}
        <Modal
          isOpen={showDeclineConfirm}
          onClose={() => setShowDeclineConfirm(false)}
          title="Decline Squad Invitation"
          size="sm"
        >
          <div className="flex flex-col gap-4 text-left p-5">
            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to decline joining <strong className="text-gray-900">{activePreview?.team_name || 'this team'}</strong> for <strong className="text-gray-900">{activePreview?.event_title || 'this event'}</strong>?
              The squad leader will be notified and this invitation link will be cancelled.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowDeclineConfirm(false)}
                disabled={isDeclining}
              >
                Keep Invitation
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleDecline}
                isLoading={isDeclining}
                disabled={isDeclining}
              >
                Yes, Decline Invitation
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </PageShell>
  )
}
