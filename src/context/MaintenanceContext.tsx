import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { getPlatformSettings, syncLocalSetting } from '@/lib/admin'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

interface MaintenanceContextType {
  isMaintenanceMode: boolean
  supportEmail: string
  supportPhone: string
  isChecking: boolean
  refreshMaintenanceStatus: () => Promise<boolean>
  setMaintenanceMode: (enabled: boolean) => void
}

const MaintenanceContext = createContext<MaintenanceContextType>({
  isMaintenanceMode: false,
  supportEmail: 'support@festflow.online',
  supportPhone: '+91-9876543210',
  isChecking: false,
  refreshMaintenanceStatus: async () => false,
  setMaintenanceMode: () => {},
})

const MOCK_SETTINGS_KEY = 'festflow_admin_settings'

export function MaintenanceProvider({ children }: { children: ReactNode }) {
  // Synchronous initial state from localStorage to prevent any initial UI flash
  const [isMaintenanceMode, setIsMaintenanceMode] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(MOCK_SETTINGS_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          return parsed.maintenance_mode === true || parsed.maintenance_mode === 'true'
        }
      }
    } catch {
      // Ignore
    }
    return false
  })

  const [supportEmail, setSupportEmail] = useState('support@festflow.online')
  const [supportPhone, setSupportPhone] = useState('+91-9876543210')
  const [isChecking, setIsChecking] = useState(false)

  const syncFromSettings = useCallback((settings: any) => {
    if (settings) {
      const isMaint = settings.maintenance_mode === true || settings.maintenance_mode === 'true'
      setIsMaintenanceMode(isMaint)
      if (settings.support_email) setSupportEmail(settings.support_email)
      if (settings.support_phone) setSupportPhone(settings.support_phone)
      return isMaint
    }
    return false
  }, [])

  const refreshMaintenanceStatus = useCallback(async (): Promise<boolean> => {
    setIsChecking(true)
    try {
      const settings = await getPlatformSettings()
      return syncFromSettings(settings)
    } finally {
      setIsChecking(false)
    }
  }, [syncFromSettings])

  const setMaintenanceMode = useCallback((enabled: boolean) => {
    setIsMaintenanceMode(enabled)
    syncLocalSetting('maintenance_mode', enabled)
  }, [])

  useEffect(() => {
    // 1. Initial async fetch
    void refreshMaintenanceStatus()

    // 2. Realtime listener on Supabase platform_settings table
    let channel: any = null
    if (isSupabaseConfigured) {
      try {
        channel = supabase
          .channel('realtime_platform_settings_maintenance')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'platform_settings',
            },
            (payload: any) => {
              const row = payload.new
              if (row && row.key === 'maintenance_mode') {
                const isMaint = row.value === true || row.value === 'true'
                setIsMaintenanceMode(isMaint)
                syncLocalSetting('maintenance_mode', isMaint)
              }
            }
          )
          .subscribe()
      } catch (err) {
        console.warn('[MaintenanceContext] Realtime subscription warning:', err)
      }
    }

    // 3. Window custom event listener (immediate local synchronization)
    const handleSettingsChanged = (e: any) => {
      if (e.detail?.key === 'maintenance_mode') {
        const val = e.detail.value === true || e.detail.value === 'true'
        setIsMaintenanceMode(val)
      }
    }
    const handleMaintenanceChanged = (e: any) => {
      setIsMaintenanceMode(Boolean(e.detail?.enabled))
    }

    window.addEventListener('festflow:settings_changed', handleSettingsChanged)
    window.addEventListener('festflow:maintenance_mode_changed', handleMaintenanceChanged)

    // 4. Multi-tab synchronization via storage event
    const handleStorage = (e: StorageEvent) => {
      if (e.key === MOCK_SETTINGS_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue)
          if (parsed && typeof parsed.maintenance_mode !== 'undefined') {
            const isMaint = parsed.maintenance_mode === true || parsed.maintenance_mode === 'true'
            setIsMaintenanceMode(isMaint)
          }
        } catch {
          // Ignore
        }
      }
    }
    window.addEventListener('storage', handleStorage)

    // 5. Periodic polling fallback (every 30 seconds) + on tab refocus
    const interval = setInterval(() => {
      void refreshMaintenanceStatus()
    }, 30000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshMaintenanceStatus()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (channel) {
        void supabase.removeChannel(channel)
      }
      window.removeEventListener('festflow:settings_changed', handleSettingsChanged)
      window.removeEventListener('festflow:maintenance_mode_changed', handleMaintenanceChanged)
      window.removeEventListener('storage', handleStorage)
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshMaintenanceStatus])

  return (
    <MaintenanceContext.Provider
      value={{
        isMaintenanceMode,
        supportEmail,
        supportPhone,
        isChecking,
        refreshMaintenanceStatus,
        setMaintenanceMode,
      }}
    >
      {children}
    </MaintenanceContext.Provider>
  )
}

export function useMaintenance() {
  return useContext(MaintenanceContext)
}
