import { useState } from 'react'
import {
  Sparkles,
  QrCode,
  Calendar,
  MapPin,
  CheckCircle2,
  Clock,
  Building2,
  Search,
  ChevronRight,
  Check,
  Info,
} from 'lucide-react'
import { Link } from 'react-router'

interface DeviceScreenContentProps {
  currentScene: number
  onNavigateScene?: (sceneIndex: number) => void
}

export function DeviceScreenContent({
  currentScene,
  onNavigateScene,
}: DeviceScreenContentProps) {
  // Interactive state for Scene 2 (Category Filter)
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'tech' | 'cultural' | 'sports'>('tech')

  // Interactive state for Scene 3 (Seats) - strictly local mock state
  const [selectedSeats, setSelectedSeats] = useState<string[]>(['A4', 'A5'])

  // Interactive state for Scene 4 (Payment UTR & Verification) - simulated demo
  const [utrNumber, setUtrNumber] = useState('DEMO-UTR-9821')
  const [isPaymentSubmitted, setIsPaymentSubmitted] = useState(true)

  // Interactive state for Scene 6 (Command Center 1-click verification) - synthetic demo roster
  const [demoRoster, setDemoRoster] = useState([
    { id: 1, name: 'DEMO ATTENDEE (Alex Morgan)', utr: 'DEMO-UTR-9821', amount: '₹500', seats: 'A4, A5', verified: true },
    { id: 2, name: 'DEMO ATTENDEE (Sarah Khan)', utr: 'DEMO-UTR-9822', amount: '₹250', seats: 'B3', verified: false },
    { id: 3, name: 'DEMO ATTENDEE (Jordan Taylor)', utr: 'DEMO-UTR-9823', amount: '₹250', seats: 'B4', verified: true },
  ])

  const toggleSeat = (seatId: string) => {
    if (selectedSeats.includes(seatId)) {
      setSelectedSeats(selectedSeats.filter((s) => s !== seatId))
    } else {
      if (selectedSeats.length < 4) {
        setSelectedSeats([...selectedSeats, seatId])
      }
    }
  }

  const handleVerifyAttendee = (id: number) => {
    setDemoRoster(
      demoRoster.map((item) => (item.id === id ? { ...item, verified: !item.verified } : item))
    )
  }

  return (
    <div className="w-full h-full flex flex-col justify-between overflow-hidden select-none font-sans text-white">
      {/* ─── SCENE 0: CAMPUS OVERVIEW TELEMETRY HUD ──────────────────────── */}
      {currentScene === 0 && (
        <div className="p-6 sm:p-8 flex flex-col justify-between h-full bg-[#0E0E14]/85 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider text-[#18CFFC] bg-[#14141E] border border-[#18CFFC]/30 mb-4">
              <span className="w-2 h-2 rounded-full bg-[#18CFFC] animate-ping" />
              <span>SEQUENCE 01 · ISOMETRIC CAMPUS ECOSYSTEM</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-100 to-[#18CFFC] bg-clip-text text-transparent">
              A Living Collegiate Universe.
            </h2>
            <p className="text-xs sm:text-sm text-zinc-300 mt-2 max-w-lg leading-relaxed">
              Every academic block, amphitheater, and club space connected in one cohesive digital network.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
            {[
              { title: 'Main Auditorium', status: 'Beacon Active · IoT Innovate', active: true },
              { title: 'Engineering Atrium', status: 'HackSprint 24h Hub', active: false },
              { title: 'Clubs Command HQ', status: '42 Registered Chapters', active: false },
              { title: 'Cultural Pavilion', status: 'Aura Fest 2026 Arena', active: false },
            ].map((node, i) => (
              <div
                key={i}
                className={`p-3.5 rounded-2xl border transition-all ${
                  node.active
                    ? 'bg-[#18CFFC]/15 border-[#18CFFC]/50 shadow-[0_0_20px_rgba(24,207,252,0.25)]'
                    : 'bg-[#14141E]/80 border-white/10'
                }`}
              >
                <span className="text-[10px] font-mono text-[#18CFFC] block mb-1">NODE 0{i + 1}</span>
                <span className="text-xs font-bold text-white block">{node.title}</span>
                <span className="text-[10px] text-zinc-400 mt-0.5 block">{node.status}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/10 text-xs">
            <span className="text-zinc-400 flex items-center gap-1.5 font-mono">
              <Sparkles size={14} className="text-[#18CFFC]" /> Venue Illuminated
            </span>
            <button
              onClick={() => onNavigateScene?.(1)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] text-black font-bold flex items-center gap-1.5 hover:scale-105 transition-all cursor-pointer shadow-lg shadow-cyan-500/25"
            >
              <span>Dive into Mobile Experience</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ─── SCENE 1: DISCOVER EVENTS (Inside Floating Phone Screen) ──────── */}
      {currentScene === 1 && (
        <div className="w-full h-full p-4 sm:p-5 flex flex-col justify-between bg-[#0B0C10] rounded-2xl overflow-y-auto">
          {/* Mobile Status Header */}
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <span className="text-xs font-bold font-mono tracking-wider text-[#18CFFC]">FESTFLOW DISCOVER</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                ● 12 LIVE EVENTS
              </span>
            </div>

            {/* Simulated Search Bar */}
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                readOnly
                value="Search hackathons, symposiums..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#14141E] border border-white/10 text-xs text-zinc-300 focus:outline-none"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none mb-3">
              {(['all', 'tech', 'cultural', 'sports'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-[#18CFFC] text-black font-bold shadow-md shadow-cyan-500/30'
                      : 'bg-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Featured Event Card in Phone */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#121422] to-[#16182a] border border-[#18CFFC]/30 shadow-xl relative overflow-hidden group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-[#18CFFC] uppercase tracking-wider">
                  TECH SYMPOSIUM · WORKSHOP
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-mono font-bold">
                  ₹250 / PASS
                </span>
              </div>
              <h3 className="text-base font-extrabold text-white leading-tight mb-1">
                IoT INNOVATE 2026
              </h3>
              <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed mb-3">
                Build real-time connected micro-controllers, IoT protocols, and cloud sensors with live faculty mentorship.
              </p>

              <div className="flex items-center gap-3 text-[11px] text-zinc-400 mb-3">
                <span className="flex items-center gap-1">
                  <Calendar size={12} className="text-[#18CFFC]" /> Nov 28, 2026
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={12} className="text-[#ED47FC]" /> Main Auditorium
                </span>
              </div>

              <div className="flex items-center justify-between pt-2.5 border-t border-white/10">
                <span className="text-[10px] text-emerald-400 font-medium">● 48 Seats Remaining</span>
                <button
                  onClick={() => onNavigateScene?.(2)}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#18CFFC] to-[#07A4FC] text-black text-xs font-bold flex items-center gap-1 cursor-pointer hover:scale-105 transition-all shadow-md"
                >
                  <span>Select Seats</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2 text-center">
            <span className="text-[10px] text-zinc-500 font-mono">SEQUENCE 02 · REAL EVENT BROWSING & FILTERS</span>
          </div>
        </div>
      )}

      {/* ─── SCENE 2: RESERVED SEAT SELECTION ────────────────────────────── */}
      {currentScene === 2 && (
        <div className="w-full h-full p-4 sm:p-5 flex flex-col justify-between bg-[#0B0C10] rounded-2xl overflow-y-auto">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <div>
                <span className="text-xs font-bold text-white block">IoT INNOVATE 2026</span>
                <span className="text-[10px] text-zinc-400 font-mono">Main Auditorium · Cinema Reserved Seating</span>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-[#18CFFC]/15 border border-[#18CFFC]/40 text-[#18CFFC] text-[10px] font-mono font-bold flex items-center gap-1">
                <Clock size={11} className="animate-spin" /> 09:42 Hold
              </div>
            </div>

            {/* Auditorium Stage Screen Indicator */}
            <div className="relative mb-4 text-center">
              <div className="h-1.5 w-3/4 mx-auto rounded-full bg-gradient-to-r from-transparent via-[#18CFFC] to-transparent shadow-[0_0_12px_#18CFFC]" />
              <span className="text-[9px] font-mono tracking-widest text-zinc-400 uppercase mt-1 block">
                MAIN STAGE / PRESENTATION SCREEN
              </span>
            </div>

            {/* Interactive Seat Rows Grid */}
            <div className="space-y-2 mb-3">
              {['A', 'B', 'C'].map((row) => (
                <div key={row} className="flex items-center justify-center gap-1.5">
                  <span className="w-4 text-[10px] font-mono text-zinc-500 font-bold text-right">{row}</span>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => {
                    const seatId = `${row}${num}`
                    const isSelected = selectedSeats.includes(seatId)
                    const isOccupied = (row === 'B' && (num === 2 || num === 7)) || (row === 'C' && num === 5)

                    return (
                      <button
                        key={seatId}
                        disabled={isOccupied}
                        onClick={() => toggleSeat(seatId)}
                        className={`w-6 h-6 rounded-md text-[9px] font-mono font-bold flex items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#18CFFC] text-black shadow-[0_0_10px_#18CFFC] scale-110'
                            : isOccupied
                            ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-40'
                            : 'bg-[#181824] text-zinc-300 hover:bg-[#7F1AFB] hover:text-white border border-white/10'
                        }`}
                      >
                        {num}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 text-[10px] text-zinc-400 mb-3 pt-2 border-t border-white/10 font-mono">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-[#181824] border border-white/15" /> Available (₹250)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-[#18CFFC]" /> Selected
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-zinc-800" /> Booked
              </span>
            </div>

            {/* Booking Summary Box */}
            <div className="p-2.5 rounded-xl bg-[#14141E] border border-white/10 flex items-center justify-between mb-2">
              <div>
                <span className="text-[9px] text-zinc-400 block font-mono">
                  {selectedSeats.length} SEAT{selectedSeats.length > 1 ? 'S' : ''} SELECTED (DEMO STATE)
                </span>
                <span className="text-xs font-bold text-white">
                  {selectedSeats.length > 0 ? selectedSeats.join(', ') : 'None selected'}
                </span>
              </div>
              <span className="text-base font-extrabold text-[#18CFFC] font-mono">
                ₹{selectedSeats.length * 250}
              </span>
            </div>

            {/* Demo Safety Notice */}
            <div className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 flex items-center gap-1.5 text-[9px] text-zinc-400 font-mono">
              <Info size={11} className="text-[#18CFFC] shrink-0" />
              <span>Simulated demo state. Does not hold live production seats.</span>
            </div>
          </div>

          <button
            disabled={selectedSeats.length === 0}
            onClick={() => onNavigateScene?.(3)}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] text-black font-bold text-xs flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] transition-all shadow-lg shadow-cyan-500/25 disabled:opacity-50 mt-2"
          >
            <span>Confirm Demo Hold & Continue</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* ─── SCENE 3: REGISTRATION & DIRECT MANUAL UPI PAYMENT ─────────────── */}
      {currentScene === 3 && (
        <div className="w-full h-full p-4 sm:p-5 flex flex-col justify-between bg-[#0B0C10] rounded-2xl overflow-y-auto">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <span className="text-xs font-bold text-white">DIRECT UPI SETTLEMENT (DEMO)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 font-mono font-bold">
                0% PLATFORM FEE
              </span>
            </div>

            {/* Attendee Details - Strictly Demo Labelled */}
            <div className="p-3 rounded-xl bg-[#14141E] border border-white/10 space-y-1.5 mb-3 text-xs">
              <div className="flex justify-between text-zinc-400 text-[11px]">
                <span>Lead Booker:</span>
                <span className="text-white font-semibold">DEMO STUDENT (Alex Morgan)</span>
              </div>
              <div className="flex justify-between text-zinc-400 text-[11px]">
                <span>College / Roll:</span>
                <span className="text-white font-mono">DEMO ROLL #FF-DEMO-2026</span>
              </div>
              <div className="flex justify-between text-zinc-400 text-[11px]">
                <span>Allocated Seats:</span>
                <span className="text-[#18CFFC] font-mono font-bold">{selectedSeats.join(', ')}</span>
              </div>
            </div>

            {/* Club UPI QR Box - Synthetic Demonstration */}
            <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#121422] to-[#14141e] border border-white/10 text-center mb-3">
              <span className="text-[10px] text-zinc-400 font-mono uppercase block mb-1">
                DEMO UPI QR · NO REAL CHARGE
              </span>
              <div className="w-24 h-24 mx-auto rounded-xl bg-white p-2 flex items-center justify-center my-2 shadow-lg">
                <QrCode size={80} className="text-black" />
              </div>
              <span className="font-mono text-xs text-[#18CFFC] font-bold block">
                demo.club@festflow.demo
              </span>
              <span className="text-[10px] text-zinc-400 block mt-0.5">Sample Payable: ₹{selectedSeats.length * 250}</span>
            </div>

            {/* 12-Digit UTR Transaction Input */}
            <div className="space-y-1 mb-2">
              <label className="text-[10px] text-zinc-400 font-mono uppercase block">
                Simulated 12-Digit UTR Reference
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={14}
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#14141E] border border-[#18CFFC]/40 text-xs font-mono text-white tracking-widest focus:outline-none"
                />
                <button
                  onClick={() => setIsPaymentSubmitted(true)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-all ${
                    isPaymentSubmitted
                      ? 'bg-emerald-400 text-black shadow-md shadow-emerald-500/20'
                      : 'bg-[#18CFFC] text-black'
                  }`}
                >
                  {isPaymentSubmitted ? '✓ Submitted' : 'Submit'}
                </button>
              </div>
            </div>

            {/* Status Change Banner */}
            <div
              className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs transition-all ${
                isPaymentSubmitted
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-amber-500/10 border-amber-500/30'
              }`}
            >
              <CheckCircle2
                size={16}
                className={`shrink-0 ${isPaymentSubmitted ? 'text-emerald-400' : 'text-amber-400'}`}
              />
              <div>
                <span
                  className={`font-bold block text-[11px] ${
                    isPaymentSubmitted ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  {isPaymentSubmitted ? 'DEMO: UTR Verified by Club Host' : 'Awaiting Organizer Bank Review'}
                </span>
                <span className="text-[9px] text-zinc-400 font-mono">
                  {isPaymentSubmitted
                    ? 'Simulated pass generated for demonstration'
                    : 'Ref #DEMO-UTR-9821 queued for review'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateScene?.(4)}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-[#18CFFC] text-black font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.02] transition-all shadow-lg mt-2"
          >
            <span>View Demonstration Digital Pass</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* ─── SCENE 4: DIGITAL PASS PRESENTATION ──────────────────────────── */}
      {currentScene === 4 && (
        <div className="w-full h-full p-4 sm:p-5 flex flex-col justify-between bg-gradient-to-b from-[#10121C] to-[#0A0B10] rounded-2xl border border-[#18CFFC]/30 shadow-2xl relative overflow-hidden">
          {/* Ambient Sheen Flare */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#18CFFC]/10 rounded-full blur-2xl pointer-events-none" />

          <div>
            {/* Ticket Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-emerald-400">
                  DIGITAL ENTRY PASS (DEMO SPECIMEN)
                </span>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">DEMO-SPECIMEN</span>
            </div>

            {/* Pass Title & Club Badge */}
            <div className="mb-3">
              <span className="text-[10px] font-mono text-[#18CFFC] uppercase tracking-wider block">
                DEMO CHAPTER · CAMPUS UNIVERSITY
              </span>
              <h3 className="text-lg font-black text-white leading-tight">
                IoT INNOVATE 2026
              </h3>
            </div>

            {/* QR Code Presentation */}
            <div className="p-4 rounded-2xl bg-[#08080C] border border-white/15 text-center mb-3 shadow-inner relative group">
              <div className="w-36 h-36 mx-auto rounded-xl bg-white p-2.5 flex items-center justify-center shadow-lg">
                <QrCode size={124} className="text-black" />
              </div>
              <span className="text-xs font-mono font-extrabold tracking-widest text-[#18CFFC] block mt-2">
                FF-DEMO-049CCA
              </span>
              <span className="text-[9px] text-zinc-400 font-mono block mt-0.5">
                Specimen QR token · Instant camera scanner admittance
              </span>
            </div>

            {/* Pass Metadata Grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px] p-2.5 rounded-xl bg-[#14141E] border border-white/10 font-mono">
              <div>
                <span className="text-zinc-500 block text-[9px]">ATTENDEE</span>
                <span className="text-white font-bold truncate block">DEMO STUDENT</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[9px]">RESERVED SEATS</span>
                <span className="text-[#18CFFC] font-bold block">{selectedSeats.join(', ')}</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[9px]">DATE & TIME</span>
                <span className="text-zinc-300 block">Nov 28 · 10:00 AM</span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[9px]">VENUE</span>
                <span className="text-zinc-300 block truncate">Main Auditorium</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateScene?.(5)}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] text-black font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.02] transition-all shadow-lg mt-2"
          >
            <span>Open Organizer Command Center</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* ─── SCENE 5: CLUB COMMAND CENTER DASHBOARD ──────────────────────── */}
      {currentScene === 5 && (
        <div className="w-full h-full p-4 sm:p-5 flex flex-col justify-between bg-[#0B0C10] rounded-2xl overflow-y-auto">
          <div>
            {/* Dashboard Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <div>
                <span className="text-xs font-bold text-white block">ORGANIZER COMMAND CENTER</span>
                <span className="text-[10px] text-zinc-400 font-mono">Sample Club · Illustrative Dashboard Simulation</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold">
                ● DEMO DATASET
              </span>
            </div>

            {/* Quick Metrics Cards - Explicitly labeled as sample/demo data */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="p-2.5 rounded-xl bg-[#14141E] border border-white/10">
                <span className="text-[8px] font-mono text-[#18CFFC] block uppercase">SAMPLE REGISTRATIONS</span>
                <span className="text-sm font-extrabold text-white font-mono">428 / 500</span>
                <span className="text-[8px] text-emerald-400 block font-mono">85.6% Full (Demo)</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#14141E] border border-white/10">
                <span className="text-[8px] font-mono text-[#18CFFC] block uppercase">SAMPLE COLLECTION</span>
                <span className="text-sm font-extrabold text-[#18CFFC] font-mono">₹1,07,000</span>
                <span className="text-[8px] text-zinc-400 block font-mono">Direct UPI (Demo)</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#14141E] border border-white/10">
                <span className="text-[8px] font-mono text-[#18CFFC] block uppercase">VENUE ATTENDANCE</span>
                <span className="text-sm font-extrabold text-[#ED47FC] font-mono">312</span>
                <span className="text-[8px] text-zinc-400 block font-mono">Sample Verified Entrants</span>
              </div>
            </div>

            {/* Live Attendee UTR Verification Inbox */}
            <div className="p-3 rounded-xl bg-[#14141E] border border-white/10 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold">
                  SIMULATED PAYMENT VERIFICATION INBOX
                </span>
                <span className="text-[9px] text-zinc-500 font-mono">Local UI demonstration</span>
              </div>

              <div className="space-y-1.5">
                {demoRoster.map((row) => (
                  <div
                    key={row.id}
                    className="p-2 rounded-lg bg-[#0E0E14] border border-white/5 flex items-center justify-between text-[11px]"
                  >
                    <div>
                      <span className="font-bold text-white block leading-tight">{row.name}</span>
                      <span className="text-[9px] font-mono text-zinc-400">
                        {row.utr} · {row.amount} · Seats {row.seats}
                      </span>
                    </div>
                    <button
                      onClick={() => handleVerifyAttendee(row.id)}
                      className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer ${
                        row.verified
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-[#18CFFC] text-black'
                      }`}
                    >
                      {row.verified ? (
                        <>
                          <Check size={11} /> Verified (Demo)
                        </>
                      ) : (
                        'Verify UTR'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Seat Availability Public Visibility Toggle */}
            <div className="p-2.5 rounded-xl bg-[#14141E] border border-white/10 flex items-center justify-between text-xs">
              <span className="text-zinc-300 font-medium text-[11px]">Seat Count Visibility to Students</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono font-bold text-[10px]">
                ENABLED
              </span>
            </div>
          </div>

          <button
            onClick={() => onNavigateScene?.(6)}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#18CFFC] to-[#ED47FC] text-black font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer hover:scale-[1.02] transition-all shadow-lg mt-2"
          >
            <span>Proceed to The Final Reveal</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* ─── SCENE 6: THE FINAL REVEAL ───────────────────────────────────── */}
      {currentScene === 6 && (
        <div className="p-6 sm:p-8 flex flex-col justify-between h-full bg-[#0E0E14]/90 backdrop-blur-xl border border-white/15 rounded-3xl text-center shadow-2xl">
          <div className="my-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-widest text-[#18CFFC] bg-[#14141E] border border-[#18CFFC]/40 shadow-[0_0_20px_rgba(24,207,252,0.3)]">
              <Sparkles size={13} className="text-[#ED47FC]" />
              <span>THE COMPLETE CAMPUS EVENT OS</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight leading-none bg-gradient-to-r from-white via-zinc-100 to-[#18CFFC] bg-clip-text text-transparent">
              ONE PLATFORM.
              <br />
              <span className="text-[#18CFFC]">EVERY CAMPUS EVENT.</span>
            </h1>

            <p className="text-xs sm:text-sm text-zinc-300 max-w-md mx-auto leading-relaxed">
              From university hackathons to cultural celebrations — discovery, seat selection, UPI settlements, and verified pass turnstiles.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <Link to="/discover" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto px-7 py-3 rounded-xl bg-gradient-to-r from-[#18CFFC] via-[#07A4FC] to-[#7F1AFB] text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:scale-105 transition-all shadow-xl shadow-cyan-500/30 cursor-pointer">
                  <span>EXPLORE CAMPUS EVENTS</span>
                  <ChevronRight size={15} />
                </button>
              </Link>
              <Link to="/club/signup" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:scale-105 transition-all cursor-pointer">
                  <span>HOST AN EVENT FREE</span>
                  <Building2 size={15} className="text-[#18CFFC]" />
                </button>
              </Link>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
            <span>FESTFLOW © 2026 · DEMO SHOWCASE</span>
            <button
              onClick={() => onNavigateScene?.(0)}
              className="text-[#18CFFC] hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Replay Product Story ↺</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
export default DeviceScreenContent
