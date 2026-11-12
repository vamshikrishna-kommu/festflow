import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import {
  ArrowLeft,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Ticket,
} from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Button, Badge } from '@/components/ui'
import { SeatMap } from '@/components/seating/SeatMap'
import { SeatSelectionSummary } from '@/components/seating/SeatSelectionSummary'
import { SeatedCheckout } from '@/components/seating/SeatedCheckout'
import { getEventBySlug, getEventById } from '@/lib/events'
import { reserveSeats, releaseHold } from '@/lib/seating'
import { registerForEvent, checkStudentRegistrationForEvent } from '@/lib/registrations'
import { useAuth } from '@/context/AuthContext'
import type {
  EventWithClub,
  RegistrationRecord,
  SeatWithAvailability,
  ReserveSeatsSuccess,
  ReserveSeatsResult,
} from '@/types'

export default function SeatBookingPage() {
  const { slug, id } = useParams<{ slug?: string; id?: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [event, setEvent] = useState<EventWithClub | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [existingReg, setExistingReg] = useState<RegistrationRecord | null>(null)

  // Selection & Reservation state
  const [selectedSeats, setSelectedSeats] = useState<SeatWithAvailability[]>([])
  const [reservationResult, setReservationResult] = useState<ReserveSeatsSuccess | null>(null)
  const [isReserving, setIsReserving] = useState(false)
  const [reserveError, setReserveError] = useState<string | null>(null)
  const [registrationId, setRegistrationId] = useState<string | null>(null)

  // Checkout modal / step
  const [showCheckout, setShowCheckout] = useState(false)

  // Load event
  useEffect(() => {
    let active = true
    setLoading(true)

    const fetchEvent = async () => {
      if (slug) {
        const res = await getEventBySlug(slug)
        return res.event
      }
      if (id) {
        const res = await getEventById(id)
        return res.event as EventWithClub | null
      }
      return null
    }

    fetchEvent()
      .then((ev) => {
        if (!active) return
        if (!ev) {
          setError('Event not found')
        } else {
          setEvent(ev)
          if (user?.id) {
            checkStudentRegistrationForEvent(ev.id, user.id).then((reg) => {
              if (active) setExistingReg(reg.registration)
            })
          }
        }
        setLoading(false)
      })
      .catch((err) => {
        if (active) {
          setError(err?.message || 'Failed to load event')
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [slug, id, user?.id])

  // Handle seat reservation
  const handleReserve = async () => {
    if (!event || !user || selectedSeats.length === 0) return

    // If already held, open checkout
    if (reservationResult) {
      setShowCheckout(true)
      return
    }

    setIsReserving(true)
    setReserveError(null)

    const idempotencyKey = `hold_${user.id}_${event.id}_${Date.now()}`
    const seatIds = selectedSeats.map((s) => s.id)

    try {
      const res: ReserveSeatsResult = await reserveSeats(event.id, seatIds, idempotencyKey)

      if (!res.success) {
        setReserveError(res.message || 'Unable to reserve selected seats. Please try another selection.')
        setIsReserving(false)
        return
      }

      setReservationResult(res)

      // Create base registration if not already present
      const regRes = await registerForEvent(event.id, user.id, {
        participantDetails: {
          student_name: profile?.display_name || user.email || 'Student',
          email: user.email || '',
        },
        seatReservationId: res.reservation_ids[0],
      })

      if (regRes.success && regRes.registration_id) {
        setRegistrationId(regRes.registration_id)
      }

      // If free, we can mark complete immediately or go to checkout for confirmation
      setShowCheckout(true)
    } catch (err: any) {
      setReserveError(err?.message || 'Failed to reserve seats. Please try again.')
    } finally {
      setIsReserving(false)
    }
  }

  const handleClearSelection = async () => {
    if (reservationResult?.reservation_ids?.length) {
      await releaseHold(reservationResult.reservation_ids)
    }
    setReservationResult(null)
    setSelectedSeats([])
    setReserveError(null)
  }

  const handleExpired = () => {
    setReservationResult(null)
    setSelectedSeats([])
    setShowCheckout(false)
    setReserveError('Your seat hold has expired. Please select your seats again.')
  }

  if (loading) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="w-8 h-8 text-[#18CFFC] animate-spin" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading seat reservation…</p>
        </div>
      </PageShell>
    )
  }

  if (error || !event) {
    return (
      <PageShell>
        <div className="max-w-xl mx-auto py-16 px-4 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Event Not Available</h1>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">{error || 'This event could not be found.'}</p>
          <Link to="/discover">
            <Button variant="primary">Browse Events</Button>
          </Link>
        </div>
      </PageShell>
    )
  }

  // If user already has a confirmed registration
  if (existingReg && existingReg.status === 'confirmed') {
    return (
      <PageShell>
        <div className="max-w-md mx-auto py-16 px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">You&apos;re Already Registered!</h1>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">
            You already hold a confirmed pass for {event.title}.
          </p>
          <div className="flex justify-center gap-3">
            <Link to={`/student/tickets/${existingReg.id}`}>
              <Button variant="primary">
                <Ticket className="w-4 h-4 mr-2" />
                View Ticket
              </Button>
            </Link>
            <Link to="/student/dashboard">
              <Button variant="outline">My Dashboard</Button>
            </Link>
          </div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Navigation & Event Header */}
        <div className="mb-6">
          <Link
            to={`/events/${event.slug || event.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-[#18CFFC] transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Event Details
          </Link>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="cyan">Interactive Seating</Badge>
                {event.club?.display_name && (
                  <span className="text-xs text-[var(--color-text-muted)]">by {event.club.display_name}</span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">
                {event.title}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--color-text-muted)]">
              {event.start_date && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#18CFFC]" />
                  <span>
                    {new Date(event.start_date).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              )}
              {event.venue_name && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#ED47FC]" />
                  <span>{event.venue_name}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Seat Map */}
        <div className="bg-[var(--color-surface-1)] rounded-2xl border border-white/5 p-4 sm:p-6 mb-24">
          <SeatMap
            eventId={event.id}
            maxSelectableSeats={1}
            onSeatsSelected={setSelectedSeats}
            disabled={!!reservationResult}
          />
        </div>

        {/* Floating Selection Bar */}
        <SeatSelectionSummary
          selectedSeats={selectedSeats}
          maxSeats={1}
          reservationResult={reservationResult}
          isReserving={isReserving}
          reserveError={reserveError}
          onConfirm={handleReserve}
          onClear={handleClearSelection}
          onExpired={handleExpired}
        />

        {/* Checkout Modal */}
        <AnimatePresence>
          {showCheckout && reservationResult && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-lg bg-[var(--color-surface-1)] border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
                  <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                    Complete Seat Reservation
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowCheckout(false)}
                    className="text-[var(--color-text-muted)] hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <SeatedCheckout
                  eventId={event.id}
                  clubId={event.club_id}
                  registrationId={registrationId || ''}
                  reservationResult={reservationResult}
                  selectedSeats={selectedSeats}
                  onSuccess={() => {
                    setTimeout(() => {
                      navigate(registrationId ? `/student/tickets/${registrationId}` : '/student/dashboard')
                    }, 2500)
                  }}
                  onExpired={handleExpired}
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </PageShell>
  )
}
