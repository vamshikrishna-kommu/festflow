import { useState, useEffect } from 'react'
import {
  Code,
  Cpu,
  Terminal,
  Bot,
  Gamepad2,
  Music,
  Activity,
  Trophy,
  Rocket,
  Briefcase,
  Palette,
  Camera,
  Sparkles,
  BookOpen,
  Compass,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'

export const STUDENT_INTEREST_OPTIONS = [
  { id: 'Technology', label: 'Technology', icon: Cpu },
  { id: 'Coding', label: 'Coding', icon: Code },
  { id: 'Hackathons', label: 'Hackathons', icon: Terminal },
  { id: 'Artificial Intelligence', label: 'Artificial Intelligence', icon: Bot },
  { id: 'Gaming', label: 'Gaming', icon: Gamepad2 },
  { id: 'Music', label: 'Music', icon: Music },
  { id: 'Dance', label: 'Dance', icon: Activity },
  { id: 'Sports', label: 'Sports', icon: Trophy },
  { id: 'Entrepreneurship', label: 'Entrepreneurship', icon: Rocket },
  { id: 'Business', label: 'Business', icon: Briefcase },
  { id: 'Design', label: 'Design', icon: Palette },
  { id: 'Photography', label: 'Photography', icon: Camera },
  { id: 'Cultural Events', label: 'Cultural Events', icon: Sparkles },
  { id: 'Workshops', label: 'Workshops', icon: BookOpen },
  { id: 'Career Development', label: 'Career Development', icon: Compass },
]

interface StudentInterestsSelectorProps {
  initialInterests?: string[] | null
  onSaved?: (interests: string[]) => void
  showSaveButton?: boolean
  className?: string
}

export function StudentInterestsSelector({
  initialInterests,
  onSaved,
  showSaveButton = true,
  className = '',
}: StudentInterestsSelectorProps) {
  const { user, studentProfile, updateProfile } = useAuth()

  const [selected, setSelected] = useState<string[]>(() => {
    if (initialInterests && initialInterests.length > 0) return initialInterests
    if (studentProfile?.interests && Array.isArray(studentProfile.interests)) return studentProfile.interests
    if (user?.user_metadata?.interests && Array.isArray(user.user_metadata.interests)) return user.user_metadata.interests
    return ['Technology', 'Coding', 'Cultural Events'] // sensible default
  })

  const [saving, setSaving] = useState(false)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)

  useEffect(() => {
    if (initialInterests) {
      setSelected(initialInterests)
    }
  }, [initialInterests])

  const toggleInterest = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveNotice(null)

    try {
      // 1. Update user metadata and preferences in AuthContext
      await updateProfile({
        preferences: {
          ...(user?.user_metadata?.preferences || {}),
          interests: selected,
        },
      })

      // 2. Cache in localStorage
      localStorage.setItem('festflow_student_interests', JSON.stringify(selected))

      // 3. Dispatch global sync event for recommendation refresh
      window.dispatchEvent(
        new CustomEvent('festflow:interests-updated', { detail: { interests: selected } })
      )

      if (onSaved) onSaved(selected)
      setSaveNotice('Interests updated!')
      setTimeout(() => setSaveNotice(null), 3000)
    } catch {
      setSaveNotice('Failed to save interests.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`flex flex-col gap-3.5 text-left ${className}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <span className="text-xs uppercase tracking-wider text-[#18CFFC] font-semibold">
            Personalized Feed
          </span>
          <h3 className="text-sm sm:text-base font-bold text-white font-display">
            Select Your Interests ({selected.length} chosen)
          </h3>
        </div>
        {showSaveButton && (
          <div className="flex items-center gap-2">
            {saveNotice && (
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 animate-fade-in">
                <Check size={13} /> {saveNotice}
              </span>
            )}
            <Button
              size="sm"
              variant="primary"
              onClick={handleSave}
              disabled={saving}
              className="text-xs h-8"
            >
              {saving ? 'Saving…' : 'Save Feed'}
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {STUDENT_INTEREST_OPTIONS.map((item) => {
          const Icon = item.icon
          const isSelected = selected.includes(item.id)

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggleInterest(item.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer select-none border ${
                isSelected
                  ? 'bg-gradient-to-r from-[#18CFFC]/20 via-[#07A4FC]/20 to-[#7F1AFB]/30 border-[#18CFFC]/50 text-white shadow-[0_0_12px_rgba(24,207,252,0.2)]'
                  : 'bg-[#14141A] hover:bg-[#1A1A22] border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              <Icon size={13} className={isSelected ? 'text-[#18CFFC]' : 'text-zinc-500'} />
              <span>{item.label}</span>
              {isSelected && <Check size={11} className="text-[#18CFFC] ml-0.5" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

