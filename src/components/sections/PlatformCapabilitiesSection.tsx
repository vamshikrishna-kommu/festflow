import { useRef } from 'react'
import { motion, useInView } from 'motion/react'
import {
  FileText,
  Users2,
  ShieldCheck,
  QrCode,
  Bell,
  BadgeCheck,
  Sparkles,
} from 'lucide-react'
import { Card, KineticHeading } from '@/components/ui'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const CAPABILITY_LIST = [
  {
    icon: FileText,
    title: 'Custom Registration Fields',
    description:
      'Ask attendees custom questions: branch, year of study, GitHub profiles, dietary needs, or document uploads — configured with custom required rules.',
    accentColor: '#18CFFC',
    badge: 'Form Builder',
    direction: -1,
  },
  {
    icon: Users2,
    title: 'Team & Solo Roster Controls',
    description:
      'Configure precise team limits (e.g. 2 to 4 members for hackathons), mandate team names, and allow team leaders to submit complete member details.',
    accentColor: '#7F1AFB',
    badge: 'Team Engine',
    direction: 0,
  },
  {
    icon: ShieldCheck,
    title: 'Direct UPI Payments',
    description:
      'Direct club UPI collection with QR codes and intent links. Secure UTR transaction submission and manual organizer verification protect against duplicate entries.',
    accentColor: '#07A4FC',
    badge: 'Payment Security',
    direction: 1,
  },
  {
    icon: QrCode,
    title: 'Camera QR Gate Check-in',
    description:
      'Gate volunteers validate digital passes using mobile phone cameras. Real-time check-in recording prevents pass sharing and duplicate admissions.',
    accentColor: '#ED47FC',
    badge: 'Gate Scanner',
    direction: -1,
  },
  {
    icon: BadgeCheck,
    title: 'Registered Club Profiles',
    description:
      'Every organizer completes email verification before hosting. Students can review the hosting club profile, past events, and official contact details.',
    accentColor: '#10B981',
    badge: 'Club Directory',
    direction: 0,
  },
  {
    icon: Bell,
    title: 'Real-Time Notification Pipeline',
    description:
      'Attendees and club leads receive immediate in-app notifications whenever passes are issued, payments are verified, or applications are approved.',
    accentColor: '#18CFFC',
    badge: 'Live Alerts',
    direction: 1,
  },
]

export function PlatformCapabilitiesSection() {
  const containerRef = useRef<HTMLElement>(null)
  const inView = useInView(containerRef, { once: true, margin: '-70px' })
  const reduced = useReducedMotion()

  return (
    <section
      id="features"
      ref={containerRef}
      aria-labelledby="capabilities-heading"
      className="relative scroll-mt-24 py-20 sm:py-28 lg:py-36 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full"
    >
      <div id="capabilities" className="sr-only" />

      {/* Kinetic Section Header */}
      <div className="mb-12 sm:mb-16 max-w-3xl">
        <KineticHeading
          as="h2"
          id="capabilities-heading"
          badgeText="Engineered for Production"
          badgeIcon={<Sparkles size={12} />}
          className="text-2xl sm:text-4xl lg:text-5xl"
          lines={[
            { text: 'Everything your campus event needs.' },
            { text: 'Built for scale.', highlight: 'Zero fluff.', gradientClass: 'gradient-text' },
          ]}
        />
        <p className="text-xs sm:text-sm md:text-base text-zinc-400 mt-3 leading-relaxed">
          Engineered from the ground up to solve actual campus event challenges with genuine, production-verified features.
        </p>
      </div>

      {/* Choreographed Bento Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {CAPABILITY_LIST.map(({ icon: Icon, title, description, accentColor, badge, direction }, index) => {
          const initialOffset = {
            opacity: 0,
            y: 24,
            x: direction * 15,
          }

          return (
            <motion.div
              key={title}
              initial={reduced ? undefined : initialOffset}
              animate={inView || reduced ? { opacity: 1, y: 0, x: 0 } : initialOffset}
              transition={{
                duration: 0.5,
                delay: index * 0.07,
                ease: [0.16, 1, 0.3, 1],
              }}
              whileHover={reduced ? undefined : { y: -6, scale: 1.01 }}
              className="h-full"
            >
              <Card
                className="p-6 h-full rounded-2xl bg-[#0E0E12] border border-white/[0.07] hover:border-white/20 hover:bg-[#14141A] transition-all duration-300 flex flex-col justify-between group shadow-xl hover:shadow-[0_20px_50px_rgba(0,0,0,0.7),0_0_25px_rgba(255,87,34,0.1)] relative overflow-hidden"
              >
                {/* Subtle radial mouse hover illumination */}
                <div
                  aria-hidden="true"
                  className="absolute -right-12 -top-12 w-32 h-32 rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)`,
                    filter: 'blur(25px)',
                  }}
                />

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform duration-300"
                      style={{
                        background: `${accentColor}18`,
                        color: accentColor,
                        border: `1px solid ${accentColor}30`,
                      }}
                    >
                      <Icon size={20} />
                    </div>
                    <span className="text-[10px] font-semibold tracking-wider uppercase text-zinc-500 group-hover:text-zinc-300 transition-colors">
                      {badge}
                    </span>
                  </div>

                  <h3 className="font-display font-bold text-base text-white mb-2 transition-colors">
                    {title}
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                    {description}
                  </p>
                </div>

                <div className="pt-4 mt-5 border-t border-white/[0.06] flex items-center justify-between">
                  <span className="text-[10px] font-mono text-zinc-500">Production Ready</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                </div>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
