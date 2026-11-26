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
          <span className="text-xs uppercase tracking-wider text-blue-600 font-semibold">
            Personalized Feed
          </span>
          <h3 className="text-sm sm:text-base font-bold text-gray-900 font-display">
            Select Your Interests ({selected.length} chosen)
          </h3>
        </div>
        {showSaveButton && (
          <div className="flex items-center gap-2">
            {saveNotice && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1 animate-fade-in">
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
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer select-none border ${
                isSelected
                  ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-xs'
                  : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon size={13} className={isSelected ? 'text-blue-600' : 'text-gray-400'} />
              <span>{item.label}</span>
              {isSelected && <Check size={11} className="text-blue-600 ml-0.5" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

