import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Button, Card, Badge, PageHeader, Alert } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { isProduction } from '@/lib/supabase'
import { getRegistrationById } from '@/lib/registrations'
import {
  getClubPaymentSettings,
  getStudentPaymentSubmission,
  submitPaymentProof,
  uploadPaymentScreenshot,
} from '@/lib/payments'
import { fadeIn } from '@/lib/animations'
import type {
  RegistrationWithEvent,
  ClubPaymentSettings,
  PaymentSubmission,
} from '@/types'

export default function StudentPaymentPage() {
  const { registrationId } = useParams<{ registrationId: string }>()
  const { user } = useAuth()

  const [registration, setRegistration] = useState<RegistrationWithEvent | null>(null)
  const [clubSettings, setClubSettings] = useState<ClubPaymentSettings | null>(null)
  const [submission, setSubmission] = useState<PaymentSubmission | null>(null)

  const [loading, setLoading] = useState(true)
  const [copiedUpi, setCopiedUpi] = useState(false)

  // Direct UPI Form states
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
      const clubId = regRes.registration.event?.club_id || ''
      const [settings, sub] = await Promise.all([
        clubId ? getClubPaymentSettings(clubId) : Promise.resolve(null),
        getStudentPaymentSubmission(registrationId),
      ])
      setClubSettings(settings)
      setSubmission(sub)
      if (sub?.transaction_reference) {
        setUtrReference(sub.transaction_reference)
      }
      if (sub?.screenshot_url) {
        setScreenshotPreview(sub.screenshot_url)
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [registrationId, user])

  const handleCopyUpi = () => {
    const upi = clubSettings?.upi_id
    if (!upi) return
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

    const reader = new FileReader()
    reader.onload = () => setScreenshotPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  // ── UPI UTR Submission ──────────────────────────────────────────────────────
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
  const effectiveUpi = clubSettings?.upi_id || ''
  const effectiveName = clubSettings?.account_name || 'Campus Event Organizer'
  const effectiveAmount = event?.price || 0
  const effectiveCurrency = event?.currency || 'INR'

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
            <div className="w-8 h-8 rounded-full border-2 border-[var(--color-surface-3)] border-t-[var(--color-brand-purple)] animate-spin" />
            <span className="text-xs text-[var(--color-text-muted)]">Loading event payment details…</span>
          </div>
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
                event.is_free
                  ? 'Free Event'
                  : registration.status === 'confirmed' || submission?.status === 'approved'
                  ? 'Payment Verified'
                  : submission?.status === 'pending_review'
                  ? 'Payment Under Review'
                  : submission?.status === 'rejected' || registration.status === 'rejected'
                  ? 'Payment Rejected'
                  : registration.status === 'pending_approval'
                  ? 'Application Under Review'
                  : 'Awaiting UPI Payment'
              }
              badgeVariant={
                event.is_free || registration.status === 'confirmed' || submission?.status === 'approved'
                  ? 'success'
                  : submission?.status === 'pending_review'
                  ? 'amber'
                  : submission?.status === 'rejected' || registration.status === 'rejected'
                  ? 'danger'
                  : registration.status === 'pending_approval'
                  ? 'purple'
                  : 'amber'
              }
              subtitle={`Registration Reference: ${registration.ticket_code} • Pay via direct UPI to the organizer and submit your UTR for ticket verification.`}
            />

            {/* ── Status Notices ─────────────────────────────────────────────── */}
            {event.is_free ? (
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
                  <div>
                    <h3 className="font-bold text-sm text-emerald-200">
                      This Event is Free of Charge!
                    </h3>
                    <p className="text-xs text-emerald-300/80">
                      No payment transaction is required for free campus events.
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
                className="p-8 rounded-3xl glass border border-[var(--color-brand-purple)]/30 text-center flex flex-col items-center gap-4 max-w-lg mx-auto my-4 shadow-xl"
              >
                <div className="w-16 h-16 rounded-2xl bg-[var(--color-brand-purple)]/20 text-[var(--color-brand-purple)] flex items-center justify-center">
                  <Clock size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-display text-[var(--color-text-primary)]">
                    Application Under Host Review
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-2 leading-relaxed">
                    This event requires manual organizer review. Your application has been received, but payment submission is locked until the organizer approves your registration.
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <Link to="/student/dashboard">
                    <Button variant="outline" size="sm">
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
            ) : registration.status === 'confirmed' || submission?.status === 'approved' ? (
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
                      Payment Verified & Pass Active!
                    </h3>
                    <p className="text-xs text-emerald-300/80">
                      Your entry ticket has been verified and confirmed by the organizer. Present your digital QR pass at the entrance gate.
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
                      Payment Under Review
                    </h3>
                    <p className="text-xs text-amber-300/80">
                      Submitted UTR: <span className="font-mono font-bold text-white">{submission.transaction_reference}</span>. The organizer is verifying your payment against their bank records. Your ticket will activate upon approval.
                    </p>
                  </div>
                </div>
                <Badge variant="amber">Awaiting Approval</Badge>
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
                    Payment Rejected — Review Reason
                  </h3>
                </div>
                <p className="text-xs text-rose-300/90 leading-relaxed">
                  Reason provided by organizer:{' '}
                  <span className="font-semibold text-white">
                    {submission?.review_notes || 'Transaction reference could not be verified in organizer account.'}
                  </span>
                </p>
                <p className="text-[11px] text-rose-300/70">
                  Please verify your UPI transaction history, copy the correct 12-digit UTR/RRN number, and resubmit below.
                </p>
              </motion.div>
            ) : null}

            {notice && (
              <Alert
                variant={notice.isError ? 'error' : 'success'}
                dismissible
                onDismiss={() => setNotice(null)}
              >
                {notice.message}
              </Alert>
            )}

            {/* ── Main Direct UPI Payment Container (when payable) ─────────────────────────── */}
            {!event.is_free && registration.status !== 'pending_approval' && (
              isProduction && !effectiveUpi ? (
                <Card className="p-8 text-center max-w-lg mx-auto flex flex-col items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                    <AlertTriangle size={28} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold font-display text-[var(--color-text-primary)]">
                      Organizer UPI Details Pending
                    </h3>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1.5 leading-relaxed">
                      The host club has not yet provided their official UPI ID for this event. No fee has been charged. Your registration reference <strong className="font-mono text-[var(--color-brand-cyan)]">{registration.ticket_code}</strong> is safely saved.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 w-full justify-center">
                    <Link to="/student/dashboard" className="w-full sm:w-auto">
                      <Button variant="outline" size="sm" className="w-full">
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
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  {/* Left Column: Organizer UPI Details & QR */}
                  <div className="lg:col-span-5 flex flex-col gap-6">
                    <Card className="p-6 flex flex-col items-center text-center relative overflow-hidden">
                      <span className="text-xs uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-1">
                        Amount Due
                      </span>
                      <div className="text-3xl sm:text-4xl font-extrabold font-display text-[var(--color-text-primary)] mb-4">
                        {effectiveCurrency} {effectiveAmount.toLocaleString()}
                      </div>

                      {!effectiveUpi ? (
                        <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-2 text-center w-full my-4">
                          <AlertTriangle size={28} className="mx-auto text-amber-400" />
                          <h4 className="font-bold text-sm text-amber-200">UPI Not Configured</h4>
                          <p className="text-xs text-amber-300/80 leading-relaxed">
                            The host club has not configured their UPI ID yet. Please contact the event organizer.
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* QR Code Container */}
                          <div className="p-4 bg-white rounded-2xl shadow-lg border border-[var(--color-surface-3)] mb-4 max-w-[220px] w-full flex items-center justify-center">
                            {clubSettings?.qr_image_url ? (
                              <img
                                src={clubSettings.qr_image_url}
                                alt="Organizer Official UPI QR"
                                className="w-44 h-44 max-w-full object-contain rounded-xl"
                              />
                            ) : (
                              <QRCodeSVG
                                value={upiIntentUri}
                                size={176}
                                level="M"
                                includeMargin={false}
                                className="max-w-full h-auto"
                              />
                            )}
                          </div>
                          <span className="text-[11px] text-[var(--color-text-muted)] mb-3">
                            Scan with Google Pay, PhonePe, Paytm, or BHIM
                          </span>

                          {/* Mobile Intent Button */}
                          <a
                            href={upiIntentUri}
                            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md transition-all mb-4"
                          >
                            <Smartphone size={15} /> Pay using UPI App
                          </a>

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
                        </>
                      )}

                      <div className="w-full mt-4 text-left text-xs text-[var(--color-text-secondary)] space-y-1.5 pt-3 border-t border-[var(--color-surface-3)]">
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-muted)]">Payee Display Name:</span>
                          <span className="text-[var(--color-text-primary)] font-medium">
                            {effectiveName}
                          </span>
                        </div>
                        {clubSettings?.payment_instructions && (
                          <div className="p-2.5 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-surface-2)] text-[11px] text-[var(--color-text-muted)] italic mt-2">
                            "{clubSettings.payment_instructions}"
                          </div>
                        )}
                      </div>

                      <div className="w-full mt-3 p-3 rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-surface-3)] text-left flex items-start gap-2 text-[11px] text-[var(--color-text-muted)]">
                        <Info size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                        <span>
                          Opening a UPI app or scanning the QR initiates payment with your bank. You must submit your 12-digit UTR below for organizer verification.
                        </span>
                      </div>
                    </Card>
                  </div>

                  {/* Right Column: UTR Submission Form & Event Details */}
                  <div className="lg:col-span-7 flex flex-col gap-6">
                    <Card className="p-6 sm:p-8">
                      <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)] mb-1">
                        Submit UPI Transaction Reference
                      </h2>
                      <p className="text-xs text-[var(--color-text-secondary)] mb-6">
                        After completing the transfer in your UPI application, enter the 12-digit UPI transaction reference number (UTR/RRN) below so the host club can verify and activate your pass.
                      </p>

                      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        {/* Transaction Reference / UTR */}
                        <div>
                          <label
                            htmlFor="utr"
                            className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2"
                          >
                            UPI Transaction Reference (UTR / RRN) <span className="text-rose-400">*</span>
                          </label>
                          <input
                            id="utr"
                            type="text"
                            required
                            disabled={submission?.status === 'approved' || registration.status === 'confirmed'}
                            placeholder="e.g. 428910485923 or 210839401928"
                            value={utrReference}
                            onChange={(e) => setUtrReference(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-brand-purple)] font-mono transition-colors disabled:opacity-50"
                          />
                          <span className="text-[11px] text-[var(--color-text-muted)] mt-1.5 block">
                            Look for the 12-digit UPI Reference Number / UTR in your Google Pay, PhonePe, Paytm, or bank statement.
                          </span>
                        </div>

                        {/* Screenshot Upload */}
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
                            Payment Screenshot / Receipt (Optional)
                          </label>

                          {screenshotPreview ? (
                            <div className="relative group p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <img
                                  src={screenshotPreview}
                                  alt="Proof preview"
                                  className="w-12 h-12 object-cover rounded-lg border border-[var(--color-surface-3)]"
                                />
                                <span className="text-xs text-[var(--color-text-primary)] font-medium truncate max-w-[200px]">
                                  {screenshotFile ? screenshotFile.name : 'Uploaded Payment Receipt'}
                                </span>
                              </div>
                              {submission?.status !== 'approved' && registration.status !== 'confirmed' && (
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
                                disabled={submission?.status === 'approved' || registration.status === 'confirmed'}
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
                            disabled={submission?.status === 'approved' || registration.status === 'confirmed'}
                            placeholder="e.g. Transferred from HDFC account ending in 4102"
                            value={studentNotes}
                            onChange={(e) => setStudentNotes(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] text-xs focus:outline-none focus:border-[var(--color-brand-purple)] transition-colors disabled:opacity-50"
                          />
                        </div>

                        {/* Submit Button */}
                        <div className="pt-2">
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
                              ? 'Update Payment Reference'
                              : submission?.status === 'rejected' || registration.status === 'rejected'
                              ? 'Resubmit Corrected Reference'
                              : 'Submit UPI Reference for Review'}
                          </Button>
                        </div>
                      </form>
                    </Card>

                    {/* Attendee and Event Details Summary */}
                    <Card className="p-6">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
                        Registration Details
                      </h3>
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-2)] flex items-center justify-center text-[var(--color-brand-purple)] shrink-0">
                            <Calendar size={20} />
                          </div>
                          <div className="truncate">
                            <h4 className="text-sm font-bold text-[var(--color-text-primary)] truncate">
                              {event.title}
                            </h4>
                            <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1 mt-0.5">
                              <MapPin size={11} /> {event.venue_name || 'Campus Venue'}
                            </p>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-xs space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-[var(--color-text-muted)]">Registered Student:</span>
                            <span className="font-medium text-[var(--color-text-primary)]">
                              {user?.user_metadata?.display_name || user?.email}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--color-text-muted)]">Ticket Reference:</span>
                            <span className="font-mono font-bold text-[var(--color-brand-cyan)]">
                              {registration.ticket_code}
                            </span>
                          </div>
                          {registration.team_name && (
                            <div className="flex justify-between">
                              <span className="text-[var(--color-text-muted)]">Team:</span>
                              <span className="text-[var(--color-brand-purple)] font-medium">
                                {registration.team_name}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between pt-1 border-t border-[var(--color-surface-3)] font-semibold">
                            <span className="text-[var(--color-text-muted)]">Amount Payable:</span>
                            <span className="text-[var(--color-text-primary)]">
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
      </div>
    </PageShell>
  )
}
