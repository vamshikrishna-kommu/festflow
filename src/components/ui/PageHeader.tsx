import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs'
import { Badge } from './Badge'
import type { BadgeVariant } from '@/types'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  breadcrumbs?: BreadcrumbItem[]
  badge?: string
  badgeVariant?: BadgeVariant
  actions?: ReactNode
  backLink?: { label: string; href: string }
  className?: string
}

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  badge,
  badgeVariant = 'purple',
  actions,
  backLink,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`flex flex-col gap-3.5 mb-6 sm:mb-8 text-left ${className}`}>
      {/* Top navigation row: back link or breadcrumbs */}
      {(backLink || breadcrumbs) && (
        <div className="flex items-center gap-3">
          {backLink && (
            <Link
              to={backLink.href}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <ArrowLeft size={13} />
              <span>{backLink.label}</span>
            </Link>
          )}

          {backLink && breadcrumbs && (
            <span className="text-[var(--color-text-disabled)]">•</span>
          )}

          {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
        </div>
      )}

      {/* Title & Actions row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-[var(--color-text-primary)] tracking-tight">
              {title}
            </h1>
            {badge && (
              <Badge variant={badgeVariant} className="text-[11px] py-0.5">
                {badge}
              </Badge>
            )}
          </div>
          {subtitle && (
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
