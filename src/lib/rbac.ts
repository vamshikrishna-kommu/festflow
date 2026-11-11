import type {
  AssignableClubRole,
  AssignableEventAssignmentRole,
  CanonicalClubPermission,
  ClubMemberRecord,
  ClubPermission,
  ClubRole,
  EventAssignmentRecord,
  EventAssignmentRole,
  LegacyClubPermission,
} from '@/types'

// ── Canonical Granular Permissions & Legacy Compatibility Mapping ─────────────

export const CANONICAL_CLUB_PERMISSIONS: readonly CanonicalClubPermission[] = [
  'club.view',
  'club.manage',
  'club.transfer_ownership',
  'members.view',
  'members.invite',
  'members.manage',
  'roles.assign',
  'events.view',
  'events.create',
  'events.edit',
  'events.publish',
  'events.cancel',
  'registrations.view',
  'registrations.manage',
  'payments.view',
  'payments.verify',
  'payments.settings',
  'reports.view',
  'reports.export',
] as const

export const LEGACY_PERMISSION_ALIASES: Record<
  LegacyClubPermission,
  CanonicalClubPermission | null
> = {
  manage_club: 'club.manage',
  manage_members: 'members.manage',
  manage_events: 'events.edit',
  view_attendees: 'registrations.view',
  review_payments: 'payments.verify',
  view_reports: 'reports.view',
  // Legacy gate scanner permission is intentionally retired and always evaluates to false.
  gate_checkin: null,
}

export const PERMISSION_DESCRIPTIONS: Record<CanonicalClubPermission, string> = {
  'club.view': 'Access the club workspace dashboard and organization overview',
  'club.manage': 'Edit organization profile, branding assets, and club settings',
  'club.transfer_ownership': 'Transfer primary organization ownership to another active member',
  'members.view': 'View organization team roster, member roles, and activity audit logs',
  'members.invite': 'Send, resend, and revoke team invitations',
  'members.manage': 'Remove team members or change lower-tier member assignments',
  'roles.assign': 'Assign club roles and per-event responsibility delegations',
  'events.view': 'View club events, schedules, and drafts',
  'events.create': 'Create new event drafts',
  'events.edit': 'Edit event details, tiers, coupons, branding, schedules, and discussions',
  'events.publish': 'Publish and feature club events to students',
  'events.cancel': 'Cancel published club events and trigger participant notifications',
  'registrations.view': 'View student registration rosters and waitlist queues',
  'registrations.manage': 'Approve/reject applications, manage waitlists, and handle registration edits or cancellations',
  'payments.view': 'Inspect submitted UPI payment proofs, UTR references, and settlement summaries',
  'payments.verify': 'Approve or reject UPI payments and review payment disputes or refunds',
  'payments.settings': 'Configure club UPI VPA, QR settlement instructions, and payout preferences',
  'reports.view': 'View event attendance and analytics dashboards',
  'reports.export': 'Export CSV and Excel registration and financial reports',
}

// ── Role Hierarchy & Role Definitions ─────────────────────────────────────────

export const ALL_CLUB_ROLES: readonly ClubRole[] = [
  'owner',
  'admin',
  'event_manager',
  'payment_reviewer',
  'checkin_staff',
  'viewer',
] as const

export const ASSIGNABLE_CLUB_ROLES: readonly AssignableClubRole[] = [
  'admin',
  'event_manager',
  'payment_reviewer',
  'viewer',
] as const

export const ASSIGNABLE_EVENT_ASSIGNMENT_ROLES: readonly AssignableEventAssignmentRole[] = [
  'event_manager',
  'registration_manager',
  'finance_manager',
  'content_manager',
] as const

export const ROLE_RANK: Record<ClubRole, number> = {
  owner: 6,
  admin: 5,
  event_manager: 4,
  payment_reviewer: 3,
  checkin_staff: 2,
  viewer: 1,
}

export const ROLE_LABELS: Record<ClubRole, string> = {
  owner: 'Club Owner',
  admin: 'Administrator',
  event_manager: 'Event Manager',
  payment_reviewer: 'Payment Reviewer',
  checkin_staff: 'Legacy Operations Staff',
  viewer: 'Viewer',
}

export const ROLE_DESCRIPTIONS: Record<ClubRole, string> = {
  owner:
    'Primary owner with complete authority over profile settings, payment configuration, member roles, events, and ownership transfer.',
  admin:
    'Delegated administrator managing events, attendees, payments, payment settings, and staff strictly below Admin tier.',
  event_manager:
    'Creates, edits, publishes, and cancels events, manages attendee registrations/waitlists, and exports event reports.',
  payment_reviewer:
    'Reviews student UPI payment proofs, inspects UTR references, approves/rejects fees, and views/exports financial reports.',
  checkin_staff:
    'Deprecated legacy role retained read-only for historical compatibility. Cannot access retired check-in tools or write operations.',
  viewer:
    'Read-only access to the club dashboard, event listings, attendee counts/rosters, and analytics summaries.',
}

export const ASSIGNMENT_ROLE_LABELS: Record<EventAssignmentRole, string> = {
  event_manager: 'Event Manager',
  registration_manager: 'Registration Manager',
  finance_manager: 'Finance Manager',
  checkin_staff: 'Legacy Operations Staff',
  content_manager: 'Content & Media Manager',
}

export const ASSIGNMENT_ROLE_DESCRIPTIONS: Record<EventAssignmentRole, string> = {
  event_manager:
    'Oversees event editing, publishing, cancellations, attendee operations, and report exports for this event.',
  registration_manager:
    'Manages attendees, reviews application forms/waitlists, and exports rosters for this event.',
  finance_manager:
    'Reviews UPI receipts, verifies event fee submissions, and exports financial reports for this event.',
  checkin_staff:
    'Deprecated legacy per-event role retained read-only for compatibility.',
  content_manager:
    'Updates this event description, media gallery, speakers, announcements, and schedule content.',
}

// ── Canonical Role -> Permission Matrix ───────────────────────────────────────

export const ROLE_PERMISSIONS: Record<ClubRole, CanonicalClubPermission[]> = {
  owner: [...CANONICAL_CLUB_PERMISSIONS],
  admin: CANONICAL_CLUB_PERMISSIONS.filter((perm) => perm !== 'club.transfer_ownership'),
  event_manager: [
    'club.view',
    'events.view',
    'events.create',
    'events.edit',
    'events.publish',
    'events.cancel',
    'registrations.view',
    'registrations.manage',
    'reports.view',
    'reports.export',
  ],
  payment_reviewer: [
    'club.view',
    'events.view',
    'payments.view',
    'payments.verify',
    'reports.view',
    'reports.export',
  ],
  // Legacy compatibility only: strictly read-only, gate_checkin always evaluates false.
  checkin_staff: ['club.view', 'events.view', 'registrations.view'],
  viewer: ['club.view', 'events.view', 'registrations.view', 'reports.view'],
}

// Event-scoped assignments ONLY expand permissions for that specific (club_id, event_id)
// when the user holds an active club_members row in that club.
export const EVENT_ASSIGNMENT_PERMISSIONS: Record<
  EventAssignmentRole,
  CanonicalClubPermission[]
> = {
  event_manager: [
    'events.view',
    'events.edit',
    'events.publish',
    'events.cancel',
    'registrations.view',
    'registrations.manage',
    'reports.view',
    'reports.export',
  ],
  registration_manager: [
    'events.view',
    'registrations.view',
    'registrations.manage',
    'reports.view',
    'reports.export',
  ],
  finance_manager: [
    'events.view',
    'payments.view',
    'payments.verify',
    'reports.view',
    'reports.export',
  ],
  content_manager: ['events.view', 'events.edit'],
  checkin_staff: ['events.view', 'registrations.view'],
}

// ── Validation & Normalization Helpers ────────────────────────────────────────

export function isValidClubRole(value: unknown): value is ClubRole {
  return typeof value === 'string' && (ALL_CLUB_ROLES as readonly string[]).includes(value)
}

export function isAssignableClubRole(value: unknown): value is AssignableClubRole {
  return (
    typeof value === 'string' &&
    (ASSIGNABLE_CLUB_ROLES as readonly string[]).includes(value)
  )
}

export function isAssignableEventAssignmentRole(
  value: unknown
): value is AssignableEventAssignmentRole {
  return (
    typeof value === 'string' &&
    (ASSIGNABLE_EVENT_ASSIGNMENT_ROLES as readonly string[]).includes(value)
  )
}

export function normalizeClubPermission(
  permission: ClubPermission | string
): CanonicalClubPermission | null {
  if (!permission || typeof permission !== 'string') return null
  if ((CANONICAL_CLUB_PERMISSIONS as readonly string[]).includes(permission)) {
    return permission as CanonicalClubPermission
  }
  if (permission in LEGACY_PERMISSION_ALIASES) {
    return LEGACY_PERMISSION_ALIASES[permission as LegacyClubPermission]
  }
  return null
}

// ── Core Permission Evaluators (Fail Closed) ─────────────────────────────────

export function getRolePermissions(
  role: ClubRole | null | undefined
): CanonicalClubPermission[] {
  if (!role || !isValidClubRole(role)) return []
  return ROLE_PERMISSIONS[role] ?? []
}

export function hasPermission(
  role: ClubRole | null | undefined,
  permission: ClubPermission
): boolean {
  if (!role || !isValidClubRole(role)) return false
  const canonical = normalizeClubPermission(permission)
  if (!canonical) return false
  return ROLE_PERMISSIONS[role].includes(canonical)
}

export function hasAnyPermission(
  role: ClubRole | null | undefined,
  permissions: readonly ClubPermission[]
): boolean {
  if (!role || !permissions.length) return false
  return permissions.some((permission) => hasPermission(role, permission))
}

export function hasAllPermissions(
  role: ClubRole | null | undefined,
  permissions: readonly ClubPermission[]
): boolean {
  if (!role || !permissions.length) return false
  return permissions.every((permission) => hasPermission(role, permission))
}

// ── Role Hierarchy & Member Management Guards ────────────────────────────────

export function canAssignRole(
  actorRole: ClubRole | null | undefined,
  targetRole: ClubRole | string
): boolean {
  if (!actorRole || !hasPermission(actorRole, 'roles.assign')) return false
  if (!isAssignableClubRole(targetRole)) return false
  return ROLE_RANK[actorRole] > ROLE_RANK[targetRole]
}

export function getAssignableRoles(
  actorRole: ClubRole | null | undefined
): AssignableClubRole[] {
  if (!actorRole) return []
  return ASSIGNABLE_CLUB_ROLES.filter((role) => canAssignRole(actorRole, role))
}

export function canManageMember(
  actorRole: ClubRole | null | undefined,
  actorUserId: string | null | undefined,
  targetMember: Pick<ClubMemberRecord, 'user_id' | 'role'> | null | undefined,
  newRole?: ClubRole
): boolean {
  if (!actorRole || !actorUserId || !targetMember) return false
  if (!hasPermission(actorRole, 'members.manage')) return false
  if (targetMember.user_id === actorUserId) return false
  if (!isValidClubRole(targetMember.role)) return false
  if (ROLE_RANK[actorRole] <= ROLE_RANK[targetMember.role]) return false
  if (newRole !== undefined && !canAssignRole(actorRole, newRole)) return false
  return true
}

export function canTransferOwnership(
  actorRole: ClubRole | null | undefined
): boolean {
  return hasPermission(actorRole, 'club.transfer_ownership')
}

// ── Per-Event Effective Permission Resolution ────────────────────────────────

export interface EventPermissionContext {
  clubRole: ClubRole | null | undefined
  clubId: string | null | undefined
  eventClubId: string | null | undefined
  eventId: string | null | undefined
  userId?: string | null
  isMemberActive?: boolean
  eventAssignments?: readonly EventAssignmentRecord[]
}

export function resolveEffectiveEventPermissions(
  ctx: EventPermissionContext
): Set<CanonicalClubPermission> {
  const effective = new Set<CanonicalClubPermission>()

  if (ctx.isMemberActive === false) return effective
  if (!ctx.clubRole || !isValidClubRole(ctx.clubRole)) return effective
  if (!ctx.clubId || !ctx.eventClubId || ctx.clubId !== ctx.eventClubId) return effective

  for (const perm of ROLE_PERMISSIONS[ctx.clubRole]) {
    effective.add(perm)
  }

  if (ctx.eventId && ctx.eventAssignments && ctx.eventAssignments.length > 0) {
    for (const assignment of ctx.eventAssignments) {
      if (assignment.event_id !== ctx.eventId) continue
      if (assignment.club_id !== ctx.clubId) continue
      if (ctx.userId && assignment.user_id !== ctx.userId) continue
      const assignedPerms = EVENT_ASSIGNMENT_PERMISSIONS[assignment.role]
      if (!assignedPerms) continue
      for (const perm of assignedPerms) {
        effective.add(perm)
      }
    }
  }

  return effective
}

export function hasEventPermission(
  ctx: EventPermissionContext & { permission: ClubPermission }
): boolean {
  const canonical = normalizeClubPermission(ctx.permission)
  if (!canonical) return false
  return resolveEffectiveEventPermissions(ctx).has(canonical)
}

export function hasAnyEventPermission(
  ctx: EventPermissionContext & { permissions: readonly ClubPermission[] }
): boolean {
  if (!ctx.permissions.length) return false
  const resolved = resolveEffectiveEventPermissions(ctx)
  return ctx.permissions.some((perm) => {
    const canonical = normalizeClubPermission(perm)
    return canonical ? resolved.has(canonical) : false
  })
}

// ── Consistent Club ID Resolution ────────────────────────────────────────────

export function resolveClubId(params: {
  explicitClubId?: string | null
  activeClubId?: string | null
  eventClubId?: string | null
  profileClubId?: string | null
}): string | null {
  return (
    params.explicitClubId ||
    params.eventClubId ||
    params.activeClubId ||
    params.profileClubId ||
    null
  )
}
