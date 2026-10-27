import { NavLink, useLocation } from 'react-router'
import {
  Compass,
  Ticket,
  LayoutDashboard,
  Calendar,
  Plus,
  CreditCard,
  Home,
  Building2,
  LogIn,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export function BottomNav() {
  const { session, role, isLoading } = useAuth()
  const location = useLocation()

  // Don't show bottom nav on full-screen flows like QR scanner or check-in camera
  if (location.pathname.includes('/check-in') || location.pathname.includes('/checkin')) {
    return null
  }

  const isClub = role === 'club_member'
  const isStudent = role === 'student' || (!isClub && !!session)

  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden glass border-t border-[oklch(100%_0_0_/_0.08)] bg-[oklch(11%_0.025_260_/_0.92)] backdrop-blur-xl shadow-[0_-4px_24px_oklch(0%_0_0_/_0.4)] pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 px-1 transition-all"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {!isLoading && session && isClub ? (
          // Club organizer navigation
          <>
            <NavLink
              to="/club/dashboard"
              end
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-1 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'text-[var(--color-brand-violet)] font-semibold'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`
              }
            >
              <LayoutDashboard size={20} className="mb-0.5" />
              <span className="text-[10px] leading-tight">Dashboard</span>
            </NavLink>

            <NavLink
              to="/club/events"
              end
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-1 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'text-[var(--color-brand-violet)] font-semibold'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`
              }
            >
              <Calendar size={20} className="mb-0.5" />
              <span className="text-[10px] leading-tight">Events</span>
            </NavLink>

            {/* Prominent Create Action in center */}
            <NavLink
              to="/club/events/new"
              aria-label="Create New Event"
              className="flex flex-col items-center justify-center -mt-3.5 group focus-visible:outline-offset-4"
            >
              <div className="w-12 h-12 rounded-full gradient-brand shadow-lg shadow-[var(--color-brand-purple)]/30 flex items-center justify-center text-white active:scale-95 transition-transform">
                <Plus size={24} strokeWidth={2.5} />
              </div>
              <span className="text-[10px] font-semibold text-[var(--color-text-primary)] mt-0.5">New</span>
            </NavLink>

            <NavLink
              to="/club/payments"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-1 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'text-[var(--color-brand-violet)] font-semibold'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`
              }
            >
              <CreditCard size={20} className="mb-0.5" />
              <span className="text-[10px] leading-tight">Payments</span>
            </NavLink>

            <NavLink
              to="/discover"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-1 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'text-[var(--color-brand-violet)] font-semibold'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`
              }
            >
              <Compass size={20} className="mb-0.5" />
              <span className="text-[10px] leading-tight">Discover</span>
            </NavLink>
          </>
        ) : !isLoading && session && isStudent ? (
          // Student navigation
          <>
            <NavLink
              to="/discover"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[64px] min-h-[48px] py-1 px-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'text-[var(--color-brand-cyan)] font-semibold'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`
              }
            >
              <Compass size={20} className="mb-0.5" />
              <span className="text-[10px] leading-tight">Discover</span>
            </NavLink>

            <NavLink
              to="/student/dashboard"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[64px] min-h-[48px] py-1 px-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'text-[var(--color-brand-violet)] font-semibold'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`
              }
            >
              <Ticket size={20} className="mb-0.5" />
              <span className="text-[10px] leading-tight">My Passes</span>
            </NavLink>

            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[64px] min-h-[48px] py-1 px-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'text-[var(--color-brand-pink)] font-semibold'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`
              }
            >
              <Home size={20} className="mb-0.5" />
              <span className="text-[10px] leading-tight">Home</span>
            </NavLink>
          </>
        ) : (
          // Guest navigation
          <>
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[60px] min-h-[48px] py-1 px-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'text-[var(--color-brand-violet)] font-semibold'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`
              }
            >
              <Home size={20} className="mb-0.5" />
              <span className="text-[10px] leading-tight">Home</span>
            </NavLink>

            <NavLink
              to="/discover"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[60px] min-h-[48px] py-1 px-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'text-[var(--color-brand-cyan)] font-semibold'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`
              }
            >
              <Compass size={20} className="mb-0.5" />
              <span className="text-[10px] leading-tight">Discover</span>
            </NavLink>

            <NavLink
              to="/club/signup"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[60px] min-h-[48px] py-1 px-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'text-[var(--color-brand-pink)] font-semibold'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`
              }
            >
              <Building2 size={20} className="mb-0.5" />
              <span className="text-[10px] leading-tight">For Clubs</span>
            </NavLink>

            <NavLink
              to="/student/login"
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[60px] min-h-[48px] py-1 px-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'text-[var(--color-brand-purple)] font-semibold'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`
              }
            >
              <LogIn size={20} className="mb-0.5" />
              <span className="text-[10px] leading-tight">Log In</span>
            </NavLink>
          </>
        )}
      </div>
    </nav>
  )
}
