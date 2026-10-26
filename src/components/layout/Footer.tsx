import { Link } from 'react-router'
import { Sparkles, Globe, Share2, Rss, Heart } from 'lucide-react'

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
    { label: 'Help Desk', href: '/contact' },
    { label: 'Contact Team', href: '/contact' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Security & RLS', href: '/privacy' },
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
      className="relative mt-24 border-t border-[oklch(100%_0_0_/_0.06)] bg-[var(--color-surface-1)] overflow-hidden"
      aria-label="Site footer"
    >
      {/* Glow accent */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] max-w-full h-[1px] bg-gradient-to-r from-transparent via-[var(--color-brand-purple)] to-transparent opacity-60"
        aria-hidden="true"
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 lg:gap-16">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link
              to="/"
              className="inline-flex items-center gap-2 mb-4"
              aria-label="FestFlow home"
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-brand-purple)] to-[var(--color-brand-pink)]">
                <Sparkles size={16} className="text-white" />
              </span>
              <span className="font-display font-bold text-lg text-[var(--color-text-primary)]">
                FestFlow
              </span>
            </Link>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed max-w-[220px]">
              The all-in-one event platform built for college clubs and their communities.
            </p>
            {/* Socials */}
            <div className="flex gap-3 mt-5">
              {SOCIALS.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-4)] transition-colors"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([group, links]) => (
            <div key={group}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-4">
                {group}
              </h3>
              <ul className="space-y-2.5" role="list">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    {href.startsWith('/') ? (
                      <Link
                        to={href}
                        className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                      >
                        {label}
                      </Link>
                    ) : (
                      <a
                        href={href}
                        className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                      >
                        {label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-[oklch(100%_0_0_/_0.06)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[var(--color-text-muted)]">
            © {new Date().getFullYear()} FestFlow. All rights reserved.
          </p>
          <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
            Built with{' '}
            <Heart
              size={11}
              className="text-[var(--color-brand-pink)] fill-[var(--color-brand-pink)]"
              aria-label="love"
            />{' '}
            for campus communities
          </p>
        </div>
      </div>
    </footer>
  )
}
