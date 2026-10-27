import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'motion/react'
import {
  Search,
  SlidersHorizontal,
  RefreshCw,
  Sparkles,
  X,
  Compass,
} from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { EventCard } from '@/components/sections/EventCard'
import { Button, Badge, EmptyState } from '@/components/ui'
import { staggerContainer, fadeUp } from '@/lib/animations'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { EVENT_CATEGORIES, type CategoryFilter } from '@/lib/mock-data'
import { listPublishedEvents, mapRecordToUiEvent } from '@/lib/events'
import type { Event } from '@/types'

const PAGE_SIZE = 12

export default function DiscoverPage() {
  const reduced = useReducedMotion()

  const [rawEvents, setRawEvents]   = useState<Event[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading]       = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const [search, setSearch]               = useState('')
  const [category, setCategory]           = useState<CategoryFilter>('all')
  const [participationFilter, setParticipationFilter] = useState<'all' | 'individual' | 'team'>('all')
  const [pricingFilter, setPricingFilter] = useState<'all' | 'free' | 'paid'>('all')
  const [offset, setOffset]               = useState(0)

  const fetchEvents = useCallback(async (isLoadMore = false, newOffset = 0) => {
    if (isLoadMore) setLoadingMore(true)
    else setLoading(true)
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
      if (isLoadMore) setRawEvents((prev) => [...prev, ...mapped])
      else setRawEvents(mapped)
      setTotalCount(res.count)
    }

    setLoading(false)
    setLoadingMore(false)
  }, [category, search])

  useEffect(() => {
    setOffset(0)
    fetchEvents(false, 0)
  }, [category, search, fetchEvents])

  const handleLoadMore = () => {
    const next = offset + PAGE_SIZE
    setOffset(next)
    fetchEvents(true, next)
  }

  // Client-side refinement for participation type and pricing filter
  const displayedEvents = useMemo(() => {
    return rawEvents.filter((evt) => {
      if (participationFilter === 'individual' && evt.participationType !== 'individual') {
        return false
      }
      if (participationFilter === 'team' && evt.participationType !== 'team') {
        return false
      }
      if (pricingFilter === 'free' && !evt.isFree) {
        return false
      }
      if (pricingFilter === 'paid' && evt.isFree) {
        return false
      }
      return true
    })
  }, [rawEvents, participationFilter, pricingFilter])

  const hasMore = rawEvents.length < totalCount
  const hasFilters = search.trim() || category !== 'all' || participationFilter !== 'all' || pricingFilter !== 'all'

  const clearAllFilters = () => {
    setSearch('')
    setCategory('all')
    setParticipationFilter('all')
    setPricingFilter('all')
  }

  return (
    <PageShell>
      {/* ── Page Hero Header ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-[oklch(100%_0_0_/_0.06)] pb-8 sm:pb-12 text-left">
        {/* Subtle background glow */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 80% 100% at 50% 0%, oklch(58% 0.26 285 / 0.08) 0%, oklch(72% 0.16 200 / 0.04) 50%, transparent 80%)',
          }}
        />
        <div aria-hidden="true" className="absolute inset-0 grid-pattern opacity-20 pointer-events-none" />

        <motion.div
          variants={staggerContainer}
          initial={reduced ? 'visible' : 'hidden'}
          animate="visible"
          className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-8"
        >
          <motion.div
            variants={reduced ? undefined : fadeUp}
            className="flex items-center gap-2 mb-2"
          >
            <Badge variant="cyan" className="flex items-center gap-1.5 text-xs">
              <Sparkles size={12} aria-hidden="true" /> Campus Directory
            </Badge>
          </motion.div>

          <motion.h1
            variants={reduced ? undefined : fadeUp}
            className="font-display font-extrabold text-3xl sm:text-4xl md:text-5xl text-[var(--color-text-primary)] mb-3 tracking-tight"
          >
            Discover Events
          </motion.h1>

          <motion.p
            variants={reduced ? undefined : fadeUp}
            className="max-w-xl text-sm sm:text-base text-[var(--color-text-secondary)] leading-relaxed"
          >
            Explore upcoming hackathons, cultural fests, workshops, esports tournaments, and academic symposiums published by campus clubs.
          </motion.p>
        </motion.div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 w-full text-left">
        {/* ── Search & Controls Bar ──────────────────────────────────── */}
        <div
          className="sticky top-16 z-30 py-4 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 mb-6 border-b border-[oklch(100%_0_0_/_0.06)]"
          style={{ background: 'oklch(6% 0.018 265 / 0.94)', backdropFilter: 'blur(16px)' }}
        >
          <div className="flex flex-col gap-3 max-w-7xl mx-auto">
            {/* Search Input Row */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1 max-w-lg">
                <Search
                  size={16}
                  aria-hidden="true"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
                />
                <input
                  id="event-search"
                  type="search"
                  placeholder="Search events, clubs, venues, or topics…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search campus events"
                  className="w-full h-11 pl-10 pr-10 rounded-[var(--radius-button)] bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.09)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-cyan)] focus:ring-2 focus:ring-[oklch(72%_0.16_200_/_0.2)] transition-all shadow-sm"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                    aria-label="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Sub-Filters: Participation & Pricing */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar touch-pan-x shrink-0 -mx-4 px-4 sm:mx-0 sm:px-0 py-0.5">
                {/* Participation filter */}
                <div className="flex items-center rounded-xl bg-[var(--color-surface-2)] p-1 border border-[oklch(100%_0_0_/_0.06)] text-xs">
                  {(['all', 'individual', 'team'] as const).map((mode) => (
                    <motion.button
                      key={mode}
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      onClick={() => setParticipationFilter(mode)}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-all capitalize cursor-pointer ${
                        participationFilter === mode
                          ? 'bg-[var(--color-surface-4)] text-[var(--color-text-primary)] font-semibold shadow-sm'
                          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                      }`}
                    >
                      {mode === 'all' ? 'All Formats' : mode === 'team' ? 'Team' : 'Solo'}
                    </motion.button>
                  ))}
                </div>

                {/* Pricing filter */}
                <div className="flex items-center rounded-xl bg-[var(--color-surface-2)] p-1 border border-[oklch(100%_0_0_/_0.06)] text-xs">
                  {(['all', 'free', 'paid'] as const).map((price) => (
                    <motion.button
                      key={price}
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      onClick={() => setPricingFilter(price)}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-all capitalize cursor-pointer ${
                        pricingFilter === price
                          ? 'bg-[var(--color-surface-4)] text-[var(--color-text-primary)] font-semibold shadow-sm'
                          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                      }`}
                    >
                      {price === 'all' ? 'Any Price' : price === 'free' ? 'Free Pass' : 'Ticketed'}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>

            {/* Category Filter Chips — Horizontal Scroll */}
            <div
              role="group"
              aria-label="Filter by category"
              className="flex gap-2 overflow-x-auto no-scrollbar touch-pan-x -mx-4 px-4 sm:mx-0 sm:px-0 py-1"
            >
              {EVENT_CATEGORIES.map(({ value, label }) => {
                const isSelected = category === value
                return (
                  <motion.button
                    key={value}
                    id={`cat-filter-${value}`}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setCategory(value)}
                    aria-pressed={isSelected}
                    className={`px-3.5 py-1.5 whitespace-nowrap shrink-0 rounded-xl text-xs font-medium border transition-all duration-200 capitalize flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-[var(--color-brand-cyan)] to-[var(--color-brand-violet)] text-black border-transparent font-bold shadow-md shadow-[var(--color-brand-cyan)]/20'
                        : 'bg-[var(--color-surface-1)] border-[oklch(100%_0_0_/_0.08)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand-cyan)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    <span>{label}</span>
                  </motion.button>
                )
              })}
            </div>

            {/* Results Count & Active Filters Indicator */}
            <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] pt-1">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={13} aria-hidden="true" />
                <span>
                  {loading
                    ? 'Loading verified campus events…'
                    : `${displayedEvents.length} event${displayedEvents.length !== 1 ? 's' : ''} available`}
                </span>
                {totalCount > displayedEvents.length && (
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    (filtered from {totalCount} total)
                  </span>
                )}
              </div>

              {hasFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-xs text-[var(--color-brand-cyan)] hover:underline flex items-center gap-1 font-medium"
                >
                  <X size={12} /> Clear all filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm mb-6 flex items-center gap-2">
            <X size={16} className="shrink-0" />
            <span>Failed to load events: {error}</span>
          </div>
        )}

        {/* ── Content Grid / Skeletons / Empty State ────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="h-80 rounded-[var(--radius-card)] bg-[var(--color-surface-2)]/40 animate-pulse border border-[var(--color-surface-2)]"
              />
            ))}
          </div>
        ) : displayedEvents.length > 0 ? (
          <>
            <motion.ul
              variants={staggerContainer}
              initial={reduced ? 'visible' : 'hidden'}
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
              role="list"
            >
              {displayedEvents.map((event) => (
                <li key={event.id} className="h-full">
                  <EventCard event={event} animated />
                </li>
              ))}
            </motion.ul>

            {hasMore && (
              <div className="mt-12 flex justify-center">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  isLoading={loadingMore}
                  leftIcon={<RefreshCw size={15} className={loadingMore ? 'animate-spin' : ''} />}
                >
                  Load More Events
                </Button>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={Compass}
            title={hasFilters ? 'No Matching Events Found' : 'No Events Published Yet'}
            description={
              hasFilters
                ? 'No events match your current filter criteria. Try adjusting your search term, format, or category.'
                : 'Campus organizers have not published any upcoming public events yet. Check back soon!'
            }
            action={
              hasFilters ? (
                <Button variant="outline" size="sm" onClick={clearAllFilters}>
                  Clear All Filters
                </Button>
              ) : undefined
            }
          />
        )}
      </div>
    </PageShell>
  )
}
