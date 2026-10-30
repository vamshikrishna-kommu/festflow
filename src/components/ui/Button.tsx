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
    'bg-gradient-to-r from-[#18CFFC] via-[#07A4FC] to-[#7F1AFB] text-white font-semibold border border-cyan-300/30 shadow-[0_4px_22px_rgba(127,26,251,0.40)] hover:shadow-[0_6px_30px_rgba(24,207,252,0.50)] hover:brightness-110 active:scale-[0.98]',
  secondary:
    'bg-[#1C1C24] text-[#EDEDF0] hover:text-white hover:bg-[#262632] border border-white/10 shadow-sm active:bg-[#14141A]',
  ghost:
    'bg-transparent text-[#A1A1AA] hover:text-white hover:bg-white/[0.06] active:bg-white/[0.10]',
  outline:
    'border border-white/15 bg-[#0E0E12]/80 backdrop-blur-md text-[#EDEDF0] hover:border-[#18CFFC] hover:text-white hover:bg-[#1C1C24] hover:shadow-[0_0_22px_rgba(24,207,252,0.25)] active:bg-[#14141A]',
  danger:
    'bg-rose-600 text-white hover:bg-rose-500 shadow-sm active:bg-rose-700',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3.5 text-xs gap-1.5 rounded-[var(--radius-button)] tracking-wide',
  md: 'h-10 px-5 text-sm gap-2 rounded-[var(--radius-button)] tracking-wide',
  lg: 'h-12 px-7 text-sm gap-2.5 rounded-[var(--radius-lg)] font-semibold tracking-wide',
}

export function Button({
  type = 'button',
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
    'relative inline-flex items-center justify-center font-semibold transition-all duration-200 cursor-pointer select-none overflow-hidden disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--color-brand-cyan)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-0)]'

  return (
    <motion.button
      type={type}
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
