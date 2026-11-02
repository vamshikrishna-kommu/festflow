import { useState } from 'react'
import { Clock, MapPin, User, Radio } from 'lucide-react'
import { Badge } from '@/components/ui'
import type { EventScheduleItem, ScheduleCategory } from '@/types'

interface EventScheduleSectionProps {
  schedules: EventScheduleItem[]
}

export function EventScheduleSection({ schedules }: EventScheduleSectionProps) {
  const [selectedDay, setSelectedDay] = useState<number>(1)

  if (!schedules || schedules.length === 0) return null

  // Extract unique day numbers
  const days = Array.from(new Set(schedules.map((s) => s.day_number || 1))).sort((a, b) => a - b)
  const activeDay = days.includes(selectedDay) ? selectedDay : days[0] || 1
  const daySchedules = schedules.filter((s) => (s.day_number || 1) === activeDay)

  const now = new Date()

  const getCategoryBadge = (cat: ScheduleCategory) => {
    switch (cat) {
      case 'keynote':
        return <Badge variant="cyan">Keynote</Badge>
      case 'workshop':
        return <Badge variant="purple">Workshop</Badge>
      case 'competition':
        return <Badge variant="pink">Challenge</Badge>
      case 'networking':
        return <Badge variant="blue">Networking</Badge>
      case 'panel':
        return <Badge variant="magenta">Panel</Badge>
      case 'ceremony':
        return <Badge variant="amber">Ceremony</Badge>
      case 'break':
        return <Badge variant="neutral">Refreshment</Badge>
      default:
        return <Badge variant="default">Session</Badge>
    }
  }

  const formatSessionTime = (isoTime: string) => {
    try {
      const d = new Date(isoTime)
      if (isNaN(d.getTime())) return isoTime
      return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
    } catch {
      return isoTime
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold font-heading text-white flex items-center gap-2">
            <Clock size={18} className="text-[#18CFFC]" />
            Event Schedule & Agenda
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Step-by-step sessions, keynotes, and track timeline
          </p>
        </div>

        {/* Multi-day switcher if more than 1 day */}
        {days.length > 1 && (
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#14141A] border border-white/10 shrink-0">
            {days.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDay(d)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeDay === d
                    ? 'bg-[#18CFFC] text-black shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Day {d}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chronological Agenda Timeline */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#0E0E12] border border-white/[0.08] flex flex-col gap-4">
        {daySchedules.map((session, index) => {
          const startTime = new Date(session.start_time)
          const endTime = session.end_time ? new Date(session.end_time) : null
          const isOngoing =
            !isNaN(startTime.getTime()) &&
            startTime <= now &&
            (!endTime || endTime >= now)

          const timeFormatted = formatSessionTime(session.start_time)
          const endTimeFormatted = session.end_time ? formatSessionTime(session.end_time) : null

          return (
            <div
              key={session.id || index}
              className={`p-3.5 sm:p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                isOngoing
                  ? 'bg-gradient-to-r from-[#18CFFC]/10 via-[#0E0E12] to-transparent border-[#18CFFC]/40 shadow-[0_0_20px_rgba(24,207,252,0.1)]'
                  : 'bg-[#14141A] border-white/[0.06] hover:border-white/15'
              }`}
            >
              {/* Left: Time and Title */}
              <div className="flex items-start gap-3.5">
                <div className="flex flex-col items-center shrink-0 min-w-[70px]">
                  <span className="font-mono text-xs font-bold text-[#18CFFC] bg-black/40 px-2 py-1 rounded-md border border-white/10 text-center w-full">
                    {timeFormatted}
                  </span>
                  {endTimeFormatted && (
                    <span className="text-[10px] text-zinc-500 font-mono mt-1">
                      to {endTimeFormatted}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-white">
                      {session.title}
                    </h4>
                    {getCategoryBadge(session.category)}
                    {isOngoing && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 animate-pulse">
                        <Radio size={10} /> LIVE NOW
                      </span>
                    )}
                  </div>

                  {session.description && (
                    <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                      {session.description}
                    </p>
                  )}

                  {/* Metadata: Speaker and Stage */}
                  <div className="flex items-center gap-3 text-xs text-zinc-400 pt-1 flex-wrap">
                    {session.speaker_name && (
                      <span className="flex items-center gap-1 text-zinc-300">
                        <User size={12} className="text-[#18CFFC]" />
                        {session.speaker_name}
                      </span>
                    )}
                    {session.venue_stage && (
                      <span className="flex items-center gap-1 text-zinc-400">
                        <MapPin size={12} className="text-[#7F1AFB]" />
                        {session.venue_stage}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

