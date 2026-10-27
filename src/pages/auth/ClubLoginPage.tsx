import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import { Mail, AlertCircle, ArrowRight } from 'lucide-react'
import { shakeError } from '@/lib/animations'
import { Button } from '@/components/ui'
import { AuthCard } from '@/components/auth/AuthCard'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { useAuth } from '@/context/AuthContext'

import { getSafeReturnUrl } from '@/lib/safeNavigation'

export default function ClubLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, role, signIn, resendVerification, isLoading } = useAuth()

  useEffect(() => {
    if (user && role) {
      if (role === 'club_member' || role === 'platform_admin') {
        const fromPath = (location.state as { from?: string })?.from
        const target = getSafeReturnUrl(fromPath, role, '/club/dashboard')
        navigate(target, { replace: true })
      } else if (role === 'student') {
        navigate('/student/dashboard', { replace: true })
      }
    }
  }, [user, role, location.state, navigate])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [resendSent, setResendSent] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!email.trim()) {
      errs.email = 'Email address is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Please enter a valid email address'
    }
    if (!password) {
      errs.password = 'Password is required'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setServerError(null)

    if (!validate()) return

    const res = await signIn(email.trim(), password)

    if (res.error) {
      setServerError(res.error)
    } else {
      const fromPath = (location.state as { from?: string })?.from
      const userRole = res.role || role || 'club_member'
      const target = getSafeReturnUrl(fromPath, userRole, '/club/dashboard')
      navigate(target, { replace: true })
    }
  }

  return (
    <AuthCard
      title="Club Portal Login"
      subtitle="Sign in to manage your campus events, passes, and attendees"
      role="club_member"
      mode="login"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <AnimatePresence>
          {serverError && (
            <motion.div
              variants={shakeError}
              initial="idle"
              animate="shake"
              className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5 text-left"
            >
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{serverError}</span>
              {serverError.toLowerCase().includes('email not confirmed') && (
                <div className="mt-2 pt-2 border-t border-rose-500/20">
                  {!resendSent ? (
                    <button
                      type="button"
                      disabled={resendLoading || !email.trim()}
                      onClick={async () => {
                        if (!email.trim()) return
                        setResendLoading(true)
                        const res = await resendVerification(email.trim())
                        setResendLoading(false)
                        if (!res.error) setResendSent(true)
                      }}
                      className="text-[11px] font-semibold text-rose-200 underline hover:text-white transition-colors"
                    >
                      {resendLoading ? 'Dispatching verification link…' : '✉️ Click here to resend verification email'}
                    </button>
                  ) : (
                    <span className="text-[11px] text-emerald-300 font-medium">
                      ✓ Fresh verification email dispatched! Please check your inbox.
                    </span>
                  )}
                </div>
              )}
            </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Email */}
        <div className="flex flex-col gap-1.5 text-left">
          <label
            htmlFor="club-login-email"
            className="text-xs font-semibold text-[var(--color-text-secondary)]"
          >
            Club or Representative Email
          </label>
          <div className="relative">
            <input
              id="club-login-email"
              type="email"
              autoComplete="email"
              placeholder="club@campus.edu or lead@domain.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (errors.email) setErrors((prev) => ({ ...prev, email: '' }))
              }}
              className={`w-full px-3.5 py-2.5 pl-10 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border transition-all duration-200 outline-none placeholder:text-[var(--color-text-muted)] ${
                errors.email
                  ? 'border-rose-500/80 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                  : 'border-[var(--color-surface-3)] focus:border-[var(--color-brand-purple)] focus:ring-2 focus:ring-[var(--color-brand-purple)]/20'
              }`}
            />
            <Mail
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
          </div>
          {errors.email && (
            <p className="text-xs text-rose-400">{errors.email}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <PasswordInput
            label="Password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (errors.password) setErrors((prev) => ({ ...prev, password: '' }))
            }}
            error={errors.password}
          />
          <div className="flex justify-end mt-1.5">
            <Link
              to="/forgot-password"
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-purple)] transition-colors"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full mt-1"
          disabled={isLoading}
          isLoading={isLoading}
          rightIcon={<ArrowRight size={16} />}
        >
          Sign In to Club Portal
        </Button>
      </form>
    </AuthCard>
  )
}
