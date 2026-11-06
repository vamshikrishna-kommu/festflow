import { useEffect, useRef, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X } from 'lucide-react'

export interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
  showCloseButton?: boolean
  showHandle?: boolean
  closeOnBackdropClick?: boolean
  maxHeight?: string
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  className = '',
  showCloseButton = true,
  showHandle = true,
  closeOnBackdropClick = true,
  maxHeight = 'max-h-[92dvh]',
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen) {
      const original = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = original
      }
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4 overflow-hidden"
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

          {/* Sheet Body Container */}
          <motion.div
            ref={sheetRef}
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className={`relative w-full sm:max-w-xl ${maxHeight} flex flex-col rounded-t-[28px] sm:rounded-3xl bg-[#0E0E12] border-t sm:border border-white/10 shadow-[0_-12px_48px_rgba(0,0,0,0.85)] text-left overflow-hidden z-10 pb-safe sm:pb-0 ${className}`}
          >
            {/* Grab Handle (mobile only) */}
            {showHandle && (
              <div className="pt-3 pb-1 flex justify-center sm:hidden shrink-0">
                <div className="sheet-handle" />
              </div>
            )}

            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-white/10 bg-[#14141A]/80 shrink-0">
                <div className="min-w-0 pr-2">
                  {title && (
                    <h3 className="font-heading font-bold text-base sm:text-lg text-[var(--color-text-primary)] truncate">
                      {title}
                    </h3>
                  )}
                  {description && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                      {description}
                    </p>
                  )}
                </div>

                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors touch-target flex items-center justify-center shrink-0 cursor-pointer"
                    aria-label="Close sheet"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            )}

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

