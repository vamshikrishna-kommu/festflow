import React, { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, Building2, CheckCircle2, AlertCircle, Send, Globe, MapPin } from 'lucide-react'
import { Button } from '@/components/ui'
import {
  submitCollegeRequest,
  TELANGANA_DISTRICTS,
  INSTITUTION_TYPE_LABELS,
  isValidAisheCode,
  type CollegeDistrict,
  type InstitutionType,
} from '@/lib/collegeDirectory'
import { useAuth } from '@/context/AuthContext'

interface CollegeRequestModalProps {
  isOpen: boolean
  onClose: () => void
  initialName?: string
  onRequestSubmitted?: (requestedCollegeName: string) => void
}

export function CollegeRequestModal({
  isOpen,
  onClose,
  initialName = '',
  onRequestSubmitted,
}: CollegeRequestModalProps) {
  const { user } = useAuth()

  const [collegeName, setCollegeName] = useState(initialName)
  const [shortName, setShortName] = useState('')
  const [district, setDistrict] = useState<CollegeDistrict>('Hyderabad')
  const [city] = useState('Hyderabad')
  const [locality, setLocality] = useState('')
  const [website, setWebsite] = useState('')
  const [aisheCode, setAisheCode] = useState('')
  const [institutionType, setInstitutionType] = useState<InstitutionType>('affiliated_college')
  const [supportingInfo, setSupportingInfo] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Sync initialName if opened
  React.useEffect(() => {
    if (isOpen) {
      if (initialName && !collegeName) setCollegeName(initialName)
      setError(null)
      setSuccess(false)
    }
  }, [isOpen, initialName])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!collegeName.trim()) {
      setError('Please provide the full official name of your college or university.')
      return
    }

    if (aisheCode.trim() && !isValidAisheCode(aisheCode.trim())) {
      setError('AISHE code format is invalid (e.g. C-19754, U-0027, S-12345).')
      return
    }

    setIsSubmitting(true)

    try {
      const res = await submitCollegeRequest({
        userId: user?.id || '00000000-0000-0000-0000-000000000000',
        collegeName: collegeName.trim(),
        shortName: shortName.trim() || undefined,
        district,
        city: city.trim() || 'Hyderabad',
        locality: locality.trim() || undefined,
        website: website.trim() || undefined,
        aisheCode: aisheCode.trim() || undefined,
        institutionType,
        supportingInfo: supportingInfo.trim() || undefined,
      })

      if (res.success) {
        setSuccess(true)
        if (onRequestSubmitted) {
          onRequestSubmitted(collegeName.trim())
        }
      } else {
        setError(res.error || 'Failed to submit request. Please try again.')
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetAndClose = () => {
    setCollegeName('')
    setShortName('')
    setLocality('')
    setWebsite('')
    setAisheCode('')
    setSupportingInfo('')
    setError(null)
    setSuccess(false)
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleResetAndClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-lg bg-[#0F111A] border border-white/10 rounded-2xl shadow-2xl p-6 overflow-hidden z-10 max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#18CFFC]/10 border border-[#18CFFC]/20 flex items-center justify-center text-[#18CFFC]">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-base">Request College Addition</h3>
                  <p className="text-xs text-white/50">Can't find your institution? Submit it for verification.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleResetAndClose}
                className="text-white/40 hover:text-white transition-colors p-1"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            {success ? (
              <div className="py-8 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-semibold text-white">Request Submitted Successfully</h4>
                  <p className="text-xs text-white/60 max-w-sm mx-auto leading-relaxed">
                    Our platform administrators will review and verify <span className="text-[#18CFFC] font-medium">{collegeName}</span> against authoritative databases (AISHE / TSCHE).
                  </p>
                </div>
                <p className="text-[11px] text-white/40 bg-white/[0.02] border border-white/5 p-3 rounded-xl max-w-sm mx-auto">
                  Your submitted institution name has been pre-selected for your profile so you can proceed without disruption.
                </p>
                <div className="pt-2">
                  <Button variant="primary" size="sm" onClick={handleResetAndClose}>
                    Done & Return
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="overflow-y-auto space-y-4 py-4 pr-1 text-xs text-white">
                {error && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-2.5">
                    <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                    <span>{error}</span>
                  </div>
                )}

                {/* College Name */}
                <div className="space-y-1">
                  <label className="block text-white/70 font-medium">
                    Official College / University Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Anurag University, Hyderabad"
                    value={collegeName}
                    onChange={(e) => setCollegeName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#18CFFC]"
                  />
                </div>

                {/* Short Name & AISHE */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-white/70 font-medium">Acronym / Short Name</label>
                    <input
                      type="text"
                      placeholder="e.g. AU, CBIT, IARE"
                      value={shortName}
                      onChange={(e) => setShortName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#18CFFC]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-white/70 font-medium">AISHE Code (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. C-19754 or U-0027"
                      value={aisheCode}
                      onChange={(e) => setAisheCode(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono placeholder-white/30 focus:outline-none focus:border-[#18CFFC]"
                    />
                  </div>
                </div>

                {/* District & Locality */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-white/70 font-medium">District <span className="text-rose-400">*</span></label>
                    <select
                      value={district}
                      onChange={(e) => setDistrict(e.target.value as CollegeDistrict)}
                      className="w-full px-3 py-2 rounded-xl bg-[#141724] border border-white/10 text-white focus:outline-none focus:border-[#18CFFC]"
                    >
                      {TELANGANA_DISTRICTS.map((dist) => (
                        <option key={dist} value={dist}>
                          {dist}
                        </option>
                      ))}
                      <option value="Other">Other District</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-white/70 font-medium">Campus Locality / Area</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g. Ghatkesar, Bachupally, Kandi"
                        value={locality}
                        onChange={(e) => setLocality(e.target.value)}
                        className="w-full px-3 py-2 pl-8 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#18CFFC]"
                      />
                      <MapPin size={14} className="absolute left-2.5 top-2.5 text-white/40" />
                    </div>
                  </div>
                </div>

                {/* Institution Type */}
                <div className="space-y-1">
                  <label className="block text-white/70 font-medium">Institution Type</label>
                  <select
                    value={institutionType}
                    onChange={(e) => setInstitutionType(e.target.value as InstitutionType)}
                    className="w-full px-3 py-2 rounded-xl bg-[#141724] border border-white/10 text-white focus:outline-none focus:border-[#18CFFC]"
                  >
                    {Object.entries(INSTITUTION_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Official Website */}
                <div className="space-y-1">
                  <label className="block text-white/70 font-medium">Official Website (Optional)</label>
                  <div className="relative">
                    <input
                      type="url"
                      placeholder="https://example.ac.in"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      className="w-full px-3 py-2 pl-8 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#18CFFC]"
                    />
                    <Globe size={14} className="absolute left-2.5 top-2.5 text-white/40" />
                  </div>
                </div>

                {/* Supporting Info */}
                <div className="space-y-1">
                  <label className="block text-white/70 font-medium">Additional Details / Affiliation</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Affiliated to JNTUH / OU, recently granted autonomous status, etc."
                    value={supportingInfo}
                    onChange={(e) => setSupportingInfo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#18CFFC] resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                  <Button variant="ghost" size="sm" type="button" onClick={handleResetAndClose}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    type="submit"
                    disabled={isSubmitting}
                    leftIcon={isSubmitting ? undefined : <Send size={14} />}
                  >
                    {isSubmitting ? 'Submitting…' : 'Submit Request'}
                  </Button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
