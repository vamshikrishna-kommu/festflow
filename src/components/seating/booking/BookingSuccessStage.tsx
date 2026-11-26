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
import { QRCodeSVG } from 'qrcode.react'
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
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="max-w-2xl mx-auto space-y-6 text-left"
    >
      {/* Top Banner: Status Header */}
      <div
        className={`rounded-2xl border p-6 sm:p-8 text-center shadow-xs ${
          isConfirmed
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-amber-50 border-amber-200'
        }`}
      >
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 border ${
            isConfirmed
              ? 'bg-emerald-100 border-emerald-200 text-emerald-700'
              : 'bg-amber-100 border-amber-200 text-amber-700'
          }`}
        >
          {isConfirmed ? (
            <CheckCircle2 className="w-8 h-8" />
          ) : (
            <Clock className="w-8 h-8" />
          )}
        </div>

        <Badge variant={isConfirmed ? 'success' : 'amber'} className="mb-2">
          {isConfirmed ? 'Booking Confirmed' : 'Payment Submitted — Awaiting Verification'}
        </Badge>

        <h2 className="text-2xl font-bold font-display text-gray-900">
          {isConfirmed ? 'Your Seats are Confirmed!' : 'Seat Hold Locked for Review!'}
        </h2>

        <p className="text-sm text-gray-600 max-w-md mx-auto mt-2">
          {isConfirmed
            ? `Your digital ticket pass has been generated for ${event.title}. Entry will be validated using your ticket.`
            : `Your payment proof has been submitted to ${event.club?.display_name || 'the event organizer'}. Your seat(s) remain safely reserved while your transaction reference is verified.`}
        </p>

        {ticketCode && (
          <div className="mt-5 flex flex-col items-center gap-3">
            {isConfirmed && (
              <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-xs inline-block">
                <QRCodeSVG
                  value={ticketCode}
                  size={150}
                  level="H"
                  includeMargin={false}
                />
              </div>
            )}
            <div className="inline-flex flex-col items-center p-3 rounded-xl bg-white border border-gray-200">
              <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                Registration Reference
              </span>
              <span className="text-base font-mono font-bold text-blue-600 tracking-wider">
                {ticketCode}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Booking Details Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-5">
        <div>
          <h3 className="text-base font-bold font-display text-gray-900 mb-1">
            {event.title}
          </h3>
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
            {event.club?.display_name && (
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-gray-400" />
                <span>{event.club.display_name}</span>
              </div>
            )}
            {event.start_date && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
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
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                <span>{event.venue_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Assigned Seats */}
        <div className="border-t border-gray-100 pt-4">
          <h4 className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-3">
            Reserved Seats ({seats.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {seats.map((seat, idx) => {
              const participant = participants[idx]
              return (
                <div
                  key={seat.seat_id}
                  className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: seat.category_color || '#2563EB' }}
                      />
                      <span className="font-bold text-sm text-gray-900 font-mono">
                        Seat {seat.display_label}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {seat.category_name} Tier • {seat.price === 0 ? 'Free' : `₹${seat.price}`}
                    </div>
                    {participant && (
                      <div className="text-xs text-gray-800 font-medium mt-1 flex items-center gap-1">
                        <User className="w-3 h-3 text-gray-400" />
                        <span>{participant.student_name}</span>
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-white text-gray-700 border border-gray-200 font-mono font-semibold">
                    {isConfirmed ? 'CONFIRMED' : 'HELD'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Payment Summary */}
        <div className="border-t border-gray-100 pt-4 flex items-center justify-between text-sm">
          <span className="text-gray-500 font-medium">Payment Status</span>
          <span className="font-semibold text-gray-900">
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
            <Button variant="primary" className="w-full" leftIcon={<Ticket className="w-4 h-4" />}>
              View Digital Pass
            </Button>
          </Link>
        )}

        <Link to="/student/dashboard" className="w-full sm:w-auto">
          <Button variant="secondary" className="w-full">
            My Tickets & Dashboard
          </Button>
        </Link>

        <Link to={`/events/${event.slug || event.id}`} className="w-full sm:w-auto">
          <Button variant="ghost" className="w-full text-xs text-gray-500">
            Back to Event
          </Button>
        </Link>
      </div>
    </motion.div>
  )
}
