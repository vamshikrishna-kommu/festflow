// Phase 7: Super Admin Event Moderation & Review Queue Page
import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Search, Calendar, MapPin, Eye } from 'lucide-react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { AdminConfirmModal } from '@/components/admin/AdminConfirmModal'
import { getAdminEvents, moderateEvent, type AdminEventRecord } from '@/lib/admin'
import { Button } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'

export default function AdminEventsPage() {
  const { profile } = useAuth()
  const adminEmail = profile?.email || 'admin@festflow.online'

  const [searchParams] = useSearchParams()
  const initialQuery = searchParams.get('q') || ''

  const [events, setEvents] = useState<AdminEventRecord[]>([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState(initialQuery)

  // Moderation Modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [targetEvent, setTargetEvent] = useState<AdminEventRecord | null>(null)
  const [moderationAction, setModerationAction] = useState<'approve' | 'reject' | 'request_changes' | 'unpublish'>('approve')

  const loadData = async () => {
    const data = await getAdminEvents(filter, search)
    setEvents(data)
  }

  useEffect(() => {
    loadData()
  }, [filter, search])

  const promptModeration = (event: AdminEventRecord, action: typeof moderationAction) => {
    setTargetEvent(event)
    setModerationAction(action)
    setConfirmModalOpen(true)
  }

  const handleConfirmModeration = async (reason: string) => {
    if (!targetEvent) return
    await moderateEvent(targetEvent.id, moderationAction, reason, adminEmail)
    setConfirmModalOpen(false)
    setTargetEvent(null)
    loadData()
  }

  const getModalLabels = () => {
    switch (moderationAction) {
      case 'approve':
        return {
          title: 'Approve & Publish Event?',
          description: `Approve "${targetEvent?.title}". This moves the event into public discovery and permits student registration.`,
          confirmLabel: 'Approve Event',
          variant: 'primary' as const,
        }
      case 'reject':
        return {
          title: 'Reject Event Submission?',
          description: `Reject "${targetEvent?.title}". A clear audit explanation will be logged and communicated to the organizer.`,
          confirmLabel: 'Reject Submission',
          variant: 'danger' as const,
        }
      case 'request_changes':
        return {
          title: 'Request Corrections from Organizer?',
          description: `Flag "${targetEvent?.title}" for revisions. Explain the specific changes required.`,
          confirmLabel: 'Request Changes',
          variant: 'primary' as const,
        }
      case 'unpublish':
        return {
          title: 'Unpublish Active Event?',
          description: `Remove "${targetEvent?.title}" from public listing. Important: All existing student registrations and payment records will be safely preserved.`,
          confirmLabel: 'Unpublish Event',
          variant: 'danger' as const,
        }
    }
  }

  const modalConfig = getModalLabels()

  return (
    <AdminLayout
      title="Event Moderation & Quality Review"
      subtitle="Inspect submitted college fests, review schedules and venue parameters, and moderate public platform availability."
    >
      {/* Search & Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0D0E15] p-3 rounded-2xl border border-white/5">
        <div className="flex items-center gap-2 flex-1">
          <Search size={16} className="text-white/40 ml-2" />
          <input
            type="text"
            placeholder="Search events by title, venue, or slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none text-xs text-white placeholder-white/40 focus:outline-none"
          />
        </div>

        {/* Moderation Status Filter */}
        <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl self-start sm:self-auto overflow-x-auto max-w-full">
          {[
            { id: 'all', label: 'All Events' },
            { id: 'pending_approval', label: 'Pending Review' },
            { id: 'approved', label: 'Approved' },
            { id: 'rejected', label: 'Rejected' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap
                ${filter === tab.id ? 'bg-[#18CFFC] text-black font-bold shadow-sm' : 'text-white/60 hover:text-white'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Events Moderation Table */}
      <div className="bg-[#0D0E15] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 text-white/40 uppercase font-mono bg-white/[0.01]">
                <th className="p-4 font-semibold">Event Information</th>
                <th className="p-4 font-semibold">Club Organizer</th>
                <th className="p-4 font-semibold">Date & Venue</th>
                <th className="p-4 font-semibold">Pricing & Capacity</th>
                <th className="p-4 font-semibold">Moderation Status</th>
                <th className="p-4 font-semibold text-right">Moderator Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-white/[0.02]">
                  <td className="p-4 font-medium text-white">
                    <div className="font-semibold text-white">{event.title}</div>
                    <div className="text-[11px] text-white/40 font-mono mt-0.5">/{event.slug}</div>
                  </td>
                  <td className="p-4 text-white/70">
                    <div>{event.club_name}</div>
                  </td>
                  <td className="p-4 text-white/60">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} className="text-white/40" />
                      <span>{new Date(event.start_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-white/40 mt-0.5">
                      <MapPin size={11} />
                      <span className="truncate max-w-[150px]">{event.venue_name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-white/70 font-mono">
                    <div>{event.is_free ? 'Free' : `₹${event.price}`}</div>
                    <div className="text-[10px] text-white/40">{event.capacity} max seats</div>
                  </td>
                  <td className="p-4">
                    <span
                      className={`
                        px-2.5 py-0.5 rounded-full font-mono text-[10px] font-semibold uppercase border
                        ${
                          event.moderation_status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : event.moderation_status === 'pending_approval'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }
                      `}
                    >
                      {event.moderation_status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <Link to={`/events/${event.id}`} target="_blank" rel="noreferrer">
                      <Button variant="ghost" size="sm" className="text-xs" leftIcon={<Eye size={13} />}>
                        Inspect
                      </Button>
                    </Link>

                    {event.moderation_status === 'pending_approval' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                          onClick={() => promptModeration(event, 'approve')}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                          onClick={() => promptModeration(event, 'reject')}
                        >
                          Reject
                        </Button>
                      </>
                    )}

                    {event.moderation_status === 'approved' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                        onClick={() => promptModeration(event, 'unpublish')}
                      >
                        Unpublish
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AdminConfirmModal
        isOpen={confirmModalOpen}
        title={modalConfig.title}
        description={modalConfig.description}
        confirmLabel={modalConfig.confirmLabel}
        confirmVariant={modalConfig.variant}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleConfirmModeration}
      />
    </AdminLayout>
  )
}
