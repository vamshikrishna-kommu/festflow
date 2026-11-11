/**
 * FESTFLOW MOBILE FILM 2.0 — SCENE 05: THE FINAL REVEAL
 * Headline: YOUR CAMPUS. YOUR FLOW.
 *
 * Grand finale converging Student Discovery & Club Operations:
 * - Original FestFlow logo as visual focal point with subtle radial atmosphere
 * - Final brand tagline: ONE PLATFORM · EVERY CAMPUS EVENT
 * - Primary conversion CTAs:
 *   - Explore Events -> /discover
 *   - Organize an Event -> /club/signup
 * - Honest feature summary aligned with actual FestFlow implementation
 *
 * Accessibility & Skip-to-Join guarantee:
 * - Entrance reveal finishes in the lower viewport before #scene-05-final
 *   reaches the sticky navbar, ensuring natural scroll reverses cleanly while
 *   Skip-to-Join never lands on an invisible frame.
 */
import { useRef, useEffect } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Compass, Building2, ShieldCheck, Sparkles, Ticket, Wallet } from 'lucide-react'
import { gsap } from '@/lib/gsap'
import { Logo } from '@/components/ui/Logo'

interface Scene05Props {
  reducedMotion: boolean
}

export function Scene05FinalReveal({ reducedMotion }: Scene05Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const logoRef = useRef<HTMLDivElement>(null)
  const sublineRef = useRef<HTMLDivElement>(null)
  const headlineRef = useRef<HTMLDivElement>(null)
  const ctaGroupRef = useRef<HTMLDivElement>(null)
  const badgesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const revealEls = [
      logoRef.current,
      sublineRef.current,
      headlineRef.current,
      ctaGroupRef.current,
      badgesRef.current,
    ].filter(Boolean)

    if (!container) return

    const ctx = gsap.context(() => {
      if (reducedMotion) {
        gsap.set([cardRef.current, ...revealEls], {
          opacity: 1,
          scale: 1,
          y: 0,
        })
        return
      }

      // Bidirectional scroll-linked arrival that completes BEFORE reaching the navbar offset,
      // so Skip-to-Join lands directly on fully visible CTAs at opacity: 1.
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: 'top 92%',
          end: () => `top ${Math.round(window.innerHeight * 0.54)}`,
          scrub: 0.2,
          invalidateOnRefresh: true,
        },
      })

      tl.fromTo(
        cardRef.current,
        { opacity: 0.35, y: 18, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.65, ease: 'power2.out' },
        0
      )
        .fromTo(
          logoRef.current,
          { opacity: 0.4, y: 10, scale: 0.95 },
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
          { opacity: 0.4, y: 10 },
          { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' },
          0.22
        )
        .fromTo(
          ctaGroupRef.current,
          { opacity: 0.45, y: 8 },
          { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
          0.28
        )
        .fromTo(
          badgesRef.current,
          { opacity: 0.45 },
          { opacity: 1, duration: 0.35 },
          0.35
        )
    }, container)

    return () => ctx.revert()
  }, [reducedMotion])

  return (
    <section
      ref={containerRef}
      id="scene-05-final"
      aria-labelledby="scene05-heading"
      className="relative w-full bg-[#08080A] text-white overflow-x-clip select-none"
    >
      <div className="relative w-full min-h-[calc(100dvh-65px)] sm:min-h-[calc(100dvh-73px)] flex flex-col items-center justify-center px-3 min-[360px]:px-4 sm:px-6 pt-3 min-[360px]:pt-6 sm:pt-10 pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-12">
        {/* Dynamic radial lighting atmosphere */}
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[620px] md:w-[820px] h-[300px] sm:h-[620px] md:h-[820px] rounded-full pointer-events-none -z-10"
          style={{
            background:
              'radial-gradient(ellipse 65% 65% at 50% 50%, rgba(24,207,252,0.16) 0%, rgba(127,26,251,0.14) 40%, rgba(237,71,252,0.08) 70%, transparent 85%)',
          }}
        />

        {/* Central Focal Composition */}
        <div
          ref={cardRef}
          className="relative z-10 p-3.5 min-[360px]:p-5 sm:p-9 rounded-[1.5rem] min-[360px]:rounded-[2rem] sm:rounded-[2.4rem] bg-[#0E0E12]/90 border border-white/15 backdrop-blur-xl shadow-[0_24px_72px_rgba(0,0,0,0.94),0_0_36px_rgba(24,207,252,0.16)] max-w-lg mx-auto w-full text-center"
        >
          {/* Top light sweep highlight */}
          <div
            aria-hidden="true"
            className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-[#18CFFC] to-transparent opacity-80"
          />

          {/* Original FestFlow Logo Focal Element */}
          <div ref={logoRef} className="flex justify-center mb-2 min-[360px]:mb-3 sm:mb-5">
            <Logo
              variant="hero"
              alt="FestFlow Final Brand Emblem"
              containerClassName="!w-[88px] min-[360px]:!w-[152px] sm:!w-[200px] md:!w-[220px] !p-1.5 min-[360px]:!p-2.5 sm:!p-3.5 !rounded-xl min-[360px]:!rounded-2xl sm:!rounded-3xl"
            />
          </div>

          {/* Subline Badge */}
          <div ref={sublineRef} className="mb-1.5 min-[360px]:mb-2.5 sm:mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[8px] min-[360px]:text-[9.5px] sm:text-xs font-mono font-bold tracking-[0.14em] sm:tracking-[0.2em] uppercase text-[#18CFFC] bg-[#14141A] border border-[#18CFFC]/30 shadow-[0_0_15px_rgba(24,207,252,0.16)] whitespace-nowrap">
              <Sparkles size={10} className="text-[#18CFFC] shrink-0" />
              ONE PLATFORM · EVERY CAMPUS EVENT
            </span>
          </div>

          {/* Headline */}
          <div ref={headlineRef} className="mb-3 min-[360px]:mb-4 sm:mb-7">
            <h2
              id="scene05-heading"
              className="text-[1.45rem] min-[360px]:text-[1.75rem] sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-[1.06]"
            >
              YOUR CAMPUS.
              <br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #18CFFC 0%, #07A4FC 30%, #7F1AFB 70%, #ED47FC 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                YOUR FLOW.
              </span>
            </h2>
            <p className="mt-1.5 sm:mt-3 text-[10.5px] min-[360px]:text-xs sm:text-sm text-zinc-300 max-w-md mx-auto leading-snug sm:leading-relaxed">
              Event discovery, direct UPI payments, and verified digital passes—built for college clubs and students.
            </p>
          </div>

          {/* Dual Action Conversion Portal */}
          <div
            ref={ctaGroupRef}
            className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center items-stretch max-w-sm mx-auto mb-2.5 min-[360px]:mb-4 sm:mb-6"
          >
            <Link
              to="/discover"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm text-white transition-transform active:scale-[0.98] min-h-[44px] sm:min-h-[48px]"
              style={{
                background: 'linear-gradient(135deg, #18CFFC 0%, #0D56FB 60%, #7F1AFB 100%)',
                boxShadow: '0 6px 24px rgba(24,207,252,0.35)',
              }}
            >
              <Compass size={15} />
              <span>Explore Events</span>
              <ArrowRight size={14} />
            </Link>

            <Link
              to="/club/signup"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm text-white border border-white/20 bg-white/[0.04] hover:bg-white/[0.08] active:scale-[0.98] transition-all min-h-[44px] sm:min-h-[48px]"
            >
              <Building2 size={15} className="text-[#ED47FC]" />
              <span>Organize an Event</span>
            </Link>
          </div>

          {/* Authentic Platform Highlights */}
          <div
            ref={badgesRef}
            className="pt-2 min-[360px]:pt-3 sm:pt-4 border-t border-white/10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:gap-4 text-[8.5px] min-[360px]:text-[9.5px] sm:text-[10px] text-zinc-400 font-mono font-medium"
          >
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={11} className="text-[#18CFFC]" />
              0% Platform Commission
            </span>
            <span className="flex items-center gap-1.5">
              <Ticket size={11} className="text-emerald-400" />
              Verified Digital Passes
            </span>
            <span className="flex items-center gap-1.5">
              <Wallet size={11} className="text-[#ED47FC]" />
              Direct Club UPI Settlement
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
