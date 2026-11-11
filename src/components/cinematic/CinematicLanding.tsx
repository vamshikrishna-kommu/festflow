/**
 * FESTFLOW MOBILE FILM 2.0 — MASTER CINEMATIC ORCHESTRATOR
 *
 * Implements the 5-Scene Interactive Product Film Standard:
 * 1. Scene 01: Brand Reveal (Logo, energy beam, headline)
 * 2. Scene 02: Discover Campus Events (FestFlow discovery preview)
 * 3. Scene 03: The Student Journey (Central smartphone 6-step sequential scrub)
 * 4. Scene 04: The Organizer Experience (Mobile club command center 4-stage scrub)
 * 5. Scene 05: The Final Reveal (Converged experience, logo focal point, CTAs)
 *
 * Features:
 * - Direct scroll-driven bidirectional GSAP ScrollTrigger timelines (scroll down = forward, scroll up = reverse)
 * - Native browser scrolling preserved (no wheel interception, no scroll hijacking)
 * - Safe viewport handling for 320px to 430px mobile widths
 * - Live campus events feed integration with explicit loading, error+retry, empty, and populated states
 * - Full reduced motion support
 * - Context-aware Skip-to-Join control that hides automatically upon reaching Scene 05
 */
import { useEffect, useState, useRef, useCallback } from 'react'
import { Link } from 'react-router'
import { Calendar, ChevronRight, ArrowRight, FastForward, AlertCircle, RefreshCw } from 'lucide-react'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { ScrollTrigger } from '@/lib/gsap'
import { listPublishedEvents, mapRecordToUiEvent, isEventCompleted } from '@/lib/events'
import type { Event as UiEvent } from '@/types'
import { Button, EmptyState } from '@/components/ui'
import { EventGrid } from '@/components/sections/EventGrid'

import { getNavbarOffset } from './CinematicShared'
import { Scene01BrandReveal } from './Scene01BrandReveal'
import { Scene02DiscoverEvents } from './Scene02DiscoverEvents'
import { Scene03StudentJourney } from './Scene03StudentJourney'
import { Scene04OrganizerExperience } from './Scene04OrganizerExperience'
import { Scene05FinalReveal } from './Scene05FinalReveal'

const CLUB_COMMUNITIES = [
  'Technical Chapters',
  'Cultural Societies',
  'Sports Councils',
  'Hackathon Organizers',
  'Academic Forums',
  'Literary & Arts Clubs',
  'Student Unions',
  'Design & Media Labs',
  'Music Collectives',
  'Robotics Clubs',
]

function CampusChapterTicker() {
  const reduced = useReducedMotion()
  const items = [...CLUB_COMMUNITIES, ...CLUB_COMMUNITIES, ...CLUB_COMMUNITIES]

  return (
    <div
      aria-label="Campus communities supported by FestFlow"
      className="py-4 sm:py-5 border-y border-white/[0.06] bg-[#0A0A0E]/70 backdrop-blur-md overflow-hidden relative z-10 select-none"
    >
      <p className="text-center text-[9px] sm:text-[10px] uppercase tracking-widest text-zinc-500 mb-2 font-mono font-semibold">
        Engineered for University Chapters &amp; Student Communities
      </p>
      <div className="relative overflow-hidden">
        <div
          className="ticker-track"
          style={reduced ? { justifyContent: 'center', flexWrap: 'wrap', gap: '1.25rem', animation: 'none' } : {}}
        >
          {items.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="whitespace-nowrap text-xs font-semibold text-zinc-400 hover:text-white transition-colors px-4 shrink-0 flex items-center gap-1.5"
            >
              <span className="text-[#18CFFC]" aria-hidden="true">✦</span>
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function CinematicLanding() {
  const reducedMotion = useReducedMotion()
  const [events, setEvents] = useState<UiEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [showSkip, setShowSkip] = useState(false)
  const masterContainerRef = useRef<HTMLDivElement>(null)
  const requestIdRef = useRef(0)

  const loadLiveEvents = useCallback(async () => {
    const reqId = ++requestIdRef.current
    setLoading(true)
    setEventsError(null)
    try {
      const res = await listPublishedEvents({ limit: 6 })
      if (reqId !== requestIdRef.current) return

      if (res.error) {
        setEvents([])
        setEventsError(res.error)
      } else {
        const activeEvents = (res.events || [])
          .filter((e) => !isEventCompleted(e))
          .map(mapRecordToUiEvent)
        setEvents(activeEvents)
      }
    } catch (err) {
      if (reqId !== requestIdRef.current) return
      setEvents([])
      setEventsError(err instanceof Error ? err.message : 'Unable to load live campus events.')
    } finally {
      if (reqId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadLiveEvents()
    return () => {
      // Invalidate any in-flight request on unmount
      requestIdRef.current += 1
    }
  }, [loadLiveEvents])

  useEffect(() => {
    const updateSkipVisibility = () => {
      const pastIntro = window.scrollY > 280
      const finalEl = document.getElementById('scene-05-final')
      if (!finalEl) {
        setShowSkip(pastIntro)
        return
      }
      const rect = finalEl.getBoundingClientRect()
      // Hide Skip control once Scene 05 enters upper viewport, keeping it hidden across #events and Footer
      const beforeFinal = rect.top > window.innerHeight * 0.65
      setShowSkip(pastIntro && beforeFinal)
    }

    updateSkipVisibility()
    window.addEventListener('scroll', updateSkipVisibility, { passive: true })
    window.addEventListener('resize', updateSkipVisibility, { passive: true })
    return () => {
      window.removeEventListener('scroll', updateSkipVisibility)
      window.removeEventListener('resize', updateSkipVisibility)
    }
  }, [reducedMotion])

  const handleSkipToFinal = () => {
    const el = document.getElementById('scene-05-final')
    if (!el) return
    const navbarOffset = getNavbarOffset()
    const targetTop = Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY - navbarOffset))
    window.scrollTo({
      top: targetTop,
      behavior: 'auto',
    })
    ScrollTrigger.update()
  }

  return (
    <div ref={masterContainerRef} className="relative w-full bg-[#08080A] text-white overflow-x-clip">
      {/* Context-aware Quick Skip Control — hides automatically upon reaching Scene 05, #events, or Footer */}
      {showSkip && (
        <aside
          aria-label="Skip to final actions"
          className="fixed bottom-[70px] right-2.5 min-[360px]:bottom-20 min-[360px]:right-3.5 sm:bottom-8 sm:right-8 z-30 transition-opacity duration-200"
        >
          <button
            type="button"
            onClick={handleSkipToFinal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 min-[360px]:px-3.5 min-[360px]:py-2 rounded-full text-[11px] min-[360px]:text-xs font-bold text-white bg-[#14141A]/95 hover:bg-[#1C1C24] border border-white/25 backdrop-blur-md shadow-2xl transition-all duration-200 hover:border-[#18CFFC]/60 cursor-pointer"
            aria-label="Skip to final actions"
          >
            <FastForward size={12} className="text-[#18CFFC]" />
            <span>Skip to Join</span>
          </button>
        </aside>
      )}

      {/* ─── SCENE 01: FestFlow Brand Reveal ─── */}
      <Scene01BrandReveal reducedMotion={reducedMotion} />

      {/* ─── Campus Chapter Ticker ─── */}
      <CampusChapterTicker />

      {/* ─── SCENE 02: Discover Campus Events ─── */}
      <Scene02DiscoverEvents reducedMotion={reducedMotion} />

      {/* ─── SCENE 03: The Student Journey ─── */}
      <Scene03StudentJourney reducedMotion={reducedMotion} />

      {/* ─── SCENE 04: The Organizer Experience ─── */}
      <Scene04OrganizerExperience reducedMotion={reducedMotion} />

      {/* ─── SCENE 05: The Final Reveal ─── */}
      <Scene05FinalReveal reducedMotion={reducedMotion} />

      {/* ─── LIVE CAMPUS EVENTS CALENDAR ─── */}
      <section
        id="events"
        aria-labelledby="live-events-heading"
        className="relative py-16 sm:py-24 pb-24 sm:pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full select-none"
      >
        <div className="mb-8 sm:mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold text-[#18CFFC] bg-[#14141A] border border-[#18CFFC]/30 mb-3">
              <Calendar size={13} />
              <span>Live Campus Calendar</span>
            </div>
            <h2
              id="live-events-heading"
              className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight"
            >
              Upcoming campus{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #18CFFC 0%, #07A4FC 50%, #7F1AFB 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                events.
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed max-w-xl">
              Published campus events synced directly from FestFlow organizers.
            </p>
          </div>

          <Link
            to="/discover"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#18CFFC] hover:underline"
          >
            <span>Explore all events</span>
            <ChevronRight size={15} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" aria-busy="true" aria-label="Loading upcoming campus events">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-72 sm:h-80 rounded-2xl bg-[#0E0E12] animate-pulse border border-white/10"
              />
            ))}
          </div>
        ) : eventsError ? (
          <div
            role="alert"
            className="rounded-2xl bg-[#0E0E12] border border-red-500/30 p-6 sm:p-8 text-center max-w-xl mx-auto shadow-xl"
          >
            <div className="w-11 h-11 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto mb-3">
              <AlertCircle size={20} />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white mb-1.5">
              Unable to Load Campus Events
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mb-5">
              We couldn&apos;t connect to the live campus event feed right now. Check your connection and try again.
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
              <Button
                variant="primary"
                size="md"
                onClick={() => void loadLiveEvents()}
                leftIcon={<RefreshCw size={14} />}
              >
                Retry Loading
              </Button>
              <Link to="/discover">
                <Button variant="outline" size="md" className="w-full sm:w-auto">
                  Open Discover Page
                </Button>
              </Link>
            </div>
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No Events Published Yet"
            description="Campus clubs are preparing their upcoming event schedules. Are you a club lead ready to launch your first event?"
            action={
              <Link to="/club/signup">
                <Button variant="primary" size="md" rightIcon={<ArrowRight size={15} />}>
                  Create Club Event
                </Button>
              </Link>
            }
            secondaryAction={
              <Link to="/discover">
                <Button variant="outline" size="md">
                  Browse Archive
                </Button>
              </Link>
            }
          />
        ) : (
          <EventGrid events={events} />
        )}

        <div className="mt-8 flex justify-center sm:hidden">
          <Link to="/discover" className="w-full max-w-sm">
            <Button variant="outline" size="md" className="w-full" rightIcon={<ChevronRight size={16} />}>
              Explore all campus events
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
