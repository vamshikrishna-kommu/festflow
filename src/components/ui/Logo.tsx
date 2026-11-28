export type LogoVariant =
  | 'navbar'
  | 'hero'
  | 'footer'
  | 'ticket'
  | 'emblem'
  | 'auth'
  | 'compact'

export interface LogoProps {
  variant?: LogoVariant
  size?: 'sm' | 'md' | 'lg' | 'xl'
  tone?: 'light' | 'dark'
  className?: string
}

const SIZE_MAP: Record<
  NonNullable<LogoProps['size']>,
  { mark: string; text: string; gap: string }
> = {
  sm: { mark: 'h-6 w-6', text: 'text-[17px]', gap: 'gap-2' },
  md: { mark: 'h-7 w-7 sm:h-8 sm:w-8', text: 'text-[19px] sm:text-[21px]', gap: 'gap-2.5' },
  lg: { mark: 'h-9 w-9', text: 'text-2xl', gap: 'gap-3' },
  xl: { mark: 'h-11 w-11', text: 'text-[28px]', gap: 'gap-3.5' },
}

const VARIANT_DEFAULT_SIZE: Record<LogoVariant, NonNullable<LogoProps['size']>> = {
  navbar: 'md',
  footer: 'lg',
  auth: 'lg',
  hero: 'xl',
  emblem: 'md',
  ticket: 'sm',
  compact: 'sm',
}

const ICON_ONLY_VARIANTS = new Set<LogoVariant>(['emblem', 'ticket', 'compact'])

/**
 * FestFlow Brand Lockup
 * Uses the transparent gradient ribbon "F" emblem paired with crisp SaaS typography.
 * Full variants ("navbar", "footer", "auth", "hero") render mark + wordmark;
 * compact variants ("emblem", "ticket", "compact") render only the emblem mark.
 */
export function Logo({
  variant = 'navbar',
  size,
  tone = 'light',
  className = '',
}: LogoProps) {
  const resolvedSize = size || VARIANT_DEFAULT_SIZE[variant]
  const tokens = SIZE_MAP[resolvedSize]
  const isIconOnly = ICON_ONLY_VARIANTS.has(variant)
  const textColorClass = tone === 'dark' ? 'text-white' : 'text-gray-950'

  return (
    <span
      className={`inline-flex items-center ${isIconOnly ? '' : tokens.gap} select-none shrink-0 ${className}`.trim()}
    >
      <img
        src="/festflow-mark.png"
        alt={isIconOnly ? 'FestFlow' : ''}
        aria-hidden={isIconOnly ? undefined : true}
        width={44}
        height={44}
        decoding="async"
        className={`${tokens.mark} object-contain shrink-0 block`}
      />
      {!isIconOnly && (
        <span
          className={`font-display font-bold tracking-[-0.03em] leading-none ${tokens.text} ${textColorClass}`}
        >
          FestFlow
        </span>
      )}
    </span>
  )
}

export default Logo
