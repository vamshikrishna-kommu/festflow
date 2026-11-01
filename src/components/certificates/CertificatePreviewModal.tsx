import { useRef, useState } from 'react'
import {
  Download,
  Printer,
  Copy,
  Check,
  Share2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Award,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Modal, ModalBody, ModalFooter, Button } from '@/components/ui'
import type { EventCertificateRecord, CertificateTemplateRecord } from '@/types'
import { downloadCertificatePng } from '@/lib/certificatePdf'
import { ShareAchievementCardModal } from './ShareAchievementCardModal'

interface CertificatePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  certificate: EventCertificateRecord | null
  template?: CertificateTemplateRecord | null
}

export function CertificatePreviewModal({
  isOpen,
  onClose,
  certificate,
  template,
}: CertificatePreviewModalProps) {
  const [copiedLink, setCopiedLink] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [shareCardOpen, setShareCardOpen] = useState(false)
  const qrRef = useRef<HTMLDivElement>(null)

  if (!certificate) return null

  const verificationUrl = `https://festflow.online/verify/certificate/${certificate.verification_token}`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(verificationUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      const svg = qrRef.current?.querySelector('svg') || null
      await downloadCertificatePng(certificate, template, svg)
    } finally {
      setIsDownloading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const isRevoked = certificate.status === 'revoked'

  const formattedDate = new Date(certificate.issue_date).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} size="xl" title="Official Certificate Preview">
        <ModalBody className="p-3 sm:p-6 overflow-y-auto max-h-[80vh]">
          {/* Print Style Sheet */}
          <style>{`
            @media print {
              nav, header, footer, button, .no-print, #user-menu, .modal-backdrop {
                display: none !important;
              }
              body {
                background: #ffffff !important;
                color: #000000 !important;
              }
              @page {
                size: A4 landscape;
                margin: 0;
              }
              #printable-certificate {
                width: 100vw !important;
                height: 100vh !important;
                border: none !important;
                margin: 0 !important;
                border-radius: 0 !important;
              }
            }
          `}</style>

          {/* Revocation Warning Banner */}
          {isRevoked && (
            <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
              <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
              <div>
                <p className="font-bold text-red-400 text-sm">This Certificate Has Been Officially Revoked</p>
                <p className="text-xs text-red-300/80 mt-1">
                  Reason: {certificate.revocation_reason || 'Administrative revocation'}. It will display as invalid on public verification checks.
                </p>
              </div>
            </div>
          )}

          {/* Visual Certificate Card (A4 Landscape Preview) */}
          <div
            id="printable-certificate"
            className="relative w-full aspect-[1.414/1] rounded-2xl overflow-hidden border border-amber-500/30 shadow-2xl bg-gradient-to-br from-[#08080A] via-[#0E0E14] to-[#12121C] text-center p-6 sm:p-10 flex flex-col justify-between select-none"
          >
            {/* Background Radial Glow */}
            <div className="absolute top-0 left-0 w-72 h-72 bg-[#18CFFC]/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-72 h-72 bg-[#7F1AFB]/10 rounded-full blur-3xl pointer-events-none" />

            {/* Microtext Borders */}
            <div className="absolute top-2 left-0 right-0 text-[9px] font-mono tracking-widest text-white/20 uppercase pointer-events-none">
              • FestFlow 2.0 Official Verifiable Credential • Authenticity Validated at FestFlow.online •
            </div>
            <div className="absolute bottom-2 left-0 right-0 text-[9px] font-mono tracking-widest text-white/20 uppercase pointer-events-none">
              • ID: {certificate.certificate_number} • Token: {certificate.verification_token.substring(0, 16)}... •
            </div>

            {/* Inner Gold Border */}
            <div className="absolute inset-4 rounded-xl border border-amber-500/40 pointer-events-none" />

            {/* Revoked Watermark Stamp */}
            {isRevoked && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 rotate-[-15deg]">
                <div className="px-8 py-4 border-8 border-red-500/60 bg-red-500/20 text-red-500 font-extrabold text-3xl sm:text-5xl tracking-widest uppercase rounded-2xl backdrop-blur-xs">
                  REVOKED
                </div>
              </div>
            )}

            {/* Top Section: Issuing Club & Crest */}
            <div className="relative z-1 pt-2">
              <p className="text-xs sm:text-sm font-semibold tracking-widest text-[var(--color-text-muted)] uppercase">
                {certificate.club_name}
              </p>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2 rounded-full bg-white/[0.05] border border-amber-500/30 text-amber-400 text-[10px] sm:text-xs font-mono font-bold tracking-wider uppercase">
                <Award size={12} />
                <span>{certificate.category.replace(/_/g, ' ')}</span>
              </div>
            </div>

            {/* Middle Section: Title & Recipient Name */}
            <div className="relative z-1 my-auto py-2">
              <h2 className="text-lg sm:text-3xl font-extrabold font-['Syne'] text-white tracking-wide">
                {template?.title_text || certificate.title || 'CERTIFICATE OF PARTICIPATION'}
              </h2>
              <p className="text-xs sm:text-sm italic text-gray-400 mt-1">
                {template?.subtitle_text || 'This prestigious credential is proudly presented to'}
              </p>
              <h1 className="text-2xl sm:text-5xl font-extrabold font-['Syne'] bg-gradient-to-r from-[#18CFFC] via-white to-[#ED47FC] bg-clip-text text-transparent my-2 sm:my-3 tracking-tight">
                {certificate.recipient_name}
              </h1>
              {certificate.recipient_college && (
                <p className="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  {certificate.recipient_college}
                </p>
              )}
              <p className="text-[11px] sm:text-xs text-gray-300 max-w-xl mx-auto mt-2 leading-relaxed">
                for outstanding participation and successful completion of{' '}
                <strong className="text-white">"{certificate.event_title}"</strong> organized by{' '}
                <strong className="text-white">{certificate.club_name}</strong> on {formattedDate}.
              </p>
            </div>

            {/* Bottom Section: Signatories & QR Turnstile */}
            <div className="relative z-1 grid grid-cols-3 items-end pt-2 border-t border-white/[0.08]">
              {/* Signatory 1 */}
              <div className="text-left">
                <div className="w-24 sm:w-36 h-0.5 bg-gray-600 mb-1" />
                <p className="text-[11px] sm:text-xs font-bold text-white">
                  {template?.signatory_1_name || 'Dr. Faculty Convener'}
                </p>
                <p className="text-[9px] sm:text-[10px] text-gray-400 truncate">
                  {template?.signatory_1_role || 'Faculty Advisor & Head'}
                </p>
              </div>

              {/* Center: Live QR Code & Code */}
              <div className="flex flex-col items-center">
                <div ref={qrRef} className="p-1 sm:p-1.5 bg-white rounded-lg shadow-md border border-amber-500/40">
                  <QRCodeSVG value={verificationUrl} size={54} level="M" />
                </div>
                <p className="text-[10px] sm:text-xs font-mono font-bold text-[#18CFFC] mt-1">
                  {certificate.certificate_number}
                </p>
                <p className="text-[8px] text-gray-400">Scan to Verify</p>
              </div>

              {/* Signatory 2 */}
              <div className="text-right flex flex-col items-end">
                <div className="w-24 sm:w-36 h-0.5 bg-gray-600 mb-1" />
                <p className="text-[11px] sm:text-xs font-bold text-white">
                  {template?.signatory_2_name || 'Student Lead Organizer'}
                </p>
                <p className="text-[9px] sm:text-[10px] text-gray-400 truncate">
                  {template?.signatory_2_role || 'Club President'}
                </p>
              </div>
            </div>
          </div>

          {/* Verification Link Info */}
          <div className="mt-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 truncate pr-2">
              <ShieldCheck size={16} className="text-[#18CFFC] shrink-0" />
              <span className="text-[var(--color-text-muted)] truncate">
                Public Verification Link:{' '}
                <a
                  href={verificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-brand-cyan)] hover:underline"
                >
                  {verificationUrl}
                </a>
              </span>
            </div>
            <button
              onClick={handleCopyLink}
              className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white shrink-0 transition"
              title="Copy verification link"
            >
              {copiedLink ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            </button>
          </div>
        </ModalBody>

        <ModalFooter className="flex flex-wrap items-center justify-between gap-2 p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Share2 size={14} />}
              onClick={() => setShareCardOpen(true)}
            >
              Social Share Card
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ExternalLink size={14} />}
              onClick={() => window.open(verificationUrl, '_blank')}
            >
              Verify Portal
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" leftIcon={<Printer size={14} />} onClick={handlePrint}>
              Print / Save PDF
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Download size={14} />}
              isLoading={isDownloading}
              onClick={handleDownload}
            >
              Download PNG
            </Button>
          </div>
        </ModalFooter>
      </Modal>

      {/* Social Achievement Share Card Modal */}
      <ShareAchievementCardModal
        isOpen={shareCardOpen}
        onClose={() => setShareCardOpen(false)}
        certificate={certificate}
      />
    </>
  )
}

