import { useEffect, useState } from 'react'

/**
 * Returns true when the user has requested reduced motion
 * via the OS/browser `prefers-reduced-motion: reduce` setting.
 *
 * Usage:
 *   const reduced = useReducedMotion()
 *   const variants = reduced ? staticVariants : fadeUp
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return reduced
}
