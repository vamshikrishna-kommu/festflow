import { motion, AnimatePresence } from 'motion/react'
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Users,
  ShieldCheck,
  Building2,
  Sparkles,
  ExternalLink,
  Mail,
  Phone,
  FileText,
  IndianRupee,
  Layers,
} from 'lucide-react'
import { Button, Badge, CategoryBadge } from '@/components/ui'
import type { EventInsert, EventCategory, CustomQuestion } from '@/types'

interface EventPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  data: Partial<EventInsert>
  clubName?: string
}

export function EventPreviewModal({
  isOpen,
  onClose,
  data,
  clubName = 'Campus Club',
}: EventPreviewModalProps) {
  if (!isOpen) return null

  const isFree = data.is_free ?? true
  const price = data.price ?? 0
  const capacity = data.capacity || 100
  const participation = data.participation_type || 'individual'
  const isTeam = participation === 'team'
  const minTeam = data.min_team_size || 1
  const maxTeam = data.max_team_size || 1
  const eventType = data.event_type || 'offline'
  const category = (data.category as EventCategory) || 'tech'
  const timezone = data.timezone || 'Asia/Kolkata'

  const startDateFormatted = data.start_date
    ? new Date(data.start_date).toLocaleDateString('en-IN', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Date not set'

  const startTimeFormatted = data.start_date
    ? new Date(data.start_date).toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : 'Time not set'

  const endTimeFormatted = data.end_date
    ? new Date(data.end_date).toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : null

  const regDeadlineFormatted = data.registration_closes_at
    ? new Date(data.registration_closes_at).toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null

  const questions = (data.custom_questions as CustomQuestion[]) || []

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-4xl max-h-[90vh] bg-[var(--color-surface-1)] border border-[var(--color-surface-3)] rounded-3xl overflow-hidden flex flex-col shadow-2xl"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-surface-3)] bg-[var(--color-surface-2)] shrink-0">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-[#18CFFC]/20 text-[#18CFFC]">
                <Sparkles size={16} />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#18CFFC]">
                Live Attendee View Preview
              </span>
              <span className="text-xs text-[var(--color-text-muted)] hidden sm:inline">• Read-only simulation</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Scrollable Body */}
          <div className="overflow-y-auto p-6 sm:p-8 flex flex-col gap-8 text-left">
            {/* Banner & Badges */}
            <div className="relative w-full h-48 sm:h-72 rounded-2xl overflow-hidden bg-[var(--color-surface-3)] border border-[var(--color-surface-3)]">
              {data.poster_url ? (
                <img
                  src={data.poster_url}
                  alt={data.title || 'Event Banner'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[var(--color-text-muted)] text-sm">
                  No banner selected
                </div>
              )}
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <CategoryBadge category={category} />
                <Badge variant={isTeam ? 'pink' : 'cyan'}>
                  {isTeam ? `Team (${minTeam}-${maxTeam} members)` : 'Individual Entry'}
                </Badge>
                {eventType === 'online' && <Badge variant="purple">Online Event</Badge>}
                {eventType === 'hybrid' && <Badge variant="amber">Hybrid</Badge>}
              </div>
            </div>

            {/* Title & Host info */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs text-[#18CFFC] font-medium">
                <Building2 size={14} />
                <span>Organized by {clubName}</span>
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <ShieldCheck size={12} /> Verified
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold font-display text-[var(--color-text-primary)] leading-tight">
                {data.title || 'Untitled Event'}
              </h1>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {data.summary || 'No summary provided.'}
              </p>
            </div>

            {/* Quick Specs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] flex items-start gap-3">
                <Calendar size={18} className="text-[#18CFFC] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider block">Date</span>
                  <span className="text-xs font-semibold text-[var(--color-text-primary)]">{startDateFormatted}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] flex items-start gap-3">
                <Clock size={18} className="text-[#18CFFC] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider block">Time</span>
                  <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                    {startTimeFormatted} {endTimeFormatted ? `– ${endTimeFormatted}` : ''}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)] block">({timezone})</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] flex items-start gap-3">
                <MapPin size={18} className="text-[#18CFFC] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider block">Location</span>
                  <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                    {data.venue_name || (eventType === 'online' ? 'Online / Virtual' : 'Venue not specified')}
                  </span>
                  {data.venue_address && (
                    <span className="text-[10px] text-[var(--color-text-muted)] block line-clamp-1">{data.venue_address}</span>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] flex items-start gap-3">
                <IndianRupee size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider block">Registration Fee</span>
                  <span className="text-xs font-bold text-emerald-400">
                    {isFree ? 'Free Admission' : `INR ${price}`}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)] block">Capacity: {capacity}</span>
                </div>
              </div>
            </div>

            {/* Virtual Meeting Details if Online / Hybrid */}
            {(eventType === 'online' || eventType === 'hybrid') && data.online_meeting_url && (
              <div className="p-4 rounded-xl bg-[#18CFFC]/10 border border-[#18CFFC]/20 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#18CFFC]">
                  <ExternalLink size={14} /> Virtual Platform / Meeting Details
                </div>
                <p className="text-xs text-[var(--color-text-primary)] font-mono break-all">
                  {data.online_meeting_url}
                </p>
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  Note: Direct meeting links are accessible on tickets for confirmed attendees.
                </span>
              </div>
            )}

            {/* Team Participation Specifications if Team Event */}
            {isTeam && (
              <div className="p-5 rounded-2xl bg-[#ED47FC]/5 border border-[#ED47FC]/20 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-[#FE7EE8]">
                  <Users size={16} /> Team Registration Guidelines
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                  <div>
                    <span className="text-[var(--color-text-muted)] block">Team Size Limits:</span>
                    <strong className="text-[var(--color-text-primary)]">{minTeam} to {maxTeam} members</strong>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)] block">Team Leader Rule:</span>
                    <strong className="text-[var(--color-text-primary)]">
                      {data.leader_counts_towards_size ? 'Counts toward team size' : 'Exclusive of team size'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)] block">Roster Method:</span>
                    <strong className="text-[var(--color-text-primary)]">
                      {data.team_registration_mode === 'leader_adds_members'
                        ? 'Leader registers full team'
                        : 'Members join with code'}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Description Body */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)] flex items-center gap-2">
                <FileText size={16} className="text-[#18CFFC]" />
                About This Event
              </h3>
              <div className="text-sm text-[var(--color-text-secondary)] whitespace-pre-line leading-relaxed p-4 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)]">
                {data.description || 'No detailed description provided yet.'}
              </div>
            </div>

            {/* Rules and Guidelines */}
            {data.rules && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)] flex items-center gap-2">
                  <Layers size={16} className="text-amber-400" />
                  Rules & Event Code of Conduct
                </h3>
                <div className="text-xs text-[var(--color-text-secondary)] whitespace-pre-line leading-relaxed p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                  {data.rules}
                </div>
              </div>
            )}

            {/* Custom Registration Questions Preview */}
            {questions.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)] flex items-center gap-2">
                  <Sparkles size={16} className="text-[#18CFFC]" />
                  Attendee Form Questions ({questions.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {questions.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      className="p-3.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] flex flex-col gap-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[var(--color-text-primary)]">
                          {idx + 1}. {q.label}
                        </span>
                        {q.required && <span className="text-[10px] text-rose-400 font-bold">*Required</span>}
                      </div>
                      <span className="text-[10px] text-[var(--color-text-muted)] uppercase">
                        Type: {q.type} {q.options ? `(${q.options.join(', ')})` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contact Details */}
            {(data.contact_email || data.contact_phone) && (
              <div className="p-4 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] flex flex-wrap items-center gap-6 text-xs">
                <span className="text-[var(--color-text-muted)] font-semibold uppercase tracking-wider">
                  Organizer Contact:
                </span>
                {data.contact_email && (
                  <span className="flex items-center gap-1.5 text-[var(--color-text-primary)]">
                    <Mail size={14} className="text-[#18CFFC]" />
                    {data.contact_email}
                  </span>
                )}
                {data.contact_phone && (
                  <span className="flex items-center gap-1.5 text-[var(--color-text-primary)]">
                    <Phone size={14} className="text-[#18CFFC]" />
                    {data.contact_phone}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--color-surface-3)] bg-[var(--color-surface-2)] shrink-0">
            <span className="text-xs text-[var(--color-text-muted)]">
              {regDeadlineFormatted ? `Deadline: ${regDeadlineFormatted}` : 'Open registration'}
            </span>
            <Button variant="primary" size="sm" onClick={onClose}>
              Back to Editing
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
