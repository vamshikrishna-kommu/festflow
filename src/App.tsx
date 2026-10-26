import { createBrowserRouter, RouterProvider } from 'react-router'
import { lazy, Suspense } from 'react'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { ErrorBoundary } from '@/components/ErrorBoundary'

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

// Minimal full-page loading fallback
function PageLoader() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-[var(--color-surface-0)]"
      aria-label="Loading page"
      role="status"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--color-surface-3)] border-t-[var(--color-brand-purple)] animate-spin" />
        <span className="text-xs text-[var(--color-text-muted)]">Loading…</span>
      </div>
    </div>
  )
}

const router = createBrowserRouter([
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
