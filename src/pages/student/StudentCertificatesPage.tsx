import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router'
import {
  Award,
  ShieldCheck,
  Search,
  Eye,
  Share2,
  Trophy,
  Lock,
  CheckCircle2,
  Copy,
  Check,
  Pin,
  EyeOff,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import type { EventCertificateRecord } from '@/types'
import { getStudentCertificates } from '@/lib/certificates'
import {
  evaluateAndAwardStudentBadges,
  toggleBadgePin,
  toggleBadgePrivacy,
  type BadgeDefinition,
} from '@/lib/badges'
import { CertificatePreviewModal } from '@/components/certificates/CertificatePreviewModal'
import { ShareAchievementCardModal } from '@/components/certificates/ShareAchievementCardModal'

type BadgeItem = BadgeDefinition & {
  isUnlocked: boolean
  progress: number
  total: number
  earnedAt?: string
  isPinned: boolean
  isPublic: boolean
}

export default function StudentCertificatesPage() {
  const { user } = useAuth()
  const studentId = user?.id || ''

  const [activeTab, setActiveTab] = useState<'vault' | 'badges'>('vault')
  const [loading, setLoading] = useState(true)
  const [certificates, setCertificates] = useState<EventCertificateRecord[]>([])
  const [badges, setBadges] = useState<BadgeItem[]>([])

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  // Selected Certificate for Preview / Share
  const [previewCert, setPreviewCert] = useState<EventCertificateRecord | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [shareCert, setShareCert] = useState<EventCertificateRecord | null>(null)
  const [shareOpen, setShareOpen] = useState(false)

  // Copy Feedback
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    async function loadStudentVault() {
      if (!studentId) return
      setLoading(true)

      const [certsRes, badgesRes] = await Promise.all([
        getStudentCertificates(studentId),
        evaluateAndAwardStudentBadges(studentId),
      ])

      setCertificates(certsRes.certificates)
      setBadges(badgesRes.badges)
      setLoading(false)
    }

    loadStudentVault()
  }, [studentId])

  const filteredCertificates = useMemo(() => {
    return certificates.filter((c) => {
      const matchSearch =
        c.event_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.club_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.certificate_number.toLowerCase().includes(searchQuery.toLowerCase())

      const matchCategory =
        categoryFilter === 'all' ||
        (categoryFilter === 'awards' && (c.category === 'winner' || c.category === 'runner_up' || c.category === 'finalist')) ||
        c.category === categoryFilter

      return matchSearch && matchCategory
    })
  }, [certificates, searchQuery, categoryFilter])

  const handleCopyLink = (token: string, id: string) => {
    const url = `https://festflow.online/verify/certificate/${token}`
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleTogglePin = async (badgeKey: string, currentPin: boolean) => {
    await toggleBadgePin(studentId, badgeKey, !currentPin)
    setBadges((prev) =>
      prev.map((b) => (b.key === badgeKey ? { ...b, isPinned: !currentPin } : b))
    )
  }

  const handleTogglePrivacy = async (badgeKey: string, currentPublic: boolean) => {
    await toggleBadgePrivacy(studentId, badgeKey, !currentPublic)
    setBadges((prev) =>
      prev.map((b) => (b.key === badgeKey ? { ...b, isPublic: !currentPublic } : b))
    )
  }

  const earnedCount = badges.filter((b) => b.isUnlocked).length
  const totalBadges = badges.length

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] pb-24">
      {/* Page Header */}
      <div className="border-b border-white/[0.08] bg-[var(--color-surface-1)]/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-mono text-[#18CFFC] uppercase font-bold tracking-wider mb-1">
              <ShieldCheck size={14} /> Official Student Vault
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-['Syne'] text-white">
              My Certificates & Badges
            </h1>
            <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5">
              Verified campus achievements, cryptographic certificate credentials, and milestone awards.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/discover">
              <Button variant="outline" size="sm">
                Explore Events
              </Button>
            </Link>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-6 overflow-x-auto text-xs font-semibold scrollbar-none">
          <button
            onClick={() => setActiveTab('vault')}
            className={`py-3.5 border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'vault'
                ? 'border-[#18CFFC] text-[#18CFFC]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-white'
            }`}
          >
            <Award size={15} />
            <span>Certificates Vault ({certificates.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('badges')}
            className={`py-3.5 border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'badges'
                ? 'border-[#18CFFC] text-[#18CFFC]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-white'
            }`}
          >
            <Trophy size={15} />
            <span>Campus Badges & Milestones ({earnedCount}/{totalBadges})</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* ── TAB 1: CERTIFICATES VAULT ───────────────────────────────────── */}
        {activeTab === 'vault' && (
          <div className="space-y-6">
            {/* Search and Filters Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  placeholder="Search by event title, issuing club, or certificate number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--color-surface-1)] border border-white/[0.08] text-xs text-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC]"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-[var(--color-surface-1)] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#18CFFC]"
              >
                <option value="all">All Certificates</option>
                <option value="participation">Participation</option>
                <option value="awards">Podium & Winner Awards</option>
                <option value="special_recognition">Special Recognition</option>
                <option value="merit">Merit & Honor</option>
              </select>
            </div>

            {/* Empty State */}
            {loading ? (
              <div className="p-12 text-center rounded-2xl bg-[var(--color-surface-1)] border border-white/[0.08] text-xs font-mono text-white/50">
                Loading certificates...
              </div>
            ) : filteredCertificates.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-[var(--color-surface-1)] border border-white/[0.08]">
                <Award size={40} className="text-[var(--color-text-muted)] mx-auto mb-3" />
                <h3 className="text-base font-bold text-white">No certificates in your vault yet</h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-sm mx-auto">
                  Certificates are issued by campus clubs after verified gate check-in at completed events.
                </p>
                <Link to="/discover">
                  <Button variant="primary" size="sm" className="mt-4">
                    Find Upcoming Campus Events
                  </Button>
                </Link>
              </div>
            ) : (
              /* Certificate Cards Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCertificates.map((cert) => {
                  const isRevoked = cert.status === 'revoked'
                  const isAward = cert.category === 'winner' || cert.category === 'runner_up' || cert.category === 'finalist'

                  return (
                    <div
                      key={cert.id}
                      className="group rounded-2xl p-5 sm:p-6 bg-[var(--color-surface-1)] border border-white/[0.08] hover:border-white/[0.2] transition-all flex flex-col justify-between shadow-xl relative overflow-hidden"
                    >
                      {/* Top Glowing Corner Accent */}
                      <div
                        className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl pointer-events-none transition ${
                          isAward ? 'bg-amber-500/10' : 'bg-[#18CFFC]/10'
                        }`}
                      />

                      <div>
                        {/* Header Pill & Category */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                                isAward
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  : 'bg-[#18CFFC]/10 text-[#18CFFC] border-[#18CFFC]/30'
                              }`}
                            >
                              <Award size={11} /> {cert.category.replace(/_/g, ' ')}
                            </span>
                            {isRevoked && (
                              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                Revoked
                              </span>
                            )}
                          </div>

                          <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                            {new Date(cert.issue_date).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Title & Event */}
                        <h3 className="text-base font-extrabold font-['Syne'] text-white group-hover:text-[#18CFFC] transition line-clamp-1">
                          {cert.title || cert.event_title}
                        </h3>
                        <p className="text-xs text-[var(--color-brand-cyan)] font-medium mt-0.5 line-clamp-1">
                          {cert.event_title}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          Organized by <strong className="text-gray-300">{cert.club_name}</strong>
                        </p>

                        {/* Verification Reference Pill */}
                        <div className="mt-4 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-[11px] font-mono">
                          <span className="text-gray-400">ID:</span>
                          <span className="text-[#18CFFC] font-bold">{cert.certificate_number}</span>
                        </div>
                      </div>

                      {/* Card Actions Footer */}
                      <div className="mt-5 pt-4 border-t border-white/[0.08] flex items-center justify-between gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          leftIcon={<Eye size={13} />}
                          onClick={() => {
                            setPreviewCert(cert)
                            setPreviewOpen(true)
                          }}
                        >
                          View Pass
                        </Button>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleCopyLink(cert.verification_token, cert.id)}
                            className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white transition"
                            title="Copy Verification Link"
                          >
                            {copiedId === cert.id ? (
                              <Check size={14} className="text-green-400" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>

                          <button
                            onClick={() => {
                              setShareCert(cert)
                              setShareOpen(true)
                            }}
                            className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white transition"
                            title="Share Achievement Card"
                          >
                            <Share2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: CAMPUS BADGES & MILESTONES ───────────────────────────── */}
        {activeTab === 'badges' && (
          <div className="space-y-8">
            {/* Badges Progress Summary Banner */}
            <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#18CFFC]/15 via-[#7F1AFB]/10 to-transparent border border-white/[0.1] shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#18CFFC]">
                  Gamified Milestone Ledger
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold font-['Syne'] text-white mt-1">
                  Campus Achievements & Credentials
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-xl">
                  Badges are unlocked automatically upon verified event gate check-ins and earned credentials.
                </p>
              </div>

              <div className="flex items-center gap-4 bg-white/[0.04] p-4 rounded-2xl border border-white/[0.08]">
                <div className="text-center">
                  <p className="text-2xl font-extrabold font-['Syne'] text-white">{earnedCount}</p>
                  <p className="text-[10px] font-mono uppercase text-emerald-400">Unlocked</p>
                </div>
                <div className="w-px h-8 bg-white/[0.1]" />
                <div className="text-center">
                  <p className="text-2xl font-extrabold font-['Syne'] text-[var(--color-text-muted)]">
                    {totalBadges - earnedCount}
                  </p>
                  <p className="text-[10px] font-mono uppercase text-[var(--color-text-muted)]">Locked</p>
                </div>
              </div>
            </div>

            {/* Badges Matrix Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {badges.map((badge) => {
                const percent = Math.round((badge.progress / badge.total) * 100)

                return (
                  <div
                    key={badge.key}
                    className={`rounded-2xl p-5 sm:p-6 border transition-all flex flex-col justify-between ${
                      badge.isUnlocked
                        ? 'bg-[var(--color-surface-1)] border-white/[0.1] hover:border-white/[0.2] shadow-xl'
                        : 'bg-white/[0.01] border-white/[0.04] opacity-75'
                    }`}
                  >
                    <div>
                      {/* Top Header Row */}
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-md ${
                            badge.isUnlocked
                              ? 'bg-gradient-to-br from-[#18CFFC]/20 to-[#7F1AFB]/30 border border-white/[0.15] text-[#18CFFC]'
                              : 'bg-white/[0.04] border border-white/[0.06] text-gray-500'
                          }`}
                        >
                          {badge.isUnlocked ? <Sparkles size={22} /> : <Lock size={20} />}
                        </div>

                        <span
                          className={`text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                            badge.isUnlocked
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-white/[0.04] text-gray-400 border-white/[0.08]'
                          }`}
                        >
                          {badge.isUnlocked ? 'Unlocked' : 'In Progress'}
                        </span>
                      </div>

                      <h3 className="text-base font-extrabold font-['Syne'] text-white">
                        {badge.title}
                      </h3>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                        {badge.description}
                      </p>
                    </div>

                    {/* Progress Bar & Milestone Status */}
                    <div className="mt-5 pt-4 border-t border-white/[0.06]">
                      <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                        <span className="text-[var(--color-text-muted)]">Milestone</span>
                        <span className="font-bold text-white">
                          {badge.progress} / {badge.total}
                        </span>
                      </div>

                      <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            badge.isUnlocked
                              ? 'bg-gradient-to-r from-[#18CFFC] to-[#ED47FC]'
                              : 'bg-[#18CFFC]/40'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      {/* Controls for Unlocked Badges */}
                      {badge.isUnlocked && (
                        <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                          <button
                            onClick={() => handleTogglePin(badge.key, badge.isPinned)}
                            className={`inline-flex items-center gap-1 hover:text-white transition ${
                              badge.isPinned ? 'text-[#18CFFC] font-semibold' : ''
                            }`}
                          >
                            <Pin size={12} />
                            <span>{badge.isPinned ? 'Pinned' : 'Pin to Profile'}</span>
                          </button>

                          <button
                            onClick={() => handleTogglePrivacy(badge.key, badge.isPublic)}
                            className="inline-flex items-center gap-1 hover:text-white transition"
                          >
                            {badge.isPublic ? <CheckCircle2 size={12} className="text-emerald-400" /> : <EyeOff size={12} />}
                            <span>{badge.isPublic ? 'Public' : 'Private'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Certificate Preview Modal */}
      <CertificatePreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        certificate={previewCert}
      />

      {/* Share Achievement Modal */}
      {shareCert && (
        <ShareAchievementCardModal
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          certificate={shareCert}
        />
      )}
    </div>
  )
}

