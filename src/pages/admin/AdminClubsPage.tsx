// Phase 7: Super Admin Club Oversight and Verification Page
import { useState, useEffect } from 'react'
import { Search, ShieldCheck, Users, Calendar } from 'lucide-react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { AdminConfirmModal } from '@/components/admin/AdminConfirmModal'
import { getAdminClubs, updateClubStatus, type AdminClubRecord } from '@/lib/admin'
import { Button } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'

export default function AdminClubsPage() {
  const { profile } = useAuth()
  const adminEmail = profile?.email || 'admin@festflow.online'

  const [clubs, setClubs] = useState<AdminClubRecord[]>([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  // Action Modal State
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [targetClub, setTargetClub] = useState<AdminClubRecord | null>(null)
  const [actionType, setActionType] = useState<'verify' | 'reject_verification' | 'suspend' | 'reactivate'>('verify')

  const loadData = async () => {
    const data = await getAdminClubs(search, filter)
    setClubs(data)
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
    await updateClubStatus(targetClub.id, actionType, reason, adminEmail)
    setConfirmModalOpen(false)
    setTargetClub(null)
    loadData()
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
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0D0E15] p-3 rounded-2xl border border-white/5">
        <div className="flex items-center gap-2 flex-1">
          <Search size={16} className="text-white/40 ml-2" />
          <input
            type="text"
            placeholder="Search clubs by name, representative, or college…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none text-xs text-white placeholder-white/40 focus:outline-none"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl self-start sm:self-auto">
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
                ${filter === tab.id ? 'bg-[#18CFFC] text-black font-bold shadow-sm' : 'text-white/60 hover:text-white'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clubs Table */}
      <div className="bg-[#0D0E15] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 text-white/40 uppercase font-mono bg-white/[0.01]">
                <th className="p-4 font-semibold">Club Organization</th>
                <th className="p-4 font-semibold">Representative</th>
                <th className="p-4 font-semibold">College Affiliation</th>
                <th className="p-4 font-semibold">Activity</th>
                <th className="p-4 font-semibold">Status & Badge</th>
                <th className="p-4 font-semibold text-right">Moderation Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {clubs.map((club) => (
                <tr key={club.id} className="hover:bg-white/[0.02]">
                  <td className="p-4 font-medium text-white">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{club.club_name}</span>
                      {club.is_verified && (
                        <ShieldCheck size={14} className="text-[#18CFFC] shrink-0" />
                      )}
                    </div>
                    {club.description && (
                      <div className="text-[11px] text-white/40 max-w-xs truncate mt-0.5">
                        {club.description}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-white/70">
                    <div>{club.representative_name}</div>
                  </td>
                  <td className="p-4 text-white/60">
                    {club.college_name || 'Independent / Unlinked'}
                  </td>
                  <td className="p-4 text-white/70 font-mono">
                    <span className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} className="text-white/40" /> {club.event_count ?? 0}
                      </span>
                      <span className="text-white/30">•</span>
                      <span className="flex items-center gap-1">
                        <Users size={12} className="text-white/40" /> {club.member_count ?? 0}
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
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
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
                              ? 'bg-[#18CFFC]/10 text-[#18CFFC] border-[#18CFFC]/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
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
                        className="text-xs text-[#18CFFC] border-[#18CFFC]/30 hover:bg-[#18CFFC]/10"
                        onClick={() => promptAction(club, 'verify')}
                      >
                        Verify Club
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-amber-400 hover:bg-amber-500/10"
                        onClick={() => promptAction(club, 'reject_verification')}
                      >
                        Revoke Badge
                      </Button>
                    )}

                    {club.status === 'active' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                        onClick={() => promptAction(club, 'suspend')}
                      >
                        Suspend
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
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
