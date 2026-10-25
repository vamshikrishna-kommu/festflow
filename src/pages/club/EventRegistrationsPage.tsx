import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import {
  Users,
  Search,
  CheckCircle2,
  Lock,
  XCircle,
  AlertTriangle,
  QrCode,
  MapPin,
  ExternalLink,
  Info,
  CreditCard,
  FileSpreadsheet,
} from 'lucide-react'
import { Button, Badge, Card } from '@/components/ui'
import { getEventById } from '@/lib/events'
import { getEventRegistrations, cancelRegistration } from '@/lib/registrations'
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
  const pendingCount = registrations.filter((r) => r.status === 'pending_payment').length
  const cancelledCount = registrations.filter((r) => r.status === 'cancelled').length

  const filteredRegistrations = useMemo(() => {
    return registrations.filter((r) => {
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter
      const q = search.trim().toLowerCase()
      const matchesSearch =
        q === '' ||
        r.student.display_name.toLowerCase().includes(q) ||
        r.student.email.toLowerCase().includes(q) ||
        r.ticket_code.toLowerCase().includes(q)
      return matchesStatus && matchesSearch
    })
  }, [registrations, search, statusFilter])

  const handleOrganizerCancel = async () => {
    if (!cancellingAttendee) return
    setActionLoading(true)
    const res = await cancelRegistration(cancellingAttendee.id)
    setActionLoading(false)
    setCancellingAttendee(null)

    if (res.success) {
      setNotice({
        message: `Registration for ${cancellingAttendee.student.display_name} has been cancelled.`,
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
    <div className="min-h-screen pt-28 pb-20 px-4 sm:px-6 lg:px-8 bg-[var(--color-surface-0)] text-left">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
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
          className="glass p-6 sm:p-8 rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.1)] flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl relative overflow-hidden"
        >
          <div>
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
              <span className="text-xs text-[var(--color-text-muted)] font-mono">
                /{event.slug}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold font-display text-[var(--color-text-primary)]">
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

          <div className="flex items-center gap-2.5">
            {event.status === 'published' && (
              <Link to={`/club/events/${event.id}/check-in`}>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<QrCode size={13} />}
                  className="bg-[var(--color-brand-cyan)] hover:bg-cyan-400 text-black border-none font-semibold"
                >
                  Gate Check-In
                </Button>
              </Link>
            )}
            {!event.is_free && (
              <Link to={`/club/payments?eventId=${event.id}`}>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<CreditCard size={13} />}
                  className="bg-amber-500 hover:bg-amber-400 text-black border-none font-semibold"
                >
                  Review Payments
                </Button>
              </Link>
            )}
            <Link to={`/club/events/${event.id}/reports`}>
              <Button variant="outline" size="sm" leftIcon={<FileSpreadsheet size={13} />}>
                Reports
              </Button>
            </Link>
            <Link to={`/club/events/${event.id}/edit`}>
              <Button variant="outline" size="sm">
                Edit Event
              </Button>
            </Link>
            <Link to={`/events/${event.slug}`}>
              <Button variant="ghost" size="sm" rightIcon={<ExternalLink size={13} />}>
                Public Page
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Phase 5 Notice: Payment collection */}
        {!event.is_free && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-3">
            <Info size={18} className="shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold mb-0.5">
                Paid Event Attendees Notice
              </strong>
              Payment verification and approval workflows belong to Phase 5. Organizers cannot manually mark paid registrations as paid or issue verified entry passes in Phase 4.
            </div>
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
                Pending Approval
              </span>
              <span className="text-2xl font-bold font-display text-amber-400">
                {pendingCount}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[var(--color-surface-2)] text-amber-400">
              <Lock size={22} />
            </div>
          </Card>

          <Card className="p-5 flex items-center justify-between">
            <div>
              <span className="text-xs text-[var(--color-text-muted)] font-medium block mb-1">
                Cancelled / Void
              </span>
              <span className="text-2xl font-bold font-display text-rose-400">
                {cancelledCount}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[var(--color-surface-2)] text-rose-400">
              <XCircle size={22} />
            </div>
          </Card>
        </motion.div>

        {/* ── Attendee Table & Filters ────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-[var(--color-surface-1)] rounded-2xl border border-[var(--color-surface-3)]">
            {/* Status tabs */}
            <div className="flex items-center gap-1 overflow-x-auto text-xs">
              {(['all', 'confirmed', 'pending_payment', 'cancelled'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl capitalize font-medium transition-all shrink-0 ${
                    statusFilter === st
                      ? 'bg-[var(--color-brand-purple)] text-white shadow-sm'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full md:w-72">
              <input
                type="text"
                placeholder="Search attendee or ticket code…"
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
            <div className="glass rounded-2xl border border-[oklch(100%_0_0_/_0.08)] overflow-hidden shadow-sm">
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
                      const isPending = reg.status === 'pending_payment'

                      return (
                        <tr
                          key={reg.id}
                          className="hover:bg-[var(--color-surface-2)]/40 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-medium text-[var(--color-text-primary)]">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-[var(--color-surface-3)] text-[10px] font-bold flex items-center justify-center text-[var(--color-brand-purple)]">
                                {reg.student.display_name.charAt(0).toUpperCase()}
                              </span>
                              <span>{reg.student.display_name}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-[var(--color-text-secondary)]">
                            {reg.student.email}
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
                                  : isPending
                                  ? 'amber'
                                  : 'danger'
                              }
                              className="capitalize text-[10px]"
                            >
                              {isConfirmed
                                ? 'Confirmed'
                                : isPending
                                ? 'Pending'
                                : 'Cancelled'}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {reg.status !== 'cancelled' && (
                              <button
                                type="button"
                                onClick={() => setCancellingAttendee(reg)}
                                className="text-[11px] text-rose-400 hover:text-rose-300 font-medium transition-colors"
                              >
                                Cancel Pass
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

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
                    {cancellingAttendee.student.display_name}
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
    </div>
  )
}
