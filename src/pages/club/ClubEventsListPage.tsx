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
  FileSpreadsheet,
  Archive,
  X,
} from 'lucide-react'
import { Button, Badge, PageHeader, Alert, Modal, ModalBody, ModalFooter, EmptyState } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import {
  listClubEvents,
  updateEvent,
  cancelEventByOrganizer,
  validateEventConfig,
  getEventLifecyclePhase,
  canClubMutateEvent,
  LIFECYCLE_BADGE_META,
  formatEventDate,
  formatEventTime,
  resolveEventTimezone,
} from '@/lib/events'
import { useAuth } from '@/context/AuthContext'
import { fadeIn, staggerContainer } from '@/lib/animations'
import type { EventRecord } from '@/types'

type LifecycleTab = 'all' | 'upcoming' | 'ongoing' | 'completed' | 'draft' | 'cancelled'

const LIFECYCLE_TAB_LABELS: Record<LifecycleTab, string> = {
  all: 'All',
  upcoming: 'Upcoming',
  ongoing: 'Live Now',
  completed: 'Completed',
  draft: 'Drafts',
  cancelled: 'Cancelled',
}

export default function ClubEventsListPage() {
  const {
    profile,
    clubProfile,
    activeClubId,
    activeClubMembership,
    activeClubProfile,
    activeClubRole,
    hasClubPermission,
    hasEventPermission,
    isRoleLoading,
    role,
  } = useAuth()

  const [events, setEvents] = useState<EventRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<LifecycleTab>('all')

  // Modal for cancellation confirmation
  const [cancellingEvent, setCancellingEvent] = useState<EventRecord | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [notice, setNotice] = useState<{ message: string; isError?: boolean } | null>(null)

  const clubId = activeClubId || ''
  const clubName =
    activeClubProfile?.club_name ||
    activeClubMembership?.club_name ||
    clubProfile?.club_name ||
    profile?.display_name ||
    'My Club'

  const canCreateEvents = hasClubPermission('events.create')

  const loadEvents = async () => {
    if (isRoleLoading) return
    if (!clubId) {
      setEvents([])
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
    if (!isRoleLoading) {
      loadEvents()
    }
  }, [clubId, isRoleLoading, activeClubRole])

  // Lifecycle counts (cancelled events are NEVER counted under completed)
  const statusCounts = useMemo(() => {
    const phases = events.map((e) => getEventLifecyclePhase(e))
    return {
      all: events.length,
      upcoming: phases.filter((p) => p === 'upcoming' || p === 'registration_closed').length,
      ongoing: phases.filter((p) => p === 'ongoing').length,
      completed: phases.filter((p) => p === 'completed').length,
      draft: phases.filter((p) => p === 'draft').length,
      cancelled: phases.filter((p) => p === 'cancelled').length,
    }
  }, [events])

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const phase = getEventLifecyclePhase(e)
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'upcoming'
          ? phase === 'upcoming' || phase === 'registration_closed'
          : phase === statusFilter)
      const q = search.trim().toLowerCase()
      const matchesSearch =
        q === '' ||
        e.title.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.venue_name.toLowerCase().includes(q)
      return matchesStatus && matchesSearch
    })
  }, [events, search, statusFilter])

  // Handle Publish Draft (validates config & blocks expired schedules)
  const handlePublish = async (event: EventRecord) => {
    if (!hasEventPermission(event.id, 'events.publish', event.club_id)) {
      setNotice({
        message: 'You do not have permission to publish events for this club.',
        isError: true,
      })
      return
    }
    const effectiveEndMs = event.end_date ? new Date(event.end_date).getTime() : new Date(event.start_date).getTime()
    if (!isNaN(effectiveEndMs) && effectiveEndMs <= Date.now()) {
      setNotice({
        message: `"${event.title}" has a past schedule date. Update its schedule before publishing.`,
        isError: true,
      })
      return
    }
    const validation = validateEventConfig(event, 'publish')
    if (!validation.isValid) {
      const firstErr = Object.values(validation.errors)[0] || 'Please complete all required fields before publishing.'
      setNotice({ message: firstErr, isError: true })
      return
    }
    setActionLoading(true)
    const res = await updateEvent(event.id, { status: 'published' }, event.club_id || clubId)
    setActionLoading(false)
    if (res.error) {
      setNotice({ message: res.error, isError: true })
    } else {
      setNotice({ message: `"${event.title}" has been published to campus!`, isError: false })
      loadEvents()
    }
  }

  // Handle Cancel Event cleanly via organizer cancellation RPC
  const confirmCancel = async () => {
    if (!cancellingEvent) return
    if (!hasEventPermission(cancellingEvent.id, 'events.cancel', cancellingEvent.club_id)) {
      setCancelError('You do not have permission to cancel this event.')
      return
    }
    if (!canClubMutateEvent(cancellingEvent)) {
      setCancelError('Completed or already cancelled events cannot be cancelled.')
      return
    }
    const cleanReason = cancelReason.trim()
    if (!cleanReason) {
      setCancelError('Please provide a reason for cancelling this event.')
      return
    }
    setActionLoading(true)
    setCancelError(null)
    const res = await cancelEventByOrganizer({
      eventId: cancellingEvent.id,
      cancellationReason: cleanReason,
    })
    setActionLoading(false)
    if (!res.success) {
      setCancelError(res.message || 'Failed to cancel event.')
    } else {
      const title = cancellingEvent.title
      setCancellingEvent(null)
      setCancelReason('')
      setNotice({ message: `"${title}" has been cancelled. ${res.message}`, isError: false })
      loadEvents()
    }
  }

  const getStatusBadge = (evt: EventRecord) => {
    const phase = getEventLifecyclePhase(evt)
    const meta = LIFECYCLE_BADGE_META[phase]
    return <Badge variant={meta.variant}>{meta.label}</Badge>
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
          subtitle="Create, edit, publish, and manage registrations, payments, and lifecycle archives for all your listings"
          actions={
            canCreateEvents ? (
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
            ) : undefined
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
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-[#0E0E12] rounded-2xl border border-white/[0.08] shadow-sm">
          {/* Lifecycle Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs no-scrollbar touch-pan-x">
            {(['all', 'upcoming', 'ongoing', 'completed', 'draft', 'cancelled'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 min-h-[36px] flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#242430] text-white shadow-sm font-semibold border border-white/10'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span>{LIFECYCLE_TAB_LABELS[st]}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    statusFilter === st
                      ? 'bg-[#18CFFC] text-white font-bold'
                      : 'bg-white/10 text-zinc-400'
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
              className="w-full h-10 px-3.5 pl-9 pr-8 rounded-xl text-xs bg-[#14141A] text-white border border-white/[0.08] focus:border-[#18CFFC] outline-none"
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white cursor-pointer"
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
              ) : canCreateEvents ? (
                <Link to="/club/events/new">
                  <Button variant="primary" size="sm" leftIcon={<Plus size={15} />}>
                    Create Your First Event
                  </Button>
                </Link>
              ) : undefined
            }
          />
        ) : (() => {
          const renderEventRow = (evt: (typeof filteredEvents)[number]) => {
            const eventTz = resolveEventTimezone(evt.timezone)
            const formattedDate = evt.start_date
              ? formatEventDate(evt.start_date, eventTz, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : 'Date TBA'
            const formattedTime = evt.start_date
              ? formatEventTime(evt.start_date, eventTz, {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })
              : 'Time TBA'
            const phase = getEventLifecyclePhase(evt)
            const isTerminal = phase === 'completed' || phase === 'cancelled'
            const canMutate = canClubMutateEvent(evt) || role === 'platform_admin'

            return (
              <motion.div
                key={evt.id}
                variants={fadeIn}
                className={`p-4 sm:p-5 rounded-2xl bg-[#0E0E12] border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm ${
                  isTerminal ? 'border-white/[0.05] opacity-90' : 'border-white/[0.08] hover:border-white/20'
                }`}
              >
                {/* Left: Poster thumbnail + Details */}
                <div className="flex items-start sm:items-center gap-4 min-w-0">
                  <img
                    src={evt.poster_url || 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=200'}
                    alt={evt.title}
                    className="w-20 h-20 sm:w-24 sm:h-20 rounded-xl object-cover shrink-0 border border-white/10"
                  />
                  <div className="flex flex-col gap-1 text-left min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getStatusBadge(evt)}
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-300">
                        {evt.category}
                      </span>
                      {evt.participation_type === 'team' && (
                        <Badge variant="pink" className="text-[10px]">
                          Team
                        </Badge>
                      )}
                      <span className="text-[11px] text-zinc-500 font-mono truncate max-w-[160px]">
                        /{evt.slug}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white hover:text-[#18CFFC] transition-colors truncate font-heading">
                      <Link to={`/events/${evt.slug}`}>{evt.title}</Link>
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400 font-sans">
                      <span className="flex items-center gap-1">
                        <Calendar size={13} className="text-[#18CFFC]" /> {formattedDate} at {formattedTime}
                      </span>
                      <span className="flex items-center gap-1 truncate">
                        <MapPin size={13} className="text-[#18CFFC]" /> {evt.venue_name || 'Venue TBA'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={13} /> {evt.capacity} seats
                      </span>
                      <span className="font-semibold text-white font-mono">
                        {evt.is_free ? 'Free' : `₹${evt.price}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                {(() => {
                  const canViewRoster = hasEventPermission(evt.id, 'registrations.view', evt.club_id)
                  const canViewReports = hasEventPermission(evt.id, 'reports.view', evt.club_id)
                  const canViewPayments = hasEventPermission(evt.id, 'payments.view', evt.club_id)
                  const canEditEvt = hasEventPermission(evt.id, 'events.edit', evt.club_id)
                  const canPublishEvt = hasEventPermission(evt.id, 'events.publish', evt.club_id)
                  const canCancelEvt = hasEventPermission(evt.id, 'events.cancel', evt.club_id)

                  return (
                    <div className="flex flex-wrap items-center gap-1.5 pt-3 md:pt-0 border-t md:border-t-0 border-white/[0.08] w-full md:w-auto justify-start md:justify-end shrink-0">
                      {/* View Attendees */}
                      {canViewRoster && (
                        <Link to={`/club/events/${evt.id}/registrations`} title="View registered attendees and passes">
                          <Button variant="ghost" size="sm" leftIcon={<Users size={14} />}>
                            Attendees
                          </Button>
                        </Link>
                      )}

                      {/* Reports and Exports */}
                      {canViewReports && (
                        <Link to={`/club/events/${evt.id}/reports`} title="Download CSV & Excel reports and analytics">
                          <Button variant="ghost" size="sm" leftIcon={<FileSpreadsheet size={14} />}>
                            Reports
                          </Button>
                        </Link>
                      )}

                      {/* Payments action for paid events */}
                      {!evt.is_free && canViewPayments && (
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

                      {/* Edit or Read-only Archive */}
                      {canEditEvt && (
                        <Link
                          to={`/club/events/${evt.id}/edit`}
                          title={canMutate ? 'Edit event information' : 'View read-only event archive'}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={canMutate ? <Edit size={14} /> : <Archive size={14} />}
                          >
                            {canMutate ? 'Edit' : 'Archive'}
                          </Button>
                        </Link>
                      )}

                      {/* Publish draft action (blocked once concluded or cancelled) */}
                      {evt.status === 'draft' && canMutate && canPublishEvt && (
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

                      {/* Cancel action (only for active upcoming/live published events) */}
                      {evt.status === 'published' && canClubMutateEvent(evt) && canCancelEvt && (
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
                  )
                })()}
              </motion.div>
            )
          }

          if (statusFilter !== 'all') {
            return (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="flex flex-col gap-3.5"
              >
                {filteredEvents.map(renderEventRow)}
              </motion.div>
            )
          }

          const activeAndDraft = filteredEvents.filter((evt) => {
            const p = getEventLifecyclePhase(evt)
            return p !== 'completed' && p !== 'cancelled'
          })
          const completedArchive = filteredEvents
            .filter((evt) => getEventLifecyclePhase(evt) === 'completed')
            .sort(
              (a, b) =>
                new Date(b.end_date || b.start_date || 0).getTime() -
                new Date(a.end_date || a.start_date || 0).getTime()
            )
          const cancelledArchive = filteredEvents
            .filter((evt) => getEventLifecyclePhase(evt) === 'cancelled')
            .sort(
              (a, b) =>
                new Date(b.end_date || b.start_date || 0).getTime() -
                new Date(a.end_date || a.start_date || 0).getTime()
            )

          return (
            <div className="flex flex-col gap-6">
              {activeAndDraft.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-bold font-heading uppercase tracking-wider text-zinc-200">
                      Active & Upcoming Events
                    </h2>
                    <Badge variant="cyan" className="text-[10px]">
                      {activeAndDraft.length}
                    </Badge>
                  </div>
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    className="flex flex-col gap-3.5"
                  >
                    {activeAndDraft.map(renderEventRow)}
                  </motion.div>
                </div>
              )}

              {completedArchive.length > 0 && (
                <div className="flex flex-col gap-3 pt-4 border-t border-white/[0.08]">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xs font-bold font-heading uppercase tracking-wider text-zinc-300">
                        Completed Events History
                      </h2>
                      <Badge variant="neutral" className="text-[10px]">
                        {completedArchive.length} Completed
                      </Badge>
                    </div>
                    <span className="text-[11px] text-zinc-500">
                      Historical registrations, payments, and attendance archives preserved.
                    </span>
                  </div>
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    className="flex flex-col gap-3.5"
                  >
                    {completedArchive.map(renderEventRow)}
                  </motion.div>
                </div>
              )}

              {cancelledArchive.length > 0 && (
                <div className="flex flex-col gap-3 pt-4 border-t border-white/[0.08]">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-bold font-heading uppercase tracking-wider text-rose-300">
                      Cancelled Events
                    </h2>
                    <Badge variant="danger" className="text-[10px]">
                      {cancelledArchive.length} Cancelled
                    </Badge>
                  </div>
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    className="flex flex-col gap-3.5"
                  >
                    {cancelledArchive.map(renderEventRow)}
                  </motion.div>
                </div>
              )}
            </div>
          )
        })()}

        {/* Cancellation Confirmation Modal */}
        <Modal
          isOpen={Boolean(cancellingEvent)}
          onClose={() => {
            if (!actionLoading) {
              setCancellingEvent(null)
              setCancelError(null)
            }
          }}
          title="Cancel Active Event"
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
                    This closes registrations, voids issued passes, and queues refund review for paid tickets.
                  </p>
                </div>
              </div>

              {cancelError && (
                <Alert variant="error" className="text-xs">
                  {cancelError}
                </Alert>
              )}

              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mt-1">
                Are you sure you want to cancel{' '}
                <strong className="text-[var(--color-text-primary)] font-semibold">
                  "{cancellingEvent?.title}"
                </strong>
                ?
              </p>

              <div className="flex flex-col gap-1.5 text-xs">
                <label className="text-zinc-300 font-semibold">
                  Cancellation Reason <span className="text-rose-400">*</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Provide an explanation for registered attendees..."
                  rows={3}
                  disabled={actionLoading}
                  className="w-full px-3 py-2 rounded-xl bg-[#14141A] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>
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
