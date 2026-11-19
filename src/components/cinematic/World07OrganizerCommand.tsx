/**
 * FESTFLOW CINEMATIC 4.0 — WORLD 07: THE ORGANIZER COMMAND CENTER
 * Headline: "The Organizer Command Center"
 * Subtitle: "Spatial Operations, Direct Settlements, and Pan-Campus Event Infrastructure"
 *
 * Floating spatial UI panels across 4 key operational stages:
 * 1. Live club dashboard (registrations, direct revenue, attendance rate)
 * 2. 5-step event creation wizard with custom seat map toggle & 0% platform fee
 * 3. Manual UPI verification queue with UTR confirmation & 1-click approvals
 * 4. Attendee roster with 1-click CSV/Excel export
 *
 * Technical Guarantees:
 * - Pinned GSAP ScrollTrigger timeline with deterministic slot crossovers & dark gaps.
 * - Dynamic stage pill derived from timeline progress.
 * - Accessible reduced-motion fallback renders all 4 panels simultaneously in a responsive grid.
 */
import { useRef, useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  FileSpreadsheet,
  TrendingUp,
  DollarSign,
  Users,
  CheckCircle2,
  XCircle,
  ToggleRight,
  ShieldCheck,
  Building2,
  Check,
  Download,
  Search,
  Sparkles,
} from 'lucide-react'
import { gsap } from '@/lib/motion'
import {
  SEQUENTIAL_SLOT,
  resolveActiveStepFromTime,
  type SceneProps,
} from './CinematicShared'

export const ORGANIZER_STAGES = [
  { id: 'dashboard', pill: 'STAGE 1/4 · LIVE METRICS', shortTitle: '1. Live Dashboard', title: 'Live Club Dashboard' },
  { id: 'wizard', pill: 'STAGE 2/4 · 5-STEP EVENT WIZARD', shortTitle: '2. Event Wizard', title: 'Seat Map & 0% Fee Wizard' },
  { id: 'verification', pill: 'STAGE 3/4 · UPI UTR VERIFICATION', shortTitle: '3. Payment Queue', title: 'Manual Payment Queue' },
  { id: 'rosters', pill: 'STAGE 4/4 · ROSTERS & EXPORTS', shortTitle: '4. Roster Export', title: '1-Click CSV/Excel Export' },
] as const

function OrganizerStageScreen({ stageIndex }: { stageIndex: number }) {
  const [approvedList, setApprovedList] = useState<Record<string, boolean>>({
    '429182736152': true,
  })
  const [exported, setExported] = useState<string | null>(null)

  const toggleApproval = (utr: string) => {
    setApprovedList(prev => ({
      ...prev,
      [utr]: !prev[utr],
    }))
  }

  const triggerExport = (format: string) => {
    setExported(format)
    setTimeout(() => setExported(null), 2500)
  }

  switch (stageIndex) {
    case 0:
      // Stage 1: Live Club Dashboard
      return (
        <div className="h-full p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#7F1AFB]/20 border border-[#7F1AFB]/40 flex items-center justify-center text-[#ED47FC] shadow-inner">
                  <Building2 size={16} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white leading-tight font-display">
                    Nexus Tech Club
                  </h3>
                  <span className="text-[9px] font-mono text-zinc-400">
                    OFFICIAL CHAPTER #204 · NIT CAMPUS
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[9px] font-mono font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE AUDITORIUM
              </span>
            </div>

            {/* 3 Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-[#14141A] border border-white/[0.08] relative overflow-hidden">
                <div className="flex items-center justify-between text-zinc-400 mb-1">
                  <span className="text-[9px] font-mono uppercase tracking-wider">REGISTRATIONS</span>
                  <Users size={12} className="text-[#18CFFC]" />
                </div>
                <p className="text-xl sm:text-2xl font-black text-white font-mono">284</p>
                <span className="text-[10px] text-emerald-400 font-medium">95% capacity locked</span>
              </div>

              <div className="p-3 rounded-xl bg-[#14141A] border border-white/[0.08] relative overflow-hidden">
                <div className="flex items-center justify-between text-zinc-400 mb-1">
                  <span className="text-[9px] font-mono uppercase tracking-wider">DIRECT REVENUE</span>
                  <DollarSign size={12} className="text-emerald-400" />
                </div>
                <p className="text-xl sm:text-2xl font-black text-white font-mono">₹42,600</p>
                <span className="text-[10px] text-[#18CFFC] font-mono">100% Direct to Club</span>
              </div>

              <div className="p-3 rounded-xl bg-[#14141A] border border-white/[0.08] relative overflow-hidden">
                <div className="flex items-center justify-between text-zinc-400 mb-1">
                  <span className="text-[9px] font-mono uppercase tracking-wider">GATE CHECK-IN</span>
                  <TrendingUp size={12} className="text-[#ED47FC]" />
                </div>
                <p className="text-xl sm:text-2xl font-black text-white font-mono">94.6%</p>
                <span className="text-[10px] text-[#ED47FC] font-medium">Instant QR verification</span>
              </div>
            </div>

            {/* Capacity Progress Bar */}
            <div className="p-3 rounded-xl bg-[#14141A] border border-white/[0.08] flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white font-display">Nexus Hackathon 2026</span>
                <span className="text-[#18CFFC] font-mono font-bold">284 / 300 Seats Filled</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#18CFFC] via-[#7F1AFB] to-[#ED47FC] w-[95%]" />
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                <span>16 VIP &amp; Regular Seats Left</span>
                <span className="text-amber-400">12 Pending UTR Submissions</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-400">
              REAL-TIME WEBSOCKET SYNC
            </span>
            <Link
              to="/club/signup"
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-[#ED47FC] to-[#7F1AFB] shadow-md shadow-[#7F1AFB]/20 hover:opacity-90 transition-opacity"
            >
              Launch Club Dashboard →
            </Link>
          </div>
        </div>
      )

    case 1:
      // Stage 2: 5-Step Event Creation Wizard with custom seat map toggle & 0% fee
      return (
        <div className="h-full p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-mono font-bold text-[#18CFFC] uppercase flex items-center gap-1.5">
                <Sparkles size={12} />
                5-STEP EVENT CREATION WIZARD
              </span>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-[#18CFFC]/15 text-[#18CFFC]">
                WIZARD STEP 3/5
              </span>
            </div>

            {/* Stepper Tabs */}
            <div className="flex items-center gap-1 text-[8px] sm:text-[9px] font-mono">
              <span className="px-2 py-1 rounded bg-white/10 text-zinc-300">1. Info</span>
              <span className="text-zinc-600">→</span>
              <span className="px-2 py-1 rounded bg-white/10 text-zinc-300">2. Pricing</span>
              <span className="text-zinc-600">→</span>
              <span className="px-2 py-1 rounded bg-[#18CFFC]/20 text-[#18CFFC] font-bold border border-[#18CFFC]/40">
                3. Seat Map
              </span>
              <span className="text-zinc-600">→</span>
              <span className="px-2 py-1 rounded bg-white/5 text-zinc-500">4. UPI</span>
              <span className="text-zinc-600">→</span>
              <span className="px-2 py-1 rounded bg-white/5 text-zinc-500">5. Launch</span>
            </div>

            {/* Custom Cinema Seat Map Builder Toggle */}
            <div className="p-3 rounded-xl bg-[#14141A] border border-[#18CFFC]/30 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-white font-display">
                    Interactive Cinema Seat Map Builder
                  </h4>
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-emerald-400/10 text-emerald-400 font-bold">
                    ENABLED
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-0.5 font-body">
                  Configure custom auditorium layout, tier pricing (VIP, Regular, Free), and live seat reservation locking.
                </p>
              </div>
              <ToggleRight size={28} className="text-[#18CFFC] shrink-0" />
            </div>

            {/* 0% Platform Fee Guarantee */}
            <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-950/40 to-cyan-950/30 border border-emerald-500/30 flex items-start gap-2.5">
              <ShieldCheck size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase">
                    0% PLATFORM COMMISSION GUARANTEE
                  </span>
                </div>
                <p className="text-[10px] text-zinc-300 mt-0.5 leading-relaxed font-body">
                  FestFlow takes zero transaction cuts. All registration funds go straight into your club VPA bank account with zero delay.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-400">
              AUDITORIUM SEAT MAP LIVE
            </span>
            <button
              type="button"
              className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-[#18CFFC] to-[#0D56FB] shadow-md shadow-[#18CFFC]/20 hover:opacity-90"
            >
              Save &amp; Continue to UPI VPA →
            </button>
          </div>
        </div>
      )

    case 2:
      // Stage 3: Manual UPI Verification Queue with UTR confirmation & 1-click approvals
      return (
        <div className="h-full p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-mono font-bold text-emerald-400 uppercase flex items-center gap-1.5">
                <CheckCircle2 size={12} />
                MANUAL UPI VERIFICATION QUEUE
              </span>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-400/10 text-amber-300 border border-amber-400/20">
                12 PENDING VERIFICATIONS
              </span>
            </div>

            {/* List of UTR entries with 1-click approvals */}
            <div className="flex flex-col gap-2">
              {[
                {
                  id: '1',
                  name: 'Aarav Patel',
                  roll: '22CS104',
                  seat: 'Row B · Seat 04',
                  utr: '429182736152',
                  amount: '₹150',
                  bank: 'HDFC UPI',
                },
                {
                  id: '2',
                  name: 'Sneha Nair',
                  roll: '22EC089',
                  seat: 'Row A · Seat 02 (VIP)',
                  utr: '902834192841',
                  amount: '₹250',
                  bank: 'SBI UPI',
                },
                {
                  id: '3',
                  name: 'Vikram Rao',
                  roll: '22ME014',
                  seat: 'Row C · Seat 03',
                  utr: '716253489102',
                  amount: '₹150',
                  bank: 'ICICI UPI',
                },
              ].map((item) => {
                const isApproved = approvedList[item.utr]
                return (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-[#14141A] border border-white/[0.08] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white truncate font-display">
                          {item.name}
                        </span>
                        <span className="text-[9px] font-mono text-zinc-400">({item.roll})</span>
                      </div>
                      <div className="flex items-center gap-2 text-[9px] font-mono text-zinc-400 mt-0.5">
                        <span className="text-[#18CFFC]">{item.seat}</span>
                        <span>•</span>
                        <span className="text-zinc-300 font-bold">UTR: {item.utr}</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-bold">{item.amount}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleApproval(item.utr)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 transition-all ${
                          isApproved
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                        }`}
                      >
                        <Check size={11} />
                        <span>{isApproved ? 'Approved' : 'Approve'}</span>
                      </button>
                      <button
                        type="button"
                        className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-red-400 transition-colors"
                        title="Flag UTR"
                      >
                        <XCircle size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-zinc-400">
            <span>AUTOMATIC DIGITAL PASS ISSUED ON APPROVAL</span>
            <span className="text-emerald-400">ZERO TRANSACTION FEES</span>
          </div>
        </div>
      )

    case 3:
    default:
      // Stage 4: Attendee roster with 1-click CSV/Excel export
      return (
        <div className="h-full p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-mono font-bold text-[#ED47FC] uppercase flex items-center gap-1.5">
                <FileSpreadsheet size={12} />
                ATTENDEE ROSTER &amp; RECONCILIATION
              </span>
              <span className="text-[9px] font-mono text-zinc-400">284 DELEGATES TOTAL</span>
            </div>

            {/* Search & Export Toolbar */}
            <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
              <div className="relative w-full sm:w-60">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  readOnly
                  value="Filter by Roll, Seat, or UTR..."
                  className="w-full bg-[#14141A] border border-white/10 rounded-lg pl-7 pr-3 py-1.5 text-[10px] text-zinc-400 font-mono outline-none"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => triggerExport('CSV')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14141A] hover:bg-white/10 border border-white/15 text-[10px] font-mono font-bold text-white transition-all cursor-pointer"
                >
                  <Download size={11} className="text-[#18CFFC]" />
                  <span>{exported === 'CSV' ? 'Downloaded!' : 'Export CSV'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => triggerExport('Excel')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-[10px] font-mono font-bold text-emerald-300 transition-all cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                >
                  <FileSpreadsheet size={11} className="text-emerald-400" />
                  <span>{exported === 'Excel' ? 'Downloaded .xlsx!' : '1-Click Excel'}</span>
                </button>
              </div>
            </div>

            {/* Roster Table Preview */}
            <div className="rounded-xl border border-white/10 bg-[#14141A] overflow-hidden text-[9px] font-mono">
              <div className="grid grid-cols-5 p-2 bg-white/[0.04] text-zinc-400 font-bold border-b border-white/5 uppercase">
                <span>Attendee</span>
                <span>Roll ID</span>
                <span>Seat</span>
                <span>UTR Ref</span>
                <span className="text-right">Gate Status</span>
              </div>
              {[
                { name: 'Aarav Patel', roll: '22CS104', seat: 'B-04', utr: '429182736152', status: 'Checked In', color: 'text-emerald-400' },
                { name: 'Sneha Nair', roll: '22EC089', seat: 'A-02 (VIP)', utr: '902834192841', status: 'Checked In', color: 'text-emerald-400' },
                { name: 'Vikram Rao', roll: '22ME014', seat: 'C-03', utr: '716253489102', status: 'Registered', color: 'text-[#18CFFC]' },
                { name: 'Tanvi Joshi', roll: '22BT008', seat: 'D-01', utr: '582019482711', status: 'Registered', color: 'text-[#18CFFC]' },
              ].map((row, i) => (
                <div key={i} className="grid grid-cols-5 p-2 border-b border-white/[0.03] text-zinc-300 items-center">
                  <span className="font-bold text-white truncate">{row.name}</span>
                  <span className="text-zinc-400">{row.roll}</span>
                  <span className="text-[#18CFFC]">{row.seat}</span>
                  <span className="text-zinc-400 font-mono">{row.utr.slice(0, 6)}...</span>
                  <span className={`text-right font-bold ${row.color}`}>{row.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-zinc-400">
            <span>OFFLINE AUDITORIUM GATE SCANNING READY</span>
            <span className="text-[#ED47FC]">RECONCILED AUTOMATICALLY</span>
          </div>
        </div>
      )
  }
}

export function World07OrganizerCommand({
  reducedMotion,
  id = 'world-07-organizer',
  className = '',
}: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pinStageRef = useRef<HTMLDivElement>(null)
  const panelRefs = useRef<(HTMLDivElement | null)[]>([])

  const [activeStage, setActiveStage] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    const pinStage = pinStageRef.current
    if (!container || !pinStage || reducedMotion) return

    const panels = panelRefs.current
    if (panels.some((el) => !el)) return

    const ctx = gsap.context(() => {
      // Baseline: Stage 1 visible; 2..4 opacity 0
      gsap.set(panels[0], { opacity: 1, y: 0, scale: 1 })
      gsap.set(panels.slice(1), { opacity: 0, y: 16, scale: 0.96 })

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: 'top top',
          end: `+=${ORGANIZER_STAGES.length * 110}%`,
          pin: pinStage,
          scrub: 0.35,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const stage = resolveActiveStepFromTime(
              self.progress * (ORGANIZER_STAGES.length - 1),
              ORGANIZER_STAGES.length
            )
            setActiveStage(stage)
          },
        },
      })

      // Strict sequential transitions with dead gaps across all 4 stages
      for (let i = 0; i < ORGANIZER_STAGES.length - 1; i++) {
        const cur = panels[i]
        const nxt = panels[i + 1]
        if (!cur || !nxt) continue

        // Current exits cleanly
        tl.to(
          cur,
          {
            opacity: 0,
            y: -16,
            scale: 0.96,
            duration: SEQUENTIAL_SLOT.EXIT_DURATION,
            ease: 'power2.in',
          },
          i + SEQUENTIAL_SLOT.EXIT_OFFSET
        )

        // Next enters cleanly
        tl.fromTo(
          nxt,
          { opacity: 0, y: 16, scale: 0.96 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: SEQUENTIAL_SLOT.ENTER_DURATION,
            ease: 'power2.out',
          },
          i + SEQUENTIAL_SLOT.ENTER_OFFSET
        )
      }

      // Final stage hold
      tl.to({}, { duration: SEQUENTIAL_SLOT.FINAL_HOLD_DURATION })
    }, container)

    return () => ctx.revert()
  }, [reducedMotion])

  const stageMeta = ORGANIZER_STAGES[activeStage] ?? ORGANIZER_STAGES[0]

  return (
    <section
      ref={containerRef}
      id={id}
      aria-label="World 07: The Organizer Command Center"
      className={`relative w-full bg-[#08080A] text-white select-none ${className}`}
    >
      {/* ─── REDUCED MOTION ACCESSIBLE FALLBACK (Responsive 4-panel grid) ─── */}
      {reducedMotion ? (
        <div className="py-16 px-4 max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-mono font-bold text-[#ED47FC] tracking-widest uppercase bg-[#ED47FC]/10 px-3 py-1 rounded-full border border-[#ED47FC]/20">
              WORLD 07 · THE ORGANIZER COMMAND CENTER
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white mt-4 font-display">
              The Organizer Command Center.
            </h2>
            <p className="text-zinc-400 text-sm max-w-xl mx-auto mt-2 font-body">
              Floating spatial panels providing live analytics, 5-step seat wizards, 0% platform commissions, and 1-click roster exports.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {ORGANIZER_STAGES.map((stage, idx) => (
              <div
                key={stage.id}
                className="rounded-2xl bg-[#0E0E12] border border-white/10 p-5 shadow-xl flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
                  <span className="text-[10px] font-mono text-[#ED47FC] font-bold">
                    {stage.pill}
                  </span>
                  <span className="text-sm font-bold text-white font-display">{stage.title}</span>
                </div>
                <div className="min-h-[320px]">
                  <OrganizerStageScreen stageIndex={idx} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ─── FULL PINNED GSAP SCROLL STAGE ─── */
        <div
          ref={pinStageRef}
          className="relative min-h-screen flex flex-col items-center justify-center px-4 py-8 overflow-hidden"
        >
          {/* Header Narrative */}
          <div className="text-center max-w-2xl mx-auto mb-6 sm:mb-8 z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-bold text-[#ED47FC] bg-[#14141A] border border-[#ED47FC]/30 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ED47FC] animate-ping" />
              <span>{stageMeta.pill}</span>
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight font-display">
              The Organizer{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #ED47FC 0%, #7F1AFB 50%, #18CFFC 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Command Center.
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 leading-relaxed font-body">
              Spatial operations suite featuring direct UPI reconciliation, custom seat map designer, and instantaneous roster exports.
            </p>

            {/* Stage Indicator Pills */}
            <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
              {ORGANIZER_STAGES.map((stage, idx) => (
                <div
                  key={stage.id}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono transition-all duration-300 ${
                    activeStage === idx
                      ? 'bg-[#ED47FC]/20 text-[#ED47FC] border border-[#ED47FC]/50 font-bold shadow-[0_0_14px_rgba(237,71,252,0.3)]'
                      : 'bg-white/[0.04] text-zinc-500 border border-transparent'
                  }`}
                >
                  {stage.shortTitle}
                </div>
              ))}
            </div>
          </div>

          {/* Floating Spatial Panel Container */}
          <div className="relative z-10 w-full max-w-3xl h-[420px] sm:h-[400px]">
            <div className="relative w-full h-full rounded-2xl bg-[#0A0A0E]/95 border border-white/20 p-2 sm:p-3 shadow-[0_25px_60px_rgba(0,0,0,0.85),0_0_35px_rgba(237,71,252,0.15)] overflow-hidden backdrop-blur-xl">
              {ORGANIZER_STAGES.map((stage, idx) => (
                <div
                  key={stage.id}
                  ref={(el) => {
                    panelRefs.current[idx] = el
                  }}
                  className="absolute inset-2 sm:inset-3 rounded-xl bg-[#0E0E12] border border-white/10 overflow-hidden"
                  style={{ willChange: 'opacity, transform' }}
                >
                  <OrganizerStageScreen stageIndex={idx} />
                </div>
              ))}
            </div>
          </div>

          {/* Atmospheric Ambient Backlight */}
          <div
            aria-hidden="true"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-gradient-to-tr from-[#7F1AFB]/15 via-[#ED47FC]/15 to-[#07A4FC]/15 rounded-full blur-3xl pointer-events-none -z-10"
          />
        </div>
      )}
    </section>
  )
}

