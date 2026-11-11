/**
 * Scene 01 — Brand Intro
 * Black screen → cyan light sweep → logo reveal → wordmark → tagline → headline
 * Full-viewport pinned scene, scroll-scrubbed.
 */
import { useRef, useEffect } from 'react'
import { Link } from 'react-router'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { gsap, ScrollTrigger } from '@/lib/gsap'
import { Logo } from '@/components/ui/Logo'

interface Scene01Props {
  reducedMotion: boolean
}

export function Scene01Intro({ reducedMotion }: Scene01Props) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const beamRef = useRef<HTMLDivElement>(null)
  const logoRef = useRef<HTMLDivElement>(null)
  const taglineRef = useRef<HTMLDivElement>(null)
  const headlineRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)
  const scrollHintRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reducedMotion) return
    const section = sectionRef.current
    if (!section) return

    const ctx = gsap.context(() => {
      // Initial reveal timeline (plays immediately on page load)
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })

      tl.set(overlayRef.current, { opacity: 1 })
        .to(overlayRef.current, { opacity: 0, duration: 0.6, delay: 0.1 })
        .fromTo(
          beamRef.current,
          { scaleX: 0, opacity: 0 },
          { scaleX: 1, opacity: 1, duration: 0.9, ease: 'power2.inOut' },
          0.4
        )
        .fromTo(
          logoRef.current,
          { opacity: 0, y: 24, scale: 0.92 },
          { opacity: 1, y: 0, scale: 1, duration: 0.8 },
          0.8
        )
        .fromTo(
          taglineRef.current,
          { opacity: 0, y: 16, letterSpacing: '0.4em' },
          { opacity: 1, y: 0, letterSpacing: '0.2em', duration: 0.7 },
          1.2
        )
        .fromTo(
          headlineRef.current,
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: 0.8 },
          1.5
        )
        .fromTo(
          ctaRef.current,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.6 },
          1.9
        )
        .fromTo(
          scrollHintRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.5 },
          2.4
        )

      // Scroll-out: as user scrolls away from scene 01, fade the content out
      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: 'bottom top',
        scrub: 1.5,
        onUpdate: (self) => {
          const p = self.progress
          if (p > 0.5) {
            const fade = 1 - (p - 0.5) * 2
            gsap.set([logoRef.current, taglineRef.current, headlineRef.current, ctaRef.current], {
              opacity: Math.max(0, fade),
              y: (1 - fade) * -30,
            })
          }
        },
      })
    }, section)

    return () => ctx.revert()
  }, [reducedMotion])

  return (
    <section
      ref={sectionRef}
      id="scene-intro"
      aria-label="FestFlow introduction"
      className="relative min-h-dvh flex flex-col items-center justify-center overflow-hidden bg-[#08080A] select-none"
    >
      {/* Black overlay for initial fade-in */}
      <div
        ref={overlayRef}
        aria-hidden="true"
        className="absolute inset-0 bg-[#08080A] z-20 pointer-events-none"
      />

      {/* Background: subtle grid */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Radial atmosphere */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(127,26,251,0.14) 0%, rgba(24,207,252,0.07) 55%, transparent 80%)',
        }}
      />

      {/* Cyan horizontal beam */}
      <div
        ref={beamRef}
        aria-hidden="true"
        className="absolute left-0 right-0 h-px pointer-events-none origin-left"
        style={{
          top: '50%',
          background:
            'linear-gradient(90deg, transparent 0%, #18CFFC 20%, #07A4FC 50%, #7F1AFB 80%, transparent 100%)',
          boxShadow: '0 0 24px 4px rgba(24,207,252,0.35)',
          opacity: 0,
        }}
      />

      {/* Content stack */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-3xl mx-auto">
        {/* Logo */}
        <div ref={logoRef} style={{ opacity: 0 }} className="mb-8 sm:mb-10">
          <Logo variant="hero" alt="FestFlow" />
        </div>

        {/* Tagline badge */}
        <div
          ref={taglineRef}
          style={{ opacity: 0 }}
          className="mb-5 sm:mb-6"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-bold tracking-[0.2em] uppercase text-[#18CFFC] border border-[#18CFFC]/30 bg-[#18CFFC]/05">
            ONE PLATFORM · EVERY CAMPUS EVENT
          </span>
        </div>

        {/* Main headline */}
        <div ref={headlineRef} style={{ opacity: 0 }}>
          <h1 className="text-[2rem] sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.08]">
            Discover.{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #18CFFC 0%, #07A4FC 40%, #7F1AFB 80%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Organize.
            </span>
            <br />
            Experience.
          </h1>
          <p className="mt-5 sm:mt-6 text-sm sm:text-base md:text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed">
            The modern event platform built for college clubs and students.
            Zero fees. Instant QR entry. Real-time payment verification.
          </p>
        </div>

        {/* CTAs */}
        <div
          ref={ctaRef}
          style={{ opacity: 0 }}
          className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-3 w-full max-w-sm mx-auto"
        >
          <Link
            to="/discover"
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] min-h-[48px]"
            style={{
              background: 'linear-gradient(135deg, #18CFFC 0%, #0D56FB 60%, #7F1AFB 100%)',
              boxShadow: '0 4px 24px rgba(24,207,252,0.35)',
            }}
          >
            Explore Events
            <ArrowRight size={15} />
          </Link>
          <Link
            to="/club/signup"
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm text-white border border-white/15 bg-white/05 hover:bg-white/10 hover:border-white/25 transition-all duration-200 min-h-[48px]"
          >
            Launch a Club
          </Link>
        </div>
      </div>

      {/* Scroll hint */}
      <div
        ref={scrollHintRef}
        style={{ opacity: 0 }}
        className="absolute bottom-8 sm:bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-none"
        aria-hidden="true"
      >
        <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-semibold">
          Scroll
        </span>
        <ChevronDown
          size={18}
          className="text-zinc-600 animate-bounce"
          style={{ animationDuration: '1.8s' }}
        />
      </div>
    </section>
  )
}

