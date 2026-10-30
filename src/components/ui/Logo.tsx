import { type ImgHTMLAttributes } from 'react'

export interface LogoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  /**
   * Presets for standard locations across the application
   */
  variant?: 'navbar' | 'auth' | 'footer' | 'hero' | 'ticket' | 'emblem' | 'compact' | 'custom'
  /**
   * Meaningful accessibility label, defaults to 'FestFlow logo'
   */
  alt?: string
  /**
   * Optional wrapper container classes
   */
  containerClassName?: string
}

const VARIANT_CONTAINER_CLASSES: Record<NonNullable<LogoProps['variant']>, string> = {
  navbar:
    'h-10 sm:h-12 md:h-14 w-auto max-w-[160px] flex items-center justify-center rounded-xl bg-black/60 p-1 border border-white/10 shadow-sm transition-all duration-200 group-hover:border-[#18CFFC]/40 group-hover:shadow-[0_0_18px_rgba(24,207,252,0.25)]',
  auth:
    'w-[160px] sm:w-[180px] md:w-[200px] max-w-full flex items-center justify-center rounded-2xl bg-black/75 p-2.5 border border-white/10 shadow-2xl transition-all duration-300 group-hover:border-[#18CFFC]/40 group-hover:shadow-[0_0_25px_rgba(127,26,251,0.30)]',
  footer:
    'w-[120px] sm:w-[140px] md:w-[150px] max-w-full flex items-center justify-center rounded-xl bg-black/60 p-2 border border-white/10 shadow-sm transition-all duration-200 hover:border-white/20',
  hero:
    'w-[180px] sm:w-[210px] md:w-[240px] max-w-full flex items-center justify-center rounded-3xl bg-black/80 p-3 sm:p-4 border border-[#18CFFC]/30 shadow-2xl backdrop-blur-md ring-1 ring-white/10 transition-transform duration-300 hover:scale-[1.02] hover:border-[#7F1AFB]/50 hover:shadow-[0_0_35px_rgba(127,26,251,0.40)]',
  ticket:
    'h-9 sm:h-10 w-auto max-w-[100px] flex items-center justify-center rounded-lg bg-black/80 p-1 border border-white/10 shadow-inner',
  emblem:
    'w-8 h-8 sm:w-9 sm:h-9 max-w-full flex items-center justify-center rounded-xl bg-black/80 p-0.5 border border-white/10 shadow-md',
  compact:
    'w-7 h-7 sm:w-8 sm:h-8 max-w-full flex items-center justify-center rounded-lg bg-black/80 p-0.5 border border-white/10 shadow-sm',
  custom: '',
}

export function Logo({
  variant = 'navbar',
  alt = 'FestFlow logo',
  className = '',
  containerClassName = '',
  ...imgProps
}: LogoProps) {
  const isEmblem = variant === 'emblem' || variant === 'compact'
  const src = isEmblem ? '/festflow-emblem.png' : '/festflow-logo.png'
  const containerClasses = VARIANT_CONTAINER_CLASSES[variant]

  const imageElement = (
    <img
      src={src}
      alt={alt}
      loading="eager"
      decoding="async"
      className={`w-auto h-auto max-h-full max-w-full object-contain shrink-0 select-none ${className}`}
      {...imgProps}
    />
  )

  if (variant === 'custom' && !containerClassName) {
    return imageElement
  }

  return (
    <div className={`relative inline-flex items-center justify-center overflow-hidden ${containerClasses} ${containerClassName}`}>
      {imageElement}
    </div>
  )
}
