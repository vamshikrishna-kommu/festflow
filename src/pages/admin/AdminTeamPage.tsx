// Phase 7: Super Admin Team & Granular Permission Management Page
import React, { useState, useEffect } from 'react'
import { KeyRound, Check, AlertCircle } from 'lucide-react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { getAdminTeam, updateAdminRole, bootstrapInitialSuperAdmin } from '@/lib/admin'
import type { PlatformAdminRecord, AdminRole, AdminPermission } from '@/types'
import { Button } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'

const ALL_PERMISSIONS: { id: AdminPermission; label: string; desc: string }[] = [
  { id: 'manage_colleges', label: 'College Directory', desc: 'Add, verify and suspend institutions' },
  { id: 'verify_clubs', label: 'Club Verification', desc: 'Grant official club badges & suspend' },
  { id: 'moderate_events', label: 'Event Moderation', desc: 'Approve, reject, and unpublish fests' },
  { id: 'review_reports', label: 'Abuse & Reports', desc: 'Investigate student & community complaints' },
  { id: 'manage_announcements', label: 'Announcements', desc: 'Broadcast notices to campus feeds' },
  { id: 'view_analytics', label: 'Analytics & Metrics', desc: 'Access platform health & metrics' },
  { id: 'manage_settings', label: 'Platform Settings', desc: 'Modify maintenance and operational toggles' },
  { id: 'manage_finances', label: 'Financial Oversight', desc: 'Inspect UPI submissions & dispute overrides' },
  { id: 'manage_admins', label: 'Admin Team Access', desc: 'Invite and modify administrator permissions' },
]

export default function AdminTeamPage() {
  const { profile } = useAuth()
  const currentAdminEmail = profile?.email || 'platform_admin'

  const [team, setTeam] = useState<PlatformAdminRecord[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [bootstrapEmail, setBootstrapEmail] = useState('')
  const [bootstrapMessage, setBootstrapMessage] = useState<string | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(false)

  // Edit Permissions Modal
  const [editAdmin, setEditAdmin] = useState<PlatformAdminRecord | null>(null)
  const [selectedRole, setSelectedRole] = useState<AdminRole>('platform_moderator')
  const [selectedPermissions, setSelectedPermissions] = useState<AdminPermission[]>([])

  const loadData = async () => {
    setLoadError(null)
    try {
      const list = await getAdminTeam()
      setTeam(list)
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load administrator roster.')
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleEditPermissions = (adm: PlatformAdminRecord) => {
    setEditAdmin(adm)
    setSelectedRole(adm.role)
    setSelectedPermissions(adm.permissions || [])
  }

  const togglePermission = (perm: AdminPermission) => {
    if (selectedPermissions.includes(perm)) {
      setSelectedPermissions(selectedPermissions.filter((p) => p !== perm))
    } else {
      setSelectedPermissions([...selectedPermissions, perm])
    }
  }

  const handleSavePermissions = async () => {
    if (!editAdmin) return
    setActionError(null)
    try {
      const res = await updateAdminRole(editAdmin.id, selectedRole, selectedPermissions, currentAdminEmail)
      if (res && res.success === false) {
        setActionError(res.error || 'Failed to update administrator permissions.')
        return
      }
      setEditAdmin(null)
      await loadData()
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update administrator permissions.')
    }
  }

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bootstrapEmail.trim()) return

    try {
      setIsBootstrapping(true)
      const res = await bootstrapInitialSuperAdmin(bootstrapEmail)
      setBootstrapMessage(res.message)
      if (res.success) {
        setBootstrapEmail('')
        loadData()
      }
    } catch (err: any) {
      setBootstrapMessage(err?.message || 'Failed to add platform administrator.')
    } finally {
      setIsBootstrapping(false)
    }
  }

  return (
    <AdminLayout
      title="Administrator Team & Role Delegations"
      subtitle="Manage granular administrative privileges across Super Admins, Platform Moderators, and Support staff."
    >
      {(loadError || actionError) && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{actionError || loadError}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadData}>
            Retry
          </Button>
        </div>
      )}

      {/* Admin Accounts Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-8 shadow-xs">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900 font-display">Active Administrative Staff</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 uppercase font-mono bg-gray-50">
                <th className="p-4 font-semibold">Administrator</th>
                <th className="p-4 font-semibold">Administrative Role</th>
                <th className="p-4 font-semibold">Assigned Permissions</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {team.map((adm) => (
                <tr key={adm.id} className="hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-900">
                    <div className="font-semibold text-gray-900">{adm.profile?.display_name || 'Administrator'}</div>
                    <div className="text-[11px] text-gray-500 font-mono">{adm.profile?.email || '—'}</div>
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                      {adm.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-4 text-gray-600">
                    <div className="font-mono text-[11px] text-gray-700">
                      {adm.permissions.length} active permissions
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Active
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleEditPermissions(adm)}
                    >
                      Configure Permissions
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Initial Bootstrap Protocol Section */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
            <KeyRound size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 font-display">
              Initial Super Admin Bootstrap Protocol
            </h3>
            <p className="text-xs text-gray-600 mt-0.5 max-w-2xl leading-relaxed">
              If setting up a fresh FestFlow installation where no Super Admin exists yet, promote the first registered account. Once an administrator is provisioned, this protocol is permanently closed by server-side constraints.
            </p>
          </div>
        </div>

        {bootstrapMessage && (
          <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-center gap-2">
            <AlertCircle size={14} className="text-blue-600" />
            <span>{bootstrapMessage}</span>
          </div>
        )}

        <form onSubmit={handleBootstrap} className="flex flex-col sm:flex-row items-stretch gap-3 max-w-xl">
          <input
            type="email"
            required
            placeholder="Enter registered user email to promote…"
            value={bootstrapEmail}
            onChange={(e) => setBootstrapEmail(e.target.value)}
            className="flex-1 p-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
          />
          <Button variant="primary" size="sm" type="submit" disabled={isBootstrapping}>
            {isBootstrapping ? 'Promoting…' : 'Execute Bootstrap'}
          </Button>
        </form>
      </div>

      {/* Edit Permissions Modal */}
      {editAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-white border border-gray-200 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900 font-display">
              Configure Role & Permissions: {editAdmin.profile?.display_name || 'Administrator'}
            </h3>

            <div>
              <label className="text-xs text-gray-700 font-medium block mb-1">Administrative Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as AdminRole)}
                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
              >
                <option value="super_admin">Super Admin (Unrestricted platform access)</option>
                <option value="platform_moderator">Platform Moderator (Events, clubs, reports)</option>
                <option value="college_admin">College Administrator (Colleges and campus fests)</option>
                <option value="support_admin">Support Administrator (Read-only & reports)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-700 font-medium block mb-2">Granular Feature Permissions</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ALL_PERMISSIONS.map((perm) => {
                  const isChecked = selectedPermissions.includes(perm.id)
                  return (
                    <div
                      key={perm.id}
                      onClick={() => togglePermission(perm.id)}
                      className={`
                        p-3 rounded-xl border text-xs cursor-pointer select-none transition-all flex items-start gap-2.5
                        ${
                          isChecked
                            ? 'bg-blue-50/70 border-blue-300 text-gray-900'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }
                      `}
                    >
                      <div
                        className={`
                          w-4 h-4 rounded border flex items-center justify-center mt-0.5 shrink-0 transition-colors
                          ${isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 bg-white'}
                        `}
                      >
                        {isChecked && <Check size={11} strokeWidth={3} />}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{perm.label}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{perm.desc}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
              <Button variant="ghost" size="sm" onClick={() => setEditAdmin(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleSavePermissions}>
                Save Permissions
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
