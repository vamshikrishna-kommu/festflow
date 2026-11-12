import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import {
  IndianRupee,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { HoldCountdown } from './HoldCountdown'
import { submitPaymentProof, uploadPaymentScreenshot, getClubPaymentSettings } from '@/lib/payments'
import { useAuth } from '@/context/AuthContext'
import type { ReserveSeatsSuccess, SeatWithAvailability } from '@/types/seating'
import type { ClubPaymentSettings } from '@/types'

interface SeatedCheckoutProps {
  eventId: string
  clubId: string
  registrationId: string
  reservationResult: ReserveSeatsSuccess
  selectedSeats: SeatWithAvailability[]
  onSuccess: () => void
  onExpired: () => void
}

export function SeatedCheckout({
  eventId: _eventId,
  clubId,
  registrationId,
  reservationResult,
  selectedSeats,
  onSuccess,
  onExpired,
}: SeatedCheckoutProps) {
  const { user } = useAuth()
  const [paymentSettings, setPaymentSettings] = useState<ClubPaymentSettings | null>(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [transactionRef, setTransactionRef] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getClubPaymentSettings(clubId).then((settings) => {
      setPaymentSettings(settings)
      setLoadingSettings(false)
    })
  }, [clubId])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('File too large. Max 10MB.')
        return
      }
      setProofFile(file)
      setError(null)
    }
  }

  const handleSubmit = async () => {
    if (reservationResult.total_price > 0) {
      if (!transactionRef.trim() || transactionRef.trim().length < 6) {
        setError('Please enter a valid UPI transaction reference / UTR number (at least 6 characters).')
        return
      }
      if (!proofFile) {
        setError('Please attach your payment screenshot.')
        return
      }
    }

    setSubmitting(true)
    setError(null)

    try {
      let screenshotUrl: string | null = null

      if (reservationResult.total_price > 0 && proofFile && user?.id) {
        const uploadRes = await uploadPaymentScreenshot(user.id, proofFile)
        if (!uploadRes.success || !uploadRes.url) {
          setError(uploadRes.error || 'Failed to upload screenshot. Please try again.')
          setSubmitting(false)
          return
        }
        screenshotUrl = uploadRes.url
      }

      if (reservationResult.total_price > 0) {
        const result = await submitPaymentProof({
          registrationId,
          transactionReference: transactionRef.trim(),
          screenshotUrl,
          amount: reservationResult.total_price,
          notes: `Seat reservation: ${reservationResult.seats.map((s) => s.display_label).join(', ')}`,
        })

        if (!result.success) {
          setError(result.message ?? 'Failed to submit payment. Please try again.')
          setSubmitting(false)
          return
        }
      }

      setSubmitted(true)
      onSuccess()
    } catch (err: any) {
      setError(err?.message || 'Payment submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-10 space-y-4"
      >
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Reservation Confirmed!</h3>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {reservationResult.total_price > 0
              ? 'Your payment proof has been submitted for review. Your seats are held.'
              : 'Your seats have been booked successfully! View your ticket in your dashboard.'}
          </p>
        </div>
        <div className="inline-flex flex-col items-center gap-1 p-3 rounded-xl bg-[var(--color-surface-2)] border border-white/5">
          {selectedSeats.map((seat) => (
            <div key={seat.id} className="flex items-center gap-2 text-sm">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: seat.category?.color ?? '#18CFFC' }}
              />
              <span className="font-semibold text-[var(--color-text-primary)]">{seat.display_label}</span>
              <span className="text-[var(--color-text-muted)]">{seat.category?.name}</span>
            </div>
          ))}
        </div>
      </motion.div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Hold timer */}
      <HoldCountdown heldUntil={reservationResult.held_until} onExpired={onExpired} />

      {/* Seat summary */}
      <div className="p-4 bg-[var(--color-surface-2)] rounded-xl border border-white/5 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Your Seat Reservation</h3>
        {reservationResult.seats.map((seat) => (
          <div key={seat.seat_id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seat.category_color }} />
              <span className="font-medium text-[var(--color-text-primary)]">{seat.display_label}</span>
              <span className="text-[var(--color-text-muted)]">{seat.category_name}</span>
            </div>
            <span className="text-[var(--color-text-secondary)]">
              {seat.price === 0 ? 'Free' : `₹${seat.price}`}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2 border-t border-white/5 font-semibold">
          <span className="text-[var(--color-text-primary)]">Total</span>
          <div className="flex items-center gap-1 text-[#18CFFC]">
            <IndianRupee className="w-4 h-4" />
            {reservationResult.total_price === 0 ? 'Free' : reservationResult.total_price.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Payment instructions */}
      {reservationResult.total_price > 0 && (
        <div className="space-y-4">
          {loadingSettings ? (
            <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading payment details…
            </div>
          ) : paymentSettings?.upi_id ? (
            <div className="p-4 bg-[var(--color-surface-2)] rounded-xl border border-white/5 space-y-3">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Payment Instructions</h3>
              {paymentSettings.payment_instructions && (
                <p className="text-sm text-[var(--color-text-muted)]">{paymentSettings.payment_instructions}</p>
              )}
              <div className="flex items-center gap-2 p-3 bg-[var(--color-surface-3)] rounded-lg">
                <IndianRupee className="w-4 h-4 text-[#18CFFC] flex-shrink-0" />
                <div>
                  <div className="text-xs text-[var(--color-text-muted)]">Pay to UPI ID</div>
                  <div className="text-sm font-mono font-semibold text-[var(--color-text-primary)]">{paymentSettings.upi_id}</div>
                </div>
              </div>
              {paymentSettings.qr_image_url && (
                <div className="flex justify-center">
                  <img
                    src={paymentSettings.qr_image_url}
                    alt="UPI QR Code"
                    className="w-40 h-40 object-contain rounded-lg border border-white/10 bg-white p-2"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 bg-amber-900/20 rounded-xl border border-amber-500/30">
              <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-200">Payment instructions not configured. Contact the organizer for payment details.</p>
            </div>
          )}

          {/* Reference input */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              UPI Reference / UTR Number *
            </label>
            <input
              type="text"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              placeholder="e.g. 12-digit UTR from your UPI app"
              className="w-full px-3 py-2 bg-[var(--color-surface-2)] border border-white/10 rounded-lg text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC]"
            />
          </div>

          {/* Upload proof */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              Attach Payment Screenshot *
            </label>
            <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-[#18CFFC]/50 transition-colors">
              <Upload className="w-6 h-6 text-[var(--color-text-muted)]" />
              <span className="text-sm text-[var(--color-text-muted)]">
                {proofFile ? proofFile.name : 'Click to upload screenshot (JPG, PNG — max 10MB)'}
              </span>
              <input type="file" accept="image/*" onChange={handleFileChange} className="sr-only" />
            </label>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-900/20 rounded-xl border border-red-500/30">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <Button
        variant="primary"
        onClick={handleSubmit}
        isLoading={submitting}
        disabled={submitting || (reservationResult.total_price > 0 && (!proofFile || !transactionRef.trim()))}
        className="w-full bg-gradient-to-r from-[#18CFFC] to-[#0D56FB] text-[#08080A] font-semibold"
      >
        {reservationResult.total_price === 0 ? 'Confirm Free Booking' : 'Submit Payment'}
      </Button>

      <p className="text-xs text-center text-[var(--color-text-muted)]">
        Your seat is held for {Math.max(1, Math.ceil((new Date(reservationResult.held_until).getTime() - Date.now()) / 60000))} more minutes.
        Complete payment before the hold expires.
      </p>
    </div>
  )
}
