import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router'
import { motion } from 'motion/react'
import {
  Users,
  Search,
  AlertTriangle,
  QrCode,
  MapPin,
  CreditCard,
  FileSpreadsheet,
  Check,
  X,
} from 'lucide-react'
import { Button, Badge, Card, Breadcrumbs, Modal, ModalBody, ModalFooter, EmptyState, Alert } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { getEventById } from '@/lib/events'
import {
  getEventRegistrations,
  cancelRegistration,
  reviewRegistrationApplication,
} from '@/lib/registrations'
import { useAuth } from '@/context/AuthContext'
import { ResourceOwnerGuard } from '@/components/auth/ResourceOwnerGuard'
import { fadeIn, staggerContainer } from '@/lib/animations'
import type { EventRecord, RegistrationWithStudent, RegistrationStatus } from '@/types'

export default function EventRegistrationsPage() {
  const { id } = useParams<{ id: string }>()
  const { user, role } = useAuth()

  const [event, setEvent] = useState<EventRecord | null>(null)
  const [registrations, setRegistrations] = useState<RegistrationWithStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | RegistrationStatus>('all')

  // Review Application state
  const [reviewingReg, setReviewingReg] = useState<RegistrationWithStudent | null>(null)
  const [reviewDecision, setReviewDecision] = useState<'approved' | 'rejected'>('approved')
  const [rejectionReason, setRejectionReason] = useState('')
  const [isReviewing, setIsReviewing] = useState(false)

  // Cancel action modal
  const [cancellingAttendee, setCancellingAttendee] = useState<RegistrationWithStudent | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [notice, setNotice] = useState<{ message: string; isError?: boolean } | null>(null)

  const loadData = async () => {
    if (!id) return
    setLoading(true)
    const [eventRes, regsRes] = await Promise.all([
      getEventById(id),
      getEventRegistrations(id),
    ])
    setLoading(false)

    if (eventRes.event) {
      const authorized = (user && eventRes.event.club_id === user.id) || role === 'platform_admin'
      setIsAuthorized(authorized)
      if (authorized) {
        setEvent(eventRes.event)
        if (regsRes.registrations) setRegistrations(regsRes.registrations)
      }
    } else {
      setIsAuthorized(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id, user, role])

  // Count metrics
  const confirmedCount = registrations.filter((r) => r.status === 'confirmed').length
  const pendingApprovalCount = registrations.filter((r) => r.status === 'pending_approval').length
  const pendingPaymentCount = registrations.filter((r) => r.status === 'pending_payment').length
  const cancelledCount = registrations.filter((r) => r.status === 'cancelled' || r.status === 'rejected').length

  const filterCounts = useMemo(() => {
    return {
      all: registrations.length,
      confirmed: confirmedCount,
      pending_approval: pendingApprovalCount,
      pending_payment: pendingPaymentCount,
      cancelled: cancelledCount,
    }
  }, [registrations, confirmedCount, pendingApprovalCount, pendingPaymentCount, cancelledCount])

  const filteredRegistrations = useMemo(() => {
    return registrations.filter((r) => {
      let matchesStatus = false
      if (statusFilter === 'all') {
        matchesStatus = true
      } else if (statusFilter === 'cancelled') {
        matchesStatus = r.status === 'cancelled' || r.status === 'rejected'
      } else {
        matchesStatus = r.status === statusFilter
      }

      const q = search.trim().toLowerCase()
      const studentName = r.student?.display_name || (r.team_name ? `Team ${r.team_name}` : 'Student Attendee')
      const studentEmail = r.student?.email || ''
      const matchesSearch =
        q === '' ||
        studentName.toLowerCase().includes(q) ||
        studentEmail.toLowerCase().includes(q) ||
        (r.ticket_code && r.ticket_code.toLowerCase().includes(q)) ||
        Boolean(r.team_name && r.team_name.toLowerCase().includes(q))
      return matchesStatus && matchesSearch
    })
  }, [registrations, search, statusFilter])

  const handleReviewApplication = async () => {
    if (!reviewingReg) return
    setIsReviewing(true)
    const res = await reviewRegistrationApplication(
      reviewingReg.id,
      reviewDecision,
      reviewDecision === 'rejected' ? rejectionReason.trim() : undefined
    )
    setIsReviewing(false)
    setReviewingReg(null)
    setRejectionReason('')

    if (res.success) {
      setNotice({ message: res.message, isError: false })
      loadData()
    } else {
      setNotice({ message: res.message, isError: true })
    }
  }

  const handleOrganizerCancel = async () => {
    if (!cancellingAttendee) return
    setActionLoading(true)
    const res = await cancelRegistration(cancellingAttendee.id)
    setActionLoading(false)
    setCancellingAttendee(null)

    if (res.success) {
      const attendeeName = cancellingAttendee.student?.display_name || (cancellingAttendee.team_name ? `Team ${cancellingAttendee.team_name}` : 'Attendee')
      setNotice({
        message: `Registration for ${attendeeName} has been cancelled.`,
        isError: false,
      })
      loadData()
    } else {
      setNotice({ message: res.message, isError: true })
    }
  }

  if (loading) {
    return (
      <PageShell>
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--color-surface-3)] border-t-[var(--color-brand-purple)] animate-spin mb-3" />
          <span className="text-xs text-[var(--color-text-muted)]">
            Loading event registration roster…
          </span>
        </div>
      </PageShell>
    )
  }

  if (isAuthorized === false || !event) {
    return (
      <PageShell>
        <ResourceOwnerGuard
          isAuthorized={false}
          denialTitle="Event Authorization Required"
          denialMessage="Only the club organizing this event or authorized platform administrators can inspect registrations and attendee details."
          fallbackUrl="/club/events"
          fallbackLabel="Back to My Events"
        >
          <div />
        </ResourceOwnerGuard>
      </PageShell>
    )
  }

  const fillPercent = Math.min(Math.round((confirmedCount / event.capacity) * 100), 100)

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 text-left">
        {/* Navigation Breadcrumb */}
        <Breadcrumbs
          items={[
            { label: 'Dashboard', href: '/club/dashboard' },
            { label: 'My Events', href: '/club/events' },
            { label: event.title, href: `/events/${event.slug}` },
            { label: 'Registrations' },
          ]}
        />

        {/* Header Hero */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="glass p-5 sm:p-7 md:p-8 rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.1)] flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-xl relative overflow-hidden"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="purple" className="capitalize text-[10px]">
                {event.category}
              </Badge>
              <Badge
                variant={event.status === 'published' ? 'success' : 'amber'}
                className="capitalize text-[10px]"
              >
                {event.status}
              </Badge>
              {event.participation_type === 'team' && (
                <Badge variant="pink" className="text-[10px]">
                  Team Event
                </Badge>
              )}
              <span className="text-xs text-[var(--color-text-muted)] font-mono truncate max-w-[200px]">
                /{event.slug}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold font-display text-[var(--color-text-primary)]">
              {event.title}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-1 flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1">
                <MapPin size={13} /> {event.venue_name || 'Campus Venue'}
              </span>
              <span>•</span>
              <span className="font-semibold text-[var(--color-text-primary)]">
                {event.is_free ? 'Free Admission' : `₹${event.price} Ticket`}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap pt-2 md:pt-0 border-t md:border-t-0 border-[oklch(100%_0_0_/_0.06)]">
            {event.status === 'published' && (
              <Link to={`/club/events/${event.id}/check-in`} className="flex-1 sm:flex-initial">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<QrCode size={13} />}
                  className="w-full justify-center bg-[var(--color-brand-cyan)] hover:bg-cyan-400 text-black border-none font-semibold shadow-sm"
                >
                  Gate Check-In
                </Button>
              </Link>
            )}
            {!event.is_free && (
              <Link to={`/club/payments?eventId=${event.id}`} className="flex-1 sm:flex-initial">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<CreditCard size={13} />}
                  className="w-full justify-center bg-amber-500 hover:bg-amber-400 text-black border-none font-semibold shadow-sm"
                >
                  Payments
                </Button>
              </Link>
            )}
            <Link to={`/club/events/${event.id}/reports`} className="flex-1 sm:flex-initial">
              <Button variant="outline" size="sm" className="w-full justify-center" leftIcon={<FileSpreadsheet size={13} />}>
                Reports
              </Button>
            </Link>
            <Link to={`/club/events/${event.id}/edit`} className="flex-1 sm:flex-initial">
              <Button variant="ghost" size="sm" className="w-full justify-center">
                Edit Event
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Temporary Alert Notice */}
        {notice && (
          <Alert
            variant={notice.isError ? 'error' : 'success'}
            dismissible
            onDismiss={() => setNotice(null)}
          >
            {notice.message}
          </Alert>
        )}

        {/* Capacity & Registered Summary Grid */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
        >
          <Card className="p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-xs text-[var(--color-text-muted)] font-medium block mb-1">
              Confirmed Passes
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold font-display text-emerald-400">
                {confirmedCount}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] font-mono">
                / {event.capacity} seats ({fillPercent}%)
              </span>
            </div>
            <div className="w-full h-1 bg-[var(--color-surface-3)] rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${fillPercent}%` }}
              />
            </div>
          </Card>

          <Card className="p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-xs text-[var(--color-text-muted)] font-medium block mb-1">
              Under Host Review
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold font-display text-purple-400">
                {pendingApprovalCount}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {pendingApprovalCount > 0 ? 'Action required' : 'All clear'}
              </span>
            </div>
            <span className="text-[11px] text-[var(--color-text-muted)] mt-2">
              Requires manual decision
            </span>
          </Card>

          <Card className="p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-xs text-[var(--color-text-muted)] font-medium block mb-1">
              Payment Pending
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold font-display text-amber-400">
                {pendingPaymentCount}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                Awaiting student UTR
              </span>
            </div>
            <span className="text-[11px] text-[var(--color-text-muted)] mt-2">
              Holds seat reservation
            </span>
          </Card>

          <Card className="p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-xs text-[var(--color-text-muted)] font-medium block mb-1">
              Cancelled / Void
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold font-display text-rose-400">
                {cancelledCount}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                Seats returned
              </span>
            </div>
            <span className="text-[11px] text-[var(--color-text-muted)] mt-2">
              Revoked admission
            </span>
          </Card>
        </motion.div>

        {/* ── Attendee Table & Card List ───────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Controls: Search and Status Tabs */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-[var(--color-surface-1)] rounded-2xl border border-[oklch(100%_0_0_/_0.08)] shadow-sm">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs no-scrollbar touch-pan-x">
              {([
                { id: 'all', label: 'All Attendees', count: filterCounts.all },
                { id: 'confirmed', label: 'Confirmed', count: filterCounts.confirmed },
                { id: 'pending_approval', label: 'Under Review', count: filterCounts.pending_approval },
                { id: 'pending_payment', label: 'Payment Due', count: filterCounts.pending_payment },
                { id: 'cancelled', label: 'Cancelled', count: filterCounts.cancelled },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
                  className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 min-h-[36px] flex items-center gap-1.5 ${
                    statusFilter === tab.id
                      ? 'bg-[var(--color-brand-purple)] text-white shadow-sm font-semibold'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      statusFilter === tab.id
                        ? 'bg-black/25 text-white'
                        : 'bg-[var(--color-surface-3)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <input
                type="text"
                placeholder="Search attendee, team, or ticket code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 px-3.5 pl-9 pr-8 rounded-xl text-xs bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[oklch(100%_0_0_/_0.08)] focus:border-[var(--color-brand-purple)] outline-none"
              />
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {filteredRegistrations.length === 0 ? (
            <EmptyState
              icon={Users}
              title={search || statusFilter !== 'all' ? 'No Matching Attendees' : 'No Registrations Recorded'}
              description={
                search || statusFilter !== 'all'
                  ? 'No registered attendees match your current search or status filter.'
                  : 'No student registrations have been recorded yet for this event.'
              }
              action={
                search || statusFilter !== 'all' ? (
                  <Button variant="outline" size="sm" onClick={() => { setSearch(''); setStatusFilter('all') }}>
                    Clear Filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div>
              {/* Mobile Card List View (< md) */}
              <div className="flex flex-col gap-3 md:hidden">
                {filteredRegistrations.map((reg) => {
                  const regDate = new Date(reg.created_at)
                  const formattedRegDate = regDate.toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                  const isConfirmed = reg.status === 'confirmed'
                  const isPendingApproval = reg.status === 'pending_approval'
                  const isPendingPayment = reg.status === 'pending_payment'
                  const isRejected = reg.status === 'rejected'

                  return (
                    <Card key={reg.id} className="p-4 flex flex-col gap-3 border border-[oklch(100%_0_0_/_0.08)]">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-9 h-9 rounded-full bg-[var(--color-surface-3)] text-xs font-bold flex items-center justify-center text-[var(--color-brand-purple)] shrink-0">
                            {((reg.student?.display_name || reg.team_name || 'A').replace(/^Team\s+/i, '') || 'A').charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <span className="font-semibold text-sm text-[var(--color-text-primary)] block truncate">
                              {reg.student?.display_name || (reg.team_name ? `Team ${reg.team_name}` : 'Student Attendee')}
                            </span>
                            <span className="text-xs text-[var(--color-text-muted)] block truncate">
                              {reg.student?.email || 'No email registered'}
                            </span>
                          </div>
                        </div>

                        <Badge
                          variant={
                            isConfirmed
                              ? 'success'
                              : isPendingApproval
                              ? 'purple'
                              : isPendingPayment
                              ? 'amber'
                              : 'danger'
                          }
                          className="capitalize text-[10px] shrink-0"
                        >
                          {isConfirmed
                            ? 'Confirmed'
                            : isPendingApproval
                            ? 'Review Needed'
                            : isPendingPayment
                            ? 'Pending Payment'
                            : isRejected
                            ? 'Rejected'
                            : 'Cancelled'}
                        </Badge>
                      </div>

                      {reg.team_name && (
                        <div className="text-xs text-[var(--color-brand-purple)] flex items-center gap-1 font-medium bg-[var(--color-surface-2)] p-2 rounded-lg">
                          <Users size={12} className="shrink-0" />
                          <span className="truncate">Team: {reg.team_name}</span>
                          {Array.isArray((reg as any).team_members) && (reg as any).team_members.length > 0 && (
                            <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
                              ({(reg as any).team_members.length + 1} members)
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] pt-1">
                        <span className="flex items-center gap-1 font-mono text-[11px] text-[var(--color-brand-cyan)]">
                          <QrCode size={12} />
                          {reg.ticket_code}
                        </span>
                        <span>{formattedRegDate}</span>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-surface-3)]">
                        {isPendingApproval ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setReviewingReg(reg)
                              setReviewDecision('approved')
                              setRejectionReason('')
                            }}
                            className="flex-1 justify-center bg-[var(--color-brand-purple)] hover:bg-purple-600 text-white font-medium text-xs min-h-[40px]"
                          >
                            Review Application
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setReviewingReg(reg)
                              setReviewDecision('approved')
                              setRejectionReason('')
                            }}
                            className="flex-1 justify-center text-xs min-h-[40px]"
                          >
                            Details
                          </Button>
                        )}

                        {reg.status !== 'cancelled' && reg.status !== 'rejected' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCancellingAttendee(reg)}
                            className="text-xs text-rose-400 hover:text-rose-300 border-rose-500/20 min-h-[40px]"
                          >
                            Cancel Pass
                          </Button>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block glass rounded-2xl border border-[oklch(100%_0_0_/_0.08)] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--color-surface-3)] bg-[var(--color-surface-2)]/60 text-[var(--color-text-muted)] uppercase tracking-wider text-[10px]">
                        <th className="py-3.5 px-4 font-semibold">Attendee / Team</th>
                        <th className="py-3.5 px-4 font-semibold">Email</th>
                        <th className="py-3.5 px-4 font-semibold">Ticket Code</th>
                        <th className="py-3.5 px-4 font-semibold">Registered</th>
                        <th className="py-3.5 px-4 font-semibold">Status</th>
                        <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-surface-3)]">
                      {filteredRegistrations.map((reg) => {
                        const regDate = new Date(reg.created_at)
                        const formattedRegDate = regDate.toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })

                        const isConfirmed = reg.status === 'confirmed'
                        const isPendingApproval = reg.status === 'pending_approval'
                        const isPendingPayment = reg.status === 'pending_payment'
                        const isRejected = reg.status === 'rejected'

                        return (
                          <tr
                            key={reg.id}
                            className="hover:bg-[var(--color-surface-2)]/40 transition-colors"
                          >
                            <td className="py-3.5 px-4 font-medium text-[var(--color-text-primary)]">
                              <div className="flex items-center gap-2.5">
                                <span className="w-7 h-7 rounded-full bg-[var(--color-surface-3)] text-[10px] font-bold flex items-center justify-center text-[var(--color-brand-purple)] shrink-0">
                                  {((reg.student?.display_name || reg.team_name || 'A').replace(/^Team\s+/i, '') || 'A').charAt(0).toUpperCase()}
                                </span>
                                <div>
                                  <span className="font-semibold block">
                                    {reg.student?.display_name || (reg.team_name ? `Team ${reg.team_name}` : 'Student Attendee')}
                                  </span>
                                  {reg.team_name && (
                                    <div className="text-[11px] text-[var(--color-brand-purple)] flex items-center gap-1 font-normal">
                                      <Users size={11} />
                                      <span>Team: {reg.team_name}</span>
                                      {Array.isArray((reg as any).team_members) && (reg as any).team_members.length > 0 && (
                                        <span className="text-[10px] text-[var(--color-text-muted)]">
                                          ({(reg as any).team_members.length + 1} total)
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-[var(--color-text-secondary)]">
                              {reg.student?.email || '—'}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-[var(--color-text-primary)]">
                              <span className="flex items-center gap-1 text-[11px]">
                                <QrCode size={13} className="text-[var(--color-brand-cyan)]" />
                                {reg.ticket_code}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-[var(--color-text-muted)]">
                              {formattedRegDate}
                            </td>
                            <td className="py-3.5 px-4">
                              <Badge
                                variant={
                                  isConfirmed
                                    ? 'success'
                                    : isPendingApproval
                                    ? 'purple'
                                    : isPendingPayment
                                    ? 'amber'
                                    : 'danger'
                                }
                                className="capitalize text-[10px]"
                              >
                                {isConfirmed
                                  ? 'Confirmed'
                                  : isPendingApproval
                                  ? 'Review Needed'
                                  : isPendingPayment
                                  ? 'Pending Payment'
                                  : isRejected
                                  ? 'Rejected'
                                  : 'Cancelled'}
                              </Badge>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isPendingApproval ? (
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => {
                                      setReviewingReg(reg)
                                      setReviewDecision('approved')
                                      setRejectionReason('')
                                    }}
                                    className="bg-[var(--color-brand-purple)] hover:bg-purple-600 text-white font-medium text-[11px] py-1 px-2.5 h-auto"
                                  >
                                    Review
                                  </Button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReviewingReg(reg)
                                      setReviewDecision('approved')
                                      setRejectionReason('')
                                    }}
                                    className="text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] px-2.5 py-1 rounded-lg hover:bg-[var(--color-surface-2)] transition-colors"
                                  >
                                    Details
                                  </button>
                                )}

                                {reg.status !== 'cancelled' && reg.status !== 'rejected' && (
                                  <button
                                    type="button"
                                    onClick={() => setCancellingAttendee(reg)}
                                    className="text-[11px] text-rose-400 hover:text-rose-300 font-medium px-2 py-1 transition-colors hover:bg-rose-500/10 rounded-lg"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Modal: Application Details & Review ───────────────────────────── */}
        <Modal
          isOpen={Boolean(reviewingReg)}
          onClose={() => setReviewingReg(null)}
          title={reviewingReg?.status === 'pending_approval' ? 'Review Registration Application' : 'Application & Attendee Details'}
          size="md"
        >
          <ModalBody>
            {reviewingReg && (
              <div className="flex flex-col gap-4 text-left">
                {/* Header Sub-bar */}
                <div className="flex items-center justify-between pb-3 border-b border-[var(--color-surface-3)]">
                  <span className="text-xs font-mono text-[var(--color-text-muted)]">
                    Ticket Ref: <strong className="text-[var(--color-brand-cyan)]">{reviewingReg.ticket_code}</strong>
                  </span>
                  <Badge
                    variant={
                      reviewingReg.status === 'confirmed'
                        ? 'success'
                        : reviewingReg.status === 'pending_approval'
                        ? 'purple'
                        : reviewingReg.status === 'pending_payment'
                        ? 'amber'
                        : 'danger'
                    }
                    className="capitalize text-[10px]"
                  >
                    {reviewingReg.status === 'pending_approval' ? 'Needs Review' : reviewingReg.status.replace('_', ' ')}
                  </Badge>
                </div>

                {/* Primary Attendee Details */}
                <div className="p-4 rounded-2xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.06)] space-y-2 text-xs">
                  <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">
                    Applicant / Team Leader
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[var(--color-text-secondary)]">
                    <div>
                      <span className="text-[var(--color-text-muted)] block text-[11px]">Name:</span>
                      <strong className="text-[var(--color-text-primary)] font-semibold text-sm">
                        {reviewingReg.student?.display_name || (reviewingReg.team_name ? `Team ${reviewingReg.team_name}` : 'Student Attendee')}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-muted)] block text-[11px]">Email:</span>
                      <strong className="text-[var(--color-text-primary)] font-medium">
                        {reviewingReg.student?.email || '—'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-muted)] block text-[11px]">Submitted On:</span>
                      <strong className="text-[var(--color-text-primary)] font-medium">
                        {new Date(reviewingReg.created_at).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-muted)] block text-[11px]">Admission Fee:</span>
                      <strong className={event.is_free ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                        {event.is_free ? 'Free Pass' : `₹${event.price} (Paid)`}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Team Details & Roster */}
                {reviewingReg.team_name && (
                  <div className="p-4 rounded-2xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.06)] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-[var(--color-brand-purple)]" />
                        <h4 className="text-xs font-bold text-[var(--color-text-primary)]">
                          Team: {reviewingReg.team_name}
                        </h4>
                      </div>
                      <Badge variant="purple" className="text-[10px]">
                        {Array.isArray((reviewingReg as any).team_members) ? (reviewingReg as any).team_members.length + 1 : 1} Members
                      </Badge>
                    </div>

                    {/* Team Members List */}
                    {Array.isArray((reviewingReg as any).team_members) && (reviewingReg as any).team_members.length > 0 ? (
                      <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                        {(reviewingReg as any).team_members.map((member: any, mIdx: number) => (
                          <div
                            key={mIdx}
                            className="p-2.5 rounded-xl bg-[var(--color-surface-2)]/80 border border-[var(--color-surface-3)] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                          >
                            <div>
                              <strong className="text-[var(--color-text-primary)] font-semibold block">
                                {member.name}
                              </strong>
                              <span className="text-[var(--color-text-secondary)] text-[11px]">
                                {member.email}
                              </span>
                            </div>
                            <div className="text-[11px] text-[var(--color-text-muted)] sm:text-right">
                              {member.studentId && <div>ID: {member.studentId}</div>}
                              {member.college && <div>{member.college}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[var(--color-text-muted)] italic">
                        No additional team members listed.
                      </p>
                    )}
                  </div>
                )}

                {/* Custom Questionnaire Responses */}
                {reviewingReg.custom_responses && Object.keys(reviewingReg.custom_responses).length > 0 && (
                  <div className="p-4 rounded-2xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.06)] space-y-2">
                    <h4 className="text-xs font-bold text-[var(--color-text-primary)]">
                      Questionnaire Responses
                    </h4>
                    <div className="space-y-1.5 text-xs max-h-36 overflow-y-auto pr-1">
                      {Object.entries(reviewingReg.custom_responses).map(([k, v]) => (
                        <div key={k} className="p-2 rounded-lg bg-[var(--color-surface-2)]">
                          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider block font-semibold">
                            {k}
                          </span>
                          <span className="text-[var(--color-text-primary)] font-medium">
                            {typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rejection Note if already rejected */}
                {reviewingReg.status === 'rejected' && (reviewingReg as any).rejection_reason && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                    <strong className="block font-semibold mb-0.5">Rejection Reason:</strong>
                    {(reviewingReg as any).rejection_reason}
                  </div>
                )}

                {/* Review Controls for pending_approval */}
                {reviewingReg.status === 'pending_approval' && (
                  <div className="space-y-3 pt-3 border-t border-[var(--color-surface-3)]">
                    <div className="flex items-center gap-4 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="reviewDecision"
                          value="approved"
                          checked={reviewDecision === 'approved'}
                          onChange={() => setReviewDecision('approved')}
                          className="text-[var(--color-brand-purple)] focus:ring-[var(--color-brand-purple)]"
                        />
                        <span className="text-[var(--color-text-primary)] font-semibold">
                          Approve Application {event.is_free ? '(Issues Pass)' : '(Requests Payment)'}
                        </span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="reviewDecision"
                          value="rejected"
                          checked={reviewDecision === 'rejected'}
                          onChange={() => setReviewDecision('rejected')}
                          className="text-rose-500 focus:ring-rose-500"
                        />
                        <span className="text-rose-300 font-semibold">
                          Reject Application
                        </span>
                      </label>
                    </div>

                    {reviewDecision === 'rejected' && (
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-rose-300">
                          Rejection Reason (Shared with Student)
                        </label>
                        <textarea
                          rows={2}
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="e.g. Ineligible year of study, missing prerequisites, or team capacity not met…"
                          className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-rose-500/30 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-rose-400"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            {reviewingReg?.status === 'pending_approval' ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isReviewing}
                  onClick={() => setReviewingReg(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant={reviewDecision === 'approved' ? 'primary' : 'danger'}
                  size="sm"
                  disabled={isReviewing}
                  isLoading={isReviewing}
                  onClick={handleReviewApplication}
                  leftIcon={reviewDecision === 'approved' ? <Check size={14} /> : <X size={14} />}
                >
                  {reviewDecision === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReviewingReg(null)}
              >
                Close Details
              </Button>
            )}
          </ModalFooter>
        </Modal>

        {/* ── Modal: Cancellation Confirmation ────────────────────────────── */}
        <Modal
          isOpen={Boolean(cancellingAttendee)}
          onClose={() => setCancellingAttendee(null)}
          title="Cancel Attendee Pass"
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
                    Revoke Entry Pass
                  </h4>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    This invalidates the student's QR gate credential.
                  </p>
                </div>
              </div>

              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mt-1">
                Are you sure you want to cancel the registration for{' '}
                <strong className="text-[var(--color-text-primary)]">
                  {cancellingAttendee?.student?.display_name || (cancellingAttendee?.team_name ? `Team ${cancellingAttendee?.team_name}` : 'Attendee')}
                </strong>{' '}
                (Ticket Code: <code className="text-white font-mono">{cancellingAttendee?.ticket_code}</code>)?
                Their seat will be released and their QR token will be rejected at the gate desk.
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              size="sm"
              disabled={actionLoading}
              onClick={() => setCancellingAttendee(null)}
            >
              Keep Registration
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={actionLoading}
              isLoading={actionLoading}
              onClick={handleOrganizerCancel}
            >
              Confirm Cancellation
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    </PageShell>
  )
}
