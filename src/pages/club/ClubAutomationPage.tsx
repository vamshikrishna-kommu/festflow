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
import { getEventById, isEventConcludedOrCancelled, getEventLifecyclePhase } from '@/lib/events'
import {
  getClubEventAutomations,
  saveClubEventAutomation,
  DEFAULT_CLUB_AUTOMATIONS,
} from '@/lib/notifications'
import type { ClubEventAutomationRecord, EventWithClub } from '@/types'

export default function ClubAutomationPage() {
  const { id: eventId } = useParams<{ id: string }>()
  const { role, activeClubRole, eventAssignments, hasEventPermission, isRoleLoading } = useAuth()

  const [event, setEvent] = useState<EventWithClub | null>(null)
  const [automations, setAutomations] = useState<ClubEventAutomationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [previewRule, setPreviewRule] = useState<ClubEventAutomationRecord | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const canManageAutomation = event
    ? role === 'platform_admin' ||
      hasEventPermission(event.id, 'events.edit', event.club_id) ||
      hasEventPermission(event.id, 'club.manage', event.club_id)
    : Boolean(authorized)

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!eventId || isRoleLoading) return
      setLoading(true)
      setLoadError(null)
      try {
        const res = await getEventById(eventId)
        if (!mounted) return
        if (res.error) {
          setLoadError(res.error)
        }
        if (res.event) {
          const allowed =
            role === 'platform_admin' ||
            hasEventPermission(res.event.id, 'events.edit', res.event.club_id) ||
            hasEventPermission(res.event.id, 'club.manage', res.event.club_id)
          setAuthorized(allowed)
          if (allowed && res.event.club_id) {
            setEvent(res.event as any)
            const rules = await getClubEventAutomations(eventId, res.event.club_id)
            if (mounted) setAutomations(rules)
          } else {
            setEvent(null)
            setAutomations([])
          }
        } else {
          setAuthorized(false)
          setEvent(null)
          setAutomations([])
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [eventId, role, isRoleLoading, activeClubRole, eventAssignments])

  const isLockedArchive = event ? isEventConcludedOrCancelled(event) : false
  const lifecyclePhase = event ? getEventLifecyclePhase(event) : 'published'

  const handleToggle = async (rule: ClubEventAutomationRecord) => {
    if (isLockedArchive || !canManageAutomation) return
    const updated = { ...rule, is_enabled: !rule.is_enabled }
    setAutomations((prev) => prev.map((r) => (r.id === rule.id ? updated : r)))
    setSavingId(rule.id)
    await saveClubEventAutomation(updated)
    setSavingId(null)
  }

  const handleTemplateChange = (id: string, newText: string) => {
    if (isLockedArchive || !canManageAutomation) return
    setAutomations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, message_template: newText } : r))
    )
  }

  const handleSaveRule = async (rule: ClubEventAutomationRecord) => {
    if (isLockedArchive || !canManageAutomation) return
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
      .replace(/{{event_title}}/g, event?.title || '[Event Title]')
      .replace(/{{venue_name}}/g, event?.venue_name || '[Venue Name]')
      .replace(/{{student_name}}/g, '[Participant Name]')
      .replace(
        /{{start_time}}/g,
        event?.start_date
          ? new Date(event.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '[Start Time]'
      )
  }

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Link */}
        <Link
          to={eventId ? `/club/events/${eventId}/registrations` : '/club/events'}
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Event
        </Link>

        {/* Header */}
        <div className="p-6 sm:p-8 rounded-2xl bg-white border border-gray-200 shadow-xs relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 relative z-10">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5">
                <Zap size={12} /> Club Automation Hub
              </span>
              {event && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 border border-gray-200 text-gray-700">
                  {event.title}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-display">
              Event Automations
            </h1>
            <p className="text-xs sm:text-sm text-gray-600">
              Configure registration confirmations, countdown alerts, and post-event surveys
            </p>
          </div>

          {feedback && (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-1.5 animate-fade-in">
              <CheckCircle2 size={14} />
              {feedback}
            </div>
          )}
        </div>

        {/* Explanatory Info Card */}
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-blue-100 text-blue-600 shrink-0 mt-0.5">
            <HelpCircle size={16} />
          </div>
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-gray-900">
              Guaranteed Delivery & Anti-Spam Safety
            </p>
            <p className="text-gray-600 leading-relaxed">
              Automated reminders are dispatched only to eligible, confirmed attendees who have enabled reminders in their notification preferences. Cancelled or unverified registrations are safely omitted.
            </p>
          </div>
        </div>

        {/* Automation Rules List */}
        {loading || isRoleLoading ? (
          <div className="py-20 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
            <p className="text-xs text-gray-500">Loading event automation rules...</p>
          </div>
        ) : loadError ? (
          <div className="p-6 sm:p-8 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-3 shadow-xs">
            <h2 className="text-base font-bold text-rose-900">Unable to load event automations</h2>
            <p className="text-xs text-rose-700 max-w-md mx-auto">{loadError}</p>
            <Link
              to="/club/events"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-rose-200 text-xs font-semibold text-rose-800 hover:bg-rose-50 transition-colors"
            >
              Return to Club Events
            </Link>
          </div>
        ) : authorized === false || !canManageAutomation ? (
          <div className="p-6 sm:p-8 rounded-2xl bg-white border border-rose-200 text-center space-y-3 shadow-xs">
            <h2 className="text-base font-bold text-gray-900">Event Automation Access Restricted</h2>
            <p className="text-xs text-gray-600 max-w-md mx-auto">
              You do not have permission to view or modify automation templates for this event.
            </p>
            <Link
              to="/club/events"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-900 transition-colors"
            >
              Return to Club Events
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {automations.map((rule) => {
              const def = DEFAULT_CLUB_AUTOMATIONS.find((d) => d.trigger_type === rule.trigger_type)
              const isSaving = savingId === rule.id

              return (
                <div
                  key={rule.id}
                  className={`p-5 sm:p-6 rounded-xl border transition-all space-y-4 shadow-xs ${
                    rule.is_enabled
                      ? 'bg-white border-gray-200'
                      : 'bg-gray-50 border-gray-200 opacity-75'
                  }`}
                >
                  {/* Top Bar: Title, Description, Toggle */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900 font-display">
                          {def?.label || rule.trigger_type}
                        </span>
                        {rule.is_enabled ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200">
                            Disabled
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600">
                        {def?.description || 'Custom event automation trigger'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => setPreviewRule(rule)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye size={13} /> Preview
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggle(rule)}
                        disabled={isSaving || isLockedArchive}
                        className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                          isLockedArchive ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                        } ${rule.is_enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform ${
                            rule.is_enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Message Template Textarea */}
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-700">
                        Message Template
                      </span>
                      <span className="text-[11px] text-gray-500">
                        Placeholders: {'{{event_title}}'}, {'{{venue_name}}'}, {'{{start_time}}'}
                      </span>
                    </div>

                    <textarea
                      rows={2}
                      value={rule.message_template}
                      onChange={(e) => handleTemplateChange(rule.id, e.target.value)}
                      disabled={!rule.is_enabled || isLockedArchive}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-900 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-colors resize-none disabled:opacity-50"
                    />

                    <div className="flex items-center justify-between gap-2">
                      {isLockedArchive && (
                        <span className="text-[11px] text-amber-700">
                          Read-only archive: Event is {lifecyclePhase === 'cancelled' ? 'cancelled' : 'completed'}.
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSaveRule(rule)}
                        disabled={isSaving || !rule.is_enabled || isLockedArchive}
                        className="ml-auto px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
                onClick={() => setPreviewRule(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-lg rounded-2xl bg-white border border-gray-200 p-6 shadow-2xl z-10 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-blue-600" />
                    <h3 className="text-sm font-bold text-gray-900 font-display">
                      Attendee Notification Template Preview
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewRule(null)}
                    className="text-xs text-gray-500 hover:text-gray-900 cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-600">
                      FestFlow Event Notification
                    </span>
                    <span className="text-[10px] text-gray-500">Just now</span>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed font-sans">
                    {renderPreviewText(previewRule.message_template)}
                  </p>
                </div>

                <div className="text-[11px] text-gray-500 text-right">
                  Unpopulated template placeholders indicate dynamic per-attendee values.
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
