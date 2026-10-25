import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
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
  Compass,
  CheckCircle2,
  Ticket,
  Sparkles,
  Info,
} from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Button, Badge, CategoryBadge, Card } from '@/components/ui'
import { getEventBySlug } from '@/lib/events'
import {
  registerForEvent,
  checkStudentRegistrationForEvent,
} from '@/lib/registrations'
import { useAuth } from '@/context/AuthContext'
import { fadeIn } from '@/lib/animations'
import type { EventWithClub, RegistrationRecord, RegistrationResponse } from '@/types'

export default function EventDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, role } = useAuth()

  const [event, setEvent] = useState<EventWithClub | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Registration flow state
  const [existingReg, setExistingReg] = useState<RegistrationRecord | null>(null)
  const [checkingReg, setCheckingReg] = useState(false)
  const [showRegModal, setShowRegModal] = useState(false)
  const [showClubNotice, setShowClubNotice] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [regResult, setRegResult] = useState<RegistrationResponse | null>(null)
  const [regError, setRegError] = useState<string | null>(null)

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
  useEffect(() => {
    if (!event || !user || role !== 'student') return
    let mounted = true
    setCheckingReg(true)

    checkStudentRegistrationForEvent(event.id, user.id).then((res) => {
      if (!mounted) return
      setCheckingReg(false)
      if (res.registered && res.registration) {
        setExistingReg(res.registration)
      } else {
        setExistingReg(null)
      }
    })

    return () => {
      mounted = false
    }
  }, [event, user, role])

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

    // Open confirmation modal
    setRegError(null)
    setRegResult(null)
    setShowRegModal(true)
  }

  // Submit Registration
  const handleConfirmRegistration = async () => {
    if (!event || !user) return
    if (!agreeTerms) {
      setRegError('Please accept the event attendee terms to proceed.')
      return
    }

    setIsSubmitting(true)
    setRegError(null)

    const res = await registerForEvent(event.id, user.id)
    setIsSubmitting(false)

    if (!res.success) {
      setRegError(res.message)
    } else {
      setRegResult(res)
      // Update local existing registration status
      if (res.registration_id) {
        setExistingReg({
          id: res.registration_id,
          event_id: event.id,
          student_id: user.id,
          ticket_code: res.ticket_code || '',
          status: res.status || 'confirmed',
          created_at: new Date().toISOString(),
          ticket_issued_at: res.ticket_issued ? new Date().toISOString() : null,
          cancelled_at: null,
          updated_at: new Date().toISOString(),
        })
      }
    }
  }

  if (loading) {
    return (
      <PageShell>
        <div className="max-w-5xl mx-auto px-4 py-24 flex flex-col items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-[var(--color-surface-3)] border-t-[var(--color-brand-purple)] animate-spin mb-4" />
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
        <div className="max-w-xl mx-auto px-4 py-28 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mb-4">
            <AlertTriangle size={32} />
          </div>
          <h1 className="text-2xl font-bold font-display text-[var(--color-text-primary)] mb-2">
            Event Not Available
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mb-6 max-w-md">
            {error || 'This event does not exist, has been removed, or has not yet been published by the organizer.'}
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
  const startDate = new Date(event.start_date)
  const endDate = new Date(event.end_date)
  const formattedDate = startDate.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const formattedStartTime = startDate.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const formattedEndTime = endDate.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  const regDeadline = event.registration_closes_at
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

  const clubName = event.club?.club_profile?.club_name || event.club?.display_name || 'Campus Club'

  return (
    <PageShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-24 text-left">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center justify-between py-4 text-xs text-[var(--color-text-muted)] border-b border-[var(--color-surface-3)] mb-6">
          <div className="flex items-center gap-2">
            <Link to="/discover" className="hover:text-[var(--color-text-primary)] flex items-center gap-1">
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all text-xs"
          >
            {copied ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Share2 size={14} />}
            <span>{copied ? 'Link Copied!' : 'Share Event'}</span>
          </button>
        </div>

        {/* Status Notice Banners */}
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

        {/* Hero Poster Banner */}
        <div className="relative w-full h-64 sm:h-96 rounded-3xl overflow-hidden border border-[var(--color-surface-3)] mb-8 shadow-2xl">
          <img
            src={event.poster_url || 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200'}
            alt={event.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

          {/* Badges Overlay */}
          <div className="absolute top-4 left-4 flex gap-2">
            <CategoryBadge category={event.category} />
            <Badge variant="purple" className="capitalize text-xs">
              {event.event_type}
            </Badge>
          </div>

          {/* Title on Poster */}
          <div className="absolute bottom-6 left-6 right-6">
            <h1 className="text-2xl sm:text-4xl font-extrabold font-display text-white tracking-tight leading-snug drop-shadow-md">
              {event.title}
            </h1>
            <p className="text-white/80 text-xs sm:text-sm mt-2 max-w-2xl line-clamp-2">
              {event.summary}
            </p>
          </div>
        </div>

        {/* Main Content & Registration Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Cols: Event Details */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            {/* Organizer Card */}
            <div className="p-4 rounded-2xl glass border border-[oklch(100%_0_0_/_0.08)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--color-brand-purple)] to-[var(--color-brand-pink)] flex items-center justify-center text-white shrink-0">
                  <Building2 size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-[var(--color-text-primary)]">
                      {clubName}
                    </span>
                    <ShieldCheck size={15} className="text-emerald-400" />
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
                      Edit Event
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Quick Timing & Venue Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="p-4 flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-brand-purple)] shrink-0">
                  <Calendar size={20} />
                </div>
                <div className="text-xs">
                  <span className="text-[var(--color-text-muted)] block mb-0.5">Date & Time</span>
                  <strong className="text-[var(--color-text-primary)] font-semibold block">
                    {formattedDate}
                  </strong>
                  <span className="text-[var(--color-text-secondary)]">
                    {formattedStartTime} – {formattedEndTime} (IST)
                  </span>
                </div>
              </Card>

              <Card className="p-4 flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-brand-pink)] shrink-0">
                  <MapPin size={20} />
                </div>
                <div className="text-xs">
                  <span className="text-[var(--color-text-muted)] block mb-0.5">Venue</span>
                  <strong className="text-[var(--color-text-primary)] font-semibold block">
                    {event.venue_name}
                  </strong>
                  <span className="text-[var(--color-text-secondary)]">
                    {event.venue_address || 'Campus Campus'}
                  </span>
                </div>
              </Card>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)]">
                About this Event
              </h2>
              <div className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line bg-[var(--color-surface-1)] p-6 rounded-2xl border border-[var(--color-surface-3)]">
                {event.description}
              </div>
            </div>

            {/* Eligibility & Guidelines */}
            {event.eligibility && (
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)]">
                  Eligibility & Instructions
                </h2>
                <div className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed bg-[var(--color-surface-1)] p-5 rounded-2xl border border-[var(--color-surface-3)] flex items-start gap-3">
                  <Sparkles size={18} className="text-amber-400 shrink-0 mt-0.5" />
                  <span>{event.eligibility}</span>
                </div>
              </div>
            )}
          </div>

          {/* Right 1 Col: Registration & Ticket Card */}
          <div className="flex flex-col gap-6">
            <div className="glass p-6 rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.1)] shadow-xl flex flex-col gap-5 sticky top-28">
              <div className="flex items-center justify-between pb-4 border-b border-[var(--color-surface-3)]">
                <div>
                  <span className="text-xs text-[var(--color-text-muted)] font-medium block">
                    Admission
                  </span>
                  <span className="text-2xl font-bold font-display text-[var(--color-text-primary)]">
                    {event.is_free ? (
                      <span className="text-emerald-400">Free Pass</span>
                    ) : (
                      `₹${event.price}`
                    )}
                  </span>
                </div>
                <Badge variant={event.is_free ? 'success' : 'purple'}>
                  {event.is_free ? 'Complimentary' : 'Ticketed Event'}
                </Badge>
              </div>

              {/* Specs */}
              <div className="flex flex-col gap-2.5 text-xs text-[var(--color-text-secondary)]">
                <div className="flex items-center justify-between py-1 border-b border-[var(--color-surface-2)]">
                  <span className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                    <Users size={14} /> Total Capacity
                  </span>
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    {event.capacity} seats
                  </span>
                </div>

                {regDeadline && (
                  <div className="flex items-center justify-between py-1 border-b border-[var(--color-surface-2)]">
                    <span className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                      <Clock size={14} /> Registration Closes
                    </span>
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {regDeadline}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between py-1">
                  <span className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                    <Ticket size={14} /> Ticket Type
                  </span>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    Digital QR Gate Pass
                  </span>
                </div>
              </div>

              {/* Already Registered Indicator */}
              {existingReg && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    <span>
                      {existingReg.status === 'confirmed'
                        ? 'Pass Confirmed'
                        : 'Registration Pending'}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] font-bold">
                    {existingReg.ticket_code}
                  </span>
                </div>
              )}

              {/* Registration CTA Button */}
              {existingReg ? (
                <Link to={`/student/tickets/${existingReg.id}`}>
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full mt-2"
                    leftIcon={<Ticket size={18} />}
                  >
                    View Your Entry Pass
                  </Button>
                </Link>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full mt-2"
                  disabled={isCancelled || checkingReg}
                  onClick={handleCtaClick}
                  leftIcon={<Ticket size={18} />}
                >
                  {isCancelled
                    ? 'Registration Closed'
                    : !user
                    ? 'Sign In to Register'
                    : event.is_free
                    ? 'Claim Free Student Pass'
                    : 'Register for Event'}
                </Button>
              )}

              <p className="text-[11px] text-[var(--color-text-muted)] text-center leading-relaxed">
                Tickets are delivered instantly as digital QR passes with instant gate verification.
              </p>
            </div>
          </div>
        </div>

        {/* ── Modal: Club Account Notice ─────────────────────────────────── */}
        <AnimatePresence>
          {showClubNotice && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                className="w-full max-w-md p-6 rounded-3xl glass border border-amber-500/30 text-left flex flex-col gap-4 shadow-2xl"
              >
                <div className="flex items-center gap-3 text-amber-400">
                  <div className="p-2.5 rounded-xl bg-amber-500/15">
                    <AlertTriangle size={24} />
                  </div>
                  <h3 className="text-lg font-bold font-display text-[var(--color-text-primary)]">
                    Club Account Detected
                  </h3>
                </div>

                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  You are currently logged in as a <strong>Club Organizer</strong>. Organizers manage events and attendee lists, but cannot register for student entry tickets.
                </p>

                <p className="text-xs text-[var(--color-text-muted)]">
                  To register for this event, please switch to or create a student account.
                </p>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowClubNotice(false)}
                  >
                    Dismiss
                  </Button>
                  <Link to="/student/signup">
                    <Button variant="primary" size="sm">
                      Sign Up as Student
                    </Button>
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Modal: Real Student Registration Confirmation ─────────────────── */}
        <AnimatePresence>
          {showRegModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="w-full max-w-md p-6 sm:p-8 rounded-3xl glass border border-[oklch(100%_0_0_/_0.15)] text-left flex flex-col gap-5 shadow-2xl relative"
              >
                {/* Result view */}
                {regResult ? (
                  <div className="flex flex-col items-center text-center gap-4 py-2">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 size={32} />
                    </div>

                    <div>
                      <h3 className="text-xl font-bold font-display text-[var(--color-text-primary)]">
                        {regResult.is_free ? 'Pass Confirmed!' : 'Registration Received!'}
                      </h3>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-xs">
                        {regResult.message}
                      </p>
                    </div>

                    <div className="w-full p-4 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-xs flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--color-text-muted)]">Ticket Reference:</span>
                        <span className="font-mono font-bold text-[var(--color-brand-cyan)]">
                          {regResult.ticket_code}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--color-text-muted)]">Event:</span>
                        <span className="font-medium text-[var(--color-text-primary)] truncate max-w-[180px]">
                          {event.title}
                        </span>
                      </div>
                    </div>

                    <div className="w-full flex flex-col gap-2 pt-2">
                      {regResult.registration_id && (
                        <Link
                          to={`/student/tickets/${regResult.registration_id}`}
                          className="w-full"
                        >
                          <Button variant="primary" size="lg" className="w-full" leftIcon={<Ticket size={18} />}>
                            View Digital QR Pass
                          </Button>
                        </Link>
                      )}
                      <Button
                        variant="ghost"
                        size="md"
                        onClick={() => setShowRegModal(false)}
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Form view */
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-brand-purple)] to-[var(--color-brand-pink)] flex items-center justify-center text-white">
                        <Ticket size={20} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold font-display text-[var(--color-text-primary)]">
                          Confirm Event Registration
                        </h3>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          Review details and claim your pass
                        </p>
                      </div>
                    </div>

                    {regError && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                        <AlertTriangle size={15} className="shrink-0" />
                        <span>{regError}</span>
                      </div>
                    )}

                    {/* Summary Box */}
                    <div className="p-4 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-muted)]">Event:</span>
                        <strong className="text-[var(--color-text-primary)] truncate max-w-[200px]">
                          {event.title}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-muted)]">Date & Venue:</span>
                        <span className="text-[var(--color-text-secondary)]">
                          {formattedDate} • {event.venue_name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-muted)]">Attendee:</span>
                        <span className="text-[var(--color-text-secondary)]">
                          {profile?.display_name || user?.email}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-[var(--color-surface-3)] font-semibold">
                        <span className="text-[var(--color-text-primary)]">Total Due:</span>
                        <span className={event.is_free ? 'text-emerald-400' : 'text-[var(--color-text-primary)]'}>
                          {event.is_free ? 'Free Pass (₹0)' : `₹${event.price}`}
                        </span>
                      </div>
                    </div>

                    {/* Terms Agreement */}
                    <label className="flex items-start gap-2.5 text-xs text-[var(--color-text-secondary)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreeTerms}
                        onChange={(e) => setAgreeTerms(e.target.checked)}
                        className="mt-0.5 rounded border-[var(--color-surface-3)] text-[var(--color-brand-purple)] focus:ring-[var(--color-brand-purple)]"
                      />
                      <span>
                        I understand this digital pass is personal, non-transferable, and requires valid college ID at the entry gate.
                      </span>
                    </label>

                    {/* Submit Actions */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <Button
                        variant="ghost"
                        size="md"
                        disabled={isSubmitting}
                        onClick={() => setShowRegModal(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="md"
                        disabled={isSubmitting || !agreeTerms}
                        isLoading={isSubmitting}
                        onClick={handleConfirmRegistration}
                        leftIcon={<CheckCircle2 size={16} />}
                      >
                        {event.is_free ? 'Claim Free Ticket' : 'Proceed to Register'}
                      </Button>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageShell>
  )
}
