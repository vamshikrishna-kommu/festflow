import { motion } from 'motion/react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { ButtonVariant, ButtonSize } from '@/types'
import { buttonTap, buttonHover } from '@/lib/animations'

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
    'gradient-brand text-white shadow-lg hover:brightness-110 hover:shadow-[0_0_28px_oklch(58%_0.26_285_/_0.5)] active:brightness-95',
  secondary:
    'bg-[var(--color-surface-3)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-4)] border border-[oklch(100%_0_0_/_0.06)] active:bg-[var(--color-surface-2)]',
  ghost:
    'bg-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] active:bg-[var(--color-surface-3)]',
  outline:
    'border border-[oklch(100%_0_0_/_0.20)] bg-[var(--color-surface-1)]/70 backdrop-blur-md text-[var(--color-text-primary)] hover:border-[var(--color-brand-violet)] hover:bg-[var(--color-surface-2)] hover:text-white shadow-sm active:bg-[var(--color-surface-3)]',
  danger:
    'bg-rose-600/90 text-white hover:bg-rose-600 shadow-sm active:bg-rose-700',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3.5 text-xs gap-1.5 rounded-[var(--radius-button)]',
  md: 'h-10 px-5 text-sm gap-2 rounded-[var(--radius-button)]',
  lg: 'h-12 px-7 text-sm gap-2.5 rounded-[var(--radius-lg)] font-semibold',
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
  const isInactive = Boolean(disabled || isLoading)
  const base =
    'relative inline-flex items-center justify-center font-semibold transition-all duration-200 cursor-pointer select-none overflow-hidden disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--color-brand-violet)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-0)]'

  return (
    <motion.button
      whileHover={isInactive ? undefined : buttonHover}
      whileTap={isInactive ? undefined : buttonTap}
      disabled={isInactive}
      className={`${base} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="absolute inset-0 flex items-center justify-center bg-inherit">
          <svg
            className="animate-spin h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12" cy="12" r="10"
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
      <span className={`flex items-center gap-[inherit] transition-opacity duration-150 ${isLoading ? 'invisible' : 'opacity-100'}`}>
        {leftIcon}
        {children}
        {rightIcon}
      </span>
    </motion.button>
  )
}
