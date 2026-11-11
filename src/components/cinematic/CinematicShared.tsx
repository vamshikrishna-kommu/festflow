import type { ReactNode } from 'react'

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

