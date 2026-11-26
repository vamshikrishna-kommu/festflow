import { Sparkles, Users, Calendar } from 'lucide-react'

/**
 * 2D High-Fidelity Fallback Component for devices without WebGL
 * and initial loading state while Three.js hydrates asynchronously.
 */
export function CharacterDuoFallback() {
  return (
    <div className="relative w-full h-[480px] flex items-center justify-center select-none">
      {/* Subtle ambient tint */}
      <div
        className="absolute w-80 h-80 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(37,99,235,0.08) 0%, rgba(124,58,237,0.05) 50%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Floating 2D visual card */}
      <div className="relative w-72 sm:w-80 rounded-2xl p-6 bg-white border border-gray-200 shadow-lg flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 pb-4">
          <span className="text-[11px] uppercase font-bold tracking-widest text-blue-600 flex items-center gap-1.5">
            <Sparkles size={13} className="text-indigo-600" /> 3D Experience Ready
          </span>
          <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[10px] font-bold text-blue-700">
            ● VERIFIED
          </span>
        </div>

        <div className="my-auto py-8 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 mx-auto flex items-center justify-center text-white shadow-md">
            <Users size={32} />
          </div>
          <h4 className="font-display font-bold text-lg text-gray-900">FestFlow Campus Duo</h4>
          <p className="text-xs text-gray-500 max-w-[220px] mx-auto leading-relaxed">
            Organizers and students collaborating on the next generation of campus festivals.
          </p>
        </div>

        <div className="pt-4 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-500">
          <span className="font-mono text-blue-600">#FF-CHARACTERS</span>
          <span className="text-gray-400 flex items-center gap-1">
            <Calendar size={12} /> FEST-2026
          </span>
        </div>
      </div>
    </div>
  )
}

