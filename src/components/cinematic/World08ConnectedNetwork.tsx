/**
 * FESTFLOW CINEMATIC 4.0 — WORLD 08: THE CONNECTED CAMPUS NETWORK
 * Headline: "The Connected Campus Network"
 * Subtitle: "A Pan-Campus Infrastructure Interconnecting University Chapters, Societies, and Students"
 *
 * Key Pillars & Architecture:
 * - 4 Core Vision Cards:
 *   1. Zero Platform Fees (0% Commission, 100% direct to student organizers)
 *   2. Direct UPI Settlement (Instant P2P settlement straight to club bank VPA)
 *   3. Cryptographic FastPass (100% tamper-proof dynamic QR verification with offline scanning)
 *   4. Custom Cinema Seating (Dynamic auditorium layouts, multi-tier pricing, live locking)
 * - Network Statistics Ribbon:
 *   - 45+ Universities
 *   - 180+ Chapters
 *   - ₹14.8L+ Direct Student Settlements
 *   - 28,000+ Passes Issued
 * - Bidirectional GSAP ScrollTrigger timeline with scrub and responsive card stagger.
 * - Accessible reduced-motion support.
 */
import { useRef, useEffect } from 'react'
import {
  Percent,
  Zap,
  ShieldCheck,
  Armchair,
  School,
  Users2,
  Ticket,
  Network,
} from 'lucide-react'
import { gsap } from '@/lib/motion'
import { type SceneProps } from './CinematicShared'

const VISION_CARDS = [
  {
    id: 'zero-fees',
    stat: '0%',
    badge: 'ZERO COMMISSIONS',
    title: 'Zero Platform Fees',
    description:
      'FestFlow takes 0% commission. 100% of event registration funds flow directly to student organizers with zero intermediary cuts or hidden deductions.',
    accent: '#18CFFC',
    borderGlow: 'hover:border-[#18CFFC]/50 hover:shadow-[0_0_24px_rgba(24,207,252,0.22)]',
    icon: Percent,
  },
  {
    id: 'direct-settlement',
    stat: 'Instant',
    badge: 'DIRECT UPI P2P',
    title: 'Direct UPI Settlement',
    description:
      'No 7-day payment escrow or payout holds. Funds land straight in the club bank account with automated 12-digit UTR reconciliation and 1-click approvals.',
    accent: '#07A4FC',
    borderGlow: 'hover:border-[#07A4FC]/50 hover:shadow-[0_0_24px_rgba(7,164,252,0.22)]',
    icon: Zap,
  },
  {
    id: 'verifiable-passes',
    stat: '100%',
    badge: 'CRYPTOGRAPHIC PASS',
    title: 'Cryptographic FastPass',
    description:
      'Tamper-proof digital entry passes with encrypted dynamic QR verification, offline scanning mode, and instantaneous gate check-in.',
    accent: '#7F1AFB',
    borderGlow: 'hover:border-[#7F1AFB]/50 hover:shadow-[0_0_24px_rgba(127,26,251,0.22)]',
    icon: ShieldCheck,
  },
  {
    id: 'cinema-seating',
    stat: 'Dynamic',
    badge: 'CINEMA RESERVATION',
    title: 'Custom Cinema Seating',
    description:
      'Visual interactive seat allocation for auditoriums, amphitheaters, and hackathon lab workspaces with real-time seat locking and multi-tier pricing.',
    accent: '#ED47FC',
    borderGlow: 'hover:border-[#ED47FC]/50 hover:shadow-[0_0_24px_rgba(237,71,252,0.22)]',
    icon: Armchair,
  },
] as const

const NETWORK_METRICS = [
  { label: 'Participating Universities', value: '45+', icon: School, accent: '#18CFFC' },
  { label: 'Active Campus Chapters', value: '180+', icon: Users2, accent: '#07A4FC' },
  { label: 'Direct Student Settlements', value: '₹14.8L+', icon: Zap, accent: '#7F1AFB' },
  { label: 'Verified Passes Issued', value: '28,000+', icon: Ticket, accent: '#ED47FC' },
]

export function World08ConnectedNetwork({
  reducedMotion,
  id = 'world-08-network',
  className = '',
}: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || reducedMotion) return

    const cardElements = cardsRef.current?.children
    if (!cardElements || cardElements.length === 0) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: 'top 80%',
          end: 'bottom 60%',
          scrub: 0.3,
          invalidateOnRefresh: true,
        },
      })

      // Header entrance
      tl.fromTo(
        headerRef.current,
        { opacity: 0.3, y: 24 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' },
        0
      )

      // Cards staggered reveal
      tl.fromTo(
        cardElements,
        { opacity: 0.25, y: 32, scale: 0.96 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.7,
          stagger: 0.12,
          ease: 'power2.out',
        },
        0.15
      )

      // Stats ribbon entrance
      tl.fromTo(
        statsRef.current,
        { opacity: 0.3, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' },
        0.45
      )
    }, container)

    return () => ctx.revert()
  }, [reducedMotion])

  return (
    <section
      ref={containerRef}
      id={id}
      aria-label="World 08: The Connected Campus Network"
      className={`relative w-full py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto select-none ${className}`}
    >
      {/* Header Narrative */}
      <div ref={headerRef} className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-bold text-[#18CFFC] bg-[#14141A] border border-[#18CFFC]/30 mb-3">
          <Network size={13} className="text-[#18CFFC]" />
          <span>WORLD 08 · THE CAMPUS NETWORK</span>
        </div>
        <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight font-display">
          The Connected{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #18CFFC 0%, #07A4FC 45%, #7F1AFB 80%, #ED47FC 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Campus Network.
          </span>
        </h2>
        <p className="text-xs sm:text-base text-zinc-400 mt-3 leading-relaxed font-body max-w-2xl mx-auto">
          A unified collegiate web interconnecting autonomous university chapters and student societies. Built for seamless participation, instant direct settlement, and shared culture.
        </p>
      </div>

      {/* 4 Core Vision Cards Grid */}
      <div
        ref={cardsRef}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 mb-16 sm:mb-20"
      >
        {VISION_CARDS.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.id}
              className={`rounded-2xl bg-[#0E0E12]/90 border border-white/10 p-5 sm:p-6 backdrop-blur-md flex flex-col justify-between transition-all duration-300 ${card.borderGlow} group`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span
                    className="text-2xl sm:text-3xl font-black font-mono tracking-tight"
                    style={{ color: card.accent }}
                  >
                    {card.stat}
                  </span>
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                    style={{
                      backgroundColor: `${card.accent}18`,
                      borderColor: `${card.accent}35`,
                      borderWidth: '1px',
                      color: card.accent,
                    }}
                  >
                    <Icon size={18} />
                  </div>
                </div>

                <span
                  className="inline-block text-[9px] font-mono font-bold tracking-wider uppercase mb-1"
                  style={{ color: card.accent }}
                >
                  {card.badge}
                </span>

                <h3 className="text-lg font-bold text-white mb-2 font-display group-hover:text-white transition-colors">
                  {card.title}
                </h3>

                <p className="text-xs text-zinc-400 leading-relaxed font-body">
                  {card.description}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-white/10 flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 group-hover:text-zinc-300 transition-colors">
                <span>FestFlow Core Architecture</span>
                <span className="text-[#18CFFC]">✦</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Network Statistics Ribbon */}
      <div
        ref={statsRef}
        className="rounded-2xl bg-gradient-to-r from-[#0E0E12] via-[#14141A] to-[#0E0E12] border border-white/10 p-6 sm:p-8 backdrop-blur-md shadow-2xl relative overflow-hidden"
      >
        <div className="text-center mb-6">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#18CFFC]">
            PAN-CAMPUS VERIFIED SCALE
          </p>
          <h3 className="text-lg sm:text-2xl font-black text-white mt-1 font-display">
            The Numbers Powering Campus Events
          </h3>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
          {NETWORK_METRICS.map((metric, i) => {
            const Icon = metric.icon
            return (
              <div key={i} className="flex flex-col items-center">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-2.5 shadow-sm"
                  style={{
                    backgroundColor: `${metric.accent}15`,
                    borderColor: `${metric.accent}30`,
                    borderWidth: '1px',
                    color: metric.accent,
                  }}
                >
                  <Icon size={18} />
                </div>
                <span
                  className="text-2xl sm:text-3xl font-black font-mono tracking-tight"
                  style={{ color: metric.accent }}
                >
                  {metric.value}
                </span>
                <span className="text-xs text-zinc-400 mt-1 font-medium font-body">
                  {metric.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

