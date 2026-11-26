import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router'
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
import { fetchEventSeatCounts } from '@/lib/seating'
import { RequestCancellationModal } from '@/components/registration/RequestCancellationModal'
import { subscribeToStatusChanges } from '@/lib/sync'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
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

  // Real-time seat counts & availability state
  const [liveSeats, setLiveSeats] = useState<{ total: number; occupied: number; remaining: number } | null>(null)

  const refreshSeatCounts = (eventId: string, mode?: string, cap: number = 100) => {
    fetchEventSeatCounts(eventId, mode, cap).then(setLiveSeats)
  }

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
        refreshSeatCounts(res.event.id, res.event.registration_mode, res.event.capacity)
      }
    })

    return () => {
      mounted = false
    }
  }, [slug])

  // Real-time listener for seat reservations and registrations
  useEffect(() => {
    if (!event?.id) return
    refreshSeatCounts(event.id, event.registration_mode, event.capacity)

    const channel = supabase
      .channel(`event-seats-live-${event.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'seat_reservations', filter: `event_id=eq.${event.id}` },
        () => refreshSeatCounts(event.id, event.registration_mode, event.capacity)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'registrations', filter: `event_id=eq.${event.id}` },
        () => refreshSeatCounts(event.id, event.registration_mode, event.capacity)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [event?.id, event?.registration_mode, event?.capacity])

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
      const studentName = profile?.display_name || (user.user_metadata?.display_name as string) || 'Registered Student'
      const college = studentProfile?.college_name || (user.user_metadata?.college as string) || 'Not specified'

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
          <div className="w-10 h-10 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin mb-4" />
          <span className="text-xs text-gray-500 font-medium">
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
        <div className="max-w-xl mx-auto px-4 py-20 text-center flex flex-col items-center bg-white p-8 rounded-2xl border border-gray-200 shadow-sm my-12">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-4">
            <AlertTriangle size={28} />
          </div>
          <h1 className="text-2xl font-bold font-display text-gray-900 mb-2">
            Event Not Available
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mb-6 max-w-md leading-relaxed">
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
  const cachedPoster =
    typeof window !== 'undefined' && event
      ? localStorage.getItem(`festflow_custom_poster_${event.id}`) ||
        localStorage.getItem(`festflow_custom_poster_${event.slug}`)
      : null

  // Prioritize DB poster_url first. Only if DB poster_url is absent or empty, fall back to non-stock cached poster
  const dbPoster = event.poster_url && event.poster_url !== 'null' && event.poster_url !== 'undefined' && String(event.poster_url).trim() ? event.poster_url : null
  const dbCover = (event as any).cover_url && (event as any).cover_url !== 'null' && (event as any).cover_url !== 'undefined' && String((event as any).cover_url).trim() ? (event as any).cover_url : null
  const validCached = cachedPoster && !cachedPoster.includes('images.unsplash.com') ? cachedPoster : null

  const rawPoster = dbPoster || dbCover || validCached
  const hasCustomPoster = Boolean(rawPoster)

  const posterSource =
    !bannerImgError && hasCustomPoster
      ? resolvePosterUrl(rawPoster, event.category)
      : CATEGORY_POSTERS[event.category] || CATEGORY_POSTERS.tech

  // Capacity Calculations & Urgency (Backed by real database seat reservations & holds)
  const totalCapacity = liveSeats?.total && liveSeats.total > 0 ? liveSeats.total : (event.capacity || 100)
  const occupiedCount = liveSeats ? liveSeats.occupied : ((event as any).registered_count || (ticketTiers.reduce((acc, t) => acc + (t.sold_count || 0), 0) || 0))
  const remainingSeats = liveSeats ? liveSeats.remaining : Math.max(0, totalCapacity - occupiedCount)
  const capacityPercent = totalCapacity > 0 ? Math.min(100, Math.round((occupiedCount / totalCapacity) * 100)) : 0

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
        <div className="flex items-center justify-between py-4 text-xs text-gray-500 border-b border-gray-200 mb-6 flex-wrap gap-2">
          <div className="flex items-center gap-2 truncate">
            <Link to="/discover" className="hover:text-gray-900 flex items-center gap-1 transition-colors font-medium">
              <ArrowLeft size={14} /> Discover
            </Link>
            <span className="text-gray-300">/</span>
            <span className="capitalize">{event.category}</span>
            <span className="text-gray-300">/</span>
            <span className="text-gray-900 font-semibold truncate max-w-[180px] sm:max-w-xs">
              {event.title}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {canEditEvent && (
              <button
                type="button"
                onClick={() => setShowOrganizerModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors text-xs font-semibold cursor-pointer"
              >
                <Sliders size={13} />
                <span>Experience Desk</span>
              </button>
            )}

            {user && (
              <button
                type="button"
                onClick={handleWishlistToggle}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-xs border font-medium cursor-pointer ${
                  isSaved
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200'
                }`}
                aria-label={isSaved ? 'Saved in Wishlist' : 'Save to Wishlist'}
              >
                <Heart size={14} className={isSaved ? 'fill-current text-rose-600' : 'text-gray-400'} />
                <span>{isSaved ? 'Saved' : 'Save'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors text-xs font-medium border border-gray-200 cursor-pointer"
            >
              <Share2 size={14} className="text-blue-600" />
              <span>Share</span>
            </button>
          </div>
        </div>

        {/* ── Pinned Live Announcement Alert Banner ─────────────────────────── */}
        {pinnedAnnouncement && (
          <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 flex items-start gap-3 text-xs sm:text-sm shadow-2xs">
            <Sparkles size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold text-gray-900 mb-0.5">
                {pinnedAnnouncement.title}
              </strong>
              <p className="text-gray-700 leading-relaxed">
                {pinnedAnnouncement.content}
              </p>
            </div>
          </div>
        )}

        {/* ── Status Notice Banners ────────────────────────────────────────── */}
        {isCancelled && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-3 text-sm">
            <AlertTriangle size={20} className="shrink-0 text-rose-600" />
            <div>
              <strong className="block font-semibold">Event Cancelled</strong>
              This event has been marked as cancelled by the organizer. Registrations are closed.
            </div>
          </div>
        )}

        {isRegClosedStatus && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-3 text-sm">
            <AlertTriangle size={20} className="shrink-0 text-amber-600" />
            <div>
              <strong className="block font-semibold">Registration Closed</strong>
              The organizer has closed registrations for this event. No new passes can be claimed.
            </div>
          </div>
        )}

        {isCompleted && (
          <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 flex items-center gap-3 text-sm">
            <CheckCircle2 size={20} className="shrink-0 text-blue-600" />
            <div>
              <strong className="block font-semibold">Event Concluded</strong>
              This event has successfully concluded. Thank you to all attendees.
            </div>
          </div>
        )}

        {isDraft && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Info size={18} className="shrink-0 text-amber-600" />
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
          </div>
        )}

        {/* ── Editorial Hero Poster Banner ─────────────────────────────────── */}
        <div className="relative w-full h-64 sm:h-84 md:h-[400px] rounded-2xl overflow-hidden border border-gray-200 mb-6 sm:mb-8 shadow-md group bg-gray-900">
          {posterSource && !bannerImgError ? (
            <img
              key={posterSource}
              src={posterSource.startsWith('data:') || posterSource.startsWith('blob:') ? posterSource : getOptimizedImageUrl(posterSource, 1080)}
              srcSet={posterSource.startsWith('data:') || posterSource.startsWith('blob:') ? undefined : getImageSrcSet(posterSource)}
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
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.01]"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 p-6 relative overflow-hidden">
              <div className="w-14 h-14 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white mb-3">
                <Sparkles size={26} />
              </div>
              <span className="text-xs font-bold text-white tracking-widest uppercase font-mono">
                {event.category} Experience
              </span>
              <p className="text-xs text-gray-300 mt-1 max-w-sm text-center">
                {event.title}
              </p>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950/90 via-gray-950/35 to-transparent pointer-events-none" />

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
          <div className="lg:col-span-2 flex flex-col gap-6 sm:gap-8">
            {/* Organizer Card */}
            <div className="p-4 sm:p-5 rounded-xl bg-white border border-gray-200 flex items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-xs">
                  <Building2 size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm sm:text-base text-gray-900">
                      {clubName}
                    </span>
                    <ShieldCheck size={16} className="text-blue-600" />
                  </div>
                  <span className="text-xs text-gray-500">
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
                      className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-900 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Sliders size={14} className="text-blue-600" />
                      <span>Manage Hub</span>
                    </button>
                  )}
                  {canViewRoster && (
                    <Link to={`/club/events/${event.id}/registrations`}>
                      <Button variant="secondary" size="sm" leftIcon={<Users size={14} />}>
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
              <div className="p-4 rounded-xl bg-white border border-gray-200 flex items-start gap-3.5 shadow-xs">
                <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 shrink-0 border border-blue-200/80">
                  <Calendar size={18} />
                </div>
                <div className="text-xs min-w-0">
                  <span className="text-gray-500 block mb-0.5 font-medium">Date & Time</span>
                  <strong className="text-gray-900 font-semibold block truncate">
                    {formattedDate}
                  </strong>
                  <span className="text-gray-600">
                    {formattedStartTime} – {formattedEndTime} ({event.timezone || 'IST'})
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-gray-200 flex items-start gap-3.5 shadow-xs">
                <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600 shrink-0 border border-indigo-200/80">
                  {event.event_type === 'online' ? <Globe size={18} /> : <MapPin size={18} />}
                </div>
                <div className="text-xs min-w-0">
                  <span className="text-gray-500 block mb-0.5 font-medium">
                    {event.event_type === 'online' ? 'Session Format' : 'Venue Location'}
                  </span>
                  <strong className="text-gray-900 font-semibold block truncate">
                    {event.venue_name || (event.event_type === 'online' ? 'Virtual Meeting' : 'Campus Venue')}
                  </strong>
                  <span className="text-gray-600 truncate block">
                    {event.event_type === 'online'
                      ? 'Encrypted Virtual Access Portal'
                      : (event.venue_address || 'Campus Venue')}
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
              <div className="p-5 rounded-xl bg-white border border-gray-200 flex flex-col gap-3 shadow-xs">
                <div className="flex items-center gap-2 text-blue-600">
                  <Users size={18} />
                  <h3 className="font-semibold text-sm font-display text-gray-900">
                    Team Participation Rules
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-600">
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200/80">
                    <span className="text-gray-500 block mb-0.5">Required Team Size</span>
                    <strong className="text-gray-900 font-mono">
                      {event.min_team_size} to {event.max_team_size} members
                    </strong>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200/80">
                    <span className="text-gray-500 block mb-0.5">Leader Inclusion</span>
                    <strong className="text-gray-900">
                      {event.leader_counts_towards_size ? 'Leader is counted in size' : 'Excludes team leader'}
                    </strong>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200/80">
                    <span className="text-gray-500 block mb-0.5">Registration Mode</span>
                    <strong className="text-gray-900">
                      {event.team_registration_mode === 'leader_adds_members' ? 'Leader registers team' : 'Members join via code'}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Event Description */}
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-bold font-display text-gray-900">
                About this Event
              </h2>
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
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
                <h2 className="text-lg font-bold font-display text-gray-900 flex items-center gap-2">
                  <FileText size={18} className="text-blue-600" /> Rules & Code of Conduct
                </h2>
                <div className="text-xs sm:text-sm text-gray-700 leading-relaxed whitespace-pre-line bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
                  {event.rules}
                </div>
              </div>
            )}

            {/* Eligibility & Guidelines */}
            {event.eligibility && (
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-bold font-display text-gray-900 flex items-center gap-2">
                  <Sparkles size={18} className="text-amber-600" /> Eligibility & Requirements
                </h2>
                <div className="text-xs sm:text-sm text-gray-700 leading-relaxed bg-white p-5 rounded-xl border border-gray-200 flex items-start gap-3 shadow-xs">
                  <span>{event.eligibility}</span>
                </div>
              </div>
            )}

            {/* ── Prizes & Rewards ─────────────────────────── */}
            {Array.isArray((event as any).prizes) && (event as any).prizes.length > 0 && (
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-bold font-display text-gray-900 flex items-center gap-2">
                  <Trophy size={18} className="text-amber-600" />
                  Prizes & Rewards
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(event as any).prizes.map((prz: any, i: number) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl bg-white border border-gray-200 flex flex-col items-center text-center shadow-xs"
                    >
                      <span className="text-xs font-mono text-amber-700 font-semibold mb-1">
                        {prz.rank}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 mb-1">{prz.title}</span>
                      <span className="text-lg font-bold text-blue-600">{prz.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Structured FAQs Accordion ──────────────────────── */}
            {Array.isArray((event as any).faqs) && (event as any).faqs.length > 0 && (
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-bold font-display text-gray-900 flex items-center gap-2">
                  <HelpCircle size={18} className="text-indigo-600" />
                  Frequently Asked Questions
                </h2>
                <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 flex flex-col gap-2.5 shadow-xs">
                  {(event as any).faqs.map((faq: any, i: number) => {
                    const isOpen = activeFaqIndex === i
                    return (
                      <div
                        key={i}
                        className="p-3.5 rounded-lg bg-gray-50 border border-gray-200/80 transition-colors cursor-pointer hover:bg-gray-100/70"
                        onClick={() => setActiveFaqIndex(isOpen ? null : i)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-xs sm:text-sm font-semibold text-gray-900">
                            {faq.question}
                          </h4>
                          {isOpen ? (
                            <ChevronUp size={16} className="text-blue-600 shrink-0" />
                          ) : (
                            <ChevronDown size={16} className="text-gray-400 shrink-0" />
                          )}
                        </div>
                        {isOpen && (
                          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mt-2 pt-2 border-t border-gray-200">
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
              <div className="p-4 rounded-xl bg-white border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
                <span className="text-gray-600 font-medium">Have questions? Reach the host directly:</span>
                <div className="flex items-center gap-4 flex-wrap">
                  {event.contact_email && (
                    <a
                      href={`mailto:${event.contact_email}`}
                      className="flex items-center gap-1.5 text-blue-600 hover:underline font-medium"
                    >
                      <Mail size={14} /> {event.contact_email}
                    </a>
                  )}
                  {event.contact_phone && (
                    <a
                      href={`tel:${event.contact_phone}`}
                      className="flex items-center gap-1.5 text-indigo-600 hover:underline font-medium"
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

            {/* ── Related Events Recommendations ────────────────── */}
            {relatedEvents.length > 0 && (
              <div className="flex flex-col gap-3 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold font-display text-gray-900">
                      Explore More Campus Events
                    </h3>
                    <p className="text-xs text-gray-500">
                      Other recommended {event.category} events on FestFlow
                    </p>
                  </div>
                  <Link
                    to="/discover"
                    className="text-xs text-blue-600 hover:underline font-semibold"
                  >
                    View All
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {relatedEvents.map((rel) => (
                    <Link
                      key={rel.id}
                      to={`/events/${rel.slug}`}
                      className="group p-3 rounded-xl bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all flex flex-col justify-between gap-2 shadow-xs"
                    >
                      <div>
                        <div className="w-full h-24 rounded-lg overflow-hidden mb-2 bg-gray-100">
                          <img
                            src={resolvePosterUrl(rel.poster_url || rel.cover_url, rel.category as any)}
                            alt={rel.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                        <h4 className="text-xs font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                          {rel.title}
                        </h4>
                        <span className="text-[11px] text-gray-500 block truncate">
                          {new Date(rel.start_date).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          • {rel.venue_name}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-gray-100">
                        <span className="text-gray-500 uppercase text-[10px] font-medium">{rel.category}</span>
                        <span className="font-semibold text-gray-900">
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
            <div className="p-5 sm:p-6 rounded-2xl bg-white border border-gray-200 shadow-lg flex flex-col gap-5 lg:sticky lg:top-24">
              {/* Fee & Tier Indicator */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div>
                  <span className="text-xs text-gray-500 font-medium block">
                    {selectedTier ? selectedTier.name : 'Admission Fee'}
                  </span>
                  <span className="text-2xl sm:text-3xl font-bold font-display text-gray-900">
                    {displayIsFree ? (
                      <span className="text-emerald-600">Free Entry</span>
                    ) : (
                      `₹${displayPrice}`
                    )}
                  </span>
                </div>
                <Badge variant={displayIsFree ? 'success' : 'violet'}>
                  {displayIsFree ? 'Complimentary' : selectedTier ? selectedTier.tier_type.toUpperCase() : 'Ticketed'}
                </Badge>
              </div>

              {/* Real-time Urgency & Capacity Progress Bar */}
              {event.show_seat_availability !== false ? (
                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 flex items-center gap-1 font-medium">
                      <Users size={13} className="text-blue-600" /> Seat Availability
                    </span>
                    <span className="font-mono text-gray-900 font-semibold">
                      {remainingSeats} left of {totalCapacity}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        capacityPercent >= 85
                          ? 'bg-rose-500'
                          : 'bg-blue-600'
                      }`}
                      style={{ width: `${capacityPercent}%` }}
                    />
                  </div>
                  {capacityPercent >= 80 && remainingSeats > 0 && (
                    <span className="text-[11px] text-amber-700 font-medium flex items-center gap-1">
                      Filling fast · Only {remainingSeats} seat{remainingSeats > 1 ? 's' : ''} left
                    </span>
                  )}
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 flex items-center gap-1.5 font-medium">
                      <Users size={13} className="text-blue-600" /> Registration
                    </span>
                    <Badge variant={canRegister ? 'success' : 'neutral'}>
                      {canRegister ? 'Open for Booking' : 'Closed'}
                    </Badge>
                  </div>
                  {canEditEvent && (
                    <span className="text-[10px] text-gray-500 italic block">
                      Seat count hidden from participants (Organizer view: {remainingSeats} left of {totalCapacity})
                    </span>
                  )}
                </div>
              )}

              {/* Specifications */}
              <div className="flex flex-col gap-2.5 text-xs text-gray-600">
                <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <UserCheck size={14} className="text-gray-400" /> Participation
                  </span>
                  <span className="font-semibold text-gray-900 capitalize">
                    {event.participation_type} {event.participation_type === 'team' ? `(${event.min_team_size}–${event.max_team_size})` : ''}
                  </span>
                </div>

                {regOpensFormatted && !isRegOpenYet && (
                  <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span className="flex items-center gap-1.5 text-amber-700">
                      <Clock size={14} /> Registration Opens
                    </span>
                    <span className="font-medium text-amber-800">
                      {regOpensFormatted}
                    </span>
                  </div>
                )}

                {regClosesFormatted && (
                  <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <Clock size={14} className="text-gray-400" /> Registration Closes
                    </span>
                    <span className="font-medium text-gray-900">
                      {regClosesFormatted}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between py-1">
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <Ticket size={14} className="text-gray-400" /> Entry Credential
                  </span>
                  <span className="font-medium text-gray-900">
                    Verified Digital Pass
                  </span>
                </div>
              </div>

              {/* Event Live Countdown */}
              {startDate && !isStarted && !isCompleted && !isCancelled && (
                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex flex-col items-center gap-1.5 my-1">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    Event Starts In
                  </span>
                  <EventCountdown targetDate={event.start_date} endDate={event.end_date} size="sm" />
                </div>
              )}

              {/* Already Registered Indicator */}
              {existingReg && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium">
                    <CheckCircle2 size={16} className="text-emerald-600" />
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
                  <span className="font-mono text-[11px] font-bold text-emerald-950 bg-white border border-emerald-200 px-2 py-0.5 rounded">
                    {existingReg.ticket_code}
                  </span>
                </div>
              )}

              {/* Registration CTA Button & Actions */}
              {existingReg ? (
                <div className="space-y-2 mt-1">
                  <Link to={`/student/tickets/${existingReg.id}`}>
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full"
                      leftIcon={<Ticket size={17} />}
                    >
                      View Your Entry Pass
                    </Button>
                  </Link>

                  {isCancellationPending ? (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 text-left">
                      <Clock size={16} className="shrink-0 text-amber-600 mt-0.5" />
                      <div>
                        <div className="font-semibold text-amber-950">Cancellation Request Pending Club Approval</div>
                        <div className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                          Your request to cancel has been submitted to the club organizers. Your ticket remains active until the club reviews and accepts your request.
                        </div>
                      </div>
                    </div>
                  ) : isRegCancelled ? (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                      <XCircle size={16} className="shrink-0 text-rose-600" />
                      <span>This registration was cancelled by the event organizers.</span>
                    </div>
                  ) : canRequestCancellation ? (
                    <div className="flex flex-col gap-1 w-full pt-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowCancelModal(true)}
                        className="w-full text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 py-2 border border-rose-200 justify-center min-h-[38px]"
                      >
                        Request Ticket Cancellation
                      </Button>
                      <span className="text-[10px] text-gray-500 text-center">
                        Requires approval from the club organizer
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-center text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-200 leading-relaxed">
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
                <div className="space-y-2 mt-1">
                  {/* Waitlist Callout */}
                  {remainingSeats === 0 && totalCapacity > 0 && !existingReg && (
                    <div className="space-y-2 mb-2">
                      {waitlistStatus?.userEntry?.status === 'waiting' ? (
                        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold flex items-center gap-1.5 text-xs">
                              <Clock size={15} className="text-amber-600" /> You&apos;re on the Waitlist
                            </span>
                            <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-amber-100 text-amber-900">
                              Position #{waitlistStatus.userEntry.position}
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-800 leading-relaxed">
                            If an attendee cancels or capacity expands, we&apos;ll notify you immediately with a claim window.
                          </p>
                          <button
                            type="button"
                            onClick={handleLeaveWaitlist}
                            className="text-[11px] text-amber-700 hover:text-amber-900 underline cursor-pointer font-medium"
                          >
                            Leave waitlist
                          </button>
                        </div>
                      ) : waitlistStatus?.userEntry?.status === 'offered' ? (
                        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
                          <span className="font-semibold flex items-center gap-1.5 text-xs">
                            <Sparkles size={15} className="text-emerald-600" /> A Spot Opened Up for You!
                          </span>
                          <p className="text-[11px] text-emerald-800 leading-relaxed">
                            A seat is reserved for you. Complete registration now!
                          </p>
                          <Button
                            variant="primary"
                            size="md"
                            className="w-full"
                            onClick={() => handleCtaClick()}
                          >
                            Claim Reserved Pass
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                            <AlertCircle size={15} className="text-amber-600" />
                            <span>Event Capacity Reached (Sold Out)</span>
                          </div>
                          <Button
                            variant="primary"
                            size="lg"
                            className="w-full"
                            disabled={isJoiningWaitlist}
                            onClick={handleJoinWaitlist}
                            leftIcon={<Clock size={16} />}
                          >
                            {isJoiningWaitlist ? 'Joining Waitlist...' : 'Join Event Waitlist'}
                          </Button>
                          {waitlistMessage && (
                            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800">
                              {waitlistMessage}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* One-Click Fast Registration */}
                  {canQuickRegister && (
                    <Button
                      variant="primary"
                      size="lg"
                      className="w-full min-h-[46px]"
                      disabled={isQuickRegistering}
                      onClick={handleQuickRegister}
                      leftIcon={isQuickRegistering ? <Clock size={17} className="animate-spin" /> : <Zap size={17} />}
                    >
                      {isQuickRegistering ? 'Securing your entry pass…' : '1-Click Quick Register'}
                    </Button>
                  )}

                  {quickRegNotice && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                      <span>{quickRegNotice}</span>
                    </div>
                  )}

                  {/* Standard Full Registration Button */}
                  <Button
                    variant={canQuickRegister ? 'secondary' : 'primary'}
                    size={canQuickRegister ? 'md' : 'lg'}
                    className="w-full"
                    disabled={!canRegister || checkingReg}
                    onClick={handleCtaClick}
                    leftIcon={<Ticket size={canQuickRegister ? 15 : 17} />}
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
                  variant="secondary"
                  size="md"
                  className="w-full mt-1"
                  onClick={() => setShowJoinModal(true)}
                  leftIcon={<Users size={15} className="text-blue-600" />}
                >
                  Join an Existing Squad
                </Button>
              )}

              {/* Add to Calendar Menu */}
              <div className="relative pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-gray-600 hover:text-gray-900 justify-center border border-gray-200"
                  onClick={() => setShowCalendarMenu(!showCalendarMenu)}
                  leftIcon={<CalendarPlus size={13} className="text-blue-600" />}
                >
                  Add to Calendar
                </Button>

                {showCalendarMenu && (
                  <div className="absolute bottom-full left-0 right-0 mb-1.5 p-1.5 rounded-xl bg-white border border-gray-200 shadow-xl flex flex-col gap-1 z-30">
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
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors flex items-center justify-between"
                      onClick={() => setShowCalendarMenu(false)}
                    >
                      <span>Google Calendar</span>
                      <CalendarPlus size={12} className="text-blue-600" />
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
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors flex items-center justify-between text-left cursor-pointer"
                    >
                      <span>Download .ICS File</span>
                      <Download size={12} className="text-gray-400" />
                    </button>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-gray-500 text-center leading-relaxed">
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
              <div className="flex items-center gap-3 text-amber-600">
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900">
                    Organizer Mode Active
                  </h4>
                  <p className="text-xs text-gray-500">
                    Club accounts cannot register as event attendees.
                  </p>
                </div>
              </div>

              <p className="text-xs text-gray-600 leading-relaxed mt-1">
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

        {/* ── Persistent Mobile Registration Dock ──────────────────────────── */}
        <div className="lg:hidden fixed bottom-[calc(4.1rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-30 px-3.5 py-2.5 border-t border-gray-200 bg-white/95 backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="max-w-md mx-auto flex items-center justify-between gap-2.5">
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-gray-500 block truncate">
                {selectedTier ? selectedTier.name : displayIsFree ? 'Free Admission' : 'Entry Ticket'}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold font-display text-gray-900">
                  {displayIsFree ? <span className="text-emerald-600">Free Pass</span> : `₹${displayPrice}`}
                </span>
                {event.participation_type === 'team' && (
                  <span className="text-[10px] text-gray-500">
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
                  className="min-h-[42px] font-semibold"
                >
                  View My Pass
                </Button>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                {event.participation_type === 'team' && canRegister && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="min-h-[42px] text-xs px-2.5"
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
                  className="min-h-[42px] font-semibold"
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
