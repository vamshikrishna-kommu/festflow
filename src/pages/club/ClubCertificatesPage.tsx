import { useState, useEffect, useMemo } from 'react'
import {
  Award,
  Plus,
  Search,
  CheckCircle2,
  RotateCcw,
  Eye,
  Trash2,
  Users,
  Settings2,
  FileCheck,
  ShieldCheck,
  Clock,
  TrendingUp,
} from 'lucide-react'
import { Button, Modal, ModalBody, ModalFooter } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import type {
  EventCertificateRecord,
  CertificateTemplateRecord,
  CertificateEligibilityCandidate,
  CertificateCategory,
  EventRecord,
} from '@/types'
import {
  getClubCertificates,
  getEventCertificateEligibility,
  issueBulkCertificates,
  revokeCertificate,
  reissueCertificate,
} from '@/lib/certificates'
import {
  getClubCertificateTemplates,
  createCertificateTemplate,
} from '@/lib/certificateTemplates'
import { listClubEvents } from '@/lib/events'
import { CertificatePreviewModal } from '@/components/certificates/CertificatePreviewModal'

export default function ClubCertificatesPage() {
  const { user, activeClubId, activeClubProfile } = useAuth()
  const clubId = activeClubId || user?.id || ''

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'issued' | 'bulk_issue' | 'templates' | 'analytics'>('issued')

  // Data States
  const [loading, setLoading] = useState(true)
  const [certificates, setCertificates] = useState<EventCertificateRecord[]>([])
  const [templates, setTemplates] = useState<CertificateTemplateRecord[]>([])
  const [events, setEvents] = useState<EventRecord[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('')

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  // Selected Certificate for Preview
  const [previewCert, setPreviewCert] = useState<EventCertificateRecord | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Revocation Modal State
  const [revokeModalOpen, setRevokeModalOpen] = useState(false)
  const [certToRevoke, setCertToRevoke] = useState<EventCertificateRecord | null>(null)
  const [revocationReason, setRevocationReason] = useState('')
  const [isRevoking, setIsRevoking] = useState(false)

  // Reissuance Modal State
  const [reissueModalOpen, setReissueModalOpen] = useState(false)
  const [certToReissue, setCertToReissue] = useState<EventCertificateRecord | null>(null)
  const [correctedName, setCorrectedName] = useState('')
  const [correctedCategory, setCorrectedCategory] = useState<CertificateCategory>('participation')
  const [isReissuing, setIsReissuing] = useState(false)

  // Bulk Issuance Wizard State
  const [wizardEventId, setWizardEventId] = useState<string>('')
  const [wizardCategory, setWizardCategory] = useState<CertificateCategory>('participation')
  const [wizardTemplateId, setWizardTemplateId] = useState<string>('')
  const [eligibilityCandidates, setEligibilityCandidates] = useState<CertificateEligibilityCandidate[]>([])
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([])
  const [loadingEligibility, setLoadingEligibility] = useState(false)
  const [isIssuingBatch, setIsIssuingBatch] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null)
  const [batchSuccessNotice, setBatchSuccessNotice] = useState<string | null>(null)

  // Template Designer Modal
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [tplName, setTplName] = useState('')
  const [tplTitle, setTplTitle] = useState('CERTIFICATE OF PARTICIPATION')
  const [tplSubtitle, setTplSubtitle] = useState('This is proudly presented to')
  const [tplBody, setTplBody] = useState('for outstanding participation and successful completion of {event_title} organized by {club_name} on {event_date}.')
  const [tplTheme, setTplTheme] = useState<'obsidian_gold' | 'cyan_cobalt' | 'royal_violet' | 'radiant_magenta' | 'minimal_ivory'>('obsidian_gold')
  const [tplSig1Name, setTplSig1Name] = useState('')
  const [tplSig1Role, setTplSig1Role] = useState('')
  const [tplSig2Name, setTplSig2Name] = useState('')
  const [tplSig2Role, setTplSig2Role] = useState('')
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)

  // Load Base Club Data
  useEffect(() => {
    async function loadData() {
      if (!clubId) return
      setLoading(true)

      const [certsRes, tplsRes, evtsRes] = await Promise.all([
        getClubCertificates(clubId),
        getClubCertificateTemplates(clubId),
        listClubEvents(clubId),
      ])

      setCertificates(certsRes.certificates)
      setTemplates(tplsRes.templates)
      setEvents(evtsRes.events || [])

      if (evtsRes.events && evtsRes.events.length > 0) {
        setWizardEventId(evtsRes.events[0].id)
      }
      if (tplsRes.templates && tplsRes.templates.length > 0) {
        setWizardTemplateId(tplsRes.templates[0].id)
      }

      setLoading(false)
    }

    loadData()
  }, [clubId])

  // Load Eligibility when Wizard Event Changes
  useEffect(() => {
    async function loadCandidates() {
      if (!wizardEventId) return
      setLoadingEligibility(true)
      const res = await getEventCertificateEligibility(wizardEventId)
      setLoadingEligibility(false)
      if (res.success) {
        setEligibilityCandidates(res.candidates)
        // Automatically preselect all eligible attendees
        const eligible = res.candidates.filter((c) => c.isEligible).map((c) => c.studentId)
        setSelectedCandidateIds(eligible)
      }
    }

    loadCandidates()
  }, [wizardEventId])

  // Filtered Certificates
  const filteredCertificates = useMemo(() => {
    return certificates.filter((c) => {
      const matchSearch =
        c.recipient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.certificate_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.event_title.toLowerCase().includes(searchQuery.toLowerCase())

      const matchCategory = categoryFilter === 'all' || c.category === categoryFilter
      const matchEvent = !selectedEventId || c.event_id === selectedEventId

      return matchSearch && matchCategory && matchEvent
    })
  }, [certificates, searchQuery, categoryFilter, selectedEventId])

  // Handle Revocation Submit
  const handleConfirmRevoke = async () => {
    if (!certToRevoke || !revocationReason.trim() || !user) return
    setIsRevoking(true)
    const res = await revokeCertificate(certToRevoke.id, revocationReason.trim(), user.id)
    setIsRevoking(false)
    if (res.success) {
      setCertificates((prev) =>
        prev.map((c) => (c.id === certToRevoke.id ? { ...c, status: 'revoked', revocation_reason: revocationReason.trim() } : c))
      )
      setRevokeModalOpen(false)
      setCertToRevoke(null)
      setRevocationReason('')
    }
  }

  // Handle Reissuance Submit
  const handleConfirmReissue = async () => {
    if (!certToReissue || !user) return
    setIsReissuing(true)
    const res = await reissueCertificate(
      certToReissue.id,
      {
        recipientName: correctedName.trim() || certToReissue.recipient_name,
        category: correctedCategory,
      },
      user.id
    )
    setIsReissuing(false)
    if (res.success && res.newCertificate) {
      setCertificates((prev) => [
        res.newCertificate!,
        ...prev.map((c) => (c.id === certToReissue.id ? { ...c, status: 'reissued' as const } : c)),
      ])
      setReissueModalOpen(false)
      setCertToReissue(null)
    }
  }

  // Handle Bulk Issuance Execution
  const handleExecuteBulkIssuance = async () => {
    if (!wizardEventId || selectedCandidateIds.length === 0) return
    const ev = events.find((e) => e.id === wizardEventId)
    const evTitle = ev?.title || 'Campus Event'
    const clubName = activeClubProfile?.club_name || 'FestFlow Club'

    const selectedCandidates = eligibilityCandidates.filter((c) =>
      selectedCandidateIds.includes(c.studentId)
    )

    setIsIssuingBatch(true)
    setBatchProgress({ current: 0, total: selectedCandidates.length })

    const res = await issueBulkCertificates(
      wizardEventId,
      clubId,
      evTitle,
      clubName,
      wizardTemplateId || null,
      wizardCategory,
      selectedCandidates.map((c) => ({
        studentId: c.studentId,
        registrationId: c.registrationId,
        recipientName: c.studentName,
        recipientCollege: c.studentCollege,
        recipientEmail: c.studentEmail,
      })),
      (processed, total) => {
        setBatchProgress({ current: processed, total })
      }
    )

    setIsIssuingBatch(false)
    setBatchProgress(null)
    setBatchSuccessNotice(
      `Successfully generated ${res.issued} certificates! (${res.skipped} skipped as already holding certificates).`
    )

    // Refresh certificates list
    const updated = await getClubCertificates(clubId)
    setCertificates(updated.certificates)

    // Refresh candidate eligibility list
    const elRes = await getEventCertificateEligibility(wizardEventId)
    if (elRes.success) setEligibilityCandidates(elRes.candidates)
  }

  // Handle Template Save
  const handleSaveTemplate = async () => {
    if (!tplName.trim()) return
    setIsSavingTemplate(true)
    const res = await createCertificateTemplate({
      club_id: clubId,
      name: tplName.trim(),
      theme: tplTheme,
      title_text: tplTitle.trim(),
      subtitle_text: tplSubtitle.trim(),
      body_template: tplBody.trim(),
      signatory_1_name: tplSig1Name.trim() || undefined,
      signatory_1_role: tplSig1Role.trim() || undefined,
      signatory_2_name: tplSig2Name.trim() || undefined,
      signatory_2_role: tplSig2Role.trim() || undefined,
      border_style: 'modern_double',
    })
    setIsSavingTemplate(false)
    if (res.success && res.template) {
      setTemplates((prev) => [res.template!, ...prev])
      setTemplateModalOpen(false)
      setTplName('')
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] pb-20">
      {/* Page Header */}
      <div className="border-b border-white/[0.08] bg-[var(--color-surface-1)]/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-mono text-[#18CFFC] uppercase font-bold tracking-wider mb-1">
              <ShieldCheck size={14} /> Official Credential Studio
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-['Syne'] text-white">
              Certificates & Achievements
            </h1>
            <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-0.5">
              Issue tamper-proof certificates, manage design templates, and review public verification logs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Plus size={14} />}
              onClick={() => setTemplateModalOpen(true)}
            >
              New Template
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Award size={14} />}
              onClick={() => setActiveTab('bulk_issue')}
            >
              Issue Certificates
            </Button>
          </div>
        </div>

        {/* Tab Navigation Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-6 overflow-x-auto text-xs font-semibold scrollbar-none">
          <button
            onClick={() => setActiveTab('issued')}
            className={`py-3.5 border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'issued'
                ? 'border-[#18CFFC] text-[#18CFFC]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-white'
            }`}
          >
            <FileCheck size={15} />
            <span>Issued Certificates ({certificates.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('bulk_issue')}
            className={`py-3.5 border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'bulk_issue'
                ? 'border-[#18CFFC] text-[#18CFFC]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-white'
            }`}
          >
            <Users size={15} />
            <span>Bulk Issuance Wizard</span>
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-3.5 border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'templates'
                ? 'border-[#18CFFC] text-[#18CFFC]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-white'
            }`}
          >
            <Settings2 size={15} />
            <span>Templates ({templates.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-3.5 border-b-2 flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'border-[#18CFFC] text-[#18CFFC]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-white'
            }`}
          >
            <TrendingUp size={15} />
            <span>Analytics</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* ── TAB 1: ISSUED CERTIFICATES LEDGER ───────────────────────────── */}
        {activeTab === 'issued' && (
          <div className="space-y-6">
            {/* Search & Filters Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  placeholder="Search by recipient name, certificate number, or event..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--color-surface-1)] border border-white/[0.08] text-xs text-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC]"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2.5 rounded-xl bg-[var(--color-surface-1)] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#18CFFC]"
                >
                  <option value="all">All Categories</option>
                  <option value="participation">Participation</option>
                  <option value="winner">Winner (1st)</option>
                  <option value="runner_up">Runner-Up (2nd)</option>
                  <option value="finalist">Finalist</option>
                  <option value="special_recognition">Special Recognition</option>
                  <option value="merit">Merit</option>
                </select>

                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="px-3 py-2.5 rounded-xl bg-[var(--color-surface-1)] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-[#18CFFC]"
                >
                  <option value="">All Events</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Certificates Table */}
            {loading ? (
              <div className="p-12 text-center rounded-2xl bg-[var(--color-surface-1)] border border-white/[0.08] text-xs font-mono text-white/50">
                Loading certificates...
              </div>
            ) : filteredCertificates.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-[var(--color-surface-1)] border border-white/[0.08]">
                <Award size={36} className="text-[var(--color-text-muted)] mx-auto mb-3" />
                <h3 className="text-base font-bold text-white">No certificates match your query</h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-sm mx-auto">
                  {certificates.length === 0
                    ? 'Your club has not issued any certificates yet. Use the Bulk Issuance Wizard to certify verified event attendees.'
                    : 'Try clearing your search query or category filters.'}
                </p>
                {certificates.length === 0 && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-4"
                    onClick={() => setActiveTab('bulk_issue')}
                  >
                    Open Bulk Issuance Wizard
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.08] bg-[var(--color-surface-1)] overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.02] border-b border-white/[0.08] text-[var(--color-text-muted)] font-mono uppercase text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Certificate ID</th>
                        <th className="py-3 px-4">Recipient</th>
                        <th className="py-3 px-4">Event Recognition</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Issue Date</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {filteredCertificates.map((cert) => {
                        const isRevoked = cert.status === 'revoked'
                        return (
                          <tr key={cert.id} className="hover:bg-white/[0.02] transition">
                            <td className="py-3.5 px-4 font-mono font-bold text-[#18CFFC]">
                              {cert.certificate_number}
                            </td>
                            <td className="py-3.5 px-4">
                              <p className="font-bold text-white">{cert.recipient_name}</p>
                              <p className="text-[10px] text-[var(--color-text-muted)]">
                                {cert.recipient_college || 'Student'}
                              </p>
                            </td>
                            <td className="py-3.5 px-4 text-gray-300 font-medium">
                              {cert.event_title}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono uppercase bg-white/[0.05] border border-white/[0.1] text-amber-300">
                                {cert.category.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-[var(--color-text-muted)]">
                              {new Date(cert.issue_date).toLocaleDateString()}
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase ${
                                  isRevoked
                                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                }`}
                              >
                                {isRevoked ? 'Revoked' : 'Active'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setPreviewCert(cert)
                                    setPreviewOpen(true)
                                  }}
                                  className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white transition"
                                  title="View Certificate"
                                >
                                  <Eye size={13} />
                                </button>

                                {!isRevoked && (
                                  <button
                                    onClick={() => {
                                      setCertToRevoke(cert)
                                      setRevokeModalOpen(true)
                                    }}
                                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
                                    title="Revoke Certificate"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    setCertToReissue(cert)
                                    setCorrectedName(cert.recipient_name)
                                    setCorrectedCategory(cert.category)
                                    setReissueModalOpen(true)
                                  }}
                                  className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-gray-300 transition"
                                  title="Reissue Corrected"
                                >
                                  <RotateCcw size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: BULK ISSUANCE WIZARD ─────────────────────────────────── */}
        {activeTab === 'bulk_issue' && (
          <div className="max-w-4xl mx-auto space-y-8">
            {batchSuccessNotice && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center justify-between">
                <span>{batchSuccessNotice}</span>
                <button onClick={() => setBatchSuccessNotice(null)} className="underline text-emerald-300">
                  Dismiss
                </button>
              </div>
            )}

            {/* Step 1: Select Event & Category */}
            <div className="p-6 rounded-2xl bg-[var(--color-surface-1)] border border-white/[0.08]">
              <h2 className="text-base font-extrabold font-['Syne'] text-white mb-4">
                1. Select Event & Credential Type
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-[var(--color-text-muted)] mb-1.5">
                    Target Campus Event
                  </label>
                  <select
                    value={wizardEventId}
                    onChange={(e) => setWizardEventId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#18CFFC]"
                  >
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title} ({ev.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-[var(--color-text-muted)] mb-1.5">
                    Award Category
                  </label>
                  <select
                    value={wizardCategory}
                    onChange={(e) => setWizardCategory(e.target.value as CertificateCategory)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#18CFFC]"
                  >
                    <option value="participation">Participation</option>
                    <option value="completion">Completion</option>
                    <option value="winner">Winner (1st Place)</option>
                    <option value="runner_up">Runner-Up (2nd Place)</option>
                    <option value="finalist">Finalist</option>
                    <option value="special_recognition">Special Recognition</option>
                    <option value="merit">Merit / Honorable</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-[var(--color-text-muted)] mb-1.5">
                    Certificate Template
                  </label>
                  <select
                    value={wizardTemplateId}
                    onChange={(e) => setWizardTemplateId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#18CFFC]"
                  >
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name} {tpl.is_default ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Step 2: Live Eligibility Matrix */}
            <div className="p-6 rounded-2xl bg-[var(--color-surface-1)] border border-white/[0.08]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-extrabold font-['Syne'] text-white">
                    2. Participant Eligibility Matrix
                  </h2>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    Only verified gate attendees are eligible for participation certificates. Award exceptions can be manually toggled.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[var(--color-text-muted)]">
                    {selectedCandidateIds.length} of {eligibilityCandidates.length} Selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (selectedCandidateIds.length === eligibilityCandidates.length) {
                        setSelectedCandidateIds([])
                      } else {
                        setSelectedCandidateIds(eligibilityCandidates.map((c) => c.studentId))
                      }
                    }}
                  >
                    {selectedCandidateIds.length === eligibilityCandidates.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
              </div>

              {loadingEligibility ? (
                <div className="p-8 text-center text-xs text-[var(--color-text-muted)]">
                  Loading registration and gate attendance records...
                </div>
              ) : eligibilityCandidates.length === 0 ? (
                <div className="p-8 text-center text-xs text-[var(--color-text-muted)]">
                  No confirmed registrations found for this event.
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06] border border-white/[0.08] rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                  {eligibilityCandidates.map((c) => {
                    const isSelected = selectedCandidateIds.includes(c.studentId)
                    return (
                      <div
                        key={c.studentId}
                        className={`p-3.5 flex items-center justify-between gap-3 transition ${
                          isSelected ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCandidateIds((prev) => [...prev, c.studentId])
                              } else {
                                setSelectedCandidateIds((prev) => prev.filter((id) => id !== c.studentId))
                              }
                            }}
                            className="rounded border-white/20 text-[#18CFFC] focus:ring-[#18CFFC]"
                          />
                          <div>
                            <p className="text-xs font-bold text-white">{c.studentName}</p>
                            <p className="text-[10px] text-[var(--color-text-muted)]">
                              {c.studentEmail || c.studentCollege || 'Attendee'}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          {c.hasAttended ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              <CheckCircle2 size={11} /> Attended
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                              <Clock size={11} /> No Gate Check-in
                            </span>
                          )}
                          {c.ineligibilityReason && (
                            <p className="text-[9px] text-[var(--color-text-muted)] mt-0.5 max-w-xs truncate">
                              {c.ineligibilityReason}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Step 3: Batch Action */}
            <div className="p-6 rounded-2xl bg-[var(--color-surface-1)] border border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-white">Ready for Bulk Issuance</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Generates tamper-proof credentials and dispatches records to student vaults immediately.
                </p>
              </div>

              <Button
                variant="primary"
                size="md"
                leftIcon={<Award size={15} />}
                isLoading={isIssuingBatch}
                disabled={selectedCandidateIds.length === 0 || isIssuingBatch}
                onClick={handleExecuteBulkIssuance}
              >
                {isIssuingBatch && batchProgress
                  ? `Issuing (${batchProgress.current}/${batchProgress.total})...`
                  : `Issue ${selectedCandidateIds.length} Certificates`}
              </Button>
            </div>
          </div>
        )}

        {/* ── TAB 3: CERTIFICATE TEMPLATES ─────────────────────────────────── */}
        {activeTab === 'templates' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold font-['Syne'] text-white">Certificate Design Templates</h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Customizable styles and signatory designations for your club's official credentials.
                </p>
              </div>

              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={() => setTemplateModalOpen(true)}
              >
                New Template
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="p-6 rounded-2xl bg-[var(--color-surface-1)] border border-white/[0.08] flex flex-col justify-between hover:border-white/[0.15] transition"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[#18CFFC] font-bold">
                        {tpl.theme.replace(/_/g, ' ')}
                      </span>
                      {tpl.is_default && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-[#18CFFC]/10 text-[#18CFFC] border border-[#18CFFC]/30">
                          Default
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-extrabold text-white">{tpl.name}</h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">{tpl.description}</p>
                    <div className="mt-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-xs">
                      <p className="font-bold text-gray-200">"{tpl.title_text}"</p>
                      <p className="text-[11px] text-[var(--color-text-muted)] mt-1 truncate">
                        Signatories: {tpl.signatory_1_name || 'Convener'} • {tpl.signatory_2_name || 'President'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs">
                    <span className="text-[var(--color-text-muted)]">Layout: {tpl.layout}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Create sample certificate for template preview
                        const sampleCert: EventCertificateRecord = {
                          id: 'sample_cert',
                          certificate_number: 'FF-2026-SAMPLE',
                          verification_token: 'FF-V-SAMPLE1234567890',
                          event_id: 'sample_event',
                          club_id: clubId,
                          student_id: user?.id || 'sample_student',
                          category: 'winner',
                          title: tpl.title_text,
                          recipient_name: 'Priya Sharma',
                          recipient_college: 'Anurag University',
                          recipient_email: 'priya@college.edu',
                          event_title: 'IoT Hackathon 2026',
                          club_name: activeClubProfile?.club_name || 'Innovation Club',
                          issue_date: new Date().toISOString().split('T')[0],
                          status: 'issued',
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                        }
                        setPreviewCert(sampleCert)
                        setPreviewOpen(true)
                      }}
                    >
                      Preview Layout
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 4: CERTIFICATE ANALYTICS ─────────────────────────────────── */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold font-['Syne'] text-white">Certificate Issuance Analytics</h2>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-[var(--color-surface-1)] border border-white/[0.08]">
                <p className="text-xs font-mono uppercase text-[var(--color-text-muted)]">Total Generated</p>
                <p className="text-3xl font-extrabold font-['Syne'] text-[#18CFFC] mt-2">
                  {certificates.length}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[var(--color-surface-1)] border border-white/[0.08]">
                <p className="text-xs font-mono uppercase text-[var(--color-text-muted)]">Active Verified</p>
                <p className="text-3xl font-extrabold font-['Syne'] text-emerald-400 mt-2">
                  {certificates.filter((c) => c.status === 'issued').length}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[var(--color-surface-1)] border border-white/[0.08]">
                <p className="text-xs font-mono uppercase text-[var(--color-text-muted)]">Podium Awards</p>
                <p className="text-3xl font-extrabold font-['Syne'] text-amber-400 mt-2">
                  {certificates.filter((c) => c.category === 'winner' || c.category === 'runner_up').length}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-[var(--color-surface-1)] border border-white/[0.08]">
                <p className="text-xs font-mono uppercase text-[var(--color-text-muted)]">Revoked</p>
                <p className="text-3xl font-extrabold font-['Syne'] text-red-400 mt-2">
                  {certificates.filter((c) => c.status === 'revoked').length}
                </p>
              </div>
            </div>

            {/* Event Breakdown List */}
            <div className="p-6 rounded-2xl bg-[var(--color-surface-1)] border border-white/[0.08]">
              <h3 className="text-sm font-bold text-white mb-4">Credentials Issued By Event</h3>
              <div className="divide-y divide-white/[0.06]">
                {events.map((ev) => {
                  const count = certificates.filter((c) => c.event_id === ev.id && c.status === 'issued').length
                  return (
                    <div key={ev.id} className="py-3 flex items-center justify-between text-xs">
                      <span className="font-semibold text-white">{ev.title}</span>
                      <span className="font-mono text-[#18CFFC] font-bold">{count} Issued</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Certificate Preview Modal ──────────────────────────────────────── */}
      <CertificatePreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        certificate={previewCert}
      />

      {/* ── Revocation Modal ──────────────────────────────────────────────── */}
      <Modal
        isOpen={revokeModalOpen}
        onClose={() => setRevokeModalOpen(false)}
        size="md"
        title="Revoke Certificate"
      >
        <ModalBody className="p-4 sm:p-6 space-y-4">
          <p className="text-xs text-[var(--color-text-muted)]">
            Revoking a certificate invalidates its public verification token immediately. The historical record is preserved for auditing.
          </p>
          <div>
            <label className="block text-xs font-mono uppercase text-[var(--color-text-muted)] mb-1">
              Mandatory Revocation Reason
            </label>
            <textarea
              value={revocationReason}
              onChange={(e) => setRevocationReason(e.target.value)}
              placeholder="e.g., Participant did not meet required criteria, or certificate issued in error..."
              rows={3}
              className="w-full p-3 rounded-xl bg-[var(--color-surface-2)] border border-white/[0.1] text-xs text-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-red-500"
            />
          </div>
        </ModalBody>
        <ModalFooter className="flex items-center justify-end gap-2 p-4">
          <Button variant="outline" size="sm" onClick={() => setRevokeModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            isLoading={isRevoking}
            disabled={!revocationReason.trim() || isRevoking}
            onClick={handleConfirmRevoke}
          >
            Confirm Revocation
          </Button>
        </ModalFooter>
      </Modal>

      {/* ── Reissuance Modal ──────────────────────────────────────────────── */}
      <Modal
        isOpen={reissueModalOpen}
        onClose={() => setReissueModalOpen(false)}
        size="md"
        title="Reissue Corrected Certificate"
      >
        <ModalBody className="p-4 sm:p-6 space-y-4">
          <p className="text-xs text-[var(--color-text-muted)]">
            This creates a fresh credential with a new verification ID while linking to the previous historical record.
          </p>
          <div>
            <label className="block text-xs font-mono uppercase text-[var(--color-text-muted)] mb-1">
              Corrected Recipient Name
            </label>
            <input
              type="text"
              value={correctedName}
              onChange={(e) => setCorrectedName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#18CFFC]"
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase text-[var(--color-text-muted)] mb-1">
              Category
            </label>
            <select
              value={correctedCategory}
              onChange={(e) => setCorrectedCategory(e.target.value as CertificateCategory)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#18CFFC]"
            >
              <option value="participation">Participation</option>
              <option value="winner">Winner (1st)</option>
              <option value="runner_up">Runner-Up (2nd)</option>
              <option value="finalist">Finalist</option>
              <option value="special_recognition">Special Recognition</option>
            </select>
          </div>
        </ModalBody>
        <ModalFooter className="flex items-center justify-end gap-2 p-4">
          <Button variant="outline" size="sm" onClick={() => setReissueModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            isLoading={isReissuing}
            onClick={handleConfirmReissue}
          >
            Reissue Certificate
          </Button>
        </ModalFooter>
      </Modal>

      {/* ── New Template Modal ────────────────────────────────────────────── */}
      <Modal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        size="lg"
        title="Create Certificate Template"
      >
        <ModalBody className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-[var(--color-text-muted)] mb-1">
                Template Name
              </label>
              <input
                type="text"
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                placeholder="e.g. Hackathon Excellence 2026"
                className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#18CFFC]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-[var(--color-text-muted)] mb-1">
                Visual Theme
              </label>
              <select
                value={tplTheme}
                onChange={(e) => setTplTheme(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#18CFFC]"
              >
                <option value="obsidian_gold">Obsidian & Gold</option>
                <option value="cyan_cobalt">Cyberpunk Cyan</option>
                <option value="royal_violet">Royal Violet</option>
                <option value="radiant_magenta">Radiant Magenta</option>
                <option value="minimal_ivory">Minimal Ivory</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-[var(--color-text-muted)] mb-1">
              Certificate Title
            </label>
            <input
              type="text"
              value={tplTitle}
              onChange={(e) => setTplTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#18CFFC]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-[var(--color-text-muted)] mb-1">
              Certificate Subtitle
            </label>
            <input
              type="text"
              value={tplSubtitle}
              onChange={(e) => setTplSubtitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#18CFFC]"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-[var(--color-text-muted)] mb-1">
              Certificate Body
            </label>
            <textarea
              rows={2}
              value={tplBody}
              onChange={(e) => setTplBody(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#18CFFC]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-[var(--color-text-muted)] mb-1">
                Signatory 1 Name
              </label>
              <input
                type="text"
                value={tplSig1Name}
                onChange={(e) => setTplSig1Name(e.target.value)}
                placeholder="e.g. Dr. Faculty Convener"
                className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#18CFFC]"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-[var(--color-text-muted)] mb-1">
                Signatory 1 Designation
              </label>
              <input
                type="text"
                value={tplSig1Role}
                onChange={(e) => setTplSig1Role(e.target.value)}
                placeholder="e.g. Head of Department"
                className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#18CFFC]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-[var(--color-text-muted)] mb-1">
                Signatory 2 Name
              </label>
              <input
                type="text"
                value={tplSig2Name}
                onChange={(e) => setTplSig2Name(e.target.value)}
                placeholder="e.g. Student Lead"
                className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#18CFFC]"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-[var(--color-text-muted)] mb-1">
                Signatory 2 Designation
              </label>
              <input
                type="text"
                value={tplSig2Role}
                onChange={(e) => setTplSig2Role(e.target.value)}
                placeholder="e.g. Club President"
                className="w-full px-3 py-2 rounded-xl bg-[var(--color-surface-2)] border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#18CFFC]"
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter className="flex items-center justify-end gap-2 p-4">
          <Button variant="outline" size="sm" onClick={() => setTemplateModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            isLoading={isSavingTemplate}
            disabled={!tplName.trim() || isSavingTemplate}
            onClick={handleSaveTemplate}
          >
            Create Template
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

