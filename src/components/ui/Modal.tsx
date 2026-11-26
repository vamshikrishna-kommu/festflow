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
          className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-6 overflow-hidden sm:overflow-y-auto"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            aria-hidden="true"
            onClick={closeOnBackdropClick ? onClose : undefined}
          />

          {/* Dialog / Bottom-Sheet Container */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            aria-labelledby={title ? 'modal-dialog-title' : undefined}
            aria-describedby={description ? 'modal-dialog-description' : undefined}
            className={`relative w-full ${sizeClasses[size]} max-h-[94dvh] sm:max-h-[90dvh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white border-t sm:border border-gray-200 shadow-2xl text-left overflow-hidden z-10 pb-safe sm:pb-0 ${className}`}
          >
            {/* Mobile Sheet Handle Pill */}
            <div className="pt-2.5 pb-1 flex justify-center sm:hidden shrink-0">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {(title || showCloseButton) && (
              <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100 bg-gray-50/50 shrink-0">
                <div className="min-w-0 pr-2">
                  {title && (
                    <h2 id="modal-dialog-title" className="font-display font-semibold text-base sm:text-lg text-gray-900 truncate">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p id="modal-dialog-description" className="text-xs text-gray-500 mt-0.5 truncate">
                      {description}
                    </p>
                  )}
                </div>

                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors touch-target flex items-center justify-center shrink-0 cursor-pointer"
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
    <div className={`flex-1 overflow-y-auto p-5 sm:p-6 overscroll-contain ${className}`}>
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
      className={`px-5 sm:px-6 py-3.5 sm:py-4 border-t border-gray-100 bg-gray-50/60 flex flex-wrap items-center justify-end gap-2 sm:gap-3 shrink-0 ${className}`}
    >
      {children}
    </div>
  )
}
