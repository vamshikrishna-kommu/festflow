// Shared Motion variants for consistent animation across FestFlow.
// All variants respect reduced-motion via the useReducedMotion hook.
// Import these rather than defining ad-hoc variants in components.

import type { Variants } from 'motion/react'

// ─── Entrance Variants ─────────────────────────────────────────────────────

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
}

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
}

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 40 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
}

// ─── Stagger Container ─────────────────────────────────────────────────────

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
}

export const staggerFast: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.02,
    },
  },
}

// ─── Static (no-motion) Variants ──────────────────────────────────────────
// Use these when prefers-reduced-motion is active

export const staticVariants: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1 },
}

// ─── Card Hover ────────────────────────────────────────────────────────────

export const cardHover = {
  rest: { y: 0, scale: 1 },
  hover: {
    y: -6,
    scale: 1.01,
    transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
  },
}

// ─── Button Press ──────────────────────────────────────────────────────────

export const buttonTap = {
  scale: 0.97,
  transition: { duration: 0.1 },
}

// ─── Navbar ────────────────────────────────────────────────────────────────

export const navbarSlide: Variants = {
  hidden: { y: -80, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
}

// ─── Hero Text ─────────────────────────────────────────────────────────────

export const heroHeadline: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.2 },
  },
}

export const heroWord: Variants = {
  hidden: { opacity: 0, y: 60, rotateX: -30 },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
}
