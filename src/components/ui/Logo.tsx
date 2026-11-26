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
    'h-9 sm:h-10 w-auto max-w-[145px] flex items-center justify-center rounded-lg bg-gray-950 px-2.5 py-1.5 border border-gray-900 shadow-xs transition-colors duration-150 hover:bg-black',
  auth:
    'w-[160px] sm:w-[180px] max-w-full flex items-center justify-center rounded-xl bg-gray-950 p-2.5 border border-gray-900 shadow-md',
  footer:
    'w-[120px] sm:w-[135px] max-w-full flex items-center justify-center rounded-lg bg-gray-950 px-2 py-1.5 border border-gray-900 shadow-xs',
  hero:
    'w-[180px] sm:w-[210px] max-w-full flex items-center justify-center rounded-2xl bg-gray-950 p-3 border border-gray-900 shadow-xl',
  ticket:
    'h-8 sm:h-9 w-auto max-w-[90px] flex items-center justify-center rounded-md bg-gray-950 px-2 py-1 border border-gray-900 shadow-inner',
  emblem:
    'w-8 h-8 max-w-full flex items-center justify-center rounded-lg bg-gray-950 p-1 border border-gray-900 shadow-xs',
  compact:
    'w-7 h-7 max-w-full flex items-center justify-center rounded-md bg-gray-950 p-0.5 border border-gray-900 shadow-xs',
  custom: '',
}

const VARIANT_DIMENSIONS: Record<NonNullable<LogoProps['variant']>, { width: number; height: number }> = {
  navbar: { width: 140, height: 40 },
  auth: { width: 180, height: 44 },
  footer: { width: 130, height: 38 },
  hero: { width: 210, height: 50 },
  ticket: { width: 90, height: 32 },
  emblem: { width: 32, height: 32 },
  compact: { width: 28, height: 28 },
  custom: { width: 140, height: 40 },
}

export function Logo({
  variant = 'navbar',
  alt = 'FestFlow logo',
  className = '',
  containerClassName = '',
  ...imgProps
}: LogoProps) {
  const isEmblem = variant === 'emblem' || variant === 'compact'
  const pngSrc = isEmblem ? '/festflow-emblem.png' : '/festflow-logo.png'
  const webpSrc = isEmblem ? '/festflow-emblem.webp' : '/festflow-logo.webp'
  const containerClasses = VARIANT_CONTAINER_CLASSES[variant]
  const dims = VARIANT_DIMENSIONS[variant]

  const imageElement = (
    <picture className="contents">
      <source srcSet={webpSrc} type="image/webp" />
      <img
        src={pngSrc}
        alt={alt}
        width={dims.width}
        height={dims.height}
        loading="eager"
        decoding="async"
        className={`w-auto h-auto max-h-full max-w-full object-contain shrink-0 select-none ${className}`}
        {...imgProps}
      />
    </picture>
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
