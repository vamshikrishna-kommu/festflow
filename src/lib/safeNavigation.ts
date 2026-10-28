import type { UserRole } from '@/types'

/**
 * Validates whether a path is a safe, relative, internal application path.
 * Prevents Open Redirect attacks via:
 * - Protocol schemes (e.g. `javascript:`, `data:`, `https:`, `http:`)
 * - Protocol-relative URLs (e.g. `//evil.com`)
 * - Windows-style or backslash path traversal (e.g. `/\evil.com`, `\\evil.com`)
 * - Redirect loops back to authentication, verification, or error pages
 */
export function isSafeInternalRedirect(path: unknown): path is string {
  if (typeof path !== 'string' || !path.trim()) {
    return false
  }

  const trimmed = path.trim()

  // Must begin with a single slash '/'
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\') || trimmed.startsWith('\\')) {
    return false
  }

  // Must not contain any protocol scheme before a slash or query (e.g. "javascript:", "data:")
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return false
  }

  // Block redirect loops to authentication and authorization pages
  const lowerPath = trimmed.toLowerCase()
  const forbiddenPrefixes = [
    '/student/login',
    '/club/login',
    '/student/signup',
    '/club/signup',
    '/forgot-password',
    '/reset-password',
    '/auth/callback',
    '/unauthorized',
  ]

  for (const prefix of forbiddenPrefixes) {
    if (lowerPath === prefix || lowerPath.startsWith(`${prefix}/`) || lowerPath.startsWith(`${prefix}?`)) {
      return false
    }
  }

  return true
}

/**
 * Returns the default authorized home landing path for a given user role.
 */
export function getRoleDefaultPath(role: UserRole | null | undefined): string {
  switch (role) {
    case 'club_member':
      return '/club/dashboard'
    case 'student':
      return '/student/dashboard'
    case 'platform_admin':
      return '/club/dashboard'
    default:
      return '/'
  }
}

/**
 * Determines whether a given internal path is accessible by a specific user role.
 * Enforces role isolation so that students cannot be redirected to club management
 * and organizers cannot be redirected to student-only workflows.
 */
export function isPathAllowedForRole(path: string, role: UserRole | null | undefined): boolean {
  if (!isSafeInternalRedirect(path)) {
    return false
  }

  // Strip query string and hash for prefix checks
  const cleanPath = path.split('?')[0].split('#')[0].toLowerCase()

  // Public paths accessible by anyone (regardless of role or auth state)
  const isPublicPath =
    cleanPath === '/' ||
    cleanPath === '/discover' ||
    cleanPath.startsWith('/events/') ||
    cleanPath.startsWith('/join-team') ||
    cleanPath.startsWith('/club/invitations/') ||
    cleanPath.startsWith('/club/invitation/') ||
    cleanPath.startsWith('/accept-club-invitation/') ||
    cleanPath === '/privacy' ||
    cleanPath === '/terms' ||
    cleanPath === '/contact'

  if (isPublicPath) {
    return true
  }

  // Platform admin can access all internal routes
  if (role === 'platform_admin') {
    return true
  }

  // Club organizer allowed routes
  const isClubRoute = cleanPath.startsWith('/club/')
  if (isClubRoute) {
    return role === 'club_member'
  }

  // Student allowed routes
  const isStudentRoute =
    cleanPath.startsWith('/student/') ||
    cleanPath.startsWith('/tickets/') ||
    cleanPath.startsWith('/payment/') ||
    cleanPath === '/dashboard'

  if (isStudentRoute) {
    return role === 'student'
  }

  // By default, unknown routes or general routes default to true if authenticated
  return Boolean(role)
}

/**
 * Returns a guaranteed safe, role-authorized return URL.
 * If the candidate path is invalid, unsafe, or unauthorized for the user's role,
 * this safely returns the role's default dashboard instead.
 */
export function getSafeReturnUrl(
  candidatePath: unknown,
  role: UserRole | null | undefined,
  defaultFallback?: string
): string {
  const fallback = defaultFallback || getRoleDefaultPath(role)

  if (!isSafeInternalRedirect(candidatePath)) {
    return fallback
  }

  if (!isPathAllowedForRole(candidatePath, role)) {
    return fallback
  }

  return candidatePath
}
