import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { Mail, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui'
import { AuthCard } from '@/components/auth/AuthCard'
import { useAuth } from '@/context/AuthContext'

export default function ForgotPasswordPage() {
  const [searchParams] = useSearchParams()
  const roleParam = searchParams.get('role') === 'club' ? 'club_member' : 'student'

  const { resetPassword } = useAuth()

  const [email, setEmail] = useState('')
  const role: 'club_member' | 'student' = roleParam
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) {
      setError('Please enter your email address.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    setIsSubmitting(true)
    const res = await resetPassword(cleanEmail)
    setIsSubmitting(false)

    if (res.error) {
      setError(res.error)
    } else {
      setIsSuccess(true)
    }
  }

  const loginPath = role === 'club_member' ? '/club/login' : '/student/login'

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your registered campus email to receive secure recovery instructions."
      role={role}
      mode="login"
    >
      {isSuccess ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center text-center gap-4 py-2"
        >
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
            <CheckCircle2 size={32} />
          </div>

          <div>
            <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)] mb-1">
              Check your inbox
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              We have sent a secure password reset link to{' '}
              <strong className="text-[var(--color-text-primary)]">{email}</strong>.
              Click the link inside to set a new password.
            </p>
          </div>

          <div className="flex flex-col gap-2 w-full mt-2">
            <Link to={loginPath} className="w-full">
              <Button variant="primary" size="md" className="w-full">
                Return to Login
              </Button>
            </Link>
            <button
              type="button"
              onClick={() => {
                setIsSuccess(false)
                setEmail('')
              }}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] underline transition-colors pt-1"
            >
              Try a different email address
            </button>
          </div>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left" noValidate>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="forgot-password-email"
              className="text-xs font-semibold text-[var(--color-text-secondary)]"
            >
              Your Registered Email Address
            </label>
            <div className="relative">
              <input
                id="forgot-password-email"
                type="email"
                placeholder={role === 'club_member' ? 'organizer@club.edu' : 'student@college.edu'}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (error) setError(null)
                }}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2.5 pl-10 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)] focus:border-[var(--color-brand-purple)] focus:ring-2 focus:ring-[var(--color-brand-purple)]/20 transition-all outline-none placeholder:text-[var(--color-text-muted)]"
              />
              <Mail
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-2"
            disabled={isSubmitting}
            isLoading={isSubmitting}
            rightIcon={<ArrowRight size={16} />}
          >
            Send Password Reset Link
          </Button>

          <div className="flex items-center justify-center pt-2">
            <Link
              to={loginPath}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft size={14} /> Back to Sign In
            </Link>
          </div>
        </form>
      )}
    </AuthCard>
  )
}
