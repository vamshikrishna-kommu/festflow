import type { SeatWithAvailability } from '@/types/seating'

interface SeatButtonProps {
  seat: SeatWithAvailability
  isSelected: boolean
  onClick: () => void
  disabled?: boolean
}

function getSeatColors(status: SeatWithAvailability['status'], catColor: string, isSelected: boolean) {
  if (isSelected) {
    return {
      bg: '#18CFFC',
      border: '#18CFFC',
      text: '#08080A',
    }
  }
  switch (status) {
    case 'available':
      return {
        bg: catColor + '22',
        border: catColor + '88',
        text: catColor,
      }
    case 'my_hold':
      return {
        bg: '#18CFFC33',
        border: '#18CFFC',
        text: '#18CFFC',
      }
    case 'held':
    case 'payment_submitted':
    case 'payment_under_review':
      return { bg: '#6B728033', border: '#6B7280', text: '#6B7280' }
    case 'confirmed':
      return { bg: '#6B728033', border: '#374151', text: '#374151' }
    case 'blocked':
      return { bg: '#1F293733', border: '#374151', text: '#374151' }
    default:
      return { bg: 'transparent', border: 'transparent', text: 'transparent' }
  }
}

export function SeatButton({ seat, isSelected, onClick, disabled }: SeatButtonProps) {
  if (seat.is_aisle_gap) {
    return <div className="w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0" aria-hidden />
  }

  const catColor = seat.category?.color ?? '#18CFFC'
  const colors = getSeatColors(seat.status, catColor, isSelected)
  const isUnavailable = ['held', 'payment_submitted', 'payment_under_review', 'confirmed', 'blocked'].includes(seat.status)
  const isClickable = !isUnavailable && !disabled

  const label = seat.display_label.replace(seat.row_identifier, '')

  return (
    <button
      type="button"
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      aria-label={`Seat ${seat.display_label}${seat.is_accessible ? ', Accessible' : ''} — ${seat.status}`}
      aria-pressed={isSelected}
      className={`
        relative w-8 h-8 sm:w-9 sm:h-9 rounded-md flex-shrink-0 flex items-center justify-center
        text-[9px] sm:text-[10px] font-bold border-2 transition-all duration-150
        ${isClickable
          ? 'cursor-pointer hover:scale-110 hover:brightness-125 active:scale-95'
          : 'cursor-not-allowed opacity-40'
        }
        ${isSelected ? 'scale-110 shadow-[0_0_12px_rgba(24,207,252,0.6)]' : ''}
      `}
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        color: colors.text,
      }}
      title={`${seat.display_label}${seat.category ? ` (${seat.category.name})` : ''}${seat.is_accessible ? ' ♿' : ''} — ${seat.status}`}
    >
      {label}
      {seat.is_accessible && (
        <span className="absolute -top-1 -right-1 text-[8px] leading-none">♿</span>
      )}
    </button>
  )
}

