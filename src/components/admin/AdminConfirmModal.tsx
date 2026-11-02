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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md bg-[#0D0E15] border border-white/10 rounded-2xl shadow-2xl p-6 relative overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Glow accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-[#ED47FC]" />

        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
            <ShieldAlert size={20} />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <h3 className="text-lg font-bold text-white font-display mb-2">{title}</h3>
        <p className="text-xs text-white/60 leading-relaxed mb-4">{description}</p>

        {requireReason && (
          <div className="space-y-2 mb-4">
            <label className="text-xs font-medium text-white/70 block">
              Audit Justification <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (error) setError(null)
              }}
              placeholder={reasonPlaceholder}
              className="w-full p-3 bg-white/[0.03] border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#18CFFC]/50 transition-colors resize-none"
            />
          </div>
        )}

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || (requireReason && reason.trim().length < 5)}
            className={`
              px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all
              ${
                confirmVariant === 'danger'
                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20 disabled:opacity-50'
                  : 'bg-[#18CFFC] hover:bg-[#18CFFC]/90 text-black font-bold shadow-lg shadow-[#18CFFC]/20 disabled:opacity-50'
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
