import { useRef } from 'react'
import { Link } from 'react-router'
import {
  ArrowRight,
  QrCode,
  Zap,
  Users,
  Calendar,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Armchair,
} from 'lucide-react'
import { Button } from '@/components/ui'
import { useStaggerReveal } from '@/lib/motion'

const CAPABILITIES = [
  { icon: Zap, label: '0% Platform Fee', subtext: 'Direct UPI to club bank' },
  { icon: QrCode, label: 'Digital Passes', subtext: 'Sub-second gate check-in' },
  { icon: Users, label: 'Team Engine', subtext: 'Solo & roster verification' },
]

export function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  useStaggerReveal(containerRef, '.hero-stagger', { y: 16, stagger: 0.06, immediate: true })

  return (
    <section
      aria-label="Hero"
      className="relative bg-white border-b border-gray-200/80 pt-10 sm:pt-16 pb-16 sm:pb-24 overflow-hidden"
    >
      {/* Subtle architectural grid pattern */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(#E5E7EB_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none"
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
          {/* Left Column: Crisp Editorial Headline & CTAs */}
          <div
            ref={containerRef}
            className="lg:col-span-6 flex flex-col items-center lg:items-start text-center lg:text-left"
          >
            {/* Minimal Eyebrow Pill */}
            <div className="hero-stagger mb-5">
              <Link
                to="/cinematic"
                className="inline-flex items-center gap-2 rounded-full pl-2 pr-3.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200/80 hover:bg-blue-100/70 transition-colors"
              >
                <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-semibold">
                  NEW
                </span>
                <span>Watch the FestFlow Product Tour →</span>
              </Link>
            </div>

            {/* Clean Display H1 */}
            <h1 className="hero-stagger font-display font-bold text-gray-900 text-[2rem] sm:text-5xl lg:text-[3.25rem] leading-[1.08] tracking-tight mb-5">
              Your campus.{' '}
              <span className="text-blue-600">More happening.</span>
            </h1>

            {/* Subheadline */}
            <p className="hero-stagger max-w-xl text-base sm:text-lg text-gray-600 leading-relaxed mb-8">
              Discover campus hackathons, workshops, and cultural fests. Book reserved seats in seconds, pay clubs directly via UPI with zero platform markup, and check in with verified digital passes.
            </p>

            {/* Primary & Secondary CTAs */}
            <div className="hero-stagger flex flex-col sm:flex-row gap-3 w-full sm:w-auto mb-10">
              <Link to="/discover" className="w-full sm:w-auto">
                <Button
                  id="hero-cta-discover"
                  variant="primary"
                  size="lg"
                  className="w-full sm:w-auto justify-center"
                  rightIcon={<ArrowRight size={16} />}
                >
                  Explore events
                </Button>
              </Link>
              <Link to="/club/signup" className="w-full sm:w-auto">
                <Button
                  id="hero-cta-primary"
                  variant="secondary"
                  size="lg"
                  className="w-full sm:w-auto justify-center"
                >
                  For event organizers
                </Button>
              </Link>
            </div>

            {/* Restrained Telemetry Pills */}
            <div className="hero-stagger grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg lg:max-w-none pt-2 border-t border-gray-100">
              {CAPABILITIES.map(({ icon: Icon, label, subtext }) => (
                <div
                  key={label}
                  className="flex items-center lg:items-start gap-2.5 pt-3 text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-100 border border-gray-200/80 text-gray-700 flex items-center justify-center shrink-0">
                    <Icon size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-gray-900 leading-tight">
                      {label}
                    </h4>
                    <p className="text-[11px] text-gray-500 leading-tight mt-0.5">
                      {subtext}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Clean Editorial SaaS Product UI Mockup */}
          <div ref={previewRef} className="lg:col-span-6 w-full">
            <div className="relative rounded-2xl border border-gray-200 bg-[#F7F8FA] p-3 sm:p-4 shadow-[0_20px_50px_-15px_rgba(17,24,39,0.1)]">
              {/* Browser Window Top Bar */}
              <div className="flex items-center justify-between px-3 py-2 mb-3 rounded-lg bg-white border border-gray-200/80">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                </div>
                <span className="font-mono text-[11px] text-gray-500">
                  festflow.online/events/...
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                  Preview
                </span>
              </div>

              {/* Dual Card Product Interface Composition */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 text-left">
                {/* Main Event & Seating Card */}
                <div className="sm:col-span-7 bg-white rounded-xl border border-gray-200 p-4 flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Event Category
                      </span>
                      <span className="text-[11px] font-semibold text-gray-900">
                        Direct Club UPI
                      </span>
                    </div>

                    <h3 className="font-display font-bold text-base text-gray-900 leading-snug mb-1">
                      Campus Event Preview
                    </h3>
                    <div className="flex flex-col gap-1 text-[11px] text-gray-500 mb-4">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={12} className="text-gray-400" />
                        Scheduled Date & Time
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin size={12} className="text-gray-400" />
                        Main Campus Auditorium
                      </span>
                    </div>

                    {/* Mini Auditorium Seat Selection Widget */}
                    <div className="p-3 rounded-lg bg-[#F7F8FA] border border-gray-200/80 mb-3">
                      <div className="flex items-center justify-between text-[10px] font-medium text-gray-600 mb-2">
                        <span className="flex items-center gap-1">
                          <Armchair size={12} className="text-blue-600" />
                          Reserved Seat Selection
                        </span>
                        <span className="font-mono text-blue-700 font-semibold">Row A · Selected</span>
                      </div>
                      <div className="grid grid-cols-6 gap-1.5">
                        {['A1', 'A2', 'A3', 'A4', 'A5', 'A6'].map((seat) => {
                          const isTaken = seat === 'A1' || seat === 'A2'
                          const isSelected = seat === 'A4'
                          return (
                            <div
                              key={seat}
                              className={`h-6 rounded text-[10px] font-mono font-medium flex items-center justify-center border ${
                                isSelected
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                  : isTaken
                                  ? 'bg-gray-200 text-gray-400 border-gray-200'
                                  : 'bg-white text-gray-700 border-gray-200'
                              }`}
                            >
                              {seat}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px]">
                    <span className="flex items-center gap-1 text-gray-600 font-medium">
                      <ShieldCheck size={13} className="text-blue-600" />
                      Host Organization
                    </span>
                    <span className="text-blue-700 font-semibold">Live Availability</span>
                  </div>
                </div>

                {/* Verified Digital Pass Card */}
                <div className="sm:col-span-5 bg-white rounded-xl border border-gray-200 p-4 flex flex-col justify-between shadow-xs">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2.5 mb-3">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      DIGITAL PASS
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      <CheckCircle2 size={10} /> Pass Preview
                    </span>
                  </div>

                  {/* Clean crisp simulated QR badge */}
                  <div className="bg-[#F7F8FA] border border-gray-200 rounded-lg p-3 flex flex-col items-center justify-center my-1">
                    <div className="bg-white p-2 rounded-md border border-gray-200 shadow-2xs">
                      <QrCode size={72} className="text-gray-900" strokeWidth={1.6} />
                    </div>
                    <span className="font-mono text-[10px] font-semibold text-gray-600 mt-2 tracking-wider">
                      SAMPLE QR TOKEN
                    </span>
                  </div>

                  <div className="pt-2.5 border-t border-gray-100 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-500">Pass Holder</span>
                      <span className="font-medium text-gray-900">Registered Student</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-500">Check-In Gate</span>
                      <span className="font-mono font-medium text-gray-900">Venue Entrance</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
