import { useState, useMemo } from 'react'
import {
  BarChart3,
  Users,
  DollarSign,
  Layers,
} from 'lucide-react'
import { Modal, ModalBody, ModalFooter, Button, Badge } from '@/components/ui'
import type { EventRecord } from '@/types'

interface EventComparisonModalProps {
  isOpen: boolean
  onClose: () => void
  events: EventRecord[]
}

export function EventComparisonModal({
  isOpen,
  onClose,
  events,
}: EventComparisonModalProps) {
  // Pre-select first 2 events if available
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    events.slice(0, 2).map((e) => e.id)
  )

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev // keep at least 1
        return prev.filter((item) => item !== id)
      } else {
        if (prev.length >= 4) return prev // max 4
        return [...prev, id]
      }
    })
  }

  const comparedEvents = useMemo(
    () => events.filter((e) => selectedIds.includes(e.id)),
    [events, selectedIds]
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Multi-Event Performance Comparison">
      <ModalBody>
        <div className="flex flex-col gap-5">
          {/* Event Selector Chips */}
          <div>
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
              Select Events to Compare (2 - 4 Events):
            </span>
            <div className="flex flex-wrap gap-2">
              {events.map((e) => {
                const isSelected = selectedIds.includes(e.id)
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => toggleSelect(e.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#18CFFC] text-black font-bold shadow-md shadow-[#18CFFC]/20'
                        : 'bg-[#14141A] text-zinc-400 hover:text-white border border-white/10'
                    }`}
                  >
                    <span>{e.title}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Comparison Cards Grid */}
          <div
            className={`grid gap-4 ${
              comparedEvents.length === 2
                ? 'grid-cols-1 sm:grid-cols-2'
                : comparedEvents.length === 3
                ? 'grid-cols-1 sm:grid-cols-3'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            }`}
          >
            {comparedEvents.map((evt) => {
              const capacity = evt.capacity || 100
              // Derived metrics based on legitimate event data
              const price = evt.price || 0
              const isFree = evt.is_free

              return (
                <div
                  key={evt.id}
                  className="p-4 rounded-3xl bg-[#0E0E12] border border-white/10 flex flex-col justify-between gap-4 shadow-xl relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#18CFFC]/5 rounded-full blur-2xl pointer-events-none" />

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#18CFFC]">
                        {evt.category}
                      </span>
                      <Badge variant={evt.status === 'published' ? 'success' : 'neutral'} className="text-[10px]">
                        {evt.status}
                      </Badge>
                    </div>

                    <h4 className="text-sm font-bold font-heading text-white line-clamp-1">
                      {evt.title}
                    </h4>
                    <span className="text-[11px] text-zinc-400 block mt-0.5">
                      {evt.start_date ? new Date(evt.start_date).toLocaleDateString('en-IN') : 'Date TBA'}
                    </span>
                  </div>

                  {/* Metrics Table */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-white/5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400 flex items-center gap-1.5">
                        <Users size={12} className="text-[#18CFFC]" /> Total Capacity:
                      </span>
                      <strong className="text-white font-mono">{capacity}</strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400 flex items-center gap-1.5">
                        <DollarSign size={12} className="text-emerald-400" /> Pass Pricing:
                      </span>
                      <strong className="text-white font-mono">
                        {isFree ? 'Free' : `₹${price}`}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400 flex items-center gap-1.5">
                        <Layers size={12} className="text-[#7F1AFB]" /> Mode:
                      </span>
                      <strong className="text-white capitalize font-mono">
                        {evt.event_type || 'offline'}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400 flex items-center gap-1.5">
                        <BarChart3 size={12} className="text-sky-400" /> Participation:
                      </span>
                      <strong className="text-white capitalize font-mono">
                        {evt.participation_type || 'individual'}
                      </strong>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Done
        </Button>
      </ModalFooter>
    </Modal>
  )
}

