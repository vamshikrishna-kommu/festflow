import { Link } from 'react-router'
import { Globe, Share2, Rss, Heart, Mail } from 'lucide-react'
import { Logo } from '@/components/ui'
import { OFFICIAL_CONTACT_EMAIL, OFFICIAL_SUPPORT_MAILTO } from '@/lib/brandConfig'

const FOOTER_LINKS = {
  Platform: [
    { label: 'Discover Events', href: '/discover' },
    { label: 'For College Clubs', href: '/club/signup' },
    { label: 'Platform Features', href: '/#features' },
    { label: 'Club Login', href: '/club/login' },
  ],
  Community: [
    { label: 'Cinematic Story', href: '/cinematic' },
    { label: 'Student Login', href: '/student/login' },
    { label: 'Help & Support', href: '/contact' },
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

export interface FooterProps {
  className?: string
}

export function Footer({ className = '' }: FooterProps) {
  return (
    <footer
      className={`relative mt-auto border-t border-gray-200/80 bg-white ${className}`.trim()}
      aria-label="Site footer"
    >
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12 mb-12 sm:mb-14">
          {/* Brand column */}
          <div className="col-span-2 space-y-4">
            <Link
              to="/"
              className="inline-flex items-center group"
              aria-label="FestFlow home"
            >
              <Logo variant="footer" />
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
              The modern, unified event platform built for campus clubs, student communities, and verified event ticketing.
            </p>
            <div>
              <a
                href={OFFICIAL_SUPPORT_MAILTO}
                className="inline-flex items-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Mail size={13} />
                <span>{OFFICIAL_CONTACT_EMAIL}</span>
              </a>
            </div>
            {/* Socials */}
            <div className="flex gap-2 pt-1">
              {SOCIALS.map(({ icon: Icon, label, href }) =>
                href.startsWith('http') ? (
                  <a
                    key={label}
                    href={href}
                    aria-label={label}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-colors"
                  >
                    <Icon size={14} />
                  </a>
                ) : (
                  <Link
                    key={label}
                    to={href}
                    aria-label={label}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-colors"
                  >
                    <Icon size={14} />
                  </Link>
                )
              )}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([group, links]) => (
            <div key={group} className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900">
                {group}
              </h3>
              <ul className="space-y-2.5" role="list">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      to={href}
                      className="text-xs sm:text-sm text-gray-600 hover:text-gray-900 transition-colors inline-block"
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
        <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <p>
            © {new Date().getFullYear()} FestFlow. All rights reserved.
          </p>
          <p className="flex items-center gap-1.5">
            Crafted with{' '}
            <Heart
              size={11}
              className="text-rose-500 fill-rose-500"
              aria-label="love"
            />{' '}
            for campus communities
          </p>
        </div>
      </div>
    </footer>
  )
}
