import { useState, useEffect } from 'react'
import { Clock, AlertTriangle } from 'lucide-react'
import { formatHoldExpiry } from '@/lib/seating'

interface HoldCountdownProps {
  heldUntil: string | null | undefined
  onExpired?: () => void
  className?: string
}

export function HoldCountdown({ heldUntil, onExpired, className = '' }: HoldCountdownProps) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const { label, isExpiringSoon, isExpired } = formatHoldExpiry(heldUntil)

  useEffect(() => {
    if (isExpired) onExpired?.()
  }, [isExpired, onExpired])

  if (!heldUntil) return null

  if (isExpired) {
    return (
      <div className={`flex items-center gap-1.5 text-sm font-semibold text-red-400 ${className}`}>
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        Hold expired — please reselect your seats
      </div>
    )
  }

  return (
    <div
      className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${
        isExpiringSoon ? 'text-amber-400' : 'text-[#18CFFC]'
      } ${className}`}
    >
      {isExpiringSoon ? (
        <AlertTriangle className="w-4 h-4 flex-shrink-0 animate-pulse" />
      ) : (
        <Clock className="w-4 h-4 flex-shrink-0" />
      )}
      <span>Seat hold: {label}</span>
      {isExpiringSoon && <span className="text-xs font-normal text-amber-300">— complete payment soon!</span>}
    </div>
  )
}

