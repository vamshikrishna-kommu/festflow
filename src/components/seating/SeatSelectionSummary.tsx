import { motion, AnimatePresence } from 'motion/react'
import { Ticket, IndianRupee, ArrowRight, X } from 'lucide-react'
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
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="bg-[var(--color-surface-1)]/95 backdrop-blur-xl border-t border-white/10 p-4 rounded-t-2xl shadow-2xl"
          >
            {/* Hold timer (shown after reservation) */}
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
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--color-surface-2)] border border-white/10 text-sm"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: seat.category?.color ?? '#18CFFC' }}
                  />
                  <span className="text-[var(--color-text-primary)] font-medium">{seat.display_label}</span>
                  {seat.category && (
                    <span className="text-[var(--color-text-muted)] text-xs">{seat.category.name}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Price + actions */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {selectedSeats.length} seat{selectedSeats.length > 1 ? 's' : ''}
                  {maxSeats > 1 && ` of ${maxSeats} max`}
                </div>
                <div className="flex items-center gap-1 text-lg font-bold text-[var(--color-text-primary)]">
                  <IndianRupee className="w-4 h-4 text-[#18CFFC]" />
                  {totalPrice === 0 ? (
                    <span className="text-emerald-400">Free</span>
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
                    className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-900/20 transition-colors"
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
                  className="bg-gradient-to-r from-[#18CFFC] to-[#0D56FB] text-[#08080A] font-semibold"
                >
                  {isHeld ? (
                    <>
                      Proceed to Payment
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  ) : (
                    <>
                      Reserve Seats
                      <Ticket className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Reserve error */}
            {reserveError && (
              <p className="mt-2 text-sm text-red-400">{reserveError}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
