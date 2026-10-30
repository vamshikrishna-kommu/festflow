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
    'bg-[#0E0E12] border border-white/[0.07] shadow-[var(--shadow-card)]',
  glass:
    'glass shadow-[var(--shadow-card)]',
  subtle:
    'glass-subtle shadow-sm',
  elevated:
    'glass-elevated shadow-[0_20px_50px_rgba(0,0,0,0.7)]',
  interactive:
    'bg-[#0E0E12] border border-white/[0.07] hover:border-white/20 hover:bg-[#14141A] hover:shadow-[0_16px_48px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,87,34,0.15)] cursor-pointer',
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
