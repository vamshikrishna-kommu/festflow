import { isValidElement, type ReactNode, type ElementType } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface EmptyStateProps {
  icon?: LucideIcon | ReactNode | ElementType
  title: string
  description?: string
  action?: ReactNode
  secondaryAction?: ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className = '',
}: EmptyStateProps) {
  const renderIcon = () => {
    if (!icon) return null
    if (isValidElement(icon)) {
      return icon
    }
    const IconComponent = icon as ElementType
    return <IconComponent size={28} className="text-[#18CFFC]" />
  }

  return (
    <div
      className={`p-8 sm:p-14 rounded-3xl bg-[var(--color-surface-1)] text-center flex flex-col items-center justify-center gap-4 border border-[oklch(100%_0_0_/_0.07)] ${className}`}
    >
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-[var(--color-surface-2)] text-[#18CFFC] flex items-center justify-center border border-[oklch(100%_0_0_/_0.06)] shadow-sm">
          {renderIcon()}
        </div>
      )}

      <div className="space-y-1.5 max-w-md">
        <h3 className="font-display font-bold text-base sm:text-lg text-[var(--color-text-primary)]">
          {title}
        </h3>
        {description && (
          <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  )
}
