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
  TrendingUp,
  GraduationCap,
  Tag,
  Star,
  Activity,
  BarChart3,
  Filter,
  AlertTriangle,
  Sparkles,
  Layers,
  ShieldCheck,
  Settings,
  ChevronDown,
  Archive,
} from 'lucide-react'
import { Button, Badge, EmptyState, Alert } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/context/AuthContext'
import { Link, useNavigate } from 'react-router'
import { fadeIn, staggerContainer, metricItem } from '@/lib/animations'
import {
  listClubEvents,
  getEventLifecyclePhase,
  isEventConcludedOrCancelled,
  LIFECYCLE_BADGE_META,
  formatEventDate,
  formatEventTime,
  resolveEventTimezone,
} from '@/lib/events'
import { getClubPaymentSubmissions } from '@/lib/payments'
import { getClubRegistrations } from '@/lib/registrations'
import { ROLE_LABELS } from '@/lib/clubMembers'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { ClubCouponsModal } from '@/components/club/ClubCouponsModal'
import { ClubBrandingModal } from '@/components/club/ClubBrandingModal'
import { EventTeamDelegationModal } from '@/components/club/EventTeamDelegationModal'
import { EventFeedbackDashboardModal } from '@/components/club/EventFeedbackDashboardModal'
import type { EventRecord, PaymentSubmissionWithDetails, RegistrationRecord } from '@/types'

type DateRangeFilter = 'all' | 'today' | '7d' | '30d'
type DashboardLifecycleTab = 'all' | 'upcoming' | 'ongoing' | 'completed' | 'draft' | 'cancelled'

const DASHBOARD_LIFECYCLE_LABELS: Record<DashboardLifecycleTab, string> = {
  all: 'All',
  upcoming: 'Upcoming',
  ongoing: 'Live Now',
  completed: 'Completed',
  draft: 'Drafts',
  cancelled: 'Cancelled',
}

interface ActivityItem {
  id: string
  type: 'registration' | 'payment' | 'event'
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
    eventAssignments,
    isDualEligible,
    isRoleLoading,
    hasClubPermission,
    hasEventPermission,
    switchWorkspace,
    signOut,
  } = useAuth()
  const navigate = useNavigate()

  // Primary Data States
  const [events, setEvents] = useState<EventRecord[]>([])
  const [submissions, setSubmissions] = useState<PaymentSubmissionWithDetails[]>([])
  const [allRegistrations, setAllRegistrations] = useState<RegistrationRecord[]>([])
  const [seatReservations, setSeatReservations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Filter States
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all')
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>('all')
  const [eventLifecycleFilter, setEventLifecycleFilter] = useState<DashboardLifecycleTab>('all')
  const [showAllMetrics, setShowAllMetrics] = useState(false)

  // Modals
  const [couponsModalOpen, setCouponsModalOpen] = useState(false)
  const [brandingModalOpen, setBrandingModalOpen] = useState(false)
  const [delegationModalEvent, setDelegationModalEvent] = useState<EventRecord | null>(null)
  const [feedbackModalEvent, setFeedbackModalEvent] = useState<EventRecord | null>(null)

  const clubId = activeClubId || ''
  const clubName =
    activeClubProfile?.club_name ||
    activeClubMembership?.club_name ||
    clubProfile?.club_name ||
    profile?.display_name ||
    'Campus Organization'
  const repName =
    profile?.display_name ||
    activeClubProfile?.representative_name ||
    clubProfile?.representative_name ||
    'Club Representative'

  const canCreateEvents = hasClubPermission('events.create')
  const canEditAnyEvent = hasClubPermission('events.edit')
  const canManageClub = hasClubPermission('club.manage')
  const canManageCoupons = hasClubPermission('club.manage') || hasClubPermission('events.edit')
  const canViewPayments = hasClubPermission('payments.view')
  const canVerifyPayments = hasClubPermission('payments.verify')
  const canViewMembers = hasClubPermission('members.view')
  const canAssignRoles = hasClubPermission('roles.assign')
  const canManageSettings = hasClubPermission('club.manage') || hasClubPermission('payments.settings')
  const canViewRegistrationsClub = hasClubPermission('registrations.view')
  const canManageRegistrationsClub = hasClubPermission('registrations.manage') || hasClubPermission('events.cancel')
  const canViewReportsClub = hasClubPermission('reports.view')

  const loadClubData = async () => {
    if (isRoleLoading) return
    if (!clubId) {
      setEvents([])
      setSubmissions([])
      setAllRegistrations([])
      setLoadError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(null)

    const [eventsRes, paymentsRes] = await Promise.all([
      listClubEvents(clubId),
      canViewPayments ? getClubPaymentSubmissions(clubId) : Promise.resolve({ submissions: [], error: null }),
    ])

    const initialError = eventsRes.error || (canViewPayments ? paymentsRes.error : null) || null
    if (initialError) {
      setLoadError(initialError)
    }

    const loadedEvents = eventsRes.events || []
    setEvents(loadedEvents)
    setSubmissions(canViewPayments && paymentsRes.submissions ? paymentsRes.submissions : [])

    // Load registrations across this club's events using resilient multi-tier queries
    const clubEventIds = loadedEvents.map((e) => e.id)
    if (clubEventIds.length === 0) {
      setAllRegistrations([])
      setSeatReservations([])
    } else {
      const { registrations: clubRegs, error: regError } = await getClubRegistrations(clubId, clubEventIds)
      if (regError) {
        setLoadError((prev) => prev || regError)
      }
      setAllRegistrations(clubRegs || [])

      // Also query active/confirmed seat reservations for cinema reserved seating events
      if (isSupabaseConfigured) {
        try {
          const { data: seatData } = await (supabase.from('seat_reservations') as any)
            .select('id, event_id, seat_id, status, held_until, registration_id')
            .in('event_id', clubEventIds)
            .in('status', ['held', 'payment_submitted', 'payment_under_review', 'confirmed'])

          const nowIso = new Date().toISOString()
          const activeSeats = (seatData || []).filter((s: any) => {
            if (s.status === 'held' && s.held_until && s.held_until <= nowIso) return false
            return true
          })
          setSeatReservations(activeSeats)
        } catch {
          setSeatReservations([])
        }
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!isRoleLoading) {
      loadClubData()
    }
  }, [clubId, isRoleLoading, activeClubRole, canViewPayments, canViewRegistrationsClub, canViewReportsClub, eventAssignments])

  // Real-time synchronization: when a student books or cancels, refresh dashboard automatically
  useEffect(() => {
    if (!clubId || !isSupabaseConfigured) return
    const channel = supabase
      .channel(`club-dashboard-regs-${clubId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'registrations' },
        () => {
          loadClubData()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'seat_reservations' },
        () => {
          loadClubData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
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

  // Real Database-backed lifecycle & registration metrics
  const draftEvents = useMemo(
    () => filteredEvents.filter((e) => getEventLifecyclePhase(e) === 'draft'),
    [filteredEvents]
  )
  const liveEvents = useMemo(
    () => filteredEvents.filter((e) => getEventLifecyclePhase(e) === 'ongoing'),
    [filteredEvents]
  )
  const upcomingEventsList = useMemo(() => {
    return filteredEvents
      .filter((e) => {
        const phase = getEventLifecyclePhase(e)
        return phase === 'upcoming' || phase === 'registration_closed'
      })
      .sort((a, b) => new Date(a.start_date || 0).getTime() - new Date(b.start_date || 0).getTime())
  }, [filteredEvents])
  const completedEvents = useMemo(
    () => filteredEvents.filter((e) => getEventLifecyclePhase(e) === 'completed'),
    [filteredEvents]
  )
  const cancelledEvents = useMemo(
    () => filteredEvents.filter((e) => getEventLifecyclePhase(e) === 'cancelled'),
    [filteredEvents]
  )
  const activePublishedEvents = useMemo(
    () => filteredEvents.filter((e) => !isEventConcludedOrCancelled(e) && getEventLifecyclePhase(e) !== 'draft'),
    [filteredEvents]
  )
  const draftCount = draftEvents.length
  const activePublishedCount = activePublishedEvents.length

  const lifecycleTabCounts = useMemo(
    () => ({
      all: filteredEvents.length,
      upcoming: upcomingEventsList.length,
      ongoing: liveEvents.length,
      completed: completedEvents.length,
      draft: draftEvents.length,
      cancelled: cancelledEvents.length,
    }),
    [
      filteredEvents.length,
      upcomingEventsList.length,
      liveEvents.length,
      completedEvents.length,
      draftEvents.length,
      cancelledEvents.length,
    ]
  )

  const displayedManagedEvents = useMemo(() => {
    const base =
      eventLifecycleFilter === 'all'
        ? filteredEvents
        : eventLifecycleFilter === 'upcoming'
        ? upcomingEventsList
        : eventLifecycleFilter === 'ongoing'
        ? liveEvents
        : eventLifecycleFilter === 'completed'
        ? completedEvents
        : eventLifecycleFilter === 'draft'
        ? draftEvents
        : cancelledEvents

    if (eventLifecycleFilter === 'completed' || eventLifecycleFilter === 'cancelled') {
      return [...base].sort(
        (a, b) => new Date(b.end_date || b.start_date || 0).getTime() - new Date(a.end_date || a.start_date || 0).getTime()
      )
    }
    return base
  }, [
    eventLifecycleFilter,
    filteredEvents,
    upcomingEventsList,
    liveEvents,
    completedEvents,
    draftEvents,
    cancelledEvents,
  ])

  const activeAndUpcomingEvents = useMemo(
    () =>
      filteredEvents.filter((evt) => {
        const phase = getEventLifecyclePhase(evt)
        return phase !== 'completed' && phase !== 'cancelled'
      }),
    [filteredEvents]
  )

  const completedHistoryEvents = useMemo(
    () =>
      [...completedEvents].sort(
        (a, b) => new Date(b.end_date || b.start_date || 0).getTime() - new Date(a.end_date || a.start_date || 0).getTime()
      ),
    [completedEvents]
  )

  const cancelledHistoryEvents = useMemo(
    () =>
      [...cancelledEvents].sort(
        (a, b) => new Date(b.end_date || b.start_date || 0).getTime() - new Date(a.end_date || a.start_date || 0).getTime()
      ),
    [cancelledEvents]
  )

  const totalCapacity = useMemo(() => filteredEvents.reduce((sum, e) => sum + (e.capacity || 0), 0), [filteredEvents])
  const confirmedRegistrations = useMemo(() => filteredRegistrations.filter((r) => r.status === 'confirmed'), [filteredRegistrations])
  const confirmedCount = confirmedRegistrations.length

  // Authoritative total seats occupied: accounts for multi-seat reserved seating, holds, and teams
  const totalSeatsOccupied = useMemo(() => {
    const regSeats = filteredRegistrations.reduce((sum, r) => {
      if (r.status === 'cancelled' || r.status === 'rejected') return sum
      const details = (r as any).participant_details
      const seatCount =
        details?.seat_details?.total_seats ||
        details?.seat_allocations?.length ||
        (Array.isArray((r as any).team_members) && (r as any).team_members.length > 0
          ? (r as any).team_members.length
          : 1)
      return sum + Math.max(1, Number(seatCount) || 1)
    }, 0)

    // Include active cinema seat reservations that might not have a confirmed registration record yet
    const standaloneSeatReservations = seatReservations.filter((sr) => {
      if (selectedEventFilter !== 'all' && sr.event_id !== selectedEventFilter) return false
      if (sr.registration_id && filteredRegistrations.some((r) => r.id === sr.registration_id)) return false
      return true
    })

    return regSeats + standaloneSeatReservations.length
  }, [filteredRegistrations, seatReservations, selectedEventFilter])

  const totalRegistrationsCount = useMemo(() => {
    const regCount = filteredRegistrations.length
    const standaloneCount = new Set(
      seatReservations
        .filter((sr) => (selectedEventFilter === 'all' || sr.event_id === selectedEventFilter) && (!sr.registration_id || !filteredRegistrations.some(r => r.id === sr.registration_id)))
        .map(sr => sr.student_id || sr.id)
    ).size
    return regCount + standaloneCount
  }, [filteredRegistrations, seatReservations, selectedEventFilter])

  const capacityUtilization = totalCapacity > 0 ? Math.min(100, Math.round((totalSeatsOccupied / totalCapacity) * 100)) : 0

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

  // Pending Cancellation Requests
  const pendingCancellations = useMemo(
    () => filteredRegistrations.filter((r) => (r as any).cancellation_request_status === 'pending'),
    [filteredRegistrations]
  )
  const pendingCancellationsCount = pendingCancellations.length

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
      const studentName =
        (r as any).student?.display_name ||
        (r as any).participant_details?.full_name ||
        (r as any).participant_details?.name ||
        (r as any).participant_details?.lead_booker_name
      const title = r.team_name
        ? `Team: ${r.team_name}`
        : studentName
        ? `${studentName} (#${r.ticket_code})`
        : `Pass Registered #${r.ticket_code}`

      list.push({
        id: `act_reg_${r.id}`,
        type: 'registration',
        title,
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
    if (canVerifyPayments && pendingPaymentsCount > 0) {
      return {
        type: 'pending_payment' as const,
        title: `${pendingPaymentsCount} Payment Submission${pendingPaymentsCount > 1 ? 's' : ''} Awaiting Review`,
        description: 'Students have submitted transaction UTR proofs for paid event tickets. Review and approve to issue confirmed entry passes.',
        ctaLabel: 'Review Payments',
        ctaLink: '/club/payments',
        badge: 'Action Required',
        badgeVariant: 'amber' as const,
      }
    }

    const activeSoon = activePublishedEvents
      .filter((e) => {
        if (!hasEventPermission(e.id, 'registrations.view', e.club_id)) return false
        if (getEventLifecyclePhase(e) === 'ongoing') return true
        if (!e.start_date) return false
        const diffHours = Math.floor((new Date(e.start_date).getTime() - now.getTime()) / (1000 * 60 * 60))
        return diffHours >= 0 && diffHours <= 48
      })
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())

    if (activeSoon.length > 0) {
      const nextEvt = activeSoon[0]
      const isOngoing = getEventLifecyclePhase(nextEvt) === 'ongoing'
      const diffHours = nextEvt.start_date
        ? Math.max(0, Math.floor((new Date(nextEvt.start_date).getTime() - now.getTime()) / (1000 * 60 * 60)))
        : 0

      return {
        type: 'event_active' as const,
        title: `${isOngoing ? 'Live Event In Progress' : 'Upcoming Event Ready'}: ${nextEvt.title}`,
        description: `${isOngoing ? 'Event is currently underway' : `Event starts in ${diffHours} hours`} at ${nextEvt.venue_name || 'campus venue'}. Manage attendee rosters and confirmed registrations.`,
        ctaLabel: 'Open Attendee Roster',
        ctaLink: `/club/events/${nextEvt.id}/registrations`,
        badge: isOngoing ? 'Live Now' : 'Upcoming Soon',
        badgeVariant: 'cyan' as const,
      }
    }

    const editableDraft = draftEvents.find((e) => hasEventPermission(e.id, 'events.edit', e.club_id))
    if (editableDraft) {
      const canPublishDraft = hasEventPermission(editableDraft.id, 'events.publish', editableDraft.club_id)
      return {
        type: 'draft_pending' as const,
        title: `Draft Ready for Review: "${editableDraft.title}"`,
        description: canPublishDraft
          ? 'Complete form configuration, custom questions, or publish this event to campus students.'
          : 'Complete form configuration and content details while an administrator prepares publication.',
        ctaLabel: canPublishDraft ? 'Edit & Publish' : 'Edit Draft',
        ctaLink: `/club/events/${editableDraft.id}/edit`,
        badge: 'Draft Saved',
        badgeVariant: 'purple' as const,
      }
    }

    if (canCreateEvents) {
      return {
        type: 'default' as const,
        title: 'Host Your Next Campus Experience',
        description: 'Create technical hackathons, cultural festivals, athletic tournaments, or seminars with structured registration and pass workflows.',
        ctaLabel: 'Create New Event',
        ctaLink: '/club/events/new',
        badge: 'Organizer Hub',
        badgeVariant: 'cyan' as const,
      }
    }

    if (canViewPayments) {
      return {
        type: 'pending_payment' as const,
        title: 'Payment Verification Workspace',
        description: 'Monitor transaction UTR proofs, fee receipts, and settlement status for paid campus events.',
        ctaLabel: 'Open Payments',
        ctaLink: '/club/payments',
        badge: 'Payments Desk',
        badgeVariant: 'cyan' as const,
      }
    }

    return {
      type: 'default' as const,
      title: `${clubName} Operations Workspace`,
      description: 'Review scheduled club events, assigned duties, and permitted club analytics.',
      ctaLabel: 'Browse Club Events',
      ctaLink: '/club/events',
      badge: 'Organizer Hub',
      badgeVariant: 'cyan' as const,
    }
  }, [
    canVerifyPayments,
    canViewPayments,
    canCreateEvents,
    pendingPaymentsCount,
    activePublishedEvents,
    draftEvents,
    now,
    clubName,
    hasEventPermission,
  ])

  if (!clubId && !loading) {
    return (
      <PageShell>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center justify-center text-center">
          <EmptyState
            icon={Building2}
            title="No Active Club Organization"
            description="You do not currently belong to an active club organization. When a club invites you to their team, you'll manage events, attendee rosters, and payment verification here."
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

  const renderManagedEventCard = (evt: EventRecord) => {
    const evtRegs = allRegistrations.filter((r) => r.event_id === evt.id)
    const evtConfirmed = evtRegs.filter((r) => r.status === 'confirmed').length
    const evtSeats = evtRegs.reduce((sum, r) => {
      if (r.status === 'cancelled' || r.status === 'rejected') return sum
      const details = (r as any).participant_details
      const seatCount =
        details?.seat_details?.total_seats ||
        details?.seat_allocations?.length ||
        (Array.isArray((r as any).team_members) && (r as any).team_members.length > 0
          ? (r as any).team_members.length
          : 1)
      return sum + Math.max(1, Number(seatCount) || 1)
    }, 0)
    const capacity = evt.capacity || 100
    const fillPct = Math.min(100, Math.round((evtSeats / capacity) * 100))
    const phase = getEventLifecyclePhase(evt)
    const badgeMeta = LIFECYCLE_BADGE_META[phase]
    const isArchive = phase === 'completed' || phase === 'cancelled'
    const eventTz = resolveEventTimezone(evt.timezone)
    const formattedDate = evt.start_date
      ? `${formatEventDate(evt.start_date, eventTz, { day: 'numeric', month: 'short' })} • ${formatEventTime(evt.start_date, eventTz, { hour: 'numeric', minute: '2-digit', hour12: true })}`
      : 'Schedule TBA'

    return (
      <div
        key={evt.id}
        className={`p-5 rounded-xl bg-white border transition-all flex flex-col justify-between gap-4 shadow-xs ${
          isArchive ? 'border-gray-200 opacity-90' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
        }`}
      >
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
              {evt.category}
            </span>
            <Badge
              variant={badgeMeta.variant}
              className="text-[10px]"
            >
              {badgeMeta.label}
            </Badge>
          </div>

          <h3 className="text-base font-bold font-heading text-gray-900 line-clamp-1">
            {evt.title}
          </h3>
          <p className="text-xs text-gray-600 flex items-center gap-1.5 mt-1 truncate">
            <Calendar size={12} className="text-blue-600 shrink-0" />
            {formattedDate}
          </p>
          <p className="text-xs text-gray-600 flex items-center gap-1.5 mt-1 truncate">
            <MapPin size={12} className="text-blue-600 shrink-0" />
            {evt.venue_name || 'Campus Venue'}
          </p>
        </div>

        {/* Capacity Fill Bar */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Confirmed Passes:</span>
            <span className="font-mono text-gray-900">
              <strong>{evtConfirmed}</strong> pass{evtConfirmed === 1 ? '' : 'es'} ({evtSeats} seats • {fillPct}%)
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full"
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>

        {/* Shortcuts Actions */}
        {(() => {
          const canViewEventRoster = hasEventPermission(evt.id, 'registrations.view', evt.club_id)
          const canViewEventReports = hasEventPermission(evt.id, 'reports.view', evt.club_id)
          const canEditEventCard = hasEventPermission(evt.id, 'events.edit', evt.club_id)
          const canOpenFeedback = canViewEventReports || canEditEventCard

          return (
            <div className="flex items-center justify-between gap-1.5 pt-3 border-t border-gray-100 flex-wrap">
              {canViewEventRoster && (
                <Link to={`/club/events/${evt.id}/registrations`} className="flex-1">
                  <Button size="sm" variant="primary" leftIcon={<Users size={13} />} className="w-full text-xs">
                    Roster
                  </Button>
                </Link>
              )}

              {!isArchive && canAssignRoles && (
                <button
                  type="button"
                  onClick={() => setDelegationModalEvent(evt)}
                  className="p-2 rounded-lg bg-gray-100 hover:bg-indigo-50 text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer"
                  title="Staff Delegation"
                >
                  <ShieldCheck size={14} />
                </button>
              )}

              {canOpenFeedback && (
                <button
                  type="button"
                  onClick={() => setFeedbackModalEvent(evt)}
                  className="p-2 rounded-lg bg-gray-100 hover:bg-amber-50 text-amber-600 hover:text-amber-700 transition-colors cursor-pointer"
                  title="Feedback Reviews"
                >
                  <Star size={14} />
                </button>
              )}

              {canViewEventReports && (
                <Link to={`/club/events/${evt.id}/reports`}>
                  <button
                    type="button"
                    className="p-2 rounded-lg bg-gray-100 hover:bg-sky-50 text-sky-600 hover:text-sky-700 transition-colors cursor-pointer"
                    title="Event Reports & Analytics"
                  >
                    <BarChart3 size={14} />
                  </button>
                </Link>
              )}

              {canEditEventCard && (
                <Link to={`/club/events/${evt.id}/edit`}>
                  <button
                    type="button"
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
                    title={isArchive ? 'View Event Archive' : 'Edit Event Details'}
                  >
                    {isArchive ? <Archive size={14} /> : <Edit size={14} />}
                  </button>
                </Link>
              )}
            </div>
          )
        })()}
      </div>
    )
  }

  return (
    <PageShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-7 text-left">
        {loadError && (
          <Alert variant="error">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-sm">Unable to load complete organizer dashboard data</p>
                <p className="text-xs opacity-90">{loadError}</p>
              </div>
              <Button variant="outline" size="sm" onClick={loadClubData}>
                Retry
              </Button>
            </div>
          </Alert>
        )}

        {/* Top Header Card with Brand Identity & Shortcuts */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="relative rounded-2xl border border-gray-200 p-5 sm:p-6 md:p-8 flex flex-col gap-6 shadow-xs bg-white overflow-hidden"
        >
          {/* Row 1: Brand Identity & Primary CTA */}
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 sm:gap-5 min-w-0">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-blue-600 shrink-0 border border-blue-200 bg-blue-50">
                <Building2 size={30} className="sm:w-8 sm:h-8" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-gray-900 truncate">
                    {clubName}
                  </h1>
                  <Badge variant="indigo" className="flex items-center gap-1.5 shrink-0 text-[10px] sm:text-xs">
                    <ShieldCheck size={12} className="text-indigo-600" />
                    {activeClubRole ? ROLE_LABELS[activeClubRole] : 'Access Restricted'}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-600 flex-wrap font-sans">
                  <span>Lead: <strong className="text-gray-900">{repName}</strong></span>
                  {profile?.email && (
                    <>
                      <span className="text-gray-300">•</span>
                      <span className="text-gray-500 truncate max-w-[220px]">
                        {profile.email}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Primary Action Button */}
            {canCreateEvents && (
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                <Link to="/club/events/new" className="w-full sm:w-auto shrink-0">
                  <Button variant="primary" size="sm" leftIcon={<Plus size={15} />} className="w-full sm:w-auto min-h-[44px] justify-center whitespace-nowrap font-semibold">
                    Create Event
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Quick Actions Grid (sm:hidden) */}
          <div className="sm:hidden grid grid-cols-2 gap-2 pt-3 border-t border-gray-200">
            {canViewPayments && (
              <Link to="/club/payments" className="w-full">
                <Button
                  variant={pendingPaymentsCount > 0 ? 'primary' : 'outline'}
                  size="sm"
                  leftIcon={<CreditCard size={15} />}
                  className="w-full min-h-[44px] justify-center text-xs"
                >
                  Payments {pendingPaymentsCount > 0 && `(${pendingPaymentsCount})`}
                </Button>
              </Link>
            )}
            <Link to="/club/events" className="w-full">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Calendar size={15} />}
                className="w-full min-h-[44px] justify-center text-xs"
              >
                Events ({activePublishedCount})
              </Button>
            </Link>
            {canManageCoupons && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCouponsModalOpen(true)}
                leftIcon={<Tag size={14} className="text-amber-600" />}
                className="w-full min-h-[44px] justify-center text-xs"
              >
                Coupons
              </Button>
            )}
            {canManageClub && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBrandingModalOpen(true)}
                leftIcon={<Sparkles size={14} className="text-blue-600" />}
                className="w-full min-h-[44px] justify-center text-xs"
              >
                Brand & Profile
              </Button>
            )}
          </div>

          {/* Row 2: Comprehensive Action Toolbar with Responsive Wrapping (Desktop) */}
          <div className="hidden sm:flex relative flex-wrap items-center justify-between gap-2.5 pt-4 border-t border-gray-200 w-full">
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              {canViewPayments && (
                <Link to="/club/payments" className="shrink-0">
                  <Button
                    variant={pendingPaymentsCount > 0 ? 'primary' : 'outline'}
                    size="sm"
                    leftIcon={<CreditCard size={15} />}
                    className="whitespace-nowrap"
                  >
                    Payments
                    {pendingPaymentsCount > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-400 text-gray-900 text-[10px] font-bold">
                        {pendingPaymentsCount}
                      </span>
                    )}
                  </Button>
                </Link>
              )}

              {/* Coupons Shortcut */}
              {canManageCoupons && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCouponsModalOpen(true)}
                  leftIcon={<Tag size={14} className="text-amber-600" />}
                  className="shrink-0 whitespace-nowrap"
                >
                  Coupons
                </Button>
              )}

              {/* Brand & Identity Customizer */}
              {canManageClub && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBrandingModalOpen(true)}
                  leftIcon={<Sparkles size={14} className="text-blue-600" />}
                  className="shrink-0 whitespace-nowrap"
                >
                  Brand & Profile
                </Button>
              )}

              {canViewMembers && (
                <Link to="/club/members" className="shrink-0">
                  <Button variant="outline" size="sm" leftIcon={<Users size={15} />} className="whitespace-nowrap">
                    Team Roster
                  </Button>
                </Link>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              {canManageSettings && (
                <Link to="/club/settings" className="shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Settings size={14} className="text-gray-500" />}
                    className="whitespace-nowrap"
                  >
                    Settings
                  </Button>
                </Link>
              )}

              {isDualEligible && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => switchWorkspace('student', navigate)}
                  className="text-gray-700 hover:text-gray-900 shrink-0 whitespace-nowrap"
                  leftIcon={<GraduationCap size={15} />}
                >
                  Student Space
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => signOut()}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-200 shrink-0 whitespace-nowrap"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </motion.div>

        {/* ── Pending Tasks & Actionable Items ───────────────────────────────── */}
        {(() => {
          const showPendingPaymentsTask = canVerifyPayments && pendingPaymentsCount > 0
          const showPendingCancellationsTask = canManageRegistrationsClub && pendingCancellationsCount > 0
          const showDraftsTask = canEditAnyEvent && draftCount > 0
          if (!showPendingPaymentsTask && !showPendingCancellationsTask && !showDraftsTask) {
            return null
          }
          const taskCategoryCount =
            (showPendingPaymentsTask ? 1 : 0) +
            (showPendingCancellationsTask ? 1 : 0) +
            (showDraftsTask ? 1 : 0)

          return (
            <div className="p-4 sm:p-5 rounded-xl bg-amber-50 border border-amber-200 flex flex-col gap-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-bold tracking-wider text-amber-800 flex items-center gap-1.5">
                  <AlertTriangle size={15} className="text-amber-600" /> Action Items Requiring Attention
                </span>
                <span className="text-[11px] font-mono text-amber-700">
                  {taskCategoryCount} pending task categories
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {showPendingPaymentsTask && (
                  <Link to="/club/payments" className="flex-1 sm:flex-initial">
                    <div className="p-3 rounded-xl bg-white border border-amber-200 hover:border-amber-400 flex items-center justify-between gap-3 text-xs transition-colors shadow-xs">
                      <div className="flex items-center gap-2">
                        <CreditCard size={16} className="text-amber-600 shrink-0" />
                        <span className="text-gray-900 font-semibold">
                          {pendingPaymentsCount} Payment{pendingPaymentsCount > 1 ? 's' : ''} Awaiting Review
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0">
                        Verify UTR →
                      </span>
                    </div>
                  </Link>
                )}

                {showPendingCancellationsTask && (
                  <Link to="/club/events" className="flex-1 sm:flex-initial">
                    <div className="p-3 rounded-xl bg-white border border-rose-200 hover:border-rose-400 flex items-center justify-between gap-3 text-xs transition-colors shadow-xs">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-rose-600 shrink-0" />
                        <span className="text-gray-900 font-semibold">
                          {pendingCancellationsCount} Cancellation Request{pendingCancellationsCount > 1 ? 's' : ''}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 shrink-0">
                        Review →
                      </span>
                    </div>
                  </Link>
                )}

                {showDraftsTask && (
                  <Link to="/club/events" className="flex-1 sm:flex-initial">
                    <div className="p-3 rounded-xl bg-white border border-indigo-200 hover:border-indigo-400 flex items-center justify-between gap-3 text-xs transition-colors shadow-xs">
                      <div className="flex items-center gap-2">
                        <Layers size={16} className="text-indigo-600 shrink-0" />
                        <span className="text-gray-900 font-semibold">
                          {draftCount} Draft Event{draftCount > 1 ? 's' : ''} Unpublished
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 shrink-0">
                        Review →
                      </span>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          )
        })()}

        {/* ── Spotlight Next Action Banner ─────────────────────────────────── */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="relative rounded-xl overflow-hidden p-5 sm:p-6 border transition-all shadow-xs bg-white border-gray-200"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div
                className={`p-3 rounded-xl shrink-0 border ${
                  organizerNextAction.type === 'pending_payment'
                    ? 'bg-amber-50 border-amber-200 text-amber-600'
                    : 'bg-blue-50 border-blue-200 text-blue-600'
                }`}
              >
                {organizerNextAction.type === 'pending_payment' ? (
                  <CreditCard size={22} />
                ) : organizerNextAction.type === 'event_active' ? (
                  <Users size={22} />
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
                <h2 className="text-base sm:text-lg font-bold font-heading text-gray-900">
                  {organizerNextAction.title}
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5 max-w-2xl leading-relaxed font-sans">
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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-white border border-gray-200 shadow-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
            <span className="text-[11px] font-semibold text-gray-500 flex items-center gap-1 mr-1">
              <Filter size={12} /> Timeframe:
            </span>
            {(['all', 'today', '7d', '30d'] as const).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all capitalize cursor-pointer ${
                  dateRange === range
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {range === 'all' ? 'All Time' : range === 'today' ? 'Today' : `Last ${range.toUpperCase()}`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">Filter Event:</span>
            <select
              value={selectedEventFilter}
              onChange={(e) => setSelectedEventFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-blue-600"
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
              subtitle: `${confirmedCount} confirmed registrations`,
              icon: Users,
              color: 'text-blue-600',
              badgeStyle: 'bg-blue-50 border-blue-200 text-blue-600',
            },
            {
              label: 'Completed Events',
              value: loading ? '…' : completedEvents.length.toString(),
              subtitle:
                cancelledEvents.length > 0
                  ? `${cancelledEvents.length} cancelled also archived`
                  : 'Concluded event records',
              icon: Archive,
              color: 'text-emerald-600',
              badgeStyle: 'bg-emerald-50 border-emerald-200 text-emerald-600',
              link: '/club/events',
            },
            ...(canViewPayments
              ? [
                  {
                    label: 'Pending Fee Reviews',
                    value: loading ? '…' : pendingPaymentsCount.toString(),
                    subtitle: 'UTR proofs awaiting verification',
                    icon: CreditCard,
                    color: 'text-amber-600',
                    badgeStyle: 'bg-amber-50 border-amber-200 text-amber-600',
                    link: '/club/payments',
                    highlight: pendingPaymentsCount > 0,
                  },
                  {
                    label: 'Verified Gross Fees',
                    value: loading ? '…' : `₹${grossVerifiedRevenue.toLocaleString()}`,
                    subtitle: `${approvedPayments.length} verified transactions`,
                    icon: TrendingUp,
                    color: 'text-emerald-600',
                    badgeStyle: 'bg-emerald-50 border-emerald-200 text-emerald-600',
                    link: '/club/payments',
                  },
                ]
              : []),
            {
              label: 'Active & Upcoming',
              value: loading ? '…' : activePublishedCount.toString(),
              subtitle: `${liveEvents.length} live now • ${upcomingEventsList.length} upcoming`,
              icon: Calendar,
              color: 'text-blue-600',
              badgeStyle: 'bg-blue-50 border-blue-200 text-blue-600',
              link: '/club/events',
            },
            {
              label: 'Draft Events',
              value: loading ? '…' : draftCount.toString(),
              subtitle: 'Pending publication review',
              icon: Layers,
              color: 'text-indigo-600',
              badgeStyle: 'bg-indigo-50 border-indigo-200 text-indigo-600',
            },
            {
              label: 'Capacity Fill Rate',
              value: loading ? '…' : `${capacityUtilization}%`,
              subtitle: `${totalSeatsOccupied} of ${totalCapacity} total seats`,
              icon: BarChart3,
              color: 'text-sky-600',
              badgeStyle: 'bg-sky-50 border-sky-200 text-sky-600',
            },
            {
              label: 'Upcoming Scheduled',
              value: loading ? '…' : upcomingEventsList.length.toString(),
              subtitle: upcomingEventsList[0]
                ? `Next: ${upcomingEventsList[0].title}`
                : 'No upcoming dates scheduled',
              icon: Clock,
              color: 'text-gray-700',
              badgeStyle: 'bg-gray-100 border-gray-200 text-gray-600',
            },
          ].map((stat, i) => {
            const Icon = stat.icon
            const cardContent = (
              <motion.div variants={metricItem} className="h-full">
                <div
                  className={`p-4 sm:p-5 rounded-xl bg-white border flex flex-col justify-between gap-3 h-full transition-all duration-200 shadow-xs ${
                    stat.highlight
                      ? 'border-amber-300 bg-amber-50/40'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 font-medium font-sans">
                      {stat.label}
                    </span>
                    <div className={`p-2 rounded-lg border ${stat.badgeStyle}`}>
                      <Icon size={16} />
                    </div>
                  </div>

                  <div>
                    <span
                      className={`text-2xl sm:text-3xl font-extrabold font-heading font-mono ${
                        stat.highlight ? 'text-amber-700' : 'text-gray-900'
                      }`}
                    >
                      {stat.value}
                    </span>
                    <span className="text-[11px] text-gray-500 block mt-0.5 truncate font-sans">
                      {stat.subtitle}
                    </span>
                  </div>
                </div>
              </motion.div>
            )

            return stat.link ? (
              <Link to={stat.link} key={i} className={`${!showAllMetrics && i >= 4 ? 'hidden sm:block' : 'block'} h-full`}>
                {cardContent}
              </Link>
            ) : (
              <div key={i} className={`${!showAllMetrics && i >= 4 ? 'hidden sm:block' : 'block'} h-full`}>
                {cardContent}
              </div>
            )
          })}
        </motion.div>

        {/* Toggle secondary metrics on mobile */}
        <div className="sm:hidden flex justify-center -mt-2">
          <button
            type="button"
            onClick={() => setShowAllMetrics(!showAllMetrics)}
            className="px-3.5 py-1.5 rounded-full bg-white border border-gray-200 text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <span>{showAllMetrics ? 'Show Fewer Statistics' : 'Show All Statistics (+4 more)'}</span>
            <ChevronDown size={14} className={`transition-transform duration-200 ${showAllMetrics ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* ── Live Analytics & Velocity Trends (Part 3) ────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Daily Registration Velocity Chart */}
          <div className="lg:col-span-8 p-5 sm:p-6 rounded-xl bg-white border border-gray-200 flex flex-col justify-between gap-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold font-heading text-gray-900 flex items-center gap-2">
                  <Activity size={18} className="text-blue-600" />
                  Registration Velocity (Last 14 Days)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Daily incoming student registrations across active club experiences
                </p>
              </div>
              <Badge variant="info" className="font-mono text-xs">
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
                    <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 border border-gray-800 px-2 py-0.5 rounded text-[10px] text-white font-mono whitespace-nowrap pointer-events-none z-10 shadow-md">
                      {item.count} passes ({item.dateStr})
                    </div>

                    <div
                      className="w-full rounded-t-md bg-blue-600 group-hover:bg-blue-700 transition-all duration-300"
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-[9px] text-gray-500 font-mono truncate w-full text-center">
                      {item.dayLabel.split(' ')[1]}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs text-gray-500">
              <span>Updated in real-time from active registrations</span>
              <span className="text-blue-600 font-mono font-semibold">
                Total in window: {chartData.reduce((s, c) => s + c.count, 0)}
              </span>
            </div>
          </div>

          {/* Recent Live Activity Stream (Part 15) */}
          <div className="lg:col-span-4 p-5 sm:p-6 rounded-xl bg-white border border-gray-200 flex flex-col justify-between gap-4 shadow-xs">
            <div>
              <h3 className="text-base font-bold font-heading text-gray-900 flex items-center gap-2">
                <Clock size={16} className="text-indigo-600" />
                Recent Organizer Activity
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Real-time activity audit stream
              </p>
            </div>

            <div className="flex flex-col gap-2.5 max-h-56 overflow-y-auto pr-1">
              {recentActivities.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-500">
                  No recent activity recorded yet.
                </div>
              ) : (
                recentActivities.map((act) => (
                  <div
                    key={act.id}
                    className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-gray-900 block truncate">
                        {act.title}
                      </span>
                      <span className="text-[10px] text-gray-500 block truncate">
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

            {canViewMembers && (
              <Link to="/club/members" className="pt-2 border-t border-gray-100 text-center text-xs text-blue-600 font-medium hover:underline">
                Inspect Full Team & Audit Trail →
              </Link>
            )}
          </div>
        </div>

        {/* ── Managed Campus Events List ───────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-bold font-heading text-gray-900">
                Managed Campus Events
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Lifecycle tracking, registration rosters, reports, and attendee records for {clubName}
              </p>
            </div>

            {canCreateEvents && (
              <Link to="/club/events/new">
                <Button size="sm" variant="primary" leftIcon={<Plus size={14} />}>
                  Host Event
                </Button>
              </Link>
            )}
          </div>

          {events.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar touch-pan-x">
              {(['all', 'upcoming', 'ongoing', 'completed', 'draft', 'cancelled'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setEventLifecycleFilter(tab)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all shrink-0 min-h-[34px] flex items-center gap-1.5 cursor-pointer ${
                    eventLifecycleFilter === tab
                      ? 'bg-gray-900 text-white font-semibold shadow-xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <span>{DASHBOARD_LIFECYCLE_LABELS[tab]}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                      eventLifecycleFilter === tab
                        ? 'bg-white text-gray-900 font-bold'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {lifecycleTabCounts[tab]}
                  </span>
                </button>
              ))}
            </div>
          )}

          {events.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No Events Created Yet"
              description="Start organizing campus hackathons, cultural festivals, athletic tournaments, or seminars with structured registration and pass workflows."
              action={
                canCreateEvents ? (
                  <Link to="/club/events/new">
                    <Button variant="primary" size="sm" leftIcon={<Plus size={15} />}>
                      Create First Event
                    </Button>
                  </Link>
                ) : undefined
              }
            />
          ) : displayedManagedEvents.length === 0 ? (
            <div className="p-8 rounded-xl bg-white border border-gray-200 text-center flex flex-col items-center gap-3 shadow-xs">
              <p className="text-sm text-gray-700 font-medium">
                No events currently in the {DASHBOARD_LIFECYCLE_LABELS[eventLifecycleFilter]} category.
              </p>
              <Button size="sm" variant="outline" onClick={() => setEventLifecycleFilter('all')}>
                Show All Events
              </Button>
            </div>
          ) : eventLifecycleFilter === 'all' ? (
            <div className="flex flex-col gap-6">
              {/* Active & Upcoming Events */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold font-heading text-gray-900 uppercase tracking-wider">
                      Active & Upcoming Events
                    </h3>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-mono font-semibold">
                      {activeAndUpcomingEvents.length}
                    </span>
                  </div>
                </div>
                {activeAndUpcomingEvents.length === 0 ? (
                  <div className="p-6 rounded-xl bg-white border border-gray-200 text-xs text-gray-500 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span>No active upcoming, ongoing, or draft events right now.</span>
                    {canCreateEvents && (
                      <Link to="/club/events/new">
                        <Button size="sm" variant="outline" leftIcon={<Plus size={13} />}>
                          Create New Event
                        </Button>
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeAndUpcomingEvents.map(renderManagedEventCard)}
                  </div>
                )}
              </div>

              {/* Completed Events History — Clearly separated from upcoming events */}
              {completedHistoryEvents.length > 0 && (
                <div className="flex flex-col gap-3 pt-4 border-t border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold font-heading text-gray-700 uppercase tracking-wider">
                        Completed Events History
                      </h3>
                      <Badge variant="neutral" className="text-[10px]">
                        {completedHistoryEvents.length} Completed
                      </Badge>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      Concluded events preserved with registration rosters, payments, feedback, and reports.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {completedHistoryEvents.map(renderManagedEventCard)}
                  </div>
                </div>
              )}

              {/* Cancelled Events — Kept separate from completed history */}
              {cancelledHistoryEvents.length > 0 && (
                <div className="flex flex-col gap-3 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold font-heading text-rose-700 uppercase tracking-wider">
                      Cancelled Events
                    </h3>
                    <Badge variant="danger" className="text-[10px]">
                      {cancelledHistoryEvents.length} Cancelled
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cancelledHistoryEvents.map(renderManagedEventCard)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedManagedEvents.map(renderManagedEventCard)}
            </div>
          )}
        </div>

        {/* ── Modals: Coupons, Brand Customization, Delegation, Feedback ─ */}
        {canManageCoupons && (
          <ClubCouponsModal
            isOpen={couponsModalOpen}
            onClose={() => setCouponsModalOpen(false)}
            clubId={clubId}
          />
        )}

        {canManageClub && (
          <ClubBrandingModal
            isOpen={brandingModalOpen}
            onClose={() => setBrandingModalOpen(false)}
            clubId={clubId}
            onUpdated={loadClubData}
          />
        )}

        {delegationModalEvent && canAssignRoles && (
          <EventTeamDelegationModal
            isOpen={Boolean(delegationModalEvent)}
            onClose={() => setDelegationModalEvent(null)}
            eventId={delegationModalEvent.id}
            clubId={clubId}
            eventTitle={delegationModalEvent.title}
            currentUserId={profile?.id || ''}
            readOnly={
              getEventLifecyclePhase(delegationModalEvent) === 'completed' ||
              getEventLifecyclePhase(delegationModalEvent) === 'cancelled'
            }
          />
        )}

        {feedbackModalEvent &&
          (hasEventPermission(feedbackModalEvent.id, 'reports.view', feedbackModalEvent.club_id) ||
            hasEventPermission(feedbackModalEvent.id, 'events.edit', feedbackModalEvent.club_id)) && (
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
