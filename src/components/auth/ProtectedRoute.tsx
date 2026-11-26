import type { ReactNode } from 'react'
import { Navigate, useLocation, useParams, Link } from 'react-router'
import { AlertTriangle, RefreshCw, LogOut, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button, Logo } from '@/components/ui'
import type { UserRole, ClubPermission } from '@/types'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles?: UserRole[]
  requiredClubPermissions?: ClubPermission[]
  clubPermissionMode?: 'all' | 'any'
  allowEventAssignmentScope?: boolean
  fallbackPath?: string
}

export function ProtectedRoute({
  children,
  allowedRoles,
  requiredClubPermissions,
  clubPermissionMode = 'all',
  allowEventAssignmentScope = false,
  fallbackPath,
}: ProtectedRouteProps) {
  const {
    session,
    role,
    isLoading,
    isRoleLoading,
    profileError,
    refreshProfile,
    signOut,
    hasClubMembership,
    activeClubRole,
    eventAssignments,
    hasClubPermission,
    hasEventPermission,
  } = useAuth()
  const location = useLocation()
  const { id: routeEventId } = useParams<{ id?: string }>()

  // 1. Session Hydration & Role/Membership Loading — Wait until RBAC context is settled
  const awaitingPermissions = Boolean(requiredClubPermissions?.length) && !activeClubRole && !profileError
  if (
    isLoading ||
    session === undefined ||
    (session && isRoleLoading && (!role || awaitingPermissions))
  ) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-[var(--color-surface-0)]"
        aria-label="Checking authorization"
        role="status"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin" />
          <span className="text-xs text-gray-500 font-medium">
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
        <div className="w-full max-w-md bg-white p-8 rounded-2xl border border-gray-200 shadow-lg text-center flex flex-col items-center">
          <div className="mb-5 flex flex-col items-center">
            <Logo variant="navbar" />
          </div>

          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-4">
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
              className="w-full text-rose-600 border-rose-200 hover:bg-rose-50"
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

  // 4. Role Authorization — Check global role and club membership coexistence
  if (allowedRoles && allowedRoles.length > 0 && role) {
    const isClubTarget = allowedRoles.includes('club_member')
    const isAuthorizedByClubMembership = isClubTarget && Boolean(hasClubMembership)
    const isAuthorizedByRole = allowedRoles.includes(role)
    const isPlatformAdmin = role === 'platform_admin'

    if (!isAuthorizedByRole && !isAuthorizedByClubMembership && !isPlatformAdmin) {
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

  // 5. Granular Club RBAC Permission Check (Fail Closed)
  if (requiredClubPermissions && requiredClubPermissions.length > 0 && role !== 'platform_admin') {
    const checkPermission = (perm: ClubPermission): boolean => {
      if (hasClubPermission(perm)) return true
      if (allowEventAssignmentScope && routeEventId) {
        if (hasEventPermission(routeEventId, perm)) return true
        return eventAssignments.some(
          (a) =>
            a.event_id === routeEventId &&
            hasEventPermission(routeEventId, perm, a.club_id)
        )
      }
      return false
    }

    const authorized =
      clubPermissionMode === 'any'
        ? requiredClubPermissions.some(checkPermission)
        : requiredClubPermissions.every(checkPermission)

    if (!authorized) {
      return (
        <Navigate
          to="/unauthorized"
          state={{
            attemptedPath: location.pathname + (location.search || ''),
            userRole: role,
            clubRole: activeClubRole,
            requiredPermissions: requiredClubPermissions,
          }}
          replace
        />
      )
    }
  }

  // 6. Authorized
  return <>{children}</>
}
