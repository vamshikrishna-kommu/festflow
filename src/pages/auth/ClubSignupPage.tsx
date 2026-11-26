import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { Building2, User, Mail, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui'
import { AuthCard } from '@/components/auth/AuthCard'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { VerificationNotice } from '@/components/auth/VerificationNotice'
import { GoogleAuthButton, AuthDivider } from '@/components/auth/GoogleAuthButton'
import { useAuth } from '@/context/AuthContext'
import { CollegeSearchCombobox } from '@/components/colleges/CollegeSearchCombobox'

export default function ClubSignupPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signUpClub, isLoading } = useAuth()

  const [representativeName, setRepresentativeName] = useState('')
  const [clubName, setClubName] = useState('')
  const [collegeId, setCollegeId] = useState<string | null>(null)
  const [collegeName, setCollegeName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPendingVerification, setIsPendingVerification] = useState(false)

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
      collegeId: collegeId || null,
      collegeName: collegeName.trim() || null,
    })

    if (res.error) {
      setServerError(res.error)
    } else if (res.requiresVerification) {
      setIsPendingVerification(true)
    } else {
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
      subtitle="Launch events, verify UPI payments, and manage campus passes directly"
      role="club_member"
      mode="signup"
    >
      <div className="w-full min-w-0 mb-1">
        <GoogleAuthButton
          role="club_member"
          mode="signup"
          redirectTo={searchParams.get('redirect') || searchParams.get('next') || undefined}
          onError={(err) => setServerError(err)}
        />
        <AuthDivider text="or register with email" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {serverError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 text-left"
          >
            <AlertCircle size={15} className="shrink-0 text-rose-600" />
            <span>{serverError}</span>
          </motion.div>
        )}

        {/* Representative Name */}
        <div className="flex flex-col gap-1.5 text-left">
          <label
            htmlFor="rep-name"
            className="text-xs font-semibold text-gray-700"
          >
            Representative Full Name
          </label>
          <div className="relative">
            <input
              id="rep-name"
              type="text"
              placeholder="e.g. Representative Full Name"
              value={representativeName}
              onChange={(e) => {
                setRepresentativeName(e.target.value)
                if (errors.representativeName) setErrors((prev) => ({ ...prev, representativeName: '' }))
              }}
              className={`w-full px-3.5 py-2.5 pl-10 rounded-lg text-sm bg-white text-gray-900 border transition-colors duration-150 outline-none placeholder:text-gray-400 ${
                errors.representativeName
                  ? 'border-rose-400 focus:border-rose-500 focus:ring-3 focus:ring-rose-500/15'
                  : 'border-gray-200 hover:border-gray-300 focus:border-blue-600 focus:ring-3 focus:ring-blue-600/10'
              }`}
            />
            <User
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
          </div>
          {errors.representativeName && (
            <p className="text-xs text-rose-600">{errors.representativeName}</p>
          )}
        </div>

        {/* Club Name */}
        <div className="flex flex-col gap-1.5 text-left">
          <label
            htmlFor="club-name"
            className="text-xs font-semibold text-gray-700"
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
              className={`w-full px-3.5 py-2.5 pl-10 rounded-lg text-sm bg-white text-gray-900 border transition-colors duration-150 outline-none placeholder:text-gray-400 ${
                errors.clubName
                  ? 'border-rose-400 focus:border-rose-500 focus:ring-3 focus:ring-rose-500/15'
                  : 'border-gray-200 hover:border-gray-300 focus:border-blue-600 focus:ring-3 focus:ring-blue-600/10'
              }`}
            />
            <Building2
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
          </div>
          {errors.clubName && (
            <p className="text-xs text-rose-600">{errors.clubName}</p>
          )}
        </div>

        {/* Institution Affiliation */}
        <div className="text-left">
          <CollegeSearchCombobox
            label="Affiliated Educational Institution"
            placeholder="Search institution (e.g. CBIT, OU, VNR, IITH)..."
            selectedCollegeId={collegeId}
            selectedCollegeName={collegeName}
            onSelect={(col, rawName) => {
              if (col) {
                setCollegeId(col.id)
                setCollegeName(col.official_name || col.name)
              } else {
                setCollegeId(null)
                setCollegeName(rawName || '')
              }
            }}
            helperText="Associate your club with your verified campus."
          />
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5 text-left">
          <label
            htmlFor="club-email"
            className="text-xs font-semibold text-gray-700"
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
              className={`w-full px-3.5 py-2.5 pl-10 rounded-lg text-sm bg-white text-gray-900 border transition-colors duration-150 outline-none placeholder:text-gray-400 ${
                errors.email
                  ? 'border-rose-400 focus:border-rose-500 focus:ring-3 focus:ring-rose-500/15'
                  : 'border-gray-200 hover:border-gray-300 focus:border-blue-600 focus:ring-3 focus:ring-blue-600/10'
              }`}
            />
            <Mail
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
          </div>
          {errors.email && (
            <p className="text-xs text-rose-600">{errors.email}</p>
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

        <div className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200 text-[11px] text-gray-600 text-left">
          <ShieldCheck size={14} className="text-emerald-600 shrink-0 mt-0.5" />
          <span>
            No institutional approval required to get started. Publish events immediately after email verification.
          </span>
        </div>

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
