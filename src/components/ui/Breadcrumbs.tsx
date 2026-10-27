import { Link } from 'react-router'
import { ChevronRight, Home } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  showHome?: boolean
  className?: string
}

export function Breadcrumbs({ items, showHome = false, className = '' }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] ${className}`}>
      {showHome && (
        <>
          <Link
            to="/"
            className="hover:text-[var(--color-text-primary)] transition-colors flex items-center justify-center p-0.5"
            aria-label="Home"
          >
            <Home size={13} />
          </Link>
          <ChevronRight size={12} className="text-[var(--color-text-disabled)] shrink-0" aria-hidden="true" />
        </>
      )}

      {items.map((item, index) => {
        const isLast = index === items.length - 1

        return (
          <div key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 && (
              <ChevronRight size={12} className="text-[var(--color-text-disabled)] shrink-0" aria-hidden="true" />
            )}
            {item.href && !isLast ? (
              <Link
                to={item.href}
                className="hover:text-[var(--color-text-primary)] transition-colors max-w-[140px] sm:max-w-none truncate"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={`font-medium max-w-[160px] sm:max-w-none truncate ${
                  isLast ? 'text-[var(--color-text-primary)] font-semibold' : ''
                }`}
                aria-current={isLast ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
          </div>
        )
      })}
    </nav>
  )
}
