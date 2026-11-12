import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router'
import {
  ArrowLeft,
  LayoutGrid,
  Users,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Button, Badge } from '@/components/ui'
import { LayoutEditor } from '@/components/seating/LayoutEditor'
import { SeatMap } from '@/components/seating/SeatMap'
import { getEventById } from '@/lib/events'
import { fetchSeatLayoutForOrganizer, fetchSeatAvailability } from '@/lib/seating'
import { useAuth } from '@/context/AuthContext'
import type { EventRecord, SeatLayoutFull } from '@/types'

export default function EventSeatManagementPage() {
  const { id } = useParams<{ id: string }>()
  const { hasEventPermission } = useAuth()

  const [event, setEvent] = useState<EventRecord | null>(null)
  const [layout, setLayout] = useState<SeatLayoutFull | null>(null)
  const [activeTab, setActiveTab] = useState<'editor' | 'live'>('editor')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canEdit = event ? hasEventPermission(event.id, 'events.edit', event.club_id) : false

  const loadData = async () => {
    if (!id) return
    try {
      const res = await getEventById(id)
      if (res.error || !res.event) {
        setError(res.error || 'Event not found')
        return
      }
      setEvent(res.event)

      const l = await fetchSeatLayoutForOrganizer(id)
      setLayout(l)

      if (l) {
        await fetchSeatAvailability(id)
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load layout data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  const handleRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  if (loading) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="w-8 h-8 text-[#18CFFC] animate-spin" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading seat management…</p>
        </div>
      </PageShell>
    )
  }

  if (error || !event) {
    return (
      <PageShell>
        <div className="max-w-xl mx-auto py-16 px-4 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Event Not Found</h1>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">{error || 'Unable to load event.'}</p>
          <Link to="/club/events">
            <Button variant="primary">Back to Club Events</Button>
          </Link>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/club/events"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-[#18CFFC] transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Club Events
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={layout?.is_published ? 'success' : 'amber'}>
                  {layout?.is_published ? 'Published Layout' : 'Draft Layout'}
                </Badge>
                <span className="text-xs text-[var(--color-text-muted)]">
                  Mode: {event.registration_mode || 'standard'}
                </span>
                {!canEdit && (
                  <Badge variant="amber">View Only</Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">
                Seat Management — {event.title}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                isLoading={refreshing}
              >
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Refresh
              </Button>
              <Link to={`/events/${event.slug || event.id}`}>
                <Button variant="ghost" size="sm">
                  View Public Page
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 p-1 bg-[var(--color-surface-2)] rounded-xl border border-white/5 w-fit mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'editor'
                ? 'bg-gradient-to-r from-[#18CFFC]/20 to-[#0D56FB]/20 border border-[#18CFFC]/40 text-[#18CFFC]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Layout Editor
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('live')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'live'
                ? 'bg-gradient-to-r from-[#18CFFC]/20 to-[#0D56FB]/20 border border-[#18CFFC]/40 text-[#18CFFC]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Users className="w-4 h-4" />
            Live Seat Status
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'editor' ? (
          <div>
            <LayoutEditor
              eventId={event.id}
              onSaved={() => {
                loadData()
              }}
            />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-[var(--color-surface-1)] rounded-2xl border border-white/5 p-6">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                Live Availability Map
              </h2>
              {layout?.is_published ? (
                <SeatMap
                  eventId={event.id}
                  maxSelectableSeats={0}
                  onSeatsSelected={() => {}}
                  disabled={true}
                />
              ) : (
                <div className="p-8 text-center text-[var(--color-text-muted)]">
                  Publish a layout in the Layout Editor tab first to see live availability.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}
