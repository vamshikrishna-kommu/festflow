import { motion } from 'motion/react'
import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  glass?: boolean
  hoverable?: boolean
  className?: string
}

export function Card({
  children,
  glass = false,
  hoverable = false,
  className = '',
  ...props
}: CardProps) {
  const base =
    'relative rounded-[var(--radius-card)] overflow-hidden'
  const surfaceClass = glass
    ? 'glass'
    : 'bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.06)]'

  if (hoverable) {
    return (
      <motion.div
        whileHover={{ y: -6, scale: 1.01 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className={`${base} ${surfaceClass} cursor-pointer ${className}`}
        {...(props as Parameters<typeof motion.div>[0])}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <div className={`${base} ${surfaceClass} ${className}`} {...props}>
      {children}
    </div>
  )
}
