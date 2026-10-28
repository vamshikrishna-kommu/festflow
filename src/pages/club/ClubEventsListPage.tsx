import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
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
  X,
} from 'lucide-react'
import { Button, Badge, PageHeader, Alert, Modal, ModalBody, ModalFooter, EmptyState } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { listClubEvents, updateEvent } from '@/lib/events'
import { useAuth } from '@/context/AuthContext'
import { fadeIn, staggerContainer } from '@/lib/animations'
import type { EventRecord, EventStatus } from '@/types'

export default function ClubEventsListPage() {
  const { user, profile, clubProfile, activeClubMembership, activeClubProfile } = useAuth()

  const [events, setEvents] = useState<EventRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | EventStatus>('all')

  // Modal for cancellation confirmation
  const [cancellingEvent, setCancellingEvent] = useState<EventRecord | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [notice, setNotice] = useState<{ message: string; isError?: boolean } | null>(null)

  const clubId = clubProfile?.profile_id || activeClubMembership?.club_id || user?.id || ''
  const clubName = clubProfile?.club_name || activeClubProfile?.club_name || profile?.display_name || 'My Club'

  const loadEvents = async () => {
    if (!clubId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const res = await listClubEvents(clubId)
    setLoading(false)
    if (res.events) {
      setEvents(res.events)
    }
  }

  useEffect(() => {
    loadEvents()
  }, [clubId])

  // Count summaries
  const statusCounts = useMemo(() => {
    return {
      all: events.length,
      published: events.filter((e) => e.status === 'published').length,
      draft: events.filter((e) => e.status === 'draft').length,
      cancelled: events.filter((e) => e.status === 'cancelled').length,
      completed: events.filter((e) => e.status === 'completed').length,
    }
  }, [events])

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
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 text-left">
        {/* Page Header */}
        <PageHeader
          breadcrumbs={[
            { label: 'Dashboard', href: '/club/dashboard' },
            { label: 'Events Management' },
          ]}
          title={`${clubName} Events`}
          subtitle="Create, edit, publish, and manage ticketing and attendance for all your organization listings"
          actions={
            <Link to="/club/events/new">
              <Button
                variant="primary"
                size="md"
                leftIcon={<Plus size={16} />}
                className="shine-on-hover"
              >
                Create New Event
              </Button>
            </Link>
          }
        />

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

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-[var(--color-surface-1)] rounded-2xl border border-[oklch(100%_0_0_/_0.08)] shadow-sm">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs no-scrollbar touch-pan-x">
            {(['all', 'published', 'draft', 'cancelled', 'completed'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 min-h-[36px] flex items-center gap-1.5 capitalize ${
                  statusFilter === st
                    ? 'bg-[var(--color-brand-purple)] text-white shadow-sm font-semibold'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]'
                }`}
              >
                <span>{st}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    statusFilter === st
                      ? 'bg-black/25 text-white'
                      : 'bg-[var(--color-surface-3)] text-[var(--color-text-muted)]'
                  }`}
                >
                  {statusCounts[st]}
                </span>
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
              className="w-full h-10 px-3.5 pl-9 pr-8 rounded-xl text-xs bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[oklch(100%_0_0_/_0.08)] focus:border-[var(--color-brand-purple)] outline-none"
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
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

        {/* Event List Content */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--color-surface-3)] border-t-[var(--color-brand-purple)] animate-spin mb-3" />
            <span className="text-xs text-[var(--color-text-muted)]">Loading club events…</span>
          </div>
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title={search || statusFilter !== 'all' ? 'No Matching Events' : 'No Events Found'}
            description={
              search || statusFilter !== 'all'
                ? 'No events match your current search or status filter. Try clearing your filters.'
                : 'Your organization has not published or drafted any events yet. Get started today!'
            }
            action={
              search || statusFilter !== 'all' ? (
                <Button variant="outline" size="sm" onClick={() => { setSearch(''); setStatusFilter('all') }}>
                  Clear Filters
                </Button>
              ) : (
                <Link to="/club/events/new">
                  <Button variant="primary" size="sm" leftIcon={<Plus size={15} />}>
                    Create Your First Event
                  </Button>
                </Link>
              )
            }
          />
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-3.5"
          >
            {filteredEvents.map((evt) => {
              const startDate = evt.start_date ? new Date(evt.start_date) : null
              const formattedDate = startDate
                ? startDate.toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Date TBA'
              const formattedTime = startDate
                ? startDate.toLocaleTimeString('en-IN', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })
                : 'Time TBA'

              return (
                <motion.div
                  key={evt.id}
                  variants={fadeIn}
                  className="glass p-4 sm:p-5 rounded-2xl border border-[oklch(100%_0_0_/_0.08)] hover:border-[oklch(100%_0_0_/_0.15)] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                >
                  {/* Left: Poster thumbnail + Details */}
                  <div className="flex items-start sm:items-center gap-4 min-w-0">
                    <img
                      src={evt.poster_url || 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=200'}
                      alt={evt.title}
                      className="w-20 h-20 sm:w-24 sm:h-20 rounded-xl object-cover shrink-0 border border-[var(--color-surface-3)]"
                    />
                    <div className="flex flex-col gap-1 text-left min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(evt.status)}
                        <Badge variant="purple" className="capitalize text-[10px]">
                          {evt.category}
                        </Badge>
                        {evt.participation_type === 'team' && (
                          <Badge variant="pink" className="text-[10px]">
                            Team
                          </Badge>
                        )}
                        <span className="text-[11px] text-[var(--color-text-muted)] font-mono truncate max-w-[160px]">
                          /{evt.slug}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-[var(--color-text-primary)] hover:text-[var(--color-brand-purple)] transition-colors truncate">
                        <Link to={`/events/${evt.slug}`}>{evt.title}</Link>
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-text-muted)]">
                        <span className="flex items-center gap-1">
                          <Calendar size={13} className="text-[var(--color-brand-cyan)]" /> {formattedDate} at {formattedTime}
                        </span>
                        <span className="flex items-center gap-1 truncate">
                          <MapPin size={13} className="text-[var(--color-brand-pink)]" /> {evt.venue_name || 'Venue TBA'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={13} /> {evt.capacity} seats
                        </span>
                        <span className="font-semibold text-[var(--color-text-secondary)]">
                          {evt.is_free ? 'Free' : `₹${evt.price}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-3 md:pt-0 border-t md:border-t-0 border-[var(--color-surface-3)] w-full md:w-auto justify-start md:justify-end shrink-0">
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
        <Modal
          isOpen={Boolean(cancellingEvent)}
          onClose={() => setCancellingEvent(null)}
          title="Cancel Published Event"
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
                    Cancel Event Listing
                  </h4>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    This closes registrations and invalidates unused entry passes.
                  </p>
                </div>
              </div>

              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mt-1">
                Are you sure you want to cancel{' '}
                <strong className="text-[var(--color-text-primary)] font-semibold">
                  "{cancellingEvent?.title}"
                </strong>
                ? The event will immediately be flagged as cancelled for all campus students and public visitors.
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
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
          </ModalFooter>
        </Modal>
      </div>
    </PageShell>
  )
}
