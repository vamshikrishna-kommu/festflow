import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router'
import { ArrowLeft, AlertCircle, Clock, Users, Edit3, XCircle } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui'
import { DigitalTicketCard } from '@/components/tickets/DigitalTicketCard'
import { TeamManageModal } from '@/components/team/TeamManageModal'
import { RequestCancellationModal } from '@/components/registration/RequestCancellationModal'
import { RequestEditModal } from '@/components/registration/RequestEditModal'
import { getRegistrationById } from '@/lib/registrations'
import { subscribeToStatusChanges } from '@/lib/sync'
import { useAuth } from '@/context/AuthContext'
import type { RegistrationWithEvent } from '@/types'

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, role, profile } = useAuth()

  const [registration, setRegistration] = useState<RegistrationWithEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [isOffline, setIsOffline] = useState(false)

  const loadTicket = async (silent = false) => {
    if (!id) return
    if (!silent) setLoading(true)
    setError(null)
    const res = await getRegistrationById(id)
    if (!silent) setLoading(false)

    if (res.error || !res.registration) {
      // Check offline local storage fallback
      try {
        const cachedRaw = localStorage.getItem(`festflow_cached_ticket_${id}`)
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw)
          // Strictly verify cached ticket ownership; unauthenticated users cannot view cached credentials
          if (!user || (cached.student_id !== user.id && role !== 'platform_admin')) {
            setError('You do not have permission to view this ticket.')
            return
          }
          setRegistration(cached)
          setIsOffline(true)
          return
        }
      } catch {
        // ignore JSON parse error
      }
      setError(res.error || 'Ticket could not be found.')
    } else {
      // Check ownership
      const isOwnerOrAdmin = (user && res.registration.student_id === user.id) || role === 'platform_admin'
      if (!isOwnerOrAdmin) {
        setError('You do not have permission to view this ticket.')
      } else {
        setRegistration(res.registration)
        setIsOffline(false)
        try {
          localStorage.setItem(`festflow_cached_ticket_${id}`, JSON.stringify(res.registration))
        } catch {
          // ignore
        }
      }
    }
  }

  useEffect(() => {
    loadTicket()

    const unsubscribe = subscribeToStatusChanges(
      ['ticket_updated', 'payment_reviewed', 'team_updated', 'registration_updated'],
      (event) => {
        if (!event.registrationId || event.registrationId === id) {
          loadTicket(true)
        }
      }
    )
    return () => unsubscribe()
  }, [id, user, role])

  return (
    <PageShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-24 text-left">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 py-4 text-xs text-zinc-400 border-b border-white/[0.08] mb-8 flex-wrap">
          <Link
            to="/student/dashboard"
            className="hover:text-white flex items-center gap-1 transition-colors"
          >
            <ArrowLeft size={14} /> Back to My Passes
          </Link>
          <span className="text-zinc-600">/</span>
          <span className="text-white font-medium">Digital Pass</span>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-[#18CFFC] animate-spin mb-4" />
            <span className="text-xs text-zinc-400 font-mono">
              Decrypting and verifying digital ticket…
            </span>
          </div>
        ) : error || !registration ? (
          <div className="max-w-md mx-auto py-16 text-center flex flex-col items-center p-8 rounded-3xl bg-[#0E0E12] border border-white/[0.08] shadow-2xl">
            <AlertCircle size={36} className="text-rose-400 mb-3" />
            <h2 className="text-xl font-bold font-heading text-white mb-2">
              Pass Unavailable
            </h2>
            <p className="text-xs text-zinc-400 mb-6 font-sans">
              {error || 'Unable to load digital ticket.'}
            </p>
            <Link to="/student/dashboard">
              <Button variant="primary" size="md">
                Return to Student Passes
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            {isOffline && (
              <div className="w-full max-w-md p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                  <span><strong>Offline Gate Pass</strong> — Cached from previous session. Ready for scanner verification.</span>
                </div>
              </div>
            )}
            {registration.team_name && (
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#14141A] border border-white/[0.08] text-xs mb-3 flex-wrap gap-2 w-full max-w-lg">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#18CFFC]/15 text-[#18CFFC]">
                    <Users size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-white font-heading">{registration.team_name}</span>
                    <span className="text-[11px] text-zinc-400 ml-2">
                      {registration.team_role === 'leader' ? 'Team Leader' : 'Team Member'}
                    </span>
                  </div>
                </div>

                {registration.team_id && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTeamModal(true)}
                    leftIcon={<Users size={14} className="text-[#18CFFC]" />}
                  >
                    Manage Squad Roster
                  </Button>
                )}
              </div>
            )}

            {/* Cancellation or Review Status Banners */}
            {registration.cancellation_request_status === 'pending' && (
              <div className="w-full max-w-lg p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-3 shadow-md">
                <Clock size={18} className="shrink-0 text-amber-400" />
                <div>
                  <strong className="block font-semibold">Cancellation Pending Organizer Review</strong>
                  <span>Your request to cancel this pass has been received and is being processed by the event organizer.</span>
                </div>
              </div>
            )}

            {registration.status === 'cancelled' && (
              <div className="w-full max-w-lg p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3 shadow-md">
                <XCircle size={18} className="shrink-0 text-rose-400" />
                <div>
                  <strong className="block font-semibold">Pass Cancelled & Inactive</strong>
                  <span>This registration was cancelled. Entry cannot be granted with this digital ticket.</span>
                </div>
              </div>
            )}

            <DigitalTicketCard
              registration={registration}
              studentName={profile?.display_name || 'FestFlow Student'}
              onCancel={() => setShowCancelModal(true)}
            />

            {/* Quick Actions (Request Edit / Cancellation) */}
            {registration.status !== 'cancelled' && (
              <div className="flex items-center gap-3 w-full max-w-lg justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Edit3 size={14} />}
                  onClick={() => setShowEditModal(true)}
                >
                  Request Details Edit
                </Button>
                {registration.cancellation_request_status !== 'pending' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs"
                    onClick={() => setShowCancelModal(true)}
                  >
                    Request Cancellation
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Squad Management Modal */}
        {registration?.team_id && (
          <TeamManageModal
            isOpen={showTeamModal}
            teamId={registration.team_id}
            onClose={() => setShowTeamModal(false)}
            onTeamUpdated={loadTicket}
          />
        )}

        {/* Request Cancellation Modal */}
        {registration && (
          <RequestCancellationModal
            isOpen={showCancelModal}
            onClose={() => setShowCancelModal(false)}
            registrationId={registration.id}
            eventTitle={registration.event?.title || 'this event'}
            onSubmitted={() => {
              setShowCancelModal(false)
              loadTicket(true)
            }}
          />
        )}

        {/* Request Edit Modal */}
        {registration && (
          <RequestEditModal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            registration={registration}
            eventTitle={registration.event?.title || 'this event'}
            onSubmitted={() => {
              setShowEditModal(false)
              loadTicket(true)
            }}
          />
        )}
      </div>
    </PageShell>
  )
}
