import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router'
import { motion } from 'motion/react'
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  ShieldCheck,
  Building2,
  Share2,
  ArrowLeft,
  AlertTriangle,
  AlertCircle,
  Compass,
  CheckCircle2,
  Ticket,
  Sparkles,
  Info,
  Globe,
  Mail,
  Phone,
  FileText,
  UserCheck,
  HelpCircle,
} from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Button, Badge, CategoryBadge, Card, Modal, ModalBody, ModalFooter, Alert } from '@/components/ui'
import { getEventBySlug, CATEGORY_POSTERS } from '@/lib/events'
import { checkStudentRegistrationForEvent, cancelRegistration } from '@/lib/registrations'
import { subscribeToStatusChanges } from '@/lib/sync'
import { useAuth } from '@/context/AuthContext'
import { fadeIn } from '@/lib/animations'
import { EventRegistrationModal } from '@/components/events/EventRegistrationModal'
import { JoinTeamModal } from '@/components/team/JoinTeamModal'
import type { EventWithClub, RegistrationRecord } from '@/types'

export default function EventDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, studentProfile, role } = useAuth()

  const [event, setEvent] = useState<EventWithClub | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [bannerImgError, setBannerImgError] = useState(false)

  // Registration flow state
  const [existingReg, setExistingReg] = useState<RegistrationRecord | null>(null)
  const [checkingReg, setCheckingReg] = useState(false)
  const [showRegModal, setShowRegModal] = useState(false)
  const [showClubNotice, setShowClubNotice] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [initialJoinCode, setInitialJoinCode] = useState('')

  // Student Cancellation state
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null)

  // Listen for ?join=1 or ?code=XYZ in URL to auto-open Join Team modal
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const joinParam = params.get('join')
    const codeParam = params.get('code')
    if (joinParam || codeParam) {
      if (codeParam) setInitialJoinCode(codeParam.toUpperCase().trim())
      setShowJoinModal(true)
    }
  }, [location.search])

  // Load event by slug
  useEffect(() => {
    if (!slug) return
    let mounted = true
    setLoading(true)
    setError(null)

    getEventBySlug(slug).then((res) => {
      if (!mounted) return
      setLoading(false)
      if (res.error || !res.event) {
        setError(res.error || 'Event could not be found.')
      } else {
        setEvent(res.event)
      }
    })

    return () => {
      mounted = false
    }
  }, [slug])

  // Check if current logged-in student has already registered
  const refreshRegistration = () => {
    if (!event || !user || role !== 'student') return
    setCheckingReg(true)

    checkStudentRegistrationForEvent(event.id, user.id).then((res) => {
      setCheckingReg(false)
      if (res.registered && res.registration) {
        setExistingReg(res.registration)
      } else {
        setExistingReg(null)
      }
    })
  }

  useEffect(() => {
    refreshRegistration()

    const unsubscribe = subscribeToStatusChanges(
      ['registration_updated', 'ticket_updated', 'payment_reviewed', 'reconnect'],
      (e) => {
        if (!e.eventId || (event && e.eventId === event.id)) {
          refreshRegistration()
        }
      }
    )
    return () => unsubscribe()
  }, [event, user, role])

  const handleCancelRegistration = async () => {
    if (!existingReg) return
    setCancelling(true)
    setCancelError(null)

    const res = await cancelRegistration(existingReg.id, cancelReason)
    setCancelling(false)

    if (res.success) {
      setExistingReg(null)
      setShowCancelModal(false)
      setCancelReason('')
      setCancelSuccess('Your registration has been cancelled and seat returned to capacity.')
      setTimeout(() => setCancelSuccess(null), 6000)
    } else {
      setCancelError(res.message || 'Failed to cancel registration.')
    }
  }

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  // CTA Click Handler
  const handleCtaClick = () => {
    if (!user) {
      // Direct logged-out user to student login with return path preserved
      navigate('/student/login', {
        state: { from: location.pathname },
      })
      return
    }

    if (role === 'club_member') {
      setShowClubNotice(true)
      return
    }

    if (existingReg) {
      navigate(`/student/tickets/${existingReg.id}`)
      return
    }

    setShowRegModal(true)
  }

  if (loading) {
    return (
      <PageShell>
        <div className="max-w-5xl mx-auto px-4 py-28 flex flex-col items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-[var(--color-surface-3)] border-t-[var(--color-brand-cyan)] animate-spin mb-4" />
          <span className="text-xs text-[var(--color-text-muted)] font-medium">
            Loading event details…
          </span>
        </div>
      </PageShell>
    )
  }

  // Unavailable or Not Found
  if (error || !event) {
    return (
      <PageShell>
        <div className="max-w-xl mx-auto px-4 py-28 text-center flex flex-col items-center glass p-8 rounded-3xl border border-[var(--color-surface-3)] my-12">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mb-4">
            <AlertTriangle size={32} />
          </div>
          <h1 className="text-2xl font-bold font-display text-[var(--color-text-primary)] mb-2">
            Event Not Available
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mb-6 max-w-md leading-relaxed">
            {error || 'This event does not exist, has been removed, or has not yet been published by the campus organizer.'}
          </p>
          <Link to="/discover">
            <Button variant="primary" size="md" leftIcon={<Compass size={16} />}>
              Explore Other Campus Events
            </Button>
          </Link>
        </div>
      </PageShell>
    )
  }

  // Dates formatting
  const startDate = event.start_date ? new Date(event.start_date) : null
  const endDate = event.end_date ? new Date(event.end_date) : null
  const formattedDate = startDate
    ? startDate.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Date TBA'
  const formattedStartTime = startDate
    ? startDate.toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : 'Time TBA'
  const formattedEndTime = endDate
    ? endDate.toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : 'Time TBA'

  const now = new Date()
  const isStarted = startDate ? startDate <= now : false
  const isRegOpenYet = !event.registration_opens_at || new Date(event.registration_opens_at) <= now
  const isRegDeadlinePassed = event.registration_closes_at ? new Date(event.registration_closes_at) < now : false

  const regOpensFormatted = event.registration_opens_at
    ? new Date(event.registration_opens_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null

  const regClosesFormatted = event.registration_closes_at
    ? new Date(event.registration_closes_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null

  const isOwner = user?.id === event.club_id
  const isCancelled = event.status === 'cancelled'
  const isDraft = event.status === 'draft'
  const isRegClosedStatus = event.status === 'registration_closed'
  const isCompleted = event.status === 'completed'

  const canRegister = !isCancelled && !isDraft && !isRegClosedStatus && !isCompleted && isRegOpenYet && !isRegDeadlinePassed && !isStarted

  const cutoffHours = (event as any).cancellation_cutoff_hours ?? 0
  const isCutoffPassed = Boolean(
    cutoffHours > 0 &&
    startDate &&
    startDate.getTime() - Date.now() < cutoffHours * 3600 * 1000
  )
  const isCheckedIn = (existingReg as any)?.attendance_status === 'checked_in' || (existingReg as any)?.attendance_status === 'checked_out'
  const canCancelRegistration = Boolean(
    existingReg &&
    existingReg.status !== 'cancelled' &&
    !isStarted &&
    !isCutoffPassed &&
    !isCheckedIn
  )

  const clubName = event.club?.club_profile?.club_name || event.club?.display_name || 'Campus Club'
  const posterSource = !bannerImgError && event.poster_url ? event.poster_url : (CATEGORY_POSTERS[event.category] || CATEGORY_POSTERS.tech)

  return (
    <PageShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-24 text-left">
        {/* ── Breadcrumb & Utility Bar ──────────────────────────────────────── */}
        <div className="flex items-center justify-between py-4 text-xs text-[var(--color-text-muted)] border-b border-[var(--color-surface-3)] mb-6 flex-wrap gap-2">
          <div className="flex items-center gap-2 truncate">
            <Link to="/discover" className="hover:text-[var(--color-text-primary)] flex items-center gap-1 transition-colors">
              <ArrowLeft size={14} /> Discover
            </Link>
            <span>/</span>
            <span className="capitalize">{event.category}</span>
            <span>/</span>
            <span className="text-[var(--color-text-primary)] font-medium truncate max-w-[200px] sm:max-w-xs">
              {event.title}
            </span>
          </div>

          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all text-xs border border-[oklch(100%_0_0_/_0.06)]"
          >
            {copied ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Share2 size={14} />}
            <span>{copied ? 'Link Copied!' : 'Share Event'}</span>
          </button>
        </div>

        {/* ── Status Notice Banners ────────────────────────────────────────── */}
        {isCancelled && (
          <motion.div
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="mb-6 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-center gap-3 text-sm"
          >
            <AlertTriangle size={20} className="shrink-0" />
            <div>
              <strong className="block font-semibold">Event Cancelled</strong>
              This event has been marked as cancelled by the organizer. Registrations are closed.
            </div>
          </motion.div>
        )}

        {isRegClosedStatus && (
          <motion.div
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="mb-6 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center gap-3 text-sm"
          >
            <AlertTriangle size={20} className="shrink-0" />
            <div>
              <strong className="block font-semibold">Registration Closed</strong>
              The organizer has closed registrations for this event. No new passes can be claimed.
            </div>
          </motion.div>
        )}

        {isCompleted && (
          <motion.div
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="mb-6 p-4 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-300 flex items-center gap-3 text-sm"
          >
            <CheckCircle2 size={20} className="shrink-0" />
            <div>
              <strong className="block font-semibold">Event Concluded</strong>
              This event has successfully concluded. Thank you to all attendees.
            </div>
          </motion.div>
        )}

        {isDraft && (
          <motion.div
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="mb-6 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-between gap-3 text-sm"
          >
            <div className="flex items-center gap-2">
              <Info size={18} className="shrink-0" />
              <span>
                <strong>Draft Preview:</strong> This event is currently a draft and is not visible on the public Discover feed.
              </span>
            </div>
            {isOwner && (
              <Link to={`/club/events/${event.id}/edit`}>
                <Button variant="primary" size="sm">
                  Edit & Publish
                </Button>
              </Link>
            )}
          </motion.div>
        )}

        {/* ── Editorial Hero Poster Banner ─────────────────────────────────── */}
        <div className="relative w-full h-60 sm:h-80 md:h-[420px] rounded-3xl overflow-hidden border border-[var(--color-surface-3)] mb-6 sm:mb-8 shadow-2xl">
          <img
            src={posterSource}
            alt={event.title}
            onError={() => setBannerImgError(true)}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

          {/* Badges Overlay */}
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex flex-wrap gap-1.5 sm:gap-2 max-w-[calc(100%-1.5rem)]">
            <CategoryBadge category={event.category} />
            {event.event_type === 'online' && (
              <Badge variant="cyan" className="text-xs">
                Online Session
              </Badge>
            )}
            {event.event_type === 'hybrid' && (
              <Badge variant="amber" className="text-xs">
                Hybrid Event
              </Badge>
            )}
            {event.event_type === 'offline' && (
              <Badge variant="default" className="text-xs">
                Campus In-Person
              </Badge>
            )}
            {event.participation_type === 'team' && (
              <Badge variant="pink" className="text-xs flex items-center gap-1">
                <Users size={12} /> Team ({event.min_team_size}–{event.max_team_size})
              </Badge>
            )}
            {event.approval_type === 'manual' && (
              <Badge variant="purple" className="text-xs flex items-center gap-1">
                <ShieldCheck size={12} /> Host Approval Req.
              </Badge>
            )}
          </div>

          {/* Title on Poster */}
          <div className="absolute bottom-5 sm:bottom-8 left-5 right-5 sm:left-8 sm:right-8">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold font-display text-white tracking-tight leading-snug drop-shadow-md line-clamp-2">
              {event.title}
            </h1>
            {event.summary && (
              <p className="text-white/85 text-xs sm:text-sm mt-2 max-w-2xl line-clamp-2 leading-relaxed">
                {event.summary}
              </p>
            )}
          </div>
        </div>

        {/* ── Main Content & Registration Layout ───────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Left 2 Cols: Editorial Details */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            {/* Organizer Card */}
            <div className="p-4 sm:p-5 rounded-2xl glass border border-[oklch(100%_0_0_/_0.08)] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--color-brand-cyan)] to-[var(--color-brand-violet)] flex items-center justify-center text-white shrink-0 shadow-md">
                  <Building2 size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm sm:text-base text-[var(--color-text-primary)]">
                      {clubName}
                    </span>
                    <ShieldCheck size={16} className="text-emerald-400" />
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    Official Student Organization Host
                  </span>
                </div>
              </div>

              {isOwner && (
                <div className="flex items-center gap-2">
                  <Link to={`/club/events/${event.id}/registrations`}>
                    <Button variant="outline" size="sm" leftIcon={<Users size={14} />}>
                      Attendees
                    </Button>
                  </Link>
                  <Link to={`/club/events/${event.id}/edit`}>
                    <Button variant="ghost" size="sm">
                      Edit
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Quick Timing & Venue Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="p-4 flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-brand-cyan)] shrink-0">
                  <Calendar size={20} />
                </div>
                <div className="text-xs min-w-0">
                  <span className="text-[var(--color-text-muted)] block mb-0.5">Date & Time</span>
                  <strong className="text-[var(--color-text-primary)] font-semibold block truncate">
                    {formattedDate}
                  </strong>
                  <span className="text-[var(--color-text-secondary)]">
                    {formattedStartTime} – {formattedEndTime} ({event.timezone || 'IST'})
                  </span>
                </div>
              </Card>

              <Card className="p-4 flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-brand-pink)] shrink-0">
                  {event.event_type === 'online' ? <Globe size={20} /> : <MapPin size={20} />}
                </div>
                <div className="text-xs min-w-0">
                  <span className="text-[var(--color-text-muted)] block mb-0.5">
                    {event.event_type === 'online' ? 'Session Format' : 'Venue Location'}
                  </span>
                  <strong className="text-[var(--color-text-primary)] font-semibold block truncate">
                    {event.venue_name || (event.event_type === 'online' ? 'Virtual Meeting' : 'Campus Venue')}
                  </strong>
                  <span className="text-[var(--color-text-secondary)] truncate block">
                    {event.event_type === 'online'
                      ? (existingReg ? (event.online_meeting_url || 'Meeting link issued on digital pass') : 'Link unlocked upon confirmed registration')
                      : (event.venue_address || 'Campus Campus')}
                  </span>
                </div>
              </Card>
            </div>

            {/* Team Rules Callout (if team event) */}
            {event.participation_type === 'team' && (
              <div className="p-5 rounded-2xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.08)] flex flex-col gap-3 shadow-sm">
                <div className="flex items-center gap-2 text-[var(--color-brand-pink)]">
                  <Users size={18} />
                  <h3 className="font-bold text-sm font-display text-[var(--color-text-primary)]">
                    Team Participation Rules
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[var(--color-text-secondary)]">
                  <div className="p-3 rounded-xl bg-[var(--color-surface-2)]">
                    <span className="text-[var(--color-text-muted)] block mb-0.5">Required Team Size</span>
                    <strong className="text-[var(--color-text-primary)]">
                      {event.min_team_size} to {event.max_team_size} members
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--color-surface-2)]">
                    <span className="text-[var(--color-text-muted)] block mb-0.5">Leader Inclusion</span>
                    <strong className="text-[var(--color-text-primary)]">
                      {event.leader_counts_towards_size ? 'Leader is counted in size' : 'Excludes team leader'}
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--color-surface-2)]">
                    <span className="text-[var(--color-text-muted)] block mb-0.5">Registration Mode</span>
                    <strong className="text-[var(--color-text-primary)]">
                      {event.team_registration_mode === 'leader_adds_members' ? 'Leader registers team' : 'Members join via code'}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Custom Questions Notice (if configured by organizer) */}
            {event.custom_questions && event.custom_questions.length > 0 && (
              <div className="p-4 rounded-2xl bg-[var(--color-surface-2)]/60 border border-[oklch(100%_0_0_/_0.06)] flex items-start gap-3 text-xs">
                <HelpCircle size={18} className="text-[var(--color-brand-cyan)] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[var(--color-text-primary)] font-semibold block mb-0.5">
                    Organizer Questionnaire Included
                  </strong>
                  <span className="text-[var(--color-text-secondary)]">
                    The host requires {event.custom_questions.length} custom question{event.custom_questions.length > 1 ? 's' : ''} to be answered during checkout for attendee preparation.
                  </span>
                </div>
              </div>
            )}

            {/* Event Description */}
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)]">
                About this Event
              </h2>
              <div className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line bg-[var(--color-surface-1)] p-6 rounded-2xl border border-[oklch(100%_0_0_/_0.08)] shadow-sm">
                {event.description}
              </div>
            </div>

            {/* Event Rules & Code of Conduct */}
            {event.rules && (
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)] flex items-center gap-2">
                  <FileText size={18} className="text-[var(--color-brand-cyan)]" /> Rules & Code of Conduct
                </h2>
                <div className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line bg-[var(--color-surface-1)] p-6 rounded-2xl border border-[oklch(100%_0_0_/_0.08)] shadow-sm">
                  {event.rules}
                </div>
              </div>
            )}

            {/* Eligibility & Guidelines */}
            {event.eligibility && (
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)] flex items-center gap-2">
                  <Sparkles size={18} className="text-amber-400" /> Eligibility & Requirements
                </h2>
                <div className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed bg-[var(--color-surface-1)] p-5 rounded-2xl border border-[oklch(100%_0_0_/_0.08)] flex items-start gap-3 shadow-sm">
                  <span>{event.eligibility}</span>
                </div>
              </div>
            )}

            {/* Organizer Contact Info */}
            {(event.contact_email || event.contact_phone) && (
              <div className="p-4 rounded-2xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.08)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <span className="text-[var(--color-text-muted)] font-medium">Have questions? Reach the host directly:</span>
                <div className="flex items-center gap-4 flex-wrap">
                  {event.contact_email && (
                    <a
                      href={`mailto:${event.contact_email}`}
                      className="flex items-center gap-1.5 text-[var(--color-brand-cyan)] hover:underline font-medium"
                    >
                      <Mail size={14} /> {event.contact_email}
                    </a>
                  )}
                  {event.contact_phone && (
                    <a
                      href={`tel:${event.contact_phone}`}
                      className="flex items-center gap-1.5 text-[var(--color-brand-purple)] hover:underline font-medium"
                    >
                      <Phone size={14} /> {event.contact_phone}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right 1 Col: Registration & Ticket Card */}
          <div className="flex flex-col gap-6">
            <div className="glass p-5 sm:p-6 rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.1)] shadow-2xl flex flex-col gap-5 lg:sticky lg:top-28">
              <div className="flex items-center justify-between pb-4 border-b border-[var(--color-surface-3)]">
                <div>
                  <span className="text-xs text-[var(--color-text-muted)] font-medium block">
                    Admission Fee
                  </span>
                  <span className="text-2xl sm:text-3xl font-bold font-display text-[var(--color-text-primary)]">
                    {event.is_free ? (
                      <span className="text-emerald-400">Free Entry</span>
                    ) : (
                      `₹${event.price}`
                    )}
                  </span>
                </div>
                <Badge variant={event.is_free ? 'success' : 'purple'}>
                  {event.is_free ? 'Complimentary' : 'Ticketed'}
                </Badge>
              </div>

              {/* Specifications */}
              <div className="flex flex-col gap-2.5 text-xs text-[var(--color-text-secondary)]">
                <div className="flex items-center justify-between py-1 border-b border-[var(--color-surface-2)]">
                  <span className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                    <Users size={14} /> Total Capacity
                  </span>
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    {event.capacity} seats
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-[var(--color-surface-2)]">
                  <span className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                    <UserCheck size={14} /> Participation
                  </span>
                  <span className="font-medium text-[var(--color-text-primary)] capitalize">
                    {event.participation_type} {event.participation_type === 'team' ? `(${event.min_team_size}–${event.max_team_size})` : ''}
                  </span>
                </div>

                {regOpensFormatted && !isRegOpenYet && (
                  <div className="flex items-center justify-between py-1 border-b border-[var(--color-surface-2)]">
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <Clock size={14} /> Registration Opens
                    </span>
                    <span className="font-medium text-amber-300">
                      {regOpensFormatted}
                    </span>
                  </div>
                )}

                {regClosesFormatted && (
                  <div className="flex items-center justify-between py-1 border-b border-[var(--color-surface-2)]">
                    <span className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                      <Clock size={14} /> Registration Closes
                    </span>
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {regClosesFormatted}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between py-1">
                  <span className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                    <Ticket size={14} /> Gate Credential
                  </span>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    Encrypted QR Pass
                  </span>
                </div>
              </div>

              {/* Already Registered Indicator */}
              {existingReg && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    <span>
                      {(existingReg as any).attendance_status === 'checked_in'
                        ? 'Admitted Inside Venue'
                        : (existingReg as any).attendance_status === 'checked_out'
                        ? 'Checked Out of Venue'
                        : existingReg.status === 'confirmed'
                        ? 'Pass Confirmed'
                        : existingReg.approval_status === 'pending'
                        ? 'Awaiting Approval'
                        : 'Registration Pending'}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] font-bold">
                    {existingReg.ticket_code}
                  </span>
                </div>
              )}

              {/* Registration CTA Button & Actions */}
              {existingReg ? (
                <div className="space-y-2 mt-2">
                  <Link to={`/student/tickets/${existingReg.id}`}>
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full"
                      leftIcon={<Ticket size={18} />}
                    >
                      View Your Entry Pass
                    </Button>
                  </Link>

                  {existingReg.status !== 'cancelled' && (
                    canCancelRegistration ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCancelError(null)
                          setShowCancelModal(true)
                        }}
                        className="w-full text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 py-2 border border-rose-500/20 justify-center min-h-[40px]"
                      >
                        {existingReg.team_id ? 'Leave Event / Cancel Pass' : 'Cancel Registration'}
                      </Button>
                    ) : (
                      <div className="text-[11px] text-center text-[var(--color-text-muted)] bg-[var(--color-surface-2)] p-2.5 rounded-xl border border-[oklch(100%_0_0_/_0.06)] leading-relaxed">
                        {isCheckedIn ? (
                          <span>Gate check-in recorded • Ticket cannot be cancelled after physical entry</span>
                        ) : isStarted ? (
                          <span>Event has started • Registration cancellation is closed</span>
                        ) : isCutoffPassed ? (
                          <span>Cancellation deadline passed ({cutoffHours}h cutoff before event start)</span>
                        ) : null}
                      </div>
                    )
                  )}

                  {cancelSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 size={16} className="shrink-0" />
                      <span>{cancelSuccess}</span>
                    </div>
                  )}
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full mt-2"
                  disabled={!canRegister || checkingReg}
                  onClick={handleCtaClick}
                  leftIcon={<Ticket size={18} />}
                >
                  {isCancelled
                    ? 'Registration Cancelled'
                    : isCompleted
                    ? 'Event Concluded'
                    : isRegClosedStatus
                    ? 'Registration Closed'
                    : !isRegOpenYet
                    ? `Opens ${regOpensFormatted}`
                    : isRegDeadlinePassed
                    ? 'Deadline Passed'
                    : isStarted
                    ? 'Event Started'
                    : !user
                    ? 'Sign In to Register'
                    : event.is_free
                    ? (event.participation_type === 'team' ? 'Register Team (Free)' : 'Claim Free Pass')
                    : (event.participation_type === 'team' ? 'Register Team Pass' : 'Register for Event')}
                </Button>
              )}

              {event.participation_type === 'team' && canRegister && !existingReg && (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  className="w-full mt-2 border-[var(--color-brand-purple)]/40 hover:border-[var(--color-brand-purple)] text-[var(--color-brand-purple)] hover:bg-[var(--color-brand-purple)]/10 min-h-[42px]"
                  onClick={() => setShowJoinModal(true)}
                  leftIcon={<Users size={16} />}
                >
                  Join an Existing Squad
                </Button>
              )}

              <p className="text-[11px] text-[var(--color-text-muted)] text-center leading-relaxed">
                Tickets are issued instantly as digital QR passes with real-time gate authentication.
              </p>
            </div>
          </div>
        </div>

        {/* ── Modal: Club Account Notice ─────────────────────────────────── */}
        <Modal
          isOpen={showClubNotice}
          onClose={() => setShowClubNotice(false)}
          title="Club Organizer Account"
          size="sm"
        >
          <ModalBody>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 text-amber-400">
                <div className="p-2.5 rounded-xl bg-amber-500/15">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[var(--color-text-primary)]">
                    Organizer Mode Active
                  </h4>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Club accounts cannot register as event attendees.
                  </p>
                </div>
              </div>

              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mt-1">
                You are currently logged in as a <strong>Club Organizer</strong>. Organizers manage events and check-in desks. To claim a student entry pass, please sign in with or create a student account.
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowClubNotice(false)}
            >
              Dismiss
            </Button>
            <Link to="/student/signup">
              <Button variant="primary" size="sm">
                Create Student Account
              </Button>
            </Link>
          </ModalFooter>
        </Modal>

        {/* ── Multi-Step Student Application & Registration Flow ──────────── */}
        {user && event && (
          <EventRegistrationModal
            isOpen={showRegModal}
            onClose={() => setShowRegModal(false)}
            event={event}
            user={user}
            profile={profile}
            studentProfile={studentProfile}
            onSuccess={(res) => {
              if (res.registration_id) {
                setExistingReg({
                  id: res.registration_id,
                  event_id: event.id,
                  student_id: user.id,
                  ticket_code: res.ticket_code || '',
                  status:
                    res.status ||
                    (event.approval_type === 'manual'
                      ? 'pending_approval'
                      : event.is_free
                      ? 'confirmed'
                      : 'pending_payment'),
                  created_at: new Date().toISOString(),
                  ticket_issued_at: res.ticket_issued ? new Date().toISOString() : null,
                  cancelled_at: null,
                  updated_at: new Date().toISOString(),
                  approval_status:
                    res.approval_status ||
                    (event.approval_type === 'manual' ? 'pending' : 'approved'),
                } as any)
              }
            }}
          />
        )}

        {/* ── Join Team Modal ───────────────────────────────────────────── */}
        {event && (
          <JoinTeamModal
            isOpen={showJoinModal}
            onClose={() => setShowJoinModal(false)}
            initialCode={initialJoinCode}
            onJoinedSuccess={(_res) => {
              if (event && user) {
                checkStudentRegistrationForEvent(event.id, user.id).then((r) => {
                  if (r.registered && r.registration) setExistingReg(r.registration)
                })
              }
            }}
          />
        )}

        {/* ── Student Cancellation Confirmation Modal ──────────────────────── */}
        {event && (
          <Modal
            isOpen={showCancelModal}
            onClose={() => {
              if (!cancelling) {
                setShowCancelModal(false)
                setCancelError(null)
              }
            }}
            title={existingReg?.team_id ? 'Leave Event / Cancel Pass' : 'Cancel Event Registration'}
            size="sm"
          >
            <ModalBody>
              <div className="flex flex-col gap-3.5 text-left">
                <div className="flex items-center gap-3 text-rose-400">
                  <div className="p-2.5 rounded-xl bg-rose-500/15 shrink-0">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[var(--color-text-primary)]">
                      Relinquish Registration Pass
                    </h4>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      This action will immediately void your digital ticket.
                    </p>
                  </div>
                </div>

                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Are you sure you want to cancel your entry pass for{' '}
                  <strong className="text-[var(--color-text-primary)]">{event.title}</strong>? Your seat will be returned to the event's public capacity for other campus students.
                </p>

                {!event.is_free && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300 flex flex-col gap-1">
                    <strong className="font-semibold flex items-center gap-1.5 text-amber-200">
                      <AlertCircle size={14} /> Campus Payment & Refund Policy
                    </strong>
                    <p className="text-[11px] text-amber-300/90 leading-relaxed">
                      FestFlow releases your seat reservation, but automated payment refunds are not processed. Any refund eligibility is strictly determined by the organizing club ({clubName}). Please contact event organizers directly for refund requests.
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-[var(--color-text-muted)] block">
                    Reason for Cancellation (Optional)
                  </label>
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="e.g. Schedule conflict, academic exam, personal reason…"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-purple)]"
                  />
                </div>

                {cancelError && (
                  <Alert variant="error" className="text-xs">
                    {cancelError}
                  </Alert>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="ghost"
                size="sm"
                disabled={cancelling}
                onClick={() => {
                  setShowCancelModal(false)
                  setCancelError(null)
                }}
              >
                Keep My Registration
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={cancelling}
                isLoading={cancelling}
                onClick={handleCancelRegistration}
              >
                Confirm Cancellation
              </Button>
            </ModalFooter>
          </Modal>
        )}

        {/* ── Persistent Mobile Registration Dock (Phones & Small Tablets) ────── */}
        <div className="lg:hidden fixed bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-30 px-3.5 py-2.5 glass-elevated border-t border-[oklch(100%_0_0_/_0.12)] bg-[oklch(10%_0.025_260_/_0.96)] backdrop-blur-xl shadow-[0_-6px_24px_oklch(0%_0_0_/_0.5)]">
          <div className="max-w-md mx-auto flex items-center justify-between gap-2.5">
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)] block">
                {event.is_free ? 'Gate Admission' : 'Entry Ticket'}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold font-display text-[var(--color-brand-cyan)]">
                  {event.is_free ? 'Free Pass' : `₹${event.price}`}
                </span>
                {event.participation_type === 'team' && (
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    / Squad ({event.min_team_size}–{event.max_team_size})
                  </span>
                )}
              </div>
            </div>

            {existingReg ? (
              <Link to={`/student/tickets/${existingReg.id}`}>
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Ticket size={16} />}
                  className="min-h-[44px] font-semibold"
                >
                  View My Pass
                </Button>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                {event.participation_type === 'team' && canRegister && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] text-xs px-2.5 border-[var(--color-brand-purple)]/50 text-[var(--color-brand-purple)]"
                    onClick={() => setShowJoinModal(true)}
                  >
                    Join Squad
                  </Button>
                )}

                <Button
                  variant="primary"
                  size="md"
                  disabled={!canRegister || checkingReg}
                  onClick={handleCtaClick}
                  leftIcon={<Ticket size={16} />}
                  className="min-h-[44px] font-semibold shadow-md bg-[var(--color-brand-purple)] hover:opacity-90"
                >
                  {isCancelled
                    ? 'Cancelled'
                    : isCompleted
                    ? 'Concluded'
                    : isRegClosedStatus
                    ? 'Closed'
                    : !isRegOpenYet
                    ? 'Opens Soon'
                    : isRegDeadlinePassed
                    ? 'Passed'
                    : isStarted
                    ? 'Started'
                    : !user
                    ? 'Sign In to Register'
                    : event.is_free
                    ? (event.participation_type === 'team' ? 'Register Team' : 'Claim Free Pass')
                    : (event.participation_type === 'team' ? 'Register Team' : 'Register Pass')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  )
}
