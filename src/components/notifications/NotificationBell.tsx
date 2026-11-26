import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Check,
  ArrowRight,
  Users2,
  Ticket,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getInAppNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/payments'
import { subscribeToRealtimeNotifications } from '@/lib/notifications'
import { dropdownMenu } from '@/lib/animations'
import type { InAppNotification } from '@/types'

export function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<InAppNotification[]>([])
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const loadNotifications = async () => {
    if (!user) return
    const notifs = await getInAppNotifications(user.id)
    setNotifications(notifs)
  }

  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [user])

  useEffect(() => {
    if (!user) return
    const unsubscribe = subscribeToRealtimeNotifications(user.id, (newNotif) => {
      setNotifications((prev) => [newNotif, ...prev])
    })
    return () => unsubscribe()
  }, [user])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const handleNotificationClick = async (notif: InAppNotification) => {
    if (!notif.is_read) {
      await markNotificationRead(notif.id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      )
    }
    setOpen(false)
    if (notif.link) {
      navigate(notif.link)
    }
  }

  const handleMarkAllRead = async () => {
    if (!user) return
    await markAllNotificationsRead(user.id)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'payment_approved':
      case 'registration':
        return <CheckCircle2 size={15} className="text-emerald-600" />
      case 'payment_rejected':
        return <AlertTriangle size={15} className="text-rose-600" />
      case 'payment_submitted':
        return <Clock size={15} className="text-amber-600" />
      case 'team_invitation':
      case 'team_member_added':
        return <Users2 size={15} className="text-indigo-600" />
      case 'ticket_issued':
        return <Ticket size={15} className="text-blue-600" />
      default:
        return <Sparkles size={15} className="text-blue-600" />
    }
  }

  if (!user) return null

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        type="button"
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <Bell size={18} className={unreadCount > 0 ? 'text-gray-900' : ''} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-[10px] font-semibold text-white flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            variants={dropdownMenu}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white border border-gray-200 shadow-xl p-3.5 z-50 text-left overflow-hidden flex flex-col gap-3"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold font-display text-gray-900">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Check size={12} /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto flex flex-col gap-1 pr-1">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-500">
                  No notifications yet.
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left p-2.5 rounded-lg transition-colors flex items-start gap-3 cursor-pointer ${
                      !n.is_read
                        ? 'bg-blue-50/50 hover:bg-blue-50'
                        : 'hover:bg-gray-50 opacity-80'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-gray-100 shrink-0 mt-0.5">
                      {getIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-gray-900 truncate">
                          {n.title}
                        </span>
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {new Date(n.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 line-clamp-2 mt-0.5 leading-relaxed">
                        {n.message}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  navigate('/notifications')
                }}
                className="w-full py-2 px-3 rounded-lg text-center text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Open Notification Center</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
