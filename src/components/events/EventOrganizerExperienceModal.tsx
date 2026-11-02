import { useState } from 'react'
import {
  Ticket,
  Calendar,
  Users,
  Image as ImageIcon,
  Megaphone,
  Trophy,
  Video,
  ShoppingBag,
  Plus,
  Trash2,
  Check,
} from 'lucide-react'
import { Button, Modal, ModalBody, ModalFooter } from '@/components/ui'
import {
  saveTicketTier,
  deleteTicketTier,
  saveEventSchedule,
  deleteEventSchedule,
  saveEventSpeaker,
  deleteEventSpeaker,
  uploadEventGalleryImage,
  deleteEventGalleryImage,
  publishEventAnnouncement,
  deleteEventAnnouncement,
  saveLeaderboardEntry,
  deleteLeaderboardEntry,
  saveEventAddon,
  deleteEventAddon,
} from '@/lib/eventExperience'
import { updateEvent } from '@/lib/events'
import type {
  EventTicketTier,
  EventScheduleItem,
  EventSpeaker,
  EventGalleryImage,
  EventAnnouncement,
  EventLeaderboardEntry,
  EventAddon,
} from '@/types'

interface EventOrganizerExperienceModalProps {
  isOpen: boolean
  onClose: () => void
  eventId: string
  clubId: string
  initialData: {
    meetingPlatform?: string | null
    meetingUrl?: string | null
    joiningInstructions?: string | null
    accessWindowMinutes?: number
    leaderboardEnabled?: boolean
    leaderboardTitle?: string
  }
  tiers: EventTicketTier[]
  schedules: EventScheduleItem[]
  speakers: EventSpeaker[]
  gallery: EventGalleryImage[]
  announcements: EventAnnouncement[]
  leaderboard: EventLeaderboardEntry[]
  addons: EventAddon[]
  onRefresh: () => void
}

type TabType =
  | 'tiers'
  | 'schedule'
  | 'speakers'
  | 'gallery'
  | 'announcements'
  | 'leaderboard'
  | 'virtual'
  | 'addons'

export function EventOrganizerExperienceModal({
  isOpen,
  onClose,
  eventId,
  clubId,
  initialData,
  tiers,
  schedules,
  speakers,
  gallery,
  announcements,
  leaderboard,
  addons,
  onRefresh,
}: EventOrganizerExperienceModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('tiers')

  // Form states for adding items
  // 1. Tiers
  const [tierName, setTierName] = useState('')
  const [tierPrice, setTierPrice] = useState('0')
  const [tierCapacity, setTierCapacity] = useState('100')
  const [tierPerksInput, setTierPerksInput] = useState('')

  // 2. Schedule
  const [scheduleTitle, setScheduleTitle] = useState('')
  const [scheduleStartTime, setScheduleStartTime] = useState('')
  const [scheduleSpeaker, setScheduleSpeaker] = useState('')
  const [scheduleStage, setScheduleStage] = useState('')

  // 3. Speakers
  const [speakerName, setSpeakerName] = useState('')
  const [speakerDesignation, setSpeakerDesignation] = useState('')
  const [speakerOrg, setSpeakerOrg] = useState('')
  const [speakerBio, setSpeakerBio] = useState('')

  // 4. Gallery
  const [galleryUrl, setGalleryUrl] = useState('')
  const [galleryCaption, setGalleryCaption] = useState('')

  // 5. Announcements
  const [annTitle, setAnnTitle] = useState('')
  const [annContent, setAnnContent] = useState('')
  const [annPinned, setAnnPinned] = useState(false)
  const [annPriority, setAnnPriority] = useState<'normal' | 'urgent' | 'schedule_change' | 'venue_change'>('normal')

  // 6. Leaderboard
  const [leadName, setLeadName] = useState('')
  const [leadTeam, setLeadTeam] = useState('')
  const [leadScore, setLeadScore] = useState('0')
  const [leadRank, setLeadRank] = useState('1')

  // 7. Virtual Link
  const [meetingPlatform, setMeetingPlatform] = useState(initialData.meetingPlatform || 'google_meet')
  const [meetingUrl, setMeetingUrl] = useState(initialData.meetingUrl || '')
  const [joiningInstructions, setJoiningInstructions] = useState(initialData.joiningInstructions || '')
  const [accessMinutes, setAccessMinutes] = useState(String(initialData.accessWindowMinutes || 30))

  // 8. Addons
  const [addonName, setAddonName] = useState('')
  const [addonPrice, setAddonPrice] = useState('0')
  const [addonStock, setAddonStock] = useState('50')

  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  if (!isOpen) return null

  // Handlers
  const handleAddTier = async () => {
    if (!tierName.trim()) return
    setSaving(true)
    const perks = tierPerksInput
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    await saveTicketTier({
      event_id: eventId,
      name: tierName,
      price: Number(tierPrice) || 0,
      capacity: Number(tierCapacity) || 100,
      perks,
      tier_type: Number(tierPrice) === 0 ? 'free' : 'standard',
    })
    setTierName('')
    setTierPrice('0')
    setTierCapacity('100')
    setTierPerksInput('')
    setSaving(false)
    setNotice('Ticket tier saved!')
    setTimeout(() => setNotice(null), 3000)
    onRefresh()
  }

  const handleAddSchedule = async () => {
    if (!scheduleTitle.trim() || !scheduleStartTime) return
    setSaving(true)
    await saveEventSchedule({
      event_id: eventId,
      title: scheduleTitle,
      start_time: new Date(scheduleStartTime).toISOString(),
      speaker_name: scheduleSpeaker || null,
      venue_stage: scheduleStage || null,
    })
    setScheduleTitle('')
    setScheduleStartTime('')
    setScheduleSpeaker('')
    setScheduleStage('')
    setSaving(false)
    setNotice('Schedule session added!')
    setTimeout(() => setNotice(null), 3000)
    onRefresh()
  }

  const handleAddSpeaker = async () => {
    if (!speakerName.trim()) return
    setSaving(true)
    await saveEventSpeaker({
      event_id: eventId,
      name: speakerName,
      designation: speakerDesignation || null,
      organization: speakerOrg || null,
      bio: speakerBio || null,
      role: 'speaker',
    })
    setSpeakerName('')
    setSpeakerDesignation('')
    setSpeakerOrg('')
    setSpeakerBio('')
    setSaving(false)
    setNotice('Speaker profile added!')
    setTimeout(() => setNotice(null), 3000)
    onRefresh()
  }

  const handleAddGalleryImage = async () => {
    if (!galleryUrl.trim()) return
    setSaving(true)
    await uploadEventGalleryImage(eventId, galleryUrl.trim(), galleryCaption || undefined)
    setGalleryUrl('')
    setGalleryCaption('')
    setSaving(false)
    setNotice('Gallery image uploaded!')
    setTimeout(() => setNotice(null), 3000)
    onRefresh()
  }

  const handleAddAnnouncement = async () => {
    if (!annTitle.trim() || !annContent.trim()) return
    setSaving(true)
    await publishEventAnnouncement({
      event_id: eventId,
      club_id: clubId,
      title: annTitle,
      content: annContent,
      is_pinned: annPinned,
      priority: annPriority,
    })
    setAnnTitle('')
    setAnnContent('')
    setAnnPinned(false)
    setSaving(false)
    setNotice('Announcement published!')
    setTimeout(() => setNotice(null), 3000)
    onRefresh()
  }

  const handleAddLeaderboard = async () => {
    if (!leadName.trim()) return
    setSaving(true)
    await saveLeaderboardEntry({
      event_id: eventId,
      participant_name: leadName,
      team_name: leadTeam || null,
      score: Number(leadScore) || 0,
      rank: Number(leadRank) || 1,
    })
    setLeadName('')
    setLeadTeam('')
    setLeadScore('0')
    setSaving(false)
    setNotice('Leaderboard score saved!')
    setTimeout(() => setNotice(null), 3000)
    onRefresh()
  }

  const handleSaveVirtualSettings = async () => {
    setSaving(true)
    await updateEvent(eventId, {
      meeting_platform: meetingPlatform,
      meeting_url: meetingUrl.trim() || null,
      joining_instructions: joiningInstructions.trim() || null,
      access_window_minutes: Number(accessMinutes) || 30,
    } as any)
    setSaving(false)
    setNotice('Virtual joining settings saved!')
    setTimeout(() => setNotice(null), 3000)
    onRefresh()
  }

  const handleAddAddon = async () => {
    if (!addonName.trim()) return
    setSaving(true)
    await saveEventAddon({
      event_id: eventId,
      name: addonName,
      price: Number(addonPrice) || 0,
      stock_quantity: Number(addonStock) || 50,
    })
    setAddonName('')
    setAddonPrice('0')
    setAddonStock('50')
    setSaving(false)
    setNotice('Merchandise item added!')
    setTimeout(() => setNotice(null), 3000)
    onRefresh()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Advanced Event Experience Manager"
      size="lg"
    >
      <ModalBody>
        <div className="flex flex-col gap-4 text-left">
          {/* Notice Feedback */}
          {notice && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <Check size={14} className="shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#14141A] border border-white/10 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('tiers')}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 flex items-center gap-1.5 transition-all ${
                activeTab === 'tiers'
                  ? 'bg-[#18CFFC] text-black font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Ticket size={13} /> Tickets ({tiers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 flex items-center gap-1.5 transition-all ${
                activeTab === 'schedule'
                  ? 'bg-[#18CFFC] text-black font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Calendar size={13} /> Schedule ({schedules.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('speakers')}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 flex items-center gap-1.5 transition-all ${
                activeTab === 'speakers'
                  ? 'bg-[#18CFFC] text-black font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Users size={13} /> Speakers ({speakers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('gallery')}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 flex items-center gap-1.5 transition-all ${
                activeTab === 'gallery'
                  ? 'bg-[#18CFFC] text-black font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ImageIcon size={13} /> Gallery ({gallery.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('announcements')}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 flex items-center gap-1.5 transition-all ${
                activeTab === 'announcements'
                  ? 'bg-[#18CFFC] text-black font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Megaphone size={13} /> Announcements ({announcements.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('leaderboard')}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 flex items-center gap-1.5 transition-all ${
                activeTab === 'leaderboard'
                  ? 'bg-[#18CFFC] text-black font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Trophy size={13} /> Scores ({leaderboard.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('virtual')}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 flex items-center gap-1.5 transition-all ${
                activeTab === 'virtual'
                  ? 'bg-[#18CFFC] text-black font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Video size={13} /> Virtual Portal
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('addons')}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 flex items-center gap-1.5 transition-all ${
                activeTab === 'addons'
                  ? 'bg-[#18CFFC] text-black font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <ShoppingBag size={13} /> Merch ({addons.length})
            </button>
          </div>

          {/* TAB 1: TICKET TIERS */}
          {activeTab === 'tiers' && (
            <div className="flex flex-col gap-4">
              <div className="p-3.5 rounded-xl bg-[#14141A] border border-white/10 flex flex-col gap-3">
                <span className="text-xs font-bold text-white">Create Ticket Category</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <input
                    type="text"
                    value={tierName}
                    onChange={(e) => setTierName(e.target.value)}
                    placeholder="Tier Name (e.g. VIP Pass)"
                    className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-[#18CFFC]"
                  />
                  <input
                    type="number"
                    value={tierPrice}
                    onChange={(e) => setTierPrice(e.target.value)}
                    placeholder="Price (₹0 for Free)"
                    className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-[#18CFFC]"
                  />
                  <input
                    type="number"
                    value={tierCapacity}
                    onChange={(e) => setTierCapacity(e.target.value)}
                    placeholder="Capacity (e.g. 50)"
                    className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-[#18CFFC]"
                  />
                </div>
                <input
                  type="text"
                  value={tierPerksInput}
                  onChange={(e) => setTierPerksInput(e.target.value)}
                  placeholder="Perks (comma-separated, e.g. Front row seat, Swag bag, Food voucher)"
                  className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-[#18CFFC]"
                />
                <Button
                  variant="primary"
                  size="sm"
                  disabled={saving || !tierName.trim()}
                  onClick={handleAddTier}
                  leftIcon={<Plus size={14} />}
                >
                  Add Ticket Tier
                </Button>
              </div>

              {/* Tiers List */}
              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                {tiers.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl bg-[#0E0E12] border border-white/10 flex items-center justify-between text-xs"
                  >
                    <div>
                      <strong className="text-white block font-medium">{t.name}</strong>
                      <span className="text-zinc-400">
                        ₹{t.price} • {t.sold_count}/{t.capacity} sold
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteTicketTier(t.id)
                        onRefresh()
                      }}
                      className="p-1.5 text-zinc-500 hover:text-rose-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: SCHEDULE */}
          {activeTab === 'schedule' && (
            <div className="flex flex-col gap-4">
              <div className="p-3.5 rounded-xl bg-[#14141A] border border-white/10 flex flex-col gap-3">
                <span className="text-xs font-bold text-white">Add Schedule Session</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <input
                    type="text"
                    value={scheduleTitle}
                    onChange={(e) => setScheduleTitle(e.target.value)}
                    placeholder="Session Title (e.g. Opening Keynote)"
                    className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-[#18CFFC]"
                  />
                  <input
                    type="datetime-local"
                    value={scheduleStartTime}
                    onChange={(e) => setScheduleStartTime(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-[#18CFFC]"
                  />
                  <input
                    type="text"
                    value={scheduleSpeaker}
                    onChange={(e) => setScheduleSpeaker(e.target.value)}
                    placeholder="Speaker / Host Name"
                    className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-[#18CFFC]"
                  />
                  <input
                    type="text"
                    value={scheduleStage}
                    onChange={(e) => setScheduleStage(e.target.value)}
                    placeholder="Venue / Room / Stage"
                    className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-[#18CFFC]"
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={saving || !scheduleTitle.trim() || !scheduleStartTime}
                  onClick={handleAddSchedule}
                  leftIcon={<Plus size={14} />}
                >
                  Add Agenda Session
                </Button>
              </div>

              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                {schedules.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-xl bg-[#0E0E12] border border-white/10 flex items-center justify-between text-xs"
                  >
                    <div>
                      <strong className="text-white block font-medium">{s.title}</strong>
                      <span className="text-zinc-400">
                        {new Date(s.start_time).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}{' '}
                        {s.venue_stage ? `• ${s.venue_stage}` : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteEventSchedule(s.id)
                        onRefresh()
                      }}
                      className="p-1.5 text-zinc-500 hover:text-rose-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: SPEAKERS */}
          {activeTab === 'speakers' && (
            <div className="flex flex-col gap-4">
              <div className="p-3.5 rounded-xl bg-[#14141A] border border-white/10 flex flex-col gap-3">
                <span className="text-xs font-bold text-white">Add Featured Speaker or Judge</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <input
                    type="text"
                    value={speakerName}
                    onChange={(e) => setSpeakerName(e.target.value)}
                    placeholder="Full Name"
                    className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-[#18CFFC]"
                  />
                  <input
                    type="text"
                    value={speakerDesignation}
                    onChange={(e) => setSpeakerDesignation(e.target.value)}
                    placeholder="Designation / Role"
                    className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-[#18CFFC]"
                  />
                  <input
                    type="text"
                    value={speakerOrg}
                    onChange={(e) => setSpeakerOrg(e.target.value)}
                    placeholder="Company / University"
                    className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-[#18CFFC]"
                  />
                </div>
                <textarea
                  value={speakerBio}
                  onChange={(e) => setSpeakerBio(e.target.value)}
                  placeholder="Short bio or background summary…"
                  rows={2}
                  className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-[#18CFFC]"
                />
                <Button
                  variant="primary"
                  size="sm"
                  disabled={saving || !speakerName.trim()}
                  onClick={handleAddSpeaker}
                  leftIcon={<Plus size={14} />}
                >
                  Save Speaker Profile
                </Button>
              </div>

              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                {speakers.map((spk) => (
                  <div
                    key={spk.id}
                    className="p-3 rounded-xl bg-[#0E0E12] border border-white/10 flex items-center justify-between text-xs"
                  >
                    <div>
                      <strong className="text-white block font-medium">{spk.name}</strong>
                      <span className="text-zinc-400">
                        {spk.designation || 'Speaker'} {spk.organization ? `• ${spk.organization}` : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteEventSpeaker(spk.id)
                        onRefresh()
                      }}
                      className="p-1.5 text-zinc-500 hover:text-rose-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: GALLERY */}
          {activeTab === 'gallery' && (
            <div className="flex flex-col gap-4">
              <div className="p-3.5 rounded-xl bg-[#14141A] border border-white/10 flex flex-col gap-3">
                <span className="text-xs font-bold text-white">Add Image URL to Gallery</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <input
                    type="url"
                    value={galleryUrl}
                    onChange={(e) => setGalleryUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/…"
                    className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-[#18CFFC]"
                  />
                  <input
                    type="text"
                    value={galleryCaption}
                    onChange={(e) => setGalleryCaption(e.target.value)}
                    placeholder="Photo caption (e.g. Hackathon Kickoff)"
                    className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-[#18CFFC]"
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={saving || !galleryUrl.trim()}
                  onClick={handleAddGalleryImage}
                  leftIcon={<Plus size={14} />}
                >
                  Add Photo
                </Button>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto">
                {gallery.map((img) => (
                  <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden group">
                    <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteEventGalleryImage(img.id)
                        onRefresh()
                      }}
                      className="absolute top-1 right-1 p-1 bg-black/70 rounded text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: ANNOUNCEMENTS */}
          {activeTab === 'announcements' && (
            <div className="flex flex-col gap-4">
              <div className="p-3.5 rounded-xl bg-[#14141A] border border-white/10 flex flex-col gap-3">
                <span className="text-xs font-bold text-white">Publish Live Announcement</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <input
                    type="text"
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                    placeholder="Notice Title (e.g. Venue Change)"
                    className="sm:col-span-2 px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-[#18CFFC]"
                  />
                  <select
                    value={annPriority}
                    onChange={(e) => setAnnPriority(e.target.value as any)}
                    className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-[#18CFFC]"
                  >
                    <option value="normal">General</option>
                    <option value="urgent">Urgent</option>
                    <option value="venue_change">Venue Change</option>
                    <option value="schedule_change">Time Rescheduled</option>
                  </select>
                </div>
                <textarea
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  placeholder="Detailed announcement text for attendees…"
                  rows={2}
                  className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-[#18CFFC]"
                />
                <label className="flex items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={annPinned}
                    onChange={(e) => setAnnPinned(e.target.checked)}
                    className="rounded border-white/20"
                  />
                  <span>Pin this announcement prominently to top of page</span>
                </label>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={saving || !annTitle.trim() || !annContent.trim()}
                  onClick={handleAddAnnouncement}
                  leftIcon={<Megaphone size={14} />}
                >
                  Publish to Registered Attendees
                </Button>
              </div>

              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                {announcements.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 rounded-xl bg-[#0E0E12] border border-white/10 flex items-center justify-between text-xs"
                  >
                    <div>
                      <strong className="text-white block font-medium">{a.title}</strong>
                      <span className="text-zinc-400 line-clamp-1">{a.content}</span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteEventAnnouncement(a.id)
                        onRefresh()
                      }}
                      className="p-1.5 text-zinc-500 hover:text-rose-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: LEADERBOARD */}
          {activeTab === 'leaderboard' && (
            <div className="flex flex-col gap-4">
              <div className="p-3.5 rounded-xl bg-[#14141A] border border-white/10 flex flex-col gap-3">
                <span className="text-xs font-bold text-white">Add Participant Standing</span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                  <input
                    type="text"
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    placeholder="Participant / Lead"
                    className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-[#18CFFC]"
                  />
                  <input
                    type="text"
                    value={leadTeam}
                    onChange={(e) => setLeadTeam(e.target.value)}
                    placeholder="Team Name"
                    className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-[#18CFFC]"
                  />
                  <input
                    type="number"
                    value={leadScore}
                    onChange={(e) => setLeadScore(e.target.value)}
                    placeholder="Score (pts)"
                    className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-[#18CFFC]"
                  />
                  <input
                    type="number"
                    value={leadRank}
                    onChange={(e) => setLeadRank(e.target.value)}
                    placeholder="Rank"
                    className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-[#18CFFC]"
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={saving || !leadName.trim()}
                  onClick={handleAddLeaderboard}
                  leftIcon={<Plus size={14} />}
                >
                  Save Leaderboard Entry
                </Button>
              </div>

              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                {leaderboard.map((lb) => (
                  <div
                    key={lb.id}
                    className="p-3 rounded-xl bg-[#0E0E12] border border-white/10 flex items-center justify-between text-xs"
                  >
                    <div>
                      <strong className="text-white block font-medium">
                        #{lb.rank} {lb.team_name || lb.participant_name}
                      </strong>
                      <span className="text-zinc-400">{lb.score} pts</span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteLeaderboardEntry(lb.id)
                        onRefresh()
                      }}
                      className="p-1.5 text-zinc-500 hover:text-rose-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: VIRTUAL MEETING */}
          {activeTab === 'virtual' && (
            <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-[#14141A] border border-white/10 text-xs">
              <span className="font-bold text-white">Online Session Credentials</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Platform</label>
                  <select
                    value={meetingPlatform}
                    onChange={(e) => setMeetingPlatform(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white"
                  >
                    <option value="google_meet">Google Meet</option>
                    <option value="zoom">Zoom</option>
                    <option value="teams">Microsoft Teams</option>
                    <option value="discord">Discord</option>
                    <option value="youtube">YouTube Live Stream</option>
                    <option value="other">Other Virtual Portal</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">
                    Access Unlock Window (minutes before start)
                  </label>
                  <input
                    type="number"
                    value={accessMinutes}
                    onChange={(e) => setAccessMinutes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">
                  Private Meeting URL (Encrypted & restricted to confirmed attendees)
                </label>
                <input
                  type="url"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  placeholder="https://meet.google.com/xyz-abc"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">
                  Joining Instructions / Meeting Passcode
                </label>
                <textarea
                  value={joiningInstructions}
                  onChange={(e) => setJoiningInstructions(e.target.value)}
                  placeholder="e.g. Passcode: 123456. Please join with your student college email."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white"
                />
              </div>
              <Button
                variant="primary"
                size="sm"
                disabled={saving}
                onClick={handleSaveVirtualSettings}
              >
                Save Virtual Settings
              </Button>
            </div>
          )}

          {/* TAB 8: ADDONS */}
          {activeTab === 'addons' && (
            <div className="flex flex-col gap-4">
              <div className="p-3.5 rounded-xl bg-[#14141A] border border-white/10 flex flex-col gap-3">
                <span className="text-xs font-bold text-white">Add Merchandise or Kit</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <input
                    type="text"
                    value={addonName}
                    onChange={(e) => setAddonName(e.target.value)}
                    placeholder="Item Name (e.g. Official Fest T-shirt)"
                    className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-[#18CFFC]"
                  />
                  <input
                    type="number"
                    value={addonPrice}
                    onChange={(e) => setAddonPrice(e.target.value)}
                    placeholder="Price (₹)"
                    className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-[#18CFFC]"
                  />
                  <input
                    type="number"
                    value={addonStock}
                    onChange={(e) => setAddonStock(e.target.value)}
                    placeholder="Available Stock"
                    className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-[#18CFFC]"
                  />
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={saving || !addonName.trim()}
                  onClick={handleAddAddon}
                  leftIcon={<Plus size={14} />}
                >
                  Add Item to Catalogue
                </Button>
              </div>

              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                {addons.map((ad) => (
                  <div
                    key={ad.id}
                    className="p-3 rounded-xl bg-[#0E0E12] border border-white/10 flex items-center justify-between text-xs"
                  >
                    <div>
                      <strong className="text-white block font-medium">{ad.name}</strong>
                      <span className="text-zinc-400">
                        ₹{ad.price} • {ad.stock_quantity - ad.sold_quantity} remaining
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteEventAddon(ad.id)
                        onRefresh()
                      }}
                      className="p-1.5 text-zinc-500 hover:text-rose-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Done
        </Button>
      </ModalFooter>
    </Modal>
  )
}
