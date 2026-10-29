import { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import {
  Compass,
  Ticket,
  LayoutDashboard,
  Calendar,
  CreditCard,
  Home,
  Building2,
  LogIn,
  Bell,
  Settings,
  QrCode,
  CheckCircle2,
  X,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getInAppNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/payments'
import { StudentSettingsModal } from '@/components/student/StudentSettingsModal'
import type { InAppNotification } from '@/types'

export function BottomNav() {
  const { session, user, isLoading, activeWorkspace } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false)
  const [notifications, setNotifications] = useState<InAppNotification[]>([])

  // Don't show bottom nav on full-screen flows like QR scanner or check-in camera
  const isScannerRoute = location.pathname.includes('/check-in') || location.pathname.includes('/checkin')

  // Load unread count for notification badge
  useEffect(() => {
    if (!user?.id) return
    let active = true

    const loadNotifs = async () => {
      try {
        const notifs = await getInAppNotifications(user.id)
        if (active) setNotifications(notifs)
      } catch {
        // ignore
      }
    }

    loadNotifs()
    const timer = setInterval(loadNotifs, 30000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [user?.id])

  if (isScannerRoute) {
    return null
  }

  const isClub = activeWorkspace === 'club'
  const isStudent = activeWorkspace === 'student' || (!isClub && !!session)
  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <>
      <nav
        aria-label="Mobile bottom navigation"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden glass border-t border-[oklch(100%_0_0_/_0.08)] bg-[oklch(11%_0.025_260_/_0.94)] backdrop-blur-2xl shadow-[0_-8px_32px_oklch(0%_0_0_/_0.5)] pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-1 px-1.5 transition-all"
      >
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {!isLoading && session && isClub ? (
            // ── Club Organizer Navigation (Overview, Events, Payments, Check-in, Settings) ──
            <>
              {/* 1. Overview */}
              <NavLink
                to="/club/dashboard"
                end
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-0.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'text-[var(--color-brand-purple)] font-semibold'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                  }`
                }
              >
                <LayoutDashboard size={20} className="mb-0.5" />
                <span className="text-[10px] leading-tight">Overview</span>
              </NavLink>

              {/* 2. Events */}
              <NavLink
                to="/club/events"
                end
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-0.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'text-[var(--color-brand-purple)] font-semibold'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                  }`
                }
              >
                <Calendar size={20} className="mb-0.5" />
                <span className="text-[10px] leading-tight">Events</span>
              </NavLink>

              {/* 3. Payments */}
              <NavLink
                to="/club/payments"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-0.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'text-[var(--color-brand-purple)] font-semibold'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                  }`
                }
              >
                <CreditCard size={20} className="mb-0.5" />
                <span className="text-[10px] leading-tight">Payments</span>
              </NavLink>

              {/* 4. Check-in */}
              <NavLink
                to="/club/events"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-0.5 rounded-xl text-xs font-medium transition-all ${
                    isActive || location.pathname.includes('check-in') || location.pathname.includes('checkin')
                      ? 'text-[var(--color-brand-cyan)] font-semibold'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                  }`
                }
              >
                <QrCode size={20} className="mb-0.5" />
                <span className="text-[10px] leading-tight">Check-In</span>
              </NavLink>

              {/* 5. Settings */}
              <NavLink
                to="/club/settings"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-0.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'text-[var(--color-brand-purple)] font-semibold'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                  }`
                }
              >
                <Settings size={20} className="mb-0.5" />
                <span className="text-[10px] leading-tight">Settings</span>
              </NavLink>
            </>
          ) : !isLoading && session && isStudent ? (
            // ── Student Navigation (Discover, My Tickets, Dashboard, Notifications, Profile/Settings) ──
            <>
              {/* 1. Discover */}
              <NavLink
                to="/discover"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-0.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'text-[var(--color-brand-cyan)] font-semibold'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                  }`
                }
              >
                <Compass size={20} className="mb-0.5" />
                <span className="text-[10px] leading-tight">Discover</span>
              </NavLink>

              {/* 2. My Tickets */}
              <NavLink
                to="/student/dashboard"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-0.5 rounded-xl text-xs font-medium transition-all ${
                    isActive && location.search.includes('tab=upcoming')
                      ? 'text-[var(--color-brand-violet)] font-semibold'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                  }`
                }
                onClick={() => {
                  // If on dashboard, navigate cleanly to tickets
                  if (location.pathname === '/student/dashboard') {
                    window.dispatchEvent(new CustomEvent('festflow:select-tab', { detail: 'upcoming' }))
                  }
                }}
              >
                <Ticket size={20} className="mb-0.5" />
                <span className="text-[10px] leading-tight">My Passes</span>
              </NavLink>

              {/* 3. My Dashboard */}
              <NavLink
                to="/student/dashboard"
                end
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-0.5 rounded-xl text-xs font-medium transition-all ${
                    isActive && !location.search.includes('tab=upcoming')
                      ? 'text-[var(--color-brand-violet)] font-semibold'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                  }`
                }
              >
                <LayoutDashboard size={20} className="mb-0.5" />
                <span className="text-[10px] leading-tight">Dashboard</span>
              </NavLink>

              {/* 4. Notifications */}
              <button
                type="button"
                onClick={() => setNotifDrawerOpen(true)}
                className="relative flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-0.5 rounded-xl text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-all cursor-pointer"
                aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
              >
                <div className="relative">
                  <Bell size={20} className="mb-0.5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] leading-tight">Alerts</span>
              </button>

              {/* 5. Profile/Settings */}
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-0.5 rounded-xl text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-all cursor-pointer"
                aria-label="Profile and Settings"
              >
                <Settings size={20} className="mb-0.5" />
                <span className="text-[10px] leading-tight">Settings</span>
              </button>
            </>
          ) : (
            // ── Guest Navigation (Home, Discover, For Clubs, Log In) ──
            <>
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-1 rounded-xl text-xs font-medium transition-all ${
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
                  `flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-1 rounded-xl text-xs font-medium transition-all ${
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
                  `flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-1 rounded-xl text-xs font-medium transition-all ${
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
                  `flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-1 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'text-[var(--color-brand-purple)] font-semibold'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                  }`
                }
              >
                <LogIn size={20} className="mb-0.5" />
                <span className="text-[10px] leading-tight">Sign In</span>
              </NavLink>
            </>
          )}
        </div>
      </nav>

      {/* Student Settings Sheet / Modal */}
      <StudentSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Notifications Bottom Drawer */}
      <AnimatePresence>
        {notifDrawerOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-h-[80dvh] flex flex-col rounded-t-3xl glass-elevated border-t border-[oklch(100%_0_0_/_0.15)] bg-[var(--color-surface-1)] p-4 pb-safe text-left shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[var(--color-surface-3)]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[var(--color-brand-cyan)]/15 text-[var(--color-brand-cyan)] flex items-center justify-center">
                    <Bell size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[var(--color-text-primary)]">
                      Campus Notifications
                    </h3>
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                      {unreadCount} unread alert{unreadCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {unreadCount > 0 && user && (
                    <button
                      type="button"
                      onClick={async () => {
                        await markAllNotificationsRead(user.id)
                        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
                      }}
                      className="text-[11px] font-semibold text-[var(--color-brand-cyan)] hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setNotifDrawerOpen(false)}
                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Notification List */}
              <div className="overflow-y-auto max-h-[55vh] py-2 flex flex-col gap-2">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center flex flex-col items-center text-[var(--color-text-muted)]">
                    <Bell size={28} className="opacity-30 mb-2" />
                    <span className="text-xs">No notifications right now</span>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={async () => {
                        if (!notif.is_read) {
                          await markNotificationRead(notif.id)
                          setNotifications((prev) =>
                            prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
                          )
                        }
                        setNotifDrawerOpen(false)
                        if (notif.link) navigate(notif.link)
                      }}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                        notif.is_read
                          ? 'bg-[var(--color-surface-2)]/40 border-transparent text-[var(--color-text-muted)]'
                          : 'bg-[var(--color-surface-2)] border-[var(--color-brand-cyan)]/30 text-[var(--color-text-primary)] shadow-sm'
                      }`}
                    >
                      <div className="mt-0.5">
                        <CheckCircle2 size={16} className={notif.is_read ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-brand-cyan)]'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-xs text-[var(--color-text-primary)]">
                          {notif.title}
                        </h4>
                        <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
                          {notif.message}
                        </p>
                        <span className="text-[9px] text-[var(--color-text-muted)] block mt-1">
                          {new Date(notif.created_at).toLocaleDateString()} at{' '}
                          {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
