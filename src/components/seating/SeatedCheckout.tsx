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
        <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Reservation Confirmed!</h3>
          <p className="text-sm text-gray-600 mt-1">
            {reservationResult.total_price > 0
              ? 'Your payment proof has been submitted for review. Your seats are held.'
              : 'Your seats have been booked successfully! View your ticket in your dashboard.'}
          </p>
        </div>
        <div className="inline-flex flex-col items-center gap-1 p-3 rounded-xl bg-gray-50 border border-gray-200">
          {selectedSeats.map((seat) => (
            <div key={seat.id} className="flex items-center gap-2 text-sm">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: seat.category?.color ?? '#2563EB' }}
              />
              <span className="font-semibold text-gray-900">{seat.display_label}</span>
              <span className="text-gray-500">{seat.category?.name}</span>
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
      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900">Your Seat Reservation</h3>
        {reservationResult.seats.map((seat) => (
          <div key={seat.seat_id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seat.category_color }} />
              <span className="font-medium text-gray-900">{seat.display_label}</span>
              <span className="text-gray-500">{seat.category_name}</span>
            </div>
            <span className="text-gray-700 font-medium">
              {seat.price === 0 ? 'Free' : `₹${seat.price}`}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200 font-semibold">
          <span className="text-gray-900">Total</span>
          <div className="flex items-center gap-1 text-blue-600">
            <IndianRupee className="w-4 h-4" />
            {reservationResult.total_price === 0 ? 'Free' : reservationResult.total_price.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Payment instructions */}
      {reservationResult.total_price > 0 && (
        <div className="space-y-4">
          {loadingSettings ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading payment details…
            </div>
          ) : paymentSettings?.upi_id ? (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Payment Instructions</h3>
              {paymentSettings.payment_instructions && (
                <p className="text-sm text-gray-600">{paymentSettings.payment_instructions}</p>
              )}
              <div className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg">
                <IndianRupee className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <div>
                  <div className="text-xs text-gray-500">Pay to UPI ID</div>
                  <div className="text-sm font-mono font-semibold text-gray-900">{paymentSettings.upi_id}</div>
                </div>
              </div>
              {paymentSettings.qr_image_url && (
                <div className="flex justify-center">
                  <img
                    src={paymentSettings.qr_image_url}
                    alt="UPI QR Code"
                    className="w-40 h-40 object-contain rounded-lg border border-gray-200 bg-white p-2"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">Payment instructions not configured. Contact the organizer for payment details.</p>
            </div>
          )}

          {/* Reference input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              UPI Reference / UTR Number *
            </label>
            <input
              type="text"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              placeholder="e.g. 12-digit UTR from your UPI app"
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
            />
          </div>

          {/* Upload proof */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attach Payment Screenshot *
            </label>
            <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-gray-300 bg-gray-50 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50/40 transition-colors">
              <Upload className="w-6 h-6 text-gray-400" />
              <span className="text-sm text-gray-600">
                {proofFile ? proofFile.name : 'Click to upload screenshot (JPG, PNG — max 10MB)'}
              </span>
              <input type="file" accept="image/*" onChange={handleFileChange} className="sr-only" />
            </label>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 bg-rose-50 rounded-xl border border-rose-200">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      <Button
        variant="primary"
        onClick={handleSubmit}
        isLoading={submitting}
        disabled={submitting || (reservationResult.total_price > 0 && (!paymentSettings?.upi_id || !proofFile || !transactionRef.trim()))}
        className="w-full"
      >
        {reservationResult.total_price === 0 ? 'Confirm Free Booking' : 'Submit Payment'}
      </Button>

      <p className="text-xs text-center text-gray-500">
        Your seat is held for {Math.max(1, Math.ceil((new Date(reservationResult.held_until).getTime() - Date.now()) / 60000))} more minutes.
        Complete payment before the hold expires.
      </p>
    </div>
  )
}
