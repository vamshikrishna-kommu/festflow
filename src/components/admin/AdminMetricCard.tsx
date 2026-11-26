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
      border: 'border-gray-200 hover:border-blue-300',
      text: 'text-blue-600',
      iconBg: 'bg-blue-50 text-blue-600 border-blue-200',
    },
    violet: {
      border: 'border-gray-200 hover:border-indigo-300',
      text: 'text-indigo-600',
      iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    },
    magenta: {
      border: 'border-gray-200 hover:border-purple-300',
      text: 'text-purple-600',
      iconBg: 'bg-purple-50 text-purple-600 border-purple-200',
    },
    emerald: {
      border: 'border-gray-200 hover:border-emerald-300',
      text: 'text-emerald-600',
      iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    },
    amber: {
      border: 'border-gray-200 hover:border-amber-300',
      text: 'text-amber-600',
      iconBg: 'bg-amber-50 text-amber-600 border-amber-200',
    },
  }

  const styles = colorMap[color]

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl bg-white p-5 border shadow-xs transition-all duration-300
        ${styles.border} group
      `}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-xs font-medium text-gray-500 tracking-wide uppercase font-mono">
          {title}
        </span>
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${styles.iconBg}`}>
          <Icon size={18} />
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-mono tracking-tight">
          {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
        </span>
        {delta && (
          <span
            className={`
              text-[11px] font-mono font-medium px-2 py-0.5 rounded-full
              ${
                trend === 'up'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : trend === 'down'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-gray-100 text-gray-600'
              }
            `}
          >
            {delta}
          </span>
        )}
      </div>

      {subtitle && <p className="text-[11px] text-gray-500 mt-2 truncate">{subtitle}</p>}
    </div>
  )
}

