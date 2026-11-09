// FestFlow Real-User Monitoring (RUM) & Core Web Vitals Tracking (Phase 9)

export interface WebVitalMetric {
  name: 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta?: number
  entries?: PerformanceEntry[]
}

export type VitalsCallback = (metric: WebVitalMetric) => void

let lcpValue = 0
let inpValue = 0
let clsValue = 0

/**
 * Initializes client-side Core Web Vitals telemetry using standard PerformanceObserver APIs.
 * Zero external dependencies to prevent adding any bundle overhead.
 */
export function initWebVitals(onMetric?: VitalsCallback): void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return

  // 1. Largest Contentful Paint (LCP) - Target: <= 2.5s (2500ms)
  try {
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries()
      const lastEntry = entries[entries.length - 1] as any
      if (lastEntry) {
        lcpValue = Math.round(lastEntry.startTime)
        const rating = lcpValue <= 2500 ? 'good' : lcpValue <= 4000 ? 'needs-improvement' : 'poor'
        onMetric?.({ name: 'LCP', value: lcpValue, rating, entries })
      }
    })
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
  } catch {
    // Ignore unsupported browser entry type
  }

  // 2. Cumulative Layout Shift (CLS) - Target: <= 0.1
  try {
    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries() as any[]) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value
          const rating = clsValue <= 0.1 ? 'good' : clsValue <= 0.25 ? 'needs-improvement' : 'poor'
          onMetric?.({ name: 'CLS', value: Math.round(clsValue * 1000) / 1000, rating })
        }
      }
    })
    clsObserver.observe({ type: 'layout-shift', buffered: true })
  } catch {
    // Ignore unsupported browser entry type
  }

  // 3. Interaction to Next Paint (INP) - Target: <= 200ms
  try {
    const inpObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries() as any[]) {
        if (entry.interactionId) {
          inpValue = Math.max(inpValue, Math.round(entry.duration))
          const rating = inpValue <= 200 ? 'good' : inpValue <= 500 ? 'needs-improvement' : 'poor'
          onMetric?.({ name: 'INP', value: inpValue, rating })
        }
      }
    })
    inpObserver.observe({ type: 'event', buffered: true, durationThreshold: 16 } as any)
  } catch {
    // Ignore unsupported browser entry type
  }
}

/**
 * Returns the currently recorded Core Web Vitals for diagnostic logging or reporting.
 */
export function getCurrentVitals() {
  return {
    LCP: {
      value: lcpValue,
      unit: 'ms',
      target: '<= 2500ms',
      rating: lcpValue <= 2500 ? 'good' : lcpValue <= 4000 ? 'needs-improvement' : 'poor',
    },
    INP: {
      value: inpValue,
      unit: 'ms',
      target: '<= 200ms',
      rating: inpValue <= 200 ? 'good' : inpValue <= 500 ? 'needs-improvement' : 'poor',
    },
    CLS: {
      value: Math.round(clsValue * 1000) / 1000,
      unit: '',
      target: '<= 0.1',
      rating: clsValue <= 0.1 ? 'good' : clsValue <= 0.25 ? 'needs-improvement' : 'poor',
    },
  }
}

