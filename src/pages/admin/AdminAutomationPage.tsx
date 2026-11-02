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

  const loadData = async () => {
    setLoading(true)
    try {
      const [m, j] = await Promise.all([
        getAutomationQueueMetrics(),
        getEmailOutboxJobs(statusFilter, 50),
      ])
      setMetrics(m)
      setJobs(j)
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
          className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.08)] hover:bg-[var(--color-surface-3)] transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-[#18CFFC]' : ''} />
          Refresh Queue
        </button>
      }
    >
      <div className="space-y-6">
        {feedback && (
          <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 size={16} />
            {feedback}
          </div>
        )}

        {/* Metric Overview Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.08)] space-y-1">
            <div className="flex items-center justify-between text-amber-400">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Emails Queued
              </span>
              <Clock size={16} />
            </div>
            <div className="text-xl font-black text-[var(--color-text-primary)] font-mono">
              {metrics?.emails_queued ?? 0}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.08)] space-y-1">
            <div className="flex items-center justify-between text-emerald-400">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Emails Sent
              </span>
              <CheckCircle2 size={16} />
            </div>
            <div className="text-xl font-black text-[var(--color-text-primary)] font-mono">
              {metrics?.emails_sent ?? 0}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.08)] space-y-1">
            <div className="flex items-center justify-between text-rose-400">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Failed Jobs
              </span>
              <AlertTriangle size={16} />
            </div>
            <div className="text-xl font-black text-[var(--color-text-primary)] font-mono">
              {metrics?.emails_failed ?? 0}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.08)] space-y-1">
            <div className="flex items-center justify-between text-[#7F1AFB]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Web Push Subs
              </span>
              <Smartphone size={16} />
            </div>
            <div className="text-xl font-black text-[var(--color-text-primary)] font-mono">
              {metrics?.push_subscriptions_count ?? 0}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.08)] space-y-1">
            <div className="flex items-center justify-between text-[#18CFFC]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Active Waitlists
              </span>
              <Layers size={16} />
            </div>
            <div className="text-xl font-black text-[var(--color-text-primary)] font-mono">
              {metrics?.waitlist_active_count ?? 0}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.08)] space-y-1">
            <div className="flex items-center justify-between text-[#ED47FC]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Club Rules
              </span>
              <Zap size={16} />
            </div>
            <div className="text-xl font-black text-[var(--color-text-primary)] font-mono">
              {metrics?.active_automations_count ?? 0}
            </div>
          </div>
        </div>

        {/* Integration Architecture Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.08)] space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#18CFFC]">
              <Mail size={16} /> Resend Transactional Email
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Integrated with <code className="text-[#18CFFC]">email_outbox</code> and Supabase Edge Function <code className="text-white">send-email</code>.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
              <ShieldCheck size={14} /> Production Outbox Active
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.08)] space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#7F1AFB]">
              <Smartphone size={16} /> Browser Web Push API
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Native PushManager registration with <code className="text-[#7F1AFB]">push_subscriptions</code> table storage and permission prompts.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-[#18CFFC] font-semibold">
              <CheckCircle2 size={14} /> ServiceWorker Ready
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.08)] space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <MessageSquare size={16} /> WhatsApp Business Meta API
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Utility template payloads ready for Meta Graph API v21.0 webhook connection with zero unauthorized scrapers.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-semibold">
              <Clock size={14} /> Meta WABA Key Pending
            </div>
          </div>
        </div>

        {/* Email Outbox Jobs Queue */}
        <div className="p-6 rounded-3xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.08)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)] font-display">
                Transactional Email Outbox Log
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Authoritative record of dispatched and pending emails with retry control
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                />
                <input
                  type="text"
                  placeholder="Filter recipient/subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.08)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[#18CFFC]"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.08)] text-xs text-[var(--color-text-secondary)] focus:outline-none focus:border-[#18CFFC]"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-[var(--color-text-muted)]">
              <Loader2 className="w-6 h-6 animate-spin text-[#18CFFC] mx-auto mb-2" />
              Loading outbox queue...
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--color-text-muted)]">
              No email jobs found matching the current filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                    <th className="pb-3 font-semibold">Recipient</th>
                    <th className="pb-3 font-semibold">Subject / Template</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold">Attempts</th>
                    <th className="pb-3 font-semibold">Timestamp</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-surface-2)]">
                  {filteredJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-[var(--color-surface-2)]/40 transition-colors">
                      <td className="py-3 font-mono text-[var(--color-text-primary)]">
                        {job.recipient_email}
                      </td>
                      <td className="py-3">
                        <div className="font-semibold text-[var(--color-text-primary)] truncate max-w-xs">
                          {job.subject || 'FestFlow Transactional Alert'}
                        </div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">
                          {job.template_name || job.template_type || 'default'}
                        </div>
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            job.status === 'sent'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                              : job.status === 'failed'
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td className="py-3 text-[var(--color-text-secondary)] font-mono">
                        {job.attempts ?? job.retry_count ?? 1} / 3
                      </td>
                      <td className="py-3 text-[var(--color-text-muted)]">
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
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white bg-[#18CFFC] hover:opacity-90 transition-opacity flex items-center gap-1 ml-auto cursor-pointer"
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
