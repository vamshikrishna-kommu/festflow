import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
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
  X,
} from 'lucide-react'
import { Button, Card, Badge, Modal, ModalBody, ModalFooter, EmptyState, Alert } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/context/AuthContext'
import {
  getClubPaymentSubmissions,
  reviewPaymentSubmission,
  getPaymentProofSignedUrl,
} from '@/lib/payments'
import { listClubEvents, isEventConcludedOrCancelled } from '@/lib/events'
import { subscribeToStatusChanges } from '@/lib/sync'
import { ROLE_LABELS } from '@/lib/clubMembers'
import type { PaymentSubmissionWithDetails, PaymentStatus, EventRecord } from '@/types'

export default function ClubPaymentsPage() {
  const {
    profile,
    clubProfile,
    activeClubId,
    activeClubMembership,
    activeClubProfile,
    activeClubRole,
    clubMemberships,
    eventAssignments,
    hasClubPermission,
    hasEventPermission,
    isRoleLoading,
    role,
  } = useAuth()
  const [searchParams] = useSearchParams()
  const eventIdParam = searchParams.get('eventId')

  const isPlatformAdmin = role === 'platform_admin'
  const clubId = activeClubId || null
  const clubName =
    activeClubProfile?.club_name ||
    activeClubMembership?.club_name ||
    clubProfile?.club_name ||
    profile?.display_name ||
    'Organization'

  const hasEventFinanceViewAccess = Boolean(
    clubId &&
      eventAssignments.some(
        (ea) => ea.club_id === clubId && ea.role === 'finance_manager'
      )
  )
  const canViewPayments =
    isPlatformAdmin || hasClubPermission('payments.view') || hasEventFinanceViewAccess
  const canVerifyAnyPayments =
    isPlatformAdmin || hasClubPermission('payments.verify') || hasEventFinanceViewAccess
  const canManagePaymentSettings =
    isPlatformAdmin || hasClubPermission('payments.settings')

  const [submissions, setSubmissions] = useState<PaymentSubmissionWithDetails[]>([])
  const [events, setEvents] = useState<EventRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

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

  const loadData = async (silent = false) => {
    if (isRoleLoading) return
    if (!clubId || !canViewPayments) {
      setSubmissions([])
      setEvents([])
      setLoadError(null)
      if (!silent) setLoading(false)
      return
    }
    if (!silent) setLoading(true)
    setLoadError(null)
    try {
      const [subsRes, eventsRes] = await Promise.all([
        getClubPaymentSubmissions(clubId),
        listClubEvents(clubId),
      ])
      if (!silent) setLoading(false)
      if (subsRes.error || eventsRes.error) {
        setLoadError(subsRes.error || eventsRes.error || 'Unable to load payment records.')
      }
    if (subsRes.submissions) {
      const visibleSubs = isPlatformAdmin
        ? subsRes.submissions
        : subsRes.submissions.filter((sub) =>
            hasEventPermission(sub.event_id, 'payments.view', sub.event?.club_id || clubId)
          )
      setSubmissions(visibleSubs)
    }
      if (eventsRes.events) {
        const visibleEvents = isPlatformAdmin
          ? eventsRes.events
          : eventsRes.events.filter(
              (evt) =>
                hasClubPermission('payments.view') ||
                hasEventPermission(evt.id, 'payments.view', evt.club_id || clubId)
            )
        setEvents(visibleEvents)
      }
    } catch (err: any) {
      if (!silent) setLoading(false)
      setLoadError(err?.message || 'Unable to load payment records.')
    }
  }

  useEffect(() => {
    if (!isRoleLoading) {
      loadData()
    }

    const unsubscribe = subscribeToStatusChanges(
      ['payment_submitted', 'payment_reviewed'],
      () => {
        if (!isRoleLoading && canViewPayments && clubId) {
          loadData(true)
        }
      }
    )
    return () => unsubscribe()
  }, [clubId, canViewPayments, isRoleLoading, activeClubRole, eventAssignments])

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Review Actions
  const eventById = new Map(events.map((e) => [e.id, e]))
  const canVerifySubmission = (sub: PaymentSubmissionWithDetails): boolean =>
    isPlatformAdmin ||
    hasEventPermission(sub.event_id, 'payments.verify', sub.event?.club_id || clubId)

  const handleApprove = async () => {
    if (!approvingSub || !canVerifySubmission(approvingSub)) {
      setApprovingSub(null)
      setNotice({
        message: 'You do not have permission to verify or approve this payment submission.',
        isError: true,
      })
      return
    }
    const targetEvent = eventById.get(approvingSub.event_id) || (approvingSub.event as any)
    if (targetEvent && isEventConcludedOrCancelled(targetEvent) && !isPlatformAdmin) {
      setApprovingSub(null)
      setNotice({
        message: 'Payment approvals are locked once an event has concluded or been cancelled.',
        isError: true,
      })
      return
    }
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
      setNotice({ message: 'Payment successfully approved! Entry ticket issued to student.', isError: false })
      await loadData()
    } else {
      setNotice({ message: res.message, isError: true })
    }
  }

  const handleReject = async () => {
    if (!rejectingSub || !canVerifySubmission(rejectingSub)) {
      setRejectingSub(null)
      setNotice({
        message: 'You do not have permission to reject this payment submission.',
        isError: true,
      })
      return
    }
    const targetEvent = eventById.get(rejectingSub.event_id) || (rejectingSub.event as any)
    if (targetEvent && isEventConcludedOrCancelled(targetEvent) && !isPlatformAdmin) {
      setRejectingSub(null)
      setNotice({
        message: 'Payment rejections are locked once an event has concluded or been cancelled.',
        isError: true,
      })
      return
    }
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
      setNotice({ message: 'Payment marked as rejected. Student notified with the stated reason.', isError: false })
      await loadData()
    } else {
      setNotice({ message: res.message, isError: true })
    }
  }

  // Computed metric counts
  const pendingCount = submissions.filter((s) => s.status === 'pending_review').length
  const approvedSubmissions = useMemo(() => submissions.filter((s) => s.status === 'approved'), [submissions])
  const approvedCount = approvedSubmissions.length
  const rejectedCount = submissions.filter((s) => s.status === 'rejected').length
  const verifiedGrossRevenue = useMemo(
    () => approvedSubmissions.reduce((sum, s) => sum + (s.amount || 0), 0),
    [approvedSubmissions]
  )

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

  if (!clubId) {
    return (
      <PageShell>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 text-left">
          <div className="flex items-center gap-2 text-xs text-gray-500 border-b border-gray-200 pb-4">
            <Link
              to="/club/dashboard"
              className="hover:text-[var(--color-text-primary)] flex items-center gap-1 transition-colors"
            >
              <ArrowLeft size={14} /> Club Dashboard
            </Link>
            <span>/</span>
            <span className="text-[var(--color-text-primary)] font-medium">Payment Review & Approvals</span>
          </div>
          <EmptyState
            icon={AlertTriangle}
            title="No Active Organization Found"
            description="You do not have an active club profile or authorized club membership. To access payment verification, you must be a registered club owner or an invited staff member with payment review permissions."
            action={
              <Link to="/club/dashboard">
                <Button variant="primary" size="sm">
                  Go to Club Dashboard
                </Button>
              </Link>
            }
          />
        </div>
      </PageShell>
    )
  }

  if (!isRoleLoading && !canViewPayments) {
    return (
      <PageShell>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 text-left">
          <div className="flex items-center gap-2 text-xs text-gray-500 border-b border-gray-200 pb-4">
            <Link
              to="/club/dashboard"
              className="hover:text-[var(--color-text-primary)] flex items-center gap-1 transition-colors"
            >
              <ArrowLeft size={14} /> Club Dashboard
            </Link>
            <span>/</span>
            <span className="text-[var(--color-text-primary)] font-medium">Payment Review & Approvals</span>
          </div>
          <EmptyState
            icon={AlertTriangle}
            title="Role Permission Required"
            description={`Your current role (${activeClubRole ? ROLE_LABELS[activeClubRole] : 'Staff Member'}) in ${clubName} does not have permission to view or verify payment submissions. Only Club Owners, Administrators, Payment Reviewers, or assigned Event Finance Managers can access this page.`}
            action={
              <Link to="/club/dashboard">
                <Button variant="primary" size="sm">
                  Back to Dashboard
                </Button>
              </Link>
            }
          />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 text-left">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 border-b border-gray-200 pb-4">
          <Link
            to="/club/dashboard"
            className="hover:text-gray-900 flex items-center gap-1 transition-colors"
          >
            <ArrowLeft size={14} /> Club Dashboard
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Payment Review & Approvals</span>
        </div>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold font-display text-gray-900">
                Payment Verification
              </h1>
              <Badge variant="indigo">{clubName}</Badge>
              {activeClubRole && (
                <Badge variant="outline" className="text-xs">
                  {ROLE_LABELS[activeClubRole]}
                </Badge>
              )}
              {clubMemberships.length > 1 && (
                <Badge variant="info" className="text-xs">
                  Active Club
                </Badge>
              )}
              {pendingCount > 0 && (
                <Badge variant="amber">
                  {pendingCount} Awaiting Review
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-600">
              Verify student UPI UTR numbers against your official club bank records and issue confirmed tickets.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canManagePaymentSettings && (
              <Link to="/club/settings/payments">
                <Button variant="outline" size="sm" leftIcon={<Settings size={14} />}>
                  UPI Settings
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Verification Warning Protocol */}
        <Card className="p-4 bg-amber-50 border-amber-200 flex gap-3 items-start">
          <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 leading-relaxed space-y-1">
            <p className="font-bold text-amber-900">
              Organizer Verification Protocol
            </p>
            <p>
              Always check the submitted 12-digit UTR directly in your UPI app (Google Pay, PhonePe, Paytm, or net banking statement). Screenshots can be altered and do not serve as proof of payment alone. Confirm the money has arrived in your account before approving.
            </p>
          </div>
        </Card>

        {loadError && (
          <Alert variant="error">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-sm">Unable to load payment records</p>
                <p className="text-xs opacity-90">{loadError}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => loadData()}>
                Retry
              </Button>
            </div>
          </Alert>
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

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Pending Review
            </span>
            <div className="text-2xl sm:text-3xl font-bold font-display text-amber-600 mt-2">
              {loading ? '…' : pendingCount}
            </div>
            <span className="text-[11px] text-gray-500 mt-1">
              Requires organizer check
            </span>
          </Card>

          <Card className="p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Approved
            </span>
            <div className="text-2xl sm:text-3xl font-bold font-display text-emerald-600 mt-2">
              {loading ? '…' : approvedCount}
            </div>
            <span className="text-[11px] text-gray-500 mt-1">
              Confirmed admissions
            </span>
          </Card>

          <Card className="p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Gross Revenue
            </span>
            <div className="text-2xl sm:text-3xl font-bold font-display text-gray-900 mt-2">
              {loading ? '…' : `₹${verifiedGrossRevenue.toLocaleString()}`}
            </div>
            <span className="text-[11px] text-gray-500 mt-1">
              Verified collections
            </span>
          </Card>

          <Card className="p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Rejected
            </span>
            <div className="text-2xl sm:text-3xl font-bold font-display text-rose-600 mt-2">
              {loading ? '…' : rejectedCount}
            </div>
            <span className="text-[11px] text-gray-500 mt-1">
              Declined submissions
            </span>
          </Card>
        </div>

        {/* Filters and Search Bar */}
        <Card className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto no-scrollbar touch-pan-x text-xs border border-gray-200">
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
                className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-gray-900 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white'
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
                className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-blue-600 w-full sm:w-48"
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
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search UTR, student, event…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* Submissions List */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin" />
            <span className="text-xs text-gray-500">Loading submissions…</span>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title={searchQuery || statusFilter !== 'all' || selectedEventId !== 'all' ? 'No Matching Submissions' : 'No Payment Submissions Yet'}
            description={
              searchQuery || statusFilter !== 'all' || selectedEventId !== 'all'
                ? 'Try adjusting your search terms or filter selection.'
                : 'When students submit UPI payment references for your paid events, they will appear here for verification.'
            }
            action={
              searchQuery || statusFilter !== 'all' || selectedEventId !== 'all' ? (
                <Button variant="outline" size="sm" onClick={() => { setSearchQuery(''); setStatusFilter('all'); setSelectedEventId('all') }}>
                  Clear Filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            {filteredSubmissions.map((sub) => {
              const isPending = sub.status === 'pending_review'
              const isApproved = sub.status === 'approved'
              const isRejected = sub.status === 'rejected'

              return (
                <Card
                  key={sub.id}
                  className={`p-5 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6 border ${
                    isPending
                      ? 'border-amber-300 bg-amber-50/40'
                      : 'border-gray-200'
                  }`}
                >
                  {/* Left / Info Section */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
                    {/* Student Avatar / Icon */}
                    <div className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500 shrink-0">
                      <User size={20} />
                    </div>

                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-gray-900">
                          {sub.student?.display_name || 'Student Attendee'}
                        </span>
                        {sub.student?.email && (
                          <span className="text-xs text-gray-500">
                            • {sub.student.email}
                          </span>
                        )}
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

                      <div className="text-xs text-gray-600 flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">
                          {sub.event?.title || 'Campus Event'}
                        </span>
                        <span>•</span>
                        <span className="font-bold font-mono text-emerald-600">
                          {sub.currency} {sub.amount}
                        </span>
                        <span>•</span>
                        <span className="text-gray-500">
                          Submitted: {new Date(sub.submitted_at).toLocaleDateString()} at{' '}
                          {new Date(sub.submitted_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {/* UTR Pill */}
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <span className="text-xs text-gray-500">Transaction UTR:</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(sub.transaction_reference, sub.id)}
                          className="px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-200 text-xs font-mono font-bold text-gray-900 hover:border-blue-400 flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Click to copy UTR"
                        >
                          {sub.transaction_reference}
                          {copiedId === sub.id ? (
                            <CheckCircle2 size={12} className="text-emerald-600" />
                          ) : (
                            <Copy size={12} className="text-gray-400" />
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
                            className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-xs text-gray-700 hover:text-gray-900 hover:border-gray-300 flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <ImageIcon size={12} />
                            <span>View Screenshot Proof</span>
                          </button>
                        )}
                      </div>

                      {/* Organizer Review Notes if Reviewed */}
                      {sub.review_notes && (
                        <p className="text-[11px] text-gray-500 italic pt-1">
                          Note: "{sub.review_notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions Right Section */}
                  <div className="flex items-center gap-2 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-gray-200 w-full lg:w-auto">
                    {isPending ? (
                      (eventById.get(sub.event_id) || (sub.event as any)) &&
                      isEventConcludedOrCancelled(eventById.get(sub.event_id) || (sub.event as any)) &&
                      !isPlatformAdmin ? (
                        <Badge variant="default" className="text-[10px]">
                          Event Archived — Review Locked
                        </Badge>
                      ) : !canVerifySubmission(sub) || !canVerifyAnyPayments ? (
                        <Badge variant="default" className="text-[10px]">
                          View Only
                        </Badge>
                      ) : (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setApprovingSub(sub)}
                            leftIcon={<CheckCircle2 size={14} />}
                            className="flex-1 lg:flex-initial justify-center bg-emerald-600 hover:bg-emerald-700 border-none text-white min-h-[44px]"
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
                            className="flex-1 lg:flex-initial justify-center text-rose-600 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-200 min-h-[44px]"
                          >
                            Reject
                          </Button>
                        </>
                      )
                    ) : (
                      <span className="text-xs text-gray-500">
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

        {/* ── Modal: Screenshot Preview ─────────────────────────────────────── */}
        <Modal
          isOpen={Boolean(inspectingScreenshot)}
          onClose={() => setInspectingScreenshot(null)}
          title="Payment Receipt Proof"
          size="lg"
        >
          <ModalBody>
            <div className="flex flex-col gap-3">
              <div className="max-h-[65vh] overflow-auto rounded-xl bg-gray-100 p-2 flex items-center justify-center border border-gray-200">
                {inspectingScreenshot && (
                  <img
                    src={inspectingScreenshot}
                    alt="Receipt proof"
                    className="max-h-[60vh] object-contain rounded-lg"
                  />
                )}
              </div>
              <p className="text-[11px] text-gray-500 text-center">
                Always confirm the transaction UTR directly with your bank statement before approving.
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInspectingScreenshot(null)}
            >
              Close Preview
            </Button>
          </ModalFooter>
        </Modal>

        {/* ── Modal: Approve Confirmation ───────────────────────────────────── */}
        <Modal
          isOpen={Boolean(approvingSub)}
          onClose={() => setApprovingSub(null)}
          title="Approve Payment & Issue Ticket"
          size="sm"
        >
          <ModalBody>
            {approvingSub && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 text-emerald-600">
                  <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900">
                      Verify & Issue Pass
                    </h4>
                    <p className="text-xs text-gray-500">
                      Atomically confirms registration and activates entry pass.
                    </p>
                  </div>
                </div>

                <p className="text-xs text-gray-600 leading-relaxed mt-1">
                  Have you verified that the transaction UTR{' '}
                  <span className="font-mono font-bold text-gray-900">
                    {approvingSub.transaction_reference}
                  </span>{' '}
                  for{' '}
                  <span className="font-bold text-emerald-600">
                    {approvingSub.currency} {approvingSub.amount}
                  </span>{' '}
                  has been credited to your club account?
                </p>

                <p className="text-xs text-emerald-800 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                  Approving will instantly confirm{' '}
                  <strong className="text-gray-900">
                    {approvingSub.student?.display_name || 'student'}
                  </strong>
                  &apos;s registration and activate their official entry pass.
                </p>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setApprovingSub(null)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleApprove}
              isLoading={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 border-none text-white font-semibold"
            >
              Confirm & Issue Ticket
            </Button>
          </ModalFooter>
        </Modal>

        {/* ── Modal: Reject Payment ─────────────────────────────────────────── */}
        <Modal
          isOpen={Boolean(rejectingSub)}
          onClose={() => {
            setRejectingSub(null)
            setRejectionReason('')
            setRejectError(null)
          }}
          title="Reject Payment Submission"
          size="sm"
        >
          <ModalBody>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 text-rose-600">
                <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900">
                    Decline UTR Submission
                  </h4>
                  <p className="text-xs text-gray-500">
                    Student will receive this reason to resubmit.
                  </p>
                </div>
              </div>

              <p className="text-xs text-gray-600">
                Provide a reason so the student knows why their payment was not approved (e.g. UTR not found, incorrect amount, or illegible screenshot).
              </p>

              {rejectError && (
                <Alert variant="error" className="text-xs">
                  {rejectError}
                </Alert>
              )}

              <div>
                <label
                  htmlFor="reject_reason"
                  className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5"
                >
                  Reason for Rejection <span className="text-rose-500">*</span>
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
                  className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 transition-colors"
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
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
              variant="danger"
              size="sm"
              onClick={handleReject}
              isLoading={actionLoading}
            >
              Reject Submission
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    </PageShell>
  )
}
