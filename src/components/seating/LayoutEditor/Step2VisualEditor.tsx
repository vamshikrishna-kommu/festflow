import { useState } from 'react'
import {
  Plus,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  addRow,
  removeRow,
  addSeatToRow,
  removeSeat,
  updateSeat,
  insertAisleAfter,
  getTotalCapacity,
} from '@/lib/seatLayoutEditor'
import type { LayoutEditorConfig, LayoutEditorSeat } from '@/types/seating'

interface Props {
  config: LayoutEditorConfig
  onChange: (config: LayoutEditorConfig) => void
}

type SeatTool = 'select' | 'block' | 'accessible' | 'aisle' | 'erase'

export function Step2VisualEditor({ config, onChange }: Props) {
  const [activeTool, setActiveTool] = useState<SeatTool>('select')
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null)
  const [seatsPerNewRow, setSeatsPerNewRow] = useState(10)

  const categoryMap: Record<string, { name: string; color: string }> = {}
  for (const cat of config.categories) {
    categoryMap[cat.tempId] = { name: cat.name, color: cat.color }
    if (cat.id) categoryMap[cat.id] = { name: cat.name, color: cat.color }
  }

  const handleSeatClick = (seat: LayoutEditorSeat) => {
    if (seat.is_aisle_gap) return

    if (activeTool === 'block') {
      onChange(updateSeat(config, seat.tempId, { is_blocked: !seat.is_blocked }))
    } else if (activeTool === 'accessible') {
      onChange(updateSeat(config, seat.tempId, { is_accessible: !seat.is_accessible }))
    } else if (activeTool === 'aisle') {
      onChange(insertAisleAfter(config, seat.row_identifier, seat.tempId))
    } else if (activeTool === 'erase') {
      onChange(removeSeat(config, seat.tempId))
    } else {
      setSelectedSeat(seat.tempId === selectedSeat ? null : seat.tempId)
    }
  }

  const getSeatColor = (seat: LayoutEditorSeat): string => {
    if (seat.is_aisle_gap) return 'transparent'
    if (seat.is_blocked) return '#374151'
    const catId = seat.category_id ?? ''
    return categoryMap[catId]?.color ?? '#18CFFC'
  }

  const totalCapacity = getTotalCapacity(config)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">Layout Editor</h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            {totalCapacity} available seats across {config.rows.length} rows
          </p>
        </div>

        {/* Tools */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'select' as SeatTool, label: 'Select', emoji: '👆' },
            { id: 'block' as SeatTool, label: 'Block', emoji: '🚫' },
            { id: 'accessible' as SeatTool, label: 'Accessible', emoji: '♿' },
            { id: 'aisle' as SeatTool, label: 'Aisle Gap', emoji: '↔' },
            { id: 'erase' as SeatTool, label: 'Erase', emoji: '🗑' },
          ].map((tool) => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                activeTool === tool.id
                  ? 'bg-[#18CFFC]/20 border-[#18CFFC] text-[#18CFFC]'
                  : 'bg-[var(--color-surface-2)] border-white/10 text-[var(--color-text-secondary)] hover:border-white/20'
              }`}
            >
              {tool.emoji} {tool.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stage indicator */}
      {config.stage_position === 'front' && (
        <div className="w-full h-10 bg-gradient-to-r from-[#18CFFC]/20 via-[#0D56FB]/20 to-[#7F1AFB]/20 rounded-xl border border-white/10 flex items-center justify-center">
          <span className="text-xs font-semibold tracking-widest text-[#18CFFC] uppercase">◀ STAGE / SCREEN ▶</span>
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-fit space-y-1.5 pb-2">
          {config.rows.map((row) => (
            <div key={row.row_identifier} className="flex items-center gap-2">
              {/* Row label */}
              <div className="w-8 flex-shrink-0 text-center text-xs font-bold text-[var(--color-text-muted)]">
                {row.row_identifier}
              </div>

              {/* Seats */}
              <div className="flex items-center gap-1 flex-wrap">
                {row.seats.map((seat) => {
                  if (seat.is_aisle_gap) {
                    return (
                      <div key={seat.tempId} className="w-5 h-8 flex-shrink-0" title="Aisle gap" />
                    )
                  }
                  const catColor = getSeatColor(seat)
                  const isSelected = selectedSeat === seat.tempId
                  return (
                    <button
                      key={seat.tempId}
                      onClick={() => handleSeatClick(seat)}
                      title={`${seat.display_label}${seat.is_blocked ? ' (blocked)' : ''}${seat.is_accessible ? ' ♿' : ''}`}
                      className={`
                        relative w-8 h-8 rounded-md flex-shrink-0 text-[10px] font-bold
                        flex items-center justify-center transition-all duration-150
                        border-2 cursor-pointer
                        ${seat.is_blocked
                          ? 'opacity-40 border-gray-600'
                          : isSelected
                          ? 'scale-110 border-white shadow-lg'
                          : 'border-transparent hover:scale-105 hover:border-white/40'
                        }
                      `}
                      style={{
                        backgroundColor: seat.is_blocked ? '#374151' : catColor + '33',
                        borderColor: isSelected ? 'white' : seat.is_blocked ? '#374151' : catColor + '66',
                      }}
                    >
                      <span style={{ color: catColor }}>{seat.display_label.replace(seat.row_identifier, '')}</span>
                      {seat.is_accessible && (
                        <span className="absolute -top-1 -right-1 text-[8px]">♿</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Row controls */}
              <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                <button
                  onClick={() => onChange(addSeatToRow(config, row.row_identifier))}
                  className="w-6 h-6 rounded flex items-center justify-center bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-muted)] hover:text-[#18CFFC] transition-colors"
                  title="Add seat"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onChange(removeRow(config, row.row_identifier))}
                  className="w-6 h-6 rounded flex items-center justify-center bg-[var(--color-surface-2)] hover:bg-red-900/40 text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                  title="Remove row"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Back stage indicator */}
      {config.stage_position === 'back' && (
        <div className="w-full h-10 bg-gradient-to-r from-[#18CFFC]/20 via-[#0D56FB]/20 to-[#7F1AFB]/20 rounded-xl border border-white/10 flex items-center justify-center">
          <span className="text-xs font-semibold tracking-widest text-[#18CFFC] uppercase">◀ STAGE / SCREEN ▶</span>
        </div>
      )}

      {/* Add row */}
      <div className="flex items-center gap-3 pt-2 border-t border-white/5">
        <label className="text-sm text-[var(--color-text-muted)]">Seats per row:</label>
        <input
          type="number"
          min={1}
          max={50}
          value={seatsPerNewRow}
          onChange={(e) => setSeatsPerNewRow(Math.max(1, Math.min(50, Number(e.target.value))))}
          className="w-20 px-2 py-1.5 bg-[var(--color-surface-2)] border border-white/10 rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[#18CFFC]"
        />
        <Button
          variant="outline"
          onClick={() => onChange(addRow(config, seatsPerNewRow))}
          className="text-sm"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Row
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#18CFFC]/30 border border-[#18CFFC]/60" /> Available</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-700 opacity-40 border border-gray-600" /> Blocked</span>
        <span className="flex items-center gap-1.5">♿ Accessible</span>
        <span className="flex items-center gap-1.5"><span className="w-5 h-3" /> Aisle Gap</span>
      </div>
    </div>
  )
}

