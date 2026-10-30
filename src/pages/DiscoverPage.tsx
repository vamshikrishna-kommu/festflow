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
import { Button, EmptyState } from '@/components/ui'
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
      <div className="relative overflow-hidden border-b border-white/[0.06] pb-8 sm:pb-12 text-left bg-gradient-to-b from-[#0E0E12] to-[#08080A]">
        {/* Subtle background glow */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 70% 90% at 50% -10%, rgba(255, 87, 34, 0.12) 0%, rgba(255, 122, 26, 0.04) 45%, transparent 75%)',
          }}
        />
        <div aria-hidden="true" className="absolute inset-0 grid-pattern opacity-15 pointer-events-none" />

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
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#18CFFC]/10 border border-[#18CFFC]/30 text-[#18CFFC]">
              <Sparkles size={12} aria-hidden="true" /> Campus Directory
            </div>
          </motion.div>

          <motion.h1
            variants={reduced ? undefined : fadeUp}
            className="font-heading font-extrabold text-3xl sm:text-4xl md:text-5xl text-white mb-3 tracking-tight"
          >
            Discover Events
          </motion.h1>

          <motion.p
            variants={reduced ? undefined : fadeUp}
            className="max-w-xl text-sm sm:text-base text-zinc-400 leading-relaxed font-sans"
          >
            Explore upcoming hackathons, cultural fests, workshops, esports tournaments, and academic symposiums published by campus clubs.
          </motion.p>
        </motion.div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 w-full text-left">
        {/* ── Search & Controls Bar ──────────────────────────────────── */}
        <div
          className="sticky top-16 z-30 py-4 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 mb-6 border-b border-white/[0.08]"
          style={{ background: 'rgba(8, 8, 10, 0.92)', backdropFilter: 'blur(20px)' }}
        >
          <div className="flex flex-col gap-3 max-w-7xl mx-auto">
            {/* Search Input Row */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1 max-w-lg">
                <Search
                  size={16}
                  aria-hidden="true"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
                />
                <input
                  id="event-search"
                  type="search"
                  placeholder="Search events, clubs, venues, or topics…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search campus events"
                  className="w-full h-11 pl-10 pr-10 rounded-xl bg-[#14141A] border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#18CFFC] focus:ring-2 focus:ring-[#18CFFC]/20 transition-all shadow-inner"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                    aria-label="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Sub-Filters: Participation & Pricing */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar touch-pan-x shrink-0 -mx-4 px-4 sm:mx-0 sm:px-0 py-0.5">
                {/* Participation filter */}
                <div className="flex items-center rounded-xl bg-[#14141A] p-1 border border-white/[0.08] text-xs">
                  {(['all', 'individual', 'team'] as const).map((mode) => (
                    <motion.button
                      key={mode}
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      onClick={() => setParticipationFilter(mode)}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all capitalize cursor-pointer text-xs ${
                        participationFilter === mode
                          ? 'bg-[#242430] text-white font-semibold shadow-sm border border-white/10'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {mode === 'all' ? 'All Formats' : mode === 'team' ? 'Team' : 'Solo'}
                    </motion.button>
                  ))}
                </div>

                {/* Pricing filter */}
                <div className="flex items-center rounded-xl bg-[#14141A] p-1 border border-white/[0.08] text-xs">
                  {(['all', 'free', 'paid'] as const).map((price) => (
                    <motion.button
                      key={price}
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      onClick={() => setPricingFilter(price)}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all capitalize cursor-pointer text-xs ${
                        pricingFilter === price
                          ? 'bg-[#242430] text-white font-semibold shadow-sm border border-white/10'
                          : 'text-zinc-400 hover:text-white'
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
                    type="button"
                    id={`cat-filter-${value}`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setCategory(value)}
                    aria-pressed={isSelected}
                    className={`px-3.5 py-1.5 whitespace-nowrap shrink-0 rounded-xl text-xs font-semibold border transition-all duration-200 capitalize flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] text-white border-[#18CFFC]/50 shadow-md shadow-[#18CFFC]/25'
                        : 'bg-[#0E0E12] border-white/[0.08] text-zinc-400 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <span>{label}</span>
                  </motion.button>
                )
              })}
            </div>

            {/* Results Count & Active Filters Indicator */}
            <div className="flex items-center justify-between text-xs text-zinc-500 pt-1 font-mono">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={13} aria-hidden="true" className="text-[#18CFFC]" />
                <span>
                  {loading
                    ? 'Loading verified campus events…'
                    : `${displayedEvents.length} event${displayedEvents.length !== 1 ? 's' : ''} available`}
                </span>
                {totalCount > displayedEvents.length && (
                  <span className="text-[10px] text-zinc-500">
                    (filtered from {totalCount} total)
                  </span>
                )}
              </div>

              {hasFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-xs text-[#18CFFC] hover:underline flex items-center gap-1 font-sans font-medium"
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
                className="h-80 rounded-2xl bg-[#0E0E12] animate-pulse border border-white/[0.06]"
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
