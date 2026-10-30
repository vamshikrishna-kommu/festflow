import { useRef } from 'react'
import { motion, useInView } from 'motion/react'
import {
  TicketCheck,
  QrCode,
  BarChart3,
  Bell,
  ShieldCheck,
  Zap,
  ArrowRight,
} from 'lucide-react'
import { staggerContainer, fadeUp } from '@/lib/animations'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const FEATURES = [
  {
    icon: TicketCheck,
    title: 'Smart Ticketing',
    description:
      'Free or paid tickets, customizable capacity, and digital passes with unique QR codes — issued automatically upon confirmation.',
    accentVar: '--color-brand-orange',
    glowAlpha: '0.22',
    hue: '24',
  },
  {
    icon: QrCode,
    title: 'QR Gate Check-in',
    description:
      'Organizers scan passes at the entrance for real-time validation. Duplicate-admission prevention built in.',
    accentVar: '--color-brand-orange-light',
    glowAlpha: '0.20',
    hue: '30',
  },
  {
    icon: BarChart3,
    title: 'Live Analytics',
    description:
      'Registration counts, check-in rates and attendance breakdowns update in real time on your organizer dashboard.',
    accentVar: '--color-brand-orange',
    glowAlpha: '0.18',
    hue: '24',
  },
  {
    icon: Bell,
    title: 'In-App Notifications',
    description:
      'Students receive in-app notifications the moment a registration status changes or an event is updated.',
    accentVar: '--color-brand-orange-light',
    glowAlpha: '0.20',
    hue: '30',
  },
  {
    icon: ShieldCheck,
    title: 'Registered Clubs',
    description:
      'Every club verifies their email before publishing. Students always know exactly who is hosting an event.',
    accentVar: '--color-brand-orange',
    glowAlpha: '0.22',
    hue: '24',
  },
  {
    icon: Zap,
    title: '100% Free — Always',
    description:
      'No subscriptions. No platform commission. Zero hidden fees. Clubs collect 100% of proceeds directly via UPI.',
    accentVar: '--color-brand-orange-light',
    glowAlpha: '0.20',
    hue: '30',
  },
]

export function FeaturesSection() {
  const ref     = useRef<HTMLElement>(null)
  const inView  = useInView(ref, { once: true, margin: '-80px' })
  const reduced = useReducedMotion()

  return (
    <section
      id="features-overview"
      ref={ref}
      aria-labelledby="features-heading"
      className="relative scroll-mt-24 py-20 sm:py-28 lg:py-36 px-4 sm:px-6 lg:px-8 overflow-hidden"
    >
      {/* Background grid */}
      <div
        aria-hidden="true"
        className="absolute inset-0 grid-pattern opacity-30 pointer-events-none"
      />

      {/* Top fade in from hero */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, var(--color-surface-0), transparent)' }}
      />

      {/* Centered glow */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, oklch(58% 0.26 285 / 0.06) 0%, transparent 70%)',
        }}
      />

      <div className="relative max-w-7xl mx-auto">
        {/* Section header */}
        <motion.div
          variants={staggerContainer}
          initial={reduced ? 'visible' : 'hidden'}
          animate={inView ? 'visible' : 'hidden'}
          className="text-center mb-12 sm:mb-16 lg:mb-20"
        >
          <motion.p
            variants={reduced ? undefined : fadeUp}
            className="text-xs uppercase tracking-widest text-[var(--color-brand-violet)] font-semibold mb-3 sm:mb-4"
          >
            Everything you need
          </motion.p>
          <motion.h2
            id="features-heading"
            variants={reduced ? undefined : fadeUp}
            className="font-display font-bold text-3xl sm:text-5xl md:text-6xl text-[var(--color-text-primary)] mb-4 sm:mb-5 leading-tight"
          >
            Built for clubs.{' '}
            <span className="gradient-text">Loved by students.</span>
          </motion.h2>
          <motion.p
            variants={reduced ? undefined : fadeUp}
            className="max-w-xl mx-auto text-sm sm:text-base text-[var(--color-text-secondary)] leading-relaxed"
          >
            From a single workshop to a 2,000-person fest — FestFlow handles
            every scale with the same effortless experience.
          </motion.p>
        </motion.div>

        {/* Feature grid */}
        <motion.ul
          variants={staggerContainer}
          initial={reduced ? 'visible' : 'hidden'}
          animate={inView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
          role="list"
        >
          {FEATURES.map(({ icon: Icon, title, description, accentVar, glowAlpha, hue }) => (
            <motion.li
              key={title}
              variants={reduced ? undefined : fadeUp}
              className="relative group rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.065)] bg-[var(--color-surface-1)] p-5 sm:p-6 overflow-hidden transition-all duration-300 hover:border-[oklch(100%_0_0_/_0.13)] hover:bg-[var(--color-surface-2)] hover:-translate-y-1 hover:shadow-[0_12px_40px_oklch(0%_0_0_/_0.5)]"
            >
              {/* Hover glow (always slightly visible) */}
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-[0.06] group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-[var(--radius-card)]"
                style={{
                  background: `radial-gradient(ellipse at 20% 20%, oklch(58% 0.26 ${hue} / ${glowAlpha}), transparent 65%)`,
                }}
              />

              {/* Icon */}
              <div
                className="relative w-11 h-11 rounded-xl flex items-center justify-center mb-4 shrink-0"
                style={{ background: `oklch(58% 0.26 ${hue} / 0.14)` }}
              >
                <Icon
                  size={20}
                  aria-hidden="true"
                  style={{ color: `var(${accentVar})` }}
                />
              </div>

              <h3 className="relative font-semibold text-base text-[var(--color-text-primary)] mb-2">
                {title}
              </h3>
              <p className="relative text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {description}
              </p>

              {/* Subtle arrow hint on hover */}
              <div className="relative mt-4 flex items-center gap-1 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ color: `var(${accentVar})` }}>
                Learn more <ArrowRight size={12} />
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  )
}
