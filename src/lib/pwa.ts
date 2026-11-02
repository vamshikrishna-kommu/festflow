// FestFlow Progressive Web App (PWA) Client Management

export interface PwaStatus {
  isSupported: boolean
  isInstalled: boolean
  hasUpdate: boolean
}

let deferredInstallPrompt: any = null

/**
 * Registers the Service Worker in production or supporting environments.
 */
export function registerServiceWorker(onUpdateFound?: () => void): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  // Capture install prompt for customizable install banners
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredInstallPrompt = e
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing
          if (!installingWorker) return

          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New update available
                if (onUpdateFound) {
                  onUpdateFound()
                }
              }
            }
          })
        })
      })
      .catch((err) => {
        console.warn('[FestFlow PWA] Service worker registration failed:', err)
      })
  })
}

/**
 * Triggers the browser's native PWA installation dialog.
 */
export async function promptPwaInstall(): Promise<boolean> {
  if (!deferredInstallPrompt) {
    return false
  }

  deferredInstallPrompt.prompt()
  const choice = await deferredInstallPrompt.userChoice
  deferredInstallPrompt = null
  return choice.outcome === 'accepted'
}

/**
 * Checks if the application is running in standalone (installed) mode.
 */
export function isPwaInstalled(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  )
}

// ── Secure Offline Digital Pass Local Store ─────────────────────────────────
// Allows students to view previously issued passes offline in campus basements/venues.
// Does NOT store passwords, tokens, or allow unauthorized check-in bypass.

const OFFLINE_PASS_STORAGE_KEY = 'festflow_offline_cached_passes'

export interface CachedOfflinePass {
  id: string
  event_id: string
  event_title: string
  event_venue: string
  event_date: string
  ticket_code: string
  student_name: string
  student_email: string
  cached_at: string
}

export function cacheDigitalPassOffline(pass: CachedOfflinePass): void {
  try {
    const raw = localStorage.getItem(OFFLINE_PASS_STORAGE_KEY)
    const list: CachedOfflinePass[] = raw ? JSON.parse(raw) : []
    const index = list.findIndex((p) => p.id === pass.id)
    if (index >= 0) {
      list[index] = pass
    } else {
      list.push(pass)
    }
    localStorage.setItem(OFFLINE_PASS_STORAGE_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}

export function getOfflineCachedPasses(): CachedOfflinePass[] {
  try {
    const raw = localStorage.getItem(OFFLINE_PASS_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
}

