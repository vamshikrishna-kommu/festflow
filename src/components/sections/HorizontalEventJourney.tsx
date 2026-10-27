import { useRef, useEffect, useState } from 'react'
import { motion, useScroll, useTransform } from 'motion/react'
import { Link } from 'react-router'
import {
  Calendar,
  MapPin,
  ArrowRight,
  Sparkles,
  Ticket,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react'
import { Button, Badge, KineticHeading } from '@/components/ui'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { listPublishedEvents, mapRecordToUiEvent } from '@/lib/events'
import type { Event as UiEvent } from '@/types'

export function HorizontalEventJourney() {
  const targetRef = useRef<HTMLDivElement>(null)
  const [events, setEvents] = useState<UiEvent[]>([])
  const [loading, setLoading] = useState(true)
  const reduced = useReducedMotion()

  useEffect(() => {
    let mounted = true
    listPublishedEvents({ limit: 8 }).then((res) => {
      if (!mounted) return
      setLoading(false)
      setEvents(res.events?.length ? res.events.map(mapRecordToUiEvent) : [])
    })
    return () => {
      mounted = false
    }
  }, [])

  // Desktop Pinned Scroll
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ['start start', 'end end'],
  })

  // Calculate translation range based on card array length
  const totalCards = Math.max(events.length, 3)
  const shiftPercent = -((totalCards - 1.25) * 28)
  const x = useTransform(scrollYProgress, [0, 1], ['0%', `${shiftPercent}%`])

  return (
    <section
      id="journey"
      aria-label="Horizontal Event Journey"
      className="relative bg-[var(--color-surface-0)] border-t border-[oklch(100%_0_0_/_0.06)]"
    >
      {/* ─── DESKTOP & TABLET CINEMATIC PINNED SCROLL (md and up) ─────────── */}
      <div
        ref={targetRef}
        className="relative h-[250vh] hidden md:block"
        style={reduced ? { height: 'auto' } : {}}
      >
        <div
          className={`${
            reduced ? 'relative py-24' : 'sticky top-0 h-screen'
          } flex flex-col justify-center overflow-hidden px-6 lg:px-12`}
        >
          {/* Ambient luminous glow backdrops */}
          <div
            aria-hidden="true"
            className="absolute top-1/2 left-1/3 -translate-y-1/2 w-[700px] h-[450px] pointer-events-none -z-10"
            style={{
              background:
                'radial-gradient(ellipse 60% 50% at 50% 50%, oklch(58% 0.26 285 / 0.12) 0%, oklch(72% 0.16 200 / 0.08) 60%, transparent 75%)',
            }}
          />

          {/* Section Header with Kinetic Typography */}
          <div className="max-w-7xl mx-auto w-full mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <KineticHeading
                as="h2"
                badgeText="The Motion Journey"
                badgeIcon={<Sparkles size={12} />}
                className="text-2xl sm:text-4xl lg:text-5xl"
                lines={[
                  { text: 'Scroll the campus' },
                  { text: 'event horizon.', highlight: 'Live Now.', gradientClass: 'gradient-text' },
                ]}
              />
              <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-2 max-w-lg leading-relaxed">
                A continuous cinematic journey through upcoming hackathons, symposiums, and cultural fests hosted across colleges.
              </p>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <Link to="/discover">
                <Button
                  variant="outline"
                  size="sm"
                  rightIcon={<ArrowRight size={14} />}
                  className="shine-on-hover text-xs font-semibold"
                >
                  Explore All Events
                </Button>
              </Link>
            </div>
          </div>

          {/* Horizontal Moving Cards Track */}
          <div className="relative w-full max-w-7xl mx-auto overflow-visible py-4">
            {loading ? (
              <div className="flex gap-6">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="w-[380px] h-[420px] rounded-3xl bg-[var(--color-surface-2)]/60 animate-pulse border border-[oklch(100%_0_0_/_0.08)] shrink-0"
                  />
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="p-10 rounded-3xl glass-elevated border border-[oklch(100%_0_0_/_0.1)] text-center max-w-xl mx-auto my-6">
                <Ticket size={36} className="mx-auto text-[var(--color-brand-cyan)] mb-3" />
                <h3 className="text-lg font-bold font-display text-[var(--color-text-primary)]">
                  Campus Calendar Forming
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1.5 mb-5 leading-relaxed">
                  Colleges are currently publishing their semester event rosters. Are you a club leader ready to launch your event?
                </p>
                <Link to="/club/signup">
                  <Button variant="primary" size="sm" rightIcon={<ArrowRight size={14} />}>
                    Launch Club Event Portal
                  </Button>
                </Link>
              </div>
            ) : (
              <motion.div
                style={reduced ? {} : { x }}
                className="flex gap-7 will-change-transform"
              >
                {events.map((event) => {
                  const eventDate = event.date
                    ? new Date(event.date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Upcoming'

                  const isFree = event.isFree || !event.price || event.price === 0

                  return (
                    <motion.div
                      key={event.id}
                      className="w-[360px] lg:w-[400px] rounded-3xl glass-elevated border border-[oklch(100%_0_0_/_0.1)] hover:border-[var(--color-brand-violet)]/50 transition-all duration-300 flex flex-col justify-between shrink-0 group overflow-hidden shadow-2xl relative"
                      whileHover={reduced ? undefined : { y: -8, scale: 1.01 }}
                      transition={{ duration: 0.25 }}
                    >
                      {/* Top Banner Image with Chromatic Overlay */}
                      <div className="h-44 w-full relative overflow-hidden bg-[var(--color-surface-3)]">
                        {event.coverImage ? (
                          <img
                            src={event.coverImage}
                            alt={event.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full gradient-brand opacity-40 flex items-center justify-center">
                            <Sparkles size={32} className="text-white/60" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-surface-1)] via-transparent to-transparent" />

                        {/* Top floating pill badges */}
                        <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between">
                          <Badge variant="purple" className="text-[10px] uppercase font-bold tracking-wider backdrop-blur-md">
                            {event.category || 'Campus Event'}
                          </Badge>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold shadow-md backdrop-blur-md ${
                            isFree ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          }`}>
                            {isFree ? 'Free Entry' : `₹${event.price}`}
                          </span>
                        </div>
                      </div>

                      {/* Card Content */}
                      <div className="p-6 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-[11px] text-[var(--color-brand-cyan)] font-semibold mb-2">
                            <Calendar size={13} />
                            <span>{eventDate}</span>
                            {event.venue && (
                              <>
                                <span className="text-[var(--color-text-muted)]">•</span>
                                <span className="text-[var(--color-text-muted)] flex items-center gap-1 truncate max-w-[160px]">
                                  <MapPin size={12} /> {event.venue}
                                </span>
                              </>
                            )}
                          </div>

                          <h3 className="font-display font-bold text-lg text-[var(--color-text-primary)] group-hover:text-[var(--color-brand-violet)] transition-colors line-clamp-1 mb-2">
                            {event.title}
                          </h3>

                          <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed mb-4">
                            {event.description || 'Join fellow university students for this official campus club event.'}
                          </p>
                        </div>

                        {/* Bottom Actions and Security Stamp */}
                        <div className="pt-4 border-t border-[oklch(100%_0_0_/_0.08)] flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)] font-medium">
                            <ShieldCheck size={13} className="text-emerald-400" />
                            <span>Verified Host</span>
                          </span>

                          <Link to={`/events/${event.slug}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              rightIcon={<ChevronRight size={14} />}
                              className="text-xs font-semibold group-hover:bg-[var(--color-surface-3)]"
                            >
                              Details
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </motion.div>
            )}
          </div>

          {/* Bottom Progress Bar Track */}
          <div className="max-w-7xl mx-auto w-full mt-6 flex items-center justify-between text-xs text-[var(--color-text-muted)] font-mono">
            <span>01 / 0{totalCards}</span>
            <div className="w-48 h-1 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
              <motion.div
                style={{ scaleX: scrollYProgress, transformOrigin: '0%' }}
                className="h-full gradient-brand"
              />
            </div>
            <span>Scroll Journey</span>
          </div>
        </div>
      </div>

      {/* ─── MOBILE NATIVE TOUCH-FRIENDLY SCROLL (< 768px) ────────────────── */}
      <div className="md:hidden py-16 px-4">
        <div className="mb-6">
          <KineticHeading
            as="h2"
            badgeText="The Motion Journey"
            badgeIcon={<Sparkles size={12} />}
            className="text-2xl font-bold"
            lines={[
              { text: 'Scroll the campus' },
              { text: 'event horizon.', highlight: 'Live Now.', gradientClass: 'gradient-text' },
            ]}
          />
          <p className="text-xs text-[var(--color-text-secondary)] mt-2">
            Explore active hackathons, cultural festivals, and university symposiums.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-64 rounded-2xl bg-[var(--color-surface-2)]/60 animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="p-6 rounded-2xl glass text-center">
            <Ticket size={28} className="mx-auto text-[var(--color-brand-cyan)] mb-2" />
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Upcoming events launching soon</p>
          </div>
        ) : (
          <div className="flex overflow-x-auto gap-4 snap-x snap-mandatory pb-4 scrollbar-none -mx-4 px-4">
            {events.map((event) => {
              const eventDate = event.date
                ? new Date(event.date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Upcoming'

              const isFree = event.isFree || !event.price || event.price === 0

              return (
                <div
                  key={event.id}
                  className="w-[85vw] max-w-[320px] rounded-2xl glass-elevated border border-[oklch(100%_0_0_/_0.1)] shrink-0 snap-center p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-[var(--color-brand-cyan)] uppercase">
                        {event.category || 'Campus'}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isFree ? 'bg-emerald-500/20 text-emerald-300' : 'bg-cyan-500/20 text-cyan-300'
                      }`}>
                        {isFree ? 'Free' : `₹${event.price}`}
                      </span>
                    </div>

                    <h3 className="font-bold text-base text-[var(--color-text-primary)] truncate mb-1">
                      {event.title}
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1 mb-3">
                      <Calendar size={12} /> {eventDate}
                    </p>
                  </div>

                  <Link to={`/events/${event.slug}`} className="w-full">
                    <Button variant="outline" size="sm" className="w-full justify-center text-xs">
                      View Event Pass
                    </Button>
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
