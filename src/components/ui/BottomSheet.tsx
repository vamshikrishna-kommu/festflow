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
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            aria-hidden="true"
            onClick={closeOnBackdropClick ? onClose : undefined}
          />

          {/* Sheet Body Container */}
          <motion.div
            ref={sheetRef}
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={`relative w-full sm:max-w-xl ${maxHeight} flex flex-col rounded-t-2xl sm:rounded-2xl bg-white border-t sm:border border-gray-200 shadow-2xl text-left overflow-hidden z-10 pb-safe sm:pb-0 ${className}`}
          >
            {/* Grab Handle (mobile only) */}
            {showHandle && (
              <div className="pt-3 pb-1 flex justify-center sm:hidden shrink-0">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>
            )}

            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-gray-100 bg-gray-50/50 shrink-0">
                <div className="min-w-0 pr-2">
                  {title && (
                    <h3 className="font-display font-semibold text-base sm:text-lg text-gray-900 truncate">
                      {title}
                    </h3>
                  )}
                  {description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {description}
                    </p>
                  )}
                </div>

                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors touch-target flex items-center justify-center shrink-0 cursor-pointer"
                    aria-label="Close sheet"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            )}

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
