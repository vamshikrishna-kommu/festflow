/**
 * FESTFLOW MOBILE FILM 2.0 — SCENE 04: THE ORGANIZER EXPERIENCE
 * Headline: YOU CREATE. WE SIMPLIFY.
 *
 * Architectural & Product Authenticity Fixes:
 * - Uses strict non-overlapping sequential transitions & timeline-derived `activeStage` state.
 * - Matches actual EventForm Step 4 (Tickets & Settings) and references Club Payment Settings for UPI ID.
 * - Replaces fake automatic screenshot verification with honest manual UTR review instructions.
 * - Displays realistic attendee roster filtering, CSV/Excel exports, and completed event archives.
 * - Reduced-motion renders all 4 organizer stages simultaneously in an accessible grid.
 */
import { useRef, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { FileSpreadsheet } from 'lucide-react'
import { gsap } from '@/lib/gsap'
import {
  MobileMockupChassis,
  SEQUENTIAL_SLOT,
  resolveActiveStepFromTime,
} from './CinematicShared'

interface Scene04Props {
  reducedMotion: boolean
}

const ORGANIZER_STAGES = [
  { id: 'dashboard', pill: 'ORGANIZER · CLUB COMMAND CENTER' },
  { id: 'wizard', pill: 'ORGANIZER · 5-STEP EVENT WIZARD' },
  { id: 'verification', pill: 'ORGANIZER · PAYMENT VERIFICATION' },
  { id: 'rosters', pill: 'ORGANIZER · ROSTERS & EXPORTS' },
] as const

function OrganizerStageScreen({ stageIndex }: { stageIndex: number }) {
  switch (stageIndex) {
    case 0:
      return (
        <div className="h-full p-2.5 min-[360px]:p-3.5 flex flex-col justify-between">
          <div className="flex flex-col gap-1.5 min-[360px]:gap-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
              <div>
                <span className="text-[7px] min-[360px]:text-[8px] font-mono text-zinc-400 uppercase">
                  CHAPTER PORTAL · SAMPLE
                </span>
                <h3 className="text-[11px] min-[360px]:text-xs font-black text-white leading-tight">
                  Nexus Tech Club
                </h3>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[7px] min-[360px]:text-[8px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/25">
                ● VERIFIED
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 min-[360px]:gap-2">
              <div className="p-2 rounded-xl bg-[#14141A] border border-white/[0.08]">
                <p className="text-[7px] min-[360px]:text-[8px] text-zinc-500 uppercase font-mono">
                  REGISTRATIONS
                </p>
                <p className="text-sm min-[360px]:text-base font-black text-white">284</p>
                <span className="text-[7px] min-[360px]:text-[8px] text-[#18CFFC]">Sample metric</span>
              </div>
              <div className="p-2 rounded-xl bg-[#14141A] border border-white/[0.08]">
                <p className="text-[7px] min-[360px]:text-[8px] text-zinc-500 uppercase font-mono">
                  PENDING UPI
                </p>
                <p className="text-sm min-[360px]:text-base font-black text-amber-400">12</p>
                <span className="text-[7px] min-[360px]:text-[8px] text-zinc-400">Needs review</span>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-[#14141A] border border-white/[0.08] flex flex-col gap-1">
              <div className="flex items-center justify-between text-[9px] min-[360px]:text-[10px]">
                <span className="font-bold text-white truncate">Nexus Hackathon (Demo)</span>
                <span className="text-[#18CFFC] font-mono font-bold shrink-0">95% Full</span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] w-[95%]" />
              </div>
              <span className="text-[7.5px] min-[360px]:text-[8px] text-zinc-400">
                Sample capacity: 284 / 300 · CSV & Excel exports ready
              </span>
            </div>
          </div>

          <Link
            to="/club/signup"
            className="w-full py-2 min-[360px]:py-2.5 rounded-xl text-center text-[11px] min-[360px]:text-xs font-bold text-white bg-gradient-to-r from-[#ED47FC] to-[#7F1AFB]"
          >
            Launch Club Dashboard →
          </Link>
        </div>
      )

    case 1:
      return (
        <div className="h-full p-2.5 min-[360px]:p-3.5 flex flex-col justify-between">
          <div className="flex flex-col gap-1.5 min-[360px]:gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[8px] min-[360px]:text-[9px] font-mono text-[#18CFFC] uppercase font-bold">
                STEP 4 OF 5 · TICKETS & SETTINGS
              </span>
              <span className="text-[7px] font-mono text-zinc-500">SAMPLE</span>
            </div>
            <h3 className="text-[11px] min-[360px]:text-xs font-black text-white leading-tight">
              Ticket Pricing & Capacity
            </h3>
            <div className="p-2 min-[360px]:p-2.5 rounded-xl bg-[#14141A] border border-white/10 flex flex-col gap-1.5 min-[360px]:gap-2">
              <div>
                <span className="text-[7px] min-[360px]:text-[8px] text-zinc-500 font-semibold block mb-0.5">
                  ADMISSION TYPE
                </span>
                <div className="h-6 min-[360px]:h-7 px-2 rounded-lg bg-[#0E0E12] border border-white/10 flex items-center justify-between text-[9px] min-[360px]:text-[10px]">
                  <span className="text-white">Paid Ticket (Direct UPI)</span>
                  <span className="text-emerald-400 font-mono font-bold">₹150</span>
                </div>
              </div>
              <div>
                <span className="text-[7px] min-[360px]:text-[8px] text-zinc-500 font-semibold block mb-0.5">
                  PAYOUT CHANNEL
                </span>
                <div className="min-h-[24px] min-[360px]:min-h-[28px] px-2 py-1 rounded-lg bg-[#0E0E12] border border-white/10 flex items-center text-[8.5px] min-[360px]:text-[9.5px] text-[#18CFFC] font-mono">
                  Club Payment Settings UPI ID
                </div>
              </div>
              <p className="text-[7.5px] min-[360px]:text-[8px] text-zinc-400 leading-snug">
                Direct transfer to your club's saved UPI ID. 0% platform commission fee for colleges.
              </p>
            </div>
          </div>
          <div className="w-full py-2 min-[360px]:py-2.5 rounded-xl text-center text-[11px] min-[360px]:text-xs font-bold text-white bg-gradient-to-r from-[#18CFFC] to-[#0D56FB]">
            Next: Review & Publish →
          </div>
        </div>
      )

    case 2:
      return (
        <div className="h-full p-2.5 min-[360px]:p-3.5 flex flex-col justify-between">
          <div className="flex flex-col gap-1.5 min-[360px]:gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[8px] min-[360px]:text-[9px] font-mono text-amber-400 uppercase font-bold">
                PENDING REVIEW QUEUE
              </span>
              <span className="text-[7px] font-mono text-zinc-500">SAMPLE</span>
            </div>
            <div className="p-2 min-[360px]:p-2.5 rounded-xl bg-[#14141A] border border-white/10 flex flex-col gap-1.5 min-[360px]:gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-white truncate">Aarav Patel (Demo)</p>
                  <p className="text-[7.5px] min-[360px]:text-[8px] text-zinc-400">Team Leader Registration</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[8px] font-mono font-bold text-amber-400 bg-amber-400/10 shrink-0">
                  ₹150
                </span>
              </div>
              <div className="p-1.5 rounded-lg bg-[#0E0E12] border border-white/[0.06] text-[8.5px] min-[360px]:text-[9px] font-mono">
                <span className="text-zinc-500">UTR: </span>
                <span className="text-emerald-400 font-bold">429182736152</span>
              </div>
              <div className="p-2 rounded-lg bg-zinc-900/90 border border-white/10 text-center text-[8px] min-[360px]:text-[9px] text-zinc-300 leading-snug">
                Receipt Attached · Verify UTR in your UPI bank app before approving
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 min-[360px]:gap-2">
            <div className="py-2 min-[360px]:py-2.5 rounded-xl text-center text-[10px] min-[360px]:text-xs font-bold text-white bg-emerald-600">
              Approve Pass
            </div>
            <div className="py-2 min-[360px]:py-2.5 rounded-xl text-center text-[10px] min-[360px]:text-xs font-bold text-zinc-200 bg-white/10">
              Reject (Reason)
            </div>
          </div>
        </div>
      )

    case 3:
    default:
      return (
        <div className="h-full p-2.5 min-[360px]:p-3.5 flex flex-col justify-between">
          <div className="flex flex-col gap-1.5 min-[360px]:gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[8px] min-[360px]:text-[9px] font-mono text-emerald-400 uppercase font-bold">
                ATTENDEE ROSTERS & EXPORTS
              </span>
              <span className="text-[7px] font-mono text-zinc-500">SAMPLE</span>
            </div>

            {/* Roster List Preview */}
            <div className="flex flex-col gap-1.5">
              <div className="p-2 rounded-xl bg-[#14141A] border border-white/[0.08] flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[9.5px] min-[360px]:text-[10.5px] font-bold text-white truncate">
                    Aarav Patel
                  </p>
                  <span className="text-[7.5px] font-mono text-zinc-400">#FF-9A4B7C2D</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[7px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/25">
                  Confirmed
                </span>
              </div>

              <div className="p-2 rounded-xl bg-[#14141A] border border-white/[0.08] flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[9.5px] min-[360px]:text-[10.5px] font-bold text-white truncate">
                    Diya Nair
                  </p>
                  <span className="text-[7.5px] font-mono text-zinc-400">#FF-4C1E88B0</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[7px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/25">
                  Confirmed
                </span>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-[#18CFFC]/10 border border-[#18CFFC]/25 text-[8.5px] min-[360px]:text-[9.5px] text-[#18CFFC] flex items-center gap-2">
              <FileSpreadsheet size={13} className="shrink-0" />
              <span className="leading-tight font-medium">
                1-Click CSV & Formatted Excel Reports
              </span>
            </div>
          </div>

          <div className="p-2 rounded-xl bg-[#14141A] border border-white/[0.08] flex items-center justify-between text-[8px] min-[360px]:text-[9px] text-zinc-400">
            <span>CONFIRMED ROSTER (SAMPLE)</span>
            <span className="font-mono font-bold text-white">284 / 300</span>
          </div>
        </div>
      )
  }
}

export function Scene04OrganizerExperience({ reducedMotion }: Scene04Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pinStageRef = useRef<HTMLDivElement>(null)
  const stageRefs = useRef<(HTMLDivElement | null)[]>([])

  const [activeStage, setActiveStage] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    const pinStage = pinStageRef.current
    if (!container || !pinStage || reducedMotion) return

    const stages = stageRefs.current
    if (stages.some((el) => !el)) return

    const ctx = gsap.context(() => {
      gsap.set(stages[0], { opacity: 1, scale: 1, y: 0 })
      gsap.set(stages.slice(1), { opacity: 0, scale: 0.96, y: 14 })

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: 'top top',
          end: '+=140%',
          scrub: 0.45,
          pin: pinStage,
          pinSpacing: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
        onUpdate: () => {
          const nextIdx = resolveActiveStepFromTime(tl.time(), ORGANIZER_STAGES.length)
          setActiveStage((prev) => (prev === nextIdx ? prev : nextIdx))
        },
      })

      for (let i = 0; i < ORGANIZER_STAGES.length - 1; i++) {
        tl.to(
          stages[i],
          {
            opacity: 0,
            scale: 0.96,
            y: -14,
            duration: SEQUENTIAL_SLOT.EXIT_DURATION,
            ease: 'power2.in',
          },
          i + SEQUENTIAL_SLOT.EXIT_OFFSET
        ).fromTo(
          stages[i + 1],
          { opacity: 0, scale: 0.96, y: 14 },
          {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: SEQUENTIAL_SLOT.ENTER_DURATION,
            ease: 'power2.out',
            immediateRender: false,
          },
          i + SEQUENTIAL_SLOT.ENTER_OFFSET
        )
      }

      tl.to({}, { duration: SEQUENTIAL_SLOT.FINAL_HOLD_DURATION }, ORGANIZER_STAGES.length - 1)
    }, container)

    return () => ctx.revert()
  }, [reducedMotion])

  if (reducedMotion) {
    return (
      <section
        id="scene-04-organizer"
        aria-labelledby="scene04-heading"
        className="relative w-full bg-[#08080A] text-white py-12 sm:py-16 px-4 sm:px-6 overflow-x-clip border-t border-white/[0.06]"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 max-w-lg mx-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-[0.18em] uppercase text-[#ED47FC] bg-[#14141A] border border-[#ED47FC]/30 mb-2">
              ALL 4 ORGANIZER STAGES · REDUCED MOTION VIEW
            </span>
            <h2
              id="scene04-heading"
              className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight"
            >
              YOU CREATE.{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #ED47FC 0%, #7F1AFB 60%, #18CFFC 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                WE SIMPLIFY.
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ORGANIZER_STAGES.map((stage, idx) => (
              <article
                key={stage.id}
                aria-label={stage.pill}
                className="rounded-2xl bg-[#0E0E12] border border-white/12 overflow-hidden flex flex-col"
              >
                <div className="px-3 py-2 border-b border-white/[0.08] bg-[#14141A]">
                  <span className="text-[9px] font-mono font-bold text-[#ED47FC]">{stage.pill}</span>
                </div>
                <div className="min-h-[290px] flex-1">
                  <OrganizerStageScreen stageIndex={idx} />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    )
  }

  const currentStage = ORGANIZER_STAGES[activeStage] || ORGANIZER_STAGES[0]

  return (
    <section
      ref={containerRef}
      id="scene-04-organizer"
      aria-labelledby="scene04-heading"
      className="relative w-full bg-[#08080A] text-white overflow-x-clip select-none"
    >
      <div
        ref={pinStageRef}
        className="relative w-full h-[100dvh] pt-[70px] sm:pt-[82px] pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:pb-6 flex flex-col items-center justify-center px-4 sm:px-6 overflow-hidden"
      >
        {/* Subtle magenta radial glow */}
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] sm:w-[560px] h-[320px] sm:h-[560px] rounded-full pointer-events-none -z-10"
          style={{
            background:
              'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(237,71,252,0.12) 0%, rgba(127,26,251,0.07) 50%, transparent 75%)',
          }}
        />

        {/* Section Header */}
        <div className="text-center mb-2.5 min-[360px]:mb-3.5 sm:mb-5 max-w-md mx-auto">
          <span
            data-testid="scene04-stage-pill"
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-mono font-bold tracking-[0.16em] uppercase text-[#ED47FC] bg-[#14141A] border border-[#ED47FC]/30 mb-1.5 sm:mb-2 shadow-[0_0_12px_rgba(237,71,252,0.18)]"
          >
            {currentStage.pill}
          </span>
          <h2
            id="scene04-heading"
            className="text-[1.35rem] min-[360px]:text-[1.75rem] sm:text-4xl md:text-[2.6rem] font-black text-white tracking-tight leading-[1.1]"
          >
            YOU CREATE.{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #ED47FC 0%, #7F1AFB 60%, #18CFFC 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              WE SIMPLIFY.
            </span>
          </h2>
        </div>

        {/* Organizer Smartphone Viewfinder */}
        <MobileMockupChassis statusRight="ORGANIZER" accentGlow="magenta">
          <div className="relative w-full h-[calc(100%-22px)]">
            {ORGANIZER_STAGES.map((stage, idx) => (
              <div
                key={stage.id}
                ref={(el) => {
                  stageRefs.current[idx] = el
                }}
                aria-hidden={activeStage !== idx}
                style={{
                  zIndex: activeStage === idx ? 10 : 1,
                  pointerEvents: activeStage === idx ? 'auto' : 'none',
                }}
                className="absolute inset-0"
              >
                <OrganizerStageScreen stageIndex={idx} />
              </div>
            ))}
          </div>
        </MobileMockupChassis>

        {/* Stage Dots */}
        <div aria-hidden="true" className="flex items-center gap-1.5 mt-2.5 sm:mt-3.5">
          {ORGANIZER_STAGES.map((s, idx) => (
            <span
              key={s.id}
              className={`h-1 rounded-full transition-all duration-200 ${
                idx === activeStage ? 'w-5 bg-[#ED47FC]' : 'w-1.5 bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
