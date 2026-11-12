import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ChevronRight,
  ChevronLeft,
  LayoutGrid,
  Tag,
  CheckCircle2,
  Eye,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Step1RoomInfo } from './Step1RoomInfo'
import { Step2VisualEditor } from './Step2VisualEditor'
import { Step3Categories } from './Step3Categories'
import { Step4Validation } from './Step4Validation'
import { Step5Preview } from './Step5Preview'
import { createDefaultLayoutConfig } from '@/lib/seatLayoutEditor'
import { saveSeatLayout, publishSeatLayout } from '@/lib/seating'
import type { LayoutEditorConfig } from '@/types/seating'

interface LayoutEditorProps {
  eventId: string
  initialConfig?: LayoutEditorConfig | null
  onSaved?: (layoutId: string) => void
  onCancel?: () => void
}

const STEPS = [
  { id: 1, label: 'Room Info', icon: Info },
  { id: 2, label: 'Layout', icon: LayoutGrid },
  { id: 3, label: 'Categories', icon: Tag },
  { id: 4, label: 'Validate', icon: CheckCircle2 },
  { id: 5, label: 'Preview', icon: Eye },
]

export function LayoutEditor({ eventId, initialConfig, onSaved, onCancel }: LayoutEditorProps) {
  const [step, setStep] = useState(1)
  const [config, setConfig] = useState<LayoutEditorConfig>(
    initialConfig ?? createDefaultLayoutConfig()
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedLayoutId, setSavedLayoutId] = useState<string | null>(null)
  const [published, setPublished] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    const result = await saveSeatLayout(eventId, config)
    setSaving(false)
    if (!result.success) {
      setSaveError(result.error ?? 'Save failed')
      return
    }
    setSavedLayoutId(result.layoutId ?? null)
    if (result.layoutId) onSaved?.(result.layoutId)
  }

  const handlePublish = async () => {
    let layoutIdToPublish = savedLayoutId
    if (!layoutIdToPublish) {
      setSaving(true)
      const saveRes = await saveSeatLayout(eventId, config)
      if (!saveRes.success || !saveRes.layoutId) {
        setSaving(false)
        setSaveError(saveRes.error ?? 'Save failed before publishing')
        return
      }
      layoutIdToPublish = saveRes.layoutId
      setSavedLayoutId(saveRes.layoutId)
      onSaved?.(saveRes.layoutId)
    }

    setSaving(true)
    const result = await publishSeatLayout(layoutIdToPublish)
    setSaving(false)
    if (!result.success) {
      setSaveError(result.error ?? 'Publish failed')
    } else {
      setPublished(true)
    }
  }

  const stepProps = { config, onChange: setConfig }

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Step indicators */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((s, idx) => {
          const Icon = s.icon
          const isActive = step === s.id
          const isDone = step > s.id
          return (
            <div key={s.id} className="flex items-center flex-1">
              <button
                type="button"
                onClick={() => isDone && setStep(s.id)}
                className={`flex flex-col items-center gap-1 cursor-${isDone ? 'pointer' : 'default'} group`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-br from-[#18CFFC] to-[#0D56FB] border-transparent text-white'
                      : isDone
                      ? 'bg-[#18CFFC]/20 border-[#18CFFC] text-[#18CFFC]'
                      : 'bg-[var(--color-surface-2)] border-[var(--color-surface-3)] text-[var(--color-text-muted)]'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:block ${
                    isActive
                      ? 'text-[#18CFFC]'
                      : isDone
                      ? 'text-[var(--color-text-secondary)]'
                      : 'text-[var(--color-text-muted)]'
                  }`}
                >
                  {s.label}
                </span>
              </button>
              {idx < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 transition-colors duration-300 ${
                    step > s.id ? 'bg-[#18CFFC]' : 'bg-[var(--color-surface-3)]'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div className="bg-[var(--color-surface-1)] rounded-2xl border border-white/5 p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {step === 1 && <Step1RoomInfo {...stepProps} />}
            {step === 2 && <Step2VisualEditor {...stepProps} />}
            {step === 3 && <Step3Categories {...stepProps} />}
            {step === 4 && <Step4Validation {...stepProps} />}
            {step === 5 && <Step5Preview {...stepProps} eventId={eventId} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Error */}
      {saveError && (
        <p className="mt-3 text-sm text-red-400 text-center">{saveError}</p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <div className="flex gap-3">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
          )}
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={saving}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          )}
        </div>

        <div className="flex gap-3">
          {step < 5 && (
            <Button
              variant="primary"
              onClick={() => setStep((s) => s + 1)}
              disabled={saving}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
          {step === 5 && (
            <>
              <Button variant="outline" onClick={handleSave} isLoading={saving}>
                Save Draft
              </Button>
              <Button
                variant="primary"
                onClick={handlePublish}
                isLoading={saving}
                disabled={published}
              >
                {published ? 'Published!' : 'Publish Layout'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
export default LayoutEditor
