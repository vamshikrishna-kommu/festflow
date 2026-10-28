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
} from 'lucide-react'
import {
  Button,
  Badge,
  Card,
  Logo,
  Modal,
  ModalBody,
  ModalFooter,
  EmptyState,
  Alert,
} from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/context/AuthContext'
import { Link, useSearchParams } from 'react-router'
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
  const { user, profile, studentProfile, signOut } = useAuth()

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

  const loadRegistrations = async () => {
    if (!user) return
    setLoading(true)
    const res = await getStudentRegistrations(user.id)
    setLoading(false)
    if (res.registrations) {
      setRegistrations(res.registrations)
    }
  }

  useEffect(() => {
    loadRegistrations()

    const unsubscribe = subscribeToStatusChanges(
      ['registration_updated', 'payment_reviewed', 'team_updated', 'ticket_updated', 'reconnect'],
      () => {
        loadRegistrations()
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
          className="relative rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.08)] overflow-hidden p-5 sm:p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-[0_12px_40px_oklch(0%_0_0_/_0.4)]"
          style={{ background: 'linear-gradient(135deg, oklch(10% 0.025 265), oklch(12% 0.03 275))' }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 15% 40%, oklch(72% 0.16 200 / 0.1) 0%, transparent 65%)' }}
          />

          <div className="relative flex items-center gap-4 sm:gap-5">
            <div
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0 border border-white/10"
              style={{ background: 'linear-gradient(135deg, var(--color-brand-cyan), var(--color-brand-violet))' }}
            >
              <GraduationCap size={32} className="sm:w-9 sm:h-9" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs uppercase tracking-wider text-[var(--color-brand-cyan)] font-semibold">
                  {getGreeting()}
                </span>
                <Badge variant="cyan" className="flex items-center gap-1.5 shrink-0 text-[10px] sm:text-xs">
                  <Logo variant="compact" /> Student Companion
                </Badge>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold font-display text-[var(--color-text-primary)] truncate">
                {displayName}
              </h1>

              <div className="flex items-center gap-2 mt-1 text-xs text-[var(--color-text-secondary)] flex-wrap">
                <span className="truncate">{college}</span>
                {gradYear && (
                  <>
                    <span>•</span>
                    <span className="text-[var(--color-text-muted)] font-mono">Class of {gradYear}</span>
                  </>
                )}
                {profile?.email && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span className="text-[var(--color-text-muted)] hidden sm:inline truncate max-w-[200px]">
                      {profile.email}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="relative flex flex-wrap items-center gap-2 sm:gap-2.5 pt-3 md:pt-0 border-t md:border-t-0 border-[oklch(100%_0_0_/_0.06)] shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={loadRegistrations}
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              leftIcon={<Settings size={15} />}
              className="justify-center text-[var(--color-brand-cyan)] hover:border-[var(--color-brand-cyan)]"
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
          className="relative rounded-2xl overflow-hidden p-5 sm:p-6 border transition-all shadow-md"
          style={{
            background:
              nextActionItem.type === 'pending_payment'
                ? 'linear-gradient(135deg, oklch(76% 0.17 68 / 0.12), oklch(62% 0.22 45 / 0.08))'
                : nextActionItem.type === 'pending_approval'
                ? 'linear-gradient(135deg, oklch(58% 0.26 285 / 0.12), oklch(50% 0.2 265 / 0.08))'
                : nextActionItem.type === 'upcoming_event'
                ? 'linear-gradient(135deg, oklch(72% 0.16 200 / 0.12), oklch(58% 0.26 285 / 0.08))'
                : 'linear-gradient(135deg, oklch(14% 0.03 270), oklch(12% 0.02 265))',
            borderColor:
              nextActionItem.type === 'pending_payment'
                ? 'oklch(76% 0.17 68 / 0.3)'
                : nextActionItem.type === 'pending_approval'
                ? 'oklch(58% 0.26 285 / 0.3)'
                : nextActionItem.type === 'upcoming_event'
                ? 'oklch(72% 0.16 200 / 0.3)'
                : 'oklch(100% 0 0 / 0.08)',
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div
                className={`p-3 rounded-xl shrink-0 ${
                  nextActionItem.type === 'pending_payment'
                    ? 'bg-amber-500/20 text-amber-300'
                    : nextActionItem.type === 'pending_approval'
                    ? 'bg-purple-500/20 text-purple-300'
                    : nextActionItem.type === 'upcoming_event'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-[var(--color-surface-2)] text-[var(--color-brand-cyan)]'
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
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)]">
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

                <h2 className="text-base sm:text-lg font-bold font-display text-[var(--color-text-primary)]">
                  {nextActionItem.title}
                </h2>
                <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-0.5 max-w-2xl leading-relaxed">
                  {nextActionItem.description}
                </p>
              </div>
            </div>

            <Link to={nextActionItem.ctaLink} className="self-start sm:self-center shrink-0">
              <Button
                variant={nextActionItem.type === 'pending_payment' ? 'primary' : 'outline'}
                size="md"
                rightIcon={<ArrowRight size={15} />}
                className={
                  nextActionItem.type === 'pending_payment'
                    ? 'bg-amber-500 hover:bg-amber-400 text-black border-none font-semibold shadow-md'
                    : ''
                }
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
              badgeStyle: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
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
              badgeStyle: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
              activeTabKey: 'past' as const,
            },
          ].map((stat, i) => {
            const Icon = stat.icon
            const isCurrentTab = tab === stat.activeTabKey
            return (
              <motion.div variants={metricItem} className="h-full" key={i}>
                <Card
                  className={`p-4 sm:p-5 flex flex-col justify-between gap-3 cursor-pointer h-full transition-all duration-200 ${
                    isCurrentTab
                      ? 'border-[var(--color-brand-cyan)] shadow-[0_0_20px_oklch(72%_0.16_200_/_0.15)]'
                      : 'hover:border-[oklch(100%_0_0_/_0.15)]'
                  }`}
                  onClick={() => setTab(stat.activeTabKey)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--color-text-muted)] font-medium">
                      {stat.label}
                    </span>
                    <div className={`p-2 rounded-xl border ${stat.badgeStyle}`}>
                      <Icon size={18} />
                    </div>
                  </div>

                  <div>
                    <span className="text-2xl sm:text-3xl font-bold font-display text-[var(--color-text-primary)]">
                      {stat.value}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-muted)] block mt-0.5 truncate">
                      {stat.subtitle}
                    </span>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>

        {/* ── Passes & Registrations Section ──────────────────────────────── */}
        <div className="flex flex-col gap-5 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--color-surface-3)]">
            <div>
              <h2 className="text-xl font-bold font-display text-[var(--color-text-primary)]">
                Event Passes & Registration History
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Digital tickets, team rosters, and real-time gate entry credentials
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Optional search within list */}
              {registrations.length > 3 && (
                <div className="relative w-48 sm:w-56">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
                  <input
                    type="search"
                    placeholder="Search my passes…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-8 pl-8 pr-3 text-xs rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.08)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-cyan)]"
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
          <div className="flex items-center gap-1.5 p-1.5 bg-[var(--color-surface-2)] rounded-2xl w-full overflow-x-auto no-scrollbar touch-pan-x text-xs border border-[oklch(100%_0_0_/_0.06)]">
            {([
              { id: 'upcoming', label: 'Upcoming Passes', count: upcomingCount, activeStyle: 'bg-[var(--color-brand-cyan)] text-black' },
              { id: 'pending_approval', label: 'Under Review', count: pendingApprovalCount, activeStyle: 'bg-[oklch(58%_0.26_285_/_0.2)] text-[var(--color-brand-violet)] ring-1 ring-[oklch(58%_0.26_285_/_0.3)]' },
              { id: 'pending_payment', label: 'Payment Due', count: pendingPaymentCount, activeStyle: 'bg-[oklch(76%_0.17_68_/_0.2)] text-[var(--color-brand-amber)] ring-1 ring-[oklch(76%_0.17_68_/_0.3)]' },
              ...(waitlistedCount > 0 ? [{ id: 'waitlisted', label: 'Waitlisted', count: waitlistedCount, activeStyle: 'bg-[oklch(76%_0.17_68_/_0.15)] text-[var(--color-brand-amber)]' }] : []),
              { id: 'past', label: 'Past Events', count: pastCount, activeStyle: 'bg-[var(--color-surface-3)] text-[var(--color-text-primary)]' },
              { id: 'cancelled', label: 'Cancelled / Declined', count: cancelledCount, activeStyle: 'bg-rose-500/15 text-rose-300' },
            ] as const).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id as typeof tab)}
                className={`px-3.5 py-1.5 rounded-xl font-medium whitespace-nowrap shrink-0 transition-all duration-200 flex items-center gap-1.5 ${
                  tab === t.id
                    ? `${t.activeStyle} font-semibold shadow-sm`
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)]'
                }`}
              >
                <span>{t.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${tab === t.id ? 'bg-black/20 text-inherit font-bold' : 'bg-[var(--color-surface-3)] text-[var(--color-text-muted)]'}`}>
                  {t.count}
                </span>
              </button>
            ))}
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
                  <Card
                    key={reg.id}
                    className="p-5 flex flex-col justify-between gap-4 border border-[oklch(100%_0_0_/_0.08)] hover:border-[oklch(100%_0_0_/_0.15)] transition-all shadow-sm"
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
                              <Badge variant="cyan" className="capitalize text-[10px]">
                                {event.category}
                              </Badge>
                              {event.participation_type === 'team' && (
                                <Badge variant="pink" className="text-[10px] flex items-center gap-1">
                                  <Users size={10} /> Team Event
                                </Badge>
                              )}
                            </>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-[var(--color-text-muted)]">
                              Event Unavailable
                            </Badge>
                          )}
                        </div>

                        {/* Event Title */}
                        <h3 className="font-bold text-[var(--color-text-primary)] text-base line-clamp-1">
                          {event?.slug ? (
                            <Link
                              to={`/events/${event.slug}`}
                              className="hover:text-[var(--color-brand-cyan)] transition-colors"
                            >
                              {event.title}
                            </Link>
                          ) : (
                            <span className="text-[var(--color-text-secondary)] italic">
                              {event?.title || 'Event Details Unavailable'}
                            </span>
                          )}
                        </h3>

                        {/* Team Info if Team Event */}
                        {isTeam && (
                          <div className="mt-2 p-2 rounded-xl bg-[var(--color-surface-2)]/70 border border-[var(--color-surface-3)] text-xs">
                            <div className="flex items-center justify-between text-[var(--color-brand-purple)] font-medium">
                              <span className="flex items-center gap-1.5">
                                <Users size={13} />
                                <strong className="text-[var(--color-text-primary)]">
                                  {reg.team_name || 'Team Registration'}
                                </strong>
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-[var(--color-text-muted)]">
                                  {reg.team_role === 'leader' ? 'Team Leader' : 'Team Member'}
                                </span>
                                {reg.team_id && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedTeamId(reg.team_id)
                                      setShowTeamModal(true)
                                    }}
                                    className="px-2 py-0.5 rounded-lg bg-[var(--color-brand-purple)]/15 hover:bg-[var(--color-brand-purple)]/25 text-[var(--color-brand-purple)] text-[11px] font-semibold transition-colors cursor-pointer"
                                  >
                                    {reg.team_role === 'leader' ? 'Manage Squad' : 'View Squad'}
                                  </button>
                                )}
                              </div>
                            </div>

                            {teamMembers.length > 0 && (
                              <div className="text-[11px] text-[var(--color-text-secondary)] mt-1 truncate">
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
                        <div className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)] mt-2">
                          <span className="flex items-center gap-1.5">
                            <Calendar size={12} className="text-[var(--color-brand-cyan)]" /> {formattedDate} • {startDate ? formattedTime : ''}
                          </span>
                          <span className="flex items-center gap-1.5 truncate">
                            <MapPin size={12} className="text-[var(--color-brand-pink)]" /> {event?.venue_name || 'Venue details unavailable'}
                          </span>
                        </div>
                      </div>

                      {/* Poster thumbnail or clean fallback icon */}
                      {event?.poster_url ? (
                        <img
                          src={event.poster_url}
                          alt={event.title || 'Event'}
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover shrink-0 border border-[var(--color-surface-3)] shadow-sm"
                        />
                      ) : (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] flex items-center justify-center text-[var(--color-text-muted)] shrink-0">
                          <Ticket size={24} />
                        </div>
                      )}
                    </div>

                    {/* Bottom ticket action row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[var(--color-surface-3)] text-xs">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--color-text-muted)] min-w-0">
                        <QrCode size={13} className="text-[var(--color-brand-cyan)] shrink-0" />
                        <span className="truncate">{reg.ticket_code}</span>
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
                              className="border-[var(--color-brand-purple)]/40 text-[var(--color-brand-purple)] hover:bg-[var(--color-brand-purple)]/10"
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
                              className="bg-amber-500 hover:bg-amber-400 text-black border-none font-semibold"
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
                            <span className="text-[11px] text-[var(--color-text-muted)] italic px-2">
                              Admitted at Gate
                            </span>
                          ) : hasStarted ? (
                            <span className="text-[11px] text-[var(--color-text-muted)] italic px-2">
                              Concluded
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setCancellingReg(reg)}
                              className="text-[11px] text-rose-400 hover:text-rose-300 font-medium ml-1 transition-colors px-2 py-1 rounded-lg hover:bg-rose-500/10"
                            >
                              Cancel Pass
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </Card>
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
