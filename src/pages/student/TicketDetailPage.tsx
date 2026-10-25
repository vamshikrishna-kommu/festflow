import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowLeft, AlertCircle, AlertTriangle } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui'
import { DigitalTicketCard } from '@/components/tickets/DigitalTicketCard'
import { getRegistrationById, cancelRegistration } from '@/lib/registrations'
import { useAuth } from '@/context/AuthContext'
import type { RegistrationWithEvent } from '@/types'

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, profile } = useAuth()

  const [registration, setRegistration] = useState<RegistrationWithEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const loadTicket = async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    const res = await getRegistrationById(id)
    setLoading(false)

    if (res.error || !res.registration) {
      setError(res.error || 'Ticket could not be found.')
    } else {
      // Check ownership
      if (
        user &&
        res.registration.student_id !== user.id &&
        user.id !== 'demo_student_default'
      ) {
        setError('You do not have permission to view this ticket.')
      } else {
        setRegistration(res.registration)
      }
    }
  }

  useEffect(() => {
    loadTicket()
  }, [id, user])

  const handleCancel = async () => {
    if (!id) return
    setActionLoading(true)
    const res = await cancelRegistration(id)
    setActionLoading(false)
    setShowCancelModal(false)

    if (res.success) {
      loadTicket()
    } else {
      alert(res.message)
    }
  }

  return (
    <PageShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-24 text-left">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 py-4 text-xs text-[var(--color-text-muted)] border-b border-[var(--color-surface-3)] mb-8">
          <Link
            to="/student/dashboard"
            className="hover:text-[var(--color-text-primary)] flex items-center gap-1 transition-colors"
          >
            <ArrowLeft size={14} /> Back to My Passes
          </Link>
          <span>/</span>
          <span className="text-[var(--color-text-primary)] font-medium">Digital Pass</span>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full border-2 border-[var(--color-surface-3)] border-t-[var(--color-brand-cyan)] animate-spin mb-4" />
            <span className="text-xs text-[var(--color-text-muted)]">
              Decrypting and verifying digital ticket…
            </span>
          </div>
        ) : error || !registration ? (
          <div className="max-w-md mx-auto py-16 text-center flex flex-col items-center glass p-8 rounded-2xl border border-[var(--color-surface-3)]">
            <AlertCircle size={36} className="text-rose-400 mb-3" />
            <h2 className="text-xl font-bold font-display text-[var(--color-text-primary)] mb-2">
              Pass Unavailable
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)] mb-6">
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
            <DigitalTicketCard
              registration={registration}
              studentName={profile?.display_name || 'FestFlow Student'}
              onCancel={() => setShowCancelModal(true)}
            />
          </div>
        )}

        {/* Cancellation Confirmation Modal */}
        <AnimatePresence>
          {showCancelModal && registration && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                className="w-full max-w-md p-6 rounded-2xl glass border border-rose-500/30 text-left flex flex-col gap-4 shadow-2xl"
              >
                <div className="flex items-center gap-3 text-rose-400">
                  <div className="p-2.5 rounded-xl bg-rose-500/15">
                    <AlertTriangle size={24} />
                  </div>
                  <h3 className="text-lg font-bold font-display text-[var(--color-text-primary)]">
                    Cancel Pass Registration?
                  </h3>
                </div>

                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Are you sure you want to cancel your entry pass for{' '}
                  <strong className="text-[var(--color-text-primary)]">
                    {registration.event.title}
                  </strong>
                  ? Your seat will be released immediately for other campus students, and this QR pass will become void.
                </p>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={actionLoading}
                    onClick={() => setShowCancelModal(false)}
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
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageShell>
  )
}
