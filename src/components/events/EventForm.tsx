import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from 'react'
import { motion } from 'motion/react'
import {
  Sparkles,
  Calendar,
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
  Plus,
  Trash2,
  Eye,
  Layers,
  HelpCircle,
  ExternalLink,
  Mail,
  Phone,
  ListPlus,
  Sliders,
  ArrowUp,
  ArrowDown,
  EyeOff,
  Layout,
  Lock,
  LayoutGrid,
} from 'lucide-react'
import { Button, Badge } from '@/components/ui'
import { EVENT_CATEGORIES } from '@/lib/mock-data'
import {
  getDefaultPoster,
  resolvePosterUrl,
  uploadEventPoster,
  generateSlug,
  validateEventConfig,
  resolveEventTimezone,
  zonedDatetimeInputToIso,
  isoToZonedDatetimeInput,
} from '@/lib/events'
import { readFileAsDataUrl, compressImageToDataUrl } from '@/lib/imageOptimization'
import { EventPreviewModal } from './EventPreviewModal'
import { EventPageBuilder } from './EventPageBuilder'
import { useAuth } from '@/context/AuthContext'
import type {
  EventRecord,
  EventInsert,
  EventCategory,
  EventType,
  ParticipationType,
  ApprovalType,
  TeamRegistrationMode,
  CustomQuestion,
  CustomQuestionType,
  ParticipantFieldsRequirement,
  EventStatus,
  EventPageSection,
} from '@/types'

interface EventFormProps {
  initialData?: Partial<EventRecord>
  onSubmit: (
    data: Omit<EventInsert, 'id' | 'created_at' | 'updated_at'>,
    action: 'save_draft' | 'publish'
  ) => Promise<void>
  isSubmitting: boolean
  serverError: string | null
  mode: 'create' | 'edit'
  readOnly?: boolean
  allowAdminStatusEdit?: boolean
  canPublish?: boolean
}

export function EventForm({
  initialData,
  onSubmit,
  isSubmitting,
  serverError,
  mode,
  readOnly = false,
  allowAdminStatusEdit = false,
  canPublish,
}: EventFormProps) {
  const {
    user,
    clubProfile,
    activeClubId,
    activeClubProfile,
    hasClubPermission,
    hasEventPermission,
  } = useAuth()

  const targetClubId =
    mode === 'edit'
      ? (initialData?.club_id || activeClubId || clubProfile?.profile_id || '')
      : (activeClubId || clubProfile?.profile_id || '')

  const effectiveCanPublish =
    canPublish !== undefined
      ? canPublish
      : mode === 'edit' && initialData?.id
        ? hasEventPermission(initialData.id, 'events.publish', initialData.club_id)
        : hasClubPermission('events.publish')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // System timezones
  const COMMON_TIMEZONES = [
    { value: 'Asia/Kolkata', label: 'IST — India Standard Time (UTC+05:30)' },
    { value: 'Asia/Dubai', label: 'GST — Gulf Standard Time (UTC+04:00)' },
    { value: 'Asia/Singapore', label: 'SGT — Singapore Time (UTC+08:00)' },
    { value: 'Europe/London', label: 'GMT/BST — London (UTC+00:00)' },
    { value: 'America/New_York', label: 'EST — Eastern Time (UTC-05:00)' },
    { value: 'America/Los_Angeles', label: 'PST — Pacific Time (UTC-08:00)' },
  ]

  // Form states: Section 1 (Core Info)
  const [title, setTitle] = useState(initialData?.title || '')
  const [summary, setSummary] = useState(initialData?.summary || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [category, setCategory] = useState<EventCategory>(initialData?.category || 'tech')
  const [contactEmail, setContactEmail] = useState(initialData?.contact_email || user?.email || '')
  const [contactPhone, setContactPhone] = useState(initialData?.contact_phone || '')

  // Section 2: Format & Location
  const [eventType, setEventType] = useState<EventType>(initialData?.event_type || 'offline')
  const [venueName, setVenueName] = useState(initialData?.venue_name || '')
  const [venueAddress, setVenueAddress] = useState(initialData?.venue_address || '')
  const [onlineMeetingUrl, setOnlineMeetingUrl] = useState(initialData?.online_meeting_url || '')

  // Section 3: Schedule & Timezone
  const initialTimezone = resolveEventTimezone(initialData?.timezone)
  const [timezone, setTimezone] = useState(initialTimezone)
  const [startDate, setStartDate] = useState(isoToZonedDatetimeInput(initialData?.start_date, initialTimezone))
  const [endDate, setEndDate] = useState(isoToZonedDatetimeInput(initialData?.end_date, initialTimezone))
  const [registrationStart, setRegistrationStart] = useState(
    isoToZonedDatetimeInput(initialData?.registration_start_date || initialData?.registration_opens_at, initialTimezone)
  )
  const [registrationClose, setRegistrationClose] = useState(
    isoToZonedDatetimeInput(initialData?.registration_closes_at, initialTimezone)
  )

  // Section 4: Participation & Team Configuration
  const [participationType, setParticipationType] = useState<ParticipationType>(
    initialData?.participation_type || 'individual'
  )
  const [minTeamSize, setMinTeamSize] = useState<number>(initialData?.min_team_size || 2)
  const [maxTeamSize, setMaxTeamSize] = useState<number>(initialData?.max_team_size || 4)
  const [leaderCountsTowardsSize, setLeaderCountsTowardsSize] = useState<boolean>(
    initialData?.leader_counts_towards_size ?? true
  )
  const [teamRegistrationMode, setTeamRegistrationMode] = useState<TeamRegistrationMode>(
    initialData?.team_registration_mode || 'leader_adds_members'
  )
  const [requireTeamName, setRequireTeamName] = useState<boolean>(
    initialData?.require_team_name ?? false
  )

  // Standard attendee fields configuration
  const [participantFields, setParticipantFields] = useState<ParticipantFieldsRequirement>(
    initialData?.participant_fields || {
      require_college: true,
      require_phone: true,
      require_grad_year: true,
      require_id_card: false,
    }
  )

  // Section 5: Capacity, Pricing & Approval
  const [capacity, setCapacity] = useState<number | string>(initialData?.capacity || 100)
  const [isFree, setIsFree] = useState<boolean>(initialData?.is_free ?? true)
  const [price, setPrice] = useState<number | string>(initialData?.price || 0)
  const [approvalType, setApprovalType] = useState<ApprovalType>(
    initialData?.approval_type || 'automatic'
  )
  const [status, setStatus] = useState<EventStatus>(initialData?.status || 'draft')
  const [waitlistEnabled, setWaitlistEnabled] = useState<boolean>(
    initialData?.waitlist_enabled ?? true
  )
  const [isUnlisted, setIsUnlisted] = useState<boolean>(
    initialData?.is_unlisted ?? false
  )
  const [registrationMode, setRegistrationMode] = useState<'standard' | 'reserved_seating'>(
    (initialData as any)?.registration_mode || 'standard'
  )
  const [showSeatAvailability, setShowSeatAvailability] = useState<boolean>(
    (initialData as any)?.show_seat_availability ?? true
  )
  const [coverUrl, setCoverUrl] = useState<string>(initialData?.cover_url || '')
  const [pageLayout, setPageLayout] = useState<EventPageSection[]>(
    initialData?.page_layout || []
  )

  // Section 6: Custom Questions Builder
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>(
    initialData?.custom_questions || []
  )

  // Section 7: Rules & Restrictions
  const [rules, setRules] = useState(initialData?.rules || '')
  const [eligibility, setEligibility] = useState(initialData?.eligibility || '')
  const [departmentsInput, setDepartmentsInput] = useState<string>(
    initialData?.allowed_departments ? initialData.allowed_departments.join(', ') : ''
  )
  const [selectedYears, setSelectedYears] = useState<number[]>(
    initialData?.allowed_years || []
  )

  // Poster upload state
  const [posterUrl, setPosterUrl] = useState<string>(initialData?.poster_url || '')
  const [uploadingPoster, setUploadingPoster] = useState(false)
  const [posterError, setPosterError] = useState<string | null>(null)
  const [previewImgError, setPreviewImgError] = useState(false)

  // Preview Modal state
  const [showPreview, setShowPreview] = useState(false)

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Prevent accidental data loss if user attempts to reload or navigate away while editing
  const isDirty = Boolean(title.trim() || summary.trim() || description.trim() || venueName.trim())
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !isSubmitting) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty, isSubmitting])

  // Handle poster upload
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 0. Instantly preview the chosen image using a local object URL (0ms latency, zero delay)
    try {
      const instantBlobUrl = URL.createObjectURL(file)
      setPosterUrl(instantBlobUrl)
    } catch {
      // ignore
    }
    setCoverUrl('')
    setPreviewImgError(false)
    setPosterError(null)
    setUploadingPoster(true)

    try {
      // 1. Immediately compress the selected file to a compact, ultra-crisp WebP Data URL (~40-60KB)
      const optimizedData = await compressImageToDataUrl(file, {
        maxWidth: 1280,
        maxHeight: 720,
        quality: 0.76,
        format: 'image/webp',
      })

      const finalDataUrl = optimizedData || (await readFileAsDataUrl(file))
      if (finalDataUrl) {
        setPosterUrl(finalDataUrl)
        setCoverUrl('')
        setPreviewImgError(false)
        setPosterError(null)

        if (typeof window !== 'undefined') {
          if (initialData?.id) {
            try {
              localStorage.setItem(`festflow_custom_poster_${initialData.id}`, finalDataUrl)
            } catch {
              // ignore quota
            }
          }
          if (initialData?.slug) {
            try {
              localStorage.setItem(`festflow_custom_poster_${initialData.slug}`, finalDataUrl)
            } catch {
              // ignore quota
            }
          }
        }
      } else {
        setPosterError('Could not process image file.')
      }

      // 2. Parallel upload to Supabase Storage bucket 'event-posters' if available
      const uploadFolder = targetClubId || initialData?.club_id || user?.id
      if (uploadFolder) {
        try {
          const storageRes = await uploadEventPoster(file, uploadFolder)
          if (storageRes.url && !storageRes.error && storageRes.url.startsWith('http')) {
            setPosterUrl(storageRes.url)
            if (typeof window !== 'undefined') {
              if (initialData?.id) {
                try { localStorage.setItem(`festflow_custom_poster_${initialData.id}`, storageRes.url) } catch {}
              }
              if (initialData?.slug) {
                try { localStorage.setItem(`festflow_custom_poster_${initialData.slug}`, storageRes.url) } catch {}
              }
            }
          }
        } catch {
          // ignore - finalDataUrl already safely in place
        }
      }
    } catch {
      try {
        const rawData = await readFileAsDataUrl(file)
        if (rawData) {
          setPosterUrl(rawData)
          setCoverUrl('')
          setPreviewImgError(false)
          setPosterError(null)

          if (typeof window !== 'undefined') {
            if (initialData?.id) {
              try {
                localStorage.setItem(`festflow_custom_poster_${initialData.id}`, rawData)
              } catch {
                // ignore
              }
            }
            if (initialData?.slug) {
              try {
                localStorage.setItem(`festflow_custom_poster_${initialData.slug}`, rawData)
              } catch {
                // ignore
              }
            }
          }
        }
      } catch {
        setPosterError('Failed to read image file from device.')
      }
    } finally {
      setUploadingPoster(false)
      if (e.target) {
        e.target.value = ''
      }
    }
  }

  // Custom questions handlers
  const handleAddQuestion = () => {
    const newQ: CustomQuestion = {
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      label: '',
      type: 'text',
      required: false,
      placeholder: '',
    }
    setCustomQuestions((prev) => [...prev, newQ])
  }

  const handleRemoveQuestion = (id: string) => {
    setCustomQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  const handleUpdateQuestion = (id: string, updates: Partial<CustomQuestion>) => {
    setCustomQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...updates } : q))
    )
  }

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    setCustomQuestions((prev) => {
      const next = [...prev]
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= next.length) return prev
      const temp = next[index]
      next[index] = next[targetIndex]
      next[targetIndex] = temp
      return next
    })
  }

  // College years toggle
  const toggleYear = (year: number) => {
    setSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year].sort()
    )
  }

  // Assemble full payload for submission or preview
  const buildPayload = (
    action: 'save_draft' | 'publish'
  ): Omit<EventInsert, 'id' | 'created_at' | 'updated_at'> => {
    const startIso = zonedDatetimeInputToIso(startDate, timezone)
    const endIso = zonedDatetimeInputToIso(endDate, timezone)
    const regStartIso = registrationStart ? zonedDatetimeInputToIso(registrationStart, timezone) : null
    const regCloseIso = registrationClose ? zonedDatetimeInputToIso(registrationClose, timezone) : null
    const finalSlug = initialData?.slug || generateSlug(title)
    let finalPoster = posterUrl.trim()
    if (finalPoster.startsWith('blob:')) {
      const cached =
        (typeof window !== 'undefined' && initialData?.id && localStorage.getItem(`festflow_custom_poster_${initialData.id}`)) ||
        (typeof window !== 'undefined' && finalSlug && localStorage.getItem(`festflow_custom_poster_${finalSlug}`))
      finalPoster = cached || getDefaultPoster(category)
    } else if (!finalPoster) {
      finalPoster = getDefaultPoster(category)
    }

    if (typeof window !== 'undefined') {
      const isCustomPoster = Boolean(
        finalPoster &&
        !finalPoster.startsWith('blob:') &&
        !finalPoster.includes('images.unsplash.com')
      )
      if (isCustomPoster) {
        if (initialData?.id) {
          try { localStorage.setItem(`festflow_custom_poster_${initialData.id}`, finalPoster) } catch {}
        }
        if (finalSlug) {
          try { localStorage.setItem(`festflow_custom_poster_${finalSlug}`, finalPoster) } catch {}
        }
      } else if (finalPoster.includes('images.unsplash.com')) {
        if (initialData?.id) {
          try { localStorage.removeItem(`festflow_custom_poster_${initialData.id}`) } catch {}
        }
        if (finalSlug) {
          try { localStorage.removeItem(`festflow_custom_poster_${finalSlug}`) } catch {}
        }
      }
    }

    const depts = departmentsInput
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean)

    return {
      slug: finalSlug,
      club_id: targetClubId,
      title: title.trim(),
      summary: summary.trim(),
      description: description.trim(),
      category,
      poster_url: finalPoster,
      cover_url: coverUrl.trim() || null,
      start_date: startIso,
      end_date: endIso,
      registration_start_date: regStartIso,
      venue_name: venueName.trim(),
      venue_address: venueAddress.trim() || null,
      event_type: eventType,
      online_meeting_url: onlineMeetingUrl.trim() || null,
      timezone,
      registration_opens_at: regStartIso || new Date().toISOString(),
      registration_closes_at: regCloseIso,
      capacity: Number(capacity) || 1,
      is_free: isFree,
      price: isFree ? 0 : Number(price),
      currency: 'INR',
      eligibility: eligibility.trim() || null,
      rules: rules.trim() || null,
      contact_email: contactEmail.trim() || null,
      contact_phone: contactPhone.trim() || null,
      approval_type: approvalType,
      participation_type: participationType,
      min_team_size: participationType === 'team' ? Number(minTeamSize) : 1,
      max_team_size: participationType === 'team' ? Number(maxTeamSize) : 1,
      leader_counts_towards_size: leaderCountsTowardsSize,
      team_registration_mode: teamRegistrationMode,
      require_team_name: requireTeamName,
      allowed_colleges: null,
      allowed_departments: depts.length > 0 ? depts : null,
      allowed_years: selectedYears.length > 0 ? selectedYears : null,
      custom_questions: customQuestions,
      participant_fields: participantFields,
      waitlist_enabled: waitlistEnabled,
      is_unlisted: isUnlisted,
      registration_mode: registrationMode,
      show_seat_availability: showSeatAvailability,
      page_layout: pageLayout,
      status: action === 'publish' ? 'published' : mode === 'edit' ? status : 'draft',
    }
  }

  const handleSubmit = async (e: FormEvent, action: 'save_draft' | 'publish') => {
    e.preventDefault()

    if (readOnly) {
      return
    }

    if (action === 'publish' && !effectiveCanPublish) {
      setErrors({ title: 'You do not have permission to publish events for this club.' })
      window.scrollTo({ top: 120, behavior: 'smooth' })
      return
    }

    if (!user?.id || !targetClubId) {
      setErrors({ title: 'You must be signed in with an active club workspace to save or publish an event.' })
      window.scrollTo({ top: 120, behavior: 'smooth' })
      return
    }

    if (uploadingPoster) {
      setErrors({ title: 'Please wait a moment while your event banner finishes compressing and uploading.' })
      window.scrollTo({ top: 120, behavior: 'smooth' })
      return
    }

    const payload = buildPayload(action)
    const validation = validateEventConfig(payload, action)

    if (!validation.isValid) {
      setErrors(validation.errors)
      window.scrollTo({ top: 120, behavior: 'smooth' })
      return
    }

    if (!allowAdminStatusEdit && action === 'publish') {
      if (initialData?.status === 'cancelled') {
        setErrors({ title: 'Cancelled events cannot be re-published. Create a new event instead.' })
        window.scrollTo({ top: 120, behavior: 'smooth' })
        return
      }
      const endMs = payload.end_date ? new Date(payload.end_date).getTime() : NaN
      if (!isNaN(endMs) && endMs <= Date.now()) {
        setErrors({ end_date: 'Cannot publish an event whose end date has already passed. Set a future schedule first.' })
        window.scrollTo({ top: 120, behavior: 'smooth' })
        return
      }
    }

    setErrors({})
    await onSubmit(payload, action)
  }

  // Mobile Multi-Step Form Stepper (Steps 1 to 5)
  // Step 1: Basic Information
  // Step 2: Date, Time & Venue
  // Step 3: Poster & Description
  // Step 4: Ticket & Registration Settings
  // Step 5: Review & Publish
  const [mobileStep, setMobileStep] = useState<number>(1)

  const validateMobileStep = (s: number): boolean => {
    if (readOnly) return true
    const newErrors: Record<string, string> = {}
    if (s === 1) {
      if (!title.trim()) newErrors.title = 'Event title is required'
      if (!summary.trim()) newErrors.summary = 'Short summary is required'
    } else if (s === 2) {
      if (!startDate) newErrors.startDate = 'Event start date & time is required'
      if (!endDate) newErrors.endDate = 'Event end date & time is required'
      const startIso = zonedDatetimeInputToIso(startDate, timezone)
      const endIso = zonedDatetimeInputToIso(endDate, timezone)
      if (startIso && endIso && new Date(startIso).getTime() >= new Date(endIso).getTime()) {
        newErrors.endDate = 'End date must be strictly after start date'
      }
      if ((eventType === 'offline' || eventType === 'hybrid') && !venueName.trim()) {
        newErrors.venueName = 'Campus venue name is required'
      }
      if (eventType === 'online' && !onlineMeetingUrl.trim()) {
        newErrors.onlineMeetingUrl = 'Online meeting link is required for virtual sessions'
      }
    } else if (s === 4) {
      if (Number(capacity) < 1) newErrors.capacity = 'Capacity must be at least 1'
      if (!isFree && (Number(price) <= 0 || isNaN(Number(price)))) {
        newErrors.price = 'Ticket price must be greater than 0'
      }
      if (participationType === 'team' && Number(minTeamSize) > Number(maxTeamSize)) {
        newErrors.teamSize = 'Min team size cannot exceed max team size'
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...newErrors }))
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return false
    }
    return true
  }

  const renderPosterSection = () => (
    <div className="flex flex-col gap-4">
      {/* Banner Image Upload */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
          Event Banner Poster <span className="text-[var(--color-text-muted)]">(optional, auto-fallback provided)</span>
        </label>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative w-full sm:w-48 h-28 rounded-xl overflow-hidden bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] shrink-0 flex items-center justify-center">
            {uploadingPoster && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 backdrop-blur-xs text-white">
                <div className="w-5 h-5 border-2 border-[#18CFFC] border-t-transparent rounded-full animate-spin mb-1" />
                <span className="text-[10px] text-[#18CFFC] font-medium">Processing…</span>
              </div>
            )}
            {posterUrl && !previewImgError ? (
              <>
                <img
                  key={posterUrl}
                  src={posterUrl.startsWith('blob:') || posterUrl.startsWith('data:') ? posterUrl : resolvePosterUrl(posterUrl, category)}
                  alt="Banner Preview"
                  className="w-full h-full object-cover"
                  onError={() => {
                    setPreviewImgError(true)
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setPosterUrl('')
                    setCoverUrl('')
                    setPreviewImgError(false)
                  }}
                  className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/60 text-white hover:bg-rose-600 transition-colors"
                  title="Remove custom image"
                >
                  <X size={12} />
                </button>
              </>
            ) : posterUrl && previewImgError ? (
              <div className="flex flex-col items-center justify-center p-2 text-center bg-amber-500/10 h-full w-full">
                <AlertCircle size={18} className="text-amber-400 mb-1" />
                <span className="text-[10px] text-amber-200 font-medium">Image unavailable</span>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (fileInputRef.current) fileInputRef.current.value = ''
                      fileInputRef.current?.click()
                    }}
                    className="text-[10px] text-[#18CFFC] hover:underline font-semibold cursor-pointer"
                  >
                    Upload from device
                  </button>
                  <span className="text-[10px] text-zinc-600">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPosterUrl(getDefaultPoster(category))
                      setCoverUrl('')
                      setPreviewImgError(false)
                    }}
                    className="text-[10px] text-zinc-400 hover:text-white font-medium cursor-pointer"
                  >
                    Use Stock
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 text-[var(--color-text-muted)]">
                <ImageIcon size={22} />
                <span className="text-[10px]">Default Poster</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 flex-1">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (fileInputRef.current) fileInputRef.current.value = ''
                  fileInputRef.current?.click()
                }}
                disabled={uploadingPoster}
                leftIcon={<Upload size={14} />}
                className="min-h-[44px]"
              >
                {uploadingPoster ? 'Compressing & Storing…' : 'Upload Banner (Max 5MB)'}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setPosterUrl(getDefaultPoster(category))
                  setCoverUrl('')
                  setPreviewImgError(false)
                  setPosterError(null)
                }}
                className="px-3 py-2 text-xs text-zinc-400 hover:text-white rounded-lg border border-white/10 hover:border-white/20 transition-colors min-h-[44px]"
              >
                Use {category ? category.toUpperCase() : 'Tech'} Stock Photo
              </button>
            </div>
            {/* Direct Image URL input option */}
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                placeholder="Or paste direct image URL (https://...)"
                value={posterUrl.startsWith('data:') ? '' : posterUrl}
                onChange={(e) => {
                  const val = e.target.value.trim()
                  setPosterUrl(val)
                  setCoverUrl('')
                  setPreviewImgError(false)
                }}
                className="w-full text-xs px-3 py-2 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-white placeholder-zinc-500 focus:outline-none focus:border-[#18CFFC]"
              />
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Supports JPEG, PNG, WEBP up to 5MB. 16:9 ratio recommended. Auto-optimized before upload.
            </p>
            {posterError && <p className="text-xs text-rose-400">{posterError}</p>}
          </div>
        </div>
      </div>

      {/* Panoramic Cover Image URL (Phase 2) */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--color-surface-3)]">
        <div className="flex items-center justify-between">
          <label htmlFor="cover-url" className="text-xs font-semibold text-[var(--color-text-secondary)]">
            Panoramic Cover Banner URL <span className="text-[var(--color-text-muted)]">(optional wide backdrop)</span>
          </label>
          <span className="text-[11px] text-[var(--color-text-muted)]">21:9 or 16:9 ultra-wide banner</span>
        </div>
        <input
          id="cover-url"
          type="url"
          placeholder="https://images.unsplash.com/... or hosted image URL"
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC] outline-none min-h-[44px]"
        />
      </div>
    </div>
  )

  return (
    <>
      <form
        className="flex flex-col gap-6 sm:gap-8 w-full max-w-4xl mx-auto text-left pb-24 md:pb-8"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
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

        {/* ── Mobile Multi-Step Stepper Header (md:hidden) ─────────────────────── */}
        <div className="md:hidden flex flex-col gap-2.5 p-4 rounded-2xl bg-[#0E0E12] border border-white/10 shadow-lg mb-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-gradient-to-tr from-[#18CFFC] to-[#7F1AFB] text-white text-xs font-bold flex items-center justify-center shadow-sm">
                {mobileStep}
              </span>
              <span className="text-xs font-bold text-white font-heading">
                {mobileStep === 1 && '1. Basic Information'}
                {mobileStep === 2 && '2. Date, Time & Venue'}
                {mobileStep === 3 && '3. Poster & Description'}
                {mobileStep === 4 && '4. Tickets & Settings'}
                {mobileStep === 5 && '5. Review & Publish'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-zinc-400">
              Step {mobileStep} of 5
            </span>
          </div>

          {/* Stepper Bar */}
          <div className="grid grid-cols-5 gap-1.5 pt-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  if (s < mobileStep || validateMobileStep(mobileStep)) {
                    setMobileStep(s)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }
                }}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  s === mobileStep
                    ? 'bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] shadow-[0_0_12px_rgba(24,207,252,0.5)]'
                    : s < mobileStep
                    ? 'bg-emerald-400'
                    : 'bg-white/10'
                }`}
                aria-label={`Step ${s}`}
              />
            ))}
          </div>
        </div>

        <fieldset disabled={readOnly} className="flex flex-col gap-6 sm:gap-8 border-0 p-0 m-0 min-w-0">
        {/* ── Section 1: Basic Information & Poster ───────────────────────── */}
        <div className={`${mobileStep === 1 ? 'flex' : 'hidden'} md:flex glass p-6 sm:p-8 rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.08)] flex-col gap-6 shadow-lg`}>
          <div className="flex items-center justify-between pb-4 border-b border-[var(--color-surface-3)]">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-[#18CFFC]/15 text-[#18CFFC]">
                <Sparkles size={18} />
              </span>
              <div>
                <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)]">
                  Event Essentials
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Core information displayed on discover feeds and public badges
                </p>
              </div>
            </div>
            <Badge variant="purple">Step 1</Badge>
          </div>

          {/* Event Title */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="event-title" className="text-xs font-semibold text-[var(--color-text-secondary)]">
              Event Title <span className="text-rose-400">*</span>
            </label>
            <input
              id="event-title"
              type="text"
              placeholder="e.g. National Hackathon 2026: Code for Green"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                if (errors.title) setErrors((prev) => ({ ...prev, title: '' }))
              }}
              className={`w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border transition-all outline-none ${
                errors.title
                  ? 'border-rose-500/80 focus:border-rose-500'
                  : 'border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC]'
              }`}
            />
            {errors.title && <p className="text-xs text-rose-400">{errors.title}</p>}
          </div>

          {/* Category & Slug preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="event-category" className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Category <span className="text-rose-400">*</span>
              </label>
              <select
                id="event-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as EventCategory)}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC] transition-all outline-none cursor-pointer"
              >
                {EVENT_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value} className="bg-[var(--color-surface-1)]">
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Event URL Slug
              </label>
              <div className="px-3.5 py-2.5 rounded-xl text-xs bg-[var(--color-surface-2)]/60 text-[var(--color-text-muted)] border border-[var(--color-surface-3)] font-mono truncate">
                /events/{initialData?.slug || (title ? generateSlug(title) : 'your-event-slug')}
              </div>
            </div>
          </div>

          {/* Short Summary */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="event-summary" className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Short Summary <span className="text-rose-400">*</span>
              </label>
              <span className="text-[11px] text-[var(--color-text-muted)]">
                {summary.length}/140 chars
              </span>
            </div>
            <input
              id="event-summary"
              type="text"
              maxLength={160}
              placeholder="e.g. A 24-hour inter-college hackathon building climate tech solutions with ₹50,000 in prizes."
              value={summary}
              onChange={(e) => {
                setSummary(e.target.value)
                if (errors.summary) setErrors((prev) => ({ ...prev, summary: '' }))
              }}
              className={`w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border transition-all outline-none ${
                errors.summary
                  ? 'border-rose-500/80 focus:border-rose-500'
                  : 'border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC]'
              }`}
            />
            {errors.summary && <p className="text-xs text-rose-400">{errors.summary}</p>}
          </div>

          {/* Banner Image & Cover URL: shown in Section 1 on desktop, in Step 3 on mobile */}
          <div className="hidden md:block">
            {renderPosterSection()}
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[var(--color-surface-3)]">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="contact-email" className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Host Contact Email <span className="text-[var(--color-text-muted)]">(for attendee queries)</span>
              </label>
              <div className="relative">
                <input
                  id="contact-email"
                  type="email"
                  placeholder="club@campus.edu"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 pl-9 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC] outline-none"
                />
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="contact-phone" className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Host Helpline / WhatsApp <span className="text-[var(--color-text-muted)]">(optional)</span>
              </label>
              <div className="relative">
                <input
                  id="contact-phone"
                  type="text"
                  placeholder="+91 98765 43210"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 pl-9 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC] outline-none"
                />
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 2: Format & Location ─────────────────────────────────── */}
        <div className={`${mobileStep === 2 ? 'flex' : 'hidden'} md:flex glass p-6 sm:p-8 rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.08)] flex-col gap-6 shadow-lg`}>
          <div className="flex items-center justify-between pb-4 border-b border-[var(--color-surface-3)]">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400">
                <MapPin size={18} />
              </span>
              <div>
                <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)]">
                  Format & Venue
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Define whether attendees join on campus, online, or a hybrid of both
                </p>
              </div>
            </div>
            <Badge variant="cyan">Step 2</Badge>
          </div>

          {/* Event Type Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { type: 'offline' as EventType, label: 'In-Person (Campus)', desc: 'Held at a physical campus auditorium or hall', icon: Building },
              { type: 'online' as EventType, label: 'Virtual (Online)', desc: 'Streamed via Google Meet, Zoom, or Discord', icon: Globe },
              { type: 'hybrid' as EventType, label: 'Hybrid', desc: 'Simultaneous on-campus seating and live stream', icon: Layers },
            ].map(({ type, label, desc, icon: Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setEventType(type)
                  if (errors.venue_name || errors.online_meeting_url) {
                    setErrors((prev) => ({ ...prev, venue_name: '', online_meeting_url: '' }))
                  }
                }}
                className={`p-4 rounded-2xl border text-left flex flex-col gap-2 transition-all ${
                  eventType === type
                    ? 'border-[#18CFFC] bg-[#18CFFC]/10 shadow-lg'
                    : 'border-[var(--color-surface-3)] bg-[var(--color-surface-2)]/60 hover:bg-[var(--color-surface-2)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Icon size={18} className={eventType === type ? 'text-[#18CFFC]' : 'text-[var(--color-text-muted)]'} />
                  {eventType === type && <CheckCircle2 size={16} className="text-[#18CFFC]" />}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--color-text-primary)]">{label}</h4>
                  <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed mt-0.5">{desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* In-Person / Hybrid Venue Fields */}
          {(eventType === 'offline' || eventType === 'hybrid') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="venue-name" className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Campus Venue / Hall Name <span className="text-rose-400">*</span>
                </label>
                <input
                  id="venue-name"
                  type="text"
                  placeholder="e.g. Dr. APJ Abdul Kalam Auditorium, Block 3"
                  value={venueName}
                  onChange={(e) => {
                    setVenueName(e.target.value)
                    if (errors.venue_name) setErrors((prev) => ({ ...prev, venue_name: '' }))
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border transition-all outline-none ${
                    errors.venue_name
                      ? 'border-rose-500/80 focus:border-rose-500'
                      : 'border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC]'
                  }`}
                />
                {errors.venue_name && <p className="text-xs text-rose-400">{errors.venue_name}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="venue-address" className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Campus Address / Landmark <span className="text-[var(--color-text-muted)]">(optional)</span>
                </label>
                <input
                  id="venue-address"
                  type="text"
                  placeholder="e.g. South Campus Gate, Main University Road"
                  value={venueAddress}
                  onChange={(e) => setVenueAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC] outline-none"
                />
              </div>
            </div>
          )}

          {/* Virtual / Hybrid Online Link Fields */}
          {(eventType === 'online' || eventType === 'hybrid') && (
            <div className="flex flex-col gap-1.5 pt-2">
              <label htmlFor="online-meeting-url" className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Online Platform Link / Instructions <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  id="online-meeting-url"
                  type="text"
                  placeholder="e.g. https://meet.google.com/xyz-abc or Discord: https://discord.gg/..."
                  value={onlineMeetingUrl}
                  onChange={(e) => {
                    setOnlineMeetingUrl(e.target.value)
                    if (errors.online_meeting_url) setErrors((prev) => ({ ...prev, online_meeting_url: '' }))
                  }}
                  className={`w-full px-3.5 py-2.5 pl-9 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border transition-all outline-none ${
                    errors.online_meeting_url
                      ? 'border-rose-500/80 focus:border-rose-500'
                      : 'border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC]'
                  }`}
                />
                <ExternalLink size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Privacy safeguard: Only verified registered attendees receive the direct joining URL on their digital pass.
              </p>
              {errors.online_meeting_url && <p className="text-xs text-rose-400">{errors.online_meeting_url}</p>}
            </div>
          )}
        </div>

        {/* ── Section 3: Schedule, Timezone & Deadlines ────────────────────── */}
        <div className={`${mobileStep === 2 ? 'flex' : 'hidden'} md:flex glass p-6 sm:p-8 rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.08)] flex-col gap-6 shadow-lg`}>
          <div className="flex items-center justify-between pb-4 border-b border-[var(--color-surface-3)]">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
                <Calendar size={18} />
              </span>
              <div>
                <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)]">
                  Date, Time & Timezone
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Event schedule and attendee registration cut-off
                </p>
              </div>
            </div>
            <Badge variant="amber">Step 3</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Start Date & Time */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="start-date" className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Event Starts <span className="text-rose-400">*</span>
              </label>
              <input
                id="start-date"
                type="datetime-local"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  if (errors.start_date || errors.end_date) {
                    setErrors((prev) => ({ ...prev, start_date: '', end_date: '' }))
                  }
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border transition-all outline-none ${
                  errors.start_date
                    ? 'border-rose-500/80 focus:border-rose-500'
                    : 'border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC]'
                }`}
              />
              {errors.start_date && <p className="text-xs text-rose-400">{errors.start_date}</p>}
            </div>

            {/* End Date & Time */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="end-date" className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Event Ends <span className="text-rose-400">*</span>
              </label>
              <input
                id="end-date"
                type="datetime-local"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  if (errors.end_date) setErrors((prev) => ({ ...prev, end_date: '' }))
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border transition-all outline-none ${
                  errors.end_date
                    ? 'border-rose-500/80 focus:border-rose-500'
                    : 'border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC]'
                }`}
              />
              {errors.end_date && <p className="text-xs text-rose-400">{errors.end_date}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Timezone Selector */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="timezone-select" className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Event Timezone
              </label>
              <select
                id="timezone-select"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC] outline-none"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value} className="bg-[var(--color-surface-1)]">
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Registration Opening */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-start" className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Registration Opens <span className="text-[var(--color-text-muted)]">(optional launch)</span>
              </label>
              <input
                id="reg-start"
                type="datetime-local"
                value={registrationStart}
                onChange={(e) => setRegistrationStart(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC] outline-none"
              />
            </div>

            {/* Registration Deadline */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-close" className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Registration Deadline <span className="text-[var(--color-text-muted)]">(optional cut-off)</span>
              </label>
              <input
                id="reg-close"
                type="datetime-local"
                value={registrationClose}
                onChange={(e) => {
                  setRegistrationClose(e.target.value)
                  if (errors.registration_closes_at) {
                    setErrors((prev) => ({ ...prev, registration_closes_at: '' }))
                  }
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border transition-all outline-none ${
                  errors.registration_closes_at
                    ? 'border-rose-500/80 focus:border-rose-500'
                    : 'border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC]'
                }`}
              />
              {errors.registration_closes_at && (
                <p className="text-xs text-rose-400">{errors.registration_closes_at}</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 4: Participation & Team Configuration ───────────────── */}
        <div className={`${mobileStep === 4 ? 'flex' : 'hidden'} md:flex glass p-6 sm:p-8 rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.08)] flex-col gap-6 shadow-lg`}>
          <div className="flex items-center justify-between pb-4 border-b border-[var(--color-surface-3)]">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-[#ED47FC]/15 text-[#ED47FC]">
                <Users size={18} />
              </span>
              <div>
                <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)]">
                  Participation & Team Rules
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Configure whether students join individually or as collaborative teams
                </p>
              </div>
            </div>
            <Badge variant="magenta">Step 4</Badge>
          </div>

          {/* Mode Switcher */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setParticipationType('individual')
                if (errors.min_team_size || errors.max_team_size) {
                  setErrors((prev) => ({ ...prev, min_team_size: '', max_team_size: '' }))
                }
              }}
              className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                participationType === 'individual'
                  ? 'border-[#18CFFC] bg-[#18CFFC]/10 shadow-lg'
                  : 'border-[var(--color-surface-3)] bg-[var(--color-surface-2)]/60 hover:bg-[var(--color-surface-2)]'
              }`}
            >
              <div className="p-2 rounded-xl bg-[var(--color-surface-3)] shrink-0">
                <Users size={18} className="text-[var(--color-text-muted)]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[var(--color-text-primary)]">Solo / Individual</h4>
                  {participationType === 'individual' && <CheckCircle2 size={16} className="text-[#18CFFC]" />}
                </div>
                <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                  Each participant registers individually and receives a dedicated digital QR entry pass.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setParticipationType('team')}
              className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                participationType === 'team'
                  ? 'border-[#ED47FC] bg-[#ED47FC]/10 shadow-lg'
                  : 'border-[var(--color-surface-3)] bg-[var(--color-surface-2)]/60 hover:bg-[var(--color-surface-2)]'
              }`}
            >
              <div className="p-2 rounded-xl bg-[var(--color-surface-3)] shrink-0">
                <Users size={18} className="text-[#ED47FC]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[var(--color-text-primary)]">Team / Group</h4>
                  {participationType === 'team' && <CheckCircle2 size={16} className="text-[#ED47FC]" />}
                </div>
                <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                  Hackathons, sports, quizzes, or group challenges requiring multiple participants per unit.
                </p>
              </div>
            </button>
          </div>

          {/* Team Configuration Detailed Controls */}
          {participationType === 'team' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-5 rounded-2xl bg-[#ED47FC]/[0.04] border border-[#ED47FC]/20 flex flex-col gap-5"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-[#ED47FC] uppercase tracking-wider">
                <Sliders size={14} /> Team Roster & Size Limits
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="min-team-size" className="text-xs font-semibold text-[var(--color-text-secondary)]">
                    Minimum Team Size <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="min-team-size"
                    type="number"
                    min="1"
                    max="50"
                    value={minTeamSize}
                    onChange={(e) => {
                      setMinTeamSize(Number(e.target.value))
                      if (errors.min_team_size || errors.max_team_size) {
                        setErrors((prev) => ({ ...prev, min_team_size: '', max_team_size: '' }))
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)] focus:border-[#ED47FC] outline-none"
                  />
                  {errors.min_team_size && <p className="text-xs text-rose-400">{errors.min_team_size}</p>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="max-team-size" className="text-xs font-semibold text-[var(--color-text-secondary)]">
                    Maximum Team Size <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="max-team-size"
                    type="number"
                    min={minTeamSize}
                    max="50"
                    value={maxTeamSize}
                    onChange={(e) => {
                      setMaxTeamSize(Number(e.target.value))
                      if (errors.max_team_size) setErrors((prev) => ({ ...prev, max_team_size: '' }))
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)] focus:border-[#ED47FC] outline-none"
                  />
                  {errors.max_team_size && <p className="text-xs text-rose-400">{errors.max_team_size}</p>}
                </div>
              </div>

              {/* Explicit Leader Count Switch */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)]">
                <div>
                  <h5 className="text-xs font-bold text-[var(--color-text-primary)]">
                    Team Leader counts toward the team size
                  </h5>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    {leaderCountsTowardsSize
                      ? `Yes: A team of ${minTeamSize}-${maxTeamSize} includes the leader plus ${Math.max(0, minTeamSize - 1)}-${Math.max(0, maxTeamSize - 1)} members.`
                      : `No: The leader is separate, requiring ${minTeamSize}-${maxTeamSize} additional team members.`}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={leaderCountsTowardsSize}
                  onChange={(e) => setLeaderCountsTowardsSize(e.target.checked)}
                  className="w-4 h-4 rounded text-[#ED47FC] focus:ring-[#ED47FC] cursor-pointer"
                />
              </div>

              {/* Team Registration Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] cursor-pointer">
                  <input
                    type="radio"
                    name="team_reg_mode"
                    checked={teamRegistrationMode === 'leader_adds_members'}
                    onChange={() => setTeamRegistrationMode('leader_adds_members')}
                    className="mt-0.5 text-[#ED47FC] focus:ring-[#ED47FC]"
                  />
                  <div className="text-xs">
                    <strong className="text-[var(--color-text-primary)] block">Leader adds members</strong>
                    <span className="text-[11px] text-[var(--color-text-muted)]">
                      The leader enters teammate names & emails during registration.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] cursor-pointer">
                  <input
                    type="radio"
                    name="team_reg_mode"
                    checked={teamRegistrationMode === 'members_join_with_code'}
                    onChange={() => setTeamRegistrationMode('members_join_with_code')}
                    className="mt-0.5 text-[#ED47FC] focus:ring-[#ED47FC]"
                  />
                  <div className="text-xs">
                    <strong className="text-[var(--color-text-primary)] block">Members join with team code</strong>
                    <span className="text-[11px] text-[var(--color-text-muted)]">
                      Leader creates the team and shares a secure join code with teammates.
                    </span>
                  </div>
                </label>
              </div>

              {/* Require Team Name */}
              <label className="flex items-center gap-2.5 text-xs text-[var(--color-text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireTeamName}
                  onChange={(e) => setRequireTeamName(e.target.checked)}
                  className="w-4 h-4 rounded text-[#ED47FC] focus:ring-[#ED47FC] cursor-pointer"
                />
                <span>Mandatory Team Name (e.g. "ByteKnights", "RoboTech Alpha")</span>
              </label>
            </motion.div>
          )}

          {/* Standard Required Attendee Fields */}
          <div className="flex flex-col gap-3 pt-2 border-t border-[var(--color-surface-3)]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Participant Information to Collect
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <label className="flex items-center gap-2 p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={participantFields.require_college}
                  onChange={(e) =>
                    setParticipantFields((prev) => ({ ...prev, require_college: e.target.checked }))
                  }
                  className="rounded text-[#18CFFC] focus:ring-[#18CFFC]"
                />
                <span className="text-[var(--color-text-primary)]">College Name</span>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={participantFields.require_phone}
                  onChange={(e) =>
                    setParticipantFields((prev) => ({ ...prev, require_phone: e.target.checked }))
                  }
                  className="rounded text-[#18CFFC] focus:ring-[#18CFFC]"
                />
                <span className="text-[var(--color-text-primary)]">Phone Number</span>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={participantFields.require_grad_year}
                  onChange={(e) =>
                    setParticipantFields((prev) => ({ ...prev, require_grad_year: e.target.checked }))
                  }
                  className="rounded text-[#18CFFC] focus:ring-[#18CFFC]"
                />
                <span className="text-[var(--color-text-primary)]">Graduation Year</span>
              </label>

              <label className="flex items-center gap-2 p-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={participantFields.require_id_card}
                  onChange={(e) =>
                    setParticipantFields((prev) => ({ ...prev, require_id_card: e.target.checked }))
                  }
                  className="rounded text-[#18CFFC] focus:ring-[#18CFFC]"
                />
                <span className="text-[var(--color-text-primary)]">Student ID Number</span>
              </label>
            </div>
          </div>
        </div>

        {/* ── Section 5: Capacity, Pricing & Approval ──────────────────────── */}
        <div className={`${mobileStep === 4 ? 'flex' : 'hidden'} md:flex glass p-6 sm:p-8 rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.08)] flex-col gap-6 shadow-lg`}>
          <div className="flex items-center justify-between pb-4 border-b border-[var(--color-surface-3)]">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                <IndianRupee size={18} />
              </span>
              <div>
                <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)]">
                  Capacity & Ticketing Fee
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Set seat limits, choose between free admission or club UPI fee
                </p>
              </div>
            </div>
            <Badge variant="success">Step 5</Badge>
          </div>

          {/* Seating & Registration Mode Selection */}
          <div className="flex flex-col gap-2 p-4 rounded-2xl bg-[var(--color-surface-2)]/60 border border-[var(--color-surface-3)]">
            <label className="text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-2">
              <LayoutGrid size={15} className="text-[#18CFFC]" />
              Seating & Admission Model
            </label>
            <p className="text-xs text-[var(--color-text-muted)]">
              Choose standard open admission or cinema-style reserved seating with an interactive map.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
              <button
                type="button"
                onClick={() => setRegistrationMode('standard')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  registrationMode === 'standard'
                    ? 'border-[#18CFFC] bg-[#18CFFC]/10 shadow-sm'
                    : 'border-[var(--color-surface-3)] bg-[var(--color-surface-2)] hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--color-text-primary)]">Standard Open Admission</span>
                  {registrationMode === 'standard' && <CheckCircle2 size={16} className="text-[#18CFFC]" />}
                </div>
                <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                  General registration queue, standard passes, open or unallocated venue seating.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRegistrationMode('reserved_seating')}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  registrationMode === 'reserved_seating'
                    ? 'border-[#18CFFC] bg-[#18CFFC]/10 shadow-sm'
                    : 'border-[var(--color-surface-3)] bg-[var(--color-surface-2)] hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--color-text-primary)]">Cinema-Style Reserved Seating</span>
                  {registrationMode === 'reserved_seating' && <CheckCircle2 size={16} className="text-[#18CFFC]" />}
                </div>
                <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                  Interactive seat map, tier-based seat pricing, real-time availability, and hold timer.
                </p>
              </button>
            </div>

            {registrationMode === 'reserved_seating' && (initialData as any)?.id && (
              <div className="mt-2 flex items-center justify-between p-3 rounded-xl bg-[#18CFFC]/10 border border-[#18CFFC]/30 text-xs">
                <span className="text-[#18CFFC] font-medium">Layout configuration is available for this event.</span>
                <a
                  href={`/club/events/${(initialData as any).id}/seats`}
                  className="inline-flex items-center gap-1 font-semibold text-white underline hover:text-[#18CFFC]"
                >
                  Open Seat Editor →
                </a>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Capacity Input */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="event-capacity" className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Total Capacity ({participationType === 'team' ? 'Teams' : 'Attendees'}) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  id="event-capacity"
                  type="number"
                  min="1"
                  max="100000"
                  placeholder="e.g. 150"
                  value={capacity}
                  onChange={(e) => {
                    setCapacity(e.target.value)
                    if (errors.capacity) setErrors((prev) => ({ ...prev, capacity: '' }))
                  }}
                  className={`w-full px-3.5 py-2.5 pl-9 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border transition-all outline-none ${
                    errors.capacity
                      ? 'border-rose-500/80 focus:border-rose-500'
                      : 'border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC]'
                  }`}
                />
                <Users size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              </div>
              {errors.capacity && <p className="text-xs text-rose-400">{errors.capacity}</p>}
            </div>

            {/* Approval Type */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="approval-type" className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Registration Approval Mode
              </label>
              <select
                id="approval-type"
                value={approvalType}
                onChange={(e) => setApprovalType(e.target.value as ApprovalType)}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC] outline-none cursor-pointer"
              >
                <option value="automatic" className="bg-[var(--color-surface-1)]">
                  Automatic (Instant ticket upon submit/payment)
                </option>
                <option value="manual" className="bg-[var(--color-surface-1)]">
                  Manual Review (Organizer must approve before ticket issue)
                </option>
              </select>
            </div>
          </div>

          {/* Show Seat Availability Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)]">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
                <Users size={14} className="text-[#18CFFC]" />
                Show Seat Availability to Participants
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)]">
                Display live remaining seats ("N left of M") and capacity fill bar. When disabled, the seat counting is completely hidden from participants and attendees.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
              <input
                type="checkbox"
                checked={showSeatAvailability}
                onChange={(e) => setShowSeatAvailability(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[var(--color-surface-3)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#18CFFC]"></div>
            </label>
          </div>

          {/* Pricing Toggle */}
          <div className="flex flex-col gap-3 pt-2 border-t border-[var(--color-surface-3)]">
            <label className="text-xs font-semibold text-[var(--color-text-secondary)]">
              Admission Pricing <span className="text-rose-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsFree(true)
                  setPrice(0)
                  if (errors.price) setErrors((prev) => ({ ...prev, price: '' }))
                }}
                className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all ${
                  isFree
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-sm'
                    : 'border-[var(--color-surface-3)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                Free Admission (₹0)
              </button>
              <button
                type="button"
                onClick={() => setIsFree(false)}
                className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all ${
                  !isFree
                    ? 'border-[#18CFFC] bg-[#18CFFC]/10 text-[#18CFFC] shadow-sm'
                    : 'border-[var(--color-surface-3)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                Paid Ticket (Direct UPI)
              </button>
            </div>

            {!isFree && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex flex-col gap-1.5 pt-1"
              >
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
                        : 'border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC]'
                    }`}
                  />
                  <IndianRupee size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  100% of ticket fees are paid directly to your club's registered UPI ID. Zero platform commission.
                </p>
                {errors.price && <p className="text-xs text-rose-400">{errors.price}</p>}
              </motion.div>
            )}
          </div>

          {/* Waitlist Toggle (Phase 2) */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)]">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                Automated Waitlist Queue
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)]">
                Allow students to join a waitlist when capacity is reached, with instant auto-promotion on cancellations.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={waitlistEnabled}
                onChange={(e) => setWaitlistEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[var(--color-surface-3)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#18CFFC]"></div>
            </label>
          </div>

          {/* Unlisted Visibility Toggle (Phase 2) */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)]">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
                <EyeOff size={14} className="text-[#7F1AFB]" />
                Unlisted Event (Direct Link Only)
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)]">
                Hide this event from the public Discover directory. Only students with the link can view & register.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isUnlisted}
                onChange={(e) => setIsUnlisted(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[var(--color-surface-3)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#7F1AFB]"></div>
            </label>
          </div>

          {/* Event Status Selector for Edit Mode */}
          {mode === 'edit' && (
            <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--color-surface-3)]">
              <label htmlFor="event-status" className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Lifecycle State
              </label>
              <select
                id="event-status"
                value={status}
                disabled={readOnly}
                onChange={(e) => setStatus(e.target.value as EventStatus)}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC] outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="draft" disabled={!allowAdminStatusEdit && (initialData?.status === 'cancelled' || initialData?.status === 'completed')}>
                  Draft (Hidden from discover)
                </option>
                <option value="published" disabled={!allowAdminStatusEdit && (initialData?.status === 'cancelled' || initialData?.status === 'completed')}>
                  Published (Discoverable & open for registration)
                </option>
                <option value="registration_closed" disabled={!allowAdminStatusEdit && (initialData?.status === 'cancelled' || initialData?.status === 'completed')}>
                  Registration Closed (Visible, but registrations locked)
                </option>
                <option value="completed">Completed (Event has concluded)</option>
                <option value="cancelled">Cancelled (Void tickets)</option>
              </select>
            </div>
          )}
        </div>

        {/* ── Section 6: Custom Registration Questions Form Builder ────────── */}
        <div className={`${mobileStep === 4 ? 'flex' : 'hidden'} md:flex glass p-6 sm:p-8 rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.08)] flex-col gap-6 shadow-lg`}>
          <div className="flex items-center justify-between pb-4 border-b border-[var(--color-surface-3)]">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-[#7F1AFB]/15 text-[#C084FC]">
                <ListPlus size={18} />
              </span>
              <div>
                <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)]">
                  Custom Registration Questions
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Collect event-specific attendee responses (e.g. T-shirt sizes, GitHub profile, dietary needs)
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddQuestion}
              leftIcon={<Plus size={14} />}
            >
              Add Question
            </Button>
          </div>

          {customQuestions.length === 0 ? (
            <div className="py-8 text-center flex flex-col items-center justify-center border border-dashed border-[var(--color-surface-3)] rounded-2xl p-6">
              <HelpCircle size={28} className="text-[var(--color-text-muted)] mb-2 opacity-50" />
              <p className="text-xs text-[var(--color-text-secondary)] font-medium">
                No custom questions configured
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)] max-w-sm mt-0.5">
                Students will only be asked for standard attendee information (name, email, college, phone). Click "Add Question" to customize.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {customQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  className="p-4 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-[var(--color-text-primary)]">
                      Question #{idx + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveQuestion(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title="Move question up"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveQuestion(idx, 'down')}
                        disabled={idx === customQuestions.length - 1}
                        className="p-1 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title="Move question down"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(q.id)}
                        className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Remove question"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 flex flex-col gap-1">
                      <label className="text-[11px] text-[var(--color-text-muted)]">Prompt / Title *</label>
                      <input
                        type="text"
                        placeholder="e.g. GitHub Profile URL or Dietary Preference"
                        value={q.label}
                        onChange={(e) => handleUpdateQuestion(q.id, { label: e.target.value })}
                        className="px-3 py-2 rounded-xl text-xs bg-[var(--color-surface-1)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC] outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-[var(--color-text-muted)]">Response Type</label>
                      <select
                        value={q.type}
                        onChange={(e) => {
                          const newType = e.target.value as CustomQuestionType
                          handleUpdateQuestion(q.id, {
                            type: newType,
                            options:
                              newType === 'select' || newType === 'radio' || newType === 'multiselect'
                                ? q.options && q.options.length > 0
                                  ? q.options
                                  : ['Option 1', 'Option 2']
                                : undefined,
                          })
                        }}
                        className="px-3 py-2 rounded-xl text-xs bg-[var(--color-surface-1)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC] outline-none"
                      >
                        <option value="text">Short Text</option>
                        <option value="textarea">Paragraph Text</option>
                        <option value="email">Email Address</option>
                        <option value="phone">Phone Number</option>
                        <option value="number">Numeric Value</option>
                        <option value="select">Dropdown Select</option>
                        <option value="radio">Multiple Choice (Radio)</option>
                        <option value="multiselect">Multi-Select Checkboxes</option>
                        <option value="checkbox">Single Checkbox (Yes/No)</option>
                        <option value="date">Date Picker</option>
                        <option value="file">File / Document Link</option>
                      </select>
                    </div>
                  </div>

                  {/* Options editor for Select / Radio / Multiselect */}
                  {(q.type === 'select' || q.type === 'radio' || q.type === 'multiselect') && (
                    <div className="flex flex-col gap-1.5 pt-1">
                      <label className="text-[11px] text-[var(--color-text-muted)]">
                        Options (comma-separated, at least 2)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Vegetarian, Vegan, Non-Vegetarian"
                        value={q.options ? q.options.join(', ') : ''}
                        onChange={(e) =>
                          handleUpdateQuestion(q.id, {
                            options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean),
                          })
                        }
                        className="px-3 py-2 rounded-xl text-xs bg-[var(--color-surface-1)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC] outline-none"
                      />
                    </div>
                  )}

                  {/* Placeholder input for text types */}
                  {(q.type === 'text' || q.type === 'textarea' || q.type === 'email' || q.type === 'phone' || q.type === 'number' || q.type === 'file') && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-[var(--color-text-muted)]">Placeholder Text (optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. https://github.com/username or your answer here"
                        value={q.placeholder || ''}
                        onChange={(e) => handleUpdateQuestion(q.id, { placeholder: e.target.value })}
                        className="px-3 py-2 rounded-xl text-xs bg-[var(--color-surface-1)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC] outline-none"
                      />
                    </div>
                  )}

                  {/* Required Toggle */}
                  <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={(e) => handleUpdateQuestion(q.id, { required: e.target.checked })}
                      className="rounded text-[#18CFFC] focus:ring-[#18CFFC]"
                    />
                    <span>Required for registration submission</span>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Step 3 Mobile Poster Card */}
        <div className={`${mobileStep === 3 ? 'flex' : 'hidden'} md:hidden glass p-5 rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.08)] flex-col gap-4 shadow-lg`}>
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-surface-3)]">
            <span className="p-2 rounded-xl bg-[#ED47FC]/15 text-[#ED47FC]">
              <ImageIcon size={18} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white font-heading">Event Media & Poster</h3>
              <p className="text-[11px] text-zinc-400">Visual artwork for discover feeds and digital passes</p>
            </div>
          </div>
          {renderPosterSection()}
        </div>

        {/* ── Section 7: Description, Rules & Guidelines ───────────────────── */}
        <div className={`${mobileStep === 3 ? 'flex' : 'hidden'} md:flex glass p-6 sm:p-8 rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.08)] flex-col gap-6 shadow-lg`}>
          <div className="flex items-center justify-between pb-4 border-b border-[var(--color-surface-3)]">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-[#7F1AFB]/15 text-[#C084FC]">
                <FileText size={18} />
              </span>
              <div>
                <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)]">
                  Description, Rules & Eligibility
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Provide detailed event briefing, code of conduct, and academic constraints
                </p>
              </div>
            </div>
            <Badge variant="purple">Step 7</Badge>
          </div>

          {/* Full Description */}
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
              rows={7}
              placeholder="Introduce the event agenda, keynote speakers, prize breakdown, prerequisites, and timeline..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                if (errors.description) setErrors((prev) => ({ ...prev, description: '' }))
              }}
              className={`w-full p-4 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border transition-all outline-none font-sans leading-relaxed ${
                errors.description
                  ? 'border-rose-500/80 focus:border-rose-500'
                  : 'border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC]'
              }`}
            />
            {errors.description && <p className="text-xs text-rose-400">{errors.description}</p>}
          </div>

          {/* Rules and Guidelines */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="event-rules" className="text-xs font-semibold text-[var(--color-text-secondary)]">
              Rules & Code of Conduct <span className="text-[var(--color-text-muted)]">(optional)</span>
            </label>
            <textarea
              id="event-rules"
              rows={4}
              placeholder="e.g. 1. Teams must check in 15 minutes before the hackathon kickoff.&#10;2. Plagiarism or pre-built code is strictly prohibited.&#10;3. Hardware kits must be returned intact."
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              className="w-full p-3.5 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC] outline-none"
            />
          </div>

          {/* Eligibility & Restrictions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="event-eligibility" className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Eligibility Note <span className="text-[var(--color-text-muted)]">(optional)</span>
              </label>
              <input
                id="event-eligibility"
                type="text"
                placeholder="e.g. Open to all UG & PG college students across India"
                value={eligibility}
                onChange={(e) => setEligibility(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC] outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="event-departments" className="text-xs font-semibold text-[var(--color-text-secondary)]">
                Allowed Departments <span className="text-[var(--color-text-muted)]">(comma-separated)</span>
              </label>
              <input
                id="event-departments"
                type="text"
                placeholder="e.g. Computer Science, IT, Electronics"
                value={departmentsInput}
                onChange={(e) => setDepartmentsInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)] focus:border-[#18CFFC] focus:ring-1 focus:ring-[#18CFFC] outline-none"
              />
            </div>
          </div>

          {/* Academic Years Allowed */}
          <div className="flex flex-col gap-2 pt-2">
            <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
              Eligible Academic Years <span className="text-[var(--color-text-muted)]">(Leave empty if open to all years)</span>
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {[1, 2, 3, 4, 5].map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => toggleYear(year)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    selectedYears.includes(year)
                      ? 'border-[#18CFFC] bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] text-white shadow-sm'
                      : 'border-[var(--color-surface-3)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  Year {year}
                </button>
              ))}
              {selectedYears.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedYears([])}
                  className="text-xs text-[var(--color-text-muted)] hover:text-rose-400 underline ml-2"
                >
                  Clear restriction
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 8: Interactive Event Page Customizer (Drag & Drop) ────── */}
        <div className={`${mobileStep === 4 ? 'flex' : 'hidden'} md:flex glass p-6 sm:p-8 rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.08)] flex-col gap-6 shadow-lg`}>
          <div className="flex items-center justify-between pb-4 border-b border-[var(--color-surface-3)]">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-[#18CFFC]/15 text-[#18CFFC]">
                <Layout size={18} />
              </span>
              <div>
                <h2 className="text-lg font-bold font-display text-[var(--color-text-primary)]">
                  Event Page Layout & Content Customizer
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Reorder, toggle visibility, and customize content blocks for the public event landing page
                </p>
              </div>
            </div>
            <Badge variant="cyan">Step 8</Badge>
          </div>

          <EventPageBuilder layout={pageLayout} onChange={setPageLayout} />
        </div>

        {/* ── Step 5: Mobile Review & Publish Screen (md:hidden) ─────────── */}
        {mobileStep === 5 && (
          <div className="md:hidden flex flex-col gap-4">
            <div className="glass p-5 rounded-2xl border border-white/10 flex flex-col gap-4 shadow-xl">
              <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#18CFFC] to-[#7F1AFB] flex items-center justify-center text-white shrink-0 shadow-md">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white font-heading">Review & Publish Event</h3>
                  <p className="text-[11px] text-zinc-400">Verify your event setup before making it live to campus.</p>
                </div>
              </div>

              {/* Event Summary Preview Card */}
              <div className="rounded-xl overflow-hidden border border-white/10 bg-[#08080A]">
                <div className="relative h-36 w-full bg-zinc-900">
                  <img
                    src={posterUrl || getDefaultPoster(category)}
                    alt={title || 'Event poster'}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 flex gap-1">
                    <Badge variant="purple" className="text-[10px]">{category.toUpperCase()}</Badge>
                    <Badge variant="cyan" className="text-[10px]">{eventType.toUpperCase()}</Badge>
                  </div>
                  <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md text-xs font-bold text-white shadow-md">
                    {isFree ? <span className="text-emerald-400">Free Pass</span> : `₹${price}`}
                  </div>
                </div>

                <div className="p-4 space-y-2.5">
                  <h4 className="text-sm font-bold text-white font-heading">{title || 'Untitled Event'}</h4>
                  <p className="text-xs text-zinc-400 line-clamp-2">{summary || 'No summary provided.'}</p>

                  <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2 text-[11px] text-zinc-300 font-sans">
                    <div>
                      <span className="text-zinc-500 block text-[10px] uppercase font-bold">Start Date</span>
                      <span>{startDate ? new Date(startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Not set'}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[10px] uppercase font-bold">Venue</span>
                      <span className="truncate block">{eventType === 'online' ? (onlineMeetingUrl || 'Virtual URL') : (venueName || 'Campus Venue')}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[10px] uppercase font-bold">Format</span>
                      <span>{participationType === 'team' ? `Squad (${minTeamSize}–${maxTeamSize})` : 'Individual Solo'}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[10px] uppercase font-bold">Capacity</span>
                      <span>{capacity} Seats</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pre-flight Validation Checklist */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2 text-xs">
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">Pre-flight Checklist</span>
                <div className="flex items-center gap-2">
                  {title.trim() && summary.trim() ? (
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle size={14} className="text-rose-400 shrink-0" />
                  )}
                  <span className={title.trim() && summary.trim() ? 'text-zinc-300' : 'text-rose-400 font-semibold'}>
                    Title & Short Summary
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {startDate && endDate ? (
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle size={14} className="text-rose-400 shrink-0" />
                  )}
                  <span className={startDate && endDate ? 'text-zinc-300' : 'text-rose-400 font-semibold'}>
                    Schedule & Timeframe
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {(eventType === 'online' && onlineMeetingUrl) || ((eventType === 'offline' || eventType === 'hybrid') && venueName.trim()) ? (
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle size={14} className="text-amber-400 shrink-0" />
                  )}
                  <span className="text-zinc-300">Venue & Access Link</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <span className="text-zinc-300">
                    Ticketing: {isFree ? 'Free Campus Admission' : `₹${price} UPI Fee`} ({capacity} max)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        </fieldset>

        {/* ── Form Actions Bar (Desktop Sticky) ─────────────────────────────── */}
        <div className="hidden md:flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl glass border border-[oklch(100%_0_0_/_0.1)] sticky bottom-4 shadow-2xl z-20 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            {readOnly ? (
              <Lock size={16} className="text-zinc-400 shrink-0" />
            ) : (
              <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
            )}
            <span className="text-[11px] sm:text-xs">
              {readOnly
                ? 'Archive Mode (Read-Only): Concluded or cancelled event details cannot be edited by clubs.'
                : mode === 'create'
                ? 'Drafts are private to your club. Publishing makes the event discoverable immediately.'
                : 'Updates are validated and saved directly.'}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-2.5 w-full sm:w-auto">
            {/* Live Preview Button */}
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setShowPreview(true)}
              leftIcon={<Eye size={15} />}
              className="flex-1 sm:flex-initial min-h-[44px] justify-center"
            >
              Preview
            </Button>

            {!readOnly && (
              <>
                {/* Save Draft Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={(e) => handleSubmit(e, 'save_draft')}
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-initial min-h-[44px] justify-center"
                >
                  {mode === 'edit' && !effectiveCanPublish ? 'Save Changes' : 'Save Draft'}
                </Button>

                {/* Final Publish Button */}
                {effectiveCanPublish && (
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={(e) => handleSubmit(e, 'publish')}
                    disabled={isSubmitting}
                    isLoading={isSubmitting}
                    leftIcon={<CheckCircle2 size={16} />}
                    className="bg-gradient-to-r from-[#18CFFC] via-[#07A4FC] to-[#7F1AFB] hover:brightness-110 text-white font-semibold shadow-[0_4px_16px_rgba(24,207,252,0.3)] w-full sm:w-auto min-h-[44px] justify-center"
                  >
                    {mode === 'create' ? 'Publish Event' : 'Update & Publish'}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Sticky Mobile Action Dock (< md) ─────────────────────────────────── */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-3.5 py-2.5 bg-[#08080A]/95 backdrop-blur-2xl border-t border-white/10 pb-[max(0.65rem,env(safe-area-inset-bottom,0px))] flex items-center justify-between gap-2 shadow-[0_-8px_32px_rgba(0,0,0,0.8)]">
          {mobileStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setMobileStep(mobileStep - 1)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              disabled={isSubmitting}
              className="min-h-[44px] text-xs px-3 border-white/15"
            >
              Back
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(true)}
              className="min-h-[44px] text-xs px-2.5 text-zinc-400"
            >
              Preview
            </Button>
          )}

          {!readOnly ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => handleSubmit(e, 'save_draft')}
              disabled={isSubmitting}
              className="min-h-[44px] text-xs px-3 border-white/15"
            >
              {mode === 'edit' && !effectiveCanPublish ? 'Save Changes' : 'Save Draft'}
            </Button>
          ) : (
            <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
              <Lock size={12} /> Archive View
            </span>
          )}

          {mobileStep < 5 ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                if (validateMobileStep(mobileStep)) {
                  setMobileStep(mobileStep + 1)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }
              }}
              className="min-h-[44px] text-xs font-bold px-4 bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] text-white"
            >
              Next Step →
            </Button>
          ) : !readOnly && effectiveCanPublish ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={(e) => handleSubmit(e, 'publish')}
              disabled={isSubmitting}
              isLoading={isSubmitting}
              className="min-h-[44px] text-xs font-bold px-4 bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] text-white shadow-lg shadow-[#18CFFC]/25"
            >
              {mode === 'create' ? 'Publish Event' : 'Update & Publish'}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(true)}
              leftIcon={<Eye size={14} />}
              className="min-h-[44px] text-xs px-3 border-white/15"
            >
              Preview
            </Button>
          )}
        </div>
      </form>

      {/* Attendee Live View Preview Modal */}
      <EventPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        data={buildPayload('publish')}
        clubName={activeClubProfile?.club_name || clubProfile?.club_name || 'Campus Club'}
      />
    </>
  )
}
