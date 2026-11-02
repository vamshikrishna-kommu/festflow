// FestFlow Real-time Network Status and Offline Indicator (Phase 9)
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { WifiOff, Wifi, RefreshCw } from 'lucide-react'

export function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [showReconnected, setShowReconnected] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      setIsOnline(true)
      setShowReconnected(true)
      const timer = setTimeout(() => {
        setShowReconnected(false)
      }, 2500)
      return () => clearTimeout(timer)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setShowReconnected(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          className="fixed top-0 inset-x-0 z-[100] bg-gradient-to-r from-amber-600 to-rose-600 text-white text-xs font-semibold py-2 px-4 shadow-xl flex items-center justify-between"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full justify-between">
            <div className="flex items-center gap-2">
              <WifiOff size={15} className="animate-pulse" />
              <span>Offline Mode — Cached digital passes and saved events remain available</span>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-2.5 py-0.5 rounded-lg bg-black/20 hover:bg-black/40 text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        </motion.div>
      )}

      {showReconnected && (
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          className="fixed top-0 inset-x-0 z-[100] bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold py-2 px-4 shadow-xl flex items-center justify-center gap-2"
          role="status"
          aria-live="polite"
        >
          <Wifi size={15} />
          <span>Connection Restored — Live updates active</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

