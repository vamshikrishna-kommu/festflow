/**
 * FESTFLOW CINEMATIC 4.0 (FESTFLOW INFINITE)
 * WORLD 04: THE EVENT MULTIVERSE / FOUR DIMENSIONS OF EXPERIENCE
 *
 * Specification:
 * - "The Event Multiverse"
 * - Headline: "Four Dimensions of Experience." in Sora font.
 * - 4 distinct environmental realms:
 *   A. TECHNOLOGY: Futuristic lab, circuits, hardware, robotics demo (Neon Cyan #18CFFC)
 *   B. CULTURE: Amphitheater stage, performance lights, live music, arts (Radiant Magenta #ED47FC)
 *   C. HACKATHON: High-octane coding pods, prototype demos, 36hr sprints (Vibrant Violet #7F1AFB)
 *   D. INNOVATION: Project exhibition, venture pitch, connected devices (Royal Cobalt #0D56FB / Sky Blue #07A4FC)
 * - Interactive tabbed / scrub-driven realm cards with distinctive ambient colors.
 * - Clean reduced-motion handling & full responsiveness (320px to 4K).
 */
import { useRef, useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  Cpu,
  Sparkles,
  Code2,
  Rocket,
  Compass,
  ArrowRight,
  Layers,
  CheckCircle,
} from 'lucide-react'
import { gsap } from '@/lib/gsap'
import { getNavbarOffset, type SceneProps } from './CinematicShared'

export interface MultiverseRealm {
  id: string
  code: string
  name: string
  categorySlug: string
  tagline: string
  description: string
  environment: string
  ambientColor: string
  accentColor: string
  borderColor: string
  glowColor: string
  icon: typeof Cpu
  highlights: string[]
  metrics: { label: string; value: string }[]
  featuredEvent: {
    title: string
    venue: string
    date: string
    passType: string
    badge: string
  }
}

const REALMS: MultiverseRealm[] = [
  {
    id: 'realm-tech',
    code: 'DIMENSION A',
    name: 'TECHNOLOGY',
    categorySlug: 'tech',
    tagline: 'Futuristic Labs, Circuits & Robotics',
    description:
      'Where theory transforms into hardware. Immerse yourself in autonomous rover test tracks, neural edge accelerators, quantum computing lectures, and microchip fabrication labs.',
    environment: 'High-bay testing rigs, oscilloscope arrays, soldering stations, embedded telemetry benches.',
    ambientColor: '#18CFFC',
    accentColor: '#18CFFC',
    borderColor: 'border-[#18CFFC]/40',
    glowColor: 'rgba(24,207,252,0.28)',
    icon: Cpu,
    highlights: ['Autonomous Robotics Demos', 'Embedded Edge AI Workshops', 'Hardware Hack Pits', 'Microcontroller Labs'],
    metrics: [
      { label: 'ANNUAL WORKSHOPS', value: '320+ Sessions' },
      { label: 'HARDWARE PARTICIPANTS', value: '6,400+ Engineers' },
      { label: 'HANDS-ON LABS', value: '98% Practical' },
    ],
    featuredEvent: {
      title: 'Autonomous Rover & Edge AI Summit',
      venue: 'Turing Robotics Arena · North Wing',
      date: 'NOV 18 · 10:00 AM',
      passType: 'FastPass Included',
      badge: 'Hardware Provided',
    },
  },
  {
    id: 'realm-culture',
    code: 'DIMENSION B',
    name: 'CULTURE',
    categorySlug: 'cultural',
    tagline: 'Amphitheater Stages, Performance Lights & Arts',
    description:
      'Where creative expression commands the campus. Electrifying 5,000-seat amphitheater concerts, inter-collegiate dance battles, symphony collectives, and interactive projection installations.',
    environment: 'Motorized line-array sound stages, DMX laser grids, outdoor acoustic amphitheaters, vibrant craft bazaars.',
    ambientColor: '#ED47FC',
    accentColor: '#ED47FC',
    borderColor: 'border-[#ED47FC]/40',
    glowColor: 'rgba(237,71,252,0.28)',
    icon: Sparkles,
    highlights: ['Pro-Nite Live Concerts', 'Inter-Collegiate Dance Battles', 'Symphonic Rock Ensembles', 'Visual Projection Murals'],
    metrics: [
      { label: 'PEAK ATTENDANCE', value: '12,000+ Crowd' },
      { label: 'COMPETING SOCIETIES', value: '45+ Chapters' },
      { label: 'ACOUSTIC STAGES', value: '6 Simultaneous' },
    ],
    featuredEvent: {
      title: 'Vibrance \'26: Grand Amphitheater Carnival',
      venue: 'Open Air Amphitheatre · Central Lawn',
      date: 'NOV 20-22 · 3 Days',
      passType: 'General Access & VIP',
      badge: 'Main Stage Live',
    },
  },
  {
    id: 'realm-hackathon',
    code: 'DIMENSION C',
    name: 'HACKATHON',
    categorySlug: 'hackathons',
    tagline: 'High-Octane Coding Pods & 36hr Sprints',
    description:
      'Where sleepless nights turn into venture-backed prototypes. Continuous 36-hour sprints, midnight code commits, instant peer code reviews, and direct investor demo days.',
    environment: 'Ergonomic developer pods, multi-screen docking rigs, infinite caffeine bars, live commit dashboards.',
    ambientColor: '#7F1AFB',
    accentColor: '#7F1AFB',
    borderColor: 'border-[#7F1AFB]/40',
    glowColor: 'rgba(127,26,251,0.30)',
    icon: Code2,
    highlights: ['36h Midnight Sprint', '₹10L+ National Prize Pools', 'Direct Seed VC Tables', 'Zero-Latency API Mentors'],
    metrics: [
      { label: 'ACTIVE BUILDERS', value: '850+ Hackers' },
      { label: 'SHIPPED PROTOTYPES', value: '142 Apps' },
      { label: 'ACCEPTED SUBMISSIONS', value: '100% On-Chain' },
    ],
    featuredEvent: {
      title: 'HackSphere 2026: 36h National Championship',
      venue: 'Centennial Tech Hub · Level 3',
      date: 'NOV 12-14 · 36 Hours',
      passType: 'Hacker Pass · Free',
      badge: '₹2.5L Prize Pool',
    },
  },
  {
    id: 'realm-innovation',
    code: 'DIMENSION D',
    name: 'INNOVATION',
    categorySlug: 'innovation',
    tagline: 'Project Exhibition, Venture Pitch & Connected Devices',
    description:
      'Where student research meets institutional capital. Patent showcases, clean energy microgrids, student founder venture pitches, and alumni angel demo days.',
    environment: 'Modular project exhibition booths, institutional boardroom presentation theaters, angel demo stages.',
    ambientColor: '#07A4FC',
    accentColor: '#0D56FB',
    borderColor: 'border-[#07A4FC]/40',
    glowColor: 'rgba(7,164,252,0.28)',
    icon: Rocket,
    highlights: ['Institutional Pitch Arena', 'Clean Tech Microgrid Demos', 'Patented Deep-Tech Displays', 'Alumni Angel Funding'],
    metrics: [
      { label: 'SEED CAPITAL FUNDED', value: '₹45L+ Raised' },
      { label: 'INCUBATED STARTUPS', value: '48 Teams' },
      { label: 'INSTITUTIONAL MENTORS', value: '35+ Angels' },
    ],
    featuredEvent: {
      title: 'Collegiate Venture Demo & Angel Showcase',
      venue: 'Executive Innovation Center · Tower 1',
      date: 'NOV 28 · 02:00 PM',
      passType: 'Founder & Investor Access',
      badge: 'Direct Seed Review',
    },
  },
]

export function World04EventMultiverse({
  reducedMotion,
  className = '',
  id = 'world-04-multiverse',
}: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pinTargetRef = useRef<HTMLDivElement>(null)
  const [activeRealmIndex, setActiveRealmIndex] = useState(0)

  // Layout refs
  const headerRef = useRef<HTMLDivElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const contentStageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const pinTarget = pinTargetRef.current
    if (!container || !pinTarget) return

    const ctx = gsap.context(() => {
      if (reducedMotion) {
        gsap.set([headerRef.current, tabsRef.current, contentStageRef.current], {
          opacity: 1,
          y: 0,
        })
        return
      }

      // Entrance animation
      gsap.fromTo(
        headerRef.current,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: container,
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
        }
      )

      // Scrub timeline to cycle through realms
      gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: () => `top ${getNavbarOffset()}`,
          end: '+=120%',
          scrub: 0.6,
          pin: pinTarget,
          pinSpacing: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const progress = self.progress
            const index = Math.min(3, Math.floor(progress * 4))
            setActiveRealmIndex(index)
          },
        },
      })
    }, container)

    return () => ctx.revert()
  }, [reducedMotion])

  const activeRealm = REALMS[activeRealmIndex]
  const ActiveIcon = activeRealm.icon

  return (
    <section
      ref={containerRef}
      id={id}
      aria-label="World 04: The Event Multiverse - Four Dimensions of Experience"
      className={`relative w-full bg-[#08080A] text-white overflow-x-clip select-none ${className}`}
    >
      <div
        ref={pinTargetRef}
        className="relative w-full min-h-[calc(100dvh-65px)] sm:min-h-[calc(100dvh-73px)] flex flex-col justify-between px-4 sm:px-6 md:px-10 pt-4 sm:pt-6 pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-6 overflow-hidden"
      >
        {/* Dynamic Multiverse Ambient Backdrop */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none -z-20 overflow-hidden">
          {/* Radial aura that changes color with the active realm */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[750px] md:w-[1000px] h-[500px] sm:h-[750px] md:h-[1000px] rounded-full blur-[140px] opacity-25 transition-colors duration-700 pointer-events-none"
            style={{ backgroundColor: activeRealm.ambientColor }}
          />

          {/* Multiverse geometric lines */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.4) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        {/* Top Header */}
        <div ref={headerRef} className="relative z-10 w-full max-w-6xl mx-auto flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] sm:text-xs font-mono font-medium tracking-[0.18em] uppercase text-[#18CFFC] bg-[#14141A]/90 border border-[#18CFFC]/35 backdrop-blur-md shadow-[0_0_20px_rgba(24,207,252,0.18)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#18CFFC] animate-ping" />
              <span>WORLD 04 · EVENT MULTIVERSE</span>
            </div>

            <div className="flex items-center gap-2 text-[10px] sm:text-xs font-mono text-zinc-400">
              <Layers size={13} style={{ color: activeRealm.ambientColor }} />
              <span className="hidden sm:inline">REALM:</span>
              <span className="font-bold text-white">{activeRealm.code}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-white/10 pb-3">
            <div>
              <p className="text-xs sm:text-sm font-mono tracking-wider uppercase mb-1" style={{ color: activeRealm.ambientColor }}>
                The Event Multiverse
              </p>
              <h2 className="font-display font-black text-2xl sm:text-4xl md:text-5xl text-white tracking-tight uppercase">
                Four Dimensions of Experience.
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-sm font-sans">
              From hardware pits to pro-nite amphitheaters, every passion finds its orbit on FestFlow.
            </p>
          </div>
        </div>

        {/* Dimension Realm Tabs */}
        <div ref={tabsRef} className="relative z-10 w-full max-w-6xl mx-auto my-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {REALMS.map((realm, idx) => {
              const isSelected = idx === activeRealmIndex
              const Icon = realm.icon
              return (
                <button
                  key={realm.id}
                  type="button"
                  onClick={() => setActiveRealmIndex(idx)}
                  className={`group relative flex items-center gap-2.5 p-2 sm:p-3 rounded-xl border text-left transition-all duration-300 ${
                    isSelected
                      ? 'bg-[#14141A] border-white/40 shadow-[0_0_24px_rgba(0,0,0,0.6)]'
                      : 'bg-[#0E0E12]/80 border-white/10 hover:border-white/20 hover:bg-[#14141A]/60'
                  }`}
                >
                  <div
                    className="p-1.5 rounded-lg shrink-0 transition-transform duration-300 group-hover:scale-110"
                    style={{
                      backgroundColor: `${realm.ambientColor}18`,
                      color: realm.ambientColor,
                    }}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[9px] font-mono tracking-wider text-zinc-400 uppercase truncate">
                      {realm.code}
                    </span>
                    <span className="block text-xs sm:text-sm font-bold text-white truncate font-display">
                      {realm.name}
                    </span>
                  </div>
                  {isSelected && (
                    <span
                      className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                      style={{ backgroundColor: realm.ambientColor }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Main Dimension Display (Active Realm) */}
        <div
          ref={contentStageRef}
          className="relative z-10 w-full max-w-6xl mx-auto my-auto grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-center"
        >
          {/* Left: Realm Overview & Specs (7 cols) */}
          <div className="lg:col-span-7 rounded-2xl bg-[#0E0E14] border border-white/20 p-5 sm:p-7 flex flex-col justify-between shadow-2xl relative overflow-hidden">
            {/* Top Accent Line */}
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ backgroundColor: activeRealm.ambientColor }}
            />

            <div>
              {/* Realm Header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-zinc-400">
                  {activeRealm.code} · ENVIRONMENTAL DOMAIN
                </span>
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium tracking-wide border"
                  style={{
                    backgroundColor: `${activeRealm.ambientColor}18`,
                    color: activeRealm.ambientColor,
                    borderColor: `${activeRealm.ambientColor}50`,
                  }}
                >
                  ACTIVE ORBIT
                </span>
              </div>

              {/* Title & Tagline */}
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center border shrink-0"
                  style={{
                    backgroundColor: `${activeRealm.ambientColor}18`,
                    borderColor: `${activeRealm.ambientColor}50`,
                    color: activeRealm.ambientColor,
                  }}
                >
                  <ActiveIcon size={20} />
                </div>
                <div>
                  <h3 className="font-display font-black text-2xl sm:text-3xl text-white">
                    {activeRealm.name}
                  </h3>
                  <p className="text-xs sm:text-sm font-mono" style={{ color: activeRealm.ambientColor }}>
                    {activeRealm.tagline}
                  </p>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs sm:text-sm text-zinc-300 font-sans leading-relaxed my-3">
                {activeRealm.description}
              </p>

              {/* Highlights Chips */}
              <div className="my-3">
                <span className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-2">
                  REALM CAPABILITIES & EXPERIENCES
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {activeRealm.highlights.map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-sans bg-[#14141A] border border-white/10 text-zinc-200"
                    >
                      <CheckCircle size={11} style={{ color: activeRealm.ambientColor }} />
                      <span>{item}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-2.5 my-4 pt-3 border-t border-white/10">
                {activeRealm.metrics.map((m, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-[#14141A] border border-white/10 text-center">
                    <span className="block text-[8px] sm:text-[9px] font-mono text-zinc-400 uppercase">
                      {m.label}
                    </span>
                    <span className="block text-xs sm:text-sm font-bold text-white font-mono mt-0.5">
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA: Link to explore category */}
            <div className="pt-2 flex items-center justify-between">
              <Link
                to={`/discover?category=${activeRealm.categorySlug}`}
                className="group inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-black transition-all duration-300 hover:scale-[1.02]"
                style={{
                  backgroundColor: activeRealm.ambientColor,
                  boxShadow: `0 0 20px ${activeRealm.glowColor}`,
                }}
              >
                <span>Explore {activeRealm.name} Events</span>
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </Link>

              <span className="text-[11px] font-mono text-zinc-500">
                Scroll to cycle dimensions
              </span>
            </div>
          </div>

          {/* Right: Featured Realm Event Showcase Card (5 cols) */}
          <div className="lg:col-span-5 rounded-2xl bg-[#0D0D12] border border-white/20 p-5 sm:p-6 flex flex-col justify-between shadow-2xl relative">
            <div>
              <div className="flex items-center justify-between mb-3 text-[10px] font-mono">
                <span className="text-zinc-400">FEATURED REALM SHOWCASE</span>
                <span
                  className="px-2 py-0.5 rounded-full font-bold"
                  style={{
                    backgroundColor: `${activeRealm.ambientColor}20`,
                    color: activeRealm.ambientColor,
                  }}
                >
                  {activeRealm.featuredEvent.badge}
                </span>
              </div>

              {/* Event Card Header */}
              <h4 className="font-display font-bold text-lg sm:text-xl text-white mb-2">
                {activeRealm.featuredEvent.title}
              </h4>

              {/* Environment context */}
              <div className="p-3 rounded-xl bg-[#14141A] border border-white/10 mb-4">
                <span className="block text-[9px] font-mono text-zinc-400 uppercase mb-1">
                  PHYSICAL ENVIRONMENT
                </span>
                <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                  {activeRealm.environment}
                </p>
              </div>

              {/* Event Details */}
              <div className="space-y-2 mb-4 text-xs font-mono">
                <div className="flex items-center justify-between text-zinc-300">
                  <span className="text-zinc-400">VENUE:</span>
                  <span className="font-bold">{activeRealm.featuredEvent.venue}</span>
                </div>
                <div className="flex items-center justify-between text-zinc-300">
                  <span className="text-zinc-400">DATE:</span>
                  <span className="font-bold" style={{ color: activeRealm.ambientColor }}>
                    {activeRealm.featuredEvent.date}
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-300">
                  <span className="text-zinc-400">FASTPASS:</span>
                  <span className="text-[#10B981] font-bold">Cryptographically Verified</span>
                </div>
              </div>
            </div>

            {/* Quick action */}
            <Link
              to="/discover"
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300"
            >
              <Compass size={14} />
              <span>Browse All Multiverse Events</span>
            </Link>
          </div>
        </div>

        {/* Bottom Orbit Indicator */}
        <div className="relative z-10 w-full max-w-6xl mx-auto pt-3 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-zinc-400">
          <span>DIMENSIONS: 04 ACTIVE</span>
          <div className="flex items-center gap-1.5">
            {REALMS.map((r, idx) => (
              <span
                key={r.id}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  idx === activeRealmIndex ? 'scale-125' : 'opacity-30'
                }`}
                style={{ backgroundColor: r.ambientColor }}
              />
            ))}
          </div>
          <span className="text-white font-bold">
            DIMENSION 0{activeRealmIndex + 1} / 04
          </span>
        </div>
      </div>
    </section>
  )
}
export default World04EventMultiverse
