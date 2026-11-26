import { groupSeatsIntoRows } from '@/lib/seating'
import type { LayoutEditorConfig, SeatWithAvailability } from '@/types/seating'

interface Props {
  config: LayoutEditorConfig
  onChange: (config: LayoutEditorConfig) => void
  eventId: string
}

export function Step5Preview({ config }: Props) {
  const categoryMap: Record<string, { name: string; color: string }> = {}
  for (const cat of config.categories) {
    categoryMap[cat.tempId] = { name: cat.name, color: cat.color }
  }

  // Build a preview seat list from config (not from DB)
  const previewSeats: SeatWithAvailability[] = config.rows.flatMap((row) =>
    row.seats.map((seat) => ({
      id: seat.tempId,
      layout_id: '',
      category_id: seat.category_id,
      row_identifier: seat.row_identifier,
      column_position: seat.column_position,
      display_label: seat.display_label,
      section: seat.section ?? null,
      is_blocked: seat.is_blocked,
      is_accessible: seat.is_accessible,
      is_aisle_gap: seat.is_aisle_gap,
      description: null,
      created_at: '',
      status: seat.is_aisle_gap ? 'aisle_gap' : seat.is_blocked ? 'blocked' : 'available',
      category: seat.category_id ? (categoryMap[seat.category_id] ? {
        id: seat.category_id,
        layout_id: '',
        name: categoryMap[seat.category_id].name,
        color: categoryMap[seat.category_id].color,
        price: config.categories.find(c => c.tempId === seat.category_id)?.price ?? 0,
        description: null,
        sort_order: 0,
        created_at: '',
      } : null) : null,
    }))
  )

  const rows = groupSeatsIntoRows(previewSeats)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">Student Preview</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          This is how students will see the seat map when booking. Click &quot;Publish Layout&quot; to make it live.
        </p>
      </div>

      {/* Stage */}
      {config.stage_position === 'front' && (
        <div className="w-full h-10 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-center">
          <span className="text-xs font-semibold tracking-widest text-blue-700 uppercase">◀ STAGE / SCREEN ▶</span>
        </div>
      )}

      {/* Seat grid */}
      <div className="overflow-x-auto">
        <div className="min-w-fit space-y-1.5 pb-2">
          {rows.map((row) => (
            <div key={row.row_identifier} className="flex items-center gap-2">
              <div className="w-6 text-center text-xs font-bold text-gray-500">
                {row.row_identifier}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {row.seats.map((seat) => {
                  if (seat.is_aisle_gap) {
                    return <div key={seat.id} className="w-4 h-7" />
                  }
                  const catColor = seat.category?.color ?? '#2563EB'
                  return (
                    <div
                      key={seat.id}
                      className={`w-7 h-7 rounded flex items-center justify-center text-[9px] font-bold border transition-transform ${
                        seat.is_blocked
                          ? 'opacity-60 border-gray-300 bg-gray-200 text-gray-500'
                          : 'border-transparent cursor-pointer hover:scale-110'
                      }`}
                      style={
                        seat.is_blocked
                          ? undefined
                          : { backgroundColor: catColor + '22', borderColor: catColor + '88', color: catColor }
                      }
                      title={`${seat.display_label}${seat.category ? ` — ${seat.category.name}` : ''}`}
                    >
                      {seat.display_label.replace(seat.row_identifier, '')}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Legend</h3>
        <div className="flex flex-wrap gap-4">
          {config.categories.map((cat) => (
            <span key={cat.tempId} className="flex items-center gap-2 text-sm text-gray-700">
              <span className="w-4 h-4 rounded" style={{ backgroundColor: cat.color + '33', border: `2px solid ${cat.color}` }} />
              {cat.name}
              {cat.price > 0 ? ` · ₹${cat.price}` : ' · Free'}
            </span>
          ))}
          <span className="flex items-center gap-2 text-sm text-gray-500">
            <span className="w-4 h-4 rounded bg-gray-200 border border-gray-300" />
            Blocked
          </span>
        </div>
      </div>
    </div>
  )
}

