import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion } from 'motion/react'
import {
  Search,
  SlidersHorizontal,
  RefreshCw,
  X,
  Compass,
  LayoutGrid,
  Map,
} from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { EventCard } from '@/components/sections/EventCard'
import { EventDiscoveryMap } from '@/components/events/EventDiscoveryMap'
import { Button, EmptyState } from '@/components/ui'
import { SEOHead } from '@/components/seo/SEOHead'
import { staggerContainer } from '@/lib/animations'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useDebounce } from '@/hooks/useDebounce'
import { EVENT_CATEGORIES, type CategoryFilter } from '@/lib/mock-data'
import { listPublishedEvents, mapRecordToUiEvent, isEventCompleted } from '@/lib/events'
import type { Event } from '@/types'

const PAGE_SIZE = 12

export default function DiscoverPage() {
  const reduced = useReducedMotion()

  const [rawEvents, setRawEvents]   = useState<Event[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading]       = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const [viewMode, setViewMode]           = useState<'grid' | 'map'>('grid')
  const [search, setSearch]               = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const activeRequestId = useRef(0)

  const [category, setCategory]           = useState<CategoryFilter>('all')
  const [participationFilter, setParticipationFilter] = useState<'all' | 'individual' | 'team'>('all')
  const [pricingFilter, setPricingFilter] = useState<'all' | 'free' | 'paid'>('all')
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'closing_soon' | 'this_week'>('all')
  const [collegeFilter, setCollegeFilter] = useState<string>('all')
  const [offset, setOffset]               = useState(0)

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

  const displayedEvents = useMemo(() => {
    const now = Date.now()
    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000

    return rawEvents.filter((evt) => {
      if (isEventCompleted(evt)) return false
      if (participationFilter === 'individual' && evt.participationType !== 'individual') return false
      if (participationFilter === 'team' && evt.participationType !== 'team') return false
      if (pricingFilter === 'free' && !evt.isFree) return false
      if (pricingFilter === 'paid' && evt.isFree) return false
      if (collegeFilter !== 'all') {
        const matchesVenue = evt.venue?.toLowerCase().includes(collegeFilter.toLowerCase())
        const matchesAllowed = Array.isArray(evt.allowedColleges) && evt.allowedColleges.some((c) => c.toLowerCase().includes(collegeFilter.toLowerCase()))
        if (!matchesVenue && !matchesAllowed) return false
      }
      if (urgencyFilter === 'closing_soon') {
        const deadline = evt.registrationDeadline ? new Date(evt.registrationDeadline).getTime() : null
        const eventStart = evt.date ? new Date(evt.date).getTime() : null
        const targetTime = deadline || eventStart
        if (!targetTime || targetTime < now || (targetTime - now) > fiveDaysMs) return false
      } else if (urgencyFilter === 'this_week') {
        const eventStart = evt.date ? new Date(evt.date).getTime() : null
        if (!eventStart || eventStart < now || (eventStart - now) > sevenDaysMs) return false
      }
      return true
    })
  }, [rawEvents, participationFilter, pricingFilter, collegeFilter, urgencyFilter])

  const hasMore = rawEvents.length < totalCount
  const hasFilters = search.trim() || category !== 'all' || participationFilter !== 'all' || pricingFilter !== 'all' || collegeFilter !== 'all' || urgencyFilter !== 'all'

  const clearAllFilters = () => {
    setSearch('')
    setCategory('all')
    setParticipationFilter('all')
    setPricingFilter('all')
    setCollegeFilter('all')
    setUrgencyFilter('all')
  }

  return (
    <PageShell>
      <SEOHead
        title="Discover Campus Events & Hackathons"
        description="Find upcoming college hackathons, technical symposiums, workshops, and fests across verified campus clubs on FestFlow."
        canonicalPath="/discover"
      />

      {/* Page Hero Header */}
      <div className="bg-white border-b border-gray-200/80 py-8 sm:py-12 text-left">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 border border-blue-200 text-blue-700 mb-3">
            Campus Directory
          </span>
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-gray-900 tracking-tight mb-2">
            Discover Events
          </h1>
          <p className="max-w-2xl text-sm sm:text-base text-gray-600 leading-relaxed">
            Explore upcoming hackathons, cultural fests, workshops, esports tournaments, and academic symposiums hosted by verified campus clubs.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 w-full text-left">
        {/* Sticky Search & Filter Bar */}
        <div className="sticky top-16 z-30 py-4 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 mb-6 border-b border-gray-200 bg-[#F7F8FA]/95 backdrop-blur-md">
          <div className="flex flex-col gap-3 max-w-7xl mx-auto">
            {/* Search & Inline Filter Row */}
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
              <div className="relative flex-1 max-w-lg">
                <Search
                  size={16}
                  aria-hidden="true"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  id="event-search"
                  type="search"
                  placeholder="Search events, clubs, venues, or topics…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search campus events"
                  className="w-full h-10 pl-10 pr-10 rounded-lg bg-white border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-600/10 transition-colors shadow-2xs"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                    aria-label="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Sub-Filters */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar touch-pan-x shrink-0 -mx-4 px-4 sm:mx-0 sm:px-0 py-0.5">
                {/* Format filter */}
                <div className="flex items-center rounded-lg bg-gray-100 p-0.5 border border-gray-200 text-xs">
                  {(['all', 'individual', 'team'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setParticipationFilter(mode)}
                      className={`px-2.5 py-1.5 rounded-md font-medium transition-all capitalize cursor-pointer text-xs ${
                        participationFilter === mode
                          ? 'bg-white text-gray-900 font-semibold shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {mode === 'all' ? 'All Formats' : mode === 'team' ? 'Team' : 'Solo'}
                    </button>
                  ))}
                </div>

                {/* Pricing filter */}
                <div className="flex items-center rounded-lg bg-gray-100 p-0.5 border border-gray-200 text-xs">
                  {(['all', 'free', 'paid'] as const).map((price) => (
                    <button
                      key={price}
                      type="button"
                      onClick={() => setPricingFilter(price)}
                      className={`px-2.5 py-1.5 rounded-md font-medium transition-all capitalize cursor-pointer text-xs ${
                        pricingFilter === price
                          ? 'bg-white text-gray-900 font-semibold shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {price === 'all' ? 'Any Price' : price === 'free' ? 'Free Pass' : 'Ticketed'}
                    </button>
                  ))}
                </div>

                {/* Urgency filter */}
                <div className="flex items-center rounded-lg bg-gray-100 p-0.5 border border-gray-200 text-xs">
                  {([
                    { id: 'all', label: 'All Dates' },
                    { id: 'closing_soon', label: 'Closing Soon' },
                    { id: 'this_week', label: 'This Week' },
                  ] as const).map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setUrgencyFilter(id)}
                      className={`px-2.5 py-1.5 rounded-md font-medium transition-all whitespace-nowrap cursor-pointer text-xs ${
                        urgencyFilter === id
                          ? 'bg-white text-gray-900 font-semibold shadow-xs'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* College filter */}
                {availableColleges.length > 0 && (
                  <div className="flex items-center rounded-lg bg-white px-2.5 py-1 border border-gray-200 text-xs shrink-0 h-[34px]">
                    <select
                      value={collegeFilter}
                      onChange={(e) => setCollegeFilter(e.target.value)}
                      className="bg-transparent text-xs text-gray-700 font-medium focus:outline-none cursor-pointer max-w-[150px] truncate"
                      aria-label="Filter events by campus or college"
                    >
                      <option value="all">All Campuses</option>
                      {availableColleges.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* View Mode Toggle */}
                <div className="flex items-center rounded-lg bg-gray-100 p-0.5 border border-gray-200 text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium transition-all cursor-pointer text-xs ${
                      viewMode === 'grid'
                        ? 'bg-white text-gray-900 font-semibold shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <LayoutGrid size={13} />
                    <span className="hidden sm:inline">Grid</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('map')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium transition-all cursor-pointer text-xs ${
                      viewMode === 'map'
                        ? 'bg-white text-gray-900 font-semibold shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Map size={13} />
                    <span>Map</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Category Filter Chips */}
            <div
              role="group"
              aria-label="Filter by category"
              className="flex gap-2 overflow-x-auto no-scrollbar touch-pan-x -mx-4 px-4 sm:mx-0 sm:px-0 py-0.5"
            >
              {EVENT_CATEGORIES.map(({ value, label }) => {
                const isSelected = category === value
                return (
                  <button
                    key={value}
                    type="button"
                    id={`cat-filter-${value}`}
                    onClick={() => setCategory(value)}
                    aria-pressed={isSelected}
                    className={`px-3.5 py-1.5 whitespace-nowrap shrink-0 rounded-full text-xs font-medium border transition-colors capitalize flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-gray-900 text-white border-gray-900 font-semibold shadow-xs'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900'
                    }`}
                  >
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>

            {/* Results Count */}
            <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
              <div className="flex items-center gap-2 font-medium">
                <SlidersHorizontal size={13} aria-hidden="true" className="text-gray-400" />
                <span>
                  {loading
                    ? 'Loading verified campus events…'
                    : `${displayedEvents.length} event${displayedEvents.length !== 1 ? 's' : ''} available`}
                </span>
                {totalCount > displayedEvents.length && (
                  <span className="text-gray-400">
                    (filtered from {totalCount} total)
                  </span>
                )}
              </div>

              {hasFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <X size={12} /> Clear all filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm mb-6 flex items-center gap-2">
            <X size={16} className="shrink-0 text-rose-600" />
            <span>Failed to load events: {error}</span>
          </div>
        )}

        {/* Map View */}
        {viewMode === 'map' && (
          <div className="mb-8">
            <EventDiscoveryMap events={displayedEvents} />
          </div>
        )}

        {/* Content Grid / Skeletons / Empty State */}
        {viewMode === 'grid' && (loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="h-80 rounded-xl bg-white animate-pulse border border-gray-200"
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
                  variant="secondary"
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
                <Button variant="secondary" size="sm" onClick={clearAllFilters}>
                  Clear All Filters
                </Button>
              ) : undefined
            }
          />
        ))}
      </div>
    </PageShell>
  )
}
