import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import {
  Building2,
  ShieldCheck,
  Users,
  Calendar,
  Megaphone,
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
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'announcements' | 'about'>('upcoming')
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
          <h2 className="text-xl font-bold font-heading text-white mb-2">Club Not Found</h2>
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

  return (
    <PageShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-left space-y-8">
        {/* Cover Banner */}
        <div className="relative rounded-3xl overflow-hidden border border-white/[0.08] bg-[#0E0E12] shadow-2xl">
          <div className="h-44 sm:h-60 w-full relative bg-gradient-to-r from-[#0D56FB]/30 via-[#7F1AFB]/30 to-[#ED47FC]/20">
            {club.coverUrl ? (
              <img
                src={club.coverUrl}
                alt={`${club.clubName} Cover`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center opacity-30">
                <Building2 className="w-16 h-16 text-white/50" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0E0E12] via-[#0E0E12]/50 to-transparent" />
          </div>

          {/* Profile Header Details */}
          <div className="px-6 pb-6 sm:px-8 sm:pb-8 pt-0 relative -mt-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-[#08080A] border-2 border-white/20 p-1.5 shadow-2xl overflow-hidden flex-shrink-0">
                {club.logoUrl ? (
                  <img
                    src={club.logoUrl}
                    alt={club.clubName}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <div className="w-full h-full rounded-xl bg-gradient-to-br from-[#18CFFC]/20 to-[#7F1AFB]/20 flex items-center justify-center font-heading font-black text-3xl text-white">
                    {club.clubName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-white tracking-tight">
                    {club.clubName}
                  </h1>
                  {club.isVerified && (
                    <div
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#18CFFC]/10 border border-[#18CFFC]/30 text-[#18CFFC] text-xs font-semibold shadow-[0_0_12px_rgba(24,207,252,0.15)]"
                      title="Officially recognized and verified campus organization"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Verified Club</span>
                    </div>
                  )}
                  <span className="px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.1] text-xs text-white/70 font-mono">
                    {club.category}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-[var(--color-text-muted)] max-w-xl line-clamp-2">
                  {club.description || 'Official student organization hosted on the FestFlow platform.'}
                </p>

                {/* Follower count & Lead Info */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-white/60 font-mono pt-1">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#18CFFC]" />
                    <span className="font-semibold text-white">{followersCount}</span> followers
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#ED47FC]" />
                    <span className="font-semibold text-white">
                      {(club.upcomingEvents?.length || 0) + (club.pastEvents?.length || 0)}
                    </span>{' '}
                    total events
                  </div>
                  {club.representativeName && (
                    <span className="text-white/40">Lead: {club.representativeName}</span>
                  )}
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
                className="gap-2 shadow-lg"
              >
                <Heart
                  className={`w-4 h-4 ${
                    isFollowing ? 'fill-[#ED47FC] text-[#ED47FC]' : 'text-current'
                  }`}
                />
                {followLoading ? 'Saving…' : isFollowing ? 'Following' : 'Follow Club'}
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

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-white/[0.08] pb-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'upcoming'
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-[#18CFFC]" />
            Upcoming Events ({club.upcomingEvents?.length || 0})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('announcements')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'announcements'
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5 text-[#ED47FC]" />
            Official Announcements ({club.announcements?.length || 0})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('past')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'past'
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-[#07A4FC]" />
            Past Events ({club.pastEvents?.length || 0})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('about')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'about'
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Info className="w-3.5 h-3.5 text-purple-400" />
            About & Leadership
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
                      className="p-5 rounded-2xl bg-[#0E0E12] border border-white/[0.08] hover:border-[#18CFFC]/30 transition-all flex flex-col justify-between space-y-4 shadow-md"
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
                        <h3 className="text-base font-bold text-white font-heading hover:text-[#18CFFC] transition-colors">
                          <Link to={`/events/${evt.slug || evt.id}`}>{evt.title}</Link>
                        </h3>
                        <p className="text-xs text-[var(--color-text-muted)] line-clamp-2">
                          {evt.summary || evt.description || 'Join this exciting campus event hosted by ' + club.clubName}
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
              <div className="p-8 rounded-2xl bg-[#0E0E12] border border-white/[0.08] text-center space-y-2">
                <Sparkles className="w-8 h-8 text-white/20 mx-auto" />
                <h4 className="text-sm font-semibold text-white">No upcoming events right now</h4>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Follow {club.clubName} to be notified as soon as their next event registrations open.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Past Events */}
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
                      className="p-5 rounded-2xl bg-[#0E0E12] border border-white/[0.06] opacity-80 hover:opacity-100 transition-all flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono text-white/50">
                          <span>{eventDate}</span>
                          <span className="px-2 py-0.5 rounded-full bg-white/[0.04]">Completed</span>
                        </div>
                        <h3 className="text-base font-bold text-white/90 font-heading">
                          <Link to={`/events/${evt.slug || evt.id}`} className="hover:text-white">
                            {evt.title}
                          </Link>
                        </h3>
                        <p className="text-xs text-[var(--color-text-muted)] line-clamp-2">
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
              <div className="p-8 rounded-2xl bg-[#0E0E12] border border-white/[0.08] text-center space-y-2">
                <Clock className="w-8 h-8 text-white/20 mx-auto" />
                <h4 className="text-sm font-semibold text-white">No past event archives</h4>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Completed events and past recaps will appear here.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Official Announcements */}
        {activeTab === 'announcements' && (
          <div className="space-y-4">
            {club.announcements && club.announcements.length > 0 ? (
              <div className="space-y-3">
                {club.announcements.map((ann) => {
                  const annDate = new Date(ann.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                  })
                  return (
                    <div
                      key={ann.id}
                      className={`p-5 rounded-2xl bg-[#0E0E12] border transition-all space-y-3 ${
                        ann.is_pinned
                          ? 'border-[#ED47FC]/40 shadow-[0_0_20px_rgba(237,71,252,0.06)]'
                          : 'border-white/[0.08]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {ann.is_pinned && (
                            <span className="px-2 py-0.5 rounded-full bg-[#ED47FC]/10 border border-[#ED47FC]/30 text-[#ED47FC] text-[10px] font-mono font-bold uppercase tracking-wider">
                              Pinned
                            </span>
                          )}
                          <h4 className="text-sm sm:text-base font-bold text-white font-heading">
                            {ann.title}
                          </h4>
                        </div>
                        <span className="text-xs font-mono text-[var(--color-text-muted)]">{annDate}</span>
                      </div>
                      <p className="text-xs sm:text-sm text-white/80 whitespace-pre-wrap leading-relaxed">
                        {ann.content}
                      </p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-[#0E0E12] border border-white/[0.08] text-center space-y-2">
                <Megaphone className="w-8 h-8 text-white/20 mx-auto" />
                <h4 className="text-sm font-semibold text-white">No announcements published</h4>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Important club updates, calls for volunteers, and notices will be broadcast here.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: About & Leadership */}
        {activeTab === 'about' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 p-6 rounded-2xl bg-[#0E0E12] border border-white/[0.08] space-y-5">
              <div>
                <h3 className="text-sm font-bold text-white font-heading uppercase tracking-wider mb-2">
                  About Organization
                </h3>
                <p className="text-xs sm:text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                  {club.description ||
                    'This organization is committed to fostering student talent, hosting campus-wide workshops, hackathons, and cultural fests.'}
                </p>
              </div>

              <div className="pt-4 border-t border-white/[0.06] space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-heading">
                  Leadership & Faculty Coordination
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <p className="text-white/40 font-mono text-[10px]">ORGANIZATION REPRESENTATIVE</p>
                    <p className="text-white font-semibold mt-1">
                      {club.representativeName || 'Lead Student Executive'}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <p className="text-white/40 font-mono text-[10px]">CAMPUS AFFILIATION</p>
                    <p className="text-white font-semibold mt-1">{club.category} Domain</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-[#0E0E12] border border-white/[0.08] space-y-4">
              <h3 className="text-sm font-bold text-white font-heading uppercase tracking-wider">
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
