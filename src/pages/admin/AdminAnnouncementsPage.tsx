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
  const adminId = profile?.id || ''
  const adminEmail = profile?.email || 'platform_admin'

  const [announcements, setAnnouncements] = useState<PlatformAnnouncementRecord[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [current, setCurrent] = useState<Partial<PlatformAnnouncementRecord>>({
    target_audience: 'all',
    is_pinned: false,
    status: 'published',
  })

  const loadData = async () => {
    setErrorMessage(null)
    try {
      const list = await getPlatformAnnouncements()
      setAnnouncements(list)
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to load platform announcements.')
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!current.title?.trim() || !current.content?.trim()) return
    setErrorMessage(null)

    try {
      const res = await savePlatformAnnouncement(current, adminId, adminEmail)
      if (res.error) {
        setErrorMessage(`Failed to publish announcement: ${res.error}`)
        return
      }

      setModalOpen(false)
      setCurrent({ target_audience: 'all', is_pinned: false, status: 'published' })
      await loadData()
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to publish announcement.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this platform announcement?')) return
    setErrorMessage(null)
    try {
      const res = await deletePlatformAnnouncement(id, adminId, adminEmail)
      if (!res.success) {
        setErrorMessage(`Failed to delete announcement: ${res.error}`)
        return
      }
      await loadData()
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to delete announcement.')
    }
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
      {errorMessage && (
        <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center justify-between gap-3">
          <span>{errorMessage}</span>
          <Button variant="outline" size="sm" onClick={loadData}>
            Retry
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {announcements.map((ann) => (
          <div
            key={ann.id}
            className={`
              p-5 rounded-2xl bg-white border transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4 shadow-xs
              ${ann.is_pinned ? 'border-blue-200 bg-blue-50/40' : 'border-gray-200 hover:border-gray-300'}
            `}
          >
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {ann.is_pinned && (
                  <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    <Pin size={10} /> PINNED NOTICE
                  </span>
                )}
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 uppercase">
                  Audience: {ann.target_audience}
                </span>
                <span className="text-xs text-gray-500 font-mono">
                  {new Date(ann.created_at).toLocaleDateString()}
                </span>
              </div>

              <h3 className="text-base font-bold text-gray-900 font-display">{ann.title}</h3>
              <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{ann.content}</p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="text-rose-600 hover:bg-rose-50 shrink-0 self-start"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white border border-gray-200 rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 font-display mb-4">Broadcast Platform Announcement</h3>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-gray-700 font-medium block mb-1">Announcement Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schedule Update: National Technical Fest Registration Extended"
                  value={current.title || ''}
                  onChange={(e) => setCurrent({ ...current, title: e.target.value })}
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                />
              </div>

              <div>
                <label className="text-gray-700 font-medium block mb-1">Detailed Content *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Enter the broadcast notification message..."
                  value={current.content || ''}
                  onChange={(e) => setCurrent({ ...current, content: e.target.value })}
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-700 font-medium block mb-1">Target Audience</label>
                  <select
                    value={current.target_audience}
                    onChange={(e) => setCurrent({ ...current, target_audience: e.target.value as any })}
                    className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                  >
                    <option value="all">Everyone (Platform-wide)</option>
                    <option value="students">Students Only</option>
                    <option value="clubs">Club Organizers Only</option>
                    <option value="colleges">Institutions Only</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-gray-700">
                    <input
                      type="checkbox"
                      checked={Boolean(current.is_pinned)}
                      onChange={(e) => setCurrent({ ...current, is_pinned: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Pin to top banner</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
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
