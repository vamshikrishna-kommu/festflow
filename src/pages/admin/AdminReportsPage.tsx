// Phase 7: Super Admin Abuse & Community Reports Management Page
import { useState, useEffect } from 'react'
import { ShieldAlert } from 'lucide-react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { AdminConfirmModal } from '@/components/admin/AdminConfirmModal'
import { getAdminReports, resolveAdminReport } from '@/lib/admin'
import type { AdminReportRecord } from '@/types'
import { Button } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'

export default function AdminReportsPage() {
  const { profile } = useAuth()
  const adminEmail = profile?.email || 'admin@festflow.online'

  const [reports, setReports] = useState<AdminReportRecord[]>([])
  const [filter, setFilter] = useState('all')

  // Resolution Modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [targetReport, setTargetReport] = useState<AdminReportRecord | null>(null)
  const [targetStatus, setTargetStatus] = useState<'resolved' | 'dismissed'>('resolved')

  const loadData = async () => {
    const data = await getAdminReports(filter)
    setReports(data)
  }

  useEffect(() => {
    loadData()
  }, [filter])

  const promptResolution = (report: AdminReportRecord, status: 'resolved' | 'dismissed') => {
    setTargetReport(report)
    setTargetStatus(status)
    setConfirmModalOpen(true)
  }

  const handleConfirmResolution = async (reason: string) => {
    if (!targetReport) return
    const actionTaken = targetStatus === 'resolved' ? 'Content moderated and warning issued' : 'Report dismissed after investigation'
    await resolveAdminReport(targetReport.id, targetStatus, actionTaken, reason, adminEmail)
    setConfirmModalOpen(false)
    setTargetReport(null)
    loadData()
  }

  return (
    <AdminLayout
      title="Abuse, Spam & Content Reports"
      subtitle="Investigate student and organizer community complaints, prevent harassment, and maintain safe campus standards."
    >
      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-[#0D0E15] p-2 rounded-2xl border border-white/5 w-fit">
        {[
          { id: 'all', label: 'All Reports' },
          { id: 'pending', label: 'Pending Review' },
          { id: 'investigating', label: 'Under Investigation' },
          { id: 'resolved', label: 'Resolved' },
          { id: 'dismissed', label: 'Dismissed' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`
              px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all
              ${filter === tab.id ? 'bg-[#18CFFC] text-black font-bold shadow-sm' : 'text-white/60 hover:text-white'}
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Reports Desk */}
      <div className="grid grid-cols-1 gap-4">
        {reports.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#0D0E15] border border-dashed border-white/10">
            <ShieldAlert size={32} className="mx-auto text-white/30 mb-3" />
            <h3 className="text-sm font-semibold text-white">No active incident reports</h3>
            <p className="text-xs text-white/50 mt-1">There are no reports matching the selected status filter.</p>
          </div>
        ) : (
          reports.map((report) => (
            <div
              key={report.id}
              className="p-5 rounded-2xl bg-[#0D0E15] border border-white/5 hover:border-white/10 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4"
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase">
                    {report.target_type}
                  </span>
                  <span className="text-sm font-bold text-white">{report.target_title || report.target_id}</span>
                  <span
                    className={`
                      text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full uppercase border
                      ${
                        report.status === 'pending'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : report.status === 'resolved'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-white/10 text-white/60 border-white/10'
                      }
                    `}
                  >
                    {report.status}
                  </span>
                </div>

                <div className="text-xs text-white/80 bg-white/[0.02] p-3 rounded-xl border border-white/5">
                  <div className="font-semibold text-rose-300 mb-0.5">Report Reason: {report.reason}</div>
                  {report.details && <div className="text-white/60 mt-1">{report.details}</div>}
                </div>

                <div className="text-[11px] text-white/40 font-mono flex items-center gap-4">
                  <span>Reported on: {new Date(report.created_at).toLocaleString()}</span>
                  {report.action_taken && <span className="text-emerald-400">Resolution: {report.action_taken}</span>}
                </div>
              </div>

              {/* Action Buttons */}
              {report.status !== 'resolved' && report.status !== 'dismissed' && (
                <div className="flex sm:flex-col gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                    onClick={() => promptResolution(report, 'resolved')}
                  >
                    Resolve & Moderate
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-white/60 hover:text-white"
                    onClick={() => promptResolution(report, 'dismissed')}
                  >
                    Dismiss Report
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <AdminConfirmModal
        isOpen={confirmModalOpen}
        title={targetStatus === 'resolved' ? 'Resolve & Log Action for Incident?' : 'Dismiss Abuse Report?'}
        description={`Target item: ${targetReport?.target_title || targetReport?.target_id}. Provide an audit note explaining the decision.`}
        confirmLabel={targetStatus === 'resolved' ? 'Resolve Report' : 'Dismiss Report'}
        confirmVariant={targetStatus === 'resolved' ? 'primary' : 'danger'}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleConfirmResolution}
      />
    </AdminLayout>
  )
}
