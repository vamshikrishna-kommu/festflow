/**
 * scripts/test-phase1-navigation-and-settings.ts
 *
 * Automated verification suite for Phase 1:
 * - A: Navigation & Scroll Restoration Fixes
 *      - Root html scroll-behavior: auto (prevents clamping during async route load)
 *      - RootLayout integration in createBrowserRouter
 *      - ScrollRestoration with getKey logic for pathname vs tab/filter query params
 *      - In-page hash target scrolling with smooth behavior
 *      - Default button type="button" across UI components to prevent accidental form submissions
 *      - Elimination of duplicate anchor IDs (#features vs #features-overview)
 * - B: Settings Persistence Repairs
 *      - AuthContext updateProfile implementation covering profiles, student_profiles, club_profiles
 *      - Supabase auth.updateUser metadata synchronization
 *      - Offline/simulation mode persistence sync
 *      - Component-level error handling without false success banners
 *      - Device-specific preferences in localStorage vs account settings in DB
 *      - Unified Club Settings (Profile + Payments) and Student Settings modal
 *      - Desktop & mobile settings navigation routes and triggers
 */

import * as fs from 'fs'
import * as path from 'path'

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
    console.log(`  ✓ PASS: ${name}`)
  } else {
    results.push({ suite, name, passed: false, error: errMsg || 'Assertion failed' })
    console.error(`  ✗ FAIL: ${name} -> ${errMsg || 'Assertion failed'}`)
  }
}

async function runPhase1Suite() {
  console.log('\n======================================================')
  console.log('🧪 FESTFLOW PHASE 1 — NAVIGATION, SCROLL & SETTINGS TEST SUITE')
  console.log('======================================================\n')

  // --- SUITE 1: CSS & Root Scroll Behavior ---
  console.log('--- 1. Root Scroll Behavior & CSS Audit ---')
  const indexCss = fs.readFileSync(path.resolve('src/styles/index.css'), 'utf-8')

  assert(
    indexCss.includes('scroll-behavior: auto;'),
    'CSS Audit',
    'Root html uses scroll-behavior: auto to prevent route transition jump clamping'
  )

  assert(
    !indexCss.includes('html {\n  scroll-behavior: smooth;\n}'),
    'CSS Audit',
    'Global unconditional smooth scroll is removed from root html selector'
  )

  assert(
    indexCss.includes('.smooth-scroll') || indexCss.includes('html.smooth-scroll'),
    'CSS Audit',
    'Targeted smooth-scroll class is available for intentional in-page animations'
  )

  // --- SUITE 2: Router & Scroll Restoration Architecture ---
  console.log('\n--- 2. Router & Scroll Restoration Architecture ---')
  const appSource = fs.readFileSync(path.resolve('src/App.tsx'), 'utf-8')

  assert(
    appSource.includes('<ScrollRestoration') && appSource.includes('getKey='),
    'Scroll Restoration',
    'ScrollRestoration component is configured with custom getKey function'
  )

  assert(
    appSource.includes('location.pathname'),
    'Scroll Restoration',
    'ScrollRestoration key tracks pathname, preserving scroll across local query/tab changes'
  )

  assert(
    appSource.includes('RootLayout'),
    'Router Architecture',
    'Router encloses routes in a unified RootLayout wrapper'
  )

  assert(
    appSource.includes('window.scrollTo(0, 0)') ||
    appSource.includes('window.scrollTo({ top: 0, left: 0'),
    'Route Navigation',
    'Navigation to genuinely new route resets window scroll to (0, 0)'
  )

  assert(
    appSource.includes("navigationType === 'POP'"),
    'History Navigation',
    'Browser Back/Forward (POP) navigations are honored without forced scroll resets'
  )

  assert(
    appSource.includes('location.hash') && appSource.includes('scrollIntoView'),
    'Anchor Navigation',
    'Intentional hash navigation (#anchor) scrolls target into view'
  )

  // --- SUITE 3: Button Default Attributes & Form Submissions ---
  console.log('\n--- 3. Button Defaults & Form Trigger Prevention ---')
  const buttonSource = fs.readFileSync(path.resolve('src/components/ui/Button.tsx'), 'utf-8')
  const featuresSource = fs.readFileSync(path.resolve('src/components/sections/FeaturesSection.tsx'), 'utf-8')
  const platformSource = fs.readFileSync(path.resolve('src/components/sections/PlatformCapabilitiesSection.tsx'), 'utf-8')

  assert(
    buttonSource.includes("type = 'button'"),
    'Button Safety',
    'Button component explicitly defaults type to "button" instead of browser "submit"'
  )

  assert(
    featuresSource.includes('id="features-overview"'),
    'Anchor Integrity',
    'FeaturesSection uses distinct id="features-overview" to avoid DOM collisions'
  )

  assert(
    platformSource.includes('id="features"'),
    'Anchor Integrity',
    'PlatformCapabilitiesSection declares primary id="features" with scroll-mt offset'
  )

  // --- SUITE 4: Settings Persistence & AuthContext Contract ---
  console.log('\n--- 4. Settings Persistence & AuthContext Contract ---')
  const authContextSource = fs.readFileSync(path.resolve('src/context/AuthContext.tsx'), 'utf-8')

  assert(
    authContextSource.includes('updateProfile: ('),
    'Auth Context',
    'AuthContext interface exposes updateProfile method'
  )

  assert(
    authContextSource.includes(".from('profiles')") &&
    authContextSource.includes(".from('student_profiles')") &&
    authContextSource.includes(".from('club_profiles')"),
    'Database Persistence',
    'updateProfile targets profiles, student_profiles, and club_profiles tables'
  )

  assert(
    authContextSource.includes('supabase.auth.updateUser('),
    'Auth Metadata Persistence',
    'updateProfile persists display name and preferences into Supabase auth metadata'
  )

  assert(
    authContextSource.includes('festflow_simulated_auth'),
    'Offline/Simulation Sync',
    'updateProfile maintains state in simulated auth storage during local development'
  )

  assert(
    authContextSource.includes('refreshProfile: () => Promise<void>'),
    'State Synchronization',
    'AuthContext exposes refreshProfile to reload fresh user state after saves'
  )

  // --- SUITE 5: Student Settings Modal Verification ---
  console.log('\n--- 5. Student Settings Modal ---')
  const studentSettingsSource = fs.readFileSync(
    path.resolve('src/components/student/StudentSettingsModal.tsx'),
    'utf-8'
  )

  assert(
    studentSettingsSource.includes('updateProfile({'),
    'Student Settings',
    'StudentSettingsModal calls updateProfile on save submission'
  )

  assert(
    studentSettingsSource.includes('collegeName') &&
    studentSettingsSource.includes('gradYear') &&
    studentSettingsSource.includes('phone'),
    'Student Settings',
    'StudentSettingsModal collects and persists college, graduation year, and phone'
  )

  assert(
    studentSettingsSource.includes("localStorage.setItem('festflow_pref_"),
    'Device Preferences',
    'Device-only preferences (sound, haptics, contrast) are isolated in localStorage'
  )

  assert(
    studentSettingsSource.includes('setErrorMessage(res.error)') &&
    studentSettingsSource.includes('return'),
    'Error Handling',
    'StudentSettingsModal captures errors and prevents false success notification on failure'
  )

  // --- SUITE 6: Club Settings Page Verification ---
  console.log('\n--- 6. Club Settings Page ---')
  const clubSettingsSource = fs.readFileSync(
    path.resolve('src/pages/club/ClubPaymentSettingsPage.tsx'),
    'utf-8'
  )

  assert(
    clubSettingsSource.includes('clubProfile') && clubSettingsSource.includes('activeTab'),
    'Club Settings Tabs',
    'ClubPaymentSettingsPage provides tabbed navigation for Profile and Payment Gateway'
  )

  assert(
    clubSettingsSource.includes('handleSaveProfile'),
    'Club Profile Handler',
    'Club settings includes dedicated save handler for club profile details'
  )

  assert(
    clubSettingsSource.includes('clubNameInput') &&
    clubSettingsSource.includes('repNameInput') &&
    clubSettingsSource.includes('descriptionInput') &&
    clubSettingsSource.includes('websiteInput'),
    'Club Fields',
    'Club settings persists club name, lead representative, description, and website'
  )

  assert(
    clubSettingsSource.includes('type="button"') && clubSettingsSource.includes('setQrImageUrl(null)'),
    'Form Integrity',
    'QR removal button explicitly uses type="button" inside form container'
  )

  // --- SUITE 7: Routes & Navigation Discoverability ---
  console.log('\n--- 7. Routes & Navigation Discoverability ---')
  const navbarSource = fs.readFileSync(path.resolve('src/components/layout/Navbar.tsx'), 'utf-8')
  const studentDashSource = fs.readFileSync(
    path.resolve('src/pages/dashboard/StudentDashboardPage.tsx'),
    'utf-8'
  )
  const clubDashSource = fs.readFileSync(
    path.resolve('src/pages/dashboard/ClubDashboardPage.tsx'),
    'utf-8'
  )

  assert(
    appSource.includes("path: '/club/settings'"),
    'Routes',
    'Application router registers /club/settings route'
  )

  assert(
    appSource.includes("path: '/student/settings'"),
    'Routes',
    'Application router registers /student/settings route'
  )

  assert(
    navbarSource.includes('/club/settings') && navbarSource.includes('StudentSettingsModal'),
    'Navbar Discoverability',
    'Navbar includes settings access for both club organizers and students'
  )

  assert(
    studentDashSource.includes('StudentSettingsModal') && studentDashSource.includes('Settings'),
    'Student Dashboard',
    'Student dashboard provides direct Settings modal trigger button'
  )

  assert(
    clubDashSource.includes('/club/settings'),
    'Club Dashboard',
    'Club dashboard links directly to unified /club/settings page'
  )

  // --- SUMMARY ---
  const passedCount = results.filter((r) => r.passed).length
  const failedCount = results.filter((r) => !r.passed).length
  console.log('\n======================================================')
  console.log(`TEST RESULTS: ${passedCount}/${results.length} PASSED (${failedCount} FAILED)`)
  console.log('======================================================\n')

  if (failedCount > 0) {
    process.exit(1)
  }
}

runPhase1Suite().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
