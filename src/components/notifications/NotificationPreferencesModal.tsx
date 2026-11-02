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
  Award,
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
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-xl rounded-2xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.12)] shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-[var(--color-surface-3)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#18CFFC]/20 to-[#7F1AFB]/20 border border-[#18CFFC]/30 flex items-center justify-center text-[#18CFFC]">
                <Bell size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--color-text-primary)] font-display">
                  Notification Preferences
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Control which channels and event updates you receive
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 overflow-y-auto space-y-6">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-xs text-[var(--color-text-muted)]">
                <Loader2 className="w-6 h-6 animate-spin text-[#18CFFC]" />
                <span>Loading preferences...</span>
              </div>
            ) : prefs ? (
              <>
                {/* Delivery Channels */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
                    Delivery Channels
                  </h4>
                  <div className="space-y-3">
                    {/* Email Channel */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.06)]">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--color-surface-3)] text-[#18CFFC]">
                          <Mail size={16} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                            Email Notifications
                          </div>
                          <div className="text-xs text-[var(--color-text-secondary)]">
                            Receive digital tickets, registrations, and official receipts
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggle('email_enabled')}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                          prefs.email_enabled ? 'bg-[#18CFFC]' : 'bg-[var(--color-surface-3)]'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            prefs.email_enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Push Channel */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.06)]">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--color-surface-3)] text-[#7F1AFB]">
                          <Smartphone size={16} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                            Browser Push Notifications
                          </div>
                          <div className="text-xs text-[var(--color-text-secondary)]">
                            {pushStatus.supported
                              ? 'Receive instant gate alerts & turnstile updates on this device'
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
                            ? 'opacity-40 cursor-not-allowed bg-[var(--color-surface-3)]'
                            : prefs.push_enabled
                            ? 'bg-[#7F1AFB]'
                            : 'bg-[var(--color-surface-3)]'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            prefs.push_enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Categories */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">
                    Notification Categories
                  </h4>
                  <div className="space-y-3">
                    {/* Event Reminders */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.06)]">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--color-surface-3)] text-[#07A4FC]">
                          <Calendar size={16} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                            Event Reminders (7d, 1d, 2h)
                          </div>
                          <div className="text-xs text-[var(--color-text-secondary)]">
                            Automated schedule updates, venue directions, and turnstile alerts
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggle('event_reminders')}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                          prefs.event_reminders ? 'bg-[#07A4FC]' : 'bg-[var(--color-surface-3)]'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            prefs.event_reminders ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Payment Status */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.06)]">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--color-surface-3)] text-emerald-400">
                          <CreditCard size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                              Payment & Pass Issuance
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400">
                              Mandatory Transactional
                            </span>
                          </div>
                          <div className="text-xs text-[var(--color-text-secondary)]">
                            Verification alerts, pass activation, and organizer receipts
                          </div>
                        </div>
                      </div>
                      <div className="p-1 text-emerald-400">
                        <ShieldCheck size={18} />
                      </div>
                    </div>

                    {/* Team Notifications */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.06)]">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--color-surface-3)] text-[#ED47FC]">
                          <Users2 size={16} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                            Team Invitations & Member Alerts
                          </div>
                          <div className="text-xs text-[var(--color-text-secondary)]">
                            Invitations to join hackathon teams, roster updates, and requests
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggle('team_notifications')}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                          prefs.team_notifications ? 'bg-[#ED47FC]' : 'bg-[var(--color-surface-3)]'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            prefs.team_notifications ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Certificates */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.06)]">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--color-surface-3)] text-amber-400">
                          <Award size={16} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                            Certificates & Achievements
                          </div>
                          <div className="text-xs text-[var(--color-text-secondary)]">
                            Notices when verified certificates are ready to download or verify
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggle('certificate_notifications')}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                          prefs.certificate_notifications ? 'bg-amber-400' : 'bg-[var(--color-surface-3)]'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            prefs.certificate_notifications ? 'translate-x-5' : 'translate-x-0'
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
          <div className="px-6 py-4 border-t border-[var(--color-surface-3)] flex items-center justify-between bg-[var(--color-surface-2)]/50">
            <span className="text-xs text-[var(--color-text-muted)]">
              FestFlow never shares your contact details.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
