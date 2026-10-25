import type { ReactNode } from 'react'
import { Navbar } from './Navbar'
import { Footer } from './Footer'

interface PageShellProps {
  children: ReactNode
  /** When true, renders without top padding (hero sections handle their own spacing) */
  fullbleed?: boolean
}

export function PageShell({ children, fullbleed = false }: PageShellProps) {
  return (
    <div className="min-h-dvh flex flex-col">
      <Navbar />
      <main
        id="main-content"
        tabIndex={-1}
        className={`flex-1 ${fullbleed ? '' : 'pt-24'}`}
      >
        {children}
      </main>
      <Footer />
    </div>
  )
}
