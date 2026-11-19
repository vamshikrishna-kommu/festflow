import type { ReactNode } from 'react'

/**
 * Standard scene props interface used across all cinematic scenes in FestFlow 3.0
 */
export interface SceneProps {
  reducedMotion: boolean
  className?: string
  id?: string
}

/**
 * Array of all 10 cinematic world IDs in sequential order (FestFlow Infinite 4.0)
 */
export const WORLD_IDS = [
  'world-01-void',
  'world-02-campus',
  'world-03-human',
  'world-04-multiverse',
  'world-05-discover',
  'world-06-student',
  'world-07-organizer',
  'world-08-network',
  'world-09-infinite',
  'world-10-final',
] as const

export type WorldId = (typeof WORLD_IDS)[number]

export interface WorldMetadata {
  id: WorldId
  title: string
  subtitle?: string
  badge?: string
}

export const WORLD_CONFIGS: Record<WorldId, WorldMetadata> = {
  'world-01-void': {
    id: 'world-01-void',
    title: 'The Void / Awakens',
    subtitle: 'Where Campus Life Begins',
    badge: 'World 01',
  },
  'world-02-campus': {
    id: 'world-02-campus',
    title: 'The Campus Reveals Itself',
    subtitle: 'A Living Collegiate Ecosystem',
    badge: 'World 02',
  },
  'world-03-human': {
    id: 'world-03-human',
    title: 'Human Energy',
    subtitle: 'The Pulse of Student Ambition',
    badge: 'World 03',
  },
  'world-04-multiverse': {
    id: 'world-04-multiverse',
    title: 'The Event Multiverse',
    subtitle: 'Four Dimensions of Experience',
    badge: 'World 04',
  },
  'world-05-discover': {
    id: 'world-05-discover',
    title: 'Discover / Enter Portal',
    subtitle: 'Find What Moves You',
    badge: 'World 05',
  },
  'world-06-student': {
    id: 'world-06-student',
    title: 'The Student Journey',
    subtitle: 'From Discovery to Gate Pass',
    badge: 'World 06',
  },
  'world-07-organizer': {
    id: 'world-07-organizer',
    title: 'The Organizer Command Center',
    subtitle: 'Spatial Operations & Direct Settlement',
    badge: 'World 07',
  },
  'world-08-network': {
    id: 'world-08-network',
    title: 'The Connected Campus Network',
    subtitle: 'Interconnected Collegiate Society',
    badge: 'World 08',
  },
  'world-09-infinite': {
    id: 'world-09-infinite',
    title: 'The Infinite Event Space',
    subtitle: 'Architectural Portal Convergence',
    badge: 'World 09',
  },
  'world-10-final': {
    id: 'world-10-final',
    title: 'The Final Brand Reveal',
    subtitle: 'One Platform. Every Campus Event.',
    badge: 'World 10',
  },
}

export function isValidWorldId(id: string): id is WorldId {
  return (WORLD_IDS as readonly string[]).includes(id)
}

/**
 * Array of all 7 cinematic scene IDs in sequential order (Backward Compatibility)
 */
export const SCENE_IDS = [
  'scene-01-brand',
  'scene-02-discover',
  'scene-03-journey',
  'scene-04-organizer',
  'scene-05-community',
  'scene-06-tickets',
  'scene-07-final',
] as const

export type SceneId = (typeof SCENE_IDS)[number]

export interface SceneMetadata {
  id: SceneId
  title: string
  subtitle?: string
  badge?: string
}

export const SCENE_CONFIGS: Record<SceneId, SceneMetadata> = {
  'scene-01-brand': {
    id: 'scene-01-brand',
    title: 'Brand Reveal',
    subtitle: 'Where Campus Life Unfolds',
    badge: 'Scene 01',
  },
  'scene-02-discover': {
    id: 'scene-02-discover',
    title: 'Discover Campus Events',
    subtitle: 'Real-time Live Feed',
    badge: 'Scene 02',
  },
  'scene-03-journey': {
    id: 'scene-03-journey',
    title: 'The Student Journey',
    subtitle: 'Seamless Registration & Entry',
    badge: 'Scene 03',
  },
  'scene-04-organizer': {
    id: 'scene-04-organizer',
    title: 'The Organizer Experience',
    subtitle: 'Command Center & Realtime Analytics',
    badge: 'Scene 04',
  },
  'scene-05-community': {
    id: 'scene-05-community',
    title: 'Campus Communities',
    subtitle: 'Connecting Societies & Students',
    badge: 'Scene 05',
  },
  'scene-06-tickets': {
    id: 'scene-06-tickets',
    title: 'FastPass & QR Tickets',
    subtitle: 'Offline-ready Entry Check-in',
    badge: 'Scene 06',
  },
  'scene-07-final': {
    id: 'scene-07-final',
    title: 'The Final Reveal',
    subtitle: 'Elevate Your College Experience',
    badge: 'Scene 07',
  },
}

/**
 * Returns whether a given string is a valid SceneId
 */
export function isValidSceneId(id: string): id is SceneId {
  return (SCENE_IDS as readonly string[]).includes(id)
}

/**
 * Resolves sticky site Navbar height dynamically so pinned ScrollTrigger stages
 * never slide underneath or jump past the header across mobile/desktop breakpoints.
 */
export function getNavbarOffset(): number {
  if (typeof document === 'undefined') return 65
  const header = document.querySelector('header')
  if (!header) return 65
  return Math.round(header.getBoundingClientRect().height)
}

/**
 * Deterministic timeline timing helper for N sequential screens inside one pin stage.
 * Guarantees a strict dead-gap where outgoing screen reaches opacity 0 BEFORE
 * incoming screen begins entering, eliminating translucent layer ghosting in both
 * forward and reverse scroll directions.
 *
 * Slot allocation for index k (0 .. count - 2):
 * - k + 0.00 -> k + 0.68 : screen k held active (opacity 1)
 * - k + 0.68 -> k + 0.82 : screen k exits cleanly (opacity 1 -> 0)
 * - k + 0.82 -> k + 0.86 : 0.04 empty dark gap (all layers at opacity 0)
 * - k + 0.84              : deterministic header badge switch midpoint
 * - k + 0.86 -> k + 1.00 : screen k+1 enters cleanly (opacity 0 -> 1)
 */
export function resolveActiveStepFromTime(time: number, count: number): number {
  let active = 0
  for (let i = 0; i < count - 1; i++) {
    if (time >= i + 0.84) {
      active = i + 1
    }
  }
  return active
}

export const SEQUENTIAL_SLOT = {
  EXIT_OFFSET: 0.68,
  EXIT_DURATION: 0.14,
  SWITCH_MIDPOINT: 0.84,
  ENTER_OFFSET: 0.86,
  ENTER_DURATION: 0.14,
  FINAL_HOLD_DURATION: 0.55,
} as const

interface MobileMockupChassisProps {
  children: ReactNode
  statusRight?: string
  accentGlow?: 'violet' | 'magenta' | 'cyan'
  phoneRef?: React.Ref<HTMLDivElement>
}

const ACCENT_SHADOW_MAP = {
  violet: 'shadow-[0_20px_56px_rgba(0,0,0,0.88),0_0_28px_rgba(127,26,251,0.16)]',
  magenta: 'shadow-[0_20px_56px_rgba(0,0,0,0.88),0_0_28px_rgba(237,71,252,0.16)]',
  cyan: 'shadow-[0_20px_56px_rgba(0,0,0,0.88),0_0_28px_rgba(24,207,252,0.16)]',
}

/**
 * Responsive mobile phone bezel sized proportionally for viewports from
 * 320x568 up to 430x932 and desktop without clipping behind Navbar/BottomNav.
 */
export function MobileMockupChassis({
  children,
  statusRight = '5G',
  accentGlow = 'violet',
  phoneRef,
}: MobileMockupChassisProps) {
  return (
    <div
      ref={phoneRef}
      className={`relative w-[clamp(264px,82vw,324px)] h-[clamp(306px,calc(100dvh-248px),470px)] rounded-[2.15rem] sm:rounded-[2.4rem] bg-[#0A0A0E] border-[1.5px] border-white/20 p-1.5 sm:p-2 ${ACCENT_SHADOW_MAP[accentGlow]} overflow-hidden shrink-0`}
    >
      {/* Top Speaker Notch */}
      <div
        aria-hidden="true"
        className="absolute top-1.5 sm:top-2 left-1/2 -translate-x-1/2 w-16 sm:w-20 h-3.5 sm:h-4 bg-black rounded-b-xl z-30 flex items-center justify-center"
      >
        <div className="w-7 sm:w-8 h-1 bg-zinc-700 rounded-full" />
      </div>

      {/* Internal Canvas */}
      <div className="relative w-full h-full rounded-[1.85rem] sm:rounded-[2.1rem] bg-[#08080A] text-white overflow-hidden pt-4 sm:pt-5">
        <div className="flex justify-between items-center px-3.5 sm:px-4 pt-0.5 pb-1 text-[8px] sm:text-[9px] font-mono text-zinc-400">
          <span>9:41</span>
          <span className="truncate">{statusRight}</span>
        </div>
        {children}
      </div>
    </div>
  )
}

/**
 * Helper to smoothly scroll to a world by world ID
 */
export function scrollToWorld(worldId: WorldId | string): void {
  scrollToScene(worldId)
}

/**
 * Helper to smoothly scroll to a scene by scene ID
 */
export function scrollToScene(sceneId: SceneId | string): void {
  if (typeof document === 'undefined') return
  const el = document.getElementById(sceneId)
  if (!el) return
  const offset = getNavbarOffset()
  const bodyRect = document.body.getBoundingClientRect().top
  const elementRect = el.getBoundingClientRect().top
  const elementPosition = elementRect - bodyRect
  const offsetPosition = elementPosition - offset

  window.scrollTo({
    top: offsetPosition,
    behavior: 'smooth',
  })
}
