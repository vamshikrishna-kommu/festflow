import { motion } from 'motion/react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { ButtonVariant, ButtonSize } from '@/types'
import { buttonTap, buttonHover } from '@/lib/animations'

interface ButtonProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    | 'onDrag'
    | 'onDragEnd'
    | 'onDragEnter'
    | 'onDragLeave'
    | 'onDragOver'
    | 'onDragStart'
    | 'onDrop'
    | 'onAnimationStart'
  > {
  variant?: ButtonVariant
  size?: ButtonSize
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  isLoading?: boolean
  children: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-medium border border-blue-600/30 shadow-xs hover:shadow-sm active:bg-[#1E40AF] transition-all',
  secondary:
    'bg-white text-[#111827] hover:bg-[#F9FAFB] hover:text-[#000000] border border-[#E5E7EB] shadow-xs active:bg-[#F3F4F6]',
  ghost:
    'bg-transparent text-[#4B5563] hover:text-[#111827] hover:bg-[#F3F4F6] active:bg-[#E5E7EB]',
  outline:
    'border border-[#E5E7EB] bg-white text-[#111827] hover:border-[#D1D5DB] hover:bg-[#F9FAFB] active:bg-[#F3F4F6] shadow-xs',
  'outline-dark':
    'border border-gray-700 bg-gray-900/75 text-white hover:border-gray-500 hover:bg-gray-800 active:bg-gray-950 focus-visible:ring-offset-gray-950 shadow-xs',
  danger:
    'bg-[#EF4444] text-white hover:bg-[#DC2626] border border-red-600/20 shadow-xs active:bg-[#B91C1C]',
}

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1 rounded-[var(--radius-button)] tracking-tight',
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-[var(--radius-button)] tracking-tight',
  md: 'h-9.5 px-4 text-sm gap-2 rounded-[var(--radius-button)] tracking-tight',
  lg: 'h-11 px-5 text-sm gap-2.5 rounded-[var(--radius-lg)] font-medium tracking-tight',
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
    'relative inline-flex items-center justify-center font-medium transition-all duration-150 cursor-pointer select-none overflow-hidden disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#2563EB]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none'

  return (
    <motion.button
      type={type}
      whileHover={isInactive ? undefined : buttonHover}
      whileTap={isInactive ? undefined : buttonTap}
      disabled={isInactive}
      aria-busy={isLoading ? true : undefined}
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
      <span
        className={`flex items-center gap-[inherit] transition-opacity duration-150 ${
          isLoading ? 'invisible' : 'opacity-100'
        }`}
      >
        {leftIcon}
        {children}
        {rightIcon}
      </span>
    </motion.button>
  )
}
