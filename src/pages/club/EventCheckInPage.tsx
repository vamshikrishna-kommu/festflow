import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, Link } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Copy,
  RefreshCw,
  KeyRound,
  ExternalLink,
  UserCheck,
  Users,
  ChevronDown,
  ChevronUp,
  History,
  WifiOff,
  RotateCcw,
  LogIn,
  LogOut,
} from 'lucide-react'
import { Button, Card, Badge, PageHeader } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/context/AuthContext'
import { getEventById } from '@/lib/events'
import {
  checkInTicket,
  checkOutTicket,
  getEventRegistrationsWithCheckIn,
  cleanTicketPayload,
} from '@/lib/checkin'
import { subscribeToStatusChanges } from '@/lib/sync'
import { QrCameraScanner } from '@/components/checkin/QrCameraScanner'
import { scannerAccepted, scannerRejected } from '@/lib/animations'
import type {
  EventRecord,
  RegistrationWithCheckIn,
  CheckInResponse,
  CheckInStats,
  CheckInOutcome,
} from '@/types'

interface ScanHistoryItem {
  id: string
  ticketCode: string
  studentName?: string
  outcome: CheckInOutcome
  message: string
  timestamp: string
  mode?: 'check_in' | 'check_out'
  isNetworkError?: boolean
}

export default function EventCheckInPage() {
  const { id } = useParams<{ id: string }>()
  const { user, role } = useAuth()

  const [event, setEvent] = useState<EventRecord | null>(null)
  const [attendees, setAttendees] = useState<RegistrationWithCheckIn[]>([])
  const [stats, setStats] = useState<CheckInStats>({
    totalCapacity: 0,
    confirmedRegistrations: 0,
    checkedInCount: 0,
    checkedOutCount: 0,
    notCheckedInCount: 0,
    successfulCheckIns: 0,
    remainingExpected: 0,
    attendancePercentage: 0,
  })

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const isAuthorized = Boolean(event && ((user && event.club_id === user.id) || role === 'platform_admin'))

  // Scanner Mode & Manual Entry
  const [scannerMode, setScannerMode] = useState<'check_in' | 'check_out'>('check_in')
  const [manualCode, setManualCode] = useState('')
  const [processingScan, setProcessingScan] = useState(false)
  const [scanResult, setScanResult] = useState<CheckInResponse | null>(null)
  const [lastAttemptedCode, setLastAttemptedCode] = useState<string>('')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Team expand states
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({})

  // Scan History Activity Log
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)

  // Attendee Table Filtering
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState<'all' | 'checked_in' | 'checked_out' | 'not_checked_in' | 'ineligible'>('all')

  const resultBannerRef = useRef<HTMLDivElement>(null)
  const manualInputRef = useRef<HTMLInputElement>(null)

  const loadData = async (isSilent = false) => {
    if (!id) return
    if (!isSilent) setLoading(true)
    else setRefreshing(true)
    setLoadError(null)

    const [eventRes, rosterRes] = await Promise.all([
      getEventById(id),
      getEventRegistrationsWithCheckIn(id),
    ])

    if (!isSilent) setLoading(false)
    else setRefreshing(false)

    if (eventRes.error) {
      setLoadError(eventRes.error)
    } else if (eventRes.event) {
      setEvent(eventRes.event)
      const authorized = (user && eventRes.event.club_id === user.id) || role === 'platform_admin'
      if (!authorized) {
        setLoadError('You are not authorized to check in attendees for this event.')
      }
    } else {
      setLoadError('Event could not be found.')
    }

    if (rosterRes.registrations) setAttendees(rosterRes.registrations)
    if (rosterRes.stats) setStats(rosterRes.stats)
  }

  useEffect(() => {
    loadData()

    const unsubscribe = subscribeToStatusChanges(
      ['checkin_recorded', 'registration_updated', 'reconnect'],
      (e) => {
        if (!e.eventId || e.eventId === id) {
          loadData(true)
        }
      }
    )
    return () => unsubscribe()
  }, [id, user, role])

  // Handle Scan or Manual Check-In / Check-Out
  const handleScanAttempt = async (ticketCode: string, overrideMode?: 'check_in' | 'check_out') => {
    if (!id || processingScan) return
    const clean = cleanTicketPayload(ticketCode)
    if (!clean) return

    const mode = overrideMode || scannerMode
    setLastAttemptedCode(clean)
    setProcessingScan(true)
    const result = mode === 'check_out'
      ? await checkOutTicket(id, clean)
      : await checkInTicket(id, clean)
    setProcessingScan(false)
    setScanResult(result)

    // Add to gate scan history feed
    setScanHistory((prev) => [
      {
        id: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        ticketCode: result.ticket_code || clean,
        studentName: result.student_name,
        outcome: result.outcome,
        message: result.message,
        mode,
        isNetworkError: result.isNetworkError,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      },
      ...prev.slice(0, 14), // keep latest 15
    ])

    // Scroll result banner into view
    setTimeout(() => {
      resultBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 100)

    // Refresh roster on success, duplicate, or checked-out
    if (result.success || result.outcome === 'ALREADY_USED' || result.outcome === 'ALREADY_CHECKED_OUT') {
      await loadData(true)
    }
  }

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualCode.trim()) return
    await handleScanAttempt(manualCode)
    setManualCode('')
  }

  const handleFocusManual = () => {
    manualInputRef.current?.focus()
    manualInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const toggleTeamExpand = (regId: string) => {
    setExpandedTeams((prev) => ({ ...prev, [regId]: !prev[regId] }))
  }

  // Filtered Attendees Roster
  const filteredAttendees = useMemo(() => {
    return attendees.filter((a) => {
      const isCheckedIn = Boolean(a.check_in && a.check_in.status !== 'checked_out')
      const isCheckedOut = Boolean(a.check_in && a.check_in.status === 'checked_out')
      const isCancelled = a.status === 'cancelled'
      const isIneligible = isCancelled || a.status === 'rejected' || a.status === 'pending_payment' || a.status === 'pending_approval'

      let matchesTab = true
      if (filterTab === 'checked_in') matchesTab = isCheckedIn
      else if (filterTab === 'checked_out') matchesTab = isCheckedOut
      else if (filterTab === 'not_checked_in') matchesTab = !a.check_in && a.status === 'confirmed'
      else if (filterTab === 'ineligible') matchesTab = isIneligible

      const q = searchQuery.trim().toLowerCase()
      const studentName = a.student?.display_name || (a.team_name ? `Team ${a.team_name}` : 'Student Attendee')
      const studentEmail = a.student?.email || ''
      const teamMembers = Array.isArray(a.team_members) ? (a.team_members as any[]) : []
      const memberNames = teamMembers.map((m) => m?.name || '').join(' ')
      const memberEmails = teamMembers.map((m) => m?.email || '').join(' ')

      const matchesSearch =
        !q ||
        (a.ticket_code && a.ticket_code.toLowerCase().includes(q)) ||
        (a.qr_token && a.qr_token.toLowerCase().includes(q)) ||
        studentName.toLowerCase().includes(q) ||
        studentEmail.toLowerCase().includes(q) ||
        Boolean(a.team_name && a.team_name.toLowerCase().includes(q)) ||
        memberNames.toLowerCase().includes(q) ||
        memberEmails.toLowerCase().includes(q)

      return matchesTab && matchesSearch
    })
  }, [attendees, filterTab, searchQuery])



  // Loading state
  if (loading && !refreshing) {
    return (
      <div className="min-h-screen pt-32 pb-24 px-4 bg-[var(--color-surface-0)] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-[var(--color-surface-3)] border-t-[#18CFFC] animate-spin" />
        <span className="text-sm text-[var(--color-text-muted)]">Loading gate scanner & attendee roster…</span>
      </div>
    )
  }

  // Event not found state
  if (!loading && !event) {
    return (
      <div className="min-h-screen pt-32 pb-24 px-4 bg-[var(--color-surface-0)] flex items-center justify-center">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
            <AlertTriangle size={28} />
          </div>
          <h2 className="text-xl font-bold font-display text-[var(--color-text-primary)]">
            Event Not Found
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            {loadError || 'The requested event could not be found or failed to load.'}
          </p>
          <div className="pt-2">
            <Link to="/club/events">
              <Button variant="primary" size="sm">
                Back to My Events
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  // Unauthorized access state
  if (!loading && event && !isAuthorized) {
    return (
      <div className="min-h-screen pt-32 pb-24 px-4 bg-[var(--color-surface-0)] flex items-center justify-center">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
            <XCircle size={28} />
          </div>
          <h2 className="text-xl font-bold font-display text-[var(--color-text-primary)]">
            Unauthorized Gate Access
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            You are not authorized to check in attendees for this event. Only the hosting club organizer or designated event staff may access the gate scanner.
          </p>
          <div className="pt-2">
            <Link to="/club/events">
              <Button variant="primary" size="sm">
                Return to My Events
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

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
    <PageShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 text-left">
        {/* Page Header */}
        <PageHeader
          breadcrumbs={[
            { label: 'Club Dashboard', href: '/club/dashboard' },
            { label: 'My Events', href: '/club/events' },
            { label: 'Gate QR Check-In' },
          ]}
          title="Live Gate Check-In"
          badge={event?.status === 'cancelled' ? 'Event Cancelled' : 'Staff Scanner'}
          badgeVariant={event?.status === 'cancelled' ? 'danger' : 'cyan'}
          subtitle={
            event
              ? `${event.title} • ${formattedDate} at ${formattedTime} • ${event.venue_name || 'Online'}`
              : undefined
          }
          actions={
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
          }
        />

        {/* Live Attendance Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="p-4 flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Admitted Inside
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-emerald-400 mt-2">
              {loading ? '…' : (stats.checkedInCount ?? stats.successfulCheckIns)}
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)] mt-1">
              currently inside venue
            </span>
          </Card>

          <Card className="p-4 flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Checked Out
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-amber-400 mt-2">
              {loading ? '…' : (stats.checkedOutCount ?? 0)}
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)] mt-1">
              exited attendees {event?.allow_reentry ? '(re-entry allowed)' : ''}
            </span>
          </Card>

          <Card className="p-4 flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Yet to Arrive
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-[#18CFFC] mt-2">
              {loading ? '…' : (stats.notCheckedInCount ?? stats.remainingExpected)}
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)] mt-1">
              out of {stats.confirmedRegistrations} confirmed
            </span>
          </Card>

          <Card className="p-4 flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              Event Capacity
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold font-display text-[var(--color-text-primary)] mt-2">
              {loading ? '…' : stats.totalCapacity}
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)] mt-1">
              venue seat maximum ({stats.attendancePercentage}% turnout)
            </span>
          </Card>
        </div>

        {/* Scan Result Banner (High-Contrast Gate Feedback) */}
        <div ref={resultBannerRef}>
          <AnimatePresence>
            {scanResult && (
              <motion.div
                variants={scanResult.outcome === 'VALID' || scanResult.outcome === 'CHECKED_OUT' ? scannerAccepted : scannerRejected}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className={`p-6 rounded-2xl border text-left shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  scanResult.outcome === 'VALID'
                    ? 'bg-emerald-950/90 border-emerald-500 text-white'
                    : scanResult.outcome === 'CHECKED_OUT'
                    ? 'bg-amber-950/90 border-amber-500 text-white'
                    : scanResult.outcome === 'ALREADY_USED' || scanResult.outcome === 'ALREADY_CHECKED_OUT' || scanResult.outcome === 'NOT_CHECKED_IN'
                    ? 'bg-amber-950/90 border-amber-500 text-white'
                    : scanResult.isNetworkError
                    ? 'bg-blue-950/90 border-[#18CFFC] text-white'
                    : 'bg-rose-950/90 border-rose-500 text-white'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-2xl bg-black/40 shrink-0 mt-0.5">
                    {scanResult.outcome === 'VALID' ? (
                      <CheckCircle2 size={32} className="text-emerald-400" />
                    ) : scanResult.outcome === 'CHECKED_OUT' ? (
                      <LogOut size={32} className="text-amber-400" />
                    ) : scanResult.outcome === 'ALREADY_USED' || scanResult.outcome === 'ALREADY_CHECKED_OUT' || scanResult.outcome === 'NOT_CHECKED_IN' ? (
                      <AlertTriangle size={32} className="text-amber-400" />
                    ) : scanResult.isNetworkError ? (
                      <WifiOff size={32} className="text-[#18CFFC]" />
                    ) : (
                      <XCircle size={32} className="text-rose-400" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-extrabold uppercase tracking-wide">
                        {scanResult.outcome === 'VALID'
                          ? (scanResult.is_reentry ? `Re-Entry Approved (Entry #${scanResult.entry_count})` : 'Valid Ticket — Entry Approved')
                          : scanResult.outcome === 'CHECKED_OUT'
                          ? 'Attendee Checked Out (Exit Logged)'
                          : scanResult.outcome === 'ALREADY_USED'
                          ? 'Pass Already Checked In'
                          : scanResult.outcome === 'ALREADY_CHECKED_OUT'
                          ? 'Attendee Already Checked Out'
                          : scanResult.outcome === 'NOT_CHECKED_IN'
                          ? 'Cannot Check Out — Not Checked In'
                          : scanResult.isNetworkError
                          ? 'Network Connectivity Issue'
                          : scanResult.outcome === 'WRONG_EVENT'
                          ? 'Wrong Event Pass'
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
                  {scanResult.isNetworkError && lastAttemptedCode && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleScanAttempt(lastAttemptedCode)}
                      leftIcon={<RotateCcw size={14} />}
                      className="bg-[#18CFFC] hover:bg-[#07A4FC] text-black font-semibold border-none"
                    >
                      Retry
                    </Button>
                  )}
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
          {/* Left Column: QR Camera Scanner & Manual Lookup */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Gate Scanner Mode Switcher (Check-In vs Check-Out) */}
            <div className="flex items-center justify-between p-1.5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)]">
              <button
                type="button"
                onClick={() => setScannerMode('check_in')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                  scannerMode === 'check_in'
                    ? 'bg-emerald-500 text-black shadow-lg scale-[1.02]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                <LogIn size={15} />
                Entry Gate (Check-In)
              </button>
              <button
                type="button"
                onClick={() => setScannerMode('check_out')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                  scannerMode === 'check_out'
                    ? 'bg-amber-500 text-black shadow-lg scale-[1.02]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                <LogOut size={15} />
                Exit Gate (Check-Out)
              </button>
            </div>

            <Card className="p-6 flex flex-col items-center text-center">
              <QrCameraScanner
                onScan={handleScanAttempt}
                isProcessing={processingScan}
                onFocusManual={handleFocusManual}
              />
              <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
                <span className={`w-2 h-2 rounded-full ${scannerMode === 'check_in' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span>
                  Gate Mode: <strong className="text-[var(--color-text-primary)]">{scannerMode === 'check_in' ? 'Check-In (Admission)' : 'Check-Out (Departure)'}</strong>
                </span>
              </div>
            </Card>

            {/* Manual Code Entry Form Fallback */}
            <Card className="p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2 flex items-center gap-1.5">
                <KeyRound size={14} className="text-[#18CFFC]" />
                Manual Code Entry ({scannerMode === 'check_in' ? 'Check-In' : 'Check-Out'})
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mb-3">
                If the camera cannot read the attendee's screen, enter their ticket code or pass token manually:
              </p>

              <form onSubmit={handleManualSubmit} className="flex flex-col sm:flex-row gap-2">
                <input
                  ref={manualInputRef}
                  type="text"
                  placeholder="e.g. TKT-INNOVATE-2026 or FFQ_…"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] font-mono focus:outline-none focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC] transition-colors min-h-[40px]"
                />
                <Button
                  type="submit"
                  variant={scannerMode === 'check_in' ? 'primary' : 'outline'}
                  size="sm"
                  isLoading={processingScan}
                  disabled={!manualCode.trim()}
                  className={`w-full sm:w-auto min-h-[44px] ${scannerMode === 'check_out' ? 'border-amber-500 text-amber-300 hover:bg-amber-500/20' : ''}`}
                >
                  {scannerMode === 'check_in' ? 'Verify Entry' : 'Verify Exit'}
                </Button>
              </form>
            </Card>

            {/* Recent Gate Scan Activity Log */}
            {scanHistory.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] flex items-center gap-1.5">
                    <History size={14} className="text-[#18CFFC]" />
                    Recent Gate Scans ({scanHistory.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-xs text-[#18CFFC] hover:text-[#18CFFC] hover:underline flex items-center gap-0.5"
                  >
                    {showHistory ? 'Collapse' : 'Expand'}
                    {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>

                <div className={`space-y-2 ${showHistory ? 'max-h-60 overflow-y-auto' : 'max-h-28 overflow-hidden'}`}>
                  {scanHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-2 rounded-lg bg-[var(--color-surface-2)]/70 border border-[var(--color-surface-3)] text-xs flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          item.outcome === 'VALID'
                            ? 'bg-emerald-400'
                            : item.outcome === 'CHECKED_OUT'
                            ? 'bg-amber-400'
                            : item.outcome === 'ALREADY_USED' || item.outcome === 'ALREADY_CHECKED_OUT' || item.outcome === 'NOT_CHECKED_IN'
                            ? 'bg-amber-400'
                            : 'bg-rose-400'
                        }`} />
                        <span className="font-mono text-[11px] font-semibold text-[var(--color-text-primary)] truncate">
                          {item.ticketCode}
                        </span>
                        {item.mode && (
                          <span className={`text-[9px] font-bold uppercase px-1 rounded ${item.mode === 'check_in' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {item.mode === 'check_in' ? 'IN' : 'OUT'}
                          </span>
                        )}
                        {item.studentName && (
                          <span className="text-[11px] text-[var(--color-text-muted)] truncate hidden sm:inline">
                            • {item.studentName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge
                          variant={item.outcome === 'VALID' ? 'success' : item.outcome === 'CHECKED_OUT' ? 'amber' : 'danger'}
                          className="text-[9px] py-0 px-1.5"
                        >
                          {item.outcome}
                        </Badge>
                        <span className="text-[10px] text-[var(--color-text-muted)]">
                          {item.timestamp}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Right Column: Searchable Attendee List & Gate Actions */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <Card className="p-5 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold font-display text-[var(--color-text-primary)]">
                    Attendee Gate Roster
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Real-time attendance status and venue management
                  </p>
                </div>

                {/* Instant Search */}
                <div className="relative w-full sm:w-64">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                  />
                  <input
                    type="text"
                    placeholder="Search name, email, or code…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC] transition-colors"
                  />
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-[#0E0E12] p-1 rounded-xl text-xs overflow-x-auto no-scrollbar touch-pan-x border border-white/5">
                {(
                  [
                    { id: 'all', label: `All (${attendees.length})` },
                    { id: 'checked_in', label: `Inside (${stats.checkedInCount ?? stats.successfulCheckIns})` },
                    { id: 'checked_out', label: `Checked Out (${stats.checkedOutCount ?? 0})` },
                    { id: 'not_checked_in', label: `Not Arrived (${stats.notCheckedInCount ?? stats.remainingExpected})` },
                    { id: 'ineligible', label: 'Ineligible' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterTab(tab.id)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap min-h-[36px] flex items-center justify-center ${
                      filterTab === tab.id
                        ? 'bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] text-white font-semibold shadow-[0_4px_16px_rgba(24,207,252,0.3)]'
                        : 'text-[var(--color-text-muted)] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Attendee Roster Rows */}
              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 rounded-full border-2 border-[var(--color-surface-3)] border-t-[#18CFFC] animate-spin" />
                  <span className="text-xs text-[var(--color-text-muted)]">Loading roster…</span>
                </div>
              ) : attendees.length === 0 ? (
                <div className="py-14 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-[var(--color-surface-3)] text-[var(--color-text-muted)] flex items-center justify-center mx-auto">
                    <UserCheck size={20} />
                  </div>
                  <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                    No Registered Attendees Yet
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)] max-w-xs mx-auto">
                    Students who register for this event will appear in this check-in roster.
                  </p>
                </div>
              ) : filteredAttendees.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--color-text-muted)]">
                  No attendees matching current filter or search query.
                </div>
              ) : (
                <div className="max-h-[520px] overflow-y-auto flex flex-col gap-2.5 pr-1">
                  {filteredAttendees.map((att) => {
                    const latestCheckIn = att.check_in
                    const isCheckedIn = Boolean(latestCheckIn && latestCheckIn.status !== 'checked_out')
                    const isCheckedOut = Boolean(latestCheckIn && latestCheckIn.status === 'checked_out')
                    const isCancelled = att.status === 'cancelled'
                    const isIneligible = isCancelled || att.status === 'rejected' || att.status === 'pending_payment' || att.status === 'pending_approval'

                    const displayName =
                      att.student?.display_name ||
                      (att.team_name ? `Team ${att.team_name}` : 'Student Attendee')
                    const displayEmail = att.student?.email || ''

                    const teamMembers = Array.isArray(att.team_members) ? (att.team_members as any[]) : []
                    const hasTeamMembers = teamMembers.length > 0
                    const isTeamExpanded = Boolean(expandedTeams[att.id])

                    const memberCheckIns = att.check_ins || (att.check_in ? [att.check_in] : [])

                    return (
                      <div
                        key={att.id}
                        className={`p-3.5 rounded-xl border transition-all flex flex-col gap-2 text-left ${
                          isCheckedIn
                            ? 'bg-emerald-500/[0.04] border-emerald-500/20'
                            : isCheckedOut
                            ? 'bg-amber-500/[0.04] border-amber-500/20'
                            : isIneligible
                            ? 'bg-rose-500/[0.04] border-rose-500/20 opacity-75'
                            : 'bg-[#14141A] border-white/5 hover:border-[#18CFFC]/40'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-[var(--color-text-primary)]">
                                {displayName}
                              </span>
                              {isCheckedIn ? (
                                <Badge variant="success" className="text-[10px] py-0">
                                  Inside (Checked In)
                                </Badge>
                              ) : isCheckedOut ? (
                                <Badge variant="amber" className="text-[10px] py-0">
                                  Checked Out
                                </Badge>
                              ) : isCancelled ? (
                                <Badge variant="danger" className="text-[10px] py-0">
                                  Cancelled
                                </Badge>
                              ) : att.status === 'rejected' ? (
                                <Badge variant="danger" className="text-[10px] py-0">
                                  Rejected
                                </Badge>
                              ) : att.status === 'pending_payment' ? (
                                <Badge variant="amber" className="text-[10px] py-0">
                                  Payment Due
                                </Badge>
                              ) : att.status === 'pending_approval' ? (
                                <Badge variant="brand" className="text-[10px] py-0">
                                  Pending Review
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] py-0">
                                  Expected
                                </Badge>
                              )}

                              {hasTeamMembers && (
                                <Badge variant="brand" className="text-[10px] py-0 flex items-center gap-1">
                                  <Users size={10} /> {teamMembers.length} Members
                                </Badge>
                              )}
                            </div>

                            <div className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-2 flex-wrap font-mono">
                              <button
                                type="button"
                                onClick={() => handleCopy(att.ticket_code)}
                                className="hover:text-white transition-colors flex items-center gap-1"
                                title="Click to copy code"
                              >
                                <span>{att.ticket_code}</span>
                                {copiedCode === att.ticket_code ? (
                                  <CheckCircle2 size={11} className="text-emerald-400" />
                                ) : (
                                  <Copy size={11} />
                                )}
                              </button>
                              {displayEmail && (
                                <span className="text-[var(--color-text-secondary)] font-sans">
                                  • {displayEmail}
                                </span>
                              )}
                              {latestCheckIn && (
                                <span className={`font-sans ${isCheckedIn ? 'text-emerald-400' : 'text-amber-400'}`}>
                                  • {isCheckedIn ? 'In at ' : 'Out at '}
                                  {new Date(isCheckedIn ? latestCheckIn.checked_in_at : (latestCheckIn.checked_out_at || latestCheckIn.checked_in_at)).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action Button: Check In / Check Out / Re-admit */}
                          <div className="flex items-center gap-2 shrink-0">
                            {hasTeamMembers && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleTeamExpand(att.id)}
                                rightIcon={isTeamExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                className="text-xs"
                              >
                                Members
                              </Button>
                            )}

                            {isCheckedIn ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={processingScan}
                                onClick={() => handleScanAttempt(att.ticket_code, 'check_out')}
                                leftIcon={<LogOut size={13} />}
                                className="text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/20 min-h-[38px]"
                              >
                                Check Out
                              </Button>
                            ) : isCheckedOut ? (
                              event?.allow_reentry ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={processingScan}
                                  onClick={() => handleScanAttempt(att.ticket_code, 'check_in')}
                                  leftIcon={<LogIn size={13} />}
                                  className="text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20 min-h-[38px]"
                                >
                                  Re-admit
                                </Button>
                              ) : (
                                <span className="text-xs text-amber-400 font-medium">Exited (Single Entry)</span>
                              )
                            ) : !isIneligible && att.status === 'confirmed' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={processingScan}
                                onClick={() => handleScanAttempt(att.ticket_code, 'check_in')}
                                leftIcon={<UserCheck size={13} />}
                                className="text-xs hover:border-emerald-500 hover:text-emerald-300 min-h-[38px]"
                              >
                                Check In
                              </Button>
                            ) : (
                              <span className="text-xs text-[var(--color-text-muted)]">Ineligible</span>
                            )}
                          </div>
                        </div>

                        {/* Expandable Team Members Gate Sub-Roster */}
                        {hasTeamMembers && isTeamExpanded && (
                          <div className="mt-2 pt-2 border-t border-[var(--color-surface-3)]/60 space-y-1.5 pl-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] block">
                              Team Members Pass Verification & Attendance
                            </span>
                            {teamMembers.map((member, mIdx) => {
                              const memberIndex = mIdx + 1
                              const memberPassCode = `${att.ticket_code}-M${memberIndex}`
                              const memberCheckIn = memberCheckIns.find(
                                (c) => c.member_index === memberIndex
                              )
                              const memberIn = Boolean(memberCheckIn && memberCheckIn.status !== 'checked_out')
                              const memberOut = Boolean(memberCheckIn && memberCheckIn.status === 'checked_out')

                              return (
                                <div
                                  key={mIdx}
                                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-surface-3)] text-xs"
                                >
                                  <div className="space-y-0.5 truncate">
                                    <div className="flex items-center gap-1.5 truncate">
                                      <span className="font-semibold text-[var(--color-text-primary)] truncate">
                                        {member?.name || `Member #${memberIndex}`}
                                      </span>
                                      <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                                        ({memberPassCode})
                                      </span>
                                      {memberIn && (
                                        <Badge variant="success" className="text-[9px] py-0 px-1">Inside</Badge>
                                      )}
                                      {memberOut && (
                                        <Badge variant="amber" className="text-[9px] py-0 px-1">Exited</Badge>
                                      )}
                                    </div>
                                    {member?.email && (
                                      <span className="text-[11px] text-[var(--color-text-secondary)] block truncate">
                                        {member.email}
                                      </span>
                                    )}
                                  </div>

                                  <div className="shrink-0 flex items-center gap-1.5">
                                    {memberIn ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={processingScan}
                                        onClick={() => handleScanAttempt(memberPassCode, 'check_out')}
                                        className="text-[11px] py-1 px-2 border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
                                      >
                                        Check Out
                                      </Button>
                                    ) : memberOut ? (
                                      event?.allow_reentry ? (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          disabled={processingScan}
                                          onClick={() => handleScanAttempt(memberPassCode, 'check_in')}
                                          className="text-[11px] py-1 px-2 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20"
                                        >
                                          Re-admit
                                        </Button>
                                      ) : (
                                        <span className="text-[10px] text-amber-400">Exited</span>
                                      )
                                    ) : att.status === 'confirmed' ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={processingScan}
                                        onClick={() => handleScanAttempt(memberPassCode, 'check_in')}
                                        className="text-[11px] py-1 px-2.5 hover:border-emerald-500 hover:text-emerald-300"
                                      >
                                        Check In
                                      </Button>
                                    ) : (
                                      <span className="text-[11px] text-[var(--color-text-muted)]">Ineligible</span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
