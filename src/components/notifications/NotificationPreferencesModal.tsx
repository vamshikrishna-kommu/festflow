import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  X,
  Bell,
  Mail,
  Smartphone,
  Calendar,
  CreditCard,
  Users2,
  ShieldCheck,
  Check,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  getUserNotificationPreferences,
  saveUserNotificationPreferences,
  checkPushSupport,
  registerPushSubscription,
  removePushSubscription,
} from '@/lib/notifications'
import type { UserNotificationPreferences } from '@/types'

interface NotificationPreferencesModalProps {
  isOpen: boolean
  onClose: () => void
}

export function NotificationPreferencesModal({
  isOpen,
  onClose,
}: NotificationPreferencesModalProps) {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState<UserNotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedFeedback, setSavedFeedback] = useState(false)
  const [pushStatus, setPushStatus] = useState(checkPushSupport())

  useEffect(() => {
    if (isOpen && user) {
      setLoading(true)
      getUserNotificationPreferences(user.id)
        .then((res) => {
          setPrefs(res)
          setPushStatus(checkPushSupport())
        })
        .finally(() => setLoading(false))
    }
  }, [isOpen, user])

  const handleToggle = (key: keyof Omit<UserNotificationPreferences, 'user_id' | 'updated_at'>) => {
    if (!prefs) return
    setPrefs({
      ...prefs,
      [key]: !prefs[key],
    })
  }

  const handlePushToggle = async () => {
    if (!prefs || !user) return
    if (!prefs.push_enabled) {
      // Enabling push
      const res = await registerPushSubscription(user.id)
      if (res.success) {
        setPrefs({ ...prefs, push_enabled: true })
      } else {
        alert(res.message)
      }
    } else {
      // Disabling push
      await removePushSubscription(user.id)
      setPrefs({ ...prefs, push_enabled: false })
    }
    setPushStatus(checkPushSupport())
  }

  const handleSave = async () => {
    if (!prefs) return
    setSaving(true)
    const res = await saveUserNotificationPreferences(prefs)
    setSaving(false)
    if (res.success) {
      setSavedFeedback(true)
      setTimeout(() => {
        setSavedFeedback(false)
        onClose()
      }, 900)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-xl rounded-2xl bg-white border border-gray-200 shadow-xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                <Bell size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 font-display">
                  Notification Preferences
                </h3>
                <p className="text-xs text-gray-500">
                  Control which channels and event updates you receive
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 overflow-y-auto space-y-6">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-xs text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span>Loading preferences...</span>
              </div>
            ) : prefs ? (
              <>
                {/* Delivery Channels */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                    Delivery Channels
                  </h4>
                  <div className="space-y-3">
                    {/* Email Channel */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white border border-gray-200 text-blue-600">
                          <Mail size={16} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            Email Notifications
                          </div>
                          <div className="text-xs text-gray-600">
                            Receive digital tickets, registrations, and official receipts
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggle('email_enabled')}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                          prefs.email_enabled ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform ${
                            prefs.email_enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Push Channel */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white border border-gray-200 text-indigo-600">
                          <Smartphone size={16} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            Browser Push Notifications
                          </div>
                          <div className="text-xs text-gray-600">
                            {pushStatus.supported
                              ? 'Receive instant event alerts & schedule updates on this device'
                              : 'Not supported on this browser or platform'}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!pushStatus.supported}
                        onClick={handlePushToggle}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                          !pushStatus.supported
                            ? 'opacity-40 cursor-not-allowed bg-gray-200'
                            : prefs.push_enabled
                            ? 'bg-indigo-600'
                            : 'bg-gray-200'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform ${
                            prefs.push_enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                    Notification Categories
                  </h4>
                  <div className="space-y-3">
                    {/* Event Reminders */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white border border-gray-200 text-blue-600">
                          <Calendar size={16} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            Event Reminders (7d, 1d, 2h)
                          </div>
                          <div className="text-xs text-gray-600">
                            Automated schedule updates, venue directions, and pass reminders
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggle('event_reminders')}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                          prefs.event_reminders ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform ${
                            prefs.event_reminders ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Payment Status */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white border border-gray-200 text-emerald-600">
                          <CreditCard size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">
                              Payment & Pass Issuance
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Mandatory Transactional
                            </span>
                          </div>
                          <div className="text-xs text-gray-600">
                            Verification alerts, pass activation, and organizer receipts
                          </div>
                        </div>
                      </div>
                      <div className="p-1 text-emerald-600">
                        <ShieldCheck size={18} />
                      </div>
                    </div>

                    {/* Team Notifications */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white border border-gray-200 text-purple-600">
                          <Users2 size={16} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            Team Invitations & Member Alerts
                          </div>
                          <div className="text-xs text-gray-600">
                            Invitations to join hackathon teams, roster updates, and requests
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggle('team_notifications')}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                          prefs.team_notifications ? 'bg-purple-600' : 'bg-gray-200'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform ${
                            prefs.team_notifications ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
            <span className="text-xs text-gray-500">
              FestFlow never shares your contact details.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Saving...
                  </>
                ) : savedFeedback ? (
                  <>
                    <Check size={14} /> Saved!
                  </>
                ) : (
                  'Save Preferences'
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
