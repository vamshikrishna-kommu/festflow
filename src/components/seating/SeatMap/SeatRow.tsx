import { SeatButton } from './SeatButton'
import type { SeatWithAvailability } from '@/types/seating'

interface SeatRowProps {
  rowIdentifier: string
  seats: SeatWithAvailability[]
  selectedSeatIds: Set<string>
  onSeatClick: (seat: SeatWithAvailability) => void
  disabled?: boolean
}

export function SeatRow({ rowIdentifier, seats, selectedSeatIds, onSeatClick, disabled }: SeatRowProps) {
  return (
    <div className="flex items-center gap-1" role="row" aria-label={`Row ${rowIdentifier}`}>
      {/* Row label */}
      <div className="w-5 sm:w-6 flex-shrink-0 text-center text-[10px] sm:text-xs font-bold text-[var(--color-text-muted)]" aria-hidden>
        {rowIdentifier}
      </div>
      {/* Seats */}
      <div className="flex items-center gap-0.5 sm:gap-1">
        {seats.map((seat) => (
          <SeatButton
            key={seat.id}
            seat={seat}
            isSelected={selectedSeatIds.has(seat.id)}
            onClick={() => onSeatClick(seat)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  )
}

