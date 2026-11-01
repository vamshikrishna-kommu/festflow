import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router'
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Award,
  Calendar,
  Building,
  CheckCircle2,
  ExternalLink,
  Download,
  Share2,
  ArrowLeft,
  Copy,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui'
import type { EventCertificateRecord } from '@/types'
import { verifyCertificate } from '@/lib/certificates'
import { downloadCertificatePng } from '@/lib/certificatePdf'
import { ShareAchievementCardModal } from '@/components/certificates/ShareAchievementCardModal'

export default function CertificateVerificationPage() {
  const { token, id } = useParams<{ token?: string; id?: string }>()
  const lookupToken = token || id || ''

  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'valid' | 'revoked' | 'invalid' | 'reissued'>('invalid')
  const [certificate, setCertificate] = useState<EventCertificateRecord | null>(null)
  const [message, setMessage] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [shareCardOpen, setShareCardOpen] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  useEffect(() => {
    async function runVerification() {
      if (!lookupToken) {
        setLoading(false)
        setStatus('invalid')
        setMessage('No verification token or certificate number was provided.')
        return
      }

      setLoading(true)
      const res = await verifyCertificate(lookupToken)
      setLoading(false)
      setStatus(res.status)
      setCertificate(res.certificate || null)
      setMessage(res.message)
    }

    runVerification()
  }, [lookupToken])

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = async () => {
    if (!certificate) return
    setIsDownloading(true)
    try {
      await downloadCertificatePng(certificate)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] flex flex-col justify-between selection:bg-[#18CFFC]/30 selection:text-white">
      {/* Top Banner Navigation */}
      <header className="border-b border-white/[0.08] bg-[var(--color-surface-1)]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#0D56FB] via-[#7F1AFB] to-[#18CFFC] flex items-center justify-center font-bold text-white text-sm shadow-md">
              F
            </div>
            <span className="font-extrabold text-lg font-['Syne'] tracking-tight group-hover:text-[#18CFFC] transition">
              Fest<span className="text-[#18CFFC]">Flow</span>
            </span>
          </Link>

          <Link
            to="/discover"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-white transition"
          >
            <ArrowLeft size={14} />
            <span>Discover Events</span>
          </Link>
        </div>
      </header>

      {/* Main Verification Content */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 sm:py-14 flex flex-col justify-center">
        {loading ? (
          <div className="p-12 text-center rounded-3xl bg-[var(--color-surface-1)] border border-white/[0.08] shadow-2xl">
            <div className="w-12 h-12 border-3 border-[#18CFFC] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold font-['Syne'] text-white">Verifying Certificate Authenticity...</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Validating cryptographic verification token against the FestFlow server registry.
            </p>
          </div>
        ) : status === 'valid' && certificate ? (
          /* Valid Certificate View */
          <div className="rounded-3xl bg-[var(--color-surface-1)] border border-emerald-500/30 shadow-2xl overflow-hidden">
            {/* Top Verified Header Strip */}
            <div className="p-6 sm:p-8 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent border-b border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <ShieldCheck size={28} />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold tracking-wider uppercase text-emerald-400">
                    <CheckCircle2 size={13} />
                    <span>Verified Authenticity</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-extrabold font-['Syne'] text-white">
                    Official Campus Credential
                  </h1>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-[11px] font-mono text-[var(--color-text-muted)] uppercase">Reference Number</p>
                <p className="text-base font-mono font-extrabold text-[#18CFFC]">{certificate.certificate_number}</p>
              </div>
            </div>

            {/* Credential Details Matrix */}
            <div className="p-6 sm:p-8 space-y-6">
              {/* Recipient Card */}
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-mono uppercase text-[var(--color-text-muted)] tracking-wider">
                    Conferred Recipient
                  </p>
                  <p className="text-2xl font-extrabold font-['Syne'] text-white mt-1">
                    {certificate.recipient_name}
                  </p>
                  {certificate.recipient_college && (
                    <p className="text-xs font-semibold text-gray-400 mt-0.5">{certificate.recipient_college}</p>
                  )}
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold tracking-wider uppercase self-start sm:self-auto">
                  <Award size={14} />
                  <span>{certificate.category.replace(/_/g, ' ')}</span>
                </div>
              </div>

              {/* Event & Club Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-text-muted)] mb-1">
                    <Building size={14} className="text-[#18CFFC]" />
                    <span>Issuing Club</span>
                  </div>
                  <p className="text-base font-bold text-white">{certificate.club_name}</p>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-text-muted)] mb-1">
                    <Calendar size={14} className="text-[#ED47FC]" />
                    <span>Date of Issue</span>
                  </div>
                  <p className="text-base font-bold text-white">
                    {new Date(certificate.issue_date).toLocaleDateString('en-US', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              {/* Event Title */}
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <p className="text-xs font-mono uppercase text-[var(--color-text-muted)] mb-1">Event Recognition</p>
                <p className="text-lg font-bold text-white">{certificate.event_title}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Issued for verified attendance and completion under authorized club governance.
                </p>
              </div>

              {/* Privacy Notice */}
              <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed italic border-t border-white/[0.06] pt-4">
                🔒 In accordance with FestFlow student privacy regulations, private participant contacts (email, phone, student ID) are never exposed via the public verification gateway.
              </p>
            </div>

            {/* Action Bar */}
            <div className="p-4 sm:p-6 bg-white/[0.02] border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                leftIcon={copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                onClick={handleCopyLink}
              >
                {copied ? 'Link Copied!' : 'Copy Verification Link'}
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Share2 size={14} />}
                  onClick={() => setShareCardOpen(true)}
                >
                  Share Card
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
            </div>
          </div>
        ) : status === 'revoked' ? (
          /* Revoked Certificate View */
          <div className="rounded-3xl bg-[var(--color-surface-1)] border border-red-500/40 shadow-2xl p-6 sm:p-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto mb-4">
              <ShieldAlert size={36} />
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-xs font-bold uppercase tracking-wider mb-2">
              Credential Revoked
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-['Syne'] text-white">
              Certificate No Longer Valid
            </h1>
            <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-left max-w-lg mx-auto">
              <p className="text-xs font-mono uppercase text-red-300 font-bold mb-1">Revocation Notice</p>
              <p className="text-xs text-red-200/90 leading-relaxed">{message}</p>
            </div>
            {certificate && (
              <div className="mt-6 text-xs text-[var(--color-text-muted)] space-y-1">
                <p>
                  Originally issued to: <strong className="text-white">{certificate.recipient_name}</strong>
                </p>
                <p>
                  Event: <strong className="text-white">{certificate.event_title}</strong>
                </p>
                <p>
                  Reference: <code className="text-[#18CFFC]">{certificate.certificate_number}</code>
                </p>
              </div>
            )}
            <div className="mt-8">
              <Link to="/discover">
                <Button variant="outline" size="sm">
                  Return to FestFlow Home
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* Invalid / Not Found View */
          <div className="rounded-3xl bg-[var(--color-surface-1)] border border-amber-500/30 shadow-2xl p-6 sm:p-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={36} />
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs font-bold uppercase tracking-wider mb-2">
              Unverified Identifier
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-['Syne'] text-white">
              Certificate Not Found
            </h1>
            <p className="text-xs sm:text-sm text-[var(--color-text-muted)] max-w-md mx-auto mt-2 leading-relaxed">
              No active or historical certificate record matches token: <code className="text-amber-400 font-mono">{lookupToken}</code>. The certificate may have been forged or deleted.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Link to="/discover">
                <Button variant="outline" size="sm">
                  Explore Verified Events
                </Button>
              </Link>
              <Link to="/contact">
                <Button variant="ghost" size="sm" leftIcon={<ExternalLink size={14} />}>
                  Report Forgery
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Share Achievement Modal */}
      {certificate && (
        <ShareAchievementCardModal
          isOpen={shareCardOpen}
          onClose={() => setShareCardOpen(false)}
          certificate={certificate}
        />
      )}

      {/* Public Footer */}
      <footer className="border-t border-white/[0.08] py-6 text-center text-xs text-[var(--color-text-muted)]">
        <p>
          Powered by <strong className="text-white">FestFlow 2.0 Credential Ledger</strong> • Verified Campus Event Management
        </p>
      </footer>
    </div>
  )
}

