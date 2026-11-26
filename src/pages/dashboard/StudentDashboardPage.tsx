import { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  GraduationCap,
  Ticket,
  LogOut,
  Compass,
  Clock,
  MapPin,
  CheckCircle2,
  ArrowRight,
  Users,
  RefreshCw,
  Sparkles,
  CreditCard,
  Search,
  Settings,
  Building2,
  Heart,
  Flame,
  Award,
  Bell,
  Eye,
  Trash2,
  ChevronRight,
  ShieldCheck,
  Check,
  Calendar,
  CalendarPlus,
  Download,
  Smartphone,
  AlertCircle,
  Edit3,
} from 'lucide-react'
import {
  Button,
  Badge,
  EmptyState,
  Alert,
} from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/context/AuthContext'
import { Link, useSearchParams, useNavigate } from 'react-router'
import { fadeIn, staggerContainer, metricItem } from '@/lib/animations'
import { getStudentRegistrations } from '@/lib/registrations'
import { listPublishedEvents, mapRecordToUiEvent, isEventCompleted } from '@/lib/events'
import { getSmartRecommendations, type RecommendedEvent } from '@/lib/recommendations'
import { calculateTrendingEvents, type TrendingEvent } from '@/lib/trending'
import { getStudentWishlistEvents, getStudentWishlistIds } from '@/lib/wishlist'
import { getRecentlyViewedEvents, clearRecentlyViewedEvents } from '@/lib/recentlyViewed'
import { getInAppNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/payments'
import { generateGoogleCalendarUrl, downloadIcsFile } from '@/lib/calendar'
import { EventCard } from '@/components/sections/EventCard'
import { EventCountdown } from '@/components/events/EventCountdown'
import { StudentInterestsSelector } from '@/components/student/StudentInterestsSelector'
import { StudentSettingsModal } from '@/components/student/StudentSettingsModal'
import { TeamManageModal } from '@/components/team/TeamManageModal'
import { RequestCancellationModal } from '@/components/registration/RequestCancellationModal'
import { RequestEditModal } from '@/components/registration/RequestEditModal'
import { claimWaitlistOffer, declineWaitlistOffer } from '@/lib/waitlist'
import { subscribeToStatusChanges } from '@/lib/sync'
import { writeCachedStudentPasses, readCachedStudentPasses } from '@/lib/ticketCache'
import type { RegistrationWithEvent, Event, InAppNotification, StudentAchievement } from '@/types'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

type MainDashboardTab = 'overview' | 'passes' | 'recommended' | 'trending' | 'wishlist' | 'history' | 'notifications'
type PassStatusTab = 'upcoming' | 'pending_approval' | 'pending_payment' | 'waitlisted' | 'past' | 'cancelled'

export default function StudentDashboardPage() {
  const { user, profile, studentProfile, isDualEligible, switchWorkspace, signOut } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Primary Data States
  const [registrations, setRegistrations] = useState<RegistrationWithEvent[]>([])
  const [publishedEvents, setPublishedEvents] = useState<Event[]>([])
  const [wishlistEvents, setWishlistEvents] = useState<Event[]>([])
  const [wishlistIds, setWishlistIds] = useState<string[]>([])
  const [recentlyViewed, setRecentlyViewed] = useState<Event[]>([])
  const [notifications, setNotifications] = useState<InAppNotification[]>([])

  // UI Control States
  const [loading, setLoading] = useState(true)
  const [mainTab, setMainTab] = useState<MainDashboardTab>('overview')
  const [passTab, setPassTab] = useState<PassStatusTab>('upcoming')
  const [searchQuery, setSearchQuery] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showInterestsEditor, setShowInterestsEditor] = useState(false)

  // Cancellation, Edit and Team Modals
  const [cancellationModalReg, setCancellationModalReg] = useState<RegistrationWithEvent | null>(null)
  const [editingReg, setEditingReg] = useState<RegistrationWithEvent | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [notice, setNotice] = useState<{ message: string; isError?: boolean } | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [showTeamModal, setShowTeamModal] = useState(false)

  // Student Profile fallbacks
  const displayName = profile?.display_name || (user?.user_metadata?.display_name as string) || 'Campus Student'
  const college = studentProfile?.college_name || (user?.user_metadata?.college as string) || 'Campus Student'
  const gradYear = studentProfile?.graduation_year || (user?.user_metadata?.graduation_year as number) || null

  // ── Load All Data (Concurrent Promise.all for 4x faster dashboard load) ──
  const loadAllStudentData = useCallback(async (silent = false) => {
    if (!user) return
    if (!silent) setLoading(true)
    setLoadError(null)

    try {
      const [
        regRes,
        eventsRes,
        wEvents,
        wIds,
        rViewed,
        notifs,
      ] = await Promise.all([
        getStudentRegistrations(user.id),
        listPublishedEvents({ limit: 40 }),
        getStudentWishlistEvents(user.id),
        getStudentWishlistIds(user.id),
        getRecentlyViewedEvents(user.id),
        getInAppNotifications(user.id),
      ])

      if (regRes.error || eventsRes.error) {
        setLoadError(regRes.error || eventsRes.error || 'Failed to load dashboard data from server.')
      }

      if (!regRes.error && regRes.registrations) {
        setRegistrations(regRes.registrations)
        writeCachedStudentPasses(user.id, regRes.registrations)
      }
      if (!eventsRes.error && eventsRes.events) {
        setPublishedEvents(
          eventsRes.events
            .filter((e) => !isEventCompleted(e))
            .map(mapRecordToUiEvent)
        )
      }
      setWishlistEvents(wEvents)
      setWishlistIds(wIds)
      setRecentlyViewed(rViewed)
      setNotifications(notifs)
    } catch (err: any) {
      console.warn('[FestFlow Student] Data load notice:', err)
      setLoadError(err?.message || 'Unable to connect to the server.')
      // Attempt to load sanitized passes strictly for active user when offline
      const cached = readCachedStudentPasses(user.id)
      if (cached) {
        setRegistrations(cached)
        setNotice({ message: 'Showing previously cached offline passes while disconnected.', isError: false })
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadAllStudentData()

    const unsubscribe = subscribeToStatusChanges(
      ['registration_updated', 'payment_reviewed', 'team_updated', 'ticket_updated'],
      () => {
        loadAllStudentData(true)
      }
    )

    // Listen for wishlist or interests updates
    const onWishlistUpdated = () => {
      if (user?.id) {
        getStudentWishlistEvents(user.id).then(setWishlistEvents)
        getStudentWishlistIds(user.id).then(setWishlistIds)
      }
    }
    const onInterestsUpdated = () => {
      loadAllStudentData(true)
    }

    window.addEventListener('festflow:wishlist-updated', onWishlistUpdated)
    window.addEventListener('festflow:interests-updated', onInterestsUpdated)

    // Listen for tab switch from bottom navigation
    const onSelectTab = (e: any) => {
      const tab = e?.detail
      if (tab === 'upcoming' || tab === 'passes') {
        setMainTab('passes')
        setPassTab('upcoming')
      } else if (['overview', 'passes', 'recommended', 'trending', 'wishlist', 'history', 'notifications'].includes(tab)) {
        setMainTab(tab as MainDashboardTab)
      }
    }
    window.addEventListener('festflow:select-tab', onSelectTab)

    return () => {
      unsubscribe()
      window.removeEventListener('festflow:wishlist-updated', onWishlistUpdated)
      window.removeEventListener('festflow:interests-updated', onInterestsUpdated)
      window.removeEventListener('festflow:select-tab', onSelectTab)
    }
  }, [user, loadAllStudentData])

  // Sync with URL query parameters
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam) {
      if (['overview', 'passes', 'recommended', 'trending', 'wishlist', 'history', 'notifications'].includes(tabParam)) {
        setMainTab(tabParam as MainDashboardTab)
      } else if (['upcoming', 'pending_approval', 'pending_payment', 'waitlisted', 'past', 'cancelled'].includes(tabParam)) {
        setMainTab('passes')
        setPassTab(tabParam as PassStatusTab)
      }
    }
    if (searchParams.get('settings') === 'true') {
      setSettingsOpen(true)
    }
  }, [searchParams])

  const nowMs = useMemo(() => Date.now(), [registrations])
  const now = useMemo(() => new Date(nowMs), [nowMs])

  // ── Smart Recommendations Calculation (Part 4) ────────────────────────────
  const studentInterests = useMemo(() => {
    return studentProfile?.interests || (user?.user_metadata?.preferences?.interests as string[]) || (user?.user_metadata?.interests as string[]) || []
  }, [studentProfile, user])

  const recommendedEvents: RecommendedEvent[] = useMemo(() => {
    return getSmartRecommendations({
      allEvents: publishedEvents,
      studentInterests,
      registrations,
      wishlistIds,
      limit: 6,
    })
  }, [publishedEvents, studentInterests, registrations, wishlistIds])

  // ── Trending Events Calculation (Part 5) ──────────────────────────────────
  const trendingEvents: TrendingEvent[] = useMemo(() => {
    return calculateTrendingEvents(publishedEvents, 6)
  }, [publishedEvents])

  // ── Upcoming Registered Events ───────────────────────────────────────────
  const upcomingRegisteredEvents = useMemo(() => {
    return registrations
      .filter((r) => r.status === 'confirmed' && Boolean(r.event?.start_date) && new Date(r.event!.start_date) >= now)
      .sort((a, b) => new Date(a.event!.start_date).getTime() - new Date(b.event!.start_date).getTime())
  }, [registrations, now])

  // ── Registration Deadlines Closing Soon ───────────────────────────────────
  const closingSoonEvents = useMemo(() => {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    const nowTime = now.getTime()
    return publishedEvents
      .filter((evt) => {
        const deadline = evt.registrationDeadline ? new Date(evt.registrationDeadline).getTime() : null
        const eventStart = evt.date ? new Date(evt.date).getTime() : null
        const targetTime = deadline || eventStart
        return targetTime && targetTime >= nowTime && (targetTime - nowTime) <= sevenDaysMs
      })
      .sort((a, b) => {
        const timeA = (a.registrationDeadline ? new Date(a.registrationDeadline).getTime() : new Date(a.date).getTime()) || 0
        const timeB = (b.registrationDeadline ? new Date(b.registrationDeadline).getTime() : new Date(b.date).getTime()) || 0
        return timeA - timeB
      })
      .slice(0, 4)
  }, [publishedEvents, now])

  // ── Recently Added Events ────────────────────────────────────────────────
  const recentlyAddedEvents = useMemo(() => {
    return publishedEvents.slice(0, 4)
  }, [publishedEvents])

  // ── Filtered Passes List ──────────────────────────────────────────────────
  const filteredList = useMemo(() => {
    return registrations.filter((r) => {
      const hasValidDate = Boolean(r.event?.start_date)
      const isPast = r.event ? isEventCompleted(r.event, now.getTime()) : !hasValidDate
      const isUpcoming = hasValidDate && !isPast

      let matches = false
      if (passTab === 'upcoming') {
        matches = r.status === 'confirmed' && isUpcoming
      } else if (passTab === 'pending_approval') {
        matches = r.status === 'pending_approval'
      } else if (passTab === 'pending_payment') {
        matches = r.status === 'pending_payment'
      } else if (passTab === 'waitlisted') {
        matches = r.status === 'waitlisted'
      } else if (passTab === 'past') {
        matches = r.status === 'confirmed' && isPast
      } else if (passTab === 'cancelled') {
        matches = r.status === 'cancelled' || r.status === 'rejected'
      }

      if (!matches) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const title = r.event?.title?.toLowerCase() || ''
        const code = r.ticket_code?.toLowerCase() || ''
        const team = r.team_name?.toLowerCase() || ''
        const venue = r.event?.venue_name?.toLowerCase() || ''
        return title.includes(q) || code.includes(q) || team.includes(q) || venue.includes(q)
      }

      return true
    })
  }, [registrations, passTab, now, searchQuery])

  // ── Count & Participation Metrics (Single-pass memoized calculation) ────────
  const {
    upcomingCount,
    pendingApprovalCount,
    pendingPaymentCount,
    waitlistedCount,
    pastCount,
    cancelledCount,
  } = useMemo(() => {
    let upcoming = 0
    let pendingApproval = 0
    let pendingPayment = 0
    let waitlisted = 0
    let past = 0
    let cancelled = 0

    for (const r of registrations) {
      const hasDate = Boolean(r.event?.start_date)
      const isCompletedEvt = r.event ? isEventCompleted(r.event, now.getTime()) : !hasDate
      const isUpcoming = hasDate && !isCompletedEvt
      if (r.status === 'confirmed') {
        if (isUpcoming) upcoming++
        else past++
      } else if (r.status === 'pending_approval') {
        pendingApproval++
      } else if (r.status === 'pending_payment') {
        pendingPayment++
      } else if (r.status === 'waitlisted') {
        waitlisted++
      } else if (r.status === 'cancelled' || r.status === 'rejected') {
        cancelled++
      }
    }

    return {
      upcomingCount: upcoming,
      pendingApprovalCount: pendingApproval,
      pendingPaymentCount: pendingPayment,
      waitlistedCount: waitlisted,
      pastCount: past,
      cancelledCount: cancelled,
    }
  }, [registrations, now])

  // Attended & completed events (confirmed registrations for completed events or legacy check-in records)
  const attendedRegistrations = useMemo(() => {
    const refMs = now.getTime()
    return registrations.filter((r) => {
      const legacyChecked =
        (r as any).attendance_status === 'checked_in' ||
        (r as any).attendance_status === 'checked_out'
      if (legacyChecked) return true
      if (r.status === 'confirmed' && r.event) {
        return isEventCompleted(r.event, refMs)
      }
      return false
    })
  }, [registrations, now])

  const attendedCount = attendedRegistrations.length
  const totalRegistrations = registrations.length
  const estimatedHours = attendedCount * 3.5

  // ── Student Achievements (Part 3 & 11) ────────────────────────────────────
  const achievements: StudentAchievement[] = useMemo(() => {
    return [
      {
        id: 'campus_pioneer',
        title: 'Campus Pioneer',
        description: 'Reserved your first campus event pass on FestFlow',
        iconName: 'Ticket',
        badgeLabel: 'Pioneer',
        progress: Math.min(totalRegistrations, 1),
        total: 1,
        unlocked: totalRegistrations >= 1,
      },
      {
        id: 'squad_leader',
        title: 'Squad Leader',
        description: 'Created a collaborative team roster for a hackathon or fest',
        iconName: 'Users',
        badgeLabel: 'Captain',
        progress: registrations.some((r) => r.team_name || r.team_id) ? 1 : 0,
        total: 1,
        unlocked: registrations.some((r) => r.team_name || r.team_id),
      },
      {
        id: 'event_regular',
        title: 'Campus Regular',
        description: 'Completed 3 confirmed campus fest events with FestFlow',
        iconName: 'Award',
        badgeLabel: 'Regular',
        progress: Math.min(attendedCount, 3),
        total: 3,
        unlocked: attendedCount >= 3,
      },
      {
        id: 'curator',
        title: 'Trend Curator',
        description: 'Saved 3 or more campus events to your personal wishlist',
        iconName: 'Heart',
        badgeLabel: 'Curator',
        progress: Math.min(wishlistIds.length, 3),
        total: 3,
        unlocked: wishlistIds.length >= 3,
      },
    ]
  }, [totalRegistrations, registrations, attendedCount, wishlistIds])

  // ── Next Action Spotlight Item (Part 3 & 9) ────────────────────────────────
  const nextActionItem = useMemo(() => {
    const pendingPay = registrations.find((r) => r.status === 'pending_payment')
    if (pendingPay) {
      return {
        type: 'pending_payment' as const,
        registration: pendingPay,
        title: 'Complete Ticket Payment',
        description: `Your seat for "${pendingPay.event?.title || 'your event'}" is on hold. Complete payment to issue your digital pass.`,
        ctaLabel: pendingPay.event?.price ? `Pay ₹${pendingPay.event.price}` : 'Submit Payment Proof',
        ctaLink: `/student/payments/${pendingPay.id}`,
      }
    }

    const pendingApp = registrations.find((r) => r.status === 'pending_approval')
    if (pendingApp) {
      return {
        type: 'pending_approval' as const,
        registration: pendingApp,
        title: 'Application Under Host Review',
        description: `Your application for "${pendingApp.event?.title || 'your event'}" is awaiting organizer review.`,
        ctaLabel: 'View Status Details',
        ctaLink: `/student/tickets/${pendingApp.id}`,
      }
    }

    const upcomingEvents = registrations
      .filter((r) => r.status === 'confirmed' && Boolean(r.event?.start_date) && new Date(r.event!.start_date) >= now)
      .sort((a, b) => new Date(a.event!.start_date).getTime() - new Date(b.event!.start_date).getTime())

    if (upcomingEvents.length > 0) {
      const nextEvt = upcomingEvents[0]
      const startDate = new Date(nextEvt.event!.start_date)
      return {
        type: 'upcoming_event' as const,
        registration: nextEvt,
        title: `Next Up: ${nextEvt.event?.title || 'Campus Event'}`,
        description: `${startDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} at ${nextEvt.event?.venue_name || 'Campus Venue'}`,
        ctaLabel: 'View Entry Pass',
        ctaLink: `/student/tickets/${nextEvt.id}`,
      }
    }

    return {
      type: 'new_student' as const,
      registration: null,
      title: 'Ready for Campus Happenings?',
      description: 'Explore upcoming hackathons, tech workshops, cultural fests, and competitions across campuses.',
      ctaLabel: 'Discover Events',
      ctaLink: '/discover',
    }
  }, [registrations, now])

  // ── Waitlist Actions Handler ──────────────────────────────────────────────
  const handleClaimWaitlist = async (regId: string) => {
    setActionLoading(true)
    const res = await claimWaitlistOffer(regId)
    setActionLoading(false)
    if (res.success) {
      setNotice({ message: res.message, isError: false })
      loadAllStudentData(true)
    } else {
      setNotice({ message: res.message, isError: true })
    }
  }

  const handleDeclineWaitlist = async (regId: string) => {
    setActionLoading(true)
    const res = await declineWaitlistOffer(regId)
    setActionLoading(false)
    if (res.success) {
      setNotice({ message: res.message, isError: false })
      loadAllStudentData(true)
    }
  }

  // ── Clear History Handler ──────────────────────────────────────────────────
  const handleClearHistory = async () => {
    if (!user?.id) return
    await clearRecentlyViewedEvents(user.id)
    setRecentlyViewed([])
  }

  // ── Notifications Handlers ────────────────────────────────────────────────
  const handleMarkNotification = async (id: string) => {
    await markNotificationRead(id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
  }

  const handleMarkAllNotifications = async () => {
    if (!user?.id) return
    await markAllNotificationsRead(user.id)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  return (
    <PageShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 text-left">
        {/* ── 1. Personalized Welcome Card ────────────────────────── */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="relative rounded-2xl border border-gray-200 p-5 sm:p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs bg-white"
        >
          <div className="relative flex items-center gap-4 sm:gap-5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0 bg-blue-600">
              <GraduationCap size={28} />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs uppercase tracking-wider text-blue-600 font-semibold">
                  {getGreeting()}
                </span>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 border border-blue-200 text-blue-700">
                  Student Hub
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold font-display text-gray-900 tracking-tight truncate">
                {displayName}
              </h1>

              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
                <span className="truncate font-medium text-gray-700">{college}</span>
                {gradYear && (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="text-gray-500 font-mono">Class of {gradYear}</span>
                  </>
                )}
                {profile?.email && (
                  <>
                    <span className="hidden sm:inline text-gray-300">•</span>
                    <span className="text-gray-500 hidden sm:inline truncate max-w-[200px]">
                      {profile.email}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="relative flex flex-wrap items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-gray-100 shrink-0">
            <Link to="/discover" className="w-full sm:w-auto">
              <Button
                variant="primary"
                size="sm"
                className="w-full sm:w-auto justify-center"
                leftIcon={<Compass size={15} />}
              >
                Discover Events
              </Button>
            </Link>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadAllStudentData()}
              disabled={loading}
              className="flex-1 sm:flex-initial justify-center"
              leftIcon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
              title="Refresh passes and event data"
            >
              Refresh
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowInterestsEditor(!showInterestsEditor)}
              leftIcon={<Sparkles size={14} className="text-blue-600" />}
              className="flex-1 sm:flex-initial justify-center"
            >
              Interests
            </Button>

            {isDualEligible && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => switchWorkspace('club', navigate)}
                leftIcon={<Building2 size={14} />}
                className="text-indigo-700 border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 justify-center"
              >
                Club Space
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              leftIcon={<Settings size={14} />}
              className="hidden sm:inline-flex justify-center"
            >
              Settings
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
              leftIcon={<LogOut size={14} />}
              className="hidden sm:inline-flex text-rose-600 hover:text-rose-700 hover:bg-rose-50 justify-center"
            >
              Sign Out
            </Button>
          </div>
        </motion.div>

        {/* Database / Query Error Alert */}
        {loadError && (
          <Alert variant="error">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
              <span>Failed to refresh live data: {loadError}</span>
              <Button
                size="xs"
                variant="outline"
                onClick={() => loadAllStudentData()}
                className="shrink-0 bg-white"
              >
                Retry
              </Button>
            </div>
          </Alert>
        )}

        {/* Temporary Notice Feedback */}
        {notice && (
          <Alert
            variant={notice.isError ? 'error' : 'success'}
            dismissible
            onDismiss={() => setNotice(null)}
          >
            {notice.message}
          </Alert>
        )}

        {/* ── Interests Selector Drawer ───────────────────────────── */}
        <AnimatePresence>
          {showInterestsEditor && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden"
            >
              <StudentInterestsSelector
                initialInterests={studentInterests}
                onSaved={() => setShowInterestsEditor(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 2. Next Action Spotlight & Event Countdown ──────── */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="relative rounded-2xl overflow-hidden p-5 sm:p-6 border shadow-xs bg-white border-gray-200"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div
                className={`p-3 rounded-xl shrink-0 border ${
                  nextActionItem.type === 'pending_payment'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : nextActionItem.type === 'pending_approval'
                    ? 'bg-blue-50 text-blue-600 border-blue-200'
                    : nextActionItem.type === 'upcoming_event'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-gray-50 text-blue-600 border-gray-200'
                }`}
              >
                {nextActionItem.type === 'pending_payment' ? (
                  <CreditCard size={20} />
                ) : nextActionItem.type === 'pending_approval' ? (
                  <Clock size={20} />
                ) : nextActionItem.type === 'upcoming_event' ? (
                  <Ticket size={20} />
                ) : (
                  <Sparkles size={20} />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-gray-500">
                    Recommended Action
                  </span>
                  {nextActionItem.type === 'pending_payment' && (
                    <Badge variant="amber" className="text-[10px]">
                      Payment Required
                    </Badge>
                  )}
                  {nextActionItem.type === 'upcoming_event' && (
                    <Badge variant="success" className="text-[10px]">
                      Upcoming Pass Confirmed
                    </Badge>
                  )}
                </div>

                <h2 className="text-base sm:text-lg font-bold font-display text-gray-900">
                  {nextActionItem.title}
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5 max-w-2xl leading-relaxed">
                  {nextActionItem.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-center shrink-0 flex-wrap">
              {nextActionItem.type === 'upcoming_event' && nextActionItem.registration?.event?.start_date && (
                <div className="hidden lg:flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                  <EventCountdown
                    targetDate={nextActionItem.registration.event.start_date}
                    endDate={nextActionItem.registration.event.end_date}
                    size="sm"
                  />
                </div>
              )}

              <Link to={nextActionItem.ctaLink}>
                <Button
                  variant={nextActionItem.type === 'pending_payment' || nextActionItem.type === 'upcoming_event' ? 'primary' : 'secondary'}
                  size="md"
                  rightIcon={<ArrowRight size={15} />}
                >
                  {nextActionItem.ctaLabel}
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* ── 8. Participation Statistics Grid ───────────────── */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
        >
          {[
            {
              label: 'Confirmed Passes',
              value: loading ? '…' : upcomingCount.toString(),
              subtitle: 'Active upcoming events',
              icon: Ticket,
              badgeStyle: 'text-emerald-700 bg-emerald-50 border-emerald-200',
              targetTab: 'passes' as const,
              subTab: 'upcoming' as const,
            },
            {
              label: 'Events Attended',
              value: loading ? '…' : attendedCount.toString(),
              subtitle: 'Completed campus events',
              icon: ShieldCheck,
              badgeStyle: 'text-blue-700 bg-blue-50 border-blue-200',
              targetTab: 'history' as const,
            },
            {
              label: 'Campus Activity',
              value: loading ? '…' : `${estimatedHours}h`,
              subtitle: 'Workshop & fest learning',
              icon: Clock,
              badgeStyle: 'text-indigo-700 bg-indigo-50 border-indigo-200',
              targetTab: 'overview' as const,
            },
            {
              label: 'Saved in Wishlist',
              value: loading ? '…' : wishlistIds.length.toString(),
              subtitle: 'Bookmarked upcoming events',
              icon: Heart,
              badgeStyle: 'text-rose-700 bg-rose-50 border-rose-200',
              targetTab: 'wishlist' as const,
            },
          ].map((stat, i) => {
            const Icon = stat.icon
            return (
              <motion.div variants={metricItem} className="h-full" key={i}>
                <div
                  className="p-4 sm:p-5 rounded-xl bg-white border border-gray-200 hover:border-gray-300 shadow-xs hover:shadow-md flex flex-col justify-between gap-3 cursor-pointer h-full transition-all duration-150"
                  onClick={() => {
                    setMainTab(stat.targetTab)
                    if (stat.subTab) setPassTab(stat.subTab)
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 font-medium">
                      {stat.label}
                    </span>
                    <div className={`p-2 rounded-lg border ${stat.badgeStyle}`}>
                      <Icon size={16} />
                    </div>
                  </div>

                  <div>
                    <span className="text-2xl sm:text-3xl font-bold font-display text-gray-900 font-mono">
                      {stat.value}
                    </span>
                    <span className="text-[11px] text-gray-500 block mt-0.5 truncate">
                      {stat.subtitle}
                    </span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </motion.div>

        {/* ── Dashboard Navigation Bar ─────────────────────────────────────── */}
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl w-full overflow-x-auto no-scrollbar touch-pan-x text-xs border border-gray-200">
          {[
            { id: 'overview', label: 'Dashboard Overview', icon: Sparkles },
            { id: 'passes', label: 'My Passes', icon: Ticket, count: totalRegistrations },
            { id: 'recommended', label: 'For You', icon: Sparkles, count: recommendedEvents.length },
            { id: 'trending', label: 'Trending', icon: Flame, count: trendingEvents.length },
            { id: 'wishlist', label: 'Saved Events', icon: Heart, count: wishlistIds.length },
            { id: 'history', label: 'Participation History', icon: Award, count: attendedCount },
            { id: 'notifications', label: 'Notifications', icon: Bell, count: notifications.filter((n) => !n.is_read).length },
          ].map((t) => {
            const isSelected = mainTab === t.id
            const Icon = t.icon
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setMainTab(t.id as MainDashboardTab)}
                className={`px-3.5 py-2 rounded-lg font-medium whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-white text-gray-900 font-semibold shadow-xs border border-gray-200/80'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                }`}
              >
                <Icon size={14} className={isSelected ? 'text-blue-600' : 'text-gray-500'} />
                <span>{t.label}</span>
                {typeof t.count === 'number' && t.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-semibold ${
                    isSelected ? 'bg-blue-50 text-blue-700' : 'bg-gray-200 text-gray-700'
                  }`}>
                    {t.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── TAB CONTENT: OVERVIEW ────────────────────────────────────────── */}
        {mainTab === 'overview' && (
          <div className="flex flex-col gap-10">
            {/* 1. Upcoming Registered Events Section */}
            {upcomingRegisteredEvents.length > 0 && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold font-display text-gray-900 flex items-center gap-2">
                      <Ticket size={18} className="text-emerald-600" />
                      Upcoming Registered Passes ({upcomingRegisteredEvents.length})
                    </h3>
                    <p className="text-xs text-gray-500">
                      Confirmed digital passes ready for your upcoming campus events
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMainTab('passes')
                      setPassTab('upcoming')
                    }}
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    View All Passes <ChevronRight size={13} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upcomingRegisteredEvents.slice(0, 2).map((reg) => {
                    const evt = reg.event
                    const startDate = evt?.start_date ? new Date(evt.start_date) : null
                    const formattedDate = startDate
                      ? startDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
                      : 'Date TBA'
                    return (
                      <div
                        key={reg.id}
                        className="p-5 rounded-xl bg-white border border-gray-200 flex flex-col justify-between gap-4 shadow-xs hover:border-gray-300 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              Confirmed Entry
                            </span>
                            <h4 className="text-base font-bold font-display text-gray-900 truncate mt-2">
                              {evt?.title || 'Campus Event'}
                            </h4>
                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Clock size={12} className="text-gray-400" />
                                {formattedDate}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin size={12} className="text-gray-400" />
                                {evt?.venue_name || 'Campus Venue'}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200 shrink-0 font-medium">
                            #{reg.ticket_code}
                          </span>
                        </div>

                        {evt?.start_date && (
                          <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200/80 flex items-center justify-between">
                            <span className="text-[11px] text-gray-500 font-medium">Starts in:</span>
                            <EventCountdown targetDate={evt.start_date} endDate={evt.end_date} size="sm" />
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
                          <Link to={`/student/tickets/${reg.id}`} className="w-full">
                            <Button size="sm" variant="primary" className="w-full justify-center" leftIcon={<Ticket size={14} />}>
                              Open Digital Pass
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 2. Registration Deadlines Closing Soon */}
            {closingSoonEvents.length > 0 && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold font-display text-gray-900 flex items-center gap-2">
                      <Clock size={18} className="text-amber-600" />
                      Registration Closing Soon
                    </h3>
                    <p className="text-xs text-gray-500">
                      Seats filling fast — secure your pass before registration windows close
                    </p>
                  </div>
                  <Link
                    to="/discover"
                    className="text-xs text-amber-700 hover:underline flex items-center gap-1 font-semibold"
                  >
                    Browse Directory <ChevronRight size={13} />
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {closingSoonEvents.map((evt) => (
                    <EventCard key={evt.id} event={evt} animated />
                  ))}
                </div>
              </div>
            )}

            {/* 3. Recommended Events Feed */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold font-display text-gray-900 flex items-center gap-2">
                    <Sparkles size={18} className="text-blue-600" />
                    Recommended for You
                  </h3>
                  <p className="text-xs text-gray-500">
                    Curated based on your interests in {studentInterests.slice(0, 3).join(', ') || 'campus activities'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMainTab('recommended')}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  View All ({recommendedEvents.length}) <ChevronRight size={13} />
                </button>
              </div>

              {recommendedEvents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {recommendedEvents.slice(0, 3).map((evt) => (
                    <EventCard key={evt.id} event={evt} animated />
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-xl bg-white border border-gray-200 text-center text-xs text-gray-500">
                  Select your interests above to receive personalized campus recommendations!
                </div>
              )}
            </div>

            {/* 4. Trending Events Showcase */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold font-display text-gray-900 flex items-center gap-2">
                    <Flame size={18} className="text-amber-600" />
                    Trending Across Campus
                  </h3>
                  <p className="text-xs text-gray-500">
                    Highest velocity registrations and high-demand fests right now
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMainTab('trending')}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  Explore Trending <ChevronRight size={13} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {trendingEvents.slice(0, 3).map((evt) => (
                  <EventCard key={evt.id} event={evt} animated />
                ))}
              </div>
            </div>

            {/* 5. Recently Added Events */}
            {recentlyAddedEvents.length > 0 && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold font-display text-gray-900 flex items-center gap-2">
                      <Calendar size={18} className="text-blue-600" />
                      Recently Added Events
                    </h3>
                    <p className="text-xs text-gray-500">
                      Newest hackathons, symposiums, and cultural fests published by campus clubs
                    </p>
                  </div>
                  <Link
                    to="/discover"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                  >
                    See All <ChevronRight size={13} />
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {recentlyAddedEvents.map((evt) => (
                    <EventCard key={evt.id} event={evt} animated />
                  ))}
                </div>
              </div>
            )}

            {/* 12. Student Achievements Summary */}
            <div className="flex flex-col gap-4 p-5 sm:p-6 rounded-2xl bg-white border border-gray-200 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-bold">
                    <Award size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-display text-gray-900">
                      Campus Achievements & Badges
                    </h3>
                    <p className="text-xs text-gray-500">
                      Unlock verified badges by actively participating in campus events
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                {achievements.map((ach) => (
                  <div
                    key={ach.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                      ach.unlocked
                        ? 'bg-blue-50/40 border-blue-200 shadow-2xs'
                        : 'bg-gray-50 border-gray-200/80 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        ach.unlocked ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {ach.unlocked ? 'Unlocked' : 'In Progress'}
                      </span>
                      {ach.unlocked && <Check size={14} className="text-emerald-600" />}
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 font-display">{ach.title}</h4>
                      <p className="text-[11px] text-gray-600 leading-tight mt-1">{ach.description}</p>
                    </div>

                    <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${(ach.progress / ach.total) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 6. Recently Viewed Events */}
            {recentlyViewed.length > 0 && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold font-display text-gray-900 flex items-center gap-2">
                    <Eye size={16} className="text-gray-500" />
                    Recently Viewed Events
                  </h3>
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={12} /> Clear History
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {recentlyViewed.slice(0, 4).map((evt) => (
                    <EventCard key={evt.id} event={evt} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB CONTENT: MY PASSES ────────────────────────── */}
        {mainTab === 'passes' && (
          <div className="flex flex-col gap-5">
            {/* Filter Sub-Tabs & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl overflow-x-auto no-scrollbar touch-pan-x text-xs border border-gray-200">
                {([
                  { id: 'upcoming', label: 'Upcoming Passes', count: upcomingCount },
                  { id: 'pending_approval', label: 'Under Review', count: pendingApprovalCount },
                  { id: 'pending_payment', label: 'Payment Due', count: pendingPaymentCount },
                  ...(waitlistedCount > 0 ? [{ id: 'waitlisted', label: 'Waitlisted', count: waitlistedCount }] : []),
                  { id: 'past', label: 'Past Events', count: pastCount },
                  { id: 'cancelled', label: 'Cancelled / Declined', count: cancelledCount },
                ] as const).map((t) => {
                  const isSelected = passTab === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setPassTab(t.id as PassStatusTab)}
                      className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-white text-gray-900 font-semibold shadow-xs border border-gray-200/80'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                      }`}
                    >
                      <span>{t.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                        isSelected ? 'bg-blue-600 text-white font-bold' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {t.count}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="relative min-w-[200px] sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter passes or code..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {/* Passes Grid */}
            {filteredList.length === 0 ? (
              <EmptyState
                icon={Ticket}
                title={`No ${passTab.replace('_', ' ')} passes`}
                description="Browse campus events and secure your digital entry passes."
                action={
                  <Link to="/discover">
                    <Button variant="primary" size="sm" leftIcon={<Compass size={15} />}>
                      Explore Events
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredList.map((reg) => {
                  const event = reg.event || null
                  const isCheckedIn = (reg as any).attendance_status === 'checked_in' || (reg as any).attendance_status === 'checked_out'
                  const isTeam = Boolean(reg.team_name || event?.participation_type === 'team')

                  return (
                    <div
                      key={reg.id}
                      className="p-5 rounded-xl bg-white border border-gray-200 flex flex-col justify-between gap-4 shadow-xs hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">
                            {event?.category || 'Campus Event'}
                          </span>
                          <h4 className="text-lg font-bold font-display text-gray-900 line-clamp-1 mt-0.5">
                            {event?.title || 'Campus Event'}
                          </h4>
                          <span className="text-xs text-gray-500 flex items-center gap-1.5 mt-1">
                            <MapPin size={12} className="text-gray-400" />
                            {event?.venue_name || 'Campus Venue'}
                          </span>
                        </div>

                        <div className="shrink-0 flex flex-col items-end gap-1">
                          {reg.cancellation_request_status === 'pending' ? (
                            <Badge variant="amber" className="text-[10px]">
                              Cancellation Pending
                            </Badge>
                          ) : isCheckedIn ? (
                            <Badge variant="blue" className="text-[10px]">
                              Attendance Recorded
                            </Badge>
                          ) : reg.status === 'confirmed' ? (
                            <Badge variant="success" className="text-[10px]">
                              Confirmed Pass
                            </Badge>
                          ) : reg.status === 'pending_payment' ? (
                            <Badge variant="amber" className="text-[10px]">
                              Payment Due
                            </Badge>
                          ) : reg.status === 'pending_approval' ? (
                            <Badge variant="violet" className="text-[10px]">
                              Under Review
                            </Badge>
                          ) : (
                            <Badge variant="neutral" className="text-[10px]">
                              {reg.status}
                            </Badge>
                          )}
                          {reg.refund_status && reg.refund_status !== 'not_applicable' && (
                            <Badge variant="outline" className="text-[9px] text-blue-700 border-blue-200">
                              Refund: {reg.refund_status.replace(/_/g, ' ')}
                            </Badge>
                          )}
                          <span className="text-[10px] font-mono text-gray-500">
                            #{reg.ticket_code}
                          </span>
                        </div>
                      </div>

                      {/* Waitlist Allocation Banner */}
                      {reg.status === 'waitlisted' && reg.waitlist_offer_expires_at && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                              <Sparkles size={14} className="text-emerald-600" /> Spot Allocated from Waitlist!
                            </div>
                            <div className="text-[11px] text-emerald-800">
                              An opening has been offered to you. Claim before expiry.
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button size="sm" variant="primary" isLoading={actionLoading} className="text-xs" onClick={() => handleClaimWaitlist(reg.id)}>
                              Claim Pass
                            </Button>
                            <Button size="sm" variant="ghost" disabled={actionLoading} className="text-xs" onClick={() => handleDeclineWaitlist(reg.id)}>
                              Decline
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Event Countdown */}
                      {reg.status === 'confirmed' && event?.start_date && (
                        <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200/80 flex items-center justify-between">
                          <span className="text-[11px] text-gray-500 font-medium">Countdown:</span>
                          <EventCountdown targetDate={event.start_date} endDate={event.end_date} size="sm" />
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100 flex-wrap">
                        {reg.status === 'confirmed' ? (
                          <Link to={`/student/tickets/${reg.id}`}>
                            <Button size="sm" variant="primary" leftIcon={<Ticket size={14} />}>
                              View Digital Pass
                            </Button>
                          </Link>
                        ) : reg.status === 'pending_payment' ? (
                          <Link to={`/student/payments/${reg.id}`}>
                            <Button
                              size="sm"
                              variant="primary"
                              leftIcon={<Smartphone size={14} />}
                            >
                              Pay via UPI & Submit UTR
                            </Button>
                          </Link>
                        ) : reg.status === 'pending_approval' ? (
                          <Link to={`/student/payments/${reg.id}`}>
                            <Button size="sm" variant="secondary" leftIcon={<Clock size={14} />}>
                              Verification Pending
                            </Button>
                          </Link>
                        ) : reg.status === 'rejected' ? (
                          <Link to={`/student/payments/${reg.id}`}>
                            <Button size="sm" variant="danger" leftIcon={<AlertCircle size={14} />}>
                              Payment Rejected – Resubmit
                            </Button>
                          </Link>
                        ) : (
                          <Link to={`/student/tickets/${reg.id}`}>
                            <Button size="sm" variant="secondary" leftIcon={<Ticket size={14} />}>
                              View Registration
                            </Button>
                          </Link>
                        )}

                        <div className="flex items-center gap-1.5">
                          {event && (
                            <>
                              <a
                                href={generateGoogleCalendarUrl({
                                  title: event.title,
                                  description: event.description,
                                  startDate: event.start_date,
                                  endDate: event.end_date,
                                  location: event.venue_name || 'Campus Venue',
                                  url: `${window.location.origin}/student/tickets/${reg.id}`,
                                })}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
                                title="Add to Google Calendar"
                              >
                                <CalendarPlus size={14} />
                              </a>
                              <button
                                type="button"
                                onClick={() =>
                                  downloadIcsFile({
                                    title: event.title,
                                    description: event.description,
                                    startDate: event.start_date,
                                    endDate: event.end_date,
                                    location: event.venue_name || 'Campus Venue',
                                    url: `${window.location.origin}/student/tickets/${reg.id}`,
                                  })
                                }
                                className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
                                title="Download Calendar (.ics)"
                              >
                                <Download size={14} />
                              </button>
                            </>
                          )}

                          {isTeam && reg.team_id && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setSelectedTeamId(reg.team_id!)
                                setShowTeamModal(true)
                              }}
                              leftIcon={<Users size={13} />}
                              className="text-xs"
                            >
                              Manage Squad
                            </Button>
                          )}

                          {reg.status === 'confirmed' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingReg(reg)}
                              leftIcon={<Edit3 size={13} />}
                              className="text-xs text-gray-600 hover:text-gray-900"
                            >
                              Edit
                            </Button>
                          )}

                          {reg.status === 'confirmed' && reg.cancellation_request_status !== 'pending' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setCancellationModalReg(reg)}
                              className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            >
                              Request Cancellation
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB CONTENT: RECOMMENDED FOR YOU ────────────────────── */}
        {mainTab === 'recommended' && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold font-display text-gray-900">
                  Smart Event Recommendations
                </h3>
                <p className="text-xs text-gray-500">
                  Calculated based on your interests, registration history, and event popularity
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowInterestsEditor(true)}
                leftIcon={<Sparkles size={14} className="text-blue-600" />}
              >
                Customize Interests
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {recommendedEvents.map((evt) => (
                <EventCard key={evt.id} event={evt} animated />
              ))}
            </div>
          </div>
        )}

        {/* ── TAB CONTENT: TRENDING ───────────────────────────────── */}
        {mainTab === 'trending' && (
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="text-xl font-bold font-display text-gray-900 flex items-center gap-2">
                <Flame size={20} className="text-amber-600" />
                Trending Events
              </h3>
              <p className="text-xs text-gray-500">
                Live registration velocity and seats filling fast across all campuses
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {trendingEvents.map((evt) => (
                <EventCard key={evt.id} event={evt} animated />
              ))}
            </div>
          </div>
        )}

        {/* ── TAB CONTENT: WISHLIST ───────────────────────────────── */}
        {mainTab === 'wishlist' && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold font-display text-gray-900 flex items-center gap-2">
                  <Heart size={20} className="text-rose-600 fill-current" />
                  Saved Events ({wishlistEvents.length})
                </h3>
                <p className="text-xs text-gray-500">
                  Events you have bookmarked for quick access and reminders
                </p>
              </div>
            </div>

            {wishlistEvents.length === 0 ? (
              <EmptyState
                icon={Heart}
                title="Your Wishlist is Empty"
                description="Save upcoming hackathons, fests, and workshops by clicking the heart icon on any event card."
                action={
                  <Link to="/discover">
                    <Button variant="primary" size="sm" leftIcon={<Compass size={15} />}>
                      Explore Catalog
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {wishlistEvents.map((evt) => (
                  <EventCard key={evt.id} event={evt} animated />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB CONTENT: PARTICIPATION HISTORY ─────────────────── */}
        {mainTab === 'history' && (
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="text-xl font-bold font-display text-gray-900 flex items-center gap-2">
                <Award size={20} className="text-blue-600" />
                Participation & Completed Events History
              </h3>
              <p className="text-xs text-gray-500">
                Completed campus events and historical attendance records from your registrations
              </p>
            </div>

            {attendedRegistrations.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No Completed Events Yet"
                description="Once campus events where you held a confirmed registration finish, they will appear in your participation history."
                action={
                  <Button variant="secondary" size="sm" onClick={() => setMainTab('passes')}>
                    View Confirmed Passes
                  </Button>
                }
              />
            ) : (
              <div className="flex flex-col gap-3">
                {attendedRegistrations.map((reg) => (
                  <div
                    key={reg.id}
                    className="p-4 rounded-xl bg-white border border-gray-200 flex items-center justify-between gap-4 flex-wrap shadow-xs"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 font-display">
                          {reg.event?.title || 'Campus Event'}
                        </h4>
                        <span className="text-xs text-gray-500">
                          {reg.event?.venue_name || 'Campus Venue'} • Pass #{reg.ticket_code}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                        <ShieldCheck size={13} /> Participated
                      </span>
                      <Link to={`/student/tickets/${reg.id}`}>
                        <Button size="sm" variant="secondary">
                          View Pass
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB CONTENT: NOTIFICATIONS ─────────────────────────── */}
        {mainTab === 'notifications' && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold font-display text-gray-900 flex items-center gap-2">
                  <Bell size={20} className="text-blue-600" />
                  Student Notifications Center
                </h3>
                <p className="text-xs text-gray-500">
                  Registration updates, digital pass alerts, and event reminders
                </p>
              </div>

              {notifications.some((n) => !n.is_read) && (
                <Button size="sm" variant="secondary" onClick={handleMarkAllNotifications}>
                  Mark All Read
                </Button>
              )}
            </div>

            {notifications.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="No Notifications"
                description="You're all caught up! Updates regarding tickets and campus events will appear here."
              />
            ) : (
              <div className="flex flex-col gap-2.5">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (!n.is_read) handleMarkNotification(n.id)
                      if (n.link) navigate(n.link)
                    }}
                    className={`p-4 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-4 ${
                      n.is_read
                        ? 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        : 'bg-blue-50/40 border-blue-200 text-gray-900 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${n.is_read ? 'bg-gray-300' : 'bg-blue-600'}`} />
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-gray-900 truncate">{n.title}</h4>
                        <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">{n.message}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-500 font-mono shrink-0">
                      {new Date(n.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Modals: Settings, Team Manage, Cancellation ─────────────────── */}
        <StudentSettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />

        {selectedTeamId && (
          <TeamManageModal
            isOpen={showTeamModal}
            onClose={() => {
              setShowTeamModal(false)
              setSelectedTeamId(null)
            }}
            teamId={selectedTeamId}
            onTeamUpdated={() => loadAllStudentData(true)}
          />
        )}

        {/* Request Cancellation Modal (Module 2) */}
        {cancellationModalReg && (
          <RequestCancellationModal
            isOpen={Boolean(cancellationModalReg)}
            onClose={() => setCancellationModalReg(null)}
            registrationId={cancellationModalReg.id}
            eventTitle={cancellationModalReg.event?.title || 'this event'}
            onSubmitted={() => {
              setCancellationModalReg(null)
              loadAllStudentData(true)
            }}
          />
        )}

        {/* Request Details Edit Modal (Module 4) */}
        {editingReg && (
          <RequestEditModal
            isOpen={Boolean(editingReg)}
            onClose={() => setEditingReg(null)}
            registration={editingReg}
            eventTitle={editingReg.event?.title || 'this event'}
            onSubmitted={() => {
              setEditingReg(null)
              loadAllStudentData(true)
            }}
          />
        )}
      </div>
    </PageShell>
  )
}
