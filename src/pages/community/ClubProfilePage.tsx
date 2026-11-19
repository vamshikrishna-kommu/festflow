import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import {
  Building2,
  ShieldCheck,
  Users,
  Calendar,
  Share2,
  Check,
  Flag,
  Globe,
  ExternalLink,
  Clock,
  MapPin,
  Sparkles,
  Heart,
  Info,
  Trophy,
  Compass,
} from 'lucide-react'
import { Button } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/context/AuthContext'
import type { ClubPublicProfile, EventRecord } from '@/types'
import { getClubPublicProfile, followClub, unfollowClub } from '@/lib/community'
import { ReportModal } from '@/components/community/ReportModal'

export default function ClubProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const clubId = id || ''

  const [club, setClub] = useState<ClubPublicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [followLoading, setFollowLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'about'>('upcoming')
  const [reportModalOpen, setReportModalOpen] = useState(false)

  useEffect(() => {
    async function loadClub() {
      if (!clubId) return
      setLoading(true)
      const res = await getClubPublicProfile(clubId, user?.id)
      setLoading(false)
      if (res.success && res.club) {
        setClub(res.club)
        setIsFollowing(!!res.club.isFollowing)
        setFollowersCount(res.club.followersCount || 0)
      }
    }

    loadClub()
  }, [clubId, user?.id])

  const handleFollowToggle = async () => {
    if (!user) {
      navigate('/login?redirect=' + encodeURIComponent(window.location.pathname))
      return
    }
    if (followLoading) return

    setFollowLoading(true)
    if (isFollowing) {
      const res = await unfollowClub(user.id, clubId)
      if (res.success) {
        setIsFollowing(false)
        setFollowersCount((prev) => Math.max(0, prev - 1))
      }
    } else {
      const res = await followClub(user.id, clubId)
      if (res.success) {
        setIsFollowing(true)
        setFollowersCount((prev) => prev + 1)
      }
    }
    setFollowLoading(false)
  }

  const handleShare = () => {
    const url = window.location.href
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: `${club?.clubName || 'Club'} on FestFlow`,
        text: `Check out ${club?.clubName || 'this student organization'} and their upcoming campus events on FestFlow!`,
        url,
      }).catch(() => {})
      return
    }
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <PageShell>
        <div className="py-24 flex flex-col items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-[#18CFFC] animate-spin mb-4" />
          <p className="text-xs text-[var(--color-text-muted)] font-mono">Loading club profile…</p>
        </div>
      </PageShell>
    )
  }

  if (!club) {
    return (
      <PageShell>
        <div className="max-w-md mx-auto py-24 text-center p-8 rounded-3xl bg-[#0E0E12] border border-white/[0.08]">
          <h2 className="text-xl font-bold font-display text-white mb-2">Club Not Found</h2>
          <p className="text-xs text-[var(--color-text-muted)] mb-6">
            The student organization you are searching for does not exist or has not yet been approved.
          </p>
          <Link to="/community">
            <Button variant="primary" size="md">
              Return to Community
            </Button>
          </Link>
        </div>
      </PageShell>
    )
  }

  const totalEvents = (club.upcomingEvents?.length || 0) + (club.pastEvents?.length || 0)

  return (
    <PageShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-left space-y-8">
        {/* ── 1. Cinematic Club Header Banner ─────────────────────────────── */}
        <div className="relative rounded-3xl overflow-hidden border border-white/[0.1] bg-[#0E0E12] shadow-2xl group">
          {/* Panoramic Cover */}
          <div className="h-52 sm:h-72 w-full relative bg-gradient-to-r from-[#0D56FB]/40 via-[#7F1AFB]/30 to-[#ED47FC]/25 overflow-hidden">
            {club.coverUrl ? (
              <img
                src={club.coverUrl}
                alt={`${club.clubName} Cover`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#18CFFC]/20 via-[#7F1AFB]/20 to-transparent" />
                <Building2 className="w-20 h-20 text-white/20" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0E0E12] via-[#0E0E12]/60 to-black/20" />
          </div>

          {/* Profile Header Details Row */}
          <div className="px-6 pb-6 sm:px-8 sm:pb-8 pt-0 relative -mt-20 flex flex-col md:flex-row md:items-end justify-between gap-6 z-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
              {/* Club Logo */}
              <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-2xl bg-[#08080A] border-2 border-white/20 p-2 shadow-2xl overflow-hidden flex-shrink-0 group-hover:border-[#18CFFC]/40 transition-colors">
                {club.logoUrl ? (
                  <img
                    src={club.logoUrl}
                    alt={club.clubName}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <div className="w-full h-full rounded-xl bg-gradient-to-br from-[#18CFFC] to-[#7F1AFB] flex items-center justify-center font-display font-black text-4xl text-white shadow-inner">
                    {club.clubName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl sm:text-4xl font-extrabold font-display text-white tracking-tight">
                    {club.clubName}
                  </h1>
                  {club.isVerified && (
                    <div
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#18CFFC]/15 border border-[#18CFFC]/40 text-[#18CFFC] text-xs font-semibold shadow-[0_0_16px_rgba(24,207,252,0.25)] backdrop-blur-md"
                      title="Officially recognized and verified campus organization"
                    >
                      <ShieldCheck className="w-4 h-4 text-[#18CFFC]" />
                      <span>Verified Chapter</span>
                    </div>
                  )}
                  <span className="px-3 py-0.5 rounded-full bg-white/[0.08] border border-white/[0.12] text-xs text-white/80 font-mono capitalize">
                    {club.category}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] max-w-xl leading-relaxed">
                  {club.description || 'Official student organization hosted on FestFlow.'}
                </p>

                {/* Social Links & Lead */}
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                  {club.representativeName && (
                    <span className="text-zinc-400 font-mono text-[11px]">
                      Chapter Lead: <strong className="text-white">{club.representativeName}</strong>
                    </span>
                  )}

                  {club.websiteUrl && (
                    <a
                      href={club.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[#18CFFC] hover:underline"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Website</span>
                    </a>
                  )}

                  {club.socialLinks && Object.entries(club.socialLinks).map(([network, url]) => {
                    if (!url) return null
                    return (
                      <a
                        key={network}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[#ED47FC] hover:underline capitalize"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>{network}</span>
                      </a>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 self-start md:self-end">
              <Button
                variant={isFollowing ? 'secondary' : 'primary'}
                size="md"
                onClick={handleFollowToggle}
                disabled={followLoading}
                className="gap-2 shadow-lg shadow-[#18CFFC]/10 font-semibold"
              >
                <Heart
                  className={`w-4 h-4 ${
                    isFollowing ? 'fill-[#ED47FC] text-[#ED47FC]' : 'text-current'
                  }`}
                />
                {followLoading ? 'Saving…' : isFollowing ? 'Following Chapter' : 'Follow Chapter'}
              </Button>

              <Button
                variant="outline"
                size="md"
                onClick={handleShare}
                className="gap-1.5 border-white/10 text-white/80 hover:text-white"
                title="Share club profile"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                {copied ? 'Copied' : 'Share'}
              </Button>

              <button
                type="button"
                onClick={() => setReportModalOpen(true)}
                className="p-2.5 rounded-xl border border-white/10 text-white/40 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition-colors"
                title="Report organization"
              >
                <Flag className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── 2. Statistics Ribbon ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-[#0E0E12] border border-white/[0.08] hover:border-[#18CFFC]/30 transition-all flex items-center gap-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#18CFFC]/10 text-[#18CFFC] flex items-center justify-center shrink-0 border border-[#18CFFC]/20">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono text-[var(--color-text-muted)] uppercase tracking-wider block">Events Organized</span>
              <strong className="text-lg sm:text-xl font-display font-extrabold text-white">{totalEvents}</strong>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0E0E12] border border-white/[0.08] hover:border-[#ED47FC]/30 transition-all flex items-center gap-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#ED47FC]/10 text-[#ED47FC] flex items-center justify-center shrink-0 border border-[#ED47FC]/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono text-[var(--color-text-muted)] uppercase tracking-wider block">Followers</span>
              <strong className="text-lg sm:text-xl font-display font-extrabold text-white">{followersCount}</strong>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0E0E12] border border-white/[0.08] hover:border-[#7F1AFB]/30 transition-all flex items-center gap-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-[#7F1AFB]/10 text-[#7F1AFB] flex items-center justify-center shrink-0 border border-[#7F1AFB]/20">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono text-[var(--color-text-muted)] uppercase tracking-wider block">Domain</span>
              <strong className="text-sm sm:text-base font-display font-bold text-white capitalize truncate block">{club.category}</strong>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#0E0E12] border border-white/[0.08] hover:border-emerald-500/30 transition-all flex items-center gap-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-mono text-[var(--color-text-muted)] uppercase tracking-wider block">Chapter Status</span>
              <strong className="text-sm sm:text-base font-display font-bold text-emerald-300">
                {club.isVerified ? 'Verified' : 'Active'}
              </strong>
            </div>
          </div>
        </div>

        {/* ── 3. Tabbed View: Upcoming Events, Past Highlights, About Chapter ─ */}
        <div className="flex items-center gap-2 border-b border-white/[0.08] pb-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'upcoming'
                ? 'bg-gradient-to-r from-[#18CFFC]/20 to-[#7F1AFB]/20 text-white border border-[#18CFFC]/40 shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-[#18CFFC]" />
            Upcoming Events ({club.upcomingEvents?.length || 0})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('past')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'past'
                ? 'bg-gradient-to-r from-[#18CFFC]/20 to-[#7F1AFB]/20 text-white border border-[#18CFFC]/40 shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-[#ED47FC]" />
            Past Highlights ({club.pastEvents?.length || 0})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('about')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'about'
                ? 'bg-gradient-to-r from-[#18CFFC]/20 to-[#7F1AFB]/20 text-white border border-[#18CFFC]/40 shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Info className="w-3.5 h-3.5 text-purple-400" />
            About Chapter
          </button>
        </div>

        {/* Tab 1: Upcoming Events */}
        {activeTab === 'upcoming' && (
          <div className="space-y-4">
            {club.upcomingEvents && club.upcomingEvents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {club.upcomingEvents.map((evt: EventRecord) => {
                  const eventDate = new Date(evt.start_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                  return (
                    <div
                      key={evt.id}
                      className="p-5 rounded-2xl bg-[#0E0E12] border border-white/[0.08] hover:border-[#18CFFC]/40 transition-all flex flex-col justify-between space-y-4 shadow-md group/evt"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono text-[var(--color-text-muted)]">
                          <span className="flex items-center gap-1 text-[#18CFFC]">
                            <Calendar className="w-3.5 h-3.5" />
                            {eventDate}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-white/70">
                            {evt.category || 'Event'}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white font-display group-hover/evt:text-[#18CFFC] transition-colors">
                          <Link to={`/events/${evt.slug || evt.id}`}>{evt.title}</Link>
                        </h3>
                        <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">
                          {evt.summary || evt.description || `Join this campus event hosted by ${club.clubName}`}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                        <span className="text-xs font-mono text-white/60 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-white/40" />
                          {evt.venue_name || 'Campus Venue'}
                        </span>
                        <Link to={`/events/${evt.slug || evt.id}`}>
                          <Button variant="outline" size="sm" className="gap-1 border-white/10 text-xs">
                            View & Register
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-10 rounded-2xl bg-[#0E0E12] border border-white/[0.08] text-center space-y-2">
                <Sparkles className="w-8 h-8 text-[#18CFFC]/40 mx-auto" />
                <h4 className="text-sm font-semibold text-white font-display">No upcoming events right now</h4>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Follow {club.clubName} to be notified as soon as their next event registrations open.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Past Highlights */}
        {activeTab === 'past' && (
          <div className="space-y-4">
            {club.pastEvents && club.pastEvents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {club.pastEvents.map((evt: EventRecord) => {
                  const eventDate = new Date(evt.start_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                  return (
                    <div
                      key={evt.id}
                      className="p-5 rounded-2xl bg-[#0E0E12] border border-white/[0.06] opacity-85 hover:opacity-100 transition-all flex flex-col justify-between space-y-4 shadow-sm"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono text-white/50">
                          <span>{eventDate}</span>
                          <span className="px-2 py-0.5 rounded-full bg-white/[0.04] text-emerald-400 text-[10px]">Concluded</span>
                        </div>
                        <h3 className="text-base font-bold text-white font-display">
                          <Link to={`/events/${evt.slug || evt.id}`} className="hover:text-[#18CFFC] transition-colors">
                            {evt.title}
                          </Link>
                        </h3>
                        <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">
                          {evt.summary || evt.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                        <span className="text-xs text-white/40 font-mono">{evt.venue_name || 'Campus Venue'}</span>
                        <Link to={`/events/${evt.slug || evt.id}`}>
                          <Button variant="ghost" size="sm" className="text-xs text-white/60">
                            Archive Details
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-10 rounded-2xl bg-[#0E0E12] border border-white/[0.08] text-center space-y-2">
                <Clock className="w-8 h-8 text-white/20 mx-auto" />
                <h4 className="text-sm font-semibold text-white font-display">No past event archives</h4>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Completed events and past recaps will appear here.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: About Chapter */}
        {activeTab === 'about' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 p-6 rounded-2xl bg-[#0E0E12] border border-white/[0.08] space-y-5">
              <div>
                <h3 className="text-sm font-bold text-white font-display uppercase tracking-wider mb-2">
                  About Chapter
                </h3>
                <p className="text-xs sm:text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                  {club.description ||
                    'This organization is committed to fostering student talent, hosting campus-wide workshops, hackathons, and cultural fests.'}
                </p>
              </div>

              <div className="pt-4 border-t border-white/[0.06] space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-display">
                  Leadership & Faculty Coordination
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <p className="text-white/40 font-mono text-[10px]">CHAPTER REPRESENTATIVE</p>
                    <p className="text-white font-semibold mt-1">
                      {club.representativeName || 'Lead Student Executive'}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <p className="text-white/40 font-mono text-[10px]">CAMPUS DOMAIN</p>
                    <p className="text-white font-semibold mt-1 capitalize">{club.category} Division</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-[#0E0E12] border border-white/[0.08] space-y-4">
              <h3 className="text-sm font-bold text-white font-display uppercase tracking-wider">
                Official Links
              </h3>
              <div className="space-y-2 text-xs">
                {club.websiteUrl && (
                  <a
                    href={club.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/80 hover:text-white hover:border-[#18CFFC]/40 transition-colors"
                  >
                    <Globe className="w-4 h-4 text-[#18CFFC]" />
                    <span className="truncate">Official Website</span>
                    <ExternalLink className="w-3 h-3 ml-auto text-white/40" />
                  </a>
                )}

                {club.socialLinks && Object.entries(club.socialLinks).map(([network, url]) => {
                  if (!url) return null
                  return (
                    <a
                      key={network}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/80 hover:text-white hover:border-[#ED47FC]/40 transition-colors"
                    >
                      <Globe className="w-4 h-4 text-[#ED47FC]" />
                      <span className="capitalize">{network}</span>
                      <ExternalLink className="w-3 h-3 ml-auto text-white/40" />
                    </a>
                  )
                })}

                {!club.websiteUrl && (!club.socialLinks || Object.keys(club.socialLinks).length === 0) && (
                  <p className="text-xs text-[var(--color-text-muted)] italic">
                    No external links provided.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Community Report Modal */}
      <ReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        targetType="club"
        targetId={clubId}
        targetLabel={club.clubName}
      />
    </PageShell>
  )
}
