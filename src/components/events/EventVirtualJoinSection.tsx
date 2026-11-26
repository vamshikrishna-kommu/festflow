import { useState, useEffect } from 'react'
import { Video, Lock, ExternalLink, ShieldCheck } from 'lucide-react'
import { Button, Badge } from '@/components/ui'
import { getEventMeetingDetails } from '@/lib/eventExperience'
import type { EventOnlineDetails } from '@/types'

interface EventVirtualJoinSectionProps {
  eventId: string
  eventType: 'offline' | 'online' | 'hybrid'
  eventData: {
    start_date?: string
    end_date?: string
    access_window_minutes?: number
    meeting_platform?: string | null
    meeting_url?: string | null
    joining_instructions?: string | null
    club_id?: string
  }
  userId?: string
  isConfirmedAttendee: boolean
}

export function EventVirtualJoinSection({
  eventId,
  eventType,
  eventData,
  userId,
  isConfirmedAttendee,
}: EventVirtualJoinSectionProps) {
  const [details, setDetails] = useState<EventOnlineDetails | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (eventType === 'offline') return
    let mounted = true
    setLoading(true)

    getEventMeetingDetails(eventId, eventData, userId, isConfirmedAttendee)
      .then((res) => {
        if (!mounted) return
        setLoading(false)
        setDetails(res)
      })
      .catch(() => {
        if (!mounted) return
        setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [eventId, eventType, eventData, userId, isConfirmedAttendee])

  if (eventType === 'offline') return null

  const platformName = eventData.meeting_platform
    ? eventData.meeting_platform.charAt(0).toUpperCase() + eventData.meeting_platform.slice(1)
    : 'Virtual Meeting Room'

  return (
    <div className="p-5 rounded-xl bg-blue-50/60 border border-blue-200 flex flex-col gap-3.5 shadow-xs text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <Video size={18} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
              <span>{platformName} Joining Portal</span>
              <Badge variant="info" className="text-[10px]">
                {eventType === 'hybrid' ? 'Hybrid Stream' : 'Live Online'}
              </Badge>
            </h3>
            <span className="text-[11px] text-gray-500">
              Encrypted virtual attendance credentials
            </span>
          </div>
        </div>

        {details?.accessible && (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
            <ShieldCheck size={12} /> Access Granted
          </span>
        )}
      </div>

      {/* Access Gate Logic */}
      {loading ? (
        <div className="py-4 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin" />
          <span>Verifying pass access credentials…</span>
        </div>
      ) : details?.accessible && details.meeting_url ? (
        <div className="space-y-3 pt-2 border-t border-blue-200/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-white border border-gray-200">
            <div className="min-w-0">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-bold">
                Direct Session Link
              </span>
              <span className="text-xs font-mono text-gray-700 truncate block">
                {details.meeting_url}
              </span>
            </div>

            <a
              href={details.meeting_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0"
            >
              <Button
                variant="primary"
                size="sm"
                rightIcon={<ExternalLink size={14} />}
              >
                Launch Virtual Room
              </Button>
            </a>
          </div>

          {details.joining_instructions && (
            <div className="p-3 rounded-xl bg-white border border-gray-200 text-xs text-gray-600 leading-relaxed font-sans">
              <strong className="block text-gray-900 mb-0.5">Joining Instructions:</strong>
              {details.joining_instructions}
            </div>
          )}
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-white border border-gray-200 flex items-start gap-3 text-xs text-gray-600">
          <Lock size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="text-gray-900 block font-semibold mb-0.5">
              Protected Attendee Portal
            </strong>
            <p className="text-gray-600 leading-relaxed">
              {details?.message ||
                (!userId
                  ? 'Please sign in to verify your registration and unlock the session meeting link.'
                  : !isConfirmedAttendee
                  ? 'Meeting link is locked. It unlocks exclusively for confirmed pass holders.'
                  : `Virtual meeting credentials unlock ${eventData.access_window_minutes || 30} minutes prior to session start.`)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
