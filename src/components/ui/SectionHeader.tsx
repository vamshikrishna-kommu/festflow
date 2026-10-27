import type { ReactNode } from 'react'
import { Badge } from './Badge'
import type { BadgeVariant } from '@/types'

export interface SectionHeaderProps {
  badge?: string
  badgeVariant?: BadgeVariant
  badgeIcon?: ReactNode
  title: string
  gradientWord?: string
  subtitle?: string
  action?: ReactNode
  align?: 'left' | 'center'
  className?: string
}

export function SectionHeader({
  badge,
  badgeVariant = 'purple',
  badgeIcon,
  title,
  gradientWord,
  subtitle,
  action,
  align = 'left',
  className = '',
}: SectionHeaderProps) {
  const isCenter = align === 'center'

  return (
    <div
      className={`flex flex-col ${
        isCenter ? 'items-center text-center' : 'items-start text-left sm:flex-row sm:items-end sm:justify-between'
      } gap-4 mb-8 sm:mb-10 ${className}`}
    >
      <div className={`space-y-2 ${isCenter ? 'max-w-2xl mx-auto' : 'max-w-xl'}`}>
        {badge && (
          <div>
            <Badge variant={badgeVariant} className="gap-1.5 py-1 px-3 text-xs">
              {badgeIcon}
              <span>{badge}</span>
            </Badge>
          </div>
        )}

        <h2 className="font-display font-bold text-2xl sm:text-3xl md:text-4xl text-[var(--color-text-primary)] tracking-tight">
          {title}{' '}
          {gradientWord && <span className="gradient-text">{gradientWord}</span>}
        </h2>

        {subtitle && (
          <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
