import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { Button, Badge, Alert, Card } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { getTeamPreview, joinTeam } from '@/lib/teams'
import type { TeamPreview, TeamJoinResponse } from '@/types'
import { useAuth } from '@/context/AuthContext'

export default function JoinTeamPage() {
  const { code: routeCode } = useParams<{ code?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, profile, studentProfile } = useAuth()

  const initialCode = (routeCode || searchParams.get('code') || '').toUpperCase().trim()

  const [code, setCode] = useState(initialCode)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [preview, setPreview] = useState<TeamPreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Participant form fields
  const [studentName, setStudentName] = useState('')
  const [collegeName, setCollegeName] = useState('')
  const [phone, setPhone] = useState('')
  const [idCardNumber, setIdCardNumber] = useState('')

  // Submit states
  const [isJoining, setIsJoining] = useState(false)
  const [joinResult, setJoinResult] = useState<TeamJoinResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const verifyCode = async (codeToVerify: string) => {
    const clean = codeToVerify.trim().toUpperCase()
    if (!clean) return

    setLoadingPreview(true)
    setPreviewError(null)
    setErrorMessage(null)

    const res = await getTeamPreview(clean)
    setLoadingPreview(false)

    if (res.success && res.preview) {
      setPreview(res.preview)
    } else {
      setPreview(null)
      setPreviewError(res.message || 'Invalid or expired team invitation code.')
    }
  }

  useEffect(() => {
    setStudentName(profile?.display_name || user?.user_metadata?.display_name || '')
    setCollegeName(studentProfile?.college_name || user?.user_metadata?.college || '')
    setPhone(user?.user_metadata?.phone || '')

    if (initialCode) {
      setCode(initialCode)
      verifyCode(initialCode)
    }
  }, [initialCode, profile, studentProfile, user])

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    verifyCode(code)
  }

  const handleJoin = async () => {
    if (!user) {
      sessionStorage.setItem('festflow_pending_join_code', code)
      navigate(`/student/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`)
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

    const res = await joinTeam({
      inviteCode: code,
      userId: user.id,
      userEmail: user.email || '',
      participantDetails: {
        student_name: studentName.trim(),
        college_name: collegeName.trim() || undefined,
        phone: phone.trim() || undefined,
        id_card_number: idCardNumber.trim() || undefined,
      },
    })

    setIsJoining(false)

    if (res.success) {
      setJoinResult(res)
    } else {
      setErrorMessage(res.message || 'Failed to join team.')
    }
  }

  return (
    <PageShell>
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-6 text-left">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <Link to="/discover" className="hover:text-[var(--color-text-primary)] transition-colors flex items-center gap-1">
            <ArrowLeft size={14} /> Discover
          </Link>
          <span>/</span>
          <span className="text-[var(--color-text-primary)] font-medium">Join Event Squad</span>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-[var(--color-brand-purple)]/25 to-[var(--color-brand-cyan)]/25 text-[var(--color-brand-purple)] shadow-md">
            <Users size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-[var(--color-text-primary)]">
              Join an Event Squad
            </h1>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Enter your team invitation code to verify your squad and claim your pass
            </p>
          </div>
        </div>

        {errorMessage && (
          <Alert variant="error" dismissible onDismiss={() => setErrorMessage(null)}>
            {errorMessage}
          </Alert>
        )}

        {joinResult ? (
          <Card className="p-6 flex flex-col items-center text-center gap-4 bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.15)] shadow-xl rounded-3xl">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-lg">
              <CheckCircle2 size={36} />
            </div>

            <div>
              <h2 className="text-xl font-bold font-display text-[var(--color-text-primary)]">
                You're in the squad!
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                Your spot in <strong className="text-[var(--color-brand-purple)]">{joinResult.team_name}</strong> is confirmed.
              </p>
            </div>

            <div className="w-full p-4 rounded-2xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.08)] flex flex-col gap-2.5 text-xs text-left">
              <div className="flex justify-between items-center">
                <span className="text-[var(--color-text-muted)]">Team:</span>
                <span className="font-bold text-[var(--color-text-primary)]">{joinResult.team_name}</span>
              </div>
              {preview?.event_title && (
                <div className="flex justify-between items-center">
                  <span className="text-[var(--color-text-muted)]">Event:</span>
                  <span className="text-[var(--color-text-primary)] font-medium truncate max-w-[220px]">
                    {preview.event_title}
                  </span>
                </div>
              )}
              {joinResult.ticket_code && (
                <div className="flex justify-between items-center">
                  <span className="text-[var(--color-text-muted)]">Ticket Code:</span>
                  <span className="font-mono font-bold text-[var(--color-brand-cyan)]">
                    {joinResult.ticket_code}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-[var(--color-text-muted)]">Confirmed Members:</span>
                <Badge variant="purple">{joinResult.member_count} Members</Badge>
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

              {preview?.event_slug && (
                <Link to={`/events/${preview.event_slug}`} className="flex-1">
                  <Button variant="outline" size="lg" className="w-full">
                    Event Details
                  </Button>
                </Link>
              )}
            </div>
          </Card>
        ) : (
          <Card className="p-5 sm:p-6 bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.12)] shadow-xl rounded-3xl flex flex-col gap-5">
            {/* Code Verification Input */}
            <form onSubmit={handleVerifySubmit} className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center justify-between">
                <span>Invitation Code</span>
                <span className="text-[11px] text-[var(--color-text-muted)] font-normal">
                  Format: TF-XXXXXX
                </span>
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. TF-8K9N2P"
                  maxLength={15}
                  className="flex-1 px-4 py-3 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.12)] text-[var(--color-text-primary)] font-mono text-base tracking-wider uppercase placeholder:normal-case placeholder:tracking-normal placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-purple)] transition-all"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={loadingPreview}
                  disabled={!code.trim() || loadingPreview}
                >
                  Verify Code
                </Button>
              </div>

              {previewError && (
                <p className="text-xs text-rose-400 flex items-center gap-1.5 mt-1">
                  <AlertCircle size={13} /> {previewError}
                </p>
              )}
            </form>

            {/* Team Safe Preview */}
            <AnimatePresence>
              {preview && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 rounded-2xl bg-[var(--color-surface-2)]/90 border border-[var(--color-brand-purple)]/30 flex flex-col gap-3 shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-brand-purple)]">
                        Verified Squad
                      </span>
                      <h3 className="text-base font-bold text-[var(--color-text-primary)] mt-0.5">
                        {preview.team_name}
                      </h3>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        Led by <strong className="text-[var(--color-text-secondary)]">{preview.leader_name}</strong>
                      </p>
                    </div>

                    <Badge variant={preview.is_full ? 'danger' : 'success'}>
                      {preview.is_full ? 'Team Full' : `${preview.current_size}/${preview.max_size} Joined`}
                    </Badge>
                  </div>

                  <div className="pt-2 border-t border-[var(--color-surface-3)] grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[var(--color-text-muted)] flex items-center gap-1 mb-0.5">
                        <Ticket size={12} /> Event
                      </span>
                      <span className="font-medium text-[var(--color-text-primary)] truncate block">
                        {preview.event_title}
                      </span>
                    </div>

                    <div>
                      <span className="text-[var(--color-text-muted)] flex items-center gap-1 mb-0.5">
                        <Calendar size={12} /> Status
                      </span>
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {preview.is_free ? 'Free Entry' : `₹${preview.price} Pass`}
                      </span>
                    </div>
                  </div>

                  {preview.is_full && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
                      <AlertCircle size={15} />
                      <span>This squad has reached its maximum size of {preview.max_size} members.</span>
                    </div>
                  )}

                  {!preview.is_open && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
                      <Clock size={15} />
                      <span>Registration for this event is closed or past the deadline.</span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Attendee Form */}
            {preview && !preview.is_full && preview.is_open && (
              <div className="flex flex-col gap-3 pt-2 border-t border-[var(--color-surface-3)]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Your Attendee Information
                </h4>

                {!user ? (
                  <div className="p-4 rounded-2xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.08)] flex flex-col items-center text-center gap-3">
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Please sign in with your student account to join <strong>{preview.team_name}</strong>.
                    </p>
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={handleJoin}
                      rightIcon={<ArrowRight size={14} />}
                    >
                      Sign In to Join Squad
                    </Button>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-xs text-[var(--color-text-secondary)] font-medium mb-1 block">
                        Full Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="Your full student name"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.1)] text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-purple)]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-[var(--color-text-secondary)] font-medium mb-1 block">
                          College / Institute
                        </label>
                        <input
                          type="text"
                          value={collegeName}
                          onChange={(e) => setCollegeName(e.target.value)}
                          placeholder="College name"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.1)] text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-purple)]"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-[var(--color-text-secondary)] font-medium mb-1 block">
                          Contact Phone
                        </label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Phone number"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.1)] text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-purple)]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-[var(--color-text-secondary)] font-medium mb-1 block">
                        Student ID / Roll Number
                      </label>
                      <input
                        type="text"
                        value={idCardNumber}
                        onChange={(e) => setIdCardNumber(e.target.value)}
                        placeholder="Campus ID / Roll number"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.1)] text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-purple)]"
                      />
                    </div>

                    <Button
                      type="button"
                      variant="primary"
                      size="lg"
                      className="w-full mt-2"
                      isLoading={isJoining}
                      disabled={isJoining}
                      onClick={handleJoin}
                      rightIcon={<CheckCircle2 size={16} />}
                    >
                      Confirm & Join Squad
                    </Button>
                  </>
                )}
              </div>
            )}
          </Card>
        )}
      </div>
    </PageShell>
  )
}
