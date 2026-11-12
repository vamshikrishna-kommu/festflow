import { useState } from 'react'
import { motion } from 'motion/react'
import {
  ArrowLeft,
  ArrowRight,
  User,
  Mail,
  Phone,
  GraduationCap,
  CreditCard,
  AlertCircle,
  HelpCircle,
  Ticket,
} from 'lucide-react'
import { Button, Alert } from '@/components/ui'
import { HoldCountdown } from '../HoldCountdown'
import { CollegeSearchCombobox } from '@/components/colleges/CollegeSearchCombobox'
import type { EventWithClub, Profile, StudentProfile } from '@/types'
import type { ReserveSeatItem, SeatParticipant } from '@/types/seating'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface ParticipantDetailsStageProps {
  event: EventWithClub
  user: SupabaseUser
  profile: Profile | null
  studentProfile: StudentProfile | null
  seats: ReserveSeatItem[]
  heldUntil: string
  totalPrice: number
  isSubmitting: boolean
  error: string | null
  onBack: () => void
  onExpired: () => void
  onSubmit: (data: {
    participants: SeatParticipant[]
    customResponses: Record<string, any>
    leadDetails: {
      student_name: string
      email: string
      phone: string
      college_name: string
      grad_year: string
      id_card_number?: string
    }
  }) => void
}

export function ParticipantDetailsStage({
  event,
  user,
  profile,
  studentProfile,
  seats,
  heldUntil,
  totalPrice,
  isSubmitting,
  error,
  onBack,
  onExpired,
  onSubmit,
}: ParticipantDetailsStageProps) {
  const pRequirements = event.participant_fields || {
    require_college: true,
    require_phone: true,
    require_grad_year: true,
    require_id_card: false,
  }

  // Lead participant state
  const [fullName, setFullName] = useState(
    profile?.display_name || user.user_metadata?.display_name || ''
  )
  const [email] = useState(user.email || '')
  const [collegeName, setCollegeName] = useState(
    studentProfile?.college_name || user.user_metadata?.college || ''
  )
  const [collegeId, setCollegeId] = useState<string | null>(
    (studentProfile as any)?.college_id || (user.user_metadata as any)?.college_id || null
  )
  const [phone, setPhone] = useState(user.user_metadata?.phone || '')
  const [gradYear, setGradYear] = useState(
    studentProfile?.graduation_year ? String(studentProfile.graduation_year) : ''
  )
  const [idCardNumber, setIdCardNumber] = useState('')

  // Additional participants state for multi-seat bookings (index 1 to N-1)
  const [additionalParticipants, setAdditionalParticipants] = useState<
    Array<{
      seat_id: string
      student_name: string
      email: string
      phone: string
      college_name: string
    }>
  >(() =>
    seats.slice(1).map((s) => ({
      seat_id: s.seat_id,
      student_name: '',
      email: '',
      phone: '',
      college_name: '',
    }))
  )

  // Custom questions
  const [customAnswers, setCustomAnswers] = useState<Record<string, any>>({})

  // Agreements
  const [agreeRules, setAgreeRules] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)

  // Validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const updateAdditionalParticipant = (
    index: number,
    field: 'student_name' | 'email' | 'phone' | 'college_name',
    value: string
  ) => {
    setAdditionalParticipants((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}

    // Lead attendee validation
    if (!fullName.trim()) {
      errors.fullName = 'Full name is required.'
    }

    if (pRequirements.require_phone && (!phone.trim() || phone.replace(/\D/g, '').length < 10)) {
      errors.phone = 'A valid 10-digit phone number is required.'
    }

    if (pRequirements.require_college && !collegeName.trim()) {
      errors.collegeName = 'College name is required.'
    }

    if (pRequirements.require_grad_year && !gradYear.trim()) {
      errors.gradYear = 'Graduation year is required.'
    }

    if (pRequirements.require_id_card && !idCardNumber.trim()) {
      errors.idCardNumber = 'Student ID card number is required.'
    }

    // Additional participants validation
    const usedEmails = new Set<string>([email.toLowerCase().trim()])

    additionalParticipants.forEach((ap, idx) => {
      const seatLabel = seats[idx + 1]?.display_label || `Seat ${idx + 2}`
      if (!ap.student_name.trim()) {
        errors[`p_${idx}_name`] = `Name is required for ${seatLabel}.`
      }
      if (!ap.email.trim() || !/^\S+@\S+\.\S+$/.test(ap.email.trim())) {
        errors[`p_${idx}_email`] = `Valid email is required for ${seatLabel}.`
      } else {
        const lower = ap.email.trim().toLowerCase()
        if (usedEmails.has(lower)) {
          errors[`p_${idx}_email`] = `Duplicate email for ${seatLabel}. Each attendee must have a distinct email.`
        } else {
          usedEmails.add(lower)
        }
      }
    })

    // Custom questions validation
    if (event.custom_questions && Array.isArray(event.custom_questions)) {
      event.custom_questions.forEach((q: any) => {
        if (q.required) {
          const val = customAnswers[q.id]
          if (q.type === 'checkbox' && !val) {
            errors[`q_${q.id}`] = `Please accept: ${q.label}`
          } else if (!val || String(val).trim() === '') {
            errors[`q_${q.id}`] = `This question is required: ${q.label}`
          }
        }
      })
    }

    if (!agreeRules) {
      errors.agreeRules = 'You must affirm that you meet the eligibility criteria for this event.'
    }

    if (!agreeTerms) {
      errors.agreeTerms = 'You must agree to the booking terms and cancellation policies.'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const leadParticipant: SeatParticipant = {
      seat_id: seats[0].seat_id,
      display_label: seats[0].display_label,
      category_name: seats[0].category_name,
      category_color: seats[0].category_color,
      price: seats[0].price,
      student_name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      college_name: collegeName.trim() || undefined,
      id_card_number: idCardNumber.trim() || undefined,
      grad_year: gradYear.trim() || undefined,
      is_lead: true,
    }

    const restParticipants: SeatParticipant[] = additionalParticipants.map((ap, idx) => ({
      seat_id: seats[idx + 1].seat_id,
      display_label: seats[idx + 1].display_label,
      category_name: seats[idx + 1].category_name,
      category_color: seats[idx + 1].category_color,
      price: seats[idx + 1].price,
      student_name: ap.student_name.trim(),
      email: ap.email.trim(),
      phone: ap.phone.trim() || undefined,
      college_name: ap.college_name.trim() || collegeName.trim() || undefined,
      is_lead: false,
    }))

    onSubmit({
      participants: [leadParticipant, ...restParticipants],
      customResponses: customAnswers,
      leadDetails: {
        student_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        college_name: collegeName.trim(),
        grad_year: gradYear.trim(),
        id_card_number: idCardNumber.trim() || undefined,
      },
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="space-y-6"
    >
      {/* Top Banner: Hold Countdown + Held Seats Summary */}
      <div className="bg-[var(--color-surface-1)] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
          <div>
            <div className="text-xs uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-1">
              Active Seat Hold
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {seats.map((seat) => (
                <div
                  key={seat.seat_id}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--color-surface-2)] border border-white/10 text-xs font-semibold text-[var(--color-text-primary)]"
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: seat.category_color || '#18CFFC' }}
                  />
                  <span>{seat.display_label}</span>
                  <span className="text-[var(--color-text-muted)] font-normal">
                    ({seat.category_name || 'Standard'} • ₹{seat.price})
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex sm:flex-col sm:items-end justify-between items-center">
            <HoldCountdown heldUntil={heldUntil} onExpired={onExpired} />
            <div className="text-xs text-[var(--color-text-muted)] mt-1">
              Total:{' '}
              <strong className="text-[var(--color-text-primary)] text-sm">
                {totalPrice === 0 ? 'Free' : `₹${totalPrice.toLocaleString('en-IN')}`}
              </strong>
            </div>
          </div>
        </div>

        <p className="text-xs text-[var(--color-text-muted)] mt-3">
          Your selected seat(s) are held while you complete attendee details. If the countdown expires before registration, the seats will be released back to the general booking pool.
        </p>
      </div>

      {error && (
        <Alert variant="error" className="mb-4">
          <AlertCircle className="w-4 h-4 mr-2" />
          {error}
        </Alert>
      )}

      {/* Main Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Lead Attendee (Seat 1) */}
        <div className="bg-[var(--color-surface-1)] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#18CFFC]/10 border border-[#18CFFC]/20 flex items-center justify-center text-[#18CFFC]">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                  Primary Attendee (Lead Booker)
                </h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Assigned Seat: <strong className="text-[#18CFFC]">{seats[0]?.display_label}</strong> ({seats[0]?.category_name || 'Standard'})
                </p>
              </div>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#18CFFC]/10 text-[#18CFFC] border border-[#18CFFC]/20 font-medium">
              Lead Pass
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
                Full Name *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className={`w-full bg-[var(--color-surface-2)] border ${
                    fieldErrors.fullName ? 'border-red-500' : 'border-white/10'
                  } rounded-xl pl-9 pr-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC]`}
                />
              </div>
              {fieldErrors.fullName && (
                <p className="text-xs text-red-400 mt-1">{fieldErrors.fullName}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
                Email Address (Account Linked)
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-[var(--color-text-muted)]" />
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full bg-[var(--color-surface-2)]/60 border border-white/5 rounded-xl pl-9 pr-3 py-2.5 text-sm text-[var(--color-text-muted)] cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
                College / Institution {pRequirements.require_college && '*'}
              </label>
              <CollegeSearchCombobox
                selectedCollegeId={collegeId}
                selectedCollegeName={collegeName}
                onSelect={(col, raw) => {
                  setCollegeName(col?.name || raw || '')
                  setCollegeId(col?.id || null)
                }}
                error={fieldErrors.collegeName}
                placeholder="Search or enter your college..."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
                Contact Phone {pRequirements.require_phone && '*'}
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 w-4 h-4 text-[var(--color-text-muted)]" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className={`w-full bg-[var(--color-surface-2)] border ${
                    fieldErrors.phone ? 'border-red-500' : 'border-white/10'
                  } rounded-xl pl-9 pr-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC]`}
                />
              </div>
              {fieldErrors.phone && (
                <p className="text-xs text-red-400 mt-1">{fieldErrors.phone}</p>
              )}
            </div>

            {pRequirements.require_grad_year && (
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
                  Graduation Year *
                </label>
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-3 w-4 h-4 text-[var(--color-text-muted)]" />
                  <input
                    type="text"
                    value={gradYear}
                    onChange={(e) => setGradYear(e.target.value)}
                    placeholder="e.g. 2026"
                    className={`w-full bg-[var(--color-surface-2)] border ${
                      fieldErrors.gradYear ? 'border-red-500' : 'border-white/10'
                    } rounded-xl pl-9 pr-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC]`}
                  />
                </div>
                {fieldErrors.gradYear && (
                  <p className="text-xs text-red-400 mt-1">{fieldErrors.gradYear}</p>
                )}
              </div>
            )}

            {pRequirements.require_id_card && (
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
                  Student ID Card Number *
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-3 w-4 h-4 text-[var(--color-text-muted)]" />
                  <input
                    type="text"
                    value={idCardNumber}
                    onChange={(e) => setIdCardNumber(e.target.value)}
                    placeholder="e.g. 21CS042"
                    className={`w-full bg-[var(--color-surface-2)] border ${
                      fieldErrors.idCardNumber ? 'border-red-500' : 'border-white/10'
                    } rounded-xl pl-9 pr-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC]`}
                  />
                </div>
                {fieldErrors.idCardNumber && (
                  <p className="text-xs text-red-400 mt-1">{fieldErrors.idCardNumber}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Additional Participants (for multi-seat bookings) */}
        {additionalParticipants.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                Additional Seats Attendees ({additionalParticipants.length})
              </h3>
              <span className="text-xs text-[var(--color-text-muted)]">
                Assign a named attendee to each additional ticket
              </span>
            </div>

            {additionalParticipants.map((ap, idx) => {
              const seat = seats[idx + 1]
              return (
                <div
                  key={ap.seat_id}
                  className="bg-[var(--color-surface-1)] border border-white/10 rounded-2xl p-5 shadow-xl space-y-4"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: seat?.category_color || '#18CFFC' }}
                      />
                      <h4 className="text-sm font-bold text-[var(--color-text-primary)]">
                        Seat {seat?.display_label}
                      </h4>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        ({seat?.category_name || 'Standard'} • ₹{seat?.price ?? 0})
                      </span>
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      Attendee #{idx + 2}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
                        Attendee Name *
                      </label>
                      <input
                        type="text"
                        value={ap.student_name}
                        onChange={(e) =>
                          updateAdditionalParticipant(idx, 'student_name', e.target.value)
                        }
                        placeholder="Full name of attendee"
                        className={`w-full bg-[var(--color-surface-2)] border ${
                          fieldErrors[`p_${idx}_name`] ? 'border-red-500' : 'border-white/10'
                        } rounded-xl px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC]`}
                      />
                      {fieldErrors[`p_${idx}_name`] && (
                        <p className="text-xs text-red-400 mt-1">{fieldErrors[`p_${idx}_name`]}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
                        Attendee Email *
                      </label>
                      <input
                        type="email"
                        value={ap.email}
                        onChange={(e) =>
                          updateAdditionalParticipant(idx, 'email', e.target.value)
                        }
                        placeholder="Email for digital pass delivery"
                        className={`w-full bg-[var(--color-surface-2)] border ${
                          fieldErrors[`p_${idx}_email`] ? 'border-red-500' : 'border-white/10'
                        } rounded-xl px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC]`}
                      />
                      {fieldErrors[`p_${idx}_email`] && (
                        <p className="text-xs text-red-400 mt-1">{fieldErrors[`p_${idx}_email`]}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
                        Mobile Phone (Optional)
                      </label>
                      <input
                        type="tel"
                        value={ap.phone}
                        onChange={(e) =>
                          updateAdditionalParticipant(idx, 'phone', e.target.value)
                        }
                        placeholder="10-digit number"
                        className="w-full bg-[var(--color-surface-2)] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1.5">
                        College / Institution (Optional)
                      </label>
                      <input
                        type="text"
                        value={ap.college_name}
                        onChange={(e) =>
                          updateAdditionalParticipant(idx, 'college_name', e.target.value)
                        }
                        placeholder={collegeName || 'College name'}
                        className="w-full bg-[var(--color-surface-2)] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC]"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Card 3: Organizer Custom Questions (if any) */}
        {event.custom_questions &&
          Array.isArray(event.custom_questions) &&
          event.custom_questions.length > 0 && (
            <div className="bg-[var(--color-surface-1)] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-white/5">
                <HelpCircle className="w-4 h-4 text-[#ED47FC]" />
                <h3 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                  Event Specific Questions
                </h3>
              </div>

              {event.custom_questions.map((q: any) => (
                <div key={q.id} className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--color-text-secondary)]">
                    {q.label} {q.required && <span className="text-red-400">*</span>}
                  </label>

                  {q.type === 'checkbox' ? (
                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[var(--color-text-muted)]">
                      <input
                        type="checkbox"
                        checked={Boolean(customAnswers[q.id])}
                        onChange={(e) =>
                          setCustomAnswers((prev) => ({ ...prev, [q.id]: e.target.checked }))
                        }
                        className="mt-0.5 rounded border-white/20 bg-[var(--color-surface-2)] text-[#18CFFC] focus:ring-0"
                      />
                      <span>{q.description || q.label}</span>
                    </label>
                  ) : q.type === 'select' ? (
                    <select
                      value={customAnswers[q.id] || ''}
                      onChange={(e) =>
                        setCustomAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                      }
                      className="w-full bg-[var(--color-surface-2)] border border-white/10 rounded-xl px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[#18CFFC]"
                    >
                      <option value="">Select an option</option>
                      {(q.options || []).map((opt: string) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={q.type === 'number' ? 'number' : 'text'}
                      value={customAnswers[q.id] || ''}
                      onChange={(e) =>
                        setCustomAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                      }
                      placeholder={q.placeholder || ''}
                      className="w-full bg-[var(--color-surface-2)] border border-white/10 rounded-xl px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC]"
                    />
                  )}

                  {fieldErrors[`q_${q.id}`] && (
                    <p className="text-xs text-red-400">{fieldErrors[`q_${q.id}`]}</p>
                  )}
                </div>
              ))}
            </div>
          )}

        {/* Card 4: Agreements */}
        <div className="bg-[var(--color-surface-1)] border border-white/10 rounded-2xl p-5 shadow-xl space-y-3">
          <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[var(--color-text-muted)]">
            <input
              type="checkbox"
              checked={agreeRules}
              onChange={(e) => setAgreeRules(e.target.checked)}
              className="mt-0.5 rounded border-white/20 bg-[var(--color-surface-2)] text-[#18CFFC] focus:ring-0"
            />
            <span>
              I confirm that all entered attendee information is accurate, and all participants meet the eligibility criteria for this event.
            </span>
          </label>
          {fieldErrors.agreeRules && (
            <p className="text-xs text-red-400 pl-6">{fieldErrors.agreeRules}</p>
          )}

          <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[var(--color-text-muted)]">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-0.5 rounded border-white/20 bg-[var(--color-surface-2)] text-[#18CFFC] focus:ring-0"
            />
            <span>
              I agree to the FestFlow booking terms, seat assignment policy, and club event rules.
            </span>
          </label>
          {fieldErrors.agreeTerms && (
            <p className="text-xs text-red-400 pl-6">{fieldErrors.agreeTerms}</p>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Seat Selection
          </Button>

          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            className="w-full sm:w-auto bg-gradient-to-r from-[#18CFFC] to-[#0D56FB] text-black font-bold px-6"
          >
            {totalPrice > 0 ? (
              <>
                Proceed to Payment (₹{totalPrice.toLocaleString('en-IN')})
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </>
            ) : (
              <>
                Confirm Reservation & Get Ticket
                <Ticket className="w-4 h-4 ml-1.5" />
              </>
            )}
          </Button>
        </div>
      </form>
    </motion.div>
  )
}
