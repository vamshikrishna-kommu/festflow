import { useState } from 'react'
import { useNavigate } from 'react-router'
import { PageHeader } from '@/components/ui'
import { EventForm } from '@/components/events/EventForm'
import { PageShell } from '@/components/layout/PageShell'
import { createEvent } from '@/lib/events'
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

    const res = await createEvent(data, action)
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
        {/* Page Header */}
        <PageHeader
          breadcrumbs={[
            { label: 'Club Dashboard', href: '/club/dashboard' },
            { label: 'My Events', href: '/club/events' },
            { label: 'New Event' },
          ]}
          title="Create Campus Event"
          badge="Event Workspace"
          badgeVariant="cyan"
          subtitle="Configure your event schedule, ticketing, application questions, and capacity. You can save as a draft or publish immediately to campus."
        />

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
