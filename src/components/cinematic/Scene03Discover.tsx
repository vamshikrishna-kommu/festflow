/**
 * Scene 03 — Discover (Phone Mockup)
 * "FIND WHAT MOVES YOU."
 * CSS phone mockup with realistic event card UI inside. Scroll-driven entrance.
 */
import { useRef, useEffect } from 'react'
import { Search, MapPin, Calendar, ChevronRight } from 'lucide-react'
import { gsap } from '@/lib/gsap'

interface Scene03Props {
  reducedMotion: boolean
}

function PhoneDiscoverScreen() {
  return (
    <div className="flex flex-col h-full bg-[#08080A] text-white overflow-hidden rounded-[inherit]">
      {/* Status bar */}
      <div className="flex justify-between items-center px-5 pt-3 pb-1 text-[9px] font-semibold text-zinc-400 shrink-0">
        <span>9:41</span>
        <span>●●●</span>
      </div>

      {/* Header */}
      <div className="px-4 pt-2 pb-3 shrink-0">
        <p className="text-[10px] text-zinc-500 font-medium">Good morning 👋</p>
        <h3 className="text-sm font-bold text-white leading-tight">Discover Events</h3>
      </div>

      {/* Search bar */}
      <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#14141A] border border-white/10 shrink-0">
        <Search size={12} className="text-zinc-500 shrink-0" />
        <span className="text-[10px] text-zinc-500">Search hackathons, workshops…</span>
      </div>

      {/* Category pills */}
      <div className="flex gap-2 px-4 mb-3 overflow-hidden shrink-0">
        {['All', 'Tech', 'Cultural', 'Sports'].map((cat, i) => (
          <span
            key={cat}
            className="shrink-0 px-2.5 py-1 rounded-full text-[9px] font-bold border"
            style={
              i === 0
                ? {
                    background: 'linear-gradient(135deg, #18CFFC20, #7F1AFB20)',
                    border: '1px solid rgba(24,207,252,0.4)',
                    color: '#18CFFC',
                  }
                : { borderColor: 'rgba(255,255,255,0.1)', color: '#71717a' }
            }
          >
            {cat}
          </span>
        ))}
      </div>

      {/* Event cards */}
      <div className="flex-1 overflow-hidden px-4 flex flex-col gap-2.5 pb-3">
        {[
          {
            title: 'Nexus Hackathon 2026',
            date: 'Nov 14–15',
            venue: 'Main Campus Audi',
            tag: 'Tech',
            color: '#18CFFC',
            free: false,
            fee: '₹200',
          },
          {
            title: 'Rhythm Cultural Fest',
            date: 'Nov 22',
            venue: 'Open Air Stage',
            tag: 'Cultural',
            color: '#ED47FC',
            free: true,
            fee: 'Free',
          },
          {
            title: 'React Workshop',
            date: 'Nov 18',
            venue: 'Lab 203',
            tag: 'Workshop',
            color: '#7F1AFB',
            free: true,
            fee: 'Free',
          },
        ].map(({ title, date, venue, tag, color, fee }) => (
          <div
            key={title}
            className="rounded-xl p-3 flex items-start gap-2.5 group"
            style={{ background: '#0E0E12', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {/* Color indicator */}
            <div
              className="w-1 self-stretch rounded-full shrink-0"
              style={{ background: color }}
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span
                  className="text-[8px] font-bold uppercase tracking-wider"
                  style={{ color }}
                >
                  {tag}
                </span>
                <span
                  className="text-[8px] font-bold"
                  style={{ color: fee === 'Free' ? '#10B981' : '#F59E0B' }}
                >
                  {fee}
                </span>
              </div>
              <p className="text-[10px] font-semibold text-white leading-tight truncate">
                {title}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex items-center gap-0.5 text-[8px] text-zinc-500">
                  <Calendar size={7} />
                  {date}
                </span>
                <span className="flex items-center gap-0.5 text-[8px] text-zinc-500">
                  <MapPin size={7} />
                  {venue}
                </span>
              </div>
            </div>
            <ChevronRight size={10} className="text-zinc-600 shrink-0 mt-1" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function Scene03Discover({ reducedMotion }: Scene03Props) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)
  const phoneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const ctx = gsap.context(() => {
      const isMobile = window.innerWidth < 768

      // Copy entrance
      gsap.fromTo(
        copyRef.current,
        { opacity: 0, x: isMobile ? 0 : -40, y: isMobile ? 30 : 0 },
        {
          opacity: 1,
          x: 0,
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

      // Phone entrance
      gsap.fromTo(
        phoneRef.current,
        { opacity: 0, x: isMobile ? 0 : 50, y: isMobile ? 40 : 0, rotate: isMobile ? 0 : 4 },
        {
          opacity: 1,
          x: 0,
          y: 0,
          rotate: 0,
          duration: reducedMotion ? 0 : 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: section,
            start: 'top 75%',
            toggleActions: 'play none none reverse',
          },
        }
      )

      // Subtle floating animation for phone (only desktop)
      if (!reducedMotion && !isMobile) {
        gsap.to(phoneRef.current, {
          y: -10,
          duration: 2.8,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          delay: 1.2,
        })
      }
    }, section)

    return () => ctx.revert()
  }, [reducedMotion])

  return (
    <section
      ref={sectionRef}
      id="scene-discover"
      aria-labelledby="scene03-heading"
      className="relative py-20 sm:py-28 lg:py-36 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full overflow-hidden"
    >
      {/* Background gradient */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 right-0 -translate-y-1/2 w-[500px] h-[500px] pointer-events-none -z-10"
        style={{
          background:
            'radial-gradient(ellipse 70% 70% at 100% 50%, rgba(24,207,252,0.07) 0%, transparent 70%)',
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Copy */}
        <div ref={copyRef} style={{ opacity: 0 }} className="text-center lg:text-left">
          <span className="inline-block text-[11px] uppercase tracking-[0.25em] font-bold text-[#18CFFC] mb-4">
            Event Discovery
          </span>
          <h2
            id="scene03-heading"
            className="text-[1.9rem] sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-[1.1] mb-5"
          >
            Find what{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #18CFFC 0%, #07A4FC 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              moves you.
            </span>
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-md mx-auto lg:mx-0 mb-8">
            Browse hackathons, cultural fests, sports tournaments, and skill workshops. Filter by category, college, date, or price in seconds.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto lg:mx-0">
            {[
              { label: 'Smart Search', desc: 'Find events across all campus clubs' },
              { label: 'Category Filters', desc: 'Tech, cultural, sports, workshops' },
              { label: 'Free & Paid', desc: 'Filter by registration fee type' },
              { label: 'Closing Soon', desc: 'Never miss a registration deadline' },
            ].map(({ label, desc }) => (
              <div
                key={label}
                className="p-3 rounded-xl text-left"
                style={{ background: '#0E0E12', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <p className="text-xs font-bold text-white mb-0.5">{label}</p>
                <p className="text-[11px] text-zinc-500 leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Phone mockup */}
        <div className="flex justify-center lg:justify-end">
          <div
            ref={phoneRef}
            style={{ opacity: 0 }}
            className="relative"
            aria-label="FestFlow discover screen preview"
          >
            {/* Phone frame */}
            <div
              className="relative w-[220px] sm:w-[240px] h-[440px] sm:h-[480px] rounded-[2.5rem] overflow-hidden"
              style={{
                background: '#0A0A0F',
                border: '1.5px solid rgba(255,255,255,0.12)',
                boxShadow:
                  '0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05), 0 0 60px rgba(24,207,252,0.12)',
              }}
            >
              {/* Notch */}
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 rounded-b-2xl bg-black z-20"
                aria-hidden="true"
              />
              <div className="h-full pt-2">
                <PhoneDiscoverScreen />
              </div>
            </div>

            {/* Decorative glow */}
            <div
              aria-hidden="true"
              className="absolute -inset-8 rounded-[3rem] pointer-events-none -z-10"
              style={{
                background:
                  'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(24,207,252,0.10) 0%, transparent 70%)',
              }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

