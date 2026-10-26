import { useState } from 'react'
import { useNavigate, Link } from 'react-router'
import { motion } from 'motion/react'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { EventForm } from '@/components/events/EventForm'
import { PageShell } from '@/components/layout/PageShell'
import { createEvent } from '@/lib/events'
import { fadeIn } from '@/lib/animations'
import type { EventInsert } from '@/types'

export default function NewEventPage() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const handleCreate = async (
    data: Omit<EventInsert, 'id' | 'created_at' | 'updated_at'>,
    action: 'save_draft' | 'publish'
  ) => {
    setIsSubmitting(true)
    setServerError(null)

    const res = await createEvent(data)
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
          <span className="text-[var(--color-text-primary)] font-medium">New Event</span>
        </div>

        {/* Page Header */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-1 text-left"
        >
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold font-display text-[var(--color-text-primary)] tracking-tight">
              Create Campus Event
            </h1>
            <span className="p-1 rounded-md bg-[var(--color-brand-purple)]/20 text-[var(--color-brand-purple)]">
              <Sparkles size={16} />
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Fill in the details below to launch your event. You can save as a draft or publish immediately to campus.
          </p>
        </motion.div>

        {/* Multi-section Event Form */}
        <EventForm
          mode="create"
          onSubmit={handleCreate}
          isSubmitting={isSubmitting}
          serverError={serverError}
        />
      </div>
    </PageShell>
  )
}
