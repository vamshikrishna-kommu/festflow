import { Link } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRight, Sparkles, QrCode, ShieldCheck, Zap } from 'lucide-react'
import { Button } from '@/components/ui'
import { fadeUp, fadeIn, staggerContainer } from '@/lib/animations'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { HeroScene3D } from './HeroScene3D'

const CAPABILITIES = [
  { icon: Zap, label: '0% Platform Fee', subtext: 'Free for every campus club' },
  { icon: QrCode, label: 'Instant QR Entry', subtext: 'Real-time check-in validation' },
  { icon: ShieldCheck, label: 'Direct UPI', subtext: 'Ticket revenue direct to club bank' },
]

export function HeroSection() {
  const reduced = useReducedMotion()

  return (
    <section
      aria-label="Hero"
      className="relative min-h-[85dvh] flex flex-col justify-center overflow-hidden pt-8 sm:pt-12 pb-14 noise-overlay"
    >
      {/* Background radial atmosphere */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[750px] pointer-events-none -z-10"
        style={{
          background:
            'radial-gradient(ellipse 65% 55% at 50% 15%, oklch(58% 0.26 285 / 0.16) 0%, oklch(62% 0.24 318 / 0.08) 50%, transparent 75%)',
        }}
      />

      {/* Grid pattern */}
      <div
        aria-hidden="true"
        className="absolute inset-0 grid-pattern opacity-30 pointer-events-none -z-10"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Column: Narrative Headline & Action */}
          <motion.div
            variants={staggerContainer}
            initial={reduced ? 'visible' : 'hidden'}
            animate="visible"
            className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left z-10"
          >
            {/* Platform Eyebrow Badge */}
            <motion.div variants={reduced ? undefined : fadeIn} className="mb-4 sm:mb-5">
              <span className="inline-flex items-center gap-2 rounded-full pl-2.5 pr-4 py-1.5 text-xs font-semibold text-[var(--color-brand-violet)] glass border border-[oklch(58%_0.26_285_/_0.25)] shadow-sm">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full gradient-brand shrink-0">
                  <Sparkles size={11} className="text-white" aria-hidden="true" />
                </span>
                <span>The Modern Event OS for Colleges · 0% Fee</span>
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={reduced ? undefined : fadeUp}
              className="font-display font-extrabold text-3xl sm:text-5xl lg:text-5xl xl:text-6xl leading-[1.12] tracking-tight mb-4 sm:mb-6 text-[var(--color-text-primary)] max-w-2xl"
            >
              Discover, organize <br className="hidden sm:inline" />
              & ticket campus events{' '}
              <span className="gradient-text">effortlessly.</span>
            </motion.h1>

            {/* Subheadline describing genuine capabilities */}
            <motion.p
              variants={reduced ? undefined : fadeUp}
              className="max-w-xl text-sm sm:text-base md:text-lg text-[var(--color-text-secondary)] leading-relaxed mb-8 sm:mb-10"
            >
              FestFlow empowers college clubs to publish custom registrations, collect UPI payments directly to club accounts, issue verified digital QR tickets, and check in attendees in real time.
            </motion.p>

            {/* Dual CTAs */}
            <motion.div
              variants={reduced ? undefined : fadeUp}
              className="flex flex-col sm:flex-row gap-3.5 sm:gap-4 w-full sm:w-auto mb-10 sm:mb-12"
            >
              <Link to="/club/signup" className="w-full sm:w-auto">
                <Button
                  id="hero-cta-primary"
                  variant="primary"
                  size="lg"
                  className="w-full sm:w-auto min-h-[52px] px-8 justify-center text-sm sm:text-base font-semibold shine-on-hover shadow-[0_0_28px_oklch(58%_0.26_285_/_0.35)]"
                  rightIcon={<ArrowRight size={18} />}
                >
                  Create Club Event Free
                </Button>
              </Link>
              <Link to="/discover" className="w-full sm:w-auto">
                <Button
                  id="hero-cta-discover"
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto min-h-[52px] px-7 justify-center text-sm sm:text-base font-medium"
                >
                  Browse Campus Events
                </Button>
              </Link>
            </motion.div>

            {/* Micro Feature Highlights */}
            <motion.div
              variants={reduced ? undefined : fadeUp}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg lg:max-w-none"
            >
              {CAPABILITIES.map(({ icon: Icon, label, subtext }) => (
                <div
                  key={label}
                  className="p-3 rounded-2xl glass-subtle border border-[oklch(100%_0_0_/_0.06)] flex items-center lg:items-start gap-2.5 text-left"
                >
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'oklch(58% 0.26 285 / 0.16)' }}
                  >
                    <Icon size={14} className="text-[var(--color-brand-violet)]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[var(--color-text-primary)] leading-tight">
                      {label}
                    </h4>
                    <p className="text-[10px] text-[var(--color-text-muted)] leading-tight mt-0.5">
                      {subtext}
                    </p>
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right Column: Original 3D Sculpture Centerpiece */}
          <div className="lg:col-span-5 flex items-center justify-center relative">
            {/* Ambient lighting backdrop behind 3D object */}
            <div
              aria-hidden="true"
              className="absolute w-80 h-80 rounded-full pointer-events-none -z-0"
              style={{
                background:
                  'radial-gradient(circle, oklch(58% 0.26 285 / 0.22) 0%, oklch(72% 0.16 200 / 0.15) 50%, transparent 70%)',
                filter: 'blur(30px)',
              }}
            />
            <HeroScene3D />
          </div>
        </div>
      </div>
    </section>
  )
}
