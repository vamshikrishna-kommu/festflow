import { motion, AnimatePresence } from 'motion/react'
import { IndianRupee, ArrowRight, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { HoldCountdown } from './HoldCountdown'
import type { SeatWithAvailability, ReserveSeatsSuccess } from '@/types/seating'

interface SeatSelectionSummaryProps {
  selectedSeats: SeatWithAvailability[]
  maxSeats: number
  reservationResult: ReserveSeatsSuccess | null
  isReserving: boolean
  reserveError: string | null
  onConfirm: () => void
  onClear: () => void
  onExpired: () => void
}

export function SeatSelectionSummary({
  selectedSeats,
  maxSeats,
  reservationResult,
  isReserving,
  reserveError,
  onConfirm,
  onClear,
  onExpired,
}: SeatSelectionSummaryProps) {
  const hasSelection = selectedSeats.length > 0
  const isHeld = !!reservationResult

  const totalPrice = reservationResult
    ? reservationResult.total_price
    : selectedSeats.reduce((sum, s) => sum + (s.category?.price ?? 0), 0)

  return (
    <div className="sticky bottom-0 z-20">
      <AnimatePresence>
        {hasSelection && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white/95 backdrop-blur-md border border-gray-200 p-4 rounded-t-2xl shadow-[0_-8px_24px_rgba(0,0,0,0.08)]"
          >
            {/* Hold timer */}
            {reservationResult && (
              <div className="mb-3">
                <HoldCountdown heldUntil={reservationResult.held_until} onExpired={onExpired} />
              </div>
            )}

            {/* Selected seats */}
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedSeats.map((seat) => (
                <div
                  key={seat.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-sm"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: seat.category?.color ?? '#2563EB' }}
                  />
                  <span className="text-gray-900 font-semibold font-mono">{seat.display_label}</span>
                  {seat.category && (
                    <span className="text-gray-500 text-xs">{seat.category.name}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Price + actions */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-gray-500 font-medium">
                  {selectedSeats.length} seat{selectedSeats.length > 1 ? 's' : ''}
                  {maxSeats > 1 && ` of ${maxSeats} max`}
                </div>
                <div className="flex items-center gap-1 text-lg font-bold text-gray-900">
                  <IndianRupee className="w-4 h-4 text-blue-600" />
                  {totalPrice === 0 ? (
                    <span className="text-emerald-600">Free</span>
                  ) : (
                    <span>{totalPrice.toLocaleString('en-IN')}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!isHeld && (
                  <button
                    type="button"
                    onClick={onClear}
                    className="p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Clear selection"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <Button
                  variant="primary"
                  onClick={onConfirm}
                  isLoading={isReserving}
                  disabled={isReserving || selectedSeats.length === 0}
                >
                  {isHeld ? (
                    <>
                      Continue to Details
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  ) : (
                    <>
                      Hold Seats & Continue
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            {reserveError && (
              <p className="mt-2 text-sm text-rose-600">{reserveError}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
