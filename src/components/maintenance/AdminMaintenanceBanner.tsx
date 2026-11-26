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
      className="w-full bg-rose-50 border-b border-rose-200 text-rose-900 px-4 py-2.5 z-50 sticky top-0 backdrop-blur-md shadow-xs"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600" />
          </span>
          <div className="flex items-center gap-1.5 font-semibold text-rose-800">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>MAINTENANCE MODE ACTIVE</span>
          </div>
          <span className="hidden md:inline text-rose-700">
            Non-administrative visitors are currently blocked and seeing the maintenance screen.
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/admin/settings"
            className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 hover:bg-rose-100 text-rose-800 font-medium transition-colors flex items-center gap-1 text-[11px]"
          >
            <Settings className="w-3 h-3" />
            <span>Settings</span>
          </Link>

          <button
            type="button"
            onClick={handleTurnOff}
            disabled={isDisabling}
            className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-semibold transition-all flex items-center gap-1 text-[11px] cursor-pointer disabled:opacity-50 shadow-xs"
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
