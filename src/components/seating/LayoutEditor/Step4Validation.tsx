import { useMemo } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { validateLayout } from '@/lib/seating'
import { getTotalCapacity } from '@/lib/seatLayoutEditor'
import type { LayoutEditorConfig, LayoutValidationError } from '@/types/seating'

interface Props {
  config: LayoutEditorConfig
  onChange: (config: LayoutEditorConfig) => void
}

export function Step4Validation({ config }: Props) {
  const errors = useMemo(() => validateLayout(config), [config])
  const totalSeats = getTotalCapacity(config)
  const isValid = errors.length === 0

  const stats = {
    rows: config.rows.length,
    totalSeats,
    blocked: config.rows.flatMap((r) => r.seats).filter((s) => s.is_blocked && !s.is_aisle_gap).length,
    accessible: config.rows.flatMap((r) => r.seats).filter((s) => s.is_accessible).length,
    categories: config.categories.length,
    aisle_gaps: config.rows.flatMap((r) => r.seats).filter((s) => s.is_aisle_gap).length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">Validation</h2>
        <p className="text-sm text-[var(--color-text-muted)]">Review your layout before publishing.</p>
      </div>

      {/* Status */}
      <div
        className={`p-4 rounded-xl border flex items-start gap-3 ${
          isValid
            ? 'bg-emerald-900/20 border-emerald-500/30'
            : 'bg-red-900/20 border-red-500/30'
        }`}
      >
        {isValid ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        ) : (
          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        )}
        <div>
          <div className={`font-semibold ${isValid ? 'text-emerald-300' : 'text-red-300'}`}>
            {isValid ? 'Layout is valid and ready to publish' : `${errors.length} issue(s) found`}
          </div>
          {!isValid && (
            <ul className="mt-2 space-y-1">
              {errors.map((err: LayoutValidationError, idx: number) => (
                <li key={idx} className="text-sm text-red-300">
                  <span className="font-medium">{err.field}:</span> {err.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Rows', value: stats.rows },
          { label: 'Available Seats', value: stats.totalSeats },
          { label: 'Blocked', value: stats.blocked },
          { label: 'Accessible', value: stats.accessible },
          { label: 'Categories', value: stats.categories },
          { label: 'Aisle Gaps', value: stats.aisle_gaps },
        ].map((stat) => (
          <div
            key={stat.label}
            className="p-3 bg-[var(--color-surface-2)] rounded-xl border border-white/5"
          >
            <div className="text-2xl font-bold text-[#18CFFC]">{stat.value}</div>
            <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Hold settings summary */}
      <div className="p-4 bg-[var(--color-surface-2)] rounded-xl border border-white/5 space-y-2">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Settings Summary</h3>
        <div className="grid grid-cols-2 gap-y-1 text-sm">
          <span className="text-[var(--color-text-muted)]">Hold Duration</span>
          <span className="text-[var(--color-text-secondary)]">{config.hold_duration_minutes} minutes</span>
          <span className="text-[var(--color-text-muted)]">Max Seats / Registration</span>
          <span className="text-[var(--color-text-secondary)]">{config.max_seats_per_registration}</span>
          <span className="text-[var(--color-text-muted)]">Stage Position</span>
          <span className="text-[var(--color-text-secondary)] capitalize">{config.stage_position}</span>
          <span className="text-[var(--color-text-muted)]">Multi-Seat Booking</span>
          <span className="text-[var(--color-text-secondary)]">{config.allow_multi_seat ? 'Allowed' : 'Single seat only'}</span>
        </div>
      </div>
    </div>
  )
}
