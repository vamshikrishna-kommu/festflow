import { useRef } from 'react'
import { motion, useInView } from 'motion/react'
import {
  TicketCheck,
  QrCode,
  BarChart3,
  Bell,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { staggerContainer, fadeUp } from '@/lib/animations'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const FEATURES = [
  {
    icon: TicketCheck,
    title: 'Smart Ticketing',
    description:
      'Sell free or paid tickets, set capacity limits, and issue instant digital tickets with unique QR codes.',
    accent: 'var(--color-brand-purple)',
    glow: 'oklch(58% 0.24 290 / 0.2)',
  },
  {
    icon: QrCode,
    title: 'QR Check-in',
    description:
      'Scan QR codes at the gate for lightning-fast check-ins. Works offline too — no signal required.',
    accent: 'var(--color-brand-pink)',
    glow: 'oklch(65% 0.22 340 / 0.2)',
  },
  {
    icon: BarChart3,
    title: 'Live Analytics',
    description:
      'Real-time dashboards for registrations, check-in rate, revenue, and attendee demographics.',
    accent: 'var(--color-brand-cyan)',
    glow: 'oklch(70% 0.18 200 / 0.2)',
  },
  {
    icon: Bell,
    title: 'Automated Reminders',
    description:
      'Automatically notify registered attendees via email and push before the event starts.',
    accent: 'var(--color-brand-amber)',
    glow: 'oklch(75% 0.18 65 / 0.2)',
  },
  {
    icon: ShieldCheck,
    title: 'Verified Clubs',
    description:
      'Clubs verify their email to publish events. Attendees always know who they\'re registering with.',
    accent: 'var(--color-brand-purple)',
    glow: 'oklch(58% 0.24 290 / 0.2)',
  },
  {
    icon: Zap,
    title: '100% Free Platform',
    description:
      'Zero subscription fees and 0% platform commission. Clubs collect 100% of event proceeds directly via UPI.',
    accent: 'var(--color-brand-pink)',
    glow: 'oklch(65% 0.22 340 / 0.2)',
  },
]

export function FeaturesSection() {
  const ref     = useRef<HTMLElement>(null)
  const inView  = useInView(ref, { once: true, margin: '-100px' })
  const reduced = useReducedMotion()

  return (
    <section
      id="features"
      ref={ref}
      aria-labelledby="features-heading"
      className="relative py-24 md:py-32 px-6 overflow-hidden"
    >
      {/* Subtle background grid */}
      <div
        aria-hidden="true"
        className="absolute inset-0 [background-image:linear-gradient(oklch(100%_0_0_/_0.03)_1px,transparent_1px),linear-gradient(90deg,oklch(100%_0_0_/_0.03)_1px,transparent_1px)] [background-size:60px_60px] pointer-events-none"
      />

      <div className="relative max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          variants={staggerContainer}
          initial={reduced ? 'visible' : 'hidden'}
          animate={inView ? 'visible' : 'hidden'}
          className="text-center mb-16"
        >
          <motion.p
            variants={reduced ? undefined : fadeUp}
            className="text-xs uppercase tracking-widest text-[var(--color-brand-purple)] font-semibold mb-3"
          >
            Everything you need
          </motion.p>
          <motion.h2
            id="features-heading"
            variants={reduced ? undefined : fadeUp}
            className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-[var(--color-text-primary)] mb-4"
          >
            Built for clubs.{' '}
            <span className="gradient-text">Loved by students.</span>
          </motion.h2>
          <motion.p
            variants={reduced ? undefined : fadeUp}
            className="max-w-xl mx-auto text-[var(--color-text-secondary)]"
          >
            From a single workshop to a 2,000-person fest — FestFlow handles every scale
            with the same effortless experience.
          </motion.p>
        </motion.div>

        {/* Feature grid */}
        <motion.ul
          variants={staggerContainer}
          initial={reduced ? 'visible' : 'hidden'}
          animate={inView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          role="list"
        >
          {FEATURES.map(({ icon: Icon, title, description, accent, glow }) => (
            <motion.li
              key={title}
              variants={reduced ? undefined : fadeUp}
              className="relative group rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.06)] bg-[var(--color-surface-1)] p-6 overflow-hidden transition-all duration-300 hover:border-[oklch(100%_0_0_/_0.12)] hover:bg-[var(--color-surface-2)]"
            >
              {/* Hover glow */}
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-[var(--radius-card)]"
                style={{ background: `radial-gradient(ellipse at 30% 30%, ${glow}, transparent 70%)` }}
              />

              <div
                className="relative w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${glow.replace('0.2)', '0.25)')}` }}
              >
                <Icon
                  size={20}
                  aria-hidden="true"
                  style={{ color: accent }}
                />
              </div>

              <h3 className="relative font-semibold text-base text-[var(--color-text-primary)] mb-2">
                {title}
              </h3>
              <p className="relative text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {description}
              </p>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </section>
  )
}
