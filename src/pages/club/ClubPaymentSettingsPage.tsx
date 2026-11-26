import { useState, useEffect } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import {
  QrCode,
  CheckCircle2,
  Upload,
  ExternalLink,
  Building2,
  CreditCard,
  Globe,
  User,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react'
import { Button, Card, PageHeader, Alert, EmptyState } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { useAuth } from '@/context/AuthContext'
import {
  getClubPaymentSettings,
  saveClubPaymentSettings,
  uploadClubPaymentQr,
  validateUpiId,
} from '@/lib/payments'
import { ROLE_LABELS } from '@/lib/clubMembers'

export default function ClubPaymentSettingsPage() {
  const {
    profile,
    clubProfile,
    activeClubId,
    activeClubMembership,
    activeClubProfile,
    activeClubRole,
    clubMemberships,
    hasClubPermission,
    isRoleLoading,
    role,
    updateProfile,
  } = useAuth()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const isPlatformAdmin = role === 'platform_admin'
  const clubId = activeClubId || null
  const sourceClubProfile = activeClubProfile || clubProfile
  const currentClubName =
    activeClubProfile?.club_name ||
    activeClubMembership?.club_name ||
    clubProfile?.club_name ||
    profile?.display_name ||
    'Campus Club'
  const currentRepName =
    activeClubProfile?.representative_name ||
    clubProfile?.representative_name ||
    profile?.display_name ||
    ''

  const canManageClub = isPlatformAdmin || hasClubPermission('club.manage')
  const canManagePaymentSettings = isPlatformAdmin || hasClubPermission('payments.settings')
  const canReviewPayments = isPlatformAdmin || hasClubPermission('payments.verify')
  const canAccessSettings = canManageClub || canManagePaymentSettings

  // Determine active tab from URL or query, respecting permitted tab scope
  const requestedTab =
    searchParams.get('tab') === 'profile'
      ? 'profile'
      : location.pathname.endsWith('/payments')
      ? 'payments'
      : 'profile'

  const initialTab =
    requestedTab === 'payments' && !canManagePaymentSettings && canManageClub
      ? 'profile'
      : requestedTab === 'profile' && !canManageClub && canManagePaymentSettings
      ? 'payments'
      : requestedTab

  const [activeTab, setActiveTab] = useState<'profile' | 'payments'>(initialTab)

  // Payment Settings form state
  const [upiId, setUpiId] = useState('')
  const [accountName, setAccountName] = useState('')
  const [paymentInstructions, setPaymentInstructions] = useState('')
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null)

  // Club Profile form state
  const [clubNameInput, setClubNameInput] = useState(currentClubName)
  const [repNameInput, setRepNameInput] = useState(currentRepName)
  const [websiteInput, setWebsiteInput] = useState(sourceClubProfile?.website_url || '')
  const [descriptionInput, setDescriptionInput] = useState(sourceClubProfile?.description || '')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingQr, setUploadingQr] = useState(false)
  const [notice, setNotice] = useState<{ message: string; isError?: boolean } | null>(null)

  // Keep active tab within permitted tabs if roles change dynamically
  useEffect(() => {
    if (activeTab === 'profile' && !canManageClub && canManagePaymentSettings) {
      setActiveTab('payments')
    } else if (activeTab === 'payments' && !canManagePaymentSettings && canManageClub) {
      setActiveTab('profile')
    }
  }, [activeTab, canManageClub, canManagePaymentSettings])

  // Sync profile inputs when activeClubProfile or clubProfile updates
  useEffect(() => {
    if (activeClubProfile) {
      setClubNameInput(activeClubProfile.club_name || '')
      setRepNameInput(activeClubProfile.representative_name || profile?.display_name || '')
      setWebsiteInput(activeClubProfile.website_url || '')
      setDescriptionInput(activeClubProfile.description || '')
    } else if (clubProfile) {
      setClubNameInput(clubProfile.club_name || '')
      setRepNameInput(clubProfile.representative_name || profile?.display_name || '')
      setWebsiteInput(clubProfile.website_url || '')
      setDescriptionInput(clubProfile.description || '')
    } else if (profile) {
      setClubNameInput(profile.display_name || 'Campus Club')
      setRepNameInput(profile.display_name || '')
    }
  }, [activeClubProfile, clubProfile, profile])

  // Load payment settings
  useEffect(() => {
    let mounted = true
    if (isRoleLoading) return
    if (!clubId || !canManagePaymentSettings) {
      setLoading(false)
      return
    }
    setLoading(true)
    getClubPaymentSettings(clubId).then((settings) => {
      if (!mounted) return
      setLoading(false)
      if (settings) {
        setUpiId(settings.upi_id || '')
        setAccountName(settings.account_name || currentClubName)
        setPaymentInstructions(settings.payment_instructions || '')
        setQrImageUrl(settings.qr_image_url || null)
      } else {
        setUpiId('')
        setQrImageUrl(null)
        setAccountName(currentClubName)
        setPaymentInstructions(
          'Please mention your student name and registration code in the transaction note. Keep the 12-digit UTR handy for verification.'
        )
      }
    })
    return () => {
      mounted = false
    }
  }, [clubId, currentClubName, canManagePaymentSettings, isRoleLoading, activeClubRole])

  const handleTabChange = (tab: 'profile' | 'payments') => {
    if (tab === 'profile' && !canManageClub) return
    if (tab === 'payments' && !canManagePaymentSettings) return
    setActiveTab(tab)
    setNotice(null)
    setSearchParams({ tab }, { replace: true })
  }

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canManagePaymentSettings || !clubId) return
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

  const handleSavePayments = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canManagePaymentSettings || !clubId) return
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canManageClub || !clubId) return
    setNotice(null)

    if (!clubNameInput.trim()) {
      setNotice({ message: 'Club organization name cannot be empty.', isError: true })
      return
    }

    if (!repNameInput.trim()) {
      setNotice({ message: 'Club Lead / Representative name cannot be empty.', isError: true })
      return
    }

    if (websiteInput.trim() && !/^https?:\/\/.+/i.test(websiteInput.trim())) {
      setNotice({ message: 'Website must start with http:// or https://', isError: true })
      return
    }

    setSaving(true)
    const res = await updateProfile({
      clubName: clubNameInput.trim(),
      repName: repNameInput.trim(),
      displayName: repNameInput.trim(),
      websiteUrl: websiteInput.trim() || undefined,
      description: descriptionInput.trim() || undefined,
    })
    setSaving(false)

    if (res.error) {
      setNotice({ message: res.error, isError: true })
    } else {
      setNotice({ message: 'Club organization profile updated successfully!' })
      // Keep payment account name synced if unchanged
      if (!accountName || accountName === currentClubName) {
        setAccountName(clubNameInput.trim())
      }
    }
  }

  if (!clubId) {
    return (
      <PageShell>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 text-left">
          <div className="flex items-center gap-2 text-xs text-gray-500 border-b border-gray-200 pb-4">
            <Link
              to="/club/dashboard"
              className="hover:text-[var(--color-text-primary)] flex items-center gap-1 transition-colors"
            >
              <ArrowLeft size={14} /> Club Dashboard
            </Link>
            <span>/</span>
            <span className="text-[var(--color-text-primary)] font-medium">Club Settings</span>
          </div>
          <EmptyState
            icon={AlertTriangle}
            title="No Active Organization Found"
            description="You do not have an active club profile or authorized club membership. To manage club settings and UPI payment gateways, you must be a registered club owner or an authorized administrator."
            action={
              <Link to="/club/dashboard">
                <Button variant="primary" size="sm">
                  Go to Club Dashboard
                </Button>
              </Link>
            }
          />
        </div>
      </PageShell>
    )
  }

  if (!isRoleLoading && !canAccessSettings) {
    return (
      <PageShell>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 text-left">
          <PageHeader
            breadcrumbs={[
              { label: 'Club Dashboard', href: '/club/dashboard' },
              { label: 'Club Settings' },
            ]}
            title="Club Settings & Operations"
            badge="Access Restricted"
            badgeVariant="danger"
            subtitle={`Configure your official student organization profile and manage direct zero-commission UPI payment channels.`}
          />
          <EmptyState
            icon={AlertTriangle}
            title="Role Permission Required"
            description={`Your current role (${activeClubRole ? ROLE_LABELS[activeClubRole] : 'Staff Member'}) in ${currentClubName} does not have permission to modify organization profiles or UPI gateway settings. Only Club Owners and Administrators can manage these settings.`}
            action={
              canReviewPayments ? (
                <Link to="/club/payments">
                  <Button variant="primary" size="sm">
                    Go to Payments Review
                  </Button>
                </Link>
              ) : (
                <Link to="/club/dashboard">
                  <Button variant="primary" size="sm">
                    Back to Dashboard
                  </Button>
                </Link>
              )
            }
          />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 text-left">
        {/* Page Header */}
        <PageHeader
          breadcrumbs={[
            { label: 'Club Dashboard', href: '/club/dashboard' },
            { label: 'Club Settings' },
          ]}
          title="Club Settings & Operations"
          badge={clubMemberships.length > 1 ? `${currentClubName} (Active)` : 'Club Administration'}
          badgeVariant="purple"
          subtitle={`Configure your official student organization profile and manage direct zero-commission UPI payment channels.`}
          actions={
            canReviewPayments ? (
              <Link to="/club/payments">
                <Button variant="outline" size="sm" rightIcon={<ExternalLink size={14} />}>
                  Review Student Payments
                </Button>
              </Link>
            ) : undefined
          }
        />

        {/* Section Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl border border-gray-200 text-xs">
          {canManageClub && (
            <button
              type="button"
              onClick={() => handleTabChange('profile')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-white text-gray-900 font-semibold shadow-xs border border-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Building2 size={16} />
              <span>Club Organization Profile</span>
            </button>
          )}

          {canManagePaymentSettings && (
            <button
              type="button"
              onClick={() => handleTabChange('payments')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === 'payments'
                  ? 'bg-white text-gray-900 font-semibold shadow-xs border border-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <CreditCard size={16} />
              <span>UPI & Payment Gateway</span>
            </button>
          )}
        </div>

        {/* Notice Feedback */}
        {notice && (
          <Alert variant={notice.isError ? 'error' : 'success'} dismissible onDismiss={() => setNotice(null)}>
            {notice.message}
          </Alert>
        )}

        {/* ── Tab 1: Club Organization Profile ──────────────────────────────── */}
        {activeTab === 'profile' && canManageClub && (
          <form onSubmit={handleSaveProfile}>
            <Card className="p-6 sm:p-8 flex flex-col gap-6">
              <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Club Organization Details
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Visible to campus students across event badges, tickets, and college directory feeds.
                  </p>
                </div>
                <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
                  <Building2 size={18} />
                </span>
              </div>

              {/* Club Name */}
              <div>
                <label
                  htmlFor="club_name_input"
                  className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2"
                >
                  Official Club / Organization Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="club_name_input"
                  type="text"
                  required
                  placeholder="e.g. ACM Student Chapter, Robotics Club, IEEE Society"
                  value={clubNameInput}
                  onChange={(e) => setClubNameInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-colors"
                />
              </div>

              {/* Representative / Lead Name */}
              <div>
                <label
                  htmlFor="rep_name_input"
                  className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2"
                >
                  Lead Representative / President <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    id="rep_name_input"
                    type="text"
                    required
                    placeholder="e.g. Alex Chen"
                    value={repNameInput}
                    onChange={(e) => setRepNameInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-colors"
                  />
                </div>
                <span className="text-[11px] text-gray-500 mt-1.5 block">
                  Official contact person authorized to manage events and verify attendee admission.
                </span>
              </div>

              {/* Official Website URL */}
              <div>
                <label
                  htmlFor="website_url_input"
                  className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2"
                >
                  Official Website or Linktree (Optional)
                </label>
                <div className="relative">
                  <Globe size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    id="website_url_input"
                    type="url"
                    placeholder="https://robotics-festflow.edu"
                    value={websiteInput}
                    onChange={(e) => setWebsiteInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-colors"
                  />
                </div>
              </div>

              {/* Club Description */}
              <div>
                <label
                  htmlFor="club_desc_input"
                  className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2"
                >
                  Club Mission & About (Optional)
                </label>
                <textarea
                  id="club_desc_input"
                  rows={3}
                  placeholder="Briefly describe your club, regular activities, and what students can expect when attending your events."
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-colors"
                />
              </div>

              {/* Form Actions */}
              <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-3">
                <Link to="/club/dashboard">
                  <Button type="button" variant="ghost" size="md">
                    Back to Dashboard
                  </Button>
                </Link>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={saving}
                  leftIcon={<CheckCircle2 size={16} />}
                >
                  {saving ? 'Saving Profile…' : 'Save Club Details'}
                </Button>
              </div>
            </Card>
          </form>
        )}

        {/* ── Tab 2: UPI Payment Gateway ───────────────────────────────────── */}
        {activeTab === 'payments' && canManagePaymentSettings && (
          <form onSubmit={handleSavePayments}>
            <Card className="p-6 sm:p-8 flex flex-col gap-6">
              {/* Security & Instructions Notice */}
              <Alert variant="info" title="Zero-Commission Direct Organizer UPI Transfers">
                Students send payments directly to your official club UPI ID via their preferred app (Google Pay, PhonePe, Paytm). FestFlow does not hold your funds, take commissions, or ask for your UPI PIN or banking passwords.
              </Alert>

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin" />
                  <span className="text-xs text-gray-500">Loading payment configuration…</span>
                </div>
              ) : (
                <>
                  {/* UPI ID */}
                  <div>
                    <label
                      htmlFor="upi_id"
                      className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2"
                    >
                      Club Official UPI ID <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="upi_id"
                        type="text"
                        required
                        placeholder="e.g. acm.chapter@okaxis or robotics.fest@icici"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-colors font-mono"
                      />
                    </div>
                    <span className="text-[11px] text-gray-500 mt-1.5 block">
                      Format: username@bank. Make sure this UPI handle is active and linked to your club bank or organizer account.
                    </span>
                  </div>

                  {/* Account / Display Name */}
                  <div>
                    <label
                      htmlFor="account_name"
                      className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2"
                    >
                      Payee Display Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="account_name"
                      type="text"
                      required
                      placeholder="e.g. Campus Robotics Club or ACM Student Chapter"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-colors"
                    />
                    <span className="text-[11px] text-gray-500 mt-1.5 block">
                      This payee name will be shown to students on the payment checkout page so they can verify before confirming the transfer in their UPI app.
                    </span>
                  </div>

                  {/* Custom Payment Instructions */}
                  <div>
                    <label
                      htmlFor="payment_instructions"
                      className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2"
                    >
                      Custom Payment Instructions (Optional)
                    </label>
                    <textarea
                      id="payment_instructions"
                      rows={3}
                      placeholder="e.g. Please put your registration number in the payment note. Verification takes up to 2 hours."
                      value={paymentInstructions}
                      onChange={(e) => setPaymentInstructions(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-colors"
                    />
                  </div>

                  {/* Optional QR Code Upload */}
                  <div className="pt-2 border-t border-gray-200">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">
                      Custom UPI QR Code Image (Optional)
                    </label>
                    <p className="text-xs text-gray-500 mb-4">
                      If uploaded, students will see this official club QR image directly on screen to scan with any UPI app.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      {qrImageUrl ? (
                        <div className="relative group shrink-0">
                          <img
                            src={qrImageUrl}
                            alt="Club Payment QR"
                            className="w-36 h-36 object-contain rounded-xl bg-white p-2 border border-gray-200 shadow-xs"
                          />
                          <button
                            type="button"
                            onClick={() => setQrImageUrl(null)}
                            className="absolute -top-2 -right-2 bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-full text-xs shadow cursor-pointer"
                            title="Remove QR Image"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="w-36 h-36 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 bg-gray-50 shrink-0">
                          <QrCode size={36} className="opacity-50 mb-1" />
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
                        <span className="text-[11px] text-gray-500">
                          PNG, JPG or WEBP up to 5MB.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-3">
                    <Link to="/club/dashboard">
                      <Button type="button" variant="ghost" size="md">
                        Back to Dashboard
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
        )}
      </div>
    </PageShell>
  )
}
