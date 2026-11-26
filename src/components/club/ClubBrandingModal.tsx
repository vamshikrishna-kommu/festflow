import { useState, useEffect } from 'react'
import {
  Building2,
  Globe,
  ShieldCheck,
  Save,
  AlertCircle,
  Share2,
} from 'lucide-react'
import { Modal, ModalBody, Button } from '@/components/ui'
import { getClubBranding, updateClubBranding } from '@/lib/clubBranding'
import type { ClubSocialLinks } from '@/types'

interface ClubBrandingModalProps {
  isOpen: boolean
  onClose: () => void
  clubId: string
  onUpdated?: () => void
}

const CATEGORIES = [
  'Technical & Coding',
  'Cultural & Arts',
  'Sports & Esports',
  'Business & Entrepreneurship',
  'Robotics & IoT',
  'Literature & Debating',
  'Social Service & Outreach',
  'General',
]

export function ClubBrandingModal({
  isOpen,
  onClose,
  clubId,
  onUpdated,
}: ClubBrandingModalProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ message: string; isError?: boolean } | null>(null)

  // Fields
  const [clubName, setClubName] = useState('')
  const [repName, setRepName] = useState('')
  const [category, setCategory] = useState('Technical & Coding')
  const [description, setDescription] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [coverUrl, setCoverUrl] = useState('')

  // Social Links
  const [instagram, setInstagram] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [twitter, setTwitter] = useState('')
  const [discord, setDiscord] = useState('')

  useEffect(() => {
    if (isOpen && clubId) {
      setLoading(true)
      setNotice(null)
      getClubBranding(clubId).then((res) => {
        setLoading(false)
        if (res.profile) {
          setClubName(res.profile.club_name || '')
          setRepName(res.profile.representative_name || '')
          setCategory((res.profile as any).category || 'Technical & Coding')
          setDescription(res.profile.description || '')
          setWebsiteUrl(res.profile.website_url || '')
          setLogoUrl((res.profile as any).logo_url || '')
          setCoverUrl((res.profile as any).cover_url || '')
          const s = (res.profile as any).social_links || {}
          setInstagram(s.instagram || '')
          setLinkedin(s.linkedin || '')
          setTwitter(s.twitter || '')
          setDiscord(s.discord || '')
        }
      })
    }
  }, [isOpen, clubId])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setNotice(null)

    const socialLinks: ClubSocialLinks = {
      instagram: instagram.trim() || undefined,
      linkedin: linkedin.trim() || undefined,
      twitter: twitter.trim() || undefined,
      discord: discord.trim() || undefined,
      website: websiteUrl.trim() || undefined,
    }

    const res = await updateClubBranding(clubId, {
      club_name: clubName.trim(),
      representative_name: repName.trim(),
      category,
      description: description.trim(),
      website_url: websiteUrl.trim() || undefined,
      logo_url: logoUrl.trim() || undefined,
      cover_url: coverUrl.trim() || undefined,
      social_links: socialLinks,
    })

    setSaving(false)
    if (res.error) {
      setNotice({ message: res.error, isError: true })
      return
    }

    setNotice({ message: 'Organization profile & branding updated successfully!' })
    if (onUpdated) onUpdated()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Club Profile & Brand Identity">
      <ModalBody>
        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <p className="text-xs text-gray-600">
            Customize your verified club identity, logo, banners, and social channels shown across FestFlow.
          </p>

          {loading && (
            <div className="py-2 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
              Loading club branding...
            </div>
          )}

          {notice && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                notice.isError
                  ? 'bg-rose-50 border border-rose-200 text-rose-700'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              }`}
            >
              <AlertCircle size={14} />
              <span>{notice.message}</span>
            </div>
          )}

          {/* Live Card Preview */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 relative overflow-hidden flex flex-col gap-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
              Live Profile Preview
            </span>

            {/* Banner preview */}
            <div className="h-20 w-full rounded-xl bg-gradient-to-r from-blue-100 via-indigo-100 to-slate-100 overflow-hidden relative border border-gray-200">
              {coverUrl && (
                <img
                  src={coverUrl}
                  alt="Cover Banner"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    ;(e.target as HTMLElement).style.display = 'none'
                  }}
                />
              )}
            </div>

            {/* Avatar & Info */}
            <div className="flex items-center gap-3 -mt-6 px-2">
              <div className="w-12 h-12 rounded-xl bg-white border-2 border-blue-600 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={clubName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      ;(e.target as HTMLElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <Building2 size={20} className="text-blue-600" />
                )}
              </div>
              <div className="pt-4">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-bold font-heading text-gray-900">
                    {clubName || 'Organization Name'}
                  </h4>
                  <ShieldCheck size={14} className="text-blue-600" />
                </div>
                <span className="text-[11px] text-gray-500">
                  {category} • Lead: {repName || 'Club Lead'}
                </span>
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                Organization Display Name *
              </label>
              <input
                type="text"
                required
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                Representative / Lead Organizer *
              </label>
              <input
                type="text"
                required
                value={repName}
                onChange={(e) => setRepName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                Club Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                Official Website
              </label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://myclub.college.edu"
                className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                Logo Image URL
              </label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://.../logo.png"
                className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                Cover Banner Image URL
              </label>
              <input
                type="url"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="https://.../banner.jpg"
                className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-gray-700 block mb-1">
              About & Mission Statement
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your student organization, achievements, and types of events hosted..."
              className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 resize-none"
            />
          </div>

          {/* Social Media Links */}
          <div className="flex flex-col gap-2 pt-2 border-t border-gray-200">
            <span className="text-xs font-semibold text-gray-700">Social Channels</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-gray-200">
                <Share2 size={14} className="text-pink-600 shrink-0" />
                <input
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="Instagram handle or URL"
                  className="w-full bg-transparent text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-gray-200">
                <Share2 size={14} className="text-sky-600 shrink-0" />
                <input
                  type="text"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="LinkedIn profile or URL"
                  className="w-full bg-transparent text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-gray-200">
                <Share2 size={14} className="text-blue-600 shrink-0" />
                <input
                  type="text"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="X / Twitter handle"
                  className="w-full bg-transparent text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-gray-200">
                <Globe size={14} className="text-indigo-600 shrink-0" />
                <input
                  type="text"
                  value={discord}
                  onChange={(e) => setDiscord(e.target.value)}
                  placeholder="Discord Community invite link"
                  className="w-full bg-transparent text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200">
            <Button size="sm" variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              type="submit"
              disabled={saving}
              leftIcon={<Save size={14} />}
            >
              {saving ? 'Saving Changes...' : 'Save Branding'}
            </Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  )
}

