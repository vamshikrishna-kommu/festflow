// Phase 7: Super Admin Overview Dashboard Page
import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import {
  Users,
  Building,
  GraduationCap,
  Calendar,
  AlertCircle,
  CreditCard,
  Ticket,
  DollarSign,
  ArrowRight,
  RefreshCw,
  Clock,
} from 'lucide-react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { AdminMetricCard } from '@/components/admin/AdminMetricCard'
import { getPlatformMetrics, getAdminAuditLogs, getAdminEvents } from '@/lib/admin'
import type { PlatformMetrics, AdminAuditLogRecord, AdminEventRecord } from '@/types'
import { Button } from '@/components/ui'

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null)
  const [recentLogs, setRecentLogs] = useState<AdminAuditLogRecord[]>([])
  const [pendingEvents, setPendingEvents] = useState<AdminEventRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setIsLoading(true)
      setLoadError(null)
      const [m, logs, evts] = await Promise.all([
        getPlatformMetrics(),
        getAdminAuditLogs({ limit: 6 }),
        getAdminEvents('pending_approval'),
      ])
      setMetrics(m)
      setRecentLogs(logs)
      setPendingEvents(evts)
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load platform oversight metrics.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  return (
    <AdminLayout
      title="Platform Executive Overview"
      subtitle="Comprehensive administrative control center monitoring global fest activity, verified institutions, and payment reconciliation."
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={isLoading}
          leftIcon={<RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />}
        >
          Refresh Data
        </Button>
      }
    >
      {/* Platform Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <AdminMetricCard
          title="Registered Students"
          value={metrics?.total_students ?? '—'}
          icon={GraduationCap}
          color="cyan"
          subtitle="Verified campus attendees"
        />
        <AdminMetricCard
          title="Verified Clubs"
          value={metrics?.total_verified_clubs ?? '—'}
          icon={Building}
          subtitle={`Out of ${metrics?.total_clubs ?? 0} total clubs`}
          color="violet"
        />
        <AdminMetricCard
          title="Colleges & Universities"
          value={metrics?.total_colleges ?? '—'}
          icon={Users}
          color="magenta"
          subtitle="Accredited institutions"
        />
        <AdminMetricCard
          title="Active Fest Events"
          value={metrics?.total_published_events ?? '—'}
          icon={Calendar}
          subtitle={`${metrics?.total_pending_moderation ?? 0} awaiting moderation`}
          color="emerald"
        />
        <AdminMetricCard
          title="Total Registrations"
          value={metrics?.total_registrations ?? '—'}
          icon={Users}
          color="cyan"
          subtitle="Individual & squad orders"
        />
        <AdminMetricCard
          title="Verified UPI Payments"
          value={metrics?.total_verified_payments ?? '—'}
          icon={CreditCard}
          subtitle={`${metrics?.total_pending_payments ?? 0} submissions pending`}
          color="amber"
        />
        <AdminMetricCard
          title="Issued Entry Passes"
          value={metrics?.total_issued_passes ?? '—'}
          icon={Ticket}
          color="emerald"
          subtitle="Confirmed registration passes"
        />
        <AdminMetricCard
          title="Transacted Ticket Volume"
          value={metrics ? `₹${metrics.total_revenue_inr.toLocaleString('en-IN')}` : '—'}
          icon={DollarSign}
          color="violet"
          subtitle="Preserving manual direct UPI"
        />
      </div>

      {/* Main Grid: Pending Moderation & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Events Awaiting Moderation Queue */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
                <AlertCircle size={16} />
              </div>
              <h2 className="text-base font-bold text-gray-900 font-display">
                Event Moderation Queue
              </h2>
            </div>
            <Link
              to="/admin/events"
              className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
            >
              View Queue ({pendingEvents.length}) <ArrowRight size={13} />
            </Link>
          </div>

          {pendingEvents.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-gray-50 border border-dashed border-gray-300">
              <p className="text-xs text-gray-500">
                All submitted events have been reviewed. No pending moderation tasks.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingEvents.slice(0, 3).map((event) => (
                <div
                  key={event.id}
                  className="p-4 rounded-xl bg-gray-50 border border-gray-200 hover:border-gray-300 flex items-center justify-between gap-4 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-gray-900 truncate">{event.title}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        Pending Approval
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 truncate flex items-center gap-3">
                      <span>{event.club_name}</span>
                      <span>•</span>
                      <span>{event.venue_name}</span>
                      <span>•</span>
                      <span>{event.is_free ? 'Free' : `₹${event.price}`}</span>
                    </div>
                  </div>

                  <Link to="/admin/events">
                    <Button variant="outline" size="sm" className="shrink-0 text-xs">
                      Review
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Admin Quick Shortcuts */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 font-display mb-4">
              Administrative Quick Actions
            </h2>
            <div className="space-y-2.5">
              <Link
                to="/admin/clubs"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 hover:border-blue-300 hover:bg-blue-50/70 transition-all text-xs font-medium text-gray-700 hover:text-gray-900"
              >
                <span>Verify Club Submissions</span>
                <ArrowRight size={14} className="text-blue-600" />
              </Link>
              <Link
                to="/admin/reports"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 hover:border-rose-300 hover:bg-rose-50/70 transition-all text-xs font-medium text-gray-700 hover:text-gray-900"
              >
                <span>Triage Abuse Reports</span>
                <ArrowRight size={14} className="text-rose-600" />
              </Link>
              <Link
                to="/admin/announcements"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/70 transition-all text-xs font-medium text-gray-700 hover:text-gray-900"
              >
                <span>Publish Broadcast Notice</span>
                <ArrowRight size={14} className="text-indigo-600" />
              </Link>
              <Link
                to="/admin/finances"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 hover:border-amber-300 hover:bg-amber-50/70 transition-all text-xs font-medium text-gray-700 hover:text-gray-900"
              >
                <span>Financial & Payment Oversight</span>
                <ArrowRight size={14} className="text-amber-600" />
              </Link>
              <Link
                to="/admin/settings"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 hover:border-gray-300 transition-all text-xs font-medium text-gray-700 hover:text-gray-900"
              >
                <span>Platform Settings & Feature Flags</span>
                <ArrowRight size={14} className="text-gray-400" />
              </Link>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
            <span>FestFlow v2.0 Platform</span>
            <span className="font-mono text-emerald-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Systems Operational
            </span>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={loadData}
            className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors self-start sm:self-auto cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Recent Immutable Audit Activity Feed */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
              <Clock size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 font-display">
                Recent Audit Trail Actions
              </h2>
              <p className="text-xs text-gray-500">Immutable security ledger of privileged operations</p>
            </div>
          </div>
          <Link
            to="/admin/audit-logs"
            className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
          >
            Full Audit Ledger <ArrowRight size={13} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 uppercase font-mono">
                <th className="pb-3 font-semibold">Timestamp</th>
                <th className="pb-3 font-semibold">Administrator</th>
                <th className="pb-3 font-semibold">Action</th>
                <th className="pb-3 font-semibold">Target Entity</th>
                <th className="pb-3 font-semibold">Audit Justification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="py-3 text-gray-500 font-mono">
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-3 font-medium text-gray-900">{log.admin_email}</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono border border-blue-200">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 text-gray-600 font-mono">{log.target_entity}</td>
                  <td className="py-3 text-gray-600 max-w-xs truncate">{log.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  )
}
