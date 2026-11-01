import { useState } from 'react'
import {
  Copy,
  Check,
  Share2,
  Download,
  Camera,
} from 'lucide-react'
import { Modal, ModalBody, Button } from '@/components/ui'
import {
  generateWhatsAppShareUrl,
  generateTwitterShareUrl,
  generateLinkedInShareUrl,
  shareEventNative,
  type EventSharePayload,
} from '@/lib/share'

interface EventShareModalProps {
  isOpen: boolean
  onClose: () => void
  event: {
    title: string
    clubName?: string
    date?: string
    venue?: string
    slug: string
    posterUrl?: string | null
  }
}

export function EventShareModal({ isOpen, onClose, event }: EventShareModalProps) {
  const [copied, setCopied] = useState(false)
  const [igCopied, setIgCopied] = useState(false)

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/events/${event.slug}`
    : `https://www.festflow.online/events/${event.slug}`

  const payload: EventSharePayload = {
    title: event.title,
    clubName: event.clubName,
    date: event.date,
    venue: event.venue,
    url: shareUrl,
  }

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const handleCopyIgText = () => {
    const igText = `Catch me at ${event.title}${event.clubName ? ` by ${event.clubName}` : ''}! 🎟️ Digital passes on FestFlow: ${shareUrl}`
    if (navigator.clipboard) {
      navigator.clipboard.writeText(igText)
      setIgCopied(true)
      setTimeout(() => setIgCopied(false), 2500)
    }
  }

  const handleNativeShare = async () => {
    const success = await shareEventNative(payload)
    if (success) {
      onClose()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Campus Event">
      <ModalBody>
        <div className="flex flex-col gap-5 py-2 text-left">
          {/* Preview snippet */}
          <div className="p-3.5 rounded-2xl bg-[#14141A] border border-white/10 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#18CFFC] to-[#7F1AFB] flex items-center justify-center text-white shrink-0 font-bold">
              <Share2 size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-white truncate font-display">{event.title}</h4>
              <p className="text-xs text-zinc-400 truncate mt-0.5">
                {event.clubName || 'FestFlow Campus'} {event.venue ? `• ${event.venue}` : ''}
              </p>
            </div>
          </div>

          {/* Quick Copy Link Bar */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-400">Direct Event Link</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-[#0E0E12] border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-300 font-mono focus:outline-none focus:border-[#18CFFC]"
              />
              <Button
                size="sm"
                variant={copied ? 'secondary' : 'primary'}
                onClick={handleCopy}
                leftIcon={copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          {/* Sharing Channels Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
            {/* WhatsApp */}
            <a
              href={generateWhatsAppShareUrl(payload)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-semibold transition-all hover:scale-[1.02] cursor-pointer"
            >
              <span className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center font-bold">
                WA
              </span>
              <span>WhatsApp</span>
            </a>

            {/* Native Share */}
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-[#18CFFC]/10 hover:bg-[#18CFFC]/20 border border-[#18CFFC]/20 text-[#18CFFC] text-xs font-semibold transition-all hover:scale-[1.02] cursor-pointer"
              >
                <span className="w-7 h-7 rounded-lg bg-[#18CFFC]/20 flex items-center justify-center">
                  <Share2 size={14} />
                </span>
                <span>Device Share</span>
              </button>
            )}

            {/* Twitter / X */}
            <a
              href={generateTwitterShareUrl(payload)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold transition-all hover:scale-[1.02] cursor-pointer"
            >
              <span className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center font-bold">
                𝕏
              </span>
              <span>Twitter / X</span>
            </a>

            {/* LinkedIn */}
            <a
              href={generateLinkedInShareUrl(payload)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-400 text-xs font-semibold transition-all hover:scale-[1.02] cursor-pointer"
            >
              <span className="w-7 h-7 rounded-lg bg-sky-500/20 flex items-center justify-center font-bold">
                in
              </span>
              <span>LinkedIn</span>
            </a>
          </div>

          {/* Instagram Story Helper */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#7F1AFB]/10 to-[#ED47FC]/10 border border-[#7F1AFB]/20 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Camera size={14} className="text-[#ED47FC]" /> Instagram Story Helper
              </span>
              <span className="text-[10px] text-zinc-400">Story Sticker</span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              Copy the caption teaser below and paste into your Instagram Story, then add a Link Sticker with your event URL!
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyIgText}
                leftIcon={igCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                className="text-[11px] h-8"
              >
                {igCopied ? 'Caption Copied!' : 'Copy Story Caption'}
              </Button>
              {event.posterUrl && (
                <a
                  href={event.posterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download="event-poster.jpg"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors"
                >
                  <Download size={12} /> Poster
                </a>
              )}
            </div>
          </div>
        </div>
      </ModalBody>
    </Modal>
  )
}
