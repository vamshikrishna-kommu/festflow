import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ShieldAlert } from 'lucide-react'
import { Button, Card, PageHeader } from '@/components/ui'
import { EventForm } from '@/components/events/EventForm'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/context/AuthContext'
import { createEvent } from '@/lib/events'
import type { EventInsert } from '@/types'

export default function NewEventPage() {
  const navigate = useNavigate()
  const { activeClubId, activeClubProfile, hasClubPermission, isRoleLoading } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const canCreateEvent = Boolean(activeClubId) && hasClubPermission('events.create')
  const canPublishEvent = Boolean(activeClubId) && hasClubPermission('events.publish')

  const handleCreate = async (
    data: Omit<EventInsert, 'id' | 'created_at' | 'updated_at'>,
    action: 'save_draft' | 'publish'
  ) => {
    if (!activeClubId || !hasClubPermission('events.create')) {
      setServerError('You do not have permission to create events for the active club.')
      return
    }
    if (action === 'publish' && !hasClubPermission('events.publish')) {
      setServerError('You do not have permission to publish events directly. Save as a draft instead.')
      return
    }

    setIsSubmitting(true)
    setServerError(null)

    const res = await createEvent({ ...data, club_id: activeClubId }, action)
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

  if (isRoleLoading) {
    return (
      <PageShell>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-sm text-zinc-400">
          Loading club workspace permissions...
        </div>
      </PageShell>
    )
  }

  if (!canCreateEvent) {
    return (
      <PageShell>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card className="p-6 sm:p-8 flex flex-col items-start gap-4 border-amber-500/20 bg-amber-500/5">
            <div className="flex items-center gap-3 text-amber-300">
              <ShieldAlert size={22} />
              <h1 className="text-lg font-semibold text-white">Event Creation Restricted</h1>
            </div>
            <p className="text-sm text-zinc-300">
              Your current club role{activeClubProfile?.club_name ? ` in ${activeClubProfile.club_name}` : ''} does not include permission to create new events.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/club/events">
                <Button variant="primary" size="sm">Back to Club Events</Button>
              </Link>
              <Link to="/club/dashboard">
                <Button variant="outline" size="sm">Club Dashboard</Button>
              </Link>
            </div>
          </Card>
        </div>
      </PageShell>
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
          canPublish={canPublishEvent}
        />
      </div>
    </PageShell>
  )
}
