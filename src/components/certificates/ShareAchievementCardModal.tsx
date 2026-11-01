import { useState } from 'react'
import { Download, Share2, Copy, Check, Award, Trophy, ShieldCheck } from 'lucide-react'
import { Modal, ModalBody, ModalFooter, Button } from '@/components/ui'
import type { EventCertificateRecord, StudentBadgeRecord } from '@/types'
import { downloadAchievementCardPng } from '@/lib/certificatePdf'

interface ShareAchievementCardModalProps {
  isOpen: boolean
  onClose: () => void
  certificate: EventCertificateRecord
  badge?: StudentBadgeRecord | null
}

export function ShareAchievementCardModal({
  isOpen,
  onClose,
  certificate,
  badge,
}: ShareAchievementCardModalProps) {
  const [copiedLink, setCopiedLink] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const verificationUrl = `https://festflow.online/verify/certificate/${certificate.verification_token}`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(verificationUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      await downloadAchievementCardPng(certificate, badge)
    } finally {
      setIsDownloading(false)
    }
  }

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Earned ${certificate.title} on FestFlow!`,
          text: `Proud to receive my official verified credential for "${certificate.event_title}" organized by ${certificate.club_name}! Check authenticity on FestFlow:`,
          url: verificationUrl,
        })
        return
      } catch {
        // Fallback to copy link
      }
    }
    handleCopyLink()
  }

  const isAward = certificate.category === 'winner' || certificate.category === 'runner_up' || certificate.category === 'finalist'

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" title="Share Achievement Card">
      <ModalBody className="p-4 sm:p-6 text-center">
        {/* Square 1:1 Social Card Preview */}
        <div className="relative w-full max-w-sm mx-auto aspect-square rounded-3xl p-6 sm:p-8 overflow-hidden border border-white/[0.1] bg-gradient-to-br from-[#08080A] via-[#0E0E14] to-[#1A102E] shadow-2xl flex flex-col justify-between select-none">
          {/* Top Radial Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#18CFFC]/15 rounded-full blur-2xl pointer-events-none" />

          {/* Card Header Pill */}
          <div className="relative z-1 flex items-center justify-between">
            <span className="text-[10px] font-mono tracking-widest text-[#18CFFC] uppercase font-bold">
              FestFlow Credential
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <ShieldCheck size={11} /> Verified
            </span>
          </div>

          {/* Center Achievement Spotlight */}
          <div className="relative z-1 my-auto py-2">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#18CFFC]/20 to-[#7F1AFB]/30 border border-white/[0.15] flex items-center justify-center text-3xl shadow-lg mb-3">
              {isAward ? <Trophy className="text-amber-400" size={32} /> : <Award className="text-[#18CFFC]" size={32} />}
            </div>

            <p className="text-xs font-mono font-bold tracking-wider text-[#ED47FC] uppercase">
              {certificate.category.replace(/_/g, ' ')}
            </p>

            <h3 className="text-2xl sm:text-3xl font-extrabold font-['Syne'] text-white mt-1">
              {certificate.recipient_name}
            </h3>

            {certificate.recipient_college && (
              <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                {certificate.recipient_college}
              </p>
            )}

            <div className="mt-4 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
              <p className="text-xs font-bold text-white truncate">{certificate.event_title}</p>
              <p className="text-[11px] text-[var(--color-brand-cyan)] truncate">{certificate.club_name}</p>
            </div>
          </div>

          {/* Footer Card Credentials */}
          <div className="relative z-1 pt-3 border-t border-white/[0.08] flex items-center justify-between text-[10px] font-mono text-gray-400">
            <span>{certificate.certificate_number}</span>
            <span className="text-[#18CFFC]">festflow.online</span>
          </div>
        </div>

        <p className="text-xs text-[var(--color-text-muted)] mt-4">
          Export this 1:1 card for LinkedIn, Instagram stories, and portfolio showcases with cryptographic verification link.
        </p>
      </ModalBody>

      <ModalFooter className="flex items-center justify-between gap-2 p-4">
        <Button
          variant="outline"
          size="sm"
          leftIcon={copiedLink ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          onClick={handleCopyLink}
        >
          {copiedLink ? 'Copied Link!' : 'Copy Link'}
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" leftIcon={<Share2 size={14} />} onClick={handleNativeShare}>
            Share
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Download size={14} />}
            isLoading={isDownloading}
            onClick={handleDownload}
          >
            Download Card
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  )
}

