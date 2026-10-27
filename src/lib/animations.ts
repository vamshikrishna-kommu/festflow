// Centralized Motion Design System for FestFlow.
// Establishes shared durations, easing curves, stagger rules, and reduced-motion fallbacks.
// Reuses modern Motion (motion/react) with transform and opacity primitives.

import type { Variants } from 'motion/react'

// ─── Design Tokens: Durations & Easing ─────────────────────────────────────

export const DURATIONS = {
  instant: 0.1,
  fast: 0.18,
  normal: 0.28,
  slow: 0.45,
  deliberate: 0.6,
} as const

export const EASINGS = {
  // Signature FestFlow cubic bezier deceleration curve
  brand: [0.22, 1, 0.36, 1] as [number, number, number, number],
  smooth: [0.16, 1, 0.3, 1] as [number, number, number, number],
  sharp: [0.4, 0, 0.2, 1] as [number, number, number, number],
  spring: { type: 'spring', stiffness: 420, damping: 28 } as const,
  gentleSpring: { type: 'spring', stiffness: 300, damping: 24 } as const,
  snappySpring: { type: 'spring', stiffness: 500, damping: 30 } as const,
}

// ─── 1. Page and Route Transitions ─────────────────────────────────────────

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATIONS.normal, ease: EASINGS.brand },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: DURATIONS.fast, ease: 'easeIn' },
  },
}

// ─── 2. Section Reveals ────────────────────────────────────────────────────

export const sectionReveal: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATIONS.slow, ease: EASINGS.brand },
  },
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASINGS.brand },
  },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: DURATIONS.normal, ease: 'easeOut' },
  },
}

// ─── 3. Stagger Containers ─────────────────────────────────────────────────

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
}

export const staggerFast: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
}

// ─── 4. Card Entrance & Interactive Micro-Interactions ──────────────────────

export const cardEntrance: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: DURATIONS.normal, ease: EASINGS.brand },
  },
}

export const cardHover = {
  rest: { y: 0, scale: 1 },
  hover: {
    y: -5,
    scale: 1.01,
    transition: { duration: DURATIONS.fast, ease: EASINGS.brand },
  },
}

export const cardTap = {
  scale: 0.98,
  transition: { duration: DURATIONS.instant },
}

// ─── 5. Dialog and Drawer Appearance ───────────────────────────────────────

export const modalBackdrop: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: DURATIONS.fast },
  },
  exit: {
    opacity: 0,
    transition: { duration: DURATIONS.fast },
  },
}

export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 14 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: DURATIONS.normal, ease: EASINGS.brand },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 10,
    transition: { duration: DURATIONS.fast, ease: 'easeIn' },
  },
}

export const drawerRight: Variants = {
  hidden: { x: '100%', opacity: 0.6 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 380, damping: 32 },
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: { duration: DURATIONS.fast, ease: 'easeIn' },
  },
}

export const drawerBottom: Variants = {
  hidden: { y: '100%' },
  visible: {
    y: 0,
    transition: { type: 'spring', stiffness: 380, damping: 32 },
  },
  exit: {
    y: '100%',
    transition: { duration: DURATIONS.fast, ease: 'easeIn' },
  },
}

// ─── 6. Dropdown Opening and Closing ───────────────────────────────────────

export const dropdownMenu: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: -6 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: DURATIONS.fast, ease: EASINGS.brand },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: -4,
    transition: { duration: DURATIONS.instant, ease: 'easeIn' },
  },
}

// ─── 7. Button Press & Hover Feedback ──────────────────────────────────────

export const buttonTap = {
  scale: 0.97,
  transition: { duration: DURATIONS.instant },
}

export const buttonHover = {
  scale: 1.015,
  transition: { duration: DURATIONS.fast, ease: EASINGS.brand },
}

// ─── 8. Tab Changes ────────────────────────────────────────────────────────

export const tabContent: Variants = {
  hidden: { opacity: 0, x: 8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.22, ease: EASINGS.brand },
  },
  exit: {
    opacity: 0,
    x: -8,
    transition: { duration: 0.14, ease: 'easeIn' },
  },
}

// ─── 9. Form Validation & Error Appearance ─────────────────────────────────

export const fieldError: Variants = {
  hidden: { opacity: 0, y: -4, height: 0 },
  visible: {
    opacity: 1,
    y: 0,
    height: 'auto',
    transition: { duration: 0.2, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    y: -4,
    height: 0,
    transition: { duration: 0.14, ease: 'easeIn' },
  },
}

export const shakeError: Variants = {
  idle: { x: 0 },
  shake: {
    x: [0, -6, 6, -4, 4, -2, 2, 0],
    transition: { duration: 0.4, ease: 'easeInOut' },
  },
}

// ─── 10. Loading Skeleton Transitions ──────────────────────────────────────

export const skeletonPulse: Variants = {
  animate: {
    opacity: [0.45, 0.85, 0.45],
    transition: {
      duration: 1.6,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

// ─── 11. Toast Notifications ───────────────────────────────────────────────

export const toastReveal: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.92 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 450, damping: 28 },
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    y: 12,
    transition: { duration: DURATIONS.fast },
  },
}

// ─── 12. Ticket Reveal & Status Changes ────────────────────────────────────

export const ticketReveal: Variants = {
  hidden: { opacity: 0, scale: 0.92, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: DURATIONS.slow, ease: EASINGS.brand },
  },
}

export const statusBadgePop: Variants = {
  initial: { scale: 0.82, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: { type: 'spring', stiffness: 480, damping: 24 },
  },
}

// ─── 13. Scanner Success & Rejection Feedback ──────────────────────────────

export const scannerAccepted: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: {
    opacity: 1,
    scale: [0.94, 1.02, 1],
    transition: { duration: 0.3, ease: EASINGS.brand },
  },
}

export const scannerRejected: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    x: [0, -8, 8, -6, 6, -2, 2, 0],
    transition: { duration: 0.45, ease: 'easeInOut' },
  },
}

// ─── 14. Dashboard Metric Counter & Chart Appearance ───────────────────────

export const metricItem: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: DURATIONS.normal, ease: EASINGS.brand },
  },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: DURATIONS.slow, ease: EASINGS.brand },
  },
}

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -36 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: DURATIONS.slow, ease: EASINGS.brand },
  },
}

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 36 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: DURATIONS.slow, ease: EASINGS.brand },
  },
}

// ─── 15. Navbar & Hero Specialised Variants ────────────────────────────────

export const navbarSlide: Variants = {
  hidden: { y: -70, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: DURATIONS.slow, ease: EASINGS.brand },
  },
}

export const heroHeadline: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
}

export const heroWord: Variants = {
  hidden: { opacity: 0, y: 40, rotateX: -20 },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { duration: 0.6, ease: EASINGS.brand },
  },
}

// ─── 16. Static Reduced-Motion Variants (Accessibility Fallback) ───────────

export const staticVariants: Variants = {
  hidden: { opacity: 1, y: 0, x: 0, scale: 1 },
  visible: { opacity: 1, y: 0, x: 0, scale: 1 },
  exit: { opacity: 1 },
}

export function getAccessibleVariants(normalVariants: Variants, isReduced: boolean): Variants {
  return isReduced ? staticVariants : normalVariants
}
