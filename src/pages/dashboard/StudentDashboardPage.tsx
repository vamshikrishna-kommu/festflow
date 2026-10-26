import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  GraduationCap,
  Ticket,
  LogOut,
  Compass,
  AlertTriangle,
  Clock,
  MapPin,
  CheckCircle2,
  Lock,
  XCircle,
  QrCode,
  ArrowRight,
  Users,
  RefreshCw,
} from 'lucide-react'
import { Button, Badge, Card } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/context/AuthContext'
import { Link } from 'react-router'
import { fadeIn, staggerContainer } from '@/lib/animations'
import { getStudentRegistrations, cancelRegistration } from '@/lib/registrations'
import type { RegistrationWithEvent } from '@/types'

export default function StudentDashboardPage() {
  const { user, profile, studentProfile, signOut } = useAuth()

  const [registrations, setRegistrations] = useState<RegistrationWithEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'upcoming' | 'pending_approval' | 'pending_payment' | 'past' | 'cancelled'>('upcoming')

  // Cancellation modal
  const [cancellingReg, setCancellingReg] = useState<RegistrationWithEvent | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [notice, setNotice] = useState<{ message: string; isError?: boolean } | null>(null)

  const displayName = profile?.display_name || 'FestFlow Student'
  const college = studentProfile?.college_name || 'Campus Student'

  const loadRegistrations = async () => {
    if (!user) return
    setLoading(true)
    const res = await getStudentRegistrations(user.id)
    setLoading(false)
    if (res.registrations) {
      setRegistrations(res.registrations)
    }
  }

  useEffect(() => {
    loadRegistrations()
  }, [user])

  const now = new Date()

  // Filter registrations by category tab
  const filteredList = useMemo(() => {
    return registrations.filter((r) => {
      const hasValidDate = Boolean(r.event?.start_date)
      const eventStart = hasValidDate ? new Date(r.event!.start_date) : null
      const isUpcoming = eventStart ? eventStart >= now : false
      const isPast = eventStart ? eventStart < now : false

      if (tab === 'upcoming') {
        // Only confirmed passes for valid upcoming events
        return r.status === 'confirmed' && isUpcoming
      }
      if (tab === 'pending_approval') {
        return r.status === 'pending_approval'
      }
      if (tab === 'pending_payment') {
        return r.status === 'pending_payment'
      }
      if (tab === 'past') {
        // Confirmed passes where event has concluded or date is unavailable
        return r.status === 'confirmed' && (isPast || !hasValidDate)
      }
      if (tab === 'cancelled') {
        return r.status === 'cancelled' || r.status === 'rejected'
      }
      return true
    })
  }, [registrations, tab, now])

  // Count summaries
  const upcomingCount = registrations.filter(
    (r) => r.status === 'confirmed' && Boolean(r.event?.start_date) && new Date(r.event!.start_date) >= now
  ).length
  const pendingApprovalCount = registrations.filter((r) => r.status === 'pending_approval').length
  const pendingPaymentCount = registrations.filter((r) => r.status === 'pending_payment').length
  const pastCount = registrations.filter(
    (r) => r.status === 'confirmed' && (!r.event?.start_date || new Date(r.event!.start_date) < now)
  ).length
  const cancelledCount = registrations.filter(
    (r) => r.status === 'cancelled' || r.status === 'rejected'
  ).length

  const handleCancelPass = async () => {
    if (!cancellingReg) return
    setActionLoading(true)
    const res = await cancelRegistration(cancellingReg.id)
    setActionLoading(false)
    setCancellingReg(null)

    if (res.success) {
      setNotice({ message: 'Your event pass has been cancelled.', isError: false })
      loadRegistrations()
    } else {
      setNotice({ message: res.message, isError: true })
    }
  }

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8 text-left">
        {/* Top Header Card */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="glass p-4 sm:p-6 md:p-8 rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.1)] flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-xl relative overflow-hidden"
        >
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="w-13 h-13 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[var(--color-brand-cyan)] to-[var(--color-brand-purple)] flex items-center justify-center text-white shadow-lg shadow-[var(--color-brand-cyan)]/20 shrink-0">
              <GraduationCap size={28} className="sm:w-8 sm:h-8" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-display text-[var(--color-text-primary)] truncate">
                  {displayName}
                </h1>
                <Badge variant="cyan" className="shrink-0 text-[10px] sm:text-xs">Student Pass</Badge>
              </div>
              <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] truncate">
                {college} • {profile?.email}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 pt-2 md:pt-0 border-t md:border-t-0 border-[oklch(100%_0_0_/_0.06)]">
            <Button
              variant="outline"
              size="sm"
              onClick={loadRegistrations}
              disabled={loading}
              className="flex-1 sm:flex-initial justify-center"
              leftIcon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
              title="Refresh your passes and application status"
            >
              Refresh
            </Button>
            <Link to="/discover" className="flex-1 sm:flex-initial">
              <Button variant="ghost" size="sm" className="w-full justify-center" leftIcon={<Compass size={15} />}>
                Discover
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut()}
              leftIcon={<LogOut size={15} />}
              className="text-rose-400 hover:text-rose-300 hover:border-rose-500/30 w-full sm:w-auto justify-center"
            >
              Sign Out
            </Button>
          </div>
        </motion.div>

        {/* Temporary Notification Notice */}
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-3.5 rounded-xl text-xs flex items-center justify-between ${
              notice.isError
                ? 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {notice.isError ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
              <span>{notice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="hover:opacity-75"
            >
              ✕
            </button>
          </motion.div>
        )}

        {/* Quick Stats Grid */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {[
            {
              label: 'Confirmed Passes',
              value: loading ? '…' : upcomingCount.toString(),
              icon: Ticket,
              color: 'text-emerald-400',
            },
            {
              label: 'Under Host Review',
              value: loading ? '…' : pendingApprovalCount.toString(),
              icon: Clock,
              color: 'text-purple-400',
            },
            {
              label: 'Payment Pending',
              value: loading ? '…' : pendingPaymentCount.toString(),
              icon: Lock,
              color: 'text-amber-400',
            },
            {
              label: 'Cancelled / Rejected',
              value: loading ? '…' : cancelledCount.toString(),
              icon: XCircle,
              color: 'text-rose-400',
            },
          ].map((stat, i) => {
            const Icon = stat.icon
            return (
              <Card key={i} className="p-5 flex items-center justify-between">
                <div>
                  <span className="text-xs text-[var(--color-text-muted)] font-medium block mb-1">
                    {stat.label}
                  </span>
                  <span className="text-2xl font-bold font-display text-[var(--color-text-primary)]">
                    {stat.value}
                  </span>
                </div>
                <div className={`p-3 rounded-xl bg-[var(--color-surface-2)] ${stat.color}`}>
                  <Icon size={22} />
                </div>
              </Card>
            )
          })}
        </motion.div>

        {/* ── Real Registrations & Digital Passes Section ──────────────────── */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--color-surface-3)]">
            <div>
              <h2 className="text-xl font-bold font-display text-[var(--color-text-primary)]">
                My Digital Entry Passes
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Real-time ticket tokens, QR passes, and registration statuses
              </p>
            </div>

            <Link to="/discover">
              <Button variant="primary" size="sm" leftIcon={<Compass size={15} />}>
                Find More Events
              </Button>
            </Link>
          </div>

          {/* Sub-Tabs: Upcoming, Under Review, Pending Payment, Past, Cancelled */}
          <div className="flex items-center gap-1.5 p-1 bg-[var(--color-surface-2)] rounded-xl w-full max-w-full overflow-x-auto no-scrollbar touch-pan-x text-xs border border-[var(--color-surface-3)]">
            <button
              type="button"
              onClick={() => setTab('upcoming')}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap shrink-0 transition-all ${
                tab === 'upcoming'
                  ? 'bg-[var(--color-brand-cyan)] text-black font-semibold shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Upcoming ({upcomingCount})
            </button>
            <button
              type="button"
              onClick={() => setTab('pending_approval')}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap shrink-0 transition-all ${
                tab === 'pending_approval'
                  ? 'bg-[var(--color-brand-purple)] text-white font-semibold shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Host Review ({pendingApprovalCount})
            </button>
            <button
              type="button"
              onClick={() => setTab('pending_payment')}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap shrink-0 transition-all ${
                tab === 'pending_payment'
                  ? 'bg-amber-400 text-black font-semibold shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Payment Due ({pendingPaymentCount})
            </button>
            <button
              type="button"
              onClick={() => setTab('past')}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap shrink-0 transition-all ${
                tab === 'past'
                  ? 'bg-[var(--color-surface-3)] text-[var(--color-text-primary)] font-semibold shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Past ({pastCount})
            </button>
            <button
              type="button"
              onClick={() => setTab('cancelled')}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap shrink-0 transition-all ${
                tab === 'cancelled'
                  ? 'bg-rose-500/20 text-rose-300 font-semibold shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Cancelled / Rejected ({cancelledCount})
            </button>
          </div>

          {/* Content Area */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-[var(--color-surface-3)] border-t-[var(--color-brand-cyan)] animate-spin mb-3" />
              <span className="text-xs text-[var(--color-text-muted)]">Loading digital tickets…</span>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="py-16 px-4 glass rounded-2xl border border-[var(--color-surface-3)] text-center flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-[var(--color-surface-2)] flex items-center justify-center text-[var(--color-brand-cyan)] mb-3">
                <Ticket size={28} />
              </div>
              <h3 className="text-base font-bold font-display text-[var(--color-text-primary)] mb-1">
                No passes found
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] max-w-sm mb-5">
                {tab === 'upcoming'
                  ? 'You have no upcoming confirmed passes. Discover upcoming campus events and reserve your spot!'
                  : tab === 'pending_approval'
                  ? 'You have no applications currently awaiting host review.'
                  : tab === 'pending_payment'
                  ? 'You have no tickets currently awaiting payment submission.'
                  : `You have no ${tab.replace('_', ' ')} event tickets in your account history.`}
              </p>
              <Link to="/discover">
                <Button variant="primary" size="sm" leftIcon={<Compass size={15} />}>
                  Explore Events
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredList.map((reg) => {
                const event = reg.event || null
                const startDate = event?.start_date ? new Date(event.start_date) : null
                const formattedDate = startDate
                  ? startDate.toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'Date unavailable'
                const formattedTime = startDate
                  ? startDate.toLocaleTimeString('en-IN', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })
                  : 'Time unavailable'

                const isConfirmed = reg.status === 'confirmed'
                const isPendingApproval = reg.status === 'pending_approval'
                const isPendingPayment = reg.status === 'pending_payment'
                const isRejected = reg.status === 'rejected'
                const isCancelled = reg.status === 'cancelled'
                const hasStarted = startDate ? startDate <= now : false

                return (
                  <Card
                    key={reg.id}
                    className="p-4 sm:p-5 flex flex-col justify-between gap-4 border border-[oklch(100%_0_0_/_0.08)] hover:border-[oklch(100%_0_0_/_0.15)] transition-all shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                              ? 'Under Host Review'
                              : isPendingPayment
                              ? 'Pending Payment'
                              : isRejected
                              ? 'Rejected'
                              : 'Cancelled'}
                          </Badge>
                          {event ? (
                            <>
                              <Badge variant="cyan" className="capitalize text-[10px]">
                                {event.category}
                              </Badge>
                              {event.participation_type === 'team' && (
                                <Badge variant="pink" className="text-[10px]">
                                  Team Event
                                </Badge>
                              )}
                            </>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-[var(--color-text-muted)]">
                              Event Unavailable
                            </Badge>
                          )}
                        </div>

                        <h3 className="font-semibold text-[var(--color-text-primary)] text-base line-clamp-1">
                          {event?.slug ? (
                            <Link
                              to={`/events/${event.slug}`}
                              className="hover:text-[var(--color-brand-cyan)] transition-colors"
                            >
                              {event.title}
                            </Link>
                          ) : (
                            <span className="text-[var(--color-text-secondary)] italic">
                              {event?.title || 'Event Details Unavailable'}
                            </span>
                          )}
                        </h3>

                        {reg.team_name && (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--color-brand-purple)] font-medium mt-1">
                            <Users size={13} />
                            <span>Team: {reg.team_name}</span>
                            {Array.isArray((reg as any).team_members) && (reg as any).team_members.length > 0 && (
                              <span className="text-[11px] text-[var(--color-text-muted)]">
                                • {(reg as any).team_members.length + 1} members
                              </span>
                            )}
                          </div>
                        )}

                        {isRejected && (reg as any).rejection_reason && (
                          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs mt-2">
                            <strong className="block font-semibold text-[11px] uppercase tracking-wide">
                              Organizer Reason:
                            </strong>
                            {(reg as any).rejection_reason}
                          </div>
                        )}

                        <div className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)] mt-1.5">
                          <span className="flex items-center gap-1.5">
                            <Clock size={12} /> {formattedDate} {startDate ? `at ${formattedTime}` : ''}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <MapPin size={12} /> {event?.venue_name || 'Venue details unavailable'}
                          </span>
                        </div>
                      </div>

                      {/* Poster thumbnail or clean fallback icon */}
                      {event?.poster_url ? (
                        <img
                          src={event.poster_url}
                          alt={event.title || 'Event'}
                          className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover shrink-0 border border-[var(--color-surface-3)]"
                        />
                      ) : (
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] flex items-center justify-center text-[var(--color-text-muted)] shrink-0">
                          <Ticket size={22} />
                        </div>
                      )}
                    </div>

                    {/* Bottom ticket action row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-[var(--color-surface-3)] text-xs">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--color-text-muted)] min-w-0">
                        <QrCode size={13} className="text-[var(--color-brand-cyan)] shrink-0" />
                        <span className="truncate">{reg.ticket_code}</span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                        {isConfirmed && (
                          <Link to={`/student/tickets/${reg.id}`}>
                            <Button variant="primary" size="sm" rightIcon={<ArrowRight size={13} />}>
                              View QR Ticket
                            </Button>
                          </Link>
                        )}

                        {isPendingApproval && (
                          <Link to={`/student/tickets/${reg.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-[var(--color-brand-purple)]/40 text-[var(--color-brand-purple)] hover:bg-[var(--color-brand-purple)]/10"
                              rightIcon={<ArrowRight size={13} />}
                            >
                              Track Status
                            </Button>
                          </Link>
                        )}

                        {isPendingPayment && (
                          <Link to={`/student/payments/${reg.id}`}>
                            <Button
                              variant="primary"
                              size="sm"
                              className="bg-amber-500 hover:bg-amber-400 text-black border-none font-semibold"
                              rightIcon={<ArrowRight size={13} />}
                            >
                              Submit Payment
                            </Button>
                          </Link>
                        )}

                        {isRejected && (!event || !event.is_free) && (
                          <Link to={`/student/payments/${reg.id}`}>
                            <Button
                              variant="danger"
                              size="sm"
                              rightIcon={<ArrowRight size={13} />}
                            >
                              Resubmit UTR
                            </Button>
                          </Link>
                        )}

                        {!isCancelled && !isRejected && (
                          hasStarted ? (
                            <span className="text-[11px] text-[var(--color-text-muted)] italic px-2">
                              Started
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setCancellingReg(reg)}
                              className="text-[11px] text-rose-400 hover:text-rose-300 font-medium ml-1 transition-colors"
                            >
                              Cancel Pass
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* Cancellation Confirmation Modal */}
        <AnimatePresence>
          {cancellingReg && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                className="w-full max-w-md p-6 rounded-2xl glass border border-rose-500/30 text-left flex flex-col gap-4 shadow-2xl"
              >
                <div className="flex items-center gap-3 text-rose-400">
                  <div className="p-2.5 rounded-xl bg-rose-500/15">
                    <AlertTriangle size={24} />
                  </div>
                  <h3 className="text-lg font-bold font-display text-[var(--color-text-primary)]">
                    Cancel Event Registration?
                  </h3>
                </div>

                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Are you sure you want to cancel your registration for{' '}
                  <strong className="text-[var(--color-text-primary)]">
                    "{cancellingReg.event?.title || 'this event'}"
                  </strong>
                  ? Your seat will be released immediately for other campus students, and this QR pass will become void.
                </p>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={actionLoading}
                    onClick={() => setCancellingReg(null)}
                  >
                    Keep Pass
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={actionLoading}
                    isLoading={actionLoading}
                    onClick={handleCancelPass}
                  >
                    Confirm Cancellation
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
