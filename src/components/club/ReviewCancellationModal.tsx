import { useState } from 'react'
import {
  Modal,
  ModalBody,
  ModalFooter,
  Button,
  Badge,
  Alert,
} from '@/components/ui'
import { CheckCircle2, XCircle, CreditCard, User, Mail, Ticket } from 'lucide-react'
import { reviewRegistrationCancellation } from '@/lib/cancellations'
import type { RegistrationCancellationRequestRecord, RegistrationRecord, RefundStatus } from '@/types'

interface ReviewCancellationModalProps {
  isOpen: boolean
  onClose: () => void
  request: RegistrationCancellationRequestRecord | null
  registration?: RegistrationRecord | null
  studentName?: string
  studentEmail?: string
  eventTitle?: string
  isPaidEvent?: boolean
  price?: number
  onReviewed?: () => void
}

export function ReviewCancellationModal({
  isOpen,
  onClose,
  request,
  registration,
  studentName = 'Student Attendee',
  studentEmail = '',
  eventTitle = 'Campus Event',
  isPaidEvent = false,
  price = 0,
  onReviewed,
}: ReviewCancellationModalProps) {
  const [decisionNotes, setDecisionNotes] = useState('')
  const [refundStatus, setRefundStatus] = useState<RefundStatus>(
    isPaidEvent ? 'refund_approved' : 'not_applicable'
  )
  const [refundAmount, setRefundAmount] = useState<number>(price || 0)
  const [refundTransactionRef, setRefundTransactionRef] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  if (!request) return null

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    setLoading(true)
    setError(null)

    const res = await reviewRegistrationCancellation({
      requestId: request.id,
      decision,
      decisionNotes: decisionNotes.trim() || undefined,
      refundStatus: decision === 'approved' ? refundStatus : 'refund_rejected',
      refundAmount: decision === 'approved' ? refundAmount : 0,
      refundTransactionRef: refundTransactionRef.trim() || undefined,
    })

    setLoading(false)

    if (res.success) {
      setSuccessNotice(
        decision === 'approved'
          ? 'Cancellation approved. Ticket pass invalidated and refund status recorded.'
          : 'Cancellation rejected. Registration remains confirmed and active.'
      )
      setTimeout(() => {
        setSuccessNotice(null)
        onClose()
        onReviewed?.()
      }, 1500)
    } else {
      setError(res.message || 'Failed to review cancellation request.')
    }
  }

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
      title="Review Attendee Cancellation Request"
      size="lg"
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

            {/* Attendee & Request Context Card */}
            <div className="p-4 rounded-2xl bg-[#14141A] border border-white/[0.08] flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <User size={16} className="text-[#18CFFC]" />
                  <span>{studentName}</span>
                </div>
                <Badge variant="amber" className="text-[10px] capitalize">
                  Reason: {request.reason.replace(/_/g, ' ')}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-400">
                <div className="flex items-center gap-1.5 truncate">
                  <Mail size={13} className="text-zinc-500 shrink-0" />
                  <span className="truncate">{studentEmail || 'Email unlisted'}</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[11px]">
                  <Ticket size={13} className="text-zinc-500 shrink-0" />
                  <span>Pass: #{registration?.ticket_code || 'TICKET'} ({eventTitle})</span>
                </div>
              </div>

              {request.explanation && (
                <div className="p-3 rounded-xl bg-black/30 border border-white/5 text-xs text-zinc-300">
                  <span className="font-semibold text-zinc-400 block mb-0.5">Attendee Note:</span>
                  <p className="italic">"{request.explanation}"</p>
                </div>
              )}
            </div>

            {/* Refund Determination (Independent from cancellation approval) */}
            {isPaidEvent && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <CreditCard size={15} />
                  <span>Manual UPI Refund Determination</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-400 font-medium">Refund Policy Status</label>
                    <select
                      value={refundStatus}
                      onChange={(e) => setRefundStatus(e.target.value as RefundStatus)}
                      disabled={loading}
                      className="px-3 py-2 rounded-xl bg-[#14141A] border border-white/10 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="refund_approved">Refund Approved (Pending payout)</option>
                      <option value="refund_processing">Refund Processing</option>
                      <option value="refunded">Refunded (Completed via UPI)</option>
                      <option value="refund_rejected">Refund Rejected (Non-refundable)</option>
                      <option value="not_applicable">Not Applicable</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-400 font-medium">Refund Amount (₹)</label>
                    <input
                      type="number"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(Number(e.target.value))}
                      disabled={loading}
                      className="px-3 py-2 rounded-xl bg-[#14141A] border border-white/10 text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-xs">
                  <label className="text-zinc-400 font-medium">Refund Reference / UTR (Optional)</label>
                  <input
                    type="text"
                    value={refundTransactionRef}
                    onChange={(e) => setRefundTransactionRef(e.target.value)}
                    placeholder="Enter UPI UTR or bank reference ID once transferred..."
                    disabled={loading}
                    className="px-3 py-2 rounded-xl bg-[#14141A] border border-white/10 text-xs text-white focus:outline-none focus:border-emerald-500 placeholder-zinc-500"
                  />
                </div>
              </div>
            )}

            {/* Organizer Decision Note */}
            <div className="flex flex-col gap-1.5 text-xs">
              <label className="text-zinc-300 font-semibold">Organizer Decision Notes</label>
              <textarea
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="Add explanation for the attendee regarding approval or rejection..."
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
            Reject Request
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            isLoading={loading}
            onClick={() => handleDecision('approved')}
            leftIcon={<CheckCircle2 size={14} />}
          >
            Approve Cancellation
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  )
}
