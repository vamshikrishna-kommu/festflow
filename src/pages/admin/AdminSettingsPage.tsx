// Phase 7: Super Admin Platform Configuration & Settings Page
import React, { useState, useEffect } from 'react'
import { Save, ShieldCheck, RefreshCw } from 'lucide-react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { getPlatformSettings, updatePlatformSetting } from '@/lib/admin'
import type { PlatformSettingsMap } from '@/types'
import { Button } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useMaintenance } from '@/context/MaintenanceContext'

export default function AdminSettingsPage() {
  const { profile } = useAuth()
  const adminId = profile?.id || ''
  const adminEmail = profile?.email || 'platform_admin'
  const { setMaintenanceMode } = useMaintenance()

  const [settings, setSettings] = useState<PlatformSettingsMap | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null)

  const loadData = async () => {
    setErrorFeedback(null)
    try {
      const data = await getPlatformSettings()
      setSettings(data)
    } catch (err: any) {
      setErrorFeedback(err?.message || 'Unable to load platform settings.')
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleToggle = async (key: keyof PlatformSettingsMap) => {
    if (!settings) return
    const newVal = !settings[key]
    setSettings({ ...settings, [key]: newVal })
    if (key === 'maintenance_mode') {
      setMaintenanceMode(newVal)
    }
    setErrorFeedback(null)

    try {
      const res = await updatePlatformSetting(key as string, newVal, adminId, adminEmail)
      if (!res.success) {
        setSettings({ ...settings, [key]: !newVal })
        if (key === 'maintenance_mode') {
          setMaintenanceMode(!newVal)
        }
        setErrorFeedback(res.error || `Failed to update ${key}.`)
        setTimeout(() => setErrorFeedback(null), 5000)
      } else {
        setFeedback(`Updated "${key}" successfully.`)
        setTimeout(() => setFeedback(null), 3000)
      }
    } catch (err: any) {
      setSettings({ ...settings, [key]: !newVal })
      if (key === 'maintenance_mode') {
        setMaintenanceMode(!newVal)
      }
      setErrorFeedback(err?.message || `Failed to update ${key}.`)
      setTimeout(() => setErrorFeedback(null), 5000)
    }
  }

  const handleTextChange = (key: keyof PlatformSettingsMap, val: any) => {
    if (!settings) return
    setSettings({ ...settings, [key]: val })
  }

  const handleSaveTextSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!settings) return
    try {
      setIsSaving(true)
      setErrorFeedback(null)
      const res1 = await updatePlatformSetting('support_email', settings.support_email, adminId, adminEmail)
      const res2 = await updatePlatformSetting('support_phone', settings.support_phone, adminId, adminEmail)
      const res3 = await updatePlatformSetting('max_upload_size_mb', Number(settings.max_upload_size_mb), adminId, adminEmail)

      if (!res1.success || !res2.success || !res3.success) {
        setErrorFeedback(res1.error || res2.error || res3.error || 'Failed to persist settings.')
        setTimeout(() => setErrorFeedback(null), 5000)
      } else {
        setFeedback('Contact and upload parameters saved to platform configuration.')
        setTimeout(() => setFeedback(null), 3000)
      }
    } catch (err: any) {
      setErrorFeedback(err?.message || 'Failed to persist settings.')
      setTimeout(() => setErrorFeedback(null), 5000)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AdminLayout
      title="Platform Settings & Feature Flags"
      subtitle="Configure operational thresholds, emergency maintenance switches, and security requirements."
      actions={
        <Button variant="outline" size="sm" onClick={loadData} leftIcon={<RefreshCw size={14} />}>
          Reload Configuration
        </Button>
      }
    >
      {feedback && (
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium flex items-center gap-2">
          <ShieldCheck size={14} className="text-blue-600" />
          <span>{feedback}</span>
        </div>
      )}

      {errorFeedback && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
          <ShieldCheck size={14} className="text-rose-600" />
          <span>{errorFeedback}</span>
        </div>
      )}

      {settings && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Operational Toggles */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6 shadow-xs">
            <h2 className="text-base font-bold text-gray-900 font-display">System Feature Flags</h2>

            {/* Maintenance Mode */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div>
                <div className="text-xs font-semibold text-gray-900">Platform Maintenance Mode</div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  Restricts non-administrative users to a maintenance screen.
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('maintenance_mode')}
                className={`
                  w-12 h-6 rounded-full transition-colors relative
                  ${settings.maintenance_mode ? 'bg-rose-600' : 'bg-gray-200'}
                `}
              >
                <span
                  className={`
                    w-4 h-4 rounded-full bg-white shadow-xs absolute top-1 transition-transform
                    ${settings.maintenance_mode ? 'left-7' : 'left-1'}
                  `}
                />
              </button>
            </div>

            {/* Student Registration Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div>
                <div className="text-xs font-semibold text-gray-900">Student Event Registrations</div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  Allow students to register for live events across the platform.
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('student_registration_enabled')}
                className={`
                  w-12 h-6 rounded-full transition-colors relative
                  ${settings.student_registration_enabled ? 'bg-emerald-600' : 'bg-gray-200'}
                `}
              >
                <span
                  className={`
                    w-4 h-4 rounded-full bg-white shadow-xs absolute top-1 transition-transform
                    ${settings.student_registration_enabled ? 'left-7' : 'left-1'}
                  `}
                />
              </button>
            </div>

            {/* Club Event Creation Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div>
                <div className="text-xs font-semibold text-gray-900">Club Event Publishing</div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  Permit verified and active clubs to submit new fests and workshops.
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('club_event_creation_enabled')}
                className={`
                  w-12 h-6 rounded-full transition-colors relative
                  ${settings.club_event_creation_enabled ? 'bg-emerald-600' : 'bg-gray-200'}
                `}
              >
                <span
                  className={`
                    w-4 h-4 rounded-full bg-white shadow-xs absolute top-1 transition-transform
                    ${settings.club_event_creation_enabled ? 'left-7' : 'left-1'}
                  `}
                />
              </button>
            </div>

            {/* Event Moderation Requirement */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div>
                <div className="text-xs font-semibold text-gray-900">Require Admin Event Moderation</div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  Require Super Admin review before newly drafted events go live.
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('require_event_approval')}
                className={`
                  w-12 h-6 rounded-full transition-colors relative
                  ${settings.require_event_approval ? 'bg-blue-600' : 'bg-gray-200'}
                `}
              >
                <span
                  className={`
                    w-4 h-4 rounded-full bg-white shadow-xs absolute top-1 transition-transform
                    ${settings.require_event_approval ? 'left-7' : 'left-1'}
                  `}
                />
              </button>
            </div>
          </div>

          {/* Right Column: Platform Parameters & Contact Information */}
          <form onSubmit={handleSaveTextSettings} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 text-xs shadow-xs">
            <h2 className="text-base font-bold text-gray-900 font-display">Platform Parameters</h2>

            <div>
              <label className="text-gray-700 font-medium block mb-1">Official Support Email Address</label>
              <input
                type="email"
                value={settings.support_email}
                onChange={(e) => handleTextChange('support_email', e.target.value)}
                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
              />
            </div>

            <div>
              <label className="text-gray-700 font-medium block mb-1">Emergency Support Phone Number</label>
              <input
                type="tel"
                value={settings.support_phone}
                onChange={(e) => handleTextChange('support_phone', e.target.value)}
                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
              />
            </div>

            <div>
              <label className="text-gray-700 font-medium block mb-1">Maximum Media Upload Size (MB)</label>
              <input
                type="number"
                min="1"
                max="50"
                value={settings.max_upload_size_mb}
                onChange={(e) => handleTextChange('max_upload_size_mb', e.target.value)}
                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
              />
            </div>

            <div className="pt-3 border-t border-gray-200 flex justify-end">
              <Button variant="primary" size="sm" type="submit" disabled={isSaving} leftIcon={<Save size={14} />}>
                {isSaving ? 'Saving…' : 'Save Parameters'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </AdminLayout>
  )
}
