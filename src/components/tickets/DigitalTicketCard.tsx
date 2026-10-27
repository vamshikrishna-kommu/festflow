import { useState, useRef } from 'react'
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
  
  // Team pass vs individual member pass toggle
  const [activePassView, setActivePassView] = useState<'squad' | 'member'>('squad')
  const [selectedMemberIdx, setSelectedMemberIdx] = useState(0)

  const ticketCardRef = useRef<HTMLDivElement>(null)
  const event = registration.event || null
  const qrToken = (registration as any).qr_token || registration.ticket_code

  const isConfirmed = registration.status === 'confirmed'
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

  // Active pass details based on squad vs member pass view
  const currentMember = hasTeamMembers && activePassView === 'member' ? teamMembers[selectedMemberIdx] : null
  const currentPassCode = currentMember
    ? `${registration.ticket_code}-M${selectedMemberIdx + 1}`
    : registration.ticket_code
  const currentToken = currentMember
    ? `${qrToken}-M${selectedMemberIdx + 1}`
    : qrToken

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

    const res = await resendPassEmail(registration.id)
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
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
      ctx.lineWidth = 2
      ctx.strokeRect(16, 16, 608, 888)

      // Header Banner
      const headerGrad = ctx.createLinearGradient(0, 16, 640, 120)
      headerGrad.addColorStop(0, 'rgba(124, 58, 237, 0.4)')
      headerGrad.addColorStop(1, 'rgba(6, 182, 212, 0.3)')
      ctx.fillStyle = headerGrad
      ctx.fillRect(16, 16, 608, 120)

      // Header Title
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 22px system-ui, sans-serif'
      ctx.fillText('FestFlow Digital Pass', 40, 60)

      ctx.fillStyle = '#06b6d4'
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
      ctx.fillText(currentMember ? 'TEAM ATTENDEE' : 'PASS HOLDER', 40, 295)

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 18px system-ui, sans-serif'
      const attendeeDisplay = currentMember ? currentMember.name : attendee
      ctx.fillText(attendeeDisplay, 40, 325)

      if (registration.team_name) {
        ctx.fillStyle = '#a78bfa'
        ctx.font = '13px system-ui, sans-serif'
        ctx.fillText(`Team: ${registration.team_name} ${currentMember ? `(Member #${selectedMemberIdx + 1})` : '(Squad Pass)'}`, 40, 350)
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

      {/* ── Team Pass View Switcher ────────────────────────────────────────── */}
      {hasTeamMembers && isConfirmed && (
        <div className="flex items-center justify-between p-1.5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] print:hidden">
          <button
            type="button"
            onClick={() => setActivePassView('squad')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              activePassView === 'squad'
                ? 'bg-gradient-to-r from-[var(--color-brand-purple)] to-[var(--color-brand-cyan)] text-white shadow-md'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Users size={14} />
            <span>Squad Pass (Leader)</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePassView('member')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              activePassView === 'member'
                ? 'bg-gradient-to-r from-[var(--color-brand-purple)] to-[var(--color-brand-cyan)] text-white shadow-md'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <User size={14} />
            <span>Member Passes ({teamMembers.length})</span>
          </button>
        </div>
      )}

      {/* ── Member Pass Selector Bar ───────────────────────────────────────── */}
      {hasTeamMembers && activePassView === 'member' && isConfirmed && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 print:hidden">
          {teamMembers.map((m, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedMemberIdx(idx)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium shrink-0 transition-all border ${
                selectedMemberIdx === idx
                  ? 'border-[var(--color-brand-cyan)] bg-[var(--color-brand-cyan)]/15 text-[var(--color-brand-cyan)] font-bold'
                  : 'border-[var(--color-surface-3)] bg-[var(--color-surface-1)] text-[var(--color-text-secondary)] hover:border-[var(--color-surface-4)]'
              }`}
            >
              {m.name || `Member #${idx + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* ── Main Ticket Card ──────────────────────────────────────────────── */}
      <motion.div
        id="festflow-digital-pass"
        ref={ticketCardRef}
        variants={ticketReveal}
        initial="hidden"
        animate="visible"
        className="relative rounded-3xl overflow-hidden glass border border-[oklch(100%_0_0_/_0.12)] shadow-2xl bg-gradient-to-b from-[var(--color-surface-1)] to-[var(--color-surface-0)] print:border-black print:text-black"
      >
        {/* Top Header Banner */}
        <div className="p-5 sm:p-6 pb-4 bg-gradient-to-r from-[var(--color-brand-purple)]/20 via-[var(--color-brand-pink)]/15 to-transparent border-b border-[var(--color-surface-3)]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <Logo variant="emblem" />
              <span className="font-display font-bold text-base text-[var(--color-text-primary)]">
                FestFlow Entry Pass
              </span>
            </div>

            {/* Status Badge */}
            <motion.div variants={statusBadgePop} initial="initial" animate="animate">
              {isConfirmed && <Badge variant="success">Confirmed Pass</Badge>}
              {isPendingApproval && <Badge variant="purple">Under Host Review</Badge>}
              {isPending && <Badge variant="amber">Payment Pending</Badge>}
              {isWaitlisted && <Badge variant="amber">Waitlisted</Badge>}
              {isRejected && <Badge variant="danger">Application Rejected</Badge>}
              {isCancelled && <Badge variant="danger">Cancelled</Badge>}
            </motion.div>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold font-display text-[var(--color-text-primary)] leading-snug">
            {event?.title || 'FestFlow Entry Pass'}
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Organized by{' '}
            <span className="text-[var(--color-text-secondary)] font-medium">
              {event?.venue_name || 'Campus Venue'} • {(event?.category || 'General').toUpperCase()}
            </span>
          </p>
        </div>

        {/* Middle Info Block */}
        <div className="p-5 sm:p-6 grid grid-cols-2 gap-4 text-xs border-b border-[var(--color-surface-3)]">
          <div>
            <span className="text-[var(--color-text-muted)] flex items-center gap-1 mb-1">
              <User size={13} /> {currentMember ? 'Member Attendee' : 'Pass Holder'}
            </span>
            <strong className="text-sm text-[var(--color-text-primary)] font-semibold block truncate">
              {currentMember ? currentMember.name : attendee}
            </strong>
            {currentMember?.studentId && (
              <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
                ID: {currentMember.studentId}
              </span>
            )}
          </div>

          <div>
            <span className="text-[var(--color-text-muted)] flex items-center gap-1 mb-1">
              <Calendar size={13} /> Date
            </span>
            <strong className="text-sm text-[var(--color-text-primary)] font-semibold block">
              {formattedDate}
            </strong>
          </div>

          <div>
            <span className="text-[var(--color-text-muted)] flex items-center gap-1 mb-1">
              <Clock size={13} /> Time
            </span>
            <strong className="text-xs text-[var(--color-text-primary)] font-medium block">
              {formattedTime} (IST)
            </strong>
          </div>

          <div>
            <span className="text-[var(--color-text-muted)] flex items-center gap-1 mb-1">
              <MapPin size={13} /> Venue
            </span>
            <strong className="text-xs text-[var(--color-text-primary)] font-medium block truncate">
              {event?.venue_name || 'Campus Venue'}
            </strong>
          </div>
        </div>

        {/* Team Information Block */}
        {registration.team_name && (
          <div className="p-4 bg-[var(--color-surface-2)]/60 border-b border-[var(--color-surface-3)] text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 text-[var(--color-brand-purple)] font-bold">
                <Users size={14} /> Team: {registration.team_name}
              </span>
              <Badge variant="purple" className="text-[10px]">
                {hasTeamMembers ? `${teamMembers.length + 1} Members` : 'Team Leader'}
              </Badge>
            </div>
            {hasTeamMembers && (
              <div className="text-[11px] text-[var(--color-text-secondary)] flex flex-wrap gap-x-2 gap-y-1">
                <span className="text-[var(--color-text-muted)] font-medium">Squad:</span>
                <span className="font-medium text-[var(--color-text-primary)]">{attendee} (Leader)</span>
                {teamMembers.map((m: any, i: number) => (
                  <span
                    key={i}
                    className={`${activePassView === 'member' && selectedMemberIdx === i ? 'text-[var(--color-brand-cyan)] font-bold' : 'text-[var(--color-text-secondary)]'}`}
                  >
                    • {m.name} {m.studentId ? `(${m.studentId})` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Perforated Notched Cutouts */}
        <div className="relative h-6 bg-[var(--color-surface-0)] flex items-center justify-between px-4 overflow-hidden">
          <div className="w-5 h-5 rounded-full bg-[var(--color-surface-0)] border border-[oklch(100%_0_0_/_0.15)] -ml-7 shadow-inner" />
          <div className="flex-1 border-b-2 border-dashed border-[var(--color-surface-3)] mx-2" />
          <div className="w-5 h-5 rounded-full bg-[var(--color-surface-0)] border border-[oklch(100%_0_0_/_0.15)] -mr-7 shadow-inner" />
        </div>

        {/* Bottom Section: QR Code & Verification */}
        <div className="p-6 pt-3 flex flex-col items-center text-center gap-4 bg-[var(--color-surface-1)]/50">
          {isConfirmed ? (
            <>
              {/* Confirmed QR Code */}
              <div className="p-3.5 bg-white rounded-2xl shadow-xl border border-white/20 flex items-center justify-center">
                <QRCodeSVG
                  value={qrPayload}
                  size={155}
                  bgColor="#ffffff"
                  fgColor="#0a0a0f"
                  level="M"
                />
              </div>

              <div className="flex flex-col items-center gap-1">
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  {currentMember ? 'Member Entry Pass Token' : 'Official Gate Scanner Pass Token'}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  title="Click to copy pass code"
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] hover:border-[var(--color-brand-purple)] text-xs font-mono font-bold text-[var(--color-text-primary)] transition-all"
                >
                  <span>{currentPassCode}</span>
                  {copied ? (
                    <CheckCircle2 size={13} className="text-emerald-400" />
                  ) : (
                    <Copy size={13} className="text-[var(--color-text-muted)]" />
                  )}
                </button>
              </div>

              <p className="text-[11px] text-[var(--color-text-muted)] max-w-xs leading-relaxed">
                Scan this encrypted QR pass at the campus event gate for instant check-in. Valid only for authorized student entry.
              </p>
            </>
          ) : isPendingApproval ? (
            /* Pending Host Approval Lockout */
            <div className="p-6 rounded-2xl bg-[var(--color-brand-purple)]/10 border border-[var(--color-brand-purple)]/30 text-center flex flex-col items-center gap-3 w-full">
              <div className="p-3 rounded-full bg-[var(--color-brand-purple)]/20 text-[var(--color-brand-purple)]">
                <Clock size={28} />
              </div>
              <div>
                <strong className="text-sm font-semibold text-[var(--color-text-primary)] block mb-1">
                  Application Under Host Review
                </strong>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed max-w-xs mb-3">
                  The event organizer is currently reviewing your registration application. Your digital entry pass {event?.is_free ? 'will activate automatically once approved' : 'will unlock for payment once approved'}.
                </p>
              </div>
              <div className="text-[11px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-3 py-1 rounded-md">
                Ref: {registration.ticket_code}
              </div>
            </div>
          ) : isPending ? (
            /* Pending Payment Lockout */
            <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center flex flex-col items-center gap-3 w-full">
              <div className="p-3 rounded-full bg-amber-500/20 text-amber-400">
                <Lock size={28} />
              </div>
              <div>
                <strong className="text-sm font-semibold text-amber-300 block mb-1">
                  Pass Locked — Payment Verification Pending
                </strong>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed max-w-xs mb-3">
                  Please complete the ticket fee payment to unlock your active gate entry pass and QR code.
                </p>
                <Link to={`/student/payments/${registration.id}`}>
                  <Button variant="primary" size="sm" rightIcon={<ExternalLink size={14} />}>
                    Pay via UPI & Submit UTR
                  </Button>
                </Link>
              </div>
              <div className="text-[11px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-3 py-1 rounded-md mt-1">
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
              hasStarted ? (
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
