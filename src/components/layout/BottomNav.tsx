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
  User,
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

  // Don't show bottom nav on full-screen flows like QR scanner, check-in camera, or multi-step event wizard
  const isScannerRoute = location.pathname.includes('/check-in') || location.pathname.includes('/checkin')
  const isFormRoute = location.pathname.includes('/club/events/new') || (location.pathname.includes('/club/events/') && location.pathname.includes('/edit'))

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

  if (isScannerRoute || isFormRoute) {
    return null
  }

  const isClub = activeWorkspace === 'club'
  const isStudent = activeWorkspace === 'student' || (!isClub && !!session)
  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <>
      <nav
        aria-label="Mobile bottom navigation"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-white/10 bg-[#08080A]/95 backdrop-blur-2xl shadow-[0_-8px_32px_rgba(0,0,0,0.75)] pb-[max(0.65rem,env(safe-area-inset-bottom,0px))] pt-1 px-1 transition-all select-none"
      >
        <div className="flex items-center justify-around max-w-md mx-auto">
          {!isLoading && session && isClub ? (
            // ── Club Organizer Navigation (Dashboard, Events, Payments, Check-In, Settings) ──
            <>
              {/* 1. Dashboard / Overview */}
              <NavLink
                to="/club/dashboard"
                end
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[50px] py-1 px-0.5 rounded-2xl text-xs font-medium transition-all active:scale-90 cursor-pointer ${
                    isActive
                      ? 'text-[#18CFFC] font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="relative flex items-center justify-center">
                      <LayoutDashboard size={20} className={isActive ? 'text-[#18CFFC]' : ''} />
                      {isActive && (
                        <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-[#18CFFC] shadow-[0_0_8px_#18CFFC]" />
                      )}
                    </div>
                    <span className="text-[10px] leading-tight mt-1 tracking-tight">Overview</span>
                  </>
                )}
              </NavLink>

              {/* 2. Events */}
              <NavLink
                to="/club/events"
                end
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[50px] py-1 px-0.5 rounded-2xl text-xs font-medium transition-all active:scale-90 cursor-pointer ${
                    isActive
                      ? 'text-[#7F1AFB] font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="relative flex items-center justify-center">
                      <Calendar size={20} className={isActive ? 'text-[#7F1AFB]' : ''} />
                      {isActive && (
                        <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-[#7F1AFB] shadow-[0_0_8px_#7F1AFB]" />
                      )}
                    </div>
                    <span className="text-[10px] leading-tight mt-1 tracking-tight">Events</span>
                  </>
                )}
              </NavLink>

              {/* 3. Payments */}
              <NavLink
                to="/club/payments"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[50px] py-1 px-0.5 rounded-2xl text-xs font-medium transition-all active:scale-90 cursor-pointer ${
                    isActive
                      ? 'text-[#18CFFC] font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="relative flex items-center justify-center">
                      <CreditCard size={20} className={isActive ? 'text-[#18CFFC]' : ''} />
                      {isActive && (
                        <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-[#18CFFC] shadow-[0_0_8px_#18CFFC]" />
                      )}
                    </div>
                    <span className="text-[10px] leading-tight mt-1 tracking-tight">Payments</span>
                  </>
                )}
              </NavLink>

              {/* 4. Check-In Scanner */}
              <NavLink
                to="/club/events"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[50px] py-1 px-0.5 rounded-2xl text-xs font-medium transition-all active:scale-90 cursor-pointer ${
                    isActive || location.pathname.includes('check-in') || location.pathname.includes('checkin')
                      ? 'text-[#18CFFC] font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`
                }
              >
                {({ isActive }) => {
                  const active = isActive || location.pathname.includes('check-in') || location.pathname.includes('checkin')
                  return (
                    <>
                      <div className="relative flex items-center justify-center">
                        <QrCode size={20} className={active ? 'text-[#18CFFC]' : ''} />
                        {active && (
                          <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-[#18CFFC] shadow-[0_0_8px_#18CFFC]" />
                        )}
                      </div>
                      <span className="text-[10px] leading-tight mt-1 tracking-tight">Check-In</span>
                    </>
                  )
                }}
              </NavLink>

              {/* 5. Settings / Profile */}
              <NavLink
                to="/club/settings"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[50px] py-1 px-0.5 rounded-2xl text-xs font-medium transition-all active:scale-90 cursor-pointer ${
                    isActive
                      ? 'text-[#ED47FC] font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="relative flex items-center justify-center">
                      <Settings size={20} className={isActive ? 'text-[#ED47FC]' : ''} />
                      {isActive && (
                        <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-[#ED47FC] shadow-[0_0_8px_#ED47FC]" />
                      )}
                    </div>
                    <span className="text-[10px] leading-tight mt-1 tracking-tight">Settings</span>
                  </>
                )}
              </NavLink>
            </>
          ) : !isLoading && session && isStudent ? (
            // ── Student Navigation (Home, Explore, My Passes, Alerts, Profile) ──
            <>
              {/* 1. Home / Dashboard */}
              <NavLink
                to="/student/dashboard"
                end
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[50px] py-1 px-0.5 rounded-2xl text-xs font-medium transition-all active:scale-90 cursor-pointer ${
                    isActive && !location.search.includes('tab=upcoming')
                      ? 'text-[#7F1AFB] font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`
                }
              >
                {({ isActive }) => {
                  const active = isActive && !location.search.includes('tab=upcoming')
                  return (
                    <>
                      <div className="relative flex items-center justify-center">
                        <Home size={20} className={active ? 'text-[#7F1AFB]' : ''} />
                        {active && (
                          <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-[#7F1AFB] shadow-[0_0_8px_#7F1AFB]" />
                        )}
                      </div>
                      <span className="text-[10px] leading-tight mt-1 tracking-tight">Home</span>
                    </>
                  )
                }}
              </NavLink>

              {/* 2. Explore / Discover */}
              <NavLink
                to="/discover"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[50px] py-1 px-0.5 rounded-2xl text-xs font-medium transition-all active:scale-90 cursor-pointer ${
                    isActive
                      ? 'text-[#18CFFC] font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="relative flex items-center justify-center">
                      <Compass size={20} className={isActive ? 'text-[#18CFFC]' : ''} />
                      {isActive && (
                        <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-[#18CFFC] shadow-[0_0_8px_#18CFFC]" />
                      )}
                    </div>
                    <span className="text-[10px] leading-tight mt-1 tracking-tight">Explore</span>
                  </>
                )}
              </NavLink>

              {/* 3. My Passes / Tickets */}
              <NavLink
                to="/student/dashboard?tab=upcoming"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[50px] py-1 px-0.5 rounded-2xl text-xs font-medium transition-all active:scale-90 cursor-pointer ${
                    isActive && location.search.includes('tab=upcoming')
                      ? 'text-[#18CFFC] font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`
                }
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('festflow:select-tab', { detail: 'upcoming' }))
                }}
              >
                {({ isActive }) => {
                  const active = isActive && location.search.includes('tab=upcoming')
                  return (
                    <>
                      <div className="relative flex items-center justify-center">
                        <Ticket size={20} className={active ? 'text-[#18CFFC]' : ''} />
                        {active && (
                          <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-[#18CFFC] shadow-[0_0_8px_#18CFFC]" />
                        )}
                      </div>
                      <span className="text-[10px] leading-tight mt-1 tracking-tight">My Passes</span>
                    </>
                  )
                }}
              </NavLink>

              {/* 4. Notifications / Alerts */}
              <button
                type="button"
                onClick={() => setNotifDrawerOpen(true)}
                className="relative flex flex-col items-center justify-center flex-1 min-h-[50px] py-1 px-0.5 rounded-2xl text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-all active:scale-90 cursor-pointer"
                aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
              >
                <div className="relative flex items-center justify-center">
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-md animate-pulse">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] leading-tight mt-1 tracking-tight">Alerts</span>
              </button>

              {/* 5. Profile & Settings */}
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="flex flex-col items-center justify-center flex-1 min-h-[50px] py-1 px-0.5 rounded-2xl text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-all active:scale-90 cursor-pointer"
                aria-label="Profile and Settings"
              >
                <div className="relative flex items-center justify-center">
                  <User size={20} />
                </div>
                <span className="text-[10px] leading-tight mt-1 tracking-tight">Profile</span>
              </button>
            </>
          ) : (
            // ── Guest Navigation (Home, Explore, Start Club, Sign In) ──
            <>
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[50px] py-1 px-1 rounded-2xl text-xs font-medium transition-all active:scale-90 cursor-pointer ${
                    isActive
                      ? 'text-[#7F1AFB] font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="relative flex items-center justify-center">
                      <Home size={20} className={isActive ? 'text-[#7F1AFB]' : ''} />
                      {isActive && (
                        <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-[#7F1AFB] shadow-[0_0_8px_#7F1AFB]" />
                      )}
                    </div>
                    <span className="text-[10px] leading-tight mt-1 tracking-tight">Home</span>
                  </>
                )}
              </NavLink>

              <NavLink
                to="/discover"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[50px] py-1 px-1 rounded-2xl text-xs font-medium transition-all active:scale-90 cursor-pointer ${
                    isActive
                      ? 'text-[#18CFFC] font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="relative flex items-center justify-center">
                      <Compass size={20} className={isActive ? 'text-[#18CFFC]' : ''} />
                      {isActive && (
                        <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-[#18CFFC] shadow-[0_0_8px_#18CFFC]" />
                      )}
                    </div>
                    <span className="text-[10px] leading-tight mt-1 tracking-tight">Explore</span>
                  </>
                )}
              </NavLink>

              <NavLink
                to="/club/signup"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[50px] py-1 px-1 rounded-2xl text-xs font-medium transition-all active:scale-90 cursor-pointer ${
                    isActive
                      ? 'text-[#ED47FC] font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="relative flex items-center justify-center">
                      <Building2 size={20} className={isActive ? 'text-[#ED47FC]' : ''} />
                      {isActive && (
                        <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-[#ED47FC] shadow-[0_0_8px_#ED47FC]" />
                      )}
                    </div>
                    <span className="text-[10px] leading-tight mt-1 tracking-tight">For Clubs</span>
                  </>
                )}
              </NavLink>

              <NavLink
                to="/student/login"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[50px] py-1 px-1 rounded-2xl text-xs font-medium transition-all active:scale-90 cursor-pointer ${
                    isActive
                      ? 'text-[#18CFFC] font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="relative flex items-center justify-center">
                      <LogIn size={20} className={isActive ? 'text-[#18CFFC]' : ''} />
                      {isActive && (
                        <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-[#18CFFC] shadow-[0_0_8px_#18CFFC]" />
                      )}
                    </div>
                    <span className="text-[10px] leading-tight mt-1 tracking-tight">Sign In</span>
                  </>
                )}
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
              className="w-full max-h-[80dvh] flex flex-col rounded-t-3xl glass-elevated border-t border-white/15 bg-[#0E0E12] p-4 pb-safe text-left shadow-2xl"
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

              {/* Drawer Footer: Link to Full Center */}
              <div className="pt-2.5 mt-1 border-t border-[var(--color-surface-3)] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setNotifDrawerOpen(false)
                    navigate('/notifications')
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-[#18CFFC] flex items-center justify-center gap-1.5 transition-colors min-h-[44px]"
                >
                  <span>Open Full Notification Center</span>
                  <span className="text-[10px]">→</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
