import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { motion } from 'motion/react'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { EventForm } from '@/components/events/EventForm'
import { getEventById, updateEvent } from '@/lib/events'
import { useAuth } from '@/context/AuthContext'
import { fadeIn } from '@/lib/animations'
import type { EventRecord, EventInsert, EventUpdate } from '@/types'

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

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
        // Verify ownership (or allow in local simulation)
        if (user && res.event.club_id !== user.id && user.id !== 'demo_club_member_default') {
          setLoadError('You do not have permission to edit this event.')
        } else {
          setEvent(res.event)
        }
      }
    })

    return () => {
      mounted = false
    }
  }, [id, user])

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
        <div className="w-8 h-8 rounded-full border-2 border-[var(--color-surface-3)] border-t-[var(--color-brand-purple)] animate-spin mb-3" />
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
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <Link
            to="/club/dashboard"
            className="hover:text-[var(--color-text-primary)] transition-colors flex items-center gap-1"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
          <span>/</span>
          <Link
            to="/club/events"
            className="hover:text-[var(--color-text-primary)] transition-colors"
          >
            My Events
          </Link>
          <span>/</span>
          <span className="text-[var(--color-text-primary)] font-medium">Edit: {event.title}</span>
        </div>

        {/* Page Header */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-1 text-left"
        >
          <h1 className="text-3xl font-bold font-display text-[var(--color-text-primary)] tracking-tight">
            Edit Event
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Update event details, timing, venue, or ticket configurations.
          </p>
        </motion.div>

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
