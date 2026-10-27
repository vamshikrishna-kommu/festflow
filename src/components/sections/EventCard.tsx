import { useState } from 'react'
import { motion } from 'motion/react'
import { Link } from 'react-router'
import { Calendar, MapPin, Users, ArrowUpRight, Clock, ShieldCheck } from 'lucide-react'
import { CategoryBadge, Badge } from '@/components/ui'
import { fadeUp } from '@/lib/animations'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import type { Event } from '@/types'

interface EventCardProps {
  event: Event
  animated?: boolean
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return 'Date TBA'
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return 'Date TBA'
  }
}

export function EventCard({ event, animated = false }: EventCardProps) {
  const reduced = useReducedMotion()
  const [imgError, setImgError] = useState(false)

  const hasCapacity = typeof event.capacity === 'number' && event.capacity > 0
  const registered = typeof event.registeredCount === 'number' ? event.registeredCount : 0
  const spots = hasCapacity ? event.capacity - registered : null
  const isFull = hasCapacity && spots !== null && spots <= 0
  const fillPct = hasCapacity ? Math.min((registered / event.capacity) * 100, 100) : 0
  const isNearFull = hasCapacity && fillPct >= 80 && !isFull && registered > 0

  const isTeam = event.participationType === 'team'
  const isOnline = event.eventType === 'online'

  const inner = (
    <Link
      to={`/events/${event.slug}`}
      className="block group focus:outline-none h-full"
      aria-label={`View ${event.title} by ${event.clubName}`}
    >
      <motion.article
        whileHover={reduced ? undefined : { y: -5, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } }}
        whileTap={reduced ? undefined : { scale: 0.985 }}
        className="relative flex flex-col h-full rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.07)] bg-[var(--color-surface-1)] overflow-hidden transition-all duration-300 group-hover:border-[oklch(100%_0_0_/_0.18)] group-hover:shadow-[0_16px_48px_oklch(0%_0_0_/_0.55)] cursor-pointer"
      >
        {/* Proportioned Cover Image Banner (16:10 aspect ratio) */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--color-surface-2)] shrink-0">
          {!imgError && event.coverImage ? (
            <img
              src={event.coverImage}
              alt={`${event.title} cover`}
              loading="lazy"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
          ) : (
            <div
              className="w-full h-full flex flex-col items-center justify-center p-6 text-center"
              style={{
                background: 'linear-gradient(135deg, oklch(18% 0.04 270), oklch(14% 0.03 260))',
              }}
            >
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[var(--color-brand-cyan)] mb-2 shadow-inner">
                <Calendar size={22} />
              </div>
              <span className="text-xs font-semibold text-[var(--color-text-secondary)] line-clamp-1">
                {event.clubName}
              </span>
            </div>
          )}

          {/* Vignette Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-surface-1)] via-black/20 to-transparent" />

          {/* Top Badges */}
          <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap items-center">
            <CategoryBadge category={event.category} />
            {isTeam && (
              <Badge variant="pink" className="text-[10px] flex items-center gap-1 shadow-sm">
                <Users size={10} /> Team
              </Badge>
            )}
            {isOnline && (
              <Badge variant="cyan" className="text-[10px] shadow-sm">
                Online
              </Badge>
            )}
          </div>

          {/* Price badge */}
          <div className="absolute top-3 right-3">
            {event.isFree ? (
              <span className="glass rounded-full px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 ring-1 ring-emerald-400/30 shadow-md">
                FREE
              </span>
            ) : (
              <span className="glass rounded-full px-2.5 py-0.5 text-[11px] font-bold text-[var(--color-text-primary)] ring-1 ring-white/15 shadow-md">
                ₹{event.price}
              </span>
            )}
          </div>

          {/* Arrow hint on hover */}
          <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
            <span className="w-8 h-8 rounded-full bg-[var(--color-brand-cyan)] text-black flex items-center justify-center shadow-lg font-bold">
              <ArrowUpRight size={15} />
            </span>
          </div>
        </div>

        {/* Card Body */}
        <div className="flex flex-col flex-1 p-4 sm:p-5 gap-3">
          {/* Organizer row */}
          <div className="flex items-center gap-2">
            <img
              src={event.clubAvatar}
              alt={event.clubName}
              width={20}
              height={20}
              loading="lazy"
              className="rounded-full shrink-0 ring-1 ring-[oklch(100%_0_0_/_0.1)] object-cover"
            />
            <span className="text-xs text-[var(--color-text-muted)] truncate font-medium flex items-center gap-1">
              {event.clubName}
              <ShieldCheck size={12} className="text-emerald-400 shrink-0" />
            </span>
          </div>

          {/* Event Title */}
          <h3 className="font-display font-bold text-base leading-snug text-[var(--color-text-primary)] line-clamp-2 group-hover:text-[var(--color-brand-cyan)] transition-colors duration-200">
            {event.title}
          </h3>

          {/* Meta Information */}
          <div className="flex flex-col gap-1.5 text-xs text-[var(--color-text-muted)]">
            <div className="flex items-center gap-1.5">
              <Calendar size={12} aria-hidden="true" className="shrink-0 text-[var(--color-brand-cyan)]" />
              <span className="truncate">{formatDate(event.date)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={12} aria-hidden="true" className="shrink-0 text-[var(--color-brand-purple)]" />
              <span className="truncate">{event.time}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin size={12} aria-hidden="true" className="shrink-0 text-[var(--color-brand-pink)]" />
              <span className="truncate">{event.venue || event.location}</span>
            </div>
          </div>

          {/* Capacity and Availability Bar (backed by genuine DB data) */}
          <div className="mt-auto pt-2 border-t border-[oklch(100%_0_0_/_0.06)]">
            <div className="flex items-center justify-between mb-1.5 text-[11px]">
              <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
                <Users size={11} aria-hidden="true" />
                {registered > 0 ? (
                  <span>
                    {registered.toLocaleString()} / {event.capacity.toLocaleString()} seats
                  </span>
                ) : (
                  <span>{event.capacity.toLocaleString()} seats capacity</span>
                )}
              </div>

              {isFull ? (
                <span className="font-semibold text-rose-400">Sold out</span>
              ) : isNearFull && spots !== null ? (
                <span className="font-semibold text-[var(--color-brand-amber)]">{spots} left</span>
              ) : (
                <span className="text-emerald-400 font-medium">Open</span>
              )}
            </div>

            {hasCapacity && (
              <div
                className="h-1 rounded-full overflow-hidden bg-[var(--color-surface-3)]"
                role="progressbar"
                aria-valuenow={registered}
                aria-valuemax={event.capacity}
                aria-label={`${registered} of ${event.capacity} spots filled`}
              >
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: registered > 0 ? `${Math.max(fillPct, 4)}%` : '0%',
                    background: isFull
                      ? 'oklch(55% 0.22 25)'
                      : isNearFull
                      ? 'oklch(76% 0.17 68)'
                      : 'linear-gradient(90deg, var(--color-brand-cyan), var(--color-brand-violet))',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </motion.article>
    </Link>
  )

  if (animated && !reduced) {
    return <motion.div variants={fadeUp} className="h-full">{inner}</motion.div>
  }
  return inner
}
