/**
 * Scene 02 — Campus Events World
 * "EVERY CAMPUS HAS A STORY."
 * 4 category cards emerge with staggered scale+opacity as user scrolls in.
 */
import { useRef, useEffect } from 'react'
import { Cpu, Music2, Trophy, Lightbulb } from 'lucide-react'
import { gsap } from '@/lib/gsap'

interface Scene02Props {
  reducedMotion: boolean
}

const CATEGORIES = [
  {
    icon: Cpu,
    label: 'Technology',
    sub: 'Hackathons · Coding · Robotics',
    color: '#18CFFC',
    bg: 'rgba(24,207,252,0.08)',
    border: 'rgba(24,207,252,0.2)',
  },
  {
    icon: Music2,
    label: 'Cultural',
    sub: 'Fests · Competitions · Dance',
    color: '#ED47FC',
    bg: 'rgba(237,71,252,0.08)',
    border: 'rgba(237,71,252,0.2)',
  },
  {
    icon: Trophy,
    label: 'Sports',
    sub: 'Tournaments · Athletics · Esports',
    color: '#07A4FC',
    bg: 'rgba(7,164,252,0.08)',
    border: 'rgba(7,164,252,0.2)',
  },
  {
    icon: Lightbulb,
    label: 'Workshops',
    sub: 'Seminars · Talks · Skill Building',
    color: '#7F1AFB',
    bg: 'rgba(127,26,251,0.08)',
    border: 'rgba(127,26,251,0.2)',
  },
]

export function Scene02Events({ reducedMotion }: Scene02Props) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const headlineRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const ctx = gsap.context(() => {
      // Headline reveal
      gsap.fromTo(
        headlineRef.current,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: reducedMotion ? 0 : 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: headlineRef.current,
            start: 'top 85%',
            toggleActions: 'play none none reverse',
          },
        }
      )

      // Cards stagger
      const cards = cardsRef.current?.children
      if (cards) {
        gsap.fromTo(
          Array.from(cards),
          { opacity: 0, y: 50, scale: 0.94 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: reducedMotion ? 0 : 0.7,
            ease: 'power3.out',
            stagger: reducedMotion ? 0 : 0.12,
            scrollTrigger: {
              trigger: cardsRef.current,
              start: 'top 80%',
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
      id="scene-events"
      aria-labelledby="scene02-heading"
      className="relative py-20 sm:py-28 lg:py-36 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full"
    >
      {/* Background glow */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] pointer-events-none -z-10"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(13,86,251,0.08) 0%, transparent 70%)',
        }}
      />

      <div ref={headlineRef} style={{ opacity: 0 }} className="text-center mb-12 sm:mb-16">
        <span className="inline-block text-[11px] uppercase tracking-[0.25em] font-bold text-[#18CFFC] mb-4">
          Built for Every Campus Chapter
        </span>
        <h2
          id="scene02-heading"
          className="text-[1.9rem] sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]"
        >
          Every campus has{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #ED47FC 0%, #7F1AFB 60%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            a story.
          </span>
        </h2>
        <p className="mt-4 text-sm sm:text-base text-zinc-400 max-w-lg mx-auto leading-relaxed">
          From hackathons to cultural fests, FestFlow powers every kind of campus event under one platform.
        </p>
      </div>

      <div
        ref={cardsRef}
        role="list"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5"
      >
        {CATEGORIES.map(({ icon: Icon, label, sub, color, bg, border }) => (
          <div
            key={label}
            role="listitem"
            className="rounded-2xl p-5 sm:p-6 flex flex-col gap-4 group transition-transform duration-200 hover:-translate-y-1"
            style={{
              background: bg,
              border: `1px solid ${border}`,
              opacity: 0,
            }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${color}18`, border: `1px solid ${color}30` }}
              aria-hidden="true"
            >
              <Icon size={22} style={{ color }} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white mb-1">{label}</h3>
              <p className="text-[11px] sm:text-xs text-zinc-500 leading-snug">{sub}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

