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
  CheckCircle2,
  X,
  User,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getInAppNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/payments'
import { StudentSettingsModal } from '@/components/student/StudentSettingsModal'
import type { InAppNotification } from '@/types'

export function BottomNav() {
  const { session, user, isLoading, activeWorkspace, hasClubPermission } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false)
  const [notifications, setNotifications] = useState<InAppNotification[]>([])

  const isFormRoute = location.pathname.includes('/club/events/new') || (location.pathname.includes('/club/events/') && location.pathname.includes('/edit'))

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

  if (isFormRoute) {
    return null
  }

  const isClub = activeWorkspace === 'club'
  const isStudent = activeWorkspace === 'student' || (!isClub && !!session)
  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <>
      <nav
        aria-label="Mobile bottom navigation"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-gray-200 bg-white/95 backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.05)] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-1 px-1 transition-all select-none"
      >
        <div className="flex items-center justify-around max-w-md mx-auto">
          {!isLoading && session && isClub ? (
            <>
              {hasClubPermission('club.view') && (
                <NavLink
                  to="/club/dashboard"
                  end
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-0.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'text-blue-600 font-semibold'
                        : 'text-gray-500 hover:text-gray-900'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="relative flex items-center justify-center">
                        <LayoutDashboard size={20} className={isActive ? 'text-blue-600' : ''} />
                      </div>
                      <span className="text-[10px] leading-tight mt-1 tracking-tight">Overview</span>
                    </>
                  )}
                </NavLink>
              )}

              {hasClubPermission('events.view') && (
                <NavLink
                  to="/club/events"
                  end
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-0.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'text-blue-600 font-semibold'
                        : 'text-gray-500 hover:text-gray-900'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="relative flex items-center justify-center">
                        <Calendar size={20} className={isActive ? 'text-blue-600' : ''} />
                      </div>
                      <span className="text-[10px] leading-tight mt-1 tracking-tight">Events</span>
                    </>
                  )}
                </NavLink>
              )}

              {hasClubPermission('payments.view') && (
                <NavLink
                  to="/club/payments"
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-0.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'text-blue-600 font-semibold'
                        : 'text-gray-500 hover:text-gray-900'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="relative flex items-center justify-center">
                        <CreditCard size={20} className={isActive ? 'text-blue-600' : ''} />
                      </div>
                      <span className="text-[10px] leading-tight mt-1 tracking-tight">Payments</span>
                    </>
                  )}
                </NavLink>
              )}

              {(hasClubPermission('club.manage') || hasClubPermission('payments.settings')) && (
                <NavLink
                  to="/club/settings"
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-0.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'text-blue-600 font-semibold'
                        : 'text-gray-500 hover:text-gray-900'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="relative flex items-center justify-center">
                        <Settings size={20} className={isActive ? 'text-blue-600' : ''} />
                      </div>
                      <span className="text-[10px] leading-tight mt-1 tracking-tight">Settings</span>
                    </>
                  )}
                </NavLink>
              )}
            </>
          ) : !isLoading && session && isStudent ? (
            <>
              <NavLink
                to="/student/dashboard"
                end
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-0.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    isActive && !location.search.includes('tab=upcoming')
                      ? 'text-blue-600 font-semibold'
                      : 'text-gray-500 hover:text-gray-900'
                  }`
                }
              >
                {({ isActive }) => {
                  const active = isActive && !location.search.includes('tab=upcoming')
                  return (
                    <>
                      <div className="relative flex items-center justify-center">
                        <Home size={20} className={active ? 'text-blue-600' : ''} />
                      </div>
                      <span className="text-[10px] leading-tight mt-1 tracking-tight">Home</span>
                    </>
                  )
                }}
              </NavLink>

              <NavLink
                to="/discover"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-0.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'text-blue-600 font-semibold'
                      : 'text-gray-500 hover:text-gray-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="relative flex items-center justify-center">
                      <Compass size={20} className={isActive ? 'text-blue-600' : ''} />
                    </div>
                    <span className="text-[10px] leading-tight mt-1 tracking-tight">Explore</span>
                  </>
                )}
              </NavLink>

              <NavLink
                to="/student/dashboard?tab=upcoming"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-0.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    isActive && location.search.includes('tab=upcoming')
                      ? 'text-blue-600 font-semibold'
                      : 'text-gray-500 hover:text-gray-900'
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
                        <Ticket size={20} className={active ? 'text-blue-600' : ''} />
                      </div>
                      <span className="text-[10px] leading-tight mt-1 tracking-tight">My Passes</span>
                    </>
                  )
                }}
              </NavLink>

              <button
                type="button"
                onClick={() => setNotifDrawerOpen(true)}
                className="relative flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-0.5 rounded-xl text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
                aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
              >
                <div className="relative flex items-center justify-center">
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] leading-tight mt-1 tracking-tight">Alerts</span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-0.5 rounded-xl text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
                aria-label="Profile and Settings"
              >
                <div className="relative flex items-center justify-center">
                  <User size={20} />
                </div>
                <span className="text-[10px] leading-tight mt-1 tracking-tight">Profile</span>
              </button>
            </>
          ) : (
            <>
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-1 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'text-blue-600 font-semibold'
                      : 'text-gray-500 hover:text-gray-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="relative flex items-center justify-center">
                      <Home size={20} className={isActive ? 'text-blue-600' : ''} />
                    </div>
                    <span className="text-[10px] leading-tight mt-1 tracking-tight">Home</span>
                  </>
                )}
              </NavLink>

              <NavLink
                to="/discover"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-1 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'text-blue-600 font-semibold'
                      : 'text-gray-500 hover:text-gray-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="relative flex items-center justify-center">
                      <Compass size={20} className={isActive ? 'text-blue-600' : ''} />
                    </div>
                    <span className="text-[10px] leading-tight mt-1 tracking-tight">Explore</span>
                  </>
                )}
              </NavLink>

              <NavLink
                to="/club/signup"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-1 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'text-blue-600 font-semibold'
                      : 'text-gray-500 hover:text-gray-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="relative flex items-center justify-center">
                      <Building2 size={20} className={isActive ? 'text-blue-600' : ''} />
                    </div>
                    <span className="text-[10px] leading-tight mt-1 tracking-tight">For Clubs</span>
                  </>
                )}
              </NavLink>

              <NavLink
                to="/student/login"
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center flex-1 min-h-[48px] py-1 px-1 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'text-blue-600 font-semibold'
                      : 'text-gray-500 hover:text-gray-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="relative flex items-center justify-center">
                      <LogIn size={20} className={isActive ? 'text-blue-600' : ''} />
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
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-h-[80dvh] flex flex-col rounded-t-2xl border-t border-gray-200 bg-white p-4 pb-safe text-left shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Bell size={18} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-gray-900">
                      Campus Notifications
                    </h3>
                    <span className="text-[11px] text-gray-500">
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
                      className="text-xs font-medium text-blue-600 hover:underline cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setNotifDrawerOpen(false)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                    aria-label="Close notifications"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Notification List */}
              <div className="overflow-y-auto max-h-[55vh] py-3 flex flex-col gap-2">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center flex flex-col items-center text-gray-400">
                    <Bell size={28} className="opacity-40 mb-2" />
                    <span className="text-xs text-gray-500">No notifications right now</span>
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
                      className={`p-3 rounded-xl border transition-colors cursor-pointer flex items-start gap-3 ${
                        notif.is_read
                          ? 'bg-gray-50/50 border-gray-100 text-gray-600'
                          : 'bg-blue-50/40 border-blue-200 text-gray-900 shadow-xs'
                      }`}
                    >
                      <div className="mt-0.5">
                        <CheckCircle2 size={16} className={notif.is_read ? 'text-gray-400' : 'text-blue-600'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-xs text-gray-900">
                          {notif.title}
                        </h4>
                        <p className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
                          {notif.message}
                        </p>
                        <span className="text-[10px] text-gray-400 block mt-1">
                          {new Date(notif.created_at).toLocaleDateString()} at{' '}
                          {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2.5 mt-1 border-t border-gray-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setNotifDrawerOpen(false)
                    navigate('/notifications')
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-semibold text-blue-600 flex items-center justify-center gap-1.5 transition-colors min-h-[42px]"
                >
                  <span>Open Full Notification Center</span>
                  <span className="text-xs">→</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
