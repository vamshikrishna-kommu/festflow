import type { ReactNode } from 'react'
import type { BadgeVariant } from '@/types'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]',
  purple:  'bg-[oklch(58%_0.24_290_/_0.18)] text-[var(--color-brand-purple)] ring-1 ring-[oklch(58%_0.24_290_/_0.3)]',
  pink:    'bg-[oklch(65%_0.22_340_/_0.18)] text-[var(--color-brand-pink)]   ring-1 ring-[oklch(65%_0.22_340_/_0.3)]',
  amber:   'bg-[oklch(75%_0.18_65_/_0.18)]  text-[var(--color-brand-amber)]  ring-1 ring-[oklch(75%_0.18_65_/_0.3)]',
  cyan:    'bg-[oklch(70%_0.18_200_/_0.18)] text-[var(--color-brand-cyan)]   ring-1 ring-[oklch(70%_0.18_200_/_0.3)]',
  success: 'bg-[oklch(65%_0.18_145_/_0.18)] text-[oklch(65%_0.18_145)]      ring-1 ring-[oklch(65%_0.18_145_/_0.3)]',
  outline: 'bg-transparent text-[var(--color-text-secondary)] ring-1 ring-[oklch(100%_0_0_/_0.15)]',
  danger:  'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/30',
}

const CATEGORY_VARIANT_MAP: Record<string, BadgeVariant> = {
  hackathon: 'purple',
  tech:      'cyan',
  music:     'pink',
  cultural:  'pink',
  workshop:  'amber',
  seminar:   'amber',
  sports:    'success',
  gaming:    'purple',
  art:       'amber',
  social:    'default',
}

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  )
}

/** Convenience: automatically selects a variant from the event category string */
export function CategoryBadge({ category }: { category: string }) {
  const variant = CATEGORY_VARIANT_MAP[category] ?? 'default'
  return <Badge variant={variant}>{category}</Badge>
}
