import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Search,
  SlidersHorizontal,
  RefreshCw,
  Sparkles,
  X,
  Compass,
  LayoutGrid,
  Map,
  Flame,
  Armchair,
  Ticket,
  ChevronRight,
  Filter,
} from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { EventCard } from '@/components/sections/EventCard'
import { EventDiscoveryMap } from '@/components/events/EventDiscoveryMap'
import { Button } from '@/components/ui'
import { SEOHead } from '@/components/seo/SEOHead'
import { staggerContainer, fadeUp } from '@/lib/animations'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useDebounce } from '@/hooks/useDebounce'
import { EVENT_CATEGORIES, type CategoryFilter } from '@/lib/mock-data'
import { listPublishedEvents, mapRecordToUiEvent, isEventCompleted } from '@/lib/events'
import type { Event } from '@/types'

const PAGE_SIZE = 12

export default function DiscoverPage() {
  const reduced = useReducedMotion()

  const [rawEvents, setRawEvents]     = useState<Event[]>([])
  const [totalCount, setTotalCount]   = useState(0)
  const [loading, setLoading]         = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const [viewMode, setViewMode]             = useState<'grid' | 'map'>('grid')
  const [search, setSearch]                 = useState('')
  // Debounce search query to eliminate network storms on every keystroke
  const debouncedSearch = useDebounce(search, 300)
  const activeRequestId = useRef(0)

  const [category, setCategory]                         = useState<CategoryFilter>('all')
  const [participationFilter, setParticipationFilter]   = useState<'all' | 'individual' | 'team'>('all')
  const [pricingFilter, setPricingFilter]               = useState<'all' | 'free' | 'paid'>('all')
  const [urgencyFilter, setUrgencyFilter]               = useState<'all' | 'closing_soon' | 'this_week'>('all')
  const [seatingOnly, setSeatingOnly]                   = useState(false)
  const [collegeFilter, setCollegeFilter]               = useState<string>('all')
  const [offset, setOffset]                             = useState(0)

  // Derive unique college / campus venues from verified events
  const availableColleges = useMemo(() => {
    const set = new Set<string>()
    for (const evt of rawEvents) {
      if (evt.venue && evt.venue !== 'Campus Venue' && evt.venue !== 'Online') {
        set.add(evt.venue)
      }
      if (Array.isArray(evt.allowedColleges)) {
        evt.allowedColleges.forEach((c) => {
          if (c && c.trim()) set.add(c.trim())
        })
      }
    }
    return Array.from(set).sort()
  }, [rawEvents])

  const fetchEvents = useCallback(async (isLoadMore = false, newOffset = 0) => {
    const reqId = ++activeRequestId.current
    if (isLoadMore) setLoadingMore(true)
    else setLoading(true)
    setError(null)

    const res = await listPublishedEvents({
      category: category === 'all' ? undefined : category,
      search: debouncedSearch.trim() || undefined,
      limit: PAGE_SIZE,
      offset: newOffset,
    })

    // Ignore response if a newer search query was fired
    if (reqId !== activeRequestId.current) return

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
  }, [category, debouncedSearch])

  useEffect(() => {
    setOffset(0)
    fetchEvents(false, 0)
  }, [category, debouncedSearch, fetchEvents])

  const handleLoadMore = () => {
    const next = offset + PAGE_SIZE
    setOffset(next)
    fetchEvents(true, next)
  }

  // Client-side refinement for completed status, participation type, pricing, college, seating and closing-soon filters
  const displayedEvents = useMemo(() => {
    const now = Date.now()
    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000

    return rawEvents.filter((evt) => {
      if (isEventCompleted(evt)) {
        return false
      }
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
      if (seatingOnly) {
        // Events with reserved seating
        const hasSeatTag = Array.isArray(evt.tags) && evt.tags.some(t => t.toLowerCase().includes('seat') || t.toLowerCase().includes('auditorium'))
        const isAuditoriumVenue = evt.venue?.toLowerCase().includes('auditorium') || evt.venue?.toLowerCase().includes('hall')
        if (!hasSeatTag && !isAuditoriumVenue) {
          return false
        }
      }
      if (collegeFilter !== 'all') {
        const matchesVenue = evt.venue?.toLowerCase().includes(collegeFilter.toLowerCase())
        const matchesAllowed = Array.isArray(evt.allowedColleges) && evt.allowedColleges.some((c) => c.toLowerCase().includes(collegeFilter.toLowerCase()))
        if (!matchesVenue && !matchesAllowed) return false
      }
      if (urgencyFilter === 'closing_soon') {
        const deadline = evt.registrationDeadline ? new Date(evt.registrationDeadline).getTime() : null
        const eventStart = evt.date ? new Date(evt.date).getTime() : null
        const targetTime = deadline || eventStart
        if (!targetTime || targetTime < now || (targetTime - now) > fiveDaysMs) {
          return false
        }
      } else if (urgencyFilter === 'this_week') {
        const eventStart = evt.date ? new Date(evt.date).getTime() : null
        if (!eventStart || eventStart < now || (eventStart - now) > sevenDaysMs) {
          return false
        }
      }
      return true
    })
  }, [rawEvents, participationFilter, pricingFilter, collegeFilter, urgencyFilter, seatingOnly])

  const hasMore = rawEvents.length < totalCount
  const hasFilters =
    search.trim() ||
    category !== 'all' ||
    participationFilter !== 'all' ||
    pricingFilter !== 'all' ||
    collegeFilter !== 'all' ||
    urgencyFilter !== 'all' ||
    seatingOnly

  const clearAllFilters = () => {
    setSearch('')
    setCategory('all')
    setParticipationFilter('all')
    setPricingFilter('all')
    setCollegeFilter('all')
    setUrgencyFilter('all')
    setSeatingOnly(false)
  }

  return (
    <PageShell>
      <SEOHead
        title="Discover Campus Events & Hackathons"
        description="Find upcoming college hackathons, technical symposiums, workshops, and fests across verified campus clubs on FestFlow."
        canonicalPath="/discover"
      />

      {/* ── Page Hero Header ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-white/[0.08] pb-10 sm:pb-14 text-left bg-gradient-to-b from-[#0E0E12] via-[#08080A] to-[#08080A]">
        {/* Subtle background glow */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 75% 90% at 50% -10%, rgba(24, 207, 252, 0.16) 0%, rgba(127, 26, 251, 0.08) 45%, transparent 75%)',
          }}
        />
        <div aria-hidden="true" className="absolute inset-0 grid-pattern opacity-15 pointer-events-none" />

        <motion.div
          variants={staggerContainer}
          initial={reduced ? 'visible' : 'hidden'}
          animate="visible"
          className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10"
        >
          <motion.div
            variants={reduced ? undefined : fadeUp}
            className="flex items-center gap-2 mb-3"
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#18CFFC]/10 border border-[#18CFFC]/30 text-[#18CFFC] backdrop-blur-md">
              <Sparkles size={12} aria-hidden="true" className="animate-pulse" /> Campus Discovery Hub
            </div>
          </motion.div>

          <motion.h1
            variants={reduced ? undefined : fadeUp}
            className="font-display font-black text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white mb-4 tracking-tight leading-[1.1]"
          >
            Explore Campus{' '}
            <span className="bg-gradient-to-r from-[#18CFFC] via-[#07A4FC] to-[#ED47FC] bg-clip-text text-transparent">
              Experiences
            </span>
          </motion.h1>

          <motion.p
            variants={reduced ? undefined : fadeUp}
            className="max-w-2xl text-sm sm:text-base text-[var(--color-text-secondary)] font-body leading-relaxed"
          >
            Discover hackathons, cultural festivals, academic symposiums, gaming tournaments, and
            workshops hosted by verified collegiate clubs.
          </motion.p>
        </motion.div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 w-full text-left">
        {/* ── Search & Controls Bar ──────────────────────────────────── */}
        <div
          className="sticky top-16 z-30 py-4 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 mb-6 border-b border-white/[0.08] shadow-2xl shadow-black/40"
          style={{ background: 'rgba(8, 8, 10, 0.94)', backdropFilter: 'blur(24px)' }}
        >
          <div className="flex flex-col gap-3.5 max-w-7xl mx-auto">
            {/* Search Input Row & Sub-Filters */}
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
              {/* Search with subtle glow on focus */}
              <div className="relative flex-1 max-w-xl group">
                <Search
                  size={17}
                  aria-hidden="true"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-[#18CFFC] transition-colors pointer-events-none"
                />
                <input
                  id="event-search"
                  type="search"
                  placeholder="Search events, clubs, venues, or topics…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search campus events"
                  className="w-full h-11 pl-10 pr-10 rounded-xl bg-[#14141A] border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#18CFFC] focus:ring-2 focus:ring-[#18CFFC]/25 focus:shadow-[0_0_24px_rgba(24,207,252,0.22)] transition-all shadow-inner"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                    aria-label="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Sub-Filters: Participation, Pricing, High-Contrast Badges */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar touch-pan-x shrink-0 -mx-4 px-4 sm:mx-0 sm:px-0 py-0.5">
                {/* High Contrast Badges: Free Pass */}
                <button
                  type="button"
                  onClick={() => setPricingFilter(pricingFilter === 'free' ? 'all' : 'free')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                    pricingFilter === 'free'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50 shadow-md shadow-emerald-500/20'
                      : 'bg-[#14141A] text-zinc-400 border-white/[0.08] hover:text-white hover:border-white/20'
                  }`}
                >
                  <Ticket size={13} className={pricingFilter === 'free' ? 'text-emerald-300' : 'text-zinc-400'} />
                  <span>Free Pass</span>
                </button>

                {/* High Contrast Badges: Reserved Seating */}
                <button
                  type="button"
                  onClick={() => setSeatingOnly(!seatingOnly)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                    seatingOnly
                      ? 'bg-[#0D56FB]/25 text-[#18CFFC] border-[#18CFFC]/50 shadow-md shadow-[#18CFFC]/20'
                      : 'bg-[#14141A] text-zinc-400 border-white/[0.08] hover:text-white hover:border-white/20'
                  }`}
                >
                  <Armchair size={13} className={seatingOnly ? 'text-[#18CFFC]' : 'text-zinc-400'} />
                  <span>Reserved Seating</span>
                </button>

                {/* High Contrast Badges: Urgent / Filling Fast */}
                <button
                  type="button"
                  onClick={() => setUrgencyFilter(urgencyFilter === 'closing_soon' ? 'all' : 'closing_soon')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                    urgencyFilter === 'closing_soon'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400/50 shadow-md shadow-amber-500/20'
                      : 'bg-[#14141A] text-zinc-400 border-white/[0.08] hover:text-white hover:border-white/20'
                  }`}
                >
                  <Flame size={13} className={urgencyFilter === 'closing_soon' ? 'text-amber-300 animate-bounce' : 'text-zinc-400'} />
                  <span>Urgent / Closing Soon</span>
                </button>

                {/* Participation filter */}
                <div className="flex items-center rounded-xl bg-[#14141A] p-1 border border-white/[0.08] text-xs">
                  {(['all', 'individual', 'team'] as const).map((mode) => (
                    <motion.button
                      key={mode}
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      onClick={() => setParticipationFilter(mode)}
                      className={`px-2.5 py-1 rounded-lg font-medium transition-all capitalize cursor-pointer text-xs ${
                        participationFilter === mode
                          ? 'bg-[#262632] text-white font-semibold shadow-sm border border-white/10'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {mode === 'all' ? 'All Formats' : mode === 'team' ? 'Team' : 'Solo'}
                    </motion.button>
                  ))}
                </div>

                {/* Campus / College filter */}
                {availableColleges.length > 0 && (
                  <div className="flex items-center rounded-xl bg-[#14141A] px-2.5 py-1 border border-white/[0.08] text-xs shrink-0">
                    <select
                      value={collegeFilter}
                      onChange={(e) => setCollegeFilter(e.target.value)}
                      className="bg-transparent text-xs text-zinc-300 focus:outline-none cursor-pointer py-1 max-w-[140px] truncate"
                      aria-label="Filter events by campus or college"
                    >
                      <option value="all" className="bg-[#14141A] text-white">All Campuses</option>
                      {availableColleges.map((col) => (
                        <option key={col} value={col} className="bg-[#14141A] text-white">
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* View Mode Toggle: Grid vs Map */}
                <div className="flex items-center rounded-xl bg-[#14141A] p-1 border border-white/[0.08] text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer text-xs ${
                      viewMode === 'grid'
                        ? 'bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] text-white font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <LayoutGrid size={13} />
                    <span className="hidden sm:inline">Grid</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('map')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer text-xs ${
                      viewMode === 'map'
                        ? 'bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] text-white font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Map size={13} />
                    <span>Radar Map</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Category Filter Pills — Horizontal Scroll with Mask Fade */}
            <div className="relative -mx-4 px-4 sm:mx-0 sm:px-0">
              {/* Fade gradient indicators on edges */}
              <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[#08080A] to-transparent z-10 sm:hidden" />
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[#08080A] to-transparent z-10 sm:hidden" />

              <div
                role="group"
                aria-label="Filter by category"
                className="flex gap-2 overflow-x-auto no-scrollbar touch-pan-x py-1"
                style={{
                  maskImage:
                    'linear-gradient(to right, black calc(100% - 24px), transparent 100%)',
                }}
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
                          ? 'bg-gradient-to-r from-[#18CFFC] via-[#07A4FC] to-[#7F1AFB] text-white border-[#18CFFC]/50 shadow-md shadow-[#18CFFC]/25'
                          : 'bg-[#14141A] border-white/[0.08] text-zinc-400 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <span>{label}</span>
                    </motion.button>
                  )
                })}
              </div>
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
                  className="text-xs text-[#18CFFC] hover:text-[#18CFFC]/80 flex items-center gap-1 font-sans font-medium transition-colors"
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

        {/* ── View Transitions: Grid vs Radar Map ─────────────────────────── */}
        <AnimatePresence mode="wait">
          {viewMode === 'map' ? (
            <motion.div
              key="radar-map-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="mb-8"
            >
              <EventDiscoveryMap events={displayedEvents} />
            </motion.div>
          ) : (
            <motion.div
              key="event-grid-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
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
                    {displayedEvents.map((event, idx) => (
                      <li key={event.id} className="h-full">
                        <EventCard event={event} animated priority={idx < 2} />
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
                /* Branded Premium Empty State */
                <div className="relative py-16 px-6 sm:px-12 rounded-3xl bg-[#0E0E12] border border-white/[0.08] text-center overflow-hidden my-8">
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(24, 207, 252, 0.08) 0%, rgba(127, 26, 251, 0.04) 50%, transparent 80%)',
                    }}
                  />

                  <div className="relative max-w-md mx-auto flex flex-col items-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#18CFFC]/20 to-[#7F1AFB]/20 border border-[#18CFFC]/30 flex items-center justify-center text-[#18CFFC] mb-5 shadow-lg shadow-[#18CFFC]/10">
                      <Compass size={32} />
                    </div>

                    <h3 className="font-display font-bold text-xl sm:text-2xl text-white mb-2">
                      {hasFilters ? 'No Campus Events Found' : 'No Events Published Yet'}
                    </h3>

                    <p className="text-sm text-[var(--color-text-secondary)] font-body leading-relaxed mb-6">
                      {hasFilters
                        ? 'No events match your current combination of category, format, or search criteria. Try relaxing your filters or resetting them below.'
                        : 'Student clubs are currently preparing upcoming experiences. Check back soon for the next festival or technical symposium.'}
                    </p>

                    {hasFilters && (
                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        <Button
                          size="sm"
                          onClick={clearAllFilters}
                          className="bg-gradient-to-r from-[#18CFFC] to-[#0D56FB] text-white hover:brightness-110 font-semibold px-5"
                        >
                          <Filter size={14} />
                          Reset All Filters
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            clearAllFilters()
                            setCategory('tech')
                          }}
                          className="border-white/10 text-zinc-300 hover:text-white text-xs"
                        >
                          Browse Technical
                          <ChevronRight size={13} />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageShell>
  )
}
