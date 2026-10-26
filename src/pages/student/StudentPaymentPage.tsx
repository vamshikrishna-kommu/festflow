import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
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
  CreditCard,
  RefreshCw,
  Smartphone,
  QrCode,
  XCircle,
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
  createPaymentOrder,
  verifyPaymentOrder,
  recordPaymentFailure,
  getStudentPaymentOrder,
  loadRazorpayScript,
  isRazorpayConfigured,
  getRazorpayKeyId,
} from '@/lib/payments'
import { fadeIn } from '@/lib/animations'
import type {
  RegistrationWithEvent,
  ClubPaymentSettings,
  PaymentSubmission,
  PaymentOrder,
  CreateOrderResponse,
} from '@/types'

export default function StudentPaymentPage() {
  const { registrationId } = useParams<{ registrationId: string }>()
  const { user } = useAuth()

  const [registration, setRegistration] = useState<RegistrationWithEvent | null>(null)
  const [clubSettings, setClubSettings] = useState<ClubPaymentSettings | null>(null)
  const [submission, setSubmission] = useState<PaymentSubmission | null>(null)
  const [paymentOrder, setPaymentOrder] = useState<PaymentOrder | null>(null)

  const [loading, setLoading] = useState(true)
  const [copiedUpi, setCopiedUpi] = useState(false)
  const [activeTab, setActiveTab] = useState<'gateway' | 'upi_qr'>('gateway')

  // Online Checkout states
  const [initiatingCheckout, setInitiatingCheckout] = useState(false)
  const [showSandboxModal, setShowSandboxModal] = useState(false)
  const [sandboxProcessing, setSandboxProcessing] = useState(false)
  const [activeCreatedOrder, setActiveCreatedOrder] = useState<CreateOrderResponse['order'] | null>(null)

  // Manual UPI Form states
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
      const [settings, sub, order] = await Promise.all([
        getClubPaymentSettings(clubId),
        getStudentPaymentSubmission(registrationId),
        getStudentPaymentOrder(registrationId),
      ])
      setClubSettings(settings)
      setSubmission(sub)
      setPaymentOrder(order)
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

    const reader = new FileReader()
    reader.onload = () => setScreenshotPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  // ── Launch Payment Checkout ─────────────────────────────────────────────────
  const handleLaunchCheckout = async () => {
    if (!registrationId || !user) return

    setInitiatingCheckout(true)
    setNotice(null)

    // 1. Create or retrieve server-verified order
    const orderRes = await createPaymentOrder(registrationId, 'razorpay')
    setInitiatingCheckout(false)

    if (!orderRes.success || !orderRes.order) {
      setNotice({ message: orderRes.message, isError: true })
      return
    }

    setActiveCreatedOrder(orderRes.order)

    // 2. Check if live Razorpay keys are configured
    if (isRazorpayConfigured) {
      const scriptLoaded = await loadRazorpayScript()
      if (scriptLoaded && (window as any).Razorpay) {
        try {
          const rzpOptions = {
            key: getRazorpayKeyId(),
            amount: Math.round(orderRes.order.amount * 100), // paise
            currency: orderRes.order.currency,
            name: 'FestFlow Event Pass',
            description: orderRes.order.event_title,
            image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=120',
            order_id: orderRes.order.provider_order_id || undefined,
            prefill: {
              name: user.user_metadata?.display_name || user.email,
              email: user.email,
              contact: user.user_metadata?.phone || '',
            },
            theme: {
              color: '#8B5CF6',
            },
            handler: async (response: any) => {
              setNotice({ message: 'Verifying payment with payment gateway…' })
              const verifyRes = await verifyPaymentOrder({
                orderId: orderRes.order!.id,
                providerPaymentId: response.razorpay_payment_id,
                providerSignature: response.razorpay_signature || 'rzp_verified',
                providerOrderId: response.razorpay_order_id,
              })

              if (verifyRes.success) {
                setNotice({ message: 'Payment successfully verified and pass issued!' })
                await loadData()
              } else {
                setNotice({ message: verifyRes.message, isError: true })
              }
            },
            modal: {
              ondismiss: () => {
                setNotice({ message: 'Payment checkout dismissed. You can retry whenever you are ready.' })
              },
            },
          }

          const rzp = new (window as any).Razorpay(rzpOptions)
          rzp.on('payment.failed', async (response: any) => {
            await recordPaymentFailure({
              orderId: orderRes.order!.id,
              errorCode: response.error?.code || 'GATEWAY_DECLINE',
              errorDescription: response.error?.description || 'Payment was declined by issuing bank.',
            })
            setNotice({
              message: `Payment failed: ${response.error?.description || 'Transaction declined'}. You can try again safely.`,
              isError: true,
            })
            await loadData()
          })

          rzp.open()
          return
        } catch (err) {
          console.warn('Razorpay SDK invocation exception:', err)
        }
      }
    }

    // 3. Fallback to interactive Sandbox Test Modal (when credentials are not yet added in .env)
    setShowSandboxModal(true)
  }

  // ── Sandbox Modal Simulators ────────────────────────────────────────────────
  const handleSimulateSandboxSuccess = async () => {
    if (!activeCreatedOrder) return
    setSandboxProcessing(true)
    const mockPaymentId = `pay_mock_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`
    const mockSignature = `sig_mock_${Math.random().toString(36).substring(2, 16)}`

    const verifyRes = await verifyPaymentOrder({
      orderId: activeCreatedOrder.id,
      providerPaymentId: mockPaymentId,
      providerSignature: mockSignature,
      providerOrderId: activeCreatedOrder.provider_order_id || undefined,
    })

    setSandboxProcessing(false)
    setShowSandboxModal(false)

    if (verifyRes.success) {
      setNotice({ message: 'Payment authorized and verified! Digital pass confirmed.' })
      await loadData()
    } else {
      setNotice({ message: verifyRes.message, isError: true })
    }
  }

  const handleSimulateSandboxDecline = async () => {
    if (!activeCreatedOrder) return
    setSandboxProcessing(true)

    await recordPaymentFailure({
      orderId: activeCreatedOrder.id,
      errorCode: 'BANK_DECLINED',
      errorDescription: 'Transaction declined by issuer bank (Simulated Test).',
    })

    setSandboxProcessing(false)
    setShowSandboxModal(false)
    setNotice({
      message: 'Payment simulation: Bank card/account was declined. You can safely retry checkout.',
      isError: true,
    })
    await loadData()
  }

  // ── Manual UPI UTR Submission ───────────────────────────────────────────────
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

  // Dynamic UPI URI for QR and mobile app intent
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
          <span className="text-[var(--color-text-primary)] font-medium">Event Checkout & Payment</span>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--color-surface-3)] border-t-[var(--color-brand-purple)] animate-spin" />
            <span className="text-xs text-[var(--color-text-muted)]">Loading event payment details…</span>
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
          <div className="flex flex-col gap-6">
            {/* Page Header */}
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="amber" className="flex items-center gap-1">
                  <Clock size={12} /> Payment Verification Required
                </Badge>
                <span className="text-xs text-[var(--color-text-muted)] font-mono">
                  Ref: {registration.ticket_code}
                </span>
                {event.is_free && (
                  <Badge variant="success">Free Event</Badge>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold font-display text-[var(--color-text-primary)]">
                Checkout for {event.title}
              </h1>
              <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-1">
                Complete your registration payment to unlock your confirmed digital gate pass with QR ticket code.
              </p>
            </div>

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
                    This event requires manual organizer review. Your application has been received, but checkout and payment submission are locked until the organizer approves your registration.
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
            ) : registration.status === 'confirmed' || submission?.status === 'approved' || paymentOrder?.status === 'paid' ? (
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
                      Your entry ticket is active. Present your digital QR pass at the entrance gate.
                    </p>
                  </div>
                </div>
                <Link to={`/student/tickets/${registration.id}`}>
                  <Button variant="primary" size="sm" rightIcon={<ExternalLink size={14} />}>
                    View Digital Pass
                  </Button>
                </Link>
              </motion.div>
            ) : paymentOrder?.status === 'failed' ? (
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle size={24} className="text-rose-400 shrink-0" />
                  <div>
                    <h3 className="font-bold text-sm text-rose-200">
                      Previous Payment Attempt Failed
                    </h3>
                    <p className="text-xs text-rose-300/80">
                      Reason: {paymentOrder.error_description || 'Transaction was declined.'} You can safely retry checkout below.
                    </p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleLaunchCheckout}
                  isLoading={initiatingCheckout}
                  leftIcon={<RefreshCw size={14} />}
                >
                  Retry Payment
                </Button>
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
                      UPI Payment Under Organizer Review
                    </h3>
                    <p className="text-xs text-amber-300/80">
                      Submitted Ref: <span className="font-mono font-bold">{submission.transaction_reference}</span>. The club organizer will verify your payment against their bank statements and confirm your pass.
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
                  Please verify your transaction history, copy the correct 12-digit UTR number below, and resubmit for approval.
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

            {/* ── Main Payment Container (when payable) ─────────────────────────── */}
            {!event.is_free && registration.status !== 'pending_approval' && (
              <div className="flex flex-col gap-6">
                {/* Mode Selector Tabs */}
                <div className="flex items-center gap-2 p-1.5 bg-[var(--color-surface-2)] rounded-2xl border border-[var(--color-surface-3)] w-full sm:w-fit">
                  <button
                    type="button"
                    onClick={() => setActiveTab('gateway')}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'gateway'
                        ? 'bg-[var(--color-brand-purple)] text-white shadow-lg'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    <CreditCard size={15} /> Instant Online Checkout
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('upi_qr')}
                    className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'upi_qr'
                        ? 'bg-[var(--color-brand-purple)] text-white shadow-lg'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    <QrCode size={15} /> Direct Club UPI & UTR
                  </button>
                </div>

                {/* ── TAB 1: Instant Online Checkout (Razorpay / Sandbox Gateway) ── */}
                {activeTab === 'gateway' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left: Order Summary & Instant Checkout Action */}
                    <div className="lg:col-span-7 flex flex-col gap-6">
                      <Card className="p-6 sm:p-8 flex flex-col gap-6">
                        <div className="flex items-center justify-between border-b border-[var(--color-surface-3)] pb-4">
                          <div>
                            <span className="text-xs uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">
                              Total Due
                            </span>
                            <div className="text-3xl sm:text-4xl font-extrabold font-display text-[var(--color-text-primary)] mt-1">
                              {effectiveCurrency} {effectiveAmount.toLocaleString()}
                            </div>
                          </div>
                          <Badge variant="purple" className="flex items-center gap-1.5">
                            <ShieldCheck size={14} /> 256-Bit Encrypted
                          </Badge>
                        </div>

                        {/* Order breakdown */}
                        <div className="space-y-3 text-xs">
                          <div className="flex justify-between text-[var(--color-text-secondary)]">
                            <span>Event Pass Fee</span>
                            <span className="text-[var(--color-text-primary)] font-medium">
                              {effectiveCurrency} {effectiveAmount}
                            </span>
                          </div>
                          <div className="flex justify-between text-[var(--color-text-secondary)]">
                            <span>Platform Convenience Fee</span>
                            <span className="text-emerald-400 font-semibold">Free (₹0)</span>
                          </div>
                          <div className="flex justify-between text-[var(--color-text-secondary)]">
                            <span>Organizer Payee</span>
                            <span className="text-[var(--color-text-primary)] truncate max-w-[200px]">
                              {effectiveName}
                            </span>
                          </div>
                          <div className="flex justify-between pt-3 border-t border-[var(--color-surface-3)] text-sm font-bold text-[var(--color-text-primary)]">
                            <span>Final Payable</span>
                            <span className="text-[var(--color-brand-cyan)]">
                              {effectiveCurrency} {effectiveAmount}
                            </span>
                          </div>
                        </div>

                        {/* Launch Checkout Button */}
                        <div className="pt-2">
                          <Button
                            variant="primary"
                            size="lg"
                            className="w-full bg-gradient-to-r from-[var(--color-brand-purple)] to-[var(--color-brand-pink)] hover:opacity-90 border-none font-bold text-sm shadow-xl"
                            onClick={handleLaunchCheckout}
                            isLoading={initiatingCheckout}
                            leftIcon={<CreditCard size={18} />}
                          >
                            Pay {effectiveCurrency} {effectiveAmount} with Gateway
                          </Button>

                          <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-[var(--color-text-muted)] text-center">
                            <Lock size={12} className="text-emerald-400" />
                            <span>Supports Google Pay, PhonePe, Paytm, Cards, and NetBanking</span>
                          </div>
                        </div>
                      </Card>

                      {/* Security Guarantees */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-surface-3)] text-left flex items-start gap-2.5">
                          <ShieldCheck size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                          <div>
                            <strong className="block text-xs font-semibold text-[var(--color-text-primary)]">
                              Instant Ticket
                            </strong>
                            <span className="text-[10px] text-[var(--color-text-muted)]">
                              Pass issued immediately upon verification
                            </span>
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-surface-3)] text-left flex items-start gap-2.5">
                          <Lock size={16} className="text-purple-400 shrink-0 mt-0.5" />
                          <div>
                            <strong className="block text-xs font-semibold text-[var(--color-text-primary)]">
                              No Card Storage
                            </strong>
                            <span className="text-[10px] text-[var(--color-text-muted)]">
                              Credentials never touch our servers
                            </span>
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-surface-3)] text-left flex items-start gap-2.5">
                          <Clock size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                          <div>
                            <strong className="block text-xs font-semibold text-[var(--color-text-primary)]">
                              Idempotent Safety
                            </strong>
                            <span className="text-[10px] text-[var(--color-text-muted)]">
                              Prevents duplicate charges on retries
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Event Brief Card */}
                    <div className="lg:col-span-5 flex flex-col gap-6">
                      <Card className="p-6">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
                          Attendee & Event Details
                        </h3>
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-[var(--color-surface-2)] flex items-center justify-center text-[var(--color-brand-purple)] shrink-0">
                              <Calendar size={22} />
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
                              <span className="text-[var(--color-text-muted)]">Registered Attendee:</span>
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
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>
                )}

                {/* ── TAB 2: Direct Campus UPI QR & UTR Verification ─────────── */}
                {activeTab === 'upi_qr' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left: Organizer UPI Details & QR */}
                    <div className="lg:col-span-5 flex flex-col gap-6">
                      <Card className="p-6 flex flex-col items-center text-center relative overflow-hidden">
                        <span className="text-xs uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-2">
                          Transfer Exactly
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
                        <span className="text-[11px] text-[var(--color-text-muted)] mb-3">
                          Scan with Google Pay, PhonePe, Paytm, or BHIM
                        </span>

                        {/* Mobile Intent Button */}
                        <a
                          href={upiIntentUri}
                          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md transition-all mb-4"
                        >
                          <Smartphone size={15} /> Open in UPI App (Mobile Only)
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
                    </div>

                    {/* Right: UTR Submission Form */}
                    <div className="lg:col-span-7 flex flex-col gap-6">
                      <Card className="p-6 sm:p-8">
                        <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)] mb-1">
                          Submit Transaction Reference (UTR)
                        </h2>
                        <p className="text-xs text-[var(--color-text-secondary)] mb-6">
                          After making the transfer, enter your 12-digit UPI UTR number below so the club organizer can verify and confirm your entry pass.
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
                              Found in your Google Pay, PhonePe, or Paytm receipt details.
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
                                ? 'Update Payment Details'
                                : 'Submit Payment for Review'}
                            </Button>
                          </div>
                        </form>
                      </Card>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Interactive Sandbox Test Mode Checkout Modal ────────────────────── */}
        <AnimatePresence>
          {showSandboxModal && activeCreatedOrder && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="w-full max-w-md p-6 rounded-3xl glass border border-[var(--color-brand-purple)]/40 text-left flex flex-col gap-5 shadow-2xl bg-gradient-to-b from-[var(--color-surface-1)] to-[var(--color-surface-0)]"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[var(--color-surface-3)]">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-[var(--color-brand-purple)]/20 text-[var(--color-brand-purple)] flex items-center justify-center">
                      <CreditCard size={18} />
                    </span>
                    <div>
                      <h3 className="font-bold font-display text-sm text-[var(--color-text-primary)]">
                        FestFlow Gateway Sandbox
                      </h3>
                      <span className="text-[10px] text-amber-400 font-medium">
                        Simulated Payment Mode (No Live Card Charged)
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSandboxModal(false)}
                    className="text-[var(--color-text-muted)] hover:text-white p-1 rounded-lg"
                  >
                    <XCircle size={18} />
                  </button>
                </div>

                {/* Order Details */}
                <div className="p-4 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Event:</span>
                    <strong className="text-[var(--color-text-primary)] truncate max-w-[200px]">
                      {activeCreatedOrder.event_title}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Order Ref:</span>
                    <span className="font-mono text-[var(--color-brand-cyan)] font-bold">
                      {activeCreatedOrder.order_reference}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[var(--color-surface-3)] font-bold text-sm">
                    <span className="text-[var(--color-text-primary)]">Payable Amount:</span>
                    <span className="text-[var(--color-brand-cyan)]">
                      {activeCreatedOrder.currency} {activeCreatedOrder.amount}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                  In production with live keys, this opens the authentic Razorpay checkout modal. For testing, choose a simulation outcome below to verify server-side state transitions.
                </p>

                {/* Simulation Action Buttons */}
                <div className="flex flex-col gap-2.5 pt-2">
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                    onClick={handleSimulateSandboxSuccess}
                    isLoading={sandboxProcessing}
                    leftIcon={<CheckCircle2 size={16} />}
                  >
                    Simulate Successful Payment
                  </Button>

                  <Button
                    variant="outline"
                    size="md"
                    className="w-full border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
                    onClick={handleSimulateSandboxDecline}
                    disabled={sandboxProcessing}
                    leftIcon={<AlertTriangle size={16} />}
                  >
                    Simulate Bank Decline / Failure
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setShowSandboxModal(false)}
                    disabled={sandboxProcessing}
                  >
                    Cancel & Close
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageShell>
  )
}
