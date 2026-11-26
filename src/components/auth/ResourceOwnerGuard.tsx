import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react'
import { Button, Logo } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { getRoleDefaultPath } from '@/lib/safeNavigation'

interface ResourceOwnerGuardProps {
  isAuthorized: boolean | null
  isLoading?: boolean
  denialTitle?: string
  denialMessage?: string
  fallbackUrl?: string
  fallbackLabel?: string
  children: ReactNode
}

export function ResourceOwnerGuard({
  isAuthorized,
  isLoading = false,
  denialTitle = 'Access Denied',
  denialMessage = 'You do not have permission to manage this resource or view this private record.',
  fallbackUrl,
  fallbackLabel,
  children,
}: ResourceOwnerGuardProps) {
  const { role } = useAuth()
  const defaultDashboard = getRoleDefaultPath(role)
  const targetFallback = fallbackUrl || defaultDashboard
  const targetLabel = fallbackLabel || (role === 'club_member' ? 'Back to Club Events' : 'Back to Dashboard')

  // 1. Loading state
  if (isLoading || isAuthorized === null) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center">
        <div className="w-9 h-9 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin mb-3" />
        <span className="text-xs text-gray-500 font-medium">
          Verifying resource permissions…
        </span>
      </div>
    )
  }

  // 2. Unauthorized — Render Access Denied UI
  if (!isAuthorized) {
    return (
      <div className="min-h-[60dvh] px-4 py-16 flex flex-col justify-center items-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-md bg-white p-8 rounded-2xl border border-gray-200 shadow-lg flex flex-col items-center"
        >
          <div className="mb-4">
            <Logo variant="navbar" />
          </div>

          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-4">
            <ShieldAlert size={28} />
          </div>

          <h2 className="text-xl font-bold font-display text-[var(--color-text-primary)] mb-2">
            {denialTitle}
          </h2>

          <p className="text-sm text-[var(--color-text-secondary)] mb-6 leading-relaxed">
            {denialMessage}
          </p>

          <div className="w-full flex flex-col sm:flex-row gap-3">
            <Link to={targetFallback} className="flex-1">
              <Button variant="primary" size="md" className="w-full" leftIcon={<ArrowLeft size={15} />}>
                {targetLabel}
              </Button>
            </Link>
            <Link to="/" className="sm:w-auto">
              <Button variant="outline" size="md" className="w-full" leftIcon={<Home size={15} />}>
                Home
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  // 3. Authorized
  return <>{children}</>
}
