import type { SeatCategory } from '@/types/seating'

interface SeatLegendProps {
  categories: SeatCategory[]
}

export function SeatLegend({ categories }: SeatLegendProps) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500">
      {categories.map((cat) => (
        <span key={cat.id} className="flex items-center gap-1.5">
          <span
            className="w-3.5 h-3.5 rounded"
            style={{ backgroundColor: cat.color + '26', border: `2px solid ${cat.color + '99'}` }}
          />
          <span className="text-gray-700 font-medium">{cat.name}</span>
          {cat.price > 0 && <span>· ₹{cat.price}</span>}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="w-3.5 h-3.5 rounded border-2 border-blue-700 bg-blue-600" />
        <span className="text-gray-700 font-medium">Selected</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3.5 h-3.5 rounded border-2 border-gray-300 bg-gray-200" />
        <span>Taken/Blocked</span>
      </span>
    </div>
  )
}

