import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import {
  Zap,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Save,
  Eye,
  HelpCircle,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getEventById } from '@/lib/events'
import {
  getClubEventAutomations,
  saveClubEventAutomation,
  DEFAULT_CLUB_AUTOMATIONS,
} from '@/lib/notifications'
import type { ClubEventAutomationRecord, EventWithClub } from '@/types'

export default function ClubAutomationPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const { user } = useAuth()

  const [event, setEvent] = useState<EventWithClub | null>(null)
  const [automations, setAutomations] = useState<ClubEventAutomationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [previewRule, setPreviewRule] = useState<ClubEventAutomationRecord | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (!eventId) return
      setLoading(true)
      try {
        const res = await getEventById(eventId)
        if (res.event) {
          setEvent(res.event as any)
          const clubId = (res.event as any).club_id || user?.id || 'default_club'
          const rules = await getClubEventAutomations(eventId, clubId)
          setAutomations(rules)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [eventId, user])

  const handleToggle = async (rule: ClubEventAutomationRecord) => {
    const updated = { ...rule, is_enabled: !rule.is_enabled }
    setAutomations((prev) => prev.map((r) => (r.id === rule.id ? updated : r)))
    setSavingId(rule.id)
    await saveClubEventAutomation(updated)
    setSavingId(null)
  }

  const handleTemplateChange = (id: string, newText: string) => {
    setAutomations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, message_template: newText } : r))
    )
  }

  const handleSaveRule = async (rule: ClubEventAutomationRecord) => {
    setSavingId(rule.id)
    const res = await saveClubEventAutomation(rule)
    setSavingId(null)
    if (res.success) {
      setFeedback(`Automation rule updated.`)
      setTimeout(() => setFeedback(null), 2500)
    }
  }

  const renderPreviewText = (template: string) => {
    if (!template) return ''
    return template
      .replace(/{{event_title}}/g, event?.title || 'TechFest 2026')
      .replace(/{{venue_name}}/g, event?.venue_name || 'Campus Main Auditorium')
      .replace(/{{student_name}}/g, 'Alex Rivera')
      .replace(
        /{{start_time}}/g,
        event?.start_date
          ? new Date(event.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '10:00 AM'
      )
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Link */}
        <Link
          to={eventId ? `/club/events/${eventId}/registrations` : '/club/events'}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[#18CFFC] transition-colors"
        >
          <ArrowLeft size={14} /> Back to Event
        </Link>

        {/* Header */}
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[var(--color-surface-1)] to-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.08)] shadow-2xl relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 relative z-10">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[#18CFFC]/15 text-[#18CFFC] border border-[#18CFFC]/20 flex items-center gap-1.5">
                <Zap size={12} /> Club Automation Hub
              </span>
              {event && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]">
                  {event.title}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-text-primary)] font-display">
              Event Automations
            </h1>
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
              Configure automatic turnstile calls, countdown alerts, and post-event surveys
            </p>
          </div>

          {feedback && (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 animate-fade-in">
              <CheckCircle2 size={14} />
              {feedback}
            </div>
          )}
        </div>

        {/* Explanatory Info Card */}
        <div className="p-4 rounded-2xl bg-[#07A4FC]/10 border border-[#07A4FC]/20 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-[#07A4FC]/20 text-[#07A4FC] shrink-0 mt-0.5">
            <HelpCircle size={16} />
          </div>
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-[var(--color-text-primary)]">
              Guaranteed Delivery & Anti-Spam Safety
            </p>
            <p className="text-[var(--color-text-secondary)] leading-relaxed">
              Automated reminders are dispatched only to eligible, confirmed attendees who have enabled reminders in their notification preferences. Cancelled or unverified registrations are safely omitted.
            </p>
          </div>
        </div>

        {/* Automation Rules List */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#18CFFC] mx-auto" />
            <p className="text-xs text-[var(--color-text-muted)]">Loading event automation rules...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {automations.map((rule) => {
              const def = DEFAULT_CLUB_AUTOMATIONS.find((d) => d.trigger_type === rule.trigger_type)
              const isSaving = savingId === rule.id

              return (
                <div
                  key={rule.id}
                  className={`p-5 sm:p-6 rounded-2xl border transition-all space-y-4 ${
                    rule.is_enabled
                      ? 'bg-[var(--color-surface-1)] border-[oklch(100%_0_0_/_0.12)] shadow-md'
                      : 'bg-[var(--color-surface-1)]/50 border-[oklch(100%_0_0_/_0.04)] opacity-70'
                  }`}
                >
                  {/* Top Bar: Title, Description, Toggle */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[var(--color-text-primary)] font-display">
                          {def?.label || rule.trigger_type}
                        </span>
                        {rule.is_enabled ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-500/15 text-neutral-400 border border-neutral-500/20">
                            Disabled
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {def?.description || 'Custom event automation trigger'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => setPreviewRule(rule)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye size={13} /> Preview
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggle(rule)}
                        disabled={isSaving}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                          rule.is_enabled ? 'bg-[#18CFFC]' : 'bg-[var(--color-surface-3)]'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                            rule.is_enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Message Template Textarea */}
                  <div className="space-y-2 pt-2 border-t border-[var(--color-surface-2)]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[var(--color-text-secondary)]">
                        Message Template
                      </span>
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        Placeholders: {'{{event_title}}'}, {'{{venue_name}}'}, {'{{start_time}}'}
                      </span>
                    </div>

                    <textarea
                      rows={2}
                      value={rule.message_template}
                      onChange={(e) => handleTemplateChange(rule.id, e.target.value)}
                      disabled={!rule.is_enabled}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.08)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[#18CFFC] transition-colors resize-none disabled:opacity-50"
                    />

                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => handleSaveRule(rule)}
                        disabled={isSaving || !rule.is_enabled}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        Save Template
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Live Preview Modal */}
        <AnimatePresence>
          {previewRule && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="fixed inset-0 bg-black/80 backdrop-blur-sm"
                onClick={() => setPreviewRule(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-lg rounded-2xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.12)] p-6 shadow-2xl z-10 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-[var(--color-surface-3)] pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-[#18CFFC]" />
                    <h3 className="text-sm font-bold text-[var(--color-text-primary)] font-display">
                      Sample Attendee Notification Preview
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewRule(null)}
                    className="text-xs text-[var(--color-text-muted)] hover:text-white"
                  >
                    Close
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.08)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#18CFFC]">
                      FestFlow Event Notification
                    </span>
                    <span className="text-[10px] text-[var(--color-text-muted)]">Just now</span>
                  </div>
                  <p className="text-xs text-[var(--color-text-primary)] leading-relaxed font-sans">
                    {renderPreviewText(previewRule.message_template)}
                  </p>
                </div>

                <div className="text-[11px] text-[var(--color-text-muted)] text-right">
                  Rendered with sample participant and venue variables.
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
