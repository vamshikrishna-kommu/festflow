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
  HelpCircle,
  Mail,
  AlertTriangle,
} from 'lucide-react'
import { Button, Modal, ModalBody, ModalFooter } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { CollegeSearchCombobox } from '@/components/colleges/CollegeSearchCombobox'

interface StudentSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  initialSection?: 'profile' | 'notifications' | 'sound' | 'appearance' | 'security' | 'help'
}

export function StudentSettingsModal({
  isOpen,
  onClose,
  initialSection = 'profile',
}: StudentSettingsModalProps) {
  const { user, profile, studentProfile, signOut, updateProfile } = useAuth()

  const [activeSection, setActiveSection] = useState<'profile' | 'notifications' | 'sound' | 'appearance' | 'security' | 'help'>(initialSection)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  
  // Profile form state
  const [displayName, setDisplayName] = useState(profile?.display_name || user?.user_metadata?.display_name || '')
  const [collegeName, setCollegeName] = useState(studentProfile?.college_name || user?.user_metadata?.college || '')
  const [collegeId, setCollegeId] = useState<string | null>(
    (studentProfile as any)?.college_id || (user?.user_metadata as any)?.college_id || null
  )
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
      setCollegeId((studentProfile as any)?.college_id || (user?.user_metadata as any)?.college_id || null)
      setGradYear(
        studentProfile?.graduation_year
          ? String(studentProfile.graduation_year)
          : user?.user_metadata?.graduation_year
          ? String(user.user_metadata.graduation_year)
          : ''
      )
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
        collegeId: collegeId || undefined,
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
    { id: 'notifications', label: 'Alerts', icon: Bell },
    { id: 'sound', label: 'Haptics', icon: soundEnabled ? Volume2 : VolumeX },
    { id: 'appearance', label: 'Display', icon: Moon },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'help', label: 'Help', icon: HelpCircle },
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
          <div className="flex items-center gap-1.5 p-1 bg-[#14141A] rounded-2xl overflow-x-auto no-scrollbar touch-pan-x text-xs border border-white/[0.08]">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setActiveSection(id)
                  setSavedNotice(null)
                  setErrorMessage(null)
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium shrink-0 transition-all cursor-pointer ${
                  activeSection === id
                    ? 'bg-[#242430] text-white font-semibold shadow-sm border border-white/10'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Icon size={14} className={activeSection === id ? 'text-[#18CFFC]' : ''} />
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

              <div className="space-y-3">
                <CollegeSearchCombobox
                  label="College / Institute"
                  selectedCollegeId={collegeId}
                  selectedCollegeName={collegeName}
                  onSelect={(col, rawName) => {
                    if (col) {
                      setCollegeId(col.id)
                      setCollegeName(col.official_name || col.name)
                    } else {
                      setCollegeId(null)
                      setCollegeName(rawName || '')
                    }
                  }}
                />

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
                  Account ID: {user?.id}
                </div>
              </div>

              {!showLogoutConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold border border-rose-500/30 transition-all min-h-[44px] cursor-pointer"
                >
                  <LogOut size={16} />
                  <span>Sign Out from Device</span>
                </button>
              ) : (
                <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 space-y-3">
                  <div className="flex items-center gap-2 text-rose-300 font-semibold">
                    <AlertTriangle size={18} className="text-rose-400 shrink-0" />
                    <span>Are you sure you want to sign out?</span>
                  </div>
                  <p className="text-[11px] text-rose-200/80">
                    Your offline cached tickets will remain stored securely on this device, but you will need to log in again to register for new campus events.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowLogoutConfirm(false)}
                      className="flex-1 min-h-[44px]"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        onClose()
                        signOut()
                      }}
                      className="flex-1 min-h-[44px]"
                      leftIcon={<LogOut size={15} />}
                    >
                      Yes, Sign Out
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 6. Help & Support Section ── */}
          {activeSection === 'help' && (
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.06)] space-y-2">
                <span className="font-semibold text-[var(--color-text-primary)] block">
                  Frequently Asked Questions
                </span>
                <div className="space-y-2 text-[11px] text-[var(--color-text-muted)]">
                  <div>
                    <strong className="text-[var(--color-text-primary)] block">How do I enter an event with my ticket?</strong>
                    Open "My Passes", tap on the event, and show the digital QR code at the campus entry gate. You can enable High-Contrast mode for bright sunlight.
                  </div>
                  <div>
                    <strong className="text-[var(--color-text-primary)] block">How are UPI payments verified?</strong>
                    After transferring to the club's official UPI ID, submit your 12-digit UTR reference number and receipt screenshot. The organizer reconciles it against their records.
                  </div>
                  <div>
                    <strong className="text-[var(--color-text-primary)] block">Can I access my passes offline?</strong>
                    Yes. Once opened, confirmed passes are securely cached in local storage on your device.
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.06)] flex items-center justify-between">
                <div>
                  <span className="font-semibold text-[var(--color-text-primary)] block">
                    Campus Student Helpdesk
                  </span>
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    Need assistance with payments or registration?
                  </span>
                </div>
                <a
                  href="mailto:support@festflow.online"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--color-brand-cyan)]/10 text-[var(--color-brand-cyan)] border border-[var(--color-brand-cyan)]/25 font-semibold text-xs min-h-[44px]"
                >
                  <Mail size={14} />
                  <span>Email Support</span>
                </a>
              </div>

              <div className="flex items-center justify-between text-[11px] px-1 text-[var(--color-text-muted)]">
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-white underline">
                  Terms of Service
                </a>
                <span>•</span>
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-white underline">
                  Privacy Policy
                </a>
                <span>•</span>
                <span className="font-mono text-[10px]">FestFlow v2.0</span>
              </div>
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
