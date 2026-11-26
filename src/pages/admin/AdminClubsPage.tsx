// Phase 7: Super Admin Club Oversight and Verification Page
import { useState, useEffect } from 'react'
import { AlertTriangle, Search, ShieldCheck, Users, Calendar } from 'lucide-react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { AdminConfirmModal } from '@/components/admin/AdminConfirmModal'
import { getAdminClubs, updateClubStatus, type AdminClubRecord } from '@/lib/admin'
import { Button } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'

export default function AdminClubsPage() {
  const { profile } = useAuth()
  const adminEmail = profile?.email || 'platform_admin'

  const [clubs, setClubs] = useState<AdminClubRecord[]>([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Action Modal State
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [targetClub, setTargetClub] = useState<AdminClubRecord | null>(null)
  const [actionType, setActionType] = useState<'verify' | 'reject_verification' | 'suspend' | 'reactivate'>('verify')

  const loadData = async () => {
    setLoadError(null)
    try {
      const data = await getAdminClubs(search, filter)
      setClubs(data)
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load clubs list.')
    }
  }

  useEffect(() => {
    loadData()
  }, [filter, search])

  const promptAction = (club: AdminClubRecord, action: typeof actionType) => {
    setTargetClub(club)
    setActionType(action)
    setConfirmModalOpen(true)
  }

  const handleConfirmAction = async (reason: string) => {
    if (!targetClub) return
    setActionError(null)
    try {
      const res = await updateClubStatus(targetClub.id, actionType, reason, adminEmail)
      if (res && res.success === false) {
        setActionError(res.error || 'Failed to update club status.')
        return
      }
      setConfirmModalOpen(false)
      setTargetClub(null)
      await loadData()
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update club status.')
    }
  }

  const getActionLabels = () => {
    switch (actionType) {
      case 'verify':
        return {
          title: 'Approve Official Club Verification?',
          description: `Grant verified club status to "${targetClub?.club_name}". This activates public badge indicators and permits official fest hosting.`,
          confirmLabel: 'Approve Verification',
          variant: 'primary' as const,
        }
      case 'reject_verification':
        return {
          title: 'Reject Club Verification Request?',
          description: `Reject verification for "${targetClub?.club_name}". An audit explanation must be recorded.`,
          confirmLabel: 'Reject Request',
          variant: 'danger' as const,
        }
      case 'suspend':
        return {
          title: 'Suspend Club Organization?',
          description: `Suspend "${targetClub?.club_name}". The club will be hidden from new event registrations. Existing registrations, payments and passes will be preserved.`,
          confirmLabel: 'Suspend Club',
          variant: 'danger' as const,
        }
      case 'reactivate':
        return {
          title: 'Reactivate Club Organization?',
          description: `Restore active platform standing for "${targetClub?.club_name}".`,
          confirmLabel: 'Reactivate Club',
          variant: 'primary' as const,
        }
    }
  }

  const modalConfig = getActionLabels()

  return (
    <AdminLayout
      title="Campus Clubs & Organizers Oversight"
      subtitle="Verify student club credentials, review executive affiliations, and moderate organization access."
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

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-xs">
        <div className="flex items-center gap-2 flex-1">
          <Search size={16} className="text-gray-400 ml-2" />
          <input
            type="text"
            placeholder="Search clubs by name, representative, or college…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none text-xs text-gray-900 placeholder-gray-400 focus:outline-none"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl self-start sm:self-auto">
          {[
            { id: 'all', label: 'All Clubs' },
            { id: 'verified', label: 'Verified' },
            { id: 'unverified', label: 'Pending / Unverified' },
            { id: 'suspended', label: 'Suspended' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${filter === tab.id ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'text-gray-600 hover:text-gray-900'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clubs Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 uppercase font-mono bg-gray-50">
                <th className="p-4 font-semibold">Club Organization</th>
                <th className="p-4 font-semibold">Representative</th>
                <th className="p-4 font-semibold">College Affiliation</th>
                <th className="p-4 font-semibold">Activity</th>
                <th className="p-4 font-semibold">Status & Badge</th>
                <th className="p-4 font-semibold text-right">Moderation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {clubs.map((club) => (
                <tr key={club.id} className="hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{club.club_name}</span>
                      {club.is_verified && (
                        <ShieldCheck size={14} className="text-blue-600 shrink-0" />
                      )}
                    </div>
                    {club.description && (
                      <div className="text-[11px] text-gray-500 max-w-xs truncate mt-0.5">
                        {club.description}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-gray-700">
                    <div>{club.representative_name}</div>
                  </td>
                  <td className="p-4 text-gray-600">
                    {club.college_name || 'Independent / Unlinked'}
                  </td>
                  <td className="p-4 text-gray-600 font-mono">
                    <span className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} className="text-gray-400" /> {club.event_count ?? 0}
                      </span>
                      <span className="text-gray-300">•</span>
                      <span className="flex items-center gap-1">
                        <Users size={12} className="text-gray-400" /> {club.member_count ?? 0}
                      </span>
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`
                          px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold uppercase border
                          ${
                            club.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }
                        `}
                      >
                        {club.status}
                      </span>
                      <span
                        className={`
                          px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold border
                          ${
                            club.is_verified
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }
                        `}
                      >
                        {club.is_verified ? 'Verified' : 'Unverified'}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    {!club.is_verified ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
                        onClick={() => promptAction(club, 'verify')}
                      >
                        Verify Club
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-amber-700 hover:bg-amber-50"
                        onClick={() => promptAction(club, 'reject_verification')}
                      >
                        Revoke Badge
                      </Button>
                    )}

                    {club.status === 'active' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-rose-700 border-rose-200 hover:bg-rose-50"
                        onClick={() => promptAction(club, 'suspend')}
                      >
                        Suspend
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                        onClick={() => promptAction(club, 'reactivate')}
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

      <AdminConfirmModal
        isOpen={confirmModalOpen}
        title={modalConfig.title}
        description={modalConfig.description}
        confirmLabel={modalConfig.confirmLabel}
        confirmVariant={modalConfig.variant}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleConfirmAction}
      />
    </AdminLayout>
  )
}
