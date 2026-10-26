import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import {
  Building2,
  Calendar,
  Users,
  CreditCard,
  Plus,
  ShieldCheck,
  Edit,
  ArrowRight,
  Clock,
  MapPin,
  Layers,
  Settings,
  QrCode,
} from 'lucide-react'
import { Button, Badge, Card } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/context/AuthContext'
import { Link } from 'react-router'
import { fadeIn, staggerContainer } from '@/lib/animations'
import { listClubEvents } from '@/lib/events'
import { getClubPaymentSubmissions } from '@/lib/payments'
import type { EventRecord } from '@/types'

export default function ClubDashboardPage() {
  const { user, profile, clubProfile, signOut } = useAuth()
  const [events, setEvents] = useState<EventRecord[]>([])
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const clubName = clubProfile?.club_name || profile?.display_name || 'Campus Club'
  const repName = profile?.display_name || clubProfile?.representative_name || 'Club Representative'

  useEffect(() => {
    let mounted = true
    const clubId = user?.id || 'demo_club_member_default'
    Promise.all([
      listClubEvents(clubId),
      getClubPaymentSubmissions(clubId),
    ]).then(([eventsRes, paymentsRes]) => {
      if (!mounted) return
      setLoading(false)
      if (eventsRes.events) setEvents(eventsRes.events)
      if (paymentsRes.submissions) {
        const pending = paymentsRes.submissions.filter((s) => s.status === 'pending_review').length
        setPendingPaymentsCount(pending)
      }
    })
    return () => {
      mounted = false
    }
  }, [user])

  // Computed metrics
  const publishedCount = events.filter((e) => e.status === 'published').length
  const draftCount = events.filter((e) => e.status === 'draft').length
  const totalCapacity = events.reduce((sum, e) => sum + (e.capacity || 0), 0)

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
            <div className="w-13 h-13 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[var(--color-brand-purple)] to-[var(--color-brand-pink)] flex items-center justify-center text-white shadow-lg shadow-[var(--color-brand-purple)]/20 shrink-0">
              <Building2 size={28} className="sm:w-8 sm:h-8" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-display text-[var(--color-text-primary)] truncate">
                  {clubName}
                </h1>
                <Badge variant="purple" className="flex items-center gap-1 shrink-0 text-[10px] sm:text-xs">
                  <ShieldCheck size={12} /> Verified Club
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] truncate">
                Lead: <span className="text-[var(--color-text-primary)] font-medium">{repName}</span> • {profile?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap pt-2 md:pt-0 border-t md:border-t-0 border-[oklch(100%_0_0_/_0.06)]">
            <Link to="/club/payments" className="flex-1 sm:flex-initial">
              <Button
                variant={pendingPaymentsCount > 0 ? 'primary' : 'outline'}
                size="sm"
                leftIcon={<CreditCard size={15} />}
                className={`w-full justify-center ${pendingPaymentsCount > 0 ? 'bg-amber-500 hover:bg-amber-400 text-black border-none font-semibold' : ''}`}
              >
                Verify Payments
                {pendingPaymentsCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-black text-amber-400 text-[10px] font-bold">
                    {pendingPaymentsCount}
                  </span>
                )}
              </Button>
            </Link>
            <Link to="/club/settings/payments" className="flex-1 sm:flex-initial">
              <Button variant="outline" size="sm" className="w-full justify-center" leftIcon={<Settings size={15} />}>
                UPI
              </Button>
            </Link>
            <Link to="/club/events/new" className="w-full sm:w-auto">
              <Button variant="primary" size="sm" className="w-full justify-center" leftIcon={<Plus size={15} />}>
                Create Event
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
              className="text-rose-400 hover:text-rose-300 w-full sm:w-auto justify-center"
            >
              Sign Out
            </Button>
          </div>
        </motion.div>

        {/* Overview Stats Grid */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {[
            {
              label: 'Pending Payments',
              value: loading ? '…' : pendingPaymentsCount.toString(),
              icon: CreditCard,
              color: 'text-amber-400',
              link: '/club/payments',
              highlight: pendingPaymentsCount > 0,
            },
            {
              label: 'Published Events',
              value: loading ? '…' : publishedCount.toString(),
              icon: Calendar,
              color: 'text-purple-400',
              link: '/club/events',
            },
            {
              label: 'Draft Events',
              value: loading ? '…' : draftCount.toString(),
              icon: Layers,
              color: 'text-cyan-400',
              link: '/club/events',
            },
            {
              label: 'Total Capacity',
              value: loading ? '…' : `${totalCapacity.toLocaleString()} seats`,
              icon: Users,
              color: 'text-pink-400',
            },
          ].map((stat, i) => {
            const Icon = stat.icon
            const content = (
              <Card
                key={i}
                className={`p-5 flex items-center justify-between transition-colors ${
                  stat.highlight ? 'border-amber-500/40 bg-amber-500/[0.04]' : ''
                }`}
              >
                <div>
                  <span className="text-xs text-[var(--color-text-muted)] font-medium block mb-1">
                    {stat.label}
                  </span>
                  <span className={`text-2xl font-bold font-display ${stat.highlight ? 'text-amber-400' : 'text-[var(--color-text-primary)]'}`}>
                    {stat.value}
                  </span>
                </div>
                <div className={`p-3 rounded-xl bg-[var(--color-surface-2)] ${stat.color}`}>
                  <Icon size={22} />
                </div>
              </Card>
            )
            return stat.link ? (
              <Link to={stat.link} key={i}>
                {content}
              </Link>
            ) : (
              content
            )
          })}
        </motion.div>

        {/* Events Management Area */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)]">
                Managed Events
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Real-time status of events published or drafted by {clubName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/club/events" className="flex-1 sm:flex-initial">
                <Button variant="ghost" size="sm" className="w-full justify-center" rightIcon={<ArrowRight size={14} />}>
                  View All ({events.length})
                </Button>
              </Link>
              <Link to="/club/events/new" className="flex-1 sm:flex-initial">
                <Button variant="primary" size="sm" className="w-full justify-center" leftIcon={<Plus size={15} />}>
                  Create Event
                </Button>
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-[var(--color-surface-3)] border-t-[var(--color-brand-purple)] animate-spin mb-3" />
              <span className="text-xs text-[var(--color-text-muted)]">Loading club events…</span>
            </div>
          ) : events.length === 0 ? (
            <Card className="p-8 text-center flex flex-col items-center gap-3">
              <div className="p-3 rounded-2xl bg-[var(--color-surface-2)] text-[var(--color-brand-purple)]">
                <Calendar size={28} />
              </div>
              <h3 className="font-bold font-display text-[var(--color-text-primary)] text-base">
                No events created yet
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] max-w-sm">
                Get started by creating your first campus event. You can save as a draft or publish right away.
              </p>
              <Link to="/club/events/new">
                <Button variant="primary" size="sm" leftIcon={<Plus size={15} />}>
                  Create Your First Event
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.slice(0, 4).map((event) => {
                const startDate = event.start_date ? new Date(event.start_date) : null
                const formattedDate = startDate
                  ? startDate.toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'Date TBA'

                return (
                  <Card key={event.id} className="p-4 sm:p-5 flex flex-col justify-between gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
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
                          <Badge variant="purple" className="capitalize text-[10px]">
                            {event.category}
                          </Badge>
                        </div>
                        <h3 className="font-semibold text-[var(--color-text-primary)] text-base line-clamp-1">
                          {event.title}
                        </h3>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1 flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> {formattedDate}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 truncate">
                            <MapPin size={12} /> {event.venue_name}
                          </span>
                        </p>
                      </div>

                      {event.poster_url && (
                        <img
                          src={event.poster_url}
                          alt={event.title}
                          className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover shrink-0 border border-[var(--color-surface-3)]"
                        />
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-[var(--color-surface-3)] text-xs">
                      <span className="text-[var(--color-text-secondary)] font-medium">
                        {event.is_free ? 'Free Entry' : `₹${event.price}`} • {event.capacity} seats
                      </span>

                      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                        {event.status === 'published' && (
                          <Link
                            to={`/club/events/${event.id}/check-in`}
                            className="flex items-center gap-1 text-[var(--color-brand-cyan)] hover:underline font-semibold"
                          >
                            <QrCode size={13} /> Check In
                          </Link>
                        )}
                        <Link
                          to={`/club/events/${event.id}/registrations`}
                          className="flex items-center gap-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                          <Users size={13} /> Attendees
                        </Link>
                        <Link
                          to={`/club/events/${event.id}/reports`}
                          className="flex items-center gap-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                          Reports
                        </Link>
                        <Link
                          to={`/club/events/${event.id}/edit`}
                          className="flex items-center gap-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                          <Edit size={13} /> Edit
                        </Link>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
