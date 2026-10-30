import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowRight,
  ChevronRight,
  Calendar,
  Sparkles,
  Building2,
  GraduationCap,
  QrCode,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { HeroSection } from '@/components/sections/HeroSection'
import { HorizontalEventJourney } from '@/components/sections/HorizontalEventJourney'
import { WorkflowSection } from '@/components/sections/WorkflowSection'
import { PlatformCapabilitiesSection } from '@/components/sections/PlatformCapabilitiesSection'
import { CategoryShowcaseSection } from '@/components/sections/CategoryShowcaseSection'
import { EventGrid } from '@/components/sections/EventGrid'
import { Button, EmptyState, KineticHeading } from '@/components/ui'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { listPublishedEvents, mapRecordToUiEvent } from '@/lib/events'
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
      className="py-6 sm:py-8 border-y border-white/[0.06] bg-[#0E0E12]/50 backdrop-blur-md overflow-hidden relative z-10"
    >
      <p className="text-center text-[10px] uppercase tracking-widest text-zinc-500 mb-3 font-semibold">
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
              className="whitespace-nowrap text-xs font-semibold text-zinc-400 hover:text-white transition-colors px-6 shrink-0 flex items-center gap-2"
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

// ─── Digital Pass & QR Turnstile Spotlight Section ──────────────────────────
function DigitalPassSpotlightSection() {
  return (
    <section
      aria-labelledby="pass-spotlight-heading"
      className="relative py-20 sm:py-28 lg:py-36 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full overflow-hidden"
    >
      {/* Background radial atmosphere */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[550px] pointer-events-none -z-10"
        style={{
          background:
            'radial-gradient(ellipse 60% 45% at 50% 50%, rgba(24, 207, 252, 0.12) 0%, rgba(127, 26, 251, 0.08) 50%, transparent 75%)',
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        {/* Left Column: Editorial Feature Narrative */}
        <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-[#18CFFC] bg-[#14141A] border border-[#18CFFC]/30 mb-4 shadow-sm">
            <QrCode size={13} className="text-[#18CFFC]" />
            <span>Digital Passes & Sub-Second Check-in</span>
          </span>

          <KineticHeading
            as="h2"
            id="pass-spotlight-heading"
            className="text-2xl sm:text-4xl lg:text-5xl"
            lines={[
              { text: 'Cryptographic digital passes.' },
              { text: 'Zero gate bottlenecks.', highlight: 'Instant entry.', gradientClass: 'gradient-text' },
            ]}
          />

          <p className="text-xs sm:text-sm md:text-base text-zinc-400 mt-4 mb-8 leading-relaxed max-w-xl">
            Every verified student receives a tamper-resistant mobile digital pass stamped with a dynamic QR token. At the venue gate, club volunteers scan with any smartphone camera for live duplicate lockout and offline caching.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg mb-8">
            <div className="p-4 rounded-2xl bg-[#0E0E12] border border-white/[0.08] text-left">
              <div className="w-8 h-8 rounded-xl bg-[#18CFFC]/15 text-[#18CFFC] flex items-center justify-center mb-2.5">
                <Zap size={16} />
              </div>
              <h4 className="text-xs font-bold text-white mb-1">Sub-Second Camera Scan</h4>
              <p className="text-[11px] text-zinc-400 leading-snug">
                Volunteer gate scanners validate passes in under 300ms using native phone cameras.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#0E0E12] border border-white/[0.08] text-left">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-2.5">
                <ShieldCheck size={16} />
              </div>
              <h4 className="text-xs font-bold text-white mb-1">Live Replay Defense</h4>
              <p className="text-[11px] text-zinc-400 leading-snug">
                Real-time check-in lockout blocks shared screenshots and duplicate entries immediately.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Link to="/club/signup" className="w-full sm:w-auto">
              <Button variant="primary" size="md" rightIcon={<ArrowRight size={15} />}>
                Launch Club Gate Scanner
              </Button>
            </Link>
            <Link to="/discover" className="w-full sm:w-auto">
              <Button variant="outline" size="md">
                Find Events Near You
              </Button>
            </Link>
          </div>
        </div>

        {/* Right Column: High-Fidelity Mobile Pass Mockup */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="relative w-full max-w-[340px] rounded-3xl bg-[#0E0E12] border border-white/15 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.85),0_0_40px_rgba(24,207,252,0.20)] flex flex-col gap-5 overflow-hidden">
            {/* Top Pass Brand & Verified Pill */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#18CFFC] animate-pulse" />
                <span className="text-xs font-bold tracking-wider text-white uppercase font-display">FESTFLOW PASS</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">
                ● VERIFIED
              </span>
            </div>

            {/* Event Name & Metadata */}
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#18CFFC] block mb-1">
                ALL-ACCESS PASS
              </span>
              <h3 className="font-display font-bold text-lg text-white leading-tight">
                Nexus Hackathon 2026
              </h3>
              <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5">
                <Calendar size={12} className="text-[#18CFFC]" /> Nov 14–15, 2026 · Main Campus Audi
              </p>
            </div>

            {/* Simulated Demonstration QR Code (Fictional Demonstration Token) */}
            <div className="bg-white p-4 rounded-2xl flex flex-col items-center justify-center gap-2 mx-auto shadow-inner">
              {/* Clean SVG simulated QR pattern */}
              <svg
                width="140"
                height="140"
                viewBox="0 0 140 140"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="select-none"
                aria-label="Demonstration pass QR code"
              >
                {/* 3 Corner Positioning Squares */}
                <rect x="8" y="8" width="36" height="36" rx="4" fill="#08080A" />
                <rect x="14" y="14" width="24" height="24" rx="2" fill="#FFFFFF" />
                <rect x="20" y="20" width="12" height="12" rx="1" fill="#18CFFC" />

                <rect x="96" y="8" width="36" height="36" rx="4" fill="#08080A" />
                <rect x="102" y="14" width="24" height="24" rx="2" fill="#FFFFFF" />
                <rect x="108" y="20" width="12" height="12" rx="1" fill="#18CFFC" />

                <rect x="8" y="96" width="36" height="36" rx="4" fill="#08080A" />
                <rect x="14" y="102" width="24" height="24" rx="2" fill="#FFFFFF" />
                <rect x="20" y="108" width="12" height="12" rx="1" fill="#18CFFC" />

                {/* Simulated Data Blocks */}
                <rect x="52" y="12" width="8" height="8" fill="#08080A" />
                <rect x="68" y="12" width="8" height="8" fill="#08080A" />
                <rect x="52" y="28" width="12" height="8" fill="#08080A" />
                <rect x="72" y="28" width="8" height="16" fill="#08080A" />

                <rect x="16" y="52" width="16" height="8" fill="#08080A" />
                <rect x="40" y="52" width="8" height="16" fill="#18CFFC" />
                <rect x="56" y="52" width="28" height="8" fill="#08080A" />
                <rect x="92" y="52" width="12" height="8" fill="#08080A" />
                <rect x="112" y="52" width="16" height="8" fill="#08080A" />

                <rect x="12" y="72" width="8" height="16" fill="#08080A" />
                <rect x="28" y="72" width="16" height="8" fill="#08080A" />
                <rect x="52" y="68" width="16" height="16" rx="2" fill="#18CFFC" />
                <rect x="76" y="72" width="12" height="16" fill="#08080A" />
                <rect x="96" y="68" width="8" height="20" fill="#08080A" />
                <rect x="112" y="72" width="16" height="8" fill="#08080A" />

                <rect x="52" y="96" width="8" height="16" fill="#08080A" />
                <rect x="68" y="104" width="20" height="8" fill="#08080A" />
                <rect x="96" y="96" width="12" height="16" fill="#08080A" />
                <rect x="116" y="104" width="12" height="8" fill="#18CFFC" />

                <rect x="52" y="120" width="20" height="8" fill="#08080A" />
                <rect x="80" y="120" width="16" height="8" fill="#08080A" />
                <rect x="104" y="120" width="24" height="8" fill="#08080A" />
              </svg>
              <span className="font-mono text-[9px] text-zinc-600 font-bold tracking-widest uppercase">
                DEMO PASS #FF-2026-NEXUS
              </span>
            </div>

            {/* Bottom Pass Serial & Gate */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
              <span>GATE: AUDI-NORTH</span>
              <span className="text-[#FFA040]">TIER: TEAM LEADER</span>
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
      className="relative py-20 sm:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden max-w-7xl mx-auto w-full"
    >
      {/* Background glow atmosphere */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none -z-10"
        style={{
          background:
            'radial-gradient(ellipse 65% 50% at 50% 50%, rgba(255, 87, 34, 0.15) 0%, rgba(245, 158, 11, 0.05) 50%, transparent 70%)',
        }}
      />
      <div aria-hidden="true" className="absolute inset-0 grid-pattern opacity-20 pointer-events-none -z-10" />

      <div className="p-8 sm:p-14 rounded-3xl bg-[#0E0E12] border border-white/15 shadow-[0_24px_64px_rgba(0,0,0,0.85),0_0_40px_rgba(24,207,252,0.18)] text-center relative overflow-hidden group">
        {/* Controlled light sweep beam across top border */}
        <div
          aria-hidden="true"
          className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#18CFFC] to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-700"
        />

        <div className="mb-4">
          <KineticHeading
            as="h2"
            id="cta-heading"
            badgeText="100% Free Forever for Colleges"
            badgeIcon={<Sparkles size={12} />}
            className="text-3xl sm:text-5xl md:text-6xl text-center"
            lines={[
              { text: 'Ready to elevate your' },
              { text: 'campus events?', highlight: 'Start in seconds.', gradientClass: 'gradient-text' },
            ]}
          />
        </div>

        <p className="text-zinc-400 text-sm sm:text-base md:text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
          Whether you are a student discovering the next hackathon or a club lead managing thousands of attendees, FestFlow is free, fast, and engineered for you.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
          <Link to="/club/signup" className="w-full sm:w-auto flex-1">
            <Button
              id="landing-cta-club"
              variant="primary"
              size="lg"
              leftIcon={<Building2 size={16} />}
              rightIcon={<ArrowRight size={16} />}
              className="w-full justify-center shine-on-hover shadow-[0_4px_24px_rgba(255,87,34,0.4)]"
            >
              Start Club Portal
            </Button>
          </Link>
          <Link to="/student/signup" className="w-full sm:w-auto flex-1">
            <Button
              id="landing-cta-student"
              variant="outline"
              size="lg"
              leftIcon={<GraduationCap size={16} />}
              rightIcon={<ChevronRight size={16} />}
              className="w-full justify-center hover:bg-[#1C1C24]"
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
      setEvents(res.events?.length ? res.events.map(mapRecordToUiEvent) : [])
    })
    return () => {
      mounted = false
    }
  }, [])

  return (
    <PageShell fullbleed>
      {/* 1. Hero with Cinematic 3D Centerpiece */}
      <HeroSection />

      {/* 2. Supported Student Communities Ticker */}
      <CommunityTicker />

      {/* 3. Signature Horizontal Event Journey (Driven by Vertical Scroll) */}
      <HorizontalEventJourney />

      {/* 4. How It Works (Student & Club workflows) */}
      <WorkflowSection />

      {/* 5. Genuine Platform Capabilities Bento Grid */}
      <PlatformCapabilitiesSection />

      {/* 6. Event Categories Showcase */}
      <CategoryShowcaseSection />

      {/* 7. Digital Passes & QR Check-in Spotlight */}
      <DigitalPassSpotlightSection />

      {/* 8. Live Published Campus Events Preview */}
      <section
        id="events"
        aria-labelledby="featured-events-heading"
        className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full"
      >
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <KineticHeading
              as="h2"
              id="featured-events-heading"
              badgeText="Live Campus Calendar"
              badgeIcon={<Calendar size={13} />}
              className="text-2xl sm:text-4xl lg:text-5xl"
              lines={[
                { text: 'Upcoming campus' },
                { text: 'events.', highlight: 'Register Now.', gradientClass: 'gradient-text' },
              ]}
            />
            <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed max-w-xl">
              Explore events hosted by university clubs and student organizations.
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
                <Button variant="outline" size="md">
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
            <Button variant="outline" size="md" className="w-full" rightIcon={<ChevronRight size={16} />}>
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
