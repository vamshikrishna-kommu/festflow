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
  QrCode,
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

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [m, logs, evts] = await Promise.all([
        getPlatformMetrics(),
        getAdminAuditLogs({ limit: 6 }),
        getAdminEvents('pending_approval'),
      ])
      setMetrics(m)
      setRecentLogs(logs)
      setPendingEvents(evts)
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
          delta="+14% this month"
          trend="up"
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
          title="Turnstile Check-ins"
          value={metrics?.total_check_ins ?? '—'}
          icon={QrCode}
          color="emerald"
          subtitle="Verified gate entrances"
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
        <div className="lg:col-span-2 bg-[#0D0E15] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <AlertCircle size={16} />
              </div>
              <h2 className="text-base font-bold text-white font-display">
                Event Moderation Queue
              </h2>
            </div>
            <Link
              to="/admin/events"
              className="text-xs font-semibold text-[#18CFFC] hover:underline flex items-center gap-1"
            >
              View Queue ({pendingEvents.length}) <ArrowRight size={13} />
            </Link>
          </div>

          {pendingEvents.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-white/[0.02] border border-dashed border-white/10">
              <p className="text-xs text-white/50">
                All submitted events have been reviewed. No pending moderation tasks.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingEvents.slice(0, 3).map((event) => (
                <div
                  key={event.id}
                  className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 flex items-center justify-between gap-4 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-white truncate">{event.title}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        Pending Approval
                      </span>
                    </div>
                    <div className="text-xs text-white/50 truncate flex items-center gap-3">
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
        <div className="bg-[#0D0E15] border border-white/5 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white font-display mb-4">
              Administrative Quick Actions
            </h2>
            <div className="space-y-2.5">
              <Link
                to="/admin/clubs"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#18CFFC]/30 hover:bg-[#18CFFC]/5 transition-all text-xs font-medium text-white/80"
              >
                <span>Verify Club Submissions</span>
                <ArrowRight size={14} className="text-[#18CFFC]" />
              </Link>
              <Link
                to="/admin/reports"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-rose-500/30 hover:bg-rose-500/5 transition-all text-xs font-medium text-white/80"
              >
                <span>Triage Abuse Reports</span>
                <ArrowRight size={14} className="text-rose-400" />
              </Link>
              <Link
                to="/admin/announcements"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#7F1AFB]/30 hover:bg-[#7F1AFB]/5 transition-all text-xs font-medium text-white/80"
              >
                <span>Publish Broadcast Notice</span>
                <ArrowRight size={14} className="text-[#7F1AFB]" />
              </Link>
              <Link
                to="/admin/finances"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all text-xs font-medium text-white/80"
              >
                <span>Financial & Payment Oversight</span>
                <ArrowRight size={14} className="text-amber-400" />
              </Link>
              <Link
                to="/admin/settings"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/20 transition-all text-xs font-medium text-white/80"
              >
                <span>Platform Settings & Feature Flags</span>
                <ArrowRight size={14} className="text-white/40" />
              </Link>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between text-xs text-white/40">
            <span>FestFlow v2.0 Platform</span>
            <span className="font-mono text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Systems Operational
            </span>
          </div>
        </div>
      </div>

      {/* Recent Immutable Audit Activity Feed */}
      <div className="bg-[#0D0E15] border border-white/5 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#18CFFC]/10 border border-[#18CFFC]/20 text-[#18CFFC] flex items-center justify-center">
              <Clock size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                Recent Audit Trail Actions
              </h2>
              <p className="text-xs text-white/50">Immutable security ledger of privileged operations</p>
            </div>
          </div>
          <Link
            to="/admin/audit-logs"
            className="text-xs font-semibold text-[#18CFFC] hover:underline flex items-center gap-1"
          >
            Full Audit Ledger <ArrowRight size={13} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 text-white/40 uppercase font-mono">
                <th className="pb-3 font-semibold">Timestamp</th>
                <th className="pb-3 font-semibold">Administrator</th>
                <th className="pb-3 font-semibold">Action</th>
                <th className="pb-3 font-semibold">Target Entity</th>
                <th className="pb-3 font-semibold">Audit Justification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentLogs.map((log) => (
                <tr key={log.id} className="hover:bg-white/[0.02]">
                  <td className="py-3 text-white/50 font-mono">
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-3 font-medium text-white">{log.admin_email}</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded-full bg-white/5 text-[#18CFFC] font-mono border border-white/10">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 text-white/60 font-mono">{log.target_entity}</td>
                  <td className="py-3 text-white/70 max-w-xs truncate">{log.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  )
}
