import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import {
  Plus,
  Search,
  Calendar,
  MapPin,
  Users,
  Eye,
  Edit,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  QrCode,
  FileSpreadsheet,
} from 'lucide-react'
import { Button, Badge } from '@/components/ui'
import { listClubEvents, updateEvent } from '@/lib/events'
import { useAuth } from '@/context/AuthContext'
import { fadeIn, staggerContainer } from '@/lib/animations'
import type { EventRecord, EventStatus } from '@/types'

export default function ClubEventsListPage() {
  const { user, profile, clubProfile } = useAuth()

  const [events, setEvents] = useState<EventRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | EventStatus>('all')

  // Modal for cancellation confirmation
  const [cancellingEvent, setCancellingEvent] = useState<EventRecord | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [notice, setNotice] = useState<{ message: string; isError?: boolean } | null>(null)

  const clubName = clubProfile?.club_name || profile?.display_name || 'My Club'

  const loadEvents = async () => {
    setLoading(true)
    const clubId = user?.id || 'demo_club_member_default'
    const res = await listClubEvents(clubId)
    setLoading(false)
    if (res.events) {
      setEvents(res.events)
    }
  }

  useEffect(() => {
    loadEvents()
  }, [user])

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchesStatus = statusFilter === 'all' || e.status === statusFilter
      const q = search.trim().toLowerCase()
      const matchesSearch =
        q === '' ||
        e.title.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.venue_name.toLowerCase().includes(q)
      return matchesStatus && matchesSearch
    })
  }, [events, search, statusFilter])

  // Handle Publish Draft
  const handlePublish = async (event: EventRecord) => {
    setActionLoading(true)
    const res = await updateEvent(event.id, { status: 'published' })
    setActionLoading(false)
    if (res.error) {
      setNotice({ message: res.error, isError: true })
    } else {
      setNotice({ message: `"${event.title}" has been published to campus!`, isError: false })
      loadEvents()
    }
  }

  // Handle Cancel Event
  const confirmCancel = async () => {
    if (!cancellingEvent) return
    setActionLoading(true)
    const res = await updateEvent(cancellingEvent.id, { status: 'cancelled' })
    setActionLoading(false)
    setCancellingEvent(null)
    if (res.error) {
      setNotice({ message: res.error, isError: true })
    } else {
      setNotice({ message: `"${cancellingEvent.title}" has been cancelled.`, isError: false })
      loadEvents()
    }
  }

  const getStatusBadge = (status: EventStatus) => {
    switch (status) {
      case 'published':
        return <Badge variant="success">Published</Badge>
      case 'draft':
        return <Badge variant="amber">Draft</Badge>
      case 'cancelled':
        return <Badge variant="danger">Cancelled</Badge>
      case 'completed':
        return <Badge variant="outline">Completed</Badge>
    }
  }

  return (
    <div className="min-h-screen pt-28 pb-20 px-4 sm:px-6 lg:px-8 bg-[var(--color-surface-0)]">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        {/* Breadcrumb / Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-1">
              <Link to="/club/dashboard" className="hover:text-[var(--color-text-primary)]">
                Dashboard
              </Link>
              <span>/</span>
              <span className="text-[var(--color-text-primary)] font-medium">Events Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-[var(--color-text-primary)]">
              {clubName} Events
            </h1>
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
              Create, edit, publish, and manage registrations for all your club events
            </p>
          </div>

          <Link to="/club/events/new">
            <Button variant="primary" size="md" leftIcon={<Plus size={16} />}>
              Create New Event
            </Button>
          </Link>
        </div>

        {/* Temporary Alert Notice */}
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
              className="hover:opacity-75 transition-opacity"
            >
              ✕
            </button>
          </motion.div>
        )}

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-[var(--color-surface-1)] rounded-2xl border border-[var(--color-surface-3)]">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 text-xs">
            {(['all', 'published', 'draft', 'cancelled', 'completed'] as const).map((st) => (
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
                {st}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <input
              type="text"
              placeholder="Search your events…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3.5 py-1.5 pl-9 rounded-xl text-xs bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)] focus:border-[var(--color-brand-purple)] outline-none"
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          </div>
        </div>

        {/* Event List Content */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--color-surface-3)] border-t-[var(--color-brand-purple)] animate-spin mb-3" />
            <span className="text-xs text-[var(--color-text-muted)]">Loading club events…</span>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-16 px-4 glass rounded-2xl border border-[var(--color-surface-3)] text-center flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-surface-2)] flex items-center justify-center text-[var(--color-text-muted)] mb-3">
              <Calendar size={28} />
            </div>
            <h3 className="text-base font-bold font-display text-[var(--color-text-primary)] mb-1">
              No events found
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mb-5">
              {search || statusFilter !== 'all'
                ? 'No events match your current filter criteria. Try clearing search filters.'
                : 'Your club has not published or drafted any events yet.'}
            </p>
            <Link to="/club/events/new">
              <Button variant="primary" size="sm" leftIcon={<Plus size={15} />}>
                Create Your First Event
              </Button>
            </Link>
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-3.5"
          >
            {filteredEvents.map((evt) => {
              const startDate = new Date(evt.start_date)
              const formattedDate = startDate.toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
              const formattedTime = startDate.toLocaleTimeString('en-IN', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })

              return (
                <motion.div
                  key={evt.id}
                  variants={fadeIn}
                  className="glass p-4 sm:p-5 rounded-2xl border border-[oklch(100%_0_0_/_0.08)] hover:border-[oklch(100%_0_0_/_0.15)] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                >
                  {/* Left: Poster thumbnail + Details */}
                  <div className="flex items-start sm:items-center gap-4">
                    <img
                      src={evt.poster_url || 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=200'}
                      alt={evt.title}
                      className="w-20 h-20 sm:w-24 sm:h-20 rounded-xl object-cover shrink-0 border border-[var(--color-surface-3)]"
                    />
                    <div className="flex flex-col gap-1 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(evt.status)}
                        <Badge variant="purple" className="capitalize text-[10px]">
                          {evt.category}
                        </Badge>
                        <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
                          /{evt.slug}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-[var(--color-text-primary)] hover:text-[var(--color-brand-purple)] transition-colors">
                        <Link to={`/events/${evt.slug}`}>{evt.title}</Link>
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
                        <span className="flex items-center gap-1">
                          <Calendar size={13} /> {formattedDate} at {formattedTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin size={13} /> {evt.venue_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={13} /> {evt.capacity} seats
                        </span>
                        <span className="font-medium text-[var(--color-text-secondary)]">
                          {evt.is_free ? 'Free' : `₹${evt.price}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    {/* View Attendees */}
                    <Link to={`/club/events/${evt.id}/registrations`} title="View registered attendees and passes">
                      <Button variant="ghost" size="sm" leftIcon={<Users size={14} />}>
                        Attendees
                      </Button>
                    </Link>

                    {/* Live Check-In for published events */}
                    {evt.status === 'published' && (
                      <Link to={`/club/events/${evt.id}/check-in`} title="Gate QR Scanner and live check-in">
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<QrCode size={14} />}
                          className="text-[var(--color-brand-cyan)] hover:text-cyan-300"
                        >
                          Check In
                        </Button>
                      </Link>
                    )}

                    {/* Reports and Exports */}
                    <Link to={`/club/events/${evt.id}/reports`} title="Download CSV reports and analytics">
                      <Button variant="ghost" size="sm" leftIcon={<FileSpreadsheet size={14} />}>
                        Reports
                      </Button>
                    </Link>

                    {/* Payments action for paid events */}
                    {!evt.is_free && (
                      <Link to={`/club/payments?eventId=${evt.id}`} title="Verify attendee UPI payments">
                        <Button variant="ghost" size="sm" leftIcon={<CreditCard size={14} />} className="text-amber-400 hover:text-amber-300">
                          Payments
                        </Button>
                      </Link>
                    )}

                    {/* Preview / Details */}
                    <Link to={`/events/${evt.slug}`} title="Preview public event details">
                      <Button variant="ghost" size="sm" leftIcon={<Eye size={14} />}>
                        Preview
                      </Button>
                    </Link>

                    {/* Edit */}
                    <Link to={`/club/events/${evt.id}/edit`} title="Edit event information">
                      <Button variant="outline" size="sm" leftIcon={<Edit size={14} />}>
                        Edit
                      </Button>
                    </Link>

                    {/* Publish draft action */}
                    {evt.status === 'draft' && (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={actionLoading}
                        onClick={() => handlePublish(evt)}
                        leftIcon={<CheckCircle2 size={14} />}
                      >
                        Publish
                      </Button>
                    )}

                    {/* Cancel action */}
                    {evt.status === 'published' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                        onClick={() => setCancellingEvent(evt)}
                        title="Cancel this published event"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}

        {/* Cancellation Confirmation Modal */}
        <AnimatePresence>
          {cancellingEvent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
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
                    Cancel Event?
                  </h3>
                </div>

                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Are you sure you want to cancel{' '}
                  <strong className="text-[var(--color-text-primary)] font-semibold">
                    "{cancellingEvent.title}"
                  </strong>
                  ? The event will immediately be flagged as cancelled for all students and public visitors.
                </p>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={actionLoading}
                    onClick={() => setCancellingEvent(null)}
                  >
                    Keep Event
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={actionLoading}
                    isLoading={actionLoading}
                    onClick={confirmCancel}
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
