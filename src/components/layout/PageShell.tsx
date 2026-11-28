import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { BottomNav } from './BottomNav'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { pageTransition, staticVariants } from '@/lib/animations'

interface PageShellProps {
  children: ReactNode
  /** When true, renders without top padding (hero sections handle their own spacing) */
  fullbleed?: boolean
  /** When true, omits mobile bottom nav padding if the page has its own custom bottom bar */
  noBottomNavOffset?: boolean
}

export function PageShell({ children, fullbleed: _fullbleed = false, noBottomNavOffset = false }: PageShellProps) {
  const isReduced = useReducedMotion()

  return (
    <div className="w-full min-h-dvh flex flex-col bg-[var(--color-canvas)] text-[var(--color-text-primary)]">
      <Navbar />
      <motion.main
        id="main-content"
        tabIndex={-1}
        variants={isReduced ? staticVariants : pageTransition}
        initial="initial"
        animate="animate"
        exit="exit"
        className="w-full flex-1 focus:outline-none"
      >
        {children}
      </motion.main>
      <Footer className={noBottomNavOffset ? '' : 'pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:pb-0'} />
      <BottomNav />
    </div>
  )
}
