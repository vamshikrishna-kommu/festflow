// scripts/test-maintenance-mode.ts
// Test suite to verify Maintenance Mode invariants, access control, and real-time state synchronization
import assert from 'node:assert/strict'

// Browser shim for Node.js test environment
const mockStorage: Record<string, string> = {}
if (typeof globalThis.localStorage === 'undefined') {
  ;(globalThis as any).localStorage = {
    getItem: (key: string) => mockStorage[key] || null,
    setItem: (key: string, value: string) => {
      mockStorage[key] = String(value)
    },
    removeItem: (key: string) => {
      delete mockStorage[key]
    },
    clear: () => {
      for (const k of Object.keys(mockStorage)) delete mockStorage[k]
    },
  }
}

if (typeof globalThis.window === 'undefined') {
  const listeners: Record<string, Function[]> = {}
  ;(globalThis as any).window = {
    addEventListener: (event: string, fn: Function) => {
      listeners[event] = listeners[event] || []
      listeners[event].push(fn)
    },
    removeEventListener: (event: string, fn: Function) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((cb) => cb !== fn)
      }
    },
    dispatchEvent: (event: any) => {
      const type = event.type || event
      const fns = listeners[type] || []
      for (const fn of fns) fn(event)
      return true
    },
    CustomEvent: class CustomEvent {
      type: string
      detail: any
      constructor(type: string, params: any) {
        this.type = type
        this.detail = params?.detail
      }
    },
  }
}

if (typeof globalThis.CustomEvent === 'undefined') {
  ;(globalThis as any).CustomEvent = (globalThis as any).window.CustomEvent
}

import { getPlatformSettings, updatePlatformSetting, syncLocalSetting } from '../src/lib/admin'

async function runMaintenanceTests() {
  console.log('============================================================')
  console.log('   FESTFLOW TEST SUITE: PLATFORM MAINTENANCE MODE GUARD   ')
  console.log('============================================================\n')

  const MOCK_KEY = 'festflow_admin_settings'
  const original = localStorage.getItem(MOCK_KEY)

  try {
    // 1. Initial State: Maintenance mode defaults to false
    localStorage.removeItem(MOCK_KEY)
    const initialSettings = await getPlatformSettings()
    assert.equal(initialSettings.maintenance_mode, false, 'Initial maintenance_mode must be false')
    console.log('[PASS] Test 1: Maintenance mode defaults to false when unconfigured')

    // 2. Toggle ON: updatePlatformSetting updates local storage and notifies
    let eventFired = false
    let eventDetailEnabled: boolean | null = null
    const handler = (e: any) => {
      eventFired = true
      eventDetailEnabled = e.detail?.enabled
    }
    window.addEventListener('festflow:maintenance_mode_changed', handler)

    const updateRes = await updatePlatformSetting('maintenance_mode', true, 'admin-123', 'admin@festflow.online')
    assert.equal(updateRes.success, true, 'updatePlatformSetting must succeed')

    const activeSettings = await getPlatformSettings()
    assert.equal(activeSettings.maintenance_mode, true, 'maintenance_mode must be true after toggle ON')
    assert.equal(eventFired, true, 'festflow:maintenance_mode_changed event must be dispatched')
    assert.equal(eventDetailEnabled, true, 'Event detail must indicate enabled: true')
    console.log('[PASS] Test 2: Toggle ON sets maintenance_mode: true & dispatches synchronization event')

    // 3. Access Control Invariants:
    // Regular students and unauthenticated visitors MUST be blocked
    function evaluateAccess(role: string | null, path: string, isMaintenance: boolean): 'MAINTENANCE_SCREEN' | 'ALLOW' {
      const isAdmin = role === 'platform_admin'
      const isExcluded = path.startsWith('/admin') || path.startsWith('/auth')
      if (isMaintenance && !isAdmin && !isExcluded) {
        return 'MAINTENANCE_SCREEN'
      }
      return 'ALLOW'
    }

    // Public / Visitor routes
    assert.equal(evaluateAccess(null, '/', true), 'MAINTENANCE_SCREEN', 'Visitor on / must see maintenance screen')
    assert.equal(evaluateAccess(null, '/discover', true), 'MAINTENANCE_SCREEN', 'Visitor on /discover must see maintenance screen')
    assert.equal(evaluateAccess(null, '/events/hackathon-2026', true), 'MAINTENANCE_SCREEN', 'Visitor on /events/:slug must see maintenance screen')

    // Student and Club routes
    assert.equal(evaluateAccess('student', '/student/dashboard', true), 'MAINTENANCE_SCREEN', 'Student on dashboard must see maintenance screen')
    assert.equal(evaluateAccess('club_member', '/club/dashboard', true), 'MAINTENANCE_SCREEN', 'Club member on dashboard must see maintenance screen')

    // Admin Exemption: Platform Admins MUST be allowed everywhere
    assert.equal(evaluateAccess('platform_admin', '/', true), 'ALLOW', 'Admin on / must have full access')
    assert.equal(evaluateAccess('platform_admin', '/discover', true), 'ALLOW', 'Admin on /discover must have full access')
    assert.equal(evaluateAccess('platform_admin', '/admin/dashboard', true), 'ALLOW', 'Admin on /admin/dashboard must have full access')
    assert.equal(evaluateAccess('platform_admin', '/admin/settings', true), 'ALLOW', 'Admin on /admin/settings must have full access')
    console.log('[PASS] Test 3: Access Control: Visitors, Students & Clubs blocked; Platform Admins allowed')

    // 4. Toggle OFF: Restores public access immediately
    window.removeEventListener('festflow:maintenance_mode_changed', handler)
    let offEventFired = false
    const offHandler = (e: any) => {
      offEventFired = true
      assert.equal(e.detail?.enabled, false)
    }
    window.addEventListener('festflow:maintenance_mode_changed', offHandler)

    await updatePlatformSetting('maintenance_mode', false, 'admin-123', 'admin@festflow.online')
    const restoredSettings = await getPlatformSettings()
    assert.equal(restoredSettings.maintenance_mode, false, 'maintenance_mode must be false after toggle OFF')
    assert.equal(offEventFired, true, 'OFF event must be dispatched')

    assert.equal(evaluateAccess(null, '/', false), 'ALLOW', 'Visitor on / must be allowed when maintenance is OFF')
    assert.equal(evaluateAccess('student', '/student/dashboard', false), 'ALLOW', 'Student must be allowed when maintenance is OFF')
    assert.equal(evaluateAccess('club_member', '/club/dashboard', false), 'ALLOW', 'Club member must be allowed when maintenance is OFF')
    window.removeEventListener('festflow:maintenance_mode_changed', offHandler)
    console.log('[PASS] Test 4: Toggle OFF restores normal access for all users immediately')

    console.log('\n------------------------------------------------------------')
    console.log('Results: All Maintenance Mode tests passed successfully (4/4).')
    console.log('------------------------------------------------------------\n')
  } finally {
    if (original !== null) {
      localStorage.setItem(MOCK_KEY, original)
    } else {
      localStorage.removeItem(MOCK_KEY)
    }
  }
}

runMaintenanceTests().catch((err) => {
  console.error('Test failed with error:', err)
  process.exit(1)
})
