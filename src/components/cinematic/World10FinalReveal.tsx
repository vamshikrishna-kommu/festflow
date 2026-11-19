/**
 * FESTFLOW CINEMATIC 4.0 — WORLD 10: THE FINAL BRAND REVEAL
 * Headline: "ONE PLATFORM. EVERY CAMPUS EVENT."
 * Supporting text: "Your next campus experience starts here."
 *
 * Grand finale converging Student Discovery & Campus Operations:
 * - Central FestFlow emblem focal point with radiant multi-tone atmospheric ring
 * - Final brand tagline: "ONE PLATFORM. EVERY CAMPUS EVENT."
 * - Primary conversion CTAs:
 *   - "EXPLORE EVENTS" -> /discover
 *   - "GET STARTED" -> /student/signup (with club organizer link /club/signup)
 * - 3 Trust badges:
 *   - 0% Platform Fee
 *   - Tamper-Proof Digital Pass
 *   - Direct Bank Settlement
 *
 * Accessibility & Skip-to-Join guarantee:
 * - Bidirectional scrub timeline completes arrival before #world-10-final
 *   crosses the navbar offset, ensuring Skip-to-Join lands on fully visible, interactive CTAs.
 */
import { useRef, useEffect } from 'react'
import { Link } from 'react-router'
import {
  ArrowRight,
  Compass,
  ShieldCheck,
  Sparkles,
  Zap,
  Users,
} from 'lucide-react'
import { gsap } from '@/lib/motion'
import { Logo } from '@/components/ui/Logo'
import { type SceneProps } from './CinematicShared'

export function World10FinalReveal({
  reducedMotion,
  className = '',
  id = 'world-10-final',
}: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const logoRef = useRef<HTMLDivElement>(null)
  const sublineRef = useRef<HTMLDivElement>(null)
  const headlineRef = useRef<HTMLHeadingElement>(null)
  const supportingRef = useRef<HTMLParagraphElement>(null)
  const ctaGroupRef = useRef<HTMLDivElement>(null)
  const badgesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const revealEls = [
      logoRef.current,
      sublineRef.current,
      headlineRef.current,
      supportingRef.current,
      ctaGroupRef.current,
      badgesRef.current,
    ].filter(Boolean)

    const ctx = gsap.context(() => {
      if (reducedMotion) {
        gsap.set([cardRef.current, ...revealEls], {
          opacity: 1,
          scale: 1,
          y: 0,
        })
        return
      }

      // Bidirectional scroll-linked arrival that completes BEFORE reaching navbar offset
      // so Skip-to-Join lands directly on fully visible CTAs at opacity: 1.
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: 'top 90%',
          end: () => `top ${Math.round(window.innerHeight * 0.48)}`,
          scrub: 0.25,
          invalidateOnRefresh: true,
        },
      })

      tl.fromTo(
        cardRef.current,
        { opacity: 0.35, y: 20, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.65, ease: 'power2.out' },
        0
      )
        .fromTo(
          logoRef.current,
          { opacity: 0.4, y: 12, scale: 0.95 },
          { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'power2.out' },
          0.08
        )
        .fromTo(
          sublineRef.current,
          { opacity: 0.4, y: 8 },
          { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
          0.16
        )
        .fromTo(
          headlineRef.current,
          { opacity: 0.4, y: 12 },
          { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' },
          0.22
        )
        .fromTo(
          supportingRef.current,
          { opacity: 0.4, y: 10 },
          { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
          0.28
        )
        .fromTo(
          ctaGroupRef.current,
          { opacity: 0.4, y: 14 },
          { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' },
          0.34
        )
        .fromTo(
          badgesRef.current,
          { opacity: 0.4, y: 10 },
          { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
          0.4
        )
    }, container)

    return () => ctx.revert()
  }, [reducedMotion])

  return (
    <section
      ref={containerRef}
      id={id}
      aria-label="World 10: The Final Brand Reveal"
      className={`relative w-full py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex items-center justify-center select-none ${className}`}
    >
      <div
        ref={cardRef}
        className="relative w-full max-w-4xl rounded-3xl bg-[#0E0E12]/90 border border-white/10 p-6 sm:p-12 lg:p-16 backdrop-blur-xl shadow-2xl text-center overflow-hidden"
      >
        {/* Radiant Multi-Tone Atmospheric Ring */}
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] sm:w-[500px] sm:h-[500px] rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, rgba(24,207,252,0.18) 0%, rgba(7,164,252,0.12) 30%, rgba(127,26,251,0.14) 55%, rgba(237,71,252,0.08) 75%, transparent 100%)',
            filter: 'blur(45px)',
          }}
        />

        {/* FestFlow Emblem Focal Point */}
        <div ref={logoRef} className="relative z-10 flex justify-center mb-6">
          <div className="relative group">
            <div
              aria-hidden="true"
              className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-[#18CFFC] via-[#7F1AFB] to-[#ED47FC] opacity-40 blur-lg transition duration-500 group-hover:opacity-75"
            />
            <div className="relative p-3.5 sm:p-4 rounded-2xl bg-[#08080A] border border-white/20 shadow-2xl">
              <Logo variant="hero" />
            </div>
          </div>
        </div>

        {/* Narrative Pill */}
        <div ref={sublineRef} className="relative z-10 mb-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold text-[#18CFFC] bg-[#14141A] border border-[#18CFFC]/30 shadow-md">
            <Sparkles size={12} className="text-[#18CFFC]" />
            <span>WORLD 10 · THE FINAL REVEAL</span>
          </div>
        </div>

        {/* Monumental Headline */}
        <h2
          ref={headlineRef}
          className="relative z-10 text-3xl min-[360px]:text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight font-display mb-4"
        >
          ONE PLATFORM.{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #18CFFC 0%, #07A4FC 40%, #7F1AFB 75%, #ED47FC 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            EVERY CAMPUS EVENT.
          </span>
        </h2>

        {/* Supporting text */}
        <p
          ref={supportingRef}
          className="relative z-10 text-sm sm:text-lg text-zinc-300 max-w-2xl mx-auto leading-relaxed font-body mb-8 sm:mb-10"
        >
          Your next campus experience starts here. Join thousands of collegiate students and club leads organizing, competing, and celebrating together.
        </p>

        {/* Primary & Secondary Conversion CTAs */}
        <div
          ref={ctaGroupRef}
          className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-10 sm:mb-12"
        >
          <Link
            to="/discover"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 rounded-full text-sm font-bold text-black bg-gradient-to-r from-[#18CFFC] via-[#07A4FC] to-white hover:brightness-110 transition-all duration-200 shadow-[0_0_25px_rgba(24,207,252,0.35)] cursor-pointer"
          >
            <Compass size={17} />
            <span>EXPLORE EVENTS</span>
            <ArrowRight size={17} />
          </Link>

          <Link
            to="/student/signup"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 rounded-full text-sm font-bold text-white bg-[#14141A] hover:bg-white/[0.08] border border-white/20 transition-all duration-200 shadow-lg cursor-pointer"
          >
            <Users size={17} className="text-[#18CFFC]" />
            <span>GET STARTED</span>
          </Link>
        </div>

        {/* Club lead prompt */}
        <p className="relative z-10 text-xs text-zinc-400 mb-8 font-body">
          Leading a student club or society?{' '}
          <Link
            to="/club/signup"
            className="text-[#18CFFC] font-semibold hover:underline inline-flex items-center gap-1"
          >
            Create club account <ArrowRight size={12} />
          </Link>
        </p>

        {/* 3 Trust Badges */}
        <div
          ref={badgesRef}
          className="relative z-10 pt-8 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center font-mono text-xs text-zinc-400"
        >
          <div className="flex items-center justify-center gap-2">
            <span className="w-6 h-6 rounded-md bg-[#18CFFC]/15 text-[#18CFFC] flex items-center justify-center font-bold text-[11px]">
              0%
            </span>
            <span className="font-semibold text-zinc-300">0% Platform Fee</span>
          </div>

          <div className="flex items-center justify-center gap-2">
            <ShieldCheck size={16} className="text-[#7F1AFB]" />
            <span className="font-semibold text-zinc-300">Tamper-Proof Digital Pass</span>
          </div>

          <div className="flex items-center justify-center gap-2">
            <Zap size={16} className="text-emerald-400" />
            <span className="font-semibold text-zinc-300">Direct Bank Settlement</span>
          </div>
        </div>
      </div>
    </section>
  )
}

