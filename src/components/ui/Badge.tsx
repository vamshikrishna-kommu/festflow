import type { ReactNode } from 'react'
import type { BadgeVariant } from '@/types'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
  pulse?: boolean
  dot?: boolean
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]',
  purple:  'bg-[oklch(58%_0.26_285_/_0.15)] text-[var(--color-brand-violet)] ring-1 ring-[oklch(58%_0.26_285_/_0.28)]',
  pink:    'bg-[oklch(62%_0.24_318_/_0.15)] text-[var(--color-brand-fuchsia)] ring-1 ring-[oklch(62%_0.24_318_/_0.28)]',
  amber:   'bg-[oklch(76%_0.17_68_/_0.15)]  text-[var(--color-brand-amber)]  ring-1 ring-[oklch(76%_0.17_68_/_0.28)]',
  cyan:    'bg-[oklch(72%_0.16_200_/_0.15)] text-[var(--color-brand-cyan)]   ring-1 ring-[oklch(72%_0.16_200_/_0.28)]',
  success: 'bg-[oklch(65%_0.18_145_/_0.15)] text-[oklch(68%_0.18_145)]      ring-1 ring-[oklch(65%_0.18_145_/_0.28)]',
  outline: 'bg-transparent text-[var(--color-text-secondary)] ring-1 ring-[oklch(100%_0_0_/_0.15)]',
  danger:  'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/25',
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

export function Badge({ variant = 'default', children, className = '', pulse = false, dot = false }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${variantClasses[variant]} ${className}`}
    >
      {(pulse || dot) && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
          )}
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
        </span>
      )}
      {children}
    </span>
  )
}

/** Convenience: automatically selects a variant from the event category string */
export function CategoryBadge({ category }: { category: string }) {
  const variant = CATEGORY_VARIANT_MAP[category] ?? 'default'
  return <Badge variant={variant}>{category}</Badge>
}
