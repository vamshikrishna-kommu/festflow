import { useState, useId, forwardRef, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff, Check, X } from 'lucide-react'

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  error?: string
  showStrength?: boolean
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, showStrength = false, value, onChange, ...rest }, ref) => {
    const [showPassword, setShowPassword] = useState(false)
    const id = useId()
    const strVal = typeof value === 'string' ? value : ''

    // Password strength calculation
    const hasMinLength = strVal.length >= 8
    const hasNumber = /\d/.test(strVal)
    const hasSpecialOrUpper = /[A-Z!@#$%^&*(),.?":{}|<>]/.test(strVal)
    const strengthScore = [hasMinLength, hasNumber, hasSpecialOrUpper].filter(Boolean).length

    const strengthColor =
      strengthScore === 0
        ? 'bg-[var(--color-surface-3)]'
        : strengthScore === 1
        ? 'bg-rose-500'
        : strengthScore === 2
        ? 'bg-amber-400'
        : 'bg-emerald-400'

    const strengthLabel =
      strengthScore === 0
        ? ''
        : strengthScore === 1
        ? 'Weak'
        : strengthScore === 2
        ? 'Good'
        : 'Strong'

    return (
      <div className="flex flex-col gap-1.5 w-full text-left">
        <label htmlFor={id} className="text-xs font-semibold text-[var(--color-text-secondary)]">
          {label}
        </label>

        <div className="relative">
          <input
            {...rest}
            ref={ref}
            id={id}
            type={showPassword ? 'text' : 'password'}
            value={value}
            onChange={onChange}
            className={`w-full px-3.5 py-2.5 pr-11 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border transition-all duration-200 outline-none placeholder:text-[var(--color-text-muted)] ${
              error
                ? 'border-rose-500/80 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                : 'border-[var(--color-surface-3)] focus:border-[var(--color-brand-purple)] focus:ring-2 focus:ring-[var(--color-brand-purple)]/20'
            }`}
          />
          <button
            type="button"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {error && (
          <p className="text-xs text-rose-400 mt-0.5 flex items-center gap-1">
            <X size={12} /> {error}
          </p>
        )}

        {showStrength && strVal.length > 0 && (
          <div className="mt-1 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[var(--color-text-muted)]">Password strength</span>
              <span className="font-medium text-[var(--color-text-secondary)]">{strengthLabel}</span>
            </div>
            <div className="h-1.5 w-full bg-[var(--color-surface-3)] rounded-full overflow-hidden flex gap-1">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  strengthScore >= 1 ? strengthColor : 'transparent'
                }`}
                style={{ width: '33.33%' }}
              />
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  strengthScore >= 2 ? strengthColor : 'transparent'
                }`}
                style={{ width: '33.33%' }}
              />
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  strengthScore >= 3 ? strengthColor : 'transparent'
                }`}
                style={{ width: '33.33%' }}
              />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--color-text-muted)] pt-0.5">
              <span className={`flex items-center gap-1 ${hasMinLength ? 'text-emerald-400' : ''}`}>
                {hasMinLength ? <Check size={11} /> : '•'} 8+ characters
              </span>
              <span className={`flex items-center gap-1 ${hasNumber ? 'text-emerald-400' : ''}`}>
                {hasNumber ? <Check size={11} /> : '•'} 1+ number
              </span>
              <span className={`flex items-center gap-1 ${hasSpecialOrUpper ? 'text-emerald-400' : ''}`}>
                {hasSpecialOrUpper ? <Check size={11} /> : '•'} uppercase / symbol
              </span>
            </div>
          </div>
        )}
      </div>
    )
  }
)

PasswordInput.displayName = 'PasswordInput'
