import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import {
  QrCode,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Upload,
  ArrowLeft,
  Info,
  ExternalLink,
} from 'lucide-react'
import { Button, Card, Badge } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/context/AuthContext'
import {
  getClubPaymentSettings,
  saveClubPaymentSettings,
  uploadClubPaymentQr,
  validateUpiId,
} from '@/lib/payments'
import { fadeIn } from '@/lib/animations'

export default function ClubPaymentSettingsPage() {
  const { user, profile, clubProfile } = useAuth()
  const clubId = user?.id || 'demo_club_member_default'
  const clubName = clubProfile?.club_name || profile?.display_name || 'Campus Club'

  const [upiId, setUpiId] = useState('')
  const [accountName, setAccountName] = useState('')
  const [paymentInstructions, setPaymentInstructions] = useState('')
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingQr, setUploadingQr] = useState(false)
  const [notice, setNotice] = useState<{ message: string; isError?: boolean } | null>(null)

  useEffect(() => {
    let mounted = true
    getClubPaymentSettings(clubId).then((settings) => {
      if (!mounted) return
      setLoading(false)
      if (settings) {
        setUpiId(settings.upi_id || '')
        setAccountName(settings.account_name || clubName)
        setPaymentInstructions(settings.payment_instructions || '')
        setQrImageUrl(settings.qr_image_url || null)
      } else {
        setAccountName(clubName)
        setPaymentInstructions(
          'Please mention your student name and registration code in the transaction note. Keep the 12-digit UTR handy for verification.'
        )
      }
    })
    return () => {
      mounted = false
    }
  }, [clubId, clubName])

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setNotice({ message: 'Please upload an image file (PNG, JPG, or WEBP).', isError: true })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setNotice({ message: 'QR image must be under 5MB.', isError: true })
      return
    }

    setUploadingQr(true)
    setNotice(null)
    const res = await uploadClubPaymentQr(clubId, file)
    setUploadingQr(false)

    if (res.success && res.url) {
      setQrImageUrl(res.url)
      setNotice({ message: 'Payment QR image uploaded successfully.' })
    } else {
      setNotice({ message: res.error || 'Failed to upload QR image.', isError: true })
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setNotice(null)

    if (!validateUpiId(upiId)) {
      setNotice({
        message: 'Invalid UPI ID format. Standard format is username@bank (e.g. techfest@okaxis).',
        isError: true,
      })
      return
    }

    if (!accountName.trim()) {
      setNotice({ message: 'Account / display name is required.', isError: true })
      return
    }

    setSaving(true)
    const res = await saveClubPaymentSettings({
      clubId,
      upi_id: upiId,
      account_name: accountName,
      payment_instructions: paymentInstructions,
      qr_image_url: qrImageUrl,
    })
    setSaving(false)

    if (res.success) {
      setNotice({ message: 'UPI payment settings saved successfully!' })
    } else {
      setNotice({ message: res.message, isError: true })
    }
  }

  return (
    <PageShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 text-left">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] border-b border-[var(--color-surface-3)] pb-4">
          <Link
            to="/club/dashboard"
            className="hover:text-[var(--color-text-primary)] flex items-center gap-1 transition-colors"
          >
            <ArrowLeft size={14} /> Club Dashboard
          </Link>
          <span>/</span>
          <span className="text-[var(--color-text-primary)] font-medium">UPI Payment Settings</span>
        </div>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold font-display text-[var(--color-text-primary)]">
                UPI Payment Settings
              </h1>
              <Badge variant="purple" className="flex items-center gap-1">
                <ShieldCheck size={12} /> Club Finance
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
              Configure your club's official UPI ID and QR code to receive student registrations for paid events.
            </p>
          </div>
          <Link to="/club/payments">
            <Button variant="outline" size="sm" rightIcon={<ExternalLink size={14} />}>
              Review Payments
            </Button>
          </Link>
        </div>

        {/* Security & Instructions Notice */}
        <Card className="p-4 bg-[var(--color-brand-purple)]/5 border-[var(--color-brand-purple)]/20 flex gap-3 items-start">
          <Info size={18} className="text-[var(--color-brand-purple)] shrink-0 mt-0.5" />
          <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed space-y-1">
            <p className="text-[var(--color-text-primary)] font-medium">
              Zero-Commission Direct UPI Settlements
            </p>
            <p>
              Students send payments directly to your official club UPI ID via their preferred app (Google Pay, PhonePe, Paytm). FestFlow does not hold your funds, take commissions, or ask for your UPI PIN or banking passwords.
            </p>
          </div>
        </Card>

        {notice && (
          <motion.div
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            className={`p-4 rounded-xl border text-xs sm:text-sm flex items-center gap-3 ${
              notice.isError
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}
          >
            {notice.isError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span className="flex-1">{notice.message}</span>
          </motion.div>
        )}

        {/* Settings Form */}
        <form onSubmit={handleSave}>
          <Card className="p-6 sm:p-8 flex flex-col gap-6">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--color-surface-3)] border-t-[var(--color-brand-purple)] animate-spin" />
                <span className="text-xs text-[var(--color-text-muted)]">Loading payment settings…</span>
              </div>
            ) : (
              <>
                {/* UPI ID */}
                <div>
                  <label
                    htmlFor="upi_id"
                    className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2"
                  >
                    Club Official UPI ID <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="upi_id"
                      type="text"
                      required
                      placeholder="e.g. acm.chapter@okaxis or robotics.fest@icici"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-brand-purple)] transition-colors font-mono"
                    />
                  </div>
                  <span className="text-[11px] text-[var(--color-text-muted)] mt-1.5 block">
                    Format: username@bank. Make sure this UPI handle is active and linked to your club bank or organizer account.
                  </span>
                </div>

                {/* Account / Display Name */}
                <div>
                  <label
                    htmlFor="account_name"
                    className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2"
                  >
                    Payee Display Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    id="account_name"
                    type="text"
                    required
                    placeholder="e.g. Campus Robotics Club or ACM Student Chapter"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-brand-purple)] transition-colors"
                  />
                  <span className="text-[11px] text-[var(--color-text-muted)] mt-1.5 block">
                    This payee name will be shown to students on the payment checkout page so they can verify before confirming the transfer in their UPI app.
                  </span>
                </div>

                {/* Custom Payment Instructions */}
                <div>
                  <label
                    htmlFor="payment_instructions"
                    className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2"
                  >
                    Custom Payment Instructions (Optional)
                  </label>
                  <textarea
                    id="payment_instructions"
                    rows={3}
                    placeholder="e.g. Please put your registration number in the payment note. Verification takes up to 2 hours."
                    value={paymentInstructions}
                    onChange={(e) => setPaymentInstructions(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-brand-purple)] transition-colors"
                  />
                </div>

                {/* Optional QR Code Upload */}
                <div className="pt-2 border-t border-[var(--color-surface-3)]">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
                    Custom UPI QR Code Image (Optional)
                  </label>
                  <p className="text-xs text-[var(--color-text-muted)] mb-4">
                    If uploaded, students will see this official club QR image directly on screen to scan with any UPI app.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    {qrImageUrl ? (
                      <div className="relative group shrink-0">
                        <img
                          src={qrImageUrl}
                          alt="Club Payment QR"
                          className="w-36 h-36 object-contain rounded-xl bg-white p-2 border border-[var(--color-surface-3)] shadow-md"
                        />
                        <button
                          type="button"
                          onClick={() => setQrImageUrl(null)}
                          className="absolute -top-2 -right-2 bg-rose-600 hover:bg-rose-500 text-white p-1 rounded-full text-xs shadow"
                          title="Remove QR Image"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="w-36 h-36 rounded-xl border-2 border-dashed border-[var(--color-surface-3)] flex flex-col items-center justify-center text-[var(--color-text-muted)] bg-[var(--color-surface-1)] shrink-0">
                        <QrCode size={36} className="opacity-40 mb-1" />
                        <span className="text-[10px]">No Custom QR</span>
                      </div>
                    )}

                    <div className="flex flex-col gap-2 w-full sm:w-auto">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={handleQrUpload}
                          disabled={uploadingQr}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          isLoading={uploadingQr}
                          leftIcon={<Upload size={14} />}
                        >
                          {uploadingQr ? 'Uploading QR…' : qrImageUrl ? 'Replace QR Code' : 'Upload Club QR Image'}
                        </Button>
                      </label>
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        PNG, JPG or WEBP up to 5MB.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="pt-4 border-t border-[var(--color-surface-3)] flex items-center justify-end gap-3">
                  <Link to="/club/dashboard">
                    <Button type="button" variant="ghost" size="md">
                      Cancel
                    </Button>
                  </Link>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={saving}
                    leftIcon={<CheckCircle2 size={16} />}
                  >
                    {saving ? 'Saving Settings…' : 'Save Payment Settings'}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </form>
      </div>
    </PageShell>
  )
}
