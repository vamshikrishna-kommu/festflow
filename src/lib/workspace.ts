import type { UserRole, ClubRole, ClubMemberRecord, ClubProfile } from '@/types'

export type WorkspaceType = 'student' | 'club'

export interface AvailableClub {
  id: string
  name: string
  role: ClubRole
  isOwner: boolean
}

/**
 * Checks whether a user can access the Student Workspace.
 * True for students and platform admins.
 */
export function canAccessStudentWorkspace(role: UserRole | null | undefined): boolean {
  if (!role) return false
  return role === 'student' || role === 'platform_admin'
}

/**
 * Checks whether a user can access the Club Workspace.
 * True for club owners, platform admins, or any user with at least one ACTIVE club membership.
 * Revoked, pending, or expired memberships do NOT grant access.
 */
export function canAccessClubWorkspace(
  role: UserRole | null | undefined,
  clubProfile: ClubProfile | null | undefined,
  clubMemberships: ClubMemberRecord[] = []
): boolean {
  if (role === 'platform_admin') return true
  if (clubProfile !== null && clubProfile !== undefined) return true
  return Array.isArray(clubMemberships) && clubMemberships.some((m) => m && m.status === 'active')
}

/**
 * Checks whether the user is eligible for both Student and Club workspaces.
 */
export function isDualWorkspaceEligible(
  role: UserRole | null | undefined,
  clubProfile: ClubProfile | null | undefined,
  clubMemberships: ClubMemberRecord[] = []
): boolean {
  return (
    canAccessStudentWorkspace(role) &&
    canAccessClubWorkspace(role, clubProfile, clubMemberships)
  )
}

/**
 * Derives the workspace type implied by the current URL pathname.
 * Returns null if the path is a neutral public route (e.g. /discover, /events/:id).
 */
export function getWorkspaceFromPath(pathname: string): WorkspaceType | null {
  const clean = pathname.toLowerCase()

  // Public club routes that do not indicate active club workspace
  if (
    clean.startsWith('/club/invitations/') ||
    clean.startsWith('/club/invitation/') ||
    clean.startsWith('/club/join/') ||
    clean.startsWith('/accept-club-invitation') ||
    clean === '/club/login' ||
    clean === '/club/signup'
  ) {
    return null
  }

  // Club Workspace routes
  if (clean.startsWith('/club/') || clean === '/club') {
    return 'club'
  }

  // Student Workspace routes
  if (
    clean.startsWith('/student') ||
    clean.startsWith('/tickets') ||
    clean.startsWith('/payment') ||
    clean === '/dashboard'
  ) {
    return 'student'
  }

  return null
}
