import { useState, useEffect, useMemo, useDeferredValue } from 'react'
import { useParams, Link } from 'react-router'
import { motion } from 'motion/react'
import {
  Users,
  Search,
  AlertTriangle,
  Ticket,
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
  Copy,
  CheckCheck,
  Upload,
  Tag,
  Star,
  UserCheck,
  Lock,
} from 'lucide-react'
import { Button, Badge, Card, Breadcrumbs, Modal, ModalBody, ModalFooter, EmptyState, Alert } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import {
  getEventById,
  getEventLifecyclePhase,
  isEventConcludedOrCancelled,
  LIFECYCLE_BADGE_META,
  formatEventDate,
  formatEventTime,
  resolveEventTimezone,
} from '@/lib/events'
import {
  cancelRegistration,
  reviewRegistrationApplication,
  registerForEvent,
} from '@/lib/registrations'
import { getEventRegistrationsWithCheckIn } from '@/lib/checkin'
import { getClubPaymentSubmissions } from '@/lib/payments'
import { promoteWaitlistStudent, autoPromoteWaitlist, offerWaitlistSlot } from '@/lib/waitlist'
import { getEventCancellationRequests } from '@/lib/cancellations'
import { getEventEditRequests } from '@/lib/editRequests'
import { ReviewCancellationModal } from '@/components/club/ReviewCancellationModal'
import { ReviewEditModal } from '@/components/club/ReviewEditModal'
import { ClubCouponsModal } from '@/components/club/ClubCouponsModal'
import { EventTeamDelegationModal } from '@/components/club/EventTeamDelegationModal'
import { EventFeedbackDashboardModal } from '@/components/club/EventFeedbackDashboardModal'
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
  RegistrationCancellationRequestRecord,
  RegistrationEditRequestRecord,
} from '@/types'

export default function EventRegistrationsPage() {
  const { id } = useParams<{ id: string }>()
  const {
    user,
    role,
    activeClubId,
    activeClubRole,
    eventAssignments,
    hasEventPermission,
    isRoleLoading,
  } = useAuth()

  const [event, setEvent] = useState<EventRecord | null>(null)
  const [registrations, setRegistrations] = useState<RegistrationWithCheckIn[]>([])
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([])
  const [payments, setPayments] = useState<PaymentSubmissionWithDetails[]>([])
  const [cancellationRequests, setCancellationRequests] = useState<RegistrationCancellationRequestRecord[]>([])
  const [editRequests, setEditRequests] = useState<RegistrationEditRequestRecord[]>([])
  const [selectedCancellationReq, setSelectedCancellationReq] = useState<RegistrationCancellationRequestRecord | null>(null)
  const [selectedCancellationAttendee, setSelectedCancellationAttendee] = useState<RegistrationWithCheckIn | null>(null)
  const [selectedEditReq, setSelectedEditReq] = useState<RegistrationEditRequestRecord | null>(null)
  const [selectedEditAttendee, setSelectedEditAttendee] = useState<RegistrationWithCheckIn | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  const isPlatformAdmin = role === 'platform_admin'
  const canViewRegistrations = event
    ? isPlatformAdmin || hasEventPermission(event.id, 'registrations.view', event.club_id)
    : Boolean(isAuthorized)
  const canManageRegistrations = event
    ? isPlatformAdmin || hasEventPermission(event.id, 'registrations.manage', event.club_id)
    : false
  const canExportReports = event
    ? isPlatformAdmin || hasEventPermission(event.id, 'reports.export', event.club_id)
    : false
  const canViewReports = event
    ? isPlatformAdmin || hasEventPermission(event.id, 'reports.view', event.club_id)
    : false
  const canViewPayments = event
    ? isPlatformAdmin || hasEventPermission(event.id, 'payments.view', event.club_id)
    : false
  const canManageCoupons = event
    ? isPlatformAdmin ||
      hasEventPermission(event.id, 'club.manage', event.club_id) ||
      hasEventPermission(event.id, 'events.edit', event.club_id)
    : false
  const canAssignRoles = event
    ? isPlatformAdmin || hasEventPermission(event.id, 'roles.assign', event.club_id)
    : false
  const canViewFeedback = event
    ? canViewReports || hasEventPermission(event.id, 'events.edit', event.club_id)
    : false

  // Search & Multi-Filters (using React 19 useDeferredValue for 0ms typing latency)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [statusFilter, setStatusFilter] = useState<'all' | RegistrationStatus | 'edit_requests'>('all')
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'pending_review' | 'unpaid'>('all')
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

  // Multi-Select Bulk Actions State
  const [selectedRegIds, setSelectedRegIds] = useState<string[]>([])

  // CSV Import State
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [csvRawText, setCsvRawText] = useState('')
  const [csvPreviewRows, setCsvPreviewRows] = useState<
    Array<{
      name: string
      email: string
      phone?: string
      college?: string
      isValid: boolean
      error?: string
    }>
  >([])
  const [isImporting, setIsImporting] = useState(false)

  // Shortcuts Modals State
  const [couponsModalOpen, setCouponsModalOpen] = useState(false)
  const [teamModalOpen, setTeamModalOpen] = useState(false)
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)

  const loadData = async (silent = false) => {
    if (!id || isRoleLoading) return
    if (!silent) setLoading(true)

    const eventRes = await getEventById(id)
    if (!eventRes.event) {
      setIsAuthorized(false)
      setEvent(null)
      if (!silent) setLoading(false)
      return
    }

    const authorized =
      role === 'platform_admin' ||
      hasEventPermission(eventRes.event.id, 'registrations.view', eventRes.event.club_id)

    setIsAuthorized(authorized)
    if (!authorized) {
      setEvent(null)
      setRegistrations([])
      setCheckIns([])
      setPayments([])
      setCancellationRequests([])
      setEditRequests([])
      if (!silent) setLoading(false)
      return
    }

    const canFetchPayments =
      role === 'platform_admin' ||
      hasEventPermission(eventRes.event.id, 'payments.view', eventRes.event.club_id)

    const [checkInRes, payRes, cancelRes, editRes] = await Promise.all([
      getEventRegistrationsWithCheckIn(id),
      canFetchPayments
        ? getClubPaymentSubmissions(eventRes.event.club_id || activeClubId || undefined, id)
        : Promise.resolve({ submissions: [], error: null }),
      getEventCancellationRequests(id),
      getEventEditRequests(id),
    ])
    if (!silent) setLoading(false)

    setEvent(eventRes.event)
    if (checkInRes.registrations) setRegistrations(checkInRes.registrations)
    if (checkInRes.checkIns) setCheckIns(checkInRes.checkIns)
    setPayments(canFetchPayments && payRes.submissions ? payRes.submissions : [])
    if (cancelRes.requests) setCancellationRequests(cancelRes.requests)
    if (editRes.requests) setEditRequests(editRes.requests)
  }

  useEffect(() => {
    if (!isRoleLoading) {
      loadData()
    }

    const unsubscribe = subscribeToStatusChanges(
      ['registration_updated', 'team_updated', 'payment_reviewed'],
      (e) => {
        if (!isRoleLoading && (!e.eventId || e.eventId === id)) {
          loadData(true)
        }
      }
    )
    return () => unsubscribe()
  }, [id, role, isRoleLoading, activeClubId, activeClubRole, eventAssignments])

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
  const waitlistCount = registrations.filter((r) => r.status === 'waitlisted').length

  const cancellationPendingCount = registrations.filter(
    (r) => r.cancellation_request_status === 'pending' || r.status === 'cancellation_requested'
  ).length
  const editPendingCount = editRequests.filter((e) => e.status === 'pending').length

  const filterCounts = useMemo(() => {
    return {
      all: registrations.length,
      confirmed: confirmedCount,
      pending_approval: pendingApprovalCount,
      pending_payment: pendingPaymentCount,
      cancellation_requested: cancellationPendingCount,
      edit_requests: editPendingCount,
      cancelled: cancelledCount,
      waitlisted: waitlistCount,
    }
  }, [
    registrations,
    confirmedCount,
    pendingApprovalCount,
    pendingPaymentCount,
    cancellationPendingCount,
    editPendingCount,
    cancelledCount,
    waitlistCount,
  ])

  // Reset pagination to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter, paymentFilter, participationFilter, sortBy, pageSize])

  // Filtering Logic
  const filteredRegistrations = useMemo(() => {
    return registrations.filter((r) => {
      // 1. Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'cancelled') {
          if (r.status !== 'cancelled' && r.status !== 'rejected') return false
        } else if (statusFilter === 'cancellation_requested') {
          if (r.cancellation_request_status !== 'pending' && r.status !== 'cancellation_requested') return false
        } else if (statusFilter === 'edit_requests') {
          if (!editRequests.some((e) => e.registration_id === r.id && e.status === 'pending')) return false
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

      // 3. Participation Mode Filter
      if (participationFilter !== 'all') {
        const hasTeam = Boolean(r.team_name || (r as any).team_id)
        if (participationFilter === 'team' && !hasTeam) return false
        if (participationFilter === 'individual' && hasTeam) return false
      }

      // 4. Text Search (Name, email, team, registration ID, ticket code, squad member names)
      const q = deferredSearch.trim().toLowerCase()
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
  }, [registrations, deferredSearch, statusFilter, paymentFilter, participationFilter, paymentMap, event, editRequests])

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
    participationFilter !== 'all'

  const clearAllFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setPaymentFilter('all')
    setParticipationFilter('all')
    setSortBy('newest')
  }

  const ensureMutableArchive = (): boolean => {
    if (!canManageRegistrations) {
      setNotice({
        message: 'Your role has read-only access to the roster. Modifying registrations is restricted.',
        isError: true,
      })
      return false
    }
    if (event && isEventConcludedOrCancelled(event) && !isPlatformAdmin) {
      setNotice({
        message: 'Registrations are read-only once an event has concluded or been cancelled.',
        isError: true,
      })
      return false
    }
    return true
  }

  // Application Review Handler
  const handleReviewApplication = async () => {
    if (!selectedAttendee) return
    if (!ensureMutableArchive()) {
      setSelectedAttendee(null)
      return
    }
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
    if (!ensureMutableArchive()) {
      setCancellingAttendee(null)
      return
    }
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

  // Waitlist Slot Offer Handler
  const handleOfferSlot = async (regId: string) => {
    if (!ensureMutableArchive()) return
    setActionLoading(true)
    const res = await offerWaitlistSlot({ registrationId: regId, expiresHours: 24 })
    setActionLoading(false)
    if (res.success) {
      setNotice({ message: res.message, isError: false })
      loadData(true)
    } else {
      setNotice({ message: res.message, isError: true })
    }
  }

  // Excel Export Triggers
  const handleExport = async (type: 'full' | 'attendance' | 'teams' | 'payments') => {
    if (!event || !canExportReports) {
      setNotice({ message: 'You do not have permission to export event reports.', isError: true })
      return
    }
    if (type === 'payments' && !canViewPayments) {
      setNotice({ message: 'You do not have permission to export payment reconciliation data.', isError: true })
      return
    }
    try {
      setExportingType(type)
      if (type === 'full') {
        await exportFullAttendeesXlsx({
          event,
          registrations,
          checkIns,
          payments: canViewPayments ? payments : [],
          isAuthorized: Boolean(isAuthorized && canExportReports && canViewPayments),
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
          isAuthorized: Boolean(isAuthorized && canExportReports && canViewPayments),
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

  // ── Multi-Select Checkbox Handlers ──────────────────────────────────────────
  const toggleSelectAllPage = () => {
    const pageIds = paginatedRegistrations.map((r) => r.id)
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedRegIds.includes(id))
    if (allSelected) {
      setSelectedRegIds((prev) => prev.filter((id) => !pageIds.includes(id)))
    } else {
      setSelectedRegIds((prev) => Array.from(new Set([...prev, ...pageIds])))
    }
  }

  const toggleSelectRow = (regId: string) => {
    setSelectedRegIds((prev) =>
      prev.includes(regId) ? prev.filter((id) => id !== regId) : [...prev, regId]
    )
  }

  // ── Bulk Actions ────────────────────────────────────────────────────────────
  const handleBulkApprove = async () => {
    if (selectedRegIds.length === 0 || !ensureMutableArchive()) return
    setActionLoading(true)
    let approvedCount = 0
    for (const regId of selectedRegIds) {
      const res = await reviewRegistrationApplication(regId, 'approved')
      if (res.success) approvedCount++
    }
    setActionLoading(false)
    setSelectedRegIds([])
    setNotice({ message: `Approved ${approvedCount} attendee applications and issued official entry passes.` })
    loadData(true)
  }

  const handleBulkCancel = async () => {
    if (selectedRegIds.length === 0 || !ensureMutableArchive()) return
    if (!window.confirm(`Are you sure you want to cancel and void passes for ${selectedRegIds.length} selected attendees?`)) return
    setActionLoading(true)
    let cancelledCount = 0
    for (const regId of selectedRegIds) {
      const res = await cancelRegistration(regId)
      if (res.success) cancelledCount++
    }
    setActionLoading(false)
    setSelectedRegIds([])
    setNotice({ message: `Cancelled and voided ${cancelledCount} registration passes.` })
    loadData(true)
  }

  const handleBulkExport = async () => {
    if (!event || selectedRegIds.length === 0 || !canExportReports) {
      if (!canExportReports) {
        setNotice({ message: 'You do not have permission to export attendee records.', isError: true })
      }
      return
    }
    const selectedRegistrations = registrations.filter((r) => selectedRegIds.includes(r.id))
    try {
      await exportFullAttendeesXlsx({
        event,
        registrations: selectedRegistrations,
        checkIns,
        payments: canViewPayments ? payments : [],
        isAuthorized: Boolean(isAuthorized && canExportReports && canViewPayments),
      })
      setNotice({ message: `Exported ${selectedRegistrations.length} selected attendee records to Excel.` })
    } catch (e: any) {
      setNotice({ message: e.message || 'Export failed.', isError: true })
    }
  }

  // ── CSV Import Handlers ─────────────────────────────────────────────────────
  const handleCsvFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result as string
      if (text) handleParseCsv(text)
    }
    reader.readAsText(file)
  }

  const handleParseCsv = (text: string) => {
    setCsvRawText(text)
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length < 2) {
      setCsvPreviewRows([])
      return
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/["']/g, ''))
    const nameIdx = headers.findIndex((h) => h.includes('name'))
    const emailIdx = headers.findIndex((h) => h.includes('email') || h.includes('mail'))
    const phoneIdx = headers.findIndex((h) => h.includes('phone') || h.includes('mobile') || h.includes('contact'))
    const collegeIdx = headers.findIndex((h) => h.includes('college') || h.includes('institute') || h.includes('dept'))

    const existingEmails = new Set(registrations.map((r) => r.student?.email?.toLowerCase().trim()).filter(Boolean))
    const seenCsvEmails = new Set<string>()

    const rows: typeof csvPreviewRows = []
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''))
      const name = nameIdx >= 0 ? parts[nameIdx] || '' : parts[0] || ''
      const email = emailIdx >= 0 ? parts[emailIdx]?.toLowerCase() || '' : parts[1]?.toLowerCase() || ''
      const phone = phoneIdx >= 0 ? parts[phoneIdx] : undefined
      const college = collegeIdx >= 0 ? parts[collegeIdx] : undefined

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!email || !emailRegex.test(email)) {
        rows.push({ name, email, phone, college, isValid: false, error: 'Invalid email syntax' })
      } else if (existingEmails.has(email)) {
        rows.push({ name, email, phone, college, isValid: false, error: 'Already registered for event' })
      } else if (seenCsvEmails.has(email)) {
        rows.push({ name, email, phone, college, isValid: false, error: 'Duplicate in CSV file' })
      } else {
        seenCsvEmails.add(email)
        rows.push({ name: name || 'Student Attendee', email, phone, college, isValid: true })
      }
    }
    setCsvPreviewRows(rows)
  }

  const handleExecuteCsvImport = async () => {
    if (!event || !ensureMutableArchive()) return
    const validRows = csvPreviewRows.filter((r) => r.isValid)
    if (validRows.length === 0) {
      setNotice({ message: 'No valid rows to import.', isError: true })
      return
    }

    setIsImporting(true)
    let imported = 0

    for (const row of validRows) {
      try {
        await registerForEvent(event.id, `sim_imported_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, {
          participantDetails: {
            fullName: row.name,
            email: row.email,
            phone: row.phone || '',
            college: row.college || '',
          },
        })
        imported++
      } catch {
        // continue
      }
    }

    setIsImporting(false)
    setImportModalOpen(false)
    setCsvPreviewRows([])
    setCsvRawText('')
    setNotice({ message: `Successfully imported ${imported} validated attendees into event roster!` })
    loadData(true)
  }

  // ── Waitlist Promotion Handlers ─────────────────────────────────────────────
  const handlePromoteWaitlisted = async (regId: string) => {
    if (!event || !ensureMutableArchive()) return
    setActionLoading(true)
    const res = await promoteWaitlistStudent(regId, event.is_free, 24)
    setActionLoading(false)
    if (res.success) {
      setNotice({ message: 'Waitlisted attendee successfully promoted to official entry pass!' })
      loadData(true)
    } else {
      setNotice({ message: res.error || 'Failed to promote waitlist attendee.', isError: true })
    }
  }

  const handleAutoPromoteAllWaitlisted = async () => {
    if (!event || !ensureMutableArchive()) return
    const availableSlots = Math.max(0, event.capacity - confirmedCount)
    if (availableSlots <= 0) {
      setNotice({
        message: 'Event is currently at maximum capacity. Increase capacity to promote waitlisted attendees.',
        isError: true,
      })
      return
    }
    setActionLoading(true)
    const res = await autoPromoteWaitlist(event.id, availableSlots, event.is_free)
    setActionLoading(false)
    setNotice({ message: `Auto-promoted ${res.promotedCount} waitlisted students into available seats!` })
    loadData(true)
  }

  if (loading || isRoleLoading) {
    return (
      <PageShell>
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--color-surface-3)] border-t-[var(--color-brand-purple)] animate-spin mb-3" />
          <span className="text-xs text-[var(--color-text-muted)]">
            Loading attendee directory…
          </span>
        </div>
      </PageShell>
    )
  }

  if (isAuthorized === false || !canViewRegistrations || !event) {
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
  const reviewingPayment = canViewPayments && selectedAttendee ? paymentMap.get(selectedAttendee.id) : null
  const lifecyclePhase = getEventLifecyclePhase(event)
  const isReadOnlyArchive = isEventConcludedOrCancelled(event) && !isPlatformAdmin
  const isRosterReadOnly = isReadOnlyArchive || !canManageRegistrations
  const lifecycleMeta = LIFECYCLE_BADGE_META[lifecyclePhase]
  const eventTz = resolveEventTimezone(event.timezone)
  const formattedEventSchedule = event.start_date
    ? `${formatEventDate(event.start_date, eventTz, { day: 'numeric', month: 'short', year: 'numeric' })} at ${formatEventTime(event.start_date, eventTz, { hour: 'numeric', minute: '2-digit', hour12: true })}`
    : 'Date TBA'

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
            style={{ background: 'radial-gradient(ellipse at 15% 40%, rgba(24, 207, 252, 0.12) 0%, transparent 65%)' }}
          />
          <div className="min-w-0 relative">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-300">
                {event.category}
              </span>
              <Badge
                variant={lifecycleMeta.variant}
                className="text-[10px]"
              >
                {lifecycleMeta.label}
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
              <span>{formattedEventSchedule}</span>
              <span className="text-zinc-600">•</span>
              <span className="font-semibold text-white font-mono">
                {event.is_free ? 'Free Admission' : `₹${event.price} Pass`}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-2 flex-wrap pt-2 md:pt-0 border-t md:border-t-0 border-white/[0.08] relative">
            {/* CSV Attendee Import Button (locked for concluded/cancelled events or read-only roles) */}
            {!isRosterReadOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportModalOpen(true)}
                leftIcon={<Upload size={14} className="text-[#18CFFC]" />}
                className="border-[#18CFFC]/30 hover:border-[#18CFFC] hover:bg-[#18CFFC]/10 text-white font-semibold shadow-sm"
              >
                Import CSV
              </Button>
            )}

            {/* Excel Export Button */}
            {canExportReports && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExportModalOpen(true)}
                leftIcon={<Download size={14} className="text-emerald-400" />}
                className="border-emerald-500/30 hover:border-emerald-500 hover:bg-emerald-500/10 text-emerald-300 font-semibold shadow-sm"
              >
                Export Excel
              </Button>
            )}

            {/* Coupons Button */}
            {canManageCoupons && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCouponsModalOpen(true)}
                leftIcon={<Tag size={13} className="text-amber-400" />}
              >
                Coupons
              </Button>
            )}

            {/* Team Roles Button */}
            {canAssignRoles && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTeamModalOpen(true)}
                leftIcon={<Users size={13} className="text-purple-400" />}
              >
                Staff Roles
              </Button>
            )}

            {/* Feedback Button */}
            {canViewFeedback && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFeedbackModalOpen(true)}
                leftIcon={<Star size={13} className="text-amber-400" />}
              >
                Feedback
              </Button>
            )}

            {/* Auto-Promote Waitlist if available slots and waitlist count > 0 */}
            {filterCounts.waitlisted > 0 && !isRosterReadOnly && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleAutoPromoteAllWaitlisted}
                disabled={actionLoading}
                leftIcon={<UserCheck size={13} />}
                className="bg-gradient-to-r from-[#18CFFC] to-[#0D56FB]"
              >
                Promote Waitlist ({filterCounts.waitlisted})
              </Button>
            )}

            {!event.is_free && canViewPayments && (
              <Link to={`/club/payments?eventId=${event.id}`}>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<CreditCard size={13} />}
                  className="bg-gradient-to-r from-[var(--color-brand-cyan)] to-[var(--color-brand-violet)] text-white hover:opacity-95 border-none font-semibold shadow-sm"
                >
                  Payments
                </Button>
              </Link>
            )}

            {canViewReports && (
              <Link to={`/club/events/${event.id}/reports`}>
                <Button variant="outline" size="sm" leftIcon={<FileSpreadsheet size={13} />}>
                  Reports
                </Button>
              </Link>
            )}
          </div>
        </motion.div>

        {isReadOnlyArchive ? (
          <Alert variant="warning">
            <span className="flex items-center gap-2 text-xs">
              <Lock size={14} className="shrink-0" />
              <span>
                This event has {lifecyclePhase === 'cancelled' ? 'been cancelled' : 'concluded'}. Attendee lists, payment history, and exports remain available in read-only archive mode; registration mutations are locked.
              </span>
            </span>
          </Alert>
        ) : !canManageRegistrations ? (
          <Alert variant="info">
            <span className="flex items-center gap-2 text-xs">
              <Lock size={14} className="shrink-0" />
              <span>
                View-only roster access is active for your role. Approving applications, promoting waitlist entries, and cancelling passes require registration management permission.
              </span>
            </span>
          </Alert>
        ) : null}

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
              <span className="text-2xl sm:text-3xl font-bold font-display text-[#C084FC]">
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
              Waitlist & Cancelled
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold font-display text-[var(--color-brand-cyan)]">
                {waitlistCount}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {cancelledCount} cancelled / rejected
              </span>
            </div>
            <span className="text-[11px] text-[var(--color-text-muted)] mt-2">
              Queue & revoked entries
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
                  ...(filterCounts.cancellation_requested > 0
                    ? [{ id: 'cancellation_requested', label: 'Cancellation Requests', count: filterCounts.cancellation_requested }]
                    : []),
                  ...(filterCounts.edit_requests > 0
                    ? [{ id: 'edit_requests', label: 'Edit Requests', count: filterCounts.edit_requests }]
                    : []),
                  ...(filterCounts.waitlisted > 0
                    ? [{ id: 'waitlisted', label: 'Waitlist', count: filterCounts.waitlisted }]
                    : []),
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
                          <Ticket size={12} />
                          {reg.ticket_code}
                        </span>
                        <span>{formatExcelDateTime(reg.created_at)}</span>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-surface-3)] flex-wrap">
                        {reg.cancellation_request_status === 'pending' && !isRosterReadOnly ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              const match = cancellationRequests.find((cr) => cr.registration_id === reg.id && cr.status === 'pending')
                              setSelectedCancellationAttendee(reg)
                              setSelectedCancellationReq(match || {
                                id: `cr_${reg.id}`,
                                registration_id: reg.id,
                                event_id: reg.event_id,
                                student_id: reg.student_id,
                                reason: 'Attendee requested cancellation',
                                explanation: null,
                                status: 'pending',
                                refund_applicable: !event?.is_free,
                                refund_status: !event?.is_free ? 'refund_requested' : 'not_applicable',
                                refund_amount: Number(event?.price || 0),
                                refund_notes: null,
                                refund_transaction_ref: null,
                                reviewed_by: null,
                                reviewed_at: null,
                                decision_notes: null,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                              })
                            }}
                            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs min-h-[40px] flex-1"
                          >
                            Review Cancellation
                          </Button>
                        ) : isPendingApproval && !isRosterReadOnly ? (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setSelectedAttendee(reg)
                              setReviewDecision('approved')
                              setRejectionReason('')
                            }}
                            className="bg-[#7F1AFB] hover:bg-[#6814D0] text-white font-medium flex-1 justify-center text-xs min-h-[40px]"
                          >
                            Review Application
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedAttendee(reg)
                              setReviewDecision('approved')
                              setRejectionReason('')
                            }}
                            className="flex-1 justify-center text-xs min-h-[40px]"
                          >
                            Attendee Details
                          </Button>
                        )}

                        {editRequests.some((e) => e.registration_id === reg.id && e.status === 'pending') && !isRosterReadOnly && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const match = editRequests.find((e) => e.registration_id === reg.id && e.status === 'pending')
                              setSelectedEditAttendee(reg)
                              setSelectedEditReq(match || null)
                            }}
                            className="text-[#18CFFC] border-[#18CFFC]/40 text-xs min-h-[40px]"
                          >
                            Review Edit
                          </Button>
                        )}

                        {reg.status === 'waitlisted' && !isRosterReadOnly && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOfferSlot(reg.id)}
                            disabled={actionLoading}
                            className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 text-xs min-h-[40px]"
                          >
                            Offer Slot (24h)
                          </Button>
                        )}

                        {reg.status !== 'cancelled' && reg.status !== 'rejected' && reg.cancellation_request_status !== 'pending' && !isRosterReadOnly && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedCancellationAttendee(reg)
                              setSelectedCancellationReq({
                                id: `admin_cancel_${reg.id}`,
                                registration_id: reg.id,
                                event_id: reg.event_id,
                                student_id: reg.student_id,
                                reason: 'Organizer initiated pass revocation',
                                explanation: null,
                                status: 'pending',
                                refund_applicable: !event?.is_free,
                                refund_status: !event?.is_free ? 'refund_approved' : 'not_applicable',
                                refund_amount: Number(event?.price || 0),
                                refund_notes: null,
                                refund_transaction_ref: null,
                                reviewed_by: null,
                                reviewed_at: null,
                                decision_notes: null,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                              })
                            }}
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
                        <th className="py-3.5 px-3 w-8">
                          <input
                            type="checkbox"
                            aria-label="Select all on this page"
                            checked={
                              paginatedRegistrations.length > 0 &&
                              paginatedRegistrations.every((r) => selectedRegIds.includes(r.id))
                            }
                            onChange={toggleSelectAllPage}
                            className="rounded bg-white/10 border-white/20 text-[#18CFFC] focus:ring-[#18CFFC] cursor-pointer"
                          />
                        </th>
                        <th className="py-3.5 px-4 font-semibold">Attendee / Team</th>
                        <th className="py-3.5 px-4 font-semibold">Email</th>
                        <th className="py-3.5 px-4 font-semibold">Ticket Code</th>
                        <th className="py-3.5 px-4 font-semibold">Pass Status</th>
                        <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-surface-3)]">
                      {paginatedRegistrations.map((reg) => {
                        const isConfirmed = reg.status === 'confirmed'
                        const isPendingApproval = reg.status === 'pending_approval'
                        const isPendingPayment = reg.status === 'pending_payment'
                        const isWaitlisted = reg.status === 'waitlisted'
                        const isRejected = reg.status === 'rejected'

                        return (
                          <tr
                            key={reg.id}
                            className={`hover:bg-[var(--color-surface-2)]/40 transition-colors ${
                              selectedRegIds.includes(reg.id) ? 'bg-[#18CFFC]/5' : ''
                            }`}
                          >
                            <td className="py-3.5 px-3 w-8">
                              <input
                                type="checkbox"
                                aria-label={`Select ${reg.student?.display_name || 'attendee'}`}
                                checked={selectedRegIds.includes(reg.id)}
                                onChange={() => toggleSelectRow(reg.id)}
                                className="rounded bg-white/10 border-white/20 text-[#18CFFC] focus:ring-[#18CFFC] cursor-pointer"
                              />
                            </td>
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
                                <Ticket size={13} className="text-[var(--color-brand-cyan)]" />
                                {reg.ticket_code}
                              </span>
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
                                    : isWaitlisted
                                    ? 'cyan'
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
                                  : isWaitlisted
                                  ? 'Waitlisted'
                                  : isRejected
                                  ? 'Rejected'
                                  : 'Cancelled'}
                              </Badge>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isWaitlisted && !isRosterReadOnly && (
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handlePromoteWaitlisted(reg.id)}
                                    disabled={actionLoading}
                                    className="bg-[#18CFFC] hover:bg-[#07A4FC] text-black font-semibold text-[11px] py-1 px-2.5 h-auto"
                                  >
                                    Promote
                                  </Button>
                                )}

                                 {reg.cancellation_request_status === 'pending' && !isRosterReadOnly ? (
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => {
                                      const match = cancellationRequests.find((cr) => cr.registration_id === reg.id && cr.status === 'pending')
                                      setSelectedCancellationAttendee(reg)
                                      setSelectedCancellationReq(match || {
                                        id: `cr_${reg.id}`,
                                        registration_id: reg.id,
                                        event_id: reg.event_id,
                                        student_id: reg.student_id,
                                        reason: 'Attendee requested cancellation',
                                        explanation: null,
                                        status: 'pending',
                                        refund_applicable: !event?.is_free,
                                        refund_status: !event?.is_free ? 'refund_requested' : 'not_applicable',
                                        refund_amount: Number(event?.price || 0),
                                        refund_notes: null,
                                        refund_transaction_ref: null,
                                        reviewed_by: null,
                                        reviewed_at: null,
                                        decision_notes: null,
                                        created_at: new Date().toISOString(),
                                        updated_at: new Date().toISOString(),
                                      })
                                    }}
                                    className="bg-amber-500 hover:bg-amber-400 text-black font-semibold text-[11px] py-1 px-2.5 h-auto"
                                  >
                                    Review Cancellation
                                  </Button>
                                ) : isPendingApproval && !isRosterReadOnly ? (
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedAttendee(reg)
                                      setReviewDecision('approved')
                                      setRejectionReason('')
                                    }}
                                    className="bg-[#7F1AFB] hover:bg-[#6814D0] text-white font-medium text-[11px] py-1 px-2.5 h-auto"
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
                                    className="text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] px-2.5 py-1 rounded-lg hover:bg-[var(--color-surface-2)] transition-colors font-medium cursor-pointer"
                                  >
                                    Details
                                  </button>
                                )}

                                {editRequests.some((e) => e.registration_id === reg.id && e.status === 'pending') && !isRosterReadOnly && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const match = editRequests.find((e) => e.registration_id === reg.id && e.status === 'pending')
                                      setSelectedEditAttendee(reg)
                                      setSelectedEditReq(match || null)
                                    }}
                                    className="text-[11px] text-[#18CFFC] hover:text-[#07A4FC] font-medium px-2 py-1 transition-colors hover:bg-[#18CFFC]/10 rounded-lg cursor-pointer"
                                  >
                                    Review Edit
                                  </button>
                                )}

                                {isWaitlisted && !isRosterReadOnly && (
                                  <button
                                    type="button"
                                    onClick={() => handleOfferSlot(reg.id)}
                                    disabled={actionLoading}
                                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium px-2 py-1 transition-colors hover:bg-emerald-500/10 rounded-lg cursor-pointer"
                                  >
                                    Offer Slot
                                  </button>
                                )}

                                {reg.status !== 'cancelled' && reg.status !== 'rejected' && reg.cancellation_request_status !== 'pending' && !isRosterReadOnly && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedCancellationAttendee(reg)
                                      setSelectedCancellationReq({
                                        id: `admin_cancel_${reg.id}`,
                                        registration_id: reg.id,
                                        event_id: reg.event_id,
                                        student_id: reg.student_id,
                                        reason: 'Organizer initiated pass revocation',
                                        explanation: null,
                                        status: 'pending',
                                        refund_applicable: !event?.is_free,
                                        refund_status: !event?.is_free ? 'refund_approved' : 'not_applicable',
                                        refund_amount: Number(event?.price || 0),
                                        refund_notes: null,
                                        refund_transaction_ref: null,
                                        reviewed_by: null,
                                        reviewed_at: null,
                                        decision_notes: null,
                                        created_at: new Date().toISOString(),
                                        updated_at: new Date().toISOString(),
                                      })
                                    }}
                                    className="text-[11px] text-rose-400 hover:text-rose-300 font-medium px-2 py-1 transition-colors hover:bg-rose-500/10 rounded-lg cursor-pointer"
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

              {/* ── Floating Bulk Actions Bar (Part 9) ────────────────────── */}
              {selectedRegIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#0E0E12]/95 border border-[#18CFFC]/50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 text-xs backdrop-blur-md">
                  <span className="font-semibold text-white flex items-center gap-1.5 whitespace-nowrap">
                    <CheckCheck size={16} className="text-[#18CFFC]" />
                    {selectedRegIds.length} {selectedRegIds.length === 1 ? 'Attendee' : 'Attendees'} Selected
                  </span>

                  <div className="h-4 w-px bg-white/20 hidden sm:block" />

                  <div className="flex items-center gap-2 flex-wrap">
                    {!isRosterReadOnly && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleBulkApprove}
                        disabled={actionLoading}
                        leftIcon={<Check size={13} />}
                        className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                      >
                        Bulk Approve
                      </Button>
                    )}

                    {canExportReports && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleBulkExport}
                        leftIcon={<Download size={13} />}
                        className="text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/10"
                      >
                        Export Selected
                      </Button>
                    )}

                    {!isRosterReadOnly && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleBulkCancel}
                        disabled={actionLoading}
                        leftIcon={<X size={13} />}
                        className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                      >
                        Bulk Cancel
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedRegIds([])}
                      className="text-zinc-400 hover:text-white"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              )}

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
                {selectedAttendee.status === 'pending_approval' && !isRosterReadOnly && (
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
            {selectedAttendee?.status === 'pending_approval' && !isRosterReadOnly ? (
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

                {/* 2. Historical Attendance Archive (if prior session records exist) */}
                {checkIns.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.08)] flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <strong className="text-sm text-[var(--color-text-primary)] block font-semibold">
                        Historical Attendance Archive
                      </strong>
                      <span className="text-xs text-[var(--color-text-muted)] block">
                        Archived check-in timestamps recorded for prior sessions ({checkIns.length} records).
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
                )}

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
                      className="shrink-0 bg-[#7F1AFB] hover:bg-[#6814D0] text-white font-medium"
                    >
                      Download
                    </Button>
                  </div>
                )}

                {/* 4. Payment Reconciliation (Authorized Organizers on Paid Events) */}
                {!event.is_free && canViewPayments && (
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
                      className="shrink-0 font-semibold"
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
                    This invalidates the student&apos;s official registration pass.
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
                Their seat will be released and their registration pass will be voided.
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

        {/* ── Modal: Review Cancellation Request (Module 2) ────────────────── */}
        {!isRosterReadOnly && (
          <ReviewCancellationModal
            isOpen={Boolean(selectedCancellationReq)}
            onClose={() => {
              setSelectedCancellationReq(null)
              setSelectedCancellationAttendee(null)
            }}
            request={selectedCancellationReq}
            registration={selectedCancellationAttendee}
            studentName={
              selectedCancellationAttendee?.student?.display_name ||
              selectedCancellationAttendee?.participant_details?.student_name ||
              (selectedCancellationAttendee?.team_name ? `Team ${selectedCancellationAttendee?.team_name}` : 'Attendee')
            }
            studentEmail={
              selectedCancellationAttendee?.student?.email ||
              selectedCancellationAttendee?.participant_details?.email ||
              ''
            }
            eventTitle={event?.title || 'Event'}
            isPaidEvent={!event?.is_free}
            price={Number(event?.price || 0)}
            onReviewed={() => {
              setSelectedCancellationReq(null)
              setSelectedCancellationAttendee(null)
              loadData(true)
            }}
          />
        )}

        {/* ── Modal: Review Details Edit Request (Module 4) ────────────────── */}
        {!isRosterReadOnly && (
          <ReviewEditModal
            isOpen={Boolean(selectedEditReq)}
            onClose={() => {
              setSelectedEditReq(null)
              setSelectedEditAttendee(null)
            }}
            request={selectedEditReq}
            registration={selectedEditAttendee}
            studentName={
              selectedEditAttendee?.student?.display_name ||
              selectedEditAttendee?.participant_details?.student_name ||
              'Attendee'
            }
            studentEmail={
              selectedEditAttendee?.student?.email ||
              selectedEditAttendee?.participant_details?.email ||
              ''
            }
            onReviewed={() => {
              setSelectedEditReq(null)
              setSelectedEditAttendee(null)
              loadData(true)
            }}
          />
        )}

        {/* ── Modal: Validated CSV Attendee Import (Part 9) ────────────────── */}
        <Modal
          isOpen={importModalOpen}
          onClose={() => {
            setImportModalOpen(false)
            setCsvPreviewRows([])
            setCsvRawText('')
          }}
          title="Import Validated Attendees from CSV"
          size="lg"
        >
          <ModalBody>
            <div className="flex flex-col gap-4 text-left">
              <p className="text-xs text-zinc-400">
                Upload or paste a comma-separated roster (.csv) containing attendee details. Required columns: <code className="text-[#18CFFC]">Name</code>, <code className="text-[#18CFFC]">Email</code>. Optional: <code className="text-zinc-300">Phone</code>, <code className="text-zinc-300">College</code>.
              </p>

              <div className="flex flex-col gap-2">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileInput}
                  className="text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#18CFFC]/20 file:text-[#18CFFC] hover:file:bg-[#18CFFC]/30 cursor-pointer"
                />

                <span className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">or paste CSV rows directly:</span>
                <textarea
                  rows={4}
                  value={csvRawText}
                  onChange={(e) => handleParseCsv(e.target.value)}
                  placeholder={`Name,Email,Phone,College\nRahul Sharma,rahul@college.edu,9876543210,Anurag University\nPriya Patel,priya@institute.edu,9123456789,JNTU`}
                  className="w-full p-2.5 rounded-xl bg-[#08080A] border border-white/10 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-[#18CFFC] resize-none"
                />
              </div>

              {csvPreviewRows.length > 0 && (
                <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-semibold">
                      Parsed {csvPreviewRows.length} Rows:
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 text-[11px] font-mono">
                        ✓ {csvPreviewRows.filter((r) => r.isValid).length} Valid
                      </span>
                      <span className="text-rose-400 text-[11px] font-mono">
                        ✗ {csvPreviewRows.filter((r) => !r.isValid).length} Duplicates / Errors
                      </span>
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto rounded-xl border border-white/5 divide-y divide-white/5">
                    {csvPreviewRows.map((row, idx) => (
                      <div
                        key={idx}
                        className={`p-2 flex items-center justify-between gap-2 text-xs ${
                          row.isValid ? 'bg-white/[0.02]' : 'bg-rose-500/[0.06]'
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-white block truncate">{row.name}</span>
                          <span className="text-[10px] text-zinc-400 block truncate">{row.email}</span>
                        </div>
                        {row.isValid ? (
                          <Badge variant="success" className="text-[10px]">Valid Attendee</Badge>
                        ) : (
                          <Badge variant="danger" className="text-[10px]">{row.error}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setImportModalOpen(false)
                setCsvPreviewRows([])
                setCsvRawText('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isImporting || csvPreviewRows.filter((r) => r.isValid).length === 0}
              isLoading={isImporting}
              onClick={handleExecuteCsvImport}
              leftIcon={<Upload size={14} />}
            >
              Import {csvPreviewRows.filter((r) => r.isValid).length} Valid Attendees
            </Button>
          </ModalFooter>
        </Modal>

        {/* ── Modal: Club Coupons (Part 13) ────────────────────────────────── */}
        {canManageCoupons && (
          <ClubCouponsModal
            isOpen={couponsModalOpen}
            onClose={() => setCouponsModalOpen(false)}
            clubId={event.club_id}
            eventId={event.id}
            eventTitle={event.title}
          />
        )}

        {/* ── Modal: Event Team Staff Delegation (Part 7) ──────────────────── */}
        {canAssignRoles && (
          <EventTeamDelegationModal
            isOpen={teamModalOpen}
            onClose={() => setTeamModalOpen(false)}
            eventId={event.id}
            clubId={event.club_id}
            eventTitle={event.title}
            currentUserId={user?.id || ''}
          />
        )}

        {/* ── Modal: Attendee Feedback Dashboard (Part 14) ─────────────────── */}
        {canViewFeedback && (
          <EventFeedbackDashboardModal
            isOpen={feedbackModalOpen}
            onClose={() => setFeedbackModalOpen(false)}
            eventId={event.id}
            eventTitle={event.title}
          />
        )}
      </div>
    </PageShell>
  )
}
