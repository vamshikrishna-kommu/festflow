/**
 * Scene 08 — Connected Ecosystem
 * "STUDENTS. CLUBS. EVENTS."
 * Platform convergence: Three nodes (Students, Clubs, Events) connected by glowing energetic lines
 * demonstrating how FestFlow unites the entire campus ecosystem into one fluid rhythm.
 */
import { useRef, useEffect } from 'react'
import { GraduationCap, Building2, Sparkles, Network } from 'lucide-react'
import { gsap } from '@/lib/gsap'

interface Scene08Props {
  reducedMotion: boolean
}

export function Scene08Connected({ reducedMotion }: Scene08Props) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const headlineRef = useRef<HTMLDivElement>(null)
  const networkRef = useRef<HTMLDivElement>(null)
  const lineSvgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const ctx = gsap.context(() => {
      // Headline emergence
      gsap.fromTo(
        headlineRef.current,
        { opacity: 0, y: 35 },
        {
          opacity: 1,
          y: 0,
          duration: reducedMotion ? 0 : 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: section,
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
        }
      )

      // Network container and node stagger
      const nodes = networkRef.current?.querySelectorAll('.ecosystem-node')
      if (nodes && nodes.length > 0) {
        gsap.fromTo(
          Array.from(nodes),
          { opacity: 0, scale: 0.85, y: 30 },
          {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: reducedMotion ? 0 : 0.9,
            stagger: reducedMotion ? 0 : 0.15,
            ease: 'back.out(1.4)',
            scrollTrigger: {
              trigger: networkRef.current,
              start: 'top 75%',
              toggleActions: 'play none none reverse',
            },
          }
        )
      }

      // Connecting SVG lines stroke animation
      const paths = lineSvgRef.current?.querySelectorAll('.connection-line')
      if (paths && paths.length > 0 && !reducedMotion) {
        gsap.fromTo(
          Array.from(paths),
          { strokeDashoffset: 100, opacity: 0 },
          {
            strokeDashoffset: 0,
            opacity: 0.7,
            duration: 1.2,
            stagger: 0.2,
            ease: 'power2.inOut',
            scrollTrigger: {
              trigger: networkRef.current,
              start: 'top 70%',
              toggleActions: 'play none none reverse',
            },
          }
        )
      }
    }, section)

    return () => ctx.revert()
  }, [reducedMotion])

  return (
    <section
      ref={sectionRef}
      id="scene-connected"
      aria-labelledby="scene08-heading"
      className="relative py-24 sm:py-32 lg:py-40 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full overflow-hidden"
    >
      {/* Dynamic ambient energy glow */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[550px] pointer-events-none -z-10"
        style={{
          background:
            'radial-gradient(ellipse 65% 55% at 50% 50%, rgba(24,207,252,0.08) 0%, rgba(127,26,251,0.08) 50%, transparent 75%)',
        }}
      />

      {/* Header */}
      <div ref={headlineRef} style={{ opacity: 0 }} className="text-center mb-16 sm:mb-20">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] uppercase tracking-[0.25em] font-bold text-[#18CFFC] bg-[#14141A] border border-[#18CFFC]/30 mb-4 shadow-[0_0_15px_rgba(24,207,252,0.15)]">
          <Network size={12} className="text-[#18CFFC]" />
          Unified Ecosystem
        </span>
        <h2
          id="scene08-heading"
          className="text-[2rem] sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]"
        >
          Students. Clubs.{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #18CFFC 0%, #07A4FC 30%, #7F1AFB 70%, #ED47FC 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Events.
          </span>
        </h2>
        <p className="mt-4 text-sm sm:text-base text-zinc-400 max-w-xl mx-auto leading-relaxed">
          One continuous loop. When clubs publish, students discover. When students register, verification happens instantly. When event day arrives, queues vanish.
        </p>
      </div>

      {/* Convergence Graphic / Interactive Node Map */}
      <div
        ref={networkRef}
        className="relative max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 md:gap-4 my-8"
      >
        {/* SVG Connecting Beam for Desktop */}
        <svg
          ref={lineSvgRef}
          aria-hidden="true"
          className="hidden md:block absolute top-1/2 left-0 w-full -translate-y-1/2 pointer-events-none -z-10 h-28"
          viewBox="0 0 800 100"
          fill="none"
        >
          <path
            className="connection-line"
            d="M 120 50 Q 260 20, 400 50 T 680 50"
            stroke="url(#gradient-line-1)"
            strokeWidth="2.5"
            strokeDasharray="6 6"
            strokeLinecap="round"
          />
          <path
            className="connection-line"
            d="M 120 50 Q 260 80, 400 50 T 680 50"
            stroke="url(#gradient-line-2)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="gradient-line-1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#18CFFC" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#7F1AFB" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ED47FC" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="gradient-line-2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#07A4FC" stopOpacity="0.5" />
              <stop offset="50%" stopColor="#0D56FB" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#18CFFC" stopOpacity="0.5" />
            </linearGradient>
          </defs>
        </svg>

        {/* Node 1: Students */}
        <div className="ecosystem-node w-full md:w-[260px] p-6 rounded-2xl bg-[#0E0E12] border border-[#18CFFC]/25 shadow-[0_16px_40px_rgba(0,0,0,0.6),0_0_24px_rgba(24,207,252,0.12)] text-center relative group hover:border-[#18CFFC]/60 transition-all duration-300">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#18CFFC]/10 border border-[#18CFFC]/30 flex items-center justify-center text-[#18CFFC] group-hover:scale-110 transition-transform duration-300 shadow-[0_0_20px_rgba(24,207,252,0.25)]">
            <GraduationCap size={28} />
          </div>
          <span className="text-[10px] font-mono tracking-widest text-[#18CFFC] font-bold uppercase block mb-1">
            01 · PARTICIPANT
          </span>
          <h3 className="text-base font-bold text-white mb-2">Student Community</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Zero app friction. Discover events, invite team members, verify payments, and keep offline QR passes ready.
          </p>
        </div>

        {/* Central Core: The Platform Engine */}
        <div className="ecosystem-node w-full md:w-[270px] p-6 rounded-3xl bg-gradient-to-b from-[#14141A] to-[#0A0A0E] border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(127,26,251,0.25)] text-center relative group scale-105 z-10">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-[#18CFFC] via-[#0D56FB] to-[#7F1AFB] p-0.5 shadow-[0_0_30px_rgba(127,26,251,0.5)]">
            <div className="w-full h-full bg-[#08080A] rounded-[14px] flex items-center justify-center text-[#18CFFC]">
              <Sparkles size={30} className="animate-pulse" />
            </div>
          </div>
          <span className="text-[10px] font-mono tracking-widest text-[#ED47FC] font-bold uppercase block mb-1">
            FESTFLOW OS
          </span>
          <h3 className="text-lg font-black text-white mb-2">Automated Core</h3>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Direct UPI settlements, instant audit trails, real-time ticket invalidation, and sub-second attendance telemetry.
          </p>
        </div>

        {/* Node 3: Clubs & Organizers */}
        <div className="ecosystem-node w-full md:w-[260px] p-6 rounded-2xl bg-[#0E0E12] border border-[#ED47FC]/25 shadow-[0_16px_40px_rgba(0,0,0,0.6),0_0_24px_rgba(237,71,252,0.12)] text-center relative group hover:border-[#ED47FC]/60 transition-all duration-300">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#ED47FC]/10 border border-[#ED47FC]/30 flex items-center justify-center text-[#ED47FC] group-hover:scale-110 transition-transform duration-300 shadow-[0_0_20px_rgba(237,71,252,0.25)]">
            <Building2 size={28} />
          </div>
          <span className="text-[10px] font-mono tracking-widest text-[#ED47FC] font-bold uppercase block mb-1">
            02 · ORGANIZER
          </span>
          <h3 className="text-base font-bold text-white mb-2">Campus Clubs</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Create events in 5 minutes, track revenue transparently, scan entry gates, and export complete post-fest reports.
          </p>
        </div>
      </div>
    </section>
  )
}

