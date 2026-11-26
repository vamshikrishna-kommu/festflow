import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router'
import { motion } from 'motion/react'
import { QRCodeSVG } from 'qrcode.react'
import {
  Copy,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Upload,
  Clock,
  ExternalLink,
  ShieldCheck,
  Calendar,
  MapPin,
  Smartphone,
  Mail,
  Info,
  Scan,
  Sparkles,
  Users,
  Tag,
  X,
} from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Button, Card, Badge, PageHeader, Alert, Modal, ModalBody, ModalFooter } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { isProduction } from '@/lib/supabase'
import { getRegistrationById } from '@/lib/registrations'
import {
  getClubPaymentSettings,
  getStudentPaymentSubmission,
  submitPaymentProof,
  uploadPaymentScreenshot,
  requestPaymentReview,
} from '@/lib/payments'
import { validateCoupon, redeemCoupon } from '@/lib/coupons'
import { extractUtrFromImageFile } from '@/lib/ocrUtrExtractor'
import { fadeIn } from '@/lib/animations'
import type {
  RegistrationWithEvent,
  ClubPaymentSettings,
  PaymentSubmission,
  EventCouponRecord,
} from '@/types'

import { ResourceOwnerGuard } from '@/components/auth/ResourceOwnerGuard'
import { subscribeToStatusChanges } from '@/lib/sync'

export default function StudentPaymentPage() {
  const { registrationId } = useParams<{ registrationId: string }>()
  const { user, role } = useAuth()

  const [registration, setRegistration] = useState<RegistrationWithEvent | null>(null)
  const [clubSettings, setClubSettings] = useState<ClubPaymentSettings | null>(null)
  const [submission, setSubmission] = useState<PaymentSubmission | null>(null)

  const [loading, setLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [copiedUpi, setCopiedUpi] = useState(false)

  // Direct UPI Form states
  const [utrReference, setUtrReference] = useState('')
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const [studentNotes, setStudentNotes] = useState('')
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // OCR extraction states
  const [isExtractingOcr, setIsExtractingOcr] = useState(false)
  const [ocrProgress, setOcrProgress] = useState({ percent: 0, text: '' })
  const [ocrStatusMessage, setOcrStatusMessage] = useState<{
    type: 'success' | 'warning' | 'info' | 'error'
    text: string
  } | null>(null)
  const [detectedUtrCandidate, setDetectedUtrCandidate] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)

  // Coupon verification and discount states
  const [couponInput, setCouponInput] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const [appliedCoupon, setAppliedCoupon] = useState<EventCouponRecord | null>(null)
  const [discountAmount, setDiscountAmount] = useState<number>(0)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [couponSuccess, setCouponSuccess] = useState<string | null>(null)

  const hasUserEditedUtr = useRef(false)
  const initialLoadDone = useRef(false)

  const [notice, setNotice] = useState<{ message: string; isError?: boolean } | null>(null)

  // Payment Dispute Review Modal State (Module 8)
  const [disputeModalOpen, setDisputeModalOpen] = useState(false)
  const [disputeNotes, setDisputeNotes] = useState('')
  const [disputeLoading, setDisputeLoading] = useState(false)
  const [disputeSuccess, setDisputeSuccess] = useState(false)
  const [disputeError, setDisputeError] = useState<string | null>(null)

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!submission?.id || !disputeNotes.trim()) return
    setDisputeLoading(true)
    setDisputeError(null)

    const res = await requestPaymentReview({
      submissionId: submission.id,
      studentNotes: disputeNotes.trim(),
      studentId: user?.id,
    })

    setDisputeLoading(false)
    if (res.success) {
      setDisputeSuccess(true)
      setTimeout(() => {
        setDisputeSuccess(false)
        setDisputeModalOpen(false)
        loadData(true)
      }, 1500)
    } else {
      setDisputeError(res.message || 'Failed to submit payment review request.')
    }
  }

  const loadData = async (isBackground = false) => {
    if (!registrationId) return
    if (!isBackground) {
      setLoading(true)
    }
    const regRes = await getRegistrationById(registrationId)
    if (regRes.registration) {
      const authorized = (user && regRes.registration.student_id === user.id) || role === 'platform_admin'
      setIsAuthorized(authorized)
      if (!authorized) {
        if (!isBackground) setLoading(false)
        return
      }

      setRegistration(regRes.registration)
      const clubId = regRes.registration.event?.club_id || ''
      const [settings, sub] = await Promise.all([
        clubId ? getClubPaymentSettings(clubId) : Promise.resolve(null),
        getStudentPaymentSubmission(registrationId),
      ])
      setClubSettings(settings)
      setSubmission(sub)
      if (sub?.transaction_reference && !hasUserEditedUtr.current) {
        setUtrReference(sub.transaction_reference)
      }
      if (sub?.screenshot_url && !screenshotFile) {
        setScreenshotPreview(sub.screenshot_url)
      }
    } else {
      setIsAuthorized(false)
    }
    if (!isBackground) {
      setLoading(false)
      initialLoadDone.current = true
    }
  }

  useEffect(() => {
    loadData(initialLoadDone.current)

    const unsubscribe = subscribeToStatusChanges(
      ['payment_reviewed', 'registration_updated'],
      (event) => {
        if (!event.registrationId || event.registrationId === registrationId) {
          loadData(true)
        }
      }
    )
    return () => unsubscribe()
  }, [registrationId, user?.id, role])

  const handleCopyUpi = () => {
    const upi = clubSettings?.upi_id
    if (!upi) return
    navigator.clipboard.writeText(upi)
    setCopiedUpi(true)
    setTimeout(() => setCopiedUpi(false), 2000)
  }

  /**
   * Executes OCR on the selected screenshot to identify candidate UTR/RRN numbers.
   */
  const runOcrExtraction = async (file: File) => {
    setIsExtractingOcr(true)
    setOcrProgress({ percent: 5, text: 'Preparing image…' })
    setOcrStatusMessage(null)
    setDetectedUtrCandidate(null)

    try {
      const result = await extractUtrFromImageFile(file, (progress, statusText) => {
        setOcrProgress({
          percent: Math.round(progress * 100),
          text: statusText,
        })
      })

      if (result.success && result.reference) {
        setDetectedUtrCandidate(result.reference)
        // If user hasn't typed anything yet or field is empty, populate automatically
        if (!utrReference.trim()) {
          setUtrReference(result.reference)
          hasUserEditedUtr.current = true
          setFieldError(null)
          setOcrStatusMessage({
            type: 'success',
            text: 'Reference detected — please verify it.',
          })
        } else if (utrReference.trim() === result.reference) {
          setOcrStatusMessage({
            type: 'success',
            text: 'Reference verified from screenshot.',
          })
        } else {
          // Preserve student's manually entered value, never silently overwrite!
          setOcrStatusMessage({
            type: 'info',
            text: `Detected UTR ${result.reference} from screenshot. Your current manual entry is preserved.`,
          })
        }
      } else {
        setOcrStatusMessage({
          type: 'warning',
          text: 'Could not confidently detect the UTR. Please enter it manually.',
        })
      }
    } catch {
      setOcrStatusMessage({
        type: 'warning',
        text: 'Could not confidently detect the UTR. Please enter it manually.',
      })
    } finally {
      setIsExtractingOcr(false)
    }
  }

  const handleScreenshotSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setNotice({ message: 'Please select an image file (PNG, JPG, or WEBP).', isError: true })
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setNotice({ message: 'Screenshot must be under 10MB.', isError: true })
      return
    }

    setScreenshotFile(file)
    setNotice(null)

    const reader = new FileReader()
    reader.onload = () => setScreenshotPreview(reader.result as string)
    reader.readAsDataURL(file)

    // Run OCR automatic extraction
    runOcrExtraction(file)
  }

  // ── Coupon Verification & Discount Application ────────────────────────────
  const handleApplyCoupon = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const cleanCode = couponInput.trim().toUpperCase()
    if (!cleanCode) {
      setCouponError('Please enter a coupon code.')
      setCouponSuccess(null)
      return
    }

    setCouponLoading(true)
    setCouponError(null)
    setCouponSuccess(null)

    const baseFee = registration?.event?.price || 0
    const res = await validateCoupon(cleanCode, registration?.event?.id || '', baseFee)
    setCouponLoading(false)

    if (res.valid && res.coupon) {
      setAppliedCoupon(res.coupon)
      setDiscountAmount(res.discountAmount)
      const discountMsg =
        res.coupon.discount_type === 'percentage'
          ? `${res.coupon.discount_value}% OFF applied! You save ₹${res.discountAmount}.`
          : `₹${res.discountAmount} discount applied successfully!`
      setCouponSuccess(discountMsg)
      setCouponInput('')
    } else {
      setAppliedCoupon(null)
      setDiscountAmount(0)
      setCouponError(res.error || 'Invalid or expired coupon code.')
    }
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setDiscountAmount(0)
    setCouponSuccess(null)
    setCouponError(null)
    setCouponInput('')
  }

  // ── UPI UTR Submission (Honest Organizer Verification Workflow) ─────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!registrationId || !user) return

    const cleanRef = utrReference.trim()
    if (!cleanRef) {
      setFieldError('Please enter the 12-digit UPI transaction reference (UTR) from your payment receipt.')
      return
    }

    if (cleanRef.length < 6 || cleanRef.length > 24) {
      setFieldError('Transaction reference / UTR must be between 6 and 24 characters.')
      return
    }

    if (!/^[A-Za-z0-9\-_]{6,24}$/.test(cleanRef)) {
      setFieldError('Transaction reference may only contain alphanumeric characters and hyphens.')
      return
    }

    setSubmitting(true)
    setNotice(null)
    setFieldError(null)

    // Store verified storage path rather than large data URIs
    let uploadedScreenshotUrl =
      submission?.screenshot_url ||
      (screenshotPreview && !screenshotPreview.startsWith('data:') ? screenshotPreview : null)

    if (screenshotFile) {
      setUploadingScreenshot(true)
      const uploadRes = await uploadPaymentScreenshot(user.id, screenshotFile)
      setUploadingScreenshot(false)
      if (uploadRes.success && uploadRes.url) {
        uploadedScreenshotUrl = uploadRes.url
      } else if (uploadRes.error) {
        setNotice({
          message: `Screenshot upload warning: ${uploadRes.error}. Submitting transaction reference...`,
          isError: false,
        })
      }
    }

    let combinedNotes = studentNotes.trim()
    if (appliedCoupon) {
      const finalPaid = Math.max(0, (registration?.event?.price || 0) - discountAmount)
      const couponTag = `[Coupon Applied: ${appliedCoupon.code} | Discount: ₹${discountAmount} | Final Amount Paid: ₹${finalPaid}]`
      combinedNotes = combinedNotes ? `${couponTag} | ${combinedNotes}` : couponTag
    }

    const res = await submitPaymentProof({
      registrationId,
      transactionReference: cleanRef,
      screenshotUrl: uploadedScreenshotUrl,
      notes: combinedNotes || null,
      amount: effectiveAmount,
    })

    setSubmitting(false)

    if (res.success) {
      if (appliedCoupon) {
        redeemCoupon(appliedCoupon.id).catch(() => {})
      }
      setNotice({
        message: res.message || 'Payment reference submitted successfully! The club organizer will verify and activate your pass.',
      })
      await loadData(true)
    } else {
      setNotice({ message: res.message || 'Failed to submit payment details.', isError: true })
    }
  }

  const event = registration?.event
  const effectiveUpi = clubSettings?.upi_id || ''
  const effectiveName = clubSettings?.account_name || 'Campus Event Organizer'
  const basePrice = event?.price || 0
  const finalPrice = Math.max(0, basePrice - discountAmount)
  const effectiveAmount = appliedCoupon ? finalPrice : basePrice
  const effectiveCurrency = event?.currency || 'INR'

  // Authoritative payment display status booleans
  const isFreeEvent = Boolean(event?.is_free) || effectiveAmount === 0 || basePrice === 0
  const isPaymentApproved = submission?.status === 'approved' && registration?.status === 'confirmed'
  const isPaymentPendingReview = !isPaymentApproved && (submission?.status === 'pending_review' || registration?.status === 'pending_approval')
  const isPaymentRejected = !isPaymentApproved && !isPaymentPendingReview && (submission?.status === 'rejected' || registration?.status === 'rejected')
  const isPaymentPendingSubmission = !isFreeEvent && !isPaymentApproved && !isPaymentPendingReview && !isPaymentRejected

  // Dynamic UPI URI for QR and mobile app intent
  const upiIntentUri = effectiveUpi
    ? `upi://pay?pa=${encodeURIComponent(effectiveUpi)}&pn=${encodeURIComponent(
        effectiveName
      )}&am=${encodeURIComponent(effectiveAmount.toString())}&cu=INR&tn=${encodeURIComponent(
        `FestFlow Pass ${registration?.ticket_code || ''}`
      )}`
    : ''

  return (
    <PageShell>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32 sm:pb-28 pt-4 flex flex-col gap-6 text-left">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin" />
            <span className="text-xs text-gray-500">Loading event payment details…</span>
          </div>
        ) : isAuthorized === false ? (
          <ResourceOwnerGuard
            isAuthorized={false}
            denialTitle="Payment Access Restricted"
            denialMessage="You do not have permission to view or submit payments for this registration pass. Passes are strictly tied to the registering student."
            fallbackUrl="/student/dashboard"
            fallbackLabel="Back to My Passes"
          >
            <div />
          </ResourceOwnerGuard>
        ) : !registration || !event ? (
          <Card className="p-8 text-center max-w-lg mx-auto">
            <AlertCircle size={40} className="text-rose-400 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">
              Registration Not Found
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)] mb-6">
              The registration details could not be loaded. Please return to your passes dashboard.
            </p>
            <Link to="/student/dashboard">
              <Button variant="outline" size="sm">
                Back to Dashboard
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Page Header */}
            <PageHeader
              breadcrumbs={[
                { label: 'My Passes', href: '/student/dashboard' },
                { label: 'Event Payment' },
              ]}
              title={`Pay via UPI: ${event.title}`}
              badge={
                isFreeEvent
                  ? 'Free Event'
                  : isPaymentApproved
                  ? 'Payment Verified'
                  : isPaymentPendingReview
                  ? 'Awaiting Club Verification'
                  : isPaymentRejected
                  ? 'Payment Rejected'
                  : registration.status === 'pending_approval'
                  ? 'Application Under Review'
                  : registration.status === 'cancelled'
                  ? 'Registration Cancelled'
                  : 'Payment Pending'
              }
              badgeVariant={
                isFreeEvent || isPaymentApproved
                  ? 'success'
                  : isPaymentPendingReview
                  ? 'amber'
                  : isPaymentRejected
                  ? 'danger'
                  : registration.status === 'pending_approval'
                  ? 'purple'
                  : registration.status === 'cancelled'
                  ? 'neutral'
                  : 'amber'
              }
              subtitle={
                isFreeEvent
                  ? `Registration Reference: ${registration.ticket_code} • Free event admission pass is confirmed.`
                  : isPaymentApproved
                  ? `Registration Reference: ${registration.ticket_code} • Payment verified by organizer. Entry pass confirmed.`
                  : isPaymentPendingReview
                  ? `Registration Reference: ${registration.ticket_code} • Payment submitted (UTR: ${submission?.transaction_reference}). Awaiting organizer verification.`
                  : isPaymentRejected
                  ? `Registration Reference: ${registration.ticket_code} • Payment submission was declined. Please verify and resubmit.`
                  : `Registration Reference: ${registration.ticket_code} • Transfer ${effectiveCurrency} ${effectiveAmount} via UPI to the organizer and submit your 12-digit transaction reference for verification.`
              }
            />

            {/* ── Status Notices ─────────────────────────────────────────────── */}
            {isFreeEvent ? (
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                className="p-6 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
                  <div>
                    <h3 className="font-bold text-sm text-emerald-950">
                      This Event is Free of Charge!
                    </h3>
                    <p className="text-xs text-emerald-800">
                      No payment transaction is required for free campus events. Your confirmed digital entry pass is ready below.
                    </p>
                  </div>
                </div>
                <Link to={`/student/tickets/${registration.id}`}>
                  <Button variant="primary" size="sm" rightIcon={<ExternalLink size={14} />}>
                    View Digital Pass
                  </Button>
                </Link>
              </motion.div>
            ) : registration.status === 'pending_approval' ? (
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                className="p-8 rounded-2xl bg-white border border-gray-200 text-center flex flex-col items-center gap-4 max-w-lg mx-auto my-4 shadow-sm"
              >
                <div className="w-14 h-14 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                  <Clock size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-display text-gray-900">
                    Application Under Host Review
                  </h3>
                  <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                    This event requires manual organizer review. Your application has been received, but payment submission is locked until the organizer approves your registration.
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <Link to="/student/dashboard">
                    <Button variant="secondary" size="sm">
                      Back to Dashboard
                    </Button>
                  </Link>
                  <Link to={`/student/tickets/${registration.id}`}>
                    <Button variant="primary" size="sm">
                      View Application
                    </Button>
                  </Link>
                </div>
              </motion.div>
            ) : isPaymentApproved ? (
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                className="p-6 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-emerald-950">
                      Payment Verified & Pass Active!
                    </h3>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Your payment of <strong className="text-emerald-950">{effectiveCurrency} {effectiveAmount}</strong> (Ref: <span className="font-mono text-emerald-950 font-bold">{submission?.transaction_reference || 'Verified'}</span>) has been verified and confirmed by the organizer.
                    </p>
                  </div>
                </div>
                <Link to={`/student/tickets/${registration.id}`} className="shrink-0">
                  <Button variant="primary" size="md" rightIcon={<ExternalLink size={15} />}>
                    View Digital Pass
                  </Button>
                </Link>
              </motion.div>
            ) : isPaymentPendingReview ? (
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                className="p-5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <Clock size={22} className="text-amber-600 shrink-0" />
                  <div>
                    <h3 className="font-bold text-sm text-amber-950">
                      Payment Submitted — Awaiting Club Verification
                    </h3>
                    <p className="text-xs text-amber-800 mt-0.5">
                      Submitted UTR: <span className="font-mono font-bold text-amber-950">{submission?.transaction_reference}</span>. The host club organizer is verifying this payment against their official bank records. Your digital entry ticket will activate as soon as approved.
                    </p>
                  </div>
                </div>
                <Badge variant="amber" className="shrink-0">Awaiting Verification</Badge>
              </motion.div>
            ) : isPaymentRejected ? (
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                className="p-5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle size={20} className="text-rose-600 shrink-0" />
                  <h3 className="font-bold text-sm text-rose-950">
                    Payment Verification Declined
                  </h3>
                </div>
                <p className="text-xs text-rose-800 leading-relaxed">
                  Reason provided by organizer:{' '}
                  <span className="font-semibold text-rose-950">
                    {submission?.review_notes || registration.rejection_reason || 'Transaction reference could not be verified in organizer bank account.'}
                  </span>
                </p>
                <p className="text-[11px] text-rose-700">
                  Please verify your UPI transaction history in Google Pay, PhonePe, Paytm, or BHIM, copy the correct 12-digit UTR/RRN number, and resubmit below.
                </p>
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDisputeModalOpen(true)}
                    className="text-xs border-rose-300 text-rose-700 hover:bg-rose-100"
                  >
                    Request Dispute Review
                  </Button>
                </div>
              </motion.div>
            ) : isPaymentPendingSubmission ? (
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 text-xs leading-relaxed"
              >
                <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold text-amber-950">
                    Payment Pending — Ticket Amount Due: {effectiveCurrency} {effectiveAmount}
                  </strong>
                  <span>
                    To unlock your official event pass, transfer the registration fee using UPI and enter your 12-digit transaction reference (UTR) below for organizer verification.
                  </span>
                </div>
              </motion.div>
            ) : null}

            {/* ── Team Squad Information Banner ─────────────────────────────────── */}
            {registration.team_name && (
              <div className="p-4 rounded-xl bg-white border border-gray-200 flex items-center justify-between gap-3 flex-wrap shadow-xs">
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 shrink-0">
                    <Users size={18} />
                  </span>
                  <div>
                    <h4 className="font-bold text-xs text-gray-900">
                      Team Squad: {registration.team_name}
                    </h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {registration.team_role === 'leader'
                        ? 'You are the Team Leader. You submit payment proof for the entire squad.'
                        : 'You are a Team Member. Squad fee payment is managed by your Team Leader.'}
                    </p>
                  </div>
                </div>
                <Badge variant="violet" className="text-[10px]">
                  {registration.team_role === 'leader' ? 'Team Leader' : 'Team Member'}
                </Badge>
              </div>
            )}

            {notice && (
              <Alert
                variant={notice.isError ? 'error' : 'success'}
                dismissible
                onDismiss={() => setNotice(null)}
              >
                {notice.message}
              </Alert>
            )}

            {/* ── Main Direct UPI Payment Container ───────────── */}
            {!isFreeEvent && registration.status !== 'pending_approval' && registration.status !== 'cancelled' && !isPaymentApproved && (
              isProduction && !effectiveUpi ? (
                <Card className="p-8 text-center max-w-lg mx-auto flex flex-col items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold font-display text-gray-900">
                      Organizer UPI Details Pending
                    </h3>
                    <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                      The host club has not yet provided their official UPI ID for this event. No fee has been charged. Your registration reference <strong className="font-mono text-blue-600">{registration.ticket_code}</strong> is safely saved.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 w-full justify-center">
                    <Link to="/student/dashboard" className="w-full sm:w-auto">
                      <Button variant="secondary" size="sm" className="w-full">
                        Back to My Passes
                      </Button>
                    </Link>
                    {event.contact_email && (
                      <a
                        href={`mailto:${event.contact_email}?subject=UPI%20Payment%20Query%20for%20${encodeURIComponent(event.title)}`}
                        className="w-full sm:w-auto"
                      >
                        <Button variant="primary" size="sm" className="w-full" leftIcon={<Mail size={14} />}>
                          Contact Organizer
                        </Button>
                      </a>
                    )}
                  </div>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start w-full">
                  {/* Left Column: Organizer UPI Details & QR */}
                  <div className="lg:col-span-5 flex flex-col gap-5 w-full min-w-0">
                    {/* Redeem Promo / Coupon Card */}
                    <Card className="p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                            <Tag size={15} />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-gray-900 font-display">
                              Redeem Coupon
                            </h4>
                            <span className="text-[10px] text-gray-500 font-mono">
                              Apply club promo or partner discount code
                            </span>
                          </div>
                        </div>
                        {appliedCoupon && (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-mono font-bold flex items-center gap-1">
                            <Sparkles size={11} /> Applied
                          </span>
                        )}
                      </div>

                      {!appliedCoupon ? (
                        <form onSubmit={handleApplyCoupon} className="flex gap-2 pt-1">
                          <input
                            type="text"
                            value={couponInput}
                            onChange={(e) => {
                              setCouponInput(e.target.value.toUpperCase())
                              if (couponError) setCouponError(null)
                            }}
                            placeholder="Enter Code (e.g. FEST20)"
                            className="flex-1 px-3 py-2 rounded-lg bg-white border border-gray-200 text-xs font-mono font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 uppercase min-w-0"
                            disabled={couponLoading}
                          />
                          <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            disabled={!couponInput.trim() || couponLoading}
                            className="px-4 text-xs font-semibold shrink-0"
                          >
                            {couponLoading ? 'Verifying…' : 'Apply'}
                          </Button>
                        </form>
                      ) : (
                        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-gray-900 flex items-center gap-1.5 truncate">
                                <span className="font-mono text-emerald-700 font-bold">{appliedCoupon.code}</span>
                                <span className="text-gray-500">applied</span>
                              </p>
                              <p className="text-[11px] text-emerald-700 font-medium">
                                Saved {effectiveCurrency} {discountAmount} (
                                {appliedCoupon.discount_type === 'percentage'
                                  ? `${appliedCoupon.discount_value}% OFF`
                                  : `₹${appliedCoupon.discount_value} OFF`}
                                )
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleRemoveCoupon}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-emerald-100 text-xs transition-colors shrink-0 cursor-pointer"
                            title="Remove coupon"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}

                      {couponError && (
                        <div className="text-[11px] text-rose-600 flex items-center gap-1.5 pt-0.5 font-medium">
                          <AlertCircle size={13} className="shrink-0" />
                          <span>{couponError}</span>
                        </div>
                      )}
                      {couponSuccess && !appliedCoupon && (
                        <div className="text-[11px] text-emerald-700 flex items-center gap-1.5 pt-0.5 font-medium">
                          <CheckCircle2 size={13} className="shrink-0" />
                          <span>{couponSuccess}</span>
                        </div>
                      )}
                    </Card>

                    {/* Amount & QR Details Card */}
                    <Card className="p-5 sm:p-6 flex flex-col items-center text-center">
                      <span className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">
                        {appliedCoupon ? 'Discounted Amount Due' : 'Amount Due'}
                      </span>
                      <div className="flex items-baseline justify-center gap-3 mb-2">
                        <div className="text-3xl sm:text-4xl font-bold font-display text-gray-900">
                          {effectiveCurrency} {effectiveAmount.toLocaleString()}
                        </div>
                        {appliedCoupon && discountAmount > 0 && (
                          <span className="text-lg line-through text-gray-400 font-mono">
                            {effectiveCurrency} {basePrice.toLocaleString()}
                          </span>
                        )}
                      </div>

                      {appliedCoupon && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold mb-4">
                          <Sparkles size={12} />
                          <span>Coupon {appliedCoupon.code} Saved {effectiveCurrency} {discountAmount}</span>
                        </div>
                      )}

                      {!effectiveUpi ? (
                        <div className="p-6 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2 text-center w-full my-4">
                          <AlertTriangle size={26} className="mx-auto text-amber-600" />
                          <h4 className="font-bold text-sm text-amber-950">UPI Not Configured</h4>
                          <p className="text-xs text-amber-800 leading-relaxed">
                            The host club has not configured their official UPI ID yet. Please contact the event organizer.
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* QR Code Container */}
                          <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-xs mb-3 max-w-[200px] sm:max-w-[220px] w-full flex items-center justify-center">
                            {clubSettings?.qr_image_url ? (
                              <img
                                src={clubSettings.qr_image_url}
                                alt="Organizer Official UPI QR"
                                className="w-40 sm:w-44 h-40 sm:h-44 max-w-full object-contain rounded-lg"
                              />
                            ) : (
                              <QRCodeSVG
                                value={upiIntentUri}
                                size={160}
                                level="M"
                                includeMargin={false}
                                className="max-w-full h-auto"
                              />
                            )}
                          </div>
                          <span className="text-[11px] text-gray-500 mb-3">
                            Scan with Google Pay, PhonePe, Paytm, or BHIM
                          </span>

                          {appliedCoupon && clubSettings?.qr_image_url && effectiveAmount > 0 && (
                            <div className="w-full p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] mb-3 text-left flex items-start gap-2">
                              <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                              <span>
                                <strong>Coupon Note:</strong> When scanning this club&apos;s static QR, manually enter the discounted total: <strong>{effectiveCurrency} {effectiveAmount}</strong>.
                              </span>
                            </div>
                          )}

                          {/* Mobile Intent Button */}
                          <a
                            href={upiIntentUri}
                            className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-colors mb-3 cursor-pointer select-none"
                          >
                            <Smartphone size={16} /> Pay using UPI App
                          </a>

                          {/* UPI ID Pill with Copy */}
                          <div className="w-full p-3 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between gap-2 text-left">
                            <div className="truncate min-w-0">
                              <span className="text-[10px] uppercase font-semibold text-gray-500 block">
                                Organizer UPI ID
                              </span>
                              <span className="text-xs sm:text-sm font-mono font-bold text-gray-900 truncate block">
                                {effectiveUpi}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={handleCopyUpi}
                              className="shrink-0"
                            >
                              {copiedUpi ? (
                                <CheckCircle2 size={14} className="text-emerald-600" />
                              ) : (
                                <Copy size={14} />
                              )}
                              <span className="ml-1 text-xs">{copiedUpi ? 'Copied' : 'Copy'}</span>
                            </Button>
                          </div>
                        </>
                      )}

                      <div className="w-full mt-4 text-left text-xs text-gray-600 space-y-1.5 pt-3 border-t border-gray-100">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Payee Display Name:</span>
                          <span className="text-gray-900 font-semibold">
                            {effectiveName}
                          </span>
                        </div>
                        {clubSettings?.payment_instructions && (
                          <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200/80 text-[11px] text-gray-600 italic mt-2">
                            &ldquo;{clubSettings.payment_instructions}&rdquo;
                          </div>
                        )}
                      </div>

                      {/* Step-by-Step Payment Instructions */}
                      <div className="w-full mt-3 p-3.5 rounded-lg bg-blue-50/50 border border-blue-200/80 text-left flex flex-col gap-2 text-xs text-gray-700">
                        <div className="flex items-center gap-1.5 font-semibold text-gray-900">
                          <Info size={14} className="text-blue-600 shrink-0" />
                          <span>Payment & Verification Steps</span>
                        </div>
                        <ol className="list-decimal list-inside space-y-1 text-[11px] text-gray-600 leading-relaxed">
                          <li>Tap <strong>Pay using UPI App</strong> or scan the QR code above.</li>
                          <li>Complete the payment of <strong>{effectiveCurrency} {effectiveAmount}</strong>.</li>
                          <li>Copy the 12-digit <strong>UTR / RRN reference</strong> from your UPI app receipt.</li>
                          <li>Enter the reference below and tap <strong>Submit for Verification</strong>.</li>
                        </ol>
                      </div>
                    </Card>
                  </div>

                  {/* Right Column: UTR Submission Form & Event Details */}
                  <div className="lg:col-span-7 flex flex-col gap-5 w-full min-w-0">
                    <Card className="p-5 sm:p-7">
                      <h2 className="text-lg font-bold font-display text-gray-900 mb-1">
                        Submit UPI Transaction Reference
                      </h2>
                      <p className="text-xs text-gray-600 mb-6 leading-relaxed">
                        After transferring the fee via Google Pay, PhonePe, Paytm, or BHIM, enter your 12-digit UPI reference number (UTR / RRN) below so the club organizer can verify and activate your pass.
                      </p>

                      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        {/* Transaction Reference / UTR */}
                        <div>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                            <label
                              htmlFor="utr-input"
                              className="block text-xs font-semibold uppercase tracking-wider text-gray-700"
                            >
                              UPI Transaction Reference (UTR / RRN) <span className="text-rose-500">*</span>
                            </label>
                            {detectedUtrCandidate && utrReference.trim() !== detectedUtrCandidate && (
                              <button
                                type="button"
                                onClick={() => {
                                  setUtrReference(detectedUtrCandidate)
                                  hasUserEditedUtr.current = true
                                  setFieldError(null)
                                  setOcrStatusMessage({
                                    type: 'success',
                                    text: 'Applied detected reference — please verify it before submitting.',
                                  })
                                }}
                                className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <Sparkles size={12} /> Use detected: <span className="font-mono">{detectedUtrCandidate}</span>
                              </button>
                            )}
                          </div>

                          <div className="relative flex items-center">
                            <input
                              id="utr-input"
                              name="transactionReference"
                              type="text"
                              inputMode="text"
                              autoCapitalize="characters"
                              autoCorrect="off"
                              spellCheck={false}
                              required
                              placeholder="e.g. 428910485923"
                              value={utrReference}
                              onChange={(e) => {
                                hasUserEditedUtr.current = true
                                setUtrReference(e.target.value)
                                if (fieldError) setFieldError(null)
                              }}
                              className={`w-full px-4 py-3 rounded-lg bg-white border text-gray-900 placeholder:text-gray-400 text-sm sm:text-base focus:outline-none font-mono transition-colors ${
                                fieldError
                                  ? 'border-rose-400 focus:border-rose-500 focus:ring-3 focus:ring-rose-500/15'
                                  : 'border-gray-200 hover:border-gray-300 focus:border-blue-600 focus:ring-3 focus:ring-blue-600/10'
                              }`}
                            />
                            {utrReference && (
                              <button
                                type="button"
                                onClick={() => {
                                  hasUserEditedUtr.current = true
                                  setUtrReference('')
                                  setFieldError(null)
                                }}
                                aria-label="Clear UTR input"
                                className="absolute right-3 text-xs text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
                              >
                                Clear
                              </button>
                            )}
                          </div>

                          {fieldError && (
                            <p className="text-xs text-rose-600 mt-1.5 flex items-center gap-1" role="alert">
                              <AlertCircle size={13} className="shrink-0" />
                              <span>{fieldError}</span>
                            </p>
                          )}

                          <span className="text-[11px] text-gray-500 mt-1.5 block">
                            Look for the 12-digit UPI Reference Number / UTR in your Google Pay, PhonePe, Paytm, BHIM, or bank statement.
                          </span>
                        </div>

                        {/* Screenshot Upload with OCR Auto-Extraction */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label
                              htmlFor="screenshot-file-input"
                              className="block text-xs font-semibold uppercase tracking-wider text-gray-700"
                            >
                              Payment Screenshot / Receipt <span className="text-gray-400 font-normal normal-case">(Optional)</span>
                            </label>
                            <span className="text-[11px] text-blue-600 font-medium flex items-center gap-1">
                              <Scan size={12} /> Auto-detects UTR
                            </span>
                          </div>

                          <input
                            id="screenshot-file-input"
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/*"
                            className="sr-only"
                            onChange={handleScreenshotSelect}
                            disabled={submitting || uploadingScreenshot}
                          />

                          {screenshotPreview ? (
                            <div className="flex flex-col gap-2">
                              <div className="relative p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <img
                                    src={screenshotPreview}
                                    alt="Payment receipt preview"
                                    className="w-14 h-14 object-cover rounded-lg border border-gray-200 shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <span className="text-xs text-gray-900 font-semibold truncate block max-w-[180px] sm:max-w-xs">
                                      {screenshotFile ? screenshotFile.name : 'Uploaded Payment Receipt'}
                                    </span>
                                    {screenshotFile && (
                                      <span className="text-[10px] text-gray-500">
                                        {(screenshotFile.size / 1024).toFixed(0)} KB • Ready for verification
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <label
                                    htmlFor="screenshot-file-input"
                                    className="text-xs text-blue-600 hover:underline px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer font-medium"
                                  >
                                    Replace
                                  </label>
                                  <button
                                    type="button"
                                    disabled={isExtractingOcr || submitting}
                                    onClick={() => {
                                      setScreenshotFile(null)
                                      setScreenshotPreview(null)
                                      setOcrStatusMessage(null)
                                      setDetectedUtrCandidate(null)
                                    }}
                                    className="text-xs text-rose-600 hover:text-rose-700 px-2.5 py-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer font-medium"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>

                              {/* OCR In-Progress Indicator */}
                              {isExtractingOcr && (
                                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-gray-700 space-y-2">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="flex items-center gap-2 text-blue-700 font-semibold">
                                      <Scan size={14} className="animate-spin" /> {ocrProgress.text || 'Scanning receipt for UTR…'}
                                    </span>
                                    <span className="font-mono text-gray-600">{ocrProgress.percent}%</span>
                                  </div>
                                  <div className="w-full bg-blue-100 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                                      style={{ width: `${Math.max(8, ocrProgress.percent)}%` }}
                                    />
                                  </div>
                                </div>
                              )}

                              {/* OCR Status Banner */}
                              {!isExtractingOcr && ocrStatusMessage && (
                                <div
                                  className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                                    ocrStatusMessage.type === 'success'
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                      : ocrStatusMessage.type === 'info'
                                      ? 'bg-blue-50 border-blue-200 text-blue-900'
                                      : 'bg-amber-50 border-amber-200 text-amber-900'
                                  }`}
                                >
                                  {ocrStatusMessage.type === 'success' ? (
                                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                                  ) : ocrStatusMessage.type === 'info' ? (
                                    <Sparkles size={16} className="text-blue-600 shrink-0 mt-0.5" />
                                  ) : (
                                    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                                  )}
                                  <div className="flex-1 leading-relaxed">
                                    <span>{ocrStatusMessage.text}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <label
                              htmlFor="screenshot-file-input"
                              className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center cursor-pointer transition-colors text-center bg-gray-50/70 hover:bg-blue-50/30 select-none min-h-[120px]"
                            >
                              <div className="w-11 h-11 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-blue-600 mb-2.5 shadow-2xs">
                                <Upload size={20} />
                              </div>
                              <span className="text-xs sm:text-sm text-gray-900 font-semibold">
                                Tap to upload payment receipt screenshot
                              </span>
                              <span className="text-[11px] text-gray-500 mt-1">
                                Supports JPG, PNG, WEBP (up to 10MB) • Scans receipt for 12-digit UTR
                              </span>
                            </label>
                          )}
                        </div>

                        {/* Optional Note */}
                        <div>
                          <label
                            htmlFor="notes"
                            className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2"
                          >
                            Note to Organizer (Optional)
                          </label>
                          <input
                            id="notes"
                            type="text"
                            placeholder="e.g. Transferred from HDFC account ending in 4102"
                            value={studentNotes}
                            onChange={(e) => setStudentNotes(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-lg bg-white border border-gray-200 hover:border-gray-300 text-gray-900 placeholder:text-gray-400 text-xs sm:text-sm focus:outline-none focus:border-blue-600 focus:ring-3 focus:ring-blue-600/10 transition-colors"
                          />
                        </div>

                        {/* Action Button */}
                        <div className="pt-2 flex flex-col gap-2">
                          <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            className="w-full min-h-[48px]"
                            disabled={isExtractingOcr || submitting || uploadingScreenshot}
                            isLoading={submitting || uploadingScreenshot}
                            leftIcon={<ShieldCheck size={18} />}
                          >
                            {submitting || uploadingScreenshot
                              ? 'Submitting Proof…'
                              : isPaymentPendingReview
                              ? 'Update Payment Reference'
                              : isPaymentRejected
                              ? 'Resubmit for Verification'
                              : 'Submit for Verification'}
                          </Button>
                          <p className="text-[11px] text-center text-gray-500">
                            Your transaction reference will be verified by the host club organizer before pass issuance.
                          </p>
                        </div>
                      </form>
                    </Card>

                    {/* Attendee and Event Details Summary */}
                    <Card className="p-6">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                        Registration Details
                      </h3>
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                            <Calendar size={18} />
                          </div>
                          <div className="truncate">
                            <h4 className="text-sm font-bold text-gray-900 truncate">
                              {event.title}
                            </h4>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                              <MapPin size={11} /> {event.venue_name || 'Campus Venue'}
                            </p>
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Registered Student:</span>
                            <span className="font-medium text-gray-900">
                              {user?.user_metadata?.display_name || user?.email}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Ticket Reference:</span>
                            <span className="font-mono font-bold text-blue-700">
                              {registration.ticket_code}
                            </span>
                          </div>
                          {registration.team_name && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Team:</span>
                              <span className="text-indigo-700 font-medium">
                                {registration.team_name}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between pt-2 border-t border-gray-200">
                            <span className="text-gray-500">Base Pass Fee:</span>
                            <span className="text-gray-900 font-medium">
                              {effectiveCurrency} {basePrice}
                            </span>
                          </div>
                          {appliedCoupon && (
                            <div className="flex justify-between text-emerald-700 font-medium">
                              <span className="flex items-center gap-1">
                                <Tag size={11} /> Discount ({appliedCoupon.code}):
                              </span>
                              <span>- {effectiveCurrency} {discountAmount}</span>
                            </div>
                          )}
                          <div className="flex justify-between pt-2 border-t border-gray-200 font-semibold">
                            <span className="text-gray-700">Net Amount Payable:</span>
                            <span className="text-gray-900 font-mono font-bold">
                              {effectiveCurrency} {effectiveAmount}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* Payment Dispute Review Modal */}
        {disputeModalOpen && (
          <Modal
            isOpen={disputeModalOpen}
            onClose={() => setDisputeModalOpen(false)}
            title="Request Payment Review"
            size="md"
          >
            <form onSubmit={handleDisputeSubmit}>
              <ModalBody>
                <div className="flex flex-col gap-3 text-left">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    If you believe your payment of <strong className="text-gray-900">{effectiveCurrency} {effectiveAmount}</strong> was incorrectly rejected, provide transaction details for the organizing committee to re-examine against bank records.
                  </p>
                  {disputeError && <Alert variant="error" className="text-xs">{disputeError}</Alert>}
                  {disputeSuccess && <Alert variant="success" className="text-xs">Review request submitted! The organizer has been notified.</Alert>}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-gray-700">Explanation for Organizer</label>
                    <textarea
                      value={disputeNotes}
                      onChange={(e) => setDisputeNotes(e.target.value)}
                      placeholder="e.g., Amount was debited from bank, account holder name is X, transaction timestamp..."
                      rows={3}
                      required
                      disabled={disputeLoading || disputeSuccess}
                      className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 resize-none"
                    />
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" size="sm" type="button" disabled={disputeLoading} onClick={() => setDisputeModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" isLoading={disputeLoading} disabled={disputeSuccess}>
                  Submit Dispute
                </Button>
              </ModalFooter>
            </form>
          </Modal>
        )}
      </div>
    </PageShell>
  )
}
