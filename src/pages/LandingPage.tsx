import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowRight,
  ChevronRight,
  Calendar,
  Sparkles,
  Building2,
  GraduationCap,
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
      className="py-7 sm:py-9 border-y border-[oklch(100%_0_0_/_0.06)] bg-[var(--color-surface-1)]/30 backdrop-blur-sm overflow-hidden relative z-10"
    >
      <p className="text-center text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-3 font-medium">
        Engineered for student communities
      </p>
      <div className="relative overflow-hidden">
        <div
          className="ticker-track"
          style={reduced ? { justifyContent: 'center', flexWrap: 'wrap', gap: '2rem', animation: 'none' } : {}}
        >
          {items.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="whitespace-nowrap text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-brand-violet)] transition-colors px-7 shrink-0"
            >
              <span className="text-[var(--color-brand-violet)] mr-2" aria-hidden="true">✦</span>
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
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
            'radial-gradient(ellipse 65% 50% at 50% 50%, oklch(58% 0.26 285 / 0.16) 0%, oklch(72% 0.16 200 / 0.08) 50%, transparent 70%)',
        }}
      />
      <div aria-hidden="true" className="absolute inset-0 grid-pattern opacity-20 pointer-events-none -z-10" />

      <div className="p-8 sm:p-14 rounded-3xl glass-elevated border border-[oklch(100%_0_0_/_0.15)] shadow-[0_24px_64px_oklch(0%_0_0_/_0.6)] text-center relative overflow-hidden group">
        {/* Controlled light sweep beam across top border */}
        <div
          aria-hidden="true"
          className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--color-brand-cyan)] to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-700"
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

        <p className="text-[var(--color-text-secondary)] text-sm sm:text-base md:text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
          Whether you are a student looking for the next hackathon or a club lead managing thousands of attendees, FestFlow is free, fast, and built for you.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
          <Link to="/club/signup" className="w-full sm:w-auto flex-1">
            <Button
              id="landing-cta-club"
              variant="primary"
              size="lg"
              leftIcon={<Building2 size={16} />}
              rightIcon={<ArrowRight size={16} />}
              className="w-full justify-center shine-on-hover shadow-[0_0_24px_oklch(58%_0.26_285_/_0.4)]"
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
              className="w-full justify-center hover:bg-[var(--color-surface-3)]"
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

      {/* 5. Genuine Platform Capabilities */}
      <PlatformCapabilitiesSection />

      {/* 6. Event Categories Showcase */}
      <CategoryShowcaseSection />

      {/* 7. Live Published Campus Events Preview */}
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
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-2 leading-relaxed max-w-xl">
              Explore events hosted by university clubs and student organizations.
            </p>
          </div>

          <Link
            to="/discover"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[var(--color-brand-violet)] hover:underline"
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
                className="h-80 rounded-[var(--radius-card)] bg-[var(--color-surface-2)]/60 animate-pulse border border-[var(--color-surface-3)]"
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

      {/* 8. Getting Started Dual CTA */}
      <GettingStartedSection />
    </PageShell>
  )
}

