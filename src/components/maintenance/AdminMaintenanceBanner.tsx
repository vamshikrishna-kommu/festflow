import { useState } from 'react'
import { Link } from 'react-router'
import { AlertTriangle, Power, Settings, Loader2 } from 'lucide-react'
import { useMaintenance } from '@/context/MaintenanceContext'
import { useAuth } from '@/context/AuthContext'
import { updatePlatformSetting } from '@/lib/admin'

export function AdminMaintenanceBanner() {
  const { isMaintenanceMode, setMaintenanceMode } = useMaintenance()
  const { user, profile } = useAuth()
  const [isDisabling, setIsDisabling] = useState(false)

  if (!isMaintenanceMode) return null

  const handleTurnOff = async () => {
    setIsDisabling(true)
    try {
      const res = await updatePlatformSetting(
        'maintenance_mode',
        false,
        profile?.id || user?.id,
        user?.email
      )
      if (res.success) {
        setMaintenanceMode(false)
      }
    } finally {
      setIsDisabling(false)
    }
  }

  return (
    <aside
      aria-label="Platform Maintenance Notice"
      className="w-full bg-gradient-to-r from-rose-950/90 via-amber-950/90 to-rose-950/90 border-b border-rose-500/30 text-white px-4 py-2.5 z-50 sticky top-0 backdrop-blur-md shadow-lg"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
          </span>
          <div className="flex items-center gap-1.5 font-semibold text-rose-300">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>MAINTENANCE MODE ACTIVE</span>
          </div>
          <span className="hidden md:inline text-white/60">
            Non-administrative visitors are currently blocked and seeing the maintenance screen.
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/admin/settings"
            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors flex items-center gap-1 text-[11px]"
          >
            <Settings className="w-3 h-3" />
            <span>Settings</span>
          </Link>

          <button
            type="button"
            onClick={handleTurnOff}
            disabled={isDisabling}
            className="px-3 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-bold transition-all flex items-center gap-1 text-[11px] cursor-pointer disabled:opacity-50 shadow-sm"
          >
            {isDisabling ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Power className="w-3 h-3" />
            )}
            <span>Disable Maintenance</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
