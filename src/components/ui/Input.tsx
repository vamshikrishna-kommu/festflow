import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { fieldError } from '@/lib/animations'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  containerClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    helperText,
    leftIcon,
    rightIcon,
    id: externalId,
    required,
    disabled,
    className = '',
    containerClassName = '',
    ...props
  },
  ref
) {
  const generatedId = useId()
  const inputId = externalId || generatedId
  const errorId = `${inputId}-error`
  const helperId = `${inputId}-helper`

  return (
    <div className={`flex flex-col gap-1.5 text-left w-full ${containerClassName}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold text-[var(--color-text-secondary)] flex items-center justify-between"
        >
          <span>
            {label} {required && <span className="text-rose-400" aria-hidden="true">*</span>}
          </span>
          {!required && (
            <span className="text-[10px] text-[var(--color-text-muted)] font-normal">Optional</span>
          )}
        </label>
      )}

      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3.5 pointer-events-none text-[var(--color-text-muted)] flex items-center justify-center">
            {leftIcon}
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          required={required}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`w-full rounded-[var(--radius-input)] bg-[var(--color-surface-2)] border text-xs sm:text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-all duration-200 outline-none h-11 ${
            leftIcon ? 'pl-10' : 'pl-3.5'
          } ${rightIcon ? 'pr-10' : 'pr-3.5'} ${
            error
              ? 'border-rose-500/70 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20'
              : 'border-white/10 bg-[#14141A] focus:border-[#18CFFC] focus:ring-2 focus:ring-[#18CFFC]/20'
          } ${disabled ? 'opacity-50 cursor-not-allowed bg-white/5' : 'hover:border-white/20'} ${className}`}
          {...props}
        />

        {rightIcon && (
          <div className="absolute right-3.5 flex items-center justify-center text-[var(--color-text-muted)]">
            {rightIcon}
          </div>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            id={errorId}
            variants={fieldError}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="text-[11px] font-medium text-rose-400 mt-0.5 overflow-hidden"
            role="alert"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {!error && helperText && (
        <p id={helperId} className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
          {helperText}
        </p>
      )}
    </div>
  )
})
