import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui'
import { AuthCard } from '@/components/auth/AuthCard'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { useAuth } from '@/context/AuthContext'

export default function ResetPasswordPage() {
  const { updatePassword, role } = useAuth()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!password) {
      errs.password = 'New password is required'
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

    setIsSubmitting(true)
    const res = await updatePassword(password)
    setIsSubmitting(false)

    if (res.error) {
      setServerError(res.error)
    } else {
      setIsSuccess(true)
    }
  }

  const loginPath = role === 'club_member' ? '/club/login' : '/student/login'

  return (
    <AuthCard
      title="Create New Password"
      subtitle="Enter a strong, secure password for your FestFlow account."
      role={role === 'club_member' ? 'club_member' : 'student'}
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
              Password updated successfully!
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Your FestFlow account password has been updated. You can now sign in with your new credentials.
            </p>
          </div>

          <Link to={loginPath} className="w-full mt-2">
            <Button variant="primary" size="lg" className="w-full">
              Sign In to Your Account
            </Button>
          </Link>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left" noValidate>
          {serverError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </motion.div>
          )}

          <PasswordInput
            label="New Password"
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (errors.password) setErrors((prev) => ({ ...prev, password: '' }))
            }}
            error={errors.password}
            showStrength
          />

          <PasswordInput
            label="Confirm New Password"
            placeholder="Repeat new password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: '' }))
            }}
            error={errors.confirmPassword}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-2"
            disabled={isSubmitting}
            isLoading={isSubmitting}
            rightIcon={<ArrowRight size={16} />}
          >
            Update Password
          </Button>
        </form>
      )}
    </AuthCard>
  )
}
