import type { ReactNode } from 'react'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { BottomNav } from './BottomNav'

interface PageShellProps {
  children: ReactNode
  /** When true, renders without top padding (hero sections handle their own spacing) */
  fullbleed?: boolean
  /** When true, omits mobile bottom nav padding if the page has its own custom bottom bar */
  noBottomNavOffset?: boolean
}

export function PageShell({ children, fullbleed = false, noBottomNavOffset = false }: PageShellProps) {
  return (
    <div className="min-h-dvh flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[var(--color-brand-purple)] focus:text-white focus:rounded-lg focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-white text-xs font-semibold"
      >
        Skip to content
      </a>
      <Navbar />
      <main
        id="main-content"
        tabIndex={-1}
        className={`flex-1 ${fullbleed ? '' : 'pt-20 sm:pt-24'} ${noBottomNavOffset ? '' : 'pb-20 md:pb-0'}`}
      >
        {children}
      </main>
      <Footer />
      <BottomNav />
    </div>
  )
}
