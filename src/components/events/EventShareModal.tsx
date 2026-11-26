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
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0 font-bold">
              <Share2 size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-gray-900 truncate font-display">{event.title}</h4>
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {event.clubName || 'FestFlow Campus'} {event.venue ? `• ${event.venue}` : ''}
              </p>
            </div>
          </div>

          {/* Quick Copy Link Bar */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-700">Direct Event Link</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 font-mono focus:outline-none focus:border-blue-600"
              />
              <Button
                size="sm"
                variant={copied ? 'secondary' : 'primary'}
                onClick={handleCopy}
                leftIcon={copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
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
              className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-semibold transition-all cursor-pointer"
            >
              <span className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center font-bold">
                WA
              </span>
              <span>WhatsApp</span>
            </a>

            {/* Native Share */}
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-semibold transition-all cursor-pointer"
              >
                <span className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
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
              className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-900 text-xs font-semibold transition-all cursor-pointer"
            >
              <span className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center font-bold">
                𝕏
              </span>
              <span>Twitter / X</span>
            </a>

            {/* LinkedIn */}
            <a
              href={generateLinkedInShareUrl(payload)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 text-xs font-semibold transition-all cursor-pointer"
            >
              <span className="w-7 h-7 rounded-lg bg-sky-100 flex items-center justify-center font-bold">
                in
              </span>
              <span>LinkedIn</span>
            </a>
          </div>

          {/* Instagram Story Helper */}
          <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <Camera size={14} className="text-indigo-600" /> Instagram Story Helper
              </span>
              <span className="text-[10px] text-gray-500">Story Sticker</span>
            </div>
            <p className="text-[11px] text-gray-600 leading-relaxed">
              Copy the caption teaser below and paste into your Instagram Story, then add a Link Sticker with your event URL!
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyIgText}
                leftIcon={igCopied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 transition-colors"
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
