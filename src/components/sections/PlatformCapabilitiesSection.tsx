import {
  FileText,
  Users2,
  ShieldCheck,
  QrCode,
  Bell,
  BadgeCheck,
} from 'lucide-react'
import { Card, SectionHeader } from '@/components/ui'

const CAPABILITY_LIST = [
  {
    icon: FileText,
    title: 'Custom Registration Fields',
    description:
      'Ask attendees custom questions: branch, year of study, GitHub profiles, dietary needs, or document uploads — configured with custom required rules.',
    colorVar: '--color-brand-violet',
    badge: 'Form Builder',
  },
  {
    icon: Users2,
    title: 'Team & Solo Roster Controls',
    description:
      'Configure precise team limits (e.g. 2 to 4 members for hackathons), mandate team names, and allow team leaders to submit complete member details.',
    colorVar: '--color-brand-fuchsia',
    badge: 'Team Engine',
  },
  {
    icon: ShieldCheck,
    title: 'Direct UPI Payments',
    description:
      'Direct club UPI collection with QR codes and intent links. Secure UTR transaction submission and manual organizer verification protect against duplicate entries.',
    colorVar: '--color-brand-cyan',
    badge: 'Payment Security',
  },
  {
    icon: QrCode,
    title: 'Camera QR Gate Check-in',
    description:
      'Gate volunteers validate digital passes using mobile phone cameras. Real-time check-in recording prevents pass sharing and duplicate admissions.',
    colorVar: '--color-brand-amber',
    badge: 'Gate Scanner',
  },
  {
    icon: BadgeCheck,
    title: 'Registered Club Profiles',
    description:
      'Every organizer completes email verification before hosting. Students can review the hosting club profile, past events, and official contact details.',
    colorVar: '--color-brand-emerald',
    badge: 'Club Directory',
  },
  {
    icon: Bell,
    title: 'Real-Time Notification Pipeline',
    description:
      'Attendees and club leads receive immediate in-app notifications whenever passes are issued, payments are verified, or applications are approved.',
    colorVar: '--color-brand-violet',
    badge: 'Live Alerts',
  },
]

export function PlatformCapabilitiesSection() {
  return (
    <section
      id="capabilities"
      aria-labelledby="capabilities-heading"
      className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full"
    >
      <SectionHeader
        badge="Engineered for Production"
        badgeVariant="purple"
        title="Everything your campus event needs."
        gradientWord="Zero fluff."
        subtitle="Built from the ground up to solve actual campus event challenges with genuine, production-verified features."
        align="left"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {CAPABILITY_LIST.map(({ icon: Icon, title, description, colorVar, badge }) => (
          <Card
            key={title}
            className="p-6 rounded-[var(--radius-card)] bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.065)] hover:border-[oklch(100%_0_0_/_0.15)] hover:bg-[var(--color-surface-2)] transition-all duration-300 flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'oklch(58% 0.26 285 / 0.14)' }}
                >
                  <Icon size={20} style={{ color: `var(${colorVar})` }} />
                </div>
                <span className="text-[10px] font-semibold text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] transition-colors">
                  {badge}
                </span>
              </div>

              <h3 className="font-display font-bold text-base text-[var(--color-text-primary)] mb-2">
                {title}
              </h3>
              <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {description}
              </p>
            </div>

            <div className="pt-4 mt-5 border-t border-[oklch(100%_0_0_/_0.06)] flex items-center justify-between">
              <span className="text-[10px] font-mono text-[var(--color-text-muted)]">Verified Feature</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}
