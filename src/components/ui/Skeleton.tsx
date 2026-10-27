import type { HTMLAttributes } from 'react'

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'card'
  width?: string | number
  height?: string | number
  className?: string
}

export function Skeleton({
  variant = 'rectangular',
  width,
  height,
  className = '',
  style,
  ...props
}: SkeletonProps) {
  const variantStyles: Record<NonNullable<SkeletonProps['variant']>, string> = {
    text: 'h-4 w-full rounded-md',
    circular: 'rounded-full',
    rectangular: 'rounded-xl',
    card: 'rounded-[var(--radius-card)]',
  }

  const computedStyle = {
    ...(width !== undefined ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
    ...(height !== undefined ? { height: typeof height === 'number' ? `${height}px` : height } : {}),
    ...style,
  }

  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-[var(--color-surface-2)]/80 border border-[oklch(100%_0_0_/_0.04)] ${variantStyles[variant]} ${className}`}
      style={computedStyle}
      {...props}
    />
  )
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-[var(--radius-card)] bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.065)] p-4 flex flex-col gap-3.5 animate-pulse ${className}`}
    >
      <Skeleton variant="rectangular" className="h-44 w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton variant="text" className="w-1/3 h-3" />
        <Skeleton variant="text" className="w-3/4 h-5" />
      </div>
      <div className="flex items-center justify-between pt-2">
        <Skeleton variant="text" className="w-1/4 h-3.5" />
        <Skeleton variant="text" className="w-1/4 h-4 rounded-full" />
      </div>
    </div>
  )
}

export function SkeletonText({
  lines = 3,
  className = '',
}: {
  lines?: number
  className?: string
}) {
  return (
    <div aria-hidden="true" className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={`h-3.5 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  )
}
