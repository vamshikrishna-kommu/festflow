import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, Link } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Copy,
  ArrowLeft,
  Calendar,
  MapPin,
  RefreshCw,
  KeyRound,
  ExternalLink,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'
import { Button, Card, Badge } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { getEventById } from '@/lib/events'
import {
  checkInTicket,
  getEventRegistrationsWithCheckIn,
  cleanTicketPayload,
} from '@/lib/checkin'
import { QrCameraScanner } from '@/components/checkin/QrCameraScanner'
import { fadeIn } from '@/lib/animations'
import type {
  EventRecord,
  RegistrationWithCheckIn,
  CheckInResponse,
  CheckInStats,
} from '@/types'

export default function EventCheckInPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()

  const [event, setEvent] = useState<EventRecord | null>(null)
  const [attendees, setAttendees] = useState<RegistrationWithCheckIn[]>([])
  const [stats, setStats] = useState<CheckInStats>({
    totalCapacity: 0,
    confirmedRegistrations: 0,
    successfulCheckIns: 0,
    remainingExpected: 0,
    attendancePercentage: 0,
  })

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Scanner & Manual Entry
  const [manualCode, setManualCode] = useState('')
  const [processingScan, setProcessingScan] = useState(false)
  const [scanResult, setScanResult] = useState<CheckInResponse | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Attendee Table Filtering
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState<'all' | 'checked_in' | 'not_checked_in' | 'cancelled'>('all')

  const resultBannerRef = useRef<HTMLDivElement>(null)

  const loadData = async (isSilent = false) => {
    if (!id) return
    if (!isSilent) setLoading(true)
    else setRefreshing(true)

    const [eventRes, rosterRes] = await Promise.all([
      getEventById(id),
      getEventRegistrationsWithCheckIn(id),
    ])

    if (!isSilent) setLoading(false)
    else setRefreshing(false)

    if (eventRes.event) setEvent(eventRes.event)
    if (rosterRes.registrations) setAttendees(rosterRes.registrations)
    if (rosterRes.stats) setStats(rosterRes.stats)
  }

  useEffect(() => {
    loadData()
  }, [id, user])

  // Handle Scan or Manual Check-In
  const handleCheckInAttempt = async (ticketCode: string) => {
    if (!id || processingScan) return
    const clean = cleanTicketPayload(ticketCode)
    if (!clean) return

    setProcessingScan(true)
    const result = await checkInTicket(id, clean)
    setProcessingScan(false)
    setScanResult(result)

    // Scroll result into view
    setTimeout(() => {
      resultBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 100)

    // Refresh roster stats on success
    if (result.success || result.outcome === 'ALREADY_USED') {
      await loadData(true)
    }
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualCode.trim()) return
    await handleCheckInAttempt(manualCode)
    setManualCode('')
  }

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  // Filtered Attendees Roster
  const filteredAttendees = useMemo(() => {
    return attendees.filter((a) => {
      const isCheckedIn = Boolean(a.check_in)
      const isCancelled = a.status === 'cancelled'

      let matchesTab = true
      if (filterTab === 'checked_in') matchesTab = isCheckedIn
      else if (filterTab === 'not_checked_in') matchesTab = !isCheckedIn && a.status === 'confirmed'
      else if (filterTab === 'cancelled') matchesTab = isCancelled

      const q = searchQuery.trim().toLowerCase()
      const matchesSearch =
        !q ||
        a.ticket_code.toLowerCase().includes(q) ||
        a.student.display_name.toLowerCase().includes(q) ||
        a.student.email.toLowerCase().includes(q)

      return matchesTab && matchesSearch
    })
  }, [attendees, filterTab, searchQuery])

  // Formatted date and time
  const startDate = event ? new Date(event.start_date) : null
  const formattedDate = startDate
    ? startDate.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : ''
  const formattedTime = startDate
    ? startDate.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
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
          <span className="text-[var(--color-text-primary)] font-medium">Gate QR Check-In</span>
        </div>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold font-display text-[var(--color-text-primary)]">
                Live Gate Check-In
              </h1>
              <Badge variant="cyan" className="flex items-center gap-1">
                <ShieldCheck size={12} /> Staff Scanner
              </Badge>
            </div>
            {event && (
              <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-[var(--color-text-primary)]">{event.title}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar size={13} /> {formattedDate} at {formattedTime}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin size={13} /> {event.venue_name}
                </span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
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
              <Link to={`/club/events/${event.id}/registrations`}>
                <Button variant="ghost" size="sm" rightIcon={<ExternalLink size={14} />}>
                  Roster
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4 flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Successful Check-Ins
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-emerald-400 mt-2">
              {loading ? '…' : stats.successfulCheckIns}
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)] mt-1">
              verified entrance entries
            </span>
          </Card>

          <Card className="p-4 flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Remaining Expected
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-amber-400 mt-2">
              {loading ? '…' : stats.remainingExpected}
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)] mt-1">
              out of {stats.confirmedRegistrations} confirmed
            </span>
          </Card>

          <Card className="p-4 flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Turnout Rate
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-[var(--color-brand-cyan)] mt-2">
              {loading ? '…' : `${stats.attendancePercentage}%`}
            </div>
            {/* Progress bar */}
            <div className="w-full bg-[var(--color-surface-2)] h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className="bg-[var(--color-brand-cyan)] h-full transition-all duration-500 rounded-full"
                style={{ width: `${Math.min(100, stats.attendancePercentage)}%` }}
              />
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Total Capacity
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-[var(--color-text-primary)] mt-2">
              {loading ? '…' : stats.totalCapacity}
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)] mt-1">
              venue seat maximum
            </span>
          </Card>
        </div>

        {/* Scan Result Banner (High-Contrast Feedback) */}
        <div ref={resultBannerRef}>
          <AnimatePresence>
            {scanResult && (
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className={`p-6 rounded-2xl border text-left shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  scanResult.outcome === 'VALID'
                    ? 'bg-emerald-950/90 border-emerald-500 text-white'
                    : scanResult.outcome === 'ALREADY_USED'
                    ? 'bg-amber-950/90 border-amber-500 text-white'
                    : 'bg-rose-950/90 border-rose-500 text-white'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-2xl bg-black/40 shrink-0 mt-0.5">
                    {scanResult.outcome === 'VALID' ? (
                      <CheckCircle2 size={32} className="text-emerald-400" />
                    ) : scanResult.outcome === 'ALREADY_USED' ? (
                      <AlertTriangle size={32} className="text-amber-400" />
                    ) : (
                      <XCircle size={32} className="text-rose-400" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-extrabold uppercase tracking-wide">
                        {scanResult.outcome === 'VALID'
                          ? 'Valid Ticket — Entry Approved'
                          : scanResult.outcome === 'ALREADY_USED'
                          ? 'Ticket Already Checked In'
                          : 'Entry Denied'}
                      </span>
                      {scanResult.ticket_code && (
                        <span className="px-2 py-0.5 rounded bg-black/50 font-mono text-xs font-bold">
                          {scanResult.ticket_code}
                        </span>
                      )}
                    </div>

                    {scanResult.student_name && (
                      <p className="text-sm font-semibold">
                        Attendee: {scanResult.student_name}
                      </p>
                    )}

                    <p className="text-xs opacity-90 max-w-xl leading-relaxed">
                      {scanResult.message}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setScanResult(null)}
                    className="border-white/30 text-white hover:bg-white/10"
                  >
                    Dismiss
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Scanner & Manual Fallback Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: QR Camera Scanner */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <Card className="p-6 flex flex-col items-center text-center">
              <QrCameraScanner
                onScan={handleCheckInAttempt}
                isProcessing={processingScan}
              />
            </Card>

            {/* Manual Code Entry Form */}
            <Card className="p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2 flex items-center gap-1.5">
                <KeyRound size={14} className="text-[var(--color-brand-cyan)]" />
                Manual Code Entry Fallback
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mb-3">
                If the camera cannot read the attendee's screen, enter their ticket code manually:
              </p>

              <form onSubmit={handleManualSubmit} className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. TKT-INNOVATE-2026"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] font-mono focus:outline-none focus:border-[var(--color-brand-cyan)] transition-colors"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={processingScan}
                  disabled={!manualCode.trim()}
                >
                  Verify
                </Button>
              </form>
            </Card>
          </div>

          {/* Right Column: Searchable Attendee List & Gate Action */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <Card className="p-5 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold font-display text-[var(--color-text-primary)]">
                    Attendee Gate Roster
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Real-time check-in status for all registered passes
                  </p>
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-64">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                  />
                  <input
                    type="text"
                    placeholder="Search name or ticket code…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-cyan)] transition-colors"
                  />
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-[var(--color-surface-2)] p-1 rounded-xl text-xs overflow-x-auto">
                {(
                  [
                    { id: 'all', label: `All (${attendees.length})` },
                    { id: 'checked_in', label: `Checked In (${stats.successfulCheckIns})` },
                    { id: 'not_checked_in', label: `Expected (${stats.remainingExpected})` },
                    { id: 'cancelled', label: 'Cancelled' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterTab(tab.id)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                      filterTab === tab.id
                        ? 'bg-[var(--color-surface-4)] text-[var(--color-text-primary)] font-semibold shadow'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Attendee Roster Rows */}
              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 rounded-full border-2 border-[var(--color-surface-3)] border-t-[var(--color-brand-cyan)] animate-spin" />
                  <span className="text-xs text-[var(--color-text-muted)]">Loading roster…</span>
                </div>
              ) : filteredAttendees.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--color-text-muted)]">
                  No attendees matching current filter.
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto flex flex-col gap-2 pr-1">
                  {filteredAttendees.map((att) => {
                    const isCheckedIn = Boolean(att.check_in)
                    const isCancelled = att.status === 'cancelled'

                    return (
                      <div
                        key={att.id}
                        className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left ${
                          isCheckedIn
                            ? 'bg-emerald-500/[0.04] border-emerald-500/20'
                            : isCancelled
                            ? 'bg-rose-500/[0.04] border-rose-500/20 opacity-70'
                            : 'bg-[var(--color-surface-2)]/60 border-[var(--color-surface-3)] hover:border-[var(--color-brand-purple)]/40'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[var(--color-text-primary)]">
                              {att.student.display_name}
                            </span>
                            {isCheckedIn ? (
                              <Badge variant="success" className="text-[10px] py-0">
                                Checked In
                              </Badge>
                            ) : isCancelled ? (
                              <Badge variant="danger" className="text-[10px] py-0">
                                Cancelled
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] py-0">
                                Expected
                              </Badge>
                            )}
                          </div>

                          <div className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-2 flex-wrap font-mono">
                            <button
                              type="button"
                              onClick={() => handleCopy(att.ticket_code)}
                              className="hover:text-[var(--color-brand-cyan)] transition-colors flex items-center gap-1"
                              title="Click to copy code"
                            >
                              <span>{att.ticket_code}</span>
                              {copiedCode === att.ticket_code ? (
                                <CheckCircle2 size={11} className="text-emerald-400" />
                              ) : (
                                <Copy size={11} />
                              )}
                            </button>
                            {att.check_in && (
                              <span className="text-emerald-400 font-sans">
                                • In at{' '}
                                {new Date(att.check_in.checked_in_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action: Manual Check-In */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isCheckedIn ? (
                            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                              <CheckCircle2 size={14} /> Admitted
                            </span>
                          ) : !isCancelled && att.status === 'confirmed' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={processingScan}
                              onClick={() => handleCheckInAttempt(att.ticket_code)}
                              leftIcon={<UserCheck size={13} />}
                              className="text-xs hover:border-emerald-500 hover:text-emerald-300"
                            >
                              Check In
                            </Button>
                          ) : (
                            <span className="text-xs text-[var(--color-text-muted)]">Ineligible</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
