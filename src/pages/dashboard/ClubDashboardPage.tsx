import { useState, useEffect, useMemo } from 'react'
import { motion } from 'motion/react'
import {
  Building2,
  Calendar,
  Users,
  CreditCard,
  Plus,
  Edit,
  ArrowRight,
  Clock,
  MapPin,
  Settings,
  QrCode,
  FileSpreadsheet,
  TrendingUp,
  GraduationCap,
} from 'lucide-react'
import { Button, Badge, Logo, EmptyState } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/context/AuthContext'
import { Link, useNavigate } from 'react-router'
import { fadeIn, staggerContainer, metricItem } from '@/lib/animations'
import { listClubEvents } from '@/lib/events'
import { getClubPaymentSubmissions } from '@/lib/payments'
import { hasPermission, ROLE_LABELS } from '@/lib/clubMembers'
import type { EventRecord, PaymentSubmissionWithDetails } from '@/types'

export default function ClubDashboardPage() {
  const {
    profile,
    clubProfile,
    activeClubMembership,
    activeClubProfile,
    activeClubId,
    activeClubRole,
    isDualEligible,
    switchWorkspace,
    signOut,
  } = useAuth()
  const navigate = useNavigate()
  const [events, setEvents] = useState<EventRecord[]>([])
  const [submissions, setSubmissions] = useState<PaymentSubmissionWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  const clubId = activeClubId || clubProfile?.profile_id || activeClubMembership?.club_id || ''
  const clubName = clubProfile?.club_name || activeClubProfile?.club_name || profile?.display_name || 'Campus Club'
  const repName = profile?.display_name || clubProfile?.representative_name || 'Club Representative'

  useEffect(() => {
    let mounted = true
    if (!clubId) {
      setLoading(false)
      return
    }
    Promise.all([
      listClubEvents(clubId),
      getClubPaymentSubmissions(clubId),
    ]).then(([eventsRes, paymentsRes]) => {
      if (!mounted) return
      setLoading(false)
      if (eventsRes.events) setEvents(eventsRes.events)
      if (paymentsRes.submissions) setSubmissions(paymentsRes.submissions)
    })
    return () => {
      mounted = false
    }
  }, [clubId])

  const now = new Date()

  // Real Database-backed metrics
  const publishedEvents = useMemo(() => events.filter((e) => e.status === 'published'), [events])
  const draftEvents = useMemo(() => events.filter((e) => e.status === 'draft'), [events])
  const publishedCount = publishedEvents.length
  const draftCount = draftEvents.length
  const totalCapacity = useMemo(() => events.reduce((sum, e) => sum + (e.capacity || 0), 0), [events])

  const pendingPayments = useMemo(
    () => submissions.filter((s) => s.status === 'pending_review'),
    [submissions]
  )
  const pendingPaymentsCount = pendingPayments.length

  const approvedPayments = useMemo(
    () => submissions.filter((s) => s.status === 'approved'),
    [submissions]
  )
  const grossVerifiedRevenue = useMemo(
    () => approvedPayments.reduce((sum, s) => sum + (s.amount || 0), 0),
    [approvedPayments]
  )

  // Find next action for organizer
  const organizerNextAction = useMemo(() => {
    // 1. Pending payment reviews take highest urgency
    if (pendingPaymentsCount > 0) {
      return {
        type: 'pending_payment' as const,
        title: `${pendingPaymentsCount} Payment Submission${pendingPaymentsCount > 1 ? 's' : ''} Awaiting Review`,
        description: 'Students have submitted transaction UTR proofs for paid event tickets. Review and approve to release gate passes.',
        ctaLabel: 'Review Payments',
        ctaLink: '/club/payments',
        badge: 'Action Required',
        badgeVariant: 'amber' as const,
      }
    }

    // 2. Event starting soon (next 48h) or currently active
    const upcomingPublished = publishedEvents
      .filter((e) => Boolean(e.start_date))
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())

    if (upcomingPublished.length > 0) {
      const nextEvt = upcomingPublished[0]
      const startDate = new Date(nextEvt.start_date)
      const diffMs = startDate.getTime() - now.getTime()
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

      if (diffHours >= -6 && diffHours <= 48) {
        return {
          type: 'event_active' as const,
          title: `Gate Desk Ready: ${nextEvt.title}`,
          description: `Event ${diffHours <= 0 ? 'is in progress' : `starts in ${diffHours} hours`} at ${nextEvt.venue_name}. Launch check-in scanner for attendee admittance.`,
          ctaLabel: 'Launch QR Check-In',
          ctaLink: `/club/events/${nextEvt.id}/check-in`,
          badge: 'Live Session',
          badgeVariant: 'cyan' as const,
        }
      }
    }

    // 3. Draft events to complete
    if (draftCount > 0) {
      const draftEvt = draftEvents[0]
      return {
        type: 'draft_pending' as const,
        title: `Draft Ready for Review: "${draftEvt.title}"`,
        description: 'Complete form configuration, custom questions, or publish this event to campus students.',
        ctaLabel: 'Edit & Publish',
        ctaLink: `/club/events/${draftEvt.id}/edit`,
        badge: 'Draft Saved',
        badgeVariant: 'purple' as const,
      }
    }

    // 4. Default
    return {
      type: 'default' as const,
      title: 'Host Your Next Campus Experience',
      description: 'Create technical hackathons, cultural festivals, athletic tournaments, or seminars with automated QR ticketing.',
      ctaLabel: 'Create New Event',
      ctaLink: '/club/events/new',
      badge: 'Organizer Hub',
      badgeVariant: 'cyan' as const,
    }
  }, [pendingPaymentsCount, publishedEvents, draftEvents, draftCount, now])

  if (!clubId && !loading) {
    return (
      <PageShell>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center justify-center text-center">
          <EmptyState
            icon={Building2}
            title="No Active Club Organization"
            description="You do not currently belong to an active club organization. When a club invites you to their team, you'll manage events and turnstile gate check-in here."
            action={
              <Button
                variant="primary"
                onClick={() => switchWorkspace('student', navigate)}
                leftIcon={<GraduationCap size={16} />}
              >
                Return to Student Workspace
              </Button>
            }
          />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8 text-left">
        {/* Top Header Card */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="relative rounded-3xl border border-white/[0.08] overflow-hidden p-5 sm:p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl bg-gradient-to-b from-[#0E0E12] to-[#08080A]"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 15% 40%, rgba(255, 87, 34, 0.12) 0%, transparent 65%)' }}
          />

          <div className="relative flex items-center gap-4 sm:gap-5">
            <div
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[#18CFFC]/20 shrink-0 border border-white/10 bg-gradient-to-br from-[#18CFFC] to-[#7F1AFB]"
            >
              <Building2 size={32} className="sm:w-9 sm:h-9" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-white truncate">
                  {clubName}
                </h1>
                <Badge variant="purple" className="flex items-center gap-1.5 shrink-0 text-[10px] sm:text-xs">
                  <Logo variant="compact" /> {activeClubRole ? ROLE_LABELS[activeClubRole] : 'Campus Organizer'}
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-400 flex-wrap font-sans">
                <span>Lead: <strong className="text-white">{repName}</strong></span>
                {profile?.email && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span className="text-zinc-500 truncate max-w-[220px]">
                      {profile.email}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="relative flex flex-wrap items-center gap-2 sm:gap-2.5 pt-3 md:pt-0 border-t md:border-t-0 border-white/[0.08] shrink-0">
            {(!activeClubRole || hasPermission(activeClubRole, 'review_payments')) && (
              <Link to="/club/payments">
                <Button
                  variant={pendingPaymentsCount > 0 ? 'primary' : 'outline'}
                  size="sm"
                  leftIcon={<CreditCard size={15} />}
                  className={
                    pendingPaymentsCount > 0
                      ? 'bg-amber-500 hover:bg-amber-400 text-black border-none font-semibold shadow-md'
                      : ''
                  }
                >
                  Payments
                  {pendingPaymentsCount > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-black text-amber-300 text-[10px] font-bold">
                      {pendingPaymentsCount}
                    </span>
                  )}
                </Button>
              </Link>
            )}

            {(!activeClubRole || hasPermission(activeClubRole, 'manage_members')) && (
              <Link to="/club/members">
                <Button variant="outline" size="sm" leftIcon={<Users size={15} />}>
                  Team & Roles
                </Button>
              </Link>
            )}

            {(!activeClubRole || hasPermission(activeClubRole, 'manage_club')) && (
              <Link to="/club/settings">
                <Button variant="outline" size="sm" leftIcon={<Settings size={15} />}>
                  Club Settings
                </Button>
              </Link>
            )}

            {(!activeClubRole || hasPermission(activeClubRole, 'manage_events')) && (
              <Link to="/club/events/new">
                <Button variant="primary" size="sm" leftIcon={<Plus size={15} />}>
                  Create Event
                </Button>
              </Link>
            )}

            {isDualEligible && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => switchWorkspace('student', navigate)}
                className="text-zinc-300 hover:text-white"
                leftIcon={<GraduationCap size={15} />}
              >
                Student Space
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut()}
              className="text-rose-400 hover:text-rose-300 hover:border-rose-500/30"
            >
              Sign Out
            </Button>
          </div>
        </motion.div>

        {/* ── Organizer Spotlight Next Action Banner ────────────────────────── */}
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="relative rounded-2xl overflow-hidden p-5 sm:p-6 border transition-all shadow-md bg-[#0E0E12] border-white/[0.08]"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div
                className={`p-3 rounded-xl shrink-0 ${
                  organizerNextAction.type === 'pending_payment'
                    ? 'bg-amber-500/20 text-amber-300'
                    : organizerNextAction.type === 'event_active'
                    ? 'bg-[#18CFFC]/20 text-[#18CFFC]'
                    : 'bg-[#14141A] text-[#18CFFC]'
                }`}
              >
                {organizerNextAction.type === 'pending_payment' ? (
                  <CreditCard size={22} />
                ) : organizerNextAction.type === 'event_active' ? (
                  <QrCode size={22} />
                ) : (
                  <Calendar size={22} />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge variant={organizerNextAction.badgeVariant} className="text-[10px]">
                    {organizerNextAction.badge}
                  </Badge>
                </div>
                <h2 className="text-base sm:text-lg font-bold font-heading text-white">
                  {organizerNextAction.title}
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 mt-0.5 max-w-2xl leading-relaxed font-sans">
                  {organizerNextAction.description}
                </p>
              </div>
            </div>

            <Link to={organizerNextAction.ctaLink} className="self-start sm:self-center shrink-0">
              <Button
                variant={organizerNextAction.type === 'pending_payment' ? 'primary' : 'outline'}
                size="md"
                rightIcon={<ArrowRight size={15} />}
                className={
                  organizerNextAction.type === 'pending_payment'
                    ? 'bg-amber-500 hover:bg-amber-400 text-black border-none font-semibold shadow-md'
                    : ''
                }
              >
                {organizerNextAction.ctaLabel}
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* ── Real Authorized Metrics Grid (Zero Fabricated Metrics) ───────── */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
        >
          {[
            {
              label: 'Pending Reviews',
              value: loading ? '…' : pendingPaymentsCount.toString(),
              subtitle: 'UTR proofs awaiting verification',
              icon: CreditCard,
              color: 'text-amber-400',
              badgeStyle: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
              link: '/club/payments',
              highlight: pendingPaymentsCount > 0,
            },
            {
              label: 'Published Events',
              value: loading ? '…' : publishedCount.toString(),
              subtitle: 'Active campus listings',
              icon: Calendar,
              color: 'text-[#18CFFC]',
              badgeStyle: 'bg-[#18CFFC]/10 border-[#18CFFC]/20 text-[#18CFFC]',
              link: '/club/events',
            },
            {
              label: 'Verified Gross Fees',
              value: loading ? '…' : `₹${grossVerifiedRevenue.toLocaleString()}`,
              subtitle: `${approvedPayments.length} verified transactions`,
              icon: TrendingUp,
              color: 'text-emerald-400',
              badgeStyle: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
              link: '/club/payments',
            },
            {
              label: 'Total Capacity',
              value: loading ? '…' : `${totalCapacity.toLocaleString()} seats`,
              subtitle: `${events.length} total event listings`,
              icon: Users,
              color: 'text-zinc-300',
              badgeStyle: 'bg-white/10 border-white/15 text-zinc-300',
            },
          ].map((stat, i) => {
            const Icon = stat.icon
            const content = (
              <motion.div variants={metricItem} className="h-full">
                <div
                  key={i}
                  className={`p-4 sm:p-5 rounded-2xl bg-[#0E0E12] border flex flex-col justify-between gap-3 h-full transition-all duration-200 ${
                    stat.highlight
                      ? 'border-amber-500/40 bg-amber-500/[0.04] shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                      : 'border-white/[0.08] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400 font-medium font-sans">
                      {stat.label}
                    </span>
                    <div className={`p-2 rounded-xl border ${stat.badgeStyle}`}>
                      <Icon size={18} />
                    </div>
                  </div>

                  <div>
                    <span
                      className={`text-2xl sm:text-3xl font-extrabold font-heading font-mono ${
                        stat.highlight ? 'text-amber-400' : 'text-white'
                      }`}
                    >
                      {stat.value}
                    </span>
                    <span className="text-[11px] text-zinc-500 block mt-0.5 truncate font-sans">
                      {stat.subtitle}
                    </span>
                  </div>
                </div>
              </motion.div>
            )
            return stat.link ? (
              <Link to={stat.link} key={i} className="block h-full">
                {content}
              </Link>
            ) : (
              <div key={i} className="h-full">
                {content}
              </div>
            )
          })}
        </motion.div>

        {/* ── Managed Events Section ────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--color-surface-3)]">
            <div>
              <h2 className="text-xl font-bold font-display text-[var(--color-text-primary)]">
                Managed Campus Events
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Real-time ticketing, check-in desks, and attendee records for {clubName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/club/events">
                <Button variant="ghost" size="sm" rightIcon={<ArrowRight size={14} />}>
                  View All ({events.length})
                </Button>
              </Link>
              <Link to="/club/events/new">
                <Button variant="primary" size="sm" leftIcon={<Plus size={15} />}>
                  Create Event
                </Button>
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-[var(--color-surface-3)] border-t-[var(--color-brand-purple)] animate-spin mb-3" />
              <span className="text-xs text-[var(--color-text-muted)]">Loading club events…</span>
            </div>
          ) : events.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No Events Created Yet"
              description="Launch your first campus event to begin accepting registrations, issuing digital passes, and scanning QR credentials."
              action={
                <Link to="/club/events/new">
                  <Button variant="primary" size="sm" leftIcon={<Plus size={15} />}>
                    Create Your First Event
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.slice(0, 4).map((event) => {
                const startDate = event.start_date ? new Date(event.start_date) : null
                const formattedDate = startDate
                  ? startDate.toLocaleDateString('en-IN', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })
                  : 'Date TBA'

                return (
                  <div key={event.id} className="p-5 rounded-2xl bg-[#0E0E12] flex flex-col justify-between gap-4 border border-white/[0.08] hover:border-white/20 transition-all shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge
                            variant={
                              event.status === 'published'
                                ? 'success'
                                : event.status === 'draft'
                                ? 'amber'
                                : 'danger'
                            }
                            className="capitalize text-[10px]"
                          >
                            {event.status}
                          </Badge>
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-300">
                            {event.category}
                          </span>
                          {event.participation_type === 'team' && (
                            <Badge variant="pink" className="text-[10px]">
                              Team
                            </Badge>
                          )}
                        </div>

                        <h3 className="font-bold text-white text-base line-clamp-1 font-heading">
                          <Link to={`/events/${event.slug}`} className="hover:text-[#18CFFC] transition-colors">
                            {event.title}
                          </Link>
                        </h3>

                        <div className="text-xs text-zinc-400 mt-1.5 flex flex-col gap-1 font-sans">
                          <span className="flex items-center gap-1.5">
                            <Clock size={12} className="text-[#18CFFC]" /> {formattedDate}
                          </span>
                          <span className="flex items-center gap-1.5 truncate">
                            <MapPin size={12} className="text-[#18CFFC]" /> {event.venue_name || 'Campus Venue'}
                          </span>
                        </div>
                      </div>

                      {event.poster_url ? (
                        <img
                          src={event.poster_url}
                          alt={event.title}
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover shrink-0 border border-white/10 shadow-sm"
                        />
                      ) : (
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#14141A] border border-white/10 flex items-center justify-center text-zinc-500 shrink-0">
                          <Calendar size={24} />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/[0.08] text-xs">
                      <span className="text-zinc-300 font-medium font-mono">
                        {event.is_free ? 'Free Admission' : `₹${event.price}`} • {event.capacity} seats
                      </span>

                      <div className="flex flex-wrap items-center gap-3">
                        {event.status === 'published' && (
                          <Link
                            to={`/club/events/${event.id}/check-in`}
                            className="flex items-center gap-1 text-[#18CFFC] hover:underline font-semibold"
                          >
                            <QrCode size={13} /> Check In
                          </Link>
                        )}
                        <Link
                          to={`/club/events/${event.id}/registrations`}
                          className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
                        >
                          <Users size={13} /> Attendees
                        </Link>
                        <Link
                          to={`/club/events/${event.id}/reports`}
                          className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
                        >
                          <FileSpreadsheet size={13} /> Reports
                        </Link>
                        <Link
                          to={`/club/events/${event.id}/edit`}
                          className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
                        >
                          <Edit size={13} /> Edit
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
