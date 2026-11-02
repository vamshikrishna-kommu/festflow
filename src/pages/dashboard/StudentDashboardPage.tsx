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
  CalendarPlus,
  Download,
  Smartphone,
  AlertCircle,
} from 'lucide-react'
import {
  Button,
  Badge,
  Logo,
  Modal,
  ModalBody,
  ModalFooter,
  EmptyState,
  Alert,
} from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/context/AuthContext'
import { Link, useSearchParams, useNavigate } from 'react-router'
import { fadeIn, staggerContainer, metricItem } from '@/lib/animations'
import { getStudentRegistrations, cancelRegistration } from '@/lib/registrations'
import { listPublishedEvents, mapRecordToUiEvent } from '@/lib/events'
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
import { subscribeToStatusChanges } from '@/lib/sync'
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

  // Cancellation and Team Modals
  const [cancellingReg, setCancellingReg] = useState<RegistrationWithEvent | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [notice, setNotice] = useState<{ message: string; isError?: boolean } | null>(null)
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

      if (regRes.registrations) {
        setRegistrations(regRes.registrations)
      }
      if (!eventsRes.error && eventsRes.events) {
        setPublishedEvents(eventsRes.events.map(mapRecordToUiEvent))
      }
      setWishlistEvents(wEvents)
      setWishlistIds(wIds)
      setRecentlyViewed(rViewed)
      setNotifications(notifs)
    } catch (err) {
      console.warn('[FestFlow Student] Data load notice:', err)
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

    return () => {
      unsubscribe()
      window.removeEventListener('festflow:wishlist-updated', onWishlistUpdated)
      window.removeEventListener('festflow:interests-updated', onInterestsUpdated)
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

  // ── Filtered Passes List ──────────────────────────────────────────────────
  const filteredList = useMemo(() => {
    return registrations.filter((r) => {
      const hasValidDate = Boolean(r.event?.start_date)
      const eventStart = hasValidDate ? new Date(r.event!.start_date) : null
      const isUpcoming = eventStart ? eventStart >= now : false
      const isPast = eventStart ? eventStart < now : false

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
        matches = r.status === 'confirmed' && (isPast || !hasValidDate)
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
      const isUpcoming = hasDate ? new Date(r.event!.start_date) >= now : false
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

  // Attended events (verified through check-in records)
  const attendedRegistrations = useMemo(() => {
    return registrations.filter(
      (r) => (r as any).attendance_status === 'checked_in' || (r as any).attendance_status === 'checked_out'
    )
  }, [registrations])

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
        description: 'Attended 3 verified campus events with gate check-in',
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
        ctaLabel: 'View Gate Pass & QR',
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

  // ── Cancel Pass Handler ────────────────────────────────────────────────────
  const handleCancelPass = async () => {
    if (!cancellingReg) return
    setActionLoading(true)
    const res = await cancelRegistration(cancellingReg.id)
    setActionLoading(false)
    setCancellingReg(null)

    if (res.success) {
      setNotice({ message: 'Your event pass has been cancelled successfully.', isError: false })
      loadAllStudentData(true)
    } else {
      setNotice({ message: res.message, isError: true })
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
        {/* ── 1. Personalized Welcome Card (Part 3) ────────────────────────── */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="relative rounded-3xl border border-white/[0.08] overflow-hidden p-5 sm:p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl bg-gradient-to-b from-[#0E0E12] to-[#08080A]"
        >
          {/* Subtle FestFlow Brand Radial Glow */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 15% 40%, rgba(24, 207, 252, 0.12) 0%, rgba(127, 26, 251, 0.06) 45%, transparent 70%)',
            }}
          />

          <div className="relative flex items-center gap-4 sm:gap-5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[#18CFFC]/20 shrink-0 border border-white/10 bg-gradient-to-br from-[#18CFFC] to-[#7F1AFB]">
              <GraduationCap size={32} className="sm:w-9 sm:h-9" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs uppercase tracking-wider text-[#18CFFC] font-semibold">
                  {getGreeting()}
                </span>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-[#18CFFC]/10 border border-[#18CFFC]/30 text-[#18CFFC]">
                  <Logo variant="compact" /> Student Companion
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-white truncate">
                {displayName}
              </h1>

              <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400 flex-wrap font-sans">
                <span className="truncate">{college}</span>
                {gradYear && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span className="text-zinc-500 font-mono">Class of {gradYear}</span>
                  </>
                )}
                {profile?.email && (
                  <>
                    <span className="hidden sm:inline text-zinc-600">•</span>
                    <span className="text-zinc-500 hidden sm:inline truncate max-w-[200px]">
                      {profile.email}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="relative flex flex-wrap items-center gap-2 sm:gap-2.5 pt-3 md:pt-0 border-t md:border-t-0 border-white/[0.08] shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadAllStudentData()}
              disabled={loading}
              className="justify-center"
              leftIcon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
              title="Refresh passes and event data"
            >
              Refresh
            </Button>
            <Link to="/discover">
              <Button variant="outline" size="sm" className="justify-center" leftIcon={<Compass size={15} />}>
                Discover Events
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInterestsEditor(!showInterestsEditor)}
              leftIcon={<Sparkles size={14} className="text-[#18CFFC]" />}
              className="justify-center text-zinc-300 hover:text-white"
            >
              My Interests
            </Button>

            {isDualEligible && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => switchWorkspace('club', navigate)}
                leftIcon={<Building2 size={15} />}
                className="text-[#18CFFC] border-[#18CFFC]/30 hover:bg-[#18CFFC]/10 justify-center"
              >
                Club Space
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              leftIcon={<Settings size={15} />}
              className="justify-center text-zinc-300 hover:text-white"
            >
              Settings
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut()}
              leftIcon={<LogOut size={15} />}
              className="text-rose-400 hover:text-rose-300 hover:border-rose-500/30 justify-center"
            >
              Sign Out
            </Button>
          </div>
        </motion.div>

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

        {/* ── Interests Selector Drawer (Part 8) ───────────────────────────── */}
        <AnimatePresence>
          {showInterestsEditor && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-5 rounded-3xl bg-[#0E0E12] border border-white/10 shadow-xl overflow-hidden"
            >
              <StudentInterestsSelector
                initialInterests={studentInterests}
                onSaved={() => setShowInterestsEditor(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 2. Next Action Spotlight & Event Countdown (Part 3 & 9) ──────── */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="relative rounded-2xl overflow-hidden p-5 sm:p-6 border transition-all shadow-md bg-[#0E0E12] border-white/[0.08]"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div
                className={`p-3 rounded-xl shrink-0 ${
                  nextActionItem.type === 'pending_payment'
                    ? 'bg-amber-500/20 text-amber-300'
                    : nextActionItem.type === 'pending_approval'
                    ? 'bg-[#18CFFC]/15 text-[#18CFFC]'
                    : nextActionItem.type === 'upcoming_event'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-[#14141A] text-[#18CFFC]'
                }`}
              >
                {nextActionItem.type === 'pending_payment' ? (
                  <CreditCard size={22} />
                ) : nextActionItem.type === 'pending_approval' ? (
                  <Clock size={22} />
                ) : nextActionItem.type === 'upcoming_event' ? (
                  <Ticket size={22} />
                ) : (
                  <Sparkles size={22} />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
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

                <h2 className="text-base sm:text-lg font-bold font-heading text-white">
                  {nextActionItem.title}
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 mt-0.5 max-w-2xl leading-relaxed font-sans">
                  {nextActionItem.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-center shrink-0 flex-wrap">
              {nextActionItem.type === 'upcoming_event' && nextActionItem.registration?.event?.start_date && (
                <div className="hidden lg:flex items-center gap-2 bg-[#14141A] px-3 py-1.5 rounded-xl border border-white/10">
                  <EventCountdown
                    targetDate={nextActionItem.registration.event.start_date}
                    endDate={nextActionItem.registration.event.end_date}
                    size="sm"
                  />
                </div>
              )}

              <Link to={nextActionItem.ctaLink}>
                <Button
                  variant={nextActionItem.type === 'pending_payment' || nextActionItem.type === 'upcoming_event' ? 'primary' : 'outline'}
                  size="md"
                  rightIcon={<ArrowRight size={15} />}
                >
                  {nextActionItem.ctaLabel}
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>

        {/* ── 8. Participation Statistics Grid (Part 3 & 11) ───────────────── */}
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
              subtitle: 'Ready for gate check-in',
              icon: Ticket,
              badgeStyle: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
              targetTab: 'passes' as const,
              subTab: 'upcoming' as const,
            },
            {
              label: 'Events Attended',
              value: loading ? '…' : attendedCount.toString(),
              subtitle: 'Verified gate entries',
              icon: ShieldCheck,
              badgeStyle: 'text-[#18CFFC] bg-[#18CFFC]/10 border-[#18CFFC]/20',
              targetTab: 'history' as const,
            },
            {
              label: 'Campus Activity',
              value: loading ? '…' : `${estimatedHours}h`,
              subtitle: 'Workshop & fest learning',
              icon: Clock,
              badgeStyle: 'text-[#ED47FC] bg-[#ED47FC]/10 border-[#ED47FC]/20',
              targetTab: 'overview' as const,
            },
            {
              label: 'Saved in Wishlist',
              value: loading ? '…' : wishlistIds.length.toString(),
              subtitle: 'Bookmarked upcoming events',
              icon: Heart,
              badgeStyle: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
              targetTab: 'wishlist' as const,
            },
          ].map((stat, i) => {
            const Icon = stat.icon
            return (
              <motion.div variants={metricItem} className="h-full" key={i}>
                <div
                  className="p-4 sm:p-5 rounded-2xl bg-[#0E0E12] border border-white/[0.08] hover:border-white/20 flex flex-col justify-between gap-3 cursor-pointer h-full transition-all duration-200"
                  onClick={() => {
                    setMainTab(stat.targetTab)
                    if (stat.subTab) setPassTab(stat.subTab)
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400 font-medium">
                      {stat.label}
                    </span>
                    <div className={`p-2 rounded-xl border ${stat.badgeStyle}`}>
                      <Icon size={18} />
                    </div>
                  </div>

                  <div>
                    <span className="text-2xl sm:text-3xl font-extrabold font-heading text-white font-mono">
                      {stat.value}
                    </span>
                    <span className="text-[11px] text-zinc-500 block mt-0.5 truncate font-sans">
                      {stat.subtitle}
                    </span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </motion.div>

        {/* ── Dashboard Navigation Bar ─────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 p-1.5 bg-[#14141A] rounded-2xl w-full overflow-x-auto no-scrollbar touch-pan-x text-xs border border-white/[0.08]">
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
                className={`px-3.5 py-2 rounded-xl font-medium whitespace-nowrap shrink-0 transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] text-white font-semibold shadow-md'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Icon size={14} className={isSelected ? 'text-white' : 'text-zinc-400'} />
                <span>{t.label}</span>
                {typeof t.count === 'number' && t.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                    isSelected ? 'bg-black/30 text-white' : 'bg-white/10 text-zinc-300'
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
            {/* 3. Recommended Events Feed (Part 4) */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold font-heading text-white flex items-center gap-2">
                    <Sparkles size={18} className="text-[#18CFFC]" />
                    Recommended for You
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Curated based on your interests in {studentInterests.slice(0, 3).join(', ') || 'campus activities'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMainTab('recommended')}
                  className="text-xs text-[#18CFFC] hover:underline flex items-center gap-1 font-semibold"
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
                <div className="p-8 rounded-2xl bg-[#0E0E12] border border-white/5 text-center text-xs text-zinc-400">
                  Select your interests above to receive personalized campus recommendations!
                </div>
              )}
            </div>

            {/* 4. Trending Events Showcase (Part 5) */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold font-heading text-white flex items-center gap-2">
                    <Flame size={18} className="text-amber-400" />
                    Trending Across Campus
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Highest velocity registrations and high-demand fests right now
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMainTab('trending')}
                  className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-semibold"
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

            {/* 12. Student Achievements Summary (Part 3 & 11) */}
            <div className="flex flex-col gap-4 p-5 sm:p-6 rounded-3xl bg-[#0E0E12] border border-white/[0.08]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#18CFFC] to-[#7F1AFB] flex items-center justify-center text-white font-bold">
                    <Award size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-heading text-white">
                      Campus Achievements & Badges
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Unlock verified badges by actively participating in campus events
                    </p>
                  </div>
                </div>

                <Link to="/student/certificates">
                  <Button variant="outline" size="sm" rightIcon={<ChevronRight size={14} />}>
                    Certificates & Vault
                  </Button>
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                {achievements.map((ach) => (
                  <div
                    key={ach.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                      ach.unlocked
                        ? 'bg-[#14141A] border-[#18CFFC]/30 shadow-[0_0_15px_rgba(24,207,252,0.1)]'
                        : 'bg-[#08080A] border-white/5 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        ach.unlocked ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-zinc-500'
                      }`}>
                        {ach.unlocked ? 'Unlocked' : 'In Progress'}
                      </span>
                      {ach.unlocked && <Check size={14} className="text-emerald-400" />}
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-white font-display">{ach.title}</h4>
                      <p className="text-[11px] text-zinc-400 leading-tight mt-1">{ach.description}</p>
                    </div>

                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] rounded-full transition-all duration-500"
                        style={{ width: `${(ach.progress / ach.total) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 6. Recently Viewed Events (Part 7) */}
            {recentlyViewed.length > 0 && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold font-heading text-white flex items-center gap-2">
                    <Eye size={16} className="text-zinc-400" />
                    Recently Viewed Events
                  </h3>
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
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

        {/* ── TAB CONTENT: MY PASSES (Part 10 & 11) ────────────────────────── */}
        {mainTab === 'passes' && (
          <div className="flex flex-col gap-5">
            {/* Filter Sub-Tabs & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 p-1.5 bg-[#14141A] rounded-2xl overflow-x-auto no-scrollbar touch-pan-x text-xs border border-white/[0.08]">
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
                      className={`px-3.5 py-1.5 rounded-xl font-medium whitespace-nowrap shrink-0 transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-[#242430] text-white font-semibold shadow-sm border border-white/10'
                          : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      <span>{t.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                        isSelected ? 'bg-[#18CFFC] text-white font-bold' : 'bg-white/10 text-zinc-400'
                      }`}>
                        {t.count}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="relative min-w-[200px] sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter passes or code..."
                  className="w-full pl-9 pr-3 py-2 bg-[#14141A] border border-white/10 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#18CFFC]"
                />
              </div>
            </div>

            {/* Passes Grid */}
            {filteredList.length === 0 ? (
              <EmptyState
                icon={Ticket}
                title={`No ${passTab.replace('_', ' ')} passes`}
                description="Browse campus events and secure your verified gate entry passes."
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
                      className="p-5 rounded-3xl bg-[#0E0E12] border border-white/[0.08] flex flex-col justify-between gap-4 shadow-xl hover:border-white/20 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#18CFFC]">
                            {event?.category || 'Campus Event'}
                          </span>
                          <h4 className="text-lg font-bold font-heading text-white line-clamp-1 mt-0.5">
                            {event?.title || 'Campus Event'}
                          </h4>
                          <span className="text-xs text-zinc-400 flex items-center gap-1.5 mt-1">
                            <MapPin size={12} className="text-zinc-500" />
                            {event?.venue_name || 'Campus Venue'}
                          </span>
                        </div>

                        <div className="shrink-0 flex flex-col items-end gap-1">
                          {isCheckedIn ? (
                            <Badge variant="cyan" className="text-[10px]">
                              Gate Admitted
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
                            <Badge variant="purple" className="text-[10px]">
                              Under Review
                            </Badge>
                          ) : (
                            <Badge variant="neutral" className="text-[10px]">
                              {reg.status}
                            </Badge>
                          )}
                          <span className="text-[10px] font-mono text-zinc-500">
                            #{reg.ticket_code}
                          </span>
                        </div>
                      </div>

                      {/* Event Countdown for upcoming confirmed pass */}
                      {reg.status === 'confirmed' && event?.start_date && (
                        <div className="p-2.5 rounded-xl bg-[#14141A] border border-white/5 flex items-center justify-between">
                          <span className="text-[11px] text-zinc-400">Countdown:</span>
                          <EventCountdown targetDate={event.start_date} endDate={event.end_date} size="sm" />
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/[0.06] flex-wrap">
                        {reg.status === 'confirmed' ? (
                          <Link to={`/student/tickets/${reg.id}`}>
                            <Button size="sm" variant="primary" leftIcon={<Ticket size={14} />}>
                              View Digital QR Pass
                            </Button>
                          </Link>
                        ) : reg.status === 'pending_payment' ? (
                          <Link to={`/student/payments/${reg.id}`}>
                            <Button
                              size="sm"
                              variant="primary"
                              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold"
                              leftIcon={<Smartphone size={14} />}
                            >
                              Pay via UPI & Submit UTR
                            </Button>
                          </Link>
                        ) : reg.status === 'pending_approval' ? (
                          <Link to={`/student/payments/${reg.id}`}>
                            <Button size="sm" variant="outline" leftIcon={<Clock size={14} />}>
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
                            <Button size="sm" variant="outline" leftIcon={<Ticket size={14} />}>
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
                                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
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
                                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                                title="Download Calendar (.ics)"
                              >
                                <Download size={14} />
                              </button>
                            </>
                          )}

                          {isTeam && reg.team_id && (
                            <Button
                              size="sm"
                              variant="outline"
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
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB CONTENT: RECOMMENDED FOR YOU (Part 4) ────────────────────── */}
        {mainTab === 'recommended' && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold font-heading text-white">
                  Smart Event Recommendations
                </h3>
                <p className="text-xs text-zinc-400">
                  Calculated based on your interests, registration history, and event popularity
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowInterestsEditor(true)}
                leftIcon={<Sparkles size={14} className="text-[#18CFFC]" />}
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

        {/* ── TAB CONTENT: TRENDING (Part 5) ───────────────────────────────── */}
        {mainTab === 'trending' && (
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="text-xl font-bold font-heading text-white flex items-center gap-2">
                <Flame size={20} className="text-amber-400" />
                Trending Events
              </h3>
              <p className="text-xs text-zinc-400">
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

        {/* ── TAB CONTENT: WISHLIST (Part 6) ───────────────────────────────── */}
        {mainTab === 'wishlist' && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold font-heading text-white flex items-center gap-2">
                  <Heart size={20} className="text-rose-500 fill-current" />
                  Saved Events ({wishlistEvents.length})
                </h3>
                <p className="text-xs text-zinc-400">
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

        {/* ── TAB CONTENT: PARTICIPATION HISTORY (Part 11) ─────────────────── */}
        {mainTab === 'history' && (
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="text-xl font-bold font-heading text-white flex items-center gap-2">
                <Award size={20} className="text-[#18CFFC]" />
                Verified Attendance & Participation History
              </h3>
              <p className="text-xs text-zinc-400">
                Official records of campus events attended with gate check-in authentication
              </p>
            </div>

            {attendedRegistrations.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No Physical Check-in Records Yet"
                description="Once you present your QR digital pass at campus event gates, your verified attendance will appear here."
                action={
                  <Button variant="outline" size="sm" onClick={() => setMainTab('passes')}>
                    View Confirmed Passes
                  </Button>
                }
              />
            ) : (
              <div className="flex flex-col gap-3">
                {attendedRegistrations.map((reg) => (
                  <div
                    key={reg.id}
                    className="p-4 rounded-2xl bg-[#0E0E12] border border-white/[0.08] flex items-center justify-between gap-4 flex-wrap"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white font-display">
                          {reg.event?.title || 'Campus Event'}
                        </h4>
                        <span className="text-xs text-zinc-400">
                          {reg.event?.venue_name || 'Campus Venue'} • Pass #{reg.ticket_code}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                        <ShieldCheck size={13} /> Verified Check-in
                      </span>
                      <Link to={`/student/tickets/${reg.id}`}>
                        <Button size="sm" variant="outline">
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

        {/* ── TAB CONTENT: NOTIFICATIONS (Part 13) ─────────────────────────── */}
        {mainTab === 'notifications' && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold font-heading text-white flex items-center gap-2">
                  <Bell size={20} className="text-[#18CFFC]" />
                  Student Notifications Center
                </h3>
                <p className="text-xs text-zinc-400">
                  Registration updates, gate pass credentials, and event reminders
                </p>
              </div>

              {notifications.some((n) => !n.is_read) && (
                <Button size="sm" variant="outline" onClick={handleMarkAllNotifications}>
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
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                      n.is_read
                        ? 'bg-[#0E0E12] border-white/5 text-zinc-400'
                        : 'bg-[#14141A] border-[#18CFFC]/30 text-white shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${n.is_read ? 'bg-zinc-600' : 'bg-[#18CFFC]'}`} />
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold truncate">{n.title}</h4>
                        <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{n.message}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono shrink-0">
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

        {cancellingReg && (
          <Modal
            isOpen={Boolean(cancellingReg)}
            onClose={() => setCancellingReg(null)}
            title="Cancel Event Pass"
          >
            <ModalBody>
              <div className="flex flex-col gap-3 py-2 text-left">
                <p className="text-sm text-zinc-300">
                  Are you sure you want to cancel your pass for{' '}
                  <strong className="text-white">{cancellingReg.event?.title}</strong>?
                </p>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Your seat will be returned to the event capacity so other students can register.
                </p>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" size="sm" onClick={() => setCancellingReg(null)}>
                Keep Pass
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={actionLoading}
                onClick={handleCancelPass}
              >
                Confirm Cancellation
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </div>
    </PageShell>
  )
}
