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
    titleColor: string
    defaultIcon: typeof Info
  }
> = {
  info: {
    container: 'bg-blue-50/70 border-blue-200/80 text-blue-900',
    iconColor: 'text-blue-600',
    titleColor: 'text-blue-950',
    defaultIcon: Info,
  },
  success: {
    container: 'bg-emerald-50/70 border-emerald-200/80 text-emerald-900',
    iconColor: 'text-emerald-600',
    titleColor: 'text-emerald-950',
    defaultIcon: CheckCircle2,
  },
  warning: {
    container: 'bg-amber-50/70 border-amber-200/80 text-amber-900',
    iconColor: 'text-amber-600',
    titleColor: 'text-amber-950',
    defaultIcon: AlertTriangle,
  },
  error: {
    container: 'bg-rose-50/70 border-rose-200/80 text-rose-900',
    iconColor: 'text-rose-600',
    titleColor: 'text-rose-950',
    defaultIcon: AlertCircle,
  },
  neutral: {
    container: 'bg-gray-50 border-gray-200 text-gray-800',
    iconColor: 'text-gray-500',
    titleColor: 'text-gray-900',
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
      className={`p-3.5 sm:p-4 rounded-xl border text-xs sm:text-sm flex items-start gap-3 transition-colors ${config.container} ${className}`}
    >
      <div className={`shrink-0 mt-0.5 ${config.iconColor}`}>
        {icon || <IconComponent size={18} />}
      </div>

      <div className="flex-1 min-w-0">
        {title && (
          <h4 className={`font-semibold text-xs sm:text-sm ${config.titleColor} mb-0.5`}>
            {title}
          </h4>
        )}
        <div className="leading-relaxed opacity-90">{children}</div>
      </div>

      {dismissible && onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded-md text-gray-400 hover:text-gray-700 transition-colors shrink-0 cursor-pointer"
          aria-label="Dismiss alert"
        >
          <X size={15} />
        </button>
      )}
    </div>
  )
}
