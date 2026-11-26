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
      bg: '#2563EB',
      border: '#1D4ED8',
      text: '#FFFFFF',
    }
  }
  switch (status) {
    case 'available':
      return {
        bg: catColor + '1A',
        border: catColor + '99',
        text: catColor,
      }
    case 'my_hold':
      return {
        bg: '#DBEAFE',
        border: '#2563EB',
        text: '#1D4ED8',
      }
    case 'held':
    case 'payment_submitted':
    case 'payment_under_review':
      return { bg: '#F3F4F6', border: '#9CA3AF', text: '#6B7280' }
    case 'confirmed':
      return { bg: '#E5E7EB', border: '#9CA3AF', text: '#6B7280' }
    case 'blocked':
      return { bg: '#F3F4F6', border: '#D1D5DB', text: '#9CA3AF' }
    default:
      return { bg: 'transparent', border: 'transparent', text: 'transparent' }
  }
}

export function SeatButton({ seat, isSelected, onClick, disabled }: SeatButtonProps) {
  if (seat.is_aisle_gap) {
    return <div className="w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0" aria-hidden />
  }

  const catColor = seat.category?.color ?? '#2563EB'
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
          ? 'cursor-pointer hover:scale-110 active:scale-95'
          : 'cursor-not-allowed opacity-55'
        }
        ${isSelected ? 'scale-110 shadow-sm ring-2 ring-blue-600/25' : ''}
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

