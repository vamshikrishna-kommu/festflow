// Phase 7: Secure Admin Confirmation Modal with Mandatory Audit Justification
import { useState } from 'react'
import { AlertTriangle, X, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui'

interface AdminConfirmModalProps {
  isOpen: boolean
  title: string
  description: string
  confirmLabel?: string
  confirmVariant?: 'danger' | 'primary'
  requireReason?: boolean
  reasonPlaceholder?: string
  onClose: () => void
  onConfirm: (reason: string) => Promise<void> | void
}

export function AdminConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm Action',
  confirmVariant = 'danger',
  requireReason = true,
  reasonPlaceholder = 'Provide a detailed reason for this administrative action (mandatory for audit log)…',
  onClose,
  onConfirm,
}: AdminConfirmModalProps) {
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleConfirm = async () => {
    if (requireReason && (!reason || reason.trim().length < 5)) {
      setError('A written justification of at least 5 characters is mandatory for audit compliance.')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)
      await onConfirm(reason.trim())
      setReason('')
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to execute administrative action.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-xl p-6 relative overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Top accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-rose-600" />

        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
            <ShieldAlert size={20} />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <h3 className="text-lg font-bold text-gray-900 font-display mb-2">{title}</h3>
        <p className="text-xs text-gray-600 leading-relaxed mb-4">{description}</p>

        {requireReason && (
          <div className="space-y-2 mb-4">
            <label className="text-xs font-medium text-gray-700 block">
              Audit Justification <span className="text-rose-600">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (error) setError(null)
              }}
              placeholder={reasonPlaceholder}
              className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-colors resize-none"
            />
          </div>
        )}

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || (requireReason && reason.trim().length < 5)}
            className={`
              px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all shadow-xs
              ${
                confirmVariant === 'danger'
                  ? 'bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50'
                  : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50'
              }
            `}
          >
            {isSubmitting ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
