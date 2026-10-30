import { Link } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRight, Sparkles, QrCode, Zap, Users } from 'lucide-react'
import { Button, KineticHeading } from '@/components/ui'
import { fadeUp, fadeIn, staggerContainer } from '@/lib/animations'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { HeroScene3D } from './HeroScene3D'

const CAPABILITIES = [
  { icon: Zap, label: '0% Platform Fee', subtext: 'Direct UPI to club bank' },
  { icon: QrCode, label: 'Sub-Second Entry', subtext: 'Camera QR gate scanner' },
  { icon: Users, label: 'Team Engine', subtext: 'Solo & roster verification' },
]

export function HeroSection() {
  const reduced = useReducedMotion()

  return (
    <section
      aria-label="Hero"
      className="relative min-h-[88dvh] flex flex-col justify-center overflow-hidden pt-6 sm:pt-10 pb-16 noise-overlay"
    >
      {/* Background radial warmth atmosphere */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[700px] pointer-events-none -z-10"
        style={{
          background:
            'radial-gradient(ellipse 65% 50% at 50% 12%, rgba(127, 26, 251, 0.16) 0%, rgba(24, 207, 252, 0.08) 50%, transparent 75%)',
        }}
      />

      {/* Grid pattern */}
      <div
        aria-hidden="true"
        className="absolute inset-0 grid-pattern opacity-25 pointer-events-none -z-10"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Editorial Headline & CTAs */}
          <motion.div
            variants={staggerContainer}
            initial={reduced ? 'visible' : 'hidden'}
            animate="visible"
            className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left z-10"
          >
            {/* Platform Eyebrow Badge */}
            <motion.div variants={reduced ? undefined : fadeIn} className="mb-4 sm:mb-5">
              <span className="inline-flex items-center gap-2 rounded-full pl-2.5 pr-4 py-1.5 text-xs font-semibold text-[#18CFFC] bg-[#14141A] border border-[#18CFFC]/30 shadow-[0_0_18px_rgba(24,207,252,0.20)]">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] shrink-0">
                  <Sparkles size={11} className="text-white" aria-hidden="true" />
                </span>
                <span>The Modern Event OS for Colleges · 0% Fee</span>
              </span>
            </motion.div>

            {/* Cinematic Editorial Headline */}
            <div className="mb-4 sm:mb-6 max-w-2xl w-full">
              <KineticHeading
                as="h1"
                className="text-[1.85rem] sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl leading-[1.14] sm:leading-[1.12] tracking-tight"
                lines={[
                  { text: 'Discover, organize' },
                  { text: '& ticket campus events', highlight: 'effortlessly.', gradientClass: 'gradient-text' },
                ]}
              />
            </div>

            {/* Subheadline */}
            <motion.p
              variants={reduced ? undefined : fadeUp}
              className="max-w-xl text-sm sm:text-base md:text-lg text-zinc-400 leading-relaxed mb-8 sm:mb-10 font-normal"
            >
              FestFlow gives college clubs an enterprise-grade command center. Build custom forms, collect direct UPI settlements with zero platform markup, issue cryptographically stamped passes, and scan attendees in real time.
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
                  className="w-full sm:w-auto min-h-[52px] px-8 justify-center text-sm sm:text-base font-semibold shine-on-hover shadow-[0_4px_24px_rgba(127,26,251,0.40)]"
                  rightIcon={<ArrowRight size={18} />}
                >
                  Host an Event Free
                </Button>
              </Link>
              <Link to="/discover" className="w-full sm:w-auto">
                <Button
                  id="hero-cta-discover"
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto min-h-[52px] px-7 justify-center text-sm sm:text-base font-medium"
                >
                  Explore Campus Events
                </Button>
              </Link>
            </motion.div>

            {/* Micro Feature Telemetry Highlights */}
            <motion.div
              variants={reduced ? undefined : fadeUp}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg lg:max-w-none"
            >
              {CAPABILITIES.map(({ icon: Icon, label, subtext }) => (
                <div
                  key={label}
                  className="p-3.5 rounded-2xl bg-[#0E0E12] border border-white/[0.08] hover:border-[#18CFFC]/35 transition-colors flex items-center lg:items-start gap-3 text-left shadow-sm"
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-[#18CFFC]/15 text-[#18CFFC]"
                  >
                    <Icon size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white leading-tight">
                      {label}
                    </h4>
                    <p className="text-[10px] text-zinc-400 leading-tight mt-0.5">
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
                  'radial-gradient(circle, rgba(127, 26, 251, 0.25) 0%, rgba(24, 207, 252, 0.15) 50%, transparent 70%)',
                filter: 'blur(35px)',
              }}
            />
            <HeroScene3D />
          </div>
        </div>
      </div>
    </section>
  )
}
