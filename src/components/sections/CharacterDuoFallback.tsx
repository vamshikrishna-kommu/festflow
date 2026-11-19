import { Sparkles, Users, Calendar } from 'lucide-react'

/**
 * 2D High-Fidelity Fallback Component for devices without WebGL
 * and initial loading state while Three.js hydrates asynchronously.
 */
export function CharacterDuoFallback() {
  return (
    <div className="relative w-full h-[480px] flex items-center justify-center select-none">
      {/* Background ambient glow */}
      <div
        className="absolute w-80 h-80 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(127,26,251,0.25) 0%, rgba(24,207,252,0.12) 50%, transparent 70%)',
          filter: 'blur(45px)',
        }}
      />

      {/* Floating 2D visual card */}
      <div className="relative w-72 sm:w-80 rounded-3xl p-6 bg-[#0E0E12] border border-[#18CFFC]/30 shadow-[0_24px_70px_rgba(0,0,0,0.85),0_0_30px_rgba(127,26,251,0.25)] flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <span className="text-[11px] uppercase font-bold tracking-widest text-[#18CFFC] flex items-center gap-1.5">
            <Sparkles size={13} className="text-[#ED47FC]" /> 3D Experience Ready
          </span>
          <span className="px-2 py-0.5 rounded-full bg-[#18CFFC]/15 border border-[#18CFFC]/40 text-[10px] font-bold text-[#18CFFC]">
            ● VERIFIED
          </span>
        </div>

        <div className="my-auto py-8 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#18CFFC] via-[#07A4FC] to-[#7F1AFB] mx-auto flex items-center justify-center text-white shadow-xl shadow-cyan-500/25">
            <Users size={32} />
          </div>
          <h4 className="font-display font-bold text-lg text-white">FestFlow Campus Duo</h4>
          <p className="text-xs text-zinc-400 max-w-[220px] mx-auto leading-relaxed">
            Organizers and students collaborating on the next generation of campus festivals.
          </p>
        </div>

        <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-400">
          <span className="font-mono text-[#18CFFC]">#FF-CHARACTERS</span>
          <span className="text-zinc-500 flex items-center gap-1">
            <Calendar size={12} /> FEST-2026
          </span>
        </div>
      </div>
    </div>
  )
}

