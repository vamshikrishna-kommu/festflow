import { useState, useEffect } from 'react'
import { Clock, Radio } from 'lucide-react'

interface EventCountdownProps {
  targetDate: string | null | undefined
  endDate?: string | null | undefined
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  className?: string
}

interface TimeRemaining {
  days: number
  hours: number
  minutes: number
  seconds: number
  isLive: boolean
  isEnded: boolean
  isInvalid: boolean
}

function calculateRemaining(startIso: string | null | undefined, endIso?: string | null | undefined): TimeRemaining {
  if (!startIso) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isLive: false, isEnded: false, isInvalid: true }
  }

  const startTime = new Date(startIso).getTime()
  if (isNaN(startTime)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isLive: false, isEnded: false, isInvalid: true }
  }

  const now = Date.now()
  const endTime = endIso ? new Date(endIso).getTime() : startTime + 3 * 3600 * 1000

  // Event has ended
  if (now > endTime) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isLive: false, isEnded: true, isInvalid: false }
  }

  // Event is currently live
  if (now >= startTime && now <= endTime) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isLive: true, isEnded: false, isInvalid: false }
  }

  const diffMs = Math.max(startTime - now, 0)
  const totalSeconds = Math.floor(diffMs / 1000)

  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return { days, hours, minutes, seconds, isLive: false, isEnded: false, isInvalid: false }
}

export function EventCountdown({
  targetDate,
  endDate,
  size = 'md',
  showIcon = true,
  className = '',
}: EventCountdownProps) {
  const [remaining, setRemaining] = useState<TimeRemaining>(() => calculateRemaining(targetDate, endDate))

  useEffect(() => {
    // Initial sync
    setRemaining(calculateRemaining(targetDate, endDate))

    const intervalId = window.setInterval(() => {
      const next = calculateRemaining(targetDate, endDate)
      setRemaining(next)
      if (next.isEnded) {
        clearInterval(intervalId)
      }
    }, 1000)

    return () => clearInterval(intervalId)
  }, [targetDate, endDate])

  if (remaining.isInvalid) {
    return null
  }

  if (remaining.isEnded) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-800/80 text-zinc-400 border border-white/5 ${className}`}>
        <Clock size={13} className="text-zinc-500" />
        <span>Event Concluded</span>
      </div>
    )
  }

  if (remaining.isLive) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.25)] animate-pulse ${className}`}>
        <Radio size={14} className="animate-spin text-emerald-400" />
        <span>HAPPENING NOW</span>
      </div>
    )
  }

  const isSmall = size === 'sm'
  const isLarge = size === 'lg'

  return (
    <div className={`flex items-center gap-1 sm:gap-1.5 font-mono select-none ${className}`}>
      {showIcon && (
        <span className="text-[#18CFFC] mr-1 hidden sm:inline-block">
          <Clock size={isSmall ? 13 : isLarge ? 17 : 14} />
        </span>
      )}

      {/* Days */}
      <div className="flex flex-col items-center">
        <div className={`rounded-lg bg-[#14141A] border border-white/10 flex items-center justify-center font-bold text-white shadow-inner ${
          isSmall ? 'w-7 h-7 text-xs' : isLarge ? 'w-11 h-11 text-lg' : 'w-9 h-9 text-sm'
        }`}>
          {String(remaining.days).padStart(2, '0')}
        </div>
        <span className="text-[9px] uppercase tracking-wider text-zinc-500 mt-0.5">d</span>
      </div>

      <span className="text-zinc-600 font-bold mb-3">:</span>

      {/* Hours */}
      <div className="flex flex-col items-center">
        <div className={`rounded-lg bg-[#14141A] border border-white/10 flex items-center justify-center font-bold text-white shadow-inner ${
          isSmall ? 'w-7 h-7 text-xs' : isLarge ? 'w-11 h-11 text-lg' : 'w-9 h-9 text-sm'
        }`}>
          {String(remaining.hours).padStart(2, '0')}
        </div>
        <span className="text-[9px] uppercase tracking-wider text-zinc-500 mt-0.5">h</span>
      </div>

      <span className="text-zinc-600 font-bold mb-3">:</span>

      {/* Minutes */}
      <div className="flex flex-col items-center">
        <div className={`rounded-lg bg-[#14141A] border border-white/10 flex items-center justify-center font-bold text-white shadow-inner ${
          isSmall ? 'w-7 h-7 text-xs' : isLarge ? 'w-11 h-11 text-lg' : 'w-9 h-9 text-sm'
        }`}>
          {String(remaining.minutes).padStart(2, '0')}
        </div>
        <span className="text-[9px] uppercase tracking-wider text-zinc-500 mt-0.5">m</span>
      </div>

      <span className="text-zinc-600 font-bold mb-3">:</span>

      {/* Seconds */}
      <div className="flex flex-col items-center">
        <div className={`rounded-lg bg-[#14141A] border border-[#18CFFC]/30 flex items-center justify-center font-bold text-[#18CFFC] shadow-[0_0_10px_rgba(24,207,252,0.15)] ${
          isSmall ? 'w-7 h-7 text-xs' : isLarge ? 'w-11 h-11 text-lg' : 'w-9 h-9 text-sm'
        }`}>
          {String(remaining.seconds).padStart(2, '0')}
        </div>
        <span className="text-[9px] uppercase tracking-wider text-[#18CFFC] mt-0.5">s</span>
      </div>
    </div>
  )
}
