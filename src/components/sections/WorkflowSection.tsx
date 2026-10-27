import { useState } from 'react'
import { motion } from 'motion/react'
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
} from 'lucide-react'
import { Card, Badge, Button, SectionHeader } from '@/components/ui'
import { Link } from 'react-router'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const STUDENT_STEPS = [
  {
    step: '01',
    icon: Compass,
    title: 'Discover Campus Events',
    description:
      'Browse hackathons, cultural fests, workshops, and sports meets hosted by recognized campus clubs and student chapters.',
    tag: 'No login needed to browse',
  },
  {
    step: '02',
    icon: Ticket,
    title: 'Guided Registration & Teams',
    description:
      'Register solo or build your team roster. Fill out organizer-specific custom questions with auto-filled student details.',
    tag: 'Solo or team rosters',
  },
  {
    step: '03',
    icon: CreditCard,
    title: 'Direct UPI Checkout',
    description:
      'For paid events, pay directly to the club organizer using your favorite UPI app with automated server-side verification and zero commission fees.',
    tag: 'Zero student markup',
  },
  {
    step: '04',
    icon: QrCode,
    title: 'Digital Pass in Your Vault',
    description:
      'Receive a verified digital entry pass with a unique QR code. Present it at the campus gate or venue check-in desk for fast admittance.',
    tag: 'Downloadable pass image',
  },
]

const CLUB_STEPS = [
  {
    step: '01',
    icon: PlusCircle,
    title: 'Configure Your Event Portal',
    description:
      'Set dates, registration caps, ticket pricing (free or paid), venue coordinates, and custom questions like department or dietary preference.',
    tag: 'Multi-step builder',
  },
  {
    step: '02',
    icon: Landmark,
    title: 'Connect UPI & Direct Settlement',
    description:
      'Configure your club UPI ID or merchant credentials so registration fees deposit directly into your designated student chapter account.',
    tag: '100% direct payouts',
  },
  {
    step: '03',
    icon: FileSpreadsheet,
    title: 'Monitor Live Registrations',
    description:
      'Track attendee counts, approve manual applications, review team rosters, and export comprehensive attendee reports in real time.',
    tag: 'Real-time dashboard',
  },
  {
    step: '04',
    icon: ScanLine,
    title: 'Gate QR Check-in App',
    description:
      'Volunteer organizers scan attendee passes using any phone camera. Built-in double-entry prevention ensures zero ticket fraud.',
    tag: 'High-speed camera scanner',
  },
]

export function WorkflowSection() {
  const [activeTab, setActiveTab] = useState<'student' | 'club'>('student')
  const reduced = useReducedMotion()
  const isStudent = activeTab === 'student'
  const steps = isStudent ? STUDENT_STEPS : CLUB_STEPS

  return (
    <section
      id="how-it-works"
      aria-labelledby="workflow-heading"
      className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full"
    >
      <SectionHeader
        badge="Intuitive Campus Workflow"
        badgeVariant="cyan"
        title="Engineered for students."
        gradientWord="Optimized for organizers."
        subtitle="FestFlow streamlines every step of campus event production, eliminating messy Google Forms, manual UPI screenshot verification, and chaotic spreadsheet check-ins."
        align="center"
      />

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
            <span>For Students & Attendees</span>
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
            <span>For Campus Clubs & Leads</span>
          </button>
        </div>
      </div>

      {/* 4-Step Process Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {steps.map(({ step, icon: Icon, title, description, tag }, index) => (
          <motion.div
            key={`${activeTab}-${step}`}
            initial={reduced ? undefined : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.08 }}
          >
            <Card
              className="p-6 h-full flex flex-col justify-between border border-[oklch(100%_0_0_/_0.065)] bg-[var(--color-surface-1)] hover:border-[oklch(100%_0_0_/_0.15)] transition-all duration-300"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                    style={{
                      background: isStudent
                        ? 'oklch(72% 0.16 200 / 0.15)'
                        : 'oklch(58% 0.26 285 / 0.18)',
                    }}
                  >
                    <Icon
                      size={18}
                      className={isStudent ? 'text-[var(--color-brand-cyan)]' : 'text-[var(--color-brand-violet)]'}
                    />
                  </div>
                  <span className="font-mono text-xs font-bold text-[var(--color-text-muted)] tracking-wider">
                    {step}
                  </span>
                </div>

                <h3 className="font-display font-bold text-base text-[var(--color-text-primary)] mb-2">
                  {title}
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  {description}
                </p>
              </div>

              <div className="pt-4 mt-6 border-t border-[oklch(100%_0_0_/_0.06)]">
                <Badge variant={isStudent ? 'cyan' : 'purple'} className="text-[10px] py-0.5">
                  {tag}
                </Badge>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Action Footer Callout */}
      <div className="mt-12 text-center">
        <Link to={isStudent ? '/discover' : '/club/signup'}>
          <Button
            variant={isStudent ? 'outline' : 'primary'}
            size="md"
            rightIcon={<ArrowRight size={15} />}
          >
            {isStudent ? 'Explore Live Events Near You' : 'Start Your Club Onboarding Free'}
          </Button>
        </Link>
      </div>
    </section>
  )
}
