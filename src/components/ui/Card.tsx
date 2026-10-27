import type { HTMLAttributes, ReactNode } from 'react'

export type CardVariant = 'default' | 'glass' | 'subtle' | 'elevated' | 'interactive'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  variant?: CardVariant
  glass?: boolean
  hoverable?: boolean
  className?: string
}

const variantClasses: Record<CardVariant, string> = {
  default:
    'bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.065)] shadow-[var(--shadow-card)]',
  glass:
    'glass shadow-[var(--shadow-card)]',
  subtle:
    'glass-subtle shadow-sm',
  elevated:
    'glass-elevated shadow-[0_16px_48px_oklch(0%_0_0_/_0.55)]',
  interactive:
    'bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.065)] transition-all duration-300 hover:border-[oklch(100%_0_0_/_0.15)] hover:bg-[var(--color-surface-2)] hover:shadow-[0_12px_40px_oklch(0%_0_0_/_0.5)] hover:-translate-y-1 cursor-pointer',
}

export function Card({
  children,
  variant,
  glass = false,
  hoverable = false,
  className = '',
  ...props
}: CardProps) {
  const base = 'relative rounded-[var(--radius-card)] overflow-hidden'
  const activeVariant = variant || (glass ? 'glass' : hoverable ? 'interactive' : 'default')
  const surfaceClass = variantClasses[activeVariant]
  const hoverClass =
    hoverable && activeVariant !== 'interactive'
      ? 'transition-all duration-300 hover:border-[oklch(100%_0_0_/_0.15)] hover:shadow-[0_12px_40px_oklch(0%_0_0_/_0.5)] hover:-translate-y-1'
      : ''

  return (
    <div
      className={`${base} ${surfaceClass} ${hoverClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
