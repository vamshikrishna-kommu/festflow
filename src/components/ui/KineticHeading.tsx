import { useRef } from 'react'
import { motion, useInView } from 'motion/react'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { maskRevealContainer, maskRevealLine } from '@/lib/animations'

interface KineticHeadingProps {
  as?: 'h1' | 'h2' | 'h3' | 'h4'
  lines: Array<{
    text: string
    highlight?: string
    gradientClass?: string
  }>
  className?: string
  id?: string
  badgeText?: string
  badgeIcon?: React.ReactNode
}

/**
 * KineticHeading — Masked Line and Gradient Revealer
 * Provides cinematic typography reveals without layout thrashing,
 * clipping artifacts, or screen-reader degradation.
 */
export function KineticHeading({
  as: Component = 'h2',
  lines,
  className = '',
  id,
  badgeText,
  badgeIcon,
}: KineticHeadingProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const reduced = useReducedMotion()

  const fullText = lines.map((l) => `${l.text} ${l.highlight || ''}`.trim()).join(' ')

  return (
    <div ref={ref} className="w-full">
      {badgeText && (
        <motion.div
          initial={reduced ? undefined : { opacity: 0, y: 12 }}
          animate={inView || reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="mb-3.5 inline-block"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-[var(--color-brand-violet)] bg-[var(--color-surface-2)] border border-[oklch(58%_0.26_285_/_0.25)] shadow-sm">
            {badgeIcon && <span className="text-[var(--color-brand-cyan)]">{badgeIcon}</span>}
            <span>{badgeText}</span>
          </span>
        </motion.div>
      )}

      <Component
        id={id}
        aria-label={fullText}
        className={`font-display font-extrabold tracking-tight text-[var(--color-text-primary)] ${className}`}
      >
        <motion.span
          variants={maskRevealContainer}
          initial={reduced ? 'visible' : 'hidden'}
          animate={inView || reduced ? 'visible' : 'hidden'}
          className="block"
        >
          {lines.map((line, idx) => (
            <span key={idx} className="block overflow-hidden pb-1 -mb-1">
              <motion.span
                variants={reduced ? undefined : maskRevealLine}
                className="inline-block will-change-transform"
              >
                {line.text}{' '}
                {line.highlight && (
                  <span
                    className={`inline-block ${line.gradientClass || 'gradient-text'} will-change-transform`}
                  >
                    {line.highlight}
                  </span>
                )}
              </motion.span>
            </span>
          ))}
        </motion.span>
      </Component>
    </div>
  )
}
