/**
 * Scene 06 — Digital Ticket
 * "YOUR TICKET. ALWAYS WITHIN REACH."
 * Digital boarding-pass style ticket with decorative SVG QR. Full-width reveal.
 */
import { useRef, useEffect } from 'react'
import { Calendar, MapPin, QrCode } from 'lucide-react'
import { gsap } from '@/lib/gsap'

interface Scene06Props {
  reducedMotion: boolean
}

function DigitalTicket() {
  return (
    <div
      className="relative w-full max-w-[300px] sm:max-w-[320px] mx-auto"
      aria-label="FestFlow digital ticket preview"
      role="img"
    >
      {/* Main ticket card */}
      <div
        className="rounded-3xl overflow-hidden"
        style={{
          background: '#0E0E12',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow:
            '0 32px 64px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04), 0 0 60px rgba(24,207,252,0.15)',
        }}
      >
        {/* Top section */}
        <div
          className="p-5 pb-4"
          style={{
            background: 'linear-gradient(135deg, rgba(24,207,252,0.08) 0%, rgba(127,26,251,0.08) 100%)',
            borderBottom: '1px dashed rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: '#18CFFC' }}
                aria-hidden="true"
              />
              <span className="text-[9px] font-bold tracking-widest text-white uppercase font-mono">
                FESTFLOW PASS
              </span>
            </div>
            <span
              className="px-2 py-0.5 rounded-full text-[8px] font-bold"
              style={{
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.3)',
                color: '#10B981',
              }}
            >
              ● VERIFIED
            </span>
          </div>

          <span className="text-[9px] uppercase font-mono tracking-widest text-[#18CFFC] block mb-1.5">
            ALL-ACCESS PASS
          </span>
          <h3 className="text-base font-black text-white leading-tight mb-3">
            Nexus Hackathon 2026
          </h3>

          <div className="flex flex-col gap-1.5">
            {[
              { icon: Calendar, text: 'Nov 14–15, 2026 · 9:00 AM' },
              { icon: MapPin, text: 'Main Campus Auditorium' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5">
                <Icon size={9} className="text-[#18CFFC] shrink-0" />
                <span className="text-[9px] text-zinc-400">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* QR section */}
        <div className="p-5 flex flex-col items-center gap-3">
          <div className="bg-white p-3 rounded-xl">
            {/* Decorative SVG QR — NOT a real scannable code */}
            <svg
              width="120"
              height="120"
              viewBox="0 0 140 140"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="select-none"
              aria-label="Demonstration pass QR code"
              aria-hidden="true"
            >
              <rect x="8" y="8" width="36" height="36" rx="4" fill="#08080A" />
              <rect x="14" y="14" width="24" height="24" rx="2" fill="#FFFFFF" />
              <rect x="20" y="20" width="12" height="12" rx="1" fill="#18CFFC" />
              <rect x="96" y="8" width="36" height="36" rx="4" fill="#08080A" />
              <rect x="102" y="14" width="24" height="24" rx="2" fill="#FFFFFF" />
              <rect x="108" y="20" width="12" height="12" rx="1" fill="#18CFFC" />
              <rect x="8" y="96" width="36" height="36" rx="4" fill="#08080A" />
              <rect x="14" y="102" width="24" height="24" rx="2" fill="#FFFFFF" />
              <rect x="20" y="108" width="12" height="12" rx="1" fill="#18CFFC" />
              <rect x="52" y="12" width="8" height="8" fill="#08080A" />
              <rect x="68" y="12" width="8" height="8" fill="#08080A" />
              <rect x="52" y="28" width="12" height="8" fill="#08080A" />
              <rect x="72" y="28" width="8" height="16" fill="#08080A" />
              <rect x="16" y="52" width="16" height="8" fill="#08080A" />
              <rect x="40" y="52" width="8" height="16" fill="#18CFFC" />
              <rect x="56" y="52" width="28" height="8" fill="#08080A" />
              <rect x="92" y="52" width="12" height="8" fill="#08080A" />
              <rect x="112" y="52" width="16" height="8" fill="#08080A" />
              <rect x="12" y="72" width="8" height="16" fill="#08080A" />
              <rect x="28" y="72" width="16" height="8" fill="#08080A" />
              <rect x="52" y="68" width="16" height="16" rx="2" fill="#18CFFC" />
              <rect x="76" y="72" width="12" height="16" fill="#08080A" />
              <rect x="96" y="68" width="8" height="20" fill="#08080A" />
              <rect x="112" y="72" width="16" height="8" fill="#08080A" />
              <rect x="52" y="96" width="8" height="16" fill="#08080A" />
              <rect x="68" y="104" width="20" height="8" fill="#08080A" />
              <rect x="96" y="96" width="12" height="16" fill="#08080A" />
              <rect x="116" y="104" width="12" height="8" fill="#18CFFC" />
              <rect x="52" y="120" width="20" height="8" fill="#08080A" />
              <rect x="80" y="120" width="16" height="8" fill="#08080A" />
              <rect x="104" y="120" width="24" height="8" fill="#08080A" />
            </svg>
          </div>

          <div className="text-center">
            <p className="font-mono text-[8px] text-zinc-600 font-bold tracking-widest uppercase">
              DEMO PASS #FF-2026-NEXUS
            </p>
          </div>

          <div
            className="w-full pt-3 flex items-center justify-between text-[9px] font-mono text-zinc-400"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            <span>GATE: AUDI-NORTH</span>
            <span style={{ color: '#F59E0B' }}>TIER: TEAM LEADER</span>
          </div>
        </div>
      </div>

      {/* Floating logo badge */}
      <div
        className="absolute -bottom-4 left-1/2 -translate-x-1/2"
        aria-hidden="true"
      >
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[8px] font-bold text-white"
          style={{
            background: '#08080A',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        >
          <QrCode size={9} className="text-[#18CFFC]" />
          Powered by FestFlow
        </div>
      </div>
    </div>
  )
}

export function Scene06Ticket({ reducedMotion }: Scene06Props) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const headlineRef = useRef<HTMLDivElement>(null)
  const ticketRef = useRef<HTMLDivElement>(null)
  const featuresRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        headlineRef.current,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
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

      gsap.fromTo(
        ticketRef.current,
        { opacity: 0, y: 50, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: reducedMotion ? 0 : 1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: section,
            start: 'top 75%',
            toggleActions: 'play none none reverse',
          },
        }
      )

      if (!reducedMotion) {
        gsap.to(ticketRef.current, {
          y: -8,
          duration: 3,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          delay: 1,
        })
      }

      gsap.fromTo(
        featuresRef.current,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: reducedMotion ? 0 : 0.7,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: featuresRef.current,
            start: 'top 85%',
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
      id="scene-ticket"
      aria-labelledby="scene06-heading"
      className="relative py-20 sm:py-28 lg:py-36 px-4 sm:px-6 lg:px-8 overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #08080A 0%, #0A0A10 100%)' }}
    >
      {/* Background */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] pointer-events-none -z-10"
        style={{
          background:
            'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(24,207,252,0.06) 0%, rgba(13,86,251,0.04) 50%, transparent 80%)',
        }}
      />

      <div className="max-w-6xl mx-auto w-full">
        {/* Headline */}
        <div ref={headlineRef} style={{ opacity: 0 }} className="text-center mb-14 sm:mb-16">
          <span className="inline-block text-[11px] uppercase tracking-[0.25em] font-bold text-[#18CFFC] mb-4">
            Digital Passes
          </span>
          <h2
            id="scene06-heading"
            className="text-[1.9rem] sm:text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1] mb-4"
          >
            Your ticket.{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #18CFFC 0%, #07A4FC 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Always within reach.
            </span>
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 max-w-md mx-auto leading-relaxed">
            Your digital pass is always in your pocket. Gate scanners verify in under a second with live duplicate prevention.
          </p>
        </div>

        {/* Ticket + features */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div ref={ticketRef} style={{ opacity: 0 }} className="flex justify-center pb-8">
            <DigitalTicket />
          </div>

          <div ref={featuresRef} style={{ opacity: 0 }} className="flex flex-col gap-5">
            {[
              {
                label: 'Cryptographic verification',
                desc: 'Each pass is tamper-resistant and tied to the registered student.',
                color: '#18CFFC',
              },
              {
                label: 'Sub-second camera scan',
                desc: 'Gate volunteers scan with any smartphone — no special hardware needed.',
                color: '#07A4FC',
              },
              {
                label: 'Live duplicate prevention',
                desc: 'The same pass cannot be scanned twice. Screenshots and sharing are blocked.',
                color: '#0D56FB',
              },
              {
                label: 'Offline-ready access',
                desc: 'Your pass is cached locally. No internet required at the gate.',
                color: '#7F1AFB',
              },
            ].map(({ label, desc, color }) => (
              <div key={label} className="flex gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: `${color}12`,
                    border: `1px solid ${color}25`,
                  }}
                  aria-hidden="true"
                >
                  <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">{label}</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

