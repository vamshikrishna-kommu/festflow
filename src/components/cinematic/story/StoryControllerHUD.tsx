import { Play, Pause, ChevronLeft, ChevronRight, ArrowLeft, Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { Logo } from '@/components/ui'

interface StoryControllerHUDProps {
  currentScene: number
  totalScenes: number
  isPlaying: boolean
  onTogglePlay: () => void
  onSelectScene: (index: number) => void
  onNext: () => void
  onPrev: () => void
  sceneTitles: string[]
}

export function StoryControllerHUD({
  currentScene,
  totalScenes,
  isPlaying,
  onTogglePlay,
  onSelectScene,
  onNext,
  onPrev,
  sceneTitles,
}: StoryControllerHUDProps) {
  return (
    <>
      {/* ─── TOP CINEMATIC HEADER ─────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 p-4 sm:p-6 flex items-center justify-between pointer-events-auto select-none bg-gradient-to-b from-[#08080A]/95 via-[#08080A]/60 to-transparent backdrop-blur-sm">
        {/* Logo and Mode Badge */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <Logo variant="emblem" />
            <span className="font-extrabold text-base sm:text-lg text-white group-hover:text-[#18CFFC] transition-colors">
              FestFlow
            </span>
          </Link>
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest text-[#18CFFC] bg-white/5 border border-[#18CFFC]/30 shadow-sm">
            <Sparkles size={11} className="text-[#ED47FC]" />
            <span>CINEMATIC PRODUCT STORY</span>
          </div>
        </div>

        {/* Center Current Sequence Indicator */}
        <div className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0E0E14]/90 border border-white/10 text-xs font-mono">
          <span className="text-[#18CFFC] font-bold">0{currentScene + 1} / 0{totalScenes}</span>
          <span className="text-zinc-500">·</span>
          <span className="text-white uppercase tracking-wider font-semibold">
            {sceneTitles[currentScene]}
          </span>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Play/Pause presentation */}
          <button
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause auto presentation' : 'Play auto presentation'}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            {isPlaying ? (
              <>
                <Pause size={13} className="text-[#18CFFC]" />
                <span className="hidden sm:inline">Pause</span>
              </>
            ) : (
              <>
                <Play size={13} className="text-emerald-400 fill-emerald-400" />
                <span className="hidden sm:inline">Auto-Play</span>
              </>
            )}
          </button>

          {/* Exit to Main App */}
          <Link to="/">
            <button className="px-3.5 py-1.5 rounded-xl bg-[#14141E] hover:bg-[#1C1C2A] border border-white/10 text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer">
              <ArrowLeft size={13} />
              <span className="hidden sm:inline">Back to FestFlow</span>
            </button>
          </Link>
        </div>
      </header>

      {/* ─── BOTTOM SCRUBBER & TIMELINE CONTROLLER ─────────────────────────── */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 flex flex-col items-center pointer-events-auto select-none bg-gradient-to-t from-[#08080A]/95 via-[#08080A]/60 to-transparent backdrop-blur-sm">
        {/* Navigation timeline pill */}
        <div className="w-full max-w-2xl px-3 sm:px-4 py-2.5 rounded-2xl bg-[#0E0E14]/90 border border-white/10 shadow-2xl flex items-center justify-between gap-2 sm:gap-4 backdrop-blur-xl">
          {/* Previous Scene Button */}
          <button
            disabled={currentScene === 0}
            onClick={onPrev}
            aria-label="Previous sequence"
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0"
          >
            <ChevronLeft size={16} />
          </button>

          {/* 7 Interactive Sequence Dots / Pills */}
          <div className="flex items-center justify-between w-full gap-1 sm:gap-2">
            {sceneTitles.map((title, idx) => {
              const isActive = idx === currentScene
              const isPast = idx < currentScene

              return (
                <button
                  key={title}
                  onClick={() => onSelectScene(idx)}
                  className={`flex-1 py-1.5 px-1 rounded-lg text-center transition-all cursor-pointer flex flex-col items-center ${
                    isActive
                      ? 'bg-[#18CFFC]/20 border border-[#18CFFC]/50 shadow-[0_0_12px_rgba(24,207,252,0.3)]'
                      : isPast
                      ? 'bg-white/5 border border-white/10 hover:bg-white/10'
                      : 'bg-white/[0.02] border border-transparent hover:bg-white/5'
                  }`}
                >
                  <div
                    className={`h-1 w-full rounded-full mb-1 transition-all ${
                      isActive
                        ? 'bg-[#18CFFC]'
                        : isPast
                        ? 'bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB]'
                        : 'bg-white/15'
                    }`}
                  />
                  <span
                    className={`text-[9px] font-mono tracking-wider truncate block w-full ${
                      isActive
                        ? 'text-white font-bold'
                        : isPast
                        ? 'text-zinc-300'
                        : 'text-zinc-500'
                    }`}
                  >
                    0{idx + 1}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Next Scene Button */}
          <button
            disabled={currentScene === totalScenes - 1}
            onClick={onNext}
            aria-label="Next sequence"
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Keyboard shortcut hint */}
        <div className="mt-2 text-[10px] text-zinc-500 font-mono hidden sm:block">
          Use <span className="text-zinc-400">←</span> and <span className="text-zinc-400">→</span> keys to navigate · <span className="text-zinc-400">Space</span> to play/pause
        </div>
      </footer>
    </>
  )
}
export default StoryControllerHUD
