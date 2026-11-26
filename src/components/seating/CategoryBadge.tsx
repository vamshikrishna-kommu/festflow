import type { SeatCategory } from '@/types/seating'

interface CategoryBadgeProps {
  category: SeatCategory | null | undefined
  size?: 'sm' | 'md'
  showPrice?: boolean
}

export function CategoryBadge({ category, size = 'md', showPrice = false }: CategoryBadgeProps) {
  if (!category) return null
  const dot = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'
  const text = size === 'sm' ? 'text-xs' : 'text-sm'
  return (
    <span className={`inline-flex items-center gap-1.5 ${text} font-medium text-gray-700`}>
      <span
        className={`${dot} rounded-full flex-shrink-0`}
        style={{ backgroundColor: category.color }}
      />
      {category.name}
      {showPrice && category.price > 0 && (
        <span className="text-gray-500">· ₹{category.price}</span>
      )}
    </span>
  )
}

