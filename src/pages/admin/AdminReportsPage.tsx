// Phase 7: Super Admin Abuse & Community Reports Management Page
import { useState, useEffect } from 'react'
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { AdminConfirmModal } from '@/components/admin/AdminConfirmModal'
import { getAdminReports, resolveAdminReport } from '@/lib/admin'
import type { AdminReportRecord } from '@/types'
import { Button } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'

export default function AdminReportsPage() {
  const { profile } = useAuth()
  const adminEmail = profile?.email || 'platform_admin'

  const [reports, setReports] = useState<AdminReportRecord[]>([])
  const [filter, setFilter] = useState('all')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Resolution Modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [targetReport, setTargetReport] = useState<AdminReportRecord | null>(null)
  const [targetStatus, setTargetStatus] = useState<'resolved' | 'dismissed'>('resolved')

  const loadData = async () => {
    setLoadError(null)
    try {
      const data = await getAdminReports(filter)
      setReports(data)
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load moderation reports.')
    }
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
    setActionError(null)
    try {
      const res = await resolveAdminReport(targetReport.id, targetStatus, actionTaken, reason, adminEmail)
      if (res && res.success === false) {
        setActionError(res.error || 'Failed to update report status.')
        return
      }
      setConfirmModalOpen(false)
      setTargetReport(null)
      await loadData()
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update report status.')
    }
  }

  return (
    <AdminLayout
      title="Abuse, Spam & Content Reports"
      subtitle="Investigate student and organizer community complaints, prevent harassment, and maintain safe campus standards."
    >
      {(loadError || actionError) && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            <span>{actionError || loadError}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>
            Retry
          </Button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-white p-2 rounded-2xl border border-gray-200 shadow-xs w-fit flex-wrap">
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
              ${filter === tab.id ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'text-gray-600 hover:text-gray-900'}
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Reports Desk */}
      <div className="grid grid-cols-1 gap-4">
        {loadError && reports.length === 0 ? null : reports.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white border border-dashed border-gray-300">
            <ShieldAlert size={32} className="mx-auto text-gray-400 mb-3" />
            <h3 className="text-sm font-semibold text-gray-900">No active incident reports</h3>
            <p className="text-xs text-gray-500 mt-1">There are no reports matching the selected status filter.</p>
          </div>
        ) : (
          reports.map((report) => (
            <div
              key={report.id}
              className="p-5 rounded-2xl bg-white border border-gray-200 hover:border-gray-300 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4 shadow-xs"
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 uppercase">
                    {report.target_type}
                  </span>
                  <span className="text-sm font-bold text-gray-900">{report.target_title || report.target_id}</span>
                  <span
                    className={`
                      text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full uppercase border
                      ${
                        report.status === 'pending'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : report.status === 'resolved'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-gray-100 text-gray-600 border-gray-200'
                      }
                    `}
                  >
                    {report.status}
                  </span>
                </div>

                <div className="text-xs text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <div className="font-semibold text-rose-700 mb-0.5">Report Reason: {report.reason}</div>
                  {report.details && <div className="text-gray-600 mt-1">{report.details}</div>}
                </div>

                <div className="text-[11px] text-gray-500 font-mono flex items-center gap-4">
                  <span>Reported on: {new Date(report.created_at).toLocaleString()}</span>
                  {report.action_taken && <span className="text-emerald-700">Resolution: {report.action_taken}</span>}
                </div>
              </div>

              {/* Action Buttons */}
              {report.status !== 'resolved' && report.status !== 'dismissed' && (
                <div className="flex sm:flex-col gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    onClick={() => promptResolution(report, 'resolved')}
                  >
                    Resolve & Moderate
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-gray-600 hover:text-gray-900"
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
