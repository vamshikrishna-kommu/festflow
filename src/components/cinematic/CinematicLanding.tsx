/**
 * FESTFLOW CINEMATIC 4.0 — MASTER 10-WORLD ORCHESTRATOR
 * Codename: FESTFLOW INFINITE
 *
 * Implements the 10-World Grand Cinematic Continuum:
 * 1. World 01: The Void / FestFlow Awakens (#world-01-void)
 * 2. Campus Chapter Ticker (University chapters & student societies ribbon)
 * 3. World 02: The Campus Reveals Itself (#world-02-campus)
 * 4. World 03: Human Energy / Campus Comes Alive (#world-03-human)
 * 5. World 04: The Event Multiverse (#world-04-multiverse)
 * 6. World 05: Discover / Enter the Event (#world-05-discover)
 * 7. World 06: The Student Journey (#world-06-student)
 * 8. World 07: The Organizer Command Center (#world-07-organizer)
 * 9. World 08: The Connected Campus Network (#world-08-network)
 * 10. World 09: The Infinite Event Space (#world-09-infinite)
 * 11. World 10: The Final Brand Reveal (#world-10-final)
 * 12. Live Campus Calendar Feed (#events)
 *
 * Technical Guarantees:
 * - Centralized Lenis smooth scroll setup synced to GSAP ticker via initLenis / destroyLenis
 * - Full-bleed dynamic InfiniteUniverseCanvas background reacting to continuous masterProgress (0 to 1)
 * - Suspense and WebGLFallback wrapper for resilient GPU rendering
 * - Web Audio procedural sound engine toggle (AudioAmbienceToggle)
 * - Safe viewport handling for 320px to 4K resolutions with zero horizontal overflow (overflow-x-clip)
 * - Context-aware Quick Skip Control targeting World 10 (#world-10-final)
 * - Accessible reduced-motion support across all 10 worlds
 */
import { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react'
import { Link } from 'react-router'
import {
  Calendar,
  ChevronRight,
  ArrowRight,
  FastForward,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { initLenis, destroyLenis, ScrollTrigger } from '@/lib/motion'
import { listPublishedEvents, mapRecordToUiEvent, isEventCompleted } from '@/lib/events'
import type { Event as UiEvent } from '@/types'
import { Button, EmptyState } from '@/components/ui'
import { EventGrid } from '@/components/sections/EventGrid'
import { scrollToWorld } from './CinematicShared'
import { WebGLFallback } from './WebGLFallback'
import { AudioAmbienceToggle } from './AudioAmbienceToggle'

// 10 Worlds Sequential Imports
import { World01TheVoid } from './World01TheVoid'
import { World02CampusReveal } from './World02CampusReveal'
import { World03HumanEnergy } from './World03HumanEnergy'
import { World04EventMultiverse } from './World04EventMultiverse'
import { World05DiscoverPortal } from './World05DiscoverPortal'
import { World06StudentJourney } from './World06StudentJourney'
import { World07OrganizerCommand } from './World07OrganizerCommand'
import { World08ConnectedNetwork } from './World08ConnectedNetwork'
import { World09InfiniteSpace } from './World09InfiniteSpace'
import { World10FinalReveal } from './World10FinalReveal'

// Lazy load InfiniteUniverseCanvas with graceful fallback
const InfiniteUniverseCanvas = lazy(async () => {
  try {
    const mod = await import('./InfiniteUniverseCanvas')
    return { default: mod.InfiniteUniverseCanvas || mod.default }
  } catch {
    return {
      default: (props: { className?: string; reducedMotion?: boolean; scrollProgress?: number }) => (
        <WebGLFallback type="hero" {...props} />
      ),
    }
  }
})

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
          style={
            reduced
              ? { justifyContent: 'center', flexWrap: 'wrap', gap: '1.25rem', animation: 'none' }
              : {}
          }
        >
          {items.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="whitespace-nowrap text-xs font-semibold text-zinc-400 hover:text-white transition-colors px-4 shrink-0 flex items-center gap-1.5"
            >
              <span className="text-[#18CFFC]" aria-hidden="true">
                ✦
              </span>
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
  const [masterProgress, setMasterProgress] = useState(0)

  const masterContainerRef = useRef<HTMLDivElement>(null)
  const requestIdRef = useRef(0)

  // Initialize smooth scrolling with Lenis synced to GSAP ticker
  useEffect(() => {
    if (reducedMotion) return
    const lenis = initLenis()

    return () => {
      destroyLenis(lenis)
    }
  }, [reducedMotion])

  // Continuous master scroll progress calculation (0 to 1) for InfiniteUniverseCanvas
  useEffect(() => {
    if (reducedMotion) return
    const container = masterContainerRef.current
    if (!container) return

    const st = ScrollTrigger.create({
      trigger: container,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        setMasterProgress(self.progress)
      },
    })

    return () => {
      st.kill()
    }
  }, [reducedMotion])

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
      requestIdRef.current += 1
    }
  }, [loadLiveEvents])

  // Context-aware Skip-to-Join button visibility handler targeting World 10 (#world-10-final)
  useEffect(() => {
    const updateSkipVisibility = () => {
      const pastIntro = window.scrollY > 280
      const finalEl = document.getElementById('world-10-final')
      if (!finalEl) {
        setShowSkip(pastIntro)
        return
      }
      const rect = finalEl.getBoundingClientRect()
      // Hide Skip control once World 10 enters viewport, keeping it hidden across #events and Footer
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
    scrollToWorld('world-10-final')
    ScrollTrigger.update()
  }

  return (
    <div
      ref={masterContainerRef}
      className="relative w-full bg-[#08080A] text-white overflow-x-clip"
    >
      {/* ─── MASTER 3D BACKGROUND UNIVERSE CANVAS ─── */}
      <Suspense fallback={<WebGLFallback type="hero" reducedMotion={reducedMotion} />}>
        <InfiniteUniverseCanvas
          scrollProgress={masterProgress}
          reducedMotion={reducedMotion}
        />
      </Suspense>

      {/* ─── FLOATING AUDIO AMBIENCE TOGGLE (Web Audio procedural synthesis) ─── */}
      <aside
        aria-label="Sound ambience toggle"
        className="fixed top-20 right-3.5 sm:top-24 sm:right-6 z-40 transition-opacity duration-200"
      >
        <AudioAmbienceToggle showLabel={false} />
      </aside>

      {/* ─── CONTEXT-AWARE QUICK SKIP CONTROL (Targets World 10) ─── */}
      {showSkip && (
        <aside
          aria-label="Skip to final actions"
          className="fixed bottom-[70px] right-2.5 min-[360px]:bottom-20 min-[360px]:right-3.5 sm:bottom-8 sm:right-8 z-30 transition-opacity duration-200"
        >
          <button
            type="button"
            onClick={handleSkipToFinal}
            className="flex items-center gap-1.5 px-3 py-2 min-[360px]:px-4 min-[360px]:py-2.5 rounded-full text-[11px] min-[360px]:text-xs font-bold text-white bg-[#14141A]/95 hover:bg-[#1C1C24] border border-white/25 backdrop-blur-md shadow-2xl transition-all duration-200 hover:border-[#18CFFC]/60 hover:shadow-[0_0_20px_rgba(24,207,252,0.25)] cursor-pointer"
            aria-label="Skip to final actions"
          >
            <FastForward size={13} className="text-[#18CFFC]" />
            <span>Skip to Join</span>
          </button>
        </aside>
      )}

      {/* ─── WORLD 01: The Void / FestFlow Awakens ─── */}
      <World01TheVoid reducedMotion={reducedMotion} />

      {/* ─── Campus Chapter Ticker ─── */}
      <CampusChapterTicker />

      {/* ─── WORLD 02: The Campus Reveals Itself ─── */}
      <World02CampusReveal reducedMotion={reducedMotion} />

      {/* ─── WORLD 03: Human Energy / Campus Comes Alive ─── */}
      <World03HumanEnergy reducedMotion={reducedMotion} />

      {/* ─── WORLD 04: The Event Multiverse ─── */}
      <World04EventMultiverse reducedMotion={reducedMotion} />

      {/* ─── WORLD 05: Discover / Enter the Event ─── */}
      <World05DiscoverPortal reducedMotion={reducedMotion} />

      {/* ─── WORLD 06: The Student Journey ─── */}
      <World06StudentJourney reducedMotion={reducedMotion} />

      {/* ─── WORLD 07: The Organizer Command Center ─── */}
      <World07OrganizerCommand reducedMotion={reducedMotion} />

      {/* ─── WORLD 08: The Connected Campus Network ─── */}
      <World08ConnectedNetwork reducedMotion={reducedMotion} />

      {/* ─── WORLD 09: The Infinite Event Space ─── */}
      <World09InfiniteSpace reducedMotion={reducedMotion} />

      {/* ─── WORLD 10: The Final Brand Reveal ─── */}
      <World10FinalReveal reducedMotion={reducedMotion} />

      {/* ─── LIVE CAMPUS EVENTS CALENDAR ─── */}
      <section
        id="events"
        aria-labelledby="live-events-heading"
        className="relative py-16 sm:py-24 pb-24 sm:pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full select-none"
      >
        <div className="mb-8 sm:mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold text-[#18CFFC] bg-[#14141A] border border-[#18CFFC]/30 mb-3 font-mono">
              <Calendar size={13} />
              <span>Live Campus Calendar</span>
            </div>
            <h2
              id="live-events-heading"
              className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight font-display"
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
            <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed max-w-xl font-body">
              Published campus events synced directly from FestFlow student organizers.
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
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            aria-busy="true"
            aria-label="Loading upcoming campus events"
          >
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
            <h3 className="text-base sm:text-lg font-bold text-white mb-1.5 font-display">
              Unable to Load Campus Events
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed mb-5 font-body">
              We couldn&apos;t connect to the live campus event feed right now. Check your connection
              and try again.
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
            <Button
              variant="outline"
              size="md"
              className="w-full"
              rightIcon={<ChevronRight size={16} />}
            >
              Explore all campus events
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}

export default CinematicLanding
