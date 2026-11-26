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

    const hasMinLength = strVal.length >= 8
    const hasNumber = /\d/.test(strVal)
    const hasSpecialOrUpper = /[A-Z!@#$%^&*(),.?":{}|<>]/.test(strVal)
    const strengthScore = [hasMinLength, hasNumber, hasSpecialOrUpper].filter(Boolean).length

    const strengthColor =
      strengthScore === 0
        ? 'bg-gray-200'
        : strengthScore === 1
        ? 'bg-rose-500'
        : strengthScore === 2
        ? 'bg-amber-500'
        : 'bg-emerald-500'

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
        <label htmlFor={id} className="text-xs font-semibold text-gray-700">
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
            className={`w-full px-3.5 py-2.5 pr-11 rounded-lg text-sm bg-white text-gray-900 border transition-colors duration-150 outline-none placeholder:text-gray-400 ${
              error
                ? 'border-rose-400 focus:border-rose-500 focus:ring-3 focus:ring-rose-500/15'
                : 'border-gray-200 hover:border-gray-300 focus:border-blue-600 focus:ring-3 focus:ring-blue-600/10'
            }`}
          />
          <button
            type="button"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors p-1 cursor-pointer"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {error && (
          <p className="text-xs text-rose-600 mt-0.5 flex items-center gap-1">
            <X size={12} /> {error}
          </p>
        )}

        {showStrength && strVal.length > 0 && (
          <div className="mt-1 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-500">Password strength</span>
              <span className="font-medium text-gray-700">{strengthLabel}</span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden flex gap-1">
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
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500 pt-0.5">
              <span className={`flex items-center gap-1 ${hasMinLength ? 'text-emerald-700 font-medium' : ''}`}>
                {hasMinLength ? <Check size={11} /> : '•'} 8+ characters
              </span>
              <span className={`flex items-center gap-1 ${hasNumber ? 'text-emerald-700 font-medium' : ''}`}>
                {hasNumber ? <Check size={11} /> : '•'} 1+ number
              </span>
              <span className={`flex items-center gap-1 ${hasSpecialOrUpper ? 'text-emerald-700 font-medium' : ''}`}>
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
