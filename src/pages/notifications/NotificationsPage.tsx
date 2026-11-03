import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Check,
  Calendar,
  CreditCard,
  Users2,
  Ticket,
  Megaphone,
  Settings,
  Search,
  Filter,
  ArrowRight,
  Archive,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getInAppNotificationsEnhanced,
  markNotificationRead,
  markAllNotificationsRead,
  archiveNotification,
  subscribeToRealtimeNotifications,
} from '@/lib/notifications'
import { NotificationPreferencesModal } from '@/components/notifications/NotificationPreferencesModal'
import type { InAppNotification, NotificationCategory } from '@/types'

const CATEGORY_TABS: Array<{ id: NotificationCategory | 'all'; label: string; icon: any }> = [
  { id: 'all', label: 'All', icon: Bell },
  { id: 'registration', label: 'Registrations', icon: CheckCircle2 },
  { id: 'payment', label: 'Payments', icon: CreditCard },
  { id: 'events', label: 'Events', icon: Calendar },
  { id: 'team_invitations', label: 'Teams', icon: Users2 },
  { id: 'digital_passes', label: 'Passes', icon: Ticket },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'reminders', label: 'Reminders', icon: Clock },
]

export default function NotificationsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [activeCategory, setActiveCategory] = useState<NotificationCategory | 'all'>('all')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<{
    notifications: InAppNotification[]
    totalCount: number
    unreadCount: number
    totalPages: number
  }>({
    notifications: [],
    totalCount: 0,
    unreadCount: 0,
    totalPages: 1,
  })

  const [isPrefsOpen, setIsPrefsOpen] = useState(false)

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await getInAppNotificationsEnhanced(user.id, {
        category: activeCategory,
        unreadOnly,
        page,
        limit: 15,
        search: searchQuery,
      })
      setResult(res)
    } finally {
      setLoading(false)
    }
  }, [user, activeCategory, unreadOnly, page, searchQuery])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Real-time subscription
  useEffect(() => {
    if (!user) return
    const unsubscribe = subscribeToRealtimeNotifications(user.id, () => {
      loadData()
    })
    return () => unsubscribe()
  }, [user, loadData])

  const handleNotificationClick = async (notif: InAppNotification) => {
    if (!notif.is_read) {
      await markNotificationRead(notif.id)
      setResult((prev) => ({
        ...prev,
        unreadCount: Math.max(0, prev.unreadCount - 1),
        notifications: prev.notifications.map((n) =>
          n.id === notif.id ? { ...n, is_read: true } : n
        ),
      }))
    }

    if (notif.link) {
      navigate(notif.link)
    }
  }

  const handleMarkAllRead = async () => {
    if (!user) return
    await markAllNotificationsRead(user.id, activeCategory)
    loadData()
  }

  const handleArchive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await archiveNotification(id)
    setResult((prev) => ({
      ...prev,
      notifications: prev.notifications.filter((n) => n.id !== id),
      totalCount: Math.max(0, prev.totalCount - 1),
    }))
  }

  const getCategoryBadge = (category?: string, type?: string) => {
    switch (category || type) {
      case 'payment':
      case 'payment_approved':
        return { label: 'Payment', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' }
      case 'payment_rejected':
        return { label: 'Payment Rejected', color: 'bg-rose-500/15 text-rose-400 border-rose-500/20' }
      case 'payment_submitted':
        return { label: 'Payment Pending', color: 'bg-amber-500/15 text-amber-400 border-amber-500/20' }
      case 'registration':
      case 'ticket_issued':
      case 'digital_passes':
        return { label: 'Pass Active', color: 'bg-[#18CFFC]/15 text-[#18CFFC] border-[#18CFFC]/20' }
      case 'team_invitations':
        return { label: 'Team', color: 'bg-[#ED47FC]/15 text-[#ED47FC] border-[#ED47FC]/20' }
      case 'reminders':
        return { label: 'Reminder', color: 'bg-sky-400/15 text-sky-400 border-sky-400/20' }
      case 'announcements':
        return { label: 'Announcement', color: 'bg-[#7F1AFB]/15 text-[#7F1AFB] border-[#7F1AFB]/20' }
      default:
        return { label: 'Update', color: 'bg-neutral-500/15 text-neutral-300 border-neutral-500/20' }
    }
  }

  const getIcon = (type?: string, category?: string) => {
    switch (category || type) {
      case 'payment_approved':
      case 'registration':
        return <CheckCircle2 size={18} className="text-emerald-400" />
      case 'payment_rejected':
        return <AlertTriangle size={18} className="text-rose-400" />
      case 'payment_submitted':
      case 'reminders':
        return <Clock size={18} className="text-amber-400" />
      case 'team_invitations':
        return <Users2 size={18} className="text-[#ED47FC]" />
      case 'announcements':
        return <Megaphone size={18} className="text-[#7F1AFB]" />
      default:
        return <Sparkles size={18} className="text-[#18CFFC]" />
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[var(--color-surface-1)] to-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.08)] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#18CFFC]/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[#18CFFC]/15 text-[#18CFFC] border border-[#18CFFC]/20">
                Notification Center
              </span>
              {result.unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#7F1AFB]/20 text-[#ED47FC] border border-[#7F1AFB]/30 animate-pulse">
                  {result.unreadCount} unread
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-text-primary)] font-display">
              Updates & Activity
            </h1>
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
              Real-time alerts, payment receipts, pass issuance, and team notifications
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-3">
            {result.unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.08)] hover:bg-[var(--color-surface-3)] transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Check size={14} /> Mark all read
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsPrefsOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer shadow-lg shadow-[#18CFFC]/10"
            >
              <Settings size={14} /> Preferences
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
              />
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.1)] text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC] transition-colors"
              />
            </div>

            {/* Unread Toggle & Refresh */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setUnreadOnly(!unreadOnly)
                  setPage(1)
                }}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border ${
                  unreadOnly
                    ? 'bg-[#18CFFC]/15 border-[#18CFFC]/30 text-[#18CFFC]'
                    : 'bg-[var(--color-surface-1)] border-[oklch(100%_0_0_/_0.08)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                <Filter size={14} />
                Unread only
              </button>

              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                title="Refresh notifications"
                className="p-2 rounded-xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.08)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin text-[#18CFFC]' : ''} />
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORY_TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeCategory === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveCategory(tab.id)
                    setPage(1)
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer border ${
                    isActive
                      ? 'bg-gradient-to-r from-[#18CFFC]/20 to-[#7F1AFB]/20 border-[#18CFFC]/40 text-white shadow-sm'
                      : 'bg-[var(--color-surface-1)] border-[oklch(100%_0_0_/_0.06)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-[#18CFFC]' : ''} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-2.5">
          {loading && result.notifications.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-8 h-8 rounded-full border-2 border-[#18CFFC] border-t-transparent animate-spin mx-auto" />
              <p className="text-xs text-[var(--color-text-muted)]">Loading notifications...</p>
            </div>
          ) : result.notifications.length === 0 ? (
            <div className="py-20 text-center p-8 rounded-2xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.06)] space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.08)] flex items-center justify-center text-[var(--color-text-muted)] mx-auto">
                <Bell size={22} />
              </div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                No notifications found
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto">
                {unreadOnly
                  ? 'You are all caught up! There are no unread notifications.'
                  : 'You do not have any notifications in this view.'}
              </p>
            </div>
          ) : (
            result.notifications.map((notif) => {
              const badge = getCategoryBadge(notif.category, notif.type)
              return (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => handleNotificationClick(notif)}
                  className={`group relative p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    !notif.is_read
                      ? 'bg-[var(--color-surface-1)] border-[oklch(100%_0_0_/_0.15)] shadow-md hover:border-[#18CFFC]/50'
                      : 'bg-[var(--color-surface-1)]/60 border-[oklch(100%_0_0_/_0.04)] opacity-80 hover:opacity-100 hover:bg-[var(--color-surface-1)]'
                  }`}
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.08)] shrink-0 mt-0.5">
                      {getIcon(notif.type, notif.category)}
                    </div>
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-[var(--color-text-primary)] font-display truncate">
                          {notif.title}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                        {!notif.is_read && (
                          <span className="w-2 h-2 rounded-full bg-[#18CFFC] animate-pulse" />
                        )}
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                        {notif.message}
                      </p>
                      <div className="flex items-center gap-3 pt-1 text-[11px] text-[var(--color-text-muted)]">
                        <span>
                          {new Date(notif.created_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          at{' '}
                          {new Date(notif.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {notif.link && (
                          <span className="text-[#18CFFC] flex items-center gap-1 group-hover:underline">
                            View details <ArrowRight size={11} />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {!notif.is_read && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleNotificationClick(notif)
                        }}
                        title="Mark as read"
                        className="p-2 rounded-xl text-[var(--color-text-muted)] hover:text-emerald-400 hover:bg-[var(--color-surface-2)] transition-colors"
                      >
                        <Check size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleArchive(e, notif.id)}
                      title="Archive notification"
                      className="p-2 rounded-xl text-[var(--color-text-muted)] hover:text-rose-400 hover:bg-[var(--color-surface-2)] transition-colors"
                    >
                      <Archive size={16} />
                    </button>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>

        {/* Pagination Controls */}
        {result.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.06)]">
            <span className="text-xs text-[var(--color-text-secondary)]">
              Showing page {page} of {result.totalPages} ({result.totalCount} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= result.totalPages}
                onClick={() => setPage((p) => Math.min(result.totalPages, p + 1))}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preferences Modal */}
      <NotificationPreferencesModal
        isOpen={isPrefsOpen}
        onClose={() => setIsPrefsOpen(false)}
      />
    </div>
  )
}
