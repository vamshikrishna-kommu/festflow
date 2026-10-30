import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { QRCodeSVG } from 'qrcode.react'
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
  Sun,
} from 'lucide-react'
import { Badge, Button, Logo } from '@/components/ui'
import { resendPassEmail } from '@/lib/emails'
import { ticketReveal, statusBadgePop } from '@/lib/animations'
import type { RegistrationWithEvent } from '@/types'

interface DigitalTicketCardProps {
  registration: RegistrationWithEvent
  studentName?: string
  onCancel?: () => void
  showActions?: boolean
}

export function DigitalTicketCard({
  registration,
  studentName,
  onCancel,
  showActions = true,
}: DigitalTicketCardProps) {
  const [copied, setCopied] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendNotice, setResendNotice] = useState<{ message: string; isError?: boolean } | null>(null)

  // Mobile gate scanner high-contrast mode toggle
  const [highContrast, setHighContrast] = useState<boolean>(() => {
    return localStorage.getItem('festflow_pref_high_contrast') === 'true'
  })

  const ticketCardRef = useRef<HTMLDivElement>(null)
  const event = registration.event || null
  const qrToken = (registration as any).qr_token || registration.ticket_code

  const isConfirmed = registration.status === 'confirmed' && Boolean(registration.ticket_issued_at)

  // Offline ticket persistence: safely caches confirmed pass for offline gate scan
  useEffect(() => {
    if (isConfirmed && registration.id) {
      try {
        localStorage.setItem(`festflow_cached_ticket_${registration.id}`, JSON.stringify(registration))
      } catch {
        // ignore quota limits
      }
    }
  }, [isConfirmed, registration])
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
  const currentToken = qrToken

  // Opaque token only: Never encode student email, phone, or payment secrets inside QR
  const qrPayload = `festflow://pass/${currentToken}`

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

    const res = await resendPassEmail(
      registration,
      registration.participant_details?.email,
      registration.participant_details?.student_name
    )
    setResending(false)

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
      setResendNotice({ message: res.message || 'Failed to resend pass.', isError: true })
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
      ctx.fillText('OFFICIAL CAMPUS GATE PASS', 40, 85)

      ctx.fillStyle = '#34d399'
      ctx.font = 'bold 13px system-ui, sans-serif'
      ctx.fillText('✓ VERIFIED', 520, 60)

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

      // QR Code Background Box
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.roundRect(195, 390, 250, 250, 16)
      ctx.fill()

      // Draw SVG QR Code onto Canvas
      const svgElement = ticketCardRef.current?.querySelector('svg')
      if (svgElement) {
        const svgXml = new XMLSerializer().serializeToString(svgElement)
        const svgBlob = new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' })
        const URL = window.URL || window.webkitURL || window
        const blobURL = URL.createObjectURL(svgBlob)

        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, 220, 415, 200, 200)
          URL.revokeObjectURL(blobURL)

          // Ticket Code Box Below QR
          ctx.fillStyle = '#1e1b4b'
          ctx.beginPath()
          ctx.roundRect(170, 670, 300, 44, 8)
          ctx.fill()
          ctx.strokeStyle = 'rgba(124, 58, 237, 0.5)'
          ctx.stroke()

          ctx.fillStyle = '#a5b4fc'
          ctx.font = 'bold 18px monospace'
          ctx.textAlign = 'center'
          ctx.fillText(currentPassCode, 320, 698)

          // Security Notice
          ctx.textAlign = 'center'
          ctx.fillStyle = '#64748b'
          ctx.font = '11px system-ui, sans-serif'
          ctx.fillText('Scan at campus event gate for entry admission.', 320, 750)
          ctx.fillText('Encrypted token • Do not share with unverified parties.', 320, 770)

          // Watermark Footer
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
          ctx.font = 'bold 10px monospace'
          ctx.fillText(`TOKEN: ${currentToken.substring(0, 16)}...`, 320, 840)
          ctx.fillText('POWERED BY FESTFLOW PASS ENGINE', 320, 860)

          // Export and trigger download
          const link = document.createElement('a')
          link.download = `FestFlow-Pass-${currentPassCode}.png`
          link.href = canvas.toDataURL('image/png')
          link.click()
        }
        img.src = blobURL
      }
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
        className="relative rounded-3xl overflow-hidden border border-white/[0.1] shadow-2xl bg-gradient-to-b from-[#14141A] to-[#0E0E12] print:border-black print:text-black"
      >
        {/* Top Header Banner */}
        <div className="p-5 sm:p-6 pb-4 bg-gradient-to-r from-[#18CFFC]/20 via-[#7F1AFB]/15 to-transparent border-b border-white/[0.08]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <Logo variant="emblem" />
              <span className="font-heading font-bold text-base text-white">
                FestFlow Entry Pass
              </span>
            </div>

            {/* Status Badge */}
            <motion.div variants={statusBadgePop} initial="initial" animate="animate">
              {(registration as any)?.attendance_status === 'checked_in' ? (
                <Badge variant="success">Admitted Inside</Badge>
              ) : (registration as any)?.attendance_status === 'checked_out' ? (
                <Badge variant="amber">Checked Out</Badge>
              ) : isConfirmed ? (
                <Badge variant="success">Confirmed Pass</Badge>
              ) : null}
              {isPendingApproval && <Badge variant="purple">Under Host Review</Badge>}
              {isPending && <Badge variant="amber">Payment Pending</Badge>}
              {isWaitlisted && <Badge variant="amber">Waitlisted</Badge>}
              {isRejected && <Badge variant="danger">Application Rejected</Badge>}
              {isCancelled && <Badge variant="danger">Cancelled</Badge>}
            </motion.div>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold font-heading text-white leading-snug">
            {event?.title || 'FestFlow Entry Pass'}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Organized by{' '}
            <span className="text-zinc-300 font-medium">
              {event?.venue_name || 'Campus Venue'} • {(event?.category || 'General').toUpperCase()}
            </span>
          </p>
        </div>

        {/* Middle Info Block */}
        <div className="p-5 sm:p-6 grid grid-cols-2 gap-4 text-xs border-b border-white/[0.08]">
          <div>
            <span className="text-zinc-500 flex items-center gap-1 mb-1 font-medium">
              <User size={13} className="text-[#18CFFC]" /> {registration.team_role === 'leader' ? 'Squad Leader' : 'Pass Holder'}
            </span>
            <strong className="text-sm text-white font-semibold block truncate">
              {attendee}
            </strong>
          </div>

          <div>
            <span className="text-zinc-500 flex items-center gap-1 mb-1 font-medium">
              <Calendar size={13} className="text-[#18CFFC]" /> Date
            </span>
            <strong className="text-sm text-white font-semibold block">
              {formattedDate}
            </strong>
          </div>

          <div>
            <span className="text-zinc-500 flex items-center gap-1 mb-1 font-medium">
              <Clock size={13} className="text-[#18CFFC]" /> Time
            </span>
            <strong className="text-xs text-zinc-200 font-medium block">
              {formattedTime} (IST)
            </strong>
          </div>

          <div>
            <span className="text-zinc-500 flex items-center gap-1 mb-1 font-medium">
              <MapPin size={13} className="text-[#18CFFC]" /> Venue
            </span>
            <strong className="text-xs text-zinc-200 font-medium block truncate">
              {event?.venue_name || 'Campus Venue'}
            </strong>
          </div>
        </div>

        {/* Team Information Block */}
        {registration.team_name && (
          <div className="p-4 bg-[#14141A] border-b border-white/[0.08] text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 text-[#18CFFC] font-bold">
                <Users size={14} /> Team: {registration.team_name}
              </span>
              <Badge variant="purple" className="text-[10px]">
                {registration.team_role === 'leader' ? 'Squad Leader' : 'Team Member'}
              </Badge>
            </div>
            {hasTeamMembers && registration.team_role === 'leader' && (
              <div className="text-[11px] text-zinc-400 mt-1.5">
                <div className="text-[10px] text-zinc-500 font-medium mb-1">
                  Squad Roster (Individual passes delivered directly to each member):
                </div>
                <div className="flex flex-wrap gap-x-2 gap-y-1">
                  {teamMembers.map((m: any, i: number) => (
                    <span
                      key={i}
                      className="bg-white/10 px-2 py-0.5 rounded-md text-[10px] text-zinc-300"
                    >
                      • {m.name} {m.studentId ? `(${m.studentId})` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Perforated Notched Cutouts */}
        <div className="relative h-6 bg-[#08080A] flex items-center justify-between px-4 overflow-hidden">
          <div className="w-5 h-5 rounded-full bg-[#08080A] border border-white/20 -ml-7 shadow-inner" />
          <div className="flex-1 border-b-2 border-dashed border-white/15 mx-2" />
          <div className="w-5 h-5 rounded-full bg-[#08080A] border border-white/20 -mr-7 shadow-inner" />
        </div>

        {/* Bottom Section: QR Code & Verification */}
        <div className="p-6 pt-3 flex flex-col items-center text-center gap-4 bg-[#0E0E12]">
          {isConfirmed ? (
            <>
              {/* Gate Scanner High-Contrast Mode Toggle for Turnstiles */}
              <div className="flex items-center justify-between w-full max-w-xs px-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !highContrast
                    setHighContrast(nextVal)
                    localStorage.setItem('festflow_pref_high_contrast', String(nextVal))
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all border cursor-pointer ${
                    highContrast
                      ? 'bg-amber-400 text-black border-amber-300 shadow-md'
                      : 'bg-[#14141A] text-zinc-300 hover:text-white border-white/10'
                  }`}
                  title="Toggle high-contrast screen brightness for gate scanner cameras"
                >
                  <Sun size={13} className={highContrast ? 'text-black' : 'text-amber-400'} />
                  <span>{highContrast ? 'High Contrast Mode ON' : 'Turnstile Contrast Mode'}</span>
                </button>

                <span className="text-[10px] text-zinc-500 font-mono">
                  {highContrast ? 'Maximum Readability' : 'OLED Dark'}
                </span>
              </div>

              {/* Confirmed QR Code */}
              <div className={`p-4 rounded-2xl shadow-xl border flex flex-col items-center justify-center transition-all ${
                highContrast
                  ? 'bg-white border-white text-black ring-4 ring-white/30'
                  : 'bg-white border-white/20'
              }`}>
                <QRCodeSVG
                  value={qrPayload}
                  size={highContrast ? 180 : 155}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="H"
                />
                {highContrast && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-black mt-2">
                    Turnstile Scanner Ready
                  </span>
                )}
              </div>

              <div className="flex flex-col items-center gap-1">
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  Official Gate Scanner Pass Token
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  title="Click to copy pass code"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14141A] border border-white/10 hover:border-[#18CFFC] text-xs font-mono font-bold text-white transition-all min-h-[36px] cursor-pointer"
                >
                  <span>{currentPassCode}</span>
                  {copied ? (
                    <CheckCircle2 size={13} className="text-emerald-400" />
                  ) : (
                    <Copy size={13} className="text-zinc-500" />
                  )}
                </button>
              </div>

              <p className="text-[11px] text-zinc-500 max-w-xs leading-relaxed font-sans">
                Scan this encrypted QR pass at the campus event gate for instant check-in. Valid only for authorized student entry.
              </p>
            </>
          ) : isPendingApproval ? (
            /* Pending Host Approval Lockout */
            <div className="p-6 rounded-2xl bg-[#14141A] border border-[#18CFFC]/30 text-center flex flex-col items-center gap-3 w-full">
              <div className="p-3 rounded-full bg-[#18CFFC]/15 text-[#18CFFC]">
                <Clock size={28} />
              </div>
              <div>
                <strong className="text-sm font-semibold text-white block mb-1 font-heading">
                  Application Under Host Review
                </strong>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mb-3 font-sans">
                  The event organizer is currently reviewing your registration application. Your digital entry pass {event?.is_free ? 'will activate automatically once approved' : 'will unlock for payment once approved'}.
                </p>
              </div>
              <div className="text-[11px] font-mono text-zinc-400 bg-black/40 px-3 py-1 rounded-md border border-white/10">
                Ref: {registration.ticket_code}
              </div>
            </div>
          ) : isPending ? (
            /* Pending Payment Lockout */
            <div className="p-6 rounded-2xl bg-[#14141A] border border-amber-500/20 text-center flex flex-col items-center gap-3 w-full">
              <div className="p-3 rounded-full bg-amber-500/20 text-amber-400">
                <Lock size={28} />
              </div>
              <div>
                <strong className="text-sm font-semibold text-amber-300 block mb-1 font-heading">
                  Pass Locked — Payment Verification Pending
                </strong>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mb-3 font-sans">
                  Please complete the ticket fee payment to unlock your active gate entry pass and QR code.
                </p>
                <Link to={`/student/payments/${registration.id}`}>
                  <Button variant="primary" size="sm" rightIcon={<ExternalLink size={14} />}>
                    Pay via UPI & Submit UTR
                  </Button>
                </Link>
              </div>
              <div className="text-[11px] font-mono text-zinc-400 bg-black/40 px-3 py-1 rounded-md border border-white/10 mt-1">
                Ref: {registration.ticket_code}
              </div>
            </div>
          ) : isRejected ? (
            /* Registration Application Declined */
            <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center flex flex-col items-center gap-3 w-full">
              <div className="p-3 rounded-full bg-rose-500/20 text-rose-400">
                <XCircle size={28} />
              </div>
              <div>
                <strong className="text-sm font-semibold text-rose-300 block mb-1">
                  Registration Application Declined
                </strong>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed max-w-xs mb-3">
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
              <div className="text-[11px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-3 py-1 rounded-md">
                Ref: {registration.ticket_code}
              </div>
            </div>
          ) : isWaitlisted ? (
            /* Registration Waitlisted Notice */
            <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-center flex flex-col items-center gap-3 w-full">
              <div className="p-3 rounded-full bg-amber-500/20 text-amber-400">
                <Clock size={28} />
              </div>
              <div>
                <strong className="text-sm font-semibold text-amber-300 block mb-1">
                  Registration Waitlisted
                </strong>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed max-w-xs mb-3">
                  This event is at maximum capacity. You are placed on the organizer waitlist. If a confirmed seat becomes available, your status will update automatically.
                </p>
              </div>
              <div className="text-[11px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-3 py-1 rounded-md">
                Ref: {registration.ticket_code}
              </div>
            </div>
          ) : (
            /* Cancelled Notice */
            <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center flex flex-col items-center gap-2 w-full">
              <XCircle size={28} className="text-rose-400" />
              <strong className="text-sm font-semibold text-rose-300">
                Registration Void / Cancelled
              </strong>
              <p className="text-xs text-[var(--color-text-muted)] max-w-xs">
                This pass has been cancelled and is no longer valid for gate admission.
              </p>
            </div>
          )}

          {/* Resend Notice Feedback */}
          {resendNotice && (
            <div
              className={`w-full p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                resendNotice.isError
                  ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                  : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
              }`}
            >
              {resendNotice.isError ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
              <span>{resendNotice.message}</span>
            </div>
          )}

          {/* Ticket ID & Security Footer */}
          <div className="w-full pt-3 border-t border-[var(--color-surface-3)] flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-400" />
              Verified FestFlow Digital Token
            </span>
            <span className="font-mono">ID: {registration.id.slice(0, 8)}…</span>
          </div>
        </div>
      </motion.div>

      {/* ── Notification Banner ─────────────────────────────────────────── */}
      {resendNotice && (
        <div
          className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-2 transition-all print:hidden ${
            resendNotice.isError
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {resendNotice.isError ? (
              <AlertCircle size={15} className="shrink-0 text-rose-400" />
            ) : (
              <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
            )}
            <span>{resendNotice.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setResendNotice(null)}
            className="p-1 rounded-md hover:bg-white/10 text-[var(--color-text-muted)] hover:text-white transition-colors"
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
              <Button variant="ghost" size="sm" className="w-full justify-center min-h-[44px]" leftIcon={<ExternalLink size={14} />}>
                View Event Page
              </Button>
            </Link>
          ) : (
            <span className="text-xs text-[var(--color-text-muted)] text-center sm:text-left">Event Details Unavailable</span>
          )}

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {isConfirmed && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPass}
                  leftIcon={<Download size={14} />}
                  title="Download offline image pass"
                  className="flex-1 sm:flex-initial justify-center min-h-[44px]"
                >
                  Download
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  leftIcon={<Printer size={14} />}
                  title="Print paper entry badge"
                  className="flex-1 sm:flex-initial justify-center min-h-[44px]"
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
                  className="text-[var(--color-brand-cyan)] hover:text-[var(--color-brand-cyan)]/80 flex-1 sm:flex-initial justify-center min-h-[44px]"
                  title="Resend pass to registered email"
                >
                  {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Email Pass'}
                </Button>
              </>
            )}

            {!isCancelled && !isRejected && onCancel && (
              (registration as any)?.attendance_status === 'checked_in' || (registration as any)?.attendance_status === 'checked_out' ? (
                <span className="text-[11px] text-[var(--color-text-muted)] italic px-2 w-full sm:w-auto text-center">
                  Gate entry recorded (cancellation closed)
                </span>
              ) : hasStarted ? (
                <span className="text-[11px] text-[var(--color-text-muted)] italic px-2 w-full sm:w-auto text-center">
                  Event started (cancellation closed)
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancel}
                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 w-full sm:w-auto justify-center min-h-[44px]"
                >
                  Cancel Registration
                </Button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}
