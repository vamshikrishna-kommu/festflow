import { useState, useRef } from 'react'
import { motion, useInView } from 'motion/react'
import {
  Compass,
  CreditCard,
  QrCode,
  Ticket,
  PlusCircle,
  FileSpreadsheet,
  ScanLine,
  Landmark,
  GraduationCap,
  Building2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react'
import { Card, Badge, Button, KineticHeading } from '@/components/ui'
import { Link } from 'react-router'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const STUDENT_STEPS = [
  {
    step: '01',
    icon: Compass,
    title: 'Discover Events',
    description:
      'Browse verified hackathons, cultural festivals, tech symposiums, and sports tournaments hosted by registered clubs.',
    tag: 'No login required to explore',
    status: 'Instant Access',
  },
  {
    step: '02',
    icon: Ticket,
    title: 'Register Solo or Team',
    description:
      'Fill out organizer-specific custom questions, submit GitHub or portfolio links, and assemble team rosters with instant auto-fill.',
    tag: 'Solo & roster support',
    status: 'Guided Form',
  },
  {
    step: '03',
    icon: CreditCard,
    title: 'Direct UPI Payment',
    description:
      'For paid passes, pay directly to the club organizer account via UPI QR/intent and submit your 12-digit UTR transaction reference.',
    tag: '0% Platform markup',
    status: 'Direct Bank Settlement',
  },
  {
    step: '04',
    icon: ShieldCheck,
    title: 'Organizer Verification',
    description:
      'The club organizer verifies your UTR against incoming bank credits. Once verified, your authentic digital pass unlocks instantly.',
    tag: 'Host verification required',
    status: 'Proof Verification',
  },
  {
    step: '05',
    icon: QrCode,
    title: 'Gate QR Admittance',
    description:
      'Present your holographic QR pass at the venue desk. Volunteer organizers scan and validate entry in milliseconds.',
    tag: 'Live duplicate lockout',
    status: 'Fast-Track Check-in',
  },
]

const CLUB_STEPS = [
  {
    step: '01',
    icon: PlusCircle,
    title: 'Launch Event Portal',
    description:
      'Set dates, registration caps, ticket pricing (free or paid), venue coordinates, and custom questions like department or dietary preference.',
    tag: 'Multi-step builder',
    status: 'Instant Setup',
  },
  {
    step: '02',
    icon: Landmark,
    title: 'Connect UPI VPA',
    description:
      'Configure your student chapter UPI ID so all ticket revenues deposit directly into your designated club bank account with zero fees.',
    tag: '100% direct payouts',
    status: 'Direct Settlement',
  },
  {
    step: '03',
    icon: FileSpreadsheet,
    title: 'Review & Verify Payments',
    description:
      'Review submitted attendee UTR numbers in your organizer portal, verify bank credits with 1 click, and auto-issue digital passes.',
    tag: 'Built-in fraud defense',
    status: 'Organizer Control',
  },
  {
    step: '04',
    icon: ScanLine,
    title: 'Gate Camera Scanner',
    description:
      'Deploy volunteers with mobile phone cameras to scan passes in real time. High-speed verification prevents pass sharing and double entries.',
    tag: 'High-speed camera scanner',
    status: 'Real-time Gate App',
  },
]

export function WorkflowSection() {
  const [activeTab, setActiveTab] = useState<'student' | 'club'>('student')
  const containerRef = useRef<HTMLElement>(null)
  const inView = useInView(containerRef, { once: true, margin: '-80px' })
  const reduced = useReducedMotion()
  const isStudent = activeTab === 'student'
  const steps = isStudent ? STUDENT_STEPS : CLUB_STEPS

  return (
    <section
      id="how-it-works"
      ref={containerRef}
      aria-labelledby="workflow-heading"
      className="relative py-20 sm:py-28 lg:py-36 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full overflow-hidden"
    >
      {/* Background radial atmosphere */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] h-[500px] pointer-events-none -z-10"
        style={{
          background:
            'radial-gradient(ellipse 60% 45% at 50% 50%, oklch(58% 0.26 285 / 0.1) 0%, oklch(72% 0.16 200 / 0.06) 50%, transparent 75%)',
        }}
      />

      {/* Kinetic Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
        <KineticHeading
          as="h2"
          badgeText="Intuitive Campus Workflow"
          badgeIcon={<CheckCircle2 size={13} />}
          className="text-2xl sm:text-4xl lg:text-5xl text-center"
          lines={[
            { text: 'Engineered for students.' },
            { text: 'Optimized for organizers.', highlight: 'Step by step.', gradientClass: 'gradient-text' },
          ]}
        />
        <p className="text-xs sm:text-sm md:text-base text-[var(--color-text-secondary)] mt-3 leading-relaxed">
          FestFlow streamlines every step of campus event operations, replacing messy Google Forms, manual screenshot chasing, and spreadsheet check-ins with an intentional motion-led pipeline.
        </p>
      </div>

      {/* Role Selector Tabs */}
      <div className="flex justify-center mb-12 sm:mb-16">
        <div className="p-1 rounded-2xl glass-elevated border border-[oklch(100%_0_0_/_0.08)] flex items-center gap-1.5 shadow-lg">
          <button
            type="button"
            onClick={() => setActiveTab('student')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
              isStudent
                ? 'bg-[var(--color-surface-3)] text-white shadow-md'
                : 'text-[var(--color-text-secondary)] hover:text-white'
            }`}
          >
            <GraduationCap size={16} className={isStudent ? 'text-[var(--color-brand-cyan)]' : ''} />
            <span>The Student Experience (5 Steps)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('club')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
              !isStudent
                ? 'text-white shadow-md'
                : 'text-[var(--color-text-secondary)] hover:text-white'
            }`}
            style={
              !isStudent
                ? {
                    background: 'oklch(58% 0.26 285 / 0.25)',
                    border: '1px solid oklch(58% 0.26 285 / 0.4)',
                  }
                : {}
            }
          >
            <Building2 size={16} className={!isStudent ? 'text-[var(--color-brand-violet)]' : ''} />
            <span>For Club Leaders & Hosts</span>
          </button>
        </div>
      </div>

      {/* Interactive Process Grid with Step Connector */}
      <div className="relative">
        {/* Animated Connector Beam behind cards on desktop */}
        <div
          aria-hidden="true"
          className="hidden lg:block absolute top-14 left-8 right-8 h-0.5 pointer-events-none -z-0"
        >
          <div className="w-full h-full bg-[oklch(100%_0_0_/_0.08)] rounded-full relative overflow-hidden">
            <motion.div
              initial={reduced ? undefined : { scaleX: 0 }}
              animate={inView || reduced ? { scaleX: 1 } : { scaleX: 0 }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: '0%' }}
              className="w-full h-full gradient-brand shadow-[0_0_12px_var(--color-brand-violet)]"
            />
          </div>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-2 ${isStudent ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4 sm:gap-5`}>
          {steps.map(({ step, icon: Icon, title, description, tag, status }, index) => (
            <motion.div
              key={`${activeTab}-${step}`}
              initial={reduced ? undefined : { opacity: 0, y: 22 }}
              animate={inView || reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 }}
              transition={{ duration: 0.45, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
              whileHover={reduced ? undefined : { y: -6, transition: { duration: 0.2 } }}
              className="h-full"
            >
              <Card
                className="p-5 sm:p-6 h-full flex flex-col justify-between border border-[oklch(100%_0_0_/_0.08)] bg-[var(--color-surface-1)] hover:border-[var(--color-brand-violet)]/40 hover:bg-[var(--color-surface-2)] transition-all duration-300 relative group overflow-hidden shadow-lg"
              >
                {/* Top ambient hover accent */}
                <div
                  aria-hidden="true"
                  className="absolute top-0 left-0 right-0 h-1 bg-transparent group-hover:gradient-brand transition-all duration-300"
                />

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-md group-hover:scale-110 transition-transform duration-300"
                      style={{
                        background: isStudent
                          ? 'oklch(72% 0.16 200 / 0.16)'
                          : 'oklch(58% 0.26 285 / 0.18)',
                      }}
                    >
                      <Icon
                        size={20}
                        className={isStudent ? 'text-[var(--color-brand-cyan)]' : 'text-[var(--color-brand-violet)]'}
                      />
                    </div>
                    <span className="font-mono text-xs font-extrabold text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] transition-colors">
                      {step}
                    </span>
                  </div>

                  <span className="text-[10px] font-bold text-[var(--color-brand-cyan)] uppercase tracking-wider block mb-1">
                    {status}
                  </span>

                  <h3 className="font-display font-bold text-base text-[var(--color-text-primary)] mb-2 group-hover:text-[var(--color-brand-violet)] transition-colors">
                    {title}
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    {description}
                  </p>
                </div>

                <div className="pt-4 mt-5 border-t border-[oklch(100%_0_0_/_0.06)] flex items-center justify-between">
                  <Badge variant={isStudent ? 'cyan' : 'purple'} className="text-[10px] py-0.5">
                    {tag}
                  </Badge>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Action Footer Callout */}
      <div className="mt-12 sm:mt-16 text-center">
        <Link to={isStudent ? '/discover' : '/club/signup'}>
          <Button
            variant={isStudent ? 'outline' : 'primary'}
            size="md"
            rightIcon={<ArrowRight size={15} />}
            className="shine-on-hover"
          >
            {isStudent ? 'Explore Campus Events Near You' : 'Start Your Club Onboarding Free'}
          </Button>
        </Link>
      </div>
    </section>
  )
}

