import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import {
  FileSpreadsheet,
  Download,
  Mail,
  Send,
  Users,
  CreditCard,
  QrCode,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Calendar,
  MapPin,
  RefreshCw,
} from 'lucide-react'
import { Button, Card, Badge } from '@/components/ui'
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
import { fadeIn } from '@/lib/animations'
import type {
  EventRecord,
  RegistrationWithStudent,
  PaymentSubmissionWithDetails,
  RegistrationWithCheckIn,
} from '@/types'

export default function EventReportsPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()

  const [event, setEvent] = useState<EventRecord | null>(null)
  const [registrations, setRegistrations] = useState<RegistrationWithStudent[]>([])
  const [payments, setPayments] = useState<PaymentSubmissionWithDetails[]>([])
  const [attendeesWithCheckIn, setAttendeesWithCheckIn] = useState<RegistrationWithCheckIn[]>([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

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

    if (eventRes.event) setEvent(eventRes.event)
    if (regRes.registrations) setRegistrations(regRes.registrations)
    if (payRes.submissions) setPayments(payRes.submissions)
    if (checkInRes.registrations) setAttendeesWithCheckIn(checkInRes.registrations)
  }

  useEffect(() => {
    loadData()
  }, [id, user])

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

  return (
    <div className="min-h-screen pt-28 pb-24 px-4 sm:px-6 lg:px-8 bg-[var(--color-surface-0)] text-left">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] border-b border-[var(--color-surface-3)] pb-4">
          <Link
            to="/club/dashboard"
            className="hover:text-[var(--color-text-primary)] flex items-center gap-1 transition-colors"
          >
            <ArrowLeft size={14} /> Club Dashboard
          </Link>
          <span>/</span>
          <Link to="/club/events" className="hover:text-[var(--color-text-primary)]">
            My Events
          </Link>
          <span>/</span>
          <span className="text-[var(--color-text-primary)] font-medium">Reports & Analytics</span>
        </div>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold font-display text-[var(--color-text-primary)]">
                Event Reports & Analytics
              </h1>
              <Badge variant="purple" className="flex items-center gap-1">
                <FileSpreadsheet size={12} /> Executive Summary
              </Badge>
            </div>
            {event && (
              <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-[var(--color-text-primary)]">{event.title}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar size={13} /> {formattedDate}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin size={13} /> {event.venue_name}
                </span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(true)}
              isLoading={refreshing}
              leftIcon={<RefreshCw size={14} />}
            >
              Refresh
            </Button>
            {event && (
              <Link to={`/club/events/${event.id}/check-in`}>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<QrCode size={14} />}
                  className="bg-[var(--color-brand-cyan)] hover:bg-cyan-400 text-black border-none font-semibold"
                >
                  Gate Check-In
                </Button>
              </Link>
            )}
          </div>
        </div>

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

        {/* Executive Summary Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <Card className="p-3.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">
              Total Signed Up
            </span>
            <div className="text-xl sm:text-2xl font-bold font-display text-[var(--color-text-primary)] mt-1">
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
            <div className="text-xl sm:text-2xl font-bold font-display text-[var(--color-brand-cyan)] mt-1">
              {loading ? '…' : successfulCheckIns}
            </div>
          </Card>

          <Card className="p-3.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">
              Turnout Rate
            </span>
            <div className="text-xl sm:text-2xl font-bold font-display text-purple-400 mt-1">
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

        {/* Section 1: CSV Export Actions */}
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-base font-bold font-display text-[var(--color-text-primary)]">
              Official Data Exports
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Download sanitized, formula-injection-safe UTF-8 CSV spreadsheets for administrative reporting.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Export 1: All Registrations */}
            <Card className="p-5 flex flex-col justify-between gap-4 border-[var(--color-surface-3)] hover:border-[var(--color-brand-purple)]/50 transition-colors">
              <div className="space-y-1.5">
                <div className="p-2.5 rounded-xl bg-[var(--color-brand-purple)]/10 text-[var(--color-brand-purple)] w-fit">
                  <Users size={20} />
                </div>
                <h3 className="font-bold text-sm text-[var(--color-text-primary)]">
                  All Registrations Roster
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Complete list of all registered students, ticket tokens, and status history ({totalRegistrations} rows).
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => event && exportRegistrationsListCsv(event, registrations)}
                disabled={!event || registrations.length === 0}
                leftIcon={<Download size={14} />}
                className="w-full"
              >
                Download CSV
              </Button>
            </Card>

            {/* Export 2: Confirmed Attendees */}
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

              <Button
                variant="outline"
                size="sm"
                onClick={() => event && exportConfirmedAttendeesCsv(event, registrations)}
                disabled={!event || confirmedAttendees === 0}
                leftIcon={<Download size={14} />}
                className="w-full"
              >
                Download CSV
              </Button>
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

              <Button
                variant="outline"
                size="sm"
                onClick={() => event && exportPaymentReconciliationCsv(event, payments)}
                disabled={!event || payments.length === 0}
                leftIcon={<Download size={14} />}
                className="w-full"
              >
                Download CSV
              </Button>
            </Card>

            {/* Export 4: Gate Check-In Report */}
            <Card className="p-5 flex flex-col justify-between gap-4 border-[var(--color-surface-3)] hover:border-[var(--color-brand-cyan)]/50 transition-colors">
              <div className="space-y-1.5">
                <div className="p-2.5 rounded-xl bg-[var(--color-brand-cyan)]/10 text-[var(--color-brand-cyan)] w-fit">
                  <QrCode size={20} />
                </div>
                <h3 className="font-bold text-sm text-[var(--color-text-primary)]">
                  Gate Attendance Report
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Real-time entry verification logs with exact check-in timestamps and admission status ({attendeesWithCheckIn.length} rows).
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => event && exportAttendanceReportCsv(event, attendeesWithCheckIn)}
                disabled={!event || attendeesWithCheckIn.length === 0}
                leftIcon={<Download size={14} />}
                className="w-full"
              >
                Download CSV
              </Button>
            </Card>
          </div>
        </div>

        {/* Section 2: Bulk Reminders & Communication Controls */}
        <Card className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-[var(--color-surface-3)]">
          <div className="space-y-1 max-w-xl">
            <div className="flex items-center gap-2">
              <Mail size={18} className="text-[var(--color-brand-cyan)]" />
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
            className="shrink-0"
          >
            Preview & Send Reminder
          </Button>
        </Card>

        {/* Reminder Preview & Confirmation Modal */}
        <AnimatePresence>
          {showReminderModal && event && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="max-w-lg w-full bg-[var(--color-surface-1)] border border-[var(--color-surface-3)] rounded-2xl p-6 flex flex-col gap-4 shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-[var(--color-surface-3)] pb-3">
                  <div className="flex items-center gap-2">
                    <Mail size={18} className="text-[var(--color-brand-cyan)]" />
                    <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                      Event Reminder Preview
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowReminderModal(false)}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] p-1"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-xs space-y-2">
                  <p>
                    <strong className="text-[var(--color-text-primary)]">Subject:</strong> Reminder: {event.title} is coming up!
                  </p>
                  <p>
                    <strong className="text-[var(--color-text-primary)]">Recipients:</strong> {confirmedAttendees} confirmed ticket holders
                  </p>
                  <p className="text-[var(--color-text-muted)]">
                    Event Date: {formattedDate} at {event.venue_name}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="custom_note"
                    className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2"
                  >
                    Custom Organizer Note (Optional)
                  </label>
                  <textarea
                    id="custom_note"
                    rows={3}
                    placeholder="e.g. Please bring your college ID card and arrive 15 minutes before opening."
                    value={customReminderNote}
                    onChange={(e) => setCustomReminderNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-cyan)] transition-colors"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
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
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
