/**
 * Scene 07 — Organizer
 * "YOU CREATE. WE SIMPLIFY."
 * Club dashboard preview — event creation, registrations, payment review, QR check-in.
 */
import { useRef, useEffect } from 'react'
import { Plus, Users, CheckCircle2, QrCode, ChevronRight, TrendingUp } from 'lucide-react'
import { gsap } from '@/lib/gsap'

interface Scene07Props {
  reducedMotion: boolean
}

function OrganizerDashboard() {
  return (
    <div
      className="relative w-full max-w-[340px] sm:max-w-[380px] rounded-2xl overflow-hidden"
      style={{
        background: '#0E0E12',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow:
          '0 32px 64px rgba(0,0,0,0.8), 0 0 60px rgba(237,71,252,0.08)',
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div>
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Club Portal</p>
          <h3 className="text-sm font-black text-white">Nexus Tech Club</h3>
        </div>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(237,71,252,0.1)', border: '1px solid rgba(237,71,252,0.2)' }}
          aria-hidden="true"
        >
          <TrendingUp size={14} className="text-[#ED47FC]" />
        </div>
      </div>

      {/* Quick stats */}
      <div
        className="grid grid-cols-3 gap-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        {[
          { label: 'Events', value: '3', color: '#18CFFC' },
          { label: 'Registered', value: '142', color: '#7F1AFB' },
          { label: 'Pending', value: '8', color: '#F59E0B' },
        ].map(({ label, value, color }, i) => (
          <div
            key={label}
            className="px-4 py-3 text-center"
            style={i < 2 ? { borderRight: '1px solid rgba(255,255,255,0.06)' } : {}}
          >
            <p className="text-base font-black" style={{ color }}>{value}</p>
            <p className="text-[8px] text-zinc-500 uppercase tracking-wider font-semibold">{label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="p-4 flex flex-col gap-2">
        <p className="text-[8px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Quick Actions</p>

        {[
          {
            icon: Plus,
            label: 'Create New Event',
            sub: '5-step guided wizard',
            color: '#18CFFC',
            bg: 'rgba(24,207,252,0.08)',
            border: 'rgba(24,207,252,0.2)',
          },
          {
            icon: Users,
            label: 'Review Registrations',
            sub: '12 new this week',
            color: '#7F1AFB',
            bg: 'rgba(127,26,251,0.08)',
            border: 'rgba(127,26,251,0.2)',
          },
          {
            icon: CheckCircle2,
            label: 'Verify Payments',
            sub: '8 pending approval',
            color: '#F59E0B',
            bg: 'rgba(245,158,11,0.08)',
            border: 'rgba(245,158,11,0.2)',
          },
          {
            icon: QrCode,
            label: 'QR Check-in Scanner',
            sub: 'Open gate scanner',
            color: '#ED47FC',
            bg: 'rgba(237,71,252,0.08)',
            border: 'rgba(237,71,252,0.2)',
          },
        ].map(({ icon: Icon, label, sub, color, bg, border }) => (
          <div
            key={label}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer group transition-all duration-150 hover:scale-[1.01]"
            style={{ background: bg, border: `1px solid ${border}` }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${color}18` }}
              aria-hidden="true"
            >
              <Icon size={12} style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-white leading-tight">{label}</p>
              <p className="text-[8px] text-zinc-500">{sub}</p>
            </div>
            <ChevronRight size={10} className="text-zinc-600 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function Scene07Organizer({ reducedMotion }: Scene07Props) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)
  const dashRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        copyRef.current,
        { opacity: 0, x: reducedMotion ? 0 : 50 },
        {
          opacity: 1,
          x: 0,
          duration: reducedMotion ? 0 : 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: section,
            start: 'top 80%',
            toggleActions: 'play none none reverse',
          },
        }
      )

      gsap.fromTo(
        dashRef.current,
        { opacity: 0, x: reducedMotion ? 0 : -50, scale: 0.95 },
        {
          opacity: 1,
          x: 0,
          scale: 1,
          duration: reducedMotion ? 0 : 0.9,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: section,
            start: 'top 75%',
            toggleActions: 'play none none reverse',
          },
        }
      )
    }, section)

    return () => ctx.revert()
  }, [reducedMotion])

  return (
    <section
      ref={sectionRef}
      id="scene-organizer"
      aria-labelledby="scene07-heading"
      className="relative py-20 sm:py-28 lg:py-36 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] pointer-events-none -z-10"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(237,71,252,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Dashboard preview */}
        <div ref={dashRef} style={{ opacity: 0 }} className="flex justify-center">
          <OrganizerDashboard />
        </div>

        {/* Copy */}
        <div ref={copyRef} style={{ opacity: 0 }} className="text-center lg:text-left">
          <span className="inline-block text-[11px] uppercase tracking-[0.25em] font-bold text-[#ED47FC] mb-4">
            Club Organizer Portal
          </span>
          <h2
            id="scene07-heading"
            className="text-[1.9rem] sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-[1.1] mb-5"
          >
            You create.{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #ED47FC 0%, #7F1AFB 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              We simplify.
            </span>
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-md mx-auto lg:mx-0 mb-8">
            A complete club management dashboard — from event creation to payment verification and gate check-in. Run your entire event from your phone.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto lg:mx-0">
            {[
              { label: 'Event creation wizard', desc: '5-step guided process' },
              { label: 'Registration management', desc: 'Search, filter, export' },
              { label: 'Payment verification', desc: 'Approve or reject with reasons' },
              { label: 'QR gate scanner', desc: 'Camera-based, no hardware' },
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
      </div>
    </section>
  )
}

