import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'

interface RealtimeConnectionStatusProps {
  isConnected: boolean
}

export function RealtimeConnectionStatus({ isConnected }: RealtimeConnectionStatusProps) {
  const [showReconnecting, setShowReconnecting] = useState(false)

  useEffect(() => {
    if (!isConnected) {
      const t = setTimeout(() => setShowReconnecting(true), 1500)
      return () => clearTimeout(t)
    } else {
      setShowReconnecting(false)
    }
  }, [isConnected])

  if (!showReconnecting) return null

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-amber-900/90 backdrop-blur-sm border border-amber-500/40 rounded-xl text-sm text-amber-200 shadow-lg">
      <WifiOff className="w-4 h-4 flex-shrink-0 animate-pulse" />
      Reconnecting to live seat availability…
    </div>
  )
}

