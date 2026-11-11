/**
 * Scene 09 — Final Climax CTA
 * "YOUR CAMPUS. YOUR FLOW."
 * Sub: "ONE PLATFORM. EVERY CAMPUS EVENT."
 * Grand finale with brand emblem, dual high-impact call to action, and quick explore portal.
 */
import { useRef, useEffect } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Sparkles, Building2, Compass, ShieldCheck } from 'lucide-react'
import { gsap } from '@/lib/gsap'
import { Logo } from '@/components/ui/Logo'

interface Scene09Props {
  reducedMotion: boolean
}

export function Scene09Final({ reducedMotion }: Scene09Props) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const logoRef = useRef<HTMLDivElement>(null)
  const headlineRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const badgesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top 75%',
          toggleActions: 'play none none reverse',
        },
      })

      tl.fromTo(
        logoRef.current,
        { opacity: 0, scale: 0.8, y: 30 },
        { opacity: 1, scale: 1, y: 0, duration: reducedMotion ? 0 : 0.8, ease: 'back.out(1.5)' }
      )
        .fromTo(
          headlineRef.current,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: reducedMotion ? 0 : 0.8, ease: 'power3.out' },
          reducedMotion ? 0 : '-=0.4'
        )
        .fromTo(
          actionsRef.current,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: reducedMotion ? 0 : 0.7, ease: 'power3.out' },
          reducedMotion ? 0 : '-=0.3'
        )
        .fromTo(
          badgesRef.current,
          { opacity: 0 },
          { opacity: 1, duration: reducedMotion ? 0 : 0.6 },
          reducedMotion ? 0 : '-=0.2'
        )
    }, section)

    return () => ctx.revert()
  }, [reducedMotion])

  return (
    <section
      ref={sectionRef}
      id="scene-final"
      aria-labelledby="scene09-heading"
      className="relative py-28 sm:py-36 lg:py-44 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full text-center overflow-hidden"
    >
      {/* Background glow & radial lighting */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] pointer-events-none -z-10"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(24,207,252,0.14) 0%, rgba(127,26,251,0.12) 40%, rgba(237,71,252,0.06) 70%, transparent 85%)',
        }}
      />

      <div
        ref={containerRef}
        className="relative z-10 p-8 sm:p-14 lg:p-16 rounded-[2.5rem] bg-[#0E0E12]/90 border border-white/15 backdrop-blur-xl shadow-[0_32px_100px_rgba(0,0,0,0.9),0_0_50px_rgba(24,207,252,0.20)]"
      >
        {/* Animated perimeter top highlight */}
        <div
          aria-hidden="true"
          className="absolute top-0 left-12 right-12 h-px bg-gradient-to-r from-transparent via-[#18CFFC] to-transparent opacity-80"
        />

        {/* Brand Emblem */}
        <div ref={logoRef} style={{ opacity: 0 }} className="flex justify-center mb-8">
          <Logo variant="hero" alt="FestFlow Brand" />
        </div>

        {/* Tagline */}
        <div className="mb-4">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-bold tracking-[0.22em] uppercase text-[#18CFFC] bg-[#14141A] border border-[#18CFFC]/30 shadow-[0_0_20px_rgba(24,207,252,0.2)]">
            <Sparkles size={13} className="text-[#18CFFC]" />
            ONE PLATFORM · EVERY CAMPUS EVENT
          </span>
        </div>

        {/* Grand Headline */}
        <div ref={headlineRef} style={{ opacity: 0 }} className="mb-8 max-w-3xl mx-auto">
          <h2
            id="scene09-heading"
            className="text-[2.2rem] sm:text-5xl md:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.08]"
          >
            Your Campus.{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #18CFFC 0%, #07A4FC 30%, #7F1AFB 70%, #ED47FC 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Your Flow.
            </span>
          </h2>
          <p className="mt-5 text-sm sm:text-base md:text-lg text-zinc-300 max-w-xl mx-auto leading-relaxed">
            Join thousands of students and clubs experiencing seamless event discovery, instant registration, zero-fee UPI payments, and sub-second digital pass entry.
          </p>
        </div>

        {/* Dual Primary CTAs */}
        <div
          ref={actionsRef}
          style={{ opacity: 0 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-stretch max-w-md mx-auto mb-10"
        >
          <Link
            to="/discover"
            className="flex-1 inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl font-bold text-sm text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] min-h-[52px]"
            style={{
              background: 'linear-gradient(135deg, #18CFFC 0%, #0D56FB 60%, #7F1AFB 100%)',
              boxShadow: '0 8px 30px rgba(24,207,252,0.40)',
            }}
          >
            <Compass size={17} />
            <span>Explore Events</span>
            <ArrowRight size={16} />
          </Link>

          <Link
            to="/club/signup"
            className="flex-1 inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl font-bold text-sm text-white border border-white/20 bg-white/05 hover:bg-white/10 hover:border-white/35 transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] min-h-[52px]"
          >
            <Building2 size={17} className="text-[#ED47FC]" />
            <span>Organize an Event</span>
          </Link>
        </div>

        {/* Trust Badges */}
        <div
          ref={badgesRef}
          style={{ opacity: 0 }}
          className="pt-8 border-t border-white/10 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs text-zinc-400 font-medium"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck size={15} className="text-[#18CFFC]" />
            <span>0% Platform Commission</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Sub-Second Gate Scanner</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#ED47FC]">✦</span>
            <span>Direct UPI Club Settlement</span>
          </div>
        </div>
      </div>
    </section>
  )
}

