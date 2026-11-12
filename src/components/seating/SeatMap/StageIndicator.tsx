import type { StagePosition } from '@/types/seating'

interface StageIndicatorProps {
  position: StagePosition
}

export function StageIndicator({ position }: StageIndicatorProps) {
  if (position !== 'front' && position !== 'back') return null

  return (
    <div
      className="w-full max-w-sm mx-auto h-9 sm:h-10 bg-gradient-to-r from-[#18CFFC]/10 via-[#0D56FB]/20 to-[#7F1AFB]/10 rounded-xl border border-white/10 flex items-center justify-center gap-2"
      aria-label="Stage/Screen position"
    >
      <div className="w-16 h-1 rounded-full bg-gradient-to-r from-[#18CFFC] to-[#0D56FB]" />
      <span className="text-[10px] font-semibold tracking-[0.2em] text-[#07A4FC] uppercase">STAGE</span>
      <div className="w-16 h-1 rounded-full bg-gradient-to-r from-[#0D56FB] to-[#7F1AFB]" />
    </div>
  )
}

