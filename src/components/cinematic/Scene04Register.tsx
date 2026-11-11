/**
 * Scene 04 — Registration Journey
 * "YOUR NEXT EXPERIENCE STARTS HERE."
 * Phone mockup shows event detail → registration form → confirmation screen.
 * Scroll-triggered screen transitions.
 */
import { useRef, useEffect, useState } from 'react'
import { ChevronLeft, Calendar, MapPin, Users, CheckCircle2, Clock } from 'lucide-react'
import { gsap, ScrollTrigger } from '@/lib/gsap'

interface Scene04Props {
  reducedMotion: boolean
}

function RegistrationScreen({ screen }: { screen: 0 | 1 | 2 }) {
  if (screen === 0) {
    // Event detail
    return (
      <div className="flex flex-col h-full bg-[#08080A] text-white overflow-hidden rounded-[inherit]">
        <div className="flex justify-between items-center px-5 pt-3 pb-1 text-[9px] font-semibold text-zinc-400 shrink-0">
          <span>9:41</span>
          <span>●●●</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 shrink-0">
          <ChevronLeft size={12} className="text-zinc-400" />
          <span className="text-[10px] font-semibold text-zinc-400">Event Details</span>
        </div>
        {/* Event banner placeholder */}
        <div
          className="mx-4 h-20 rounded-xl mb-3 shrink-0 flex items-end p-2"
          style={{
            background: 'linear-gradient(135deg, rgba(24,207,252,0.2) 0%, rgba(127,26,251,0.3) 100%)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <span className="text-[8px] text-white/60 font-mono uppercase tracking-wider">
            NEXUS HACKATHON 2026
          </span>
        </div>
        <div className="px-4 flex-1 overflow-hidden flex flex-col gap-2">
          <h3 className="text-xs font-black text-white leading-tight">Nexus Hackathon 2026</h3>
          <div className="flex flex-col gap-1.5">
            {[
              { icon: Calendar, text: 'Nov 14–15, 2026 · 9:00 AM' },
              { icon: MapPin, text: 'Main Campus Auditorium' },
              { icon: Users, text: 'Teams of 2–4 members' },
              { icon: Clock, text: 'Registration closes Nov 12' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-1.5">
                <Icon size={8} className="text-[#18CFFC] shrink-0" />
                <span className="text-[8px] text-zinc-400 leading-tight">{text}</span>
              </div>
            ))}
          </div>
          <div
            className="mt-auto mb-3 py-2 rounded-xl text-center text-[10px] font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, #18CFFC 0%, #0D56FB 60%, #7F1AFB 100%)',
            }}
          >
            Register Now · ₹200
          </div>
        </div>
      </div>
    )
  }

  if (screen === 1) {
    // Registration form
    return (
      <div className="flex flex-col h-full bg-[#08080A] text-white overflow-hidden rounded-[inherit]">
        <div className="flex justify-between items-center px-5 pt-3 pb-1 text-[9px] font-semibold text-zinc-400 shrink-0">
          <span>9:41</span>
          <span>●●●</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 shrink-0">
          <ChevronLeft size={12} className="text-zinc-400" />
          <span className="text-[10px] font-semibold text-zinc-400">Registration</span>
        </div>
        <div className="flex gap-1 px-4 mb-3 shrink-0">
          {[1, 2, 3].map((s, i) => (
            <div
              key={s}
              className="h-1 flex-1 rounded-full"
              style={{
                background:
                  i === 0
                    ? 'linear-gradient(90deg, #18CFFC, #7F1AFB)'
                    : i === 1
                    ? 'rgba(24,207,252,0.3)'
                    : 'rgba(255,255,255,0.1)',
              }}
            />
          ))}
        </div>
        <div className="px-4 flex-1 overflow-hidden flex flex-col gap-2.5">
          <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Your Details</p>
          {['Full Name', 'Roll Number', 'College'].map((field) => (
            <div key={field}>
              <label className="block text-[8px] text-zinc-500 mb-1 font-semibold">{field}</label>
              <div
                className="w-full h-7 rounded-lg px-2 flex items-center"
                style={{ background: '#0E0E12', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {field === 'Full Name' && (
                  <span className="text-[9px] text-white">Priya Sharma</span>
                )}
              </div>
            </div>
          ))}
          <div
            className="mt-auto mb-3 py-2 rounded-xl text-center text-[10px] font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, #18CFFC 0%, #0D56FB 60%, #7F1AFB 100%)',
            }}
          >
            Continue →
          </div>
        </div>
      </div>
    )
  }

  // screen === 2: Success
  return (
    <div className="flex flex-col h-full bg-[#08080A] text-white overflow-hidden rounded-[inherit] items-center justify-center px-5 gap-3">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{
          background: 'rgba(16,185,129,0.1)',
          border: '1px solid rgba(16,185,129,0.3)',
        }}
      >
        <CheckCircle2 size={28} className="text-emerald-400" />
      </div>
      <div className="text-center">
        <p className="text-xs font-black text-white mb-1">Registered!</p>
        <p className="text-[9px] text-zinc-500 leading-snug text-center">
          Your spot is confirmed. Complete payment to secure your digital pass.
        </p>
      </div>
      <div
        className="w-full py-2 rounded-xl text-center text-[10px] font-bold text-white"
        style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}
      >
        Go to Payment →
      </div>
      <div className="flex justify-between items-center w-full px-2">
        <div className="flex justify-between items-center px-5 pt-3 pb-1 text-[9px] font-semibold text-zinc-400 shrink-0 absolute top-0 left-0 right-0">
          <span>9:41</span>
          <span>●●●</span>
        </div>
      </div>
    </div>
  )
}

export function Scene04Register({ reducedMotion }: Scene04Props) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)
  const phoneRef = useRef<HTMLDivElement>(null)
  const [screen, setScreen] = useState<0 | 1 | 2>(0)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        copyRef.current,
        { opacity: 0, y: 40 },
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
        phoneRef.current,
        { opacity: 0, x: reducedMotion ? 0 : 50 },
        {
          opacity: 1,
          x: 0,
          duration: reducedMotion ? 0 : 0.9,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: section,
            start: 'top 75%',
            toggleActions: 'play none none reverse',
          },
        }
      )

      // Cycle through screens as user scrolls through section
      if (!reducedMotion) {
        ScrollTrigger.create({
          trigger: section,
          start: 'top center',
          end: 'bottom top',
          onUpdate: (self) => {
            const p = self.progress
            if (p < 0.33) setScreen(0)
            else if (p < 0.66) setScreen(1)
            else setScreen(2)
          },
        })
      }
    }, section)

    return () => ctx.revert()
  }, [reducedMotion])

  return (
    <section
      ref={sectionRef}
      id="scene-register"
      aria-labelledby="scene04-heading"
      className="relative py-20 sm:py-28 lg:py-36 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-0 -translate-y-1/2 w-[500px] h-[500px] pointer-events-none -z-10"
        style={{
          background:
            'radial-gradient(ellipse 70% 70% at 0% 50%, rgba(127,26,251,0.07) 0%, transparent 70%)',
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Phone first on mobile */}
        <div className="flex justify-center order-first lg:order-first">
          <div
            ref={phoneRef}
            style={{ opacity: 0 }}
            className="relative"
            aria-label="FestFlow registration screen preview"
          >
            <div
              className="relative w-[220px] sm:w-[240px] h-[440px] sm:h-[480px] rounded-[2.5rem] overflow-hidden"
              style={{
                background: '#0A0A0F',
                border: '1.5px solid rgba(255,255,255,0.12)',
                boxShadow:
                  '0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05), 0 0 60px rgba(127,26,251,0.12)',
              }}
            >
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 rounded-b-2xl bg-black z-20"
                aria-hidden="true"
              />
              <div className="h-full pt-2">
                <RegistrationScreen screen={screen} />
              </div>
            </div>
            {/* Screen indicator dots */}
            <div className="flex gap-2 justify-center mt-4" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                  style={{
                    background: i === screen ? '#18CFFC' : 'rgba(255,255,255,0.15)',
                    transform: i === screen ? 'scale(1.3)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
            <div
              aria-hidden="true"
              className="absolute -inset-8 rounded-[3rem] pointer-events-none -z-10"
              style={{
                background:
                  'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(127,26,251,0.10) 0%, transparent 70%)',
              }}
            />
          </div>
        </div>

        {/* Copy */}
        <div ref={copyRef} style={{ opacity: 0 }} className="text-center lg:text-left">
          <span className="inline-block text-[11px] uppercase tracking-[0.25em] font-bold text-[#7F1AFB] mb-4">
            Seamless Registration
          </span>
          <h2
            id="scene04-heading"
            className="text-[1.9rem] sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-[1.1] mb-5"
          >
            Your next experience{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #7F1AFB 0%, #ED47FC 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              starts here.
            </span>
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-md mx-auto lg:mx-0 mb-8">
            Simple forms with inline validation. Team registration built in. Your data is preserved even if something goes wrong — no need to start over.
          </p>

          <div className="flex flex-col gap-3 max-w-md mx-auto lg:mx-0">
            {[
              'Solo and team registration',
              'Inline field validation',
              'Data preserved on errors',
              'Duplicate submission prevention',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(127,26,251,0.15)', border: '1px solid rgba(127,26,251,0.3)' }}
                  aria-hidden="true"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#7F1AFB]" />
                </div>
                <span className="text-sm text-zinc-300">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

