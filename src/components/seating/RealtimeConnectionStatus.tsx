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
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-amber-50/95 backdrop-blur-sm border border-amber-200 rounded-xl text-sm text-amber-800 shadow-md">
      <WifiOff className="w-4 h-4 flex-shrink-0 animate-pulse text-amber-600" />
      Reconnecting to live seat availability…
    </div>
  )
}

