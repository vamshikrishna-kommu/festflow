import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router'
import { motion } from 'motion/react'
import { QRCodeSVG } from 'qrcode.react'
import {
  ArrowLeft,
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
  Lock,
} from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Button, Card, Badge } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { getRegistrationById } from '@/lib/registrations'
import {
  getClubPaymentSettings,
  getStudentPaymentSubmission,
  submitPaymentProof,
  uploadPaymentScreenshot,
} from '@/lib/payments'
import { fadeIn } from '@/lib/animations'
import type { RegistrationWithEvent, ClubPaymentSettings, PaymentSubmission } from '@/types'

export default function StudentPaymentPage() {
  const { registrationId } = useParams<{ registrationId: string }>()
  const { user } = useAuth()

  const [registration, setRegistration] = useState<RegistrationWithEvent | null>(null)
  const [clubSettings, setClubSettings] = useState<ClubPaymentSettings | null>(null)
  const [submission, setSubmission] = useState<PaymentSubmission | null>(null)

  const [loading, setLoading] = useState(true)
  const [copiedUpi, setCopiedUpi] = useState(false)

  // Form states
  const [utrReference, setUtrReference] = useState('')
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const [studentNotes, setStudentNotes] = useState('')

  const [uploadingScreenshot, setUploadingScreenshot] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<{ message: string; isError?: boolean } | null>(null)

  const loadData = async () => {
    if (!registrationId) return
    setLoading(true)
    const regRes = await getRegistrationById(registrationId)
    if (regRes.registration) {
      setRegistration(regRes.registration)
      const clubId = regRes.registration.event.club_id
      const [settings, sub] = await Promise.all([
        getClubPaymentSettings(clubId),
        getStudentPaymentSubmission(registrationId),
      ])
      setClubSettings(settings)
      setSubmission(sub)
      if (sub?.transaction_reference) {
        setUtrReference(sub.transaction_reference)
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [registrationId, user])

  const handleCopyUpi = () => {
    const upi = clubSettings?.upi_id || 'festflow.council@okaxis'
    navigator.clipboard.writeText(upi)
    setCopiedUpi(true)
    setTimeout(() => setCopiedUpi(false), 2000)
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

    // Preview
    const reader = new FileReader()
    reader.onload = () => setScreenshotPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!registrationId || !user) return

    const cleanRef = utrReference.trim()
    if (!cleanRef || cleanRef.length < 4) {
      setNotice({
        message: 'Please provide a valid UPI Transaction Reference / UTR (at least 4 characters).',
        isError: true,
      })
      return
    }

    setSubmitting(true)
    setNotice(null)

    let uploadedScreenshotUrl = screenshotPreview
    if (screenshotFile) {
      setUploadingScreenshot(true)
      const uploadRes = await uploadPaymentScreenshot(user.id, screenshotFile)
      setUploadingScreenshot(false)
      if (uploadRes.success && uploadRes.url) {
        uploadedScreenshotUrl = uploadRes.url
      }
    }

    const res = await submitPaymentProof({
      registrationId,
      transactionReference: cleanRef,
      screenshotUrl: uploadedScreenshotUrl,
      notes: studentNotes.trim() || null,
    })

    setSubmitting(false)

    if (res.success) {
      setNotice({ message: res.message })
      await loadData()
    } else {
      setNotice({ message: res.message, isError: true })
    }
  }

  const event = registration?.event
  const effectiveUpi = clubSettings?.upi_id || 'festflow.council@okaxis'
  const effectiveName = clubSettings?.account_name || 'Campus Event Organizer'
  const effectiveAmount = event?.price || 0
  const effectiveCurrency = event?.currency || 'INR'

  // Dynamic UPI payment URI for scanning
  const upiIntentUri = `upi://pay?pa=${encodeURIComponent(effectiveUpi)}&pn=${encodeURIComponent(
    effectiveName
  )}&am=${encodeURIComponent(effectiveAmount.toString())}&cu=INR&tn=${encodeURIComponent(
    `FestFlow Pass ${registration?.ticket_code || ''}`
  )}`

  return (
    <PageShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-24 text-left">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 py-4 text-xs text-[var(--color-text-muted)] border-b border-[var(--color-surface-3)] mb-8">
          <Link
            to="/student/dashboard"
            className="hover:text-[var(--color-text-primary)] flex items-center gap-1 transition-colors"
          >
            <ArrowLeft size={14} /> Back to My Passes
          </Link>
          <span>/</span>
          <span className="text-[var(--color-text-primary)] font-medium">UPI Payment Verification</span>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--color-surface-3)] border-t-[var(--color-brand-purple)] animate-spin" />
            <span className="text-xs text-[var(--color-text-muted)]">Loading payment details…</span>
          </div>
        ) : !registration || !event ? (
          <Card className="p-8 text-center">
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
          <div className="flex flex-col gap-8">
            {/* Page Header */}
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="amber" className="flex items-center gap-1">
                  <Clock size={12} /> Payment Verification Required
                </Badge>
                <span className="text-xs text-[var(--color-text-muted)] font-mono">
                  Ref: {registration.ticket_code}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold font-display text-[var(--color-text-primary)]">
                Complete Payment for {event.title}
              </h1>
              <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-1">
                Transfer the exact amount directly via any UPI app and submit your 12-digit transaction UTR for organizer review.
              </p>
            </div>

            {/* Status Notices */}
            {registration.status === 'confirmed' || submission?.status === 'approved' ? (
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
                  <div>
                    <h3 className="font-bold text-sm text-emerald-200">
                      Payment Approved & Pass Confirmed!
                    </h3>
                    <p className="text-xs text-emerald-300/80">
                      Your entry ticket is active. Present your digital QR pass at the entrance.
                    </p>
                  </div>
                </div>
                <Link to={`/student/tickets/${registration.id}`}>
                  <Button variant="primary" size="sm" rightIcon={<ExternalLink size={14} />}>
                    View Digital Pass
                  </Button>
                </Link>
              </motion.div>
            ) : submission?.status === 'pending_review' ? (
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <Clock size={24} className="text-amber-400 shrink-0 animate-pulse" />
                  <div>
                    <h3 className="font-bold text-sm text-amber-200">
                      Payment Under Organizer Review
                    </h3>
                    <p className="text-xs text-amber-300/80">
                      Submitted Ref: <span className="font-mono font-bold">{submission.transaction_reference}</span>. The club organizer will verify your payment against their UPI statements and issue your confirmed entry pass.
                    </p>
                  </div>
                </div>
                <Badge variant="amber">Pending Approval</Badge>
              </motion.div>
            ) : (registration.status === 'rejected' || submission?.status === 'rejected') ? (
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle size={20} className="text-rose-400 shrink-0" />
                  <h3 className="font-bold text-sm text-rose-200">
                    Payment Verification Issue
                  </h3>
                </div>
                <p className="text-xs text-rose-300/90 leading-relaxed">
                  Reason provided by organizer:{' '}
                  <span className="font-semibold text-white">
                    {submission?.review_notes || 'Transaction reference could not be verified in organizer bank statements.'}
                  </span>
                </p>
                <p className="text-[11px] text-rose-300/70">
                  Please verify your UPI app transaction history, copy the correct 12-digit UTR number below, and resubmit for approval.
                </p>
              </motion.div>
            ) : null}

            {notice && (
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                className={`p-4 rounded-xl border text-xs sm:text-sm flex items-center gap-3 ${
                  notice.isError
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                }`}
              >
                {notice.isError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                <span className="flex-1">{notice.message}</span>
              </motion.div>
            )}

            {/* Split Grid: UPI Payment Instructions & Submission Form */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Organizer UPI Details & QR */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                <Card className="p-6 flex flex-col items-center text-center relative overflow-hidden">
                  <span className="text-xs uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-2">
                    Pay Exactly
                  </span>
                  <div className="text-3xl sm:text-4xl font-extrabold font-display text-[var(--color-text-primary)] mb-4">
                    {effectiveCurrency} {effectiveAmount.toLocaleString()}
                  </div>

                  {/* QR Code */}
                  <div className="p-3 bg-white rounded-2xl shadow-lg border border-[var(--color-surface-3)] mb-4">
                    {clubSettings?.qr_image_url ? (
                      <img
                        src={clubSettings.qr_image_url}
                        alt="Club Official UPI QR"
                        className="w-48 h-48 object-contain rounded-xl"
                      />
                    ) : (
                      <QRCodeSVG
                        value={upiIntentUri}
                        size={192}
                        level="M"
                        includeMargin={false}
                      />
                    )}
                  </div>
                  <span className="text-[11px] text-[var(--color-text-muted)] mb-4">
                    Scan with Google Pay, PhonePe, Paytm, or BHIM
                  </span>

                  {/* UPI ID Pill with Copy */}
                  <div className="w-full p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] flex items-center justify-between gap-2 text-left">
                    <div className="truncate">
                      <span className="text-[10px] uppercase font-semibold text-[var(--color-text-muted)] block">
                        Organizer UPI ID
                      </span>
                      <span className="text-xs sm:text-sm font-mono font-bold text-[var(--color-text-primary)] truncate block">
                        {effectiveUpi}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopyUpi}
                      className="shrink-0"
                    >
                      {copiedUpi ? (
                        <CheckCircle2 size={14} className="text-emerald-400" />
                      ) : (
                        <Copy size={14} />
                      )}
                      <span className="ml-1 text-xs">{copiedUpi ? 'Copied' : 'Copy'}</span>
                    </Button>
                  </div>

                  <div className="w-full mt-3 text-left text-xs text-[var(--color-text-secondary)] space-y-1">
                    <p>
                      Payee Name:{' '}
                      <span className="text-[var(--color-text-primary)] font-medium">
                        {effectiveName}
                      </span>
                    </p>
                    {clubSettings?.payment_instructions && (
                      <p className="p-2 rounded bg-[var(--color-surface-1)] border border-[var(--color-surface-2)] text-[11px] text-[var(--color-text-muted)] italic">
                        "{clubSettings.payment_instructions}"
                      </p>
                    )}
                  </div>
                </Card>

                {/* Event Summary Pill */}
                <Card className="p-4 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--color-brand-purple)]/20 to-[var(--color-brand-pink)]/20 flex items-center justify-center text-[var(--color-brand-purple)] shrink-0">
                    <Calendar size={20} />
                  </div>
                  <div className="truncate">
                    <h4 className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                      {event.title}
                    </h4>
                    <p className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1">
                      <MapPin size={10} /> {event.venue_name}
                    </p>
                  </div>
                </Card>
              </div>

              {/* Right Column: Submission Form */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                <Card className="p-6 sm:p-8">
                  <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)] mb-1">
                    Submit Payment Reference
                  </h2>
                  <p className="text-xs text-[var(--color-text-secondary)] mb-6">
                    After completing the UPI transfer, enter your 12-digit UTR number below so the club organizer can verify your transaction.
                  </p>

                  <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    {/* Transaction Reference / UTR */}
                    <div>
                      <label
                        htmlFor="utr"
                        className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2"
                      >
                        UPI Transaction ID / 12-Digit UTR <span className="text-rose-400">*</span>
                      </label>
                      <input
                        id="utr"
                        type="text"
                        required
                        disabled={submission?.status === 'approved'}
                        placeholder="e.g. 428910485923 or UTR12345678"
                        value={utrReference}
                        onChange={(e) => setUtrReference(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-brand-purple)] font-mono transition-colors disabled:opacity-50"
                      />
                      <span className="text-[11px] text-[var(--color-text-muted)] mt-1.5 block">
                        You can find this 12-digit UTR in your Google Pay, PhonePe, or Paytm receipt details.
                      </span>
                    </div>

                    {/* Screenshot Upload */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
                        Payment Screenshot (Optional but recommended)
                      </label>

                      {screenshotPreview ? (
                        <div className="relative group p-2 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <img
                              src={screenshotPreview}
                              alt="Proof preview"
                              className="w-12 h-12 object-cover rounded-lg border border-[var(--color-surface-3)]"
                            />
                            <span className="text-xs text-[var(--color-text-primary)] font-medium truncate max-w-[200px]">
                              {screenshotFile ? screenshotFile.name : 'Uploaded Screenshot Proof'}
                            </span>
                          </div>
                          {submission?.status !== 'approved' && (
                            <button
                              type="button"
                              onClick={() => {
                                setScreenshotFile(null)
                                setScreenshotPreview(null)
                              }}
                              className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ) : (
                        <label className="border-2 border-dashed border-[var(--color-surface-3)] hover:border-[var(--color-brand-purple)]/50 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors text-center bg-[var(--color-surface-1)]">
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={handleScreenshotSelect}
                            disabled={submission?.status === 'approved'}
                          />
                          <Upload size={24} className="text-[var(--color-text-muted)] mb-2" />
                          <span className="text-xs text-[var(--color-text-primary)] font-medium">
                            Upload transaction receipt screenshot
                          </span>
                          <span className="text-[10px] text-[var(--color-text-muted)] mt-1">
                            PNG, JPG or WEBP up to 10MB
                          </span>
                        </label>
                      )}
                    </div>

                    {/* Optional Note */}
                    <div>
                      <label
                        htmlFor="notes"
                        className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2"
                      >
                        Note to Organizer (Optional)
                      </label>
                      <input
                        id="notes"
                        type="text"
                        disabled={submission?.status === 'approved'}
                        placeholder="e.g. Transferred from HDFC account ending in 4102"
                        value={studentNotes}
                        onChange={(e) => setStudentNotes(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] text-xs focus:outline-none focus:border-[var(--color-brand-purple)] transition-colors disabled:opacity-50"
                      />
                    </div>

                    {/* Disclaimer */}
                    <div className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] flex items-start gap-2.5 text-left">
                      <Lock size={14} className="text-[var(--color-brand-purple)] shrink-0 mt-0.5" />
                      <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                        Submitting payment details sends your transaction for organizer review. A valid digital entry pass with a scannable entry QR will be issued only after the club organizer verifies the payment.
                      </p>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-2">
                      {submission?.status === 'approved' ? (
                        <Link to={`/student/tickets/${registration.id}`} className="w-full block">
                          <Button variant="primary" size="lg" className="w-full">
                            View Your Confirmed Pass
                          </Button>
                        </Link>
                      ) : (
                        <Button
                          type="submit"
                          variant="primary"
                          size="lg"
                          className="w-full"
                          isLoading={submitting || uploadingScreenshot}
                          leftIcon={<ShieldCheck size={18} />}
                        >
                          {submitting
                            ? 'Submitting Proof…'
                            : submission?.status === 'pending_review'
                            ? 'Update Payment Details'
                            : 'Submit Payment for Review'}
                        </Button>
                      )}
                    </div>
                  </form>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}
