import { useState } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { QRCodeSVG } from 'qrcode.react'
import {
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  User,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Printer,
  XCircle,
  ExternalLink,
  Lock,
} from 'lucide-react'
import { Badge, Button } from '@/components/ui'
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
  const event = registration.event

  const isConfirmed = registration.status === 'confirmed'
  const isPending = registration.status === 'pending_payment'
  const isCancelled = registration.status === 'cancelled'

  const startDate = new Date(event.start_date)
  const formattedDate = startDate.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const formattedTime = startDate.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  const attendee =
    studentName ||
    registration.event.club?.display_name ||
    'Student Attendee'

  const handleCopyCode = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(registration.ticket_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  // QR code content: only an opaque reference token, never student email/phone
  const qrPayload = `festflow://ticket/${registration.ticket_code}`

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-4 text-left">
      {/* ── Main Ticket Body ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl overflow-hidden glass border border-[oklch(100%_0_0_/_0.12)] shadow-2xl bg-gradient-to-b from-[var(--color-surface-1)] to-[var(--color-surface-0)] print:border-black print:text-black"
      >
        {/* Top Header Banner */}
        <div className="p-5 sm:p-6 pb-4 bg-gradient-to-r from-[var(--color-brand-purple)]/20 via-[var(--color-brand-pink)]/15 to-transparent border-b border-[var(--color-surface-3)]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--color-brand-purple)] to-[var(--color-brand-pink)] flex items-center justify-center text-white">
                <Sparkles size={14} />
              </span>
              <span className="font-display font-bold text-base text-[var(--color-text-primary)]">
                FestFlow Entry Pass
              </span>
            </div>

            {/* Status Badge */}
            {isConfirmed && <Badge variant="success">Confirmed Pass</Badge>}
            {isPending && <Badge variant="amber">Payment Pending</Badge>}
            {isCancelled && <Badge variant="danger">Cancelled</Badge>}
          </div>

          <h2 className="text-xl sm:text-2xl font-bold font-display text-[var(--color-text-primary)] leading-snug">
            {event.title}
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Organized by{' '}
            <span className="text-[var(--color-text-secondary)] font-medium">
              {event.venue_name} • {event.category.toUpperCase()}
            </span>
          </p>
        </div>

        {/* Middle Info Block */}
        <div className="p-5 sm:p-6 grid grid-cols-2 gap-4 text-xs border-b border-[var(--color-surface-3)]">
          <div>
            <span className="text-[var(--color-text-muted)] flex items-center gap-1 mb-1">
              <User size={13} /> Attendee
            </span>
            <strong className="text-sm text-[var(--color-text-primary)] font-semibold block truncate">
              {attendee}
            </strong>
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
              {event.venue_name}
            </strong>
          </div>
        </div>

        {/* ── Perforated Notched Cutouts ───────────────────────────────────── */}
        <div className="relative h-6 bg-[var(--color-surface-0)] flex items-center justify-between px-4 overflow-hidden">
          {/* Left cutout circle */}
          <div className="w-5 h-5 rounded-full bg-[var(--color-surface-0)] border border-[oklch(100%_0_0_/_0.15)] -ml-7 shadow-inner" />
          {/* Dashed line */}
          <div className="flex-1 border-b-2 border-dashed border-[var(--color-surface-3)] mx-2" />
          {/* Right cutout circle */}
          <div className="w-5 h-5 rounded-full bg-[var(--color-surface-0)] border border-[oklch(100%_0_0_/_0.15)] -mr-7 shadow-inner" />
        </div>

        {/* Bottom Section: QR Code & Verification ─────────────────────────── */}
        <div className="p-6 pt-3 flex flex-col items-center text-center gap-4 bg-[var(--color-surface-1)]/50">
          {isConfirmed ? (
            <>
              {/* Confirmed QR Code */}
              <div className="p-3.5 bg-white rounded-2xl shadow-xl border border-white/20 flex items-center justify-center">
                <QRCodeSVG
                  value={qrPayload}
                  size={150}
                  bgColor="#ffffff"
                  fgColor="#0a0a0f"
                  level="M"
                />
              </div>

              <div className="flex flex-col items-center gap-1">
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  Gate Scanner Backup Token
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  title="Click to copy ticket code"
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] hover:border-[var(--color-brand-purple)] text-xs font-mono font-bold text-[var(--color-text-primary)] transition-all"
                >
                  <span>{registration.ticket_code}</span>
                  {copied ? (
                    <CheckCircle2 size={13} className="text-emerald-400" />
                  ) : (
                    <Copy size={13} className="text-[var(--color-text-muted)]" />
                  )}
                </button>
              </div>

              <p className="text-[11px] text-[var(--color-text-muted)] max-w-xs leading-relaxed">
                Scan this code at the campus event gate for instant check-in. Valid only for authorized student entry.
              </p>
            </>
          ) : isPending ? (
            /* Pending Payment Lockout */
            <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center flex flex-col items-center gap-3 w-full">
              <div className="p-3 rounded-full bg-amber-500/20 text-amber-400">
                <Lock size={28} />
              </div>
              <div>
                <strong className="text-sm font-semibold text-amber-300 block mb-1">
                  Ticket Locked — Payment Verification Pending
                </strong>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed max-w-xs mb-3">
                  Please transfer the ticket fee via UPI and submit your 12-digit UTR for organizer review to unlock your entry pass.
                </p>
                <Link to={`/student/payments/${registration.id}`}>
                  <Button variant="primary" size="sm" rightIcon={<ExternalLink size={14} />}>
                    Complete UPI Payment & Submit UTR
                  </Button>
                </Link>
              </div>
              <div className="text-[11px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-3 py-1 rounded-md mt-1">
                Ref: {registration.ticket_code}
              </div>
            </div>
          ) : registration.status === 'rejected' ? (
            /* Payment Rejected Notice */
            <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center flex flex-col items-center gap-3 w-full">
              <div className="p-3 rounded-full bg-rose-500/20 text-rose-400">
                <XCircle size={28} />
              </div>
              <div>
                <strong className="text-sm font-semibold text-rose-300 block mb-1">
                  Payment Verification Rejected
                </strong>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed max-w-xs mb-3">
                  The organizer could not verify your previous transaction reference. Please check your bank receipt and resubmit.
                </p>
                <Link to={`/student/payments/${registration.id}`}>
                  <Button variant="danger" size="sm" rightIcon={<ExternalLink size={14} />}>
                    Fix & Resubmit UTR Reference
                  </Button>
                </Link>
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
                This ticket has been cancelled and is no longer valid for gate entry.
              </p>
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

      {/* ── Action Buttons ───────────────────────────────────────────────── */}
      {showActions && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 print:hidden">
          <Link to={`/events/${event.slug}`}>
            <Button variant="ghost" size="sm" leftIcon={<ExternalLink size={14} />}>
              View Event Page
            </Button>
          </Link>

          <div className="flex items-center gap-2">
            {isConfirmed && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                leftIcon={<Printer size={14} />}
              >
                Print Pass
              </Button>
            )}

            {!isCancelled && onCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
              >
                Cancel Registration
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
