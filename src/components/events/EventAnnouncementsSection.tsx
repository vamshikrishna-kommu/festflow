import { Megaphone, Pin, AlertTriangle, Info, CalendarClock, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui'
import type { EventAnnouncement, AnnouncementPriority } from '@/types'

interface EventAnnouncementsSectionProps {
  announcements: EventAnnouncement[]
}

export function EventAnnouncementsSection({ announcements }: EventAnnouncementsSectionProps) {
  if (!announcements || announcements.length === 0) return null

  const getPriorityBadge = (p: AnnouncementPriority) => {
    switch (p) {
      case 'urgent':
        return (
          <Badge variant="danger" className="flex items-center gap-1">
            <AlertTriangle size={10} /> Urgent Notice
          </Badge>
        )
      case 'venue_change':
        return (
          <Badge variant="amber" className="flex items-center gap-1">
            <AlertTriangle size={10} /> Venue Update
          </Badge>
        )
      case 'schedule_change':
        return (
          <Badge variant="cyan" className="flex items-center gap-1">
            <CalendarClock size={10} /> Time Rescheduled
          </Badge>
        )
      case 'results':
        return (
          <Badge variant="purple" className="flex items-center gap-1">
            <Trophy size={10} /> Results Announced
          </Badge>
        )
      default:
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <Info size={10} /> Announcement
          </Badge>
        )
    }
  }

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold font-heading text-gray-900 flex items-center gap-2">
          <Megaphone size={18} className="text-blue-600" />
          Live Event Announcements
        </h2>
        <span className="text-xs text-gray-500">
          {announcements.length} update{announcements.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {announcements.map((ann) => (
          <div
            key={ann.id}
            className={`p-4 rounded-xl border text-left flex flex-col gap-2 transition-all ${
              ann.is_pinned
                ? 'bg-blue-50/70 border-blue-200 shadow-xs'
                : 'bg-white border-gray-200 shadow-xs'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {ann.is_pinned && (
                  <span className="text-blue-600 flex items-center gap-1 text-xs font-bold uppercase tracking-wider">
                    <Pin size={12} className="rotate-45" /> Pinned
                  </span>
                )}
                {getPriorityBadge(ann.priority)}
                <h3 className="font-bold text-sm text-gray-900">{ann.title}</h3>
              </div>
              <span className="text-[10px] text-gray-500 font-mono shrink-0">
                {formatTimestamp(ann.created_at)}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed font-sans whitespace-pre-line">
              {ann.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

