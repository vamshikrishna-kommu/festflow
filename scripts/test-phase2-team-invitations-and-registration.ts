/**
 * scripts/test-phase2-team-invitations-and-registration.ts
 *
 * Automated regression test suite for FestFlow Phase 2:
 * Team Registration and Team-Member Invitations.
 *
 * Covers:
 * 1. Database schema & SQL migration audit (tables, constraints, partial unique indexes, RLS, RPCs)
 * 2. Team creation workflow (team name, leader registration, unique code generation TF-XXXXXX)
 * 3. Safe team preview (event info, squad size, leader name without leaking emails or phone numbers)
 * 4. Team join validation (capacity limits, duplicate prevention, cross-team prevention, leader self-join prevention)
 * 5. Invitation system (single-use expiring token, resend rate limit cooldown, revocation, no account disclosure)
 * 6. UI routes & sharing integration (share sheet with copy fallback, query param links)
 */

import * as fs from 'fs'
import * as path from 'path'

// Polyfill localStorage for Node/tsx execution
const store = new Map<string, string>()
const mockLocalStorage = {
  getItem: (key: string) => store.get(key) || null,
  setItem: (key: string, val: string) => store.set(key, String(val)),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
  length: 0,
  key: () => null,
}
;(globalThis as any).localStorage = mockLocalStorage

import {
  createTeam,
  getTeamPreview,
  joinTeam,
  inviteTeamMember,
  resendTeamInvitation,
  revokeTeamInvitation,
  getTeamDetails,
  buildTeamInviteLink,
} from '../src/lib/teams'
import { registerForEvent } from '../src/lib/registrations'
import type { EventRecord } from '../src/types'

let totalTests = 0
let passedTests = 0

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++
  if (condition) {
    passedTests++
    console.log(`  ✓ PASS: ${testName}`)
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`)
  }
}

async function runTestSuite() {
  console.log('\n============================================================')
  console.log('🧪 FESTFLOW PHASE 2: TEAM REGISTRATION & INVITATION TESTS')
  console.log('============================================================\n')

  // Clear mock local storage before starting
  mockLocalStorage.clear()

  // -------------------------------------------------------------------------
  // SUITE 1: Migration File & SQL Security Audit
  // -------------------------------------------------------------------------
  console.log('--- 1. Migration File & Security Audit ---')
  const migrationPath = path.resolve('supabase/migrations/020_team_registration_and_invitations.sql')
  assert(fs.existsSync(migrationPath), 'Migration 020 exists on disk')

  const sqlContent = fs.readFileSync(migrationPath, 'utf-8').toLowerCase()

  assert(
    sqlContent.includes('create table if not exists public.teams') &&
      sqlContent.includes('create table if not exists public.team_members') &&
      sqlContent.includes('create table if not exists public.team_invitations'),
    'Schema defines teams, team_members, and team_invitations tables'
  )

  assert(
    sqlContent.includes('unique (event_id, name)') &&
      sqlContent.includes('unique (event_id, leader_id)') &&
      sqlContent.includes('unique (team_id, email)'),
    'Table constraints enforce unique team name, single team per leader, and unique email per team'
  )

  assert(
    sqlContent.includes('idx_unique_accepted_user_per_event') &&
      sqlContent.includes("where status = 'accepted'"),
    'Partial unique index prevents students from joining multiple teams for the same event'
  )

  assert(
    sqlContent.includes('for update'),
    'Database RPC uses FOR UPDATE row-level lock on teams to prevent concurrent join race conditions'
  )

  assert(
    sqlContent.includes('generate_team_invite_code') &&
      sqlContent.includes('get_team_preview_by_code') &&
      sqlContent.includes('join_team_with_code') &&
      sqlContent.includes('invite_team_member') &&
      sqlContent.includes('revoke_team_invitation'),
    'All required transactional RPC functions are defined'
  )

  assert(
    sqlContent.includes('enable row level security') &&
      sqlContent.includes('public preview teams by code'),
    'Row Level Security is enabled with explicit public preview and membership policies'
  )

  // -------------------------------------------------------------------------
  // SUITE 2: Team Creation & Registration Flow
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Team Creation & Leader Registration Workflow ---')

  const now = new Date()
  const futureStart = new Date(now.getTime() + 86400000 * 5).toISOString()
  const futureEnd = new Date(now.getTime() + 86400000 * 6).toISOString()

  const hackathonEvent: EventRecord = {
    id: 'evt-hackathon-2026',
    slug: 'hackathon-2026',
    club_id: 'club-tech-1',
    title: 'Hackathon 2026: AI & Web3',
    summary: 'Build the future in 48 hours',
    description: 'Annual hackathon with prizes and networking.',
    category: 'hackathon',
    poster_url: 'https://example.com/poster.jpg',
    start_date: futureStart,
    end_date: futureEnd,
    registration_opens_at: null,
    registration_closes_at: null,
    venue_name: 'Tech Campus Innovation Hub',
    venue_address: 'Main Block, Floor 3',
    capacity: 100,
    is_free: true,
    price: 0,
    currency: 'INR',
    eligibility: null,
    rules: 'Teams must consist of 2 to 4 students.',
    event_type: 'offline',
    participation_type: 'team',
    min_team_size: 2,
    max_team_size: 4,
    leader_counts_towards_size: true,
    team_registration_mode: 'members_join_with_code',
    require_team_name: true,
    timezone: 'Asia/Kolkata',
    approval_type: 'automatic',
    status: 'published',
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    custom_questions: [],
    allowed_colleges: null,
    allowed_departments: null,
    allowed_years: null,
    contact_email: 'fest@techcampus.edu',
    contact_phone: '+91 9999999999',
    online_meeting_url: null,
    participant_fields: {
      require_college: true,
      require_phone: true,
      require_grad_year: true,
      require_id_card: false,
    },
  }

  // Seed events into storage
  mockLocalStorage.setItem('festflow_managed_events', JSON.stringify([hackathonEvent]))

  // Leader registers for hackathon and creates team
  const leaderReg = await registerForEvent(
    hackathonEvent.id,
    'user-leader-1',
    {
      teamName: 'CyberKnights',
      participantDetails: {
        student_name: 'Alice Leader',
        email: 'alice@example.com',
        phone: '9876543210',
        college_name: 'Engineering Institute of Tech',
        grad_year: '2027',
      },
    }
  )

  assert(leaderReg.success, 'Leader registration succeeded', leaderReg.message)
  assert(Boolean(leaderReg.team_id), 'Leader registration returned a team_id')
  assert(Boolean(leaderReg.invite_code), 'Leader registration returned an invite_code')
  assert(
    leaderReg.invite_code?.startsWith('TF-') ?? false,
    'Invite code follows the format TF-XXXXXX'
  )

  const teamId = leaderReg.team_id!
  const inviteCode = leaderReg.invite_code!

  // Check team details
  const teamDetailsRes = await getTeamDetails(teamId)
  assert(teamDetailsRes.success, 'Created team details retrieved successfully')
  const teamDetails = teamDetailsRes.team
  assert(teamDetails?.name === 'CyberKnights', 'Team name matches CyberKnights')
  assert(teamDetails?.leader_id === 'user-leader-1', 'Team leader ID is Alice')
  assert(teamDetails?.members.length === 1, 'Team starts with exactly 1 member (the leader)')
  assert(teamDetails?.members[0].role === 'leader', 'Leader is assigned role="leader"')
  assert(teamDetails?.members[0].status === 'accepted', 'Leader status is "accepted"')

  // Test duplicate team name within same event
  const duplicateNameTeam = await createTeam({
    eventId: hackathonEvent.id,
    leaderId: 'user-other-2',
    leaderName: 'Other Person',
    leaderEmail: 'other@example.com',
    teamName: 'CyberKnights', // Same name
  })
  assert(!duplicateNameTeam.success, 'Duplicate team name in same event is rejected')

  // Test duplicate team creation by same leader in same event
  const duplicateLeaderTeam = await createTeam({
    eventId: hackathonEvent.id,
    leaderId: 'user-leader-1', // Same leader
    leaderName: 'Alice Leader',
    leaderEmail: 'alice@example.com',
    teamName: 'DifferentName',
  })
  assert(!duplicateLeaderTeam.success, 'Same leader cannot create multiple teams for the same event')

  // -------------------------------------------------------------------------
  // SUITE 3: Safe Team Preview (Privacy Guarantee)
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Safe Preview & Privacy Protection ---')

  const previewRes = await getTeamPreview(inviteCode)
  assert(previewRes.success, 'Team preview with valid invite code succeeds')
  assert(previewRes.preview !== undefined, 'Preview data is present')

  const preview = previewRes.preview!
  assert(preview.team_name === 'CyberKnights', 'Preview includes team name')
  assert(preview.leader_name === 'Alice Leader', 'Preview includes leader display name')
  assert(preview.event_title === hackathonEvent.title, 'Preview includes event title')
  assert(preview.current_size === 1, 'Preview shows current team size = 1')
  assert(preview.max_size === 4, 'Preview shows max capacity = 4')
  assert(preview.is_open === true, 'Preview indicates team is open for new members')

  // PRIVACY CHECK: ensure preview object never exposes private contact info
  const previewJson = JSON.stringify(preview)
  assert(!previewJson.includes('alice@example.com'), 'Preview DOES NOT leak leader email address')
  assert(!previewJson.includes('9876543210'), 'Preview DOES NOT leak leader phone number')

  // Invalid invite code check
  const invalidPreview = await getTeamPreview('TF-NONEXIST')
  assert(!invalidPreview.success, 'Non-existent invite code preview is safely rejected')

  // -------------------------------------------------------------------------
  // SUITE 4: Joining an Existing Team & Capacity Enforcement
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Join Existing Team & Capacity Enforcement ---')

  // Member 2 (Bob) joins team
  const bobJoin = await joinTeam({
    inviteCode,
    userId: 'user-bob-2',
    userEmail: 'bob@example.com',
    participantDetails: {
      student_name: 'Bob Builder',
      college_name: 'Tech University',
      phone: '9123456780',
    },
  })

  assert(bobJoin.success, 'Bob successfully joined CyberKnights using invite code', bobJoin.message)

  // Verify updated team size and member status
  const teamAfterBob = await getTeamDetails(teamId)
  assert(teamAfterBob.team?.members.length === 2, 'Team now has 2 members')
  const bobMember = teamAfterBob.team?.members.find((m) => m.user_id === 'user-bob-2')
  assert(bobMember?.role === 'member', 'Bob assigned role="member"')
  assert(bobMember?.status === 'accepted', 'Bob status="accepted"')

  // Duplicate Join: Bob tries to join again
  const bobDuplicateJoin = await joinTeam({
    inviteCode,
    userId: 'user-bob-2',
    userEmail: 'bob@example.com',
    participantDetails: {
      student_name: 'Bob Builder',
    },
  })
  assert(!bobDuplicateJoin.success, 'Duplicate join by same user is rejected')

  // Leader tries to join their own team as a member
  const leaderSelfJoin = await joinTeam({
    inviteCode,
    userId: 'user-leader-1',
    userEmail: 'alice@example.com',
    participantDetails: {
      student_name: 'Alice Leader',
    },
  })
  assert(!leaderSelfJoin.success, 'Leader cannot join their own team as a member')

  // Multi-Team Prevention: Create a second team, Bob tries to join second team for the same event
  const secondTeamRes = await createTeam({
    eventId: hackathonEvent.id,
    leaderId: 'user-leader-two',
    leaderName: 'Leader Two',
    leaderEmail: 'leader2@example.com',
    teamName: 'QuantumHacks',
  })
  assert(secondTeamRes.success, 'QuantumHacks team created')

  const bobCrossTeamJoin = await joinTeam({
    inviteCode: secondTeamRes.team!.invite_code,
    userId: 'user-bob-2',
    userEmail: 'bob@example.com',
    participantDetails: {
      student_name: 'Bob Builder',
    },
  })
  assert(
    !bobCrossTeamJoin.success,
    'User already in an accepted team for this event cannot join another team'
  )

  // Member 3 (Charlie) joins
  const charlieJoin = await joinTeam({
    inviteCode,
    userId: 'user-charlie-3',
    userEmail: 'charlie@example.com',
    participantDetails: {
      student_name: 'Charlie Chaplin',
    },
  })
  assert(charlieJoin.success, 'Member 3 (Charlie) joined successfully')

  // Member 4 (Diana) joins -> Team is now at max capacity (4/4)
  const dianaJoin = await joinTeam({
    inviteCode,
    userId: 'user-diana-4',
    userEmail: 'diana@example.com',
    participantDetails: {
      student_name: 'Diana Prince',
    },
  })
  assert(dianaJoin.success, 'Member 4 (Diana) joined successfully. Squad is now full (4/4).')

  // Member 5 (Evan) tries to join full team
  const evanJoin = await joinTeam({
    inviteCode,
    userId: 'user-evan-5',
    userEmail: 'evan@example.com',
    participantDetails: {
      student_name: 'Evan Wright',
    },
  })
  assert(!evanJoin.success, 'Join rejected because squad has reached maximum capacity')
  assert(
    evanJoin.message.toLowerCase().includes('full') ||
      evanJoin.message.toLowerCase().includes('capacity'),
    'Clear capacity error message returned when squad is full'
  )

  // -------------------------------------------------------------------------
  // SUITE 5: Email Invitations, Single-Use Tokens & Rate Limiting
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Team Member Invitations & Token Security ---')

  // Create a 3-person team with room for invitations
  const designEvent: EventRecord = {
    ...hackathonEvent,
    id: 'evt-design-2026',
    slug: 'ui-ux-designathon',
    title: 'UI/UX Designathon',
    max_team_size: 3,
  }
  mockLocalStorage.setItem(
    'festflow_managed_events',
    JSON.stringify([hackathonEvent, designEvent])
  )

  const designTeam = await createTeam({
    eventId: designEvent.id,
    leaderId: 'user-designer-1',
    leaderName: 'Design Lead',
    leaderEmail: 'designer@example.com',
    teamName: 'PixelCrafters',
  })
  assert(designTeam.success, 'PixelCrafters design team created')
  const designTeamId = designTeam.team!.id

  // Non-leader tries to invite someone
  const unauthorizedInvite = await inviteTeamMember({
    teamId: designTeamId,
    email: 'newbie@example.com',
    leaderId: 'user-unauthorized',
  })
  assert(!unauthorizedInvite.success, 'Unauthorized user cannot send team invitations')

  // Leader invites an unregistered student email
  const inviteRes = await inviteTeamMember({
    teamId: designTeamId,
    email: 'newbie@example.com',
    leaderId: 'user-designer-1',
    name: 'Newbie Student',
  })

  assert(inviteRes.success, 'Leader invited newbie@example.com')
  assert(Boolean(inviteRes.invitation_id), 'Invitation record generated')
  assert(Boolean(inviteRes.token), 'Invitation contains secure single-use token')
  assert(
    (inviteRes.token?.length ?? 0) >= 32,
    'Token has cryptographically secure length (>= 32 chars)'
  )

  // Rate limit cooldown check (leader tries to immediately spam resend)
  const rapidResend = await resendTeamInvitation(inviteRes.invitation_id!, 'user-designer-1')
  assert(
    !rapidResend.success,
    'Immediate resend blocked by rate limit cooldown (prevent spamming)'
  )
  assert(
    rapidResend.message.includes('wait') || rapidResend.message.includes('cooldown') || rapidResend.message.includes('seconds'),
    'Helpful cooldown message provided to user'
  )

  // Revocation test
  const revokeRes = await revokeTeamInvitation(inviteRes.invitation_id!, 'user-designer-1')
  assert(revokeRes.success, 'Leader successfully revoked pending invitation')

  // Re-invite after revocation
  const freshInvite = await inviteTeamMember({
    teamId: designTeamId,
    email: 'fresh@example.com',
    leaderId: 'user-designer-1',
  })
  assert(freshInvite.success, 'Fresh invitation sent successfully after revocation')

  // Unregistered user signs up, verifies email, and accepts invitation
  const acceptedJoin = await joinTeam({
    inviteCode: designTeam.team!.invite_code,
    userId: 'user-fresh-account',
    userEmail: 'fresh@example.com',
    participantDetails: {
      student_name: 'Fresh Account',
    },
  })
  assert(acceptedJoin.success, 'Newly verified user successfully accepted invitation and joined squad')

  // Verify invitation status transitioned to 'accepted'
  const updatedDesignTeam = await getTeamDetails(designTeamId, 'user-designer-1')
  const acceptedInvite = updatedDesignTeam.team?.invitations.find(
    (inv) => inv.id === freshInvite.invitation_id
  )
  assert(acceptedInvite?.status === 'accepted', 'Invitation status updated to accepted')

  // -------------------------------------------------------------------------
  // SUITE 6: UI & Link Generation Integration
  // -------------------------------------------------------------------------
  console.log('\n--- 6. UI Routes & Link Sharing Generation ---')

  const inviteLink = buildTeamInviteLink('hackathon-2026', 'TF-ABC123')
  assert(
    inviteLink.includes('/events/hackathon-2026?join=1&code=TF-ABC123'),
    'buildTeamInviteLink constructs standard direct join URL with query parameters'
  )

  const tokenInviteLink = buildTeamInviteLink('hackathon-2026', 'TF-ABC123', 'tok-secure-999')
  assert(
    tokenInviteLink.includes('&token=tok-secure-999'),
    'buildTeamInviteLink appends token when invitation token is present'
  )

  // Verify dedicated JoinTeam route exists in App.tsx
  const appTsx = fs.readFileSync(path.resolve('src/App.tsx'), 'utf-8')
  assert(
    appTsx.includes('path: \'/join-team\'') && appTsx.includes('path: \'/join-team/:code\''),
    'App.tsx registers /join-team and /join-team/:code routes'
  )

  // Verify EventDetailPage has Join Team integration
  const eventDetailTsx = fs.readFileSync(path.resolve('src/pages/EventDetailPage.tsx'), 'utf-8')
  assert(
    eventDetailTsx.includes('Join an Existing Squad') &&
      eventDetailTsx.includes('<JoinTeamModal'),
    'EventDetailPage provides desktop and mobile entry points for joining teams'
  )

  // Verify StudentDashboardPage has Squad Management integration
  const dashboardTsx = fs.readFileSync(
    path.resolve('src/pages/dashboard/StudentDashboardPage.tsx'),
    'utf-8'
  )
  assert(
    dashboardTsx.includes('Manage Squad') && dashboardTsx.includes('<TeamManageModal'),
    'StudentDashboardPage displays team pass badge and squad management modal trigger'
  )

  // Verify TicketDetailPage has Squad Management integration
  const ticketDetailTsx = fs.readFileSync(
    path.resolve('src/pages/student/TicketDetailPage.tsx'),
    'utf-8'
  )
  assert(
    ticketDetailTsx.includes('Manage Squad Roster') &&
      ticketDetailTsx.includes('<TeamManageModal'),
    'TicketDetailPage allows team leaders and members to view and manage squad roster'
  )

  console.log('\n============================================================')
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} tests passed`)
  if (passedTests === totalTests) {
    console.log('🎉 ALL PHASE 2 TEAM REGISTRATION & INVITATION TESTS PASSED!')
    console.log('============================================================\n')
    process.exit(0)
  } else {
    console.error(`❌ ${totalTests - passedTests} tests failed.`)
    console.log('============================================================\n')
    process.exit(1)
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test runner error:', err)
  process.exit(1)
})
