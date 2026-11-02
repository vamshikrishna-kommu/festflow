// Phase 7: Super Admin Student Management Page
import { useState, useEffect } from 'react'
import { Search, GraduationCap, Ticket, Calendar } from 'lucide-react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { AdminConfirmModal } from '@/components/admin/AdminConfirmModal'
import { getAdminStudents, updateStudentStatus, type AdminStudentRecord } from '@/lib/admin'
import { Button } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'

export default function AdminStudentsPage() {
  const { profile } = useAuth()
  const adminEmail = profile?.email || 'admin@festflow.online'

  const [students, setStudents] = useState<AdminStudentRecord[]>([])
  const [search, setSearch] = useState('')

  // Status Modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [targetStudent, setTargetStudent] = useState<AdminStudentRecord | null>(null)
  const [actionType, setActionType] = useState<'suspend' | 'reactivate'>('suspend')

  const loadData = async () => {
    const data = await getAdminStudents(search)
    setStudents(data)
  }

  useEffect(() => {
    loadData()
  }, [search])

  const promptStatusChange = (student: AdminStudentRecord, action: 'suspend' | 'reactivate') => {
    setTargetStudent(student)
    setActionType(action)
    setConfirmModalOpen(true)
  }

  const handleConfirmAction = async (reason: string) => {
    if (!targetStudent) return
    await updateStudentStatus(targetStudent.id, actionType, reason, adminEmail)
    setConfirmModalOpen(false)
    setTargetStudent(null)
    loadData()
  }

  return (
    <AdminLayout
      title="Student Attendees Management"
      subtitle="Search verified campus students, inspect registration activity, and manage account security standing."
    >
      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-[#0D0E15] p-3 rounded-2xl border border-white/5">
        <Search size={16} className="text-white/40 ml-2" />
        <input
          type="text"
          placeholder="Search students by name, email address, or college…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent border-none text-xs text-white placeholder-white/40 focus:outline-none"
        />
      </div>

      {/* Students Table */}
      <div className="bg-[#0D0E15] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 text-white/40 uppercase font-mono bg-white/[0.01]">
                <th className="p-4 font-semibold">Student Name & Email</th>
                <th className="p-4 font-semibold">College & Grad Year</th>
                <th className="p-4 font-semibold">Fest Activity</th>
                <th className="p-4 font-semibold">Account Status</th>
                <th className="p-4 font-semibold text-right">Access Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-white/[0.02]">
                  <td className="p-4 font-medium text-white flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#7F1AFB]/10 border border-[#7F1AFB]/20 text-[#7F1AFB] flex items-center justify-center shrink-0">
                      <GraduationCap size={16} />
                    </div>
                    <div>
                      <div className="font-semibold text-white">{student.display_name}</div>
                      <div className="text-[11px] text-white/50 font-mono">{student.email}</div>
                    </div>
                  </td>
                  <td className="p-4 text-white/70">
                    <div>{student.college_name || 'Independent Student'}</div>
                    {student.graduation_year && (
                      <div className="text-[10px] text-white/40 font-mono">Class of {student.graduation_year}</div>
                    )}
                  </td>
                  <td className="p-4 text-white/70 font-mono">
                    <span className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} className="text-white/40" /> {student.registration_count ?? 0} registrations
                      </span>
                      <span className="text-white/30">•</span>
                      <span className="flex items-center gap-1">
                        <Ticket size={12} className="text-white/40" /> {student.pass_count ?? 0} passes
                      </span>
                    </span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`
                        px-2.5 py-0.5 rounded-full font-mono text-[10px] font-semibold uppercase border
                        ${
                          student.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }
                      `}
                    >
                      {student.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {student.status === 'active' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                        onClick={() => promptStatusChange(student, 'suspend')}
                      >
                        Suspend Account
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                        onClick={() => promptStatusChange(student, 'reactivate')}
                      >
                        Reactivate Account
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
        title={actionType === 'suspend' ? 'Suspend Student Account?' : 'Reactivate Student Account?'}
        description={
          actionType === 'suspend'
            ? `Suspend platform privileges for "${targetStudent?.display_name}". Existing event registrations and ticket passes will remain intact in the database.`
            : `Restore active account standing for "${targetStudent?.display_name}".`
        }
        confirmLabel={actionType === 'suspend' ? 'Suspend Student' : 'Reactivate Student'}
        confirmVariant={actionType === 'suspend' ? 'danger' : 'primary'}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleConfirmAction}
      />
    </AdminLayout>
  )
}
