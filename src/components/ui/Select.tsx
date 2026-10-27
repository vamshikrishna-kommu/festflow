import { forwardRef, useId, type SelectHTMLAttributes, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronDown } from 'lucide-react'
import { fieldError } from '@/lib/animations'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helperText?: string
  options?: SelectOption[]
  children?: ReactNode
  containerClassName?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    error,
    helperText,
    options,
    children,
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
  const selectId = externalId || generatedId
  const errorId = `${selectId}-error`
  const helperId = `${selectId}-helper`

  return (
    <div className={`flex flex-col gap-1.5 text-left w-full ${containerClassName}`}>
      {label && (
        <label
          htmlFor={selectId}
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
        <select
          ref={ref}
          id={selectId}
          required={required}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`w-full appearance-none rounded-[var(--radius-input)] bg-[var(--color-surface-2)] border text-xs sm:text-sm text-[var(--color-text-primary)] transition-all duration-200 outline-none h-11 pl-3.5 pr-10 cursor-pointer ${
            error
              ? 'border-rose-500/70 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20'
              : 'border-[oklch(100%_0_0_/_0.09)] focus:border-[var(--color-brand-violet)] focus:ring-2 focus:ring-[oklch(58%_0.26_285_/_0.20)]'
          } ${disabled ? 'opacity-50 cursor-not-allowed bg-[var(--color-surface-3)]/40' : 'hover:border-[oklch(100%_0_0_/_0.15)]'} ${className}`}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                  className="bg-[var(--color-surface-2)] text-[var(--color-text-primary)] py-1"
                >
                  {opt.label}
                </option>
              ))
            : children}
        </select>

        <div className="absolute right-3.5 pointer-events-none text-[var(--color-text-muted)] flex items-center justify-center">
          <ChevronDown size={15} />
        </div>
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
