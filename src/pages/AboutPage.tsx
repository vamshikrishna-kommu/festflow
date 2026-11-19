import { motion } from 'motion/react'
import { Link } from 'react-router'
import {
  Sparkles,
  Zap,
  ShieldCheck,
  Compass,
  ArrowRight,
  GraduationCap,
  Building2,
  Ticket,
  QrCode,
  LayoutGrid,
  CheckCircle2,
  Lock,
  Flame,
  Globe2,
  Users,
} from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { SEOHead } from '@/components/seo/SEOHead'
import { Button, Badge, Card } from '@/components/ui'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { staggerContainer, fadeUp } from '@/lib/animations'

const CORE_VALUES = [
  {
    icon: Zap,
    title: 'Autonomy',
    badge: 'Self-Sovereign',
    description:
      'Clubs retain total control over tickets, verification rules, seating tiers, and direct peer-to-peer UPI funds. No middleman approvals.',
    gradient: 'from-[#18CFFC]/20 to-[#07A4FC]/5',
    accent: '#18CFFC',
  },
  {
    icon: Lock,
    title: 'Privacy',
    badge: 'Zero Surveillance',
    description:
      'Campus data belongs strictly to students. We collect only what is strictly necessary to generate cryptographically signed entry passes.',
    gradient: 'from-[#7F1AFB]/20 to-[#0D56FB]/5',
    accent: '#7F1AFB',
  },
  {
    icon: Flame,
    title: 'Speed',
    badge: '< 100ms Interactions',
    description:
      'From discovering a hackathon to securing a reserved hall seat: rapid search indexing, real-time seat locks, and instant QR verification.',
    gradient: 'from-[#ED47FC]/20 to-[#7F1AFB]/5',
    accent: '#ED47FC',
  },
  {
    icon: Globe2,
    title: 'Zero Gatekeeping',
    badge: 'Open Campus',
    description:
      'Every student organization — whether an official technical council or an informal esports guild — gets enterprise-grade tools for free.',
    gradient: 'from-[#07A4FC]/20 to-[#18CFFC]/5',
    accent: '#07A4FC',
  },
]

const STUDENT_BENEFITS = [
  {
    icon: Compass,
    title: 'Seamless Campus Discovery',
    description:
      'Explore live hackathons, cultural festivals, academic symposiums, and esports showdowns across colleges with instant search and category filters.',
  },
  {
    icon: Ticket,
    title: 'Guaranteed Entry Passes',
    description:
      'Cryptographically unique QR passes backed by offline storage and offline-first PWA sync, ensuring frictionless gate entry even without signal.',
  },
  {
    icon: LayoutGrid,
    title: 'Transparent Interactive Seating',
    description:
      'Select auditorium rows, balcony tiers, or stage-front zones in real-time with visual floor maps and seat holds.',
  },
  {
    icon: Users,
    title: 'Frictionless Team Registrations',
    description:
      'Form or join hackathon rosters with one-click invite codes, teammate discovery feeds, and coordinated pass issuance.',
  },
]

const CLUB_BENEFITS = [
  {
    icon: ShieldCheck,
    title: '0% Platform Commission',
    description:
      'Direct peer-to-peer UPI verification. Every rupee paid by attendees flows straight into your club’s bank account with zero platform cuts.',
  },
  {
    icon: QrCode,
    title: 'Direct UPI & OCR Verification',
    description:
      'Automated transaction reference checks with OCR receipt validation reduce check-in approval queues from hours to seconds.',
  },
  {
    icon: LayoutGrid,
    title: 'Interactive Seat Map Manager',
    description:
      'Drag-and-drop auditorium layout designer to partition VIP rows, team pods, and general admission blocks effortlessly.',
  },
  {
    icon: Zap,
    title: 'Automated Attendee Rosters',
    description:
      'Export one-click verified attendee lists, CSV/Excel summaries, check-in audit logs, and trigger automated campus notifications.',
  },
]

export default function AboutPage() {
  const reduced = useReducedMotion()

  return (
    <PageShell fullbleed>
      <SEOHead
        title="About FestFlow — The Digital Backbone for Campus Life"
        description="FestFlow bridges the gap between student ambition and event execution with zero commissions, verified entry passes, and real-time seating maps."
        canonicalPath="/about"
      />

      {/* ── 1. Hero Section: Editorial & Glowing Backdrop ────────────────── */}
      <section className="relative overflow-hidden pt-28 pb-20 sm:pt-36 sm:pb-28 border-b border-white/[0.08] bg-gradient-to-b from-[#08080A] via-[#0E0E12] to-[#08080A]">
        {/* Glow Spheres */}
        <div
          aria-hidden="true"
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[480px] pointer-events-none rounded-full blur-[140px] opacity-25"
          style={{
            background:
              'radial-gradient(ellipse at center, #18CFFC 0%, #7F1AFB 45%, transparent 75%)',
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 grid-pattern opacity-15 pointer-events-none"
        />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            variants={staggerContainer}
            initial={reduced ? 'visible' : 'hidden'}
            animate="visible"
            className="flex flex-col items-center"
          >
            <motion.div variants={reduced ? undefined : fadeUp} className="mb-4">
              <Badge variant="brand" className="px-3.5 py-1 text-xs tracking-wide">
                <Sparkles size={12} className="text-[#18CFFC]" />
                The Campus Revolution
              </Badge>
            </motion.div>

            <motion.h1
              variants={reduced ? undefined : fadeUp}
              className="font-display font-black text-4xl sm:text-5xl md:text-6xl text-white tracking-tight leading-[1.1] mb-6"
            >
              The Digital Backbone for{' '}
              <span className="bg-gradient-to-r from-[#18CFFC] via-[#07A4FC] to-[#ED47FC] bg-clip-text text-transparent">
                Campus Life
              </span>
            </motion.h1>

            <motion.p
              variants={reduced ? undefined : fadeUp}
              className="max-w-3xl text-base sm:text-lg text-[var(--color-text-secondary)] font-body leading-relaxed mb-10"
            >
              FestFlow transforms chaotic college event organizing into seamless, cinematic
              experiences. Built by students, for students — delivering transparent ticketing,
              real-time seat mapping, and zero platform cuts.
            </motion.p>

            <motion.div
              variants={reduced ? undefined : fadeUp}
              className="flex flex-wrap items-center justify-center gap-4"
            >
              <Link to="/discover">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-[#18CFFC] to-[#0D56FB] text-white hover:brightness-110 font-semibold shadow-lg shadow-[#18CFFC]/20 px-7"
                >
                  <Compass size={18} />
                  Explore Campus Events
                  <ArrowRight size={16} />
                </Button>
              </Link>
              <Link to="/club/signup">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/20 hover:border-[#18CFFC]/50 text-white hover:bg-white/[0.04] px-6 font-medium"
                >
                  <Building2 size={18} className="text-[#18CFFC]" />
                  Onboard Your Club
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── 2. Mission Section: Why We Built FestFlow ────────────────────── */}
      <section className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-b border-white/[0.06] bg-[#0E0E12]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs uppercase tracking-widest font-mono text-[#18CFFC] mb-2 block">
              Origin & Mission
            </span>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-white tracking-tight mb-5">
              Why We Built FestFlow
            </h2>
            <p className="text-[var(--color-text-secondary)] text-base sm:text-lg leading-relaxed">
              Every academic year, vibrant student communities burn countless hours managing Google
              Forms, tracking unverified UPI screenshots, fielding lost entry passes, and refereeing
              auditorium crowding.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-5 text-left">
              <div className="p-6 rounded-2xl bg-[#14141A] border border-white/[0.08] relative overflow-hidden group hover:border-[#18CFFC]/30 transition-all">
                <div className="text-sm font-semibold text-rose-400 mb-2 font-mono flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                  The Legacy Campus Pain
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  Messy spreadsheets, 5-10% commercial ticketing fees gouging club treasuries, forged
                  PDF passes, manual attendee roll calls at auditorium doors, and zero real-time seat
                  selection.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-gradient-to-br from-[#18CFFC]/10 via-[#14141A] to-[#7F1AFB]/10 border border-[#18CFFC]/30 relative overflow-hidden group shadow-lg shadow-[#18CFFC]/5">
                <div className="text-sm font-semibold text-[#18CFFC] mb-2 font-mono flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#18CFFC]" />
                  The FestFlow Solution
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  An uncompromising, unified operating system designed specifically for collegiate
                  life: verified college credentials, automated payment validation, instant offline
                  QR check-in, and interactive seat booking.
                </p>
              </div>
            </div>

            <div className="p-8 rounded-2xl bg-gradient-to-br from-[#14141A] to-[#1C1C24] border border-white/10 flex flex-col justify-between h-full">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#7F1AFB]/20 border border-[#7F1AFB]/30 flex items-center justify-center text-[#ED47FC] mb-6">
                  <Sparkles size={24} />
                </div>
                <h3 className="font-display font-bold text-2xl text-white mb-3">
                  Bridging Ambition & Execution
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-6">
                  College students possess unbridled technical creativity and cultural energy.
                  FestFlow handles the infrastructure so campus leaders can dedicate 100% of their
                  focus to delivering unforgettable collegiate memories.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/[0.08] text-center">
                <div>
                  <div className="font-display font-extrabold text-2xl text-[#18CFFC]">0%</div>
                  <div className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-mono">Commission</div>
                </div>
                <div>
                  <div className="font-display font-extrabold text-2xl text-[#ED47FC]">&lt;1s</div>
                  <div className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-mono">Scan Pass</div>
                </div>
                <div>
                  <div className="font-display font-extrabold text-2xl text-white">100%</div>
                  <div className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-mono">Direct UPI</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Dual Pillars: For Students & For Clubs ───────────────────── */}
      <section className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-b border-white/[0.06] bg-[#08080A]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs uppercase tracking-widest font-mono text-[#ED47FC] mb-2 block">
              Dual Ecosystem
            </span>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-white tracking-tight mb-4">
              Engineered For Both Sides of Campus
            </h2>
            <p className="text-[var(--color-text-secondary)] text-sm sm:text-base">
              Whether you are discovering your next hackathon or directing an inter-college festival
              of 5,000 attendees, FestFlow has purpose-built features for you.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Left Pillar: For Students */}
            <div className="p-8 rounded-3xl bg-[#0E0E12] border border-white/[0.08] flex flex-col justify-between relative overflow-hidden">
              <div
                aria-hidden="true"
                className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-[#18CFFC]/10 blur-3xl pointer-events-none"
              />
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#18CFFC]/15 border border-[#18CFFC]/30 flex items-center justify-center text-[#18CFFC]">
                    <GraduationCap size={24} />
                  </div>
                  <div>
                    <span className="text-xs font-mono text-[#18CFFC] uppercase tracking-wider">Attendee Pillar</span>
                    <h3 className="font-display font-bold text-2xl text-white">For Students</h3>
                  </div>
                </div>

                <p className="text-sm text-[var(--color-text-secondary)] mb-8">
                  Never miss an iconic campus experience. Keep your verified tickets, team rosters,
                  and auditorium seats always within arm's reach.
                </p>

                <div className="space-y-4">
                  {STUDENT_BENEFITS.map((b) => {
                    const Icon = b.icon
                    return (
                      <div
                        key={b.title}
                        className="flex items-start gap-4 p-4 rounded-xl bg-[#14141A] border border-white/[0.04] hover:border-[#18CFFC]/20 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#18CFFC]/10 text-[#18CFFC] flex items-center justify-center shrink-0 mt-0.5">
                          <Icon size={16} />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-white">{b.title}</h4>
                          <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                            {b.description}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/[0.06]">
                <Link to="/discover">
                  <Button
                    variant="outline"
                    className="w-full border-[#18CFFC]/30 text-[#18CFFC] hover:bg-[#18CFFC]/10 justify-center"
                  >
                    Browse Campus Feed
                    <ArrowRight size={15} />
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right Pillar: For Clubs */}
            <div className="p-8 rounded-3xl bg-[#0E0E12] border border-white/[0.08] flex flex-col justify-between relative overflow-hidden">
              <div
                aria-hidden="true"
                className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[#7F1AFB]/10 blur-3xl pointer-events-none"
              />
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-[#7F1AFB]/15 border border-[#7F1AFB]/30 flex items-center justify-center text-[#ED47FC]">
                    <Building2 size={24} />
                  </div>
                  <div>
                    <span className="text-xs font-mono text-[#ED47FC] uppercase tracking-wider">Organizer Pillar</span>
                    <h3 className="font-display font-bold text-2xl text-white">For Campus Clubs</h3>
                  </div>
                </div>

                <p className="text-sm text-[var(--color-text-secondary)] mb-8">
                  Supercharge your council or club with enterprise-grade event hosting tools — without
                  surrendering a single cent of your budget.
                </p>

                <div className="space-y-4">
                  {CLUB_BENEFITS.map((b) => {
                    const Icon = b.icon
                    return (
                      <div
                        key={b.title}
                        className="flex items-start gap-4 p-4 rounded-xl bg-[#14141A] border border-white/[0.04] hover:border-[#ED47FC]/20 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#7F1AFB]/15 text-[#ED47FC] flex items-center justify-center shrink-0 mt-0.5">
                          <Icon size={16} />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm text-white">{b.title}</h4>
                          <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                            {b.description}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/[0.06]">
                <Link to="/club/signup">
                  <Button
                    variant="outline"
                    className="w-full border-[#7F1AFB]/30 text-[#ED47FC] hover:bg-[#7F1AFB]/10 justify-center"
                  >
                    Register Your Chapter
                    <ArrowRight size={15} />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Core Values ──────────────────────────────────────────────── */}
      <section className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-b border-white/[0.06] bg-[#0E0E12]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs uppercase tracking-widest font-mono text-[#07A4FC] mb-2 block">
              Guiding Principles
            </span>
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-white tracking-tight mb-4">
              Core Engineering Values
            </h2>
            <p className="text-[var(--color-text-secondary)] text-sm sm:text-base">
              The foundational pillars steering every architecture decision, feature release, and
              design aesthetic in FestFlow.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {CORE_VALUES.map((val) => {
              const Icon = val.icon
              return (
                <Card
                  key={val.title}
                  className="p-6 rounded-2xl bg-[#14141A] border border-white/[0.08] hover:border-white/20 transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 border transition-transform group-hover:scale-105"
                      style={{
                        backgroundColor: `${val.accent}15`,
                        borderColor: `${val.accent}30`,
                        color: val.accent,
                      }}
                    >
                      <Icon size={22} />
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-display font-bold text-lg text-white">{val.title}</h3>
                      <span
                        className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
                        style={{
                          color: val.accent,
                          borderColor: `${val.accent}30`,
                          backgroundColor: `${val.accent}10`,
                        }}
                      >
                        {val.badge}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                      {val.description}
                    </p>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── 5. Call to Action: Join FestFlow ─────────────────────────────── */}
      <section className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#08080A] via-[#0E0E12] to-[#08080A] text-center overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 70% at 50% 50%, rgba(127, 26, 251, 0.15) 0%, rgba(24, 207, 252, 0.08) 50%, transparent 80%)',
          }}
        />

        <div className="relative max-w-3xl mx-auto">
          <Badge variant="brand" className="mb-4">
            <Sparkles size={12} className="text-[#18CFFC]" />
            Your Turn to Experience It
          </Badge>

          <h2 className="font-display font-black text-3xl sm:text-5xl text-white tracking-tight leading-tight mb-6">
            Ready to Redefine Your{' '}
            <span className="bg-gradient-to-r from-[#18CFFC] via-[#07A4FC] to-[#ED47FC] bg-clip-text text-transparent">
              Campus Experience?
            </span>
          </h2>

          <p className="text-sm sm:text-base text-[var(--color-text-secondary)] font-body leading-relaxed mb-10 max-w-xl mx-auto">
            Join thousands of students and hundreds of student organizers building vibrant college
            memories without friction or compromises.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/discover">
              <Button
                size="lg"
                className="bg-gradient-to-r from-[#18CFFC] to-[#0D56FB] text-white hover:brightness-110 font-semibold shadow-xl shadow-[#18CFFC]/20 px-8"
              >
                Find an Event
                <ArrowRight size={16} />
              </Button>
            </Link>
            <Link to="/club/signup">
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 hover:border-[#ED47FC]/50 text-white hover:bg-white/[0.04] px-7"
              >
                Create Club Account
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  )
}
