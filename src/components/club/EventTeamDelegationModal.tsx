import { useState, useEffect } from 'react'
import {
  Plus,
  Trash2,
  UserCheck,
  AlertCircle,
  X,
} from 'lucide-react'
import { Modal, ModalBody, ModalFooter, Button, Badge } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { ASSIGNABLE_EVENT_ASSIGNMENT_ROLES } from '@/lib/rbac'
import {
  getEventAssignments,
  assignMemberToEvent,
  removeEventAssignment,
  ASSIGNMENT_ROLE_LABELS,
  ASSIGNMENT_ROLE_DESCRIPTIONS,
} from '@/lib/eventAssignments'
import { getClubMembers } from '@/lib/clubMembers'
import type { EventAssignmentRecord, EventAssignmentRole, ClubMemberRecord } from '@/types'

interface EventTeamDelegationModalProps {
  isOpen: boolean
  onClose: () => void
  eventId: string
  clubId: string
  eventTitle: string
  currentUserId: string
  readOnly?: boolean
}

export function EventTeamDelegationModal({
  isOpen,
  onClose,
  eventId,
  clubId,
  eventTitle,
  currentUserId,
  readOnly = false,
}: EventTeamDelegationModalProps) {
  const { role: globalRole, hasClubPermission } = useAuth()
  const canManageDelegation =
    !readOnly && (globalRole === 'platform_admin' || hasClubPermission('roles.assign'))

  const [assignments, setAssignments] = useState<EventAssignmentRecord[]>([])
  const [clubMembers, setClubMembers] = useState<ClubMemberRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState<EventAssignmentRole>('event_manager')
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<{ message: string; isError?: boolean } | null>(null)

  const loadData = async () => {
    if (!eventId || !clubId) return
    setLoading(true)
    const [asgRes, memRes] = await Promise.all([
      getEventAssignments(eventId),
      getClubMembers(clubId),
    ])
    setLoading(false)
    if (asgRes.assignments) setAssignments(asgRes.assignments)
    if (memRes.members) setClubMembers(memRes.members.filter((m) => m.status === 'active'))
  }

  useEffect(() => {
    if (isOpen) {
      loadData()
      setShowAddForm(false)
      setNotice(null)
    }
  }, [isOpen, eventId, clubId])

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canManageDelegation) {
      setNotice({ message: 'You do not have permission to assign event roles.', isError: true })
      return
    }
    if (
      !ASSIGNABLE_EVENT_ASSIGNMENT_ROLES.includes(
        selectedRole as (typeof ASSIGNABLE_EVENT_ASSIGNMENT_ROLES)[number]
      )
    ) {
      setNotice({ message: 'Selected role cannot be assigned.', isError: true })
      return
    }
    if (!selectedUserId) {
      setNotice({ message: 'Please select a club member.', isError: true })
      return
    }

    setSubmitting(true)
    setNotice(null)

    const member = clubMembers.find((m) => m.user_id === selectedUserId)
    const res = await assignMemberToEvent({
      eventId,
      clubId,
      userId: selectedUserId,
      role: selectedRole,
      assignedBy: currentUserId,
      userProfile: member?.profile ? { display_name: member.profile.display_name, email: member.profile.email } : undefined,
    })

    setSubmitting(false)
    if (res.error) {
      setNotice({ message: res.error, isError: true })
      return
    }

    setNotice({ message: 'Member successfully assigned to event!' })
    setShowAddForm(false)
    loadData()
  }

  const handleRemove = async (assignmentId: string) => {
    if (!canManageDelegation) {
      setNotice({ message: 'You do not have permission to remove event assignments.', isError: true })
      return
    }
    await removeEventAssignment(assignmentId)
    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId))
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Event Team Delegation & Roles">
      <ModalBody>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400">
                {readOnly
                  ? 'Delegated responsibilities (read-only archive) for '
                  : !canManageDelegation
                  ? 'Delegated responsibilities (view-only) for '
                  : 'Assign club members specific responsibilities for '}
                <strong className="text-white">"{eventTitle}"</strong>.
              </p>
            </div>
            {canManageDelegation && !showAddForm && (
              <Button
                size="sm"
                variant="primary"
                leftIcon={<Plus size={14} />}
                onClick={() => setShowAddForm(true)}
              >
                Assign Member
              </Button>
            )}
          </div>

          {notice && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                notice.isError
                  ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                  : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              }`}
            >
              <AlertCircle size={14} />
              <span>{notice.message}</span>
            </div>
          )}

          {/* Form to Assign Member */}
          {showAddForm && (
            <form
              onSubmit={handleAssign}
              className="p-4 rounded-2xl bg-[#0E0E12] border border-[#18CFFC]/30 flex flex-col gap-3 shadow-xl"
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <UserCheck size={13} className="text-[#18CFFC]" />
                  Delegate Event Role
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-zinc-500 hover:text-white cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                    Select Member *
                  </label>
                  <select
                    required
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#14141A] border border-white/10 text-xs text-white focus:outline-none focus:border-[#18CFFC]"
                  >
                    <option value="">-- Choose Club Member --</option>
                    {clubMembers.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.profile?.display_name || m.profile?.email || m.user_id} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
                    Assigned Responsibility *
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-[#14141A] border border-white/10 text-xs text-white focus:outline-none focus:border-[#18CFFC]"
                  >
                    {ASSIGNABLE_EVENT_ASSIGNMENT_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ASSIGNMENT_ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#14141A] border border-white/5 text-[11px] text-zinc-400">
                {ASSIGNMENT_ROLE_DESCRIPTIONS[selectedRole]}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? 'Assigning...' : 'Confirm Assignment'}
                </Button>
              </div>
            </form>
          )}

          {/* Current Assignments List */}
          <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
            {loading ? (
              <div className="py-8 text-center text-xs text-zinc-400">Loading assignments...</div>
            ) : assignments.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                No individual assignments created yet. All club administrators currently manage this event.
              </div>
            ) : (
              assignments.map((item) => {
                const name = item.user?.display_name || item.user?.email || 'Assigned Member'
                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-[#14141A] border border-white/10 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#18CFFC]/10 text-[#18CFFC] flex items-center justify-center text-xs font-bold font-heading">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">
                          {name}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="cyan" className="text-[10px]">
                            {ASSIGNMENT_ROLE_LABELS[item.role] || item.role}
                          </Badge>
                          <span className="text-[10px] text-zinc-500">
                            Assigned {new Date(item.created_at).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {canManageDelegation && (
                      <button
                        type="button"
                        onClick={() => handleRemove(item.id)}
                        className="p-1.5 text-zinc-500 hover:text-rose-400 cursor-pointer"
                        title="Remove Assignment"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Done
        </Button>
      </ModalFooter>
    </Modal>
  )
}

