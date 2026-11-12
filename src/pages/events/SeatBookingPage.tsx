import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useLocation, Link, useSearchParams } from 'react-router'
import {
  ArrowLeft,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Ticket,
  Clock,
} from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Button, Badge, Alert } from '@/components/ui'
import { SeatMap } from '@/components/seating/SeatMap'
import { SeatSelectionSummary } from '@/components/seating/SeatSelectionSummary'
import { BookingProgressBar } from '@/components/seating/booking/BookingProgressBar'
import { ParticipantDetailsStage } from '@/components/seating/booking/ParticipantDetailsStage'
import { SeatedPaymentStage } from '@/components/seating/booking/SeatedPaymentStage'
import { BookingSuccessStage } from '@/components/seating/booking/BookingSuccessStage'
import { getEventBySlug, getEventById } from '@/lib/events'
import {
  fetchSeatLayout,
  reserveSeats,
  releaseHold,
  fetchMyReservations,
  fetchSeatsByIds,
  confirmSeatReservations,
  saveBookingSession,
  loadBookingSession,
  clearBookingSession,
} from '@/lib/seating'
import { registerForEvent, checkStudentRegistrationForEvent, getRegistrationById } from '@/lib/registrations'
import { useAuth } from '@/context/AuthContext'
import type {
  EventWithClub,
  RegistrationRecord,
  SeatWithAvailability,
  ReserveSeatsSuccess,
  ReserveSeatsResult,
  SeatLayoutFull,
} from '@/types'
import type { BookingStage, SeatParticipant, ReserveSeatItem } from '@/types/seating'

export default function SeatBookingPage() {
  const { slug, id } = useParams<{ slug?: string; id?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user, profile, studentProfile } = useAuth()

  // Determine stage from URL
  const currentStage: BookingStage = useMemo(() => {
    const p = location.pathname.toLowerCase()
    if (p.endsWith('/details')) return 'details'
    if (p.endsWith('/payment')) return 'payment'
    if (p.endsWith('/success')) return 'success'
    return 'seats'
  }, [location.pathname])

  const [event, setEvent] = useState<EventWithClub | null>(null)
  const [layout, setLayout] = useState<SeatLayoutFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [existingReg, setExistingReg] = useState<RegistrationRecord | null>(null)

  // Booking state
  const [selectedSeats, setSelectedSeats] = useState<SeatWithAvailability[]>([])
  const [reservationResult, setReservationResult] = useState<ReserveSeatsSuccess | null>(null)
  const [isReserving, setIsReserving] = useState(false)
  const [reserveError, setReserveError] = useState<string | null>(null)
  const [registrationId, setRegistrationId] = useState<string | null>(searchParams.get('regId') || null)
  const [ticketCode, setTicketCode] = useState<string | null>(null)
  const [participants, setParticipants] = useState<SeatParticipant[]>([])

  // Submission loading
  const [isSubmittingDetails, setIsSubmittingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)

  const eventSlug = event?.slug || slug || ''
  const isFreeEvent = Boolean(event?.is_free || (reservationResult && reservationResult.total_price === 0))

  // ── Load Event & Layout ───────────────────────────────────────────────────
  useEffect(() => {
    let active = true
    setLoading(true)

    const fetchAll = async () => {
      let ev: EventWithClub | null = null
      if (slug) {
        const res = await getEventBySlug(slug)
        ev = res.event
      } else if (id) {
        const res = await getEventById(id)
        ev = res.event as EventWithClub | null
      }

      if (!ev) return { event: null, layout: null }

      const lay = await fetchSeatLayout(ev.id)
      return { event: ev, layout: lay }
    }

    fetchAll()
      .then(async ({ event: ev, layout: lay }) => {
        if (!active) return
        if (!ev) {
          setError('Event not found')
          setLoading(false)
          return
        }

        setEvent(ev)
        setLayout(lay)

        // Check if student already has a confirmed registration
        if (user?.id) {
          try {
            const regCheck = await checkStudentRegistrationForEvent(ev.id, user.id)
            if (active && regCheck.registration) {
              setExistingReg(regCheck.registration)
            }
          } catch {
            // ignore
          }

          // Check for active session or active hold
          const session = loadBookingSession(ev.id)
          if (session && session.reservationIds?.length) {
            setReservationResult({
              success: true,
              reservation_ids: session.reservationIds,
              held_until: session.heldUntil,
              total_price: session.totalPrice,
              seats: session.seats,
            })
            if (session.registrationId) setRegistrationId(session.registrationId)
            if (session.ticketCode) setTicketCode(session.ticketCode)
            if (session.participants?.length) setParticipants(session.participants)

            // Hydrate selectedSeats from seat IDs
            fetchSeatsByIds(session.seatIds).then((seats) => {
              if (active) setSelectedSeats(seats)
            })
          } else {
            // Fallback: check database for active hold
            try {
              const myHolds = await fetchMyReservations(ev.id)
              const activeHolds = myHolds.filter(
                (h) => h.status === 'held' && h.held_until && new Date(h.held_until).getTime() > Date.now()
              )
              if (active && activeHolds.length > 0) {
                const seatIds = activeHolds.map((h) => h.seat_id)
                const seats = await fetchSeatsByIds(seatIds)
                if (active && seats.length > 0) {
                  setSelectedSeats(seats)
                  const reserveItems: ReserveSeatItem[] = seats.map((s) => ({
                    seat_id: s.id,
                    display_label: s.display_label,
                    category_name: s.category?.name || 'Standard',
                    category_color: s.category?.color || '#18CFFC',
                    price: s.category?.price ?? 0,
                  }))
                  const totalPrice = reserveItems.reduce((sum, s) => sum + s.price, 0)
                  const heldUntil = activeHolds[0].held_until || new Date(Date.now() + 10 * 60000).toISOString()
                  const resObj: ReserveSeatsSuccess = {
                    success: true,
                    reservation_ids: activeHolds.map((h) => h.id),
                    held_until: heldUntil,
                    total_price: totalPrice,
                    seats: reserveItems,
                  }
                  setReservationResult(resObj)
                  saveBookingSession(ev.id, {
                    eventId: ev.id,
                    eventSlug: ev.slug,
                    reservationIds: resObj.reservation_ids,
                    seatIds,
                    seats: reserveItems,
                    totalPrice,
                    heldUntil,
                  })
                }
              }
            } catch {
              // ignore
            }
          }
        }

        // If regId was provided in query param, hydrate registration details
        const qRegId = searchParams.get('regId')
        if (qRegId) {
          getRegistrationById(qRegId).then((regRes) => {
            if (active && regRes.registration) {
              setRegistrationId(regRes.registration.id)
              setTicketCode(regRes.registration.ticket_code)
              const pd = regRes.registration.participant_details as any
              if (pd?.seat_allocations && Array.isArray(pd.seat_allocations)) {
                setParticipants(pd.seat_allocations)
              }
            }
          })
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
  }, [slug, id, user?.id, searchParams])

  // ── Guard: Ensure hold exists before entering details/payment ─────────────
  useEffect(() => {
    if (loading || !event) return

    if ((currentStage === 'details' || currentStage === 'payment') && !reservationResult) {
      // No active hold — redirect to seat selection
      navigate(`/events/${eventSlug}/seats`, { replace: true })
    }
  }, [currentStage, reservationResult, loading, event, eventSlug, navigate])

  // ── Step 2: Handle Reserve (Seats -> Details) ─────────────────────────────
  const handleProceedToDetails = async () => {
    if (!event || !user || selectedSeats.length === 0) return

    // If hold already exists and still valid, navigate directly
    if (reservationResult) {
      if (new Date(reservationResult.held_until).getTime() > Date.now()) {
        navigate(`/events/${eventSlug}/seats/details`)
        return
      }
    }

    setIsReserving(true)
    setReserveError(null)

    const idempotencyKey = `hold_${user.id}_${event.id}_${Date.now()}`
    const seatIds = selectedSeats.map((s) => s.id)

    try {
      const res: ReserveSeatsResult = await reserveSeats(event.id, seatIds, idempotencyKey)

      if (!res.success) {
        setReserveError(res.message || 'Unable to reserve selected seats. Another user may have just booked them.')
        setIsReserving(false)
        return
      }

      setReservationResult(res)

      // Save to session storage
      saveBookingSession(event.id, {
        eventId: event.id,
        eventSlug: event.slug,
        reservationIds: res.reservation_ids,
        seatIds,
        seats: res.seats,
        totalPrice: res.total_price,
        heldUntil: res.held_until,
      })

      // Navigate to Step 3: Participant Details
      navigate(`/events/${eventSlug}/seats/details`)
    } catch (err: any) {
      setReserveError(err?.message || 'Failed to hold seats. Please try again.')
    } finally {
      setIsReserving(false)
    }
  }

  // ── Step 4: Handle Submit Participant Details ─────────────────────────────
  const handleSubmitParticipantDetails = async (data: {
    participants: SeatParticipant[]
    customResponses: Record<string, any>
    leadDetails: {
      student_name: string
      email: string
      phone: string
      college_name: string
      grad_year: string
      id_card_number?: string
    }
  }) => {
    if (!event || !user || !reservationResult) return

    setIsSubmittingDetails(true)
    setDetailsError(null)

    try {
      // Build full participant details payload linking all seat allocations
      const seatLabels = reservationResult.seats.map((s) => s.display_label).join(', ')
      const participantPayload = {
        ...data.leadDetails,
        seat_allocations: data.participants,
        seat_reservation_ids: reservationResult.reservation_ids,
        seat_details: {
          display_label: seatLabels,
          seats: reservationResult.seats.map((s) => s.display_label),
          category_name: reservationResult.seats[0]?.category_name || 'Reserved',
          category_color: reservationResult.seats[0]?.category_color || '#18CFFC',
          total_seats: reservationResult.seats.length,
          total_price: reservationResult.total_price,
        },
      }

      const regRes = await registerForEvent(event.id, user.id, {
        participantDetails: participantPayload,
        customResponses: data.customResponses,
        seatReservationId: reservationResult.reservation_ids[0],
        seatReservationIds: reservationResult.reservation_ids,
      })

      if (!regRes.success || !regRes.registration_id) {
        setDetailsError(regRes.message || 'Failed to complete registration.')
        setIsSubmittingDetails(false)
        return
      }

      setRegistrationId(regRes.registration_id)
      setTicketCode(regRes.ticket_code || null)
      setParticipants(data.participants)

      // Update session storage
      saveBookingSession(event.id, {
        eventId: event.id,
        eventSlug: event.slug,
        reservationIds: reservationResult.reservation_ids,
        seatIds: reservationResult.seats.map((s) => s.seat_id),
        seats: reservationResult.seats,
        totalPrice: reservationResult.total_price,
        heldUntil: reservationResult.held_until,
        registrationId: regRes.registration_id,
        ticketCode: regRes.ticket_code,
        participants: data.participants,
      })

      // Conditional payment routing: Free vs Paid
      if (reservationResult.total_price === 0 || event.is_free) {
        // Free event: confirm reservations immediately
        await confirmSeatReservations(regRes.registration_id, null)
        clearBookingSession(event.id)
        navigate(`/events/${eventSlug}/seats/success?regId=${regRes.registration_id}`)
      } else {
        // Paid event: navigate to payment stage
        navigate(`/events/${eventSlug}/seats/payment?regId=${regRes.registration_id}`)
      }
    } catch (err: any) {
      setDetailsError(err?.message || 'Registration failed. Please check your network and try again.')
    } finally {
      setIsSubmittingDetails(false)
    }
  }

  // ── Step 5: Handle Payment Complete (Paid -> Success) ─────────────────────
  const handlePaymentSuccess = () => {
    if (!event) return
    clearBookingSession(event.id)
    navigate(`/events/${eventSlug}/seats/success?regId=${registrationId}`)
  }

  // ── Hold Expiry & Clear ───────────────────────────────────────────────────
  const handleExpired = useCallback(() => {
    if (event) clearBookingSession(event.id)
    setReservationResult(null)
    setSelectedSeats([])
    setReserveError('Your seat hold has expired. Please select your seats again.')
    if (currentStage !== 'seats') {
      navigate(`/events/${eventSlug}/seats`)
    }
  }, [event, currentStage, eventSlug, navigate])

  const handleClearSelection = async () => {
    if (reservationResult?.reservation_ids?.length) {
      await releaseHold(reservationResult.reservation_ids)
    }
    if (event) clearBookingSession(event.id)
    setReservationResult(null)
    setSelectedSeats([])
    setReserveError(null)
  }

  // ── Loading & Errors ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="w-8 h-8 text-[#18CFFC] animate-spin" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading reserved seating…</p>
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

  // If user already has a confirmed registration for this event
  if (existingReg && existingReg.status === 'confirmed' && currentStage !== 'success') {
    return (
      <PageShell>
        <div className="max-w-md mx-auto py-16 px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">You&apos;re Already Registered!</h1>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">
            You already hold an active pass for {event.title}.
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

  const maxSeats = layout?.max_seats_per_registration || 1
  const seatReserveItems: ReserveSeatItem[] =
    reservationResult?.seats ||
    selectedSeats.map((s) => ({
      seat_id: s.id,
      display_label: s.display_label,
      category_name: s.category?.name || 'Standard',
      category_color: s.category?.color || '#18CFFC',
      price: s.category?.price ?? 0,
    }))

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
                <Badge variant="cyan">Reserved Seating</Badge>
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

        {/* Progress Bar for the 4-Stage Journey */}
        <BookingProgressBar currentStage={currentStage} isFreeEvent={isFreeEvent} />

        {/* ── STAGE 1: SEAT SELECTION ─────────────────────────────────────── */}
        {currentStage === 'seats' && (
          <div className="space-y-6">
            {/* Active Hold Banner if returning to /seats with valid hold */}
            {reservationResult && (
              <div className="bg-[#18CFFC]/10 border border-[#18CFFC]/25 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-5 h-5 text-[#18CFFC] flex-shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-[var(--color-text-primary)]">
                      You currently hold Seat(s): {reservationResult.seats.map((s) => s.display_label).join(', ')}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      Total: ₹{reservationResult.total_price} • Complete registration before timer expires.
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearSelection}
                    className="text-xs"
                  >
                    Release Seats
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate(`/events/${eventSlug}/seats/details`)}
                    className="text-xs bg-[#18CFFC] text-black font-bold"
                  >
                    Continue to Details →
                  </Button>
                </div>
              </div>
            )}

            {reserveError && (
              <Alert variant="error">
                <AlertCircle className="w-4 h-4 mr-2" />
                {reserveError}
              </Alert>
            )}

            {/* Seat Map */}
            <div className="bg-[var(--color-surface-1)] rounded-2xl border border-white/5 p-4 sm:p-6 mb-24">
              <SeatMap
                eventId={event.id}
                maxSelectableSeats={maxSeats}
                onSeatsSelected={setSelectedSeats}
                disabled={isReserving}
              />
            </div>

            {/* Floating Selection Bar */}
            <SeatSelectionSummary
              selectedSeats={selectedSeats}
              maxSeats={maxSeats}
              reservationResult={reservationResult}
              isReserving={isReserving}
              reserveError={reserveError}
              onConfirm={handleProceedToDetails}
              onClear={handleClearSelection}
              onExpired={handleExpired}
            />
          </div>
        )}

        {/* ── STAGE 2: PARTICIPANT DETAILS ─────────────────────────────────── */}
        {currentStage === 'details' && reservationResult && user && (
          <ParticipantDetailsStage
            event={event}
            user={user}
            profile={profile}
            studentProfile={studentProfile}
            seats={seatReserveItems}
            heldUntil={reservationResult.held_until}
            totalPrice={reservationResult.total_price}
            isSubmitting={isSubmittingDetails}
            error={detailsError}
            onBack={() => navigate(`/events/${eventSlug}/seats`)}
            onExpired={handleExpired}
            onSubmit={handleSubmitParticipantDetails}
          />
        )}

        {/* ── STAGE 3: SEATED PAYMENT ──────────────────────────────────────── */}
        {currentStage === 'payment' && reservationResult && registrationId && (
          <SeatedPaymentStage
            event={event}
            registrationId={registrationId}
            seats={seatReserveItems}
            participants={participants}
            totalPrice={reservationResult.total_price}
            heldUntil={reservationResult.held_until}
            onBack={() => navigate(`/events/${eventSlug}/seats/details`)}
            onExpired={handleExpired}
            onSuccess={handlePaymentSuccess}
          />
        )}

        {/* ── STAGE 4: BOOKING SUCCESS & PASS ──────────────────────────────── */}
        {currentStage === 'success' && (
          <BookingSuccessStage
            event={event}
            registrationId={registrationId || existingReg?.id || ''}
            ticketCode={ticketCode || existingReg?.ticket_code || undefined}
            isFreeEvent={isFreeEvent}
            seats={seatReserveItems}
            participants={participants}
            totalPrice={reservationResult?.total_price || 0}
          />
        )}
      </div>
    </PageShell>
  )
}
