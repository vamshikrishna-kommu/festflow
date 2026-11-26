import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import {
  GraduationCap,
  Trophy,
  Lock,
  MessageSquare,
  UserPlus,
  Share2,
  Check,
  Flag,
} from 'lucide-react'
import { Button } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/context/AuthContext'
import type { StudentPublicProfile } from '@/types'
import { getStudentPublicProfile } from '@/lib/community'
import { ReportModal } from '@/components/community/ReportModal'

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const profileId = id || user?.id || ''

  const [profile, setProfile] = useState<StudentPublicProfile | null>(null)
  const [isPrivate, setIsPrivate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  // Report Modal
  const [reportModalOpen, setReportModalOpen] = useState(false)

  const isOwner = user?.id === profileId

  useEffect(() => {
    async function loadProfile() {
      if (!profileId) return
      setLoading(true)
      const res = await getStudentPublicProfile(profileId, user?.id)
      setLoading(false)
      if (res.success && res.profile) {
        setProfile(res.profile)
        setIsPrivate(!!res.isPrivate)
      }
    }

    loadProfile()
  }, [profileId, user?.id])

  const handleShare = () => {
    const url = window.location.href
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: `${profile?.displayName || 'Student'} on FestFlow`,
        text: `View verified achievements and campus portfolio of ${profile?.displayName || 'this student'}.`,
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
          <p className="text-xs text-gray-500 font-mono">Loading campus profile…</p>
        </div>
      </PageShell>
    )
  }

  if (!profile) {
    return (
      <PageShell>
        <div className="max-w-md mx-auto py-24 text-center p-8 rounded-3xl bg-white border border-gray-200 shadow-xs">
          <h2 className="text-xl font-bold font-heading text-gray-900 mb-2">Student Profile Not Found</h2>
          <p className="text-xs text-gray-600 mb-6">
            The profile you are looking for does not exist or may have been deactivated.
          </p>
          <Link to="/community">
            <Button variant="primary" size="md">
              Return to Campus Community
            </Button>
          </Link>
        </div>
      </PageShell>
    )
  }

  if (isPrivate && !isOwner) {
    return (
      <PageShell>
        <div className="max-w-md mx-auto py-24 text-center p-8 rounded-3xl bg-white border border-gray-200 shadow-xs">
          <div className="w-14 h-14 rounded-full bg-gray-100 border border-gray-200 text-gray-500 mx-auto flex items-center justify-center mb-4">
            <Lock size={24} />
          </div>
          <h2 className="text-xl font-bold font-heading text-gray-900 mb-2">Private Profile</h2>
          <p className="text-xs text-gray-600 mb-6">
            This student has set their portfolio to private. Only they can view their verified credentials and badges.
          </p>
          <Link to="/community">
            <Button variant="outline" size="md">
              Back to Community
            </Button>
          </Link>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-left space-y-8">
        {/* Profile Header Card */}
        <div className="relative rounded-3xl p-6 sm:p-8 bg-white border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden">
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-blue-50 text-blue-700 font-extrabold text-2xl flex items-center justify-center shadow-xs shrink-0 border border-blue-200">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  className="w-full h-full rounded-2xl object-cover"
                />
              ) : (
                profile.displayName.charAt(0)
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold font-['Syne'] text-gray-900">
                  {profile.displayName}
                </h1>
                {profile.isTeammateDiscoverable && (
                  <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Open for Teammates
                  </span>
                )}
              </div>

              {profile.collegeName && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
                  <GraduationCap size={15} className="text-blue-600" />
                  <span>{profile.collegeName}</span>
                  {profile.course && <span>• {profile.course}</span>}
                  {profile.academicYear && <span>({profile.academicYear})</span>}
                </div>
              )}

              {profile.bio && (
                <p className="text-xs text-gray-600 leading-relaxed max-w-xl pt-1">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="relative z-10 flex items-center gap-2.5 flex-wrap shrink-0">
            {!isOwner && user && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<MessageSquare size={14} />}
                  onClick={() => navigate(`/messages?user=${profile.id}`)}
                >
                  Direct Message
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<UserPlus size={14} />}
                  onClick={() => navigate('/community/teammates')}
                >
                  Squad Match
                </Button>
              </>
            )}

            <button
              onClick={handleShare}
              className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition"
              title="Share Profile"
            >
              {copied ? <Check size={16} className="text-emerald-600" /> : <Share2 size={16} />}
            </button>

            {!isOwner && user && (
              <button
                onClick={() => setReportModalOpen(true)}
                className="p-2.5 rounded-xl bg-gray-100 hover:bg-amber-50 text-gray-500 hover:text-amber-600 transition"
                title="Report Inappropriate Profile"
              >
                <Flag size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Skills & Event Categories */}
        {profile.skills.length > 0 && (
          <div className="p-6 rounded-3xl bg-white border border-gray-200 shadow-xs space-y-3">
            <h3 className="text-sm font-bold font-['Syne'] text-gray-900">Skills & Competencies</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {profile.skills.map((sk) => (
                <span
                  key={sk}
                  className="text-xs px-3 py-1 rounded-xl bg-gray-50 text-gray-700 border border-gray-200"
                >
                  {sk}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Verified Badges & Milestones Shelf */}
        <div className="p-6 rounded-3xl bg-white border border-gray-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold font-['Syne'] text-gray-900 flex items-center gap-2">
                <Trophy size={16} className="text-amber-500" />
                Verified Campus Badges ({profile.badges.length})
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Earned through verified campus event participation and competitive victories.
              </p>
            </div>
          </div>

          {profile.badges.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-gray-50 border border-gray-200 text-xs text-gray-500">
              No campus badges unlocked yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {profile.badges.map((b) => (
                <div
                  key={b.id}
                  className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 flex flex-col items-center text-center gap-1.5"
                >
                  <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-bold">
                    ★
                  </div>
                  <span className="text-xs font-bold text-gray-900 line-clamp-1">{b.title}</span>
                  <span className="text-[10px] text-gray-600 line-clamp-2">{b.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Report Modal */}
        <ReportModal
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          targetType="profile"
          targetId={profile.id}
          targetTitle={profile.displayName}
        />
      </div>
    </PageShell>
  )
}
