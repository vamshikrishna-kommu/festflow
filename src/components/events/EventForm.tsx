import { useState, useRef, type FormEvent, type ChangeEvent } from 'react'
import { motion } from 'motion/react'
import {
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  Image as ImageIcon,
  Users,
  IndianRupee,
  AlertCircle,
  Upload,
  X,
  Globe,
  Building,
  CheckCircle2,
  FileText,
  ShieldCheck,
} from 'lucide-react'
import { Button, Badge } from '@/components/ui'
import { EVENT_CATEGORIES } from '@/lib/mock-data'
import { uploadEventPoster, getDefaultPoster, generateSlug } from '@/lib/events'
import { useAuth } from '@/context/AuthContext'
import type { EventRecord, EventInsert, EventCategory, EventType } from '@/types'

interface EventFormProps {
  initialData?: Partial<EventRecord>
  onSubmit: (
    data: Omit<EventInsert, 'id' | 'created_at' | 'updated_at'>,
    action: 'save_draft' | 'publish'
  ) => Promise<void>
  isSubmitting: boolean
  serverError: string | null
  mode: 'create' | 'edit'
}

// Convert ISO string to format suitable for datetime-local input (YYYY-MM-DDTHH:mm)
function toLocalDatetimeInput(isoStr?: string | null): string {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return ''
  const offset = d.getTimezoneOffset() * 60000
  const local = new Date(d.getTime() - offset)
  return local.toISOString().slice(0, 16)
}

// Convert datetime-local value to ISO UTC string
function fromLocalDatetimeInput(val: string): string {
  if (!val) return ''
  return new Date(val).toISOString()
}

export function EventForm({
  initialData,
  onSubmit,
  isSubmitting,
  serverError,
  mode,
}: EventFormProps) {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // User local timezone indicator
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  // Form states
  const [title, setTitle] = useState(initialData?.title || '')
  const [summary, setSummary] = useState(initialData?.summary || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [category, setCategory] = useState<EventCategory>(initialData?.category || 'tech')
  const [eventType, setEventType] = useState<EventType>(initialData?.event_type || 'offline')
  const [venueName, setVenueName] = useState(initialData?.venue_name || '')
  const [venueAddress, setVenueAddress] = useState(initialData?.venue_address || '')

  // Dates
  const [startDate, setStartDate] = useState(toLocalDatetimeInput(initialData?.start_date))
  const [endDate, setEndDate] = useState(toLocalDatetimeInput(initialData?.end_date))
  const [registrationClose, setRegistrationClose] = useState(
    toLocalDatetimeInput(initialData?.registration_closes_at)
  )

  // Capacity & Pricing
  const [capacity, setCapacity] = useState<number | string>(initialData?.capacity || 100)
  const [isFree, setIsFree] = useState<boolean>(initialData?.is_free ?? true)
  const [price, setPrice] = useState<number | string>(initialData?.price || 0)
  const [eligibility, setEligibility] = useState(initialData?.eligibility || '')

  // Poster state
  const [posterUrl, setPosterUrl] = useState<string>(initialData?.poster_url || '')
  const [uploadingPoster, setUploadingPoster] = useState(false)
  const [posterError, setPosterError] = useState<string | null>(null)

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Handle poster upload
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingPoster(true)
    setPosterError(null)

    const clubId = user?.id || 'demo_club'
    const res = await uploadEventPoster(file, clubId)
    setUploadingPoster(false)

    if (res.error) {
      setPosterError(res.error)
    } else if (res.url) {
      setPosterUrl(res.url)
    }
  }

  // Validate form
  const validate = (action: 'save_draft' | 'publish'): boolean => {
    const errs: Record<string, string> = {}

    if (!title.trim()) {
      errs.title = 'Event title is required'
    }

    if (action === 'publish') {
      if (!summary.trim()) {
        errs.summary = 'Short summary is required to publish'
      } else if (summary.trim().length < 20) {
        errs.summary = 'Summary should be at least 20 characters'
      }

      if (!description.trim()) {
        errs.description = 'Full description is required to publish'
      } else if (description.trim().length < 50) {
        errs.description = 'Please provide a more detailed description (at least 50 characters)'
      }

      if (!venueName.trim()) {
        errs.venueName = 'Venue name or platform link is required'
      }
    }

    // Date validations
    if (!startDate) {
      errs.startDate = 'Start date and time are required'
    }
    if (!endDate) {
      errs.endDate = 'End date and time are required'
    }

    if (startDate && endDate) {
      const startMs = new Date(startDate).getTime()
      const endMs = new Date(endDate).getTime()
      if (endMs <= startMs) {
        errs.endDate = 'End time must be after the start time'
      }
    }

    if (startDate && registrationClose) {
      const startMs = new Date(startDate).getTime()
      const regCloseMs = new Date(registrationClose).getTime()
      if (regCloseMs > startMs) {
        errs.registrationClose = 'Registration deadline cannot be after the event starts'
      }
    }

    // Capacity validation
    const capNum = Number(capacity)
    if (isNaN(capNum) || capNum <= 0) {
      errs.capacity = 'Capacity must be a positive integer'
    }

    // Price validation
    if (!isFree) {
      const priceNum = Number(price)
      if (isNaN(priceNum) || priceNum <= 0) {
        errs.price = 'Please specify a valid ticket price greater than 0'
      }
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: FormEvent, action: 'save_draft' | 'publish') => {
    e.preventDefault()

    if (!validate(action)) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const startIso = fromLocalDatetimeInput(startDate)
    const endIso = fromLocalDatetimeInput(endDate)
    const regCloseIso = registrationClose ? fromLocalDatetimeInput(registrationClose) : null

    const finalSlug = initialData?.slug || generateSlug(title)
    const finalPoster = posterUrl || getDefaultPoster(category)

    const payload: Omit<EventInsert, 'id' | 'created_at' | 'updated_at'> = {
      slug: finalSlug,
      club_id: user?.id || 'demo_club_member_default',
      title: title.trim(),
      summary: summary.trim(),
      description: description.trim(),
      category,
      poster_url: finalPoster,
      start_date: startIso,
      end_date: endIso,
      venue_name: venueName.trim(),
      venue_address: venueAddress.trim() || null,
      event_type: eventType,
      registration_opens_at: new Date().toISOString(),
      registration_closes_at: regCloseIso,
      capacity: Number(capacity),
      is_free: isFree,
      price: isFree ? 0 : Number(price),
      currency: 'INR',
      eligibility: eligibility.trim() || null,
      status: action === 'publish' ? 'published' : 'draft',
    }

    await onSubmit(payload, action)
  }

  return (
    <form className="flex flex-col gap-8 w-full max-w-4xl mx-auto text-left" noValidate>
      {serverError && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-3"
        >
          <AlertCircle size={18} className="shrink-0" />
          <span>{serverError}</span>
        </motion.div>
      )}

      {/* ── Section 1: Basic Information ─────────────────────────────────── */}
      <div className="glass p-6 sm:p-8 rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.08)] flex flex-col gap-6 shadow-lg">
        <div className="flex items-center gap-2.5 pb-4 border-b border-[var(--color-surface-3)]">
          <span className="p-2 rounded-xl bg-[var(--color-brand-purple)]/15 text-[var(--color-brand-purple)]">
            <Sparkles size={18} />
          </span>
          <div>
            <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)]">
              Event Overview
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Core details that will appear on discover cards and public listings
            </p>
          </div>
        </div>

        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="event-title" className="text-xs font-semibold text-[var(--color-text-secondary)]">
            Event Title <span className="text-rose-400">*</span>
          </label>
          <input
            id="event-title"
            type="text"
            placeholder="e.g. Technova 2026: Annual AI & Cloud Hackathon"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              if (errors.title) setErrors((prev) => ({ ...prev, title: '' }))
            }}
            className={`w-full px-4 py-3 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border transition-all outline-none placeholder:text-[var(--color-text-muted)] ${
              errors.title
                ? 'border-rose-500/80 focus:border-rose-500'
                : 'border-[var(--color-surface-3)] focus:border-[var(--color-brand-purple)]'
            }`}
          />
          {errors.title && <p className="text-xs text-rose-400">{errors.title}</p>}
        </div>

        {/* Category Picker */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
            Category <span className="text-rose-400">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {EVENT_CATEGORIES.filter((c) => c.value !== 'all').map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value as EventCategory)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-all capitalize ${
                  category === cat.value
                    ? 'bg-[var(--color-brand-purple)] border-[var(--color-brand-purple)] text-white shadow-md shadow-[var(--color-brand-purple)]/20'
                    : 'bg-[var(--color-surface-2)] border-[var(--color-surface-3)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Short Summary */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <label htmlFor="event-summary" className="text-xs font-semibold text-[var(--color-text-secondary)]">
              Short Summary <span className="text-[var(--color-text-muted)]">(for cards & social snippets)</span>
            </label>
            <span className="text-[11px] text-[var(--color-text-muted)]">
              {summary.length}/160 characters
            </span>
          </div>
          <textarea
            id="event-summary"
            rows={2}
            maxLength={200}
            placeholder="A compelling 1-2 sentence hook describing what attendees will learn or experience..."
            value={summary}
            onChange={(e) => {
              setSummary(e.target.value)
              if (errors.summary) setErrors((prev) => ({ ...prev, summary: '' }))
            }}
            className={`w-full px-4 py-2.5 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border transition-all outline-none placeholder:text-[var(--color-text-muted)] resize-none ${
              errors.summary
                ? 'border-rose-500/80 focus:border-rose-500'
                : 'border-[var(--color-surface-3)] focus:border-[var(--color-brand-purple)]'
            }`}
          />
          {errors.summary && <p className="text-xs text-rose-400">{errors.summary}</p>}
        </div>
      </div>

      {/* ── Section 2: Visual Poster Upload ──────────────────────────────── */}
      <div className="glass p-6 sm:p-8 rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.08)] flex flex-col gap-6 shadow-lg">
        <div className="flex items-center gap-2.5 pb-4 border-b border-[var(--color-surface-3)]">
          <span className="p-2 rounded-xl bg-[var(--color-brand-pink)]/15 text-[var(--color-brand-pink)]">
            <ImageIcon size={18} />
          </span>
          <div>
            <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)]">
              Event Poster
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Upload a 16:9 high-resolution banner image (max 5MB) or use curated defaults
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Live Preview */}
          <div className="relative h-48 rounded-2xl overflow-hidden border border-[var(--color-surface-3)] bg-[var(--color-surface-2)] group shadow-inner">
            <img
              src={posterUrl || getDefaultPoster(category)}
              alt="Poster preview"
              className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              <Badge variant="purple" className="capitalize text-[10px]">
                {category}
              </Badge>
              <span className="text-[11px] text-white/90 font-medium">
                {posterUrl ? 'Custom uploaded' : 'Category fallback'}
              </span>
            </div>
            {posterUrl && (
              <button
                type="button"
                onClick={() => setPosterUrl('')}
                title="Reset to default category poster"
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white/80 hover:text-white hover:bg-black/80 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Upload trigger */}
          <div className="flex flex-col gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPoster}
              className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-[var(--color-surface-3)] hover:border-[var(--color-brand-purple)] hover:bg-[var(--color-surface-2)]/60 transition-all text-center gap-2 cursor-pointer"
            >
              <div className="p-3 rounded-full bg-[var(--color-surface-3)] text-[var(--color-brand-purple)]">
                <Upload size={20} className={uploadingPoster ? 'animate-bounce' : ''} />
              </div>
              <div>
                <span className="text-xs font-semibold text-[var(--color-text-primary)] block">
                  {uploadingPoster ? 'Uploading image…' : 'Click to upload custom poster'}
                </span>
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  PNG, JPG, WEBP, or GIF up to 5MB
                </span>
              </div>
            </button>
            {posterError && (
              <p className="text-xs text-rose-400 flex items-center gap-1">
                <AlertCircle size={13} /> {posterError}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 3: Schedule, Timezone & Location ─────────────────────── */}
      <div className="glass p-6 sm:p-8 rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.08)] flex flex-col gap-6 shadow-lg">
        <div className="flex items-center gap-2.5 pb-4 border-b border-[var(--color-surface-3)]">
          <span className="p-2 rounded-xl bg-[var(--color-brand-amber)]/15 text-[var(--color-brand-amber)]">
            <Calendar size={18} />
          </span>
          <div>
            <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)]">
              Schedule & Location
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Event timings, registration window, and campus venue
            </p>
          </div>
        </div>

        {/* Timezone Note */}
        <div className="p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] flex items-center gap-2.5 text-xs text-[var(--color-text-secondary)]">
          <Clock size={16} className="text-amber-400 shrink-0" />
          <span>
            Dates & times are entered in your local timezone:{' '}
            <strong className="text-[var(--color-text-primary)]">{userTimezone}</strong>.
            Attendees across different regions will automatically see times in their respective local timezone.
          </span>
        </div>

        {/* Date Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="start-date" className="text-xs font-semibold text-[var(--color-text-secondary)]">
              Start Date & Time <span className="text-rose-400">*</span>
            </label>
            <input
              id="start-date"
              type="datetime-local"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                if (errors.startDate) setErrors((prev) => ({ ...prev, startDate: '' }))
              }}
              className={`w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border transition-all outline-none ${
                errors.startDate
                  ? 'border-rose-500/80 focus:border-rose-500'
                  : 'border-[var(--color-surface-3)] focus:border-[var(--color-brand-purple)]'
              }`}
            />
            {errors.startDate && <p className="text-xs text-rose-400">{errors.startDate}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="end-date" className="text-xs font-semibold text-[var(--color-text-secondary)]">
              End Date & Time <span className="text-rose-400">*</span>
            </label>
            <input
              id="end-date"
              type="datetime-local"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                if (errors.endDate) setErrors((prev) => ({ ...prev, endDate: '' }))
              }}
              className={`w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border transition-all outline-none ${
                errors.endDate
                  ? 'border-rose-500/80 focus:border-rose-500'
                  : 'border-[var(--color-surface-3)] focus:border-[var(--color-brand-purple)]'
              }`}
            />
            {errors.endDate && <p className="text-xs text-rose-400">{errors.endDate}</p>}
          </div>
        </div>

        {/* Registration Deadline */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reg-close" className="text-xs font-semibold text-[var(--color-text-secondary)]">
            Registration Deadline <span className="text-[var(--color-text-muted)]">(optional — defaults to event start)</span>
          </label>
          <input
            id="reg-close"
            type="datetime-local"
            value={registrationClose}
            onChange={(e) => {
              setRegistrationClose(e.target.value)
              if (errors.registrationClose) setErrors((prev) => ({ ...prev, registrationClose: '' }))
            }}
            className={`w-full sm:w-1/2 px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border transition-all outline-none ${
              errors.registrationClose
                ? 'border-rose-500/80 focus:border-rose-500'
                : 'border-[var(--color-surface-3)] focus:border-[var(--color-brand-purple)]'
            }`}
          />
          {errors.registrationClose && (
            <p className="text-xs text-rose-400">{errors.registrationClose}</p>
          )}
        </div>

        {/* Format & Venue */}
        <div className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
              Event Format
            </label>
            <div className="grid grid-cols-3 gap-2 sm:max-w-md">
              {[
                { id: 'offline', label: 'On Campus', icon: Building },
                { id: 'online', label: 'Virtual', icon: Globe },
                { id: 'hybrid', label: 'Hybrid', icon: Sparkles },
              ].map((fmt) => {
                const Icon = fmt.icon
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setEventType(fmt.id as EventType)}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      eventType === fmt.id
                        ? 'bg-[var(--color-brand-purple)] border-[var(--color-brand-purple)] text-white shadow-md'
                        : 'bg-[var(--color-surface-2)] border-[var(--color-surface-3)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    <Icon size={14} />
                    {fmt.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="venue-name" className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Venue Name / Platform <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  id="venue-name"
                  type="text"
                  placeholder={eventType === 'online' ? 'e.g. Google Meet / Discord Server' : 'e.g. Main Auditorium, Block A'}
                  value={venueName}
                  onChange={(e) => {
                    setVenueName(e.target.value)
                    if (errors.venueName) setErrors((prev) => ({ ...prev, venueName: '' }))
                  }}
                  className={`w-full px-3.5 py-2.5 pl-9 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border transition-all outline-none ${
                    errors.venueName
                      ? 'border-rose-500/80 focus:border-rose-500'
                      : 'border-[var(--color-surface-3)] focus:border-[var(--color-brand-purple)]'
                  }`}
                />
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              </div>
              {errors.venueName && <p className="text-xs text-rose-400">{errors.venueName}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="venue-address" className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Address / Join Link <span className="text-[var(--color-text-muted)]">(optional)</span>
              </label>
              <input
                id="venue-address"
                type="text"
                placeholder={eventType === 'online' ? 'https://meet.google.com/...' : 'Campus North Gate, Road 4'}
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)] focus:border-[var(--color-brand-purple)] transition-all outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 4: Tickets & Capacity ───────────────────────────────── */}
      <div className="glass p-6 sm:p-8 rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.08)] flex flex-col gap-6 shadow-lg">
        <div className="flex items-center gap-2.5 pb-4 border-b border-[var(--color-surface-3)]">
          <span className="p-2 rounded-xl bg-[var(--color-brand-cyan)]/15 text-[var(--color-brand-cyan)]">
            <Users size={18} />
          </span>
          <div>
            <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)]">
              Passes & Capacity
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Specify seat capacity and ticket pricing
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          {/* Capacity */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="event-capacity" className="text-xs font-semibold text-[var(--color-text-secondary)]">
              Max Attendee Capacity <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                id="event-capacity"
                type="number"
                min="1"
                placeholder="100"
                value={capacity}
                onChange={(e) => {
                  setCapacity(e.target.value)
                  if (errors.capacity) setErrors((prev) => ({ ...prev, capacity: '' }))
                }}
                className={`w-full px-3.5 py-2.5 pl-9 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border transition-all outline-none ${
                  errors.capacity
                    ? 'border-rose-500/80 focus:border-rose-500'
                    : 'border-[var(--color-surface-3)] focus:border-[var(--color-brand-purple)]'
                }`}
              />
              <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            </div>
            {errors.capacity && <p className="text-xs text-rose-400">{errors.capacity}</p>}
          </div>

          {/* Pricing Toggle */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
              Registration Fee
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsFree(true)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                  isFree
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-sm'
                    : 'bg-[var(--color-surface-2)] border-[var(--color-surface-3)] text-[var(--color-text-secondary)]'
                }`}
              >
                Free Event
              </button>
              <button
                type="button"
                onClick={() => setIsFree(false)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                  !isFree
                    ? 'bg-[var(--color-brand-purple)] border-[var(--color-brand-purple)] text-white shadow-sm'
                    : 'bg-[var(--color-surface-2)] border-[var(--color-surface-3)] text-[var(--color-text-secondary)]'
                }`}
              >
                Paid Ticket
              </button>
            </div>

            {!isFree && (
              <div className="mt-2 flex flex-col gap-1.5">
                <div className="relative">
                  <input
                    id="ticket-price"
                    type="number"
                    min="1"
                    placeholder="Ticket price (INR)"
                    value={price}
                    onChange={(e) => {
                      setPrice(e.target.value)
                      if (errors.price) setErrors((prev) => ({ ...prev, price: '' }))
                    }}
                    className={`w-full px-3.5 py-2.5 pl-9 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border transition-all outline-none ${
                      errors.price
                        ? 'border-rose-500/80 focus:border-rose-500'
                        : 'border-[var(--color-surface-3)] focus:border-[var(--color-brand-purple)]'
                    }`}
                  />
                  <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                </div>
                {errors.price && <p className="text-xs text-rose-400">{errors.price}</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 5: Full Description & Guidelines ─────────────────────── */}
      <div className="glass p-6 sm:p-8 rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.08)] flex flex-col gap-6 shadow-lg">
        <div className="flex items-center gap-2.5 pb-4 border-b border-[var(--color-surface-3)]">
          <span className="p-2 rounded-xl bg-purple-500/15 text-purple-400">
            <FileText size={18} />
          </span>
          <div>
            <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)]">
              Description & Guidelines
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Detailed event schedule, speaker info, rules, and eligibility requirements
            </p>
          </div>
        </div>

        {/* Description Editor */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="event-description" className="text-xs font-semibold text-[var(--color-text-secondary)]">
              Full Event Description <span className="text-rose-400">*</span>
            </label>
            <span className="text-[11px] text-[var(--color-text-muted)]">
              Markdown & line breaks supported
            </span>
          </div>
          <textarea
            id="event-description"
            rows={8}
            placeholder="Introduce the event agenda, prizes, prerequisite skills, timeline, and what attendees should bring..."
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              if (errors.description) setErrors((prev) => ({ ...prev, description: '' }))
            }}
            className={`w-full p-4 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border transition-all outline-none font-sans leading-relaxed ${
              errors.description
                ? 'border-rose-500/80 focus:border-rose-500'
                : 'border-[var(--color-surface-3)] focus:border-[var(--color-brand-purple)]'
            }`}
          />
          {errors.description && <p className="text-xs text-rose-400">{errors.description}</p>}
        </div>

        {/* Eligibility & Additional Instructions */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="event-eligibility" className="text-xs font-semibold text-[var(--color-text-secondary)]">
            Eligibility & Instructions <span className="text-[var(--color-text-muted)]">(optional)</span>
          </label>
          <input
            id="event-eligibility"
            type="text"
            placeholder="e.g. Open to all registered undergraduate and postgraduate students. Bring college ID."
            value={eligibility}
            onChange={(e) => setEligibility(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)] focus:border-[var(--color-brand-purple)] transition-all outline-none"
          />
        </div>
      </div>

      {/* ── Form Actions ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl glass border border-[oklch(100%_0_0_/_0.1)] sticky bottom-4 shadow-2xl z-20 backdrop-blur-md">
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
          <span>
            {mode === 'create'
              ? 'Drafts are private to your club. Publishing makes the event discoverable immediately.'
              : 'Updates to published events are reflected in real time for attendees.'}
          </span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={(e) => handleSubmit(e, 'save_draft')}
            disabled={isSubmitting}
            className="flex-1 sm:flex-initial"
          >
            Save Draft
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={(e) => handleSubmit(e, 'publish')}
            disabled={isSubmitting}
            isLoading={isSubmitting}
            leftIcon={<CheckCircle2 size={16} />}
            className="flex-1 sm:flex-initial"
          >
            {mode === 'create' ? 'Publish Event' : 'Update & Publish'}
          </Button>
        </div>
      </div>
    </form>
  )
}
