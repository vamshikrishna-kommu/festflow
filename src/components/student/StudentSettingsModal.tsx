import { useState, useEffect } from 'react'
import {
  User,
  Bell,
  Volume2,
  VolumeX,
  Moon,
  Shield,
  LogOut,
  Save,
  CheckCircle2,
  X,
} from 'lucide-react'
import { Button, Modal, ModalBody, ModalFooter } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'

interface StudentSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  initialSection?: 'profile' | 'notifications' | 'sound' | 'appearance' | 'security'
}

export function StudentSettingsModal({
  isOpen,
  onClose,
  initialSection = 'profile',
}: StudentSettingsModalProps) {
  const { user, profile, studentProfile, signOut, updateProfile } = useAuth()

  const [activeSection, setActiveSection] = useState<'profile' | 'notifications' | 'sound' | 'appearance' | 'security'>(initialSection)
  
  // Profile form state
  const [displayName, setDisplayName] = useState(profile?.display_name || user?.user_metadata?.display_name || '')
  const [collegeName, setCollegeName] = useState(studentProfile?.college_name || user?.user_metadata?.college || '')
  const [gradYear, setGradYear] = useState(studentProfile?.graduation_year ? String(studentProfile.graduation_year) : '')
  const [phone, setPhone] = useState(user?.user_metadata?.phone || '')

  // Notification Preferences (Account-level: loaded from user_metadata first, fallback to localStorage)
  const [emailAlerts, setEmailAlerts] = useState<boolean>(() => {
    if (user?.user_metadata?.preferences?.emailAlerts !== undefined) {
      return Boolean(user.user_metadata.preferences.emailAlerts)
    }
    return localStorage.getItem('festflow_pref_email') !== 'false'
  })
  const [reminderAlerts, setReminderAlerts] = useState<boolean>(() => {
    if (user?.user_metadata?.preferences?.reminderAlerts !== undefined) {
      return Boolean(user.user_metadata.preferences.reminderAlerts)
    }
    return localStorage.getItem('festflow_pref_reminders') !== 'false'
  })
  const [ticketUpdates, setTicketUpdates] = useState<boolean>(() => {
    if (user?.user_metadata?.preferences?.ticketUpdates !== undefined) {
      return Boolean(user.user_metadata.preferences.ticketUpdates)
    }
    return localStorage.getItem('festflow_pref_ticket_updates') !== 'false'
  })

  // Sound & Haptic Preferences (Device-specific)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('festflow_pref_sound') !== 'false'
  })
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(() => {
    return localStorage.getItem('festflow_pref_haptics') !== 'false'
  })

  // Appearance Preferences (Device-specific)
  const [scannerHighContrast, setScannerHighContrast] = useState<boolean>(() => {
    return localStorage.getItem('festflow_pref_high_contrast') === 'true'
  })

  // Save states
  const [isSaving, setIsSaving] = useState(false)
  const [savedNotice, setSavedNotice] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setDisplayName(profile?.display_name || user?.user_metadata?.display_name || '')
      setCollegeName(studentProfile?.college_name || user?.user_metadata?.college || '')
      setGradYear(studentProfile?.graduation_year ? String(studentProfile.graduation_year) : '')
      setPhone(user?.user_metadata?.phone || '')
      if (user?.user_metadata?.preferences) {
        if (user.user_metadata.preferences.emailAlerts !== undefined) setEmailAlerts(Boolean(user.user_metadata.preferences.emailAlerts))
        if (user.user_metadata.preferences.reminderAlerts !== undefined) setReminderAlerts(Boolean(user.user_metadata.preferences.reminderAlerts))
        if (user.user_metadata.preferences.ticketUpdates !== undefined) setTicketUpdates(Boolean(user.user_metadata.preferences.ticketUpdates))
      }
      setSavedNotice(null)
      setErrorMessage(null)
    }
  }, [isOpen, profile, studentProfile, user])

  const handleSavePreferences = async () => {
    setIsSaving(true)
    setErrorMessage(null)
    setSavedNotice(null)

    try {
      if (!displayName.trim()) {
        throw new Error('Full Name / Display Name cannot be empty.')
      }

      if (gradYear.trim()) {
        const yr = parseInt(gradYear.trim(), 10)
        if (isNaN(yr) || yr < 1980 || yr > 2035) {
          throw new Error('Please enter a valid graduation year (between 1980 and 2035).')
        }
      }

      if (phone.trim() && !/^[0-9+\-\s()]{8,15}$/.test(phone.trim())) {
        throw new Error('Please enter a valid mobile phone number (8-15 digits).')
      }

      const res = await updateProfile({
        displayName: displayName.trim(),
        collegeName: collegeName.trim() || undefined,
        gradYear: gradYear.trim() ? parseInt(gradYear.trim(), 10) : null,
        phone: phone.trim() || undefined,
        preferences: {
          emailAlerts,
          reminderAlerts,
          ticketUpdates,
        },
      })

      if (res.error) {
        setIsSaving(false)
        setErrorMessage(res.error)
        return
      }

      // Save notification and sound settings to localStorage for device caching
      localStorage.setItem('festflow_pref_email', String(emailAlerts))
      localStorage.setItem('festflow_pref_reminders', String(reminderAlerts))
      localStorage.setItem('festflow_pref_ticket_updates', String(ticketUpdates))
      localStorage.setItem('festflow_pref_sound', String(soundEnabled))
      localStorage.setItem('festflow_pref_haptics', String(hapticsEnabled))
      localStorage.setItem('festflow_pref_high_contrast', String(scannerHighContrast))

      setIsSaving(false)
      setSavedNotice('Settings saved successfully!')
      setTimeout(() => setSavedNotice(null), 3500)
    } catch (err: any) {
      setIsSaving(false)
      setErrorMessage(err?.message || 'Failed to update preferences.')
    }
  }

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'sound', label: 'Sound & Haptics', icon: soundEnabled ? Volume2 : VolumeX },
    { id: 'appearance', label: 'Display', icon: Moon },
    { id: 'security', label: 'Security', icon: Shield },
  ] as const

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Student Settings & Preferences"
      size="md"
    >
      <ModalBody>
        <div className="flex flex-col gap-4">
          {/* Section Navigation Tabs — Horizontally Scrollable on Mobile */}
          <div className="flex items-center gap-1.5 p-1 bg-[var(--color-surface-2)] rounded-2xl overflow-x-auto no-scrollbar touch-pan-x text-xs border border-[oklch(100%_0_0_/_0.06)]">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setActiveSection(id)
                  setSavedNotice(null)
                  setErrorMessage(null)
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium shrink-0 transition-all ${
                  activeSection === id
                    ? 'bg-[var(--color-surface-4)] text-[var(--color-text-primary)] font-semibold shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Feedback Notices */}
          {savedNotice && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{savedNotice}</span>
            </div>
          )}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <X size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ── 1. Profile Section ── */}
          {activeSection === 'profile' && (
            <div className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="block font-semibold text-[var(--color-text-primary)]">
                  Full Name / Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Maya Patel"
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-cyan)] min-h-[44px]"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-[var(--color-text-primary)]">
                  Registered Campus Email
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-surface-3)]/40 border border-[var(--color-surface-3)] text-xs text-[var(--color-text-muted)] cursor-not-allowed select-none min-h-[44px]"
                />
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  Used for verified digital pass notifications and login.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-[var(--color-text-primary)]">
                    College / Institute
                  </label>
                  <input
                    type="text"
                    value={collegeName}
                    onChange={(e) => setCollegeName(e.target.value)}
                    placeholder="e.g. IIT Bombay"
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-cyan)] min-h-[44px]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-[var(--color-text-primary)]">
                    Graduation Year
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={gradYear}
                    onChange={(e) => setGradYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="2027"
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-cyan)] min-h-[44px]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-[var(--color-text-primary)]">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-cyan)] min-h-[44px]"
                />
              </div>
            </div>
          )}

          {/* ── 2. Notifications Section ── */}
          {activeSection === 'notifications' && (
            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.06)] cursor-pointer">
                <div>
                  <span className="font-semibold text-[var(--color-text-primary)] block">
                    Ticket & Pass Approvals
                  </span>
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    Receive email alerts when an organizer approves your registration or UPI payment.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={ticketUpdates}
                  onChange={(e) => setTicketUpdates(e.target.checked)}
                  className="w-4 h-4 rounded text-[var(--color-brand-cyan)] focus:ring-0 cursor-pointer ml-3 shrink-0"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.06)] cursor-pointer">
                <div>
                  <span className="font-semibold text-[var(--color-text-primary)] block">
                    Event Reminders (24h Before)
                  </span>
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    Notification reminders before an event start time with venue instructions.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={reminderAlerts}
                  onChange={(e) => setReminderAlerts(e.target.checked)}
                  className="w-4 h-4 rounded text-[var(--color-brand-cyan)] focus:ring-0 cursor-pointer ml-3 shrink-0"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.06)] cursor-pointer">
                <div>
                  <span className="font-semibold text-[var(--color-text-primary)] block">
                    Campus Club Announcements
                  </span>
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    Updates regarding new hackathons, workshops, and fests from registered clubs.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={(e) => setEmailAlerts(e.target.checked)}
                  className="w-4 h-4 rounded text-[var(--color-brand-cyan)] focus:ring-0 cursor-pointer ml-3 shrink-0"
                />
              </label>
            </div>
          )}

          {/* ── 3. Sound & Haptics Section ── */}
          {activeSection === 'sound' && (
            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.06)] cursor-pointer">
                <div>
                  <span className="font-semibold text-[var(--color-text-primary)] block">
                    Audio Feedback
                  </span>
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    Play confirmation tones for pass scans and payment updates.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-[var(--color-brand-cyan)] focus:ring-0 cursor-pointer ml-3 shrink-0"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.06)] cursor-pointer">
                <div>
                  <span className="font-semibold text-[var(--color-text-primary)] block">
                    Vibration & Tactile Haptics
                  </span>
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    Vibrate phone on button clicks, code copy, and gate check-in success.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={hapticsEnabled}
                  onChange={(e) => setHapticsEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-[var(--color-brand-cyan)] focus:ring-0 cursor-pointer ml-3 shrink-0"
                />
              </label>
            </div>
          )}

          {/* ── 4. Appearance & Display Section ── */}
          {activeSection === 'appearance' && (
            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.06)] cursor-pointer">
                <div>
                  <span className="font-semibold text-[var(--color-text-primary)] block">
                    Gate Scanner High-Contrast Mode
                  </span>
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    Default digital passes to pure white backdrop for rapid turnstile laser reads.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={scannerHighContrast}
                  onChange={(e) => setScannerHighContrast(e.target.checked)}
                  className="w-4 h-4 rounded text-[var(--color-brand-cyan)] focus:ring-0 cursor-pointer ml-3 shrink-0"
                />
              </label>

              <div className="p-3.5 rounded-2xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.06)]">
                <span className="font-semibold text-[var(--color-text-primary)] block mb-1">
                  Theme Palette
                </span>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  FestFlow is engineered in high-contrast Midnight Violet for optimal battery life on OLED phone screens.
                </p>
              </div>
            </div>
          )}

          {/* ── 5. Security Section ── */}
          {activeSection === 'security' && (
            <div className="space-y-3.5 text-xs">
              <div className="p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.06)]">
                <span className="font-semibold text-[var(--color-text-primary)] block mb-1">
                  Account Authentication
                </span>
                <p className="text-[11px] text-[var(--color-text-muted)] mb-3">
                  Secured with password and magic link email authorization via Supabase.
                </p>
                <div className="text-[11px] font-mono text-[var(--color-brand-cyan)]">
                  ID: {user?.id}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose()
                  signOut()
                }}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold border border-rose-500/30 transition-all min-h-[44px] cursor-pointer"
              >
                <LogOut size={16} />
                <span>Sign Out from Device</span>
              </button>
            </div>
          )}
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" size="sm" onClick={onClose} className="min-h-[44px]">
          Close
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSavePreferences}
          disabled={isSaving}
          isLoading={isSaving}
          leftIcon={<Save size={15} />}
          className="min-h-[44px]"
        >
          Save Changes
        </Button>
      </ModalFooter>
    </Modal>
  )
}
