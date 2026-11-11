/**
 * FESTFLOW MOBILE FILM 2.0 — SCENE 03: THE STUDENT JOURNEY
 * Headline: FROM DISCOVERY TO YOUR PASS.
 *
 * Architectural guarantees:
 * - Strict sequential timeline slots with dead-dark crossover windows (no simultaneous overlaps).
 * - Header step pill derives deterministically from `tl.time()` in both scroll directions.
 * - Authentic registration, UPI submission, manual review, and confirmed digital pass view.
 * - Reduced-motion renders all 6 steps simultaneously in an accessible responsive grid.
 */
import { useRef, useEffect, useState } from 'react'
import {
  Calendar,
  MapPin,
  Clock,
  Copy,
  Upload,
  ChevronLeft,
  Users,
  CheckCircle2,
} from 'lucide-react'
import { gsap } from '@/lib/gsap'
import {
  MobileMockupChassis,
  SEQUENTIAL_SLOT,
  resolveActiveStepFromTime,
} from './CinematicShared'

interface Scene03Props {
  reducedMotion: boolean
}

const STUDENT_STEPS = [
  { id: 'selection', pill: 'STEP 1/6 · EVENT SELECTION', shortTitle: 'Browse Highlight' },
  { id: 'details', pill: 'STEP 2/6 · EVENT DETAILS', shortTitle: 'Inspect Rules' },
  { id: 'register', pill: 'STEP 3/6 · REGISTER', shortTitle: 'Submit Details' },
  { id: 'payment', pill: 'STEP 4/6 · UPI PAYMENT', shortTitle: 'Pay & Enter UTR' },
  { id: 'pending', pill: 'STEP 5/6 · PENDING REVIEW', shortTitle: 'Club Verification' },
  { id: 'pass', pill: 'STEP 6/6 · CONFIRMED PASS', shortTitle: 'Digital Entry Pass' },
] as const

function StudentStepScreen({ stepIndex }: { stepIndex: number }) {
  switch (stepIndex) {
    case 0:
      return (
        <div className="h-full p-2.5 min-[360px]:p-3.5 flex flex-col justify-between">
          <div className="flex flex-col gap-1.5 min-[360px]:gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[8px] min-[360px]:text-[9px] font-mono text-[#18CFFC] uppercase font-bold">
                CAMPUS HIGHLIGHT
              </span>
              <span className="text-[7px] font-mono text-zinc-500 uppercase">SAMPLE</span>
            </div>
            <div className="h-24 min-[360px]:h-28 rounded-xl bg-gradient-to-tr from-[#0D56FB]/30 via-[#7F1AFB]/30 to-[#18CFFC]/20 border border-white/10 flex flex-col justify-end p-2.5 min-[360px]:p-3">
              <span className="text-[8px] min-[360px]:text-[9px] font-bold text-amber-400">₹150 ENTRY</span>
              <h3 className="text-xs min-[360px]:text-sm font-black text-white leading-tight">
                Nexus Hackathon (Demo)
              </h3>
              <p className="text-[9px] min-[360px]:text-[10px] text-zinc-300">48-Hour Prototype Sprint</p>
            </div>
            <div className="p-2 min-[360px]:p-2.5 rounded-xl bg-[#14141A] border border-white/[0.08] text-zinc-300">
              <div className="flex items-center gap-1.5 mb-0.5 text-[10px] min-[360px]:text-[11px] text-white font-bold">
                <Calendar size={11} className="text-[#18CFFC] shrink-0" />
                <span>Nov 14–15 · Main Audi</span>
              </div>
              <p className="text-[9px] min-[360px]:text-[10px] text-zinc-400">Organized by Nexus Tech Club</p>
            </div>
          </div>
          <div className="w-full py-2 min-[360px]:py-2.5 rounded-xl text-center text-[11px] min-[360px]:text-xs font-bold text-white bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB]">
            View Event Details →
          </div>
        </div>
      )

    case 1:
      return (
        <div className="h-full p-2.5 min-[360px]:p-3.5 flex flex-col justify-between">
          <div className="flex flex-col gap-1.5 min-[360px]:gap-2">
            <div className="flex items-center justify-between text-[9px] min-[360px]:text-[10px] text-zinc-400">
              <span className="flex items-center gap-1">
                <ChevronLeft size={11} />
                Back to Discover
              </span>
              <span className="text-[7px] font-mono text-zinc-500">SAMPLE</span>
            </div>
            <h3 className="text-xs min-[360px]:text-sm font-black text-white leading-tight">
              Nexus Hackathon (Demo)
            </h3>
            <div className="flex flex-wrap gap-1">
              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#18CFFC]/15 text-[#18CFFC]">
                TECHNICAL
              </span>
              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-400/15 text-emerald-400">
                REGISTRATION OPEN
              </span>
            </div>
            <div className="p-2 rounded-xl bg-[#14141A] border border-white/[0.08] flex flex-col gap-1.5 text-[9px] min-[360px]:text-[10px] text-zinc-300">
              <span className="flex items-center gap-1.5">
                <Users size={11} className="text-[#18CFFC] shrink-0" /> Team size: 2 to 4 members
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin size={11} className="text-[#18CFFC] shrink-0" /> Main Auditorium + CS Labs
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={11} className="text-[#18CFFC] shrink-0" /> Entry fee: ₹150 per team
              </span>
            </div>
          </div>
          <div className="w-full py-2 min-[360px]:py-2.5 rounded-xl text-center text-[11px] min-[360px]:text-xs font-bold text-white bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB]">
            Register Now (₹150)
          </div>
        </div>
      )

    case 2:
      return (
        <div className="h-full p-2.5 min-[360px]:p-3.5 flex flex-col justify-between">
          <div className="flex flex-col gap-1.5 min-[360px]:gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[8px] min-[360px]:text-[9px] font-mono text-[#7F1AFB] uppercase font-bold">
                ATTENDEE REGISTRATION
              </span>
              <span className="text-[7px] font-mono text-zinc-500">SAMPLE</span>
            </div>
            <p className="text-[11px] min-[360px]:text-xs font-bold text-white leading-tight">
              Attendee Profile
            </p>
            <div className="flex flex-col gap-1.5">
              <div>
                <span className="text-[7px] min-[360px]:text-[8px] text-zinc-500 font-semibold block mb-0.5">
                  FULL NAME
                </span>
                <div className="h-6 min-[360px]:h-7 px-2 rounded-lg bg-[#14141A] border border-white/10 flex items-center text-[9px] min-[360px]:text-[10px] text-white">
                  Aarav Patel (Sample)
                </div>
              </div>
              <div>
                <span className="text-[7px] min-[360px]:text-[8px] text-zinc-500 font-semibold block mb-0.5">
                  COLLEGE / UNIVERSITY
                </span>
                <div className="h-6 min-[360px]:h-7 px-2 rounded-lg bg-[#14141A] border border-white/10 flex items-center text-[9px] min-[360px]:text-[10px] text-zinc-300 truncate">
                  Sample Institute of Technology
                </div>
              </div>
              <div>
                <span className="text-[7px] min-[360px]:text-[8px] text-zinc-500 font-semibold block mb-0.5">
                  PHONE NUMBER
                </span>
                <div className="h-6 min-[360px]:h-7 px-2 rounded-lg bg-[#14141A] border border-white/10 flex items-center text-[9px] min-[360px]:text-[10px] text-zinc-300 font-mono">
                  +91 98XXX XXXXX
                </div>
              </div>
            </div>
          </div>
          <div className="w-full py-2 min-[360px]:py-2.5 rounded-xl text-center text-[11px] min-[360px]:text-xs font-bold text-white bg-gradient-to-r from-[#7F1AFB] to-[#ED47FC]">
            Continue to UPI Payment →
          </div>
        </div>
      )

    case 3:
      return (
        <div className="h-full p-2.5 min-[360px]:p-3.5 flex flex-col justify-between">
          <div className="flex flex-col gap-1.5 min-[360px]:gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[8px] min-[360px]:text-[9px] font-mono text-[#07A4FC] uppercase font-bold">
                DIRECT CLUB UPI
              </span>
              <span className="text-[7px] font-mono text-zinc-500">SAMPLE</span>
            </div>
            <div className="p-2 rounded-xl bg-[#14141A] border border-[#18CFFC]/30 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[7px] min-[360px]:text-[8px] text-zinc-500 uppercase">
                  CLUB UPI ID (DEMO)
                </p>
                <p className="text-[9px] min-[360px]:text-[10px] font-mono font-bold text-[#18CFFC] truncate">
                  nexusclub@okhdfcbank
                </p>
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded bg-[#18CFFC]/10 text-[8px] min-[360px]:text-[9px] font-bold text-[#18CFFC] shrink-0">
                <Copy size={9} /> Copy
              </div>
            </div>
            <div>
              <span className="text-[7px] min-[360px]:text-[8px] text-zinc-500 font-semibold block mb-0.5">
                12-DIGIT UPI UTR / RRN
              </span>
              <div className="h-6 min-[360px]:h-7 px-2 rounded-lg bg-[#14141A] border border-white/15 flex items-center text-[9px] min-[360px]:text-[10px] font-mono text-emerald-400">
                429182736152
              </div>
            </div>
            <div className="p-2 rounded-xl border border-dashed border-white/20 bg-white/[0.02] flex items-center gap-2">
              <Upload size={11} className="text-[#18CFFC] shrink-0" />
              <span className="text-[8px] min-[360px]:text-[9px] text-zinc-300 truncate">
                Payment Receipt Attached (Optional)
              </span>
            </div>
          </div>
          <div className="w-full py-2 min-[360px]:py-2.5 rounded-xl text-center text-[11px] min-[360px]:text-xs font-bold text-white bg-gradient-to-r from-[#18CFFC] to-[#0D56FB]">
            Submit for Club Review
          </div>
        </div>
      )

    case 4:
      return (
        <div className="h-full p-2.5 min-[360px]:p-3.5 flex flex-col items-center justify-center text-center gap-2 min-[360px]:gap-3">
          <div className="w-10 h-10 min-[360px]:w-12 min-[360px]:h-12 rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
            <Clock size={20} />
          </div>
          <div>
            <span className="px-2 py-0.5 rounded text-[8px] font-bold font-mono text-amber-400 bg-amber-400/10 border border-amber-400/30 uppercase">
              STATUS: PENDING REVIEW
            </span>
            <h3 className="text-xs min-[360px]:text-sm font-black text-white mt-1.5 mb-1">
              Reference Submitted
            </h3>
            <p className="text-[9px] min-[360px]:text-[10px] text-zinc-400 leading-snug px-2">
              Sample UTR <span className="font-mono text-zinc-200">429182736152</span> is queued for manual verification by the organizing club.
            </p>
          </div>
          <div className="w-full p-2 rounded-xl bg-[#14141A] border border-white/[0.08] text-[8px] min-[360px]:text-[9px] text-zinc-400 leading-snug">
            Pass unlocks automatically once the organizer approves your UTR against club bank records.
          </div>
        </div>
      )

    case 5:
    default:
      return (
        <div className="h-full p-2.5 min-[360px]:p-3.5 flex flex-col justify-between">
          <div className="flex flex-col gap-1.5 min-[360px]:gap-2">
            <div className="flex items-center justify-between pb-1 border-b border-white/10">
              <span className="text-[8px] min-[360px]:text-[9px] font-mono font-bold text-white uppercase">
                FESTFLOW PASS · DEMO
              </span>
              <span className="px-1.5 py-0.5 rounded text-[7px] min-[360px]:text-[8px] font-bold text-emerald-400 bg-emerald-400/15 border border-emerald-400/30">
                ● CONFIRMED
              </span>
            </div>
            <div>
              <span className="text-[7px] min-[360px]:text-[8px] font-mono text-[#18CFFC] uppercase font-bold">
                VERIFIED ENTRY PASS
              </span>
              <h3 className="text-xs font-black text-white leading-tight">
                Nexus Hackathon (Demo)
              </h3>
              <p className="text-[8px] min-[360px]:text-[9px] text-zinc-400">
                Aarav Patel · Confirmed Seat
              </p>
            </div>
            {/* Authentic Confirmed Pass Code Credential */}
            <div className="p-2.5 rounded-xl bg-[#14141A] border border-emerald-500/30 flex flex-col items-center text-center gap-1">
              <div className="flex items-center gap-1 text-[8px] font-bold text-emerald-400 uppercase tracking-wider">
                <CheckCircle2 size={11} />
                <span>Approved by Host</span>
              </div>
              <span className="font-mono text-xs min-[360px]:text-sm font-black text-white tracking-wider">
                FF-9A4B7C2D
              </span>
              <span className="text-[7px] text-zinc-400 font-mono">
                PASS REFERENCE (SAMPLE)
              </span>
            </div>
          </div>
          <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[7.5px] min-[360px]:text-[8.5px] font-mono text-zinc-400">
            <span>DIGITAL PASS</span>
            <span className="text-emerald-400">CACHED OFFLINE VIEW</span>
          </div>
        </div>
      )
  }
}

export function Scene03StudentJourney({ reducedMotion }: Scene03Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pinStageRef = useRef<HTMLDivElement>(null)
  const phoneFrameRef = useRef<HTMLDivElement>(null)
  const screenRefs = useRef<(HTMLDivElement | null)[]>([])

  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    const pinStage = pinStageRef.current
    if (!container || !pinStage || reducedMotion) return

    const screens = screenRefs.current
    if (screens.some((el) => !el)) return

    const ctx = gsap.context(() => {
      // Initial baseline: only Step 1 visible; Steps 2..6 strictly at opacity 0
      gsap.set(screens[0], { opacity: 1, y: 0, scale: 1 })
      gsap.set(screens.slice(1), { opacity: 0, y: 14, scale: 0.96 })

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: 'top top',
          end: '+=185%',
          scrub: 0.45,
          pin: pinStage,
          pinSpacing: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
        onUpdate: () => {
          const nextIdx = resolveActiveStepFromTime(tl.time(), STUDENT_STEPS.length)
          setActiveStep((prev) => (prev === nextIdx ? prev : nextIdx))
        },
      })

      // Non-overlapping sequential step transitions (dead-dark crossover gap between each pair)
      for (let i = 0; i < STUDENT_STEPS.length - 1; i++) {
        tl.to(
          screens[i],
          {
            opacity: 0,
            y: -14,
            scale: 0.96,
            duration: SEQUENTIAL_SLOT.EXIT_DURATION,
            ease: 'power2.in',
          },
          i + SEQUENTIAL_SLOT.EXIT_OFFSET
        ).fromTo(
          screens[i + 1],
          { opacity: 0, y: 14, scale: 0.96 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: SEQUENTIAL_SLOT.ENTER_DURATION,
            ease: 'power2.out',
            immediateRender: false,
          },
          i + SEQUENTIAL_SLOT.ENTER_OFFSET
        )
      }

      // Hold the final Verified Pass cleanly before unpinning
      tl.to({}, { duration: SEQUENTIAL_SLOT.FINAL_HOLD_DURATION }, STUDENT_STEPS.length - 1)
    }, container)

    return () => ctx.revert()
  }, [reducedMotion])

  if (reducedMotion) {
    return (
      <section
        id="scene-03-journey"
        aria-labelledby="scene03-heading"
        className="relative w-full bg-[#08080A] text-white py-12 sm:py-16 px-4 sm:px-6 overflow-x-clip border-t border-white/[0.06]"
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8 max-w-lg mx-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-[0.18em] uppercase text-[#18CFFC] bg-[#14141A] border border-[#18CFFC]/30 mb-2">
              ALL 6 STUDENT STEPS · REDUCED MOTION VIEW
            </span>
            <h2
              id="scene03-heading"
              className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight"
            >
              FROM DISCOVERY TO{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #7F1AFB 0%, #07A4FC 50%, #18CFFC 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                YOUR PASS.
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {STUDENT_STEPS.map((step, idx) => (
              <article
                key={step.id}
                aria-label={step.pill}
                className="rounded-2xl bg-[#0E0E12] border border-white/12 overflow-hidden flex flex-col"
              >
                <div className="px-3.5 py-2 border-b border-white/[0.08] bg-[#14141A] flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-[#18CFFC]">{step.pill}</span>
                </div>
                <div className="min-h-[290px] flex-1">
                  <StudentStepScreen stepIndex={idx} />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    )
  }

  const currentStep = STUDENT_STEPS[activeStep] || STUDENT_STEPS[0]

  return (
    <section
      ref={containerRef}
      id="scene-03-journey"
      aria-labelledby="scene03-heading"
      className="relative w-full bg-[#08080A] text-white overflow-x-clip select-none"
    >
      <div
        ref={pinStageRef}
        className="relative w-full h-[100dvh] pt-[70px] sm:pt-[82px] pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-6 flex flex-col items-center justify-center px-4 sm:px-6 overflow-hidden"
      >
        {/* Subtle radial glow */}
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] sm:w-[560px] h-[320px] sm:h-[560px] rounded-full pointer-events-none -z-10"
          style={{
            background:
              'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(127,26,251,0.13) 0%, rgba(24,207,252,0.07) 50%, transparent 75%)',
          }}
        />

        {/* Header & Timeline-Synced Step Pill */}
        <div className="text-center mb-2.5 min-[360px]:mb-3.5 sm:mb-5 max-w-md mx-auto">
          <span
            data-testid="scene03-step-pill"
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-mono font-bold tracking-[0.16em] uppercase text-[#a78bfa] bg-[#14141A] border border-[#7F1AFB]/40 mb-1.5 sm:mb-2 shadow-[0_0_12px_rgba(127,26,251,0.18)]"
          >
            {currentStep.pill}
          </span>
          <h2
            id="scene03-heading"
            className="text-[1.35rem] min-[360px]:text-[1.7rem] sm:text-4xl md:text-[2.6rem] font-black text-white tracking-tight leading-[1.1]"
          >
            FROM DISCOVERY TO{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #7F1AFB 0%, #07A4FC 50%, #18CFFC 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              YOUR PASS.
            </span>
          </h2>
        </div>

        {/* Central Smartphone Container */}
        <MobileMockupChassis phoneRef={phoneFrameRef} statusRight="5G" accentGlow="violet">
          <div className="relative w-full h-[calc(100%-22px)]">
            {STUDENT_STEPS.map((step, idx) => (
              <div
                key={step.id}
                ref={(el) => {
                  screenRefs.current[idx] = el
                }}
                aria-hidden={activeStep !== idx}
                style={{
                  zIndex: activeStep === idx ? 10 : 1,
                  pointerEvents: activeStep === idx ? 'auto' : 'none',
                }}
                className="absolute inset-0"
              >
                <StudentStepScreen stepIndex={idx} />
              </div>
            ))}
          </div>
        </MobileMockupChassis>

        {/* Compact Progress Indicator Dots */}
        <div aria-hidden="true" className="flex items-center gap-1.5 mt-2.5 sm:mt-3.5">
          {STUDENT_STEPS.map((s, idx) => (
            <span
              key={s.id}
              className={`h-1 rounded-full transition-all duration-200 ${
                idx === activeStep ? 'w-5 bg-[#18CFFC]' : 'w-1.5 bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
