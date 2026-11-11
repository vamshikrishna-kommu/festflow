/**
 * FESTFLOW MOBILE FILM 2.0 — SCENE 01: BRAND REVEAL
 *
 * Architectural guarantees:
 * - Entrance timeline (`loadTl`) and ScrollTrigger timeline (`scrollTl`) target separate
 *   nested wrapper refs, eliminating tween contention during early mobile swipes.
 * - Container aligns right beneath sticky Navbar (`start: () => 'top ' + getNavbarOffset()`)
 *   with zero 65px pre-pin shift or BottomNav overlap on 320px-430px viewports.
 * - Fully reversible scrub (scroll down = advance, scroll up = restore) + clean reducedMotion mode.
 */
import { useRef, useEffect } from 'react'
import { Link } from 'react-router'
import { ArrowRight, ChevronDown, Sparkles } from 'lucide-react'
import { gsap } from '@/lib/gsap'
import { Logo } from '@/components/ui/Logo'
import { getNavbarOffset } from './CinematicShared'

interface Scene01Props {
  reducedMotion: boolean
}

export function Scene01BrandReveal({ reducedMotion }: Scene01Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pinTargetRef = useRef<HTMLDivElement>(null)

  // Inner refs owned exclusively by initial entrance animation (loadTl)
  const innerBeamRef = useRef<HTMLDivElement>(null)
  const innerAuraRef = useRef<HTMLDivElement>(null)
  const innerLogoRef = useRef<HTMLDivElement>(null)
  const innerSublineRef = useRef<HTMLDivElement>(null)
  const innerHeadlineRef = useRef<HTMLDivElement>(null)
  const innerCtaRef = useRef<HTMLDivElement>(null)
  const innerCueRef = useRef<HTMLDivElement>(null)

  // Outer refs owned exclusively by bidirectional scroll scrub (scrollTl)
  const scrollBeamRef = useRef<HTMLDivElement>(null)
  const scrollAuraRef = useRef<HTMLDivElement>(null)
  const scrollLogoRef = useRef<HTMLDivElement>(null)
  const scrollCopyRef = useRef<HTMLDivElement>(null)
  const scrollCtaRef = useRef<HTMLDivElement>(null)
  const scrollCueRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const pinTarget = pinTargetRef.current
    if (!container || !pinTarget) return

    const ctx = gsap.context(() => {
      if (reducedMotion) {
        gsap.set(
          [
            innerBeamRef.current,
            innerAuraRef.current,
            innerLogoRef.current,
            innerSublineRef.current,
            innerHeadlineRef.current,
            innerCtaRef.current,
            scrollLogoRef.current,
            scrollCopyRef.current,
            scrollCtaRef.current,
          ],
          { opacity: 1, scale: 1, scaleX: 1, y: 0, clearProps: 'transform' }
        )
        return
      }

      // 1. Snappy, restrained entrance reveal on INNER wrappers only (~1.05s total)
      const loadTl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      loadTl
        .fromTo(innerBeamRef.current, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 0.75, duration: 0.65 })
        .fromTo(innerAuraRef.current, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.75 }, '-=0.45')
        .fromTo(innerLogoRef.current, { opacity: 0, scale: 0.9, y: 14 }, { opacity: 1, scale: 1, y: 0, duration: 0.55 }, '-=0.55')
        .fromTo(innerSublineRef.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.45 }, '-=0.35')
        .fromTo(innerHeadlineRef.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5 }, '-=0.3')
        .fromTo(innerCtaRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4 }, '-=0.25')
        .fromTo(innerCueRef.current, { opacity: 0 }, { opacity: 0.85, duration: 0.35 }, '-=0.2')

      // 2. Bidirectional scroll timeline on OUTER wrappers only (zero contention)
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: () => `top ${getNavbarOffset()}`,
          end: '+=65%',
          scrub: 0.45,
          pin: pinTarget,
          pinSpacing: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      })

      scrollTl
        .to(scrollCueRef.current, { opacity: 0, y: -6, duration: 0.2 }, 0)
        .to(scrollLogoRef.current, { y: -18, scale: 1.04, opacity: 0, duration: 0.5, ease: 'power2.in' }, 0.25)
        .to(scrollCopyRef.current, { y: -22, opacity: 0, duration: 0.45, ease: 'power2.in' }, 0.2)
        .to(scrollCtaRef.current, { y: -16, opacity: 0, duration: 0.4, ease: 'power2.in' }, 0.15)
        .to(scrollBeamRef.current, { opacity: 0, scaleX: 1.2, duration: 0.45 }, 0.3)
        .to(scrollAuraRef.current, { opacity: 0, scale: 1.15, duration: 0.5 }, 0.3)
    }, container)

    return () => ctx.revert()
  }, [reducedMotion])

  return (
    <section
      ref={containerRef}
      id="scene-01-brand"
      aria-label="FestFlow product film introduction"
      className="relative w-full bg-[#08080A] text-white overflow-x-clip select-none"
    >
      <div
        ref={pinTargetRef}
        className="relative w-full h-[calc(100dvh-65px)] sm:h-[calc(100dvh-73px)] flex flex-col items-center justify-between px-4 sm:px-6 pt-3 sm:pt-6 pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-6 overflow-hidden"
      >
        {/* Subtle grid texture */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Ambient radial aura */}
        <div ref={scrollAuraRef} aria-hidden="true" className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div
            ref={innerAuraRef}
            className="w-[300px] sm:w-[480px] md:w-[660px] h-[300px] sm:h-[480px] md:h-[660px] rounded-full"
            style={{
              background:
                'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(24,207,252,0.16) 0%, rgba(127,26,251,0.10) 48%, transparent 75%)',
            }}
          />
        </div>

        {/* Horizontal horizon beam */}
        <div ref={scrollBeamRef} aria-hidden="true" className="absolute left-0 right-0 pointer-events-none" style={{ top: '44%' }}>
          <div
            ref={innerBeamRef}
            className="w-full h-[1.5px] origin-center"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, #18CFFC 25%, #07A4FC 50%, #7F1AFB 75%, transparent 100%)',
              boxShadow: '0 0 20px 2px rgba(24,207,252,0.40)',
            }}
          />
        </div>

        {/* Top spacer for vertical balance */}
        <div className="shrink-0 h-1 sm:h-4" aria-hidden="true" />

        {/* Central Brand Composition */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-lg mx-auto w-full">
          {/* Logo Focal Element */}
          <div ref={scrollLogoRef} className="mb-3 min-[360px]:mb-4 sm:mb-7">
            <div ref={innerLogoRef}>
              <Logo
                variant="hero"
                alt="FestFlow Brand Emblem"
                containerClassName="!w-[120px] min-[360px]:!w-[155px] sm:!w-[205px] md:!w-[230px] !p-2 min-[360px]:!p-3 sm:!p-4 !rounded-2xl sm:!rounded-3xl"
              />
            </div>
          </div>

          {/* Supporting Line & Headline */}
          <div ref={scrollCopyRef} className="flex flex-col items-center">
            <div ref={innerSublineRef} className="mb-2 min-[360px]:mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] min-[360px]:text-[10px] sm:text-xs font-mono font-bold tracking-[0.18em] uppercase text-[#18CFFC] bg-[#14141A]/90 border border-[#18CFFC]/30 shadow-[0_0_14px_rgba(24,207,252,0.14)]">
                <Sparkles size={11} className="text-[#18CFFC]" />
                EVENTS MADE EASY
              </span>
            </div>

            <div ref={innerHeadlineRef} className="mb-4 min-[360px]:mb-5 sm:mb-7">
              <h1 className="text-[1.5rem] min-[360px]:text-[1.95rem] sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-[1.06]">
                ONE PLATFORM.
                <br />
                <span
                  style={{
                    background: 'linear-gradient(135deg, #18CFFC 0%, #07A4FC 45%, #7F1AFB 90%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  EVERY CAMPUS EVENT.
                </span>
              </h1>
            </div>
          </div>

          {/* Mobile High-Impact Actions */}
          <div ref={scrollCtaRef} className="w-full max-w-xs mx-auto">
            <div ref={innerCtaRef} className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
              <Link
                to="/discover"
                className="flex items-center justify-center gap-2 px-5 py-2.5 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white transition-transform active:scale-[0.98] min-h-[44px]"
                style={{
                  background: 'linear-gradient(135deg, #18CFFC 0%, #0D56FB 60%, #7F1AFB 100%)',
                  boxShadow: '0 4px 20px rgba(24,207,252,0.28)',
                }}
              >
                <span>Explore Events</span>
                <ArrowRight size={14} />
              </Link>

              <Link
                to="/club/signup"
                className="flex items-center justify-center gap-2 px-5 py-2.5 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white/90 border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.98] transition-all min-h-[44px]"
              >
                <span>Organize an Event</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll Director Indicator — naturally anchored inside safe bottom flow */}
        <div ref={scrollCueRef} aria-hidden="true" className="relative z-10 shrink-0 pt-2">
          <div ref={innerCueRef} className="flex flex-col items-center gap-0.5 pointer-events-none">
            <span className="text-[9px] uppercase tracking-[0.22em] text-zinc-400 font-mono font-bold">
              {reducedMotion ? 'Scroll to Explore' : 'Scroll to Enter Film'}
            </span>
            <ChevronDown size={14} className={`text-[#18CFFC] ${reducedMotion ? '' : 'animate-bounce'}`} />
          </div>
        </div>
      </div>
    </section>
  )
}
