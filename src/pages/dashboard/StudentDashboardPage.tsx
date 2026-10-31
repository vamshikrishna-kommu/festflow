import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  GraduationCap,
  Ticket,
  LogOut,
  Compass,
  AlertTriangle,
  Clock,
  MapPin,
  CheckCircle2,
  Lock,
  QrCode,
  ArrowRight,
  Users,
  RefreshCw,
  Sparkles,
  Calendar,
  CreditCard,
  Search,
  Settings,
  Building2,
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
import { fadeIn, staggerContainer, metricItem, tabContent } from '@/lib/animations'
import { getStudentRegistrations, cancelRegistration } from '@/lib/registrations'
import { StudentSettingsModal } from '@/components/student/StudentSettingsModal'
import { TeamManageModal } from '@/components/team/TeamManageModal'
import { subscribeToStatusChanges } from '@/lib/sync'
import type { RegistrationWithEvent } from '@/types'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function StudentDashboardPage() {
  const { user, profile, studentProfile, isDualEligible, switchWorkspace, signOut } = useAuth()
  const navigate = useNavigate()

  const [registrations, setRegistrations] = useState<RegistrationWithEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'upcoming' | 'pending_approval' | 'pending_payment' | 'waitlisted' | 'past' | 'cancelled'>('upcoming')
  const [searchQuery, setSearchQuery] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Cancellation modal
  const [cancellingReg, setCancellingReg] = useState<RegistrationWithEvent | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [notice, setNotice] = useState<{ message: string; isError?: boolean } | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [showTeamModal, setShowTeamModal] = useState(false)

  const displayName = profile?.display_name || 'Campus Student'
  const college = studentProfile?.college_name || 'Campus Student'
  const gradYear = studentProfile?.graduation_year

  const [searchParams] = useSearchParams()

  const loadRegistrations = async (silent?: boolean) => {
    const isSilent = silent === true
    if (!user) return
    if (!isSilent) setLoading(true)
    const res = await getStudentRegistrations(user.id)
    if (!isSilent) setLoading(false)
    if (res.registrations) {
      setRegistrations(res.registrations)
    }
  }

  useEffect(() => {
    loadRegistrations()

    const unsubscribe = subscribeToStatusChanges(
      ['registration_updated', 'payment_reviewed', 'team_updated', 'ticket_updated'],
      () => {
        loadRegistrations(true)
      }
    )
    return () => unsubscribe()
  }, [user])

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam && ['upcoming', 'pending_approval', 'pending_payment', 'waitlisted', 'past', 'cancelled'].includes(tabParam)) {
      setTab(tabParam as any)
    }
    if (searchParams.get('settings') === 'true') {
      setSettingsOpen(true)
    }
    const handler = (e: any) => {
      if (e.detail) setTab(e.detail)
    }
    window.addEventListener('festflow:select-tab', handler)
    return () => window.removeEventListener('festflow:select-tab', handler)
  }, [searchParams])

  const nowMs = useMemo(() => Date.now(), [registrations])
  const now = useMemo(() => new Date(nowMs), [nowMs])

  // Filter registrations by category tab and optional local search
  const filteredList = useMemo(() => {
    return registrations.filter((r) => {
      const hasValidDate = Boolean(r.event?.start_date)
      const eventStart = hasValidDate ? new Date(r.event!.start_date) : null
      const isUpcoming = eventStart ? eventStart >= now : false
      const isPast = eventStart ? eventStart < now : false

      let matchesTab = false
      if (tab === 'upcoming') {
        matchesTab = r.status === 'confirmed' && isUpcoming
      } else if (tab === 'pending_approval') {
        matchesTab = r.status === 'pending_approval'
      } else if (tab === 'pending_payment') {
        matchesTab = r.status === 'pending_payment'
      } else if (tab === 'waitlisted') {
        matchesTab = r.status === 'waitlisted'
      } else if (tab === 'past') {
        matchesTab = r.status === 'confirmed' && (isPast || !hasValidDate)
      } else if (tab === 'cancelled') {
        matchesTab = r.status === 'cancelled' || r.status === 'rejected'
      }

      if (!matchesTab) return false

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
  }, [registrations, tab, now, searchQuery])

  // Count summaries
  const upcomingCount = registrations.filter(
    (r) => r.status === 'confirmed' && Boolean(r.event?.start_date) && new Date(r.event!.start_date) >= now
  ).length
  const pendingApprovalCount = registrations.filter((r) => r.status === 'pending_approval').length
  const pendingPaymentCount = registrations.filter((r) => r.status === 'pending_payment').length
  const waitlistedCount = registrations.filter((r) => r.status === 'waitlisted').length
  const pastCount = registrations.filter(
    (r) => r.status === 'confirmed' && (!r.event?.start_date || new Date(r.event!.start_date) < now)
  ).length
  const cancelledCount = registrations.filter(
    (r) => r.status === 'cancelled' || r.status === 'rejected'
  ).length

  // Find next action spotlight item
  const nextActionItem = useMemo(() => {
    // 1. Pending payment is highest urgency
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

    // 2. Pending approval
    const pendingApp = registrations.find((r) => r.status === 'pending_approval')
    if (pendingApp) {
      return {
        type: 'pending_approval' as const,
        registration: pendingApp,
        title: 'Application Under Host Review',
        description: `Your application for "${pendingApp.event?.title || 'your event'}" is awaiting organizer review. We will notify you once approved.`,
        ctaLabel: 'View Status Details',
        ctaLink: `/student/tickets/${pendingApp.id}`,
      }
    }

    // 3. Next upcoming confirmed event
    const upcomingEvents = registrations
      .filter((r) => r.status === 'confirmed' && Boolean(r.event?.start_date) && new Date(r.event!.start_date) >= now)
      .sort((a, b) => new Date(a.event!.start_date).getTime() - new Date(b.event!.start_date).getTime())

    if (upcomingEvents.length > 0) {
      const nextEvt = upcomingEvents[0]
      const startDate = new Date(nextEvt.event!.start_date)
      const diffMs = startDate.getTime() - now.getTime()
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDays = Math.floor(diffHours / 24)
      const timeRemaining = diffDays > 0 ? `in ${diffDays} day${diffDays > 1 ? 's' : ''}` : `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`

      return {
        type: 'upcoming_event' as const,
        registration: nextEvt,
        title: `Next Up: ${nextEvt.event?.title || 'Campus Event'}`,
        description: `${startDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} at ${nextEvt.event?.venue_name || 'Campus Venue'} (${timeRemaining})`,
        ctaLabel: 'View Gate Pass & QR',
        ctaLink: `/student/tickets/${nextEvt.id}`,
      }
    }

    // 4. Default: No registrations
    return {
      type: 'new_student' as const,
      registration: null,
      title: 'Ready for Campus Happenings?',
      description: 'Explore upcoming hackathons, tech workshops, cultural fests, and team competitions across colleges.',
      ctaLabel: 'Discover Events',
      ctaLink: '/discover',
    }
  }, [registrations, now])

  const handleCancelPass = async () => {
    if (!cancellingReg) return
    setActionLoading(true)
    const res = await cancelRegistration(cancellingReg.id)
    setActionLoading(false)
    setCancellingReg(null)

    if (res.success) {
      setNotice({ message: 'Your event pass has been cancelled successfully.', isError: false })
      loadRegistrations()
    } else {
      setNotice({ message: res.message, isError: true })
    }
  }

  return (
    <PageShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 text-left">
        {/* Top Header Card */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="relative rounded-3xl border border-white/[0.08] overflow-hidden p-5 sm:p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl bg-gradient-to-b from-[#0E0E12] to-[#08080A]"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 15% 40%, rgba(255, 87, 34, 0.12) 0%, transparent 65%)' }}
          />

          <div className="relative flex items-center gap-4 sm:gap-5">
            <div
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[#18CFFC]/20 shrink-0 border border-white/10 bg-gradient-to-br from-[#18CFFC] to-[#7F1AFB]"
            >
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
              onClick={() => loadRegistrations()}
              disabled={loading}
              className="justify-center"
              leftIcon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
              title="Refresh your passes and application status"
            >
              Refresh
            </Button>
            <Link to="/discover">
              <Button variant="outline" size="sm" className="justify-center" leftIcon={<Compass size={15} />}>
                Discover Events
              </Button>
            </Link>

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

        {/* ── Clear Next Action Spotlight Banner ────────────────────────────── */}
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
                    Recommended Next Action
                  </span>
                  {nextActionItem.type === 'pending_payment' && (
                    <Badge variant="amber" className="text-[10px]">
                      Urgent
                    </Badge>
                  )}
                  {nextActionItem.type === 'upcoming_event' && (
                    <Badge variant="success" className="text-[10px]">
                      Upcoming
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

            <Link to={nextActionItem.ctaLink} className="self-start sm:self-center shrink-0">
              <Button
                variant={nextActionItem.type === 'pending_payment' || nextActionItem.type === 'upcoming_event' ? 'primary' : 'outline'}
                size="md"
                rightIcon={<ArrowRight size={15} />}
              >
                {nextActionItem.ctaLabel}
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* ── Quick Stats Grid ────────────────────────────────────────────── */}
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
              subtitle: 'Ready for gate entry',
              icon: Ticket,
              badgeStyle: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
              activeTabKey: 'upcoming' as const,
            },
            {
              label: 'Host Review',
              value: loading ? '…' : pendingApprovalCount.toString(),
              subtitle: 'Awaiting organizer check',
              icon: Clock,
              badgeStyle: 'text-[#18CFFC] bg-[#18CFFC]/10 border-[#18CFFC]/20',
              activeTabKey: 'pending_approval' as const,
            },
            {
              label: 'Payment Due',
              value: loading ? '…' : pendingPaymentCount.toString(),
              subtitle: 'Fee confirmation pending',
              icon: Lock,
              badgeStyle: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
              activeTabKey: 'pending_payment' as const,
            },
            {
              label: 'Past & Concluded',
              value: loading ? '…' : pastCount.toString(),
              subtitle: 'Historical event records',
              icon: CheckCircle2,
              badgeStyle: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
              activeTabKey: 'past' as const,
            },
          ].map((stat, i) => {
            const Icon = stat.icon
            const isCurrentTab = tab === stat.activeTabKey
            return (
              <motion.div variants={metricItem} className="h-full" key={i}>
                <div
                  className={`p-4 sm:p-5 rounded-2xl bg-[#0E0E12] border flex flex-col justify-between gap-3 cursor-pointer h-full transition-all duration-200 ${
                    isCurrentTab
                      ? 'border-[#18CFFC] shadow-[0_0_24px_rgba(24,207,252,0.25)] bg-[#14141A]'
                      : 'border-white/[0.08] hover:border-white/20'
                  }`}
                  onClick={() => setTab(stat.activeTabKey)}
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

        {/* ── Passes & Registrations Section ──────────────────────────────── */}
        <div className="flex flex-col gap-5 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.08]">
            <div>
              <h2 className="text-xl font-bold font-heading text-white">
                Event Passes & Registration History
              </h2>
              <p className="text-xs text-zinc-400">
                Digital tickets, team rosters, and real-time gate entry credentials
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Optional search within list */}
              {registrations.length > 3 && (
                <div className="relative w-48 sm:w-56">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                  <input
                    type="search"
                    placeholder="Search my passes…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-8 pl-8 pr-3 text-xs rounded-xl bg-[#14141A] border border-white/[0.08] text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#18CFFC]"
                  />
                </div>
              )}

              <Link to="/discover">
                <Button variant="primary" size="sm" leftIcon={<Compass size={15} />}>
                  Explore Events
                </Button>
              </Link>
            </div>
          </div>

          {/* Sub-Tabs: Upcoming, Under Review, Pending Payment, Past, Cancelled */}
          <div className="flex items-center gap-1.5 p-1.5 bg-[#14141A] rounded-2xl w-full overflow-x-auto no-scrollbar touch-pan-x text-xs border border-white/[0.08]">
            {([
              { id: 'upcoming', label: 'Upcoming Passes', count: upcomingCount },
              { id: 'pending_approval', label: 'Under Review', count: pendingApprovalCount },
              { id: 'pending_payment', label: 'Payment Due', count: pendingPaymentCount },
              ...(waitlistedCount > 0 ? [{ id: 'waitlisted', label: 'Waitlisted', count: waitlistedCount }] : []),
              { id: 'past', label: 'Past Events', count: pastCount },
              { id: 'cancelled', label: 'Cancelled / Declined', count: cancelledCount },
            ] as const).map((t) => {
              const isSelected = tab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id as typeof tab)}
                  className={`px-3.5 py-1.5 rounded-xl font-medium whitespace-nowrap shrink-0 transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-[#242430] text-white font-semibold shadow-sm border border-white/10'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <span>{t.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${isSelected ? 'bg-[#18CFFC] text-white font-bold' : 'bg-white/10 text-zinc-400'}`}>
                    {t.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Content Area with smooth Tab Content transition */}
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              variants={tabContent}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full"
            >
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center">
                  <div className="w-8 h-8 rounded-full border-2 border-[var(--color-surface-3)] border-t-[var(--color-brand-cyan)] animate-spin mb-3" />
                  <span className="text-xs text-[var(--color-text-muted)]">Loading digital tickets…</span>
                </div>
              ) : filteredList.length === 0 ? (
                <EmptyState
                  title={
                tab === 'upcoming'
                  ? 'No Upcoming Passes'
                  : tab === 'pending_approval'
                  ? 'No Applications Under Review'
                  : tab === 'pending_payment'
                  ? 'No Pending Payments'
                  : tab === 'waitlisted'
                  ? 'No Waitlisted Registrations'
                  : `No ${tab.replace('_', ' ')} records`
              }
              description={
                tab === 'upcoming'
                  ? 'You do not have any confirmed passes for upcoming campus events. Browse the discovery catalog to reserve seats!'
                  : tab === 'pending_approval'
                  ? 'You have no event applications currently awaiting organizer review.'
                  : tab === 'pending_payment'
                  ? 'Great! All your tickets are paid in full or free passes.'
                  : `No event entries match this category in your account history.`
              }
              action={
                <Link to="/discover">
                  <Button variant="primary" size="sm" leftIcon={<Compass size={15} />}>
                    Discover Events
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredList.map((reg) => {
                const event = reg.event || null
                const startDate = event?.start_date ? new Date(event.start_date) : null
                const formattedDate = startDate
                  ? startDate.toLocaleDateString('en-IN', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'Date unavailable'
                const formattedTime = startDate
                  ? startDate.toLocaleTimeString('en-IN', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })
                  : 'Time unavailable'

                const isConfirmed = reg.status === 'confirmed'
                const isPendingApproval = reg.status === 'pending_approval'
                const isPendingPayment = reg.status === 'pending_payment'
                const isWaitlisted = reg.status === 'waitlisted'
                const isRejected = reg.status === 'rejected'
                const isCancelled = reg.status === 'cancelled'
                const hasStarted = startDate ? startDate <= now : false

                const teamMembers: any[] = Array.isArray((reg as any).team_members) ? (reg as any).team_members : []
                const isTeam = Boolean(reg.team_name || event?.participation_type === 'team')

                return (
                  <div
                    key={reg.id}
                    className="p-5 rounded-2xl bg-[#0E0E12] flex flex-col justify-between gap-4 border border-white/[0.08] hover:border-white/20 transition-all shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Status Badges */}
                        <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                          <Badge
                            variant={
                              (reg as any).attendance_status === 'checked_in'
                                ? 'success'
                                : (reg as any).attendance_status === 'checked_out'
                                ? 'amber'
                                : isConfirmed
                                ? 'success'
                                : isPendingApproval
                                ? 'purple'
                                : isPendingPayment
                                ? 'amber'
                                : isWaitlisted
                                ? 'amber'
                                : 'danger'
                            }
                            className="text-[10px] uppercase font-semibold tracking-wider"
                          >
                            {(reg as any).attendance_status === 'checked_in'
                              ? 'Admitted Inside'
                              : (reg as any).attendance_status === 'checked_out'
                              ? 'Checked Out'
                              : isConfirmed
                              ? 'Confirmed'
                              : isPendingApproval
                              ? 'Under Review'
                              : isPendingPayment
                              ? 'Payment Due'
                              : isWaitlisted
                              ? 'Waitlisted'
                              : isRejected
                              ? 'Declined'
                              : 'Cancelled'}
                          </Badge>

                          {event ? (
                            <>
                              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-300">
                                {event.category}
                              </span>
                              {event.participation_type === 'team' && (
                                <Badge variant="pink" className="text-[10px] flex items-center gap-1">
                                  <Users size={10} /> Team Event
                                </Badge>
                              )}
                            </>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-zinc-500">
                              Event Unavailable
                            </Badge>
                          )}
                        </div>

                        {/* Event Title */}
                        <h3 className="font-bold text-white text-base line-clamp-1 font-heading">
                          {event?.slug ? (
                            <Link
                              to={`/events/${event.slug}`}
                              className="hover:text-[#18CFFC] transition-colors"
                            >
                              {event.title}
                            </Link>
                          ) : (
                            <span className="text-zinc-400 italic">
                              {event?.title || 'Event Details Unavailable'}
                            </span>
                          )}
                        </h3>

                        {/* Team Info if Team Event */}
                        {isTeam && (
                          <div className="mt-2 p-2.5 rounded-xl bg-[#14141A] border border-white/[0.06] text-xs">
                            <div className="flex items-center justify-between text-[#18CFFC] font-medium">
                              <span className="flex items-center gap-1.5">
                                <Users size={13} />
                                <strong className="text-white">
                                  {reg.team_name || 'Team Registration'}
                                </strong>
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-zinc-400">
                                  {reg.team_role === 'leader' ? 'Team Leader' : 'Team Member'}
                                </span>
                                {reg.team_id && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedTeamId(reg.team_id)
                                      setShowTeamModal(true)
                                    }}
                                    className="px-2 py-0.5 rounded-lg bg-[#18CFFC]/15 hover:bg-[#18CFFC]/25 text-[#18CFFC] text-[11px] font-semibold transition-colors cursor-pointer"
                                  >
                                    {reg.team_role === 'leader' ? 'Manage Squad' : 'View Squad'}
                                  </button>
                                )}
                              </div>
                            </div>

                            {teamMembers.length > 0 && (
                              <div className="text-[11px] text-zinc-400 mt-1 truncate">
                                Members: {teamMembers.map((m: any) => m.name || m.email).filter(Boolean).join(', ')}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Rejection notice if declined */}
                        {isRejected && (reg as any).rejection_reason && (
                          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs mt-2">
                            <strong className="block font-semibold text-[11px] uppercase tracking-wide">
                              Organizer Reason:
                            </strong>
                            {(reg as any).rejection_reason}
                          </div>
                        )}

                        {/* Date & Venue Metadata */}
                        <div className="flex flex-col gap-1 text-xs text-zinc-400 mt-2">
                          <span className="flex items-center gap-1.5">
                            <Calendar size={12} className="text-[#18CFFC]" /> {formattedDate} • {startDate ? formattedTime : ''}
                          </span>
                          <span className="flex items-center gap-1.5 truncate">
                            <MapPin size={12} className="text-[#18CFFC]" /> {event?.venue_name || 'Venue details unavailable'}
                          </span>
                        </div>
                      </div>

                      {/* Poster thumbnail or clean fallback icon */}
                      {event?.poster_url ? (
                        <img
                          src={event.poster_url}
                          alt={event.title || 'Event'}
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover shrink-0 border border-white/10 shadow-sm"
                        />
                      ) : (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#14141A] border border-white/10 flex items-center justify-center text-zinc-500 shrink-0">
                          <Ticket size={24} />
                        </div>
                      )}
                    </div>

                    {/* Bottom ticket action row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/[0.08] text-xs">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-400 min-w-0">
                        <QrCode size={13} className="text-[#18CFFC] shrink-0" />
                        <span className="truncate bg-black/40 px-2 py-0.5 rounded font-bold text-white">{reg.ticket_code}</span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                        {isConfirmed && (
                          <Link to={`/student/tickets/${reg.id}`}>
                            <Button variant="primary" size="sm" rightIcon={<ArrowRight size={13} />}>
                              View QR Pass
                            </Button>
                          </Link>
                        )}

                        {isPendingApproval && (
                          <Link to={`/student/tickets/${reg.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-white/15 text-zinc-200 hover:text-white"
                              rightIcon={<ArrowRight size={13} />}
                            >
                              Track Status
                            </Button>
                          </Link>
                        )}

                        {isPendingPayment && (
                          <Link to={`/student/payments/${reg.id}`}>
                            <Button
                              variant="primary"
                              size="sm"
                              className="bg-gradient-to-r from-[var(--color-brand-cyan)] to-[var(--color-brand-violet)] text-white hover:opacity-95 border-none font-semibold shadow-md"
                              rightIcon={<ArrowRight size={13} />}
                            >
                              Pay via UPI
                            </Button>
                          </Link>
                        )}

                        {isRejected && (!event || !event.is_free) && (
                          <Link to={`/student/payments/${reg.id}`}>
                            <Button
                              variant="danger"
                              size="sm"
                              rightIcon={<ArrowRight size={13} />}
                            >
                              Resubmit UTR
                            </Button>
                          </Link>
                        )}

                        {!isCancelled && !isRejected && (
                          (reg as any).attendance_status === 'checked_in' || (reg as any).attendance_status === 'checked_out' ? (
                            <span className="text-[11px] text-zinc-500 italic px-2">
                              Admitted at Gate
                            </span>
                          ) : hasStarted ? (
                            <span className="text-[11px] text-zinc-500 italic px-2">
                              Concluded
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setCancellingReg(reg)}
                              className="text-[11px] text-rose-400 hover:text-rose-300 font-medium ml-1 transition-colors px-2 py-1 rounded-lg hover:bg-rose-500/10 cursor-pointer"
                            >
                              Cancel Pass
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
        </div>

        {/* Cancellation Confirmation Modal */}
        <Modal
          isOpen={Boolean(cancellingReg)}
          onClose={() => setCancellingReg(null)}
          title="Cancel Event Pass?"
          size="sm"
        >
          <ModalBody>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 text-rose-400">
                <div className="p-2.5 rounded-xl bg-rose-500/15">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[var(--color-text-primary)]">
                    Release Entry Seat
                  </h4>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    This action immediately revokes your digital QR ticket.
                  </p>
                </div>
              </div>

              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mt-1">
                Are you sure you want to cancel your registration for{' '}
                <strong className="text-[var(--color-text-primary)]">
                  "{cancellingReg?.event?.title || 'this event'}"
                </strong>
                ? Your seat will be made available to other students, and your QR code will be invalidated at campus gates.
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              size="sm"
              disabled={actionLoading}
              onClick={() => setCancellingReg(null)}
            >
              Keep Pass
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={actionLoading}
              isLoading={actionLoading}
              onClick={handleCancelPass}
            >
              Confirm Cancellation
            </Button>
          </ModalFooter>
        </Modal>

        {/* Student Settings Modal */}
        <StudentSettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />

        {/* Squad Roster & Invitation Management Modal */}
        {selectedTeamId && (
          <TeamManageModal
            isOpen={showTeamModal}
            teamId={selectedTeamId}
            onClose={() => {
              setShowTeamModal(false)
              setSelectedTeamId(null)
            }}
            onTeamUpdated={loadRegistrations}
          />
        )}
      </div>
    </PageShell>
  )
}
