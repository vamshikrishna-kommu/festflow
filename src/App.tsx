import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  ScrollRestoration,
  useLocation,
  useNavigationType,
  Navigate,
} from 'react-router'
import { lazy, Suspense, useEffect } from 'react'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { MaintenanceProvider, useMaintenance } from '@/context/MaintenanceContext'
import { MaintenanceScreen } from '@/components/maintenance/MaintenanceScreen'
import { AdminMaintenanceBanner } from '@/components/maintenance/AdminMaintenanceBanner'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Logo } from '@/components/ui'
import { NetworkStatusBanner } from '@/components/common/NetworkStatusBanner'
import { registerServiceWorker } from '@/lib/pwa'

// Lazy-load pages for code splitting
const LandingPage          = lazy(() => import('@/pages/LandingPage'))
const DiscoverPage         = lazy(() => import('@/pages/DiscoverPage'))
const EventDetailPage      = lazy(() => import('@/pages/EventDetailPage'))
const NotFoundPage         = lazy(() => import('@/pages/NotFoundPage'))

// Auth pages
const ClubSignupPage       = lazy(() => import('@/pages/auth/ClubSignupPage'))
const ClubLoginPage        = lazy(() => import('@/pages/auth/ClubLoginPage'))
const StudentSignupPage    = lazy(() => import('@/pages/auth/StudentSignupPage'))
const StudentLoginPage     = lazy(() => import('@/pages/auth/StudentLoginPage'))
const ForgotPasswordPage   = lazy(() => import('@/pages/auth/ForgotPasswordPage'))
const ResetPasswordPage    = lazy(() => import('@/pages/auth/ResetPasswordPage'))
const UnauthorizedPage     = lazy(() => import('@/pages/auth/UnauthorizedPage'))
const AuthCallbackPage     = lazy(() => import('@/pages/auth/AuthCallbackPage'))

// Legal & Support pages
const PrivacyPolicyPage    = lazy(() => import('@/pages/legal/PrivacyPolicyPage'))
const TermsPage            = lazy(() => import('@/pages/legal/TermsPage'))
const ContactPage          = lazy(() => import('@/pages/ContactPage'))

// Club event management & dashboard
const ClubDashboardPage    = lazy(() => import('@/pages/dashboard/ClubDashboardPage'))
const ClubEventsListPage   = lazy(() => import('@/pages/club/ClubEventsListPage'))
const NewEventPage         = lazy(() => import('@/pages/club/NewEventPage'))
const EditEventPage        = lazy(() => import('@/pages/club/EditEventPage'))
const EventSeatManagementPage = lazy(() => import('@/pages/club/EventSeatManagementPage'))
const SeatBookingPage      = lazy(() => import('@/pages/events/SeatBookingPage'))

// Student dashboard & tickets
const StudentDashboardPage   = lazy(() => import('@/pages/dashboard/StudentDashboardPage'))
const TicketDetailPage       = lazy(() => import('@/pages/student/TicketDetailPage'))
const StudentPaymentPage      = lazy(() => import('@/pages/student/StudentPaymentPage'))
const EventRegistrationsPage = lazy(() => import('@/pages/club/EventRegistrationsPage'))
const ClubPaymentSettingsPage = lazy(() => import('@/pages/club/ClubPaymentSettingsPage'))
const ClubPaymentsPage        = lazy(() => import('@/pages/club/ClubPaymentsPage'))
const EventReportsPage        = lazy(() => import('@/pages/club/EventReportsPage'))
const JoinTeamPage            = lazy(() => import('@/pages/student/JoinTeamPage'))
const ClubMembersPage         = lazy(() => import('@/pages/club/ClubMembersPage'))
const AcceptClubInvitationPage = lazy(() => import('@/pages/club/AcceptClubInvitationPage'))

// Phase 5: Campus Community & Social
const CommunityFeedPage     = lazy(() => import('@/pages/community/CommunityFeedPage'))
const TeammateDiscoveryPage = lazy(() => import('@/pages/community/TeammateDiscoveryPage'))
const StudentProfilePage    = lazy(() => import('@/pages/community/StudentProfilePage'))
const ClubProfilePage       = lazy(() => import('@/pages/community/ClubProfilePage'))
const MessagesPage          = lazy(() => import('@/pages/community/MessagesPage'))

// Phase 7: Super Admin & Platform Management
const AdminDashboardPage     = lazy(() => import('@/pages/admin/AdminDashboardPage'))
const AdminCollegesPage      = lazy(() => import('@/pages/admin/AdminCollegesPage'))
const AdminClubsPage         = lazy(() => import('@/pages/admin/AdminClubsPage'))
const AdminStudentsPage      = lazy(() => import('@/pages/admin/AdminStudentsPage'))
const AdminEventsPage        = lazy(() => import('@/pages/admin/AdminEventsPage'))
const AdminReportsPage       = lazy(() => import('@/pages/admin/AdminReportsPage'))
const AdminAnnouncementsPage = lazy(() => import('@/pages/admin/AdminAnnouncementsPage'))
const AdminFinancesPage      = lazy(() => import('@/pages/admin/AdminFinancesPage'))
const AdminSettingsPage      = lazy(() => import('@/pages/admin/AdminSettingsPage'))
const AdminAuditLogsPage     = lazy(() => import('@/pages/admin/AdminAuditLogsPage'))
const AdminTeamPage          = lazy(() => import('@/pages/admin/AdminTeamPage'))

// Phase 8: Notifications & Automation
const NotificationsPage      = lazy(() => import('@/pages/notifications/NotificationsPage'))
const ClubAutomationPage     = lazy(() => import('@/pages/club/ClubAutomationPage'))
const AdminAutomationPage    = lazy(() => import('@/pages/admin/AdminAutomationPage'))

// Branded full-page loading fallback
function PageLoader() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-[var(--color-surface-0)] z-50"
      aria-label="Loading page"
      role="status"
    >
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <Logo variant="navbar" />
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-[#18CFFC] border-t-transparent animate-spin" />
          <span>Loading FestFlow…</span>
        </div>
      </div>
    </div>
  )
}

/**
 * RootLayout manages comprehensive, reliable scroll behavior:
 * - Resets window and document scroll to (0, 0) on genuine route changes (PUSH/REPLACE).
 * - Honors intentional anchor navigation (e.g. /#features or in-page links) with smooth scroll.
 * - Restores exact scroll coordinates when using browser Back/Forward (POP navigation).
 * - Preserves scroll position across search parameter, tab, and filter changes on the same route.
 * - Clears nested scroll container offsets where appropriate.
 */
function RootLayout() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const { role } = useAuth()
  const { isMaintenanceMode } = useMaintenance()

  const isAdmin = role === 'platform_admin'
  const isExcludedPath = location.pathname.startsWith('/admin') || location.pathname.startsWith('/auth')

  useEffect(() => {
    // 1. Handle in-page anchor hash navigation (e.g. /#scene-03-journey or #main-content)
    if (location.hash) {
      const targetId = location.hash.slice(1)
      let cancelled = false
      let settleTimer: ReturnType<typeof setTimeout> | undefined
      let pollTimer: ReturnType<typeof setTimeout> | undefined

      const alignToElement = (el: HTMLElement) => {
        if (cancelled) return
        const header = document.querySelector('header')
        const headerOffset =
          targetId === 'main-content'
            ? 0
            : header
              ? Math.round(header.getBoundingClientRect().height)
              : 65
        const targetTop = Math.max(
          0,
          Math.round(el.getBoundingClientRect().top + window.scrollY - headerOffset)
        )
        window.scrollTo({ top: targetTop, behavior: 'auto' })
        window.dispatchEvent(new Event('scroll'))
      }

      const attemptScroll = (remainingAttempts: number) => {
        if (cancelled) return
        const el = document.getElementById(targetId)
        if (el) {
          // Wait two animation frames so lazy sections and ScrollTrigger pins settle before aligning
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              alignToElement(el)
              // Re-align once more after GSAP pin spacing finalizes on cold lazy load
              settleTimer = setTimeout(() => {
                const settledEl = document.getElementById(targetId)
                if (settledEl) alignToElement(settledEl)
              }, 160)
            })
          })
          return
        }

        if (remainingAttempts > 0) {
          pollTimer = setTimeout(() => attemptScroll(remainingAttempts - 1), 60)
        }
      }

      attemptScroll(40)
      return () => {
        cancelled = true
        if (pollTimer) clearTimeout(pollTimer)
        if (settleTimer) clearTimeout(settleTimer)
      }
    }

    // 2. On browser Back / Forward (POP), allow React Router's ScrollRestoration to restore coordinates.
    // Do NOT reset scroll to top on POP.
    if (navigationType === 'POP') {
      return
    }

    // 3. For genuine new route navigation (PUSH / REPLACE without hash):
    // Reset window and document scroll to top immediately.
    window.scrollTo(0, 0)
    if (document.documentElement) document.documentElement.scrollTop = 0
    if (document.body) document.body.scrollTop = 0

    // Reset nested main-content container if present
    const mainContent = document.getElementById('main-content')
    if (mainContent) {
      mainContent.scrollTop = 0
    }
  }, [location.pathname, location.hash, location.key, navigationType])

  // Initialize PWA service worker in browser environments
  useEffect(() => {
    registerServiceWorker()
  }, [])

  // If maintenance mode is active, non-administrative users see the maintenance screen
  if (isMaintenanceMode && !isAdmin && !isExcludedPath) {
    return (
      <>
        <NetworkStatusBanner />
        <MaintenanceScreen />
      </>
    )
  }

  return (
    <>
      <NetworkStatusBanner />
      {isAdmin && isMaintenanceMode && <AdminMaintenanceBanner />}
      <ScrollRestoration
        getKey={(loc) => {
          // Returning loc.pathname ensures that changing query parameters (such as filters,
          // tabs, local pagination, or search query) does NOT reset or unexpectedly jump scroll.
          return loc.pathname
        }}
      />
      <main id="main-content">
        <Outlet />
      </main>
    </>
  )
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      // Public routes
      {
        path: '/',
        element: (
          <Suspense fallback={<PageLoader />}>
            <LandingPage />
          </Suspense>
        ),
      },
      {
        path: '/discover',
        element: (
          <Suspense fallback={<PageLoader />}>
            <DiscoverPage />
          </Suspense>
        ),
      },
      {
        path: '/events/:slug',
        element: (
          <Suspense fallback={<PageLoader />}>
            <EventDetailPage />
          </Suspense>
        ),
      },
      {
        path: '/events/:slug/seats',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['student', 'club_member', 'platform_admin']}>
              <SeatBookingPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/events/:slug/book-seats',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['student', 'club_member', 'platform_admin']}>
              <SeatBookingPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/join-team',
        element: (
          <Suspense fallback={<PageLoader />}>
            <JoinTeamPage />
          </Suspense>
        ),
      },
      {
        path: '/join-team/:code',
        element: (
          <Suspense fallback={<PageLoader />}>
            <JoinTeamPage />
          </Suspense>
        ),
      },

      // Auth routes
      {
        path: '/club/signup',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ClubSignupPage />
          </Suspense>
        ),
      },
      {
        path: '/club/login',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ClubLoginPage />
          </Suspense>
        ),
      },
      {
        path: '/student/signup',
        element: (
          <Suspense fallback={<PageLoader />}>
            <StudentSignupPage />
          </Suspense>
        ),
      },
      {
        path: '/student/login',
        element: (
          <Suspense fallback={<PageLoader />}>
            <StudentLoginPage />
          </Suspense>
        ),
      },
      {
        path: '/forgot-password',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ForgotPasswordPage />
          </Suspense>
        ),
      },
      {
        path: '/reset-password',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ResetPasswordPage />
          </Suspense>
        ),
      },
      {
        path: '/unauthorized',
        element: (
          <Suspense fallback={<PageLoader />}>
            <UnauthorizedPage />
          </Suspense>
        ),
      },

      // Protected Club Routes
      {
        path: '/club/dashboard',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute
              allowedRoles={['club_member', 'platform_admin']}
              requiredClubPermissions={['club.view']}
            >
              <ClubDashboardPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/club/events',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute
              allowedRoles={['club_member', 'platform_admin']}
              requiredClubPermissions={['events.view']}
            >
              <ClubEventsListPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/club/events/new',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute
              allowedRoles={['club_member', 'platform_admin']}
              requiredClubPermissions={['events.create']}
            >
              <NewEventPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/club/events/:id/edit',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute
              allowedRoles={['club_member', 'platform_admin']}
              requiredClubPermissions={['events.edit']}
              allowEventAssignmentScope
            >
              <EditEventPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/club/events/:id/seats',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute
              allowedRoles={['club_member', 'platform_admin']}
              requiredClubPermissions={['events.edit']}
              allowEventAssignmentScope
            >
              <EventSeatManagementPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/club/events/:id/registrations',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute
              allowedRoles={['club_member', 'platform_admin']}
              requiredClubPermissions={['registrations.view']}
              allowEventAssignmentScope
            >
              <EventRegistrationsPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/club/payments',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute
              allowedRoles={['club_member', 'platform_admin']}
              requiredClubPermissions={['payments.view', 'payments.verify']}
              clubPermissionMode="any"
            >
              <ClubPaymentsPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/club/settings',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute
              allowedRoles={['club_member', 'platform_admin']}
              requiredClubPermissions={['club.manage', 'payments.settings']}
              clubPermissionMode="any"
            >
              <ClubPaymentSettingsPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/club/settings/payments',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute
              allowedRoles={['club_member', 'platform_admin']}
              requiredClubPermissions={['club.manage', 'payments.settings']}
              clubPermissionMode="any"
            >
              <ClubPaymentSettingsPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/club/events/:id/check-in',
        element: (
          <ProtectedRoute
            allowedRoles={['club_member', 'platform_admin']}
            requiredClubPermissions={['club.view']}
          >
            <Navigate to="/club/events" replace />
          </ProtectedRoute>
        ),
      },
      {
        path: '/club/events/:id/checkin',
        element: (
          <ProtectedRoute
            allowedRoles={['club_member', 'platform_admin']}
            requiredClubPermissions={['club.view']}
          >
            <Navigate to="/club/events" replace />
          </ProtectedRoute>
        ),
      },
      {
        path: '/club/events/:id/reports',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute
              allowedRoles={['club_member', 'platform_admin']}
              requiredClubPermissions={['reports.view']}
              allowEventAssignmentScope
            >
              <EventReportsPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/club/events/:id/automation',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute
              allowedRoles={['club_member', 'platform_admin']}
              requiredClubPermissions={['events.edit']}
              allowEventAssignmentScope
            >
              <ClubAutomationPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/club/members',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute
              allowedRoles={['club_member', 'platform_admin']}
              requiredClubPermissions={['members.view']}
            >
              <ClubMembersPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/club/team',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute
              allowedRoles={['club_member', 'platform_admin']}
              requiredClubPermissions={['members.view']}
            >
              <ClubMembersPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/club/invitations/:token',
        element: (
          <Suspense fallback={<PageLoader />}>
            <AcceptClubInvitationPage />
          </Suspense>
        ),
      },
      {
        path: '/club/join/:token',
        element: (
          <Suspense fallback={<PageLoader />}>
            <AcceptClubInvitationPage />
          </Suspense>
        ),
      },
      {
        path: '/club/invitation/:token',
        element: (
          <Suspense fallback={<PageLoader />}>
            <AcceptClubInvitationPage />
          </Suspense>
        ),
      },
      {
        path: '/accept-club-invitation/:token',
        element: (
          <Suspense fallback={<PageLoader />}>
            <AcceptClubInvitationPage />
          </Suspense>
        ),
      },

      // Protected Student Routes
      {
        path: '/student/dashboard',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['student', 'platform_admin']}>
              <StudentDashboardPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/student/settings',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['student', 'platform_admin']}>
              <StudentDashboardPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/student/wishlist',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['student', 'platform_admin']}>
              <StudentDashboardPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/student/tickets/:id',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['student', 'platform_admin']}>
              <TicketDetailPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/student/payments/:registrationId',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['student', 'platform_admin']}>
              <StudentPaymentPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/payment/:registrationId',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['student', 'platform_admin']}>
              <StudentPaymentPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/dashboard',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['student', 'platform_admin']}>
              <StudentDashboardPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },

      // Ticket alias route: supports direct links to /tickets/:id (from emails or QR)
      {
        path: '/tickets/:id',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['student', 'platform_admin']}>
              <TicketDetailPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },

      // Auth callback redirect
      {
        path: '/auth/callback',
        element: (
          <Suspense fallback={<PageLoader />}>
            <AuthCallbackPage />
          </Suspense>
        ),
      },

      // Phase 7: Super Admin & Platform Management Routes
      {
        path: '/admin',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['platform_admin']}>
              <AdminDashboardPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/admin/dashboard',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['platform_admin']}>
              <AdminDashboardPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/admin/colleges',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['platform_admin']}>
              <AdminCollegesPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/admin/clubs',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['platform_admin']}>
              <AdminClubsPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/admin/students',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['platform_admin']}>
              <AdminStudentsPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/admin/events',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['platform_admin']}>
              <AdminEventsPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/admin/reports',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['platform_admin']}>
              <AdminReportsPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/admin/announcements',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['platform_admin']}>
              <AdminAnnouncementsPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/admin/finances',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['platform_admin']}>
              <AdminFinancesPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/admin/settings',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['platform_admin']}>
              <AdminSettingsPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/admin/automation',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['platform_admin']}>
              <AdminAutomationPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/admin/audit-logs',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['platform_admin']}>
              <AdminAuditLogsPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/admin/team',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['platform_admin']}>
              <AdminTeamPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },

      // Phase 5: Campus Community & Social Routes
      {
        path: '/community',
        element: (
          <Suspense fallback={<PageLoader />}>
            <CommunityFeedPage />
          </Suspense>
        ),
      },
      {
        path: '/community/teammates',
        element: (
          <Suspense fallback={<PageLoader />}>
            <TeammateDiscoveryPage />
          </Suspense>
        ),
      },
      {
        path: '/teammates',
        element: (
          <Suspense fallback={<PageLoader />}>
            <TeammateDiscoveryPage />
          </Suspense>
        ),
      },
      {
        path: '/profile/:id',
        element: (
          <Suspense fallback={<PageLoader />}>
            <StudentProfilePage />
          </Suspense>
        ),
      },
      {
        path: '/u/:id',
        element: (
          <Suspense fallback={<PageLoader />}>
            <StudentProfilePage />
          </Suspense>
        ),
      },
      {
        path: '/student/profile/:id',
        element: (
          <Suspense fallback={<PageLoader />}>
            <StudentProfilePage />
          </Suspense>
        ),
      },
      {
        path: '/clubs/:id',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ClubProfilePage />
          </Suspense>
        ),
      },
      {
        path: '/club/profile/:id',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ClubProfilePage />
          </Suspense>
        ),
      },
      {
        path: '/messages',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['student', 'club_member', 'platform_admin']}>
              <MessagesPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/notifications',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['student', 'club_member', 'platform_admin']}>
              <NotificationsPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },

      // Legal and support pages
      {
        path: '/privacy',
        element: (
          <Suspense fallback={<PageLoader />}>
            <PrivacyPolicyPage />
          </Suspense>
        ),
      },
      {
        path: '/terms',
        element: (
          <Suspense fallback={<PageLoader />}>
            <TermsPage />
          </Suspense>
        ),
      },
      {
        path: '/contact',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ContactPage />
          </Suspense>
        ),
      },

      // Catch-all 404
      {
        path: '*',
        element: (
          <Suspense fallback={<PageLoader />}>
            <NotFoundPage />
          </Suspense>
        ),
      },
    ],
  },
])

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MaintenanceProvider>
          <RouterProvider router={router} />
        </MaintenanceProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
