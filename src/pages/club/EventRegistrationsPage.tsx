import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router'
import { motion } from 'motion/react'
import {
  Users,
  Search,
  AlertTriangle,
  QrCode,
  MapPin,
  CreditCard,
  FileSpreadsheet,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  ArrowUpDown,
  LogOut,
  Copy,
  CheckCheck,
} from 'lucide-react'
import { Button, Badge, Card, Breadcrumbs, Modal, ModalBody, ModalFooter, EmptyState, Alert } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { getEventById } from '@/lib/events'
import {
  cancelRegistration,
  reviewRegistrationApplication,
} from '@/lib/registrations'
import { getEventRegistrationsWithCheckIn } from '@/lib/checkin'
import { getClubPaymentSubmissions } from '@/lib/payments'
import {
  exportFullAttendeesXlsx,
  exportAttendanceReportXlsx,
  exportTeamsReportXlsx,
  exportPaymentsReportXlsx,
  formatExcelDateTime,
} from '@/lib/excelExport'
import { useAuth } from '@/context/AuthContext'
import { ResourceOwnerGuard } from '@/components/auth/ResourceOwnerGuard'
import { subscribeToStatusChanges } from '@/lib/sync'
import { fadeIn, staggerContainer } from '@/lib/animations'
import type {
  EventRecord,
  RegistrationWithCheckIn,
  RegistrationStatus,
  CheckInRecord,
  PaymentSubmissionWithDetails,
  CustomQuestion,
} from '@/types'

export default function EventRegistrationsPage() {
  const { id } = useParams<{ id: string }>()
  const { user, role } = useAuth()

  const [event, setEvent] = useState<EventRecord | null>(null)
  const [registrations, setRegistrations] = useState<RegistrationWithCheckIn[]>([])
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([])
  const [payments, setPayments] = useState<PaymentSubmissionWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  // Search & Multi-Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | RegistrationStatus>('all')
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'pending_review' | 'unpaid'>('all')
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'checked_in' | 'checked_out' | 'not_checked_in'>('all')
  const [participationFilter, setParticipationFilter] = useState<'all' | 'individual' | 'team'>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'ticket_code'>('newest')

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(25)

  // Export State
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportingType, setExportingType] = useState<string | null>(null)

  // Attendee Detail & Review Application Modal State
  const [selectedAttendee, setSelectedAttendee] = useState<RegistrationWithCheckIn | null>(null)
  const [reviewDecision, setReviewDecision] = useState<'approved' | 'rejected'>('approved')
  const [rejectionReason, setRejectionReason] = useState('')
  const [isReviewing, setIsReviewing] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)

  // Cancel Action Modal State
  const [cancellingAttendee, setCancellingAttendee] = useState<RegistrationWithCheckIn | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [notice, setNotice] = useState<{ message: string; isError?: boolean } | null>(null)

  const loadData = async () => {
    if (!id) return
    setLoading(true)
    const [eventRes, checkInRes, payRes] = await Promise.all([
      getEventById(id),
      getEventRegistrationsWithCheckIn(id),
      getClubPaymentSubmissions(user?.id, id),
    ])
    setLoading(false)

    if (eventRes.event) {
      const authorized = (user && eventRes.event.club_id === user.id) || role === 'platform_admin'
      setIsAuthorized(authorized)
      if (authorized) {
        setEvent(eventRes.event)
        if (checkInRes.registrations) setRegistrations(checkInRes.registrations)
        if (checkInRes.checkIns) setCheckIns(checkInRes.checkIns)
        if (payRes.submissions) setPayments(payRes.submissions)
      }
    } else {
      setIsAuthorized(false)
    }
  }

  useEffect(() => {
    loadData()

    const unsubscribe = subscribeToStatusChanges(
      ['registration_updated', 'team_updated', 'checkin_recorded', 'payment_reviewed', 'reconnect'],
      (e) => {
        if (!e.eventId || e.eventId === id) {
          loadData()
        }
      }
    )
    return () => unsubscribe()
  }, [id, user, role])

  // Payment Lookup Map by Registration ID
  const paymentMap = useMemo(() => {
    const map = new Map<string, PaymentSubmissionWithDetails>()
    payments.forEach((p) => {
      if (p.registration_id) {
        map.set(p.registration_id, p)
      }
    })
    return map
  }, [payments])

  // Custom Questions Lookup
  const customQuestionsList: CustomQuestion[] = useMemo(() => {
    if (!event?.custom_questions || !Array.isArray(event.custom_questions)) return []
    return event.custom_questions as CustomQuestion[]
  }, [event])

  const getQuestionLabel = (keyOrId: string): string => {
    const found = customQuestionsList.find((q) => q.id === keyOrId || q.label === keyOrId)
    return found?.label || keyOrId
  }

  // Count Metrics
  const confirmedCount = registrations.filter((r) => r.status === 'confirmed').length
  const pendingApprovalCount = registrations.filter((r) => r.status === 'pending_approval').length
  const pendingPaymentCount = registrations.filter((r) => r.status === 'pending_payment').length
  const cancelledCount = registrations.filter((r) => r.status === 'cancelled' || r.status === 'rejected').length
  const insideCount = registrations.filter((r) => r.attendance_status === 'checked_in').length
  const checkedOutCount = registrations.filter((r) => r.attendance_status === 'checked_out').length

  const filterCounts = useMemo(() => {
    return {
      all: registrations.length,
      confirmed: confirmedCount,
      pending_approval: pendingApprovalCount,
      pending_payment: pendingPaymentCount,
      cancelled: cancelledCount,
    }
  }, [registrations, confirmedCount, pendingApprovalCount, pendingPaymentCount, cancelledCount])

  // Reset pagination to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter, paymentFilter, attendanceFilter, participationFilter, sortBy, pageSize])

  // Filtering Logic
  const filteredRegistrations = useMemo(() => {
    return registrations.filter((r) => {
      // 1. Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'cancelled') {
          if (r.status !== 'cancelled' && r.status !== 'rejected') return false
        } else if (r.status !== statusFilter) {
          return false
        }
      }

      // 2. Payment Filter
      if (paymentFilter !== 'all') {
        const paymentRecord = paymentMap.get(r.id)
        if (paymentFilter === 'paid') {
          const isFree = Boolean(event?.is_free)
          const isPaid = isFree || paymentRecord?.status === 'approved' || r.status === 'confirmed'
          if (!isPaid) return false
        } else if (paymentFilter === 'pending_review') {
          if (paymentRecord?.status !== 'pending_review' && r.status !== 'pending_payment') return false
        } else if (paymentFilter === 'unpaid') {
          if (event?.is_free || paymentRecord?.status === 'approved' || r.status === 'confirmed') return false
        }
      }

      // 3. Attendance Filter
      if (attendanceFilter !== 'all') {
        if (attendanceFilter === 'checked_in' && r.attendance_status !== 'checked_in') return false
        if (attendanceFilter === 'checked_out' && r.attendance_status !== 'checked_out') return false
        if (attendanceFilter === 'not_checked_in' && r.attendance_status !== 'not_checked_in') return false
      }

      // 4. Participation Mode Filter
      if (participationFilter !== 'all') {
        const hasTeam = Boolean(r.team_name || (r as any).team_id)
        if (participationFilter === 'team' && !hasTeam) return false
        if (participationFilter === 'individual' && hasTeam) return false
      }

      // 5. Text Search (Name, email, team, registration ID, ticket code, squad member names)
      const q = search.trim().toLowerCase()
      if (q !== '') {
        const studentName = r.student?.display_name || (r.team_name ? `Team ${r.team_name}` : 'Student Attendee')
        const studentEmail = r.student?.email || ''
        const ticketCode = r.ticket_code || ''
        const regId = r.id || ''
        const teamName = r.team_name || ''

        // Check squad members
        const teamMembers: any[] = Array.isArray((r as any).team_members) ? (r as any).team_members : []
        const matchesMember = teamMembers.some(
          (m) =>
            (m.name && m.name.toLowerCase().includes(q)) ||
            (m.email && m.email.toLowerCase().includes(q)) ||
            (m.ticket_code && m.ticket_code.toLowerCase().includes(q))
        )

        const matchesPrimary =
          studentName.toLowerCase().includes(q) ||
          studentEmail.toLowerCase().includes(q) ||
          ticketCode.toLowerCase().includes(q) ||
          regId.toLowerCase().includes(q) ||
          teamName.toLowerCase().includes(q)

        if (!matchesPrimary && !matchesMember) return false
      }

      return true
    })
  }, [registrations, search, statusFilter, paymentFilter, attendanceFilter, participationFilter, paymentMap, event])

  // Sorting Logic
  const sortedRegistrations = useMemo(() => {
    const list = [...filteredRegistrations]
    list.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      if (sortBy === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      if (sortBy === 'name_asc') {
        const nameA = (a.student?.display_name || a.team_name || '').toLowerCase()
        const nameB = (b.student?.display_name || b.team_name || '').toLowerCase()
        return nameA.localeCompare(nameB)
      }
      if (sortBy === 'name_desc') {
        const nameA = (a.student?.display_name || a.team_name || '').toLowerCase()
        const nameB = (b.student?.display_name || b.team_name || '').toLowerCase()
        return nameB.localeCompare(nameA)
      }
      if (sortBy === 'ticket_code') {
        return (a.ticket_code || '').localeCompare(b.ticket_code || '')
      }
      return 0
    })
    return list
  }, [filteredRegistrations, sortBy])

  // Pagination Calculations
  const totalItems = sortedRegistrations.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const paginatedRegistrations = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return sortedRegistrations.slice(startIndex, startIndex + pageSize)
  }, [sortedRegistrations, currentPage, pageSize])

  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalItems)

  const isFilterActive =
    search !== '' ||
    statusFilter !== 'all' ||
    paymentFilter !== 'all' ||
    attendanceFilter !== 'all' ||
    participationFilter !== 'all'

  const clearAllFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setPaymentFilter('all')
    setAttendanceFilter('all')
    setParticipationFilter('all')
    setSortBy('newest')
  }

  // Application Review Handler
  const handleReviewApplication = async () => {
    if (!selectedAttendee) return
    setIsReviewing(true)
    const res = await reviewRegistrationApplication(
      selectedAttendee.id,
      reviewDecision,
      reviewDecision === 'rejected' ? rejectionReason.trim() : undefined
    )
    setIsReviewing(false)
    setSelectedAttendee(null)
    setRejectionReason('')

    if (res.success) {
      setNotice({ message: res.message, isError: false })
      loadData()
    } else {
      setNotice({ message: res.message, isError: true })
    }
  }

  // Cancel Registration Handler
  const handleOrganizerCancel = async () => {
    if (!cancellingAttendee) return
    setActionLoading(true)
    const res = await cancelRegistration(cancellingAttendee.id)
    setActionLoading(false)
    setCancellingAttendee(null)

    if (res.success) {
      const attendeeName =
        cancellingAttendee.student?.display_name ||
        (cancellingAttendee.team_name ? `Team ${cancellingAttendee.team_name}` : 'Attendee')
      setNotice({
        message: `Registration pass for ${attendeeName} has been cancelled and voided.`,
        isError: false,
      })
      loadData()
    } else {
      setNotice({ message: res.message, isError: true })
    }
  }

  // Excel Export Triggers
  const handleExport = async (type: 'full' | 'attendance' | 'teams' | 'payments') => {
    if (!event) return
    try {
      setExportingType(type)
      if (type === 'full') {
        await exportFullAttendeesXlsx({
          event,
          registrations,
          checkIns,
          payments,
          isAuthorized: Boolean(isAuthorized),
        })
      } else if (type === 'attendance') {
        await exportAttendanceReportXlsx({
          event,
          registrations,
          checkIns,
        })
      } else if (type === 'teams') {
        await exportTeamsReportXlsx({
          event,
          registrations,
        })
      } else if (type === 'payments') {
        await exportPaymentsReportXlsx({
          event,
          payments,
          isAuthorized: Boolean(isAuthorized),
        })
      }
      setNotice({
        message: `Excel workbook (.xlsx) successfully downloaded.`,
        isError: false,
      })
    } catch (err: any) {
      setNotice({
        message: err.message || 'Failed to generate Excel export.',
        isError: true,
      })
    } finally {
      setExportingType(null)
      setExportModalOpen(false)
    }
  }

  if (loading) {
    return (
      <PageShell>
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--color-surface-3)] border-t-[var(--color-brand-purple)] animate-spin mb-3" />
          <span className="text-xs text-[var(--color-text-muted)]">
            Loading attendee directory & gate turnstile records…
          </span>
        </div>
      </PageShell>
    )
  }

  if (isAuthorized === false || !event) {
    return (
      <PageShell>
        <ResourceOwnerGuard
          isAuthorized={false}
          denialTitle="Event Authorization Required"
          denialMessage="Only the club organizing this event or authorized platform administrators can inspect registrations and attendee details."
          fallbackUrl="/club/events"
          fallbackLabel="Back to My Events"
        >
          <div />
        </ResourceOwnerGuard>
      </PageShell>
    )
  }

  const fillPercent = Math.min(Math.round((confirmedCount / event.capacity) * 100), 100)
  const reviewingPayment = selectedAttendee ? paymentMap.get(selectedAttendee.id) : null
  const reviewingCheckIn = selectedAttendee?.check_in || null

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 text-left">
        {/* Navigation Breadcrumbs */}
        <Breadcrumbs
          items={[
            { label: 'Dashboard', href: '/club/dashboard' },
            { label: 'My Events', href: '/club/events' },
            { label: event.title, href: `/events/${event.slug}` },
            { label: 'Attendee Management' },
          ]}
        />

        {/* Header Hero */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="p-5 sm:p-7 md:p-8 rounded-3xl border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-2xl relative overflow-hidden bg-gradient-to-b from-[#0E0E12] to-[#08080A]"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 15% 40%, rgba(255, 87, 34, 0.12) 0%, transparent 65%)' }}
          />
          <div className="min-w-0 relative">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-300">
                {event.category}
              </span>
              <Badge
                variant={event.status === 'published' ? 'success' : 'amber'}
                className="capitalize text-[10px]"
              >
                {event.status}
              </Badge>
              {event.participation_type === 'team' && (
                <Badge variant="pink" className="text-[10px]">
                  Team Event
                </Badge>
              )}
              <span className="text-xs text-zinc-500 font-mono truncate max-w-[200px]">
                /{event.slug}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-white">
              {event.title}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 flex items-center gap-2 flex-wrap font-sans">
              <span className="flex items-center gap-1">
                <MapPin size={13} className="text-[#18CFFC]" /> {event.venue_name || 'Campus Venue'}
              </span>
              <span className="text-zinc-600">•</span>
              <span className="font-semibold text-white font-mono">
                {event.is_free ? 'Free Admission' : `₹${event.price} Pass`}
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-[#18CFFC] font-medium font-mono">
                {insideCount} admitted inside ({checkedOutCount} exited)
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap pt-2 md:pt-0 border-t md:border-t-0 border-white/[0.08] relative">
            {/* Primary Excel Export Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportModalOpen(true)}
              leftIcon={<Download size={14} className="text-emerald-400" />}
              className="flex-1 sm:flex-initial justify-center border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-500/10 text-emerald-300 font-semibold shadow-sm"
            >
              Export Excel (.xlsx)
            </Button>

            {event.status === 'published' && (
              <Link to={`/club/events/${event.id}/check-in`} className="flex-1 sm:flex-initial">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<QrCode size={13} />}
                  className="w-full justify-center shadow-sm"
                >
                  Gate Check-In
                </Button>
              </Link>
            )}

            {!event.is_free && (
              <Link to={`/club/payments?eventId=${event.id}`} className="flex-1 sm:flex-initial">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<CreditCard size={13} />}
                  className="w-full justify-center bg-amber-500 hover:bg-amber-400 text-black border-none font-semibold shadow-sm"
                >
                  Payments
                </Button>
              </Link>
            )}

            <Link to={`/club/events/${event.id}/reports`} className="flex-1 sm:flex-initial">
              <Button variant="outline" size="sm" className="w-full justify-center" leftIcon={<FileSpreadsheet size={13} />}>
                Reports
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Temporary Notice */}
        {notice && (
          <Alert
            variant={notice.isError ? 'error' : 'success'}
            dismissible
            onDismiss={() => setNotice(null)}
          >
            {notice.message}
          </Alert>
        )}

        {/* Metrics Summary Grid */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
        >
          <Card className="p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-xs text-[var(--color-text-muted)] font-medium block mb-1">
              Confirmed Passes
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold font-display text-emerald-400">
                {confirmedCount}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] font-mono">
                / {event.capacity} seats ({fillPercent}%)
              </span>
            </div>
            <div className="w-full h-1 bg-[var(--color-surface-3)] rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${fillPercent}%` }}
              />
            </div>
          </Card>

          <Card className="p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-xs text-[var(--color-text-muted)] font-medium block mb-1">
              Under Host Review
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold font-display text-purple-400">
                {pendingApprovalCount}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {pendingApprovalCount > 0 ? 'Action required' : 'All clear'}
              </span>
            </div>
            <span className="text-[11px] text-[var(--color-text-muted)] mt-2">
              Requires organizer decision
            </span>
          </Card>

          <Card className="p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-xs text-[var(--color-text-muted)] font-medium block mb-1">
              Gate Admitted Inside
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold font-display text-[var(--color-brand-cyan)]">
                {insideCount}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {checkedOutCount > 0 ? `${checkedOutCount} exited` : 'Present inside'}
              </span>
            </div>
            <span className="text-[11px] text-[var(--color-text-muted)] mt-2">
              Real-time gate check-ins
            </span>
          </Card>

          <Card className="p-4 sm:p-5 flex flex-col justify-between">
            <span className="text-xs text-[var(--color-text-muted)] font-medium block mb-1">
              Payment Pending / Unpaid
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold font-display text-amber-400">
                {pendingPaymentCount}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                Awaiting student UTR
              </span>
            </div>
            <span className="text-[11px] text-[var(--color-text-muted)] mt-2">
              Reserved seats awaiting verification
            </span>
          </Card>
        </motion.div>

        {/* ── Search, Filter & Controls Panel ──────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 p-4 bg-[var(--color-surface-1)] rounded-2xl border border-[oklch(100%_0_0_/_0.08)] shadow-sm">
            {/* Row 1: Search & Status Tabs */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 text-xs no-scrollbar touch-pan-x">
                {([
                  { id: 'all', label: 'All Attendees', count: filterCounts.all },
                  { id: 'confirmed', label: 'Confirmed', count: filterCounts.confirmed },
                  { id: 'pending_approval', label: 'Under Review', count: filterCounts.pending_approval },
                  { id: 'pending_payment', label: 'Payment Due', count: filterCounts.pending_payment },
                  { id: 'cancelled', label: 'Cancelled', count: filterCounts.cancelled },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id as typeof statusFilter)}
                    className={`px-3 py-1.5 rounded-xl font-medium transition-all shrink-0 min-h-[36px] flex items-center gap-1.5 ${
                      statusFilter === tab.id
                        ? 'bg-[var(--color-brand-purple)] text-white shadow-sm font-semibold'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                        statusFilter === tab.id
                          ? 'bg-black/25 text-white'
                          : 'bg-[var(--color-surface-3)] text-[var(--color-text-muted)]'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Search Field */}
              <div className="relative w-full lg:w-80">
                <input
                  type="text"
                  placeholder="Search attendee, email, team, roll, or ticket…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-10 px-3.5 pl-9 pr-8 rounded-xl text-xs bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[oklch(100%_0_0_/_0.08)] focus:border-[var(--color-brand-purple)] outline-none"
                />
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Row 2: Secondary Multi-Filters & Sorters */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-[oklch(100%_0_0_/_0.06)] text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-[var(--color-text-muted)] flex items-center gap-1 mr-1">
                  <Filter size={12} /> Filters:
                </span>

                {/* Gate Attendance Filter */}
                <select
                  value={attendanceFilter}
                  onChange={(e) => setAttendanceFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[oklch(100%_0_0_/_0.08)] outline-none text-xs"
                >
                  <option value="all">Turnstile: All</option>
                  <option value="checked_in">Inside Venue (Checked In)</option>
                  <option value="checked_out">Exited (Checked Out)</option>
                  <option value="not_checked_in">Not Yet Arrived</option>
                </select>

                {/* Payment Status Filter */}
                {!event.is_free && (
                  <select
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value as any)}
                    className="px-2.5 py-1.5 rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[oklch(100%_0_0_/_0.08)] outline-none text-xs"
                  >
                    <option value="all">Payment: All</option>
                    <option value="paid">Paid & Verified</option>
                    <option value="pending_review">Pending UTR Verification</option>
                    <option value="unpaid">Unpaid / No Submission</option>
                  </select>
                )}

                {/* Participation Mode Filter */}
                {event.participation_type === 'team' && (
                  <select
                    value={participationFilter}
                    onChange={(e) => setParticipationFilter(e.target.value as any)}
                    className="px-2.5 py-1.5 rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[oklch(100%_0_0_/_0.08)] outline-none text-xs"
                  >
                    <option value="all">Participation: All</option>
                    <option value="team">Team Entries</option>
                    <option value="individual">Individual Passes</option>
                  </select>
                )}

                {/* Clear Filter Button */}
                {isFilterActive && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-xs text-[var(--color-brand-cyan)] hover:underline px-2 py-1"
                  >
                    Reset Filters
                  </button>
                )}
              </div>

              {/* Sorting & Page Size Controls */}
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-[11px] font-semibold text-[var(--color-text-muted)] flex items-center gap-1">
                  <ArrowUpDown size={12} /> Sort:
                </span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-2.5 py-1.5 rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[oklch(100%_0_0_/_0.08)] outline-none text-xs"
                >
                  <option value="newest">Registration: Newest</option>
                  <option value="oldest">Registration: Oldest</option>
                  <option value="name_asc">Name: A to Z</option>
                  <option value="name_desc">Name: Z to A</option>
                  <option value="ticket_code">Ticket Code</option>
                </select>

                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1.5 rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[oklch(100%_0_0_/_0.08)] outline-none text-xs"
                >
                  <option value={10}>10 / page</option>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Attendee List View ─────────────────────────────────────────── */}
          {totalItems === 0 ? (
            <EmptyState
              icon={Users}
              title={isFilterActive ? 'No Matching Attendees' : 'No Registrations Recorded'}
              description={
                isFilterActive
                  ? 'No registered attendees match your current search queries or multi-filter criteria.'
                  : 'No student registrations have been recorded yet for this event.'
              }
              action={
                isFilterActive ? (
                  <Button variant="outline" size="sm" onClick={clearAllFilters}>
                    Clear All Filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="flex flex-col gap-4">
              {/* Pagination Info Header */}
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] px-1">
                <span>
                  Showing <strong className="text-[var(--color-text-primary)]">{startIndex + 1}–{endIndex}</strong> of{' '}
                  <strong className="text-[var(--color-text-primary)]">{totalItems}</strong> attendees
                  {isFilterActive && ` (filtered from ${registrations.length} total)`}
                </span>
                <span>Page {currentPage} of {totalPages}</span>
              </div>

              {/* Mobile Card List View (< md) */}
              <div className="flex flex-col gap-3 md:hidden">
                {paginatedRegistrations.map((reg) => {
                  const isConfirmed = reg.status === 'confirmed'
                  const isPendingApproval = reg.status === 'pending_approval'
                  const isPendingPayment = reg.status === 'pending_payment'
                  const isRejected = reg.status === 'rejected'
                  const isInside = reg.attendance_status === 'checked_in'
                  const isCheckedOut = reg.attendance_status === 'checked_out'

                  return (
                    <Card key={reg.id} className="p-4 flex flex-col gap-3 border border-[oklch(100%_0_0_/_0.08)]">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-9 h-9 rounded-full bg-[var(--color-surface-3)] text-xs font-bold flex items-center justify-center text-[var(--color-brand-purple)] shrink-0">
                            {((reg.student?.display_name || reg.team_name || 'A').replace(/^Team\s+/i, '') || 'A').charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <span className="font-semibold text-sm text-[var(--color-text-primary)] block truncate">
                              {reg.student?.display_name || (reg.team_name ? `Team ${reg.team_name}` : 'Student Attendee')}
                            </span>
                            <span className="text-xs text-[var(--color-text-muted)] block truncate">
                              {reg.student?.email || 'No email registered'}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge
                            variant={
                              isConfirmed
                                ? 'success'
                                : isPendingApproval
                                ? 'purple'
                                : isPendingPayment
                                ? 'amber'
                                : 'danger'
                            }
                            className="capitalize text-[10px]"
                          >
                            {isConfirmed
                              ? 'Confirmed'
                              : isPendingApproval
                              ? 'Review Needed'
                              : isPendingPayment
                              ? 'Pending Payment'
                              : isRejected
                              ? 'Rejected'
                              : 'Cancelled'}
                          </Badge>

                          {/* Gate Attendance Indicator */}
                          {isInside ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Inside
                            </span>
                          ) : isCheckedOut ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-medium">
                              <LogOut size={10} /> Exited
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {reg.team_name && (
                        <div className="text-xs text-[var(--color-brand-purple)] flex items-center gap-1 font-medium bg-[var(--color-surface-2)] p-2 rounded-lg">
                          <Users size={12} className="shrink-0" />
                          <span className="truncate">Team: {reg.team_name}</span>
                          {Array.isArray((reg as any).team_members) && (reg as any).team_members.length > 0 && (
                            <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
                              ({(reg as any).team_members.length + 1} members)
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] pt-1">
                        <span className="flex items-center gap-1 font-mono text-[11px] text-[var(--color-brand-cyan)]">
                          <QrCode size={12} />
                          {reg.ticket_code}
                        </span>
                        <span>{formatExcelDateTime(reg.created_at)}</span>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-surface-3)]">
                        <Button
                          variant={isPendingApproval ? 'primary' : 'ghost'}
                          size="sm"
                          onClick={() => {
                            setSelectedAttendee(reg)
                            setReviewDecision('approved')
                            setRejectionReason('')
                          }}
                          className={`flex-1 justify-center text-xs min-h-[40px] ${
                            isPendingApproval
                              ? 'bg-[var(--color-brand-purple)] hover:bg-purple-600 text-white font-medium'
                              : ''
                          }`}
                        >
                          {isPendingApproval ? 'Review Application' : 'Attendee Details'}
                        </Button>

                        {reg.status !== 'cancelled' && reg.status !== 'rejected' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCancellingAttendee(reg)}
                            className="text-xs text-rose-400 hover:text-rose-300 border-rose-500/20 min-h-[40px]"
                          >
                            Cancel Pass
                          </Button>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block glass rounded-2xl border border-[oklch(100%_0_0_/_0.08)] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--color-surface-3)] bg-[var(--color-surface-2)]/60 text-[var(--color-text-muted)] uppercase tracking-wider text-[10px]">
                        <th className="py-3.5 px-4 font-semibold">Attendee / Team</th>
                        <th className="py-3.5 px-4 font-semibold">Email</th>
                        <th className="py-3.5 px-4 font-semibold">Ticket Code</th>
                        <th className="py-3.5 px-4 font-semibold">Gate Status</th>
                        <th className="py-3.5 px-4 font-semibold">Pass Status</th>
                        <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-surface-3)]">
                      {paginatedRegistrations.map((reg) => {
                        const isConfirmed = reg.status === 'confirmed'
                        const isPendingApproval = reg.status === 'pending_approval'
                        const isPendingPayment = reg.status === 'pending_payment'
                        const isRejected = reg.status === 'rejected'
                        const isInside = reg.attendance_status === 'checked_in'
                        const isCheckedOut = reg.attendance_status === 'checked_out'

                        return (
                          <tr
                            key={reg.id}
                            className="hover:bg-[var(--color-surface-2)]/40 transition-colors"
                          >
                            <td className="py-3.5 px-4 font-medium text-[var(--color-text-primary)]">
                              <div className="flex items-center gap-2.5">
                                <span className="w-7 h-7 rounded-full bg-[var(--color-surface-3)] text-[10px] font-bold flex items-center justify-center text-[var(--color-brand-purple)] shrink-0">
                                  {((reg.student?.display_name || reg.team_name || 'A').replace(/^Team\s+/i, '') || 'A').charAt(0).toUpperCase()}
                                </span>
                                <div>
                                  <span className="font-semibold block">
                                    {reg.student?.display_name || (reg.team_name ? `Team ${reg.team_name}` : 'Student Attendee')}
                                  </span>
                                  {reg.team_name && (
                                    <div className="text-[11px] text-[var(--color-brand-purple)] flex items-center gap-1 font-normal">
                                      <Users size={11} />
                                      <span>Team: {reg.team_name}</span>
                                      {Array.isArray((reg as any).team_members) && (reg as any).team_members.length > 0 && (
                                        <span className="text-[10px] text-[var(--color-text-muted)]">
                                          ({(reg as any).team_members.length + 1} total)
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-[var(--color-text-secondary)]">
                              {reg.student?.email || '—'}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-[var(--color-text-primary)]">
                              <span className="flex items-center gap-1 text-[11px]">
                                <QrCode size={13} className="text-[var(--color-brand-cyan)]" />
                                {reg.ticket_code}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              {isInside ? (
                                <Badge variant="success" className="text-[10px] inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                                  Admitted Inside
                                </Badge>
                              ) : isCheckedOut ? (
                                <Badge variant="amber" className="text-[10px] inline-flex items-center gap-1">
                                  <LogOut size={10} /> Checked Out
                                </Badge>
                              ) : (
                                <span className="text-[11px] text-[var(--color-text-muted)]">
                                  Not Arrived
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <Badge
                                variant={
                                  isConfirmed
                                    ? 'success'
                                    : isPendingApproval
                                    ? 'purple'
                                    : isPendingPayment
                                    ? 'amber'
                                    : 'danger'
                                }
                                className="capitalize text-[10px]"
                              >
                                {isConfirmed
                                  ? 'Confirmed'
                                  : isPendingApproval
                                  ? 'Review Needed'
                                  : isPendingPayment
                                  ? 'Pending Payment'
                                  : isRejected
                                  ? 'Rejected'
                                  : 'Cancelled'}
                              </Badge>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isPendingApproval ? (
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedAttendee(reg)
                                      setReviewDecision('approved')
                                      setRejectionReason('')
                                    }}
                                    className="bg-[var(--color-brand-purple)] hover:bg-purple-600 text-white font-medium text-[11px] py-1 px-2.5 h-auto"
                                  >
                                    Review
                                  </Button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedAttendee(reg)
                                      setReviewDecision('approved')
                                      setRejectionReason('')
                                    }}
                                    className="text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] px-2.5 py-1 rounded-lg hover:bg-[var(--color-surface-2)] transition-colors font-medium"
                                  >
                                    Details
                                  </button>
                                )}

                                {reg.status !== 'cancelled' && reg.status !== 'rejected' && (
                                  <button
                                    type="button"
                                    onClick={() => setCancellingAttendee(reg)}
                                    className="text-[11px] text-rose-400 hover:text-rose-300 font-medium px-2 py-1 transition-colors hover:bg-rose-500/10 rounded-lg"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Pagination Controls ─────────────────────────────────────── */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-[var(--color-surface-1)] rounded-xl border border-[oklch(100%_0_0_/_0.06)] text-xs">
                  <span className="text-[var(--color-text-muted)] text-[11px]">
                    Page {currentPage} of {totalPages} ({totalItems} records)
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      leftIcon={<ChevronLeft size={14} />}
                      className="text-xs h-8 px-2.5"
                    >
                      Previous
                    </Button>

                    <div className="flex items-center gap-1 px-1">
                      {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                        let pageNum = i + 1
                        if (totalPages > 5 && currentPage > 3) {
                          pageNum = currentPage - 3 + i
                          if (pageNum > totalPages) pageNum = totalPages - (4 - i)
                        }

                        return (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                              currentPage === pageNum
                                ? 'bg-[var(--color-brand-purple)] text-white font-bold'
                                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]'
                            }`}
                          >
                            {pageNum}
                          </button>
                        )
                      })}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      rightIcon={<ChevronRight size={14} />}
                      className="text-xs h-8 px-2.5"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Modal: Comprehensive Attendee Details & Review ─────────────────── */}
        <Modal
          isOpen={Boolean(selectedAttendee)}
          onClose={() => setSelectedAttendee(null)}
          title={selectedAttendee?.status === 'pending_approval' ? 'Review Registration Application' : 'Attendee & Registration Profile'}
          size="lg"
        >
          <ModalBody>
            {selectedAttendee && (
              <div className="flex flex-col gap-4 text-left max-h-[75vh] overflow-y-auto pr-1">
                {/* Header Sub-bar */}
                <div className="flex items-center justify-between pb-3 border-b border-[var(--color-surface-3)]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[var(--color-text-muted)]">
                      Ticket Ref: <strong className="text-[var(--color-brand-cyan)]">{selectedAttendee.ticket_code}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedAttendee.ticket_code) {
                          navigator.clipboard.writeText(selectedAttendee.ticket_code)
                          setCopiedToken(true)
                          setTimeout(() => setCopiedToken(false), 2000)
                        }
                      }}
                      className="text-[var(--color-text-muted)] hover:text-white transition-colors"
                      title="Copy Ticket Reference"
                    >
                      {copiedToken ? <CheckCheck size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        selectedAttendee.status === 'confirmed'
                          ? 'success'
                          : selectedAttendee.status === 'pending_approval'
                          ? 'purple'
                          : selectedAttendee.status === 'pending_payment'
                          ? 'amber'
                          : 'danger'
                      }
                      className="capitalize text-[10px]"
                    >
                      {selectedAttendee.status === 'pending_approval' ? 'Needs Review' : selectedAttendee.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>

                {/* Primary Attendee Identity Details */}
                <div className="p-4 rounded-2xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.06)] space-y-2.5 text-xs">
                  <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">
                    Applicant / Primary Attendee
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[var(--color-text-secondary)]">
                    <div>
                      <span className="text-[var(--color-text-muted)] block text-[11px]">Full Name:</span>
                      <strong className="text-[var(--color-text-primary)] font-semibold text-sm">
                        {selectedAttendee.student?.display_name || (selectedAttendee.team_name ? `Team ${selectedAttendee.team_name}` : 'Student Attendee')}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-muted)] block text-[11px]">Verified Email:</span>
                      <strong className="text-[var(--color-text-primary)] font-medium">
                        {selectedAttendee.student?.email || '—'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-muted)] block text-[11px]">Registration ID:</span>
                      <span className="font-mono text-[var(--color-text-muted)] text-[11px]">
                        {selectedAttendee.id}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-muted)] block text-[11px]">Registered At:</span>
                      <strong className="text-[var(--color-text-primary)] font-medium">
                        {formatExcelDateTime(selectedAttendee.created_at)}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Team Roster: Leader & Members Distinctly Displayed */}
                {selectedAttendee.team_name && (
                  <div className="p-4 rounded-2xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.06)] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-[var(--color-brand-purple)]" />
                        <h4 className="text-xs font-bold text-[var(--color-text-primary)]">
                          Team Roster: {selectedAttendee.team_name}
                        </h4>
                      </div>
                      <Badge variant="purple" className="text-[10px]">
                        {Array.isArray((selectedAttendee as any).team_members) ? (selectedAttendee as any).team_members.length + 1 : 1} Members
                      </Badge>
                    </div>

                    {/* Distinct Team Leader Card */}
                    <div className="p-3 rounded-xl bg-[var(--color-brand-purple)]/10 border border-[var(--color-brand-purple)]/30 text-xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--color-brand-purple)] text-white">
                          Team Leader
                        </span>
                        <span className="text-[11px] font-mono text-[var(--color-brand-cyan)] font-semibold">
                          {selectedAttendee.ticket_code}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[var(--color-text-secondary)]">
                        <div>
                          <span className="text-[10px] text-[var(--color-text-muted)]">Leader Name:</span>
                          <p className="font-semibold text-[var(--color-text-primary)]">
                            {selectedAttendee.student?.display_name || 'Leader'}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-[var(--color-text-muted)]">Email:</span>
                          <p className="font-medium text-[var(--color-text-primary)] truncate">
                            {selectedAttendee.student?.email || '—'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Distinct Squad Members List */}
                    {Array.isArray((selectedAttendee as any).team_members) && (selectedAttendee as any).team_members.length > 0 ? (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">
                          Squad Members ({(selectedAttendee as any).team_members.length})
                        </span>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {(selectedAttendee as any).team_members.map((member: any, mIdx: number) => (
                            <div
                              key={mIdx}
                              className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.06)] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                            >
                              <div>
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-3)] text-[var(--color-text-muted)] font-medium">
                                    Member #{mIdx + 1}
                                  </span>
                                  <strong className="text-[var(--color-text-primary)] font-semibold">
                                    {member.name}
                                  </strong>
                                </div>
                                <span className="text-[var(--color-text-secondary)] text-[11px] block">
                                  {member.email}
                                </span>
                                {member.phone && (
                                  <span className="text-[10px] text-[var(--color-text-muted)] block">
                                    Phone: {member.phone}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[var(--color-text-muted)] sm:text-right shrink-0">
                                {member.ticket_code && (
                                  <div className="font-mono text-[var(--color-brand-cyan)] font-semibold">
                                    {member.ticket_code}
                                  </div>
                                )}
                                {member.studentId && <div>Roll/ID: {member.studentId}</div>}
                                {member.college && <div className="truncate max-w-[150px]">{member.college}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-[var(--color-text-muted)] italic">
                        No additional team members listed.
                      </p>
                    )}
                  </div>
                )}

                {/* Gate Attendance & Turnstile Record */}
                <div className="p-4 rounded-2xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.06)] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">
                      Gate Attendance & Turnstile Record
                    </span>
                    <Badge
                      variant={
                        reviewingCheckIn?.status === 'checked_out'
                          ? 'amber'
                          : reviewingCheckIn
                          ? 'success'
                          : 'default'
                      }
                      className="text-[10px]"
                    >
                      {reviewingCheckIn?.status === 'checked_out'
                        ? 'Checked Out'
                        : reviewingCheckIn
                        ? 'Admitted Inside'
                        : 'Not Yet Arrived'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[var(--color-text-secondary)]">
                    <div>
                      <span className="text-[var(--color-text-muted)] block text-[11px]">First Gate Entry:</span>
                      <strong className="text-[var(--color-text-primary)] font-medium">
                        {reviewingCheckIn?.checked_in_at ? formatExcelDateTime(reviewingCheckIn.checked_in_at) : '—'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-muted)] block text-[11px]">Last Gate Exit:</span>
                      <strong className="text-[var(--color-text-primary)] font-medium">
                        {reviewingCheckIn?.checked_out_at ? formatExcelDateTime(reviewingCheckIn.checked_out_at) : '—'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-muted)] block text-[11px]">Total Admissions:</span>
                      <strong className="text-[var(--color-text-primary)] font-medium">
                        {reviewingCheckIn?.entry_count || (reviewingCheckIn ? 1 : 0)} entry scan(s)
                      </strong>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-muted)] block text-[11px]">Operator ID:</span>
                      <span className="text-[var(--color-text-primary)] font-mono text-[11px]">
                        {reviewingCheckIn?.staff_id || '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Custom Registration-Question Responses (Actual Labels & Values) */}
                {selectedAttendee.custom_responses && Object.keys(selectedAttendee.custom_responses).length > 0 && (
                  <div className="p-4 rounded-2xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.06)] space-y-3">
                    <h4 className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                      <span>Custom Registration Questionnaire</span>
                      <span className="text-[10px] text-[var(--color-text-muted)] font-normal">
                        ({Object.keys(selectedAttendee.custom_responses).length} responses)
                      </span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {Object.entries(selectedAttendee.custom_responses).map(([k, v]) => {
                        const questionLabel = getQuestionLabel(k)
                        let displayVal = '—'
                        if (v === true) displayVal = 'Yes'
                        else if (v === false) displayVal = 'No'
                        else if (Array.isArray(v)) displayVal = v.join(', ')
                        else if (v !== null && v !== undefined && String(v).trim() !== '') displayVal = String(v)

                        return (
                          <div key={k} className="p-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.04)]">
                            <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider block font-semibold truncate mb-0.5">
                              {questionLabel}
                            </span>
                            <span className="text-[var(--color-text-primary)] font-medium text-xs break-words">
                              {displayVal}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Payment Review Details (Authorized Organizers) */}
                {!event.is_free && isAuthorized && (
                  <div className="p-4 rounded-2xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.06)] space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">
                        Payment Review & Financial Audit
                      </span>
                      <Badge
                        variant={
                          reviewingPayment?.status === 'approved'
                            ? 'success'
                            : reviewingPayment?.status === 'pending_review'
                            ? 'amber'
                            : reviewingPayment?.status === 'rejected'
                            ? 'danger'
                            : 'default'
                        }
                        className="capitalize text-[10px]"
                      >
                        {reviewingPayment?.status ? reviewingPayment.status.replace('_', ' ') : 'Unpaid / Awaiting Proof'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[var(--color-text-secondary)]">
                      <div>
                        <span className="text-[var(--color-text-muted)] block text-[11px]">UTR / Transaction Ref:</span>
                        <strong className="text-[var(--color-text-primary)] font-mono text-[11px]">
                          {reviewingPayment?.transaction_reference || (reviewingPayment as any)?.utr_number || '—'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[var(--color-text-muted)] block text-[11px]">Amount Due / Paid:</span>
                        <strong className="text-amber-400 font-semibold">
                          ₹{reviewingPayment?.amount || event.price || 0}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[var(--color-text-muted)] block text-[11px]">Proof Submitted At:</span>
                        <span className="text-[var(--color-text-primary)] font-medium">
                          {reviewingPayment?.created_at ? formatExcelDateTime(reviewingPayment.created_at) : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--color-text-muted)] block text-[11px]">Organizer Reviewed At:</span>
                        <span className="text-[var(--color-text-primary)] font-medium">
                          {reviewingPayment?.reviewed_at ? formatExcelDateTime(reviewingPayment.reviewed_at) : '—'}
                        </span>
                      </div>
                      {reviewingPayment?.review_notes && (
                        <div className="sm:col-span-2 p-2 rounded-lg bg-[var(--color-surface-2)]">
                          <span className="text-[10px] text-[var(--color-text-muted)] block">Review Notes / Remarks:</span>
                          <span className="text-[var(--color-text-primary)]">{reviewingPayment.review_notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Rejection Note if already rejected */}
                {selectedAttendee.status === 'rejected' && (selectedAttendee as any).rejection_reason && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                    <strong className="block font-semibold mb-0.5">Application Rejection Reason:</strong>
                    {(selectedAttendee as any).rejection_reason}
                  </div>
                )}

                {/* Review Controls for pending_approval */}
                {selectedAttendee.status === 'pending_approval' && (
                  <div className="space-y-3 pt-3 border-t border-[var(--color-surface-3)]">
                    <div className="flex items-center gap-4 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="reviewDecision"
                          value="approved"
                          checked={reviewDecision === 'approved'}
                          onChange={() => setReviewDecision('approved')}
                          className="text-[var(--color-brand-purple)] focus:ring-[var(--color-brand-purple)]"
                        />
                        <span className="text-[var(--color-text-primary)] font-semibold">
                          Approve Application {event.is_free ? '(Issues Pass)' : '(Requests Payment)'}
                        </span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="reviewDecision"
                          value="rejected"
                          checked={reviewDecision === 'rejected'}
                          onChange={() => setReviewDecision('rejected')}
                          className="text-rose-500 focus:ring-rose-500"
                        />
                        <span className="text-rose-300 font-semibold">
                          Reject Application
                        </span>
                      </label>
                    </div>

                    {reviewDecision === 'rejected' && (
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold text-rose-300">
                          Rejection Reason (Shared with Student)
                        </label>
                        <textarea
                          rows={2}
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="e.g. Ineligible year of study, missing prerequisites, or team capacity not met…"
                          className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-rose-500/30 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-rose-400"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            {selectedAttendee?.status === 'pending_approval' ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isReviewing}
                  onClick={() => setSelectedAttendee(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant={reviewDecision === 'approved' ? 'primary' : 'danger'}
                  size="sm"
                  disabled={isReviewing}
                  isLoading={isReviewing}
                  onClick={handleReviewApplication}
                  leftIcon={reviewDecision === 'approved' ? <Check size={14} /> : <X size={14} />}
                >
                  {reviewDecision === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedAttendee(null)}
              >
                Close Details
              </Button>
            )}
          </ModalFooter>
        </Modal>

        {/* ── Modal: Excel Export Options ───────────────────────────────────── */}
        <Modal
          isOpen={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          title="Export Event Spreadsheets (.xlsx)"
          size="md"
        >
          <ModalBody>
            <div className="flex flex-col gap-3 text-left">
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Choose an official Excel workbook to download. All files are generated with frozen headers, automatic column widths, zebra striping, and formula injection protection.
              </p>

              <div className="grid grid-cols-1 gap-2.5 pt-1">
                {/* 1. Full Attendee List */}
                <div className="p-3.5 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.08)] flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <strong className="text-sm text-[var(--color-text-primary)] block font-semibold">
                      Full Attendee Directory
                    </strong>
                    <span className="text-xs text-[var(--color-text-muted)] block">
                      All registered students, contact info, custom question answers, and ticket codes ({registrations.length} records).
                    </span>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleExport('full')}
                    disabled={Boolean(exportingType) || registrations.length === 0}
                    isLoading={exportingType === 'full'}
                    leftIcon={<Download size={14} />}
                    className="shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    Download
                  </Button>
                </div>

                {/* 2. Gate Attendance Report */}
                <div className="p-3.5 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.08)] flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <strong className="text-sm text-[var(--color-text-primary)] block font-semibold">
                      Gate Attendance & Turnstile Log
                    </strong>
                    <span className="text-xs text-[var(--color-text-muted)] block">
                      Exact entry/exit timestamps, gate operator IDs, and turnstile statuses ({checkIns.length} scan records).
                    </span>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleExport('attendance')}
                    disabled={Boolean(exportingType) || registrations.length === 0}
                    isLoading={exportingType === 'attendance'}
                    leftIcon={<Download size={14} />}
                    className="shrink-0 bg-[var(--color-brand-cyan)] hover:bg-cyan-400 text-black font-semibold"
                  >
                    Download
                  </Button>
                </div>

                {/* 3. Squads & Team Rosters (If Team Event) */}
                {event.participation_type === 'team' && (
                  <div className="p-3.5 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.08)] flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <strong className="text-sm text-[var(--color-text-primary)] block font-semibold">
                        Squads & Team Membership Rosters
                      </strong>
                      <span className="text-xs text-[var(--color-text-muted)] block">
                        Team leaders and members displayed distinctly with squad roles and individual codes.
                      </span>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleExport('teams')}
                      disabled={Boolean(exportingType) || registrations.length === 0}
                      isLoading={exportingType === 'teams'}
                      leftIcon={<Download size={14} />}
                      className="shrink-0 bg-[var(--color-brand-purple)] hover:bg-purple-600 text-white font-medium"
                    >
                      Download
                    </Button>
                  </div>
                )}

                {/* 4. Payment Reconciliation (Authorized Organizers on Paid Events) */}
                {!event.is_free && isAuthorized && (
                  <div className="p-3.5 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.08)] flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <strong className="text-sm text-[var(--color-text-primary)] block font-semibold">
                        Payment Reconciliation & UTR Audit
                      </strong>
                      <span className="text-xs text-[var(--color-text-muted)] block">
                        12-digit UPI UTR references, approval history, reviewer notes, and amounts ({payments.length} transactions).
                      </span>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleExport('payments')}
                      disabled={Boolean(exportingType) || payments.length === 0}
                      isLoading={exportingType === 'payments'}
                      leftIcon={<Download size={14} />}
                      className="shrink-0 bg-amber-500 hover:bg-amber-400 text-black font-semibold"
                    >
                      Download
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportModalOpen(false)}
            >
              Close
            </Button>
          </ModalFooter>
        </Modal>

        {/* ── Modal: Cancellation Confirmation ────────────────────────────── */}
        <Modal
          isOpen={Boolean(cancellingAttendee)}
          onClose={() => setCancellingAttendee(null)}
          title="Cancel Attendee Pass"
          size="sm"
        >
          <ModalBody>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 text-rose-400">
                <div className="p-2.5 rounded-xl bg-rose-500/15">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[var(--color-text-primary)]">
                    Revoke Entry Pass
                  </h4>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    This invalidates the student's QR gate credential.
                  </p>
                </div>
              </div>

              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mt-1">
                Are you sure you want to cancel the registration for{' '}
                <strong className="text-[var(--color-text-primary)]">
                  {cancellingAttendee?.student?.display_name ||
                    (cancellingAttendee?.team_name ? `Team ${cancellingAttendee?.team_name}` : 'Attendee')}
                </strong>{' '}
                (Ticket Code: <code className="text-white font-mono">{cancellingAttendee?.ticket_code}</code>)?
                Their seat will be released and their QR token will be rejected at the gate desk.
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              size="sm"
              disabled={actionLoading}
              onClick={() => setCancellingAttendee(null)}
            >
              Keep Registration
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={actionLoading}
              isLoading={actionLoading}
              onClick={handleOrganizerCancel}
            >
              Confirm Cancellation
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    </PageShell>
  )
}
