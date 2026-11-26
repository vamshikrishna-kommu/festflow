import { useState } from 'react'
import { motion } from 'motion/react'
import {
  Ticket,
  Users,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Plus,
  Trash2,
  Clock,
  ShieldCheck,
  Calendar,
  MapPin,
  Building2,
  GraduationCap,
  Copy,
  Check,
  Share2,
} from 'lucide-react'
import { Button, Badge, Alert } from '@/components/ui'
import { Link } from 'react-router'
import { registerForEvent } from '@/lib/registrations'
import { buildTeamInviteLink } from '@/lib/teams'
import { CollegeSearchCombobox } from '@/components/colleges/CollegeSearchCombobox'
import type {
  EventWithClub,
  Profile,
  StudentProfile,
  CustomQuestion,
  TeamMember,
  RegistrationResponse,
} from '@/types'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface EventRegistrationModalProps {
  isOpen: boolean
  onClose: () => void
  event: EventWithClub
  user: SupabaseUser
  profile: Profile | null
  studentProfile: StudentProfile | null
  selectedTierId?: string | null
  onSuccess: (res: RegistrationResponse) => void
}

export function EventRegistrationModal({
  isOpen,
  onClose,
  event,
  user,
  profile,
  studentProfile,
  selectedTierId,
  onSuccess,
}: EventRegistrationModalProps) {
  const hasTeam = event.participation_type === 'team'
  const hasQuestions = Boolean(
    event.custom_questions &&
      Array.isArray(event.custom_questions) &&
      event.custom_questions.length > 0
  )

  // Step 1: Event & Eligibility Review
  // Step 2: Attendee Profile & Required Fields
  // Step 3: Team Roster (if event.participation_type === 'team')
  // Step 4: Organizer Custom Questions (if questions exist)
  // Step 5: Review Application & Agreement
  // Step 6: Confirmation Reference Screen
  const [step, setStep] = useState<number>(1)

  // Step 1: Eligibility affirmation
  const [eligibilityConfirmed, setEligibilityConfirmed] = useState<boolean>(false)

  // Step 2: Attendee Profile Information
  const [fullName, setFullName] = useState<string>(
    profile?.display_name || user.user_metadata?.display_name || ''
  )
  const [collegeName, setCollegeName] = useState<string>(
    studentProfile?.college_name || user.user_metadata?.college || ''
  )
  const [collegeId, setCollegeId] = useState<string | null>(
    (studentProfile as any)?.college_id || (user.user_metadata as any)?.college_id || null
  )
  const [phone, setPhone] = useState<string>(
    user.user_metadata?.phone || ''
  )
  const [gradYear, setGradYear] = useState<string>(
    studentProfile?.graduation_year ? String(studentProfile.graduation_year) : ''
  )
  const [studentIdCard, setStudentIdCard] = useState<string>('')

  // Step 3: Team Roster
  const [teamName, setTeamName] = useState<string>('')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])

  // Step 4: Organizer Custom Questions
  const [customAnswers, setCustomAnswers] = useState<Record<string, any>>({})

  // Step 5: Final Agreement
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false)

  // Feedback, Loading & Result States
  const [errorNotice, setErrorNotice] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [submissionResult, setSubmissionResult] = useState<RegistrationResponse | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedInvite, setCopiedInvite] = useState(false)

  if (!isOpen) return null

  // Participant requirements configured by organizer
  const pRequirements = event.participant_fields || {
    require_college: true,
    require_phone: true,
    require_grad_year: true,
    require_id_card: false,
  }

  // Calculate dynamic active steps for the progress indicator
  const dynamicSteps: { id: number; label: string }[] = [
    { id: 1, label: '1. Eligibility & Event Rules' },
    { id: 2, label: '2. Attendee Profile' },
  ]
  if (hasTeam) {
    dynamicSteps.push({ id: 3, label: '3. Team Roster' })
  }
  if (hasQuestions) {
    dynamicSteps.push({ id: 4, label: '4. Questions' })
  }
  dynamicSteps.push({ id: 5, label: `${dynamicSteps.length + 1}. Review & Submit` })

  const totalFlowSteps = dynamicSteps.length

  const getNextStepNumber = (current: number): number => {
    if (current === 1) return 2
    if (current === 2) {
      if (hasTeam) return 3
      if (hasQuestions) return 4
      return 5
    }
    if (current === 3) {
      if (hasQuestions) return 4
      return 5
    }
    if (current === 4) {
      return 5
    }
    return 6
  }

  const getPrevStepNumber = (current: number): number => {
    if (current === 5) {
      if (hasQuestions) return 4
      if (hasTeam) return 3
      return 2
    }
    if (current === 4) {
      if (hasTeam) return 3
      return 2
    }
    if (current === 3) {
      return 2
    }
    if (current === 2) {
      return 1
    }
    return 1
  }

  // Step 1 Validation
  const validateStep1 = (): boolean => {
    if (!eligibilityConfirmed) {
      setErrorNotice('Please review and confirm that you meet the event eligibility requirements to proceed.')
      return false
    }
    setErrorNotice(null)
    return true
  }

  // Step 2 Validation (Attendee Profile)
  const validateStep2 = (): boolean => {
    const errors: Record<string, string> = {}

    if (!fullName.trim()) {
      errors.fullName = 'Full Name is required for pass issuance.'
    }

    if (pRequirements.require_college && !collegeName.trim()) {
      errors.collegeName = 'College / University name is required by the organizer.'
    }

    if (pRequirements.require_phone) {
      const cleanPhone = phone.trim()
      if (!cleanPhone) {
        errors.phone = 'Contact phone number is required by the organizer.'
      } else if (!/^[0-9+\-\s]{8,15}$/.test(cleanPhone)) {
        errors.phone = 'Please enter a valid phone number (8-15 digits).'
      }
    }

    if (pRequirements.require_grad_year) {
      const yearNum = Number(gradYear.trim())
      if (!gradYear.trim()) {
        errors.gradYear = 'Graduation year is required by the organizer.'
      } else if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2035) {
        errors.gradYear = 'Please enter a valid graduation year (e.g. 2026).'
      }
    }

    if (pRequirements.require_id_card && !studentIdCard.trim()) {
      errors.studentIdCard = 'Student ID / Roll number is required by the organizer.'
    }

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      setErrorNotice('Please complete all required attendee details before proceeding.')
      return false
    }

    setErrorNotice(null)
    return true
  }

  // Step 3 Validation (Team Roster)
  const validateStep3 = (): boolean => {
    if (!hasTeam) return true
    const errors: Record<string, string> = {}

    if (event.require_team_name && !teamName.trim()) {
      errors.teamName = 'Team name is required for this squad event.'
    }

    const leaderCount = event.leader_counts_towards_size ? 1 : 0
    const totalTeamSize = teamMembers.length + leaderCount
    const minSize = event.min_team_size || 1
    const maxSize = event.max_team_size || 10

    if (totalTeamSize < minSize) {
      setErrorNotice(
        `This event requires at least ${minSize} team members. You currently have ${totalTeamSize}. Please add ${minSize - totalTeamSize} more member(s).`
      )
      return false
    }

    if (totalTeamSize > maxSize) {
      setErrorNotice(
        `This event allows a maximum of ${maxSize} team members. You currently have ${totalTeamSize}. Please remove ${totalTeamSize - maxSize} member(s).`
      )
      return false
    }

    // Validate teammate emails & duplicate prevention
    const leaderEmail = (user.email || '').toLowerCase().trim()
    const seenEmails = new Set<string>()

    for (let i = 0; i < teamMembers.length; i++) {
      const m = teamMembers[i]
      const email = m.email.trim().toLowerCase()

      if (!email || !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
        errors[`member_email_${i}`] = `Valid email is required for Teammate #${i + 1}.`
      } else if (email === leaderEmail) {
        errors[`member_email_${i}`] = `You cannot invite your own email (${leaderEmail}). You are the Team Leader.`
      } else if (seenEmails.has(email)) {
        errors[`member_email_${i}`] = `Duplicate email "${email}" found in your invited teammates list.`
      }

      if (email) seenEmails.add(email)
    }

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      setErrorNotice('Please resolve all teammate email validation errors to proceed.')
      return false
    }

    setErrorNotice(null)
    return true
  }

  // Step 4 Validation (Custom Questions)
  const validateStep4 = (): boolean => {
    if (!hasQuestions) return true
    const errors: Record<string, string> = {}

    const questions = event.custom_questions as CustomQuestion[]
    for (const q of questions) {
      if (q.required) {
        const val = customAnswers[q.id]
        if (q.type === 'checkbox') {
          if (!val) {
            errors[q.id] = 'This confirmation / requirement is mandatory.'
          }
        } else if (!val || !String(val).trim()) {
          errors[q.id] = 'This question is required by the organizer.'
        }
      }
    }

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      setErrorNotice('Please complete all organizer questions marked with (*).')
      return false
    }

    setErrorNotice(null)
    return true
  }

  const handleNext = () => {
    if (step === 1) {
      if (!validateStep1()) return
      setStep(getNextStepNumber(1))
    } else if (step === 2) {
      if (!validateStep2()) return
      setStep(getNextStepNumber(2))
    } else if (step === 3) {
      if (!validateStep3()) return
      setStep(getNextStepNumber(3))
    } else if (step === 4) {
      if (!validateStep4()) return
      setStep(getNextStepNumber(4))
    }
  }

  const handleBack = () => {
    setErrorNotice(null)
    setFieldErrors({})
    setStep(getPrevStepNumber(step))
  }

  // Team Member Actions
  const handleAddTeamMember = () => {
    const leaderCount = event.leader_counts_towards_size ? 1 : 0
    if (teamMembers.length + leaderCount >= (event.max_team_size || 10)) {
      return
    }
    setTeamMembers([
      ...teamMembers,
      { name: '', email: '', studentId: '', college: collegeName },
    ])
  }

  const handleUpdateTeamMember = (index: number, field: keyof TeamMember, value: string) => {
    const updated = [...teamMembers]
    updated[index] = { ...updated[index], [field]: value }
    setTeamMembers(updated)
    if (fieldErrors[`member_${field}_${index}`]) {
      const nextErrors = { ...fieldErrors }
      delete nextErrors[`member_${field}_${index}`]
      setFieldErrors(nextErrors)
    }
  }

  const handleRemoveTeamMember = (index: number) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== index))
  }

  // Final Registration Submission
  const handleSubmitRegistration = async () => {
    if (!agreeTerms) {
      setErrorNotice('Please agree to the event attendee terms before submitting your application.')
      return
    }

    if (!validateStep1()) {
      setStep(1)
      return
    }
    if (!validateStep2()) {
      setStep(2)
      return
    }
    if (hasTeam && !validateStep3()) {
      setStep(3)
      return
    }
    if (hasQuestions && !validateStep4()) {
      setStep(4)
      return
    }

    setIsSubmitting(true)
    setErrorNotice(null)

    const participantDetails = {
      student_name: fullName.trim(),
      email: user.email?.trim(),
      college_name: collegeName.trim() || null,
      phone: phone.trim() || null,
      grad_year: gradYear.trim() || null,
      id_card_number: studentIdCard.trim() || null,
    }

    const payload = {
      teamName: hasTeam && teamName.trim() ? teamName.trim() : undefined,
      teamMembers: hasTeam ? teamMembers : undefined,
      customResponses: customAnswers,
      participantDetails,
      ticketTierId: selectedTierId || undefined,
    }

    const res = await registerForEvent(event.id, user.id, payload)
    setIsSubmitting(false)

    if (!res.success) {
      setErrorNotice(res.message || 'Registration could not be completed.')
    } else {
      setSubmissionResult(res)
      setStep(6) // Success reference screen
      onSuccess(res)
    }
  }

  const handleCopyTicketCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleCopyInviteCode = (inviteCode: string) => {
    navigator.clipboard.writeText(inviteCode)
    setCopiedInvite(true)
    setTimeout(() => setCopiedInvite(false), 2000)
  }

  const handleShareInvite = async (inviteCode: string) => {
    const link = buildTeamInviteLink(event.slug, inviteCode)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Join squad "${teamName}" for ${event.title}!`,
          text: `Join our team "${teamName}" on FestFlow. Use code ${inviteCode} or link:`,
          url: link,
        })
        return
      } catch {
        // Fallback to copy
      }
    }
    navigator.clipboard.writeText(link)
    setCopiedInvite(true)
    setTimeout(() => setCopiedInvite(false), 2000)
  }

  const formattedDate = event.start_date
    ? new Date(event.start_date).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : ''
  const formattedTime = event.start_date
    ? new Date(event.start_date).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    : ''

  // Progress percentage
  const currentStepProgress = Math.min(
    100,
    Math.round(((step < 5 ? step : totalFlowSteps) / totalFlowSteps) * 100)
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-sm overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-xl max-h-[94dvh] sm:max-h-[88vh] flex flex-col rounded-2xl border border-gray-200 shadow-2xl bg-white text-left relative overflow-hidden"
      >
        {/* ── Sticky Modal Header ─────────────────────────────────────────── */}
        <div className="p-4 sm:p-5 border-b border-gray-200 shrink-0 bg-white flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                <Ticket size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold font-heading text-gray-900 truncate">
                  {step === 6 ? 'Registration Reference' : event.title}
                </h3>
                <span className="text-[11px] text-gray-500 block truncate font-sans">
                  {event.is_free ? 'Free Campus Pass' : `Fee: ${event.currency || '₹'}${event.price}`} • {event.venue_name || 'Online'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          </div>

          {/* Stepper Progress Bar (Steps 1 to 5) */}
          {step < 6 && (
            <div className="flex flex-col gap-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-medium text-gray-700">
                <span>
                  {step === 1 && '1. Event & Eligibility Review'}
                  {step === 2 && '2. Attendee Profile Details'}
                  {step === 3 && '3. Team Roster & Squad Members'}
                  {step === 4 && '4. Organizer Questionnaire'}
                  {step === 5 && '5. Review & Final Agreement'}
                </span>
                <span className="text-gray-500 font-mono text-[10px]">
                  Step {step < 5 ? step : totalFlowSteps} of {totalFlowSteps}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                  style={{ width: `${currentStepProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Scrollable Body Content ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs text-gray-900 overscroll-contain">
          {errorNotice && (
            <Alert variant="error" dismissible onDismiss={() => setErrorNotice(null)}>
              {errorNotice}
            </Alert>
          )}

          {/* ──────────────── STEP 1: Event & Eligibility Review ───────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold font-display uppercase tracking-wider text-blue-600">
                    Event Overview
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={event.is_free ? 'info' : 'amber'}>
                      {event.is_free ? 'Free Pass' : `${event.currency || '₹'}${event.price}`}
                    </Badge>
                    <Badge variant={hasTeam ? 'indigo' : 'outline'}>
                      {hasTeam ? 'Team Event' : 'Individual Pass'}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar size={13} className="text-blue-600 shrink-0" />
                    <span>{formattedDate} at {formattedTime}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={13} className="text-blue-600 shrink-0" />
                    <span className="truncate">{event.venue_name || 'Online Event'}</span>
                  </div>
                </div>

                {event.summary && (
                  <p className="text-xs text-gray-600 leading-relaxed pt-2 border-t border-gray-200">
                    {event.summary}
                  </p>
                )}
              </div>

              {/* Eligibility Criteria Cards */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-blue-600" />
                  Organizer Eligibility Rules
                </h4>

                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-2 text-[11px]">
                  {/* Department Restrictions */}
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-gray-500 shrink-0 flex items-center gap-1">
                      <Building2 size={12} /> Allowed Departments:
                    </span>
                    <span className="font-semibold text-right text-gray-900">
                      {event.allowed_departments && event.allowed_departments.length > 0
                        ? event.allowed_departments.join(', ')
                        : 'Open to All Departments'}
                    </span>
                  </div>

                  {/* Batch / Year Restrictions */}
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-gray-500 shrink-0 flex items-center gap-1">
                      <GraduationCap size={12} /> Eligible Batches / Years:
                    </span>
                    <span className="font-semibold text-right text-gray-900 font-mono">
                      {event.allowed_years && event.allowed_years.length > 0
                        ? event.allowed_years.map((y) => `Class of ${y}`).join(', ')
                        : 'All Academic Years'}
                    </span>
                  </div>

                  {/* Custom Eligibility Text */}
                  {event.eligibility && (
                    <div className="pt-2 border-t border-gray-200">
                      <span className="text-[10px] text-gray-500 block uppercase font-bold">
                        Special Prerequisites:
                      </span>
                      <p className="text-xs text-gray-800 mt-0.5 leading-relaxed">
                        {event.eligibility}
                      </p>
                    </div>
                  )}

                  {/* Rules & Guidelines */}
                  {event.rules && (
                    <div className="pt-2 border-t border-gray-200">
                      <span className="text-[10px] text-gray-500 block uppercase font-bold">
                        Event Guidelines:
                      </span>
                      <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                        {event.rules}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Team Participation Mode Rules */}
              {hasTeam && (
                <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-700">
                    <Users size={16} />
                    <span className="text-xs font-bold">Team Participation Requirements</span>
                  </div>
                  <ul className="text-[11px] text-gray-700 space-y-1 list-disc list-inside">
                    <li>
                      <strong>Team Size:</strong> Minimum {event.min_team_size} to Maximum {event.max_team_size} members.
                    </li>
                    <li>
                      <strong>Leader Responsibilities:</strong> As primary registrant, you are designated as the Team Leader. You are responsible for entering valid teammate credentials and coordinating squad registration.
                    </li>
                    <li>
                      <strong>Pass Issuance:</strong> Each member will receive a personalized digital entrance sub-pass linked to this squad ticket.
                    </li>
                  </ul>
                </div>
              )}

              {/* Manual Approval Notice */}
              {event.approval_type === 'manual' && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-center gap-2">
                  <Clock size={16} className="shrink-0 text-amber-600" />
                  <span>
                    <strong>Host Approval Required:</strong> The organizer reviews each application before granting admission and issuing the final entrance pass.
                  </span>
                </div>
              )}

              {/* Eligibility Affirmation Checkbox */}
              <label
                htmlFor="eligibility-affirmation"
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                  eligibilityConfirmed
                    ? 'bg-blue-50 border-blue-300 text-gray-900'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                <input
                  id="eligibility-affirmation"
                  type="checkbox"
                  checked={eligibilityConfirmed}
                  onChange={(e) => {
                    setEligibilityConfirmed(e.target.checked)
                    if (errorNotice) setErrorNotice(null)
                  }}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-0 cursor-pointer shrink-0"
                />
                <span className="text-xs leading-relaxed">
                  I have read and confirm that I meet the department, batch, and organizer eligibility requirements for this event.
                </span>
              </label>
            </div>
          )}

          {/* ──────────────── STEP 2: Attendee Information ────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-gray-700 text-[11px] flex items-center gap-2">
                <ShieldCheck size={16} className="shrink-0 text-blue-600" />
                <span>
                  Please confirm the attendee details required by the event host. Passes are verified at the entrance.
                </span>
              </div>

              {/* Full Name */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-800">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value)
                    if (fieldErrors.fullName) setFieldErrors({ ...fieldErrors, fullName: '' })
                  }}
                  placeholder="e.g. Priya Sharma"
                  autoComplete="name"
                  className={`w-full px-3 py-2.5 rounded-xl bg-white border ${
                    fieldErrors.fullName
                      ? 'border-rose-500 ring-1 ring-rose-500'
                      : 'border-gray-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15'
                  } text-xs text-gray-900 focus:outline-none transition-colors min-h-[44px]`}
                />
                {fieldErrors.fullName && (
                  <span className="text-[10px] text-rose-600 block">{fieldErrors.fullName}</span>
                )}
              </div>

              {/* Email (Read-only verified student email) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-800">
                    Account Email <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-blue-600 font-mono font-semibold">
                    Verified Account
                  </span>
                </div>
                <input
                  type="email"
                  value={user.email || ''}
                  disabled
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-500 cursor-not-allowed select-none min-h-[44px]"
                />
              </div>

              {/* College / Institution */}
              <div className="space-y-1">
                <CollegeSearchCombobox
                  label="College / University"
                  required={pRequirements.require_college}
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
                    if (fieldErrors.collegeName) setFieldErrors({ ...fieldErrors, collegeName: '' })
                  }}
                  error={fieldErrors.collegeName}
                  helperText={pRequirements.require_college ? undefined : 'Optional for this event'}
                />
              </div>

              {/* Phone & Graduation Year Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Phone Number */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-gray-800">
                      Phone Number {pRequirements.require_phone && <span className="text-rose-500">*</span>}
                    </label>
                    {!pRequirements.require_phone && (
                      <span className="text-[10px] text-gray-500">Optional</span>
                    )}
                  </div>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value)
                      if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: '' })
                    }}
                    placeholder="e.g. +91 9876543210"
                    className={`w-full px-3 py-2.5 rounded-xl bg-white border ${
                      fieldErrors.phone
                        ? 'border-rose-500 ring-1 ring-rose-500'
                        : 'border-gray-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15'
                    } text-xs text-gray-900 focus:outline-none transition-colors min-h-[44px]`}
                  />
                  {fieldErrors.phone && (
                    <span className="text-[10px] text-rose-600 block">{fieldErrors.phone}</span>
                  )}
                </div>

                {/* Graduation Year */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-gray-800">
                      Passing Year {pRequirements.require_grad_year && <span className="text-rose-500">*</span>}
                    </label>
                    {!pRequirements.require_grad_year && (
                      <span className="text-[10px] text-gray-500">Optional</span>
                    )}
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={gradYear}
                    onChange={(e) => {
                      setGradYear(e.target.value.replace(/\D/g, '').slice(0, 4))
                      if (fieldErrors.gradYear) setFieldErrors({ ...fieldErrors, gradYear: '' })
                    }}
                    placeholder="e.g. 2026"
                    className={`w-full px-3 py-2.5 rounded-xl bg-white border ${
                      fieldErrors.gradYear
                        ? 'border-rose-500 ring-1 ring-rose-500'
                        : 'border-gray-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15'
                    } text-xs text-gray-900 focus:outline-none transition-colors min-h-[44px]`}
                  />
                  {fieldErrors.gradYear && (
                    <span className="text-[10px] text-rose-600 block">{fieldErrors.gradYear}</span>
                  )}
                </div>
              </div>

              {/* Student ID / Roll Card */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-800">
                    Student ID / Roll Number {pRequirements.require_id_card && <span className="text-rose-500">*</span>}
                  </label>
                  {!pRequirements.require_id_card && (
                    <span className="text-[10px] text-gray-500">Optional</span>
                  )}
                </div>
                <input
                  type="text"
                  autoCapitalize="characters"
                  value={studentIdCard}
                  onChange={(e) => {
                    setStudentIdCard(e.target.value)
                    if (fieldErrors.studentIdCard) setFieldErrors({ ...fieldErrors, studentIdCard: '' })
                  }}
                  placeholder="e.g. 2022CS0148"
                  className={`w-full px-3 py-2.5 rounded-xl bg-white border ${
                    fieldErrors.studentIdCard
                      ? 'border-rose-500 ring-1 ring-rose-500'
                      : 'border-gray-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15'
                  } text-xs text-gray-900 focus:outline-none transition-colors min-h-[44px]`}
                />
                {fieldErrors.studentIdCard && (
                  <span className="text-[10px] text-rose-600 block">{fieldErrors.studentIdCard}</span>
                )}
              </div>
            </div>
          )}

          {/* ──────────────── STEP 3: Team Roster Configuration ──────────── */}
          {step === 3 && hasTeam && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-gray-900 block">
                    Team Participation Rules
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Required: Min {event.min_team_size} • Max {event.max_team_size} total members
                  </span>
                </div>
                <Badge variant="indigo" className="text-[10px]">
                  {teamMembers.length + (event.leader_counts_towards_size ? 1 : 0)} of {event.max_team_size}
                </Badge>
              </div>

              {/* Team Name */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-800">
                  Team Name {event.require_team_name && <span className="text-rose-500">*</span>}
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => {
                    setTeamName(e.target.value)
                    if (fieldErrors.teamName) setFieldErrors({ ...fieldErrors, teamName: '' })
                  }}
                  placeholder="e.g. Neural Ninjas"
                  className={`w-full px-3 py-2 rounded-xl bg-white border ${
                    fieldErrors.teamName
                      ? 'border-rose-500 ring-1 ring-rose-500'
                      : 'border-gray-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15'
                  } text-xs text-gray-900 focus:outline-none transition-colors min-h-[40px]`}
                />
                {fieldErrors.teamName && (
                  <span className="text-[10px] text-rose-600 block">{fieldErrors.teamName}</span>
                )}
              </div>

              {/* Leader Card */}
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                    L
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-gray-900">
                      {fullName || user.email} (You)
                    </div>
                    <span className="text-[10px] text-gray-500">
                      Team Leader & Owner • {user.email}
                    </span>
                  </div>
                </div>
                <Badge variant="info" className="text-[10px]">Leader</Badge>
              </div>

              {/* Explicit Acceptance Workflow Notice */}
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 flex items-start gap-2.5 text-xs">
                <Users size={16} className="shrink-0 mt-0.5 text-blue-600" />
                <div className="space-y-0.5 leading-relaxed">
                  <span className="font-semibold block text-gray-900">
                    Secure Teammate Invitation Workflow
                  </span>
                  <span className="text-[11px] text-gray-600 block">
                    Teammates are invited via email and secure link. Every invited student must sign in to FestFlow and explicitly accept the invitation before becoming a confirmed team member and claiming their pass.
                  </span>
                </div>
              </div>

              {/* Member Inputs */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-gray-900 block">
                      Invite Teammates ({teamMembers.length})
                    </span>
                    <span className="text-[10px] text-gray-500">
                      Capacity: 1 Leader + {teamMembers.length} Invited / {event.max_team_size || 5} Max
                    </span>
                  </div>

                  {teamMembers.length + (event.leader_counts_towards_size ? 1 : 0) < (event.max_team_size || 10) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddTeamMember}
                      leftIcon={<Plus size={13} />}
                      className="text-xs min-h-[36px]"
                    >
                      Add Teammate
                    </Button>
                  )}
                </div>

                {teamMembers.length === 0 && (
                  <div className="p-6 rounded-xl border border-dashed border-gray-300 text-center text-gray-500 space-y-2">
                    <Users size={24} className="mx-auto text-gray-400" />
                    <p className="text-xs">
                      No teammates invited yet. Click &quot;Add Teammate&quot; to invite members by email, or you can invite them anytime after registration using your Squad Dashboard.
                    </p>
                  </div>
                )}

                {teamMembers.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-2.5 relative"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-blue-600 flex items-center gap-1.5">
                        <span>Invited Teammate #{idx + 1}</span>
                        <Badge variant="outline" className="text-[9px] py-0 px-1.5">Pending Invite</Badge>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTeamMember(idx)}
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded-md transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer"
                        title="Remove invitee"
                        aria-label={`Remove Teammate #${idx + 1}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <input
                          type="email"
                          placeholder="Student Email Address *"
                          value={m.email}
                          onChange={(e) => handleUpdateTeamMember(idx, 'email', e.target.value)}
                          className={`w-full px-2.5 py-1.5 rounded-lg bg-white border ${
                            fieldErrors[`member_email_${idx}`]
                              ? 'border-rose-500'
                              : 'border-gray-200 focus:border-blue-600'
                          } text-xs text-gray-900 focus:outline-none min-h-[38px]`}
                        />
                        {fieldErrors[`member_email_${idx}`] && (
                          <span className="text-[9px] text-rose-600 mt-0.5 block">
                            {fieldErrors[`member_email_${idx}`]}
                          </span>
                        )}
                      </div>

                      <div>
                        <input
                          type="text"
                          placeholder="Full Name (optional)"
                          value={m.name}
                          onChange={(e) => handleUpdateTeamMember(idx, 'name', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-xs text-gray-900 focus:outline-none focus:border-blue-600 min-h-[38px]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ──────────────── STEP 4: Organizer Custom Questions ─────────── */}
          {step === 4 && hasQuestions && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                <h4 className="text-xs font-bold text-gray-900 mb-0.5">
                  Organizer Questionnaire
                </h4>
                <p className="text-[11px] text-gray-500">
                  The hosting club requires the following information to prepare for your attendance.
                </p>
              </div>

              {(event.custom_questions as CustomQuestion[]).map((q) => (
                <div
                  key={q.id}
                  className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-1.5"
                >
                  <label className="block text-xs font-semibold text-gray-800">
                    {q.label} {q.required && <span className="text-rose-500">*</span>}
                  </label>

                  {/* Text Input */}
                  {q.type === 'text' && (
                    <input
                      type="text"
                      value={customAnswers[q.id] || ''}
                      onChange={(e) => {
                        setCustomAnswers({ ...customAnswers, [q.id]: e.target.value })
                        if (fieldErrors[q.id]) {
                          const n = { ...fieldErrors }
                          delete n[q.id]
                          setFieldErrors(n)
                        }
                      }}
                      placeholder={q.placeholder || 'Type your answer…'}
                      className={`w-full px-3 py-2 rounded-xl bg-white border ${
                        fieldErrors[q.id]
                          ? 'border-rose-500'
                          : 'border-gray-200 focus:border-blue-600'
                      } text-xs text-gray-900 focus:outline-none transition-colors min-h-[40px]`}
                    />
                  )}

                  {/* Textarea Input */}
                  {q.type === 'textarea' && (
                    <textarea
                      rows={3}
                      value={customAnswers[q.id] || ''}
                      onChange={(e) => {
                        setCustomAnswers({ ...customAnswers, [q.id]: e.target.value })
                        if (fieldErrors[q.id]) {
                          const n = { ...fieldErrors }
                          delete n[q.id]
                          setFieldErrors(n)
                        }
                      }}
                      placeholder={q.placeholder || 'Type your detailed response…'}
                      className={`w-full px-3 py-2 rounded-xl bg-white border ${
                        fieldErrors[q.id]
                          ? 'border-rose-500'
                          : 'border-gray-200 focus:border-blue-600'
                      } text-xs text-gray-900 focus:outline-none transition-colors resize-none`}
                    />
                  )}

                  {/* Select Dropdown */}
                  {q.type === 'select' && (
                    <select
                      value={customAnswers[q.id] || ''}
                      onChange={(e) => {
                        setCustomAnswers({ ...customAnswers, [q.id]: e.target.value })
                        if (fieldErrors[q.id]) {
                          const n = { ...fieldErrors }
                          delete n[q.id]
                          setFieldErrors(n)
                        }
                      }}
                      className={`w-full px-3 py-2 rounded-xl bg-white border ${
                        fieldErrors[q.id]
                          ? 'border-rose-500'
                          : 'border-gray-200 focus:border-blue-600'
                      } text-xs text-gray-900 focus:outline-none transition-colors min-h-[40px]`}
                    >
                      <option value="">Select an option…</option>
                      {q.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Checkbox Agreement */}
                  {q.type === 'checkbox' && (
                    <label className="flex items-center gap-2.5 pt-1 text-xs text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(customAnswers[q.id])}
                        onChange={(e) => {
                          setCustomAnswers({ ...customAnswers, [q.id]: e.target.checked })
                          if (fieldErrors[q.id]) {
                            const n = { ...fieldErrors }
                            delete n[q.id]
                            setFieldErrors(n)
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-600 w-4 h-4 cursor-pointer"
                      />
                      <span>{q.placeholder || 'Yes, I acknowledge and agree'}</span>
                    </label>
                  )}

                  {fieldErrors[q.id] && (
                    <span className="text-[10px] text-rose-600 block mt-1">
                      {fieldErrors[q.id]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ──────────────── STEP 5: Application Review & Agreement ───────── */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-gray-900">
                    Application Summary
                  </h4>
                  <span className="text-[11px] text-gray-500">
                    Review your application before submission
                  </span>
                </div>
                <Badge variant={event.is_free ? 'info' : 'amber'}>
                  {event.is_free ? 'Free Pass' : `${event.currency || '₹'}${event.price}`}
                </Badge>
              </div>

              {/* Attendee Details Summary */}
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-2 text-[11px]">
                <div className="flex justify-between items-center pb-1.5 border-b border-gray-200">
                  <span className="text-gray-500">Primary Attendee:</span>
                  <span className="font-semibold text-gray-900">{fullName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Email:</span>
                  <span className="text-gray-700 font-mono">{user.email}</span>
                </div>
                {collegeName && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">College:</span>
                    <span className="text-gray-700 truncate max-w-[200px]">
                      {collegeName}
                    </span>
                  </div>
                )}
                {phone && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Phone:</span>
                    <span className="text-gray-700">{phone}</span>
                  </div>
                )}
                {studentIdCard && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Roll / ID:</span>
                    <span className="text-gray-700 font-mono">{studentIdCard}</span>
                  </div>
                )}
              </div>

              {/* Team Roster Summary (if team event) */}
              {hasTeam && (
                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-2 text-[11px]">
                  <div className="flex justify-between items-center pb-1.5 border-b border-gray-200">
                    <span className="text-gray-500">Team Name:</span>
                    <span className="font-bold text-indigo-700">
                      {teamName || 'Untitled Squad'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Roster Size:</span>
                    <span className="text-gray-900 font-semibold">
                      {teamMembers.length + (event.leader_counts_towards_size ? 1 : 0)} Members
                    </span>
                  </div>
                  {teamMembers.length > 0 && (
                    <div className="pt-1 space-y-1">
                      <span className="text-[10px] text-gray-500 block">
                        Squad Members:
                      </span>
                      {teamMembers.map((m, i) => (
                        <div key={i} className="flex justify-between text-[10px] text-gray-600">
                          <span>#{i + 1} {m.name}</span>
                          <span className="font-mono text-gray-500">{m.email}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Custom Questions Summary */}
              {hasQuestions && (
                <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-2 text-[11px]">
                  <span className="font-bold text-gray-900 block pb-1 border-b border-gray-200">
                    Questionnaire Answers
                  </span>
                  {(event.custom_questions as CustomQuestion[]).map((q) => (
                    <div key={q.id} className="flex justify-between gap-2">
                      <span className="text-gray-500 truncate max-w-[180px]">
                        {q.label}:
                      </span>
                      <span className="text-gray-800 font-medium text-right truncate max-w-[180px]">
                        {q.type === 'checkbox'
                          ? customAnswers[q.id]
                            ? 'Confirmed'
                            : 'Not Confirmed'
                          : String(customAnswers[q.id] || '—')}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Host Review Notice */}
              {event.approval_type === 'manual' && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-center gap-2">
                  <Clock size={16} className="shrink-0 text-amber-600" />
                  <span>
                    <strong>Host Approval:</strong> The organizer manually approves applications before issuing passes.
                  </span>
                </div>
              )}

              {/* Terms Checkbox with large mobile-friendly tap target */}
              <label
                htmlFor="terms-agreement-checkbox"
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                  agreeTerms
                    ? 'bg-blue-50 border-blue-300 text-gray-900'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                <input
                  id="terms-agreement-checkbox"
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-0 cursor-pointer shrink-0"
                />
                <span className="text-xs leading-relaxed">
                  I agree that my pass is personal, non-transferable, and requires valid college verification at the entrance. All entered details are accurate.
                </span>
              </label>
            </div>
          )}

          {/* ──────────────── STEP 6: Reference & Next Actions ─────────────── */}
          {step === 6 && submissionResult && (
            <div className="py-2 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 size={32} />
              </div>

              <div>
                <h3 className="text-lg sm:text-xl font-bold font-display text-gray-900">
                  {event.approval_type === 'manual'
                    ? 'Application Submitted!'
                    : submissionResult.is_free
                    ? 'Registration Confirmed!'
                    : 'Application Accepted!'}
                </h3>
                <p className="text-xs text-gray-600 mt-1 max-w-xs mx-auto">
                  {submissionResult.message}
                </p>
              </div>

              {/* Reference Box */}
              <div className="w-full p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs flex flex-col gap-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Registration Reference:</span>
                  <button
                    type="button"
                    onClick={() => handleCopyTicketCode(submissionResult.ticket_code || '')}
                    className="font-mono font-bold text-blue-600 text-sm flex items-center gap-1.5 hover:underline cursor-pointer"
                    title="Click to copy code"
                  >
                    <span>{submissionResult.ticket_code}</span>
                    {copiedCode ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  </button>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Current Status:</span>
                  <Badge
                    variant={
                      submissionResult.status === 'confirmed'
                        ? 'success'
                        : submissionResult.status === 'pending_approval'
                        ? 'indigo'
                        : 'amber'
                    }
                  >
                    {submissionResult.status === 'confirmed'
                      ? 'Confirmed Pass'
                      : submissionResult.status === 'pending_approval'
                      ? 'Under Host Review'
                      : 'Payment Pending'}
                  </Badge>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Event:</span>
                  <span className="font-semibold text-gray-900 truncate max-w-[200px]">
                    {event.title}
                  </span>
                </div>

                {hasTeam && teamName && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Team:</span>
                    <span className="text-indigo-700 font-semibold">
                      {teamName} ({teamMembers.length + (event.leader_counts_towards_size ? 1 : 0)} members)
                    </span>
                  </div>
                )}

                {hasTeam && submissionResult.invite_code && (
                  <div className="mt-2 p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-col gap-2 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-blue-700">
                        Squad Invitation Code
                      </span>
                      <span className="text-[10px] text-gray-500">Share with members</span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-base font-bold text-blue-700 tracking-wider">
                        {submissionResult.invite_code}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyInviteCode(submissionResult.invite_code!)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          {copiedInvite ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                          <span>{copiedInvite ? 'Copied' : 'Copy'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleShareInvite(submissionResult.invite_code!)}
                          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Share2 size={13} />
                          <span>Share</span>
                        </button>
                      </div>
                    </div>

                    <p className="text-[10px] text-gray-600 leading-relaxed">
                      Teammates can use this code on the event page to join your squad directly.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons based on status */}
              <div className="w-full flex flex-col gap-2 pt-2">
                {submissionResult.registration_id && (
                  submissionResult.status === 'pending_payment' ||
                  (!submissionResult.is_free && submissionResult.status !== 'pending_approval') ? (
                    <Link
                      to={`/student/payments/${submissionResult.registration_id}`}
                      className="w-full"
                    >
                      <Button
                        variant="primary"
                        size="lg"
                        className="w-full font-bold min-h-[44px]"
                        rightIcon={<ArrowRight size={18} />}
                      >
                        Pay via UPI ({event.currency || '₹'}{event.price})
                      </Button>
                    </Link>
                  ) : submissionResult.status === 'pending_approval' ? (
                    <Link
                      to={`/student/tickets/${submissionResult.registration_id}`}
                      className="w-full"
                    >
                      <Button variant="primary" size="lg" className="w-full min-h-[44px]" rightIcon={<ArrowRight size={18} />}>
                        Track Application Status
                      </Button>
                    </Link>
                  ) : (
                    <Link
                      to={`/student/tickets/${submissionResult.registration_id}`}
                      className="w-full"
                    >
                      <Button variant="primary" size="lg" className="w-full min-h-[44px]" leftIcon={<Ticket size={18} />}>
                        View Digital Pass
                      </Button>
                    </Link>
                  )
                )}

                <Button variant="ghost" size="md" onClick={onClose} className="w-full min-h-[40px]">
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Sticky Modal Footer ─────────────────────────────────────────── */}
        {step < 6 && (
          <div className="p-3 sm:p-5 border-t border-gray-200 shrink-0 bg-white flex items-center justify-between gap-2 sm:gap-3">
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleBack}
                disabled={isSubmitting}
                leftIcon={<ArrowLeft size={15} />}
                className="min-h-[44px]"
              >
                Back
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={onClose}
                disabled={isSubmitting}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
            )}

            {step < 5 ? (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleNext}
                rightIcon={<ArrowRight size={15} />}
                className="min-h-[44px]"
              >
                Continue
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={isSubmitting || !agreeTerms}
                isLoading={isSubmitting}
                onClick={handleSubmitRegistration}
                leftIcon={<CheckCircle2 size={16} />}
                className="min-h-[44px]"
              >
                {event.is_free ? 'Confirm Free Pass' : 'Submit & Register'}
              </Button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}
