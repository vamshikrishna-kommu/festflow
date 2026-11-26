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
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className="text-center flex flex-col items-center py-4"
    >
      <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mb-5 text-blue-600 shadow-xs">
        <Mail size={28} />
      </div>

      <h2 className="text-2xl font-bold font-display text-gray-900 mb-2">
        Verify your email
      </h2>

      <p className="text-sm text-gray-600 max-w-sm mx-auto mb-4 leading-relaxed">
        We sent an activation link to{' '}
        <strong className="text-gray-900 font-semibold break-all">{email}</strong>.
        Please click the link in your email to activate your {isClub ? 'club representative' : 'student'} account.
      </p>

      <div className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3.5 mb-6 text-xs text-gray-600 text-left flex items-start gap-2.5">
        <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-gray-900 block mb-0.5">
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
              ? 'bg-rose-50 border border-rose-200 text-rose-800'
              : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          }`}
        >
          {resendStatus.isError ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
          <span>{resendStatus.message}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 w-full">
        <Button
          variant="secondary"
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

      <div className="mt-6 pt-4 border-t border-gray-100 w-full text-center">
        <Link
          to="/discover"
          className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          Browse public events while you wait
        </Link>
      </div>
    </motion.div>
  )
}
