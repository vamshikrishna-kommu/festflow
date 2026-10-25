import { motion } from 'motion/react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { ButtonVariant, ButtonSize } from '@/types'
import { buttonTap } from '@/lib/animations'

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragEnd' | 'onDragEnter' | 'onDragLeave' | 'onDragOver' | 'onDragStart' | 'onDrop' | 'onAnimationStart'> {
  variant?: ButtonVariant
  size?: ButtonSize
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  isLoading?: boolean
  children: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-[var(--color-brand-purple)] to-[var(--color-brand-pink)] text-white shadow-lg hover:brightness-110 hover:shadow-[0_0_24px_oklch(58%_0.24_290_/_0.45)]',
  secondary:
    'bg-[var(--color-surface-3)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-4)]',
  ghost:
    'bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]',
  outline:
    'border border-[oklch(100%_0_0_/_0.12)] bg-transparent text-[var(--color-text-primary)] hover:border-[var(--color-brand-purple)] hover:bg-[var(--color-surface-2)]',
  danger:
    'bg-red-600/90 text-white hover:bg-red-600',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-5 text-sm gap-2',
  lg: 'h-12 px-7 text-base gap-2.5',
}

export function Button({
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  isLoading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const base =
    'relative inline-flex items-center justify-center rounded-[var(--radius-button)] font-semibold transition-all duration-200 cursor-pointer select-none disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--color-brand-purple)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-0)]'

  return (
    <motion.button
      whileTap={buttonTap}
      disabled={disabled ?? isLoading}
      className={`${base} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <svg
            className="animate-spin h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
        </span>
      ) : null}
      <span className={`flex items-center gap-[inherit] ${isLoading ? 'invisible' : ''}`}>
        {leftIcon}
        {children}
        {rightIcon}
      </span>
    </motion.button>
  )
}
