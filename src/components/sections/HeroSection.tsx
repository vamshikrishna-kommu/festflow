import { useRef, useEffect } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ArrowRight, Play, Star, Users, Calendar } from 'lucide-react'
import { Button } from '@/components/ui'
import { fadeUp, fadeIn, staggerContainer } from '@/lib/animations'
import { useReducedMotion } from '@/hooks/useReducedMotion'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const STATS = [
  { icon: Calendar, value: '2,400+', label: 'Events hosted' },
  { icon: Users,    value: '180K+',  label: 'Students reached' },
  { icon: Star,     value: '4.9★',   label: 'Club rating avg.' },
]

const FLOATING_TAGS = [
  { text: '🎵 Music Fest',         style: 'top-[18%] left-[8%]'  },
  { text: '💻 Hackathon',          style: 'top-[30%] right-[6%]' },
  { text: '🎨 Art Exhibition',     style: 'top-[65%] left-[5%]'  },
  { text: '🏆 Sports Tournament',  style: 'top-[70%] right-[8%]' },
]

export function HeroSection() {
  const sectionRef   = useRef<HTMLElement>(null)
  const orb1Ref      = useRef<HTMLDivElement>(null)
  const orb2Ref      = useRef<HTMLDivElement>(null)
  const floatsRef    = useRef<HTMLDivElement>(null)
  const reduced      = useReducedMotion()

  // GSAP: subtle parallax on orbs (justified — CSS parallax would stutter here)
  useGSAP(() => {
    if (reduced) return

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top top',
        end: 'bottom top',
        scrub: 1.5,
      },
    })

    tl.to(orb1Ref.current, { y: -120, scale: 1.15, ease: 'none' }, 0)
    tl.to(orb2Ref.current, { y: -80,  scale: 1.1,  ease: 'none' }, 0)
    tl.to(floatsRef.current, { y: -60, ease: 'none' }, 0)
  }, { scope: sectionRef })

  // Ambient orb mouse-tracking (subtle, no GSAP needed)
  useEffect(() => {
    if (reduced) return
    const section = sectionRef.current
    if (!section) return

    const move = (e: MouseEvent) => {
      const rect = section.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width  - 0.5) * 30
      const y = ((e.clientY - rect.top)  / rect.height - 0.5) * 30
      orb1Ref.current?.style.setProperty('transform', `translate(${x * 0.4}px, ${y * 0.4}px)`)
      orb2Ref.current?.style.setProperty('transform', `translate(${-x * 0.2}px, ${-y * 0.2}px)`)
    }

    section.addEventListener('mousemove', move, { passive: true })
    return () => section.removeEventListener('mousemove', move)
  }, [reduced])

  return (
    <section
      ref={sectionRef}
      aria-label="Hero"
      className="relative min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden pt-24 pb-20 noise-overlay"
    >
      {/* Background orbs */}
      <div
        ref={orb1Ref}
        aria-hidden="true"
        className="absolute -top-32 -left-32 w-[700px] h-[700px] rounded-full bg-[radial-gradient(ellipse_at_center,oklch(58%_0.24_290_/_0.28)_0%,transparent_70%)] pointer-events-none will-change-transform"
      />
      <div
        ref={orb2Ref}
        aria-hidden="true"
        className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-[radial-gradient(ellipse_at_center,oklch(65%_0.22_340_/_0.22)_0%,transparent_70%)] pointer-events-none will-change-transform"
      />

      {/* Floating tags */}
      <div ref={floatsRef} aria-hidden="true" className="absolute inset-0 pointer-events-none">
        {FLOATING_TAGS.map(({ text, style }) => (
          <div
            key={text}
            className={`absolute hidden lg:flex glass rounded-[var(--radius-pill)] px-4 py-2 text-xs font-semibold text-[var(--color-text-secondary)] ${style}`}
          >
            {text}
          </div>
        ))}
      </div>

      {/* Content */}
      <motion.div
        variants={staggerContainer}
        initial={reduced ? 'visible' : 'hidden'}
        animate="visible"
        className="relative z-10 flex flex-col items-center text-center px-6 max-w-5xl"
      >
        {/* Eyebrow pill */}
        <motion.div variants={reduced ? undefined : fadeIn} className="mb-6">
          <span className="inline-flex items-center gap-2 glass rounded-[var(--radius-pill)] px-4 py-1.5 text-xs font-semibold text-[var(--color-brand-purple)] ring-1 ring-[oklch(58%_0.24_290_/_0.3)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-purple)] animate-pulse" />
            Now live for college clubs across India
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={reduced ? undefined : fadeUp}
          className="font-display font-extrabold text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[1.05] tracking-tight mb-6"
        >
          <span className="text-[var(--color-text-primary)]">Your campus,</span>
          <br />
          <span className="gradient-text">electrified.</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          variants={reduced ? undefined : fadeUp}
          className="max-w-2xl text-lg md:text-xl text-[var(--color-text-secondary)] leading-relaxed mb-10"
        >
          FestFlow is the all-in-one event platform for college clubs. Create events, sell
          tickets, send QR check-ins, and track attendance — all in one beautifully simple
          dashboard.
        </motion.p>

        {/* CTAs */}
        <motion.div
          variants={reduced ? undefined : fadeUp}
          className="flex flex-col sm:flex-row gap-4 mb-16"
        >
          <Link to="/club/signup">
            <Button
              id="hero-cta-primary"
              variant="primary"
              size="lg"
              rightIcon={<ArrowRight size={18} />}
            >
              Start for free
            </Button>
          </Link>
          <Link to="/discover">
            <Button
              id="hero-cta-discover"
              variant="outline"
              size="lg"
              leftIcon={<Play size={16} className="fill-current" />}
            >
              Browse events
            </Button>
          </Link>
        </motion.div>

        {/* Social proof stats */}
        <motion.div
          variants={reduced ? undefined : fadeUp}
          className="flex flex-wrap justify-center gap-8 sm:gap-12"
        >
          {STATS.map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <Icon
                  size={16}
                  className="text-[var(--color-brand-purple)]"
                  aria-hidden="true"
                />
                <span className="font-display font-bold text-2xl text-[var(--color-text-primary)]">
                  {value}
                </span>
              </div>
              <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Scroll hint */}
      <motion.div
        variants={reduced ? undefined : fadeIn}
        initial="hidden"
        animate="visible"
        transition={{ delay: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        aria-hidden="true"
      >
        <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
          Scroll
        </span>
        <div className="w-5 h-8 rounded-[var(--radius-pill)] border border-[oklch(100%_0_0_/_0.15)] flex justify-center pt-1.5">
          <motion.div
            className="w-1 h-1.5 rounded-full bg-[var(--color-brand-purple)]"
            animate={reduced ? {} : { y: [0, 12, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>
    </section>
  )
}
