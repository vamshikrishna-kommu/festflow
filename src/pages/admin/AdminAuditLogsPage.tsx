// Phase 7: Super Admin Immutable Audit Trail Viewer
import { useState, useEffect } from 'react'
import { Search, Terminal, X } from 'lucide-react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { getAdminAuditLogs } from '@/lib/admin'
import type { AdminAuditLogRecord } from '@/types'
import { Button } from '@/components/ui'

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AdminAuditLogRecord[]>([])
  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState('all')
  const [selectedLog, setSelectedLog] = useState<AdminAuditLogRecord | null>(null)

  const loadData = async () => {
    try {
      const data = await getAdminAuditLogs({ limit: 100 })
      setLogs(data)
    } finally {
      // Done
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
      {/* Search and Entity Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0D0E15] p-3 rounded-2xl border border-white/5">
        <div className="flex items-center gap-2 flex-1">
          <Search size={16} className="text-white/40 ml-2" />
          <input
            type="text"
            placeholder="Search audit trail by administrator, action, or justification reason…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none text-xs text-white placeholder-white/40 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl self-start sm:self-auto overflow-x-auto max-w-full">
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
                ${entityFilter === tab.id ? 'bg-[#18CFFC] text-black font-bold shadow-sm' : 'text-white/60 hover:text-white'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-[#0D0E15] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 text-white/40 uppercase font-mono bg-white/[0.01]">
                <th className="p-4 font-semibold">Timestamp</th>
                <th className="p-4 font-semibold">Administrator</th>
                <th className="p-4 font-semibold">Action</th>
                <th className="p-4 font-semibold">Target Entity & ID</th>
                <th className="p-4 font-semibold">Audit Justification</th>
                <th className="p-4 font-semibold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-white/[0.02]">
                  <td className="p-4 text-white/50 font-mono whitespace-nowrap">
                    <div>{new Date(log.created_at).toLocaleDateString()}</div>
                    <div className="text-[10px] text-white/30">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="p-4 font-medium text-white">{log.admin_email}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded-full bg-white/5 text-[#18CFFC] font-mono border border-white/10 font-semibold">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-4 text-white/70 font-mono">
                    <div className="font-semibold text-white/90">{log.target_entity}</div>
                    <div className="text-[10px] text-white/40 truncate max-w-[120px]">
                      {log.target_record_id || '—'}
                    </div>
                  </td>
                  <td className="p-4 text-white/70 max-w-sm truncate">{log.reason || '—'}</td>
                  <td className="p-4 text-right">
                    {(log.previous_state || log.new_state || log.metadata) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-white/60 hover:text-white"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#0D0E15] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2 text-white font-display font-bold">
                <Terminal size={18} className="text-[#18CFFC]" />
                <span>Audit Record Inspector: {selectedLog.action}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-xs text-white/70 space-y-1">
              <div><strong>Admin:</strong> {selectedLog.admin_email}</div>
              <div><strong>Justification Reason:</strong> {selectedLog.reason || 'None provided'}</div>
              <div><strong>Timestamp:</strong> {new Date(selectedLog.created_at).toISOString()}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-[#08080A] p-3 rounded-xl border border-white/5">
                <div className="text-white/40 mb-1">Previous State:</div>
                <pre className="text-white/70 text-[11px] overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(selectedLog.previous_state || {}, null, 2)}
                </pre>
              </div>

              <div className="bg-[#08080A] p-3 rounded-xl border border-white/5">
                <div className="text-emerald-400 mb-1">New State:</div>
                <pre className="text-emerald-300 text-[11px] overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(selectedLog.new_state || {}, null, 2)}
                </pre>
              </div>
            </div>

            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
              <div className="bg-[#08080A] p-3 rounded-xl border border-white/5 text-xs font-mono">
                <div className="text-white/40 mb-1">Request Metadata:</div>
                <pre className="text-white/60 text-[11px] overflow-x-auto whitespace-pre-wrap">
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
