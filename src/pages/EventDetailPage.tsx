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
  XCircle,
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
  Heart,
  CalendarPlus,
  Zap,
  Download,
  ChevronDown,
  ChevronUp,
  Video,
  Sliders,
  Trophy,
} from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Button, Badge, CategoryBadge, Modal, ModalBody, ModalFooter } from '@/components/ui'
import { getEventBySlug, CATEGORY_POSTERS, mapRecordToUiEvent, isEventCompleted, resolvePosterUrl } from '@/lib/events'
import { getOptimizedImageUrl, getImageSrcSet } from '@/lib/imageOptimization'
import { checkStudentRegistrationForEvent, registerForEvent } from '@/lib/registrations'
import { RequestCancellationModal } from '@/components/registration/RequestCancellationModal'
import { subscribeToStatusChanges } from '@/lib/sync'
import { useAuth } from '@/context/AuthContext'
import { fadeIn } from '@/lib/animations'
import { EventRegistrationModal } from '@/components/events/EventRegistrationModal'
import { JoinTeamModal } from '@/components/team/JoinTeamModal'
import { EventShareModal } from '@/components/events/EventShareModal'
import { SEOHead } from '@/components/seo/SEOHead'
import { EventCountdown } from '@/components/events/EventCountdown'
import { isEventSavedSync, toggleWishlist } from '@/lib/wishlist'
import { recordRecentlyViewed } from '@/lib/recentlyViewed'
import { generateGoogleCalendarUrl, downloadIcsFile } from '@/lib/calendar'
import { EventDiscussionSection } from '@/components/events/EventDiscussionSection'

// Phase 6 Advanced Event Experience Imports
import { EventTicketTiersSection } from '@/components/events/EventTicketTiersSection'
import { EventScheduleSection } from '@/components/events/EventScheduleSection'
import { EventSpeakersSection } from '@/components/events/EventSpeakersSection'
import { EventGallerySection } from '@/components/events/EventGallerySection'
import { EventAnnouncementsSection } from '@/components/events/EventAnnouncementsSection'
import { EventLeaderboardSection } from '@/components/events/EventLeaderboardSection'
import { EventVirtualJoinSection } from '@/components/events/EventVirtualJoinSection'
import { EventAddonsSection } from '@/components/events/EventAddonsSection'
import { EventOrganizerExperienceModal } from '@/components/events/EventOrganizerExperienceModal'
import {
  getEventTicketTiers,
  getEventSchedules,
  getEventSpeakers,
  getEventGallery,
  getEventAnnouncements,
  getEventLeaderboard,
  getEventAddons,
  getRelatedEvents,
} from '@/lib/eventExperience'
import {
  getEventWaitlistStatus,
  joinEventWaitlist,
  leaveEventWaitlist,
  type EventWaitlistStatus,
} from '@/lib/notifications'
import type {
  EventWithClub,
  RegistrationRecord,
  EventTicketTier,
  EventScheduleItem,
  EventSpeaker,
  EventGalleryImage,
  EventAnnouncement,
  EventLeaderboardEntry,
  EventAddon,
  RelatedEventSummary,
} from '@/types'

export default function EventDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, studentProfile, role, hasEventPermission } = useAuth()

  const [event, setEvent] = useState<EventWithClub | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bannerImgError, setBannerImgError] = useState(false)

  // Phase 1 Experience States
  const [showShareModal, setShowShareModal] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isQuickRegistering, setIsQuickRegistering] = useState(false)
  const [quickRegNotice, setQuickRegNotice] = useState<string | null>(null)
  const [showCalendarMenu, setShowCalendarMenu] = useState(false)

  // Registration flow state
  const [existingReg, setExistingReg] = useState<RegistrationRecord | null>(null)
  const [checkingReg, setCheckingReg] = useState(false)
  const [showRegModal, setShowRegModal] = useState(false)
  const [showClubNotice, setShowClubNotice] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [initialJoinCode, setInitialJoinCode] = useState('')

  // Student Cancellation state
  const [showCancelModal, setShowCancelModal] = useState(false)

  // Phase 6 Experience States
  const [ticketTiers, setTicketTiers] = useState<EventTicketTier[]>([])
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null)
  const [schedules, setSchedules] = useState<EventScheduleItem[]>([])
  const [speakers, setSpeakers] = useState<EventSpeaker[]>([])
  const [galleryImages, setGalleryImages] = useState<EventGalleryImage[]>([])
  const [announcements, setAnnouncements] = useState<EventAnnouncement[]>([])
  const [leaderboardEntries, setLeaderboardEntries] = useState<EventLeaderboardEntry[]>([])
  const [addons, setAddons] = useState<EventAddon[]>([])
  const [relatedEvents, setRelatedEvents] = useState<RelatedEventSummary[]>([])
  const [showOrganizerModal, setShowOrganizerModal] = useState(false)
  const [activeFaqIndex, setActiveFaqIndex] = useState<number | null>(null)

  // Phase 8 Waitlist States
  const [waitlistStatus, setWaitlistStatus] = useState<EventWaitlistStatus | null>(null)
  const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false)
  const [waitlistMessage, setWaitlistMessage] = useState<string | null>(null)

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

  // Load Phase 6 Advanced Experience Data
  const loadPhase6Data = (eventId: string, category: string) => {
    getEventTicketTiers(eventId).then((t) => {
      setTicketTiers(t)
      if (t.length > 0 && !selectedTierId) {
        const firstAvailable = t.find((tier) => tier.is_active && tier.sold_count < tier.capacity) || t[0]
        setSelectedTierId(firstAvailable.id)
      }
    })
    getEventSchedules(eventId).then(setSchedules)
    getEventSpeakers(eventId).then(setSpeakers)
    getEventGallery(eventId).then(setGalleryImages)
    getEventAnnouncements(eventId).then(setAnnouncements)
    getEventLeaderboard(eventId).then(setLeaderboardEntries)
    getEventAddons(eventId).then(setAddons)
    getRelatedEvents(eventId, category).then(setRelatedEvents)
  }

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
        loadPhase6Data(res.event.id, res.event.category)
      }
    })

    return () => {
      mounted = false
    }
  }, [slug])

  // Check if current logged-in student has already registered
  const refreshRegistration = (silent = false) => {
    if (!event || !user || role !== 'student') return
    if (!silent) setCheckingReg(true)

    checkStudentRegistrationForEvent(event.id, user.id).then((res) => {
      if (!silent) setCheckingReg(false)
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
      ['registration_updated', 'ticket_updated', 'payment_reviewed'],
      (e) => {
        if (!e.eventId || (event && e.eventId === event.id)) {
          refreshRegistration(true)
          if (event) loadPhase6Data(event.id, event.category)
        }
      }
    )
    return () => unsubscribe()
  }, [event, user, role])

  // Phase 1: Record view & check wishlist state
  useEffect(() => {
    if (user?.id && event) {
      setIsSaved(isEventSavedSync(user.id, event.id))
      recordRecentlyViewed(user.id, mapRecordToUiEvent(event as any))
    }
    if (event?.id) {
      getEventWaitlistStatus(event.id, user?.id).then(setWaitlistStatus)
    }
  }, [user, event])

  const handleJoinWaitlist = async () => {
    if (!event) return
    if (!user) {
      navigate(`/student/login?redirect=${encodeURIComponent(location.pathname)}`)
      return
    }
    setIsJoiningWaitlist(true)
    const res = await joinEventWaitlist(event.id, user.id)
    setIsJoiningWaitlist(false)
    setWaitlistMessage(res.message)
    if (res.success) {
      getEventWaitlistStatus(event.id, user.id).then(setWaitlistStatus)
    }
  }

  const handleLeaveWaitlist = async () => {
    if (!waitlistStatus?.userEntry || !user || !event) return
    await leaveEventWaitlist(waitlistStatus.userEntry.id, user.id)
    getEventWaitlistStatus(event.id, user.id).then(setWaitlistStatus)
    setWaitlistMessage('You have left the waitlist.')
  }

  const handleWishlistToggle = async () => {
    if (!user?.id || !event) return
    const res = await toggleWishlist(user.id, event.id)
    setIsSaved(res.saved)
  }

  const handleShare = () => {
    setShowShareModal(true)
  }

  // Selected Tier Details
  const selectedTier = ticketTiers.find((t) => t.id === selectedTierId)
  const displayPrice = selectedTier ? selectedTier.price : (event?.price ?? 0)
  const displayIsFree = selectedTier ? selectedTier.price === 0 : Boolean(event?.is_free)

  // One-click quick registration eligibility
  const canQuickRegister = Boolean(
    user &&
    role === 'student' &&
    !existingReg &&
    displayIsFree &&
    event?.participation_type === 'individual' &&
    !(event as any)?.requires_approval &&
    (!event?.custom_questions || event.custom_questions.length === 0)
  )

  const handleQuickRegister = async () => {
    if (!user || !event) return
    setIsQuickRegistering(true)
    setQuickRegNotice(null)

    try {
      const studentName = profile?.display_name || (user.user_metadata?.display_name as string) || 'Campus Student'
      const college = studentProfile?.college_name || (user.user_metadata?.college as string) || 'Campus Student'

      const res = await registerForEvent(event.id, user.id, {
        ticketTierId: selectedTierId || undefined,
        participantDetails: {
          full_name: studentName,
          college_name: college,
          phone: (user.user_metadata?.phone as string) || '',
        },
      })

      setIsQuickRegistering(false)
      if (res.success && res.registration_id) {
        setQuickRegNotice('Pass issued instantly!')
        refreshRegistration(true)
        setTimeout(() => {
          navigate(`/student/tickets/${res.registration_id}`)
        }, 1000)
      } else {
        setQuickRegNotice(res.message || 'Quick registration could not be completed.')
      }
    } catch (err: any) {
      setIsQuickRegistering(false)
      setQuickRegNotice(err?.message || 'Quick registration failed.')
    }
  }

  // CTA Click Handler
  const handleCtaClick = () => {
    if (!user) {
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

    if (event?.registration_mode === 'reserved_seating') {
      navigate(`/events/${event.slug || event.id}/seats`)
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
            Loading event experience…
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

  const isPlatformAdmin = role === 'platform_admin'
  const canEditEvent =
    isPlatformAdmin || hasEventPermission(event.id, 'events.edit', event.club_id)
  const canViewRoster =
    isPlatformAdmin || hasEventPermission(event.id, 'registrations.view', event.club_id)
  const canModerateDiscussion =
    canEditEvent || hasEventPermission(event.id, 'registrations.manage', event.club_id)
  const isCancelled = event.status === 'cancelled'
  const isDraft = event.status === 'draft'
  const isRegClosedStatus = event.status === 'registration_closed'
  const isCompleted = event.status === 'completed' || isEventCompleted(event)

  const canRegister = !isCancelled && !isDraft && !isRegClosedStatus && !isCompleted && isRegOpenYet && !isRegDeadlinePassed && !isStarted

  const cutoffHours = (event as any).cancellation_cutoff_hours ?? 0
  const isCutoffPassed = Boolean(
    cutoffHours > 0 &&
    startDate &&
    startDate.getTime() - Date.now() < cutoffHours * 3600 * 1000
  )
  const isCheckedIn = (existingReg as any)?.attendance_status === 'checked_in' || (existingReg as any)?.attendance_status === 'checked_out'
  const isCancellationPending = existingReg?.cancellation_request_status === 'pending'
  const isRegCancelled = existingReg?.status === 'cancelled'
  const canRequestCancellation = Boolean(
    existingReg &&
    !isRegCancelled &&
    !isCancellationPending &&
    !isStarted &&
    !isCutoffPassed &&
    !isCheckedIn
  )

  const clubName = event.club?.club_profile?.club_name || event.club?.display_name || 'Campus Club'
  const rawCover = (event as any).cover_url
  const rawPoster = event.poster_url
  const posterSource =
    !bannerImgError && rawCover && rawCover !== 'null' && rawCover !== 'undefined' && String(rawCover).trim()
      ? resolvePosterUrl(rawCover, event.category)
      : !bannerImgError && rawPoster && rawPoster !== 'null' && rawPoster !== 'undefined' && String(rawPoster).trim()
      ? resolvePosterUrl(rawPoster, event.category)
      : CATEGORY_POSTERS[event.category] || CATEGORY_POSTERS.tech

  // Capacity Calculations & Urgency
  const totalCapacity = event.capacity || 100
  const occupiedCount = (event as any).registered_count || (ticketTiers.reduce((acc, t) => acc + (t.sold_count || 0), 0) || 0)
  const remainingSeats = Math.max(0, totalCapacity - occupiedCount)
  const capacityPercent = Math.min(100, Math.round((occupiedCount / totalCapacity) * 100))

  // Pinned Announcement
  const pinnedAnnouncement = announcements.find((a) => a.is_pinned)

  return (
    <PageShell>
      <SEOHead
        title={event.title}
        description={event.description ? event.description.slice(0, 160) : `Join ${event.title} organized by ${(event as any).club?.name || 'FestFlow Club'}.`}
        canonicalPath={`/events/${event.slug || event.id}`}
        ogImage={posterSource}
        eventData={event as any}
      />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-[calc(10rem+env(safe-area-inset-bottom,0px))] lg:pb-24 text-left">
        {/* ── Breadcrumb & Utility Bar ──────────────────────────────────────── */}
        <div className="flex items-center justify-between py-4 text-xs text-zinc-400 border-b border-white/[0.08] mb-6 flex-wrap gap-2">
          <div className="flex items-center gap-2 truncate">
            <Link to="/discover" className="hover:text-white flex items-center gap-1 transition-colors">
              <ArrowLeft size={14} /> Discover
            </Link>
            <span className="text-zinc-600">/</span>
            <span className="capitalize">{event.category}</span>
            <span className="text-zinc-600">/</span>
            <span className="text-white font-medium truncate max-w-[180px] sm:max-w-xs">
              {event.title}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Organizer Quick Management Pill */}
            {canEditEvent && (
              <button
                type="button"
                onClick={() => setShowOrganizerModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#18CFFC]/20 to-[#7F1AFB]/20 border border-[#18CFFC]/40 text-[#18CFFC] hover:text-white transition-all text-xs font-semibold shadow-sm cursor-pointer"
              >
                <Sliders size={13} />
                <span>Experience Desk</span>
              </button>
            )}

            {user && (
              <button
                type="button"
                onClick={handleWishlistToggle}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all text-xs border cursor-pointer ${
                  isSaved
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                    : 'bg-[#14141A] hover:bg-[#1E1E26] text-zinc-300 hover:text-white border-white/[0.08]'
                }`}
                aria-label={isSaved ? 'Saved in Wishlist' : 'Save to Wishlist'}
              >
                <Heart size={14} className={isSaved ? 'fill-current text-rose-400' : 'text-zinc-400'} />
                <span>{isSaved ? 'Saved' : 'Save'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14141A] hover:bg-[#1E1E26] text-zinc-300 hover:text-white transition-all text-xs border border-white/[0.08] cursor-pointer"
            >
              <Share2 size={14} className="text-[#18CFFC]" />
              <span>Share</span>
            </button>
          </div>
        </div>

        {/* ── Pinned Live Announcement Alert Banner (if exists) ────────────── */}
        {pinnedAnnouncement && (
          <motion.div
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-[#18CFFC]/20 via-[#0E0E12] to-[#7F1AFB]/20 border border-[#18CFFC]/50 text-white flex items-start gap-3 text-xs sm:text-sm shadow-lg shadow-[#18CFFC]/10"
          >
            <Sparkles size={20} className="text-[#18CFFC] shrink-0 mt-0.5 animate-pulse" />
            <div>
              <strong className="block font-bold text-white mb-0.5">
                📢 {pinnedAnnouncement.title}
              </strong>
              <p className="text-zinc-200 leading-relaxed font-sans">
                {pinnedAnnouncement.content}
              </p>
            </div>
          </motion.div>
        )}

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
            {canEditEvent && (
              <Link to={`/club/events/${event.id}/edit`}>
                <Button variant="primary" size="sm">
                  Edit & Publish
                </Button>
              </Link>
            )}
          </motion.div>
        )}

        {/* ── Editorial Cinematic Hero Poster Banner ───────────────────────── */}
        <div className="relative w-full h-64 sm:h-84 md:h-[430px] rounded-3xl overflow-hidden border border-white/[0.08] mb-6 sm:mb-8 shadow-2xl group bg-gradient-to-br from-zinc-900 via-[#121218] to-black">
          <img
            key={posterSource}
            src={getOptimizedImageUrl(posterSource, 1080)}
            srcSet={getImageSrcSet(posterSource)}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1080px"
            alt={event.title}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            onError={() => {
              if (!bannerImgError) {
                setBannerImgError(true)
              }
            }}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent pointer-events-none" />

          {/* Badges Overlay */}
          <div className="absolute top-3 left-3 sm:top-5 sm:left-5 flex flex-wrap gap-1.5 sm:gap-2 max-w-[calc(100%-1.5rem)]">
            <CategoryBadge category={event.category} />
            {event.event_type === 'online' && (
              <Badge variant="cyan" className="text-xs flex items-center gap-1 shadow-md">
                <Video size={12} /> Virtual Session
              </Badge>
            )}
            {event.event_type === 'hybrid' && (
              <Badge variant="amber" className="text-xs flex items-center gap-1 shadow-md">
                <Globe size={12} /> Hybrid Event
              </Badge>
            )}
            {event.event_type === 'offline' && (
              <Badge variant="default" className="text-xs shadow-md">
                Campus In-Person
              </Badge>
            )}
            {event.participation_type === 'team' && (
              <Badge variant="pink" className="text-xs flex items-center gap-1 shadow-md">
                <Users size={12} /> Squad ({event.min_team_size}–{event.max_team_size})
              </Badge>
            )}
            {event.approval_type === 'manual' && (
              <Badge variant="purple" className="text-xs flex items-center gap-1 shadow-md">
                <ShieldCheck size={12} /> Host Approval Req.
              </Badge>
            )}
          </div>

          {/* Title on Poster */}
          <div className="absolute bottom-5 sm:bottom-8 left-5 right-5 sm:left-8 sm:right-8">
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-extrabold font-display text-white tracking-tight leading-snug drop-shadow-lg line-clamp-2">
              {event.title}
            </h1>
            {event.summary && (
              <p className="text-white/90 text-xs sm:text-sm md:text-base mt-2 max-w-2xl line-clamp-2 leading-relaxed drop-shadow">
                {event.summary}
              </p>
            )}
          </div>
        </div>

        {/* ── Main Content & Registration Layout ───────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Left 2 Cols: Editorial Details & Phase 6 Experience Sections */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            {/* Organizer Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0E0E12] border border-white/[0.08] flex items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#18CFFC] to-[#7F1AFB] flex items-center justify-center text-white shrink-0 shadow-md shadow-[#18CFFC]/20">
                  <Building2 size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm sm:text-base text-white">
                      {clubName}
                    </span>
                    <ShieldCheck size={16} className="text-emerald-400" />
                  </div>
                  <span className="text-xs text-zinc-400">
                    Official Student Organization Host
                  </span>
                </div>
              </div>

              {(canEditEvent || canViewRoster) && (
                <div className="flex items-center gap-2">
                  {canEditEvent && (
                    <button
                      type="button"
                      onClick={() => setShowOrganizerModal(true)}
                      className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
                    >
                      <Sliders size={14} className="text-[#18CFFC]" />
                      <span>Manage Hub</span>
                    </button>
                  )}
                  {canViewRoster && (
                    <Link to={`/club/events/${event.id}/registrations`}>
                      <Button variant="outline" size="sm" leftIcon={<Users size={14} />}>
                        Attendees
                      </Button>
                    </Link>
                  )}
                  {canEditEvent && (
                    <Link to={`/club/events/${event.id}/edit`}>
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Quick Timing & Venue Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-[#0E0E12] border border-white/[0.08] flex items-start gap-3.5 shadow-sm">
                <div className="p-2.5 rounded-xl bg-[#14141A] text-[#18CFFC] shrink-0 border border-white/[0.06]">
                  <Calendar size={20} />
                </div>
                <div className="text-xs min-w-0">
                  <span className="text-zinc-500 block mb-0.5 font-medium">Date & Time</span>
                  <strong className="text-white font-semibold block truncate">
                    {formattedDate}
                  </strong>
                  <span className="text-zinc-400">
                    {formattedStartTime} – {formattedEndTime} ({event.timezone || 'IST'})
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#0E0E12] border border-white/[0.08] flex items-start gap-3.5 shadow-sm">
                <div className="p-2.5 rounded-xl bg-[#14141A] text-[#18CFFC] shrink-0 border border-white/[0.06]">
                  {event.event_type === 'online' ? <Globe size={20} /> : <MapPin size={20} />}
                </div>
                <div className="text-xs min-w-0">
                  <span className="text-zinc-500 block mb-0.5 font-medium">
                    {event.event_type === 'online' ? 'Session Format' : 'Venue Location'}
                  </span>
                  <strong className="text-white font-semibold block truncate">
                    {event.venue_name || (event.event_type === 'online' ? 'Virtual Meeting' : 'Campus Venue')}
                  </strong>
                  <span className="text-zinc-400 truncate block">
                    {event.event_type === 'online'
                      ? 'Encrypted Virtual Access Portal'
                      : (event.venue_address || 'Campus Campus')}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Virtual / Hybrid Meeting Portal (Phase 6) ────────────────── */}
            {(event.event_type === 'online' || event.event_type === 'hybrid') && (
              <EventVirtualJoinSection
                eventId={event.id}
                eventType={event.event_type}
                eventData={{
                  start_date: event.start_date,
                  end_date: event.end_date,
                  access_window_minutes: (event as any).access_window_minutes || 30,
                  meeting_platform: (event as any).meeting_platform,
                  meeting_url: (event as any).meeting_url,
                  joining_instructions: (event as any).joining_instructions,
                  club_id: event.club_id,
                }}
                userId={user?.id}
                isConfirmedAttendee={existingReg?.status === 'confirmed'}
              />
            )}

            {/* ── Live Event Announcements (Phase 6) ───────────────────────── */}
            {announcements.length > 0 && (
              <EventAnnouncementsSection announcements={announcements} />
            )}

            {/* ── Multiple Ticket Categories & Passes (Phase 6) ────────────── */}
            {ticketTiers.length > 0 && (
              <EventTicketTiersSection
                tiers={ticketTiers}
                selectedTierId={selectedTierId}
                onSelectTier={setSelectedTierId}
                disabled={Boolean(existingReg)}
                isCancelled={isCancelled}
                isCompleted={isCompleted}
              />
            )}

            {/* Team Rules Callout (if team event) */}
            {event.participation_type === 'team' && (
              <div className="p-5 rounded-2xl bg-[#0E0E12] border border-white/[0.08] flex flex-col gap-3 shadow-sm">
                <div className="flex items-center gap-2 text-[#18CFFC]">
                  <Users size={18} />
                  <h3 className="font-bold text-sm font-heading text-white">
                    Team Participation Rules
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-zinc-300">
                  <div className="p-3 rounded-xl bg-[#14141A] border border-white/[0.06]">
                    <span className="text-zinc-500 block mb-0.5">Required Team Size</span>
                    <strong className="text-white font-mono">
                      {event.min_team_size} to {event.max_team_size} members
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-[#14141A] border border-white/[0.06]">
                    <span className="text-zinc-500 block mb-0.5">Leader Inclusion</span>
                    <strong className="text-white">
                      {event.leader_counts_towards_size ? 'Leader is counted in size' : 'Excludes team leader'}
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl bg-[#14141A] border border-white/[0.06]">
                    <span className="text-zinc-500 block mb-0.5">Registration Mode</span>
                    <strong className="text-white">
                      {event.team_registration_mode === 'leader_adds_members' ? 'Leader registers team' : 'Members join via code'}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Event Description */}
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-bold font-heading text-white">
                About this Event
              </h2>
              <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line bg-[#0E0E12] p-6 rounded-2xl border border-white/[0.08] shadow-sm font-sans">
                {event.description}
              </div>
            </div>

            {/* ── Event Schedule & Timeline (Phase 6) ──────────────────────── */}
            {schedules.length > 0 && (
              <EventScheduleSection schedules={schedules} />
            )}

            {/* ── Featured Speakers & Judges (Phase 6) ─────────────────────── */}
            {speakers.length > 0 && (
              <EventSpeakersSection speakers={speakers} />
            )}

            {/* ── Event Moments Gallery (Phase 6) ──────────────────────────── */}
            {galleryImages.length > 0 && (
              <EventGallerySection images={galleryImages} />
            )}

            {/* ── Competition Leaderboard & Standings (Phase 6) ────────────── */}
            {(Boolean((event as any).leaderboard_enabled) || leaderboardEntries.length > 0) && (
              <EventLeaderboardSection
                entries={leaderboardEntries}
                title={(event as any).leaderboard_title || 'Competition Standings'}
                isOrganizer={canEditEvent}
              />
            )}

            {/* ── Official Merchandise & Add-ons (Phase 6) ─────────────────── */}
            {addons.length > 0 && (
              <EventAddonsSection addons={addons} />
            )}

            {/* Event Rules & Code of Conduct */}
            {event.rules && (
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)] flex items-center gap-2">
                  <FileText size={18} className="text-[#18CFFC]" /> Rules & Code of Conduct
                </h2>
                <div className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line bg-[#0E0E12] p-6 rounded-2xl border border-white/[0.08] shadow-sm">
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
                <div className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed bg-[#0E0E12] p-5 rounded-2xl border border-white/[0.08] flex items-start gap-3 shadow-sm">
                  <span>{event.eligibility}</span>
                </div>
              </div>
            )}

            {/* ── Prizes & Rewards (if configured) ─────────────────────────── */}
            {Array.isArray((event as any).prizes) && (event as any).prizes.length > 0 && (
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-bold font-heading text-white flex items-center gap-2">
                  <Trophy size={18} className="text-amber-400" />
                  Prizes & Rewards
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(event as any).prizes.map((prz: any, i: number) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl bg-gradient-to-b from-[#14141A] to-[#0E0E12] border border-white/[0.08] flex flex-col items-center text-center shadow-sm"
                    >
                      <span className="text-xs font-mono text-amber-400 font-bold mb-1">
                        {prz.rank}
                      </span>
                      <span className="text-sm font-bold text-white mb-1">{prz.title}</span>
                      <span className="text-lg font-extrabold text-[#18CFFC]">{prz.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Structured FAQs Accordion (Phase 6) ──────────────────────── */}
            {Array.isArray((event as any).faqs) && (event as any).faqs.length > 0 && (
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-bold font-heading text-white flex items-center gap-2">
                  <HelpCircle size={18} className="text-[#ED47FC]" />
                  Frequently Asked Questions
                </h2>
                <div className="bg-[#0E0E12] p-4 sm:p-5 rounded-2xl border border-white/[0.08] flex flex-col gap-2.5">
                  {(event as any).faqs.map((faq: any, i: number) => {
                    const isOpen = activeFaqIndex === i
                    return (
                      <div
                        key={i}
                        className="p-3.5 rounded-xl bg-[#14141A] border border-white/[0.06] transition-all cursor-pointer"
                        onClick={() => setActiveFaqIndex(isOpen ? null : i)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-xs sm:text-sm font-semibold text-white">
                            {faq.question}
                          </h4>
                          {isOpen ? (
                            <ChevronUp size={16} className="text-[#18CFFC] shrink-0" />
                          ) : (
                            <ChevronDown size={16} className="text-zinc-500 shrink-0" />
                          )}
                        </div>
                        {isOpen && (
                          <p className="text-xs text-zinc-300 leading-relaxed mt-2 pt-2 border-t border-white/[0.06] font-sans">
                            {faq.answer}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Organizer Contact Info */}
            {(event.contact_email || event.contact_phone) && (
              <div className="p-4 rounded-2xl bg-[#0E0E12] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <span className="text-zinc-400 font-medium">Have questions? Reach the host directly:</span>
                <div className="flex items-center gap-4 flex-wrap">
                  {event.contact_email && (
                    <a
                      href={`mailto:${event.contact_email}`}
                      className="flex items-center gap-1.5 text-[#18CFFC] hover:underline font-medium"
                    >
                      <Mail size={14} /> {event.contact_email}
                    </a>
                  )}
                  {event.contact_phone && (
                    <a
                      href={`tel:${event.contact_phone}`}
                      className="flex items-center gap-1.5 text-[#7F1AFB] hover:underline font-medium"
                    >
                      <Phone size={14} /> {event.contact_phone}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Event Community Q&A and Discussions */}
            <EventDiscussionSection
              eventId={event.id}
              clubId={event.club_id}
              isOrganizer={canModerateDiscussion}
            />

            {/* ── Related Events Recommendations (Phase 6) ────────────────── */}
            {relatedEvents.length > 0 && (
              <div className="flex flex-col gap-3 pt-6 border-t border-white/[0.08]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold font-heading text-white">
                      Explore More Campus Events
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Other recommended {event.category} events on FestFlow
                    </p>
                  </div>
                  <Link
                    to="/discover"
                    className="text-xs text-[#18CFFC] hover:underline font-semibold"
                  >
                    View All
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {relatedEvents.map((rel) => (
                    <Link
                      key={rel.id}
                      to={`/events/${rel.slug}`}
                      className="group p-3 rounded-2xl bg-[#0E0E12] border border-white/[0.08] hover:border-[#18CFFC]/50 transition-all flex flex-col justify-between gap-2 shadow-sm"
                    >
                      <div>
                        <div className="w-full h-24 rounded-xl overflow-hidden mb-2 bg-[#14141A]">
                          <img
                            src={resolvePosterUrl(rel.poster_url || rel.cover_url, rel.category as any)}
                            alt={rel.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                        <h4 className="text-xs font-bold text-white group-hover:text-[#18CFFC] transition-colors line-clamp-1">
                          {rel.title}
                        </h4>
                        <span className="text-[10px] text-zinc-400 block truncate">
                          {new Date(rel.start_date).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          • {rel.venue_name}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] pt-1 border-t border-white/[0.06]">
                        <span className="text-zinc-500 uppercase">{rel.category}</span>
                        <span className="font-bold text-white">
                          {rel.is_free ? 'Free' : `₹${rel.price}`}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right 1 Col: Registration & Ticket Card */}
          <div className="flex flex-col gap-6">
            <div className="p-5 sm:p-6 rounded-3xl bg-[#0E0E12] border border-white/[0.1] shadow-2xl flex flex-col gap-5 lg:sticky lg:top-28">
              {/* Fee & Tier Indicator */}
              <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                <div>
                  <span className="text-xs text-zinc-500 font-medium block">
                    {selectedTier ? selectedTier.name : 'Admission Fee'}
                  </span>
                  <span className="text-2xl sm:text-3xl font-extrabold font-heading text-white">
                    {displayIsFree ? (
                      <span className="text-emerald-400">Free Entry</span>
                    ) : (
                      `₹${displayPrice}`
                    )}
                  </span>
                </div>
                <Badge variant={displayIsFree ? 'success' : 'purple'}>
                  {displayIsFree ? 'Complimentary' : selectedTier ? selectedTier.tier_type.toUpperCase() : 'Ticketed'}
                </Badge>
              </div>

              {/* Real-time Urgency & Capacity Progress Bar */}
              <div className="p-3.5 rounded-2xl bg-[#14141A] border border-white/[0.08] flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 flex items-center gap-1 font-medium">
                    <Users size={13} className="text-[#18CFFC]" /> Seat Availability
                  </span>
                  <span className="font-mono text-white font-bold">
                    {remainingSeats} left of {totalCapacity}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden border border-white/5">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      capacityPercent >= 85
                        ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                        : 'bg-gradient-to-r from-[#18CFFC] to-[#07A4FC]'
                    }`}
                    style={{ width: `${capacityPercent}%` }}
                  />
                </div>
                {capacityPercent >= 80 && remainingSeats > 0 && (
                  <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
                    🔥 Filling fast! Only {remainingSeats} seat{remainingSeats > 1 ? 's' : ''} left
                  </span>
                )}
              </div>

              {/* Specifications */}
              <div className="flex flex-col gap-2.5 text-xs text-zinc-300">
                <div className="flex items-center justify-between py-1 border-b border-white/[0.06]">
                  <span className="flex items-center gap-1.5 text-zinc-500">
                    <UserCheck size={14} className="text-[#18CFFC]" /> Participation
                  </span>
                  <span className="font-medium text-white capitalize">
                    {event.participation_type} {event.participation_type === 'team' ? `(${event.min_team_size}–${event.max_team_size})` : ''}
                  </span>
                </div>

                {regOpensFormatted && !isRegOpenYet && (
                  <div className="flex items-center justify-between py-1 border-b border-white/[0.06]">
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <Clock size={14} /> Registration Opens
                    </span>
                    <span className="font-medium text-amber-300">
                      {regOpensFormatted}
                    </span>
                  </div>
                )}

                {regClosesFormatted && (
                  <div className="flex items-center justify-between py-1 border-b border-white/[0.06]">
                    <span className="flex items-center gap-1.5 text-zinc-500">
                      <Clock size={14} /> Registration Closes
                    </span>
                    <span className="font-medium text-white">
                      {regClosesFormatted}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between py-1">
                  <span className="flex items-center gap-1.5 text-zinc-500">
                    <Ticket size={14} className="text-[#18CFFC]" /> Entry Credential
                  </span>
                  <span className="font-medium text-zinc-200">
                    Verified Digital Pass
                  </span>
                </div>
              </div>

              {/* Event Live Countdown */}
              {startDate && !isStarted && !isCompleted && !isCancelled && (
                <div className="p-3.5 rounded-2xl bg-[#0E0E12] border border-white/10 flex flex-col items-center gap-1.5 my-2">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Event Starts In
                  </span>
                  <EventCountdown targetDate={event.start_date} endDate={event.end_date} size="sm" />
                </div>
              )}

              {/* Already Registered Indicator */}
              {existingReg && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    <span>
                      {(existingReg as any).attendance_status === 'checked_in' ||
                      (existingReg as any).attendance_status === 'checked_out'
                        ? 'Attendance Recorded'
                        : existingReg.status === 'confirmed'
                        ? 'Pass Confirmed'
                        : existingReg.approval_status === 'pending'
                        ? 'Awaiting Approval'
                        : 'Registration Pending'}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] font-bold text-white bg-black/40 px-2 py-0.5 rounded">
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

                  {isCancellationPending ? (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs flex items-start gap-2.5 shadow-sm text-left">
                      <Clock size={16} className="shrink-0 text-amber-400 mt-0.5" />
                      <div>
                        <div className="font-semibold text-amber-200">Cancellation Request Pending Club Approval</div>
                        <div className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                          Your request to cancel has been submitted to the club organizers. Your ticket remains active until the club reviews and accepts your request.
                        </div>
                      </div>
                    </div>
                  ) : isRegCancelled ? (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
                      <XCircle size={16} className="shrink-0" />
                      <span>This registration was cancelled by the event organizers.</span>
                    </div>
                  ) : canRequestCancellation ? (
                    <div className="flex flex-col gap-1 w-full">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowCancelModal(true)}
                        className="w-full text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 py-2 border border-rose-500/20 justify-center min-h-[40px]"
                      >
                        Request Ticket Cancellation
                      </Button>
                      <span className="text-[10px] text-zinc-500 text-center">
                        Requires approval from the club organizer
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-center text-zinc-500 bg-[#14141A] p-2.5 rounded-xl border border-white/[0.06] leading-relaxed">
                      {isCheckedIn ? (
                        <span>Attendance recorded • Ticket cannot be cancelled after recorded entry</span>
                      ) : isStarted ? (
                        <span>Event has started • Registration cancellation is closed</span>
                      ) : isCutoffPassed ? (
                        <span>Cancellation deadline passed ({cutoffHours}h cutoff before event start)</span>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2 mt-2">
                  {/* Waitlist Callout if Event is Full / Sold Out */}
                  {remainingSeats === 0 && totalCapacity > 0 && !existingReg && (
                    <div className="space-y-2 mb-2">
                      {waitlistStatus?.userEntry?.status === 'waiting' ? (
                        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold flex items-center gap-1.5 text-xs">
                              <Clock size={15} /> You're on the Waitlist!
                            </span>
                            <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-amber-400/20 text-amber-300">
                              Position #{waitlistStatus.userEntry.position}
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-200/80 leading-relaxed">
                            If an attendee cancels or capacity expands, we'll notify you immediately with a claim window.
                          </p>
                          <button
                            type="button"
                            onClick={handleLeaveWaitlist}
                            className="text-[11px] text-amber-300/70 hover:text-amber-200 underline cursor-pointer"
                          >
                            Leave waitlist
                          </button>
                        </div>
                      ) : waitlistStatus?.userEntry?.status === 'offered' ? (
                        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 space-y-2">
                          <span className="font-bold flex items-center gap-1.5 text-xs">
                            <Sparkles size={15} /> A Spot Opened Up for You!
                          </span>
                          <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                            A seat is reserved for you. Complete registration now!
                          </p>
                          <Button
                            variant="primary"
                            size="md"
                            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold"
                            onClick={() => handleCtaClick()}
                          >
                            Claim Reserved Pass
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
                            <AlertCircle size={15} />
                            <span>Event Capacity Reached (Sold Out)</span>
                          </div>
                          <Button
                            variant="primary"
                            size="lg"
                            className="w-full bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] text-white font-bold"
                            disabled={isJoiningWaitlist}
                            onClick={handleJoinWaitlist}
                            leftIcon={<Clock size={16} />}
                          >
                            {isJoiningWaitlist ? 'Joining Waitlist...' : 'Join Event Waitlist'}
                          </Button>
                          {waitlistMessage && (
                            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
                              {waitlistMessage}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* One-Click Fast Registration for eligible free individual events */}
                  {canQuickRegister && (
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full bg-gradient-to-r from-[#18CFFC] via-[#07A4FC] to-[#7F1AFB] text-white shadow-[0_0_20px_rgba(24,207,252,0.3)] hover:shadow-[0_0_25px_rgba(24,207,252,0.5)] font-bold min-h-[48px]"
                      disabled={isQuickRegistering}
                      onClick={handleQuickRegister}
                      leftIcon={isQuickRegistering ? <Clock size={18} className="animate-spin" /> : <Zap size={18} className="text-yellow-300 fill-current" />}
                    >
                      {isQuickRegistering ? 'Securing your entry pass…' : '⚡ 1-Click Quick Register'}
                    </Button>
                  )}

                  {quickRegNotice && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 size={16} className="shrink-0" />
                      <span>{quickRegNotice}</span>
                    </div>
                  )}

                  {/* Standard Full Registration Button */}
                  <Button
                    variant={canQuickRegister ? 'outline' : 'primary'}
                    size={canQuickRegister ? 'md' : 'lg'}
                    className={`w-full ${canQuickRegister ? 'text-xs text-zinc-300 hover:text-white border-white/10' : ''}`}
                    disabled={!canRegister || checkingReg}
                    onClick={handleCtaClick}
                    leftIcon={<Ticket size={canQuickRegister ? 15 : 18} />}
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
                      : event.registration_mode === 'reserved_seating'
                      ? 'Select Seats'
                      : canQuickRegister
                      ? 'Custom Details Registration'
                      : displayIsFree
                      ? (event.participation_type === 'team' ? 'Register Team (Free)' : 'Claim Free Pass')
                      : (event.participation_type === 'team' ? 'Register Team Pass' : `Register (₹${displayPrice})`)}
                  </Button>
                </div>
              )}

              {event.participation_type === 'team' && canRegister && !existingReg && (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  className="w-full mt-2 border-white/15 hover:border-[#18CFFC] text-zinc-300 hover:text-white min-h-[42px]"
                  onClick={() => setShowJoinModal(true)}
                  leftIcon={<Users size={16} className="text-[#18CFFC]" />}
                >
                  Join an Existing Squad
                </Button>
              )}

              {/* Add to Calendar Menu */}
              <div className="relative pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-white/10 text-xs text-zinc-300 hover:text-white justify-center h-8"
                  onClick={() => setShowCalendarMenu(!showCalendarMenu)}
                  leftIcon={<CalendarPlus size={13} className="text-[#18CFFC]" />}
                >
                  Add to Calendar
                </Button>

                {showCalendarMenu && (
                  <div className="absolute bottom-full left-0 right-0 mb-1.5 p-1.5 rounded-xl bg-[#0E0E12] border border-white/15 shadow-2xl flex flex-col gap-1 z-30 backdrop-blur-xl">
                    <a
                      href={generateGoogleCalendarUrl({
                        title: event.title,
                        description: event.description,
                        startDate: event.start_date,
                        endDate: event.end_date,
                        location: event.venue_name || event.venue_address || 'Campus Venue',
                        url: typeof window !== 'undefined' ? window.location.href : '',
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-between"
                      onClick={() => setShowCalendarMenu(false)}
                    >
                      <span>Google Calendar</span>
                      <CalendarPlus size={12} className="text-[#18CFFC]" />
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        downloadIcsFile({
                          title: event.title,
                          description: event.description,
                          startDate: event.start_date,
                          endDate: event.end_date,
                          location: event.venue_name || event.venue_address || 'Campus Venue',
                          url: typeof window !== 'undefined' ? window.location.href : '',
                        })
                        setShowCalendarMenu(false)
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-between text-left cursor-pointer"
                    >
                      <span>Download .ICS File</span>
                      <Download size={12} className="text-zinc-400" />
                    </button>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
                Tickets are issued as verified FestFlow digital entry passes upon registration confirmation.
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
                You are currently logged in as a <strong>Club Organizer</strong>. Organizers manage events and attendee rosters. To claim a student entry pass, please sign in with or create a student account.
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
            selectedTierId={selectedTierId}
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
                      : displayIsFree
                      ? 'confirmed'
                      : 'pending_payment'),
                  created_at: new Date().toISOString(),
                  ticket_issued_at: res.ticket_issued ? new Date().toISOString() : null,
                  cancelled_at: null,
                  updated_at: new Date().toISOString(),
                  approval_status:
                    res.approval_status ||
                    (event.approval_type === 'manual' ? 'pending' : 'approved'),
                  ticket_tier_id: selectedTier ? selectedTier.id : null,
                  ticket_tier_name: selectedTier ? selectedTier.name : null,
                  unit_price: selectedTier ? selectedTier.price : null,
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

        {/* ── Request Cancellation Modal (Club Review Workflow) ─────────── */}
        {existingReg && (
          <RequestCancellationModal
            isOpen={showCancelModal}
            onClose={() => setShowCancelModal(false)}
            registrationId={existingReg.id}
            eventTitle={event?.title || 'this event'}
            onSubmitted={() => {
              setShowCancelModal(false)
              if (user?.id && event?.id) {
                checkStudentRegistrationForEvent(user.id, event.id).then((res) => {
                  if (res.registration) setExistingReg(res.registration)
                })
              }
            }}
          />
        )}

        {/* ── Organizer Experience Manager Hub Modal (Phase 6) ─────────────── */}
        {event && canEditEvent && (
          <EventOrganizerExperienceModal
            isOpen={showOrganizerModal}
            onClose={() => setShowOrganizerModal(false)}
            eventId={event.id}
            clubId={event.club_id}
            initialData={{
              meetingPlatform: (event as any).meeting_platform,
              meetingUrl: (event as any).meeting_url,
              joiningInstructions: (event as any).joining_instructions,
              accessWindowMinutes: (event as any).access_window_minutes,
              leaderboardEnabled: (event as any).leaderboard_enabled,
              leaderboardTitle: (event as any).leaderboard_title,
            }}
            tiers={ticketTiers}
            schedules={schedules}
            speakers={speakers}
            gallery={galleryImages}
            announcements={announcements}
            leaderboard={leaderboardEntries}
            addons={addons}
            onRefresh={() => loadPhase6Data(event.id, event.category)}
          />
        )}

        {/* ── Persistent Mobile Registration Dock (Phones & Small Tablets) ────── */}
        <div className="lg:hidden fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-30 px-3.5 py-2.5 border-t border-white/[0.1] bg-[#08080A]/95 backdrop-blur-2xl shadow-[0_-8px_32px_rgba(0,0,0,0.8)]">
          <div className="max-w-md mx-auto flex items-center justify-between gap-2.5">
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block truncate">
                {selectedTier ? selectedTier.name : displayIsFree ? 'Free Admission' : 'Entry Ticket'}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-extrabold font-heading text-white">
                  {displayIsFree ? <span className="text-emerald-400">Free Pass</span> : `₹${displayPrice}`}
                </span>
                {event.participation_type === 'team' && (
                  <span className="text-[10px] text-zinc-500">
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
                    className="min-h-[44px] text-xs px-2.5 border-white/15 text-zinc-300 hover:text-white"
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
                  className="min-h-[44px] font-semibold shadow-lg shadow-[#18CFFC]/25"
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
                    : event.registration_mode === 'reserved_seating'
                    ? 'Select Seats'
                    : displayIsFree
                    ? (event.participation_type === 'team' ? 'Register Team' : 'Claim Free Pass')
                    : (event.participation_type === 'team' ? 'Register Team' : `Register (₹${displayPrice})`)}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Modal: Event Sharing ────────────────────────────────────────── */}
        <EventShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          event={{
            title: event.title,
            clubName,
            date: formattedDate,
            venue: event.venue_name || event.venue_address || undefined,
            slug: event.slug,
            posterUrl: event.poster_url,
          }}
        />
      </div>
    </PageShell>
  )
}
