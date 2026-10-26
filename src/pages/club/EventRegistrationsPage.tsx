import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import {
  Users,
  Search,
  CheckCircle2,
  Lock,
  AlertTriangle,
  QrCode,
  MapPin,
  ExternalLink,
  Info,
  CreditCard,
  FileSpreadsheet,
  Check,
  X,
  Clock,
} from 'lucide-react'
import { Button, Badge, Card } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { getEventById } from '@/lib/events'
import {
  getEventRegistrations,
  cancelRegistration,
  reviewRegistrationApplication,
} from '@/lib/registrations'
import { useAuth } from '@/context/AuthContext'
import { fadeIn, staggerContainer } from '@/lib/animations'
import type { EventRecord, RegistrationWithStudent, RegistrationStatus } from '@/types'

export default function EventRegistrationsPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()

  const [event, setEvent] = useState<EventRecord | null>(null)
  const [registrations, setRegistrations] = useState<RegistrationWithStudent[]>([])
  const [loading, setLoading] = useState(true)
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

    if (eventRes.event) setEvent(eventRes.event)
    if (regsRes.registrations) setRegistrations(regsRes.registrations)
  }

  useEffect(() => {
    loadData()
  }, [id, user])

  // Count metrics
  const confirmedCount = registrations.filter((r) => r.status === 'confirmed').length
  const pendingApprovalCount = registrations.filter((r) => r.status === 'pending_approval').length
  const pendingPaymentCount = registrations.filter((r) => r.status === 'pending_payment').length
  const cancelledCount = registrations.filter((r) => r.status === 'cancelled' || r.status === 'rejected').length

  const filteredRegistrations = useMemo(() => {
    return registrations.filter((r) => {
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter
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
      <div className="min-h-screen pt-32 flex flex-col items-center justify-center bg-[var(--color-surface-0)]">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--color-surface-3)] border-t-[var(--color-brand-purple)] animate-spin mb-3" />
        <span className="text-xs text-[var(--color-text-muted)]">
          Loading event registration roster…
        </span>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen pt-32 px-4 flex flex-col items-center justify-center bg-[var(--color-surface-0)] text-center">
        <AlertTriangle size={36} className="text-rose-400 mb-3" />
        <h2 className="text-xl font-bold font-display text-[var(--color-text-primary)] mb-2">
          Event Not Found
        </h2>
        <Link to="/club/events">
          <Button variant="primary" size="md">
            Return to Events
          </Button>
        </Link>
      </div>
    )
  }

  const fillPercent = Math.min(Math.round((confirmedCount / event.capacity) * 100), 100)

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 text-left">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <Link to="/club/dashboard" className="hover:text-[var(--color-text-primary)]">
            Dashboard
          </Link>
          <span>/</span>
          <Link to="/club/events" className="hover:text-[var(--color-text-primary)]">
            My Events
          </Link>
          <span>/</span>
          <span className="text-[var(--color-text-primary)] font-medium truncate max-w-xs">
            {event.title}
          </span>
          <span>/</span>
          <span className="text-[var(--color-brand-purple)] font-medium">Registrations</span>
        </div>

        {/* Header Hero */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="glass p-4 sm:p-6 md:p-8 rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.1)] flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-xl relative overflow-hidden"
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
              <span className="text-xs text-[var(--color-text-muted)] font-mono truncate max-w-[200px]">
                /{event.slug}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-display text-[var(--color-text-primary)]">
              {event.title}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-1 flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1">
                <MapPin size={13} /> {event.venue_name}
              </span>
              <span>•</span>
              <span className="font-semibold text-[var(--color-text-primary)]">
                {event.is_free ? 'Free Event' : `₹${event.price} Ticket`}
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
                  className="w-full justify-center bg-[var(--color-brand-cyan)] hover:bg-cyan-400 text-black border-none font-semibold"
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
                  className="w-full justify-center bg-amber-500 hover:bg-amber-400 text-black border-none font-semibold"
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
              <Button variant="outline" size="sm" className="w-full justify-center">
                Edit
              </Button>
            </Link>
            <Link to={`/events/${event.slug}`} className="w-full sm:w-auto">
              <Button variant="ghost" size="sm" className="w-full justify-center" rightIcon={<ExternalLink size={13} />}>
                Public Page
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Paid Event Attendees Guidance */}
        {!event.is_free && (
          <div className="p-4 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-xs text-[var(--color-text-secondary)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Info size={18} className="shrink-0 mt-0.5 text-[var(--color-brand-cyan)]" />
              <div>
                <strong className="block font-semibold text-[var(--color-text-primary)] mb-0.5">
                  Fee-Based Registrations & Payment Verification
                </strong>
                Review attendee bank references and approve submitted payment receipts in the payments dashboard to activate their entry tickets.
              </div>
            </div>
            <Link to={`/club/payments?eventId=${event.id}`} className="shrink-0">
              <Button variant="outline" size="sm" rightIcon={<ExternalLink size={13} />}>
                Review Payments
              </Button>
            </Link>
          </div>
        )}

        {/* Temporary Alert Banner */}
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-3.5 rounded-xl text-xs flex items-center justify-between ${
              notice.isError
                ? 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {notice.isError ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
              <span>{notice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="hover:opacity-75"
            >
              ✕
            </button>
          </motion.div>
        )}

        {/* Stats Grid */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <Card className="p-5 flex flex-col justify-between">
            <span className="text-xs text-[var(--color-text-muted)] font-medium">
              Capacity Fill Rate
            </span>
            <div className="my-2">
              <span className="text-2xl font-bold font-display text-[var(--color-text-primary)]">
                {confirmedCount} / {event.capacity}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] ml-2">
                ({fillPercent}%)
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 w-full bg-[var(--color-surface-2)] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--color-brand-purple)] to-[var(--color-brand-pink)] rounded-full transition-all"
                style={{ width: `${fillPercent}%` }}
              />
            </div>
          </Card>

          <Card className="p-5 flex items-center justify-between">
            <div>
              <span className="text-xs text-[var(--color-text-muted)] font-medium block mb-1">
                Confirmed Passes
              </span>
              <span className="text-2xl font-bold font-display text-emerald-400">
                {confirmedCount}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[var(--color-surface-2)] text-emerald-400">
              <CheckCircle2 size={22} />
            </div>
          </Card>

          <Card className="p-5 flex items-center justify-between">
            <div>
              <span className="text-xs text-[var(--color-text-muted)] font-medium block mb-1">
                Host Review Required
              </span>
              <span className="text-2xl font-bold font-display text-[var(--color-brand-purple)]">
                {pendingApprovalCount}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-brand-purple)]">
              <Clock size={22} />
            </div>
          </Card>

          <Card className="p-5 flex items-center justify-between">
            <div>
              <span className="text-xs text-[var(--color-text-muted)] font-medium block mb-1">
                Payment Pending
              </span>
              <span className="text-2xl font-bold font-display text-amber-400">
                {pendingPaymentCount}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[var(--color-surface-2)] text-amber-400">
              <Lock size={22} />
            </div>
          </Card>
        </motion.div>

        {/* ── Attendee Table & Filters ────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-[var(--color-surface-1)] rounded-2xl border border-[var(--color-surface-3)]">
            {/* Status tabs */}
            <div className="flex items-center gap-1 overflow-x-auto text-xs">
              {(
                [
                  { key: 'all', label: `All (${registrations.length})` },
                  { key: 'pending_approval', label: `Review Needed (${pendingApprovalCount})` },
                  { key: 'confirmed', label: `Confirmed (${confirmedCount})` },
                  { key: 'pending_payment', label: `Payment (${pendingPaymentCount})` },
                  { key: 'cancelled', label: `Cancelled / Void (${cancelledCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key as any)}
                  className={`px-3 py-1.5 rounded-xl capitalize font-medium transition-all shrink-0 ${
                    statusFilter === tab.key
                      ? 'bg-[var(--color-brand-purple)] text-white shadow-sm'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full md:w-72">
              <input
                type="text"
                placeholder="Search attendee, team, or ticket code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3.5 py-1.5 pl-9 rounded-xl text-xs bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)] focus:border-[var(--color-brand-purple)] outline-none"
              />
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
              />
            </div>
          </div>

          {filteredRegistrations.length === 0 ? (
            <div className="py-16 text-center glass rounded-2xl border border-[var(--color-surface-3)] flex flex-col items-center">
              <Users size={32} className="text-[var(--color-text-muted)] mb-2" />
              <h3 className="font-bold text-sm text-[var(--color-text-primary)] mb-1">
                No registrations found
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {search || statusFilter !== 'all'
                  ? 'No attendees match your current search or filter.'
                  : 'No student registrations recorded yet for this event.'}
              </p>
            </div>
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
                    <Card key={reg.id} className="p-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-8 h-8 rounded-full bg-[var(--color-surface-3)] text-xs font-bold flex items-center justify-center text-[var(--color-brand-purple)] shrink-0">
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
                            Cancel
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
                        <th className="py-3.5 px-4 font-semibold">Attendee Name</th>
                        <th className="py-3.5 px-4 font-semibold">Contact Email</th>
                        <th className="py-3.5 px-4 font-semibold">Ticket Code</th>
                        <th className="py-3.5 px-4 font-semibold">Registration Date</th>
                        <th className="py-3.5 px-4 font-semibold">Pass Status</th>
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
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-[var(--color-surface-3)] text-[10px] font-bold flex items-center justify-center text-[var(--color-brand-purple)] shrink-0">
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
                                    className="text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] px-2 py-1 rounded hover:bg-[var(--color-surface-2)] transition-colors"
                                  >
                                    Details
                                  </button>
                                )}

                                {reg.status !== 'cancelled' && reg.status !== 'rejected' && (
                                  <button
                                    type="button"
                                    onClick={() => setCancellingAttendee(reg)}
                                    className="text-[11px] text-rose-400 hover:text-rose-300 font-medium px-2 py-1 transition-colors"
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

        {/* Application Details & Review Modal */}
        <AnimatePresence>
          {reviewingReg && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto"
            >
              <motion.div
                initial={{ scale: 0.95, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 12 }}
                className="w-full max-w-xl p-6 sm:p-7 rounded-3xl glass border border-[oklch(100%_0_0_/_0.15)] text-left flex flex-col gap-5 shadow-2xl relative my-8"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[var(--color-surface-3)]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-brand-purple)] to-[var(--color-brand-pink)] flex items-center justify-center text-white">
                      <Users size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold font-display text-[var(--color-text-primary)]">
                        {reviewingReg.status === 'pending_approval' ? 'Review Registration Application' : 'Application & Attendee Details'}
                      </h3>
                      <span className="text-xs text-[var(--color-text-muted)] font-mono">
                        Ticket Ref: {reviewingReg.ticket_code}
                      </span>
                    </div>
                  </div>

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
                <div className="p-4 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] space-y-2 text-xs">
                  <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block">
                    Applicant / Team Leader
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[var(--color-text-secondary)]">
                    <div>
                      <span className="text-[var(--color-text-muted)] block">Name:</span>
                      <strong className="text-[var(--color-text-primary)] font-medium">
                        {reviewingReg.student?.display_name || (reviewingReg.team_name ? `Team ${reviewingReg.team_name}` : 'Student Attendee')}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-muted)] block">Email:</span>
                      <strong className="text-[var(--color-text-primary)] font-medium">
                        {reviewingReg.student?.email || '—'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-muted)] block">Submission Date:</span>
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
                      <span className="text-[var(--color-text-muted)] block">Event Admission:</span>
                      <strong className={event.is_free ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                        {event.is_free ? 'Free Pass' : `₹${event.price} (Paid)`}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Team Details & Roster */}
                {reviewingReg.team_name && (
                  <div className="p-4 rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-surface-3)] space-y-3">
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
                  <div className="p-4 rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-surface-3)] space-y-2">
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

                {/* Review Action Controls (only for pending_approval) */}
                {reviewingReg.status === 'pending_approval' ? (
                  <div className="space-y-4 pt-2 border-t border-[var(--color-surface-3)]">
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
                        <span className="text-[var(--color-text-primary)] font-medium">
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
                        <span className="text-rose-300 font-medium">
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
                          placeholder="e.g. Prerequisites not met, invalid team size, or outside eligibility criteria…"
                          className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-rose-500/30 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-rose-400"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-2">
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
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-end pt-2 border-t border-[var(--color-surface-3)]">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setReviewingReg(null)}
                    >
                      Close Details
                    </Button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cancellation Confirmation Modal */}
        <AnimatePresence>
          {cancellingAttendee && (
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
                className="w-full max-w-md p-6 rounded-2xl glass border border-rose-500/30 text-left flex flex-col gap-4 shadow-2xl"
              >
                <div className="flex items-center gap-3 text-rose-400">
                  <div className="p-2.5 rounded-xl bg-rose-500/15">
                    <AlertTriangle size={24} />
                  </div>
                  <h3 className="text-lg font-bold font-display text-[var(--color-text-primary)]">
                    Cancel Attendee Pass?
                  </h3>
                </div>

                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Are you sure you want to cancel the registration for{' '}
                  <strong className="text-[var(--color-text-primary)]">
                    {cancellingAttendee.student?.display_name || (cancellingAttendee.team_name ? `Team ${cancellingAttendee.team_name}` : 'Attendee')}
                  </strong>{' '}
                  (Ticket: <code className="text-white">{cancellingAttendee.ticket_code}</code>)?
                  Their digital QR code will immediately be invalidated for gate entry.
                </p>

                <div className="flex items-center justify-end gap-3 pt-2">
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
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageShell>
  )
}
