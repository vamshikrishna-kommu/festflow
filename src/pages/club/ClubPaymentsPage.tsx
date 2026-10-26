import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Search,
  Copy,
  AlertTriangle,
  ArrowLeft,
  Settings,
  Image as ImageIcon,
  User,
  AlertCircle,
} from 'lucide-react'
import { Button, Card, Badge } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/context/AuthContext'
import {
  getClubPaymentSubmissions,
  reviewPaymentSubmission,
  getPaymentProofSignedUrl,
} from '@/lib/payments'
import { listClubEvents } from '@/lib/events'
import { fadeIn } from '@/lib/animations'
import type { PaymentSubmissionWithDetails, PaymentStatus, EventRecord } from '@/types'

export default function ClubPaymentsPage() {
  const { user } = useAuth()
  const clubId = user?.id || 'demo_club_member_default'
  const [searchParams] = useSearchParams()
  const eventIdParam = searchParams.get('eventId')

  const [submissions, setSubmissions] = useState<PaymentSubmissionWithDetails[]>([])
  const [events, setEvents] = useState<EventRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all')
  const [selectedEventId, setSelectedEventId] = useState<string>(eventIdParam || 'all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals
  const [inspectingScreenshot, setInspectingScreenshot] = useState<string | null>(null)
  const [approvingSub, setApprovingSub] = useState<PaymentSubmissionWithDetails | null>(null)
  const [rejectingSub, setRejectingSub] = useState<PaymentSubmissionWithDetails | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectError, setRejectError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [notice, setNotice] = useState<{ message: string; isError?: boolean } | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    const [subsRes, eventsRes] = await Promise.all([
      getClubPaymentSubmissions(clubId),
      listClubEvents(clubId),
    ])
    setLoading(false)
    if (subsRes.submissions) setSubmissions(subsRes.submissions)
    if (eventsRes.events) setEvents(eventsRes.events)
  }

  useEffect(() => {
    loadData()
  }, [clubId])

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Review Actions
  const handleApprove = async () => {
    if (!approvingSub) return
    setActionLoading(true)
    setNotice(null)
    const res = await reviewPaymentSubmission({
      paymentId: approvingSub.id,
      decision: 'approved',
      notes: 'Payment verified and approved.',
    })
    setActionLoading(false)
    setApprovingSub(null)

    if (res.success) {
      setNotice({ message: 'Payment successfully approved! Entry ticket issued to student.' })
      await loadData()
    } else {
      setNotice({ message: res.message, isError: true })
    }
  }

  const handleReject = async () => {
    if (!rejectingSub) return
    const cleanReason = rejectionReason.trim()
    if (!cleanReason) {
      setRejectError('Please provide a mandatory reason for rejecting this payment.')
      return
    }

    setActionLoading(true)
    setNotice(null)
    setRejectError(null)
    const res = await reviewPaymentSubmission({
      paymentId: rejectingSub.id,
      decision: 'rejected',
      notes: cleanReason,
    })
    setActionLoading(false)
    setRejectingSub(null)
    setRejectionReason('')

    if (res.success) {
      setNotice({ message: 'Payment marked as rejected. Student notified with the stated reason.' })
      await loadData()
    } else {
      setNotice({ message: res.message, isError: true })
    }
  }

  // Computed metric counts
  const pendingCount = submissions.filter((s) => s.status === 'pending_review').length
  const approvedCount = submissions.filter((s) => s.status === 'approved').length
  const rejectedCount = submissions.filter((s) => s.status === 'rejected').length

  // Filtered list
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter
      const matchesEvent = selectedEventId === 'all' || s.event_id === selectedEventId
      const q = searchQuery.trim().toLowerCase()
      const matchesSearch =
        !q ||
        s.transaction_reference.toLowerCase().includes(q) ||
        (s.student?.display_name || '').toLowerCase().includes(q) ||
        (s.student?.email || '').toLowerCase().includes(q) ||
        (s.event?.title || '').toLowerCase().includes(q)
      return matchesStatus && matchesEvent && matchesSearch
    })
  }, [submissions, statusFilter, selectedEventId, searchQuery])

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 text-left">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] border-b border-[var(--color-surface-3)] pb-4">
          <Link
            to="/club/dashboard"
            className="hover:text-[var(--color-text-primary)] flex items-center gap-1 transition-colors"
          >
            <ArrowLeft size={14} /> Club Dashboard
          </Link>
          <span>/</span>
          <span className="text-[var(--color-text-primary)] font-medium">Payment Review & Approvals</span>
        </div>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold font-display text-[var(--color-text-primary)]">
                Payment Verification
              </h1>
              {pendingCount > 0 && (
                <Badge variant="amber" className="animate-pulse">
                  {pendingCount} Awaiting Review
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
              Verify student UPI UTR numbers against your official club bank records and issue confirmed tickets.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/club/settings/payments">
              <Button variant="outline" size="sm" leftIcon={<Settings size={14} />}>
                UPI Settings
              </Button>
            </Link>
          </div>
        </div>

        {/* Verification Warning Protocol */}
        <Card className="p-4 bg-amber-500/10 border-amber-500/20 flex gap-3 items-start">
          <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/90 leading-relaxed space-y-1">
            <p className="font-bold text-amber-300">
              Organizer Verification Protocol
            </p>
            <p>
              Always check the submitted 12-digit UTR directly in your UPI app (Google Pay, PhonePe, Paytm, or net banking statement). Screenshots can be altered and do not serve as proof of payment alone. Confirm the money has arrived in your account before approving.
            </p>
          </div>
        </Card>

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

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4 flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Pending Review
            </span>
            <div className="text-2xl font-bold font-display text-amber-400 mt-2">
              {loading ? '…' : pendingCount}
            </div>
          </Card>
          <Card className="p-4 flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Approved
            </span>
            <div className="text-2xl font-bold font-display text-emerald-400 mt-2">
              {loading ? '…' : approvedCount}
            </div>
          </Card>
          <Card className="p-4 flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Rejected
            </span>
            <div className="text-2xl font-bold font-display text-rose-400 mt-2">
              {loading ? '…' : rejectedCount}
            </div>
          </Card>
          <Card className="p-4 flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Total Submissions
            </span>
            <div className="text-2xl font-bold font-display text-[var(--color-text-primary)] mt-2">
              {loading ? '…' : submissions.length}
            </div>
          </Card>
        </div>

        {/* Filters and Search Bar */}
        <Card className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-[var(--color-surface-2)] p-1 rounded-xl w-full md:w-auto overflow-x-auto no-scrollbar touch-pan-x">
            {(
              [
                { id: 'all', label: `All (${submissions.length})` },
                { id: 'pending_review', label: `Pending (${pendingCount})` },
                { id: 'approved', label: `Approved (${approvedCount})` },
                { id: 'rejected', label: `Rejected (${rejectedCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                  statusFilter === tab.id
                    ? 'bg-[var(--color-surface-4)] text-[var(--color-text-primary)] shadow'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {/* Event Filter */}
            {events.length > 0 && (
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-purple)] w-full sm:w-48"
              >
                <option value="all">All Events</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title}
                  </option>
                ))}
              </select>
            )}

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
              />
              <input
                type="text"
                placeholder="Search UTR, student, event…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-purple)] transition-colors"
              />
            </div>
          </div>
        </Card>

        {/* Submissions List */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--color-surface-3)] border-t-[var(--color-brand-purple)] animate-spin" />
            <span className="text-xs text-[var(--color-text-muted)]">Loading submissions…</span>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <Card className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <CreditCard size={40} className="text-[var(--color-text-muted)] opacity-50 mb-1" />
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
              No Payment Submissions Found
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] max-w-sm">
              {searchQuery || statusFilter !== 'all' || selectedEventId !== 'all'
                ? 'Try adjusting your search terms or filters.'
                : 'When students submit UPI payment references for your paid events, they will appear here for verification.'}
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredSubmissions.map((sub) => {
              const isPending = sub.status === 'pending_review'
              const isApproved = sub.status === 'approved'
              const isRejected = sub.status === 'rejected'

              return (
                <Card
                  key={sub.id}
                  className={`p-5 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6 ${
                    isPending ? 'border-amber-500/30 bg-amber-500/[0.02]' : ''
                  }`}
                >
                  {/* Left / Info Section */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
                    {/* Student Avatar / Icon */}
                    <div className="w-12 h-12 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] flex items-center justify-center text-[var(--color-text-muted)] shrink-0">
                      <User size={20} />
                    </div>

                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[var(--color-text-primary)]">
                          {sub.student?.display_name || 'Student Attendee'}
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          • {sub.student?.email || 'student@campus.edu'}
                        </span>
                        {isPending && (
                          <Badge variant="amber" className="text-[10px]">
                            Pending Review
                          </Badge>
                        )}
                        {isApproved && (
                          <Badge variant="success" className="text-[10px]">
                            Approved
                          </Badge>
                        )}
                        {isRejected && (
                          <Badge variant="danger" className="text-[10px]">
                            Rejected
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs text-[var(--color-text-secondary)] flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[var(--color-text-primary)]">
                          {sub.event?.title || 'Campus Event'}
                        </span>
                        <span>•</span>
                        <span className="font-bold text-[var(--color-brand-purple)]">
                          {sub.currency} {sub.amount}
                        </span>
                        <span>•</span>
                        <span className="text-[var(--color-text-muted)]">
                          Submitted: {new Date(sub.submitted_at).toLocaleDateString()} at{' '}
                          {new Date(sub.submitted_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {/* UTR Pill */}
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <span className="text-xs text-[var(--color-text-muted)]">Transaction UTR:</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(sub.transaction_reference, sub.id)}
                          className="px-2.5 py-1 rounded bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-xs font-mono font-bold text-[var(--color-text-primary)] hover:border-[var(--color-brand-purple)] flex items-center gap-1.5 transition-colors"
                          title="Click to copy UTR"
                        >
                          {sub.transaction_reference}
                          {copiedId === sub.id ? (
                            <CheckCircle2 size={12} className="text-emerald-400" />
                          ) : (
                            <Copy size={12} className="text-[var(--color-text-muted)]" />
                          )}
                        </button>

                        {/* Screenshot thumbnail if available */}
                        {sub.screenshot_url && (
                          <button
                            type="button"
                            onClick={async () => {
                              const resolved = await getPaymentProofSignedUrl(sub.screenshot_url!)
                              setInspectingScreenshot(resolved)
                            }}
                            className="px-2 py-1 rounded bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex items-center gap-1 transition-colors"
                          >
                            <ImageIcon size={12} />
                            <span>View Screenshot Proof</span>
                          </button>
                        )}
                      </div>

                      {/* Organizer Review Notes if Reviewed */}
                      {sub.review_notes && (
                        <p className="text-[11px] text-[var(--color-text-muted)] italic pt-1">
                          Note: "{sub.review_notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions Right Section */}
                  <div className="flex items-center gap-2 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-[var(--color-surface-3)] w-full lg:w-auto">
                    {isPending ? (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setApprovingSub(sub)}
                          leftIcon={<CheckCircle2 size={14} />}
                          className="flex-1 lg:flex-initial justify-center bg-emerald-600 hover:bg-emerald-500 border-none text-white min-h-[40px]"
                        >
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRejectingSub(sub)
                            setRejectionReason('')
                            setRejectError(null)
                          }}
                          leftIcon={<XCircle size={14} />}
                          className="flex-1 lg:flex-initial justify-center text-rose-400 hover:text-rose-300 hover:border-rose-500/30 min-h-[40px]"
                        >
                          Reject
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {isApproved
                          ? `Approved on ${sub.reviewed_at ? new Date(sub.reviewed_at).toLocaleDateString() : ''}`
                          : `Rejected on ${sub.reviewed_at ? new Date(sub.reviewed_at).toLocaleDateString() : ''}`}
                      </span>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {/* Modal: Screenshot Preview */}
        <AnimatePresence>
          {inspectingScreenshot && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="relative max-w-2xl w-full bg-[var(--color-surface-1)] border border-[var(--color-surface-3)] rounded-2xl p-4 flex flex-col gap-3 shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-[var(--color-surface-3)] pb-2">
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                    Payment Receipt Proof
                  </h3>
                  <button
                    type="button"
                    onClick={() => setInspectingScreenshot(null)}
                    className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
                  >
                    ✕
                  </button>
                </div>

                <div className="max-h-[70vh] overflow-auto rounded-xl bg-black/50 p-2 flex items-center justify-center">
                  <img
                    src={inspectingScreenshot}
                    alt="Receipt proof"
                    className="max-h-[65vh] object-contain rounded-lg"
                  />
                </div>

                <span className="text-[11px] text-[var(--color-text-muted)] text-center">
                  Remember: Compare the transaction reference (UTR) with your bank statement before approving.
                </span>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal: Approve Confirmation */}
        <AnimatePresence>
          {approvingSub && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="max-w-md w-full bg-[var(--color-surface-1)] border border-[var(--color-surface-3)] rounded-2xl p-6 flex flex-col gap-4 shadow-2xl"
              >
                <div className="flex items-center gap-3 text-emerald-400">
                  <CheckCircle2 size={24} />
                  <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                    Approve Payment & Issue Ticket?
                  </h3>
                </div>

                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Have you verified that the transaction UTR{' '}
                  <span className="font-mono font-bold text-white">
                    {approvingSub.transaction_reference}
                  </span>{' '}
                  for{' '}
                  <span className="font-bold text-white">
                    {approvingSub.currency} {approvingSub.amount}
                  </span>{' '}
                  has been credited to your club account?
                </p>

                <p className="text-xs text-emerald-300/80 bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                  Approving will atomically confirm{' '}
                  <span className="font-semibold text-white">
                    {approvingSub.student?.display_name || 'student'}
                  </span>
                  's registration and generate an active digital entry ticket.
                </p>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setApprovingSub(null)}
                    disabled={actionLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleApprove}
                    isLoading={actionLoading}
                    className="bg-emerald-600 hover:bg-emerald-500 border-none text-white"
                  >
                    {actionLoading ? 'Approving…' : 'Confirm & Issue Ticket'}
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal: Reject Payment */}
        <AnimatePresence>
          {rejectingSub && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="max-w-md w-full bg-[var(--color-surface-1)] border border-[var(--color-surface-3)] rounded-2xl p-6 flex flex-col gap-4 shadow-2xl"
              >
                <div className="flex items-center gap-3 text-rose-400">
                  <AlertTriangle size={24} />
                  <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                    Reject Payment Submission
                  </h3>
                </div>

                <p className="text-xs text-[var(--color-text-secondary)]">
                  Provide a mandatory reason so the student knows why their payment was not approved (e.g. UTR not found, incorrect amount, illegible screenshot).
                </p>

                {rejectError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle size={15} className="shrink-0 text-rose-400" />
                    <span>{rejectError}</span>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="reject_reason"
                    className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2"
                  >
                    Reason for Rejection <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    id="reject_reason"
                    rows={3}
                    required
                    placeholder="e.g. Transaction reference not found in bank statement. Please verify your 12-digit UTR."
                    value={rejectionReason}
                    onChange={(e) => {
                      setRejectionReason(e.target.value)
                      if (rejectError) setRejectError(null)
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRejectingSub(null)
                      setRejectionReason('')
                      setRejectError(null)
                    }}
                    disabled={actionLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={handleReject}
                    isLoading={actionLoading}
                  >
                    {actionLoading ? 'Rejecting…' : 'Reject Submission'}
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </PageShell>
  )
}
