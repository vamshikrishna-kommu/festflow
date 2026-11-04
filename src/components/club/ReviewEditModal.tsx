import { useState } from 'react'
import {
  Modal,
  ModalBody,
  ModalFooter,
  Button,
  Badge,
  Alert,
} from '@/components/ui'
import { CheckCircle2, XCircle, ArrowRight, User } from 'lucide-react'
import { reviewRegistrationEdit } from '@/lib/editRequests'
import type { RegistrationEditRequestRecord, RegistrationRecord } from '@/types'

interface ReviewEditModalProps {
  isOpen: boolean
  onClose: () => void
  request: RegistrationEditRequestRecord | null
  registration?: RegistrationRecord | null
  studentName?: string
  studentEmail?: string
  onReviewed?: () => void
}

export function ReviewEditModal({
  isOpen,
  onClose,
  request,
  registration,
  studentName = 'Student Attendee',
  studentEmail = '',
  onReviewed,
}: ReviewEditModalProps) {
  const [decisionNotes, setDecisionNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  if (!request) return null

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    setLoading(true)
    setError(null)

    const res = await reviewRegistrationEdit({
      requestId: request.id,
      decision,
      decisionNotes: decisionNotes.trim() || undefined,
    })

    setLoading(false)

    if (res.success) {
      setSuccessNotice(
        decision === 'approved'
          ? 'Edit request approved and registration details updated.'
          : 'Edit request rejected.'
      )
      setTimeout(() => {
        setSuccessNotice(null)
        onClose()
        onReviewed?.()
      }, 1500)
    } else {
      setError(res.message || 'Failed to review edit request.')
    }
  }

  const changes = request.proposed_changes || {}
  const previous = request.previous_values || {}

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!loading) {
          setError(null)
          setSuccessNotice(null)
          onClose()
        }
      }}
      title="Review Registration Edit Request"
      size="md"
    >
      <div className="flex flex-col gap-4 text-left">
        <ModalBody>
          <div className="flex flex-col gap-4">
            {error && (
              <Alert variant="error" className="text-xs">
                {error}
              </Alert>
            )}
            {successNotice && (
              <Alert variant="success" className="text-xs">
                {successNotice}
              </Alert>
            )}

            {/* Attendee Context */}
            <div className="p-3.5 rounded-2xl bg-[#14141A] border border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <User size={16} className="text-[#18CFFC]" />
                <span>{studentName}</span>
                <span className="text-xs font-normal text-zinc-400">({studentEmail})</span>
              </div>
              <Badge variant="cyan" className="text-[10px]">
                Pass: #{registration?.ticket_code || 'TICKET'}
              </Badge>
            </div>

            {/* Side-by-Side Diff Comparison */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-zinc-300">Proposed Changes</span>
              <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-black/40 border border-white/5">
                {Object.entries(changes).map(([key, newVal]) => {
                  const oldVal = previous[key] || 'Not set'
                  const label = key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

                  return (
                    <div key={key} className="flex flex-col gap-1 text-xs border-b border-white/5 pb-2 last:border-0 last:pb-0">
                      <span className="text-zinc-400 font-semibold text-[11px]">{label}</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-300 line-through">
                          {String(oldVal)}
                        </span>
                        <ArrowRight size={13} className="text-zinc-500" />
                        <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 font-semibold">
                          {String(newVal)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Student Reason */}
            <div className="p-3 rounded-xl bg-[#14141A] border border-white/5 text-xs text-zinc-300">
              <span className="font-semibold text-zinc-400 block mb-0.5">Attendee Reason:</span>
              <p className="italic">"{request.reason}"</p>
            </div>

            {/* Organizer Decision Note */}
            <div className="flex flex-col gap-1.5 text-xs">
              <label className="text-zinc-300 font-semibold">Decision Note (Optional)</label>
              <textarea
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="Reason for approval or rejection..."
                rows={2}
                disabled={loading}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#14141A] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#18CFFC] resize-none"
              />
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={loading}
            onClick={onClose}
          >
            Dismiss
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={loading}
            onClick={() => handleDecision('rejected')}
            leftIcon={<XCircle size={14} />}
          >
            Reject Edit
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            isLoading={loading}
            onClick={() => handleDecision('approved')}
            leftIcon={<CheckCircle2 size={14} />}
          >
            Approve & Apply
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  )
}
