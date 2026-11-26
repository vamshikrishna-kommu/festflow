// Phase 7: Super Admin Immutable Audit Trail Viewer
import { useState, useEffect } from 'react'
import { AlertTriangle, Search, Terminal, X } from 'lucide-react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { getAdminAuditLogs } from '@/lib/admin'
import type { AdminAuditLogRecord } from '@/types'
import { Button } from '@/components/ui'

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AdminAuditLogRecord[]>([])
  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState('all')
  const [selectedLog, setSelectedLog] = useState<AdminAuditLogRecord | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadData = async () => {
    setLoadError(null)
    try {
      const data = await getAdminAuditLogs({ limit: 100 })
      setLogs(data)
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load security audit logs.')
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredLogs = logs.filter((log) => {
    if (entityFilter !== 'all' && log.target_entity !== entityFilter) return false
    if (!search) return true
    const s = search.toLowerCase()
    return (
      log.action.toLowerCase().includes(s) ||
      log.admin_email.toLowerCase().includes(s) ||
      log.target_entity.toLowerCase().includes(s) ||
      log.reason?.toLowerCase().includes(s)
    )
  })

  return (
    <AdminLayout
      title="Immutable Security Audit Logs"
      subtitle="Complete, tamper-evident chronological ledger of all administrative decisions, status updates, and financial overrides."
    >
      {loadError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            <span>{loadError}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>
            Retry
          </Button>
        </div>
      )}

      {/* Search and Entity Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-2 flex-1">
          <Search size={16} className="text-gray-400 ml-2" />
          <input
            type="text"
            placeholder="Search audit trail by administrator, action, or justification reason…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none text-xs text-gray-900 placeholder-gray-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl self-start sm:self-auto overflow-x-auto max-w-full">
          {[
            { id: 'all', label: 'All Entities' },
            { id: 'events', label: 'Events' },
            { id: 'club_profiles', label: 'Clubs' },
            { id: 'profiles', label: 'Students' },
            { id: 'colleges', label: 'Colleges' },
            { id: 'payment_submissions', label: 'Payments' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setEntityFilter(tab.id)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap
                ${entityFilter === tab.id ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'text-gray-600 hover:text-gray-900'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 uppercase font-mono bg-gray-50">
                <th className="p-4 font-semibold">Timestamp</th>
                <th className="p-4 font-semibold">Administrator</th>
                <th className="p-4 font-semibold">Action</th>
                <th className="p-4 font-semibold">Target Entity & ID</th>
                <th className="p-4 font-semibold">Audit Justification</th>
                <th className="p-4 font-semibold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="p-4 text-gray-500 font-mono whitespace-nowrap">
                    <div>{new Date(log.created_at).toLocaleDateString()}</div>
                    <div className="text-[10px] text-gray-400">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="p-4 font-medium text-gray-900">{log.admin_email}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-mono border border-blue-200 font-semibold">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-4 text-gray-600 font-mono">
                    <div className="font-semibold text-gray-900">{log.target_entity}</div>
                    <div className="text-[10px] text-gray-500 truncate max-w-[120px]">
                      {log.target_record_id || '—'}
                    </div>
                  </td>
                  <td className="p-4 text-gray-600 max-w-sm truncate">{log.reason || '—'}</td>
                  <td className="p-4 text-right">
                    {(log.previous_state || log.new_state || log.metadata) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-gray-600 hover:text-gray-900"
                        onClick={() => setSelectedLog(log)}
                      >
                        Inspect Diff
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect State Diff Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white border border-gray-200 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <div className="flex items-center gap-2 text-gray-900 font-display font-bold">
                <Terminal size={18} className="text-blue-600" />
                <span>Audit Record Inspector: {selectedLog.action}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-xs text-gray-600 space-y-1">
              <div><strong className="text-gray-900">Admin:</strong> {selectedLog.admin_email}</div>
              <div><strong className="text-gray-900">Justification Reason:</strong> {selectedLog.reason || 'None provided'}</div>
              <div><strong className="text-gray-900">Timestamp:</strong> {new Date(selectedLog.created_at).toISOString()}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                <div className="text-gray-500 mb-1">Previous State:</div>
                <pre className="text-gray-700 text-[11px] overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(selectedLog.previous_state || {}, null, 2)}
                </pre>
              </div>

              <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
                <div className="text-emerald-700 font-semibold mb-1">New State:</div>
                <pre className="text-emerald-900 text-[11px] overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(selectedLog.new_state || {}, null, 2)}
                </pre>
              </div>
            </div>

            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs font-mono">
                <div className="text-gray-500 mb-1">Request Metadata:</div>
                <pre className="text-gray-700 text-[11px] overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
