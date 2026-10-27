import type { HTMLAttributes, ReactNode } from 'react'
import { motion } from 'motion/react'

export type CardVariant = 'default' | 'glass' | 'subtle' | 'elevated' | 'interactive'

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onAnimationStart' | 'onDrag' | 'onDragEnd' | 'onDragStart'> {
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
    'bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.065)] hover:border-[oklch(100%_0_0_/_0.15)] hover:bg-[var(--color-surface-2)] hover:shadow-[0_12px_40px_oklch(0%_0_0_/_0.5)] cursor-pointer',
}

export function Card({
  children,
  variant,
  glass = false,
  hoverable = false,
  className = '',
  ...props
}: CardProps) {
  const base = 'relative rounded-[var(--radius-card)] overflow-hidden transition-colors'
  const activeVariant = variant || (glass ? 'glass' : hoverable ? 'interactive' : 'default')
  const isInteractive = activeVariant === 'interactive' || hoverable
  const surfaceClass = variantClasses[activeVariant]

  return (
    <motion.div
      whileHover={
        isInteractive
          ? { y: -4, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } }
          : undefined
      }
      whileTap={isInteractive ? { scale: 0.99 } : undefined}
      className={`${base} ${surfaceClass} ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  )
}
