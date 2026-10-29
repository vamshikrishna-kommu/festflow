import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import { Mail, AlertCircle, ArrowRight } from 'lucide-react'
import { shakeError } from '@/lib/animations'
import { Button } from '@/components/ui'
import { AuthCard } from '@/components/auth/AuthCard'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { useAuth } from '@/context/AuthContext'

import { getSafeReturnUrl } from '@/lib/safeNavigation'

export default function StudentLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user, role, signIn, resendVerification, isLoading } = useAuth()

  useEffect(() => {
    if (user && role) {
      const redirectParam = searchParams.get('redirect') || searchParams.get('next')
      const fromPath = (location.state as { from?: string })?.from || redirectParam
      const pendingTeamToken = sessionStorage.getItem('festflow_pending_team_token')
      const pendingJoinCode = sessionStorage.getItem('festflow_pending_join_code')

      let defaultTarget = '/student/dashboard'
      if (pendingTeamToken) {
        defaultTarget = `/join-team?token=${encodeURIComponent(pendingTeamToken)}`
      } else if (pendingJoinCode) {
        defaultTarget = `/join-team?code=${encodeURIComponent(pendingJoinCode)}`
      }

      if (role === 'student') {
        const target = getSafeReturnUrl(fromPath, 'student', defaultTarget)
        navigate(target, { replace: true })
      } else if (role === 'club_member' || role === 'platform_admin') {
        const target = getSafeReturnUrl(fromPath, role, '/club/dashboard')
        navigate(target, { replace: true })
      }
    }
  }, [user, role, location.state, searchParams, navigate])

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
      const redirectParam = searchParams.get('redirect') || searchParams.get('next')
      const fromPath = (location.state as { from?: string })?.from || redirectParam
      const userRole = res.role || role || 'student'
      const pendingTeamToken = sessionStorage.getItem('festflow_pending_team_token')
      const pendingJoinCode = sessionStorage.getItem('festflow_pending_join_code')

      let defaultTarget = userRole === 'club_member' || userRole === 'platform_admin' ? '/club/dashboard' : '/student/dashboard'
      if (userRole === 'student') {
        if (pendingTeamToken) {
          defaultTarget = `/join-team?token=${encodeURIComponent(pendingTeamToken)}`
        } else if (pendingJoinCode) {
          defaultTarget = `/join-team?code=${encodeURIComponent(pendingJoinCode)}`
        }
      }

      const target = getSafeReturnUrl(fromPath, userRole, defaultTarget)
      navigate(target, { replace: true })
    }
  }

  return (
    <AuthCard
      title="Welcome back, Student"
      subtitle="Sign in to access your registered events and tickets"
      role="student"
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
            htmlFor="student-login-email"
            className="text-xs font-semibold text-[var(--color-text-secondary)]"
          >
            Your Student Email
          </label>
          <div className="relative">
            <input
              id="student-login-email"
              type="email"
              autoComplete="email"
              placeholder="student@college.edu or name@gmail.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (errors.email) setErrors((prev) => ({ ...prev, email: '' }))
              }}
              className={`w-full px-3.5 py-2.5 pl-10 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border transition-all duration-200 outline-none placeholder:text-[var(--color-text-muted)] ${
                errors.email
                  ? 'border-rose-500/80 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                  : 'border-[var(--color-surface-3)] focus:border-[var(--color-brand-cyan)] focus:ring-2 focus:ring-[var(--color-brand-cyan)]/20'
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
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-cyan)] transition-colors"
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
          Sign In as Student
        </Button>
      </form>
    </AuthCard>
  )
}
