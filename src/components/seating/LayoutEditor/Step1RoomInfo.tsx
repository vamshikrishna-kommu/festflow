import type { LayoutEditorConfig, StagePosition } from '@/types/seating'

interface Props {
  config: LayoutEditorConfig
  onChange: (config: LayoutEditorConfig) => void
}

const STAGE_OPTIONS: { value: StagePosition; label: string; description: string }[] = [
  { value: 'front', label: 'Stage at Front', description: 'Screen/stage faces the audience (top of map)' },
  { value: 'back', label: 'Stage at Back', description: 'Stage at the back wall (bottom of map)' },
  { value: 'left', label: 'Stage at Left', description: 'Side stage arrangement' },
  { value: 'right', label: 'Stage at Right', description: 'Side stage arrangement' },
]

export function Step1RoomInfo({ config, onChange }: Props) {
  const update = (patch: Partial<LayoutEditorConfig>) => onChange({ ...config, ...patch })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">Room Information</h2>
        <p className="text-sm text-[var(--color-text-muted)]">Configure the basic details of your venue.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            Layout Name *
          </label>
          <input
            type="text"
            value={config.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="e.g. Main Auditorium"
            className="w-full px-3 py-2.5 bg-[var(--color-surface-2)] border border-white/10 rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC] transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            Venue Description
          </label>
          <input
            type="text"
            value={config.venue_description}
            onChange={(e) => update({ venue_description: e.target.value })}
            placeholder="e.g. Ground Floor, Block C"
            className="w-full px-3 py-2.5 bg-[var(--color-surface-2)] border border-white/10 rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[#18CFFC] transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            Hold Duration (minutes)
          </label>
          <p className="text-xs text-[var(--color-text-muted)] mb-2">How long a seat is reserved while a student completes payment</p>
          <input
            type="number"
            min={5}
            max={60}
            value={config.hold_duration_minutes}
            onChange={(e) => update({ hold_duration_minutes: Math.max(5, Math.min(60, Number(e.target.value))) })}
            className="w-full px-3 py-2.5 bg-[var(--color-surface-2)] border border-white/10 rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[#18CFFC] transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            Max Seats Per Registration
          </label>
          <p className="text-xs text-[var(--color-text-muted)] mb-2">Maximum seats one student can book at once</p>
          <input
            type="number"
            min={1}
            max={20}
            value={config.max_seats_per_registration}
            onChange={(e) => update({ max_seats_per_registration: Math.max(1, Math.min(20, Number(e.target.value))) })}
            className="w-full px-3 py-2.5 bg-[var(--color-surface-2)] border border-white/10 rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[#18CFFC] transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-3">
          Stage / Screen Position
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {STAGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update({ stage_position: opt.value })}
              className={`p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                config.stage_position === opt.value
                  ? 'border-[#18CFFC] bg-[#18CFFC]/10'
                  : 'border-white/10 bg-[var(--color-surface-2)] hover:border-white/20'
              }`}
            >
              <div className="text-sm font-medium text-[var(--color-text-primary)]">{opt.label}</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{opt.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

