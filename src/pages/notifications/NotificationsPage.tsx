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
import { PageShell } from '@/components/layout/PageShell'
import { SEOHead } from '@/components/seo/SEOHead'
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
  const [loadError, setLoadError] = useState<string | null>(null)
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
    setLoadError(null)
    try {
      const res = await getInAppNotificationsEnhanced(user.id, {
        category: activeCategory,
        unreadOnly,
        page,
        limit: 15,
        search: searchQuery,
      })
      setResult(res)
      if (res.error) {
        setLoadError(res.error)
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load notifications.')
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
        return { label: 'Payment', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
      case 'payment_rejected':
        return { label: 'Payment Rejected', color: 'bg-rose-50 text-rose-700 border-rose-200' }
      case 'payment_submitted':
        return { label: 'Payment Pending', color: 'bg-amber-50 text-amber-700 border-amber-200' }
      case 'registration':
      case 'ticket_issued':
      case 'digital_passes':
        return { label: 'Pass Active', color: 'bg-blue-50 text-blue-700 border-blue-200' }
      case 'team_invitations':
        return { label: 'Team', color: 'bg-purple-50 text-purple-700 border-purple-200' }
      case 'reminders':
        return { label: 'Reminder', color: 'bg-sky-50 text-sky-700 border-sky-200' }
      case 'announcements':
        return { label: 'Announcement', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
      default:
        return { label: 'Update', color: 'bg-gray-100 text-gray-700 border-gray-200' }
    }
  }

  const getIcon = (type?: string, category?: string) => {
    switch (category || type) {
      case 'payment_approved':
      case 'registration':
        return <CheckCircle2 size={18} className="text-emerald-600" />
      case 'payment_rejected':
        return <AlertTriangle size={18} className="text-rose-600" />
      case 'payment_submitted':
      case 'reminders':
        return <Clock size={18} className="text-amber-600" />
      case 'team_invitations':
        return <Users2 size={18} className="text-purple-600" />
      case 'announcements':
        return <Megaphone size={18} className="text-indigo-600" />
      default:
        return <Sparkles size={18} className="text-blue-600" />
    }
  }

  return (
    <PageShell>
      <SEOHead
        title="Notifications & Activity"
        description="Real-time campus alerts, payment receipts, pass issuance, and team notifications."
        canonicalPath="/notifications"
      />
      <div className="max-w-5xl mx-auto space-y-6 pt-4 sm:pt-8 pb-24 px-4 sm:px-6 lg:px-8 text-left">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-white border border-gray-200 shadow-xs relative overflow-hidden">
          <div className="relative z-10 space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                Notification Center
              </span>
              {result.unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {result.unreadCount} unread
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-display">
              Updates & Activity
            </h1>
            <p className="text-xs sm:text-sm text-gray-600">
              Real-time alerts, payment receipts, pass issuance, and team notifications
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-3">
            {result.unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-700 hover:text-gray-900 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Check size={14} /> Mark all read
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsPrefsOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
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
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-colors"
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
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900'
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
                className="p-2 rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin text-blue-600' : ''} />
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
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-white' : ''} />
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
              <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin mx-auto" />
              <p className="text-xs text-gray-500">Loading notifications...</p>
            </div>
          ) : loadError ? (
            <div className="py-16 text-center p-8 rounded-2xl bg-red-50/70 border border-red-200 space-y-3">
              <AlertTriangle size={28} className="mx-auto text-red-600" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-red-900">Unable to load notifications</p>
                <p className="text-xs text-red-700">{loadError}</p>
              </div>
              <button
                type="button"
                onClick={loadData}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-red-200 text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
              >
                <RefreshCw size={13} />
                Retry
              </button>
            </div>
          ) : result.notifications.length === 0 ? (
            <div className="py-20 text-center p-8 rounded-2xl bg-white border border-gray-200 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-400 mx-auto">
                <Bell size={22} />
              </div>
              <h3 className="text-sm font-bold text-gray-900">
                No notifications found
              </h3>
              <p className="text-xs text-gray-600 max-w-sm mx-auto">
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
                      ? 'bg-white border-blue-200 shadow-sm hover:border-blue-300'
                      : 'bg-white/80 border-gray-200 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 shrink-0 mt-0.5">
                      {getIcon(notif.type, notif.category)}
                    </div>
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-gray-900 font-display truncate">
                          {notif.title}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                        {!notif.is_read && (
                          <span className="w-2 h-2 rounded-full bg-blue-600" />
                        )}
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {notif.message}
                      </p>
                      <div className="flex items-center gap-3 pt-1 text-[11px] text-gray-500">
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
                          <span className="text-blue-600 flex items-center gap-1 group-hover:underline">
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
                        className="p-2 rounded-xl text-gray-400 hover:text-emerald-600 hover:bg-gray-100 transition-colors"
                      >
                        <Check size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleArchive(e, notif.id)}
                      title="Archive notification"
                      className="p-2 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-gray-100 transition-colors"
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
          <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-gray-200">
            <span className="text-xs text-gray-600">
              Showing page {page} of {result.totalPages} ({result.totalCount} total)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700 hover:text-gray-900 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= result.totalPages}
                onClick={() => setPage((p) => Math.min(result.totalPages, p + 1))}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700 hover:text-gray-900 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
    </PageShell>
  )
}
