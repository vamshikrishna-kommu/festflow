import { useEffect, type RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

// Global GSAP Default Settings
gsap.defaults({
  ease: 'power2.out',
  duration: 0.5,
})

// Centralized Timing & Easing Specifications
export const MOTION = {
  duration: {
    micro: 0.18,      // 180ms hover / click micro-interactions
    ui: 0.25,         // 250ms dropdowns, tabs, dialogs
    section: 0.55,    // 550ms section reveals
    deliberate: 0.75, // 750ms hero & major milestones
  },
  ease: {
    out: 'power2.out',
    smooth: 'power3.out',
    inOut: 'power2.inOut',
  },
  stagger: {
    tight: 0.04,
    normal: 0.06,
    loose: 0.08,
  },
} as const

/**
 * Checks if the user has requested reduced motion.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * React hook to animate a section or element into view when scrolled to.
 * Automatically cleans up GSAP ScrollTrigger instances via gsap.context() on unmount.
 */
export function useScrollReveal<T extends HTMLElement>(
  targetRef: RefObject<T | null>,
  options: {
    y?: number
    opacity?: number
    duration?: number
    delay?: number
    start?: string
    once?: boolean
  } = {}
) {
  const {
    y = 20,
    opacity = 0,
    duration = MOTION.duration.section,
    delay = 0,
    start = 'top 88%',
    once = true,
  } = options

  useEffect(() => {
    const el = targetRef.current
    if (!el || prefersReducedMotion()) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity, y },
        {
          opacity: 1,
          y: 0,
          duration,
          delay,
          ease: MOTION.ease.out,
          scrollTrigger: {
            trigger: el,
            start,
            once,
          },
        }
      )
    }, targetRef)

    return () => ctx.revert()
  }, [targetRef, y, opacity, duration, delay, start, once])
}

/**
 * React hook to stagger animate child elements into view when the container enters viewport.
 */
export function useStaggerReveal<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  childSelector: string,
  options: {
    y?: number
    duration?: number
    stagger?: number
    start?: string
    immediate?: boolean
  } = {}
) {
  const {
    y = 16,
    duration = MOTION.duration.section,
    stagger = MOTION.stagger.normal,
    start = 'top 85%',
    immediate = false,
  } = options

  useEffect(() => {
    const container = containerRef.current
    if (!container || prefersReducedMotion()) return

    const ctx = gsap.context(() => {
      const children = container.querySelectorAll(childSelector)
      if (children.length === 0) return

      gsap.fromTo(
        children,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration,
          stagger,
          ease: MOTION.ease.out,
          ...(immediate
            ? {}
            : {
                scrollTrigger: {
                  trigger: container,
                  start,
                  once: true,
                },
              }),
        }
      )
    }, containerRef)

    return () => ctx.revert()
  }, [containerRef, childSelector, y, duration, stagger, start, immediate])
}

export { gsap, ScrollTrigger }
