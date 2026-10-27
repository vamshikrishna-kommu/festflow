import type { ReactNode } from 'react'
import { Navigate, useLocation, Link } from 'react-router'
import { AlertTriangle, RefreshCw, LogOut, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button, Logo } from '@/components/ui'
import type { UserRole } from '@/types'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles?: UserRole[]
  fallbackPath?: string
}

export function ProtectedRoute({
  children,
  allowedRoles,
  fallbackPath,
}: ProtectedRouteProps) {
  const { session, role, isLoading, isRoleLoading, profileError, refreshProfile, signOut } = useAuth()
  const location = useLocation()

  // 1. Session Hydration & Role Loading — Never briefly render protected content
  if (isLoading || session === undefined || (session && isRoleLoading)) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-[var(--color-surface-0)]"
        aria-label="Checking authorization"
        role="status"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 rounded-full border-2 border-[var(--color-surface-3)] border-t-[var(--color-brand-purple)] animate-spin" />
          <span className="text-xs text-[var(--color-text-muted)] font-medium">
            Verifying FestFlow access…
          </span>
        </div>
      </div>
    )
  }

  // 2. Unauthenticated — Redirect to role-appropriate login route with return state
  if (!session) {
    const isClubTarget =
      allowedRoles &&
      allowedRoles.includes('club_member') &&
      !allowedRoles.includes('student')

    const targetLogin = fallbackPath || (isClubTarget ? '/club/login' : '/student/login')
    const fullRequestedPath = location.pathname + (location.search || '')

    return (
      <Navigate
        to={targetLogin}
        state={{ from: fullRequestedPath }}
        replace
      />
    )
  }

  // 3. Authenticated, but role resolution failed or returned null (Fail Closed)
  if (allowedRoles && allowedRoles.length > 0 && !role) {
    return (
      <div className="min-h-screen pt-28 pb-16 px-4 flex flex-col justify-center items-center bg-[var(--color-surface-0)] relative overflow-hidden">
        <div className="w-full max-w-md glass p-8 rounded-[var(--radius-card)] border border-rose-500/20 shadow-2xl text-center flex flex-col items-center">
          <div className="mb-5 flex flex-col items-center">
            <Logo variant="navbar" />
          </div>

          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 shadow-lg shadow-rose-500/10">
            <AlertTriangle size={28} />
          </div>

          <h1 className="text-xl font-bold font-display text-[var(--color-text-primary)] mb-2">
            Authorization Verification Failed
          </h1>

          <p className="text-sm text-[var(--color-text-secondary)] mb-6 leading-relaxed">
            {profileError ||
              'We were unable to securely verify your account permissions from the database. To protect sensitive event data, access has been suspended.'}
          </p>

          <div className="w-full flex flex-col gap-3">
            <Button
              variant="primary"
              size="md"
              className="w-full"
              leftIcon={<RefreshCw size={15} />}
              onClick={() => refreshProfile()}
            >
              Retry Permission Check
            </Button>
            <Button
              variant="outline"
              size="md"
              className="w-full text-rose-300 border-rose-500/30 hover:bg-rose-500/10"
              leftIcon={<LogOut size={15} />}
              onClick={() => signOut()}
            >
              Sign Out & Re-authenticate
            </Button>
            <Link to="/" className="w-full mt-2">
              <Button variant="ghost" size="sm" className="w-full text-xs" leftIcon={<ArrowLeft size={14} />}>
                Back to Homepage
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // 4. Role Authorization — Deny if role does not match allowed roles
  if (allowedRoles && allowedRoles.length > 0 && role) {
    if (!allowedRoles.includes(role)) {
      return (
        <Navigate
          to="/unauthorized"
          state={{
            attemptedPath: location.pathname + (location.search || ''),
            userRole: role,
            requiredRoles: allowedRoles,
          }}
          replace
        />
      )
    }
  }

  // 5. Authorized
  return <>{children}</>
}
