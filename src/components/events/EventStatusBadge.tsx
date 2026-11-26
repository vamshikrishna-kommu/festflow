import { calculateEventStatus, type EventStatusDetails } from '@/lib/eventStatus'
import { Flame, Clock, Radio, CheckCircle, AlertTriangle, Users } from 'lucide-react'

interface EventStatusBadgeProps {
  event: {
    status?: string
    startDate?: string
    endDate?: string
    date?: string
    registrationDeadline?: string | null
    registration_opens_at?: string | null
    registration_closes_at?: string | null
    start_date?: string
    end_date?: string
    timezone?: string | null
    capacity?: number
    registeredCount?: number
  }
  showIcon?: boolean
  className?: string
}

export function EventStatusBadge({ event, showIcon = true, className = '' }: EventStatusBadgeProps) {
  const details: EventStatusDetails = calculateEventStatus(event)

  const variantStyles = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    cyan: 'bg-sky-50 text-sky-700 border-sky-200',
    purple: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    zinc: 'bg-gray-100 text-gray-600 border-gray-200',
  }[details.color]

  const getIcon = () => {
    switch (details.status) {
      case 'live':
        return <Radio size={11} className="text-emerald-600" />
      case 'filling_fast':
      case 'almost_full':
      case 'draft':
        return <Flame size={11} className="text-amber-600" />
      case 'upcoming':
        return <Clock size={11} className="text-blue-600" />
      case 'sold_out':
        return <Users size={11} className="text-rose-600" />
      case 'cancelled':
        return <AlertTriangle size={11} className="text-rose-600" />
      case 'completed':
        return <CheckCircle size={11} className="text-gray-500" />
      default:
        return null
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border select-none ${variantStyles} ${className}`}
    >
      {showIcon && getIcon()}
      <span>{details.label}</span>
    </span>
  )
}
