// Phase 7: Super Admin Financial & Payment Oversight Page
import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { AdminConfirmModal } from '@/components/admin/AdminConfirmModal'
import { getAdminPaymentSubmissions, adminPaymentOverride, type AdminPaymentRecord } from '@/lib/admin'
import { Button } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'

export default function AdminFinancesPage() {
  const { profile } = useAuth()
  const adminEmail = profile?.email || 'admin@festflow.online'

  const [payments, setPayments] = useState<AdminPaymentRecord[]>([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  // Dispute Override Modal
  const [overrideModalOpen, setOverrideModalOpen] = useState(false)
  const [targetPayment, setTargetPayment] = useState<AdminPaymentRecord | null>(null)
  const [overrideAction, setOverrideAction] = useState<'verify' | 'reject'>('verify')

  const loadData = async () => {
    const data = await getAdminPaymentSubmissions(filter, search)
    setPayments(data)
  }

  useEffect(() => {
    loadData()
  }, [filter, search])

  const promptOverride = (payment: AdminPaymentRecord, action: 'verify' | 'reject') => {
    setTargetPayment(payment)
    setOverrideAction(action)
    setOverrideModalOpen(true)
  }

  const handleConfirmOverride = async (reason: string) => {
    if (!targetPayment) return
    await adminPaymentOverride(targetPayment.id, overrideAction, reason, adminEmail)
    setOverrideModalOpen(false)
    setTargetPayment(null)
    loadData()
  }

  const totalTransacted = payments.reduce((acc, p) => (p.status === 'verified' ? acc + p.amount : acc), 0)
  const pendingCount = payments.filter((p) => p.status === 'pending').length

  return (
    <AdminLayout
      title="Financial & Payment Oversight"
      subtitle="Monitor manual UPI payment submissions, inspect UTR transaction reference codes, and handle escalated dispute overrides with strict audit compliance."
    >
      {/* Overview Stat Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-[#0D0E15] border border-white/5">
          <span className="text-[10px] font-mono uppercase text-white/40 block">Verified UPI Volume</span>
          <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">
            ₹{totalTransacted.toLocaleString('en-IN')}
          </span>
          <span className="text-xs text-white/50 mt-1 block">Direct manual club reconciliations</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#0D0E15] border border-white/5">
          <span className="text-[10px] font-mono uppercase text-white/40 block">Awaiting Club Review</span>
          <span className="text-2xl font-bold font-mono text-amber-400 mt-1 block">
            {pendingCount} submissions
          </span>
          <span className="text-xs text-white/50 mt-1 block">Under club organizer verification</span>
        </div>
        <div className="p-4 rounded-2xl bg-[#0D0E15] border border-white/5">
          <span className="text-[10px] font-mono uppercase text-white/40 block">Gateway Integration</span>
          <span className="text-2xl font-bold font-mono text-[#18CFFC] mt-1 block">
            Manual Direct UPI
          </span>
          <span className="text-xs text-white/50 mt-1 block">Zero intermediary gateway fee</span>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0D0E15] p-3 rounded-2xl border border-white/5">
        <div className="flex items-center gap-2 flex-1">
          <Search size={16} className="text-white/40 ml-2" />
          <input
            type="text"
            placeholder="Search by UTR number, student email, or event title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none text-xs text-white placeholder-white/40 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl self-start sm:self-auto">
          {[
            { id: 'all', label: 'All Submissions' },
            { id: 'pending', label: 'Pending Review' },
            { id: 'verified', label: 'Verified' },
            { id: 'rejected', label: 'Rejected' },
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

      {/* Payment Submissions Ledger Table */}
      <div className="bg-[#0D0E15] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 text-white/40 uppercase font-mono bg-white/[0.01]">
                <th className="p-4 font-semibold">UTR Reference</th>
                <th className="p-4 font-semibold">Event & Club</th>
                <th className="p-4 font-semibold">Student Attendee</th>
                <th className="p-4 font-semibold">Amount</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">Dispute Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.02]">
                  <td className="p-4 font-medium text-white">
                    <div className="font-mono font-bold text-[#18CFFC]">{p.utr}</div>
                    <div className="text-[10px] text-white/40 font-mono mt-0.5">
                      {new Date(p.created_at).toLocaleString()}
                    </div>
                  </td>
                  <td className="p-4 text-white/70">
                    <div className="font-semibold text-white truncate max-w-xs">{p.event_title}</div>
                    <div className="text-[11px] text-white/40">{p.club_name}</div>
                  </td>
                  <td className="p-4 text-white/70">
                    <div>{p.student_name}</div>
                    <div className="text-[10px] text-white/40 font-mono">{p.student_email}</div>
                  </td>
                  <td className="p-4 font-mono font-bold text-white">₹{p.amount}</td>
                  <td className="p-4">
                    <span
                      className={`
                        px-2.5 py-0.5 rounded-full font-mono text-[10px] font-semibold uppercase border
                        ${
                          p.status === 'verified'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : p.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }
                      `}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    {p.status !== 'verified' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                        onClick={() => promptOverride(p, 'verify')}
                      >
                        Override Verify
                      </Button>
                    )}
                    {p.status !== 'rejected' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                        onClick={() => promptOverride(p, 'reject')}
                      >
                        Override Reject
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
        isOpen={overrideModalOpen}
        title={overrideAction === 'verify' ? 'Administrative Payment Override: Verify?' : 'Administrative Payment Override: Reject?'}
        description={`Overriding payment UTR "${targetPayment?.utr}" for ₹${targetPayment?.amount}. This modifies the registration status and activates/deactivates the digital ticket pass. A written justification is mandatory.`}
        confirmLabel={overrideAction === 'verify' ? 'Confirm Payment Override' : 'Reject Payment Override'}
        confirmVariant={overrideAction === 'verify' ? 'primary' : 'danger'}
        onClose={() => setOverrideModalOpen(false)}
        onConfirm={handleConfirmOverride}
      />
    </AdminLayout>
  )
}
