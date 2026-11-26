import { Link, useLocation, Navigate } from 'react-router'
import { motion } from 'motion/react'
import { ShieldAlert, ArrowRight, LogOut, Compass } from 'lucide-react'
import { Button, Badge, Logo } from '@/components/ui'
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
  const isAdmin = role === 'platform_admin'

  if (isAdmin) {
    return <Navigate to="/admin/dashboard" replace />
  }

  const dashboardPath = isAdmin ? '/admin/dashboard' : isClub ? '/club/dashboard' : '/student/dashboard'
  const dashboardLabel = isAdmin ? 'Super Admin Portal' : isClub ? 'Club Dashboard' : 'Student Dashboard'

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 flex flex-col justify-center items-center bg-[#F7F8FA]">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-lg bg-white p-8 rounded-2xl border border-gray-200 shadow-lg text-center flex flex-col items-center"
      >
        <Link to="/" className="mb-5 flex flex-col items-center group" aria-label="FestFlow home">
          <Logo variant="navbar" />
        </Link>

        <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4">
          <ShieldAlert size={24} />
        </div>

        <Badge variant="amber" className="mb-3">
          Access Restricted
        </Badge>

        <h1 className="text-2xl font-bold font-display text-gray-900 mb-2">
          Role Permission Required
        </h1>

        <p className="text-sm text-gray-600 mb-6 max-w-sm leading-relaxed">
          {profile?.display_name ? (
            <>
              You are signed in as <strong className="text-gray-900">{profile.display_name}</strong> with the{' '}
              <span className="font-semibold text-amber-700 capitalize">{role?.replace('_', ' ')}</span> role.
            </>
          ) : (
            'You do not have the required permissions to view this section.'
          )}
        </p>

        {state?.attemptedPath && (
          <div className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs text-left mb-6">
            <span className="text-gray-500 block mb-0.5">Attempted route:</span>
            <code className="text-gray-900 font-mono">{state.attemptedPath}</code>
          </div>
        )}

        <div className="w-full flex flex-col sm:flex-row gap-3">
          <Link to={dashboardPath} className="flex-1">
            <Button variant="primary" size="md" className="w-full" rightIcon={<ArrowRight size={15} />}>
              Go to {dashboardLabel}
            </Button>
          </Link>
          <Link to="/discover" className="flex-1">
            <Button variant="secondary" size="md" className="w-full" leftIcon={<Compass size={15} />}>
              Explore Events
            </Button>
          </Link>
        </div>

        <div className="mt-6 pt-5 border-t border-gray-100 w-full flex items-center justify-between text-xs text-gray-500">
          <span>Need to sign in with a different role?</span>
          <button
            type="button"
            onClick={() => signOut()}
            className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 font-semibold transition-colors cursor-pointer"
          >
            <LogOut size={13} />
            Sign Out
          </button>
        </div>
      </motion.div>
    </div>
  )
}
