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
          className="text-xs font-semibold text-gray-700 flex items-center justify-between"
        >
          <span>
            {label} {required && <span className="text-rose-500" aria-hidden="true">*</span>}
          </span>
          {!required && (
            <span className="text-[10px] text-gray-400 font-normal">Optional</span>
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
        className={`w-full rounded-[var(--radius-input)] bg-white border p-3 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 transition-colors duration-150 outline-none resize-y ${
          error
            ? 'border-rose-400 focus:border-rose-500 focus:ring-3 focus:ring-rose-500/15'
            : 'border-gray-200 hover:border-gray-300 focus:border-blue-600 focus:ring-3 focus:ring-blue-600/10'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : ''} ${className}`}
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
            className="text-[11px] font-medium text-rose-600 mt-0.5 overflow-hidden"
            role="alert"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {!error && helperText && (
        <p id={helperId} className="text-[11px] text-gray-500 mt-0.5">
          {helperText}
        </p>
      )}
    </div>
  )
})
