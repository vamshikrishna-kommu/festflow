import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'motion/react'
import { Search, SlidersHorizontal, RefreshCw, Sparkles } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { EventCard } from '@/components/sections/EventCard'
import { Button } from '@/components/ui'
import { staggerContainer, fadeUp } from '@/lib/animations'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { EVENT_CATEGORIES, type CategoryFilter } from '@/lib/mock-data'
import { listPublishedEvents, mapRecordToUiEvent } from '@/lib/events'
import type { Event } from '@/types'

const PAGE_SIZE = 12

export default function DiscoverPage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  const [events, setEvents] = useState<Event[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [offset, setOffset] = useState(0)

  // Fetch published events
  const fetchEvents = useCallback(async (isLoadMore = false, newOffset = 0) => {
    if (isLoadMore) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }
    setError(null)

    const res = await listPublishedEvents({
      category: category === 'all' ? undefined : category,
      search: search.trim() || undefined,
      limit: PAGE_SIZE,
      offset: newOffset,
    })

    if (res.error) {
      setError(res.error)
    } else {
      const mapped = res.events.map(mapRecordToUiEvent)
      if (isLoadMore) {
        setEvents((prev) => [...prev, ...mapped])
      } else {
        setEvents(mapped)
      }
      setTotalCount(res.count)
    }

    setLoading(false)
    setLoadingMore(false)
  }, [category, search])

  // Initial and filter-change fetch
  useEffect(() => {
    setOffset(0)
    fetchEvents(false, 0)
  }, [category, search, fetchEvents])

  const handleLoadMore = () => {
    const nextOffset = offset + PAGE_SIZE
    setOffset(nextOffset)
    fetchEvents(true, nextOffset)
  }

  const hasMore = events.length < totalCount

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-24 w-full">
        {/* Page header */}
        <motion.div
          ref={heroRef}
          variants={staggerContainer}
          initial={reduced ? 'visible' : 'hidden'}
          animate="visible"
          className="mb-10 pt-4 text-left"
        >
          <motion.p
            variants={reduced ? undefined : fadeUp}
            className="text-xs uppercase tracking-widest text-[var(--color-brand-purple)] font-semibold mb-2 flex items-center gap-1.5"
          >
            <Sparkles size={14} /> Explore Campus Happenings
          </motion.p>
          <motion.h1
            variants={reduced ? undefined : fadeUp}
            className="font-display font-extrabold text-3xl sm:text-4xl md:text-5xl text-[var(--color-text-primary)] mb-3"
          >
            Discover Events
          </motion.h1>
          <motion.p
            variants={reduced ? undefined : fadeUp}
            className="max-w-xl text-sm sm:text-base text-[var(--color-text-secondary)]"
          >
            Find upcoming hackathons, tech bootcamps, cultural festivals, workshops, and sports tournaments happening across colleges.
          </motion.p>
        </motion.div>

        {/* Search & Category Filter Section */}
        <div className="mb-8 flex flex-col gap-4 text-left">
          {/* Search bar */}
          <div className="relative w-full max-w-md">
            <Search
              size={16}
              aria-hidden="true"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <input
              id="event-search"
              type="search"
              placeholder="Search by event title, summary, or venue…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search events"
              className="w-full h-10 pl-10 pr-4 rounded-[var(--radius-button)] bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.08)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-purple)] focus:ring-1 focus:ring-[var(--color-brand-purple)] transition-colors"
            />
          </div>

          {/* Category chips */}
          <div
            role="group"
            aria-label="Filter by category"
            className="flex gap-2 flex-wrap"
          >
            {EVENT_CATEGORIES.map(({ value, label }) => (
              <button
                key={value}
                id={`cat-filter-${value}`}
                onClick={() => setCategory(value)}
                aria-pressed={category === value}
                className={`px-3.5 py-1.5 rounded-[var(--radius-pill)] text-xs sm:text-sm font-medium border transition-all duration-200 capitalize ${
                  category === value
                    ? 'bg-[var(--color-brand-purple)] border-[var(--color-brand-purple)] text-white shadow-sm'
                    : 'bg-transparent border-[oklch(100%_0_0_/_0.1)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand-purple)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Results count & status */}
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] pt-1">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={14} aria-hidden="true" />
              <span>
                {loading ? 'Searching campus events…' : `${totalCount} upcoming event${totalCount !== 1 ? 's' : ''} available`}
              </span>
            </div>
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs text-left mb-6">
            Failed to load events: {error}
          </div>
        )}

        {/* Loading Skeletons */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="h-72 rounded-[var(--radius-card)] bg-[var(--color-surface-2)]/60 animate-pulse border border-[var(--color-surface-3)]"
              />
            ))}
          </div>
        ) : events.length > 0 ? (
          <>
            {/* Real Events Grid */}
            <motion.ul
              variants={staggerContainer}
              initial={reduced ? 'visible' : 'hidden'}
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
              role="list"
            >
              {events.map((event) => (
                <li key={event.id}>
                  <EventCard event={event} animated />
                </li>
              ))}
            </motion.ul>

            {/* Pagination / Load More */}
            {hasMore && (
              <div className="mt-12 flex justify-center">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  isLoading={loadingMore}
                  leftIcon={<RefreshCw size={16} className={loadingMore ? 'animate-spin' : ''} />}
                >
                  Load More Events
                </Button>
              </div>
            )}
          </>
        ) : (
          /* Empty State */
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-24 text-center glass rounded-2xl border border-[var(--color-surface-3)]"
          >
            <p className="text-4xl mb-4" aria-hidden="true">🔍</p>
            <h3 className="font-bold text-lg font-display text-[var(--color-text-primary)] mb-1">
              No published events found
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] max-w-sm mx-auto mb-6">
              We couldn't find any events matching your search or selected category.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('')
                setCategory('all')
              }}
            >
              Clear Search & Filters
            </Button>
          </motion.div>
        )}
      </div>
    </PageShell>
  )
}
