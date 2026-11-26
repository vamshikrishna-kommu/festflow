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
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <User size={16} className="text-blue-600" />
                  <span>{studentName}</span>
                </div>
                <Badge variant="amber" className="text-[10px] capitalize">
                  Reason: {request.reason.replace(/_/g, ' ')}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                <div className="flex items-center gap-1.5 truncate">
                  <Mail size={13} className="text-gray-400 shrink-0" />
                  <span className="truncate">{studentEmail || 'Email unlisted'}</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[11px]">
                  <Ticket size={13} className="text-gray-400 shrink-0" />
                  <span>Pass: #{registration?.ticket_code || 'TICKET'} ({eventTitle})</span>
                </div>
              </div>

              {request.explanation && (
                <div className="p-3 rounded-xl bg-white border border-gray-200 text-xs text-gray-700">
                  <span className="font-semibold text-gray-500 block mb-0.5">Attendee Note:</span>
                  <p className="italic">"{request.explanation}"</p>
                </div>
              )}
            </div>

            {/* Refund Determination (Independent from cancellation approval) */}
            {isPaidEvent && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                  <CreditCard size={15} />
                  <span>Manual UPI Refund Determination</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex flex-col gap-1">
                    <label className="text-gray-700 font-medium">Refund Policy Status</label>
                    <select
                      value={refundStatus}
                      onChange={(e) => setRefundStatus(e.target.value as RefundStatus)}
                      disabled={loading}
                      className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-emerald-600"
                    >
                      <option value="refund_approved">Refund Approved (Pending payout)</option>
                      <option value="refund_processing">Refund Processing</option>
                      <option value="refunded">Refunded (Completed via UPI)</option>
                      <option value="refund_rejected">Refund Rejected (Non-refundable)</option>
                      <option value="not_applicable">Not Applicable</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-gray-700 font-medium">Refund Amount (₹)</label>
                    <input
                      type="number"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(Number(e.target.value))}
                      disabled={loading}
                      className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1 text-xs">
                  <label className="text-gray-700 font-medium">Refund Reference / UTR (Optional)</label>
                  <input
                    type="text"
                    value={refundTransactionRef}
                    onChange={(e) => setRefundTransactionRef(e.target.value)}
                    placeholder="Enter UPI UTR or bank reference ID once transferred..."
                    disabled={loading}
                    className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>
            )}

            {/* Organizer Decision Note */}
            <div className="flex flex-col gap-1.5 text-xs">
              <label className="text-gray-700 font-semibold">Organizer Decision Notes</label>
              <textarea
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="Add explanation for the attendee regarding approval or rejection..."
                rows={2}
                disabled={loading}
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
