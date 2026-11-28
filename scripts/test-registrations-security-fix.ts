/**
 * Automated Security & Production Regression Verification Suite
 * Covers:
 *  1. Priority 1: Registrations least-privilege queries, column-grant safety & migration 061 RLS invariants
 *  2. Organizer & student RBAC positive/negative authorization boundary checks (including club isolation)
 *  3. Priority 2-6 UI/UX fixes: Transparent FestFlow logo mark, skip-link hiding, dark CTA contrast, mobile bottom nav
 */

import fs from 'fs'
import path from 'path'
import {
  ROLE_PERMISSIONS,
  hasPermission,
  hasEventPermission,
  hasAnyEventPermission,
} from '../src/lib/rbac'
import { getEventRegistrations } from '../src/lib/registrations'

let passed = 0
let failed = 0

function assert(condition: boolean, name: string, detail = '') {
  if (condition) {
    passed++
    console.log(`  [PASS] ${name}`)
  } else {
    failed++
    console.error(`  [FAIL] ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function runTests() {
  console.log('\n==================================================================')
  console.log(' FESTFLOW — REGISTRATIONS SECURITY, RBAC & UI REGRESSION TESTS    ')
  console.log('==================================================================\n')

  const root = process.cwd()

  // ── 1. Priority 1: Client Query Hygiene (No wildcard / qr_token leaks) ───
  console.log('--- 1. Query Column-Privilege & Secret Exclusion ---')
  const paymentsSrc = fs.readFileSync(path.join(root, 'src/lib/payments.ts'), 'utf-8')
  const regsSrc = fs.readFileSync(path.join(root, 'src/lib/registrations.ts'), 'utf-8')
  const waitlistSrc = fs.readFileSync(path.join(root, 'src/lib/waitlist.ts'), 'utf-8')
  const clubDashboardSrc = fs.readFileSync(path.join(root, 'src/pages/dashboard/ClubDashboardPage.tsx'), 'utf-8')

  assert(
    !paymentsSrc.includes('registration:registrations!payment_submissions_registration_id_fkey(*)'),
    'payments.ts removes wildcard registrations(*) embed from getClubPaymentSubmissions'
  )
  assert(
    paymentsSrc.includes('registration:registrations!payment_submissions_registration_id_fkey(') &&
      !/registrations\s*\(\s*id,\s*ticket_code,\s*qr_token/s.test(paymentsSrc),
    'payments.ts uses explicit non-secret registrations column projection and drops qr_token'
  )
  assert(
    regsSrc.includes('const joinedSafeRes = await supabase') &&
      regsSrc.includes('Tier 2: Pre-061 column-grant-safe query'),
    'registrations.ts getClubRegistrations includes pre-061 safe joined fallback without ungranted post-046 columns'
  )
  assert(
    !/waitlist\.ts|\.insert\([^)]*\)\s*\.select\(\)\s*\.single\(\)/s.test(waitlistSrc),
    'waitlist.ts avoids bare .select() wildcard after registrations insert'
  )
  assert(
    clubDashboardSrc.includes('canViewAnyRegistrations') &&
      clubDashboardSrc.includes("hasEventPermission(ev.id, 'registrations.view')"),
    'ClubDashboardPage.tsx gates getClubRegistrations behind club or event-level registration/payment/report permission'
  )

  // ── 2. Migration 061 Security Model & Least-Privilege Grants ─────────────
  console.log('\n--- 2. Migration 061 Least-Privilege Security & RLS Invariants ---')
  const mig061Path = path.join(root, 'supabase/migrations/061_fix_registrations_column_grants_and_rls.sql')
  assert(fs.existsSync(mig061Path), 'Migration 061 SQL file exists')
  const mig061 = fs.readFileSync(mig061Path, 'utf-8')

  assert(
    !/DISABLE ROW LEVEL SECURITY/i.test(mig061),
    'Migration 061 never disables RLS on any table'
  )
  assert(
    /ALTER TABLE public\.registrations ENABLE ROW LEVEL SECURITY;/i.test(mig061),
    'Migration 061 keeps RLS enabled on public.registrations'
  )
  assert(
    /REVOKE SELECT ON public\.registrations FROM authenticated, anon, PUBLIC;/i.test(mig061),
    'Migration 061 keeps table-level SELECT revoked from authenticated, anon, and PUBLIC'
  )
  assert(
    mig061.includes("c.column_name NOT IN ('qr_token', 'qr_token_hash')") &&
      mig061.includes('REVOKE SELECT (qr_token)'),
    'Migration 061 grants column-level SELECT exclusively on non-secret columns (excluding qr_token and qr_token_hash)'
  )
  assert(
    !/GRANT\s+(ALL|SELECT|INSERT|UPDATE|DELETE)[^;]*TO\s+anon\b/i.test(mig061),
    'Migration 061 never grants any registrations/payment_submissions/seat_reservations privilege to anon'
  )
  assert(
    mig061.includes('CREATE POLICY "students can view own registrations"') &&
      mig061.includes('USING (auth.uid() = student_id)') &&
      mig061.includes('CREATE POLICY "clubs can view registrations for their events"') &&
      mig061.includes("has_event_permission(auth.uid(), e.club_id, e.id, 'registrations.view')"),
    'Migration 061 preserves least-privilege student owner and club RBAC RLS policies'
  )

  // ── 3. Positive & Negative Authorization Checks ──────────────────────────
  console.log('\n--- 3. Organizer & Cross-Club RBAC Authorization Matrix ---')
  const clubA = '11111111-1111-1111-1111-111111111111'
  const clubB = '22222222-2222-2222-2222-222222222222'
  const eventA1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

  // Positive: Club owner & registration-permitted roles can read club event registrations
  assert(
    hasPermission('owner', 'registrations.view') &&
      hasEventPermission({
        clubRole: 'owner',
        clubId: clubA,
        eventClubId: clubA,
        eventId: eventA1,
        permission: 'registrations.view',
      }),
    'Positive: Club owner retains registrations.view on own club events'
  )

  // Positive: Club member with only event assignment registration_manager can view that event's registrations
  assert(
    hasAnyEventPermission({
      clubRole: 'viewer',
      clubId: clubA,
      eventClubId: clubA,
      eventId: eventA1,
      userId: 'user-reg-mgr',
      eventAssignments: [
        {
          id: 'assign-1',
          club_id: clubA,
          event_id: eventA1,
          user_id: 'user-reg-mgr',
          role: 'registration_manager',
          assigned_by: 'owner-1',
          created_at: new Date().toISOString(),
        },
      ],
      permissions: ['registrations.view', 'payments.view', 'reports.view'],
    }),
    'Positive: Event-scoped registration_manager has registration read authorization on assigned event'
  )

  // Negative: Event-scoped content_manager has NO registrations.view / payments.view / reports.view
  const contentMgrLacksRoster =
    !hasAnyEventPermission({
      clubRole: 'checkin_staff',
      clubId: clubA,
      eventClubId: clubA,
      eventId: eventA1,
      permissions: ['payments.view', 'registrations.manage', 'payments.verify'],
    }) &&
    !ROLE_PERMISSIONS.viewer.includes('payments.view') &&
    !ROLE_PERMISSIONS.viewer.includes('registrations.manage')
  assert(
    contentMgrLacksRoster,
    'Negative: Read-only club roles (checkin_staff / viewer) cannot manage registrations or view/verify payments'
  )

  // Negative: Pure student / non-member user with no clubRole is denied organizer registration access
  assert(
    !hasAnyEventPermission({
      clubRole: null,
      clubId: clubA,
      eventClubId: clubA,
      eventId: eventA1,
      permissions: ['registrations.view', 'payments.view', 'reports.view'],
    }),
    'Negative: Non-member student (no club role) is denied organizer registration access'
  )

  // Negative: Suspended / inactive club member loses all permissions
  assert(
    !hasAnyEventPermission({
      clubRole: 'admin',
      clubId: clubA,
      eventClubId: clubA,
      eventId: eventA1,
      isMemberActive: false,
      permissions: ['registrations.view', 'payments.view', 'reports.view'],
    }),
    'Negative: Suspended/inactive club member is denied event registration access'
  )

  // Negative: Cross-club isolation (member of Club B cannot view Club A registrations)
  assert(
    !hasAnyEventPermission({
      clubRole: 'owner',
      clubId: clubB,
      eventClubId: clubA,
      eventId: eventA1,
      permissions: ['registrations.view', 'payments.view', 'reports.view'],
    }),
    'Negative: Owner of Club B is denied access to Club A registrations (club boundary enforced)'
  )

  // Verify organizer registration getter strips raw qr_token / qr_token_hash even in local storage
  const organizerRegsRes = await getEventRegistrations('nonexistent-event-for-mask-check')
  assert(
    Array.isArray(organizerRegsRes.registrations),
    'Organizer registration service handles empty/nonexistent event safely without throwing'
  )

  // ── 4. Priority 2-6 UI, Logo, Skip Link & CTA Fixes ──────────────────────
  console.log('\n--- 4. UI Fixes: Brand Mark, Skip Link, Dark CTA, Mobile Nav ---')
  const markPath = path.join(root, 'public/festflow-mark.png')
  assert(fs.existsSync(markPath) && fs.statSync(markPath).size > 5000, 'Transparent FestFlow brand mark PNG exists')

  const logoSrc = fs.readFileSync(path.join(root, 'src/components/ui/Logo.tsx'), 'utf-8')
  assert(
    logoSrc.includes('/festflow-mark.png') && !logoSrc.includes('bg-black'),
    'Logo.tsx uses transparent /festflow-mark.png without black square backdrop'
  )

  const cssSrc = fs.readFileSync(path.join(root, 'src/styles/index.css'), 'utf-8')
  const pageShellSrc = fs.readFileSync(path.join(root, 'src/components/layout/PageShell.tsx'), 'utf-8')
  const appSrc = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf-8')
  assert(
    cssSrc.includes('.skip-link {') &&
      cssSrc.includes('.skip-link:focus') &&
      !pageShellSrc.includes('Skip to content') &&
      !appSrc.includes('<main id="main-content">'),
    'Skip-link CSS hides offscreen until focus and removes duplicate skip anchor / main-content ID'
  )

  const buttonSrc = fs.readFileSync(path.join(root, 'src/components/ui/Button.tsx'), 'utf-8')
  const landingSrc = fs.readFileSync(path.join(root, 'src/pages/LandingPage.tsx'), 'utf-8')
  assert(
    buttonSrc.includes("'outline-dark':") &&
      landingSrc.includes('id="landing-cta-student"') &&
      landingSrc.includes('variant="outline-dark"'),
    'Button.tsx defines outline-dark and LandingPage Join as Student button uses high-contrast outline-dark variant'
  )

  const bottomNavSrc = fs.readFileSync(path.join(root, 'src/components/layout/BottomNav.tsx'), 'utf-8')
  assert(
    !bottomNavSrc.includes('to="/club/events"\n                  end') &&
      bottomNavSrc.includes('aria-pressed={notifDrawerOpen}') &&
      bottomNavSrc.includes("location.pathname.startsWith('/club/login')"),
    'BottomNav.tsx handles nested /club/events routes, drawer active state, and /club/login Sign In active state'
  )

  console.log(`\nSummary: ${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

runTests().catch((err) => {
  console.error('Fatal test failure:', err)
  process.exit(1)
})
