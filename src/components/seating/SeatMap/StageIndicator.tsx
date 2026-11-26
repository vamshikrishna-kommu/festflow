import type { StagePosition } from '@/types/seating'

interface StageIndicatorProps {
  position: StagePosition
}

export function StageIndicator({ position }: StageIndicatorProps) {
  if (position !== 'front' && position !== 'back') return null

  return (
    <div
      className="w-full max-w-sm mx-auto h-9 sm:h-10 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-center gap-3 shadow-xs"
      aria-label="Stage/Screen position"
    >
      <div className="w-16 h-1 rounded-full bg-blue-600/30" />
      <span className="text-[10px] font-semibold tracking-[0.2em] text-blue-700 uppercase">STAGE</span>
      <div className="w-16 h-1 rounded-full bg-blue-600/30" />
    </div>
  )
}

