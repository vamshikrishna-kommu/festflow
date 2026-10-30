import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { EventCard } from './EventCard'
import { staggerContainer } from '@/lib/animations'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { EVENT_CATEGORIES, type CategoryFilter } from '@/lib/mock-data'
import type { Event } from '@/types'

interface EventGridProps {
  events: Event[]
  title?: string
  description?: string
  showFilters?: boolean
}

export function EventGrid({
  events,
  title,
  description,
  showFilters = false,
}: EventGridProps) {
  const [search,   setSearch]   = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const reduced = useReducedMotion()

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const matchesCat  = category === 'all' || e.category === category
      const q           = search.trim().toLowerCase()
      const matchesText = q === ''
        || e.title.toLowerCase().includes(q)
        || e.clubName.toLowerCase().includes(q)
        || e.tags.some((t) => t.toLowerCase().includes(q))
        || e.venue.toLowerCase().includes(q)
      return matchesCat && matchesText
    })
  }, [events, search, category])

  return (
    <section aria-label={title ?? 'Events'} className="w-full">
      {/* Header */}
      {(title ?? description) && (
        <div className="mb-8">
          {title && (
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-[var(--color-text-primary)] mb-2">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-[var(--color-text-secondary)]">{description}</p>
          )}
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="mb-8 flex flex-col gap-4">
          {/* Search */}
          <div className="relative w-full max-w-md">
            <Search
              size={16}
              aria-hidden="true"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <input
              id="event-search"
              type="search"
              placeholder="Search events, clubs, venues…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search events"
              className="w-full h-10 pl-10 pr-4 rounded-[var(--radius-button)] bg-[#14141A] border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC] transition-colors"
            />
          </div>

          {/* Category chips */}
          <div
            role="group"
            aria-label="Filter by category"
            className="flex gap-2 overflow-x-auto sm:flex-wrap no-scrollbar pb-1 touch-pan-x -mx-4 px-4 sm:mx-0 sm:px-0"
          >
            {EVENT_CATEGORIES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                id={`cat-filter-${value}`}
                onClick={() => setCategory(value)}
                aria-pressed={category === value}
                className={`px-3.5 py-1.5 whitespace-nowrap shrink-0 rounded-[var(--radius-pill)] text-xs sm:text-sm font-medium border transition-all duration-200 cursor-pointer ${
                  category === value
                    ? 'bg-[#18CFFC] border-[#18CFFC] text-white shadow-md shadow-[#18CFFC]/20 font-semibold'
                    : 'bg-[#0E0E12] border-white/10 text-zinc-400 hover:border-[#18CFFC]/40 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Results count */}
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <SlidersHorizontal size={14} aria-hidden="true" />
            <span>
              {filtered.length} event{filtered.length !== 1 ? 's' : ''} found
            </span>
          </div>
        </div>
      )}

      {/* Grid */}
      <AnimatePresence mode="wait">
        {filtered.length > 0 ? (
          <motion.ul
            key={`${category}-${search}`}
            variants={staggerContainer}
            initial={reduced ? 'visible' : 'hidden'}
            animate="visible"
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
            role="list"
          >
            {filtered.map((event) => (
              <li key={event.id}>
                <EventCard event={event} animated />
              </li>
            ))}
          </motion.ul>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="py-24 text-center"
          >
            <p className="text-4xl mb-4" aria-hidden="true">🔍</p>
            <p className="font-semibold text-[var(--color-text-primary)] mb-1">
              No events found
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              Try adjusting your search or category filter
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
