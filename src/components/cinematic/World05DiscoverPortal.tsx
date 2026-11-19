/**
 * FESTFLOW CINEMATIC 4.0 (FESTFLOW INFINITE)
 * WORLD 05: DISCOVER PORTAL / ENTER THE EVENT
 *
 * Specification:
 * - "Discover / Enter the Event"
 * - Headline: "Find What Moves You." in Sora font.
 * - Interactive 3D event discovery portal:
 *   - Live search bar preview with simulated typing
 *   - Category filter pills (Tech, Cultural, Sports, Arts, Hackathons)
 *   - Interactive preview card with pass availability badge and 1-click jump to full /discover catalog
 * - Bidirectional scrub with smooth pin transitions.
 * - Clean reduced-motion handling & full responsiveness (320px to 4K).
 */
import { useRef, useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  Search,
  SlidersHorizontal,
  Calendar,
  MapPin,
  Ticket,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react'
import { gsap } from '@/lib/gsap'
import { getNavbarOffset, type SceneProps } from './CinematicShared'

interface CategoryPill {
  id: string
  label: string
}

const CATEGORIES: CategoryPill[] = [
  { id: 'all', label: 'All Events' },
  { id: 'tech', label: 'Tech & AI' },
  { id: 'cultural', label: 'Cultural' },
  { id: 'sports', label: 'Sports' },
  { id: 'arts', label: 'Arts & Media' },
  { id: 'hackathons', label: 'Hackathons' },
]

interface DiscoveryEvent {
  id: string
  title: string
  category: string
  categoryId: string
  college: string
  date: string
  venue: string
  price: string
  spotsLeft: number
  totalSpots: number
  badge: string
  image: string
  accentColor: string
}

const DISCOVERY_EVENTS: DiscoveryEvent[] = [
  {
    id: 'disc-hack',
    title: 'HackSphere 2026: National 36h Sprint',
    category: 'Hackathons',
    categoryId: 'hackathons',
    college: 'Centennial Tech Hub',
    date: 'NOV 12 · 09:00 AM',
    venue: 'Tech Arena Hall B',
    price: 'Free Pass',
    spotsLeft: 42,
    totalSpots: 500,
    badge: 'Filling Fast · 92%',
    image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=700&q=80',
    accentColor: '#7F1AFB',
  },
  {
    id: 'disc-ai',
    title: 'Autonomous Robotics & LLM Summit',
    category: 'Tech & AI',
    categoryId: 'tech',
    college: 'Robotics Center of Excellence',
    date: 'NOV 18 · 10:30 AM',
    venue: 'Auditorium East',
    price: '₹149 / Entry',
    spotsLeft: 18,
    totalSpots: 300,
    badge: 'Hardware Included',
    image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=700&q=80',
    accentColor: '#18CFFC',
  },
  {
    id: 'disc-cult',
    title: 'Aura Music & Art Carnival \'26',
    category: 'Cultural',
    categoryId: 'cultural',
    college: 'Student Union Alliance',
    date: 'NOV 24 · 06:00 PM',
    venue: 'Lake Amphitheatre',
    price: 'Free Entry',
    spotsLeft: 120,
    totalSpots: 2000,
    badge: 'Main Stage Live',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=700&q=80',
    accentColor: '#ED47FC',
  },
  {
    id: 'disc-sports',
    title: 'Inter-Collegiate Esports Championship',
    category: 'Sports',
    categoryId: 'sports',
    college: 'Gaming & Simulation Chapter',
    date: 'DEC 02 · 11:00 AM',
    venue: 'Cyber Arena Dome',
    price: 'Free Pass',
    spotsLeft: 64,
    totalSpots: 256,
    badge: 'Live Streamed',
    image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=700&q=80',
    accentColor: '#07A4FC',
  },
  {
    id: 'disc-arts',
    title: 'Independent Cinema & Visual Arts Festival',
    category: 'Arts & Media',
    categoryId: 'arts',
    college: 'Department of Visual Media',
    date: 'DEC 08 · 04:00 PM',
    venue: 'Black Box Studio 3',
    price: '₹99 / Entry',
    spotsLeft: 30,
    totalSpots: 180,
    badge: 'Reserved Seating',
    image: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=700&q=80',
    accentColor: '#ED47FC',
  },
]

const SEARCH_PHRASES = [
  'HackSphere 36h Hackathon',
  'Autonomous Rover Workshop',
  'Aura Music Carnival',
  'Inter-Collegiate Esports',
  'TEDx Youth Summit',
]

export function World05DiscoverPortal({
  reducedMotion,
  className = '',
  id = 'world-05-discover',
}: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pinTargetRef = useRef<HTMLDivElement>(null)

  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('HackSphere')
  const [phraseIndex, setPhraseIndex] = useState(0)

  // Layout refs
  const headerRef = useRef<HTMLDivElement>(null)
  const searchBarRef = useRef<HTMLDivElement>(null)
  const cardStageRef = useRef<HTMLDivElement>(null)

  // Simulated live typing effect
  useEffect(() => {
    if (reducedMotion) {
      setSearchQuery('Explore Campus Events')
      return
    }

    let isMounted = true
    let charIndex = 0
    let isDeleting = false
    let currentPhrase = SEARCH_PHRASES[phraseIndex]

    const typeInterval = setInterval(() => {
      if (!isMounted) return

      if (!isDeleting) {
        // Typing characters
        charIndex++
        setSearchQuery(currentPhrase.substring(0, charIndex))

        if (charIndex >= currentPhrase.length) {
          isDeleting = true
          // Pause before deleting
          clearInterval(typeInterval)
          setTimeout(() => {
            if (isMounted) {
              setPhraseIndex((prev) => (prev + 1) % SEARCH_PHRASES.length)
            }
          }, 1800)
        }
      }
    }, 60)

    return () => {
      isMounted = false
      clearInterval(typeInterval)
    }
  }, [phraseIndex, reducedMotion])

  useEffect(() => {
    const container = containerRef.current
    const pinTarget = pinTargetRef.current
    if (!container || !pinTarget) return

    const ctx = gsap.context(() => {
      if (reducedMotion) {
        gsap.set([headerRef.current, searchBarRef.current, cardStageRef.current], {
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

      // Pinned scrub timeline
      gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: () => `top ${getNavbarOffset()}`,
          end: '+=100%',
          scrub: 0.6,
          pin: pinTarget,
          pinSpacing: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      })
    }, container)

    return () => ctx.revert()
  }, [reducedMotion])

  // Filter events based on active category
  const filteredEvents =
    activeCategory === 'all'
      ? DISCOVERY_EVENTS
      : DISCOVERY_EVENTS.filter((e) => e.categoryId === activeCategory)

  const primaryEvent = filteredEvents[0] || DISCOVERY_EVENTS[0]

  return (
    <section
      ref={containerRef}
      id={id}
      aria-label="World 05: Discover Portal - Enter the Event"
      className={`relative w-full bg-[#08080A] text-white overflow-x-clip select-none ${className}`}
    >
      <div
        ref={pinTargetRef}
        className="relative w-full min-h-[calc(100dvh-65px)] sm:min-h-[calc(100dvh-73px)] flex flex-col justify-between px-4 sm:px-6 md:px-10 pt-4 sm:pt-6 pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-6 overflow-hidden"
      >
        {/* Background Atmosphere */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none -z-20 overflow-hidden">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] sm:w-[720px] md:w-[900px] h-[480px] sm:h-[720px] md:h-[900px] rounded-full blur-[140px] opacity-20 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(24,207,252,0.3) 0%, rgba(127,26,251,0.2) 50%, transparent 75%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(24,207,252,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(24,207,252,0.4) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
            }}
          />
        </div>

        {/* Top Header */}
        <div ref={headerRef} className="relative z-10 w-full max-w-6xl mx-auto flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] sm:text-xs font-mono font-medium tracking-[0.18em] uppercase text-[#18CFFC] bg-[#14141A]/90 border border-[#18CFFC]/35 backdrop-blur-md shadow-[0_0_20px_rgba(24,207,252,0.18)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#18CFFC] animate-ping" />
              <span>WORLD 05 · DISCOVER PORTAL</span>
            </div>

            <Link
              to="/discover"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-[#18CFFC] hover:text-[#67E8F9] transition-colors"
            >
              <span>Full Catalog</span>
              <ExternalLink size={12} />
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-white/10 pb-3">
            <div>
              <p className="text-xs sm:text-sm font-mono tracking-wider text-[#07A4FC] uppercase mb-1">
                Discover / Enter the Event
              </p>
              <h2 className="font-display font-black text-2xl sm:text-4xl md:text-5xl text-white tracking-tight uppercase">
                Find What Moves You.
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-sm font-sans">
              Instant search, category filters, and cryptographic FastPass tickets ready for 1-click booking.
            </p>
          </div>
        </div>

        {/* Search Bar Preview & Category Filter Pills */}
        <div ref={searchBarRef} className="relative z-10 w-full max-w-6xl mx-auto my-3 flex flex-col gap-3">
          {/* Live Search Bar Preview with Simulated Typing */}
          <div className="relative w-full max-w-2xl mx-auto">
            <div className="relative flex items-center bg-[#14141A]/90 border border-white/20 rounded-full px-4 py-2.5 sm:py-3 shadow-[0_0_28px_rgba(24,207,252,0.15)] focus-within:border-[#18CFFC]/60 transition-all">
              <Search size={18} className="text-[#18CFFC] shrink-0 mr-3" />
              <input
                type="text"
                readOnly
                value={searchQuery}
                aria-label="Simulated search query"
                className="w-full bg-transparent text-white text-xs sm:text-sm font-mono outline-none tracking-wide placeholder-zinc-500"
              />
              <span className="w-1.5 h-4 bg-[#18CFFC] animate-pulse ml-1 shrink-0" />
              <div className="hidden min-[480px]:flex items-center gap-1.5 ml-3 pl-3 border-l border-white/10 text-[10px] font-mono text-zinc-400">
                <SlidersHorizontal size={12} className="text-zinc-500" />
                <span>FILTERS</span>
              </div>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 overflow-x-auto py-1 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-mono font-medium transition-all duration-300 whitespace-nowrap ${
                    isActive
                      ? 'bg-gradient-to-r from-[#18CFFC] to-[#07A4FC] text-black font-bold shadow-[0_0_18px_rgba(24,207,252,0.4)] scale-105'
                      : 'bg-[#14141A] text-zinc-400 hover:text-white border border-white/10 hover:border-white/20'
                  }`}
                >
                  {cat.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Main Discovery Portal Showcase Stage */}
        <div
          ref={cardStageRef}
          className="relative z-10 w-full max-w-6xl mx-auto my-auto grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-center"
        >
          {/* Primary Featured Interactive Event Card (7 cols) */}
          <div className="lg:col-span-7 rounded-2xl bg-[#0E0E14] border border-white/20 overflow-hidden shadow-2xl flex flex-col justify-between">
            {/* Image Header with Vignette & Badges */}
            <div className="relative h-44 sm:h-52 w-full overflow-hidden">
              <img
                src={primaryEvent.image}
                alt={primaryEvent.title}
                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0E0E14] via-[#0E0E14]/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />

              {/* Badges on Image */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                <span
                  className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wide backdrop-blur-md border"
                  style={{
                    backgroundColor: 'rgba(14,14,20,0.85)',
                    borderColor: primaryEvent.accentColor,
                    color: primaryEvent.accentColor,
                  }}
                >
                  {primaryEvent.badge}
                </span>

                <span className="text-[10px] font-mono text-white/90 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                  {primaryEvent.category}
                </span>
              </div>

              {/* Event Title on Image */}
              <div className="absolute bottom-3 left-4 right-4">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                  {primaryEvent.college}
                </span>
                <h3 className="font-display font-black text-xl sm:text-2xl text-white">
                  {primaryEvent.title}
                </h3>
              </div>
            </div>

            {/* Event Info & Pass Availability */}
            <div className="p-5 sm:p-6 flex flex-col justify-between">
              {/* Event Metadata Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4 text-xs font-mono">
                <div className="flex items-center gap-2 text-zinc-300">
                  <Calendar size={13} className="text-[#18CFFC]" />
                  <span>{primaryEvent.date}</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-300">
                  <MapPin size={13} className="text-[#ED47FC]" />
                  <span className="truncate">{primaryEvent.venue}</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-300">
                  <Ticket size={13} className="text-[#10B981]" />
                  <span className="font-bold text-white">{primaryEvent.price}</span>
                </div>
              </div>

              {/* Pass Availability Progress Bar */}
              <div className="mb-5 p-3 rounded-xl bg-[#14141A] border border-white/10">
                <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
                  <span className="text-zinc-400">PASS CAPACITY STATUS</span>
                  <span className="text-[#18CFFC] font-bold">
                    {primaryEvent.spotsLeft} spots remaining
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#18CFFC] via-[#07A4FC] to-[#7F1AFB]"
                    style={{
                      width: `${Math.round(((primaryEvent.totalSpots - primaryEvent.spotsLeft) / primaryEvent.totalSpots) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <Link
                  to="/discover"
                  className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs sm:text-sm font-semibold text-black bg-gradient-to-r from-[#18CFFC] to-[#07A4FC] hover:brightness-110 shadow-[0_0_24px_rgba(24,207,252,0.3)] transition-all hover:scale-[1.02]"
                >
                  <span>Explore in Discovery Catalog</span>
                  <ArrowRight size={15} />
                </Link>

                <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
                  <ShieldCheck size={14} className="text-[#10B981]" />
                  <span>Zero Gatekeeping · 100% Verified</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Quick Multiverse Discovery Stream (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 px-1">
              <span>LIVE CAMPUS EVENT STREAM</span>
              <span className="text-[#18CFFC]">REALTIME</span>
            </div>

            {filteredEvents.slice(1, 4).map((evt) => (
              <div
                key={evt.id}
                className="group p-3 sm:p-3.5 rounded-xl bg-[#0E0E14] border border-white/10 hover:border-white/30 transition-all duration-300 flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={evt.image}
                    alt={evt.title}
                    className="w-12 h-12 rounded-lg object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="block text-[9px] font-mono uppercase text-[#07A4FC]">
                      {evt.category} · {evt.price}
                    </span>
                    <h4 className="font-display font-bold text-xs sm:text-sm text-white truncate group-hover:text-[#18CFFC] transition-colors">
                      {evt.title}
                    </h4>
                    <span className="block text-[10px] font-mono text-zinc-400 truncate mt-0.5">
                      {evt.date} · {evt.venue}
                    </span>
                  </div>
                </div>

                <Link
                  to="/discover"
                  className="p-2 rounded-lg bg-[#14141A] border border-white/10 group-hover:border-[#18CFFC]/50 text-zinc-400 group-hover:text-[#18CFFC] shrink-0 transition-colors"
                >
                  <ArrowRight size={14} />
                </Link>
              </div>
            ))}

            {/* Jump to full catalog button */}
            <Link
              to="/discover"
              className="w-full py-3 rounded-xl bg-[#14141A] hover:bg-[#1C1C24] border border-white/20 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300 hover:border-[#18CFFC]/50"
            >
              <span>View All 150+ Campus Events</span>
              <ArrowRight size={14} className="text-[#18CFFC]" />
            </Link>
          </div>
        </div>

        {/* Bottom Status Ribbon */}
        <div className="relative z-10 w-full max-w-6xl mx-auto pt-3 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-zinc-400">
          <span>DISCOVERY ENGINE: ACTIVE</span>
          <span className="text-[#10B981] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
            <span>REAL-TIME SEAT SYNC</span>
          </span>
          <span className="text-white font-bold">WORLD 05 / 10</span>
        </div>
      </div>
    </section>
  )
}
export default World05DiscoverPortal
