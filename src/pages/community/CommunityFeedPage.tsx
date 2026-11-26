import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import {
  Compass,
  Users,
  Megaphone,
  Calendar,
  Share2,
  Check,
  Shield,
  ArrowRight,
  MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/context/AuthContext'
import type { CampusFeedItem } from '@/types'
import { getCampusActivityFeed } from '@/lib/community'

export default function CommunityFeedPage() {
  const { user } = useAuth()
  const [filter, setFilter] = useState<'all' | 'announcements' | 'events'>('all')
  const [feedItems, setFeedItems] = useState<CampusFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    async function loadFeed() {
      setLoading(true)
      const res = await getCampusActivityFeed({
        viewerId: user?.id,
        filter,
        limit: 25,
      })
      setLoading(false)
      if (res.success) {
        setFeedItems(res.items)
      }
    }

    loadFeed()
  }, [filter, user?.id])

  const handleShare = async (item: CampusFeedItem) => {
    const shareUrl = `${window.location.origin}${item.linkUrl || '/community'}`
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: item.title,
          text: item.content || 'Check out this campus update on FestFlow!',
          url: shareUrl,
        })
        return
      } catch {
        // user cancelled or fallback
      }
    }
    navigator.clipboard.writeText(shareUrl)
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-left space-y-8">
        {/* Top Community Banner & Quick Action Cards */}
        <div className="relative rounded-3xl p-6 sm:p-8 bg-white border border-gray-200 shadow-xs overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase text-blue-600 tracking-wider font-bold mb-2">
                <Compass size={14} /> Official Campus Hub
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold font-['Syne'] text-gray-900">
                FestFlow Community
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1.5 max-w-xl">
                Stay updated with verified student clubs, coordinate event squads, discover talented peers, and celebrate campus achievements.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-3 flex-wrap shrink-0">
              <Link to="/community/teammates">
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Users size={16} />}
                  className="font-semibold"
                >
                  Find Teammates
                </Button>
              </Link>

              {user && (
                <Link to="/messages">
                  <Button
                    variant="outline"
                    size="md"
                    leftIcon={<MessageSquare size={16} />}
                  >
                    Direct Messages
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Filter Navigation Bar */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-4 flex-wrap gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                filter === 'all'
                  ? 'bg-gray-900 text-white font-semibold shadow-xs'
                  : 'bg-white border border-gray-200 text-gray-600 hover:text-gray-900'
              }`}
            >
              All Activity
            </button>
            <button
              onClick={() => setFilter('announcements')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                filter === 'announcements'
                  ? 'bg-purple-600 text-white font-semibold shadow-xs'
                  : 'bg-white border border-gray-200 text-gray-600 hover:text-gray-900'
              }`}
            >
              <Megaphone size={13} /> Club Announcements
            </button>
            <button
              onClick={() => setFilter('events')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                filter === 'events'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'bg-white border border-gray-200 text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar size={13} /> New Events
            </button>
          </div>

          <span className="text-xs font-mono text-gray-500">
            Showing curated campus broadcasts
          </span>
        </div>

        {/* Activity Stream */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin mb-4" />
            <p className="text-xs text-gray-500 font-mono">Loading campus activity…</p>
          </div>
        ) : feedItems.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white border border-gray-200 shadow-xs">
            <Compass size={36} className="text-gray-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-900">No activity yet in this channel</h3>
            <p className="text-xs text-gray-600 mt-1">
              Follow official student organizations to see their announcements and newly scheduled events here.
            </p>
            <Link to="/discover">
              <Button variant="primary" size="sm" className="mt-4">
                Explore Upcoming Events
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {feedItems.map((item) => (
              <div
                key={item.id}
                className="group p-5 sm:p-6 rounded-2xl bg-white border border-gray-200 hover:border-gray-300 transition-all flex flex-col justify-between shadow-xs relative overflow-hidden"
              >
                {/* Header: Author & Category Badge */}
                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                        {item.author.avatarUrl ? (
                          <img
                            src={item.author.avatarUrl}
                            alt={item.author.name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          item.author.name.charAt(0)
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-gray-900 line-clamp-1">
                            {item.author.name}
                          </span>
                          {item.author.isVerified && (
                            <span className="inline-flex items-center text-blue-600" title="Verified Club">
                              <Shield size={12} className="fill-blue-100" />
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-gray-500">
                          {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                        item.type === 'announcement'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}
                    >
                      {item.type}
                    </span>
                  </div>

                  {/* Feed Item Image if present */}
                  {item.imageUrl && (
                    <div className="w-full h-40 rounded-xl overflow-hidden mb-3 border border-gray-200 bg-gray-100">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}

                  {/* Title & Body */}
                  <h3 className="text-base font-bold font-['Syne'] text-gray-900 group-hover:text-blue-600 transition line-clamp-2">
                    {item.title}
                  </h3>
                  {item.content && (
                    <p className="text-xs text-gray-600 mt-1.5 leading-relaxed line-clamp-3">
                      {item.content}
                    </p>
                  )}
                </div>

                {/* Footer Action Bar */}
                <div className="mt-5 pt-3.5 border-t border-gray-200 flex items-center justify-between gap-2">
                  {item.linkUrl ? (
                    <Link to={item.linkUrl}>
                      <Button
                        variant="primary"
                        size="sm"
                        rightIcon={<ArrowRight size={13} />}
                      >
                        {item.type === 'event' ? 'View Event Pass' : 'View Club Page'}
                      </Button>
                    </Link>
                  ) : (
                    <div />
                  )}

                  <button
                    onClick={() => handleShare(item)}
                    className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition"
                    title="Share Link"
                  >
                    {copiedId === item.id ? (
                      <Check size={14} className="text-emerald-600" />
                    ) : (
                      <Share2 size={14} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  )
}
