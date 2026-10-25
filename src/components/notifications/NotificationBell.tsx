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
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getInAppNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/payments'
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
    // Poll notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [user])

  // Close when clicking outside
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
        return <CheckCircle2 size={16} className="text-emerald-400" />
      case 'payment_rejected':
        return <AlertTriangle size={16} className="text-rose-400" />
      case 'payment_submitted':
        return <Clock size={16} className="text-amber-400" />
      default:
        return <Sparkles size={16} className="text-[var(--color-brand-purple)]" />
    }
  }

  if (!user) return null

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gradient-to-r from-[var(--color-brand-purple)] to-[var(--color-brand-pink)] text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl glass border border-[var(--color-surface-3)] shadow-2xl p-4 z-50 text-left overflow-hidden flex flex-col gap-3"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-surface-3)] pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold font-display text-[var(--color-text-primary)]">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-brand-purple)]/20 text-[var(--color-brand-purple)]">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] flex items-center gap-1 transition-colors"
                >
                  <Check size={12} /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto flex flex-col gap-1 pr-1">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--color-text-muted)]">
                  No notifications yet.
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 ${
                      !n.is_read
                        ? 'bg-[var(--color-surface-2)]/80 hover:bg-[var(--color-surface-3)]'
                        : 'hover:bg-[var(--color-surface-1)] opacity-75'
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-[var(--color-surface-3)] shrink-0 mt-0.5">
                      {getIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                          {n.title}
                        </span>
                        <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
                          {new Date(n.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)] line-clamp-2 mt-0.5 leading-relaxed">
                        {n.message}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
