import { type ReactNode } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react'

export type AlertVariant = 'info' | 'success' | 'warning' | 'error' | 'neutral'

export interface AlertProps {
  variant?: AlertVariant
  title?: string
  children: ReactNode
  icon?: ReactNode
  dismissible?: boolean
  onDismiss?: () => void
  className?: string
}

const variantStyles: Record<
  AlertVariant,
  {
    container: string
    iconColor: string
    defaultIcon: typeof Info
  }
> = {
  info: {
    container: 'bg-cyan-500/10 border-cyan-500/25 text-cyan-200',
    iconColor: 'text-cyan-400',
    defaultIcon: Info,
  },
  success: {
    container: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200',
    iconColor: 'text-emerald-400',
    defaultIcon: CheckCircle2,
  },
  warning: {
    container: 'bg-amber-500/10 border-amber-500/25 text-amber-200',
    iconColor: 'text-amber-400',
    defaultIcon: AlertTriangle,
  },
  error: {
    container: 'bg-rose-500/10 border-rose-500/25 text-rose-200',
    iconColor: 'text-rose-400',
    defaultIcon: AlertCircle,
  },
  neutral: {
    container: 'bg-[#14141A] border-white/10 text-[#A1A1AA]',
    iconColor: 'text-[#71717A]',
    defaultIcon: Info,
  },
}

export function Alert({
  variant = 'info',
  title,
  children,
  icon,
  dismissible = false,
  onDismiss,
  className = '',
}: AlertProps) {
  const config = variantStyles[variant]
  const IconComponent = config.defaultIcon

  return (
    <div
      role="alert"
      className={`p-3.5 sm:p-4 rounded-2xl border text-xs sm:text-sm flex items-start gap-3 transition-colors ${config.container} ${className}`}
    >
      <div className={`shrink-0 mt-0.5 ${config.iconColor}`}>
        {icon || <IconComponent size={18} />}
      </div>

      <div className="flex-1 min-w-0">
        {title && (
          <h4 className="font-semibold text-xs sm:text-sm text-[var(--color-text-primary)] mb-1">
            {title}
          </h4>
        )}
        <div className="text-xs sm:text-sm leading-relaxed opacity-90">{children}</div>
      </div>

      {dismissible && onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 p-1 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/20 transition-all text-current -mr-1 -mt-1"
          aria-label="Dismiss alert"
        >
          <X size={15} />
        </button>
      )}
    </div>
  )
}
