// Phase 7: Super Admin Platform Announcements Page
import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Pin } from 'lucide-react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import {
  getPlatformAnnouncements,
  savePlatformAnnouncement,
  deletePlatformAnnouncement,
} from '@/lib/admin'
import type { PlatformAnnouncementRecord } from '@/types'
import { Button } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'

export default function AdminAnnouncementsPage() {
  const { profile } = useAuth()
  const adminId = profile?.id || 'admin_root'
  const adminEmail = profile?.email || 'admin@festflow.online'

  const [announcements, setAnnouncements] = useState<PlatformAnnouncementRecord[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [current, setCurrent] = useState<Partial<PlatformAnnouncementRecord>>({
    target_audience: 'all',
    is_pinned: false,
    status: 'published',
  })

  const loadData = async () => {
    const list = await getPlatformAnnouncements()
    setAnnouncements(list)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!current.title?.trim() || !current.content?.trim()) return

    await savePlatformAnnouncement(current, adminId, adminEmail)
    setModalOpen(false)
    setCurrent({ target_audience: 'all', is_pinned: false, status: 'published' })
    loadData()
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this platform announcement?')) return
    await deletePlatformAnnouncement(id, adminId, adminEmail)
    loadData()
  }

  return (
    <AdminLayout
      title="Platform-Wide Announcements"
      subtitle="Publish verified notices, system broadcast alerts, and fest schedule bulletins across all student and club feeds."
      actions={
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setCurrent({ target_audience: 'all', is_pinned: false, status: 'published' })
            setModalOpen(true)
          }}
          leftIcon={<Plus size={15} />}
        >
          Create Announcement
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4">
        {announcements.map((ann) => (
          <div
            key={ann.id}
            className={`
              p-5 rounded-2xl bg-[#0D0E15] border transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4
              ${ann.is_pinned ? 'border-[#18CFFC]/40 bg-[#18CFFC]/[0.02]' : 'border-white/5 hover:border-white/10'}
            `}
          >
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {ann.is_pinned && (
                  <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#18CFFC]/15 text-[#18CFFC] border border-[#18CFFC]/30">
                    <Pin size={10} /> PINNED NOTICE
                  </span>
                )}
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/70 uppercase">
                  Audience: {ann.target_audience}
                </span>
                <span className="text-xs text-white/40 font-mono">
                  {new Date(ann.created_at).toLocaleDateString()}
                </span>
              </div>

              <h3 className="text-base font-bold text-white font-display">{ann.title}</h3>
              <p className="text-xs text-white/70 leading-relaxed whitespace-pre-wrap">{ann.content}</p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="text-rose-400 hover:bg-rose-500/10 shrink-0 self-start"
              onClick={() => handleDelete(ann.id)}
              leftIcon={<Trash2 size={13} />}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>

      {/* New Announcement Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0D0E15] border border-white/10 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white font-display mb-4">Broadcast Platform Announcement</h3>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-white/70 block mb-1">Announcement Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schedule Update: National Technical Fest Registration Extended"
                  value={current.title || ''}
                  onChange={(e) => setCurrent({ ...current, title: e.target.value })}
                  className="w-full p-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#18CFFC]/50"
                />
              </div>

              <div>
                <label className="text-white/70 block mb-1">Detailed Content *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Enter the broadcast notification message..."
                  value={current.content || ''}
                  onChange={(e) => setCurrent({ ...current, content: e.target.value })}
                  className="w-full p-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#18CFFC]/50 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/70 block mb-1">Target Audience</label>
                  <select
                    value={current.target_audience}
                    onChange={(e) => setCurrent({ ...current, target_audience: e.target.value as any })}
                    className="w-full p-2.5 bg-[#08080A] border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#18CFFC]/50"
                  >
                    <option value="all">Everyone (Platform-wide)</option>
                    <option value="students">Students Only</option>
                    <option value="clubs">Club Organizers Only</option>
                    <option value="colleges">Institutions Only</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-white/80">
                    <input
                      type="checkbox"
                      checked={Boolean(current.is_pinned)}
                      onChange={(e) => setCurrent({ ...current, is_pinned: e.target.checked })}
                      className="rounded border-white/20 bg-white/5 text-[#18CFFC] focus:ring-[#18CFFC]"
                    />
                    <span>Pin to top banner</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
                <Button variant="ghost" size="sm" type="button" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  Publish Notice
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
