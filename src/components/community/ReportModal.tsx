import { useState } from 'react'
import { ShieldAlert, AlertTriangle } from 'lucide-react'
import { Modal, ModalBody, ModalFooter, Button } from '@/components/ui'
import { submitCommunityReport } from '@/lib/moderation'
import { useAuth } from '@/context/AuthContext'
import type { ReportTargetType } from '@/types'

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
  targetType: ReportTargetType
  targetId: string
  targetTitle?: string
  targetLabel?: string
}

export function ReportModal({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetTitle,
  targetLabel,
}: ReportModalProps) {
  const { user } = useAuth()
  const [reason, setReason] = useState('spam')
  const [details, setDetails] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    setError(null)

    const res = await submitCommunityReport({
      reporterId: user.id,
      targetType,
      targetId,
      reason,
      details: details.trim() || undefined,
    })

    setLoading(false)
    if (res.success) {
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setDetails('')
        onClose()
      }, 2000)
    } else {
      setError(res.message || 'Failed to submit report.')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" title="Report Inappropriate Content">
      <ModalBody className="p-4 sm:p-6 space-y-4">
        {success ? (
          <div className="py-6 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
              ✓
            </div>
            <h4 className="text-sm font-bold text-white">Report Submitted</h4>
            <p className="text-xs text-[var(--color-text-muted)]">
              Thank you for keeping our campus community safe. Our moderation team has been notified.
            </p>
          </div>
        ) : (
          <form id="report-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>
                Reports are confidential and reviewed under campus safety guidelines. False reporting is prohibited.
              </span>
            </div>

            {(targetTitle || targetLabel) && (
              <div className="text-xs text-[var(--color-text-muted)]">
                Reporting: <strong className="text-white">{targetTitle || targetLabel}</strong>
              </div>
            )}

            <div>
              <label className="block text-xs font-mono uppercase text-[var(--color-text-muted)] mb-1">
                Reason for Reporting
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#18CFFC]"
              >
                <option value="spam">Spam or Unsolicited Promotion</option>
                <option value="harassment">Harassment or Inappropriate Behavior</option>
                <option value="misleading">Misleading or Fraudulent Information</option>
                <option value="offensive">Offensive Language or Hate Speech</option>
                <option value="other">Other Campus Policy Violation</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-[var(--color-text-muted)] mb-1">
                Additional Context (Optional)
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Provide any additional details to help our moderation team review this report..."
                rows={3}
                className="w-full p-3 rounded-xl bg-[var(--color-surface-2)] border border-white/[0.1] text-xs text-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC]"
              />
            </div>

            {error && (
              <div className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                {error}
              </div>
            )}
          </form>
        )}
      </ModalBody>

      {!success && (
        <ModalFooter className="flex items-center justify-end gap-2 p-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            type="submit"
            form="report-form"
            isLoading={loading}
            leftIcon={<ShieldAlert size={14} />}
          >
            Submit Report
          </Button>
        </ModalFooter>
      )}
    </Modal>
  )
}
