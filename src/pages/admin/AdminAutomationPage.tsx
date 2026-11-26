import { useState, useEffect } from 'react'
import {
  Zap,
  Mail,
  Smartphone,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  MessageSquare,
  ShieldCheck,
  Loader2,
} from 'lucide-react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import {
  getAutomationQueueMetrics,
  getEmailOutboxJobs,
  retryFailedEmailJob,
} from '@/lib/notifications'
import type { AutomationQueueMetrics } from '@/types'

export default function AdminAutomationPage() {
  const [metrics, setMetrics] = useState<AutomationQueueMetrics | null>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)

  const [loadError, setLoadError] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [m, j] = await Promise.all([
        getAutomationQueueMetrics(),
        getEmailOutboxJobs(statusFilter, 50),
      ])
      setMetrics(m)
      setJobs(j)
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load automation queue metrics and jobs.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [statusFilter])

  const handleRetry = async (jobId: string) => {
    setRetryingId(jobId)
    const res = await retryFailedEmailJob(jobId)
    setRetryingId(null)
    if (res.success) {
      setFeedback('Job requeued successfully.')
      setTimeout(() => setFeedback(null), 2500)
      loadData()
    }
  }

  const filteredJobs = jobs.filter((j) => {
    if (!searchQuery.trim()) return true
    const term = searchQuery.toLowerCase()
    return (
      (j.recipient_email || '').toLowerCase().includes(term) ||
      (j.subject || '').toLowerCase().includes(term) ||
      (j.template_name || '').toLowerCase().includes(term)
    )
  })

  return (
    <AdminLayout
      title="Notifications & Automation Operations"
      subtitle="Super Admin oversight of transactional email outbox, web push deliveries, and event cron engines"
      actions={
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-blue-600' : ''} />
          Refresh Queue
        </button>
      }
    >
      <div className="space-y-6">
        {loadError && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-600 shrink-0" />
              <span>{loadError}</span>
            </div>
            <button
              type="button"
              onClick={loadData}
              className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors self-start sm:self-auto cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {feedback && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            {feedback}
          </div>
        )}

        {/* Metric Overview Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-amber-600">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Emails Queued
              </span>
              <Clock size={16} />
            </div>
            <div className="text-xl font-black text-gray-900 font-mono">
              {metrics?.emails_queued ?? 0}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-emerald-600">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Emails Sent
              </span>
              <CheckCircle2 size={16} />
            </div>
            <div className="text-xl font-black text-gray-900 font-mono">
              {metrics?.emails_sent ?? 0}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-rose-600">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Failed Jobs
              </span>
              <AlertTriangle size={16} />
            </div>
            <div className="text-xl font-black text-gray-900 font-mono">
              {metrics?.emails_failed ?? 0}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-indigo-600">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Web Push Subs
              </span>
              <Smartphone size={16} />
            </div>
            <div className="text-xl font-black text-gray-900 font-mono">
              {metrics?.push_subscriptions_count ?? 0}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-blue-600">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Active Waitlists
              </span>
              <Layers size={16} />
            </div>
            <div className="text-xl font-black text-gray-900 font-mono">
              {metrics?.waitlist_active_count ?? 0}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between text-purple-600">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Club Rules
              </span>
              <Zap size={16} />
            </div>
            <div className="text-xl font-black text-gray-900 font-mono">
              {metrics?.active_automations_count ?? 0}
            </div>
          </div>
        </div>

        {/* Integration Architecture Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600">
              <Mail size={16} /> Resend Transactional Email
            </div>
            <p className="text-xs text-gray-600">
              Integrated with <code className="text-blue-700 font-semibold">email_outbox</code> and Supabase Edge Function <code className="text-gray-900 bg-gray-100 px-1 py-0.5 rounded font-semibold">send-email</code>.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold">
              <ShieldCheck size={14} /> Production Outbox Active
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-600">
              <Smartphone size={16} /> Browser Web Push API
            </div>
            <p className="text-xs text-gray-600">
              Native PushManager registration with <code className="text-indigo-700 font-semibold">push_subscriptions</code> table storage and permission prompts.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-blue-600 font-semibold">
              <CheckCircle2 size={14} /> ServiceWorker Ready
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
              <MessageSquare size={16} /> WhatsApp Business Meta API
            </div>
            <p className="text-xs text-gray-600">
              Utility template payloads ready for Meta Graph API v21.0 webhook connection with zero unauthorized scrapers.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-amber-700 font-semibold">
              <Clock size={14} /> Meta WABA Key Pending
            </div>
          </div>
        </div>

        {/* Email Outbox Jobs Queue */}
        <div className="p-6 rounded-3xl bg-white border border-gray-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900 font-display">
                Transactional Email Outbox Log
              </h3>
              <p className="text-xs text-gray-500">
                Authoritative record of dispatched and pending emails with retry control
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Filter recipient/subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-700 focus:outline-none focus:border-blue-600"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
              Loading outbox queue...
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-500">
              No email jobs found matching the current filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="pb-3 font-semibold">Recipient</th>
                    <th className="pb-3 font-semibold">Subject / Template</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold">Attempts</th>
                    <th className="pb-3 font-semibold">Timestamp</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 font-mono text-gray-900">
                        {job.recipient_email}
                      </td>
                      <td className="py-3">
                        <div className="font-semibold text-gray-900 truncate max-w-xs">
                          {job.subject || 'FestFlow Transactional Alert'}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {job.template_name || job.template_type || 'default'}
                        </div>
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            job.status === 'sent'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : job.status === 'failed'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="py-3 text-gray-600 font-mono">
                        {job.attempts ?? job.retry_count ?? 1} / 3
                      </td>
                      <td className="py-3 text-gray-500">
                        {new Date(job.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 text-right">
                        {job.status === 'failed' && (
                          <button
                            type="button"
                            onClick={() => handleRetry(job.id)}
                            disabled={retryingId === job.id}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-1 ml-auto cursor-pointer"
                          >
                            <RotateCcw size={12} className={retryingId === job.id ? 'animate-spin' : ''} />
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
