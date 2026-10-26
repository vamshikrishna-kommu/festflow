import { motion } from 'motion/react'
import { Link } from 'react-router'
import { Calendar, MapPin, Users, ArrowRight } from 'lucide-react'
import { Card, CategoryBadge } from '@/components/ui'
import { fadeUp } from '@/lib/animations'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import type { Event } from '@/types'

interface EventCardProps {
  event: Event
  /** When true wraps in fadeUp motion variant for stagger contexts */
  animated?: boolean
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function spotsLeft(capacity: number, registered: number): number {
  return capacity - registered
}

export function EventCard({ event, animated = false }: EventCardProps) {
  const reduced = useReducedMotion()
  const spots   = spotsLeft(event.capacity, event.registeredCount)
  const isFull  = spots <= 0
  const fillPct = Math.min((event.registeredCount / event.capacity) * 100, 100)

  const inner = (
    <Link
      to={`/events/${event.slug}`}
      className="block group focus:outline-none"
      aria-label={`View ${event.title} by ${event.clubName}`}
    >
      <Card
        hoverable={!reduced}
        className="shadow-[var(--shadow-card)] h-full"
      >
        {/* Cover image */}
        <div className="relative h-44 overflow-hidden">
          <img
            src={event.coverImage}
            alt={`${event.title} cover`}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-surface-1)] via-transparent to-transparent" />

          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-2">
            <CategoryBadge category={event.category} />
            {event.isFeatured && (
              <span className="inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-semibold bg-[oklch(75%_0.18_65_/_0.9)] text-[oklch(20%_0.05_65)]">
                ✦ Featured
              </span>
            )}
          </div>

          {/* Price */}
          <div className="absolute top-3 right-3">
            {event.isFree ? (
              <span className="glass rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-bold text-[oklch(65%_0.18_145)]">
                FREE
              </span>
            ) : (
              <span className="glass rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-bold text-[var(--color-text-primary)]">
                ₹{event.price}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-3">
          {/* Club */}
          <div className="flex items-center gap-2">
            <img
              src={event.clubAvatar}
              alt={event.clubName}
              width={20}
              height={20}
              className="rounded-full"
            />
            <span className="text-xs text-[var(--color-text-muted)] truncate">
              {event.clubName}
            </span>
          </div>

          {/* Title */}
          <h3 className="font-display font-bold text-base leading-snug text-[var(--color-text-primary)] line-clamp-2 group-hover:text-[var(--color-brand-purple)] transition-colors">
            {event.title}
          </h3>

          {/* Meta */}
          <div className="flex flex-col gap-1.5 text-xs text-[var(--color-text-muted)]">
            <div className="flex items-center gap-1.5">
              <Calendar size={12} aria-hidden="true" />
              <span>
                {formatDate(event.date)} · {event.time}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin size={12} aria-hidden="true" />
              <span className="truncate">
                {event.location}, {event.venue}
              </span>
            </div>
          </div>

          {/* Capacity bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                <Users size={11} aria-hidden="true" />
                <span>
                  {event.registeredCount.toLocaleString()} /{' '}
                  {event.capacity.toLocaleString()}
                </span>
              </div>
              {isFull ? (
                <span className="text-xs font-semibold text-red-400">Sold out</span>
              ) : (
                <span className="text-xs text-[var(--color-text-muted)]">
                  {spots} left
                </span>
              )}
            </div>
            <div
              className="h-1 rounded-full bg-[var(--color-surface-3)] overflow-hidden"
              role="progressbar"
              aria-valuenow={event.registeredCount}
              aria-valuemax={event.capacity}
              aria-label={`${event.registeredCount} of ${event.capacity} spots filled`}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${fillPct}%`,
                  background: isFull
                    ? 'oklch(55% 0.22 25)'
                    : 'linear-gradient(90deg, var(--color-brand-purple), var(--color-brand-pink))',
                }}
              />
            </div>
          </div>

          {/* CTA row */}
          <div className="pt-1 flex items-center justify-between">
            <div className="flex gap-1 flex-wrap">
              {event.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-text-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold text-[var(--color-brand-purple)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0">
              View <ArrowRight size={12} />
            </span>
          </div>
        </div>
      </Card>
    </Link>
  )

  if (animated && !reduced) {
    return <motion.div variants={fadeUp}>{inner}</motion.div>
  }
  return inner
}
