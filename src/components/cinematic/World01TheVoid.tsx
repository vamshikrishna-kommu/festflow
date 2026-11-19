/**
 * FESTFLOW CINEMATIC 4.0 (FESTFLOW INFINITE)
 * WORLD 01: THE VOID / FESTFLOW AWAKENS
 *
 * Specification:
 * - Screen begins in deep obsidian (#08080A).
 * - Luminous cyan point of origin with expanding energy rays and atmospheric aura.
 * - Massive 3D dimensional typography in Sora: "EVERY CAMPUS HAS A STORY."
 * - Subline: "Discover the experiences that bring campuses together."
 * - Dual CTAs: Primary "Explore Events" (links to /discover) & Secondary "Enter the Universe" (scrolls to World 02).
 * - Bidirectional GSAP ScrollTrigger timeline with scrub.
 * - Clean reduced-motion handling & full responsiveness (320px to 4K).
 */
import { useRef, useEffect } from 'react'
import { Link } from 'react-router'
import { ArrowRight, ChevronDown, Sparkles, Compass } from 'lucide-react'
import { gsap } from '@/lib/gsap'
import { Logo } from '@/components/ui/Logo'
import { getNavbarOffset, scrollToScene, type SceneProps } from './CinematicShared'

export interface WorldProps extends SceneProps {}

export function World01TheVoid({
  reducedMotion,
  className = '',
  id = 'world-01-void',
}: WorldProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pinTargetRef = useRef<HTMLDivElement>(null)

  // Inner elements for entrance animation
  const innerPointRef = useRef<HTMLDivElement>(null)
  const innerRaysRef = useRef<HTMLDivElement>(null)
  const innerAuraRef = useRef<HTMLDivElement>(null)
  const innerLogoRef = useRef<HTMLDivElement>(null)
  const innerBadgeRef = useRef<HTMLDivElement>(null)
  const innerHeadlineRef = useRef<HTMLHeadingElement>(null)
  const innerSublineRef = useRef<HTMLParagraphElement>(null)
  const innerCtaRef = useRef<HTMLDivElement>(null)
  const innerTelemetryRef = useRef<HTMLDivElement>(null)

  // Outer wrappers for bidirectional scroll scrub
  const scrollVoidCoreRef = useRef<HTMLDivElement>(null)
  const scrollContentRef = useRef<HTMLDivElement>(null)
  const scrollRaysRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const pinTarget = pinTargetRef.current
    if (!container || !pinTarget) return

    const ctx = gsap.context(() => {
      if (reducedMotion) {
        gsap.set(
          [
            innerPointRef.current,
            innerRaysRef.current,
            innerAuraRef.current,
            innerLogoRef.current,
            innerBadgeRef.current,
            innerHeadlineRef.current,
            innerSublineRef.current,
            innerCtaRef.current,
            innerTelemetryRef.current,
            scrollVoidCoreRef.current,
            scrollContentRef.current,
            scrollRaysRef.current,
          ],
          { opacity: 1, scale: 1, y: 0, clearProps: 'transform' }
        )
        return
      }

      // 1. Initial Void Awakening Entrance Animation
      const enterTl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      enterTl
        .fromTo(
          innerPointRef.current,
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.8, ease: 'back.out(1.8)' }
        )
        .fromTo(
          innerRaysRef.current,
          { scale: 0.2, opacity: 0, rotation: -30 },
          { scale: 1, opacity: 0.9, rotation: 0, duration: 1.1 },
          '-=0.5'
        )
        .fromTo(
          innerAuraRef.current,
          { scale: 0.4, opacity: 0 },
          { scale: 1, opacity: 0.85, duration: 1 },
          '-=0.8'
        )
        .fromTo(
          innerLogoRef.current,
          { opacity: 0, scale: 0.88, y: 20 },
          { opacity: 1, scale: 1, y: 0, duration: 0.65 },
          '-=0.6'
        )
        .fromTo(
          innerBadgeRef.current,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.45 },
          '-=0.4'
        )
        .fromTo(
          innerHeadlineRef.current,
          { opacity: 0, y: 24, scale: 0.96 },
          { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'power2.out' },
          '-=0.35'
        )
        .fromTo(
          innerSublineRef.current,
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.5 },
          '-=0.35'
        )
        .fromTo(
          innerCtaRef.current,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.5 },
          '-=0.3'
        )
        .fromTo(
          innerTelemetryRef.current,
          { opacity: 0 },
          { opacity: 0.75, duration: 0.4 },
          '-=0.2'
        )

      // 2. Bidirectional GSAP Scroll Scrub
      // As the user scrubs downward, the luminous void point blooms outward
      // and the dimensional headline glides forward in 3D perspective before fading into World 02
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: () => `top ${getNavbarOffset()}`,
          end: '+=90%',
          scrub: 0.6,
          pin: pinTarget,
          pinSpacing: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      })

      scrollTl
        // Expanding energy rays and bloom
        .to(
          scrollVoidCoreRef.current,
          {
            scale: 3.5,
            opacity: 0,
            duration: 0.7,
            ease: 'power2.in',
          },
          0
        )
        .to(
          scrollRaysRef.current,
          {
            scale: 2.2,
            rotation: 45,
            opacity: 0,
            duration: 0.65,
            ease: 'power2.in',
          },
          0
        )
        // Typography glides forward and dissolves
        .to(
          scrollContentRef.current,
          {
            y: -40,
            scale: 1.08,
            opacity: 0,
            duration: 0.65,
            ease: 'power2.in',
          },
          0.1
        )
    }, container)

    return () => ctx.revert()
  }, [reducedMotion])

  const handleEnterUniverse = () => {
    scrollToScene('world-02-campus')
  }

  return (
    <section
      ref={containerRef}
      id={id}
      aria-label="World 01: The Void - FestFlow Awakens"
      className={`relative w-full bg-[#08080A] text-white overflow-x-clip select-none ${className}`}
    >
      <div
        ref={pinTargetRef}
        className="relative w-full h-[calc(100dvh-65px)] sm:h-[calc(100dvh-73px)] min-h-[580px] flex flex-col items-center justify-between px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-6 overflow-hidden"
      >
        {/* Background Deep Obsidian Atmosphere & Star Dust */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none -z-20 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, #0c0d14 0%, #08080A 80%, #050507 100%)',
            }}
          />
          {/* Subtle grid mesh */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(24,207,252,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(24,207,252,0.4) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
        </div>

        {/* Luminous Cyan Origin Point & Energy Rays */}
        <div
          ref={scrollVoidCoreRef}
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none flex items-center justify-center -z-10"
        >
          {/* Expanding Energy Rays */}
          <div ref={scrollRaysRef} className="absolute inset-0 flex items-center justify-center">
            <div
              ref={innerRaysRef}
              className="relative w-[340px] sm:w-[580px] md:w-[860px] h-[340px] sm:h-[580px] md:h-[860px] flex items-center justify-center"
            >
              {/* Ray 1 (Horizontal) */}
              <div
                className="absolute w-full h-[2px] bg-gradient-to-r from-transparent via-[#18CFFC] to-transparent opacity-75"
                style={{ boxShadow: '0 0 28px 4px rgba(24,207,252,0.6)' }}
              />
              {/* Ray 2 (Vertical) */}
              <div
                className="absolute h-full w-[2px] bg-gradient-to-b from-transparent via-[#7F1AFB] to-transparent opacity-60"
                style={{ boxShadow: '0 0 28px 4px rgba(127,26,251,0.5)' }}
              />
              {/* Ray 3 (Diagonal 45deg) */}
              <div
                className="absolute w-[80%] h-[1.5px] rotate-45 bg-gradient-to-r from-transparent via-[#07A4FC] to-transparent opacity-50"
              />
              {/* Ray 4 (Diagonal -45deg) */}
              <div
                className="absolute w-[80%] h-[1.5px] -rotate-45 bg-gradient-to-r from-transparent via-[#ED47FC] to-transparent opacity-50"
              />
            </div>
          </div>

          {/* Radial Ambient Aura */}
          <div
            ref={innerAuraRef}
            className="w-[280px] sm:w-[460px] md:w-[680px] h-[280px] sm:h-[460px] md:h-[680px] rounded-full blur-3xl"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(24,207,252,0.28) 0%, rgba(13,86,251,0.18) 40%, rgba(127,26,251,0.12) 65%, transparent 75%)',
            }}
          />

          {/* Central Pulsing Cyan Point of Origin */}
          <div ref={innerPointRef} className="absolute flex items-center justify-center">
            <div className="w-5 sm:w-6 h-5 sm:h-6 rounded-full bg-[#18CFFC] shadow-[0_0_40px_10px_rgba(24,207,252,0.9)] animate-pulse" />
            <div className="absolute w-12 sm:w-16 h-12 sm:h-16 rounded-full border border-[#18CFFC]/50 animate-ping opacity-40" />
            <div className="absolute w-20 sm:w-28 h-20 sm:h-28 rounded-full border border-[#07A4FC]/30" />
          </div>
        </div>

        {/* Top Bar: Coordinate Telemetry & World Identifier */}
        <div className="relative z-10 w-full max-w-6xl mx-auto flex items-center justify-between px-2 pt-1">
          <div
            ref={innerBadgeRef}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] sm:text-xs font-mono font-medium tracking-[0.18em] uppercase text-[#18CFFC] bg-[#14141A]/90 border border-[#18CFFC]/35 backdrop-blur-md shadow-[0_0_20px_rgba(24,207,252,0.18)]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#18CFFC] animate-ping" />
            <span>WORLD 01 · THE VOID</span>
          </div>

          <div
            ref={innerTelemetryRef}
            className="hidden sm:flex items-center gap-3 text-[10px] font-mono text-zinc-400 tracking-wider"
          >
            <span className="text-[#07A4FC]">ORIGIN: [00.00.00]</span>
            <span className="text-zinc-600">|</span>
            <span>SYSTEM: FESTFLOW 4.0 INFINITE</span>
          </div>
        </div>

        {/* Center Composition: Logo, Massive Sora Typography, Subline, CTAs */}
        <div
          ref={scrollContentRef}
          className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto w-full my-auto px-2"
        >
          {/* FestFlow Monolith Emblem */}
          <div ref={innerLogoRef} className="mb-3 sm:mb-5">
            <Logo
              variant="hero"
              alt="FestFlow Sovereign Brand Emblem"
              containerClassName="!w-[110px] min-[380px]:!w-[130px] sm:!w-[170px] md:!w-[195px] !p-2 sm:!p-3 !rounded-2xl sm:!rounded-3xl shadow-[0_0_60px_rgba(24,207,252,0.28)]"
            />
          </div>

          {/* Subline Micro Tag */}
          <div className="mb-2 sm:mb-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] min-[380px]:text-xs sm:text-sm font-mono tracking-[0.25em] text-[#07A4FC] uppercase">
              <Sparkles size={12} className="text-[#18CFFC]" />
              FESTFLOW AWAKENS
            </span>
          </div>

          {/* Massive 3D Dimensional Typography in Sora */}
          <h1
            ref={innerHeadlineRef}
            className="font-display font-black text-[clamp(2.1rem,7.2vw,5.8rem)] leading-[0.98] tracking-tight uppercase mb-4 sm:mb-5 max-w-3xl"
            style={{
              perspective: '1000px',
            }}
          >
            <span className="block text-white drop-shadow-[0_4px_24px_rgba(255,255,255,0.2)]">
              EVERY CAMPUS
            </span>
            <span className="block bg-gradient-to-r from-[#18CFFC] via-[#07A4FC] to-[#7F1AFB] bg-clip-text text-transparent drop-shadow-[0_0_42px_rgba(24,207,252,0.45)]">
              HAS A STORY.
            </span>
          </h1>

          {/* Subline */}
          <p
            ref={innerSublineRef}
            className="font-sans text-sm min-[380px]:text-base sm:text-lg md:text-xl text-zinc-300 font-normal max-w-xl mx-auto leading-relaxed mb-6 sm:mb-8"
          >
            Discover the experiences that bring campuses together.
          </p>

          {/* Dual CTAs */}
          <div
            ref={innerCtaRef}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full sm:w-auto"
          >
            {/* Primary CTA */}
            <Link
              to="/discover"
              className="group relative inline-flex items-center justify-center gap-2.5 px-6 sm:px-8 py-3 sm:py-3.5 rounded-full text-sm sm:text-base font-semibold text-black bg-gradient-to-r from-[#18CFFC] via-[#07A4FC] to-[#7F1AFB] hover:brightness-110 shadow-[0_0_32px_rgba(24,207,252,0.4)] transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] w-full sm:w-auto"
            >
              <Compass size={18} className="text-black transition-transform duration-300 group-hover:rotate-45" />
              <span>Explore Events</span>
              <ArrowRight size={16} className="text-black transition-transform duration-300 group-hover:translate-x-1" />
            </Link>

            {/* Secondary CTA */}
            <button
              type="button"
              onClick={handleEnterUniverse}
              className="group inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3 sm:py-3.5 rounded-full text-sm sm:text-base font-medium text-white bg-[#14141A]/80 hover:bg-[#1C1C24] border border-white/20 hover:border-[#18CFFC]/50 backdrop-blur-md transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] w-full sm:w-auto"
            >
              <span>Enter the Universe</span>
              <ChevronDown size={16} className="text-[#18CFFC] transition-transform duration-300 group-hover:translate-y-0.5" />
            </button>
          </div>
        </div>

        {/* Bottom Scroll Cue */}
        <div className="relative z-10 flex flex-col items-center gap-1.5 text-zinc-400 pb-1">
          <span className="text-[10px] font-mono tracking-widest uppercase text-zinc-500">
            SCROLL TO ENTER WORLD 02
          </span>
          <ChevronDown size={14} className="text-[#18CFFC] animate-bounce" />
        </div>
      </div>
    </section>
  )
}
export default World01TheVoid
