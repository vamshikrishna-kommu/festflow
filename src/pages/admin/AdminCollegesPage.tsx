// Phase 7: Super Admin College Management Page
import React, { useState, useEffect } from 'react'
import { Plus, Search, Building2, Globe } from 'lucide-react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { AdminConfirmModal } from '@/components/admin/AdminConfirmModal'
import { getColleges, saveCollege, updateCollegeStatus } from '@/lib/admin'
import type { CollegeRecord, CollegeStatus } from '@/types'
import { Button } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'

export default function AdminCollegesPage() {
  const { profile } = useAuth()
  const adminEmail = profile?.email || 'admin@festflow.online'

  const [colleges, setColleges] = useState<CollegeRecord[]>([])
  const [search, setSearch] = useState('')

  // Add/Edit Modal
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [currentCollege, setCurrentCollege] = useState<Partial<CollegeRecord> | null>(null)

  // Status Confirm Modal
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [targetCollege, setTargetCollege] = useState<CollegeRecord | null>(null)
  const [targetStatus, setTargetStatus] = useState<CollegeStatus>('active')

  const loadData = async () => {
    const data = await getColleges(search)
    setColleges(data)
  }

  useEffect(() => {
    loadData()
  }, [search])

  const handleSaveCollege = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentCollege?.name?.trim()) return

    await saveCollege(currentCollege, adminEmail)
    setEditModalOpen(false)
    setCurrentCollege(null)
    loadData()
  }

  const promptStatusChange = (college: CollegeRecord, newStatus: CollegeStatus) => {
    setTargetCollege(college)
    setTargetStatus(newStatus)
    setStatusModalOpen(true)
  }

  const confirmStatusChange = async (reason: string) => {
    if (!targetCollege) return
    await updateCollegeStatus(targetCollege.id, targetStatus, reason, adminEmail)
    setStatusModalOpen(false)
    setTargetCollege(null)
    loadData()
  }

  return (
    <AdminLayout
      title="Colleges & Universities Directory"
      subtitle="Manage institutional accreditations, verified domains, campus affiliations, and access controls."
      actions={
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setCurrentCollege({ country: 'India', status: 'active' })
            setEditModalOpen(true)
          }}
          leftIcon={<Plus size={15} />}
        >
          Add Educational Institution
        </Button>
      }
    >
      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-[#0D0E15] p-3 rounded-2xl border border-white/5">
        <Search size={16} className="text-white/40 ml-2" />
        <input
          type="text"
          placeholder="Filter colleges by name, code or city…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent border-none text-xs text-white placeholder-white/40 focus:outline-none"
        />
      </div>

      {/* Colleges Table */}
      <div className="bg-[#0D0E15] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 text-white/40 uppercase font-mono bg-white/[0.01]">
                <th className="p-4 font-semibold">Institution Name</th>
                <th className="p-4 font-semibold">Code / Domain</th>
                <th className="p-4 font-semibold">Location</th>
                <th className="p-4 font-semibold">Clubs & Students</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {colleges.map((col) => (
                <tr key={col.id} className="hover:bg-white/[0.02]">
                  <td className="p-4 font-medium text-white flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#18CFFC]/10 border border-[#18CFFC]/20 text-[#18CFFC] flex items-center justify-center shrink-0">
                      <Building2 size={16} />
                    </div>
                    <div>
                      <div className="font-semibold">{col.name}</div>
                      {col.website && (
                        <a
                          href={col.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-white/40 hover:text-[#18CFFC] flex items-center gap-1 mt-0.5"
                        >
                          <Globe size={11} /> {col.website.replace('https://', '')}
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-white/70 font-mono">
                    <div>{col.code || '—'}</div>
                    <div className="text-[10px] text-white/40">{col.domain || 'All domains'}</div>
                  </td>
                  <td className="p-4 text-white/60">
                    {col.city ? `${col.city}, ${col.state || col.country}` : col.country}
                  </td>
                  <td className="p-4 text-white/70 font-mono">
                    <span>{col.club_count ?? 0} clubs</span>
                    <span className="text-white/30 mx-1.5">•</span>
                    <span>{col.student_count ?? 0} students</span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`
                        px-2.5 py-0.5 rounded-full font-mono text-[10px] font-semibold uppercase border
                        ${
                          col.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : col.status === 'suspended'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }
                      `}
                    >
                      {col.status}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setCurrentCollege(col)
                        setEditModalOpen(true)
                      }}
                    >
                      Edit
                    </Button>
                    {col.status === 'active' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                        onClick={() => promptStatusChange(col, 'suspended')}
                      >
                        Suspend
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                        onClick={() => promptStatusChange(col, 'active')}
                      >
                        Reactivate
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit College Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0D0E15] border border-white/10 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white font-display mb-4">
              {currentCollege?.id ? 'Edit College Details' : 'Add Educational Institution'}
            </h3>
            <form onSubmit={handleSaveCollege} className="space-y-4 text-xs">
              <div>
                <label className="text-white/70 block mb-1">Institution Full Name *</label>
                <input
                  type="text"
                  required
                  value={currentCollege?.name || ''}
                  onChange={(e) => setCurrentCollege({ ...currentCollege, name: e.target.value })}
                  placeholder="e.g. National Institute of Technology, Warangal"
                  className="w-full p-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#18CFFC]/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/70 block mb-1">Short Code</label>
                  <input
                    type="text"
                    value={currentCollege?.code || ''}
                    onChange={(e) => setCurrentCollege({ ...currentCollege, code: e.target.value })}
                    placeholder="e.g. NITW"
                    className="w-full p-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#18CFFC]/50"
                  />
                </div>
                <div>
                  <label className="text-white/70 block mb-1">Official Domain</label>
                  <input
                    type="text"
                    value={currentCollege?.domain || ''}
                    onChange={(e) => setCurrentCollege({ ...currentCollege, domain: e.target.value })}
                    placeholder="e.g. nitw.ac.in"
                    className="w-full p-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#18CFFC]/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/70 block mb-1">City</label>
                  <input
                    type="text"
                    value={currentCollege?.city || ''}
                    onChange={(e) => setCurrentCollege({ ...currentCollege, city: e.target.value })}
                    placeholder="Warangal"
                    className="w-full p-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#18CFFC]/50"
                  />
                </div>
                <div>
                  <label className="text-white/70 block mb-1">State</label>
                  <input
                    type="text"
                    value={currentCollege?.state || ''}
                    onChange={(e) => setCurrentCollege({ ...currentCollege, state: e.target.value })}
                    placeholder="Telangana"
                    className="w-full p-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#18CFFC]/50"
                  />
                </div>
              </div>

              <div>
                <label className="text-white/70 block mb-1">Website URL</label>
                <input
                  type="url"
                  value={currentCollege?.website || ''}
                  onChange={(e) => setCurrentCollege({ ...currentCollege, website: e.target.value })}
                  placeholder="https://nitw.ac.in"
                  className="w-full p-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#18CFFC]/50"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
                <Button variant="ghost" size="sm" type="button" onClick={() => setEditModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  Save College
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <AdminConfirmModal
        isOpen={statusModalOpen}
        title={targetStatus === 'suspended' ? 'Suspend College Institution?' : 'Reactivate College Institution?'}
        description={`This will mark "${targetCollege?.name}" as ${targetStatus}. Existing event registrations and club profiles will be preserved.`}
        confirmLabel={targetStatus === 'suspended' ? 'Suspend Institution' : 'Reactivate Institution'}
        confirmVariant={targetStatus === 'suspended' ? 'danger' : 'primary'}
        onClose={() => setStatusModalOpen(false)}
        onConfirm={confirmStatusChange}
      />
    </AdminLayout>
  )
}
