/**
 * Cinematic Landing Page Orchestrator
 * Integrates Scenes 01 to 09 into a seamless, scroll-driven visual journey.
 * Features:
 * - Native browser scrolling (no hijacking)
 * - Forward & reverse scrub / trigger animations powered by GSAP
 * - Floating "Skip Experience" control for fast navigation
 * - Live published campus events showcase
 * - Campus community ticker
 * - Reduced motion accessibility awareness
 */
import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router'
import { Calendar, ChevronRight, ArrowRight, FastForward } from 'lucide-react'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { listPublishedEvents, mapRecordToUiEvent, isEventCompleted } from '@/lib/events'
import type { Event as UiEvent } from '@/types'
import { Button, EmptyState } from '@/components/ui'
import { EventGrid } from '@/components/sections/EventGrid'
import { Scene01Intro } from './Scene01Intro'
import { Scene02Events } from './Scene02Events'
import { Scene03Discover } from './Scene03Discover'
import { Scene04Register } from './Scene04Register'
import { Scene05Payment } from './Scene05Payment'
import { Scene06Ticket } from './Scene06Ticket'
import { Scene07Organizer } from './Scene07Organizer'
import { Scene08Connected } from './Scene08Connected'
import { Scene09Final } from './Scene09Final'

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

function CinematicTicker() {
  const reduced = useReducedMotion()
  const items = [...CLUB_COMMUNITIES, ...CLUB_COMMUNITIES, ...CLUB_COMMUNITIES]

  return (
    <div
      aria-label="Campus communities supported by FestFlow"
      className="py-5 sm:py-6 border-y border-white/[0.06] bg-[#0A0A0E]/60 backdrop-blur-md overflow-hidden relative z-10"
    >
      <p className="text-center text-[10px] uppercase tracking-widest text-zinc-500 mb-2.5 font-semibold">
        Engineered for University Chapters & Student Communities
      </p>
      <div className="relative overflow-hidden">
        <div
          className="ticker-track"
          style={reduced ? { justifyContent: 'center', flexWrap: 'wrap', gap: '1.5rem', animation: 'none' } : {}}
        >
          {items.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="whitespace-nowrap text-xs font-semibold text-zinc-400 hover:text-white transition-colors px-5 shrink-0 flex items-center gap-2"
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
  const [showSkip, setShowSkip] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let mounted = true
    listPublishedEvents({ limit: 6 }).then((res) => {
      if (!mounted) return
      setLoading(false)
      const activeEvents = (res.events || [])
        .filter((e) => !isEventCompleted(e))
        .map(mapRecordToUiEvent)
      setEvents(activeEvents)
    })

    const handleScroll = () => {
      // Show skip button once user has scrolled past 300px
      if (window.scrollY > 300) {
        setShowSkip(true)
      } else {
        setShowSkip(false)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      mounted = false
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const handleSkipToFinal = () => {
    const el = document.getElementById('scene-final')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div ref={containerRef} className="relative w-full bg-[#08080A] text-white overflow-hidden">
      {/* Floating Quick Skip Control */}
      {showSkip && (
        <aside
          aria-label="Page navigation"
          className="fixed bottom-20 right-4 sm:bottom-8 sm:right-8 z-40 transition-opacity duration-300"
        >
          <button
            type="button"
            onClick={handleSkipToFinal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-white/90 bg-[#14141A]/90 hover:bg-[#1C1C24] border border-white/15 backdrop-blur-md shadow-2xl transition-all duration-200 hover:border-[#18CFFC]/50 hover:text-white cursor-pointer"
            aria-label="Skip to final section"
          >
            <FastForward size={13} className="text-[#18CFFC]" />
            <span>Skip to Join</span>
          </button>
        </aside>
      )}

      {/* ─── SCENE 01: Brand Intro & Reveal ─────────────────────────── */}
      <Scene01Intro reducedMotion={reducedMotion} />

      {/* ─── Ticker: Campus Chapters ─────────────────────────────────── */}
      <CinematicTicker />

      {/* ─── SCENE 02: Campus Events World ──────────────────────────── */}
      <Scene02Events reducedMotion={reducedMotion} />

      {/* ─── SCENE 03: Discover Phone Mockup ────────────────────────── */}
      <Scene03Discover reducedMotion={reducedMotion} />

      {/* ─── SCENE 04: Registration Journey ─────────────────────────── */}
      <Scene04Register reducedMotion={reducedMotion} />

      {/* ─── SCENE 05: Payment Verification ─────────────────────────── */}
      <Scene05Payment reducedMotion={reducedMotion} />

      {/* ─── SCENE 06: Digital Ticket ───────────────────────────────── */}
      <Scene06Ticket reducedMotion={reducedMotion} />

      {/* ─── SCENE 07: Organizer Dashboard ──────────────────────────── */}
      <Scene07Organizer reducedMotion={reducedMotion} />

      {/* ─── SCENE 08: Connected Ecosystem ──────────────────────────── */}
      <Scene08Connected reducedMotion={reducedMotion} />

      {/* ─── LIVE EVENTS SHOWCASE: Active Campus Schedule ───────────── */}
      <section
        id="events"
        aria-labelledby="live-events-heading"
        className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full"
      >
        <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
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
              Register now for live hackathons, cultural showcases, and workshops happening on campus.
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-80 rounded-2xl bg-[#0E0E12] animate-pulse border border-white/10"
              />
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No Events Published Yet"
            description="Campus clubs are finalizing their schedules. Are you a student organizer ready to launch your club's next event?"
            action={
              <Link to="/club/signup">
                <Button variant="primary" size="md" rightIcon={<ArrowRight size={15} />}>
                  Create an Event
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

      {/* ─── SCENE 09: Final Climax CTA ─────────────────────────────── */}
      <Scene09Final reducedMotion={reducedMotion} />
    </div>
  )
}

