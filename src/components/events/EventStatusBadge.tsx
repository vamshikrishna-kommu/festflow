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
    emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    cyan: 'bg-[#18CFFC]/15 text-[#18CFFC] border-[#18CFFC]/30',
    purple: 'bg-[#7F1AFB]/15 text-[#ED47FC] border-[#7F1AFB]/30',
    zinc: 'bg-zinc-800/80 text-zinc-400 border-white/10',
  }[details.color]

  const getIcon = () => {
    switch (details.status) {
      case 'live':
        return <Radio size={11} className="animate-pulse text-emerald-400" />
      case 'filling_fast':
      case 'almost_full':
      case 'draft':
        return <Flame size={11} className="text-amber-400" />
      case 'upcoming':
        return <Clock size={11} className="text-[#18CFFC]" />
      case 'sold_out':
        return <Users size={11} className="text-rose-400" />
      case 'cancelled':
        return <AlertTriangle size={11} className="text-rose-400" />
      case 'completed':
        return <CheckCircle size={11} className="text-zinc-500" />
      default:
        return null
    }
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border backdrop-blur-md shadow-sm select-none ${variantStyles} ${className}`}
    >
      {showIcon && getIcon()}
      <span>{details.label}</span>
    </span>
  )
}

