import { useEffect, useState, useTransition } from 'react'
import { Volume2, VolumeX, Sparkles } from 'lucide-react'
import { isAudioActive, toggleAudio, addAudioListener } from '@/lib/audio'

export interface AudioAmbienceToggleProps {
  className?: string
  showLabel?: boolean
}

export function AudioAmbienceToggle({
  className = '',
  showLabel = false,
}: AudioAmbienceToggleProps) {
  const [isActive, setIsActive] = useState<boolean>(() => isAudioActive())
  const [isPending, startTransition] = useTransition()
  const [showTooltip, setShowTooltip] = useState(false)

  useEffect(() => {
    const unsubscribe = addAudioListener((active) => {
      setIsActive(active)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  const handleToggle = () => {
    startTransition(async () => {
      await toggleAudio()
    })
  }

  const tooltipText = isActive
    ? 'Mute Immersive Ambience'
    : 'Enable Immersive Sound (Opt-in)'

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
    >
      <style>{`
        @keyframes audioWave {
          0% { height: 2px; }
          50% { height: 12px; }
          100% { height: 4px; }
        }
      `}</style>
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        aria-label={tooltipText}
        aria-pressed={isActive}
        className={`group relative flex items-center gap-2.5 px-3 py-1.5 rounded-full text-xs font-mono tracking-wider transition-all duration-300 backdrop-blur-md cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#18CFFC] ${
          isActive
            ? 'bg-[#18CFFC]/15 border border-[#18CFFC]/70 text-[#18CFFC] shadow-[0_0_20px_rgba(24,207,252,0.35)] hover:bg-[#18CFFC]/25'
            : 'bg-black/40 border border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-[#18CFFC]/40 hover:bg-white/[0.04]'
        }`}
      >
        {/* Audio status icon */}
        <span className="relative flex items-center justify-center w-4 h-4">
          {isActive ? (
            <Volume2 className="w-4 h-4 text-[#18CFFC] animate-pulse" />
          ) : (
            <VolumeX className="w-4 h-4 text-zinc-400 group-hover:text-zinc-300 transition-colors" />
          )}
        </span>

        {/* Pulsing Audio Wave Equalizer Bars */}
        <div className="flex items-end gap-[2px] h-3 w-4 px-0.5 justify-center overflow-hidden">
          <span
            className={`w-[2px] rounded-full transition-all duration-300 ${
              isActive
                ? 'bg-[#18CFFC] animate-[audioWave_0.9s_ease-in-out_infinite_alternate] h-3'
                : 'bg-zinc-600 h-1'
            }`}
          />
          <span
            className={`w-[2px] rounded-full transition-all duration-300 ${
              isActive
                ? 'bg-[#7F1AFB] animate-[audioWave_1.2s_ease-in-out_infinite_alternate_0.2s] h-2'
                : 'bg-zinc-600 h-1'
            }`}
          />
          <span
            className={`w-[2px] rounded-full transition-all duration-300 ${
              isActive
                ? 'bg-[#ED47FC] animate-[audioWave_0.8s_ease-in-out_infinite_alternate_0.4s] h-2.5'
                : 'bg-zinc-600 h-1'
            }`}
          />
          <span
            className={`w-[2px] rounded-full transition-all duration-300 ${
              isActive
                ? 'bg-[#18CFFC] animate-[audioWave_1.0s_ease-in-out_infinite_alternate_0.1s] h-1.5'
                : 'bg-zinc-600 h-1'
            }`}
          />
        </div>

        {/* Optional Label */}
        {showLabel && (
          <span className="hidden sm:inline font-sans text-[11px] font-medium tracking-normal text-inherit">
            {isActive ? '3D Audio ON' : 'Audio OFF'}
          </span>
        )}

        {/* Ambient glow accent for active state */}
        {isActive && (
          <span className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-[#18CFFC]/20 via-[#7F1AFB]/20 to-[#ED47FC]/20 blur-sm -z-10 pointer-events-none" />
        )}
      </button>

      {/* Sleek Tooltip */}
      <div
        role="tooltip"
        className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 text-[11px] font-sans font-medium whitespace-nowrap rounded-md bg-[#08080A]/95 text-zinc-200 border border-white/10 shadow-xl backdrop-blur-md pointer-events-none transition-all duration-200 z-50 flex items-center gap-1.5 ${
          showTooltip
            ? 'opacity-100 translate-y-0 visible'
            : 'opacity-0 translate-y-1 invisible'
        }`}
      >
        <Sparkles className="w-3 h-3 text-[#18CFFC]" />
        <span>{tooltipText}</span>
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-4 border-transparent border-t-[#08080A]" />
      </div>
    </div>
  )
}
