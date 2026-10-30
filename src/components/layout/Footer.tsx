import { Link } from 'react-router'
import { Globe, Share2, Rss, Heart } from 'lucide-react'
import { Logo } from '@/components/ui'

const FOOTER_LINKS = {
  Platform: [
    { label: 'Discover Events', href: '/discover' },
    { label: 'For College Clubs', href: '/club/signup' },
    { label: 'Features', href: '/#features' },
    { label: 'Club Login', href: '/club/login' },
  ],
  Community: [
    { label: 'About FestFlow', href: '/#features' },
    { label: 'Student Login', href: '/student/login' },
    { label: 'Help & Support', href: '/contact' },
    { label: 'Contact Team', href: '/contact' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Security', href: '/privacy' },
  ],
}

const SOCIALS = [
  { icon: Globe,  label: 'Discover Events', href: '/discover' },
  { icon: Share2, label: 'Contact Support', href: '/contact' },
  { icon: Rss,    label: 'Platform Features', href: '/#features' },
]

export function Footer() {
  return (
    <footer
      className="relative mt-0 border-t border-white/[0.07] overflow-hidden"
      style={{ background: '#08080A' }}
      aria-label="Site footer"
    >
      {/* Gradient top line */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[520px] max-w-full h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, #18CFFC, #7F1AFB, #ED47FC, transparent)' }}
        aria-hidden="true"
      />

      {/* Subtle background glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at top, rgba(127, 26, 251, 0.12) 0%, rgba(24, 207, 252, 0.05) 50%, transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-16 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 lg:gap-12 mb-12 sm:mb-14">
          {/* Brand column */}
          <div className="col-span-2">
            <Link
              to="/"
              className="inline-flex items-center mb-5 group"
              aria-label="FestFlow home"
            >
              <Logo variant="footer" />
            </Link>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed max-w-[230px] mb-6">
              The 100% free event platform built for college clubs and their student communities.
            </p>
            {/* Socials */}
            <div className="flex gap-2.5">
              {SOCIALS.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target={href.startsWith('http') ? '_blank' : undefined}
                  rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-4)] hover:scale-105 transition-all duration-200"
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([group, links]) => (
            <div key={group}>
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">
                {group}
              </h3>
              <ul className="space-y-2.5" role="list">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      to={href}
                      className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:translate-x-0.5 inline-block transition-all duration-200"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-[oklch(100%_0_0_/_0.06)] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-[var(--color-text-muted)]">
            © {new Date().getFullYear()} FestFlow. All rights reserved.
          </p>
          <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1.5">
            Built with{' '}
            <Heart
              size={11}
              className="text-[var(--color-brand-fuchsia)] fill-[var(--color-brand-fuchsia)]"
              aria-label="love"
            />{' '}
            for campus communities
          </p>
        </div>
      </div>
    </footer>
  )
}
