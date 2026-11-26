import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router'
import {
  Download,
  Mail,
  Send,
  Users,
  CreditCard,
  Archive,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react'
import { Button, Card, PageHeader, Alert, Modal, ModalBody, ModalFooter } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/context/AuthContext'
import {
  getEventById,
  getEventLifecyclePhase,
  isEventConcludedOrCancelled,
  LIFECYCLE_BADGE_META,
  formatEventDate,
  resolveEventTimezone,
} from '@/lib/events'
import { getEventRegistrations } from '@/lib/registrations'
import { getClubPaymentSubmissions } from '@/lib/payments'
import { getEventRegistrationsWithCheckIn } from '@/lib/checkin'
import { sendBulkEventReminders } from '@/lib/emails'
import {
  exportRegistrationsListCsv,
  exportConfirmedAttendeesCsv,
  exportPaymentReconciliationCsv,
  exportAttendanceReportCsv,
} from '@/lib/csvExport'
// Dynamic import for excelExport ensures the ~940KB ExcelJS library is only fetched on-demand when downloading
import type {
  EventRecord,
  RegistrationWithStudent,
  PaymentSubmissionWithDetails,
  RegistrationWithCheckIn,
} from '@/types'

import { ResourceOwnerGuard } from '@/components/auth/ResourceOwnerGuard'

export default function EventReportsPage() {
  const { id } = useParams<{ id: string }>()
  const {
    role,
    activeClubId,
    activeClubRole,
    eventAssignments,
    hasEventPermission,
    isRoleLoading,
  } = useAuth()

  const [event, setEvent] = useState<EventRecord | null>(null)
  const [registrations, setRegistrations] = useState<RegistrationWithStudent[]>([])
  const [payments, setPayments] = useState<PaymentSubmissionWithDetails[]>([])
  const [attendeesWithCheckIn, setAttendeesWithCheckIn] = useState<RegistrationWithCheckIn[]>([])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [exportingType, setExportingType] = useState<string | null>(null)

  // Reminder Modal
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [customReminderNote, setCustomReminderNote] = useState('')
  const [sendingReminder, setSendingReminder] = useState(false)
  const [notice, setNotice] = useState<{ message: string; isError?: boolean } | null>(null)

  const canViewReports = event
    ? role === 'platform_admin' || hasEventPermission(event.id, 'reports.view', event.club_id)
    : Boolean(isAuthorized)
  const canExportReports = event
    ? role === 'platform_admin' || hasEventPermission(event.id, 'reports.export', event.club_id)
    : false
  const canViewPayments = event
    ? role === 'platform_admin' || hasEventPermission(event.id, 'payments.view', event.club_id)
    : false
  const canViewRegistrations = event
    ? role === 'platform_admin' || hasEventPermission(event.id, 'registrations.view', event.club_id)
    : false
  const canSendReminders = event
    ? role === 'platform_admin' ||
      hasEventPermission(event.id, 'events.edit', event.club_id) ||
      hasEventPermission(event.id, 'registrations.manage', event.club_id)
    : false

  const loadData = async (silent = false) => {
    if (!id || isRoleLoading) return
    if (!silent) setLoading(true)
    else setRefreshing(true)

    const eventRes = await getEventById(id)
    if (!eventRes.event) {
      setIsAuthorized(false)
      setEvent(null)
      if (!silent) setLoading(false)
      else setRefreshing(false)
      return
    }

    const authorized =
      role === 'platform_admin' ||
      hasEventPermission(eventRes.event.id, 'reports.view', eventRes.event.club_id)

    setIsAuthorized(authorized)
    if (!authorized) {
      setEvent(null)
      setRegistrations([])
      setPayments([])
      setAttendeesWithCheckIn([])
      if (!silent) setLoading(false)
      else setRefreshing(false)
      return
    }

    const canFetchPayments =
      role === 'platform_admin' ||
      hasEventPermission(eventRes.event.id, 'payments.view', eventRes.event.club_id)

    const [regRes, payRes, checkInRes] = await Promise.all([
      getEventRegistrations(id),
      canFetchPayments
        ? getClubPaymentSubmissions(eventRes.event.club_id || activeClubId || undefined, id)
        : Promise.resolve({ submissions: [], error: null }),
      getEventRegistrationsWithCheckIn(id),
    ])

    if (!silent) setLoading(false)
    else setRefreshing(false)

    const reportError = regRes.error || payRes.error || checkInRes.error || null
    setLoadError(reportError)
    setEvent(eventRes.event)
    if (regRes.registrations) setRegistrations(regRes.registrations)
    setPayments(canFetchPayments && payRes.submissions ? payRes.submissions : [])
    if (checkInRes.registrations) setAttendeesWithCheckIn(checkInRes.registrations)
  }

  useEffect(() => {
    if (!isRoleLoading) {
      loadData()
    }
  }, [id, role, isRoleLoading, activeClubId, activeClubRole, eventAssignments])

  // Calculated Metrics
  const totalRegistrations = registrations.length
  const confirmedAttendees = registrations.filter((r) => r.status === 'confirmed').length
  const pendingPaymentReviews = registrations.filter((r) => r.status === 'pending_payment').length
  const cancelledRegistrations = registrations.filter((r) => r.status === 'cancelled').length

  const successfulCheckIns = attendeesWithCheckIn.filter((a) => Boolean(a.check_in)).length
  const lifecyclePhase = event ? getEventLifecyclePhase(event) : 'draft'
  const isArchiveEvent = event ? isEventConcludedOrCancelled(event) : false
  const lifecycleMeta = LIFECYCLE_BADGE_META[lifecyclePhase]
  const eventTz = resolveEventTimezone(event?.timezone)

  const approvedPayments = payments.filter((p) => p.status === 'approved')
  const totalRevenue = approvedPayments.reduce((sum, p) => sum + (p.amount || 0), 0)

  // Reminders Dispatch
  const handleSendReminders = async () => {
    if (!id || !canSendReminders) {
      setShowReminderModal(false)
      setNotice({
        message: 'You do not have permission to send event reminder broadcasts.',
        isError: true,
      })
      return
    }
    if (event && isEventConcludedOrCancelled(event)) {
      setShowReminderModal(false)
      setNotice({
        message: 'Pre-event reminder broadcasts are disabled after an event concludes or is cancelled.',
        isError: true,
      })
      return
    }
    setSendingReminder(true)
    setNotice(null)
    const res = await sendBulkEventReminders(id, customReminderNote)
    setSendingReminder(false)
    setShowReminderModal(false)
    setCustomReminderNote('')

    if (res.success) {
      setNotice({
        message: `${res.message} In-app alerts queued for all confirmed attendees.`,
      })
    } else {
      setNotice({ message: res.message, isError: true })
    }
  }

  const formattedDate = event?.start_date
    ? formatEventDate(event.start_date, eventTz, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : ''

  if (loading || isRoleLoading) {
    return (
      <PageShell>
        <div className="py-24 flex flex-col items-center justify-center text-center">
          <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin mb-3" />
          <span className="text-xs text-gray-500 font-medium">
            Generating event report & analytics…
          </span>
        </div>
      </PageShell>
    )
  }

  if (isAuthorized === false || !canViewReports || !event) {
    return (
      <PageShell>
        <ResourceOwnerGuard
          isAuthorized={false}
          denialTitle="Event Authorization Required"
          denialMessage="Only the club organizing this event or authorized platform administrators can access financial and attendee analytics."
          fallbackUrl="/club/events"
          fallbackLabel="Back to My Events"
        >
          <div />
        </ResourceOwnerGuard>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 text-left">
        {/* Page Header */}
        <PageHeader
          breadcrumbs={[
            { label: 'Club Dashboard', href: '/club/dashboard' },
            { label: 'My Events', href: '/club/events' },
            { label: 'Reports & Analytics' },
          ]}
          title="Event Reports & Analytics"
          badge={lifecycleMeta.label}
          badgeVariant={lifecycleMeta.variant}
          subtitle={
            event
              ? `${event.title} • ${formattedDate} • ${event.venue_name || 'Online'}`
              : undefined
          }
          actions={
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadData(true)}
                isLoading={refreshing}
                leftIcon={<RefreshCw size={14} />}
                className="flex-1 sm:flex-initial justify-center"
              >
                Refresh
              </Button>
              {event && canViewRegistrations && (
                <Link to={`/club/events/${event.id}/registrations`} className="flex-1 sm:flex-initial">
                  <Button variant="outline" size="sm" leftIcon={<Users size={14} />} className="w-full justify-center">
                    Attendee Roster
                  </Button>
                </Link>
              )}
            </div>
          }
        />

        {loadError && (
          <Alert variant="error">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-sm">Unable to load complete analytics data</p>
                <p className="text-xs opacity-90">{loadError}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => loadData(true)}>
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

        {/* Executive Summary Metrics Grid */}
        <div className={`grid grid-cols-2 sm:grid-cols-3 ${canViewPayments ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-2.5 sm:gap-3`}>
          <Card className="p-3 sm:p-3.5 flex flex-col justify-between">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-gray-500 tracking-wider">
              Total Signed Up
            </span>
            <div className="text-lg sm:text-2xl font-bold font-display text-gray-900 mt-1">
              {loading ? '…' : totalRegistrations}
            </div>
          </Card>

          <Card className="p-3.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
              Confirmed Passes
            </span>
            <div className="text-xl sm:text-2xl font-bold font-display text-emerald-600 mt-1">
              {loading ? '…' : confirmedAttendees}
            </div>
          </Card>

          <Card className="p-3.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
              Pending Reviews
            </span>
            <div className="text-xl sm:text-2xl font-bold font-display text-amber-600 mt-1">
              {loading ? '…' : pendingPaymentReviews}
            </div>
          </Card>

          {canViewPayments && (
            <Card className="p-3.5 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                Total Revenue
              </span>
              <div className="text-xl sm:text-2xl font-bold font-display text-emerald-600 mt-1">
                {loading ? '…' : `₹${totalRevenue.toLocaleString()}`}
              </div>
            </Card>
          )}

          <Card className="p-3.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
              Cancelled
            </span>
            <div className="text-xl sm:text-2xl font-bold font-display text-rose-600 mt-1">
              {loading ? '…' : cancelledRegistrations}
            </div>
          </Card>
        </div>

        {/* Section 1: Data Exports (Excel .xlsx & CSV) */}
        {canExportReports ? (
          <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold font-display text-gray-900">
                Official Administrative Exports
              </h2>
              <p className="text-xs text-gray-600">
                Download formatted Excel workbooks (.xlsx) with frozen panes and zebra styling, or raw CSV spreadsheets.
              </p>
            </div>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 ${successfulCheckIns > 0 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
            {/* Export 1: All Registrations */}
            <Card className="p-5 flex flex-col justify-between gap-4 border-gray-200 hover:border-blue-300 transition-colors">
              <div className="space-y-1.5">
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 w-fit">
                  <Users size={20} />
                </div>
                <h3 className="font-bold text-sm text-gray-900">
                  All Registrations Roster
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Complete list of all registered students, ticket tokens, and status history ({totalRegistrations} rows).
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={async () => {
                    if (!event) return
                    setExportingType('full_xlsx')
                    try {
                      const { exportFullAttendeesXlsx } = await import('@/lib/excelExport')
                      await exportFullAttendeesXlsx({
                        event,
                        registrations,
                        checkIns: attendeesWithCheckIn.flatMap(a => a.check_ins || (a.check_in ? [a.check_in] : [])),
                        payments,
                        isAuthorized: Boolean(isAuthorized),
                      })
                    } finally {
                      setExportingType(null)
                    }
                  }}
                  disabled={!event || registrations.length === 0 || Boolean(exportingType)}
                  isLoading={exportingType === 'full_xlsx'}
                  leftIcon={<Download size={14} />}
                  className="w-full font-medium"
                >
                  Download Excel (.xlsx)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => event && exportRegistrationsListCsv(event, registrations)}
                  disabled={!event || registrations.length === 0 || Boolean(exportingType)}
                  className="w-full text-xs text-gray-700"
                >
                  Download CSV
                </Button>
              </div>
            </Card>

            {/* Export 2: Historical Attendance Archive (only rendered when historical records exist) */}
            {successfulCheckIns > 0 && (
              <Card className="p-5 flex flex-col justify-between gap-4 border-gray-200 hover:border-emerald-300 transition-colors">
                <div className="space-y-1.5">
                  <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 w-fit">
                    <Archive size={20} />
                  </div>
                  <h3 className="font-bold text-sm text-gray-900">
                    Historical Attendance Archive
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Archived check-in timestamps recorded for prior event sessions ({successfulCheckIns} records).
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={async () => {
                      if (!event) return
                      setExportingType('attendance_xlsx')
                      try {
                        const { exportAttendanceReportXlsx } = await import('@/lib/excelExport')
                        await exportAttendanceReportXlsx({
                          event,
                          registrations: attendeesWithCheckIn,
                          checkIns: attendeesWithCheckIn.flatMap(a => a.check_ins || (a.check_in ? [a.check_in] : [])),
                        })
                      } finally {
                        setExportingType(null)
                      }
                    }}
                    disabled={!event || attendeesWithCheckIn.length === 0 || Boolean(exportingType)}
                    isLoading={exportingType === 'attendance_xlsx'}
                    leftIcon={<Download size={14} />}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 border-none text-white font-semibold"
                  >
                    Download Excel (.xlsx)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => event && exportAttendanceReportCsv(event, attendeesWithCheckIn)}
                    disabled={!event || attendeesWithCheckIn.length === 0 || Boolean(exportingType)}
                    className="w-full text-xs text-gray-700"
                  >
                    Download CSV
                  </Button>
                </div>
              </Card>
            )}

            {/* Export 3: Payment Reconciliation */}
            {canViewPayments && (
              <Card className="p-5 flex flex-col justify-between gap-4 border-gray-200 hover:border-amber-300 transition-colors">
                <div className="space-y-1.5">
                  <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 w-fit">
                    <CreditCard size={20} />
                  </div>
                  <h3 className="font-bold text-sm text-gray-900">
                    Payment Reconciliation
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Financial audit report with 12-digit UPI UTR references, approval timestamps, and amounts ({payments.length} rows).
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={async () => {
                      if (!event) return
                      setExportingType('payment_xlsx')
                      try {
                        const { exportPaymentsReportXlsx } = await import('@/lib/excelExport')
                        await exportPaymentsReportXlsx({
                          event,
                          payments,
                          isAuthorized: Boolean(isAuthorized),
                        })
                      } finally {
                        setExportingType(null)
                      }
                    }}
                    disabled={!event || payments.length === 0 || Boolean(exportingType)}
                    isLoading={exportingType === 'payment_xlsx'}
                    leftIcon={<Download size={14} />}
                    className="w-full font-semibold"
                  >
                    Download Excel (.xlsx)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => event && exportPaymentReconciliationCsv(event, payments)}
                    disabled={!event || payments.length === 0 || Boolean(exportingType)}
                    className="w-full text-xs text-gray-700"
                  >
                    Download CSV
                  </Button>
                </div>
              </Card>
            )}

            {/* Export 4: Confirmed Attendees or Team Roster */}
            {event?.participation_type === 'team' ? (
              <Card className="p-5 flex flex-col justify-between gap-4 border-gray-200 hover:border-indigo-300 transition-colors">
                <div className="space-y-1.5">
                  <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 w-fit">
                    <Users size={20} />
                  </div>
                  <h3 className="font-bold text-sm text-gray-900">
                    Squads & Team Rosters
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Dedicated breakdown of team leaders, invited members, and individual squad credentials.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={async () => {
                      if (!event) return
                      setExportingType('team_xlsx')
                      try {
                        const { exportTeamsReportXlsx } = await import('@/lib/excelExport')
                        await exportTeamsReportXlsx({
                          event,
                          registrations,
                        })
                      } finally {
                        setExportingType(null)
                      }
                    }}
                    disabled={!event || registrations.length === 0 || Boolean(exportingType)}
                    isLoading={exportingType === 'team_xlsx'}
                    leftIcon={<Download size={14} />}
                    className="w-full font-medium"
                  >
                    Download Excel (.xlsx)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => event && exportConfirmedAttendeesCsv(event, registrations)}
                    disabled={!event || confirmedAttendees === 0 || Boolean(exportingType)}
                    className="w-full text-xs text-gray-700"
                  >
                    Confirmed CSV
                  </Button>
                </div>
              </Card>
            ) : (
              <Card className="p-5 flex flex-col justify-between gap-4 border-gray-200 hover:border-emerald-300 transition-colors">
                <div className="space-y-1.5">
                  <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 w-fit">
                    <CheckCircle2 size={20} />
                  </div>
                  <h3 className="font-bold text-sm text-gray-900">
                    Confirmed Attendees
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    List of valid ticket holders eligible for entry, seat allocation, and catering ({confirmedAttendees} rows).
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={async () => {
                      if (!event) return
                      setExportingType('confirmed_xlsx')
                      try {
                        const { exportFullAttendeesXlsx } = await import('@/lib/excelExport')
                        await exportFullAttendeesXlsx({
                          event,
                          registrations: registrations.filter((r) => r.status === 'confirmed'),
                          checkIns: attendeesWithCheckIn.flatMap(a => a.check_ins || (a.check_in ? [a.check_in] : [])),
                          payments,
                          isAuthorized: Boolean(isAuthorized),
                        })
                      } finally {
                        setExportingType(null)
                      }
                    }}
                    disabled={!event || confirmedAttendees === 0 || Boolean(exportingType)}
                    isLoading={exportingType === 'confirmed_xlsx'}
                    leftIcon={<Download size={14} />}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 border-none text-white font-medium"
                  >
                    Download Excel (.xlsx)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => event && exportConfirmedAttendeesCsv(event, registrations)}
                    disabled={!event || confirmedAttendees === 0 || Boolean(exportingType)}
                    className="w-full text-xs text-gray-700"
                  >
                    Download CSV
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
        ) : (
          <Alert variant="warning">
            Summary metrics are visible for your role, while spreadsheet export (.xlsx and .csv) requires report export permission.
          </Alert>
        )}

        {/* Section 2: Bulk Reminders & Communication Controls */}
        {canSendReminders && (
        <Card className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-gray-200">
          <div className="space-y-1 max-w-xl">
            <div className="flex items-center gap-2">
              <Mail size={18} className="text-blue-600" />
              <h3 className="font-bold text-sm text-gray-900">
                Send Bulk Event Reminders
              </h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              {isArchiveEvent
                ? `This event has ${lifecyclePhase === 'cancelled' ? 'been cancelled' : 'already concluded'}. Pre-event reminder broadcasts are locked for archived events.`
                : (
                  <>
                    Send an automated event reminder to all <strong className="text-gray-900">{confirmedAttendees} confirmed pass holders</strong>. Notifications are queued safely with duplicate protection so attendees are not spammed.
                  </>
                )}
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => setShowReminderModal(true)}
            disabled={!event || confirmedAttendees === 0 || isArchiveEvent}
            leftIcon={<Send size={15} />}
            className="shrink-0 font-semibold"
          >
            Preview & Send Reminder
          </Button>
        </Card>
        )}

        {/* Reminder Preview & Confirmation Modal */}
        <Modal
          isOpen={showReminderModal && Boolean(event)}
          onClose={() => setShowReminderModal(false)}
          title="Event Reminder Announcement"
          size="md"
        >
          <ModalBody>
            {event && (
              <div className="flex flex-col gap-4 text-left">
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-2">
                  <p>
                    <strong className="text-gray-900">Subject:</strong> Reminder: {event.title} is coming up!
                  </p>
                  <p>
                    <strong className="text-gray-900">Recipients:</strong> {confirmedAttendees} confirmed ticket holders
                  </p>
                  <p className="text-gray-500">
                    Event Date: {formattedDate} at {event.venue_name || 'Campus Venue'}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="custom_note"
                    className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1.5"
                  >
                    Custom Organizer Note (Optional)
                  </label>
                  <textarea
                    id="custom_note"
                    rows={3}
                    placeholder="e.g. Please bring your college ID card and arrive 15 minutes before opening."
                    value={customReminderNote}
                    onChange={(e) => setCustomReminderNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-colors"
                  />
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowReminderModal(false)}
              disabled={sendingReminder}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSendReminders}
              isLoading={sendingReminder}
              leftIcon={<Send size={14} />}
            >
              {sendingReminder ? 'Queuing Reminders…' : 'Dispatch Reminders'}
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    </PageShell>
  )
}
