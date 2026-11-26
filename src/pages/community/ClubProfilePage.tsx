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
          <div className="w-10 h-10 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin mb-4" />
          <p className="text-xs text-gray-500 font-mono">Loading club profile…</p>
        </div>
      </PageShell>
    )
  }

  if (!club) {
    return (
      <PageShell>
        <div className="max-w-md mx-auto py-24 text-center p-8 rounded-3xl bg-white border border-gray-200 shadow-xs">
          <h2 className="text-xl font-bold font-heading text-gray-900 mb-2">Club Not Found</h2>
          <p className="text-xs text-gray-600 mb-6">
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
        <div className="relative rounded-3xl overflow-hidden border border-gray-200 bg-white shadow-xs">
          <div className="h-44 sm:h-60 w-full relative bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50">
            {club.coverUrl ? (
              <img
                src={club.coverUrl}
                alt={`${club.clubName} Cover`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Building2 className="w-16 h-16 text-blue-300" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent" />
          </div>

          {/* Profile Header Details */}
          <div className="px-6 pb-6 sm:px-8 sm:pb-8 pt-0 relative -mt-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-white border-2 border-gray-200 p-1.5 shadow-md overflow-hidden flex-shrink-0">
                {club.logoUrl ? (
                  <img
                    src={club.logoUrl}
                    alt={club.clubName}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <div className="w-full h-full rounded-xl bg-blue-50 flex items-center justify-center font-heading font-black text-3xl text-blue-700">
                    {club.clubName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-gray-900 tracking-tight">
                    {club.clubName}
                  </h1>
                  {club.isVerified && (
                    <div
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold"
                      title="Officially recognized and verified campus organization"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Verified Club</span>
                    </div>
                  )}
                  <span className="px-2.5 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-xs text-gray-700 font-mono">
                    {club.category}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-gray-600 max-w-xl line-clamp-2">
                  {club.description || 'Official student organization hosted on the FestFlow platform.'}
                </p>

                {/* Follower count & Lead Info */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 font-mono pt-1">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span className="font-semibold text-gray-900">{followersCount}</span> followers
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-purple-600" />
                    <span className="font-semibold text-gray-900">
                      {(club.upcomingEvents?.length || 0) + (club.pastEvents?.length || 0)}
                    </span>{' '}
                    total events
                  </div>
                  {club.representativeName && (
                    <span className="text-gray-500">Lead: {club.representativeName}</span>
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
                className="gap-2 shadow-xs"
              >
                <Heart
                  className={`w-4 h-4 ${
                    isFollowing ? 'fill-rose-500 text-rose-500' : 'text-current'
                  }`}
                />
                {followLoading ? 'Saving…' : isFollowing ? 'Following' : 'Follow Club'}
              </Button>

              <Button
                variant="outline"
                size="md"
                onClick={handleShare}
                className="gap-1.5"
                title="Share club profile"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
                {copied ? 'Copied' : 'Share'}
              </Button>

              <button
                type="button"
                onClick={() => setReportModalOpen(true)}
                className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors"
                title="Report organization"
              >
                <Flag className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'upcoming'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            Upcoming Events ({club.upcomingEvents?.length || 0})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('announcements')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'announcements'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5 text-purple-600" />
            Official Announcements ({club.announcements?.length || 0})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('past')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'past'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            Past Events ({club.pastEvents?.length || 0})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('about')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'about'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Info className="w-3.5 h-3.5 text-indigo-600" />
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
                      className="p-5 rounded-2xl bg-white border border-gray-200 hover:border-blue-300 transition-all flex flex-col justify-between space-y-4 shadow-xs"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono text-gray-500">
                          <span className="flex items-center gap-1 text-blue-600 font-medium">
                            <Calendar className="w-3.5 h-3.5" />
                            {eventDate}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                            {evt.category || 'Event'}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-gray-900 font-heading hover:text-blue-600 transition-colors">
                          <Link to={`/events/${evt.slug || evt.id}`}>{evt.title}</Link>
                        </h3>
                        <p className="text-xs text-gray-600 line-clamp-2">
                          {evt.summary || evt.description || 'Join this exciting campus event hosted by ' + club.clubName}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                        <span className="text-xs font-mono text-gray-600 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400" />
                          {evt.venue_name || 'Campus Venue'}
                        </span>
                        <Link to={`/events/${evt.slug || evt.id}`}>
                          <Button variant="outline" size="sm" className="gap-1 text-xs">
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
              <div className="p-8 rounded-2xl bg-white border border-gray-200 text-center space-y-2 shadow-xs">
                <Sparkles className="w-8 h-8 text-gray-300 mx-auto" />
                <h4 className="text-sm font-semibold text-gray-900">No upcoming events right now</h4>
                <p className="text-xs text-gray-500">
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
                      className="p-5 rounded-2xl bg-white border border-gray-200 opacity-90 hover:opacity-100 hover:border-gray-300 transition-all flex flex-col justify-between space-y-4 shadow-xs"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono text-gray-500">
                          <span>{eventDate}</span>
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Completed</span>
                        </div>
                        <h3 className="text-base font-bold text-gray-900 font-heading">
                          <Link to={`/events/${evt.slug || evt.id}`} className="hover:text-blue-600">
                            {evt.title}
                          </Link>
                        </h3>
                        <p className="text-xs text-gray-600 line-clamp-2">
                          {evt.summary || evt.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                        <span className="text-xs text-gray-500 font-mono">{evt.venue_name || 'Campus Venue'}</span>
                        <Link to={`/events/${evt.slug || evt.id}`}>
                          <Button variant="ghost" size="sm" className="text-xs text-gray-600">
                            Archive Details
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-white border border-gray-200 text-center space-y-2 shadow-xs">
                <Clock className="w-8 h-8 text-gray-300 mx-auto" />
                <h4 className="text-sm font-semibold text-gray-900">No past event archives</h4>
                <p className="text-xs text-gray-500">
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
                      className={`p-5 rounded-2xl bg-white border transition-all space-y-3 shadow-xs ${
                        ann.is_pinned
                          ? 'border-purple-200 bg-purple-50/30'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {ann.is_pinned && (
                            <span className="px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-mono font-bold uppercase tracking-wider">
                              Pinned
                            </span>
                          )}
                          <h4 className="text-sm sm:text-base font-bold text-gray-900 font-heading">
                            {ann.title}
                          </h4>
                        </div>
                        <span className="text-xs font-mono text-gray-500">{annDate}</span>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                        {ann.content}
                      </p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-white border border-gray-200 text-center space-y-2 shadow-xs">
                <Megaphone className="w-8 h-8 text-gray-300 mx-auto" />
                <h4 className="text-sm font-semibold text-gray-900">No announcements published</h4>
                <p className="text-xs text-gray-500">
                  Important club updates, calls for volunteers, and notices will be broadcast here.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: About & Leadership */}
        {activeTab === 'about' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 p-6 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-5">
              <div>
                <h3 className="text-sm font-bold text-gray-900 font-heading uppercase tracking-wider mb-2">
                  About Organization
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                  {club.description ||
                    'This organization is committed to fostering student talent, hosting campus-wide workshops, hackathons, and cultural fests.'}
                </p>
              </div>

              <div className="pt-4 border-t border-gray-200 space-y-3">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider font-heading">
                  Leadership & Faculty Coordination
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                    <p className="text-gray-500 font-mono text-[10px]">ORGANIZATION REPRESENTATIVE</p>
                    <p className="text-gray-900 font-semibold mt-1">
                      {club.representativeName || 'Lead Student Executive'}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                    <p className="text-gray-500 font-mono text-[10px]">CAMPUS AFFILIATION</p>
                    <p className="text-gray-900 font-semibold mt-1">{club.category} Domain</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-gray-900 font-heading uppercase tracking-wider">
                Official Links
              </h3>
              <div className="space-y-2 text-xs">
                {club.websiteUrl && (
                  <a
                    href={club.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 hover:text-gray-900 hover:border-blue-300 transition-colors"
                  >
                    <Globe className="w-4 h-4 text-blue-600" />
                    <span className="truncate">Official Website</span>
                    <ExternalLink className="w-3 h-3 ml-auto text-gray-400" />
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
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 hover:text-gray-900 hover:border-purple-300 transition-colors"
                    >
                      <Globe className="w-4 h-4 text-purple-600" />
                      <span className="capitalize">{network}</span>
                      <ExternalLink className="w-3 h-3 ml-auto text-gray-400" />
                    </a>
                  )
                })}

                {!club.websiteUrl && (!club.socialLinks || Object.keys(club.socialLinks).length === 0) && (
                  <p className="text-xs text-gray-500 italic">
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
