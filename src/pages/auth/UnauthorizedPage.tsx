import { Link, useLocation } from 'react-router'
import { motion } from 'motion/react'
import { ShieldAlert, ArrowRight, LogOut, Compass } from 'lucide-react'
import { Button, Badge } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'

export default function UnauthorizedPage() {
  const location = useLocation()
  const { role, profile, signOut } = useAuth()

  const state = location.state as {
    attemptedPath?: string
    userRole?: string
    requiredRoles?: string[]
  } | null

  const isClub = role === 'club_member'

  const dashboardPath = isClub ? '/club/dashboard' : '/student/dashboard'
  const dashboardLabel = isClub ? 'Club Dashboard' : 'Student Dashboard'

  return (
    <div className="min-h-screen pt-28 pb-16 px-4 flex flex-col justify-center items-center bg-[var(--color-surface-0)] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-[radial-gradient(circle,oklch(60%_0.25_25_/_0.15)_0%,transparent_70%)] pointer-events-none blur-3xl -z-10" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-lg glass p-8 rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.1)] shadow-2xl text-center flex flex-col items-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-5 shadow-lg shadow-amber-500/10">
          <ShieldAlert size={34} />
        </div>

        <Badge variant="amber" className="mb-3">
          Access Restricted
        </Badge>

        <h1 className="text-2xl font-bold font-display text-[var(--color-text-primary)] mb-2">
          Role Permission Required
        </h1>

        <p className="text-sm text-[var(--color-text-secondary)] mb-6 max-w-sm leading-relaxed">
          {profile?.display_name ? (
            <>
              You are signed in as <strong className="text-[var(--color-text-primary)]">{profile.display_name}</strong> with the{' '}
              <span className="font-semibold text-amber-400 capitalize">{role?.replace('_', ' ')}</span> role.
            </>
          ) : (
            'You do not have the required permissions to view this section.'
          )}
        </p>

        {state?.attemptedPath && (
          <div className="w-full p-3 bg-[var(--color-surface-2)] rounded-xl border border-[var(--color-surface-3)] text-xs text-left mb-6">
            <span className="text-[var(--color-text-muted)] block mb-0.5">Attempted route:</span>
            <code className="text-[var(--color-text-primary)] font-mono">{state.attemptedPath}</code>
          </div>
        )}

        <div className="w-full flex flex-col sm:flex-row gap-3">
          <Link to={dashboardPath} className="flex-1">
            <Button variant="primary" size="md" className="w-full" rightIcon={<ArrowRight size={15} />}>
              Go to {dashboardLabel}
            </Button>
          </Link>
          <Link to="/discover" className="flex-1">
            <Button variant="outline" size="md" className="w-full" leftIcon={<Compass size={15} />}>
              Explore Events
            </Button>
          </Link>
        </div>

        <div className="mt-6 pt-5 border-t border-[var(--color-surface-3)] w-full flex items-center justify-between text-xs text-[var(--color-text-muted)]">
          <span>Need to sign in with a different role?</span>
          <button
            type="button"
            onClick={() => signOut()}
            className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 font-medium transition-colors"
          >
            <LogOut size={13} />
            Sign Out
          </button>
        </div>
      </motion.div>
    </div>
  )
}
