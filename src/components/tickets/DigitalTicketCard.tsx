import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import {
  Calendar,
  Clock,
  MapPin,
  User,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Printer,
  Download,
  Mail,
  XCircle,
  ExternalLink,
  Lock,
  Users,
  AlertCircle,
  X,
  Ticket,
} from 'lucide-react'
import { Badge, Button, Logo } from '@/components/ui'
import { QRCodeSVG } from 'qrcode.react'
import { resendPassEmail } from '@/lib/emails'
import { writeCachedTicket, TICKET_CACHE_PREFIX } from '@/lib/ticketCache'
import { ticketReveal, statusBadgePop } from '@/lib/animations'
import type { RegistrationWithEvent, AttendanceStatus } from '@/types'

interface DigitalTicketCardProps {
  registration: RegistrationWithEvent
  studentName?: string
  viewerUserId?: string
  onCancel?: () => void
  showActions?: boolean
  seatReservation?: {
    display_label?: string
    row_identifier?: string
    section?: string | null
    category_name?: string | null
    category_color?: string | null
  } | null
}

export function DigitalTicketCard({
  registration,
  studentName,
  viewerUserId,
  onCancel,
  showActions = true,
  seatReservation,
}: DigitalTicketCardProps) {
  const [copied, setCopied] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendNotice, setResendNotice] = useState<{ message: string; isError?: boolean } | null>(null)

  // Gate Attendance State (Verified by Event Organizers at Venue)
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>(
    (registration as any)?.attendance_status || 'not_checked_in'
  )
  const entryCount: number =
    (registration as any)?.check_in?.entry_count ||
    (registration as any)?.check_ins?.[0]?.entry_count ||
    1

  useEffect(() => {
    if ((registration as any)?.attendance_status) {
      setAttendanceStatus((registration as any).attendance_status)
    }
  }, [registration])

  const ticketCardRef = useRef<HTMLDivElement>(null)
  const event = registration.event || null

  const isConfirmed = registration.status === 'confirmed' && Boolean(registration.ticket_issued_at)

  // Offline pass persistence under `festflow_cached_ticket_` stores sanitized metadata in localStorage.
  useEffect(() => {
    if (isConfirmed && registration.id && TICKET_CACHE_PREFIX) {
      writeCachedTicket(registration, viewerUserId || registration.student_id)
    }
  }, [isConfirmed, registration, viewerUserId])
  const isPendingApproval = registration.status === 'pending_approval'
  const isPending = registration.status === 'pending_payment'
  const isWaitlisted = registration.status === 'waitlisted'
  const isRejected = registration.status === 'rejected'
  const isCancelled = registration.status === 'cancelled'
  const startDate = event?.start_date ? new Date(event.start_date) : null
  const hasStarted = startDate ? startDate.getTime() <= Date.now() : false

  const formattedDate = startDate
    ? startDate.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Date unavailable'
  const formattedTime = startDate
    ? startDate.toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : 'Time unavailable'

  const attendee =
    studentName ||
    registration.event?.club?.display_name ||
    'Student Attendee'

  const teamMembers: any[] = Array.isArray((registration as any).team_members)
    ? (registration as any).team_members
    : []
  const hasTeamMembers = Boolean(event && event.participation_type === 'team' && teamMembers.length > 0)

  const currentPassCode = registration.ticket_code

  const handleCopyCode = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentPassCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleResendEmail = async () => {
    if (resending || resendCooldown > 0) return
    setResending(true)
    setResendNotice(null)

    try {
      const res = await resendPassEmail(
        registration,
        registration.participant_details?.email,
        registration.participant_details?.student_name
      )

      if (res.success) {
        setResendNotice({ message: res.message || 'Pass delivered to your email!', isError: false })
        setResendCooldown(30)
        const interval = setInterval(() => {
          setResendCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(interval)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      } else {
        const isUnconfiguredOrUnreachable =
          res.configured === false ||
          !res.message ||
          res.message.includes('unreachable') ||
          res.message.includes('not configured') ||
          res.message.includes('not deployed') ||
          res.message.includes('CORS') ||
          res.message.includes('FunctionsFetchError') ||
          res.message.includes('network error')

        if (isUnconfiguredOrUnreachable) {
          setResendNotice({
            message:
              'Automated email service is not yet configured. You can Download or Print your pass immediately using the buttons below.',
            isError: false,
          })
        } else {
          setResendNotice({ message: res.message, isError: true })
        }
      }
    } catch {
      setResendNotice({
        message:
          'Automated email service is not yet configured. You can Download or Print your pass immediately using the buttons below.',
        isError: false,
      })
    } finally {
      setResending(false)
    }
  }

  /**
   * Generates a high-resolution, branded PNG image of the pass for offline storage.
   */
  const handleDownloadPass = () => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 640
      canvas.height = 920
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Background Gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 920)
      bgGrad.addColorStop(0, '#0f0f1a')
      bgGrad.addColorStop(1, '#181829')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, 640, 920)

      // Outer Rounded Border
      ctx.strokeStyle = 'rgba(255, 87, 34, 0.3)'
      ctx.lineWidth = 2
      ctx.strokeRect(16, 16, 608, 888)

      // Header Banner
      const headerGrad = ctx.createLinearGradient(0, 16, 640, 120)
      headerGrad.addColorStop(0, 'rgba(255, 87, 34, 0.3)')
      headerGrad.addColorStop(1, 'rgba(255, 122, 26, 0.15)')
      ctx.fillStyle = headerGrad
      ctx.fillRect(16, 16, 608, 120)

      // Header Title
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 22px system-ui, sans-serif'
      ctx.fillText('FestFlow Digital Pass', 40, 60)

      ctx.fillStyle = '#18CFFC'
      ctx.font = 'bold 12px monospace'
      ctx.fillText('OFFICIAL CAMPUS ENTRY PASS', 40, 85)

      ctx.fillStyle = '#34d399'
      ctx.font = 'bold 13px system-ui, sans-serif'
      ctx.fillText('✓ CONFIRMED', 500, 60)

      // Event Title
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 24px system-ui, sans-serif'
      const eventTitle = event?.title || 'FestFlow Event Pass'
      const title = eventTitle.length > 32 ? eventTitle.substring(0, 30) + '…' : eventTitle
      ctx.fillText(title, 40, 180)

      // Event Meta (Date & Venue)
      ctx.fillStyle = '#94a3b8'
      ctx.font = '14px system-ui, sans-serif'
      ctx.fillText(`📅 ${formattedDate} at ${formattedTime}`, 40, 215)
      ctx.fillText(`📍 ${event?.venue_name || 'Campus Venue'}`, 40, 240)

      // Divider line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
      ctx.beginPath()
      ctx.moveTo(40, 265)
      ctx.lineTo(600, 265)
      ctx.stroke()

      // Attendee Details
      ctx.fillStyle = '#94a3b8'
      ctx.font = '12px system-ui, sans-serif'
      ctx.fillText(registration.team_role === 'leader' ? 'SQUAD LEADER' : 'PASS HOLDER', 40, 295)

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 18px system-ui, sans-serif'
      ctx.fillText(attendee, 40, 325)

      if (registration.team_name) {
        ctx.fillStyle = '#a78bfa'
        ctx.font = '13px system-ui, sans-serif'
        ctx.fillText(`Team: ${registration.team_name} (${registration.team_role === 'leader' ? 'Leader' : 'Member'})`, 40, 350)
      }

      // Confirmed Pass Verification Card Box
      ctx.fillStyle = '#141424'
      ctx.beginPath()
      ctx.roundRect(80, 400, 480, 220, 16)
      ctx.fill()
      ctx.strokeStyle = 'rgba(24, 207, 252, 0.45)'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.textAlign = 'center'
      ctx.fillStyle = '#18CFFC'
      ctx.font = 'bold 12px monospace'
      ctx.fillText('CONFIRMED PASS REFERENCE', 320, 450)

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 34px monospace'
      ctx.fillText(currentPassCode, 320, 515)

      ctx.fillStyle = '#34d399'
      ctx.font = 'bold 14px system-ui, sans-serif'
      ctx.fillText('VERIFIED STUDENT REGISTRATION', 320, 575)

      // Security Notice
      ctx.fillStyle = '#64748b'
      ctx.font = '12px system-ui, sans-serif'
      ctx.fillText('Keep this digital entry pass available for organizer verification.', 320, 690)
      ctx.fillText('Issued directly to the registered student attendee on FestFlow.', 320, 712)

      // Watermark Footer
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)'
      ctx.font = 'bold 10px monospace'
      ctx.fillText(`REF ID: ${registration.id.slice(0, 8).toUpperCase()}`, 320, 840)
      ctx.fillText('FESTFLOW · CAMPUS EVENT PASS', 320, 860)

      // Export and trigger download
      const link = document.createElement('a')
      link.download = `FestFlow-Pass-${currentPassCode}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('Failed to export pass image:', err)
      setResendNotice({ message: 'Unable to generate pass image download.', isError: true })
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-4 text-left">
      {/* ── Print Style Sheet ──────────────────────────────────────────────── */}
      <style>{`
        @media print {
          nav, header, footer, button, .print\\:hidden, #user-menu, .modal {
            display: none !important;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          #festflow-digital-pass {
            box-shadow: none !important;
            border: 2px solid #000000 !important;
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 auto !important;
            max-width: 480px !important;
          }
          #festflow-digital-pass * {
            color: #000000 !important;
          }
        }
      `}</style>



      {/* ── Main Ticket Card ──────────────────────────────────────────────── */}
      <motion.div
        id="festflow-digital-pass"
        ref={ticketCardRef}
        variants={ticketReveal}
        initial="hidden"
        animate="visible"
        className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-lg bg-white print:border-black print:text-black"
      >
        {/* Top Header Banner */}
        <div className="p-5 sm:p-6 pb-4 bg-gray-50/80 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <Logo variant="emblem" />
              <span className="font-display font-semibold text-sm text-gray-900">
                FestFlow Entry Pass
              </span>
            </div>

            {/* Status Badge */}
            <motion.div variants={statusBadgePop} initial="initial" animate="animate">
              {attendanceStatus === 'checked_in' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  Inside Venue · Entry #{entryCount}
                </span>
              ) : attendanceStatus === 'checked_out' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                  Checked Out
                </span>
              ) : isConfirmed ? (
                <Badge variant="success">Confirmed Pass</Badge>
              ) : null}
              {isPendingApproval && <Badge variant="violet">Under Host Review</Badge>}
              {isPending && <Badge variant="amber">Payment Pending</Badge>}
              {isWaitlisted && <Badge variant="amber">Waitlisted</Badge>}
              {isRejected && <Badge variant="danger">Application Rejected</Badge>}
              {isCancelled && <Badge variant="danger">Cancelled</Badge>}
            </motion.div>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold font-display text-gray-900 leading-snug">
            {event?.title || 'FestFlow Entry Pass'}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Organized at{' '}
            <span className="text-gray-800 font-medium">
              {event?.venue_name || 'Campus Venue'} · {(event?.category || 'General').toUpperCase()}
            </span>
          </p>
        </div>

        {/* Middle Info Block */}
        <div className="p-5 sm:p-6 grid grid-cols-2 gap-4 text-xs border-b border-gray-100 bg-white">
          <div>
            <span className="text-gray-500 flex items-center gap-1 mb-1 font-medium">
              <User size={13} className="text-blue-600" /> {registration.team_role === 'leader' ? 'Squad Leader' : 'Pass Holder'}
            </span>
            <strong className="text-sm text-gray-900 font-semibold block truncate">
              {attendee}
            </strong>
          </div>

          <div>
            <span className="text-gray-500 flex items-center gap-1 mb-1 font-medium">
              <Calendar size={13} className="text-blue-600" /> Date
            </span>
            <strong className="text-sm text-gray-900 font-semibold block">
              {formattedDate}
            </strong>
          </div>

          <div>
            <span className="text-gray-500 flex items-center gap-1 mb-1 font-medium">
              <Clock size={13} className="text-blue-600" /> Time
            </span>
            <strong className="text-xs text-gray-800 font-medium block">
              {formattedTime} (IST)
            </strong>
          </div>

          <div>
            <span className="text-gray-500 flex items-center gap-1 mb-1 font-medium">
              <MapPin size={13} className="text-blue-600" /> Venue
            </span>
            <strong className="text-xs text-gray-800 font-medium block truncate">
              {event?.venue_name || 'Campus Venue'}
            </strong>
          </div>
        </div>

        {/* Team Information Block */}
        {registration.team_name && (
          <div className="p-4 bg-gray-50/70 border-b border-gray-100 text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 text-blue-700 font-semibold">
                <Users size={14} /> Team: {registration.team_name}
              </span>
              <Badge variant="violet" className="text-[10px]">
                {registration.team_role === 'leader' ? 'Squad Leader' : 'Team Member'}
              </Badge>
            </div>
            {hasTeamMembers && registration.team_role === 'leader' && (
              <div className="text-[11px] text-gray-600 mt-1.5">
                <div className="text-[10px] text-gray-500 font-medium mb-1">
                  Squad Roster (Individual passes delivered directly to each member):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {teamMembers.map((m: any, i: number) => (
                    <span
                      key={i}
                      className="bg-white border border-gray-200 px-2 py-0.5 rounded-md text-[10px] text-gray-700 font-medium"
                    >
                      • {m.name} {m.studentId ? `(${m.studentId})` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reserved Seat Information Block */}
        {(seatReservation || registration.seat_details || (registration as any).seat_label) && (
          <div className="p-4 bg-blue-50/50 border-b border-gray-100 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-blue-700 font-semibold">
                <Ticket size={14} /> Reserved Seat
              </span>
              <div className="flex items-center gap-1.5">
                {(seatReservation?.category_name || (registration as any).seat_details?.category_name) && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white border border-gray-200 text-gray-700">
                    {seatReservation?.category_name || (registration as any).seat_details?.category_name}
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-mono font-bold text-sm tracking-wide shadow-2xs">
                  {seatReservation?.display_label || (registration as any).seat_details?.display_label || (registration as any).seat_label}
                </span>
              </div>
            </div>
            {(seatReservation?.section || (registration as any).seat_details?.section) && (
              <div className="text-[11px] text-gray-600 mt-1">
                Section: {seatReservation?.section || (registration as any).seat_details?.section}
              </div>
            )}
          </div>
        )}

        {/* Perforated Notched Cutouts */}
        <div className="relative h-6 bg-white flex items-center justify-between px-4 overflow-hidden">
          <div className="w-5 h-5 rounded-full bg-[#F7F8FA] border border-gray-200 -ml-7 shadow-inner" />
          <div className="flex-1 border-b-2 border-dashed border-gray-200 mx-2" />
          <div className="w-5 h-5 rounded-full bg-[#F7F8FA] border border-gray-200 -mr-7 shadow-inner" />
        </div>

        {/* Bottom Section: Confirmed Pass Reference & Verification */}
        <div className="p-6 pt-3 flex flex-col items-center text-center gap-4 bg-white">
          {isConfirmed ? (
            <>
              <div className="w-full max-w-xs p-5 rounded-xl bg-gray-50/70 border border-gray-200 flex flex-col items-center gap-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 size={12} />
                  Verified Entry Pass
                </div>

                {/* Scannable Gate QR Code */}
                <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-xs flex items-center justify-center my-1">
                  <QRCodeSVG
                    value={registration.qr_token || currentPassCode}
                    size={160}
                    level="H"
                    includeMargin={false}
                  />
                </div>

                <span className="text-[11px] text-gray-500 mt-0.5 font-medium">
                  Confirmed Pass Code
                </span>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  title="Click to copy pass code"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 hover:border-blue-600 text-base sm:text-lg font-mono font-bold tracking-wider text-gray-900 transition-colors min-h-[42px] cursor-pointer shadow-2xs"
                >
                  <span>{currentPassCode}</span>
                  {copied ? (
                    <CheckCircle2 size={15} className="text-emerald-600" />
                  ) : (
                    <Copy size={15} className="text-gray-400" />
                  )}
                </button>
              </div>

              {/* Verified Venue Gate Status (Read-Only, Controlled Exclusively by Event Organizers) */}
              <div className="w-full max-w-xs p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex flex-col items-center gap-2 text-center">
                <div className="flex items-center justify-between w-full text-xs">
                  <span className="text-gray-600 font-medium">Gate Status:</span>
                  {attendanceStatus === 'checked_in' ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                      Inside Venue · Entry #{entryCount}
                    </span>
                  ) : attendanceStatus === 'checked_out' ? (
                    <span className="text-amber-700 font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-600" />
                      Stepped Out
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                      Ready for Entry
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-gray-500 leading-tight">
                  {attendanceStatus === 'checked_in'
                    ? 'Your attendance is verified by authorized event organizers at the venue.'
                    : attendanceStatus === 'checked_out'
                    ? 'Your attendance status is maintained by authorized event organizers.'
                    : 'Check-in is verified by event organizers at the venue entrance gate.'}
                </p>
              </div>

              <p className="text-[11px] text-gray-500 max-w-xs leading-relaxed">
                Present this QR pass or confirmation code at the venue gate for verified entry.
              </p>
            </>
          ) : isPendingApproval ? (
            /* Pending Host Approval Lockout */
            <div className="p-6 rounded-xl bg-blue-50/50 border border-blue-200 text-center flex flex-col items-center gap-3 w-full">
              <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                <Clock size={26} />
              </div>
              <div>
                <strong className="text-sm font-semibold text-gray-900 block mb-1 font-display">
                  Application Under Host Review
                </strong>
                <p className="text-xs text-gray-600 leading-relaxed max-w-xs mb-3">
                  The event organizer is currently reviewing your registration application. Your digital entry pass {event?.is_free ? 'will activate automatically once approved' : 'will unlock for payment once approved'}.
                </p>
              </div>
              <div className="text-[11px] font-mono text-gray-600 bg-white px-3 py-1 rounded-md border border-gray-200">
                Ref: {registration.ticket_code}
              </div>
            </div>
          ) : isPending ? (
            /* Pending Payment Lockout */
            <div className="p-6 rounded-xl bg-amber-50/70 border border-amber-200 text-center flex flex-col items-center gap-3 w-full">
              <div className="p-3 rounded-full bg-amber-100 text-amber-700">
                <Lock size={26} />
              </div>
              <div>
                <strong className="text-sm font-semibold text-amber-950 block mb-1 font-display">
                  Pass Locked — Payment Verification Pending
                </strong>
                <p className="text-xs text-amber-900 leading-relaxed max-w-xs mb-3">
                  Please complete the ticket fee payment to unlock your confirmed entry pass.
                </p>
                <Link to={`/student/payments/${registration.id}`}>
                  <Button variant="primary" size="sm" rightIcon={<ExternalLink size={14} />}>
                    Pay via UPI & Submit UTR
                  </Button>
                </Link>
              </div>
              <div className="text-[11px] font-mono text-gray-600 bg-white px-3 py-1 rounded-md border border-gray-200 mt-1">
                Ref: {registration.ticket_code}
              </div>
            </div>
          ) : isRejected ? (
            /* Registration Application Declined */
            <div className="p-6 rounded-xl bg-rose-50 border border-rose-200 text-center flex flex-col items-center gap-3 w-full">
              <div className="p-3 rounded-full bg-rose-100 text-rose-600">
                <XCircle size={26} />
              </div>
              <div>
                <strong className="text-sm font-semibold text-rose-950 block mb-1">
                  Registration Application Declined
                </strong>
                <p className="text-xs text-rose-800 leading-relaxed max-w-xs mb-3">
                  {(registration as any).rejection_reason || 'The event organizer could not approve this registration.'}
                </p>
                {!event?.is_free && (
                  <Link to={`/student/payments/${registration.id}`}>
                    <Button variant="danger" size="sm" rightIcon={<ExternalLink size={14} />}>
                      Fix & Resubmit Details
                    </Button>
                  </Link>
                )}
              </div>
              <div className="text-[11px] font-mono text-gray-600 bg-white border border-gray-200 px-3 py-1 rounded-md">
                Ref: {registration.ticket_code}
              </div>
            </div>
          ) : isWaitlisted ? (
            /* Registration Waitlisted Notice */
            <div className="p-6 rounded-xl bg-amber-50 border border-amber-200 text-center flex flex-col items-center gap-3 w-full">
              <div className="p-3 rounded-full bg-amber-100 text-amber-700">
                <Clock size={26} />
              </div>
              <div>
                <strong className="text-sm font-semibold text-amber-950 block mb-1">
                  Registration Waitlisted
                </strong>
                <p className="text-xs text-amber-900 leading-relaxed max-w-xs mb-3">
                  This event is at maximum capacity. You are placed on the organizer waitlist. If a confirmed seat becomes available, your status will update automatically.
                </p>
              </div>
              <div className="text-[11px] font-mono text-gray-600 bg-white border border-gray-200 px-3 py-1 rounded-md">
                Ref: {registration.ticket_code}
              </div>
            </div>
          ) : (
            /* Cancelled Notice */
            <div className="p-6 rounded-xl bg-rose-50 border border-rose-200 text-center flex flex-col items-center gap-2 w-full">
              <XCircle size={26} className="text-rose-600" />
              <strong className="text-sm font-semibold text-rose-950">
                Registration Void / Cancelled
              </strong>
              <p className="text-xs text-rose-800 max-w-xs">
                This pass has been cancelled and is no longer valid for event entry.
              </p>
            </div>
          )}

          {/* Ticket ID & Security Footer */}
          <div className="w-full pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
            <span className="flex items-center gap-1 font-medium">
              <ShieldCheck size={13} className="text-blue-600" />
              Verified FestFlow Digital Pass
            </span>
            <span className="font-mono">ID: {registration.id.slice(0, 8)}…</span>
          </div>
        </div>
      </motion.div>

      {/* ── Notification Banner ─────────────────────────────────────────── */}
      {resendNotice && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all print:hidden ${
            resendNotice.isError
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {resendNotice.isError ? (
              <AlertCircle size={15} className="shrink-0 text-rose-600" />
            ) : (
              <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
            )}
            <span>{resendNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setResendNotice(null)}
            className="p-1 rounded-md hover:bg-black/5 text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
            aria-label="Dismiss notice"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Action Buttons ───────────────────────────────────────────────── */}
      {showActions && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 print:hidden">
          {event?.slug ? (
            <Link to={`/events/${event.slug}`} className="w-full sm:w-auto">
              <Button variant="ghost" size="sm" className="w-full justify-center min-h-[40px]" leftIcon={<ExternalLink size={14} />}>
                View Event Page
              </Button>
            </Link>
          ) : (
            <span className="text-xs text-gray-500 text-center sm:text-left">Event Details Unavailable</span>
          )}

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {isConfirmed && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadPass}
                  leftIcon={<Download size={14} />}
                  title="Download offline image pass"
                  className="flex-1 sm:flex-initial justify-center min-h-[40px]"
                >
                  Download
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handlePrint}
                  leftIcon={<Printer size={14} />}
                  title="Print paper entry badge"
                  className="flex-1 sm:flex-initial justify-center min-h-[40px]"
                >
                  Print
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResendEmail}
                  disabled={resending || resendCooldown > 0}
                  isLoading={resending}
                  leftIcon={<Mail size={14} />}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex-1 sm:flex-initial justify-center min-h-[40px]"
                  title="Resend pass to registered email"
                >
                  {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Email Pass'}
                </Button>
              </>
            )}

            {!isCancelled && !isRejected && onCancel && (
              (registration as any)?.attendance_status === 'checked_in' || (registration as any)?.attendance_status === 'checked_out' ? (
                <span className="text-[11px] text-gray-500 italic px-2 w-full sm:w-auto text-center">
                  Attendance recorded (cancellation closed)
                </span>
              ) : hasStarted ? (
                <span className="text-[11px] text-gray-500 italic px-2 w-full sm:w-auto text-center">
                  Event started (cancellation closed)
                </span>
              ) : (registration as any)?.cancellation_request_status === 'pending' ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                  <Clock size={13} className="text-amber-600 shrink-0" />
                  <span>Cancellation Requested (Pending Club Approval)</span>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 w-full sm:w-auto justify-center min-h-[40px]"
                >
                  Request Cancellation
                </Button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}
