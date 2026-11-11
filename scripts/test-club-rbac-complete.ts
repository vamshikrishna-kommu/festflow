/**
 * FestFlow Complete Club RBAC Repair Regression Test Suite
 *
 * Verifies the end-to-end Club Role-Based Access Control repair:
 * 1. Canonical 19-permission x 6-role matrix & legacy alias compatibility (gate_checkin retired)
 * 2. Strict role hierarchy & assignment/management guards (owner > admin > event_manager > payment_reviewer > checkin_staff > viewer)
 * 3. Per-event event_assignments expansion, event/club isolation, & inactive-member fail-closed behavior
 * 4. Service-layer lifecycle (anti-spoofing inviterRole, inactive rejection, role update, sole owner guard, ownership transfer)
 * 5. Workspace switching & unauthorized route/club fallback guarantees
 * 6. Static security & contract checks across SQL migration 053, send-email Edge Function, AuthContext, ProtectedRoute, and Club pages
 */

import fs from 'node:fs'
import path from 'node:path'

const memoryStore = new Map<string, string>()
const mockLocalStorage = {
  getItem: (k: string) => memoryStore.get(k) ?? null,
  setItem: (k: string, v: string) => {
    memoryStore.set(k, String(v))
  },
  removeItem: (k: string) => {
    memoryStore.delete(k)
  },
  clear: () => {
    memoryStore.clear()
  },
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).localStorage = mockLocalStorage

import {
  CANONICAL_CLUB_PERMISSIONS,
  ASSIGNABLE_CLUB_ROLES,
  ASSIGNABLE_EVENT_ASSIGNMENT_ROLES,
  ROLE_RANK,
  EVENT_ASSIGNMENT_PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getAssignableRoles,
  canManageMember,
  canTransferOwnership,
  resolveEffectiveEventPermissions,
  hasEventPermission,
} from '../src/lib/rbac.js'
import {
  getUserClubRole,
  getClubMembers,
  inviteClubMember,
  acceptClubInvitation,
  updateClubMemberRole,
  removeClubMember,
  transferClubOwnership,
} from '../src/lib/clubMembers.js'
import {
  assignMemberToEvent,
  getEventAssignments,
  removeEventAssignment,
} from '../src/lib/eventAssignments.js'
import {
  canAccessStudentWorkspace,
  canAccessClubWorkspace,
  isDualWorkspaceEligible,
  getWorkspaceFromPath,
} from '../src/lib/workspace.js'
import { isPathAllowedForRole, getSafeReturnUrl } from '../src/lib/safeNavigation.js'
import type {
  ClubRole,
  ClubMemberRecord,
  EventAssignmentRecord,
} from '../src/types/index.js'

let total = 0
let passed = 0
let failed = 0

function assert(condition: boolean, name: string, detail?: string) {
  total++
  if (condition) {
    passed++
    console.log(`  PASS: ${name}`)
  } else {
    failed++
    console.error(`  FAIL: ${name}${detail ? ` -> ${detail}` : ''}`)
  }
}

async function main() {
  console.log('\n======================================================================')
  console.log('   FESTFLOW: COMPLETE CLUB RBAC REPAIR VERIFICATION SUITE')
  console.log('======================================================================\n')

  mockLocalStorage.clear()

  // ── 1. Canonical 19-Permission Matrix, Legacy Aliases & Fail-Closed ───────
  console.log('1. Canonical 19-Permission Matrix & Legacy Compatibility')
  assert(
    CANONICAL_CLUB_PERMISSIONS.length === 19,
    'Canonical permission registry defines all 19 permissions'
  )
  assert(
    CANONICAL_CLUB_PERMISSIONS.every((p) => Boolean(PERMISSION_DESCRIPTIONS[p])),
    'All 19 canonical permissions have human-readable descriptions'
  )

  for (const perm of CANONICAL_CLUB_PERMISSIONS) {
    assert(hasPermission('owner', perm), `Owner holds ${perm}`)
    if (perm === 'club.transfer_ownership') {
      assert(!hasPermission('admin', perm), 'Admin does NOT hold club.transfer_ownership')
    } else {
      assert(hasPermission('admin', perm), `Admin holds ${perm}`)
    }
  }

  // Retired gate_checkin permission must fail closed across all roles
  const allRoles: ClubRole[] = [
    'owner',
    'admin',
    'event_manager',
    'payment_reviewer',
    'checkin_staff',
    'viewer',
  ]
  for (const role of allRoles) {
    assert(!hasPermission(role, 'gate_checkin'), `Retired gate_checkin denied for ${role}`)
  }
  assert(!hasPermission(null, 'club.view'), 'Null role fails closed for club.view')
  assert(!hasPermission(undefined, 'events.view'), 'Undefined role fails closed for events.view')

  // Specific role boundaries
  assert(
    hasAllPermissions('event_manager', [
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
    ]),
    'event_manager grants expected operational & event publishing permissions'
  )
  assert(
    !hasAnyPermission('event_manager', [
      'payments.view',
      'payments.verify',
      'payments.settings',
      'members.view',
      'members.invite',
      'members.manage',
      'roles.assign',
      'club.manage',
      'club.transfer_ownership',
    ]),
    'event_manager denied payments, members, roles.assign, and club management'
  )

  assert(
    hasAllPermissions('payment_reviewer', [
      'club.view',
      'events.view',
      'payments.view',
      'payments.verify',
      'reports.view',
      'reports.export',
    ]),
    'payment_reviewer grants finance verification & reporting permissions'
  )
  assert(
    !hasAnyPermission('payment_reviewer', [
      'payments.settings',
      'events.create',
      'events.edit',
      'registrations.view',
      'registrations.manage',
      'club.manage',
    ]),
    'payment_reviewer denied payments.settings, events, registrations, and club.manage'
  )

  assert(
    hasAllPermissions('viewer', ['club.view', 'events.view', 'registrations.view', 'reports.view']) &&
      !hasAnyPermission('viewer', ['reports.export', 'events.edit', 'registrations.manage', 'payments.view', 'members.invite']),
    'viewer is strictly read-only without export, mutation, or payment access'
  )

  // Legacy aliases map cleanly
  assert(hasPermission('owner', 'manage_club') && !hasPermission('admin', 'club.transfer_ownership'), 'manage_club maps to club.manage')
  assert(hasPermission('admin', 'manage_members') && !hasPermission('event_manager', 'manage_members'), 'manage_members maps to members.manage')
  assert(hasPermission('event_manager', 'manage_events'), 'manage_events maps to events.edit')
  assert(hasPermission('viewer', 'view_attendees') && !hasPermission('payment_reviewer', 'view_attendees'), 'view_attendees maps to registrations.view')
  assert(hasPermission('payment_reviewer', 'review_payments') && !hasPermission('event_manager', 'review_payments'), 'review_payments maps to payments.verify')
  assert(hasPermission('viewer', 'view_reports'), 'view_reports maps to reports.view')

  // ── 2. Hierarchy, Assignable Roles, and Management Guards ────────────────
  console.log('\n2. Strict Role Hierarchy & Management Guards')
  assert(
    ROLE_RANK.owner > ROLE_RANK.admin &&
      ROLE_RANK.admin > ROLE_RANK.event_manager &&
      ROLE_RANK.event_manager > ROLE_RANK.payment_reviewer &&
      ROLE_RANK.payment_reviewer > ROLE_RANK.checkin_staff &&
      ROLE_RANK.checkin_staff > ROLE_RANK.viewer,
    'Strict rank ordering owner > admin > event_manager > payment_reviewer > checkin_staff > viewer'
  )
  assert(!ASSIGNABLE_CLUB_ROLES.includes('checkin_staff' as any), 'checkin_staff excluded from assignable club roles')
  assert(!ASSIGNABLE_EVENT_ASSIGNMENT_ROLES.includes('checkin_staff' as any), 'checkin_staff excluded from assignable event roles')

  assert(
    JSON.stringify(getAssignableRoles('owner')) ===
      JSON.stringify(['admin', 'event_manager', 'payment_reviewer', 'viewer']),
    'Owner assignable roles are [admin, event_manager, payment_reviewer, viewer]'
  )
  assert(
    JSON.stringify(getAssignableRoles('admin')) ===
      JSON.stringify(['event_manager', 'payment_reviewer', 'viewer']),
    'Admin assignable roles are strictly below admin [event_manager, payment_reviewer, viewer]'
  )
  assert(getAssignableRoles('event_manager').length === 0, 'event_manager cannot assign any roles')
  assert(getAssignableRoles(null).length === 0, 'null role cannot assign any roles')

  assert(canTransferOwnership('owner') === true, 'Owner can transfer ownership')
  assert(canTransferOwnership('admin') === false, 'Admin cannot transfer ownership')
  assert(canTransferOwnership('event_manager') === false, 'Event Manager cannot transfer ownership')

  const ownerTarget = { user_id: 'u_owner', role: 'owner' as ClubRole }
  const adminTarget = { user_id: 'u_admin_2', role: 'admin' as ClubRole }
  const emTarget = { user_id: 'u_em', role: 'event_manager' as ClubRole }

  assert(canManageMember('owner', 'u_owner_actor', adminTarget, 'event_manager'), 'Owner can manage/demote Admin')
  assert(!canManageMember('admin', 'u_admin_actor', ownerTarget), 'Admin cannot manage Owner')
  assert(!canManageMember('admin', 'u_admin_actor', adminTarget), 'Admin cannot manage peer Admin')
  assert(!canManageMember('admin', 'u_admin_actor', emTarget, 'admin'), 'Admin cannot promote lower member to Admin')
  assert(canManageMember('admin', 'u_admin_actor', emTarget, 'payment_reviewer'), 'Admin can adjust lower member below Admin')
  assert(
    !canManageMember('admin', 'u_admin_2', adminTarget) &&
      !canManageMember('event_manager', 'u_em_actor', { user_id: 'u_other', role: 'viewer' }),
    'Event Manager manages nobody; self cannot be managed when user_id matches'
  )

  // ── 3. Per-Event Assignment Scoping & Isolation ──────────────────────────
  console.log('\n3. Per-Event Assignment Scoping & Cross-Club Isolation')
  const assignments: EventAssignmentRecord[] = [
    {
      id: 'asg_1',
      event_id: 'evt_a',
      club_id: 'club_1',
      user_id: 'u_viewer',
      role: 'event_manager',
      assigned_by: 'u_owner',
      created_at: new Date().toISOString(),
    },
    {
      id: 'asg_2',
      event_id: 'evt_a',
      club_id: 'club_2',
      user_id: 'u_viewer',
      role: 'finance_manager',
      assigned_by: 'u_owner_2',
      created_at: new Date().toISOString(),
    },
  ]

  // Viewer assigned event_manager on (club_1, evt_a)
  assert(
    hasEventPermission({
      clubRole: 'viewer',
      clubId: 'club_1',
      eventClubId: 'club_1',
      eventId: 'evt_a',
      userId: 'u_viewer',
      isMemberActive: true,
      eventAssignments: assignments,
      permission: 'events.edit',
    }),
    'Viewer with event_manager assignment gains events.edit on assigned event evt_a'
  )
  assert(
    !hasEventPermission({
      clubRole: 'viewer',
      clubId: 'club_1',
      eventClubId: 'club_1',
      eventId: 'evt_a',
      userId: 'u_viewer',
      isMemberActive: true,
      eventAssignments: assignments,
      permission: 'payments.verify',
    }),
    'event_manager assignment on evt_a does NOT grant payments.verify (and club_2 finance_manager assignment does NOT bleed into club_1)'
  )
  assert(
    !hasEventPermission({
      clubRole: 'viewer',
      clubId: 'club_1',
      eventClubId: 'club_1',
      eventId: 'evt_b',
      userId: 'u_viewer',
      isMemberActive: true,
      eventAssignments: assignments,
      permission: 'events.edit',
    }),
    'Viewer with evt_a assignment has NO events.edit on unassigned event evt_b'
  )
  assert(
    resolveEffectiveEventPermissions({
      clubRole: 'viewer',
      clubId: 'club_1',
      eventClubId: 'club_1',
      eventId: 'evt_a',
      userId: 'u_viewer',
      isMemberActive: false,
      eventAssignments: assignments,
    }).size === 0,
    'Inactive/suspended member gets ZERO effective permissions even with active event assignments'
  )
  assert(
    resolveEffectiveEventPermissions({
      clubRole: null,
      clubId: 'club_1',
      eventClubId: 'club_1',
      eventId: 'evt_a',
      userId: 'u_viewer',
      isMemberActive: true,
      eventAssignments: assignments,
    }).size === 0,
    'User with null club role gets ZERO effective permissions'
  )
  assert(
    EVENT_ASSIGNMENT_PERMISSIONS.finance_manager.includes('payments.verify') &&
      !EVENT_ASSIGNMENT_PERMISSIONS.finance_manager.includes('events.edit'),
    'finance_manager assignment grants payments.verify without granting events.edit'
  )

  const rejectedRetiredAsg = await assignMemberToEvent({
    eventId: 'evt_a',
    clubId: 'club_1',
    userId: 'u_viewer',
    role: 'checkin_staff',
    assignedBy: 'u_owner',
  })
  assert(Boolean(rejectedRetiredAsg.error), 'assignMemberToEvent rejects retired checkin_staff role')

  const createdAsg = await assignMemberToEvent({
    eventId: 'evt_a',
    clubId: 'club_1',
    userId: 'u_viewer',
    role: 'registration_manager',
    assignedBy: 'u_owner',
  })
  assert(Boolean(createdAsg.assignment), 'assignMemberToEvent creates valid registration_manager delegation')
  const fetchedAsg = await getEventAssignments('evt_a')
  assert(fetchedAsg.assignments.length === 1, 'getEventAssignments returns created delegation')
  const removedAsg = await removeEventAssignment(createdAsg.assignment!.id, 'club_1')
  assert(removedAsg.success, 'removeEventAssignment cleanly removes delegation')

  // ── 4. Service Lifecycle: Anti-Spoofing, Active Check, Hierarchy, Transfer ─
  console.log('\n4. Membership Service Anti-Spoofing & Lifecycle')
  const clubId = 'club_rbac_test_1'
  const seedMembers: ClubMemberRecord[] = [
    {
      id: 'mem_owner',
      club_id: clubId,
      user_id: 'u_owner',
      role: 'owner',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profile: {
        id: 'u_owner',
        email: 'owner@club.edu',
        display_name: 'Club Owner',
        role: 'club_admin',
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
    {
      id: 'mem_admin',
      club_id: clubId,
      user_id: 'u_admin',
      role: 'admin',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profile: {
        id: 'u_admin',
        email: 'admin@club.edu',
        display_name: 'Club Admin',
        role: 'student',
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    },
    {
      id: 'mem_revoked',
      club_id: clubId,
      user_id: 'u_revoked',
      role: 'admin',
      status: 'revoked',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]
  mockLocalStorage.setItem('festflow_local_club_members', JSON.stringify(seedMembers))

  // Revoked member fails closed
  assert((await getUserClubRole(clubId, 'u_revoked')) === null, 'Revoked club member resolves to null role')
  assert((await getClubMembers(clubId)).members.length === 2, 'getClubMembers excludes non-active/revoked members')

  // Spoofed inviterRole='owner' by non-owner / revoked user is blocked
  const spoofInvite = await inviteClubMember({
    clubId,
    email: 'evil@club.edu',
    role: 'event_manager',
    inviterId: 'u_revoked',
    inviterRole: 'owner', // attempted spoof!
    clubName: 'RBAC Club',
  })
  assert(!spoofInvite.success, 'Revoked actor spoofing inviterRole="owner" is blocked')

  // Admin cannot invite peer Admin
  const peerAdminInvite = await inviteClubMember({
    clubId,
    email: 'peeradmin@club.edu',
    role: 'admin',
    inviterId: 'u_admin',
    inviterRole: 'admin',
    clubName: 'RBAC Club',
  })
  assert(!peerAdminInvite.success && peerAdminInvite.error_code === 'ROLE_ESCALATION_DENIED', 'Admin cannot invite peer Admin')

  // Owner invites event_manager -> accepted -> promoted/demoted -> transferred
  const validInvite = await inviteClubMember({
    clubId,
    email: 'maya@club.edu',
    role: 'event_manager',
    inviterId: 'u_owner',
    inviterRole: 'owner',
    clubName: 'RBAC Club',
  })
  assert(validInvite.success && Boolean(validInvite.invitation?.token), 'Owner invites event_manager cleanly')

  const mayaAccept = await acceptClubInvitation(validInvite.invitation!.token, {
    id: 'u_maya',
    email: 'maya@club.edu',
    display_name: 'Maya',
  })
  assert(mayaAccept.success && mayaAccept.role === 'event_manager', 'Maya joins as active event_manager')

  const mayaMember = (await getClubMembers(clubId)).members.find((m) => m.user_id === 'u_maya')!
  const adminSelfPromote = await updateClubMemberRole('mem_admin', 'owner', 'u_admin', clubId)
  assert(!adminSelfPromote.success, 'Admin cannot promote self to owner')

  const adminPromoteToAdmin = await updateClubMemberRole(mayaMember.id, 'admin', 'u_admin', clubId)
  assert(!adminPromoteToAdmin.success, 'Admin cannot promote Maya to Admin')

  const ownerPromoteToAdmin = await updateClubMemberRole(mayaMember.id, 'admin', 'u_owner', clubId)
  assert(ownerPromoteToAdmin.success, 'Owner can promote Maya to Admin')

  const adminTransferAttempt = await transferClubOwnership(clubId, 'u_maya', 'u_admin')
  assert(!adminTransferAttempt.success, 'Non-owner Admin cannot transfer ownership')

  const ownerTransfer = await transferClubOwnership(clubId, 'u_maya', 'u_owner')
  assert(ownerTransfer.success, 'Owner transfers ownership to Maya')
  assert((await getUserClubRole(clubId, 'u_maya')) === 'owner', 'Maya is now Owner')
  assert((await getUserClubRole(clubId, 'u_owner')) === 'admin', 'Previous owner safely demoted to Admin')

  const oldOwnerRemoveAttempt = await removeClubMember(mayaMember.id, 'u_owner', clubId)
  assert(!oldOwnerRemoveAttempt.success && oldOwnerRemoveAttempt.error_code === 'CANNOT_REMOVE_SOLE_OWNER', 'Sole new owner cannot be removed')

  // ── 5. Workspace & Navigation Guards ─────────────────────────────────────
  console.log('\n5. Workspace & Navigation Guards')
  assert(!canAccessClubWorkspace('student', null, []), 'Student without club membership denied Club Workspace')
  assert(
    canAccessClubWorkspace('student', null, [
      { id: '1', club_id: clubId, user_id: 'u_maya', role: 'viewer', status: 'pending', created_at: '', updated_at: '' },
    ]) === false,
    'Pending membership does NOT unlock Club Workspace'
  )
  assert(
    canAccessStudentWorkspace('student') &&
      isDualWorkspaceEligible('student', null, [
        { id: '1', club_id: clubId, user_id: 'u_maya', role: 'viewer', status: 'active', created_at: '', updated_at: '' },
      ]),
    'Active membership unlocks dual workspace for student'
  )
  assert(getWorkspaceFromPath('/club/invitations/abc') === null, 'Public invitation link does not trigger Club Workspace context')
  assert(getWorkspaceFromPath('/club/events') === 'club', '/club/events resolves to club workspace')
  assert(!isPathAllowedForRole('/club/payments', 'student', false), 'Student without club access blocked from /club/payments')
  assert(getSafeReturnUrl('/club/payments', 'student', undefined, false) === '/student/dashboard', 'Safe return URL falls back cleanly when unauthorized')

  // ── 6. SQL Migration 053, Edge Function, & Fail-Closed UI Contracts ──────
  console.log('\n6. SQL Migration 053 & Source Security Contracts')
  const root = process.cwd()
  const sql053 = fs.readFileSync(path.join(root, 'supabase/migrations/053_complete_club_rbac_repair.sql'), 'utf-8')
  const sendEmailTs = fs.readFileSync(path.join(root, 'supabase/functions/send-email/index.ts'), 'utf-8')
  const authCtxTs = fs.readFileSync(path.join(root, 'src/context/AuthContext.tsx'), 'utf-8')
  const protectedTsx = fs.readFileSync(path.join(root, 'src/components/auth/ProtectedRoute.tsx'), 'utf-8')
  const membersPageTsx = fs.readFileSync(path.join(root, 'src/pages/club/ClubMembersPage.tsx'), 'utf-8')
  const acceptPageTsx = fs.readFileSync(path.join(root, 'src/pages/club/AcceptClubInvitationPage.tsx'), 'utf-8')

  assert(
    sql053.includes('CREATE OR REPLACE FUNCTION public.has_club_permission') &&
      sql053.includes('CREATE OR REPLACE FUNCTION public.has_event_permission') &&
      sql053.includes('CREATE OR REPLACE FUNCTION public.validate_event_assignment_integrity') &&
      sql053.includes('CREATE OR REPLACE FUNCTION public.permission_matches_event_assignment_role') &&
      sql053.includes('CREATE OR REPLACE FUNCTION public.transfer_club_ownership'),
    'Migration 053 defines canonical RBAC, delegation integrity, & ownership RPC functions'
  )
  assert(
    sql053.includes('gen_random_bytes(32)') && sql053.includes("'FFQ_'"),
    'Migration 053 preserves 256-bit (32-byte) FFQ_ QR token generation'
  )
  assert(
    sql053.includes('supabase_realtime') && sql053.includes('event_assignments'),
    'Migration 053 enables realtime propagation on club RBAC tables'
  )
  assert(
    sendEmailTs.includes('status: 503') && sendEmailTs.includes('checkin_staff: new Set()'),
    'send-email Edge Function fails closed (503) without service key and grants zero perms to checkin_staff'
  )
  assert(
    !authCtxTs.includes('user.user_metadata?.role as UserRole'),
    'AuthContext does NOT trust mutable user_metadata.role for authorization'
  )
  assert(
    protectedTsx.includes('isRoleLoading') && protectedTsx.includes('requiredClubPermission'),
    'ProtectedRoute waits on isRoleLoading and enforces requiredClubPermission'
  )
  assert(
    !membersPageTsx.includes("ROLE_LABELS[userRole || 'owner']") &&
      membersPageTsx.includes('transferClubOwnership') &&
      membersPageTsx.includes('ASSIGNABLE_CLUB_ROLES'),
    'ClubMembersPage removes owner fallback, enforces hierarchy, and supports ownership transfer'
  )
  assert(
    !acceptPageTsx.includes("gate_checkin:") && acceptPageTsx.includes('PERMISSION_DESCRIPTIONS'),
    'AcceptClubInvitationPage renders canonical PERMISSION_DESCRIPTIONS without retired gate_checkin'
  )

  console.log('\n======================================================================')
  console.log(`   COMPLETE RBAC SUITE: ${passed} / ${total} PASSED (${failed} FAILED)`)
  console.log('======================================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Fatal RBAC suite error:', err)
  process.exit(1)
})
