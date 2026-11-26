// Phase 7: Super Admin Student Management Page
import { useState, useEffect } from 'react'
import { AlertTriangle, Search, GraduationCap, Ticket, Calendar } from 'lucide-react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { AdminConfirmModal } from '@/components/admin/AdminConfirmModal'
import { getAdminStudents, updateStudentStatus, type AdminStudentRecord } from '@/lib/admin'
import { Button } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'

export default function AdminStudentsPage() {
  const { profile } = useAuth()
  const adminEmail = profile?.email || 'platform_admin'

  const [students, setStudents] = useState<AdminStudentRecord[]>([])
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Status Modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [targetStudent, setTargetStudent] = useState<AdminStudentRecord | null>(null)
  const [actionType, setActionType] = useState<'suspend' | 'reactivate'>('suspend')

  const loadData = async () => {
    setLoadError(null)
    try {
      const data = await getAdminStudents(search)
      setStudents(data)
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load student records.')
    }
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
    setActionError(null)
    try {
      const res = await updateStudentStatus(targetStudent.id, actionType, reason, adminEmail)
      if (res && res.success === false) {
        setActionError(res.error || 'Failed to update student account status.')
        return
      }
      setConfirmModalOpen(false)
      setTargetStudent(null)
      await loadData()
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update student account status.')
    }
  }

  return (
    <AdminLayout
      title="Student Attendees Management"
      subtitle="Search verified campus students, inspect registration activity, and manage account security standing."
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

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-xs">
        <Search size={16} className="text-gray-400 ml-2" />
        <input
          type="text"
          placeholder="Search students by name, email address, or college…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent border-none text-xs text-gray-900 placeholder-gray-400 focus:outline-none"
        />
      </div>

      {/* Students Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 uppercase font-mono bg-gray-50">
                <th className="p-4 font-semibold">Student Name & Email</th>
                <th className="p-4 font-semibold">College & Grad Year</th>
                <th className="p-4 font-semibold">Fest Activity</th>
                <th className="p-4 font-semibold">Account Status</th>
                <th className="p-4 font-semibold text-right">Access Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-900 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
                      <GraduationCap size={16} />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{student.display_name}</div>
                      <div className="text-[11px] text-gray-500 font-mono">{student.email}</div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-700">
                    <div>{student.college_name || 'Independent Student'}</div>
                    {student.graduation_year && (
                      <div className="text-[10px] text-gray-500 font-mono">Class of {student.graduation_year}</div>
                    )}
                  </td>
                  <td className="p-4 text-gray-600 font-mono">
                    <span className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} className="text-gray-400" /> {student.registration_count ?? 0} registrations
                      </span>
                      <span className="text-gray-300">•</span>
                      <span className="flex items-center gap-1">
                        <Ticket size={12} className="text-gray-400" /> {student.pass_count ?? 0} passes
                      </span>
                    </span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`
                        px-2.5 py-0.5 rounded-full font-mono text-[10px] font-semibold uppercase border
                        ${
                          student.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
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
                        className="text-xs text-rose-700 border-rose-200 hover:bg-rose-50"
                        onClick={() => promptStatusChange(student, 'suspend')}
                      >
                        Suspend Account
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
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
