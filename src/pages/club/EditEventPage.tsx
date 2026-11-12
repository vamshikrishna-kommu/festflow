import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { AlertCircle, AlertTriangle, Users, FileSpreadsheet, ShieldAlert, Lock, LayoutGrid } from 'lucide-react'
import { Button, PageHeader, Modal, ModalBody, ModalFooter, Alert } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { EventForm } from '@/components/events/EventForm'
import {
  getEventById,
  updateEvent,
  cancelEventByOrganizer,
  getEventLifecyclePhase,
  canClubMutateEvent,
  LIFECYCLE_BADGE_META,
  formatEventDate,
  formatEventTime,
  resolveEventTimezone,
} from '@/lib/events'
import { useAuth } from '@/context/AuthContext'
import type { EventRecord, EventInsert, EventUpdate } from '@/types'

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    role,
    activeClubId,
    activeClubRole,
    eventAssignments,
    hasEventPermission,
    isRoleLoading,
  } = useAuth()

  const [event, setEvent] = useState<EventRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || isRoleLoading) return
    let mounted = true
    setLoading(true)
    setLoadError(null)

    getEventById(id).then((res) => {
      if (!mounted) return
      setLoading(false)
      if (res.error || !res.event) {
        setLoadError(res.error || 'Event could not be found.')
      } else {
        const canEditFetchedEvent =
          role === 'platform_admin' ||
          hasEventPermission(res.event.id, 'events.edit', res.event.club_id)
        if (!canEditFetchedEvent) {
          setEvent(null)
          setLoadError('You do not have permission to edit this event.')
        } else {
          setEvent(res.event)
        }
      }
    })

    return () => {
      mounted = false
    }
  }, [id, role, isRoleLoading, activeClubId, activeClubRole, eventAssignments])

  const isAdmin = role === 'platform_admin'
  const canEditEvent = event ? (isAdmin || hasEventPermission(event.id, 'events.edit', event.club_id)) : false
  const canPublishEvent = event ? (isAdmin || hasEventPermission(event.id, 'events.publish', event.club_id)) : false
  const canCancelEvent = event ? (isAdmin || hasEventPermission(event.id, 'events.cancel', event.club_id)) : false
  const canViewRegistrations = event
    ? (isAdmin || hasEventPermission(event.id, 'registrations.view', event.club_id))
    : false
  const canViewReports = event
    ? (isAdmin || hasEventPermission(event.id, 'reports.view', event.club_id))
    : false

  const handleUpdate = async (
    data: Omit<EventInsert, 'id' | 'created_at' | 'updated_at'>,
    action: 'save_draft' | 'publish'
  ) => {
    if (!id || !event) return

    if (!canEditEvent) {
      setServerError('You do not have permission to edit this event.')
      return
    }

    if (action === 'publish' && !canPublishEvent) {
      setServerError('You do not have permission to publish events. Save your changes instead.')
      return
    }

    const canMutate = canClubMutateEvent(event) || isAdmin
    if (!canMutate) {
      setServerError('Completed or cancelled events are archived and cannot be edited or re-published.')
      return
    }

    setIsSubmitting(true)
    setServerError(null)

    const updates: EventUpdate = {
      ...data,
      club_id: event.club_id,
      status: action === 'publish' ? 'published' : isAdmin ? data.status : event.status,
    }

    const res = await updateEvent(id, updates, event.club_id)
    setIsSubmitting(false)

    if (res.error) {
      setServerError(res.error)
    } else if (res.event) {
      if (action === 'publish') {
        navigate(`/events/${res.event.slug}`, { replace: true })
      } else {
        navigate('/club/events', { replace: true })
      }
    }
  }

  if (loading || isRoleLoading) {
    return (
      <div className="min-h-screen pt-32 flex flex-col items-center justify-center bg-[var(--color-surface-0)]">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--color-surface-3)] border-t-[#18CFFC] animate-spin mb-3" />
        <span className="text-xs text-[var(--color-text-muted)]">Loading event data…</span>
      </div>
    )
  }

  if (loadError || !event) {
    return (
      <div className="min-h-screen pt-32 px-4 flex flex-col items-center justify-center bg-[var(--color-surface-0)]">
        <div className="glass p-8 rounded-2xl max-w-md text-center flex flex-col items-center">
          <AlertCircle size={36} className="text-rose-400 mb-3" />
          <h2 className="text-xl font-bold font-display text-[var(--color-text-primary)] mb-2">
            Unable to Edit Event
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)] mb-6">
            {loadError || 'The event you requested could not be retrieved.'}
          </p>
          <Link to="/club/events">
            <Button variant="primary" size="md">
              Return to My Events
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const lifecyclePhase = getEventLifecyclePhase(event)
  const lifecycleMeta = LIFECYCLE_BADGE_META[lifecyclePhase]
  const isCompleted = lifecyclePhase === 'completed'
  const isConcludedOrCancelled = !canClubMutateEvent(event)
  const isReadOnlyArchive = isConcludedOrCancelled && !isAdmin
  const eventTz = resolveEventTimezone(event.timezone)

  return (
    <PageShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        {/* Page Header */}
        <PageHeader
          breadcrumbs={[
            { label: 'Club Dashboard', href: '/club/dashboard' },
            { label: 'My Events', href: '/club/events' },
            { label: `${isReadOnlyArchive ? 'Archive' : 'Edit'}: ${event.title}` },
          ]}
          title={isReadOnlyArchive ? 'Event Archive Record' : 'Edit Event'}
          badge={lifecycleMeta.label}
          badgeVariant={lifecycleMeta.variant}
          subtitle={
            isReadOnlyArchive
              ? `Read-only lifecycle archive for "${event.title}". Registrations, payment logs, and reports remain preserved.`
              : `Update event configuration, schedule, ticket pricing, and registration settings for "${event.title}".`
          }
        />

        {/* Completed / Cancelled Archive Banner */}
        {isConcludedOrCancelled && (
          <div
            className={`p-5 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left ${
              isCompleted
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : 'bg-rose-500/5 border-rose-500/20'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                {isReadOnlyArchive ? (
                  <Lock size={16} className={isCompleted ? 'text-emerald-400' : 'text-rose-400'} />
                ) : (
                  <ShieldAlert size={16} className="text-amber-400" />
                )}
                <span>
                  {isCompleted
                    ? isReadOnlyArchive
                      ? 'Completed Event — Read-Only Archive'
                      : 'Completed Event — Admin Override Active'
                    : isReadOnlyArchive
                    ? 'Cancelled Event — Read-Only Record'
                    : 'Cancelled Event — Admin Override Active'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
                {isCompleted
                  ? `This event concluded on ${formatEventDate(event.end_date || event.start_date, eventTz)} at ${formatEventTime(event.end_date || event.start_date, eventTz)} (${eventTz}). Editing, re-publishing, and cancelling are disabled for organizers while attendee rosters, payment records, and analytics reports remain accessible.`
                  : 'This event was cancelled. All issued passes are invalidated and event editing is locked while historical records and refund logs remain accessible.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {canViewRegistrations && (
                <Link to={`/club/events/${event.id}/registrations`}>
                  <Button variant="outline" size="sm" leftIcon={<Users size={14} />}>
                    Registrations
                  </Button>
                </Link>
              )}
              {canViewReports && (
                <Link to={`/club/events/${event.id}/reports`}>
                  <Button variant="primary" size="sm" leftIcon={<FileSpreadsheet size={14} />}>
                    Reports & Exports
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Quick Link: Seat Management if reserved seating */}
        {event.registration_mode === 'reserved_seating' && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#18CFFC]/10 via-[#0D56FB]/10 to-[#7F1AFB]/10 border border-[#18CFFC]/30 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#18CFFC]/20 border border-[#18CFFC]/40 flex items-center justify-center text-[#18CFFC]">
                <LayoutGrid size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Reserved Seating Enabled</h4>
                <p className="text-xs text-zinc-400">Configure room layout, seat pricing categories, and view live bookings.</p>
              </div>
            </div>
            <Link to={`/club/events/${event.id}/seats`}>
              <Button variant="primary" size="sm">
                Manage Seats →
              </Button>
            </Link>
          </div>
        )}

        {/* Multi-section Event Form */}
        <EventForm
          mode="edit"
          initialData={event}
          onSubmit={handleUpdate}
          isSubmitting={isSubmitting}
          serverError={serverError}
          readOnly={isReadOnlyArchive || !canEditEvent}
          allowAdminStatusEdit={isAdmin}
          canPublish={canPublishEvent}
        />

        {/* Danger Zone: Event Cancellation (Only active upcoming/ongoing/draft events) */}
        {canClubMutateEvent(event) && canCancelEvent && (
          <div className="p-6 rounded-3xl bg-rose-500/5 border border-rose-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-left">
            <div>
              <h4 className="text-sm font-bold text-rose-400 flex items-center gap-2">
                <AlertTriangle size={16} /> Danger Zone: Cancel Event
              </h4>
              <p className="text-xs text-zinc-400 mt-1 max-w-xl leading-relaxed">
                Cancelling this event will invalidate all issued digital passes, notify all registered attendees, and queue refund reviews for paid registrations. History and records are preserved.
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowCancelModal(true)}
              className="shrink-0"
            >
              Cancel Event
            </Button>
          </div>
        )}

        {/* Modal: Confirm Event Cancellation */}
        <Modal
          isOpen={showCancelModal}
          onClose={() => {
            if (!isCancelling) {
              setShowCancelModal(false)
              setCancelError(null)
            }
          }}
          title="Confirm Event Cancellation"
          size="md"
        >
          <div className="flex flex-col gap-4 text-left">
            <ModalBody>
              <div className="flex flex-col gap-3">
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 leading-relaxed">
                  <strong className="block text-white mb-0.5">Irreversible Action</strong>
                  This action marks <strong>{event.title}</strong> as cancelled. Tickets will be invalidated immediately.
                </div>

                {cancelError && (
                  <Alert variant="error" className="text-xs">
                    {cancelError}
                  </Alert>
                )}

                <div className="flex flex-col gap-1.5 text-xs">
                  <label className="text-zinc-300 font-semibold">
                    Reason for Cancellation <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Provide a clear explanation for registered attendees..."
                    rows={3}
                    disabled={isCancelling}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#14141A] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500 resize-none"
                  />
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="ghost"
                size="sm"
                disabled={isCancelling}
                onClick={() => setShowCancelModal(false)}
              >
                Keep Event Active
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={isCancelling}
                onClick={async () => {
                  if (!canCancelEvent) {
                    setCancelError('You do not have permission to cancel this event.')
                    return
                  }
                  if (!cancelReason.trim()) {
                    setCancelError('Please specify the reason for event cancellation.')
                    return
                  }
                  setIsCancelling(true)
                  setCancelError(null)
                  const res = await cancelEventByOrganizer({
                    eventId: event.id,
                    cancellationReason: cancelReason.trim(),
                  })
                  setIsCancelling(false)
                  if (res.success) {
                    setShowCancelModal(false)
                    navigate('/club/events', { replace: true })
                  } else {
                    setCancelError(res.message || 'Failed to cancel event.')
                  }
                }}
              >
                Confirm Cancellation
              </Button>
            </ModalFooter>
          </div>
        </Modal>
      </div>
    </PageShell>
  )
}
