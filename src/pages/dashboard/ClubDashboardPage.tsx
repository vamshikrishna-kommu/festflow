import { useState, useEffect, useMemo } from 'react'
import { motion } from 'motion/react'
import {
  Building2,
  Calendar,
  Users,
  CreditCard,
  Plus,
  Edit,
  ArrowRight,
  Clock,
  MapPin,
  QrCode,
  TrendingUp,
  GraduationCap,
  Tag,
  Star,
  Activity,
  BarChart3,
  Filter,
  CheckCircle2,
  Sparkles,
  Layers,
  ShieldCheck,
  Award,
  Settings,
} from 'lucide-react'
import { Button, Badge, EmptyState } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/context/AuthContext'
import { Link, useNavigate } from 'react-router'
import { fadeIn, staggerContainer, metricItem } from '@/lib/animations'
import { listClubEvents } from '@/lib/events'
import { getClubPaymentSubmissions } from '@/lib/payments'
import { hasPermission, ROLE_LABELS } from '@/lib/clubMembers'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { ClubCouponsModal } from '@/components/club/ClubCouponsModal'
import { ClubBrandingModal } from '@/components/club/ClubBrandingModal'
import { EventComparisonModal } from '@/components/club/EventComparisonModal'
import { EventTeamDelegationModal } from '@/components/club/EventTeamDelegationModal'
import { EventFeedbackDashboardModal } from '@/components/club/EventFeedbackDashboardModal'
import type { EventRecord, PaymentSubmissionWithDetails, RegistrationRecord } from '@/types'

type DateRangeFilter = 'all' | 'today' | '7d' | '30d'

interface ActivityItem {
  id: string
  type: 'registration' | 'payment' | 'checkin' | 'event'
  title: string
  subtitle: string
  timestamp: string
  status?: string
}

export default function ClubDashboardPage() {
  const {
    profile,
    clubProfile,
    activeClubMembership,
    activeClubProfile,
    activeClubId,
    activeClubRole,
    isDualEligible,
    switchWorkspace,
    signOut,
  } = useAuth()
  const navigate = useNavigate()

  // Primary Data States
  const [events, setEvents] = useState<EventRecord[]>([])
  const [submissions, setSubmissions] = useState<PaymentSubmissionWithDetails[]>([])
  const [allRegistrations, setAllRegistrations] = useState<RegistrationRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filter States
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all')
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>('all')

  // Modals
  const [couponsModalOpen, setCouponsModalOpen] = useState(false)
  const [brandingModalOpen, setBrandingModalOpen] = useState(false)
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false)
  const [delegationModalEvent, setDelegationModalEvent] = useState<EventRecord | null>(null)
  const [feedbackModalEvent, setFeedbackModalEvent] = useState<EventRecord | null>(null)

  const clubId = activeClubId || clubProfile?.profile_id || activeClubMembership?.club_id || ''
  const clubName = clubProfile?.club_name || activeClubProfile?.club_name || profile?.display_name || 'Campus Organization'
  const repName = profile?.display_name || clubProfile?.representative_name || 'Club Representative'

  const loadClubData = async () => {
    if (!clubId) {
      setLoading(false)
      return
    }
    setLoading(true)

    const [eventsRes, paymentsRes] = await Promise.all([
      listClubEvents(clubId),
      getClubPaymentSubmissions(clubId),
    ])

    const loadedEvents = eventsRes.events || []
    setEvents(loadedEvents)
    if (paymentsRes.submissions) setSubmissions(paymentsRes.submissions)

    // Load registrations across this club's events
    const eventIds = loadedEvents.map((e) => e.id)
    if (isSupabaseConfigured && eventIds.length > 0) {
      try {
        const { data: regData } = await (supabase.from('registrations') as any)
          .select('*')
          .in('event_id', eventIds)
          .order('created_at', { ascending: false })

        if (regData) {
          setAllRegistrations(regData)
        }
      } catch (e: any) {
        console.warn('[FestFlow Dashboard] Registrations query note:', e.message)
      }
    } else {
      // Local fallback
      try {
        const raw = localStorage.getItem('festflow_local_registrations')
        if (raw) {
          const parsed = JSON.parse(raw) as RegistrationRecord[]
          setAllRegistrations(parsed.filter((r) => eventIds.includes(r.event_id)))
        }
      } catch {
        // fallback
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    loadClubData()
  }, [clubId])

  const now = new Date()

  // ── Date Range Filter Calculation ──────────────────────────────────────────
  const dateThreshold = useMemo(() => {
    if (dateRange === 'today') {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      return d
    }
    if (dateRange === '7d') {
      return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    }
    if (dateRange === '30d') {
      return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    }
    return null
  }, [dateRange])

  // Filtered Events
  const filteredEvents = useMemo(() => {
    if (selectedEventFilter === 'all') return events
    return events.filter((e) => e.id === selectedEventFilter)
  }, [events, selectedEventFilter])

  // Filtered Registrations
  const filteredRegistrations = useMemo(() => {
    let list = allRegistrations
    if (selectedEventFilter !== 'all') {
      list = list.filter((r) => r.event_id === selectedEventFilter)
    }
    if (dateThreshold) {
      list = list.filter((r) => new Date(r.created_at) >= dateThreshold)
    }
    return list
  }, [allRegistrations, selectedEventFilter, dateThreshold])

  // Real Database-backed metrics
  const publishedEvents = useMemo(() => filteredEvents.filter((e) => e.status === 'published'), [filteredEvents])
  const draftEvents = useMemo(() => filteredEvents.filter((e) => e.status === 'draft'), [filteredEvents])
  const publishedCount = publishedEvents.length
  const draftCount = draftEvents.length

  const totalCapacity = useMemo(() => filteredEvents.reduce((sum, e) => sum + (e.capacity || 0), 0), [filteredEvents])
  const totalRegistrationsCount = filteredRegistrations.length
  const confirmedRegistrations = useMemo(() => filteredRegistrations.filter((r) => r.status === 'confirmed'), [filteredRegistrations])
  const confirmedCount = confirmedRegistrations.length

  // Attendance Metrics
  const checkedInCount = useMemo(() => filteredRegistrations.filter((r) => (r as any).attendance_status === 'checked_in').length, [filteredRegistrations])
  const turnoutRate = confirmedCount > 0 ? Math.round((checkedInCount / confirmedCount) * 100) : 0
  const capacityUtilization = totalCapacity > 0 ? Math.round((totalRegistrationsCount / totalCapacity) * 100) : 0

  // Payments Metrics
  const pendingPayments = useMemo(
    () => submissions.filter((s) => s.status === 'pending_review' && (selectedEventFilter === 'all' || s.event_id === selectedEventFilter)),
    [submissions, selectedEventFilter]
  )
  const pendingPaymentsCount = pendingPayments.length

  const approvedPayments = useMemo(
    () => submissions.filter((s) => s.status === 'approved' && (selectedEventFilter === 'all' || s.event_id === selectedEventFilter)),
    [submissions, selectedEventFilter]
  )
  const grossVerifiedRevenue = useMemo(
    () => approvedPayments.reduce((sum, s) => sum + (s.amount || 0), 0),
    [approvedPayments]
  )

  // ── Daily Registration Velocity for Interactive Area Chart (Part 3) ───────
  const chartData = useMemo(() => {
    const days = 14
    const result: Array<{ dayLabel: string; count: number; dateStr: string }> = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const dayLabel = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
      const count = filteredRegistrations.filter((r) => r.created_at.slice(0, 10) === dateStr).length
      result.push({ dayLabel, count, dateStr })
    }
    return result
  }, [filteredRegistrations])

  const maxChartCount = Math.max(5, ...chartData.map((d) => d.count))

  // ── Live Recent Activity Feed (Part 15) ───────────────────────────────────
  const recentActivities: ActivityItem[] = useMemo(() => {
    const list: ActivityItem[] = []

    // 1. Latest registrations
    filteredRegistrations.slice(0, 8).forEach((r) => {
      const evt = events.find((e) => e.id === r.event_id)
      list.push({
        id: `act_reg_${r.id}`,
        type: 'registration',
        title: r.team_name ? `Team Registered: ${r.team_name}` : `Pass Registered #${r.ticket_code}`,
        subtitle: evt?.title || 'Campus Event',
        timestamp: r.created_at,
        status: r.status,
      })
    })

    // 2. Latest payments
    submissions.slice(0, 5).forEach((p) => {
      const evt = events.find((e) => e.id === p.event_id)
      list.push({
        id: `act_pay_${p.id}`,
        type: 'payment',
        title: `Payment Ref: ${p.transaction_reference || 'Submitted'}`,
        subtitle: `${evt?.title || 'Event'} • ₹${p.amount}`,
        timestamp: p.submitted_at || p.created_at,
        status: p.status,
      })
    })

    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return list.slice(0, 8)
  }, [filteredRegistrations, submissions, events])

  // Organizer Next Action Banner
  const organizerNextAction = useMemo(() => {
    if (pendingPaymentsCount > 0) {
      return {
        type: 'pending_payment' as const,
        title: `${pendingPaymentsCount} Payment Submission${pendingPaymentsCount > 1 ? 's' : ''} Awaiting Review`,
        description: 'Students have submitted transaction UTR proofs for paid event tickets. Review and approve to release gate passes.',
        ctaLabel: 'Review Payments',
        ctaLink: '/club/payments',
        badge: 'Action Required',
        badgeVariant: 'amber' as const,
      }
    }

    const upcomingPublished = publishedEvents
      .filter((e) => Boolean(e.start_date))
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())

    if (upcomingPublished.length > 0) {
      const nextEvt = upcomingPublished[0]
      const startDate = new Date(nextEvt.start_date)
      const diffMs = startDate.getTime() - now.getTime()
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

      if (diffHours >= -6 && diffHours <= 48) {
        return {
          type: 'event_active' as const,
          title: `Gate Desk Ready: ${nextEvt.title}`,
          description: `Event ${diffHours <= 0 ? 'is in progress' : `starts in ${diffHours} hours`} at ${nextEvt.venue_name}. Launch check-in scanner for attendee admittance.`,
          ctaLabel: 'Launch QR Check-In',
          ctaLink: `/club/events/${nextEvt.id}/check-in`,
          badge: 'Live Session',
          badgeVariant: 'cyan' as const,
        }
      }
    }

    if (draftCount > 0) {
      const draftEvt = draftEvents[0]
      return {
        type: 'draft_pending' as const,
        title: `Draft Ready for Review: "${draftEvt.title}"`,
        description: 'Complete form configuration, custom questions, or publish this event to campus students.',
        ctaLabel: 'Edit & Publish',
        ctaLink: `/club/events/${draftEvt.id}/edit`,
        badge: 'Draft Saved',
        badgeVariant: 'purple' as const,
      }
    }

    return {
      type: 'default' as const,
      title: 'Host Your Next Campus Experience',
      description: 'Create technical hackathons, cultural festivals, athletic tournaments, or seminars with automated QR ticketing.',
      ctaLabel: 'Create New Event',
      ctaLink: '/club/events/new',
      badge: 'Organizer Hub',
      badgeVariant: 'cyan' as const,
    }
  }, [pendingPaymentsCount, publishedEvents, draftEvents, draftCount, now])

  if (!clubId && !loading) {
    return (
      <PageShell>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center justify-center text-center">
          <EmptyState
            icon={Building2}
            title="No Active Club Organization"
            description="You do not currently belong to an active club organization. When a club invites you to their team, you'll manage events and turnstile gate check-in here."
            action={
              <Button
                variant="primary"
                onClick={() => switchWorkspace('student', navigate)}
                leftIcon={<GraduationCap size={16} />}
              >
                Return to Student Workspace
              </Button>
            }
          />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-7 text-left">
        {/* Top Header Card with Brand Identity & Shortcuts */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="relative rounded-3xl border border-white/[0.08] overflow-hidden p-5 sm:p-6 md:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-2xl bg-gradient-to-b from-[#0E0E12] to-[#08080A]"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 15% 40%, rgba(24, 207, 252, 0.12) 0%, transparent 65%)' }}
          />

          <div className="relative flex items-center gap-4 sm:gap-5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[#18CFFC]/20 shrink-0 border border-white/10 bg-gradient-to-br from-[#18CFFC] to-[#7F1AFB]">
              <Building2 size={32} className="sm:w-9 sm:h-9" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-white truncate">
                  {clubName}
                </h1>
                <Badge variant="purple" className="flex items-center gap-1.5 shrink-0 text-[10px] sm:text-xs">
                  <ShieldCheck size={12} className="text-[#18CFFC]" />
                  {activeClubRole ? ROLE_LABELS[activeClubRole] : 'Club Administrator'}
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-400 flex-wrap font-sans">
                <span>Lead: <strong className="text-white">{repName}</strong></span>
                {profile?.email && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span className="text-zinc-500 truncate max-w-[220px]">
                      {profile.email}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions Action Bar */}
          <div className="relative flex flex-wrap items-center gap-2 sm:gap-2.5 pt-3 lg:pt-0 border-t lg:border-t-0 border-white/[0.08] shrink-0">
            {(!activeClubRole || hasPermission(activeClubRole, 'manage_events')) && (
              <Link to="/club/events/new">
                <Button variant="primary" size="sm" leftIcon={<Plus size={15} />}>
                  Create Event
                </Button>
              </Link>
            )}

            {(!activeClubRole || hasPermission(activeClubRole, 'review_payments')) && (
              <Link to="/club/payments">
                <Button
                  variant={pendingPaymentsCount > 0 ? 'primary' : 'outline'}
                  size="sm"
                  leftIcon={<CreditCard size={15} />}
                >
                  Payments
                  {pendingPaymentsCount > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-bold">
                      {pendingPaymentsCount}
                    </span>
                  )}
                </Button>
              </Link>
            )}

            {/* Coupons Shortcut */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCouponsModalOpen(true)}
              leftIcon={<Tag size={14} className="text-amber-400" />}
            >
              Coupons
            </Button>

            {/* Event Comparison Shortcut */}
            {events.length >= 2 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setComparisonModalOpen(true)}
                leftIcon={<BarChart3 size={14} className="text-[#18CFFC]" />}
              >
                Compare
              </Button>
            )}

            {/* Brand & Identity Customizer */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBrandingModalOpen(true)}
              leftIcon={<Sparkles size={14} className="text-[#ED47FC]" />}
            >
              Brand & Profile
            </Button>

            {/* Certificates Studio Shortcut */}
            <Link to="/club/certificates">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Award size={14} className="text-[#18CFFC]" />}
              >
                Certificates
              </Button>
            </Link>

            {(!activeClubRole || hasPermission(activeClubRole, 'manage_members')) && (
              <Link to="/club/members">
                <Button variant="outline" size="sm" leftIcon={<Users size={15} />}>
                  Team Roster
                </Button>
              </Link>
            )}

            <Link to="/club/settings">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Settings size={14} className="text-zinc-400" />}
              >
                Settings
              </Button>
            </Link>

            {isDualEligible && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => switchWorkspace('student', navigate)}
                className="text-zinc-300 hover:text-white"
                leftIcon={<GraduationCap size={15} />}
              >
                Student Space
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut()}
              className="text-rose-400 hover:text-rose-300 hover:border-rose-500/30"
            >
              Sign Out
            </Button>
          </div>
        </motion.div>

        {/* ── Spotlight Next Action Banner ─────────────────────────────────── */}
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
                  organizerNextAction.type === 'pending_payment'
                    ? 'bg-amber-500/20 text-amber-300'
                    : organizerNextAction.type === 'event_active'
                    ? 'bg-[#18CFFC]/20 text-[#18CFFC]'
                    : 'bg-[#14141A] text-[#18CFFC]'
                }`}
              >
                {organizerNextAction.type === 'pending_payment' ? (
                  <CreditCard size={22} />
                ) : organizerNextAction.type === 'event_active' ? (
                  <QrCode size={22} />
                ) : (
                  <Calendar size={22} />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge variant={organizerNextAction.badgeVariant} className="text-[10px]">
                    {organizerNextAction.badge}
                  </Badge>
                </div>
                <h2 className="text-base sm:text-lg font-bold font-heading text-white">
                  {organizerNextAction.title}
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 mt-0.5 max-w-2xl leading-relaxed font-sans">
                  {organizerNextAction.description}
                </p>
              </div>
            </div>

            <Link to={organizerNextAction.ctaLink} className="self-start sm:self-center shrink-0">
              <Button
                variant="primary"
                size="md"
                rightIcon={<ArrowRight size={15} />}
              >
                {organizerNextAction.ctaLabel}
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* ── Date Range & Event Filters ───────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#14141A] border border-white/[0.08]">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
            <span className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1 mr-1">
              <Filter size={12} /> Timeframe:
            </span>
            {(['all', 'today', '7d', '30d'] as const).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all capitalize cursor-pointer ${
                  dateRange === range
                    ? 'bg-[#18CFFC] text-black font-bold shadow-md shadow-[#18CFFC]/20'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {range === 'all' ? 'All Time' : range === 'today' ? 'Today' : `Last ${range.toUpperCase()}`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 whitespace-nowrap">Filter Event:</span>
            <select
              value={selectedEventFilter}
              onChange={(e) => setSelectedEventFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#08080A] border border-white/10 text-xs text-white focus:outline-none focus:border-[#18CFFC]"
            >
              <option value="all">All Managed Events ({events.length})</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Primary Authorized Metrics Grid (Part 2) ─────────────────────── */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
        >
          {[
            {
              label: 'Total Registrations',
              value: loading ? '…' : totalRegistrationsCount.toString(),
              subtitle: `${confirmedCount} confirmed gate passes`,
              icon: Users,
              color: 'text-[#18CFFC]',
              badgeStyle: 'bg-[#18CFFC]/10 border-[#18CFFC]/20 text-[#18CFFC]',
            },
            {
              label: 'Gate Attendance',
              value: loading ? '…' : checkedInCount.toString(),
              subtitle: `${turnoutRate}% turnout conversion rate`,
              icon: CheckCircle2,
              color: 'text-emerald-400',
              badgeStyle: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
            },
            {
              label: 'Pending Fee Reviews',
              value: loading ? '…' : pendingPaymentsCount.toString(),
              subtitle: 'UTR proofs awaiting verification',
              icon: CreditCard,
              color: 'text-amber-400',
              badgeStyle: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
              link: '/club/payments',
              highlight: pendingPaymentsCount > 0,
            },
            {
              label: 'Verified Gross Fees',
              value: loading ? '…' : `₹${grossVerifiedRevenue.toLocaleString()}`,
              subtitle: `${approvedPayments.length} verified transactions`,
              icon: TrendingUp,
              color: 'text-emerald-400',
              badgeStyle: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
              link: '/club/payments',
            },
            {
              label: 'Published Events',
              value: loading ? '…' : publishedCount.toString(),
              subtitle: 'Active campus listings',
              icon: Calendar,
              color: 'text-[#18CFFC]',
              badgeStyle: 'bg-[#18CFFC]/10 border-[#18CFFC]/20 text-[#18CFFC]',
              link: '/club/events',
            },
            {
              label: 'Draft Events',
              value: loading ? '…' : draftCount.toString(),
              subtitle: 'Pending publication review',
              icon: Layers,
              color: 'text-purple-400',
              badgeStyle: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
            },
            {
              label: 'Capacity Fill Rate',
              value: loading ? '…' : `${capacityUtilization}%`,
              subtitle: `${totalRegistrationsCount} of ${totalCapacity} total seats`,
              icon: BarChart3,
              color: 'text-sky-400',
              badgeStyle: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
            },
            {
              label: 'Upcoming (30 Days)',
              value: loading
                ? '…'
                : publishedEvents
                    .filter((e) => e.start_date && new Date(e.start_date) >= now)
                    .length.toString(),
              subtitle: 'Events scheduled this month',
              icon: Clock,
              color: 'text-zinc-300',
              badgeStyle: 'bg-white/10 border-white/15 text-zinc-300',
            },
          ].map((stat, i) => {
            const Icon = stat.icon
            const cardContent = (
              <motion.div variants={metricItem} className="h-full">
                <div
                  className={`p-4 sm:p-5 rounded-2xl bg-[#0E0E12] border flex flex-col justify-between gap-3 h-full transition-all duration-200 ${
                    stat.highlight
                      ? 'border-amber-500/40 bg-amber-500/[0.04] shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                      : 'border-white/[0.08] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400 font-medium font-sans">
                      {stat.label}
                    </span>
                    <div className={`p-2 rounded-xl border ${stat.badgeStyle}`}>
                      <Icon size={16} />
                    </div>
                  </div>

                  <div>
                    <span
                      className={`text-2xl sm:text-3xl font-extrabold font-heading font-mono ${
                        stat.highlight ? 'text-amber-400' : 'text-white'
                      }`}
                    >
                      {stat.value}
                    </span>
                    <span className="text-[11px] text-zinc-500 block mt-0.5 truncate font-sans">
                      {stat.subtitle}
                    </span>
                  </div>
                </div>
              </motion.div>
            )

            return stat.link ? (
              <Link to={stat.link} key={i} className="block h-full">
                {cardContent}
              </Link>
            ) : (
              <div key={i} className="h-full">
                {cardContent}
              </div>
            )
          })}
        </motion.div>

        {/* ── Live Analytics & Velocity Trends (Part 3) ────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Daily Registration Velocity Chart */}
          <div className="lg:col-span-8 p-5 sm:p-6 rounded-3xl bg-[#0E0E12] border border-white/[0.08] flex flex-col justify-between gap-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold font-heading text-white flex items-center gap-2">
                  <Activity size={18} className="text-[#18CFFC]" />
                  Registration Velocity (Last 14 Days)
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Daily incoming student registrations across active club experiences
                </p>
              </div>
              <Badge variant="cyan" className="font-mono text-xs">
                Peak: {Math.max(...chartData.map((d) => d.count))} / day
              </Badge>
            </div>

            {/* Interactive SVG Bar Chart */}
            <div className="h-44 w-full flex items-end gap-2 pt-6 pb-2 px-1">
              {chartData.map((item, idx) => {
                const heightPct = Math.max(8, Math.round((item.count / maxChartCount) * 100))
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group relative">
                    {/* Tooltip on Hover */}
                    <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900 border border-white/20 px-2 py-0.5 rounded text-[10px] text-white font-mono whitespace-nowrap pointer-events-none z-10">
                      {item.count} passes ({item.dateStr})
                    </div>

                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-[#0D56FB] to-[#18CFFC] group-hover:to-[#ED47FC] transition-all duration-300"
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-[9px] text-zinc-500 font-mono truncate w-full text-center">
                      {item.dayLabel.split(' ')[1]}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/5 text-xs text-zinc-500">
              <span>Updated in real-time from active registrations</span>
              <span className="text-[#18CFFC] font-mono">
                Total in window: {chartData.reduce((s, c) => s + c.count, 0)}
              </span>
            </div>
          </div>

          {/* Recent Live Activity Stream (Part 15) */}
          <div className="lg:col-span-4 p-5 sm:p-6 rounded-3xl bg-[#0E0E12] border border-white/[0.08] flex flex-col justify-between gap-4 shadow-xl">
            <div>
              <h3 className="text-base font-bold font-heading text-white flex items-center gap-2">
                <Clock size={16} className="text-purple-400" />
                Recent Organizer Activity
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Real-time activity audit stream
              </p>
            </div>

            <div className="flex flex-col gap-2.5 max-h-56 overflow-y-auto pr-1">
              {recentActivities.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">
                  No recent activity recorded yet.
                </div>
              ) : (
                recentActivities.map((act) => (
                  <div
                    key={act.id}
                    className="p-2.5 rounded-xl bg-[#14141A] border border-white/5 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-white block truncate">
                        {act.title}
                      </span>
                      <span className="text-[10px] text-zinc-400 block truncate">
                        {act.subtitle}
                      </span>
                    </div>
                    <Badge variant={act.status === 'confirmed' || act.status === 'approved' ? 'success' : 'amber'} className="text-[10px] shrink-0">
                      {act.status || 'Active'}
                    </Badge>
                  </div>
                ))
              )}
            </div>

            <Link to="/club/members" className="pt-2 border-t border-white/5 text-center text-xs text-[#18CFFC] hover:underline">
              Inspect Full Audit Trail →
            </Link>
          </div>
        </div>

        {/* ── Managed Campus Events List ───────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/[0.08]">
            <div>
              <h2 className="text-xl font-bold font-heading text-white">
                Managed Campus Events
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Real-time ticketing, check-in desks, and attendee records for {clubName}
              </p>
            </div>

            <Link to="/club/events/new">
              <Button size="sm" variant="primary" leftIcon={<Plus size={14} />}>
                Host Event
              </Button>
            </Link>
          </div>

          {events.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No Events Created Yet"
              description="Start organizing campus hackathons, cultural festivals, athletic tournaments, or seminars with automated QR ticketing."
              action={
                <Link to="/club/events/new">
                  <Button variant="primary" size="sm" leftIcon={<Plus size={15} />}>
                    Create First Event
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEvents.map((evt) => {
                const evtRegs = allRegistrations.filter((r) => r.event_id === evt.id)
                const evtConfirmed = evtRegs.filter((r) => r.status === 'confirmed').length
                const evtCheckedIn = evtRegs.filter((r) => (r as any).attendance_status === 'checked_in').length
                const capacity = evt.capacity || 100
                const fillPct = Math.min(100, Math.round((evtConfirmed / capacity) * 100))

                return (
                  <div
                    key={evt.id}
                    className="p-5 rounded-3xl bg-[#0E0E12] border border-white/[0.08] hover:border-white/20 transition-all flex flex-col justify-between gap-4 shadow-xl"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#18CFFC]">
                          {evt.category}
                        </span>
                        <Badge
                          variant={evt.status === 'published' ? 'success' : 'amber'}
                          className="capitalize text-[10px]"
                        >
                          {evt.status}
                        </Badge>
                      </div>

                      <h3 className="text-base font-bold font-heading text-white line-clamp-1">
                        {evt.title}
                      </h3>
                      <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-1">
                        <MapPin size={12} className="text-[#18CFFC]" />
                        {evt.venue_name || 'Campus Venue'}
                      </p>
                    </div>

                    {/* Capacity & Attendance Fill Bar */}
                    <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400">Admittance:</span>
                        <span className="font-mono text-white">
                          <strong>{evtCheckedIn}</strong> / {evtConfirmed} passes ({fillPct}% cap)
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#18CFFC] to-[#0D56FB] rounded-full"
                          style={{ width: `${fillPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Shortcuts Actions */}
                    <div className="flex items-center justify-between gap-1.5 pt-3 border-t border-white/5 flex-wrap">
                      <Link to={`/club/events/${evt.id}/registrations`} className="flex-1">
                        <Button size="sm" variant="primary" leftIcon={<Users size={13} />} className="w-full text-xs">
                          Roster
                        </Button>
                      </Link>

                      <Link to={`/club/events/${evt.id}/check-in`}>
                        <Button size="sm" variant="outline" leftIcon={<QrCode size={13} />} className="text-xs">
                          Scanner
                        </Button>
                      </Link>

                      <button
                        type="button"
                        onClick={() => setDelegationModalEvent(evt)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-purple-400 hover:text-white transition-colors cursor-pointer"
                        title="Staff Delegation"
                      >
                        <ShieldCheck size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setFeedbackModalEvent(evt)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-amber-400 hover:text-white transition-colors cursor-pointer"
                        title="Feedback Reviews"
                      >
                        <Star size={14} />
                      </button>

                      <Link to={`/club/events/${evt.id}/edit`}>
                        <button
                          type="button"
                          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                          title="Edit Event Details"
                        >
                          <Edit size={14} />
                        </button>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Modals: Coupons, Brand Customization, Comparison, Delegation, Feedback ─ */}
        <ClubCouponsModal
          isOpen={couponsModalOpen}
          onClose={() => setCouponsModalOpen(false)}
          clubId={clubId}
        />

        <ClubBrandingModal
          isOpen={brandingModalOpen}
          onClose={() => setBrandingModalOpen(false)}
          clubId={clubId}
          onUpdated={loadClubData}
        />

        {events.length >= 2 && (
          <EventComparisonModal
            isOpen={comparisonModalOpen}
            onClose={() => setComparisonModalOpen(false)}
            events={events}
          />
        )}

        {delegationModalEvent && (
          <EventTeamDelegationModal
            isOpen={Boolean(delegationModalEvent)}
            onClose={() => setDelegationModalEvent(null)}
            eventId={delegationModalEvent.id}
            clubId={clubId}
            eventTitle={delegationModalEvent.title}
            currentUserId={profile?.id || ''}
          />
        )}

        {feedbackModalEvent && (
          <EventFeedbackDashboardModal
            isOpen={Boolean(feedbackModalEvent)}
            onClose={() => setFeedbackModalEvent(null)}
            eventId={feedbackModalEvent.id}
            eventTitle={feedbackModalEvent.title}
          />
        )}
      </div>
    </PageShell>
  )
}
