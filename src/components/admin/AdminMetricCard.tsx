// Phase 7: Reusable Admin Metric Card Component
import React from 'react'

interface AdminMetricCardProps {
  title: string
  value: string | number
  icon: React.ComponentType<{ size?: number; className?: string }>
  delta?: string
  trend?: 'up' | 'down' | 'neutral'
  subtitle?: string
  color?: 'cyan' | 'violet' | 'magenta' | 'emerald' | 'amber'
}

export function AdminMetricCard({
  title,
  value,
  icon: Icon,
  delta,
  trend = 'neutral',
  subtitle,
  color = 'cyan',
}: AdminMetricCardProps) {
  const colorMap = {
    cyan: {
      border: 'border-[#18CFFC]/20 hover:border-[#18CFFC]/50',
      bgGlow: 'from-[#18CFFC]/10 to-transparent',
      text: 'text-[#18CFFC]',
      iconBg: 'bg-[#18CFFC]/10 text-[#18CFFC] border-[#18CFFC]/30',
    },
    violet: {
      border: 'border-[#7F1AFB]/20 hover:border-[#7F1AFB]/50',
      bgGlow: 'from-[#7F1AFB]/10 to-transparent',
      text: 'text-[#7F1AFB]',
      iconBg: 'bg-[#7F1AFB]/10 text-[#7F1AFB] border-[#7F1AFB]/30',
    },
    magenta: {
      border: 'border-[#ED47FC]/20 hover:border-[#ED47FC]/50',
      bgGlow: 'from-[#ED47FC]/10 to-transparent',
      text: 'text-[#ED47FC]',
      iconBg: 'bg-[#ED47FC]/10 text-[#ED47FC] border-[#ED47FC]/30',
    },
    emerald: {
      border: 'border-emerald-500/20 hover:border-emerald-500/50',
      bgGlow: 'from-emerald-500/10 to-transparent',
      text: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    },
    amber: {
      border: 'border-amber-500/20 hover:border-amber-500/50',
      bgGlow: 'from-amber-500/10 to-transparent',
      text: 'text-amber-400',
      iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    },
  }

  const styles = colorMap[color]

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl bg-[#0D0E15] p-5 border transition-all duration-300
        ${styles.border} group
      `}
    >
      {/* Background radial gradient glow */}
      <div
        className={`
          absolute -right-10 -top-10 w-28 h-28 rounded-full bg-gradient-to-br ${styles.bgGlow}
          blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-500
        `}
      />

      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-xs font-medium text-white/50 tracking-wide uppercase font-mono">
          {title}
        </span>
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${styles.iconBg}`}>
          <Icon size={18} />
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight">
          {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
        </span>
        {delta && (
          <span
            className={`
              text-[11px] font-mono font-medium px-2 py-0.5 rounded-full
              ${
                trend === 'up'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : trend === 'down'
                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  : 'bg-white/10 text-white/60'
              }
            `}
          >
            {delta}
          </span>
        )}
      </div>

      {subtitle && <p className="text-[11px] text-white/40 mt-2 truncate">{subtitle}</p>}
    </div>
  )
}

