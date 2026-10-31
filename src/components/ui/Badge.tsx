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
  default: 'bg-white/[0.06] text-zinc-300 border border-white/10',
  brand:   'bg-gradient-to-r from-[#18CFFC]/15 to-[#7F1AFB]/15 text-[#18CFFC] border border-[#18CFFC]/40 shadow-[0_0_14px_rgba(24,207,252,0.25)]',
  cyan:    'bg-[#18CFFC]/15 text-[#18CFFC] border border-[#18CFFC]/35 shadow-[0_0_12px_rgba(24,207,252,0.20)]',
  blue:    'bg-[#07A4FC]/15 text-[#38BDF8] border border-[#07A4FC]/35 shadow-[0_0_12px_rgba(7,164,252,0.20)]',
  violet:  'bg-[#7F1AFB]/15 text-[#C084FC] border border-[#7F1AFB]/35 shadow-[0_0_12px_rgba(127,26,251,0.20)]',
  purple:  'bg-[#7F1AFB]/15 text-[#C084FC] border border-[#7F1AFB]/35 shadow-[0_0_12px_rgba(127,26,251,0.20)]',
  magenta: 'bg-[#ED47FC]/15 text-[#FE7EE8] border border-[#ED47FC]/35 shadow-[0_0_12px_rgba(237,71,252,0.20)]',
  pink:    'bg-[#ED47FC]/15 text-[#FE7EE8] border border-[#ED47FC]/35 shadow-[0_0_12px_rgba(237,71,252,0.20)]',
  amber:   'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  outline: 'bg-transparent text-zinc-300 border border-white/15',
  danger:  'bg-rose-500/15 text-rose-400 border border-rose-500/30',
  neutral: 'bg-white/[0.08] text-white border border-white/15',
}

const CATEGORY_VARIANT_MAP: Record<string, BadgeVariant> = {
  hackathon: 'purple',
  tech:      'cyan',
  music:     'pink',
  cultural:  'pink',
  workshop:  'amber',
  seminar:   'amber',
  sports:    'success',
  gaming:    'purple',
  art:       'amber',
  social:    'default',
}

export function Badge({ variant = 'default', children, className = '', pulse = false, dot = false }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${variantClasses[variant]} ${className}`}
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
  const variant = CATEGORY_VARIANT_MAP[category] ?? 'default'
  return <Badge variant={variant}>{category}</Badge>
}
