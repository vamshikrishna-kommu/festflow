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
    'bg-white border border-gray-200/90 shadow-[var(--shadow-card)]',
  glass:
    'bg-white/90 backdrop-blur-md border border-gray-200/80 shadow-[var(--shadow-card)]',
  subtle:
    'bg-gray-50/80 border border-gray-200/70 shadow-none',
  elevated:
    'bg-white border border-gray-200 shadow-[var(--shadow-card-hover)]',
  interactive:
    'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-[var(--shadow-card-hover)] cursor-pointer transition-all duration-200',
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
          ? { y: -2, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } }
          : undefined
      }
      whileTap={isInteractive ? { scale: 0.995 } : undefined}
      className={`${base} ${surfaceClass} ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  )
}
