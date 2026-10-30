import { useEffect, useRef, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X } from 'lucide-react'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  size?: ModalSize
  children: ReactNode
  className?: string
  showCloseButton?: boolean
  closeOnBackdropClick?: boolean
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-xl',
  xl: 'max-w-3xl',
  full: 'max-w-5xl',
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  children,
  className = '',
  showCloseButton = true,
  closeOnBackdropClick = true,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Lock body scroll while modal is active
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 overflow-y-auto"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
            aria-hidden="true"
            onClick={closeOnBackdropClick ? onClose : undefined}
          />

          {/* Dialog Container */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className={`relative w-full ${sizeClasses[size]} max-h-[92dvh] flex flex-col rounded-3xl bg-[#0E0E12] border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.85)] text-left overflow-hidden z-10 ${className}`}
          >
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 bg-[#14141A]/80 shrink-0">
                <div>
                  {title && (
                    <h2 className="font-display font-bold text-base sm:text-lg text-[var(--color-text-primary)]">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {description}
                    </p>
                  )}
                </div>

                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Close dialog"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            )}

            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export function ModalBody({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`flex-1 overflow-y-auto p-4 sm:p-7 overscroll-contain ${className}`}>
      {children}
    </div>
  )
}

export function ModalFooter({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`px-4 sm:px-6 py-3 sm:py-4 border-t border-white/10 bg-[#14141A]/50 flex flex-wrap items-center justify-end gap-2 sm:gap-3 shrink-0 ${className}`}
    >
      {children}
    </div>
  )
}
