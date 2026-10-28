import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  ScrollRestoration,
  useLocation,
  useNavigationType,
} from 'react-router'
import { lazy, Suspense, useEffect } from 'react'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Logo } from '@/components/ui'

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

// Student dashboard & tickets
const StudentDashboardPage   = lazy(() => import('@/pages/dashboard/StudentDashboardPage'))
const TicketDetailPage       = lazy(() => import('@/pages/student/TicketDetailPage'))
const StudentPaymentPage      = lazy(() => import('@/pages/student/StudentPaymentPage'))
const EventRegistrationsPage = lazy(() => import('@/pages/club/EventRegistrationsPage'))
const ClubPaymentSettingsPage = lazy(() => import('@/pages/club/ClubPaymentSettingsPage'))
const ClubPaymentsPage        = lazy(() => import('@/pages/club/ClubPaymentsPage'))
const EventCheckInPage        = lazy(() => import('@/pages/club/EventCheckInPage'))
const EventReportsPage        = lazy(() => import('@/pages/club/EventReportsPage'))
const JoinTeamPage            = lazy(() => import('@/pages/student/JoinTeamPage'))
const ClubMembersPage         = lazy(() => import('@/pages/club/ClubMembersPage'))
const AcceptClubInvitationPage = lazy(() => import('@/pages/club/AcceptClubInvitationPage'))

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
          <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--color-brand-purple)] border-t-transparent animate-spin" />
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

  useEffect(() => {
    // 1. Handle in-page anchor hash navigation (e.g. /#features or skip link #main-content)
    if (location.hash) {
      const targetId = location.hash.replace('#', '')
      const targetElement = document.getElementById(targetId)

      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth' })
        return
      }

      // Retry after frame in case the target section is inside an asynchronous lazy component
      const timer = setTimeout(() => {
        const retryEl = document.getElementById(targetId)
        if (retryEl) {
          retryEl.scrollIntoView({ behavior: 'smooth' })
        }
      }, 120)
      return () => clearTimeout(timer)
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
  }, [location.pathname, location.hash, navigationType])

  return (
    <>
      <ScrollRestoration
        getKey={(loc) => {
          // Returning loc.pathname ensures that changing query parameters (such as filters,
          // tabs, local pagination, or search query) does NOT reset or unexpectedly jump scroll.
          return loc.pathname
        }}
      />
      <Outlet />
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
            <ProtectedRoute allowedRoles={['club_member', 'platform_admin']}>
              <ClubDashboardPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/club/events',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['club_member', 'platform_admin']}>
              <ClubEventsListPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/club/events/new',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['club_member', 'platform_admin']}>
              <NewEventPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/club/events/:id/edit',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['club_member', 'platform_admin']}>
              <EditEventPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/club/events/:id/registrations',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['club_member', 'platform_admin']}>
              <EventRegistrationsPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/club/payments',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['club_member', 'platform_admin']}>
              <ClubPaymentsPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/club/settings',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['club_member', 'platform_admin']}>
              <ClubPaymentSettingsPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/club/settings/payments',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['club_member', 'platform_admin']}>
              <ClubPaymentSettingsPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/club/events/:id/check-in',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['club_member', 'platform_admin']}>
              <EventCheckInPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/club/events/:id/checkin',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['club_member', 'platform_admin']}>
              <EventCheckInPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/club/events/:id/reports',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['club_member', 'platform_admin']}>
              <EventReportsPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/club/members',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['club_member', 'platform_admin']}>
              <ClubMembersPage />
            </ProtectedRoute>
          </Suspense>
        ),
      },
      {
        path: '/club/team',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['club_member', 'platform_admin']}>
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

      // Admin-only route: platform administration
      {
        path: '/admin',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ProtectedRoute allowedRoles={['platform_admin']}>
              <ClubDashboardPage />
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
        <RouterProvider router={router} />
      </AuthProvider>
    </ErrorBoundary>
  )
}
