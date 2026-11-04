import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { AlertCircle, AlertTriangle } from 'lucide-react'
import { Button, PageHeader, Modal, ModalBody, ModalFooter, Alert } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { EventForm } from '@/components/events/EventForm'
import { getEventById, updateEvent, cancelEventByOrganizer } from '@/lib/events'
import { useAuth } from '@/context/AuthContext'
import type { EventRecord, EventInsert, EventUpdate } from '@/types'

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, role } = useAuth()

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
    if (!id) return
    let mounted = true

    getEventById(id).then((res) => {
      if (!mounted) return
      setLoading(false)
      if (res.error || !res.event) {
        setLoadError(res.error || 'Event could not be found.')
      } else {
        // Verify resource ownership
        const isOwnerOrAdmin = (user && res.event.club_id === user.id) || role === 'platform_admin'
        if (!isOwnerOrAdmin) {
          setLoadError('You do not have permission to edit this event.')
        } else {
          setEvent(res.event)
        }
      }
    })

    return () => {
      mounted = false
    }
  }, [id, user, role])

  const handleUpdate = async (
    data: Omit<EventInsert, 'id' | 'created_at' | 'updated_at'>,
    action: 'save_draft' | 'publish'
  ) => {
    if (!id) return
    setIsSubmitting(true)
    setServerError(null)

    const updates: EventUpdate = {
      ...data,
      status: action === 'publish' ? 'published' : data.status,
    }

    const res = await updateEvent(id, updates)
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

  if (loading) {
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

  return (
    <PageShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        {/* Page Header */}
        <PageHeader
          breadcrumbs={[
            { label: 'Club Dashboard', href: '/club/dashboard' },
            { label: 'My Events', href: '/club/events' },
            { label: `Edit: ${event.title}` },
          ]}
          title="Edit Event"
          badge={event.status === 'published' ? 'Published' : event.status === 'cancelled' ? 'Cancelled' : 'Draft'}
          badgeVariant={event.status === 'published' ? 'success' : event.status === 'cancelled' ? 'danger' : 'outline'}
          subtitle={`Update event configuration, schedule, ticket pricing, and registration settings for "${event.title}".`}
        />

        {/* Multi-section Event Form */}
        <EventForm
          mode="edit"
          initialData={event}
          onSubmit={handleUpdate}
          isSubmitting={isSubmitting}
          serverError={serverError}
        />

        {/* Danger Zone: Event Cancellation (Module 7) */}
        {event.status !== 'cancelled' && (
          <div className="p-6 rounded-3xl bg-rose-500/5 border border-rose-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-left">
            <div>
              <h4 className="text-sm font-bold text-rose-400 flex items-center gap-2">
                <AlertTriangle size={16} /> Danger Zone: Cancel Event
              </h4>
              <p className="text-xs text-zinc-400 mt-1 max-w-xl leading-relaxed">
                Cancelling this event will invalidate all issued digital tickets, prevent further gate check-in, notify all registered attendees, and queue refund reviews for paid registrations. History and records are preserved.
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
