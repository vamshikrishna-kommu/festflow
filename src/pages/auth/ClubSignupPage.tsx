import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { Building2, User, Mail, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui'
import { AuthCard } from '@/components/auth/AuthCard'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { VerificationNotice } from '@/components/auth/VerificationNotice'
import { useAuth } from '@/context/AuthContext'

export default function ClubSignupPage() {
  const navigate = useNavigate()
  const { signUpClub, isLoading } = useAuth()

  // Form fields
  const [representativeName, setRepresentativeName] = useState('')
  const [clubName, setClubName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // State
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPendingVerification, setIsPendingVerification] = useState(false)

  // Validation
  const validate = (): boolean => {
    const errs: Record<string, string> = {}

    if (!representativeName.trim()) {
      errs.representativeName = 'Representative name is required'
    } else if (representativeName.trim().length < 2) {
      errs.representativeName = 'Name must be at least 2 characters'
    }

    if (!clubName.trim()) {
      errs.clubName = 'Club or organization name is required'
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

    const res = await signUpClub({
      name: representativeName.trim(),
      clubName: clubName.trim(),
      email: email.trim().toLowerCase(),
      password,
    })

    if (res.error) {
      setServerError(res.error)
    } else if (res.requiresVerification) {
      setIsPendingVerification(true)
    } else {
      // Direct session granted
      navigate('/club/dashboard', { replace: true })
    }
  }

  if (isPendingVerification) {
    return (
      <AuthCard
        title="Verification Required"
        subtitle="One final step to launch your club portal"
        role="club_member"
        mode="signup"
      >
        <VerificationNotice
          email={email}
          role="club_member"
          onBackToLogin={() => navigate('/club/login')}
        />
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Register your club"
      subtitle="Launch events, sell passes, and manage check-ins directly"
      role="club_member"
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

        {/* Representative Name */}
        <div className="flex flex-col gap-1.5 text-left">
          <label
            htmlFor="rep-name"
            className="text-xs font-semibold text-[var(--color-text-secondary)]"
          >
            Representative Full Name
          </label>
          <div className="relative">
            <input
              id="rep-name"
              type="text"
              placeholder="e.g. Alex Rivera"
              value={representativeName}
              onChange={(e) => {
                setRepresentativeName(e.target.value)
                if (errors.representativeName) setErrors((prev) => ({ ...prev, representativeName: '' }))
              }}
              className={`w-full px-3.5 py-2.5 pl-10 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border transition-all duration-200 outline-none placeholder:text-[var(--color-text-muted)] ${
                errors.representativeName
                  ? 'border-rose-500/80 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                  : 'border-[var(--color-surface-3)] focus:border-[var(--color-brand-purple)] focus:ring-2 focus:ring-[var(--color-brand-purple)]/20'
              }`}
            />
            <User
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
          </div>
          {errors.representativeName && (
            <p className="text-xs text-rose-400">{errors.representativeName}</p>
          )}
        </div>

        {/* Club / Org Name */}
        <div className="flex flex-col gap-1.5 text-left">
          <label
            htmlFor="club-name"
            className="text-xs font-semibold text-[var(--color-text-secondary)]"
          >
            Club or Society Name
          </label>
          <div className="relative">
            <input
              id="club-name"
              type="text"
              placeholder="e.g. Google Developer Student Club"
              value={clubName}
              onChange={(e) => {
                setClubName(e.target.value)
                if (errors.clubName) setErrors((prev) => ({ ...prev, clubName: '' }))
              }}
              className={`w-full px-3.5 py-2.5 pl-10 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border transition-all duration-200 outline-none placeholder:text-[var(--color-text-muted)] ${
                errors.clubName
                  ? 'border-rose-500/80 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                  : 'border-[var(--color-surface-3)] focus:border-[var(--color-brand-purple)] focus:ring-2 focus:ring-[var(--color-brand-purple)]/20'
              }`}
            />
            <Building2
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
          </div>
          {errors.clubName && (
            <p className="text-xs text-rose-400">{errors.clubName}</p>
          )}
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5 text-left">
          <label
            htmlFor="club-email"
            className="text-xs font-semibold text-[var(--color-text-secondary)]"
          >
            Club or Official Email
          </label>
          <div className="relative">
            <input
              id="club-email"
              type="email"
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

        {/* Notice of direct signup */}
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[var(--color-surface-2)]/60 text-[11px] text-[var(--color-text-muted)] text-left">
          <ShieldCheck size={14} className="text-emerald-400 shrink-0 mt-0.5" />
          <span>
            FestFlow does not require institutional approval or Dean clearance to get started. You can begin publishing events immediately after email verification.
          </span>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full mt-2"
          disabled={isLoading}
          isLoading={isLoading}
          rightIcon={<ArrowRight size={16} />}
        >
          Create Club Account
        </Button>
      </form>
    </AuthCard>
  )
}
