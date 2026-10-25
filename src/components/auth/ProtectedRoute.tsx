import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '@/context/AuthContext'
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
  const { session, role, isLoading } = useAuth()
  const location = useLocation()

  // 1. Loading state — wait for session hydration
  if (isLoading || session === undefined) {
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

  // 2. Unauthenticated — redirect to appropriate login
  if (!session) {
    const isClubTarget = allowedRoles?.includes('club_member')
    const targetLogin = fallbackPath || (isClubTarget ? '/club/login' : '/student/login')
    return (
      <Navigate
        to={targetLogin}
        state={{ from: location.pathname }}
        replace
      />
    )
  }

  // 3. Authenticated, but role does not match allowedRoles
  if (allowedRoles && allowedRoles.length > 0 && role) {
    if (!allowedRoles.includes(role)) {
      // Redirect to Unauthorized with state so it can display custom helpful messages
      return (
        <Navigate
          to="/unauthorized"
          state={{
            attemptedPath: location.pathname,
            userRole: role,
            requiredRoles: allowedRoles,
          }}
          replace
        />
      )
    }
  }

  return <>{children}</>
}
