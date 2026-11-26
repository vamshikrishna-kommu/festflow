import { useState, useRef } from 'react'
import { Link } from 'react-router'
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
} from 'lucide-react'
import { Card, Badge, Button } from '@/components/ui'
import { useStaggerReveal } from '@/lib/motion'

const STUDENT_STEPS = [
  {
    step: '01',
    icon: Compass,
    title: 'Discover Events',
    description:
      'Browse verified hackathons, cultural festivals, tech symposiums, and sports tournaments hosted by campus clubs.',
    tag: 'Open directory',
  },
  {
    step: '02',
    icon: Ticket,
    title: 'Register & Select Seats',
    description:
      'Answer custom organizer questions, reserve seats in interactive auditorium layouts, and build team rosters.',
    tag: 'Solo & team support',
  },
  {
    step: '03',
    icon: CreditCard,
    title: 'Direct UPI Payment',
    description:
      'For paid passes, pay directly to the club UPI account via QR or app intent and submit your 12-digit UTR reference.',
    tag: '0% platform fee',
  },
  {
    step: '04',
    icon: ShieldCheck,
    title: 'Organizer Verification',
    description:
      'Club organizers match your UTR against bank credits. Once confirmed, your cryptographically verified pass unlocks.',
    tag: 'Trusted validation',
  },
  {
    step: '05',
    icon: QrCode,
    title: 'Gate QR Admittance',
    description:
      'Present your digital boarding pass at the venue entrance. Organizers scan and check you in instantly.',
    tag: 'Fast-track entry',
  },
]

const CLUB_STEPS = [
  {
    step: '01',
    icon: PlusCircle,
    title: 'Launch Event Portal',
    description:
      'Configure dates, ticket tiers, seat maps, capacity caps, and custom registration forms in minutes.',
    tag: 'Multi-step builder',
  },
  {
    step: '02',
    icon: Landmark,
    title: 'Connect UPI VPA',
    description:
      'Add your chapter UPI ID so all ticket revenues settle directly into your club bank account with zero deductions.',
    tag: '100% direct payouts',
  },
  {
    step: '03',
    icon: FileSpreadsheet,
    title: 'Verify & Approve Roster',
    description:
      'Review submitted UTR references and payment proofs in your dashboard, approve with one click, and auto-issue passes.',
    tag: 'Audit-logged review',
  },
  {
    step: '04',
    icon: ScanLine,
    title: 'Manage Gate Attendance',
    description:
      'Verify attendees smoothly at the venue gate with duplicate lockout protection and real-time exportable analytics.',
    tag: 'Real-time roster',
  },
]

export function WorkflowSection() {
  const [activeTab, setActiveTab] = useState<'student' | 'club'>('student')
  const gridRef = useRef<HTMLDivElement>(null)
  const isStudent = activeTab === 'student'
  const steps = isStudent ? STUDENT_STEPS : CLUB_STEPS

  useStaggerReveal(gridRef, '.workflow-card', { y: 16, stagger: 0.05 })

  return (
    <section
      id="how-it-works"
      aria-labelledby="workflow-heading"
      className="relative py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full"
    >
      {/* Section Header */}
      <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-gray-700 bg-gray-100 border border-gray-200 mb-3">
          How FestFlow Works
        </span>
        <h2
          id="workflow-heading"
          className="font-display font-bold text-2xl sm:text-4xl text-gray-900 tracking-tight"
        >
          Engineered for students. Optimized for clubs.
        </h2>
        <p className="text-sm sm:text-base text-gray-600 mt-3 leading-relaxed">
          Replace scattered Google Forms, payment screenshot chasing, and spreadsheet check-ins with a single, clean workflow.
        </p>
      </div>

      {/* Role Selector Tabs */}
      <div className="flex justify-center mb-10 sm:mb-12">
        <div className="p-1 rounded-xl bg-gray-100 border border-gray-200 inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('student')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
              isStudent
                ? 'bg-white text-gray-900 shadow-xs border border-gray-200/80 font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <GraduationCap size={16} className={isStudent ? 'text-blue-600' : 'text-gray-500'} />
            <span>Student Experience</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('club')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
              !isStudent
                ? 'bg-white text-gray-900 shadow-xs border border-gray-200/80 font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Building2 size={16} className={!isStudent ? 'text-blue-600' : 'text-gray-500'} />
            <span>Club Organizers</span>
          </button>
        </div>
      </div>

      {/* Interactive Step Grid */}
      <div
        ref={gridRef}
        className={`grid grid-cols-1 md:grid-cols-2 ${isStudent ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4 sm:gap-5`}
      >
        {steps.map(({ step, icon: Icon, title, description, tag }) => (
          <Card
            key={`${activeTab}-${step}`}
            variant="default"
            className="workflow-card p-5 h-full flex flex-col justify-between hover:border-gray-300 transition-colors"
          >
            <div className="text-left">
              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200/80 text-blue-600 flex items-center justify-center shrink-0">
                  <Icon size={18} />
                </div>
                <span className="font-mono text-xs font-semibold text-gray-400">
                  {step}
                </span>
              </div>

              <h3 className="font-display font-semibold text-sm sm:text-base text-gray-900 mb-2">
                {title}
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                {description}
              </p>
            </div>

            <div className="pt-4 mt-5 border-t border-gray-100 flex items-center">
              <Badge variant="default" className="text-[10px]">
                {tag}
              </Badge>
            </div>
          </Card>
        ))}
      </div>

      {/* Action Footer */}
      <div className="mt-10 text-center">
        <Link to={isStudent ? '/discover' : '/club/signup'}>
          <Button
            variant={isStudent ? 'secondary' : 'primary'}
            size="md"
            rightIcon={<ArrowRight size={15} />}
          >
            {isStudent ? 'Explore Campus Events' : 'Create Your Club Portal'}
          </Button>
        </Link>
      </div>
    </section>
  )
}
