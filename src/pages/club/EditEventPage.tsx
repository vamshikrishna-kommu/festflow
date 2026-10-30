import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { AlertCircle } from 'lucide-react'
import { Button, PageHeader } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { EventForm } from '@/components/events/EventForm'
import { getEventById, updateEvent } from '@/lib/events'
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
      </div>
    </PageShell>
  )
}
