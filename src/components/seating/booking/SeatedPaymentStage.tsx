import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { QRCodeSVG } from 'qrcode.react'
import {
  Upload,
  Copy,
  Check,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  X,
} from 'lucide-react'
import { Button, Alert, Badge } from '@/components/ui'
import { HoldCountdown } from '../HoldCountdown'
import {
  getClubPaymentSettings,
  uploadPaymentScreenshot,
  submitPaymentProof,
} from '@/lib/payments'
import { extractUtrFromImageFile } from '@/lib/ocrUtrExtractor'
import { useAuth } from '@/context/AuthContext'
import type { EventWithClub, ClubPaymentSettings } from '@/types'
import type { ReserveSeatItem, SeatParticipant } from '@/types/seating'

interface SeatedPaymentStageProps {
  event: EventWithClub
  registrationId: string
  seats: ReserveSeatItem[]
  participants: SeatParticipant[]
  totalPrice: number
  heldUntil: string
  onBack: () => void
  onExpired: () => void
  onSuccess: (paymentSubmissionId?: string) => void
}

export function SeatedPaymentStage({
  event,
  registrationId,
  seats,
  participants,
  totalPrice,
  heldUntil,
  onBack,
  onExpired,
  onSuccess,
}: SeatedPaymentStageProps) {
  const { user } = useAuth()
  const [clubSettings, setClubSettings] = useState<ClubPaymentSettings | null>(null)

  // Payment form states
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [utrReference, setUtrReference] = useState('')
  const [studentNotes, setStudentNotes] = useState('')
  const [copiedUpi, setCopiedUpi] = useState(false)

  // OCR state
  const [isExtractingOcr, setIsExtractingOcr] = useState(false)
  const [ocrMessage, setOcrMessage] = useState<string | null>(null)

  // Feedback states
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    if (event.club_id) {
      getClubPaymentSettings(event.club_id)
        .then((settings) => {
          if (active) {
            setClubSettings(settings)
          }
        })
        .catch(() => {})
    }

    return () => {
      active = false
    }
  }, [event.club_id])

  const upiId = clubSettings?.upi_id || 'organizer@upi'
  const payeeName = clubSettings?.account_name || event.club?.display_name || 'FestFlow Club'
  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    payeeName
  )}&am=${totalPrice}&cu=INR&tn=${encodeURIComponent(`Seats for ${event.title}`)}`

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId)
    setCopiedUpi(true)
    setTimeout(() => setCopiedUpi(false), 2000)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit.')
      return
    }

    setProofFile(file)
    setError(null)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)

    // Automatically attempt OCR extraction of UTR number
    try {
      setIsExtractingOcr(true)
      setOcrMessage('Scanning receipt for UTR / Reference number…')
      const result = await extractUtrFromImageFile(file)
      if (result && result.reference) {
        setUtrReference(result.reference)
        setOcrMessage(`Auto-detected UTR: ${result.reference}`)
      } else {
        setOcrMessage(null)
      }
    } catch {
      setOcrMessage(null)
    } finally {
      setIsExtractingOcr(false)
    }
  }

  const handleClearFile = () => {
    setProofFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setOcrMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!utrReference.trim() || utrReference.trim().length < 6) {
      setError('Please provide a valid 12-digit UTR or Transaction Reference number (at least 6 characters).')
      return
    }

    if (!proofFile) {
      setError('Please attach a screenshot of your successful UPI payment.')
      return
    }

    if (!user?.id) {
      setError('You must be signed in to submit payment proof.')
      return
    }

    setIsSubmitting(true)

    try {
      // 1. Upload screenshot to Supabase storage
      const uploadRes = await uploadPaymentScreenshot(user.id, proofFile)
      if (!uploadRes.success || !uploadRes.url) {
        setError(uploadRes.error || 'Failed to upload payment screenshot. Please try again.')
        setIsSubmitting(false)
        return
      }

      // 2. Submit payment proof record
      const seatLabels = seats.map((s) => s.display_label).join(', ')
      const result = await submitPaymentProof({
        registrationId,
        transactionReference: utrReference.trim(),
        screenshotUrl: uploadRes.url,
        amount: totalPrice,
        notes: `Reserved Seating: ${seatLabels}${studentNotes.trim() ? ` • Notes: ${studentNotes.trim()}` : ''}`,
      })

      if (!result.success) {
        setError(result.message || 'Payment submission failed. Please verify your reference number.')
        setIsSubmitting(false)
        return
      }

      onSuccess(result.submission_id)
    } catch (err: any) {
      setError(err?.message || 'Failed to submit payment. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-6"
    >
      {/* Top Banner: Hold Countdown + Policy Explanation */}
      <div className="bg-[var(--color-surface-1)] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="cyan">Hold Active</Badge>
              <span className="text-xs text-[var(--color-text-muted)]">
                {seats.length} Seat{seats.length > 1 ? 's' : ''} Reserved
              </span>
            </div>
            <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
              Complete Manual UPI Payment
            </h3>
          </div>

          <div className="flex sm:flex-col sm:items-end justify-between items-center">
            <HoldCountdown heldUntil={heldUntil} onExpired={onExpired} />
            <div className="text-xs text-[var(--color-text-muted)] mt-1">
              Amount Due:{' '}
              <strong className="text-emerald-400 text-base">
                ₹{totalPrice.toLocaleString('en-IN')}
              </strong>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2.5 mt-3 text-xs text-[var(--color-text-muted)]">
          <ShieldCheck className="w-4 h-4 text-[#18CFFC] flex-shrink-0 mt-0.5" />
          <span>
            <strong>Reservation Policy:</strong> Once you submit your UPI reference number and screenshot, your seat reservation is locked for review. The organizing club will manually verify the payment. If approved, your digital pass will activate immediately.
          </span>
        </div>
      </div>

      {error && (
        <Alert variant="error">
          <AlertCircle className="w-4 h-4 mr-2" />
          {error}
        </Alert>
      )}

      {/* Main Grid: QR & UPI Info + Upload Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: UPI Details & QR Code (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-[var(--color-surface-1)] border border-white/10 rounded-2xl p-5 shadow-xl text-center space-y-4">
            <div>
              <span className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">
                Scan & Pay With Any UPI App
              </span>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                GPay, PhonePe, Paytm, BHIM, Cred
              </p>
            </div>

            {/* Dynamic QR Code */}
            <div className="inline-block p-4 bg-white rounded-2xl shadow-xl">
              <QRCodeSVG
                value={upiUrl}
                size={180}
                level="M"
                includeMargin={false}
              />
            </div>

            {/* UPI ID Pill */}
            <div className="bg-[var(--color-surface-2)] border border-white/10 rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="text-left overflow-hidden">
                <div className="text-[10px] uppercase text-[var(--color-text-muted)] font-medium">
                  UPI ID (VPA)
                </div>
                <div className="text-xs font-mono font-bold text-[var(--color-text-primary)] truncate">
                  {upiId}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyUpi}
                className="flex-shrink-0 text-xs py-1 px-2.5"
              >
                {copiedUpi ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>

            <div className="text-left text-xs space-y-1 text-[var(--color-text-muted)] pt-2 border-t border-white/5">
              <div className="flex justify-between">
                <span>Payee Name:</span>
                <strong className="text-[var(--color-text-primary)]">{payeeName}</strong>
              </div>
              <div className="flex justify-between">
                <span>Exact Amount:</span>
                <strong className="text-emerald-400">₹{totalPrice.toLocaleString('en-IN')}</strong>
              </div>
            </div>
          </div>

          {/* Seat Breakdown Card */}
          <div className="bg-[var(--color-surface-1)] border border-white/10 rounded-2xl p-4 shadow-xl space-y-3">
            <h4 className="text-xs uppercase tracking-wider font-bold text-[var(--color-text-muted)]">
              Seats in this Booking ({seats.length})
            </h4>
            <div className="space-y-2">
              {seats.map((s, idx) => {
                const p = participants[idx]
                return (
                  <div
                    key={s.seat_id}
                    className="flex items-center justify-between p-2 rounded-xl bg-[var(--color-surface-2)] text-xs border border-white/5"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: s.category_color || '#18CFFC' }}
                      />
                      <span className="font-bold text-[var(--color-text-primary)]">
                        Seat {s.display_label}
                      </span>
                      <span className="text-[var(--color-text-muted)]">
                        ({s.category_name})
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-[var(--color-text-primary)]">
                        ₹{s.price}
                      </div>
                      {p && (
                        <div className="text-[10px] text-[var(--color-text-muted)]">
                          {p.student_name}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Col: Payment Submission Form (7 cols) */}
        <div className="lg:col-span-7">
          <form
            onSubmit={handleSubmit}
            className="bg-[var(--color-surface-1)] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5"
          >
            <div>
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                Submit Payment Verification Proof
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                After completing the transfer in your UPI app, provide the 12-digit reference number and a clear screenshot.
              </p>
            </div>

            {/* UTR Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                UPI Reference / UTR Number *
              </label>
              <input
                type="text"
                value={utrReference}
                onChange={(e) => setUtrReference(e.target.value)}
                placeholder="e.g. 332400192842"
                maxLength={50}
                className="w-full bg-[var(--color-surface-2)] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-mono text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC]"
              />
              {ocrMessage && (
                <div className="flex items-center gap-1.5 text-xs text-[#18CFFC]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{ocrMessage}</span>
                </div>
              )}
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Usually found under transaction details as UTR, UPI Ref ID, or Transaction ID.
              </p>
            </div>

            {/* Screenshot Upload */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                Payment Screenshot *
              </label>

              {!previewUrl ? (
                <label className="border-2 border-dashed border-white/15 hover:border-[#18CFFC]/50 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-[var(--color-surface-2)]/40 hover:bg-[var(--color-surface-2)]">
                  <div className="w-10 h-10 rounded-full bg-[#18CFFC]/10 border border-[#18CFFC]/20 flex items-center justify-center text-[#18CFFC]">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                    Click to upload payment screenshot
                  </span>
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    PNG, JPG, WEBP up to 10MB
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-[var(--color-surface-2)] p-2">
                  <img
                    src={previewUrl}
                    alt="Payment Screenshot Preview"
                    className="w-full max-h-52 object-contain rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={handleClearFile}
                    className="absolute top-4 right-4 p-1.5 rounded-full bg-black/70 hover:bg-red-600 text-white transition-colors"
                    title="Remove image"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {isExtractingOcr && (
                    <div className="p-2 text-center text-xs text-[#18CFFC] animate-pulse">
                      Analyzing screenshot for UTR...
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Student Notes */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                Additional Notes (Optional)
              </label>
              <textarea
                value={studentNotes}
                onChange={(e) => setStudentNotes(e.target.value)}
                placeholder="Any special remarks or details for the host club..."
                rows={2}
                className="w-full bg-[var(--color-surface-2)] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC]"
              />
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/5">
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back to Details
              </Button>

              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                disabled={isSubmitting || !utrReference.trim() || !proofFile}
                className="w-full sm:w-auto bg-gradient-to-r from-emerald-400 to-[#18CFFC] text-black font-bold px-6"
              >
                Submit Payment Proof
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </motion.div>
  )
}
