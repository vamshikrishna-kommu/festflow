import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { User, Mail, AlertCircle, ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui'
import { AuthCard } from '@/components/auth/AuthCard'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { VerificationNotice } from '@/components/auth/VerificationNotice'
import { useAuth } from '@/context/AuthContext'

export default function StudentSignupPage() {
  const navigate = useNavigate()
  const { signUpStudent, isLoading } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPendingVerification, setIsPendingVerification] = useState(false)

  const validate = (): boolean => {
    const errs: Record<string, string> = {}

    if (!name.trim()) {
      errs.name = 'Full name is required'
    } else if (name.trim().length < 2) {
      errs.name = 'Name must be at least 2 characters'
    }

    if (!email.trim()) {
      errs.email = 'Email address is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Please enter a valid email address'
    }

    if (!password) {
      errs.password = 'Password is required'
    } else if (password.length < 8) {
      errs.password = 'Password must be at least 8 characters long'
    }

    if (password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setServerError(null)

    if (!validate()) return

    const res = await signUpStudent({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
    })

    if (res.error) {
      setServerError(res.error)
    } else if (res.requiresVerification) {
      setIsPendingVerification(true)
    } else {
      navigate('/student/dashboard', { replace: true })
    }
  }

  if (isPendingVerification) {
    return (
      <AuthCard
        title="Verify your student email"
        subtitle="One click to activate your student access"
        role="student"
        mode="signup"
      >
        <VerificationNotice
          email={email}
          role="student"
          onBackToLogin={() => navigate('/student/login')}
        />
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Create Student Account"
      subtitle="Discover college fests, register for competitions, and claim your passes"
      role="student"
      mode="signup"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {serverError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2 text-left"
          >
            <AlertCircle size={15} className="shrink-0" />
            <span>{serverError}</span>
          </motion.div>
        )}

        {/* Student Name */}
        <div className="flex flex-col gap-1.5 text-left">
          <label
            htmlFor="student-name"
            className="text-xs font-semibold text-[var(--color-text-secondary)]"
          >
            Your Full Name
          </label>
          <div className="relative">
            <input
              id="student-name"
              type="text"
              placeholder="e.g. Jordan Lee"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (errors.name) setErrors((prev) => ({ ...prev, name: '' }))
              }}
              className={`w-full px-3.5 py-2.5 pl-10 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border transition-all duration-200 outline-none placeholder:text-[var(--color-text-muted)] ${
                errors.name
                  ? 'border-rose-500/80 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                  : 'border-[var(--color-surface-3)] focus:border-[var(--color-brand-cyan)] focus:ring-2 focus:ring-[var(--color-brand-cyan)]/20'
              }`}
            />
            <User
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
          </div>
          {errors.name && (
            <p className="text-xs text-rose-400">{errors.name}</p>
          )}
        </div>

        {/* Student Email */}
        <div className="flex flex-col gap-1.5 text-left">
          <label
            htmlFor="student-email"
            className="text-xs font-semibold text-[var(--color-text-secondary)]"
          >
            Student or Personal Email
          </label>
          <div className="relative">
            <input
              id="student-email"
              type="email"
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
        <PasswordInput
          label="Password"
          placeholder="Min. 8 characters"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            if (errors.password) setErrors((prev) => ({ ...prev, password: '' }))
          }}
          error={errors.password}
          showStrength
        />

        {/* Confirm Password */}
        <PasswordInput
          label="Confirm Password"
          placeholder="Repeat your password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value)
            if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: '' }))
          }}
          error={errors.confirmPassword}
        />

        {/* Perks badge */}
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[var(--color-surface-2)]/60 text-[11px] text-[var(--color-text-muted)] text-left">
          <Sparkles size={14} className="text-[var(--color-brand-cyan)] shrink-0" />
          <span>
            Free registration for student badges, bookmarks, and instant event updates.
          </span>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full mt-2"
          disabled={isLoading}
          isLoading={isLoading}
          rightIcon={<ArrowRight size={16} />}
        >
          Create Student Account
        </Button>
      </form>
    </AuthCard>
  )
}
