// =============================================================================
// FESTFLOW — SUPER ADMIN VERIFIED COLLEGE DIRECTORY & INSTITUTION MASTER PAGE
// =============================================================================
// Multi-district coverage (Hyderabad, Medchal-Malkajgiri, Rangareddy, Sangareddy).
// Authoritative AISHE verification, CSV import/export, audit history, request review.
// =============================================================================

import React, { useState, useEffect } from 'react'
import {
  Plus,
  Search,
  Building2,
  Globe,
  Upload,
  Download,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  History,
  AlertCircle,
  FileSpreadsheet,
  MapPin,
  Check,
  X,
  ExternalLink,
} from 'lucide-react'
import { AdminLayout } from '@/components/admin/AdminLayout'
import { Button } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import {
  searchCollegesDirectory,
  saveCollegeRecord,
  setCollegeVerificationStatus,
  getCollegeVerificationHistory,
  getCollegeRequests,
  reviewCollegeRequest,
  parseAndValidateCollegeCsv,
  exportCollegesToCsv,
  getCollegeDirectoryMetrics,
  TELANGANA_DISTRICTS,
  INSTITUTION_TYPE_LABELS,
  type CollegeDirectoryRecord,
  type CollegeDistrict,
  type InstitutionType,
  type CollegeVerificationStatus,
  type CollegeVerificationHistoryRecord,
  type CollegeRequestRecord,
  type CollegeCsvValidationResult,
} from '@/lib/collegeDirectory'

type AdminCollegesTab = 'directory' | 'requests'

export default function AdminCollegesPage() {
  const { profile } = useAuth()
  const adminEmail = profile?.email || 'admin@festflow.online'
  const adminId = profile?.id

  // Tab State
  const [activeTab, setActiveTab] = useState<AdminCollegesTab>('directory')

  // Directory Filters & State
  const [colleges, setColleges] = useState<CollegeDirectoryRecord[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState<CollegeDistrict | 'all'>('all')
  const [selectedType, setSelectedType] = useState<InstitutionType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | CollegeVerificationStatus>('all')
  const [metrics, setMetrics] = useState({
    total: 0,
    verified: 0,
    pending: 0,
    unverified: 0,
    suspended: 0,
    rejected: 0,
    districtsCount: {
      Hyderabad: 0,
      'Medchal-Malkajgiri': 0,
      Rangareddy: 0,
      Sangareddy: 0,
      Other: 0,
    },
  })

  // Missing Requests State
  const [requests, setRequests] = useState<CollegeRequestRecord[]>([])
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0)
  const [requestStatusFilter, setRequestStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')

  // Modals State
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [currentCollege, setCurrentCollege] = useState<Partial<CollegeDirectoryRecord> | null>(null)

  const [verifyModalOpen, setVerifyModalOpen] = useState(false)
  const [targetVerifyCollege, setTargetVerifyCollege] = useState<CollegeDirectoryRecord | null>(null)
  const [verifyAuthority, setVerifyAuthority] = useState('AISHE')
  const [verifyReference, setVerifyReference] = useState('')
  const [verifyAcademicYear, setVerifyAcademicYear] = useState('2024-2025')
  const [verifyNotes, setVerifyNotes] = useState('')

  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [activeHistoryCollege, setActiveHistoryCollege] = useState<CollegeDirectoryRecord | null>(null)
  const [historyLogs, setHistoryLogs] = useState<CollegeVerificationHistoryRecord[]>([])

  const [csvModalOpen, setCsvModalOpen] = useState(false)
  const [csvValidation, setCsvValidation] = useState<CollegeCsvValidationResult | null>(null)
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvSuccessMessage, setCsvSuccessMessage] = useState<string | null>(null)

  // Request Review Prompt
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [targetRequest, setTargetRequest] = useState<CollegeRequestRecord | null>(null)
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve')
  const [reviewNotes, setReviewNotes] = useState('')

  // Load Directory Data
  const loadDirectory = async () => {
    try {
      const res = await searchCollegesDirectory({
        query: search,
        district: selectedDistrict,
        institutionType: selectedType,
        verifiedOnly: statusFilter === 'verified',
        limit: 100,
      })

      let list = res.colleges
      if (statusFilter !== 'all' && statusFilter !== 'verified') {
        list = list.filter((c) => c.verification_status === statusFilter)
      }

      setColleges(list)
      setTotalCount(res.totalCount)

      const m = await getCollegeDirectoryMetrics()
      setMetrics(m as any)
    } catch {
      // Handled
    }
  }

  // Load Requests Data
  const loadRequests = async () => {
    const list = await getCollegeRequests(requestStatusFilter)
    setRequests(list)
    const pending = list.filter((r) => r.status === 'pending').length
    setPendingRequestsCount(pending)
  }

  useEffect(() => {
    loadDirectory()
  }, [search, selectedDistrict, selectedType, statusFilter])

  useEffect(() => {
    loadRequests()
  }, [requestStatusFilter])

  // Save College from Modal
  const handleSaveCollege = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentCollege?.official_name?.trim() && !currentCollege?.name?.trim()) return

    await saveCollegeRecord(currentCollege, adminEmail, adminId)
    setEditModalOpen(false)
    setCurrentCollege(null)
    loadDirectory()
  }

  // Submit Verification Status Change
  const handleConfirmVerification = async (newStatus: CollegeVerificationStatus) => {
    if (!targetVerifyCollege) return

    await setCollegeVerificationStatus(targetVerifyCollege.id, newStatus, {
      authority: verifyAuthority,
      sourceReference: verifyReference,
      academicYear: verifyAcademicYear,
      notes: verifyNotes,
      adminEmail,
      adminId,
    })

    setVerifyModalOpen(false)
    setTargetVerifyCollege(null)
    loadDirectory()
  }

  // View Audit History
  const handleViewHistory = async (col: CollegeDirectoryRecord) => {
    setActiveHistoryCollege(col)
    const logs = await getCollegeVerificationHistory(col.id)
    setHistoryLogs(logs)
    setHistoryModalOpen(true)
  }

  // Handle CSV File Upload & Parsing
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (text) {
        const validation = parseAndValidateCollegeCsv(text, colleges)
        setCsvValidation(validation)
        setCsvSuccessMessage(null)
      }
    }
    reader.readAsText(file)
  }

  // Batch Import Valid CSV Rows
  const handleExecuteCsvImport = async () => {
    if (!csvValidation || csvValidation.validRows.length === 0) return
    setCsvImporting(true)

    try {
      let importedCount = 0
      for (const row of csvValidation.validRows) {
        await saveCollegeRecord(row, adminEmail, adminId)
        importedCount++
      }

      setCsvSuccessMessage(`Successfully imported ${importedCount} institutions into the directory!`)
      setCsvValidation(null)
      loadDirectory()
    } finally {
      setCsvImporting(false)
    }
  }

  // Export Directory as CSV
  const handleExportCsv = () => {
    const csvContent = exportCollegesToCsv(colleges)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `festflow_colleges_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Review (Approve/Reject) Request
  const handleConfirmReview = async () => {
    if (!targetRequest) return
    await reviewCollegeRequest(targetRequest.id, reviewAction, {
      adminNotes: reviewNotes,
      adminEmail,
      adminId,
      createAsVerified: true,
      authority: 'AISHE',
    })
    setReviewModalOpen(false)
    setTargetRequest(null)
    setReviewNotes('')
    loadRequests()
    loadDirectory()
  }

  return (
    <AdminLayout
      title="Verified College & Institution Directory"
      subtitle="Authoritative institution registry across Hyderabad, Medchal-Malkajgiri, Rangareddy, and Sangareddy."
      actions={
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportCsv}
            leftIcon={<Download size={14} />}
            className="text-white/70 hover:text-white border border-white/10"
          >
            Export CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCsvValidation(null)
              setCsvSuccessMessage(null)
              setCsvModalOpen(true)
            }}
            leftIcon={<Upload size={14} />}
            className="text-white/70 hover:text-white border border-white/10"
          >
            Import CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setCurrentCollege({
                district: 'Hyderabad',
                country: 'India',
                status: 'active',
                institution_type: 'affiliated_college',
                verification_status: 'verified',
                verification_authority: 'AISHE',
                academic_year: '2024-2025',
              })
              setEditModalOpen(true)
            }}
            leftIcon={<Plus size={15} />}
          >
            Add Institution
          </Button>
        </div>
      }
    >
      {/* Top Navigation Tabs */}
      <div className="flex items-center gap-4 border-b border-white/10 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('directory')}
          className={`flex items-center gap-2 pb-1 text-xs font-semibold transition-colors relative ${
            activeTab === 'directory' ? 'text-[#18CFFC]' : 'text-white/50 hover:text-white'
          }`}
        >
          <Building2 size={16} />
          <span>Institutions Directory ({totalCount})</span>
          {activeTab === 'directory' && (
            <span className="absolute bottom-[-13px] left-0 right-0 h-0.5 bg-[#18CFFC]" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 pb-1 text-xs font-semibold transition-colors relative ${
            activeTab === 'requests' ? 'text-[#18CFFC]' : 'text-white/50 hover:text-white'
          }`}
        >
          <Clock size={16} />
          <span>Missing College Requests</span>
          {pendingRequestsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black font-mono text-[10px] font-bold">
              {pendingRequestsCount}
            </span>
          )}
          {activeTab === 'requests' && (
            <span className="absolute bottom-[-13px] left-0 right-0 h-0.5 bg-[#18CFFC]" />
          )}
        </button>
      </div>

      {activeTab === 'directory' ? (
        <>
          {/* Quick Metrics KPI Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div
              onClick={() => {
                setStatusFilter('all')
                setSelectedDistrict('all')
              }}
              className="p-3.5 rounded-2xl bg-[#0D0E15] border border-white/5 hover:border-white/20 transition-all cursor-pointer"
            >
              <div className="text-[10px] uppercase font-mono text-white/40">Total Institutions</div>
              <div className="text-xl font-bold font-display text-white mt-0.5">{metrics.total}</div>
              <div className="text-[10px] text-white/50 mt-1 font-mono">4 Target Districts</div>
            </div>

            <div
              onClick={() => setStatusFilter('verified')}
              className="p-3.5 rounded-2xl bg-emerald-500/[0.03] border border-emerald-500/20 hover:border-emerald-500/40 transition-all cursor-pointer"
            >
              <div className="text-[10px] uppercase font-mono text-emerald-400/80">Government / AISHE Verified</div>
              <div className="text-xl font-bold font-display text-emerald-400 mt-0.5">{metrics.verified}</div>
              <div className="text-[10px] text-emerald-300/60 mt-1 font-mono">UGC • AICTE • NMC</div>
            </div>

            <div
              onClick={() => setStatusFilter('pending')}
              className="p-3.5 rounded-2xl bg-amber-500/[0.03] border border-amber-500/20 hover:border-amber-500/40 transition-all cursor-pointer"
            >
              <div className="text-[10px] uppercase font-mono text-amber-400/80">Pending Verification</div>
              <div className="text-xl font-bold font-display text-amber-400 mt-0.5">{metrics.pending}</div>
              <div className="text-[10px] text-amber-300/60 mt-1 font-mono">Awaiting Review</div>
            </div>

            <div
              onClick={() => setActiveTab('requests')}
              className="p-3.5 rounded-2xl bg-[#18CFFC]/[0.03] border border-[#18CFFC]/20 hover:border-[#18CFFC]/40 transition-all cursor-pointer"
            >
              <div className="text-[10px] uppercase font-mono text-[#18CFFC]/80">Student / Club Requests</div>
              <div className="text-xl font-bold font-display text-[#18CFFC] mt-0.5">{requests.length}</div>
              <div className="text-[10px] text-[#18CFFC]/60 mt-1 font-mono">{pendingRequestsCount} Pending Action</div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="space-y-3">
            {/* Search Input & Dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2 flex items-center gap-2 bg-[#0D0E15] px-3 py-2 rounded-xl border border-white/10">
                <Search size={16} className="text-white/40 shrink-0" />
                <input
                  type="text"
                  placeholder="Search by name, acronym (e.g. CBIT, VNR), locality, or AISHE code…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-transparent border-none text-xs text-white placeholder-white/40 focus:outline-none"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="text-white/40 hover:text-white">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* District Filter */}
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value as any)}
                className="bg-[#0D0E15] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#18CFFC]"
              >
                <option value="all">All 4 Target Districts</option>
                {TELANGANA_DISTRICTS.map((dist) => (
                  <option key={dist} value={dist}>
                    {dist} District
                  </option>
                ))}
              </select>

              {/* Type Filter */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as any)}
                className="bg-[#0D0E15] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#18CFFC]"
              >
                <option value="all">All Institution Types</option>
                {Object.entries(INSTITUTION_TYPE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-white/40 text-[11px] font-mono mr-1">Verification Status:</span>
              {[
                { key: 'all', label: 'All Institutions' },
                { key: 'verified', label: 'Verified (AISHE / UGC)' },
                { key: 'pending', label: 'Pending Verification' },
                { key: 'unverified', label: 'Unverified' },
                { key: 'suspended', label: 'Suspended' },
              ].map((pill) => (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => setStatusFilter(pill.key as any)}
                  className={`
                    px-2.5 py-1 rounded-lg font-mono text-[11px] transition-colors
                    ${
                      statusFilter === pill.key
                        ? 'bg-[#18CFFC]/20 border border-[#18CFFC] text-[#18CFFC] font-semibold'
                        : 'bg-white/5 border border-white/5 text-white/60 hover:text-white'
                    }
                  `}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Colleges Table */}
          <div className="bg-[#0D0E15] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-white/40 uppercase font-mono bg-white/[0.01]">
                    <th className="p-4 font-semibold">Institution Name & Acronym</th>
                    <th className="p-4 font-semibold">AISHE / Authority</th>
                    <th className="p-4 font-semibold">District & Locality</th>
                    <th className="p-4 font-semibold">Type & Affiliation</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {colleges.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-white/40">
                        No institutions match the chosen filters.
                      </td>
                    </tr>
                  ) : (
                    colleges.map((col) => (
                      <tr key={col.id} className="hover:bg-white/[0.02]">
                        {/* Name & Acronym */}
                        <td className="p-4 font-medium text-white">
                          <div className="flex items-start gap-3">
                            <div
                              className={`
                                w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border mt-0.5
                                ${
                                  col.verification_status === 'verified'
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                    : 'bg-[#18CFFC]/10 border-[#18CFFC]/20 text-[#18CFFC]'
                                }
                              `}
                            >
                              <Building2 size={16} />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-white flex items-center gap-2">
                                <span>{col.official_name || col.name}</span>
                                {col.short_name && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-white/10 text-[#18CFFC]">
                                    {col.short_name}
                                  </span>
                                )}
                              </div>
                              {col.official_website && (
                                <a
                                  href={col.official_website}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] text-white/40 hover:text-[#18CFFC] flex items-center gap-1 mt-0.5"
                                >
                                  <Globe size={11} /> {col.official_website.replace(/^https?:\/\//, '')}
                                </a>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* AISHE / Authority */}
                        <td className="p-4 font-mono text-white/70">
                          <div className="font-bold text-white/90">{col.aishe_code || '—'}</div>
                          <div className="text-[10px] text-white/40">
                            {col.verification_authority || 'Self-registered'}
                          </div>
                        </td>

                        {/* District & Locality */}
                        <td className="p-4 text-white/80">
                          <div className="font-medium text-white flex items-center gap-1">
                            <MapPin size={11} className="text-[#18CFFC]" />
                            {col.district}
                          </div>
                          <div className="text-[11px] text-white/40">
                            {col.locality || col.city || 'Hyderabad Metropolitan'}
                          </div>
                        </td>

                        {/* Type & Affiliation */}
                        <td className="p-4 text-white/70">
                          <div>{INSTITUTION_TYPE_LABELS[col.institution_type] || col.institution_type}</div>
                          {col.affiliating_university && (
                            <div className="text-[10px] text-white/40">
                              Affiliated: {col.affiliating_university}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="p-4">
                          <span
                            className={`
                              inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-semibold uppercase border
                              ${
                                col.verification_status === 'verified'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : col.verification_status === 'pending'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  : 'bg-white/5 text-white/50 border-white/10'
                              }
                            `}
                          >
                            {col.verification_status === 'verified' && <ShieldCheck size={11} />}
                            {col.verification_status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="p-4 text-right space-x-1 whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-white/70 hover:text-white"
                            onClick={() => handleViewHistory(col)}
                            title="Audit verification history"
                          >
                            <History size={13} />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-[#18CFFC] hover:bg-[#18CFFC]/10"
                            onClick={() => {
                              setTargetVerifyCollege(col)
                              setVerifyAuthority(col.verification_authority || 'AISHE')
                              setVerifyReference(col.source_reference || '')
                              setVerifyAcademicYear(col.academic_year || '2024-2025')
                              setVerifyNotes(col.verification_notes || '')
                              setVerifyModalOpen(true)
                            }}
                          >
                            Verify
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => {
                              setCurrentCollege(col)
                              setEditModalOpen(true)
                            }}
                          >
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Missing Requests Review Tab */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50 font-mono">Filter by request status:</span>
              {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setRequestStatusFilter(st)}
                  className={`
                    px-2.5 py-1 rounded-lg font-mono text-[11px] capitalize transition-colors
                    ${
                      requestStatusFilter === st
                        ? 'bg-[#18CFFC] text-black font-semibold'
                        : 'bg-white/5 text-white/60 hover:text-white'
                    }
                  `}
                >
                  {st}
                </button>
              ))}
            </div>
            <span className="text-xs text-white/40">{requests.length} requests submitted</span>
          </div>

          <div className="bg-[#0D0E15] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-white/40 uppercase font-mono bg-white/[0.01]">
                    <th className="p-4 font-semibold">Requested College Name</th>
                    <th className="p-4 font-semibold">Location</th>
                    <th className="p-4 font-semibold">AISHE / Website</th>
                    <th className="p-4 font-semibold">Submitted By</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-white/40">
                        No missing college requests in this category.
                      </td>
                    </tr>
                  ) : (
                    requests.map((req) => (
                      <tr key={req.id} className="hover:bg-white/[0.02]">
                        <td className="p-4 font-medium text-white">
                          <div className="font-semibold">{req.college_name}</div>
                          {req.short_name && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-white/10 text-[#18CFFC]">
                              {req.short_name}
                            </span>
                          )}
                          {req.supporting_info && (
                            <p className="text-[11px] text-white/40 mt-1 italic max-w-sm">
                              "{req.supporting_info}"
                            </p>
                          )}
                        </td>
                        <td className="p-4 text-white/80">
                          <div>{req.district} District</div>
                          <div className="text-[11px] text-white/40">{req.locality || req.city}</div>
                        </td>
                        <td className="p-4 font-mono text-white/70">
                          <div>{req.aishe_code || '—'}</div>
                          {req.website && (
                            <a
                              href={req.website}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-[#18CFFC] hover:underline flex items-center gap-1"
                            >
                              <ExternalLink size={10} /> Link
                            </a>
                          )}
                        </td>
                        <td className="p-4 text-white/70">
                          <div>{req.requester_name || 'FestFlow User'}</div>
                          <div className="text-[10px] text-white/40 font-mono">
                            {req.requester_email || '—'}
                          </div>
                        </td>
                        <td className="p-4">
                          <span
                            className={`
                              px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold uppercase border
                              ${
                                req.status === 'approved'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : req.status === 'rejected'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              }
                            `}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          {req.status === 'pending' ? (
                            <>
                              <Button
                                variant="primary"
                                size="sm"
                                className="text-xs"
                                onClick={() => {
                                  setTargetRequest(req)
                                  setReviewAction('approve')
                                  setReviewNotes(`Verified against AISHE code: ${req.aishe_code || 'N/A'}`)
                                  setReviewModalOpen(true)
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                                onClick={() => {
                                  setTargetRequest(req)
                                  setReviewAction('reject')
                                  setReviewNotes('Insufficient verification details.')
                                  setReviewModalOpen(true)
                                }}
                              >
                                Reject
                              </Button>
                            </>
                          ) : (
                            <span className="text-[11px] text-white/40 font-mono">Reviewed</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 1: Edit / Add College ──────────────────────────────────────── */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-[#0D0E15] border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white font-display mb-4">
              {currentCollege?.id ? 'Edit Institution Details' : 'Add Educational Institution'}
            </h3>
            <form onSubmit={handleSaveCollege} className="space-y-3.5 text-xs">
              <div>
                <label className="text-white/70 block mb-1">Official Name *</label>
                <input
                  type="text"
                  required
                  value={currentCollege?.official_name || currentCollege?.name || ''}
                  onChange={(e) =>
                    setCurrentCollege({
                      ...currentCollege,
                      official_name: e.target.value,
                      name: e.target.value,
                    })
                  }
                  placeholder="e.g. Chaitanya Bharathi Institute of Technology"
                  className="w-full p-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#18CFFC]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/70 block mb-1">Acronym / Short Name</label>
                  <input
                    type="text"
                    value={currentCollege?.short_name || ''}
                    onChange={(e) => setCurrentCollege({ ...currentCollege, short_name: e.target.value })}
                    placeholder="e.g. CBIT"
                    className="w-full p-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#18CFFC]"
                  />
                </div>
                <div>
                  <label className="text-white/70 block mb-1">AISHE Code</label>
                  <input
                    type="text"
                    value={currentCollege?.aishe_code || ''}
                    onChange={(e) =>
                      setCurrentCollege({ ...currentCollege, aishe_code: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. C-25622"
                    className="w-full p-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white font-mono placeholder-white/30 focus:outline-none focus:border-[#18CFFC]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/70 block mb-1">District *</label>
                  <select
                    value={currentCollege?.district || 'Hyderabad'}
                    onChange={(e) =>
                      setCurrentCollege({ ...currentCollege, district: e.target.value as any })
                    }
                    className="w-full p-2.5 bg-[#141724] border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#18CFFC]"
                  >
                    {TELANGANA_DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-white/70 block mb-1">Campus Locality</label>
                  <input
                    type="text"
                    value={currentCollege?.locality || ''}
                    onChange={(e) => setCurrentCollege({ ...currentCollege, locality: e.target.value })}
                    placeholder="e.g. Gandipet, Bachupally, Amberpet"
                    className="w-full p-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#18CFFC]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/70 block mb-1">Institution Type</label>
                  <select
                    value={currentCollege?.institution_type || 'affiliated_college'}
                    onChange={(e) =>
                      setCurrentCollege({ ...currentCollege, institution_type: e.target.value as any })
                    }
                    className="w-full p-2.5 bg-[#141724] border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#18CFFC]"
                  >
                    {Object.entries(INSTITUTION_TYPE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-white/70 block mb-1">Affiliating University</label>
                  <input
                    type="text"
                    value={currentCollege?.affiliating_university || ''}
                    onChange={(e) =>
                      setCurrentCollege({ ...currentCollege, affiliating_university: e.target.value })
                    }
                    placeholder="e.g. Osmania University or JNTUH"
                    className="w-full p-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#18CFFC]"
                  />
                </div>
              </div>

              <div>
                <label className="text-white/70 block mb-1">Official Website</label>
                <input
                  type="url"
                  value={currentCollege?.official_website || currentCollege?.website || ''}
                  onChange={(e) =>
                    setCurrentCollege({
                      ...currentCollege,
                      official_website: e.target.value,
                      website: e.target.value,
                    })
                  }
                  placeholder="https://cbit.ac.in"
                  className="w-full p-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#18CFFC]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <Button variant="ghost" size="sm" type="button" onClick={() => setEditModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  Save Institution
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: Verify Institution Modal ─────────────────────────────────── */}
      {verifyModalOpen && targetVerifyCollege && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0D0E15] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-display">
                  Accreditation & Verification Review
                </h3>
                <p className="text-xs text-white/50">{targetVerifyCollege.official_name}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/70 block mb-1">Accrediting Authority *</label>
                  <select
                    value={verifyAuthority}
                    onChange={(e) => setVerifyAuthority(e.target.value)}
                    className="w-full p-2 bg-[#141724] border border-white/10 rounded-xl text-white"
                  >
                    <option value="AISHE">AISHE (Ministry of Education)</option>
                    <option value="UGC">UGC (University Grants Commission)</option>
                    <option value="AICTE">AICTE</option>
                    <option value="NMC">NMC (National Medical Commission)</option>
                    <option value="TSCHE">TSCHE (Telangana State Council)</option>
                    <option value="OU">Osmania University</option>
                    <option value="JNTUH">JNTU Hyderabad</option>
                  </select>
                </div>

                <div>
                  <label className="text-white/70 block mb-1">Academic Year</label>
                  <input
                    type="text"
                    value={verifyAcademicYear}
                    onChange={(e) => setVerifyAcademicYear(e.target.value)}
                    className="w-full p-2 bg-white/5 border border-white/10 rounded-xl text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-white/70 block mb-1">Source Reference / URL</label>
                <input
                  type="text"
                  placeholder="e.g. https://aishe.gov.in/aishe/reports (Code: C-25622)"
                  value={verifyReference}
                  onChange={(e) => setVerifyReference(e.target.value)}
                  className="w-full p-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30"
                />
              </div>

              <div>
                <label className="text-white/70 block mb-1">Internal Verification Notes</label>
                <textarea
                  rows={2}
                  placeholder="Record reasons for verification or any conditions"
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  className="w-full p-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <Button
                variant="outline"
                size="sm"
                className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10 text-xs"
                onClick={() => handleConfirmVerification('rejected')}
              >
                Reject / Invalidate
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setVerifyModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<ShieldCheck size={14} />}
                  onClick={() => handleConfirmVerification('verified')}
                >
                  Mark as Verified
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: Audit History Modal ──────────────────────────────────────── */}
      {historyModalOpen && activeHistoryCollege && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0D0E15] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <History size={18} className="text-[#18CFFC]" />
                <div>
                  <h4 className="text-sm font-semibold text-white">Verification History Audit</h4>
                  <p className="text-[11px] text-white/50">{activeHistoryCollege.official_name}</p>
                </div>
              </div>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="text-white/40 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 text-xs">
              {historyLogs.length === 0 ? (
                <p className="text-center py-6 text-white/40">No audit history entries recorded yet.</p>
              ) : (
                historyLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white capitalize">{log.action.replace('_', ' ')}</span>
                      <span className="text-[10px] text-white/40 font-mono">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-white/60">
                      Status changed from <span className="font-mono text-white/80">{log.previous_status || 'initial'}</span> to{' '}
                      <span className="font-mono text-emerald-400 font-bold">{log.new_status}</span>
                    </div>
                    {log.verification_authority && (
                      <div className="text-[10px] text-white/40">
                        Authority: {log.verification_authority} {log.source_reference ? `(${log.source_reference})` : ''}
                      </div>
                    )}
                    {log.notes && <div className="text-[11px] text-white/50 italic">"{log.notes}"</div>}
                    <div className="text-[9px] text-white/30 font-mono">
                      Reviewed by: {log.verified_by_email || 'Platform Admin'}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-white/10 text-right">
              <Button variant="ghost" size="sm" onClick={() => setHistoryModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 4: CSV Import Pipeline Modal ─────────────────────────────────── */}
      {csvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#0D0E15] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <FileSpreadsheet size={20} className="text-[#18CFFC]" />
                <div>
                  <h4 className="text-base font-bold text-white">CSV Institution Import</h4>
                  <p className="text-xs text-white/50">
                    Bulk ingest institutions with automatic duplicate detection & validation.
                  </p>
                </div>
              </div>
              <button onClick={() => setCsvModalOpen(false)} className="text-white/40 hover:text-white">
                <X size={16} />
              </button>
            </div>

            {csvSuccessMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{csvSuccessMessage}</span>
              </div>
            )}

            {/* Upload Box */}
            <div className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:border-[#18CFFC]/50 transition-colors">
              <Upload size={24} className="mx-auto text-white/40 mb-2" />
              <p className="text-xs text-white/70">Select or drop a CSV file containing college records</p>
              <p className="text-[10px] text-white/40 font-mono mt-1">
                Accepted columns: official_name, short_name, aishe_code, district, locality, website,
                institution_type
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvFileChange}
                className="mt-3 block mx-auto text-xs text-white/60 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#18CFFC]/20 file:text-[#18CFFC] hover:file:bg-[#18CFFC]/30 cursor-pointer"
              />
            </div>

            {/* Validation Feedback */}
            {csvValidation && (
              <div className="space-y-3 overflow-y-auto flex-1 text-xs">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                    <div className="font-mono text-sm font-bold text-white">{csvValidation.totalRows}</div>
                    <div className="text-[10px] text-white/40">Total Rows</div>
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="font-mono text-sm font-bold text-emerald-400">
                      {csvValidation.validRows.length}
                    </div>
                    <div className="text-[10px] text-emerald-300">Valid to Import</div>
                  </div>
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <div className="font-mono text-sm font-bold text-amber-400">
                      {csvValidation.duplicatesInDb.length + csvValidation.duplicatesInFile.length}
                    </div>
                    <div className="text-[10px] text-amber-300">Duplicates</div>
                  </div>
                  <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <div className="font-mono text-sm font-bold text-rose-400">
                      {csvValidation.errors.length}
                    </div>
                    <div className="text-[10px] text-rose-300">Errors</div>
                  </div>
                </div>

                {/* Duplicates notice */}
                {csvValidation.duplicatesInDb.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 space-y-1">
                    <div className="font-semibold flex items-center gap-1.5">
                      <AlertCircle size={14} /> Existing Records Detected (Skipped to prevent duplicates):
                    </div>
                    <ul className="list-disc pl-5 text-[11px] space-y-0.5">
                      {csvValidation.duplicatesInDb.slice(0, 5).map((d, i) => (
                        <li key={i}>
                          Row {d.row}: {d.identifier} (matches "{d.existingName}")
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Errors notice */}
                {csvValidation.errors.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-1">
                    <div className="font-semibold flex items-center gap-1.5">
                      <XCircle size={14} /> Validation Errors (Skipped):
                    </div>
                    <ul className="list-disc pl-5 text-[11px] space-y-0.5">
                      {csvValidation.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>
                          Row {err.row} [{err.column}]: {err.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <Button variant="ghost" size="sm" onClick={() => setCsvModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!csvValidation || csvValidation.validRows.length === 0 || csvImporting}
                onClick={handleExecuteCsvImport}
                leftIcon={csvImporting ? undefined : <Check size={14} />}
              >
                {csvImporting
                  ? 'Importing…'
                  : `Import ${csvValidation?.validRows.length || 0} Valid Records`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 5: Request Review Confirm Modal ─────────────────────────────── */}
      {reviewModalOpen && targetRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0D0E15] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <h4 className="text-base font-bold text-white">
              {reviewAction === 'approve' ? 'Approve & Add Institution' : 'Reject College Request'}
            </h4>
            <p className="text-xs text-white/60">
              {reviewAction === 'approve'
                ? `This will create and verify "${targetRequest.college_name}" in the directory.`
                : `This will reject the submission for "${targetRequest.college_name}".`}
            </p>

            <div className="space-y-1 text-xs">
              <label className="text-white/70 block">Review Notes / Reason</label>
              <textarea
                rows={2}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="w-full p-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <Button variant="ghost" size="sm" onClick={() => setReviewModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant={reviewAction === 'approve' ? 'primary' : 'outline'}
                size="sm"
                className={reviewAction === 'reject' ? 'text-rose-400 border-rose-500/30' : ''}
                onClick={handleConfirmReview}
              >
                {reviewAction === 'approve' ? 'Approve Institution' : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
