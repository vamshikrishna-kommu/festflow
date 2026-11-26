import { useRef } from 'react'
import {
  FileText,
  Users2,
  ShieldCheck,
  QrCode,
  Bell,
  BadgeCheck,
} from 'lucide-react'
import { Card } from '@/components/ui'
import { useStaggerReveal } from '@/lib/motion'

const CAPABILITY_LIST = [
  {
    icon: FileText,
    title: 'Custom Registration Forms',
    description:
      'Collect exact participant metadata — department, year of study, GitHub profiles, dietary notes, or custom file fields.',
    badge: 'Form Builder',
  },
  {
    icon: Users2,
    title: 'Team & Solo Roster Controls',
    description:
      'Enforce min/max team limits for hackathons, collect teammate rosters, and handle solo entries automatically.',
    badge: 'Team Engine',
  },
  {
    icon: ShieldCheck,
    title: 'Direct UPI Verification',
    description:
      'Collect ticket payments directly via club UPI QR/intent with 12-digit UTR matching and audit-logged approval.',
    badge: 'Direct Settlement',
  },
  {
    icon: QrCode,
    title: 'Digital Passes & Gate Entry',
    description:
      'Issue tamper-resistant boarding passes with unique QR tokens and verified organizer-only gate attendance controls.',
    badge: 'Gate Security',
  },
  {
    icon: BadgeCheck,
    title: 'Role-Based Club Teams',
    description:
      'Assign granular permissions to co-organizers, treasurers, and gate coordinators inside a shared club workspace.',
    badge: 'Club RBAC',
  },
  {
    icon: Bell,
    title: 'Real-Time Notifications',
    description:
      'Notify attendees the instant their pass is verified, seats are confirmed, or event schedules are updated.',
    badge: 'Live Pipeline',
  },
]

export function PlatformCapabilitiesSection() {
  const gridRef = useRef<HTMLDivElement>(null)
  useStaggerReveal(gridRef, '.capability-card', { y: 18, stagger: 0.05 })

  return (
    <section
      id="features"
      aria-labelledby="capabilities-heading"
      className="relative scroll-mt-24 py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full"
    >
      <div id="capabilities" className="sr-only" />

      {/* Section Header */}
      <div className="mb-10 sm:mb-12 max-w-2xl text-left">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 mb-3">
          Platform Capabilities
        </span>
        <h2
          id="capabilities-heading"
          className="font-display font-bold text-2xl sm:text-4xl text-gray-900 tracking-tight"
        >
          Everything your campus event needs. Built for reliability.
        </h2>
        <p className="text-sm sm:text-base text-gray-600 mt-3 leading-relaxed">
          Engineered from the ground up to solve real college fest logistics without bloated setup or per-ticket transaction fees.
        </p>
      </div>

      {/* Grid */}
      <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {CAPABILITY_LIST.map(({ icon: Icon, title, description, badge }) => (
          <Card
            key={title}
            variant="default"
            className="capability-card p-6 h-full flex flex-col justify-between text-left hover:border-gray-300 hover:shadow-md transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 text-gray-700 flex items-center justify-center shrink-0">
                  <Icon size={18} />
                </div>
                <span className="font-mono text-[11px] font-medium text-gray-500">
                  {badge}
                </span>
              </div>

              <h3 className="font-display font-semibold text-base text-gray-900 mb-2">
                {title}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                {description}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}
