import type { SeatCategory } from '@/types/seating'

interface SeatLegendProps {
  categories: SeatCategory[]
}

export function SeatLegend({ categories }: SeatLegendProps) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--color-text-muted)]">
      {categories.map((cat) => (
        <span key={cat.id} className="flex items-center gap-1.5">
          <span
            className="w-3.5 h-3.5 rounded"
            style={{ backgroundColor: cat.color + '33', border: `2px solid ${cat.color + '88'}` }}
          />
          <span className="text-[var(--color-text-secondary)]">{cat.name}</span>
          {cat.price > 0 && <span>· ₹{cat.price}</span>}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="w-3.5 h-3.5 rounded border-2 border-[#18CFFC] bg-[#18CFFC]" />
        <span className="text-[var(--color-text-secondary)]">Selected</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3.5 h-3.5 rounded border-2 border-gray-600 bg-gray-700/30 opacity-40" />
        <span>Taken/Blocked</span>
      </span>
    </div>
  )
}

