import { useState } from 'react'
import { motion } from 'motion/react'
import { Mail, CheckCircle2, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui'
import { Link } from 'react-router'
import { useAuth } from '@/context/AuthContext'

interface VerificationNoticeProps {
  email: string
  role: 'club_member' | 'student'
  onBackToLogin: () => void
}

export function VerificationNotice({ email, role, onBackToLogin }: VerificationNoticeProps) {
  const { resendVerification } = useAuth()
  const [resending, setResending] = useState(false)
  const [resendStatus, setResendStatus] = useState<{ message: string; isError?: boolean } | null>(null)
  const [cooldown, setCooldown] = useState(0)

  const handleResend = async () => {
    if (cooldown > 0 || resending) return
    setResending(true)
    setResendStatus(null)

    const res = await resendVerification(email)
    setResending(false)

    if (res.error) {
      setResendStatus({ message: res.error, isError: true })
    } else {
      setResendStatus({
        message: 'A fresh verification link has been sent to your inbox.',
        isError: false,
      })
      setCooldown(30)
      const timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
  }

  const isClub = role === 'club_member'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="text-center flex flex-col items-center py-4"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#18CFFC]/20 to-[#7F1AFB]/20 border border-[#18CFFC]/30 flex items-center justify-center mb-5 text-[#18CFFC] shadow-lg shadow-[#18CFFC]/10">
        <Mail size={32} />
      </div>

      <h2 className="text-2xl font-bold font-display text-[var(--color-text-primary)] mb-2">
        Verify your email
      </h2>

      <p className="text-sm text-[var(--color-text-secondary)] max-w-sm mx-auto mb-4 leading-relaxed">
        We sent an activation link to{' '}
        <strong className="text-[var(--color-text-primary)] font-medium break-all">{email}</strong>.
        Please click the link in your email to activate your {isClub ? 'club representative' : 'student'} account.
      </p>

      {/* Info callout */}
      <div className="w-full bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] rounded-xl p-3.5 mb-6 text-xs text-[var(--color-text-secondary)] text-left flex items-start gap-2.5">
        <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-[var(--color-text-primary)] block mb-0.5">
            {isClub ? 'Direct activation, no bureaucracy' : 'Instant campus pass'}
          </span>
          {isClub
            ? 'No institutional sign-off or waitlists required. Once verified, you will have immediate access to the FestFlow club portal.'
            : 'Once verified, you will be able to RSVP to events and receive pass confirmations directly.'}
        </div>
      </div>

      {resendStatus && (
        <div
          className={`w-full p-3 rounded-xl text-xs mb-4 flex items-center gap-2 ${
            resendStatus.isError
              ? 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
              : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
          }`}
        >
          {resendStatus.isError ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
          <span>{resendStatus.message}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 w-full">
        <Button
          variant="outline"
          size="md"
          className="flex-1"
          onClick={handleResend}
          disabled={resending || cooldown > 0}
          leftIcon={<RefreshCw size={14} className={resending ? 'animate-spin' : ''} />}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Email'}
        </Button>
        <Button
          variant="primary"
          size="md"
          className="flex-1"
          onClick={onBackToLogin}
          rightIcon={<ArrowRight size={14} />}
        >
          Go to Sign In
        </Button>
      </div>

      <div className="mt-6 pt-4 border-t border-[var(--color-surface-3)] w-full text-center">
        <Link
          to="/discover"
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
        >
          Browse public events while you wait
        </Link>
      </div>
    </motion.div>
  )
}
