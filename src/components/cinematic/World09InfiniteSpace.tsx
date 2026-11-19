/**
 * FESTFLOW CINEMATIC 4.0 — WORLD 09: THE INFINITE EVENT SPACE
 * Headline: "The Infinite Event Space"
 * Subtitle: "Massive Architectural Convergence of Floating Event Portals"
 *
 * Core Features:
 * - Monumental dimensional typography reveals interacting with scroll:
 *   "DISCOVER." — "CONNECT." — "CREATE." — "EXPERIENCE."
 * - Floating architectural convergence portals representing diverse campus realms:
 *   Technical, Cultural, Innovation, and Performing Arts.
 * - Atmospheric ambient lighting with dynamic cyan/violet chromatic sweep.
 * - Pinned bidirectional GSAP ScrollTrigger timeline with perspective transforms.
 * - Accessible reduced-motion fallback.
 */
import { useRef, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { gsap } from '@/lib/motion'
import { type SceneProps } from './CinematicShared'

const DIMENSIONAL_WORDS = [
  {
    word: 'DISCOVER.',
    subtitle: 'Uncover untapped collegiate workshops, technical symposia, and midnight hackathons.',
    accent: '#18CFFC',
    gradient: 'from-[#18CFFC] via-[#07A4FC] to-white',
    shadow: 'rgba(24, 207, 252, 0.4)',
    realm: 'TECHNICAL REALMS',
    portalCount: '450+ Events',
  },
  {
    word: 'CONNECT.',
    subtitle: 'Form cross-campus squads, discover teammates, and unite student societies.',
    accent: '#07A4FC',
    gradient: 'from-[#07A4FC] via-[#0D56FB] to-[#7F1AFB]',
    shadow: 'rgba(7, 164, 252, 0.4)',
    realm: 'COLLEGIATE SQUADS',
    portalCount: '180+ Chapters',
  },
  {
    word: 'CREATE.',
    subtitle: 'Ship autonomous prototypes, compose soundtracks, and design the future.',
    accent: '#7F1AFB',
    gradient: 'from-[#7F1AFB] via-[#ED47FC] to-[#18CFFC]',
    shadow: 'rgba(127, 26, 251, 0.4)',
    realm: 'INNOVATION PODS',
    portalCount: '1,200+ Projects',
  },
  {
    word: 'EXPERIENCE.',
    subtitle: 'Stand at the center of packed auditoriums illuminated by electric stage lights.',
    accent: '#ED47FC',
    gradient: 'from-[#ED47FC] via-[#ED47FC] to-[#18CFFC]',
    shadow: 'rgba(237, 71, 252, 0.4)',
    realm: 'MAIN AUDITORIUM',
    portalCount: '28,000+ FastPasses',
  },
] as const

export function World09InfiniteSpace({
  reducedMotion,
  id = 'world-09-infinite',
  className = '',
}: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pinStageRef = useRef<HTMLDivElement>(null)
  const wordRefs = useRef<(HTMLDivElement | null)[]>([])
  const portalCardsRef = useRef<HTMLDivElement>(null)
  const lightSweepRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const pinStage = pinStageRef.current
    if (!container || !pinStage || reducedMotion) return

    const words = wordRefs.current.filter(Boolean) as HTMLDivElement[]
    if (words.length === 0) return

    const ctx = gsap.context(() => {
      // Baseline setup
      words.forEach((w, idx) => {
        if (idx === 0) {
          gsap.set(w, { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' })
        } else {
          gsap.set(w, { opacity: 0, scale: 0.85, y: 40, filter: 'blur(10px)' })
        }
      })

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: 'top top',
          end: `+=${DIMENSIONAL_WORDS.length * 100}%`,
          pin: pinStage,
          scrub: 0.4,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      })

      // Chromatic sweep animation
      if (lightSweepRef.current) {
        tl.to(
          lightSweepRef.current,
          {
            backgroundPosition: '100% 100%',
            ease: 'none',
          },
          0
        )
      }

      // Step-by-step dimensional typography transitions
      for (let i = 0; i < words.length - 1; i++) {
        const cur = words[i]
        const nxt = words[i + 1]

        tl.to(
          cur,
          {
            opacity: 0,
            scale: 1.15,
            y: -40,
            filter: 'blur(12px)',
            duration: 0.35,
            ease: 'power2.in',
          },
          i + 0.65
        ).fromTo(
          nxt,
          { opacity: 0, scale: 0.85, y: 40, filter: 'blur(10px)' },
          {
            opacity: 1,
            scale: 1,
            y: 0,
            filter: 'blur(0px)',
            duration: 0.35,
            ease: 'power2.out',
          },
          i + 0.75
        )
      }

      // Final hold
      tl.to({}, { duration: 0.4 })
    }, container)

    return () => ctx.revert()
  }, [reducedMotion])

  return (
    <section
      ref={containerRef}
      id={id}
      aria-label="World 09: The Infinite Event Space"
      className={`relative w-full bg-[#08080A] text-white select-none ${className}`}
    >
      {/* ─── REDUCED MOTION FALLBACK ─── */}
      {reducedMotion ? (
        <div className="py-20 px-4 max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-mono font-bold text-[#18CFFC] tracking-widest uppercase bg-[#18CFFC]/10 px-3 py-1 rounded-full border border-[#18CFFC]/20">
              WORLD 09 · THE INFINITE EVENT SPACE
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white mt-4 font-display">
              The Infinite Event Space.
            </h2>
            <p className="text-zinc-400 text-sm max-w-xl mx-auto mt-2 font-body">
              Massive architectural convergence where campus events, students, and collegiate chapters intersect.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {DIMENSIONAL_WORDS.map((item, i) => (
              <div
                key={i}
                className="rounded-2xl bg-[#0E0E12] border border-white/10 p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-[10px] font-mono font-bold tracking-wider uppercase"
                      style={{ color: item.accent }}
                    >
                      {item.realm}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {item.portalCount}
                    </span>
                  </div>
                  <h3
                    className="text-4xl sm:text-5xl font-black font-display tracking-tight leading-none mb-3"
                    style={{ color: item.accent }}
                  >
                    {item.word}
                  </h3>
                  <p className="text-sm text-zinc-300 font-body leading-relaxed">
                    {item.subtitle}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ─── FULL PINNED GSAP STAGE ─── */
        <div
          ref={pinStageRef}
          className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden"
        >
          {/* Dynamic Chromatic Sweep Backlight */}
          <div
            ref={lightSweepRef}
            aria-hidden="true"
            className="absolute inset-0 opacity-25 pointer-events-none transition-all duration-700"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, rgba(24,207,252,0.2) 0%, rgba(127,26,251,0.25) 50%, rgba(8,8,10,0.95) 100%)',
              backgroundSize: '200% 200%',
              backgroundPosition: '0% 0%',
            }}
          />

          {/* Badge */}
          <div className="relative z-10 mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-bold text-[#18CFFC] bg-[#14141A] border border-[#18CFFC]/30 shadow-lg">
              <Sparkles size={12} className="text-[#18CFFC]" />
              <span>WORLD 09 · ARCHITECTURAL CONVERGENCE</span>
            </div>
          </div>

          {/* Central Dimensional Typography Portals */}
          <div className="relative z-10 w-full max-w-4xl h-[260px] sm:h-[300px] flex items-center justify-center">
            {DIMENSIONAL_WORDS.map((item, idx) => (
              <div
                key={item.word}
                ref={(el) => {
                  wordRefs.current[idx] = el
                }}
                className="absolute inset-0 flex flex-col items-center justify-center text-center px-4"
                style={{ willChange: 'opacity, transform, filter' }}
              >
                <div className="inline-flex items-center gap-2 mb-2">
                  <span
                    className="text-[10px] sm:text-xs font-mono font-bold tracking-widest uppercase"
                    style={{ color: item.accent }}
                  >
                    {item.realm}
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-[10px] sm:text-xs font-mono text-zinc-400">
                    {item.portalCount}
                  </span>
                </div>

                <h2
                  className="text-5xl min-[480px]:text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black font-display tracking-tighter leading-none"
                  style={{
                    background: `linear-gradient(135deg, ${item.accent} 0%, #FFFFFF 70%, ${item.accent} 100%)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    filter: `drop-shadow(0 0 35px ${item.shadow})`,
                  }}
                >
                  {item.word}
                </h2>

                <p className="text-xs sm:text-base md:text-lg text-zinc-300 mt-4 max-w-xl font-body leading-relaxed">
                  {item.subtitle}
                </p>
              </div>
            ))}
          </div>

          {/* Floating Convergence Portals Indicator */}
          <div
            ref={portalCardsRef}
            className="relative z-10 mt-8 flex items-center gap-2 sm:gap-3 flex-wrap justify-center text-[10px] sm:text-xs font-mono text-zinc-400"
          >
            <span className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#18CFFC]" />
              Tech Hackathons
            </span>
            <span className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#07A4FC]" />
              Cultural Fests
            </span>
            <span className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#7F1AFB]" />
              Autonomous Robotics
            </span>
            <span className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ED47FC]" />
              Venture Pitches
            </span>
          </div>
        </div>
      )}
    </section>
  )
}

