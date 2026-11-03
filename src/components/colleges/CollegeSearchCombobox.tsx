import React, { useState, useEffect, useRef, useTransition } from 'react'
import {
  Search,
  Building2,
  CheckCircle2,
  ShieldCheck,
  ChevronDown,
  X,
  MapPin,
  PlusCircle,
} from 'lucide-react'
import {
  searchCollegesDirectory,
  TELANGANA_DISTRICTS,
  INSTITUTION_TYPE_LABELS,
  type CollegeDirectoryRecord,
  type CollegeDistrict,
  type InstitutionType,
} from '@/lib/collegeDirectory'
import { CollegeRequestModal } from './CollegeRequestModal'

interface CollegeSearchComboboxProps {
  label?: string
  placeholder?: string
  selectedCollegeId?: string | null
  selectedCollegeName?: string | null
  onSelect: (college: CollegeDirectoryRecord | null, rawName?: string) => void
  disabled?: boolean
  required?: boolean
  error?: string
  helperText?: string
  className?: string
}

export function CollegeSearchCombobox({
  label = 'College / Educational Institution',
  placeholder = 'Search by name, acronym (e.g. CBIT, VNR), or AISHE code…',
  selectedCollegeId,
  selectedCollegeName,
  onSelect,
  disabled = false,
  required = false,
  error,
  helperText,
  className = '',
}: CollegeSearchComboboxProps) {
  const [, startTransition] = useTransition()
  const containerRef = useRef<HTMLDivElement>(null)

  // State
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState<CollegeDistrict | 'all'>('all')
  const [selectedType, setSelectedType] = useState<InstitutionType | 'all'>('all')
  const [results, setResults] = useState<CollegeDirectoryRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<CollegeDirectoryRecord | null>(null)

  // Missing college request modal
  const [requestModalOpen, setRequestModalOpen] = useState(false)

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  // Load initial selection if selectedCollegeId or selectedCollegeName exists
  useEffect(() => {
    let isCancelled = false
    const resolveSelected = async () => {
      if (!selectedCollegeId && !selectedCollegeName) {
        setSelectedRecord(null)
        return
      }

      // Try searching for the selected college
      const searchRes = await searchCollegesDirectory({
        query: selectedCollegeName || '',
        limit: 10,
      })

      if (isCancelled) return

      if (selectedCollegeId) {
        const match = searchRes.colleges.find((c) => c.id === selectedCollegeId)
        if (match) {
          setSelectedRecord(match)
          return
        }
      }

      if (selectedCollegeName) {
        const matchByName = searchRes.colleges.find(
          (c) =>
            c.official_name.toLowerCase() === selectedCollegeName.toLowerCase() ||
            c.name.toLowerCase() === selectedCollegeName.toLowerCase()
        )
        if (matchByName) {
          setSelectedRecord(matchByName)
          return
        }
      }

      // If no directory record found, keep synthetic record for backwards compatibility
      if (selectedCollegeName) {
        setSelectedRecord({
          id: selectedCollegeId || '',
          name: selectedCollegeName,
          official_name: selectedCollegeName,
          district: 'Hyderabad',
          country: 'India',
          status: 'active',
          institution_type: 'affiliated_college',
          verification_status: 'unverified',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      }
    }

    resolveSelected()
    return () => {
      isCancelled = true
    }
  }, [selectedCollegeId, selectedCollegeName])

  // Search execution with debouncing
  useEffect(() => {
    let isCancelled = false
    const timer = setTimeout(async () => {
      if (!isOpen) return
      setIsLoading(true)

      try {
        const res = await searchCollegesDirectory({
          query,
          district: selectedDistrict,
          institutionType: selectedType,
          limit: 30,
        })

        if (!isCancelled) {
          startTransition(() => {
            setResults(res.colleges)
            setIsLoading(false)
          })
        }
      } catch {
        if (!isCancelled) setIsLoading(false)
      }
    }, 180)

    return () => {
      isCancelled = true
      clearTimeout(timer)
    }
  }, [query, selectedDistrict, selectedType, isOpen])

  const handleSelectCollege = (college: CollegeDirectoryRecord) => {
    setSelectedRecord(college)
    setIsOpen(false)
    setQuery('')
    onSelect(college, college.official_name || college.name)
  }

  const handleClearSelection = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedRecord(null)
    onSelect(null, '')
    setQuery('')
    setIsOpen(true)
  }

  const handleRequestSubmitted = (submittedCollegeName: string) => {
    // Select the requested college name as raw custom institution
    onSelect(null, submittedCollegeName)
    setSelectedRecord({
      id: '',
      name: submittedCollegeName,
      official_name: submittedCollegeName,
      district: selectedDistrict !== 'all' ? selectedDistrict : 'Hyderabad',
      country: 'India',
      status: 'active',
      institution_type: 'affiliated_college',
      verification_status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    setIsOpen(false)
  }

  return (
    <div className={`space-y-1.5 relative ${className}`} ref={containerRef}>
      {/* Label & District Hint */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-white/80">
          {label} {required && <span className="text-rose-400">*</span>}
        </label>
        <span className="text-[10px] text-white/40 font-mono">
          Hyderabad • Medchal • Rangareddy • Sangareddy
        </span>
      </div>

      {/* Selected Card View (if an institution is chosen and dropdown is closed) */}
      {selectedRecord && !isOpen ? (
        <div
          onClick={() => !disabled && setIsOpen(true)}
          className={`
            p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3
            ${
              selectedRecord.verification_status === 'verified'
                ? 'bg-emerald-500/[0.04] border-emerald-500/30 hover:border-emerald-500/50'
                : selectedRecord.verification_status === 'pending'
                ? 'bg-amber-500/[0.04] border-amber-500/30 hover:border-amber-500/50'
                : 'bg-white/[0.03] border-white/10 hover:border-white/20'
            }
            ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
          `}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`
                w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border
                ${
                  selectedRecord.verification_status === 'verified'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : selectedRecord.verification_status === 'pending'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-[#18CFFC]/10 border-[#18CFFC]/20 text-[#18CFFC]'
                }
              `}
            >
              <Building2 size={18} />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white truncate">
                  {selectedRecord.official_name || selectedRecord.name}
                </span>
                {selectedRecord.short_name && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 text-white/80">
                    {selectedRecord.short_name}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[11px] text-white/50">
                {selectedRecord.locality && (
                  <span className="flex items-center gap-1">
                    <MapPin size={11} className="text-white/40" />
                    {selectedRecord.locality}, {selectedRecord.district}
                  </span>
                )}
                {!selectedRecord.locality && selectedRecord.district && (
                  <span>{selectedRecord.district} District</span>
                )}

                {/* Verification Badge */}
                {selectedRecord.verification_status === 'verified' && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[9px] font-semibold">
                    <ShieldCheck size={10} />
                    Verified {selectedRecord.aishe_code ? `AISHE: ${selectedRecord.aishe_code}` : ''}
                  </span>
                )}
                {selectedRecord.verification_status === 'pending' && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[9px]">
                    Verification Pending
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!disabled && (
              <button
                type="button"
                onClick={handleClearSelection}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                title="Change institution"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Search Combobox Input */
        <div className="relative">
          <div
            onClick={() => !disabled && setIsOpen(true)}
            className={`
              flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.04] border text-xs text-white min-h-[44px] transition-all
              ${error ? 'border-rose-500/50 focus-within:border-rose-500' : 'border-white/10 focus-within:border-[#18CFFC]'}
              ${isOpen ? 'ring-1 ring-[#18CFFC]/30 border-[#18CFFC]' : ''}
              ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-text'}
            `}
          >
            <Search size={16} className="text-white/40 shrink-0" />
            <input
              type="text"
              disabled={disabled}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                if (!isOpen) setIsOpen(true)
              }}
              onFocus={() => setIsOpen(true)}
              placeholder={placeholder}
              className="w-full bg-transparent border-none text-xs text-white placeholder-white/30 focus:outline-none"
            />
            {isLoading && (
              <div className="w-4 h-4 border-2 border-[#18CFFC] border-t-transparent rounded-full animate-spin shrink-0" />
            )}
            <ChevronDown
              size={16}
              className={`text-white/40 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </div>
        </div>
      )}

      {/* Helper text or validation error */}
      {error ? (
        <p className="text-[11px] text-rose-400">{error}</p>
      ) : helperText ? (
        <p className="text-[11px] text-white/40">{helperText}</p>
      ) : null}

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-[#0F111A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[380px] flex flex-col">
          {/* District Pills Filter */}
          <div className="p-2 border-b border-white/5 bg-white/[0.01] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedDistrict('all')}
              className={`
                px-2.5 py-1 rounded-lg text-[10px] font-mono transition-colors whitespace-nowrap
                ${selectedDistrict === 'all' ? 'bg-[#18CFFC] text-black font-semibold' : 'text-white/60 hover:text-white bg-white/5'}
              `}
            >
              All Districts
            </button>
            {TELANGANA_DISTRICTS.map((dist) => (
              <button
                key={dist}
                type="button"
                onClick={() => setSelectedDistrict(dist)}
                className={`
                  px-2 py-1 rounded-lg text-[10px] font-mono transition-colors whitespace-nowrap
                  ${selectedDistrict === dist ? 'bg-[#18CFFC] text-black font-semibold' : 'text-white/60 hover:text-white bg-white/5'}
                `}
              >
                {dist.replace('-Malkajgiri', '')}
              </button>
            ))}
          </div>

          {/* Type Filter Dropdown & Results Counter */}
          <div className="px-3 py-1.5 border-b border-white/5 flex items-center justify-between text-[11px] text-white/40 bg-white/[0.01]">
            <span>{results.length} institutions available</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="bg-transparent border-none text-[10px] text-white/60 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#0F111A] text-white">
                All Institution Types
              </option>
              {Object.entries(INSTITUTION_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k} className="bg-[#0F111A] text-white">
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* College Results List */}
          <div className="overflow-y-auto flex-1 divide-y divide-white/5">
            {results.length === 0 ? (
              <div className="p-6 text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mx-auto text-white/40">
                  <Building2 size={20} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-white/80">No matching colleges found</p>
                  <p className="text-[11px] text-white/40">
                    Try searching by common acronym (e.g. CBIT, GRIET) or campus locality.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRequestModalOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-[#18CFFC] hover:underline font-medium"
                >
                  <PlusCircle size={14} /> My college is not listed — Request addition
                </button>
              </div>
            ) : (
              results.map((col) => {
                const isSelected = selectedRecord?.id === col.id
                return (
                  <div
                    key={col.id}
                    onClick={() => handleSelectCollege(col)}
                    className={`
                      p-3 flex items-start justify-between gap-3 cursor-pointer transition-colors
                      ${isSelected ? 'bg-[#18CFFC]/10 text-white' : 'hover:bg-white/[0.03] text-white/90'}
                    `}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={`
                          w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border
                          ${
                            col.verification_status === 'verified'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-white/5 border-white/10 text-white/60'
                          }
                        `}
                      >
                        <Building2 size={14} />
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-white truncate">
                            {col.official_name || col.name}
                          </span>
                          {col.short_name && (
                            <span className="px-1 py-0.2 rounded text-[9px] font-mono font-bold bg-white/10 text-[#18CFFC]">
                              {col.short_name}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-white/50 flex-wrap">
                          {col.locality && (
                            <span className="flex items-center gap-1">
                              <MapPin size={10} className="text-white/30" />
                              {col.locality}, {col.district}
                            </span>
                          )}
                          {!col.locality && <span>{col.district}</span>}

                          {col.institution_type && (
                            <span className="text-white/40 font-mono">
                              • {INSTITUTION_TYPE_LABELS[col.institution_type] || col.institution_type}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {col.verification_status === 'verified' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[9px]">
                          <ShieldCheck size={10} />
                          {col.aishe_code || 'Verified'}
                        </span>
                      )}

                      {isSelected && <CheckCircle2 size={16} className="text-[#18CFFC]" />}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Bottom Bar: "My College is Not Listed" Button */}
          <div className="p-2.5 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-xs">
            <span className="text-[11px] text-white/40">Can't find your educational institution?</span>
            <button
              type="button"
              onClick={() => setRequestModalOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] text-[#18CFFC] hover:underline font-semibold"
            >
              <PlusCircle size={13} /> Request College Addition
            </button>
          </div>
        </div>
      )}

      {/* College Request Modal */}
      <CollegeRequestModal
        isOpen={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        initialName={query}
        onRequestSubmitted={handleRequestSubmitted}
      />
    </div>
  )
}
