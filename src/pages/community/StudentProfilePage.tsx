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
          <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-[#18CFFC] animate-spin mb-4" />
          <p className="text-xs text-[var(--color-text-muted)] font-mono">Loading campus profile…</p>
        </div>
      </PageShell>
    )
  }

  if (!profile) {
    return (
      <PageShell>
        <div className="max-w-md mx-auto py-24 text-center p-8 rounded-3xl bg-[#0E0E12] border border-white/[0.08]">
          <h2 className="text-xl font-bold font-heading text-white mb-2">Student Profile Not Found</h2>
          <p className="text-xs text-[var(--color-text-muted)] mb-6">
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
        <div className="max-w-md mx-auto py-24 text-center p-8 rounded-3xl bg-[#0E0E12] border border-white/[0.08]">
          <div className="w-14 h-14 rounded-full bg-white/[0.05] border border-white/10 text-zinc-400 mx-auto flex items-center justify-center mb-4">
            <Lock size={24} />
          </div>
          <h2 className="text-xl font-bold font-heading text-white mb-2">Private Profile</h2>
          <p className="text-xs text-[var(--color-text-muted)] mb-6">
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
        <div className="relative rounded-3xl p-6 sm:p-8 bg-[#0E0E12] border border-white/[0.08] shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute top-0 right-0 w-64 h-64 rounded-full bg-[#18CFFC]/10 blur-3xl pointer-events-none"
          />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-[#18CFFC] via-[#07A4FC] to-[#7F1AFB] text-white font-extrabold text-2xl flex items-center justify-center shadow-xl shrink-0 border border-white/10">
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
                <h1 className="text-2xl sm:text-3xl font-extrabold font-['Syne'] text-white">
                  {profile.displayName}
                </h1>
                {profile.isTeammateDiscoverable && (
                  <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    Open for Teammates
                  </span>
                )}
              </div>

              {profile.collegeName && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-medium">
                  <GraduationCap size={15} className="text-[#18CFFC]" />
                  <span>{profile.collegeName}</span>
                  {profile.course && <span>• {profile.course}</span>}
                  {profile.academicYear && <span>({profile.academicYear})</span>}
                </div>
              )}

              {profile.bio && (
                <p className="text-xs text-zinc-300 leading-relaxed max-w-xl pt-1">
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
              className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white transition"
              title="Share Profile"
            >
              {copied ? <Check size={16} className="text-emerald-400" /> : <Share2 size={16} />}
            </button>

            {!isOwner && user && (
              <button
                onClick={() => setReportModalOpen(true)}
                className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-zinc-500 hover:text-amber-400 transition"
                title="Report Inappropriate Profile"
              >
                <Flag size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Skills & Event Categories */}
        {profile.skills.length > 0 && (
          <div className="p-6 rounded-3xl bg-[#0E0E12] border border-white/[0.08] space-y-3">
            <h3 className="text-sm font-bold font-['Syne'] text-white">Skills & Competencies</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {profile.skills.map((sk) => (
                <span
                  key={sk}
                  className="text-xs px-3 py-1 rounded-xl bg-white/[0.04] text-zinc-200 border border-white/[0.08]"
                >
                  {sk}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Verified Badges & Milestones Shelf */}
        <div className="p-6 rounded-3xl bg-[#0E0E12] border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold font-['Syne'] text-white flex items-center gap-2">
                <Trophy size={16} className="text-amber-400" />
                Verified Campus Badges ({profile.badges.length})
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Earned through verified campus event participation and competitive victories.
              </p>
            </div>
          </div>

          {profile.badges.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-white/[0.02] border border-white/[0.04] text-xs text-zinc-500">
              No campus badges unlocked yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {profile.badges.map((b) => (
                <div
                  key={b.id}
                  className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col items-center text-center gap-1.5"
                >
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold">
                    ★
                  </div>
                  <span className="text-xs font-bold text-white line-clamp-1">{b.title}</span>
                  <span className="text-[10px] text-zinc-400 line-clamp-2">{b.description}</span>
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
