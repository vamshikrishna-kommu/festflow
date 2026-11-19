/**
 * FESTFLOW CINEMATIC 4.0 (FESTFLOW INFINITE)
 * WORLD 02: CAMPUS REVEAL / THE CAMPUS REVEALS ITSELF
 *
 * Specification:
 * - "The Campus Reveals Itself"
 * - Headline: "A Living Collegiate Ecosystem." in Sora font.
 * - Architectural overlays identifying campus nodes:
 *   1. Main Engineering Atrium
 *   2. Open Quadrangle
 *   3. Innovation Labs
 *   4. Cultural Auditorium
 * - Dimensional coordinate tags and architectural stat markers.
 * - Pinned GSAP ScrollTrigger timeline with scrub driving camera narrative & node scanning.
 * - Clean reduced-motion handling & full responsiveness (320px to 4K).
 */
import { useRef, useEffect, useState } from 'react'
import {
  Cpu,
  Sparkles,
  Rocket,
  Music,
  MapPin,
  Crosshair,
  Activity,
  ShieldCheck,
} from 'lucide-react'
import { gsap } from '@/lib/gsap'
import { getNavbarOffset, type SceneProps } from './CinematicShared'

export interface CampusNode {
  id: string
  name: string
  sector: string
  tag: string
  coordinates: string
  elevation: string
  capacity: string
  area: string
  features: string[]
  accentColor: string
  borderColor: string
  glowColor: string
  icon: typeof Cpu
  cameraAngle: string
}

const CAMPUS_NODES: CampusNode[] = [
  {
    id: 'node-atrium',
    name: 'Main Engineering Atrium',
    sector: 'SECTOR 01 · NORTH WING',
    tag: 'Hardware & Mechatronics',
    coordinates: '12.9716° N, 77.5946° E',
    elevation: '+18.5M ATRIUM',
    capacity: '1,400 Students',
    area: '4,200 SQ.M',
    features: ['Autonomous Rover Pits', 'Rapid Prototyping Fabrication', 'High-Bay Mechatronics'],
    accentColor: '#18CFFC',
    borderColor: 'border-[#18CFFC]/40',
    glowColor: 'rgba(24,207,252,0.22)',
    icon: Cpu,
    cameraAngle: 'AZIMUTH 042° · PITCH -12°',
  },
  {
    id: 'node-quad',
    name: 'Open Quadrangle',
    sector: 'SECTOR 02 · CENTRAL PLAZA',
    tag: 'Festivals & Culture',
    coordinates: '12.9721° N, 77.5952° E',
    elevation: '0.0M GROUND MATRIX',
    capacity: '8,500 Students',
    area: '11,000 SQ.M',
    features: ['Inter-College Pro-Nite Stage', 'Acoustic Amphitheater Lawns', 'Interactive Art Installations'],
    accentColor: '#ED47FC',
    borderColor: 'border-[#ED47FC]/40',
    glowColor: 'rgba(237,71,252,0.24)',
    icon: Sparkles,
    cameraAngle: 'AZIMUTH 180° · PITCH -30°',
  },
  {
    id: 'node-labs',
    name: 'Innovation Labs',
    sector: 'SECTOR 03 · TOWER BETA',
    tag: 'AI & Venture Incubation',
    coordinates: '12.9729° N, 77.5939° E',
    elevation: '+36.0M SKY LAB',
    capacity: '650 Builders',
    area: '3,800 SQ.M',
    features: ['24/7 Gigabit Hackathon Pods', 'Institutional Angel Pitch Hub', 'Edge AI Computing Cluster'],
    accentColor: '#07A4FC',
    borderColor: 'border-[#07A4FC]/40',
    glowColor: 'rgba(7,164,252,0.22)',
    icon: Rocket,
    cameraAngle: 'AZIMUTH 310° · PITCH +15°',
  },
  {
    id: 'node-auditorium',
    name: 'Cultural Auditorium',
    sector: 'SECTOR 04 · SOUTH COMPLEX',
    tag: 'Performance & Keynotes',
    coordinates: '12.9708° N, 77.5960° E',
    elevation: '-4.0M SUB-STAGE',
    capacity: '1,800 Reserved Seats',
    area: '5,100 SQ.M',
    features: ['Dolby Atmos Acoustic Array', 'Dynamic Cinema Seating Map', 'Instant FastPass QR Gates'],
    accentColor: '#7F1AFB',
    borderColor: 'border-[#7F1AFB]/40',
    glowColor: 'rgba(127,26,251,0.25)',
    icon: Music,
    cameraAngle: 'AZIMUTH 095° · PITCH -08°',
  },
]

export function World02CampusReveal({
  reducedMotion,
  className = '',
  id = 'world-02-campus',
}: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pinTargetRef = useRef<HTMLDivElement>(null)
  const [activeNodeIndex, setActiveNodeIndex] = useState(0)

  // Overlay HUD refs
  const headerRef = useRef<HTMLDivElement>(null)
  const hudRadarRef = useRef<HTMLDivElement>(null)
  const nodePillsRef = useRef<HTMLDivElement>(null)
  const activeCardRef = useRef<HTMLDivElement>(null)
  const statsRibbonRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const pinTarget = pinTargetRef.current
    if (!container || !pinTarget) return

    const ctx = gsap.context(() => {
      if (reducedMotion) {
        gsap.set(
          [
            headerRef.current,
            hudRadarRef.current,
            nodePillsRef.current,
            activeCardRef.current,
            statsRibbonRef.current,
          ],
          { opacity: 1, y: 0, clearProps: 'transform' }
        )
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

      // Pinned scrub timeline driving campus scanning narrative
      const scrubTl = gsap.timeline({
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
            // Map scroll progress across 4 nodes (0, 1, 2, 3)
            const progress = self.progress
            const index = Math.min(3, Math.floor(progress * 4))
            setActiveNodeIndex(index)
          },
        },
      })

      // Animate radar scanning sweep
      if (hudRadarRef.current) {
        scrubTl.to(
          hudRadarRef.current,
          {
            rotation: 360,
            duration: 1,
            ease: 'none',
          },
          0
        )
      }
    }, container)

    return () => ctx.revert()
  }, [reducedMotion])

  const activeNode = CAMPUS_NODES[activeNodeIndex]
  const NodeIcon = activeNode.icon

  return (
    <section
      ref={containerRef}
      id={id}
      aria-label="World 02: Campus Reveal - A Living Collegiate Ecosystem"
      className={`relative w-full bg-[#08080A] text-white overflow-x-clip select-none ${className}`}
    >
      <div
        ref={pinTargetRef}
        className="relative w-full min-h-[calc(100dvh-65px)] sm:min-h-[calc(100dvh-73px)] flex flex-col justify-between px-4 sm:px-6 md:px-10 pt-4 sm:pt-6 pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-6 overflow-hidden"
      >
        {/* Architectural Grid & Wireframe Backdrop */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none -z-20 overflow-hidden">
          {/* Blueprint Grid */}
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(24,207,252,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(24,207,252,0.35) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          {/* Radial Ambient Glow keyed to current node */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] sm:w-[680px] md:w-[920px] h-[420px] sm:h-[680px] md:h-[920px] rounded-full blur-3xl transition-colors duration-700 pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${activeNode.glowColor} 0%, rgba(8,8,10,0.8) 60%, transparent 80%)`,
            }}
          />

          {/* Architectural HUD Overlay Lines */}
          <div className="absolute inset-x-8 top-16 h-[1px] bg-gradient-to-r from-transparent via-[#18CFFC]/25 to-transparent" />
          <div className="absolute inset-y-16 left-8 w-[1px] bg-gradient-to-b from-transparent via-[#18CFFC]/20 to-transparent hidden lg:block" />
          <div className="absolute inset-y-16 right-8 w-[1px] bg-gradient-to-b from-transparent via-[#18CFFC]/20 to-transparent hidden lg:block" />
        </div>

        {/* Top Header: Badge, World Title, Dimension Coordinates */}
        <div ref={headerRef} className="relative z-10 w-full max-w-6xl mx-auto flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] sm:text-xs font-mono font-medium tracking-[0.18em] uppercase text-[#18CFFC] bg-[#14141A]/90 border border-[#18CFFC]/35 backdrop-blur-md shadow-[0_0_20px_rgba(24,207,252,0.18)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#18CFFC] animate-ping" />
              <span>WORLD 02 · CAMPUS REVEAL</span>
            </div>

            <div className="flex items-center gap-2 text-[10px] sm:text-xs font-mono text-zinc-400">
              <Crosshair size={13} className="text-[#18CFFC]" />
              <span className="hidden sm:inline">TELEMETRY:</span>
              <span className="text-zinc-200">{activeNode.coordinates}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-white/10 pb-3">
            <div>
              <p className="text-xs sm:text-sm font-mono tracking-wider text-[#07A4FC] uppercase mb-1">
                The Campus Reveals Itself
              </p>
              <h2 className="font-display font-black text-2xl sm:text-4xl md:text-5xl text-white tracking-tight uppercase">
                A Living Collegiate Ecosystem.
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-sm font-sans">
              Dynamic physical spaces mapped into a real-time event grid with cryptographic seating and zero platform friction.
            </p>
          </div>
        </div>

        {/* Interactive Node Selector Tabs */}
        <div ref={nodePillsRef} className="relative z-10 w-full max-w-6xl mx-auto my-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {CAMPUS_NODES.map((node, idx) => {
              const isSelected = idx === activeNodeIndex
              const Icon = node.icon
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setActiveNodeIndex(idx)}
                  className={`group relative flex items-center gap-2.5 p-2 sm:p-3 rounded-xl border text-left transition-all duration-300 ${
                    isSelected
                      ? 'bg-[#14141A] border-white/40 shadow-[0_0_24px_rgba(24,207,252,0.2)]'
                      : 'bg-[#0E0E12]/80 border-white/10 hover:border-white/20 hover:bg-[#14141A]/60'
                  }`}
                >
                  <div
                    className="p-1.5 rounded-lg shrink-0 transition-transform duration-300 group-hover:scale-110"
                    style={{
                      backgroundColor: `${node.accentColor}18`,
                      color: node.accentColor,
                    }}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[9px] font-mono tracking-wider text-zinc-400 uppercase truncate">
                      {node.sector.split('·')[0]}
                    </span>
                    <span className="block text-xs sm:text-sm font-bold text-white truncate font-display">
                      {node.name}
                    </span>
                  </div>
                  {isSelected && (
                    <span
                      className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                      style={{ backgroundColor: node.accentColor }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Main Stage: Holographic Blueprint Map + Active Node Telemetry Card */}
        <div className="relative z-10 w-full max-w-6xl mx-auto my-auto grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-center">
          {/* Left: Architectural Blueprint Canvas & Radar Overlay (7 cols) */}
          <div className="lg:col-span-7 relative h-[260px] sm:h-[340px] md:h-[400px] rounded-2xl bg-[#0D0D12] border border-white/15 overflow-hidden p-4 sm:p-6 flex flex-col justify-between">
            {/* Architectural Coordinates HUD */}
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
              <span className="flex items-center gap-1.5 text-[#18CFFC]">
                <Activity size={12} className="animate-pulse" />
                <span>GRID: ALPHA-CAMPUS-MATRIX</span>
              </span>
              <span>{activeNode.cameraAngle}</span>
            </div>

            {/* Simulated 3D Architectural Nodes Projection */}
            <div className="relative flex-1 flex items-center justify-center my-2">
              {/* Spinning Radar Crosshair */}
              <div
                ref={hudRadarRef}
                className="absolute w-44 sm:w-64 h-44 sm:h-64 rounded-full border border-dashed border-white/15 pointer-events-none flex items-center justify-center"
              >
                <div className="w-24 sm:w-36 h-24 sm:h-36 rounded-full border border-white/10" />
                <div className="absolute inset-x-0 h-[1px] bg-white/15" />
                <div className="absolute inset-y-0 w-[1px] bg-white/15" />
              </div>

              {/* 4 Projected Spatial Nodes */}
              <div className="relative w-full h-full max-w-md max-h-56">
                {CAMPUS_NODES.map((node, idx) => {
                  const isSelected = idx === activeNodeIndex
                  // Layout coordinates for 4 nodes
                  const positions = [
                    'top-4 left-6 sm:left-12', // Atrium
                    'top-10 right-6 sm:right-12', // Quad
                    'bottom-6 left-10 sm:left-16', // Labs
                    'bottom-4 right-8 sm:right-16', // Auditorium
                  ]

                  return (
                    <div
                      key={node.id}
                      onClick={() => setActiveNodeIndex(idx)}
                      className={`absolute ${positions[idx]} cursor-pointer group transition-all duration-300 ${
                        isSelected ? 'scale-110 z-20' : 'opacity-65 hover:opacity-100 z-10'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center border transition-all duration-300"
                          style={{
                            backgroundColor: isSelected ? `${node.accentColor}28` : '#14141A',
                            borderColor: isSelected ? node.accentColor : 'rgba(255,255,255,0.2)',
                            boxShadow: isSelected ? `0 0 20px ${node.glowColor}` : 'none',
                          }}
                        >
                          <node.icon size={15} style={{ color: node.accentColor }} />
                        </div>
                        <div className="hidden min-[420px]:block bg-[#08080A]/90 px-2 py-1 rounded-md border border-white/10 backdrop-blur-sm">
                          <span className="block text-[10px] font-bold text-white font-mono leading-none">
                            {node.name.split(' ')[0]}
                          </span>
                          <span className="block text-[8px] font-mono text-zinc-400 leading-none mt-0.5">
                            {node.elevation}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Bottom HUD Bar */}
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 border-t border-white/10 pt-2.5">
              <span className="flex items-center gap-1.5">
                <MapPin size={11} className="text-[#18CFFC]" />
                <span>4 CORE NODES DIGITIZED</span>
              </span>
              <span className="text-zinc-500 font-mono">AUTONOMOUS MAPPING 4.0</span>
            </div>
          </div>

          {/* Right: Active Node Architectural Telemetry Card (5 cols) */}
          <div
            ref={activeCardRef}
            className="lg:col-span-5 rounded-2xl bg-[#0E0E14] border border-white/20 p-5 sm:p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden"
          >
            {/* Ambient accent top beam */}
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ backgroundColor: activeNode.accentColor }}
            />

            <div>
              {/* Header: Sector Tag + Live Node Pill */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase">
                  {activeNode.sector}
                </span>
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium tracking-wide border"
                  style={{
                    backgroundColor: `${activeNode.accentColor}18`,
                    color: activeNode.accentColor,
                    borderColor: `${activeNode.accentColor}50`,
                  }}
                >
                  ACTIVE REVEAL
                </span>
              </div>

              {/* Node Title & Tagline */}
              <div className="flex items-center gap-2.5 mb-1">
                <div
                  className="p-1.5 rounded-lg shrink-0 border"
                  style={{
                    backgroundColor: `${activeNode.accentColor}18`,
                    borderColor: `${activeNode.accentColor}40`,
                    color: activeNode.accentColor,
                  }}
                >
                  <NodeIcon size={18} />
                </div>
                <h3 className="font-display font-black text-xl sm:text-2xl text-white">
                  {activeNode.name}
                </h3>
              </div>
              <p className="text-xs sm:text-sm font-mono text-[#07A4FC] mb-4">
                {activeNode.tag}
              </p>

              {/* Architectural Metrics Grid */}
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                <div className="p-2.5 rounded-xl bg-[#14141A] border border-white/10">
                  <span className="block text-[9px] font-mono text-zinc-400 uppercase">
                    CAPACITY
                  </span>
                  <span className="block text-sm font-bold text-white font-mono mt-0.5">
                    {activeNode.capacity}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#14141A] border border-white/10">
                  <span className="block text-[9px] font-mono text-zinc-400 uppercase">
                    FOOTPRINT
                  </span>
                  <span className="block text-sm font-bold text-white font-mono mt-0.5">
                    {activeNode.area}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#14141A] border border-white/10">
                  <span className="block text-[9px] font-mono text-zinc-400 uppercase">
                    ELEVATION
                  </span>
                  <span className="block text-sm font-bold text-white font-mono mt-0.5">
                    {activeNode.elevation}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#14141A] border border-white/10">
                  <span className="block text-[9px] font-mono text-zinc-400 uppercase">
                    COORDINATE
                  </span>
                  <span className="block text-xs font-bold text-[#18CFFC] font-mono mt-0.5 truncate">
                    {activeNode.coordinates.split(',')[0]}
                  </span>
                </div>
              </div>

              {/* Features List */}
              <div className="space-y-1.5 mb-5">
                <span className="block text-[10px] font-mono text-zinc-400 uppercase tracking-wider mb-1">
                  INFRASTRUCTURE HIGHLIGHTS
                </span>
                {activeNode.features.map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-zinc-300">
                    <ShieldCheck size={13} style={{ color: activeNode.accentColor }} className="shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive hint */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span>Scroll to scan next node</span>
              <span className="text-white font-bold">
                0{activeNodeIndex + 1} / 04
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Architectural Stat Markers Ribbon */}
        <div
          ref={statsRibbonRef}
          className="relative z-10 w-full max-w-6xl mx-auto pt-3 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-center"
        >
          <div>
            <span className="block text-[9px] font-mono uppercase text-zinc-400">
              ELEVATION
            </span>
            <span className="text-xs sm:text-sm font-bold text-white font-mono">
              920M ABOVE MSL
            </span>
          </div>
          <div>
            <span className="block text-[9px] font-mono uppercase text-zinc-400">
              CAMPUS NODES
            </span>
            <span className="text-xs sm:text-sm font-bold text-[#18CFFC] font-mono">
              4 ACTIVE HUBS
            </span>
          </div>
          <div>
            <span className="block text-[9px] font-mono uppercase text-zinc-400">
              TOTAL CAPACITY
            </span>
            <span className="text-xs sm:text-sm font-bold text-[#ED47FC] font-mono">
              12,350 CONCURRENT
            </span>
          </div>
          <div>
            <span className="block text-[9px] font-mono uppercase text-zinc-400">
              INTEGRATION
            </span>
            <span className="text-xs sm:text-sm font-bold text-[#7F1AFB] font-mono">
              100% DIGITIZED
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
export default World02CampusReveal
