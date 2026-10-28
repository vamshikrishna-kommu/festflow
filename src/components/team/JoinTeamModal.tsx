import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Ticket,
  Clock,
  Calendar,
  X,
} from 'lucide-react'
import { Button, Badge, Alert } from '@/components/ui'
import { Link, useNavigate } from 'react-router'
import { getTeamPreview, joinTeam } from '@/lib/teams'
import type { TeamPreview, TeamJoinResponse } from '@/types'
import { useAuth } from '@/context/AuthContext'

interface JoinTeamModalProps {
  isOpen: boolean
  onClose: () => void
  initialCode?: string
  onJoinedSuccess?: (res: TeamJoinResponse) => void
}

export function JoinTeamModal({
  isOpen,
  onClose,
  initialCode = '',
  onJoinedSuccess,
}: JoinTeamModalProps) {
  const { user, profile, studentProfile } = useAuth()
  const navigate = useNavigate()

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

  // Initialize form state when user changes or modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialCode) {
        setCode(initialCode.toUpperCase().trim())
        fetchPreview(initialCode.toUpperCase().trim())
      }
      setStudentName(profile?.display_name || user?.user_metadata?.display_name || '')
      setCollegeName(studentProfile?.college_name || user?.user_metadata?.college || '')
      setPhone(user?.user_metadata?.phone || '')
      setErrorMessage(null)
      setJoinResult(null)
    }
  }, [isOpen, initialCode, profile, studentProfile, user])

  const fetchPreview = async (codeToVerify: string) => {
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

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchPreview(code)
  }

  const handleJoin = async () => {
    if (!user) {
      // Save code in session so student returns to this team after login
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
      if (onJoinedSuccess) onJoinedSuccess(res)
    } else {
      setErrorMessage(res.message || 'Unable to join team.')
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
        className="w-full max-w-lg rounded-3xl glass border border-[oklch(100%_0_0_/_0.15)] shadow-2xl bg-gradient-to-b from-[var(--color-surface-1)] to-[var(--color-surface-0)] text-left relative overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[var(--color-surface-3)] shrink-0 bg-[var(--color-surface-1)]/80 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[var(--color-brand-purple)]/20 to-[var(--color-brand-cyan)]/20 text-[var(--color-brand-purple)]">
              <Users size={20} />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-[var(--color-text-primary)]">
                Join Event Squad
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Enter your squad's invite code to claim your spot
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

        {/* Modal Content */}
        <div className="p-4 sm:p-6 flex flex-col gap-5 max-h-[75vh] overflow-y-auto">
          {/* Error Alert */}
          {errorMessage && (
            <Alert variant="error" dismissible onDismiss={() => setErrorMessage(null)}>
              {errorMessage}
            </Alert>
          )}

          {/* Success Screen */}
          {joinResult ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center gap-4 py-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-lg">
                <CheckCircle2 size={36} />
              </div>

              <div>
                <h4 className="font-display font-bold text-lg text-[var(--color-text-primary)]">
                  You're in the squad!
                </h4>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-sm">
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

              <div className="w-full flex flex-col gap-2 pt-2">
                {joinResult.registration_id ? (
                  <Link to={`/student/tickets/${joinResult.registration_id}`} className="w-full" onClick={onClose}>
                    <Button variant="primary" size="lg" className="w-full" leftIcon={<Ticket size={16} />}>
                      View Digital Pass
                    </Button>
                  </Link>
                ) : (
                  <Link to="/student/dashboard" className="w-full" onClick={onClose}>
                    <Button variant="primary" size="lg" className="w-full">
                      Go to Dashboard
                    </Button>
                  </Link>
                )}

                <Button variant="ghost" size="md" onClick={onClose} className="w-full">
                  Dismiss
                </Button>
              </div>
            </motion.div>
          ) : (
            <>
              {/* Step 1: Code Input Form */}
              <form onSubmit={handleCodeSubmit} className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center justify-between">
                  <span>Squad Invitation Code</span>
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
                    className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.12)] text-[var(--color-text-primary)] font-mono text-sm tracking-wider uppercase placeholder:normal-case placeholder:tracking-normal placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-purple)] transition-all"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={loadingPreview}
                    disabled={!code.trim() || loadingPreview}
                  >
                    Verify
                  </Button>
                </div>

                {previewError && (
                  <p className="text-xs text-rose-400 flex items-center gap-1.5 mt-1">
                    <AlertCircle size={13} /> {previewError}
                  </p>
                )}
              </form>

              {/* Step 2: Safe Team Preview (No Private Information Leaked) */}
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
                          Verified Team
                        </span>
                        <h4 className="text-base font-bold text-[var(--color-text-primary)] mt-0.5">
                          {preview.team_name}
                        </h4>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          Led by <strong className="text-[var(--color-text-secondary)]">{preview.leader_name}</strong>
                        </p>
                      </div>

                      <Badge variant={preview.is_full ? 'danger' : 'success'}>
                        {preview.is_full
                          ? 'Team Full'
                          : `${preview.current_size}/${preview.max_size} Joined`}
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
                        <span>This team is at maximum capacity ({preview.max_size} members).</span>
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

              {/* Step 3: Attendee Details Form */}
              {preview && !preview.is_full && preview.is_open && (
                <div className="flex flex-col gap-3 pt-1 border-t border-[var(--color-surface-3)]">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    Your Attendee Information
                  </h5>

                  {!user ? (
                    <div className="p-4 rounded-2xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.08)] flex flex-col items-center text-center gap-3">
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        Sign in to claim your spot in <strong>{preview.team_name}</strong>.
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
                          placeholder="Your official student name"
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
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
