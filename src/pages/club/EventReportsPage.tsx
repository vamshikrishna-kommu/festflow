import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router'
import {
  Download,
  Mail,
  Send,
  Users,
  CreditCard,
  QrCode,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react'
import { Button, Card, PageHeader, Alert, Modal, ModalBody, ModalFooter } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/context/AuthContext'
import { getEventById } from '@/lib/events'
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
import {
  exportFullAttendeesXlsx,
  exportAttendanceReportXlsx,
  exportTeamsReportXlsx,
  exportPaymentsReportXlsx,
} from '@/lib/excelExport'
import type {
  EventRecord,
  RegistrationWithStudent,
  PaymentSubmissionWithDetails,
  RegistrationWithCheckIn,
} from '@/types'

import { ResourceOwnerGuard } from '@/components/auth/ResourceOwnerGuard'

export default function EventReportsPage() {
  const { id } = useParams<{ id: string }>()
  const { user, role } = useAuth()

  const [event, setEvent] = useState<EventRecord | null>(null)
  const [registrations, setRegistrations] = useState<RegistrationWithStudent[]>([])
  const [payments, setPayments] = useState<PaymentSubmissionWithDetails[]>([])
  const [attendeesWithCheckIn, setAttendeesWithCheckIn] = useState<RegistrationWithCheckIn[]>([])

  const [loading, setLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [exportingType, setExportingType] = useState<string | null>(null)

  // Reminder Modal
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [customReminderNote, setCustomReminderNote] = useState('')
  const [sendingReminder, setSendingReminder] = useState(false)
  const [notice, setNotice] = useState<{ message: string; isError?: boolean } | null>(null)

  const loadData = async (silent = false) => {
    if (!id) return
    if (!silent) setLoading(true)
    else setRefreshing(true)

    const [eventRes, regRes, payRes, checkInRes] = await Promise.all([
      getEventById(id),
      getEventRegistrations(id),
      getClubPaymentSubmissions(user?.id, id),
      getEventRegistrationsWithCheckIn(id),
    ])

    if (!silent) setLoading(false)
    else setRefreshing(false)

    if (eventRes.event) {
      const authorized = (user && eventRes.event.club_id === user.id) || role === 'platform_admin'
      setIsAuthorized(authorized)
      if (authorized) {
        setEvent(eventRes.event)
        if (regRes.registrations) setRegistrations(regRes.registrations)
        if (payRes.submissions) setPayments(payRes.submissions)
        if (checkInRes.registrations) setAttendeesWithCheckIn(checkInRes.registrations)
      }
    } else {
      setIsAuthorized(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id, user, role])

  // Calculated Metrics
  const totalRegistrations = registrations.length
  const confirmedAttendees = registrations.filter((r) => r.status === 'confirmed').length
  const pendingPaymentReviews = registrations.filter((r) => r.status === 'pending_payment').length
  const cancelledRegistrations = registrations.filter((r) => r.status === 'cancelled').length

  const successfulCheckIns = attendeesWithCheckIn.filter((a) => Boolean(a.check_in)).length
  const attendanceRate =
    confirmedAttendees > 0 ? Math.round((successfulCheckIns / confirmedAttendees) * 100) : 0

  const approvedPayments = payments.filter((p) => p.status === 'approved')
  const totalRevenue = approvedPayments.reduce((sum, p) => sum + (p.amount || 0), 0)

  // Reminders Dispatch
  const handleSendReminders = async () => {
    if (!id) return
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

  const startDate = event ? new Date(event.start_date) : null
  const formattedDate = startDate
    ? startDate.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : ''

  if (loading) {
    return (
      <PageShell>
        <div className="py-24 flex flex-col items-center justify-center text-center">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--color-surface-3)] border-t-[#18CFFC] animate-spin mb-3" />
          <span className="text-xs text-[var(--color-text-muted)] font-medium">
            Generating event report & analytics…
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
          badge="Executive Summary"
          badgeVariant="purple"
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
              {event && (
                <Link to={`/club/events/${event.id}/check-in`} className="flex-1 sm:flex-initial">
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<QrCode size={14} />}
                    className="w-full justify-center bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] hover:brightness-110 text-white border-none font-semibold shadow-[0_4px_16px_rgba(24,207,252,0.3)]"
                  >
                    Gate Check-In
                  </Button>
                </Link>
              )}
            </div>
          }
        />

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
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
          <Card className="p-3 sm:p-3.5 flex flex-col justify-between">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">
              Total Signed Up
            </span>
            <div className="text-lg sm:text-2xl font-bold font-display text-[var(--color-text-primary)] mt-1">
              {loading ? '…' : totalRegistrations}
            </div>
          </Card>

          <Card className="p-3.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">
              Confirmed Passes
            </span>
            <div className="text-xl sm:text-2xl font-bold font-display text-emerald-400 mt-1">
              {loading ? '…' : confirmedAttendees}
            </div>
          </Card>

          <Card className="p-3.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">
              Pending Reviews
            </span>
            <div className="text-xl sm:text-2xl font-bold font-display text-amber-400 mt-1">
              {loading ? '…' : pendingPaymentReviews}
            </div>
          </Card>

          <Card className="p-3.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">
              Gate Admitted
            </span>
            <div className="text-xl sm:text-2xl font-bold font-display text-emerald-400 mt-1">
              {loading ? '…' : successfulCheckIns}
            </div>
          </Card>

          <Card className="p-3.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">
              Turnout Rate
            </span>
            <div className="text-xl sm:text-2xl font-bold font-display text-[#18CFFC] mt-1">
              {loading ? '…' : `${attendanceRate}%`}
            </div>
          </Card>

          <Card className="p-3.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">
              Total Revenue
            </span>
            <div className="text-xl sm:text-2xl font-bold font-display text-emerald-300 mt-1">
              {loading ? '…' : `₹${totalRevenue.toLocaleString()}`}
            </div>
          </Card>

          <Card className="p-3.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">
              Cancelled
            </span>
            <div className="text-xl sm:text-2xl font-bold font-display text-rose-400 mt-1">
              {loading ? '…' : cancelledRegistrations}
            </div>
          </Card>
        </div>

        {/* Section 1: Data Exports (Excel .xlsx & CSV) */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold font-display text-[var(--color-text-primary)]">
                Official Administrative Exports
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Download formatted Excel workbooks (.xlsx) with frozen panes and zebra styling, or raw CSV spreadsheets.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Export 1: All Registrations */}
            <Card className="p-5 flex flex-col justify-between gap-4 border-[var(--color-surface-3)] hover:border-[#18CFFC]/50 transition-colors">
              <div className="space-y-1.5">
                <div className="p-2.5 rounded-xl bg-[#18CFFC]/10 text-[#18CFFC] w-fit">
                  <Users size={20} />
                </div>
                <h3 className="font-bold text-sm text-[var(--color-text-primary)]">
                  All Registrations Roster
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Complete list of all registered students, ticket tokens, and status history ({totalRegistrations} rows).
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-[var(--color-surface-3)]">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={async () => {
                    if (!event) return
                    setExportingType('full_xlsx')
                    try {
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
                  className="w-full bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] hover:brightness-110 text-white font-medium shadow-[0_2px_10px_rgba(255,87,34,0.3)]"
                >
                  Download Excel (.xlsx)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => event && exportRegistrationsListCsv(event, registrations)}
                  disabled={!event || registrations.length === 0 || Boolean(exportingType)}
                  className="w-full text-xs text-[var(--color-text-secondary)]"
                >
                  Download CSV
                </Button>
              </div>
            </Card>

            {/* Export 2: Gate Attendance Report */}
            <Card className="p-5 flex flex-col justify-between gap-4 border-[var(--color-surface-3)] hover:border-emerald-500/50 transition-colors">
              <div className="space-y-1.5">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 w-fit">
                  <QrCode size={20} />
                </div>
                <h3 className="font-bold text-sm text-[var(--color-text-primary)]">
                  Gate Attendance Report
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Real-time entry verification logs with exact check-in timestamps and admission status ({attendeesWithCheckIn.length} rows).
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-[var(--color-surface-3)]">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={async () => {
                    if (!event) return
                    setExportingType('attendance_xlsx')
                    try {
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
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  Download Excel (.xlsx)
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => event && exportAttendanceReportCsv(event, attendeesWithCheckIn)}
                  disabled={!event || attendeesWithCheckIn.length === 0 || Boolean(exportingType)}
                  className="w-full text-xs text-[var(--color-text-secondary)]"
                >
                  Download CSV
                </Button>
              </div>
            </Card>

            {/* Export 3: Payment Reconciliation */}
            <Card className="p-5 flex flex-col justify-between gap-4 border-[var(--color-surface-3)] hover:border-amber-500/50 transition-colors">
              <div className="space-y-1.5">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 w-fit">
                  <CreditCard size={20} />
                </div>
                <h3 className="font-bold text-sm text-[var(--color-text-primary)]">
                  Payment Reconciliation
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Financial audit report with 12-digit UPI UTR references, approval timestamps, and amounts ({payments.length} rows).
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-[var(--color-surface-3)]">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={async () => {
                    if (!event) return
                    setExportingType('payment_xlsx')
                    try {
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
                  className="w-full text-xs text-[var(--color-text-secondary)]"
                >
                  Download CSV
                </Button>
              </div>
            </Card>

            {/* Export 4: Confirmed Attendees or Team Roster */}
            {event?.participation_type === 'team' ? (
              <Card className="p-5 flex flex-col justify-between gap-4 border-[var(--color-surface-3)] hover:border-[#ED47FC]/50 transition-colors">
                <div className="space-y-1.5">
                  <div className="p-2.5 rounded-xl bg-[#ED47FC]/10 text-[#FE7EE8] w-fit">
                    <Users size={20} />
                  </div>
                  <h3 className="font-bold text-sm text-[var(--color-text-primary)]">
                    Squads & Team Rosters
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    Dedicated breakdown of team leaders, invited members, and individual squad credentials.
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-[var(--color-surface-3)]">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={async () => {
                      if (!event) return
                      setExportingType('team_xlsx')
                      try {
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
                    className="w-full text-xs text-[var(--color-text-secondary)]"
                  >
                    Confirmed CSV
                  </Button>
                </div>
              </Card>
            ) : (
              <Card className="p-5 flex flex-col justify-between gap-4 border-[var(--color-surface-3)] hover:border-emerald-500/50 transition-colors">
                <div className="space-y-1.5">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 w-fit">
                    <CheckCircle2 size={20} />
                  </div>
                  <h3 className="font-bold text-sm text-[var(--color-text-primary)]">
                    Confirmed Attendees
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    List of valid ticket holders eligible for entry, seat allocation, and catering ({confirmedAttendees} rows).
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-[var(--color-surface-3)]">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={async () => {
                      if (!event) return
                      setExportingType('confirmed_xlsx')
                      try {
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
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                  >
                    Download Excel (.xlsx)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => event && exportConfirmedAttendeesCsv(event, registrations)}
                    disabled={!event || confirmedAttendees === 0 || Boolean(exportingType)}
                    className="w-full text-xs text-[var(--color-text-secondary)]"
                  >
                    Download CSV
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Section 2: Bulk Reminders & Communication Controls */}
        <Card className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-[var(--color-surface-3)]">
          <div className="space-y-1 max-w-xl">
            <div className="flex items-center gap-2">
              <Mail size={18} className="text-[#18CFFC]" />
              <h3 className="font-bold text-sm text-[var(--color-text-primary)]">
                Send Bulk Event Reminders
              </h3>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Send an automated event reminder to all <strong className="text-[var(--color-text-primary)]">{confirmedAttendees} confirmed pass holders</strong>. Notifications are queued safely with duplicate protection so attendees are not spammed.
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => setShowReminderModal(true)}
            disabled={!event || confirmedAttendees === 0}
            leftIcon={<Send size={15} />}
            className="shrink-0 bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] hover:brightness-110 text-white font-semibold shadow-[0_4px_16px_rgba(24,207,252,0.3)]"
          >
            Preview & Send Reminder
          </Button>
        </Card>

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
                <div className="p-4 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.08)] text-xs space-y-2">
                  <p>
                    <strong className="text-[var(--color-text-primary)]">Subject:</strong> Reminder: {event.title} is coming up!
                  </p>
                  <p>
                    <strong className="text-[var(--color-text-primary)]">Recipients:</strong> {confirmedAttendees} confirmed ticket holders
                  </p>
                  <p className="text-[var(--color-text-muted)]">
                    Event Date: {formattedDate} at {event.venue_name || 'Campus Venue'}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="custom_note"
                    className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5"
                  >
                    Custom Organizer Note (Optional)
                  </label>
                  <textarea
                    id="custom_note"
                    rows={3}
                    placeholder="e.g. Please bring your college ID card and arrive 15 minutes before opening."
                    value={customReminderNote}
                    onChange={(e) => setCustomReminderNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-white/10 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC] transition-colors"
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
