import { useState } from 'react'
import {
  Modal,
  ModalBody,
  ModalFooter,
  Button,
  Alert,
} from '@/components/ui'
import { Edit3, Send } from 'lucide-react'
import { requestRegistrationEdit } from '@/lib/editRequests'
import type { RegistrationRecord } from '@/types'

interface RequestEditModalProps {
  isOpen: boolean
  onClose: () => void
  registration: RegistrationRecord
  eventTitle: string
  onSubmitted?: () => void
}

export function RequestEditModal({
  isOpen,
  onClose,
  registration,
  eventTitle,
  onSubmitted,
}: RequestEditModalProps) {
  const initialName = registration.participant_details?.student_name || ''
  const initialPhone = registration.participant_details?.phone || ''
  const initialCollege = registration.participant_details?.college_name || ''
  const initialTeamName = registration.team_name || ''

  const [studentName, setStudentName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)
  const [college, setCollege] = useState(initialCollege)
  const [teamName, setTeamName] = useState(initialTeamName)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const isLeader = registration.team_role === 'leader'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) {
      setError('Please provide a reason for the requested changes.')
      return
    }

    const proposedChanges: Record<string, string> = {}
    if (studentName.trim() !== initialName) proposedChanges.student_name = studentName.trim()
    if (phone.trim() !== initialPhone) proposedChanges.phone = phone.trim()
    if (college.trim() !== initialCollege) proposedChanges.college = college.trim()
    if (isLeader && teamName.trim() !== initialTeamName) proposedChanges.team_name = teamName.trim()

    if (Object.keys(proposedChanges).length === 0) {
      setError('No fields have been modified.')
      return
    }

    setLoading(true)
    setError(null)

    const res = await requestRegistrationEdit({
      registrationId: registration.id,
      proposedChanges,
      reason: reason.trim(),
    })

    setLoading(false)

    if (res.success) {
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        onClose()
        onSubmitted?.()
      }, 1500)
    } else {
      setError(res.message || 'Failed to submit edit request.')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!loading) {
          setError(null)
          onClose()
        }
      }}
      title="Request Registration Details Edit"
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="flex flex-col gap-4 text-left">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700">
              <Edit3 size={20} className="shrink-0 mt-0.5 text-blue-600" />
              <div className="text-xs leading-relaxed text-gray-600">
                <strong className="block font-semibold text-gray-900 mb-0.5">Verification Safeguard</strong>
                To protect event integrity and pass security, changes to registration details must be approved by the organizer of{' '}
                <strong className="text-gray-900">{eventTitle}</strong>.
              </div>
            </div>

            {error && (
              <Alert variant="error" className="text-xs">
                {error}
              </Alert>
            )}

            {success && (
              <Alert variant="success" className="text-xs">
                Edit request submitted! The club organizer will review your proposed changes.
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-700">Student Name</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  disabled={loading || success}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-700">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading || success}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700">College / Institution</label>
              <input
                type="text"
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                disabled={loading || success}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
              />
            </div>

            {isLeader && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-700">Team Name</label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  disabled={loading || success}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-700">
                Reason for Edit <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why these corrections are needed (e.g., typo in college name, updated contact number)..."
                disabled={loading || success}
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 resize-none"
              />
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={loading || success}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={loading}
            disabled={success}
            leftIcon={<Send size={14} />}
          >
            Submit Request
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}

