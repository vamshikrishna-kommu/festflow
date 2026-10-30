import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router'
import { ArrowLeft, AlertCircle, AlertTriangle, Users } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Button, Modal, ModalBody, ModalFooter, Alert } from '@/components/ui'
import { DigitalTicketCard } from '@/components/tickets/DigitalTicketCard'
import { TeamManageModal } from '@/components/team/TeamManageModal'
import { getRegistrationById, cancelRegistration } from '@/lib/registrations'
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
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isOffline, setIsOffline] = useState(false)

  const loadTicket = async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    const res = await getRegistrationById(id)
    setLoading(false)

    if (res.error || !res.registration) {
      // Check offline local storage fallback
      try {
        const cachedRaw = localStorage.getItem(`festflow_cached_ticket_${id}`)
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw)
          // Also verify cached ticket ownership
          if (user && cached.student_id !== user.id && role !== 'platform_admin') {
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
      ['ticket_updated', 'payment_reviewed', 'team_updated', 'registration_updated', 'reconnect'],
      (event) => {
        if (!event.registrationId || event.registrationId === id) {
          loadTicket()
        }
      }
    )
    return () => unsubscribe()
  }, [id, user, role])

  const handleCancel = async () => {
    if (!id) return
    setActionLoading(true)
    setActionError(null)
    const res = await cancelRegistration(id)
    setActionLoading(false)

    if (res.success) {
      setShowCancelModal(false)
      loadTicket()
    } else {
      setActionError(res.message || 'Failed to cancel registration.')
    }
  }

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

            <DigitalTicketCard
              registration={registration}
              studentName={profile?.display_name || 'FestFlow Student'}
              onCancel={() => setShowCancelModal(true)}
            />
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

        {/* Cancellation Confirmation Modal */}
        <Modal
          isOpen={showCancelModal}
          onClose={() => {
            setShowCancelModal(false)
            setActionError(null)
          }}
          title="Cancel Entry Pass"
          size="sm"
        >
          <ModalBody>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 text-rose-400">
                <div className="p-2.5 rounded-xl bg-rose-500/15">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[var(--color-text-primary)]">
                    Revoke Registration
                  </h4>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    This action immediately voids your gate admission pass.
                  </p>
                </div>
              </div>

              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mt-1">
                Are you sure you want to cancel your entry pass for{' '}
                <strong className="text-[var(--color-text-primary)]">
                  {registration?.event?.title || 'this event'}
                </strong>
                ? Your seat will be released immediately for other campus students, and this QR pass will become void.
              </p>

              {actionError && (
                <Alert variant="error" className="mt-2 text-xs">
                  {actionError}
                </Alert>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              size="sm"
              disabled={actionLoading}
              onClick={() => {
                setShowCancelModal(false)
                setActionError(null)
              }}
            >
              Keep Pass
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={actionLoading}
              isLoading={actionLoading}
              onClick={handleCancel}
            >
              Confirm Cancellation
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    </PageShell>
  )
}
