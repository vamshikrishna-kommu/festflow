/**
 * FESTFLOW MOBILE FILM 2.0 — SCENE 02: DISCOVER CAMPUS EVENTS
 * Headline: FIND WHAT MOVES YOU.
 *
 * Refined mobile-first framing:
 * - Compact safe-zone padding clears sticky Navbar & BottomNav on 320x568 through 430x932.
 * - Restrained scroll distance (+=85%) and bidirectional scrub (scrub: 0.45).
 * - Clearly labeled as illustrative preview cards while linking directly to /discover.
 */
import { useRef, useEffect } from 'react'
import { Link } from 'react-router'
import { Search, MapPin, Calendar, Compass, ArrowRight, Filter } from 'lucide-react'
import { gsap } from '@/lib/gsap'

interface Scene02Props {
  reducedMotion: boolean
}

export function Scene02DiscoverEvents({ reducedMotion }: Scene02Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pinTargetRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const viewfinderRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLDivElement>(null)
  const categoryPillsRef = useRef<HTMLDivElement>(null)
  const cardOneRef = useRef<HTMLDivElement>(null)
  const cardTwoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const pinTarget = pinTargetRef.current
    if (!container || !pinTarget) return

    const ctx = gsap.context(() => {
      if (reducedMotion) {
        gsap.set(
          [
            headerRef.current,
            viewfinderRef.current,
            searchInputRef.current,
            cardOneRef.current,
            cardTwoRef.current,
          ],
          { opacity: 1, scale: 1, y: 0, x: 0, clearProps: 'transform' }
        )
        return
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: 'top top',
          end: '+=85%',
          scrub: 0.45,
          pin: pinTarget,
          pinSpacing: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      })

      tl.fromTo(
        searchInputRef.current,
        { borderColor: 'rgba(255,255,255,0.1)', boxShadow: '0 0 0px transparent' },
        {
          borderColor: 'rgba(24,207,252,0.85)',
          boxShadow: '0 0 18px rgba(24,207,252,0.22)',
          duration: 0.25,
        },
        0.12
      )
        .to(
          categoryPillsRef.current,
          { x: -16, duration: 0.28, ease: 'power1.inOut' },
          0.2
        )
        .fromTo(
          cardOneRef.current,
          { scale: 0.985, borderColor: 'rgba(255,255,255,0.1)' },
          {
            scale: 1.015,
            borderColor: 'rgba(24,207,252,0.55)',
            boxShadow: '0 14px 36px rgba(0,0,0,0.75), 0 0 24px rgba(24,207,252,0.16)',
            duration: 0.28,
          },
          0.38
        )
        .to(
          cardTwoRef.current,
          { opacity: 0.6, scale: 0.97, duration: 0.24 },
          0.42
        )
        .to(
          [headerRef.current, viewfinderRef.current],
          { opacity: 0, y: -16, duration: 0.16, ease: 'power2.in' },
          0.84
        )
    }, container)

    return () => ctx.revert()
  }, [reducedMotion])

  return (
    <section
      ref={containerRef}
      id="scene-02-discover"
      aria-labelledby="scene02-heading"
      className="relative w-full bg-[#08080A] text-white overflow-x-clip select-none"
    >
      <div
        ref={pinTargetRef}
        className={`relative w-full flex flex-col items-center justify-center px-4 sm:px-6 overflow-hidden ${
          reducedMotion
            ? 'py-12 sm:py-16'
            : 'h-[100dvh] pt-[70px] sm:pt-[82px] pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-6'
        }`}
      >
        {/* Subtle background glow */}
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] sm:w-[540px] h-[320px] sm:h-[540px] rounded-full pointer-events-none -z-10"
          style={{
            background:
              'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(24,207,252,0.11) 0%, rgba(13,86,251,0.07) 50%, transparent 75%)',
          }}
        />

        {/* Section Header */}
        <div ref={headerRef} className="text-center mb-3 min-[360px]:mb-4 sm:mb-6 max-w-md mx-auto">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-mono font-bold tracking-[0.18em] uppercase text-[#18CFFC] bg-[#14141A] border border-[#18CFFC]/30 mb-1.5 sm:mb-2">
            <Compass size={11} className="text-[#18CFFC]" />
            <span>STEP 01 · CAMPUS DISCOVERY</span>
          </div>
          <h2
            id="scene02-heading"
            className="text-[1.4rem] min-[360px]:text-[1.75rem] sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight"
          >
            FIND WHAT{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #18CFFC 0%, #07A4FC 50%, #7F1AFB 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              MOVES YOU.
            </span>
          </h2>
          <p className="mt-1 text-[11px] sm:text-sm text-zinc-400 leading-snug">
            Search, track filters, and club schedules in one campus feed.
          </p>
        </div>

        {/* Discovery Viewfinder Preview */}
        <div
          ref={viewfinderRef}
          className="w-full max-w-[300px] min-[360px]:max-w-[340px] sm:max-w-[380px] rounded-2xl sm:rounded-3xl bg-[#0E0E12] border border-white/15 p-3 sm:p-4 shadow-[0_20px_56px_rgba(0,0,0,0.85)] flex flex-col gap-2 sm:gap-3 relative overflow-hidden"
        >
          {/* Preview disclosure label */}
          <div className="flex items-center justify-between text-[8px] font-mono uppercase tracking-wider text-zinc-500">
            <span>DISCOVER INTERFACE</span>
            <span className="px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/10 text-zinc-400">
              SAMPLE PREVIEW
            </span>
          </div>

          {/* Search Field */}
          <div
            ref={searchInputRef}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#14141A] border border-white/10 transition-colors duration-300"
          >
            <Search size={13} className="text-[#18CFFC] shrink-0" />
            <span className="text-[11px] sm:text-xs text-white font-medium select-none truncate">
              Hackathons, Cultural fests...
            </span>
            <span className="ml-auto flex items-center justify-center w-5 h-5 rounded-lg bg-white/05 text-zinc-400 shrink-0">
              <Filter size={10} />
            </span>
          </div>

          {/* Category Chips Track with subtle right-edge fade mask */}
          <div
            className="relative overflow-hidden -mx-1 px-1"
            style={{
              WebkitMaskImage: 'linear-gradient(90deg, black 82%, transparent 100%)',
              maskImage: 'linear-gradient(90deg, black 82%, transparent 100%)',
            }}
          >
            <div ref={categoryPillsRef} className="flex gap-1.5 select-none">
              {['All Tracks', 'Technical', 'Cultural', 'Sports', 'Workshops'].map((cat, i) => (
                <span
                  key={cat}
                  className="px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold whitespace-nowrap shrink-0"
                  style={
                    i === 1
                      ? {
                          background: 'linear-gradient(135deg, rgba(24,207,252,0.22), rgba(127,26,251,0.22))',
                          border: '1px solid rgba(24,207,252,0.55)',
                          color: '#18CFFC',
                        }
                      : {
                          background: '#14141A',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: '#a1a1aa',
                        }
                  }
                >
                  {i === 1 && '✦ '}
                  {cat}
                </span>
              ))}
            </div>
          </div>

          {/* Primary Sample Event Card */}
          <div
            ref={cardOneRef}
            className="rounded-xl sm:rounded-2xl bg-[#14141A] border border-white/10 p-2.5 sm:p-3 flex flex-col gap-1.5 sm:gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider text-[#18CFFC] bg-[#18CFFC]/10 border border-[#18CFFC]/25">
                TECHNICAL · HACKATHON
              </span>
              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/25 shrink-0">
                ₹150 · TEAM (2–4)
              </span>
            </div>

            <div>
              <h3 className="text-xs sm:text-sm font-black text-white leading-tight">
                Nexus Hackathon (Sample)
              </h3>
              <p className="text-[10px] text-zinc-400 font-medium">By Nexus Tech Club · 48H Sprint</p>
            </div>

            <div className="flex items-center gap-3 text-[9px] sm:text-[10px] text-zinc-400 pt-1 border-t border-white/[0.06]">
              <span className="flex items-center gap-1">
                <Calendar size={10} className="text-[#18CFFC]" />
                Nov 14–15
              </span>
              <span className="flex items-center gap-1">
                <MapPin size={10} className="text-[#18CFFC]" />
                Main Audi
              </span>
            </div>
          </div>

          {/* Secondary Stack Card */}
          <div
            ref={cardTwoRef}
            className="hidden min-[360px]:flex rounded-xl bg-[#14141A]/70 border border-white/05 p-2 items-center justify-between"
          >
            <div>
              <span className="text-[8px] font-mono text-[#ED47FC] font-bold uppercase tracking-wider">
                CULTURAL FEST · SAMPLE
              </span>
              <p className="text-[11px] font-bold text-zinc-300">Rhythm Carnival</p>
            </div>
            <span className="text-[8px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">
              FREE
            </span>
          </div>

          {/* Live Discover Link */}
          <Link
            to="/discover"
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold text-[#18CFFC] bg-[#18CFFC]/08 border border-[#18CFFC]/25 hover:bg-[#18CFFC]/15 active:scale-[0.99] transition-all text-center min-h-[44px]"
          >
            <span>Browse Live Campus Events</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </section>
  )
}
