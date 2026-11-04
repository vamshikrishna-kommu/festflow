import { useState } from 'react'
import {
  Modal,
  ModalBody,
  ModalFooter,
  Button,
  Alert,
} from '@/components/ui'
import { Clock, Send } from 'lucide-react'
import { requestRegistrationCancellation } from '@/lib/cancellations'
import { CANCELLATION_REASONS, type CancellationReasonType } from '@/types'

interface RequestCancellationModalProps {
  isOpen: boolean
  onClose: () => void
  registrationId: string
  eventTitle: string
  onSubmitted?: () => void
}

export function RequestCancellationModal({
  isOpen,
  onClose,
  registrationId,
  eventTitle,
  onSubmitted,
}: RequestCancellationModalProps) {
  const [reason, setReason] = useState<CancellationReasonType>('unable_to_attend')
  const [explanation, setExplanation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await requestRegistrationCancellation({
      registrationId,
      reason,
      explanation: explanation.trim() || undefined,
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
      setError(res.message || 'Failed to submit cancellation request.')
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
      title="Request Pass Cancellation"
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <ModalBody>
          <div className="flex flex-col gap-4 text-left">
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
              <Clock size={20} className="shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <strong className="block font-semibold mb-0.5">Organizer Review Required</strong>
                Cancellation requests must be reviewed and approved by the club organizing{' '}
                <strong className="text-white">{eventTitle}</strong>. Your ticket remains active until an organizer confirms the request.
              </div>
            </div>

            {error && (
              <Alert variant="error" className="text-xs">
                {error}
              </Alert>
            )}

            {success && (
              <Alert variant="success" className="text-xs">
                Cancellation request submitted successfully! The organizing club has been notified.
              </Alert>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                Reason for Cancellation <span className="text-rose-400">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as CancellationReasonType)}
                disabled={loading || success}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#14141A] border border-white/10 text-xs text-white focus:outline-none focus:border-[#18CFFC]"
              >
                {CANCELLATION_REASONS.map((r) => (
                  <option key={r.value} value={r.value} className="bg-[#14141A] text-white">
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                Additional Explanation <span className="text-zinc-500 font-normal">(Optional)</span>
              </label>
              <textarea
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Provide any context or notes for the organizing team..."
                disabled={loading || success}
                rows={3}
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
            disabled={loading || success}
            onClick={onClose}
          >
            Keep My Pass
          </Button>
          <Button
            type="submit"
            variant="danger"
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
