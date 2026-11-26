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
    return <IconComponent size={24} className="text-gray-600" />
  }

  return (
    <div
      className={`p-8 sm:p-12 rounded-2xl bg-white text-center flex flex-col items-center justify-center gap-3.5 border border-gray-200/90 shadow-sm ${className}`}
    >
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-gray-50 text-gray-700 flex items-center justify-center border border-gray-200/80 shadow-xs">
          {renderIcon()}
        </div>
      )}

      <div className="space-y-1 max-w-md">
        <h3 className="font-display font-semibold text-base text-gray-900">
          {title}
        </h3>
        {description && (
          <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  )
}
