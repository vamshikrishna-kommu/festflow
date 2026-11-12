import { useState, useEffect, useCallback } from 'react'
import { ZoomIn, ZoomOut, RotateCcw, Loader2, AlertCircle } from 'lucide-react'
import { SeatRow } from './SeatRow'
import { SeatLegend } from './SeatLegend'
import { StageIndicator } from './StageIndicator'
import { RealtimeConnectionStatus } from '../RealtimeConnectionStatus'
import {
  fetchSeatLayout,
  fetchSeatAvailability,
  subscribeToSeatAvailability,
  groupSeatsIntoRows,
} from '@/lib/seating'
import type {
  SeatLayoutFull,
  SeatWithAvailability,
  SeatAvailabilityMap,
  SeatRow as SeatRowType,
} from '@/types/seating'

interface SeatMapProps {
  eventId: string
  maxSelectableSeats: number
  onSeatsSelected: (seats: SeatWithAvailability[]) => void
  disabled?: boolean
}

export function SeatMap({ eventId, maxSelectableSeats, onSeatsSelected, disabled }: SeatMapProps) {
  const [layout, setLayout] = useState<SeatLayoutFull | null>(null)
  const [availability, setAvailability] = useState<SeatAvailabilityMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [realtimeConnected, setRealtimeConnected] = useState(true)
  const [zoom, setZoom] = useState(1)

  // Load layout
  useEffect(() => {
    setLoading(true)
    setError(null)
    setSelectedIds(new Set())

    fetchSeatLayout(eventId).then((l) => {
      if (!l) {
        setError('No seat layout is published for this event.')
      } else {
        setLayout(l)
        // Fetch initial availability
        fetchSeatAvailability(eventId).then(setAvailability)
      }
      setLoading(false)
    })

    // Subscribe to realtime
    const unsub = subscribeToSeatAvailability(eventId, (map) => {
      setAvailability(map)
      setRealtimeConnected(true)
    })
    return unsub
  }, [eventId])

  // Build rows with live availability
  const rows: SeatRowType[] = layout
    ? groupSeatsIntoRows(
        layout.seats.map((seat) => {
          const avail = availability[seat.id]
          return {
            ...seat,
            status: avail
              ? avail.is_mine
                ? 'my_hold'
                : (avail.status as any)
              : seat.status,
            held_until: avail?.held_until,
            is_mine: avail?.is_mine,
          }
        })
      )
    : []

  const handleSeatClick = useCallback(
    (seat: SeatWithAvailability) => {
      if (disabled) return
      const unavailable = ['held', 'payment_submitted', 'payment_under_review', 'confirmed', 'blocked', 'aisle_gap'].includes(seat.status)
      if (unavailable) return

      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(seat.id)) {
          next.delete(seat.id)
        } else {
          if (next.size >= maxSelectableSeats) {
            // Replace first selected with new one if only 1 allowed
            if (maxSelectableSeats === 1) {
              next.clear()
              next.add(seat.id)
            }
            // Otherwise silently ignore (user must deselect first)
            return prev
          }
          next.add(seat.id)
        }
        return next
      })
    },
    [disabled, maxSelectableSeats]
  )

  // Notify parent when selection changes
  useEffect(() => {
    if (!layout) return
    const selected = layout.seats.filter((s) => selectedIds.has(s.id))
    onSeatsSelected(selected)
  }, [selectedIds, layout, onSeatsSelected])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-[var(--color-text-muted)]">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading seat map…
      </div>
    )
  }

  if (error || !layout) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-red-400">
        <AlertCircle className="w-5 h-5" />
        {error ?? 'Failed to load seat layout.'}
      </div>
    )
  }

  return (
    <div className="relative w-full">
      <RealtimeConnectionStatus isConnected={realtimeConnected} />

      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-[var(--color-text-muted)]">
          {selectedIds.size > 0 ? (
            <span className="text-[#18CFFC] font-semibold">{selectedIds.size} seat{selectedIds.size > 1 ? 's' : ''} selected</span>
          ) : (
            <span>Select {maxSelectableSeats > 1 ? `up to ${maxSelectableSeats} seats` : 'a seat'} below</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
            className="p-1.5 rounded-lg bg-[var(--color-surface-2)] border border-white/10 text-[var(--color-text-muted)] hover:text-[#18CFFC] transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-[var(--color-text-muted)] w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}
            className="p-1.5 rounded-lg bg-[var(--color-surface-2)] border border-white/10 text-[var(--color-text-muted)] hover:text-[#18CFFC] transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="p-1.5 rounded-lg bg-[var(--color-surface-2)] border border-white/10 text-[var(--color-text-muted)] hover:text-[#18CFFC] transition-colors"
            title="Reset zoom"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stage at front */}
      {layout.stage_position === 'front' && (
        <div className="mb-4">
          <StageIndicator position={layout.stage_position} />
        </div>
      )}

      {/* Grid */}
      <div className="overflow-auto pb-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div
          className="origin-top transition-transform duration-200 inline-block min-w-full"
          style={{ transform: `scale(${zoom})` }}
        >
          <div className="space-y-1.5" role="grid" aria-label={`Seat map for ${layout.name}`}>
            {rows.map((row) => (
              <SeatRow
                key={row.row_identifier}
                rowIdentifier={row.row_identifier}
                seats={row.seats}
                selectedSeatIds={selectedIds}
                onSeatClick={handleSeatClick}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Stage at back */}
      {layout.stage_position === 'back' && (
        <div className="mt-4">
          <StageIndicator position={layout.stage_position} />
        </div>
      )}

      {/* Legend */}
      <div className="mt-5 pt-4 border-t border-white/5">
        <SeatLegend categories={layout.categories} />
      </div>
    </div>
  )
}
export default SeatMap

