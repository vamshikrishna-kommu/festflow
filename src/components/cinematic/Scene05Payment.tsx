/**
 * Scene 05 — Payment
 * "SIMPLE PAYMENT. CLEAR STATUS."
 * UPI flow with copy action, reference input, pending state.
 * Honest: no "instant approval" messaging.
 */
import { useRef, useEffect } from 'react'
import { Copy, Upload, Clock, ChevronLeft } from 'lucide-react'
import { gsap } from '@/lib/gsap'

interface Scene05Props {
  reducedMotion: boolean
}

function PaymentScreen() {
  return (
    <div className="flex flex-col h-full bg-[#08080A] text-white overflow-hidden rounded-[inherit]">
      <div className="flex justify-between items-center px-5 pt-3 pb-1 text-[9px] font-semibold text-zinc-400 shrink-0">
        <span>9:41</span>
        <span>●●●</span>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 shrink-0">
        <ChevronLeft size={12} className="text-zinc-400" />
        <span className="text-[10px] font-semibold text-zinc-400">Complete Payment</span>
      </div>

      <div className="px-4 flex-1 overflow-hidden flex flex-col gap-2.5 pb-3">
        {/* Amount card */}
        <div
          className="rounded-xl p-3 text-center"
          style={{ background: '#0E0E12', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <p className="text-[8px] text-zinc-500 uppercase tracking-wider mb-1">Amount Due</p>
          <p className="text-xl font-black text-white">₹200</p>
          <p className="text-[8px] text-zinc-500">Nexus Hackathon 2026</p>
        </div>

        {/* UPI ID copy */}
        <div>
          <p className="text-[8px] text-zinc-500 uppercase tracking-wider mb-1.5 font-semibold">
            Pay to UPI ID
          </p>
          <div
            className="flex items-center justify-between px-2.5 py-2 rounded-xl"
            style={{ background: '#0E0E12', border: '1px solid rgba(24,207,252,0.3)' }}
          >
            <span className="text-[9px] font-mono text-[#18CFFC]">nexusclub@okaxis</span>
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[8px] font-bold"
              style={{ background: 'rgba(24,207,252,0.1)', color: '#18CFFC' }}
            >
              <Copy size={7} />
              Copy
            </div>
          </div>
        </div>

        {/* Reference input */}
        <div>
          <p className="text-[8px] text-zinc-500 uppercase tracking-wider mb-1.5 font-semibold">
            Payment Reference / UTR
          </p>
          <div
            className="w-full h-7 rounded-xl px-2 flex items-center"
            style={{ background: '#0E0E12', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <span className="text-[9px] text-zinc-400 font-mono">UTR1234567890</span>
          </div>
        </div>

        {/* Screenshot upload */}
        <div
          className="rounded-xl p-2.5 flex items-center gap-2"
          style={{ background: '#0E0E12', border: '1px dashed rgba(255,255,255,0.15)' }}
        >
          <Upload size={10} className="text-zinc-500 shrink-0" />
          <span className="text-[8px] text-zinc-500">Upload payment screenshot</span>
        </div>

        {/* Submit button */}
        <div
          className="py-2 rounded-xl text-center text-[10px] font-bold text-white"
          style={{
            background: 'linear-gradient(135deg, #18CFFC 0%, #0D56FB 60%, #7F1AFB 100%)',
          }}
        >
          Submit for Verification
        </div>

        {/* Pending state */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          <Clock size={9} className="text-amber-400 shrink-0" />
          <p className="text-[8px] text-amber-400 leading-tight">
            Pending organizer review. You'll be notified once approved.
          </p>
        </div>
      </div>
    </div>
  )
}

export function Scene05Payment({ reducedMotion }: Scene05Props) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)
  const phoneRef = useRef<HTMLDivElement>(null)

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
        phoneRef.current,
        { opacity: 0, x: reducedMotion ? 0 : -50 },
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
    }, section)

    return () => ctx.revert()
  }, [reducedMotion])

  return (
    <section
      ref={sectionRef}
      id="scene-payment"
      aria-labelledby="scene05-heading"
      className="relative py-20 sm:py-28 lg:py-36 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full overflow-hidden"
    >
      <div
        aria-hidden="true"
        className="absolute top-1/2 right-0 -translate-y-1/2 w-[500px] h-[500px] pointer-events-none -z-10"
        style={{
          background:
            'radial-gradient(ellipse 70% 70% at 100% 50%, rgba(13,86,251,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Copy */}
        <div
          ref={copyRef}
          style={{ opacity: 0 }}
          className="text-center lg:text-left order-last lg:order-first"
        >
          <span className="inline-block text-[11px] uppercase tracking-[0.25em] font-bold text-[#07A4FC] mb-4">
            Payment Verification
          </span>
          <h2
            id="scene05-heading"
            className="text-[1.9rem] sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-[1.1] mb-5"
          >
            Simple payment.{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #07A4FC 0%, #0D56FB 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Clear status.
            </span>
          </h2>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-md mx-auto lg:mx-0 mb-8">
            Pay via UPI and submit your reference number. The organizer reviews and approves your payment — you're notified immediately with your ticket status.
          </p>

          <div className="flex flex-col gap-3 max-w-md mx-auto lg:mx-0">
            {[
              { label: 'UPI ID with one-tap copy', color: '#18CFFC' },
              { label: 'Reference number submission', color: '#07A4FC' },
              { label: 'Payment screenshot upload', color: '#0D56FB' },
              { label: 'Real status — pending until verified', color: '#F59E0B' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-3">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: color }}
                  aria-hidden="true"
                />
                <span className="text-sm text-zinc-300">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Phone mockup */}
        <div className="flex justify-center">
          <div
            ref={phoneRef}
            style={{ opacity: 0 }}
            className="relative"
            aria-label="FestFlow payment screen preview"
          >
            <div
              className="relative w-[220px] sm:w-[240px] h-[440px] sm:h-[480px] rounded-[2.5rem] overflow-hidden"
              style={{
                background: '#0A0A0F',
                border: '1.5px solid rgba(255,255,255,0.12)',
                boxShadow:
                  '0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05), 0 0 60px rgba(13,86,251,0.12)',
              }}
            >
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 rounded-b-2xl bg-black z-20"
                aria-hidden="true"
              />
              <div className="h-full pt-2">
                <PaymentScreen />
              </div>
            </div>
            <div
              aria-hidden="true"
              className="absolute -inset-8 rounded-[3rem] pointer-events-none -z-10"
              style={{
                background:
                  'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(13,86,251,0.10) 0%, transparent 70%)',
              }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

