import { useRef } from 'react'
import { Link } from 'react-router'
import { motion, useInView } from 'motion/react'
import { ArrowRight, ChevronRight } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { HeroSection } from '@/components/sections/HeroSection'
import { FeaturesSection } from '@/components/sections/FeaturesSection'
import { EventGrid } from '@/components/sections/EventGrid'
import { Button } from '@/components/ui'
import { staggerContainer, fadeUp } from '@/lib/animations'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { FEATURED_EVENTS } from '@/lib/mock-data'

// ─── Social Proof Logos ────────────────────────────────────────────────────
const COLLEGE_NAMES = [
  'IIT Bombay', 'IIT Madras', 'BITS Pilani', 'VIT Chennai',
  'NIT Trichy', 'Manipal', 'SRM Institute', 'Anna University',
]

// ─── CTA Section ──────────────────────────────────────────────────────────
function CtaSection() {
  const ref     = useRef<HTMLElement>(null)
  const inView  = useInView(ref, { once: true, margin: '-80px' })
  const reduced = useReducedMotion()

  return (
    <section
      ref={ref}
      aria-labelledby="cta-heading"
      className="relative py-28 px-6 overflow-hidden"
    >
      {/* Background glow */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(58%_0.24_290_/_0.15)_0%,transparent_70%)] pointer-events-none"
      />

      <motion.div
        variants={staggerContainer}
        initial={reduced ? 'visible' : 'hidden'}
        animate={inView ? 'visible' : 'hidden'}
        className="relative max-w-3xl mx-auto text-center"
      >
        <motion.p
          variants={reduced ? undefined : fadeUp}
          className="text-xs uppercase tracking-widest text-[var(--color-brand-purple)] font-semibold mb-4"
        >
          Ready to launch?
        </motion.p>
        <motion.h2
          id="cta-heading"
          variants={reduced ? undefined : fadeUp}
          className="font-display font-extrabold text-4xl sm:text-5xl md:text-6xl text-[var(--color-text-primary)] leading-tight mb-6"
        >
          Your next event{' '}
          <span className="gradient-text">starts here.</span>
        </motion.h2>
        <motion.p
          variants={reduced ? undefined : fadeUp}
          className="text-[var(--color-text-secondary)] text-lg mb-10"
        >
          Join thousands of club organisers who use FestFlow to create unforgettable
          campus experiences.
        </motion.p>
        <motion.div
          variants={reduced ? undefined : fadeUp}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Link to="/club/signup">
            <Button
              id="landing-cta-primary"
              variant="primary"
              size="lg"
              rightIcon={<ArrowRight size={18} />}
            >
              Create your first event
            </Button>
          </Link>
          <Link to="/discover">
            <Button
              id="landing-cta-discover"
              variant="outline"
              size="lg"
              rightIcon={<ChevronRight size={16} />}
            >
              Browse events
            </Button>
          </Link>
        </motion.div>
      </motion.div>
    </section>
  )
}

// ─── Landing Page ──────────────────────────────────────────────────────────
export default function LandingPage() {
  const logosRef   = useRef<HTMLDivElement>(null)
  const logosInView = useInView(logosRef, { once: true })
  const reduced    = useReducedMotion()

  return (
    <PageShell fullbleed>
      <HeroSection />

      {/* College logos marquee */}
      <div
        ref={logosRef}
        aria-label="Colleges using FestFlow"
        className="py-10 border-y border-[oklch(100%_0_0_/_0.06)] overflow-hidden"
      >
        <p className="text-center text-xs uppercase tracking-widest text-[var(--color-text-muted)] mb-6">
          Trusted by clubs at
        </p>
        <motion.div
          initial={reduced ? {} : { opacity: 0 }}
          animate={logosInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-12 animate-[scroll_20s_linear_infinite]"
          style={reduced ? {} : undefined}
        >
          {[...COLLEGE_NAMES, ...COLLEGE_NAMES].map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="whitespace-nowrap text-sm font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors flex-shrink-0"
            >
              {name}
            </span>
          ))}
        </motion.div>
      </div>

      <FeaturesSection />

      {/* Featured Events preview */}
      <section
        aria-labelledby="featured-events-heading"
        className="py-24 px-6 max-w-6xl mx-auto w-full"
      >
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--color-brand-purple)] font-semibold mb-2">
              Happening soon
            </p>
            <h2
              id="featured-events-heading"
              className="font-display font-bold text-3xl sm:text-4xl text-[var(--color-text-primary)]"
            >
              Featured events
            </h2>
          </div>
          <Link
            to="/discover"
            className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-[var(--color-brand-purple)] hover:underline"
          >
            View all <ChevronRight size={16} />
          </Link>
        </div>

        <EventGrid events={FEATURED_EVENTS} />
      </section>

      <CtaSection />
    </PageShell>
  )
}
