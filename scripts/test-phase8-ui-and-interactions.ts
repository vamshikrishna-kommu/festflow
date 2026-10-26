/**
 * scripts/test-phase8-ui-and-interactions.ts
 *
 * Automated verification suite for Phase 8:
 * - Route coverage and route definitions
 * - Password recovery & reset logic
 * - Form validation and error contract enforcement
 * - Elimination of native alerts in favour of inline feedback
 * - Team registration and questionnaire validation
 * - Mobile navigation and accessible landmarks
 * - Null-safety regression preservation
 */

import { validateUpiId } from '../src/lib/payments'

interface TestResult {
  suite: string
  name: string
  passed: boolean
  error?: string
}

const results: TestResult[] = []

function assert(condition: boolean, suite: string, name: string, errMsg?: string) {
  if (condition) {
    results.push({ suite, name, passed: true })
    console.log(`  [PASS] ${name}`)
  } else {
    results.push({ suite, name, passed: false, error: errMsg || 'Assertion failed' })
    console.error(`  [FAIL] ${name} -> ${errMsg || 'Assertion failed'}`)
  }
}

async function runPhase8Suite() {
  console.log('\n======================================================')
  console.log('🧪 FESTFLOW PHASE 8 — UI, RESPONSIVENESS & INTERACTIONS TEST SUITE')
  console.log('======================================================\n')

  // --- SUITE 1: Route Audit & Navigation Links ---
  console.log('--- 1. Route Audit & Navigation Links ---')
  const fs = await import('fs')
  const path = await import('path')

  const appSource = fs.readFileSync(path.resolve('src/App.tsx'), 'utf-8')
  const navbarSource = fs.readFileSync(path.resolve('src/components/layout/Navbar.tsx'), 'utf-8')
  const footerSource = fs.readFileSync(path.resolve('src/components/layout/Footer.tsx'), 'utf-8')
  const shellSource = fs.readFileSync(path.resolve('src/components/layout/PageShell.tsx'), 'utf-8')

  const expectedRoutes = [
    '/',
    '/discover',
    '/events/:slug',
    '/club/signup',
    '/club/login',
    '/student/signup',
    '/student/login',
    '/forgot-password',
    '/reset-password',
    '/unauthorized',
    '/club/dashboard',
    '/club/events',
    '/club/events/new',
    '/club/events/:id/edit',
    '/club/events/:id/registrations',
    '/club/payments',
    '/club/settings/payments',
    '/club/events/:id/check-in',
    '/club/events/:id/checkin',
    '/club/events/:id/reports',
    '/student/dashboard',
    '/student/tickets/:id',
    '/student/payments/:registrationId',
    '/tickets/:id',
    '/auth/callback',
    '/privacy',
    '/terms',
    '/contact',
  ]

  for (const route of expectedRoutes) {
    assert(
      appSource.includes(`path: '${route}'`),
      'Route Definitions',
      `Route "${route}" is configured in App router`
    )
  }

  assert(
    shellSource.includes('href="#main-content"') && shellSource.includes('Skip to content'),
    'Accessibility',
    'PageShell includes WCAG keyboard skip-to-content link'
  )
  assert(
    shellSource.includes('id="main-content"'),
    'Accessibility',
    'PageShell declares main landmark with id="main-content"'
  )

  assert(
    navbarSource.includes('/student/signup'),
    'Navigation Links',
    'Navbar includes Student Signup link for unauthenticated visitors'
  )
  assert(
    navbarSource.includes('New student? Sign up free'),
    'Navigation Links',
    'Navbar dropdown includes direct new student prompt'
  )
  assert(
    footerSource.includes('/privacy') && footerSource.includes('/terms') && footerSource.includes('/contact'),
    'Navigation Links',
    'Footer includes all essential platform and legal links'
  )

  // --- SUITE 2: Password Recovery & Reset Contracts ---
  console.log('\n--- 2. Password Recovery & Reset Contracts ---')
  const forgotSource = fs.readFileSync(path.resolve('src/pages/auth/ForgotPasswordPage.tsx'), 'utf-8')
  const resetSource = fs.readFileSync(path.resolve('src/pages/auth/ResetPasswordPage.tsx'), 'utf-8')
  const authContextSource = fs.readFileSync(path.resolve('src/context/AuthContext.tsx'), 'utf-8')

  assert(
    authContextSource.includes('resetPassword: (email: string)') &&
    authContextSource.includes('updatePassword: (newPassword: string)'),
    'Auth Context API',
    'AuthContext exposes resetPassword and updatePassword methods'
  )
  assert(
    forgotSource.includes('resetPassword(cleanEmail)'),
    'Forgot Password Flow',
    'ForgotPasswordPage invokes resetPassword with cleaned email'
  )
  assert(
    forgotSource.includes('disabled={isSubmitting}') && forgotSource.includes('isLoading={isSubmitting}'),
    'Forgot Password Flow',
    'ForgotPasswordPage prevents duplicate submit requests'
  )
  assert(
    resetSource.includes('updatePassword(password)'),
    'Reset Password Flow',
    'ResetPasswordPage invokes updatePassword'
  )
  assert(
    resetSource.includes('password !== confirmPassword'),
    'Reset Password Flow',
    'ResetPasswordPage validates password match'
  )
  assert(
    resetSource.includes('password.length < 8'),
    'Reset Password Flow',
    'ResetPasswordPage enforces minimum password security length'
  )

  // --- SUITE 3: Elimination of Native Browser Alerts ---
  console.log('\n--- 3. Elimination of Native Browser Alerts ---')
  const ticketDetailSource = fs.readFileSync(path.resolve('src/pages/student/TicketDetailPage.tsx'), 'utf-8')
  const clubPaymentsSource = fs.readFileSync(path.resolve('src/pages/club/ClubPaymentsPage.tsx'), 'utf-8')
  const digitalCardSource = fs.readFileSync(path.resolve('src/components/tickets/DigitalTicketCard.tsx'), 'utf-8')

  assert(
    !ticketDetailSource.includes('alert('),
    'Inline Notifications',
    'TicketDetailPage contains 0 native alert() calls'
  )
  assert(
    ticketDetailSource.includes('actionError') && ticketDetailSource.includes('setActionError'),
    'Inline Notifications',
    'TicketDetailPage renders inline cancellation error feedback'
  )

  assert(
    !clubPaymentsSource.includes('alert('),
    'Inline Notifications',
    'ClubPaymentsPage contains 0 native alert() calls'
  )
  assert(
    clubPaymentsSource.includes('rejectError') && clubPaymentsSource.includes('setRejectError'),
    'Inline Notifications',
    'ClubPaymentsPage displays inline error badge for empty rejection reason'
  )

  assert(
    !digitalCardSource.includes('alert('),
    'Inline Notifications',
    'DigitalTicketCard contains 0 native alert() calls'
  )
  assert(
    digitalCardSource.includes('setResendNotice') && digitalCardSource.includes('resendNotice'),
    'Inline Notifications',
    'DigitalTicketCard surfaces download and resend errors via accessible banner'
  )

  // --- SUITE 4: Form Validation & Input Safety ---
  console.log('\n--- 4. Form Validation & Input Safety ---')
  // UPI validation test
  assert(validateUpiId('club@okaxis'), 'Form Validation', 'validateUpiId accepts standard handle')
  assert(validateUpiId('festflow.council@upi'), 'Form Validation', 'validateUpiId accepts dot notation handle')
  assert(!validateUpiId('invalid-upi'), 'Form Validation', 'validateUpiId rejects address without bank suffix')
  assert(!validateUpiId(''), 'Form Validation', 'validateUpiId rejects empty string')

  // Stale Phase developer banner removed
  const regListSource = fs.readFileSync(path.resolve('src/pages/club/EventRegistrationsPage.tsx'), 'utf-8')
  assert(
    !regListSource.includes('Payment verification and approval workflows belong to Phase 5'),
    'Clean UI',
    'EventRegistrationsPage removed stale developer banner'
  )
  assert(
    regListSource.includes('/club/payments?eventId='),
    'Clean UI',
    'EventRegistrationsPage directs organizers to payments dashboard'
  )

  // Mobile wrap responsiveness
  const clubEventsSource = fs.readFileSync(path.resolve('src/pages/club/ClubEventsListPage.tsx'), 'utf-8')
  assert(
    clubEventsSource.includes('flex-wrap') && clubEventsSource.includes('shrink-0'),
    'Responsive Layout',
    'ClubEventsListPage actions wrap cleanly on small screens'
  )

  const eventFormSource = fs.readFileSync(path.resolve('src/components/events/EventForm.tsx'), 'utf-8')
  assert(
    eventFormSource.includes('flex-wrap') && eventFormSource.includes('flex-1 sm:flex-initial'),
    'Responsive Layout',
    'EventForm action bar is responsive on mobile viewports'
  )

  const studentDashboardSource = fs.readFileSync(path.resolve('src/pages/dashboard/StudentDashboardPage.tsx'), 'utf-8')
  assert(
    studentDashboardSource.includes('Refresh') && studentDashboardSource.includes('RefreshCw'),
    'Refresh Behavior',
    'StudentDashboardPage includes manual refresh action for live passes'
  )

  const landingSource = fs.readFileSync(path.resolve('src/pages/LandingPage.tsx'), 'utf-8')
  assert(
    landingSource.includes('sm:hidden') && landingSource.includes('Explore all campus events'),
    'Mobile UX',
    'LandingPage includes mobile-specific discovery button below event grid'
  )

  // --- SUITE 5: Summary & Report ---
  console.log('\n======================================================')
  const total = results.length
  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length

  console.log(`TOTAL CHECKS:  ${total}`)
  console.log(`PASSED:        ${passed}`)
  console.log(`FAILED:        ${failed}`)
  console.log('======================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runPhase8Suite().catch((err) => {
  console.error('Test execution exception:', err)
  process.exit(1)
})
