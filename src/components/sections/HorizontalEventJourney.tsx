import { useEffect, useState, useRef, useCallback } from 'react'
import { Link } from 'react-router'
import {
  Calendar,
  MapPin,
  ArrowRight,
  Ticket,
  ChevronRight,
  Building2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { Button, Badge } from '@/components/ui'
import { useScrollReveal } from '@/lib/motion'
import { listPublishedEvents, mapRecordToUiEvent, isEventCompleted } from '@/lib/events'
import type { Event as UiEvent } from '@/types'

export function HorizontalEventJourney() {
  const sectionRef = useRef<HTMLElement>(null)
  const [events, setEvents] = useState<UiEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useScrollReveal(sectionRef, { y: 18 })

  const loadFeaturedEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await listPublishedEvents({ limit: 8 })
    setLoading(false)
    if (res.error) {
      setError(res.error)
      return
    }
    const activeEvents = (res.events || [])
      .filter((e) => !isEventCompleted(e))
      .map(mapRecordToUiEvent)
    setEvents(activeEvents)
  }, [])

  useEffect(() => {
    let active = true
    listPublishedEvents({ limit: 8 }).then((res) => {
      if (!active) return
      setLoading(false)
      if (res.error) {
        setError(res.error)
        return
      }
      const activeEvents = (res.events || [])
        .filter((e) => !isEventCompleted(e))
        .map(mapRecordToUiEvent)
      setEvents(activeEvents)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <section
      id="journey"
      ref={sectionRef}
      aria-label="Featured Campus Events"
      className="relative bg-[#F7F8FA] border-b border-gray-200/80 py-16 sm:py-24"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 mb-3">
              Curated Campus Calendar
            </span>
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-gray-900 tracking-tight">
              Trending across campus right now.
            </h2>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">
              Browse upcoming hackathons, symposiums, and cultural fests hosted by verified university chapters.
            </p>
          </div>

          <Link to="/discover" className="shrink-0">
            <Button
              variant="secondary"
              size="sm"
              rightIcon={<ArrowRight size={14} />}
            >
              View all events
            </Button>
          </Link>
        </div>

        {/* Horizontal Carousel */}
        {loading ? (
          <div className="flex gap-5 overflow-x-auto pb-4 no-scrollbar">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="w-[320px] sm:w-[360px] h-[360px] rounded-xl bg-white animate-pulse border border-gray-200 shrink-0"
              />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 rounded-xl bg-white border border-rose-200 text-center max-w-xl mx-auto shadow-xs">
            <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertCircle size={20} />
            </div>
            <h3 className="text-base font-bold font-display text-gray-900">
              Unable to Load Upcoming Events
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 mt-1.5 mb-5 leading-relaxed">
              {error}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={loadFeaturedEvents}
              leftIcon={<RefreshCw size={14} />}
            >
              Retry
            </Button>
          </div>
        ) : events.length === 0 ? (
          <div className="p-10 rounded-xl bg-white border border-gray-200 text-center max-w-xl mx-auto shadow-xs">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <Ticket size={20} />
            </div>
            <h3 className="text-base font-bold font-display text-gray-900">
              Campus Calendar Forming
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-1.5 mb-5 leading-relaxed">
              Clubs are currently preparing their upcoming semester event schedules. Ready to launch yours?
            </p>
            <Link to="/club/signup">
              <Button variant="primary" size="sm" rightIcon={<ArrowRight size={14} />}>
                Launch Club Event Portal
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar">
            {events.map((event) => {
              const eventDate = event.date
                ? new Date(event.date).toLocaleDateString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'Upcoming'

              const isFree = event.isFree || !event.price || event.price === 0

              return (
                <div
                  key={event.id}
                  className="w-[300px] sm:w-[360px] rounded-xl bg-white border border-gray-200/90 hover:border-gray-300 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_28px_-6px_rgba(0,0,0,0.08)] transition-all duration-200 flex flex-col justify-between shrink-0 snap-start group overflow-hidden"
                >
                  {/* Top Banner Image */}
                  <div className="h-44 w-full relative overflow-hidden bg-gray-100 border-b border-gray-100">
                    {event.coverImage ? (
                      <img
                        src={event.coverImage}
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-50 flex items-center justify-center">
                        <Calendar size={28} className="text-gray-300" />
                      </div>
                    )}

                    {/* Top badges */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <Badge variant="default" className="bg-white/95 text-gray-800 border-gray-200 shadow-xs text-[10px] font-medium">
                        {event.category || 'Campus Event'}
                      </Badge>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shadow-xs ${
                          isFree
                            ? 'bg-emerald-50/95 text-emerald-700 border-emerald-200'
                            : 'bg-white/95 text-gray-900 border-gray-200'
                        }`}
                      >
                        {isFree ? 'Free' : `₹${event.price}`}
                      </span>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between text-left">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 font-medium mb-2">
                        <Calendar size={13} className="text-gray-400" />
                        <span>{eventDate}</span>
                        {event.venue && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span className="flex items-center gap-1 truncate max-w-[150px]">
                              <MapPin size={12} className="text-gray-400" /> {event.venue}
                            </span>
                          </>
                        )}
                      </div>

                      <h3 className="font-display font-semibold text-base text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1 mb-1.5">
                        {event.title}
                      </h3>

                      <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed mb-4">
                        {event.description || 'Join fellow university students for this official campus club event.'}
                      </p>
                    </div>

                    {/* Bottom Row */}
                    <div className="pt-3.5 border-t border-gray-100 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs text-gray-600 font-medium truncate max-w-[190px]">
                        <Building2 size={14} className="text-blue-600 shrink-0" />
                        <span className="truncate">{event.clubName || 'Campus Club'}</span>
                      </span>

                      <Link to={`/events/${event.slug}`}>
                        <Button
                          variant="ghost"
                          size="xs"
                          rightIcon={<ChevronRight size={13} />}
                          className="text-xs font-semibold text-gray-700 hover:text-gray-900"
                        >
                          Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
