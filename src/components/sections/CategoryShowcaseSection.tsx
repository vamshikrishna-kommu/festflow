import { useRef } from 'react'
import { motion, useInView } from 'motion/react'
import { Link } from 'react-router'
import {
  Code,
  Music,
  Trophy,
  BookOpen,
  Gamepad2,
  Mic,
  ArrowRight,
  Compass,
} from 'lucide-react'
import { Card, KineticHeading } from '@/components/ui'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const CATEGORIES = [
  {
    id: 'tech',
    title: 'Technical & Hackathons',
    description: 'Code sprints, robotics expos, AI symposiums, and 36-hour buildathons.',
    icon: Code,
    gradient: 'from-violet-600/20 via-purple-600/10 to-transparent',
    accentColor: '#a855f7',
    tag: 'Tech Chapters',
  },
  {
    id: 'cultural',
    title: 'Cultural & Arts',
    description: 'Dance battles, live music nights, fashion showcases, and theater fests.',
    icon: Music,
    gradient: 'from-fuchsia-600/20 via-pink-600/10 to-transparent',
    accentColor: '#d946ef',
    tag: 'Arts Societies',
  },
  {
    id: 'sports',
    title: 'Sports & Tournaments',
    description: 'Inter-college cricket, football leagues, basketball face-offs, and track meets.',
    icon: Trophy,
    gradient: 'from-amber-500/20 via-yellow-600/10 to-transparent',
    accentColor: '#f59e0b',
    tag: 'Sports Councils',
  },
  {
    id: 'workshop',
    title: 'Workshops & Bootcamps',
    description: 'Hands-on developer workshops, design masterclasses, and career panels.',
    icon: BookOpen,
    gradient: 'from-cyan-500/20 via-teal-600/10 to-transparent',
    accentColor: '#06b6d4',
    tag: 'Academic Forums',
  },
  {
    id: 'gaming',
    title: 'Gaming & Esports',
    description: 'LAN tournaments, Valorant showdowns, console championships, and game jams.',
    icon: Gamepad2,
    gradient: 'from-emerald-500/20 via-green-600/10 to-transparent',
    accentColor: '#10b981',
    tag: 'Esports Clubs',
  },
  {
    id: 'literary',
    title: 'Literary & Debates',
    description: 'Parliamentary debates, MUNs, quiz bowls, creative writing, and poetry slams.',
    icon: Mic,
    gradient: 'from-indigo-500/20 via-blue-600/10 to-transparent',
    accentColor: '#6366f1',
    tag: 'Literary Clubs',
  },
]

export function CategoryShowcaseSection() {
  const containerRef = useRef<HTMLElement>(null)
  const inView = useInView(containerRef, { once: true, margin: '-70px' })
  const reduced = useReducedMotion()

  return (
    <section
      id="categories"
      ref={containerRef}
      aria-labelledby="categories-heading"
      className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full"
    >
      <div className="mb-12 sm:mb-16 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <KineticHeading
            as="h2"
            id="categories-heading"
            badgeText="Event Categories"
            badgeIcon={<Compass size={13} />}
            className="text-2xl sm:text-4xl lg:text-5xl"
            lines={[
              { text: 'Find your campus pulse.' },
              { text: 'Explore by passion.', highlight: 'All fields.', gradientClass: 'gradient-text' },
            ]}
          />
          <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-2 leading-relaxed max-w-xl">
            From high-stakes hackathons to open-mic poetry, filter and discover what is happening across your campus.
          </p>
        </div>

        <Link
          to="/discover"
          className="hidden sm:inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[var(--color-brand-violet)] hover:underline shrink-0"
        >
          <span>View all categories</span>
          <ArrowRight size={15} />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {CATEGORIES.map(({ id, title, description, icon: Icon, gradient, accentColor, tag }, index) => (
          <motion.div
            key={id}
            initial={reduced ? undefined : { opacity: 0, y: 20 }}
            animate={inView || reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.45, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
            whileHover={reduced ? undefined : { y: -6 }}
            className="h-full"
          >
            <Link to={`/discover?category=${id}`} className="group block h-full">
              <Card
                className="relative p-6 h-full flex flex-col justify-between border border-[oklch(100%_0_0_/_0.065)] bg-[var(--color-surface-1)] group-hover:border-[oklch(100%_0_0_/_0.18)] group-hover:bg-[var(--color-surface-2)] transition-all duration-300 overflow-hidden shadow-md group-hover:shadow-xl"
              >
                {/* Subtle gradient wash in corner */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-40 group-hover:opacity-85 transition-opacity duration-300 pointer-events-none`}
                />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-110"
                      style={{ background: `${accentColor}25` }}
                    >
                      <Icon size={20} style={{ color: accentColor }} />
                    </div>
                    <span className="text-[10px] font-semibold text-[var(--color-text-muted)] group-hover:text-white transition-colors">
                      {tag}
                    </span>
                  </div>

                  <h3 className="font-display font-bold text-base text-[var(--color-text-primary)] mb-1.5 group-hover:text-white transition-colors">
                    {title}
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    {description}
                  </p>
                </div>

                <div className="relative z-10 pt-4 mt-5 border-t border-[oklch(100%_0_0_/_0.06)] flex items-center justify-between text-xs font-semibold text-[var(--color-brand-violet)] group-hover:text-white transition-colors">
                  <span>Browse {title}</span>
                  <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />
                </div>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="mt-8 text-center sm:hidden">
        <Link
          to="/discover"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-brand-violet)] hover:underline"
        >
          <span>View all event categories</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  )
}

