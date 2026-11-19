/**
 * FESTFLOW CINEMATIC 4.0 — WORLD 06: THE STUDENT JOURNEY
 * Headline: "The Student Journey"
 * Subtitle: "From Discovery to Gate-Verified Digital Pass"
 *
 * Real student workflow inside MobileMockupChassis across 7 distinct stages:
 * 1. Explore events (Campus highlight, entry fee, tags)
 * 2. Open schedule & rules (Timeline, rules, team requirements)
 * 3. Register profile (Auto-filled student credentials)
 * 4. Interactive Cinema Seat Map (Curved stage, Rows A-D with VIP/Regular/Free categories, legend, interactive selection, seat count badge)
 * 5. Complete participant details (Emergency contact, team members, preferences)
 * 6. Direct UPI payment & 12-digit UTR submission (0% platform fee, 1-click copy VPA, verified UTR format)
 * 7. Verified digital ticket with QR and venue gate attendance status (Gate 2 Ready, offline pass)
 *
 * Technical Guarantees:
 * - Pinned GSAP ScrollTrigger timeline with deterministic slot crossovers & dark gaps.
 * - Header step pill derives dynamically from timeline position.
 * - Accessible reduced-motion fallback renders all 7 steps simultaneously in a responsive grid.
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
  Armchair,
  QrCode,
  Sparkles,
  ShieldCheck,
  Check,
  CreditCard,
  UserCheck,
  FileText,
  Crown,
} from 'lucide-react'
import { gsap } from '@/lib/motion'
import {
  MobileMockupChassis,
  SEQUENTIAL_SLOT,
  resolveActiveStepFromTime,
  type SceneProps,
} from './CinematicShared'

export const STUDENT_STEPS = [
  { id: 'selection', pill: 'STEP 1/7 · EXPLORE EVENTS', shortTitle: '1. Explore' },
  { id: 'schedule', pill: 'STEP 2/7 · SCHEDULE & RULES', shortTitle: '2. Schedule' },
  { id: 'profile', pill: 'STEP 3/7 · STUDENT PROFILE', shortTitle: '3. Profile' },
  { id: 'seating', pill: 'STEP 4/7 · CINEMA SEAT MAP', shortTitle: '4. Seat Map' },
  { id: 'participants', pill: 'STEP 5/7 · PARTICIPANT DETAILS', shortTitle: '5. Details' },
  { id: 'payment', pill: 'STEP 6/7 · DIRECT UPI & UTR', shortTitle: '6. UPI Pay' },
  { id: 'ticket', pill: 'STEP 7/7 · VERIFIED FASTPASS', shortTitle: '7. Gate Pass' },
] as const

// Interactive Cinema Seat Map Data for Stage 4
interface SeatItem {
  id: string
  label: string
  category: 'vip' | 'regular' | 'free'
  status: 'available' | 'booked'
}

const INITIAL_SEAT_LAYOUT: { row: string; category: 'vip' | 'regular' | 'free'; seats: SeatItem[] }[] = [
  {
    row: 'A',
    category: 'vip',
    seats: [
      { id: 'A-1', label: 'A1', category: 'vip', status: 'booked' },
      { id: 'A-2', label: 'A2', category: 'vip', status: 'available' },
      { id: 'A-3', label: 'A3', category: 'vip', status: 'available' },
      { id: 'A-4', label: 'A4', category: 'vip', status: 'booked' },
      { id: 'A-5', label: 'A5', category: 'vip', status: 'available' },
      { id: 'A-6', label: 'A6', category: 'vip', status: 'booked' },
    ],
  },
  {
    row: 'B',
    category: 'regular',
    seats: [
      { id: 'B-1', label: 'B1', category: 'regular', status: 'available' },
      { id: 'B-2', label: 'B2', category: 'regular', status: 'booked' },
      { id: 'B-3', label: 'B3', category: 'regular', status: 'booked' },
      { id: 'B-4', label: 'B4', category: 'regular', status: 'available' },
      { id: 'B-5', label: 'B5', category: 'regular', status: 'available' },
      { id: 'B-6', label: 'B6', category: 'regular', status: 'booked' },
    ],
  },
  {
    row: 'C',
    category: 'regular',
    seats: [
      { id: 'C-1', label: 'C1', category: 'regular', status: 'booked' },
      { id: 'C-2', label: 'C2', category: 'regular', status: 'available' },
      { id: 'C-3', label: 'C3', category: 'regular', status: 'available' },
      { id: 'C-4', label: 'C4', category: 'regular', status: 'available' },
      { id: 'C-5', label: 'C5', category: 'regular', status: 'booked' },
      { id: 'C-6', label: 'C6', category: 'regular', status: 'available' },
    ],
  },
  {
    row: 'D',
    category: 'free',
    seats: [
      { id: 'D-1', label: 'D1', category: 'free', status: 'available' },
      { id: 'D-2', label: 'D2', category: 'free', status: 'available' },
      { id: 'D-3', label: 'D3', category: 'free', status: 'booked' },
      { id: 'D-4', label: 'D4', category: 'free', status: 'available' },
      { id: 'D-5', label: 'D5', category: 'free', status: 'booked' },
      { id: 'D-6', label: 'D6', category: 'free', status: 'available' },
    ],
  },
]

function StudentStepScreen({ stepIndex }: { stepIndex: number }) {
  const [copied, setCopied] = useState(false)
  const [selectedSeat, setSelectedSeat] = useState<string>('B-4')

  const handleCopyUpi = () => {
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleSeat = (seatId: string, status: 'available' | 'booked') => {
    if (status === 'booked') return
    setSelectedSeat(prev => (prev === seatId ? '' : seatId))
  }

  switch (stepIndex) {
    case 0:
      // Step 1: Explore events
      return (
        <div className="h-full p-2.5 min-[360px]:p-3 flex flex-col justify-between">
          <div className="flex flex-col gap-1.5 min-[360px]:gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[8px] min-[360px]:text-[9px] font-mono text-[#18CFFC] uppercase font-bold tracking-wider flex items-center gap-1">
                <Sparkles size={10} />
                CAMPUS SPOTLIGHT
              </span>
              <span className="px-1.5 py-0.5 rounded text-[7px] font-mono font-semibold bg-white/[0.08] text-zinc-400 uppercase">
                STUDENT APP
              </span>
            </div>

            {/* Featured Event Card */}
            <div className="rounded-xl bg-gradient-to-tr from-[#0D56FB]/35 via-[#7F1AFB]/35 to-[#18CFFC]/25 border border-white/15 p-2.5 min-[360px]:p-3 flex flex-col justify-end relative overflow-hidden shadow-lg">
              <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[7.5px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                ₹150 ENTRY
              </div>
              <span className="text-[7.5px] font-mono text-[#18CFFC] uppercase tracking-wider font-semibold">
                Tech & Innovation
              </span>
              <h3 className="text-xs min-[360px]:text-sm font-black text-white leading-tight font-display mt-0.5">
                Nexus Hackathon 2026
              </h3>
              <p className="text-[8.5px] min-[360px]:text-[9.5px] text-zinc-300 mt-0.5">
                48-Hour Prototype Sprint & AI Showcase
              </p>
            </div>

            {/* Venue & Date preview */}
            <div className="p-2 min-[360px]:p-2.5 rounded-xl bg-[#14141A] border border-white/[0.08] text-zinc-300">
              <div className="flex items-center gap-1.5 mb-1 text-[9.5px] min-[360px]:text-[10.5px] text-white font-bold">
                <Calendar size={11} className="text-[#18CFFC] shrink-0" />
                <span>Nov 14–15 · Main Auditorium</span>
              </div>
              <div className="flex items-center justify-between text-[8px] min-[360px]:text-[9px] text-zinc-400">
                <span>By Nexus Tech Club</span>
                <span className="text-emerald-400 font-mono font-semibold">95% Seats Filled</span>
              </div>
            </div>

            {/* Micro tag list */}
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2 py-0.5 rounded-md text-[7.5px] font-mono bg-white/[0.05] text-zinc-300 border border-white/[0.06]">
                Cinema Seating
              </span>
              <span className="px-2 py-0.5 rounded-md text-[7.5px] font-mono bg-[#18CFFC]/10 text-[#18CFFC] border border-[#18CFFC]/20">
                0% Fee Direct UPI
              </span>
              <span className="px-2 py-0.5 rounded-md text-[7.5px] font-mono bg-[#ED47FC]/10 text-[#ED47FC] border border-[#ED47FC]/20">
                FastPass
              </span>
            </div>
          </div>

          <div className="w-full py-2 min-[360px]:py-2.5 rounded-xl text-center text-[10.5px] min-[360px]:text-[11.5px] font-bold text-white bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] shadow-md shadow-[#7F1AFB]/20">
            Open Event Overview →
          </div>
        </div>
      )

    case 1:
      // Step 2: Open schedule & rules
      return (
        <div className="h-full p-2.5 min-[360px]:p-3 flex flex-col justify-between">
          <div className="flex flex-col gap-1.5 min-[360px]:gap-2">
            <div className="flex items-center justify-between text-[8.5px] min-[360px]:text-[9.5px] text-zinc-400">
              <span className="flex items-center gap-1">
                <ChevronLeft size={11} />
                Event Details
              </span>
              <span className="text-[7px] font-mono text-[#18CFFC] uppercase font-bold">RULES & TIMELINE</span>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="px-1.5 py-0.5 rounded text-[7.5px] font-bold bg-[#18CFFC]/15 text-[#18CFFC]">
                  TECHNICAL HACKATHON
                </span>
                <span className="px-1.5 py-0.5 rounded text-[7.5px] font-bold bg-emerald-400/15 text-emerald-400">
                  REGISTRATION OPEN
                </span>
              </div>
              <h3 className="text-xs min-[360px]:text-sm font-black text-white leading-tight font-display">
                Nexus Hackathon 2026
              </h3>
            </div>

            {/* Schedule details */}
            <div className="p-2 rounded-xl bg-[#14141A] border border-white/[0.08] flex flex-col gap-1.5 text-[8.5px] min-[360px]:text-[9.5px] text-zinc-300">
              <div className="flex items-center gap-1.5">
                <Calendar size={11} className="text-[#18CFFC] shrink-0" />
                <span className="font-semibold text-white">Day 1: 09:00 AM — Keynote & Sprint Kickoff</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users size={11} className="text-[#18CFFC] shrink-0" />
                <span>Team size: 2 to 4 members allowed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin size={11} className="text-[#18CFFC] shrink-0" />
                <span>Auditorium + 24/7 Innovation Labs</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={11} className="text-[#18CFFC] shrink-0" />
                <span>Cutoff: Nov 12, 11:59 PM (Strict)</span>
              </div>
            </div>

            <div className="p-1.5 rounded-lg bg-[#0E0E12] border border-white/[0.06] flex items-center justify-between text-[8px] text-zinc-400">
              <span>Pass Type: Reserved Cinema Seating</span>
              <span className="text-[#18CFFC] font-mono font-bold">₹150 / Pass</span>
            </div>
          </div>

          <div className="w-full py-2 min-[360px]:py-2.5 rounded-xl text-center text-[10.5px] min-[360px]:text-[11.5px] font-bold text-white bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] shadow-md shadow-[#7F1AFB]/20">
            Proceed to Registration →
          </div>
        </div>
      )

    case 2:
      // Step 3: Register profile
      return (
        <div className="h-full p-2.5 min-[360px]:p-3 flex flex-col justify-between">
          <div className="flex flex-col gap-1.5 min-[360px]:gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[8px] min-[360px]:text-[9px] font-mono text-[#7F1AFB] uppercase font-bold tracking-wider flex items-center gap-1">
                <UserCheck size={10} />
                STUDENT PROFILE
              </span>
              <span className="text-[7px] font-mono text-emerald-400 uppercase font-semibold">VERIFIED</span>
            </div>
            <h3 className="text-[11px] min-[360px]:text-xs font-bold text-white leading-tight font-display">
              Primary Attendee Info
            </h3>

            <div className="flex flex-col gap-1.5">
              <div>
                <span className="text-[7px] min-[360px]:text-[8px] text-zinc-500 font-semibold block mb-0.5 font-mono">
                  FULL NAME
                </span>
                <div className="h-6 min-[360px]:h-7 px-2 rounded-lg bg-[#14141A] border border-white/10 flex items-center text-[8.5px] min-[360px]:text-[9.5px] text-white">
                  Aarav Patel
                </div>
              </div>
              <div>
                <span className="text-[7px] min-[360px]:text-[8px] text-zinc-500 font-semibold block mb-0.5 font-mono">
                  COLLEGE / CAMPUS
                </span>
                <div className="h-6 min-[360px]:h-7 px-2 rounded-lg bg-[#14141A] border border-white/10 flex items-center text-[8.5px] min-[360px]:text-[9.5px] text-zinc-300 truncate">
                  National Institute of Tech (NIT)
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <span className="text-[7px] min-[360px]:text-[8px] text-zinc-500 font-semibold block mb-0.5 font-mono">
                    ROLL / STUDENT ID
                  </span>
                  <div className="h-6 min-[360px]:h-7 px-2 rounded-lg bg-[#14141A] border border-white/10 flex items-center text-[8.5px] min-[360px]:text-[9.5px] text-zinc-300 font-mono">
                    22CS104
                  </div>
                </div>
                <div>
                  <span className="text-[7px] min-[360px]:text-[8px] text-zinc-500 font-semibold block mb-0.5 font-mono">
                    PHONE NUMBER
                  </span>
                  <div className="h-6 min-[360px]:h-7 px-2 rounded-lg bg-[#14141A] border border-white/10 flex items-center text-[8.5px] min-[360px]:text-[9.5px] text-zinc-300 font-mono">
                    +91 98450 12345
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full py-2 min-[360px]:py-2.5 rounded-xl text-center text-[10.5px] min-[360px]:text-[11.5px] font-bold text-white bg-gradient-to-r from-[#7F1AFB] to-[#ED47FC] shadow-md shadow-[#ED47FC]/20">
            Next: Select Cinema Seats →
          </div>
        </div>
      )

    case 3:
      // Step 4: Interactive Cinema Seat Map
      return (
        <div className="h-full p-2.5 min-[360px]:p-3 flex flex-col justify-between">
          <div className="flex flex-col gap-1 min-[360px]:gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[8px] min-[360px]:text-[9px] font-mono text-[#18CFFC] uppercase font-bold tracking-wider flex items-center gap-1">
                <Armchair size={10} />
                INTERACTIVE SEAT MAP
              </span>
              <span className="px-1.5 py-0.5 rounded text-[7px] font-mono font-bold bg-[#18CFFC]/15 text-[#18CFFC]">
                LIVE AUDITORIUM
              </span>
            </div>

            {/* Auditorium Stage Curved Arc */}
            <div className="relative py-1 flex flex-col items-center">
              <div className="w-4/5 h-1.5 rounded-full bg-gradient-to-r from-transparent via-[#18CFFC] to-transparent shadow-[0_0_10px_rgba(24,207,252,0.7)]" />
              <span className="text-[6.5px] font-mono tracking-widest text-[#18CFFC]/90 uppercase mt-0.5">
                STAGE / FRONT SCREEN
              </span>
            </div>

            {/* Seat Map Grid (Rows A-D) */}
            <div className="p-1.5 rounded-xl bg-[#14141A] border border-white/[0.08] flex flex-col gap-1 items-center select-none">
              {INITIAL_SEAT_LAYOUT.map((rowGroup) => (
                <div key={rowGroup.row} className="flex items-center gap-1.5">
                  <span className="text-[7.5px] font-mono font-bold text-zinc-400 w-3 text-center">
                    {rowGroup.row}
                  </span>
                  <div className="flex gap-1">
                    {rowGroup.seats.map((seat) => {
                      const isSelected = selectedSeat === seat.id
                      const isBooked = seat.status === 'booked'
                      
                      let bgClass = 'bg-[#0E0E12] border-white/20 hover:border-[#18CFFC]'
                      let textClass = 'text-zinc-400'
                      
                      if (seat.category === 'vip' && !isBooked && !isSelected) {
                        bgClass = 'bg-amber-950/40 border-amber-500/40 hover:border-amber-400'
                        textClass = 'text-amber-400'
                      } else if (seat.category === 'free' && !isBooked && !isSelected) {
                        bgClass = 'bg-purple-950/40 border-purple-500/30 hover:border-purple-400'
                        textClass = 'text-purple-300'
                      }

                      if (isBooked) {
                        return (
                          <div
                            key={seat.id}
                            className="w-4 h-4 rounded-[4px] bg-zinc-800/80 border border-white/5 opacity-35 cursor-not-allowed flex items-center justify-center text-[6px] font-mono text-zinc-600"
                            title={`Seat ${seat.label} (Booked)`}
                          >
                            ×
                          </div>
                        )
                      }

                      if (isSelected) {
                        return (
                          <button
                            key={seat.id}
                            type="button"
                            onClick={() => toggleSeat(seat.id, seat.status)}
                            className="w-4 h-4 rounded-[4px] bg-[#18CFFC] border border-white flex items-center justify-center text-[7.5px] font-black text-black shadow-[0_0_8px_rgba(24,207,252,0.9)] transition-transform scale-105 cursor-pointer"
                            title={`Seat ${seat.label} (Selected)`}
                          >
                            ✓
                          </button>
                        )
                      }

                      return (
                        <button
                          key={seat.id}
                          type="button"
                          onClick={() => toggleSeat(seat.id, seat.status)}
                          className={`w-4 h-4 rounded-[4px] border transition-all cursor-pointer flex items-center justify-center text-[6.5px] font-mono ${bgClass} ${textClass}`}
                          title={`Seat ${seat.label} (${seat.category.toUpperCase()} - Available)`}
                        >
                          {seat.label.replace(/^[A-D]/, '')}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Legend with Categories */}
              <div className="flex items-center justify-center gap-2 pt-1 mt-0.5 border-t border-white/[0.06] text-[6.5px] font-mono text-zinc-400">
                <div className="flex items-center gap-0.5">
                  <div className="w-2 h-2 rounded-[2px] bg-amber-500/50 border border-amber-400" />
                  <span>VIP</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <div className="w-2 h-2 rounded-[2px] bg-[#0E0E12] border border-white/30" />
                  <span>Regular</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <div className="w-2 h-2 rounded-[2px] bg-purple-500/40 border border-purple-400" />
                  <span>Free</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <div className="w-2 h-2 rounded-[2px] bg-[#18CFFC]" />
                  <span className="text-[#18CFFC] font-bold">Selected</span>
                </div>
              </div>
            </div>

            {/* Seat Count & Selection Badge */}
            <div className="px-2 py-1 rounded-lg bg-[#18CFFC]/10 border border-[#18CFFC]/25 flex items-center justify-between text-[7.5px] font-mono">
              <span className="text-zinc-300">Seat Reservation:</span>
              <span className="text-[#18CFFC] font-bold flex items-center gap-1">
                <Crown size={9} className="text-amber-400" />
                {selectedSeat ? `Row ${selectedSeat[0]} · Seat ${selectedSeat.slice(2)} (Regular)` : 'None Selected'}
              </span>
            </div>
          </div>

          <div className="w-full py-2 min-[360px]:py-2.5 rounded-xl text-center text-[10.5px] min-[360px]:text-[11.5px] font-bold text-white bg-gradient-to-r from-[#18CFFC] to-[#0D56FB] shadow-md shadow-[#18CFFC]/20 cursor-pointer">
            Lock Seat {selectedSeat || 'B-4'} &amp; Continue →
          </div>
        </div>
      )

    case 4:
      // Step 5: Complete participant details
      return (
        <div className="h-full p-2.5 min-[360px]:p-3 flex flex-col justify-between">
          <div className="flex flex-col gap-1.5 min-[360px]:gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[8px] min-[360px]:text-[9px] font-mono text-[#ED47FC] uppercase font-bold tracking-wider flex items-center gap-1">
                <FileText size={10} />
                TEAM & PARTICIPANTS
              </span>
              <span className="text-[7px] font-mono text-zinc-400 uppercase">STEP 5 OF 7</span>
            </div>
            <h3 className="text-[11px] min-[360px]:text-xs font-bold text-white leading-tight font-display">
              Participant Specifications
            </h3>

            <div className="flex flex-col gap-1.5">
              <div>
                <span className="text-[7px] min-[360px]:text-[8px] text-zinc-400 font-semibold block mb-0.5 font-mono">
                  TEAM ROSTER (CO-DELEGATES)
                </span>
                <div className="h-6 px-2 rounded-lg bg-[#14141A] border border-white/10 flex items-center justify-between text-[8px] text-zinc-300">
                  <span>Priya Sharma (22CS109), Rohan Sen (22IT045)</span>
                  <CheckCircle2 size={10} className="text-emerald-400 shrink-0" />
                </div>
              </div>
              <div>
                <span className="text-[7px] min-[360px]:text-[8px] text-zinc-400 font-semibold block mb-0.5 font-mono">
                  EMERGENCY CONTACT PHONE
                </span>
                <div className="h-6 px-2 rounded-lg bg-[#14141A] border border-white/10 flex items-center text-[8.5px] text-zinc-300 font-mono">
                  +91 94421 88392 (Guardian / Faculty Advisor)
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <span className="text-[7px] text-zinc-400 font-semibold block mb-0.5 font-mono">
                    DIETARY PREFERENCE
                  </span>
                  <div className="h-6 px-2 rounded-lg bg-[#14141A] border border-white/10 flex items-center text-[8px] text-zinc-300">
                    Vegetarian / Standard
                  </div>
                </div>
                <div>
                  <span className="text-[7px] text-zinc-400 font-semibold block mb-0.5 font-mono">
                    T-SHIRT SIZE
                  </span>
                  <div className="h-6 px-2 rounded-lg bg-[#14141A] border border-white/10 flex items-center text-[8px] text-zinc-300 font-mono">
                    L (Unisex Sprint Tee)
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full py-2 min-[360px]:py-2.5 rounded-xl text-center text-[10.5px] min-[360px]:text-[11.5px] font-bold text-white bg-gradient-to-r from-[#ED47FC] to-[#7F1AFB] shadow-md shadow-[#ED47FC]/20">
            Proceed to Direct UPI Payment →
          </div>
        </div>
      )

    case 5:
      // Step 6: Direct UPI payment & 12-digit UTR submission
      return (
        <div className="h-full p-2.5 min-[360px]:p-3 flex flex-col justify-between">
          <div className="flex flex-col gap-1.5 min-[360px]:gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[8px] min-[360px]:text-[9px] font-mono text-[#07A4FC] uppercase font-bold tracking-wider flex items-center gap-1">
                <CreditCard size={10} />
                DIRECT CLUB UPI
              </span>
              <span className="text-[7px] font-mono text-emerald-400 font-semibold bg-emerald-400/10 px-1.5 py-0.5 rounded border border-emerald-400/20">
                0% PLATFORM FEE
              </span>
            </div>

            {/* Club UPI handle with copy */}
            <div className="p-2 rounded-xl bg-[#14141A] border border-[#18CFFC]/30 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[7px] min-[360px]:text-[8px] text-zinc-500 uppercase font-mono">
                  OFFICIAL CLUB UPI VPA
                </p>
                <p className="text-[9px] min-[360px]:text-[10px] font-mono font-bold text-[#18CFFC] truncate">
                  nexusclub@okhdfcbank
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyUpi}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#18CFFC]/10 hover:bg-[#18CFFC]/20 text-[8px] min-[360px]:text-[9px] font-bold text-[#18CFFC] shrink-0 transition-colors"
              >
                {copied ? <Check size={10} /> : <Copy size={10} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* 12-digit UTR input */}
            <div>
              <div className="flex justify-between items-center mb-0.5">
                <span className="text-[7px] min-[360px]:text-[8px] text-zinc-400 font-semibold font-mono">
                  12-DIGIT UPI UTR / RRN REF
                </span>
                <span className="text-[6.5px] font-mono text-emerald-400">Verified Format</span>
              </div>
              <div className="h-6 min-[360px]:h-7 px-2 rounded-lg bg-[#14141A] border border-white/15 flex items-center justify-between text-[9px] min-[360px]:text-[10px] font-mono text-emerald-400 font-bold">
                <span>429182736152</span>
                <CheckCircle2 size={11} className="text-emerald-400" />
              </div>
            </div>

            {/* Optional receipt upload */}
            <div className="p-2 rounded-xl border border-dashed border-white/20 bg-white/[0.02] flex items-center gap-2">
              <Upload size={11} className="text-[#18CFFC] shrink-0" />
              <div className="min-w-0">
                <span className="text-[8px] min-[360px]:text-[9px] text-zinc-200 block truncate font-medium">
                  receipt_utr_429182.png
                </span>
                <span className="text-[6.5px] text-zinc-500 block">Uploaded · 240 KB</span>
              </div>
            </div>
          </div>

          <div className="w-full py-2 min-[360px]:py-2.5 rounded-xl text-center text-[10.5px] min-[360px]:text-[11.5px] font-bold text-white bg-gradient-to-r from-[#18CFFC] to-[#0D56FB] shadow-md shadow-[#0D56FB]/20">
            Submit for 1-Click Verification →
          </div>
        </div>
      )

    case 6:
    default:
      // Step 7: Verified digital ticket with QR and venue gate attendance status
      return (
        <div className="h-full p-2.5 min-[360px]:p-3 flex flex-col justify-between">
          <div className="flex flex-col gap-1.5 min-[360px]:gap-2">
            {/* Header banner */}
            <div className="flex items-center justify-between pb-1 border-b border-white/10">
              <span className="text-[8px] min-[360px]:text-[9px] font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck size={11} className="text-emerald-400" />
                FESTFLOW PASS
              </span>
              <span className="px-1.5 py-0.5 rounded text-[7px] min-[360px]:text-[8px] font-bold text-emerald-400 bg-emerald-400/15 border border-emerald-400/30">
                ● CONFIRMED
              </span>
            </div>

            {/* Event & Student info */}
            <div>
              <span className="text-[7px] min-[360px]:text-[8px] font-mono text-[#18CFFC] uppercase font-bold">
                AUDITORIUM FASTPASS
              </span>
              <h3 className="text-xs font-black text-white leading-tight font-display">
                Nexus Hackathon 2026
              </h3>
              <p className="text-[8px] min-[360px]:text-[9px] text-zinc-300">
                Aarav Patel · NIT (22CS104)
              </p>
            </div>

            {/* QR Code & Pass Card */}
            <div className="p-2 rounded-xl bg-[#14141A] border border-emerald-500/30 flex items-center gap-2.5">
              {/* Authentic stylized QR block */}
              <div className="w-14 h-14 rounded-lg bg-white p-1 shrink-0 flex items-center justify-center relative shadow-sm">
                <QrCode size={48} className="text-black" />
                <div className="absolute inset-0 m-auto w-3 h-3 bg-emerald-500 rounded-sm flex items-center justify-center text-[7px] font-bold text-white">
                  ✓
                </div>
              </div>

              <div className="flex flex-col min-w-0">
                <span className="text-[6.5px] font-mono text-zinc-400 uppercase">PASS REFERENCE</span>
                <span className="font-mono text-xs font-black text-white tracking-wider">
                  FF-9A4B7C2D
                </span>
                <span className="text-[7.5px] font-mono text-[#18CFFC] font-semibold mt-0.5">
                  Seat: Row B · Seat 04
                </span>
                <span className="text-[7px] text-emerald-400 font-semibold flex items-center gap-0.5 mt-0.5">
                  <CheckCircle2 size={9} /> Approved by Club Lead
                </span>
              </div>
            </div>

            {/* Gate Attendance Badge */}
            <div className="p-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/25 flex items-center justify-between text-[7.5px] min-[360px]:text-[8.5px] font-mono text-emerald-300">
              <span className="flex items-center gap-1 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                GATE 2 READY
              </span>
              <span>LIVE ATTENDANCE ACTIVE</span>
            </div>
          </div>

          <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[7px] min-[360px]:text-[8px] font-mono text-zinc-400">
            <span>OFFLINE ACCESSIBLE</span>
            <span className="text-[#18CFFC]">WALLET READY</span>
          </div>
        </div>
      )
  }
}

export function World06StudentJourney({
  reducedMotion,
  id = 'world-06-student',
  className = '',
}: SceneProps) {
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
      // Baseline: Step 1 visible; Steps 2..7 opacity 0
      gsap.set(screens[0], { opacity: 1, y: 0, scale: 1 })
      gsap.set(screens.slice(1), { opacity: 0, y: 14, scale: 0.96 })

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: 'top top',
          end: `+=${STUDENT_STEPS.length * 105}%`,
          pin: pinStage,
          scrub: 0.35,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const step = resolveActiveStepFromTime(
              self.progress * (STUDENT_STEPS.length - 1),
              STUDENT_STEPS.length
            )
            setActiveStep(step)
          },
        },
      })

      // Strict sequential transitions with dead gaps across all 7 steps
      for (let i = 0; i < STUDENT_STEPS.length - 1; i++) {
        const cur = screens[i]
        const nxt = screens[i + 1]
        if (!cur || !nxt) continue

        // Current exits
        tl.to(
          cur,
          {
            opacity: 0,
            y: -14,
            scale: 0.96,
            duration: SEQUENTIAL_SLOT.EXIT_DURATION,
            ease: 'power2.in',
          },
          i + SEQUENTIAL_SLOT.EXIT_OFFSET
        )

        // Next enters
        tl.fromTo(
          nxt,
          { opacity: 0, y: 14, scale: 0.96 },
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

      // Final step hold
      tl.to({}, { duration: SEQUENTIAL_SLOT.FINAL_HOLD_DURATION })
    }, container)

    return () => ctx.revert()
  }, [reducedMotion])

  const stepMeta = STUDENT_STEPS[activeStep] ?? STUDENT_STEPS[0]

  return (
    <section
      ref={containerRef}
      id={id}
      aria-label="World 06: The Student Journey"
      className={`relative w-full bg-[#08080A] text-white select-none ${className}`}
    >
      {/* ─── REDUCED MOTION ACCESSIBLE FALLBACK (Responsive 7-card grid) ─── */}
      {reducedMotion ? (
        <div className="py-16 px-4 max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-mono font-bold text-[#18CFFC] tracking-widest uppercase bg-[#18CFFC]/10 px-3 py-1 rounded-full border border-[#18CFFC]/20">
              WORLD 06 · THE STUDENT JOURNEY
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white mt-4 font-display">
              The Student Journey.
            </h2>
            <p className="text-zinc-400 text-sm max-w-xl mx-auto mt-2 font-body">
              From event discovery and interactive cinema seating to direct UPI payments and gate-ready passes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {STUDENT_STEPS.map((step, idx) => (
              <div
                key={step.id}
                className="rounded-2xl bg-[#0E0E12] border border-white/10 p-4 shadow-xl flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                  <span className="text-[10px] font-mono text-[#18CFFC] font-bold">
                    {step.pill}
                  </span>
                  <span className="text-xs font-bold text-white">{step.shortTitle}</span>
                </div>
                <div className="min-h-[360px]">
                  <StudentStepScreen stepIndex={idx} />
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
          <div className="text-center max-w-2xl mx-auto mb-5 sm:mb-7 z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-bold text-[#18CFFC] bg-[#14141A] border border-[#18CFFC]/30 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#18CFFC] animate-ping" />
              <span>{stepMeta.pill}</span>
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight font-display">
              The Student{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #18CFFC 0%, #07A4FC 50%, #7F1AFB 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Journey.
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1.5 leading-relaxed font-body">
              7 unified steps from discovery and cinema seat selection to direct UPI and verified QR FastPass.
            </p>

            {/* Step navigation indicator pills */}
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-3.5 flex-wrap">
              {STUDENT_STEPS.map((step, idx) => (
                <div
                  key={step.id}
                  className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-mono transition-all duration-300 ${
                    activeStep === idx
                      ? 'bg-[#18CFFC]/20 text-[#18CFFC] border border-[#18CFFC]/50 font-bold shadow-[0_0_12px_rgba(24,207,252,0.3)]'
                      : 'bg-white/[0.04] text-zinc-500 border border-transparent'
                  }`}
                >
                  {step.shortTitle}
                </div>
              ))}
            </div>
          </div>

          {/* Central Mobile Mockup Chassis with dynamic screen layering */}
          <div className="relative z-10">
            <MobileMockupChassis
              phoneRef={phoneFrameRef}
              statusRight="FestFlow 5G"
              accentGlow="cyan"
            >
              <div className="relative w-full h-full overflow-hidden">
                {STUDENT_STEPS.map((step, idx) => (
                  <div
                    key={step.id}
                    ref={(el) => {
                      screenRefs.current[idx] = el
                    }}
                    className="absolute inset-0 w-full h-full"
                    style={{ willChange: 'opacity, transform' }}
                  >
                    <StudentStepScreen stepIndex={idx} />
                  </div>
                ))}
              </div>
            </MobileMockupChassis>
          </div>

          {/* Background Ambient Glow */}
          <div
            aria-hidden="true"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] bg-gradient-to-tr from-[#0D56FB]/15 via-[#7F1AFB]/15 to-[#18CFFC]/15 rounded-full blur-3xl pointer-events-none -z-10"
          />
        </div>
      )}
    </section>
  )
}

