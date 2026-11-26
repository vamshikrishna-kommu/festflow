import type { ReactNode } from 'react'
import type { BadgeVariant } from '@/types'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
  pulse?: boolean
  dot?: boolean
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700 border border-gray-200/80',
  brand:   'bg-blue-50 text-blue-700 border border-blue-200/90 font-medium',
  cyan:    'bg-sky-50 text-sky-700 border border-sky-200',
  blue:    'bg-blue-50 text-blue-700 border border-blue-200',
  info:    'bg-blue-50 text-blue-700 border border-blue-200',
  indigo:  'bg-indigo-50 text-indigo-700 border border-indigo-200',
  violet:  'bg-indigo-50 text-indigo-700 border border-indigo-200',
  purple:  'bg-purple-50 text-purple-700 border border-purple-200',
  magenta: 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200',
  pink:    'bg-pink-50 text-pink-700 border border-pink-200',
  amber:   'bg-amber-50 text-amber-800 border border-amber-200',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  outline: 'bg-white text-gray-700 border border-gray-300',
  danger:  'bg-rose-50 text-rose-700 border border-rose-200',
  neutral: 'bg-gray-100 text-gray-800 border border-gray-200',
}

const CATEGORY_VARIANT_MAP: Record<string, BadgeVariant> = {
  hackathon: 'purple',
  tech:      'blue',
  music:     'pink',
  cultural:  'magenta',
  workshop:  'amber',
  seminar:   'cyan',
  sports:    'success',
  gaming:    'violet',
  art:       'amber',
  social:    'default',
}

export function Badge({ variant = 'default', children, className = '', pulse = false, dot = false }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-tight transition-colors ${variantClasses[variant]} ${className}`}
    >
      {(pulse || dot) && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
          )}
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
        </span>
      )}
      {children}
    </span>
  )
}

/** Convenience: automatically selects a variant from the event category string */
export function CategoryBadge({ category }: { category: string }) {
  const variant = CATEGORY_VARIANT_MAP[category.toLowerCase()] ?? 'default'
  return <Badge variant={variant}>{category}</Badge>
}
