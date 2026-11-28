import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowRight,
  ChevronRight,
  Calendar,
  Building2,
  GraduationCap,
  QrCode,
  ShieldCheck,
  Zap,
  CheckCircle2,
} from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { HeroSection } from '@/components/sections/HeroSection'
import { HorizontalEventJourney } from '@/components/sections/HorizontalEventJourney'
import { WorkflowSection } from '@/components/sections/WorkflowSection'
import { PlatformCapabilitiesSection } from '@/components/sections/PlatformCapabilitiesSection'
import { CategoryShowcaseSection } from '@/components/sections/CategoryShowcaseSection'
import { EventGrid } from '@/components/sections/EventGrid'
import { Button, EmptyState } from '@/components/ui'
import { SEOHead } from '@/components/seo/SEOHead'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { listPublishedEvents, mapRecordToUiEvent, isEventCompleted } from '@/lib/events'
import type { Event as UiEvent } from '@/types'

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
  'Photography Clubs',
]

// ─── Campus Community Ticker ────────────────────────────────────────────────
function CommunityTicker() {
  const reduced = useReducedMotion()
  const items = [
    ...CLUB_COMMUNITIES,
    ...CLUB_COMMUNITIES,
    ...CLUB_COMMUNITIES,
    ...CLUB_COMMUNITIES,
  ]

  return (
    <div
      aria-label="Campus communities supported by FestFlow"
      className="py-5 border-b border-gray-200/80 bg-white overflow-hidden relative z-10"
    >
      <p className="text-center text-[11px] uppercase tracking-wider text-gray-500 mb-3 font-medium">
        Engineered for University Chapters & Student Communities
      </p>
      <div className="relative overflow-hidden">
        <div
          className="ticker-track"
          style={reduced ? { justifyContent: 'center', flexWrap: 'wrap', gap: '2rem', animation: 'none' } : {}}
        >
          {items.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="whitespace-nowrap text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors px-6 shrink-0 flex items-center gap-2.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600/60" aria-hidden="true" />
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Digital Pass & Gate Check-in Spotlight Section ─────────────────────────
function DigitalPassSpotlightSection() {
  return (
    <section
      aria-labelledby="pass-spotlight-heading"
      className="relative py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-white border-y border-gray-200/80 w-full"
    >
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        {/* Left Column: Editorial Narrative */}
        <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 mb-3">
            <QrCode size={12} className="text-blue-600" />
            <span>Verified Digital Passes</span>
          </span>

          <h2
            id="pass-spotlight-heading"
            className="font-display font-bold text-2xl sm:text-4xl text-gray-900 tracking-tight leading-tight"
          >
            Tamper-resistant passes. Instant gate admittance.
          </h2>

          <p className="text-sm sm:text-base text-gray-600 mt-3 mb-8 leading-relaxed max-w-xl">
            Every approved student receives a structured mobile boarding pass stamped with a unique verification token. Gate coordinators verify attendance directly at the entrance with live duplicate protection.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg mb-8">
            <div className="p-4 rounded-xl bg-[#F7F8FA] border border-gray-200/80 text-left">
              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mb-2.5">
                <Zap size={16} />
              </div>
              <h4 className="text-xs sm:text-sm font-semibold text-gray-900 mb-1">Instant Gate Verification</h4>
              <p className="text-xs text-gray-600 leading-snug">
                Verified organizers validate student passes smoothly without spreadsheet lookups.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#F7F8FA] border border-gray-200/80 text-left">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-2.5">
                <ShieldCheck size={16} />
              </div>
              <h4 className="text-xs sm:text-sm font-semibold text-gray-900 mb-1">Organizer-Controlled Entry</h4>
              <p className="text-xs text-gray-600 leading-snug">
                Server-enforced attendance state blocks duplicate entries and shared pass screenshots.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Link to="/club/signup" className="w-full sm:w-auto">
              <Button variant="primary" size="md" rightIcon={<ArrowRight size={15} />}>
                Create Club Account
              </Button>
            </Link>
            <Link to="/discover" className="w-full sm:w-auto">
              <Button variant="secondary" size="md">
                Browse Campus Events
              </Button>
            </Link>
          </div>
        </div>

        {/* Right Column: Clean Boarding Pass Mockup */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="w-full max-w-[340px] rounded-2xl bg-white border border-gray-200 p-6 shadow-[0_20px_48px_-12px_rgba(17,24,39,0.1)] flex flex-col gap-4 text-left">
            <div className="flex items-center justify-between pb-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                <span className="text-xs font-semibold tracking-wider text-gray-900 uppercase font-mono">FESTFLOW PASS</span>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[10px] font-semibold text-blue-700">
                <CheckCircle2 size={10} /> SAMPLE PREVIEW
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-blue-600 font-semibold block mb-1">
                PASS INTERFACE · SEAT SELECTION
              </span>
              <h3 className="font-display font-bold text-lg text-gray-900 leading-tight">
                Campus Event Pass
              </h3>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                <Calendar size={12} className="text-gray-400" /> Scheduled Date · Campus Venue
              </p>
            </div>

            {/* Clean QR Card */}
            <div className="bg-[#F7F8FA] border border-gray-200 p-4 rounded-xl flex flex-col items-center justify-center gap-2">
              <div className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs">
                <svg
                  width="124"
                  height="124"
                  viewBox="0 0 140 140"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="select-none"
                  aria-label="Demonstration pass QR code"
                >
                  <rect x="8" y="8" width="36" height="36" rx="4" fill="#111827" />
                  <rect x="14" y="14" width="24" height="24" rx="2" fill="#FFFFFF" />
                  <rect x="20" y="20" width="12" height="12" rx="1" fill="#2563EB" />

                  <rect x="96" y="8" width="36" height="36" rx="4" fill="#111827" />
                  <rect x="102" y="14" width="24" height="24" rx="2" fill="#FFFFFF" />
                  <rect x="108" y="20" width="12" height="12" rx="1" fill="#2563EB" />

                  <rect x="8" y="96" width="36" height="36" rx="4" fill="#111827" />
                  <rect x="14" y="102" width="24" height="24" rx="2" fill="#FFFFFF" />
                  <rect x="20" y="108" width="12" height="12" rx="1" fill="#2563EB" />

                  <rect x="52" y="12" width="8" height="8" fill="#111827" />
                  <rect x="68" y="12" width="8" height="8" fill="#111827" />
                  <rect x="52" y="28" width="12" height="8" fill="#111827" />
                  <rect x="72" y="28" width="8" height="16" fill="#111827" />

                  <rect x="16" y="52" width="16" height="8" fill="#111827" />
                  <rect x="40" y="52" width="8" height="16" fill="#2563EB" />
                  <rect x="56" y="52" width="28" height="8" fill="#111827" />
                  <rect x="92" y="52" width="12" height="8" fill="#111827" />
                  <rect x="112" y="52" width="16" height="8" fill="#111827" />

                  <rect x="12" y="72" width="8" height="16" fill="#111827" />
                  <rect x="28" y="72" width="16" height="8" fill="#111827" />
                  <rect x="52" y="68" width="16" height="16" rx="2" fill="#2563EB" />
                  <rect x="76" y="72" width="12" height="16" fill="#111827" />
                  <rect x="96" y="68" width="8" height="20" fill="#111827" />
                  <rect x="112" y="72" width="16" height="8" fill="#111827" />

                  <rect x="52" y="96" width="8" height="16" fill="#111827" />
                  <rect x="68" y="104" width="20" height="8" fill="#111827" />
                  <rect x="96" y="96" width="12" height="16" fill="#111827" />
                  <rect x="116" y="104" width="12" height="8" fill="#2563EB" />

                  <rect x="52" y="120" width="20" height="8" fill="#111827" />
                  <rect x="80" y="120" width="16" height="8" fill="#111827" />
                  <rect x="104" y="120" width="24" height="8" fill="#111827" />
                </svg>
              </div>
              <span className="font-mono text-[10px] text-gray-500 font-semibold tracking-wider uppercase">
                SAMPLE QR PASS
              </span>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500 font-mono">
              <span>VENUE GATE</span>
              <span className="text-gray-900 font-semibold">PASS HOLDER</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Dual Getting Started CTA Section ───────────────────────────────────────
function GettingStartedSection() {
  return (
    <section
      id="get-started"
      aria-labelledby="cta-heading"
      className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full"
    >
      <div className="p-6 sm:p-14 rounded-2xl bg-gray-950 text-white border border-gray-800 shadow-xl text-center relative overflow-hidden">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-blue-300 bg-blue-950/60 border border-blue-800/60 mb-5">
          100% Free for Campus Communities
        </span>

        <h2
          id="cta-heading"
          className="font-display font-bold text-2xl sm:text-4xl md:text-5xl text-white tracking-tight max-w-2xl mx-auto leading-tight"
        >
          Ready to elevate your campus events?
        </h2>

        <p className="text-gray-400 text-sm sm:text-base mt-4 mb-8 max-w-xl mx-auto leading-relaxed">
          Whether you are a student discovering upcoming fests or an organizer managing thousands of seats, FestFlow gets you running in minutes.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
          <Link to="/club/signup" className="w-full sm:w-auto flex-1">
            <Button
              id="landing-cta-club"
              variant="primary"
              size="lg"
              leftIcon={<Building2 size={16} />}
              rightIcon={<ArrowRight size={16} />}
              className="w-full justify-center"
            >
              Start Club Portal
            </Button>
          </Link>
          <Link to="/student/signup" className="w-full sm:w-auto flex-1">
            <Button
              id="landing-cta-student"
              variant="outline-dark"
              size="lg"
              leftIcon={<GraduationCap size={16} />}
              rightIcon={<ChevronRight size={16} />}
              className="w-full justify-center"
            >
              Join as Student
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── Main Landing Page ──────────────────────────────────────────────────────
export default function LandingPage() {
  const [events, setEvents] = useState<UiEvent[]>([])
  const [loading, setLoading] = useState(true)

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
    return () => {
      mounted = false
    }
  }, [])

  return (
    <PageShell fullbleed>
      <SEOHead
        title="FestFlow — Discover & Manage College Events"
        description="The premier event platform for college clubs and students. Discover campus hackathons, workshops, cultural fests, UPI payment verification, and digital entry passes."
        canonicalPath="/"
      />

      {/* 1. Crisp SaaS Hero with UI Mockup */}
      <HeroSection />

      {/* 2. Supported Student Communities Ticker */}
      <CommunityTicker />

      {/* 3. Curated Live Events Carousel */}
      <HorizontalEventJourney />

      {/* 4. How It Works (Student & Club workflows) */}
      <WorkflowSection />

      {/* 5. Genuine Platform Capabilities Grid */}
      <PlatformCapabilitiesSection />

      {/* 6. Digital Passes & Check-in Spotlight */}
      <DigitalPassSpotlightSection />

      {/* 7. Event Categories Showcase */}
      <CategoryShowcaseSection />

      {/* 8. Live Published Campus Events Preview */}
      <section
        id="events"
        aria-labelledby="featured-events-heading"
        className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full border-t border-gray-200/80"
      >
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-left">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-gray-700 bg-gray-100 border border-gray-200 mb-3">
              <Calendar size={12} /> Live Campus Calendar
            </span>
            <h2
              id="featured-events-heading"
              className="font-display font-bold text-2xl sm:text-4xl text-gray-900 tracking-tight"
            >
              Upcoming campus events.
            </h2>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed max-w-xl">
              Explore upcoming events hosted by university clubs and student organizations.
            </p>
          </div>

          <Link
            to="/discover"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
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
                className="h-80 rounded-xl bg-white animate-pulse border border-gray-200"
              />
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No Events Published Yet"
            description="Campus clubs are currently preparing their upcoming event schedules. Are you a student organizer ready to launch your club's first event?"
            action={
              <Link to="/club/signup">
                <Button variant="primary" size="md" rightIcon={<ArrowRight size={15} />}>
                  Create Your Club's First Event
                </Button>
              </Link>
            }
            secondaryAction={
              <Link to="/discover">
                <Button variant="secondary" size="md">
                  View Past Archive
                </Button>
              </Link>
            }
          />
        ) : (
          <EventGrid events={events} />
        )}

        <div className="mt-8 flex justify-center sm:hidden">
          <Link to="/discover" className="w-full max-w-sm">
            <Button variant="secondary" size="md" className="w-full" rightIcon={<ChevronRight size={16} />}>
              Explore all campus events
            </Button>
          </Link>
        </div>
      </section>

      {/* 9. Getting Started Dual CTA */}
      <GettingStartedSection />
    </PageShell>
  )
}
