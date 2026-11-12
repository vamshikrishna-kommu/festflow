import { Link } from 'react-router'
import { motion } from 'motion/react'
import {
  CheckCircle2,
  Clock,
  Ticket,
  Calendar,
  MapPin,
  Building2,
  User,
} from 'lucide-react'
import { Button, Badge } from '@/components/ui'
import type { EventWithClub } from '@/types'
import type { ReserveSeatItem, SeatParticipant } from '@/types/seating'

interface BookingSuccessStageProps {
  event: EventWithClub
  registrationId: string
  ticketCode?: string
  isFreeEvent: boolean
  seats: ReserveSeatItem[]
  participants: SeatParticipant[]
  totalPrice: number
}

export function BookingSuccessStage({
  event,
  registrationId,
  ticketCode,
  isFreeEvent,
  seats,
  participants,
  totalPrice,
}: BookingSuccessStageProps) {
  const isConfirmed = isFreeEvent || totalPrice === 0

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-2xl mx-auto space-y-6"
    >
      {/* Top Banner: Status Header */}
      <div
        className={`rounded-3xl border p-6 sm:p-8 text-center shadow-2xl ${
          isConfirmed
            ? 'bg-gradient-to-b from-emerald-500/15 to-emerald-500/5 border-emerald-500/30'
            : 'bg-gradient-to-b from-amber-500/15 to-amber-500/5 border-amber-500/30'
        }`}
      >
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            isConfirmed
              ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
              : 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
          }`}
        >
          {isConfirmed ? (
            <CheckCircle2 className="w-9 h-9" />
          ) : (
            <Clock className="w-9 h-9 animate-pulse" />
          )}
        </div>

        <Badge variant={isConfirmed ? 'success' : 'amber'} className="mb-2">
          {isConfirmed ? 'Booking Confirmed' : 'Payment Submitted — Awaiting Verification'}
        </Badge>

        <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
          {isConfirmed ? 'Your Seats are Confirmed!' : 'Seat Hold Locked for Review!'}
        </h2>

        <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto mt-2">
          {isConfirmed
            ? `Your digital ticket pass has been generated for ${event.title}. Entry will be validated using your ticket.`
            : `Your payment proof has been submitted to ${event.club?.display_name || 'the event organizer'}. Your seat(s) remain safely reserved while your transaction reference is verified.`}
        </p>

        {ticketCode && (
          <div className="mt-5 inline-flex flex-col items-center p-3 rounded-2xl bg-[var(--color-surface-2)]/80 border border-white/10">
            <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">
              Registration Reference
            </span>
            <span className="text-base font-mono font-black text-[#18CFFC] tracking-wider">
              {ticketCode}
            </span>
          </div>
        )}
      </div>

      {/* Booking Details Card */}
      <div className="bg-[var(--color-surface-1)] border border-white/10 rounded-2xl p-6 shadow-xl space-y-5">
        <div>
          <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-1">
            {event.title}
          </h3>
          <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--color-text-muted)]">
            {event.club?.display_name && (
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#18CFFC]" />
                <span>{event.club.display_name}</span>
              </div>
            )}
            {event.start_date && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#18CFFC]" />
                <span>
                  {new Date(event.start_date).toLocaleDateString('en-IN', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
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

        {/* Assigned Seats */}
        <div className="border-t border-white/5 pt-4">
          <h4 className="text-xs uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-3">
            Reserved Seats ({seats.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {seats.map((seat, idx) => {
              const participant = participants[idx]
              return (
                <div
                  key={seat.seat_id}
                  className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-white/5 flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: seat.category_color || '#18CFFC' }}
                      />
                      <span className="font-bold text-sm text-[var(--color-text-primary)]">
                        Seat {seat.display_label}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {seat.category_name} Tier • {seat.price === 0 ? 'Free' : `₹${seat.price}`}
                    </div>
                    {participant && (
                      <div className="text-xs text-[var(--color-text-primary)] font-medium mt-1 flex items-center gap-1">
                        <User className="w-3 h-3 text-[var(--color-text-muted)]" />
                        <span>{participant.student_name}</span>
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-[var(--color-text-muted)] border border-white/5 font-mono">
                    {isConfirmed ? 'CONFIRMED' : 'HELD'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Payment Summary */}
        <div className="border-t border-white/5 pt-4 flex items-center justify-between text-sm">
          <span className="text-[var(--color-text-muted)]">Payment Status</span>
          <span className="font-semibold text-[var(--color-text-primary)]">
            {isConfirmed
              ? 'Free Event (Confirmed)'
              : `₹${totalPrice.toLocaleString('en-IN')} (Pending Club Verification)`}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        {registrationId && (
          <Link to={`/student/tickets/${registrationId}`} className="w-full sm:w-auto">
            <Button
              variant="primary"
              className="w-full bg-gradient-to-r from-[#18CFFC] to-[#0D56FB] text-black font-bold"
            >
              <Ticket className="w-4 h-4 mr-1.5" />
              View Digital Pass
            </Button>
          </Link>
        )}

        <Link to="/student/dashboard" className="w-full sm:w-auto">
          <Button variant="outline" className="w-full">
            My Tickets & Dashboard
          </Button>
        </Link>

        <Link to={`/events/${event.slug || event.id}`} className="w-full sm:w-auto">
          <Button variant="ghost" className="w-full text-xs text-[var(--color-text-muted)]">
            Back to Event
          </Button>
        </Link>
      </div>
    </motion.div>
  )
}
