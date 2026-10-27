import { forwardRef, useId, type TextareaHTMLAttributes } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { fieldError } from '@/lib/animations'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
  containerClassName?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    error,
    helperText,
    id: externalId,
    required,
    disabled,
    rows = 4,
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

      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        required={required}
        disabled={disabled}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : helperText ? helperId : undefined}
        className={`w-full rounded-[var(--radius-input)] bg-[var(--color-surface-2)] border p-3 text-xs sm:text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] transition-all duration-200 outline-none resize-y ${
          error
            ? 'border-rose-500/70 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20'
            : 'border-[oklch(100%_0_0_/_0.09)] focus:border-[var(--color-brand-violet)] focus:ring-2 focus:ring-[oklch(58%_0.26_285_/_0.20)]'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-[var(--color-surface-3)]/40' : 'hover:border-[oklch(100%_0_0_/_0.15)]'} ${className}`}
        {...props}
      />

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
