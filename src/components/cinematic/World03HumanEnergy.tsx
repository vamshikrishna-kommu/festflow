/**
 * FESTFLOW CINEMATIC 4.0 (FESTFLOW INFINITE)
 * WORLD 03: HUMAN ENERGY / CAMPUS COMES ALIVE
 *
 * Specification:
 * - "Human Energy / Campus Comes Alive"
 * - Headline: "The Pulse of Student Ambition." in Sora font.
 * - Communicates human presence, collaboration, curiosity, and celebration:
 *   1. Robotics chapter building an autonomous rover
 *   2. Hackathon teams prototyping at midnight
 *   3. Cultural festival crowd illuminated by stage lights
 *   4. Technical workshop instructor demonstrating embedded sensors
 * - Uses authentic, high-aesthetic visuals, glowing badges, attendance counts, and quotes.
 * - Parallax scrub with staggered cards.
 * - Clean reduced-motion handling & full responsiveness (320px to 4K).
 */
import { useRef, useEffect } from 'react'
import {
  Users,
  Bot,
  Code2,
  Music,
  Cpu,
  Quote,
  CheckCircle2,
} from 'lucide-react'
import { gsap } from '@/lib/gsap'
import type { SceneProps } from './CinematicShared'

interface HumanEnergyStory {
  id: string
  title: string
  subtitle: string
  chapter: string
  action: string
  quote: string
  author: string
  attendance: string
  badge: string
  accentColor: string
  borderColor: string
  glowColor: string
  icon: typeof Bot
  image: string
}

const HUMAN_STORIES: HumanEnergyStory[] = [
  {
    id: 'story-robotics',
    title: 'Autonomous Rover Fabrication',
    subtitle: 'Robotics Chapter',
    chapter: 'Autonomous Systems Guild',
    action: 'Calibrating LiDAR sensor arrays and telemetry rigs for university planetary trials.',
    quote:
      'We pushed the LiDAR calibration until 4:00 AM. When the rover navigated the obstacle course autonomously, the entire lab went silent, then erupted.',
    author: 'Aarav Sharma · Chief Rover Architect',
    attendance: '48 Engineers · 14 Subsystems',
    badge: 'Hardware Telemetry Live',
    accentColor: '#18CFFC',
    borderColor: 'border-[#18CFFC]/40',
    glowColor: 'rgba(24,207,252,0.25)',
    icon: Bot,
    image:
      'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'story-hackathon',
    title: 'Prototyping at Midnight',
    subtitle: 'Hackathon Sprint',
    chapter: 'ACM Student Chapter',
    action: '36-Hour continuous sprint, high-velocity caffeine-fueled code commits.',
    quote:
      'Three cups of black coffee, five failed API calls, and then at 3:15 AM our decentralized ticket verification system clicked. Pure adrenaline.',
    author: 'Neha Patel · Lead Full-Stack Dev',
    attendance: '850+ Hackers · ₹2.5L Prize Pool',
    badge: '36hr Code Sprint',
    accentColor: '#7F1AFB',
    borderColor: 'border-[#7F1AFB]/40',
    glowColor: 'rgba(127,26,251,0.25)',
    icon: Code2,
    image:
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'story-cultural',
    title: 'Illuminated by Stage Lights',
    subtitle: 'Cultural Carnival',
    chapter: 'Campus Cultural Alliance',
    action: 'Open-air amphitheater illuminated by 5,000 flashlights & live stage lasers.',
    quote:
      'When the bass dropped on the amphitheater main stage with 5,000 phone lights swaying together, you realized college isn’t just classes—it’s this energy.',
    author: 'Rohan Verma · Cultural Convener',
    attendance: '5,200 Attendees · 18 Colleges',
    badge: 'Amphitheater Live',
    accentColor: '#ED47FC',
    borderColor: 'border-[#ED47FC]/40',
    glowColor: 'rgba(237,71,252,0.25)',
    icon: Music,
    image:
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'story-sensors',
    title: 'Embedded Sensors & Edge AI',
    subtitle: 'Technical Masterclass',
    chapter: 'IEEE Student Branch',
    action: 'Live hardware demonstration of edge neural networks on low-power microcontrollers.',
    quote:
      'Watching a first-year student deploy their first neural net onto a $5 microcontroller and see the sensor light turn green—that is where careers spark.',
    author: 'Dr. Ananya Ray · Faculty Mentor',
    attendance: '160 Microcontrollers · Hands-on Labs',
    badge: 'Hardware Lab',
    accentColor: '#07A4FC',
    borderColor: 'border-[#07A4FC]/40',
    glowColor: 'rgba(7,164,252,0.25)',
    icon: Cpu,
    image:
      'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=900&q=80',
  },
]

export function World03HumanEnergy({
  reducedMotion,
  className = '',
  id = 'world-03-human',
}: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const ctx = gsap.context(() => {
      if (reducedMotion) {
        gsap.set(headerRef.current, { opacity: 1, y: 0 })
        cardRefs.current.forEach((card) => {
          if (card) gsap.set(card, { opacity: 1, y: 0 })
        })
        return
      }

      // Header entrance
      gsap.fromTo(
        headerRef.current,
        { opacity: 0, y: 28 },
        {
          opacity: 1,
          y: 0,
          duration: 0.75,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: container,
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
        }
      )

      // Staggered parallax scrub across cards
      // Even-indexed cards travel faster than odd-indexed cards to create authentic depth
      cardRefs.current.forEach((card, idx) => {
        if (!card) return

        // Initial entrance
        gsap.fromTo(
          card,
          { opacity: 0, y: 40, scale: 0.96 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.65,
            delay: idx * 0.1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 85%',
              toggleActions: 'play none none reverse',
            },
          }
        )

        // Parallax scrub as user continues scrolling through the section
        const speed = idx % 2 === 0 ? -25 : -45
        gsap.to(card, {
          yPercent: speed,
          ease: 'none',
          scrollTrigger: {
            trigger: container,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 0.6,
          },
        })
      })
    }, container)

    return () => ctx.revert()
  }, [reducedMotion])

  return (
    <section
      ref={containerRef}
      id={id}
      aria-label="World 03: Human Energy - The Pulse of Student Ambition"
      className={`relative w-full bg-[#08080A] text-white py-16 sm:py-24 px-4 sm:px-6 md:px-10 overflow-hidden select-none ${className}`}
    >
      {/* Background Atmosphere */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
        {/* Subtle dual-color ambient gradient orbs */}
        <div
          className="absolute top-1/4 -left-48 w-96 h-96 rounded-full blur-[120px] opacity-20 pointer-events-none"
          style={{ background: '#18CFFC' }}
        />
        <div
          className="absolute bottom-1/4 -right-48 w-96 h-96 rounded-full blur-[120px] opacity-20 pointer-events-none"
          style={{ background: '#7F1AFB' }}
        />
        {/* Ambient mesh grid */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Header Block: Badge, World Subtitle, Sora Headline */}
        <div ref={headerRef} className="mb-12 sm:mb-16 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] sm:text-xs font-mono font-medium tracking-[0.18em] uppercase text-[#18CFFC] bg-[#14141A]/90 border border-[#18CFFC]/35 backdrop-blur-md shadow-[0_0_20px_rgba(24,207,252,0.18)] mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#18CFFC] animate-ping" />
            <span>WORLD 03 · HUMAN ENERGY</span>
          </div>

          <p className="text-xs sm:text-sm font-mono tracking-widest text-[#07A4FC] uppercase mb-2">
            Campus Comes Alive
          </p>

          <h2 className="font-display font-black text-3xl sm:text-5xl md:text-6xl text-white tracking-tight uppercase mb-4">
            The Pulse of Student Ambition.
          </h2>

          <p className="text-sm sm:text-base md:text-lg text-zinc-300 font-sans max-w-2xl mx-auto leading-relaxed">
            Behind every registration is an all-nighter, a packed amphitheater, an algorithm cracked, and a passion sparked.
          </p>
        </div>

        {/* 4 Staggered Parallax Narrative Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 items-start">
          {HUMAN_STORIES.map((story, idx) => {
            const StoryIcon = story.icon
            return (
              <div
                key={story.id}
                ref={(el) => {
                  cardRefs.current[idx] = el
                }}
                className={`group relative rounded-2xl bg-[#0E0E14] border border-white/15 overflow-hidden transition-all duration-300 hover:border-white/30 hover:shadow-[0_12px_40px_rgba(0,0,0,0.8)] ${
                  idx % 2 === 1 ? 'md:mt-12' : ''
                }`}
              >
                {/* Visual Image Header with Vignette */}
                <div className="relative h-48 sm:h-56 w-full overflow-hidden">
                  <img
                    src={story.image}
                    alt={story.title}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  {/* Cinematic gradient overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0E0E14] via-[#0E0E14]/40 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />

                  {/* Top floating badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium tracking-wide backdrop-blur-md border"
                      style={{
                        backgroundColor: 'rgba(14,14,20,0.85)',
                        borderColor: story.accentColor,
                        color: story.accentColor,
                        boxShadow: `0 0 16px ${story.glowColor}`,
                      }}
                    >
                      <StoryIcon size={12} />
                      <span>{story.badge}</span>
                    </span>

                    <span className="text-[10px] font-mono text-white/90 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                      {story.subtitle}
                    </span>
                  </div>

                  {/* Bottom Image Overlay: Chapter Name */}
                  <div className="absolute bottom-3 left-4 right-4">
                    <span className="text-[10px] font-mono tracking-wider text-zinc-400 uppercase">
                      ORGANIZER: {story.chapter}
                    </span>
                    <h3 className="font-display font-bold text-xl sm:text-2xl text-white">
                      {story.title}
                    </h3>
                  </div>
                </div>

                {/* Card Content Body */}
                <div className="p-5 sm:p-6 flex flex-col justify-between">
                  {/* Action Description */}
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-4 font-sans">
                    {story.action}
                  </p>

                  {/* Authentic Quote Box */}
                  <div className="relative p-3.5 sm:p-4 rounded-xl bg-[#14141A]/90 border border-white/10 mb-4">
                    <Quote
                      size={16}
                      style={{ color: story.accentColor }}
                      className="absolute top-3 left-3 opacity-40 shrink-0"
                    />
                    <p className="text-xs sm:text-sm italic text-zinc-200 pl-5 leading-relaxed font-sans">
                      &ldquo;{story.quote}&rdquo;
                    </p>
                    <div className="mt-2 text-right">
                      <span className="text-[10px] font-mono text-zinc-400">
                        — {story.author}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Stats Ribbon */}
                  <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <Users size={13} style={{ color: story.accentColor }} />
                      <span className="text-zinc-300 font-semibold">{story.attendance}</span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                      <CheckCircle2 size={12} className="text-[#10B981]" />
                      <span>Verified Event</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
export default World03HumanEnergy
