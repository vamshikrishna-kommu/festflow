import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import {
  GraduationCap,
  Building2,
  ChevronDown,
  Check,
  Layers,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Badge } from '@/components/ui'
import { ROLE_LABELS } from '@/lib/clubMembers'
import { dropdownMenu } from '@/lib/animations'
import type { WorkspaceType } from '@/lib/workspace'

interface WorkspaceSwitcherProps {
  variant?: 'desktop' | 'mobile'
  onNavigate?: () => void
}

export function WorkspaceSwitcher({
  variant = 'desktop',
  onNavigate,
}: WorkspaceSwitcherProps) {
  const {
    session,
    activeWorkspace,
    isDualEligible,
    availableClubs,
    activeClubId,
    activeClubRole,
    activeClubProfile,
    switchWorkspace,
    switchActiveClub,
    isLoading,
  } = useAuth()

  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    const onOut = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onOut)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onOut)
    }
  }, [])

  if (isLoading || !session) {
    return null
  }

  const activeClubName =
    activeClubProfile?.club_name ||
    availableClubs.find((c) => c.id === activeClubId)?.name ||
    'Campus Club'

  const handleSelectWorkspace = (target: WorkspaceType) => {
    setIsOpen(false)
    if (onNavigate) onNavigate()
    switchWorkspace(target, navigate)
  }

  const handleSelectClub = async (clubId: string) => {
    await switchActiveClub(clubId)
    setIsOpen(false)
    if (onNavigate) onNavigate()
    if (activeWorkspace !== 'club') {
      switchWorkspace('club', navigate)
    }
  }

  // ── Mobile Variant ────────────────────────────────────────────────────────
  if (variant === 'mobile') {
    if (!isDualEligible && availableClubs.length <= 1) {
      return (
        <div className="flex items-center justify-between px-3.5 py-2.5 mb-3 rounded-xl bg-gray-50 border border-gray-200">
          <div className="flex items-center gap-2.5 min-w-0">
            {activeWorkspace === 'club' ? (
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Building2 size={15} />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <GraduationCap size={15} />
              </div>
            )}
            <div className="min-w-0">
              <span className="text-xs font-semibold text-gray-900 block truncate">
                {activeWorkspace === 'club' ? activeClubName : 'Student Workspace'}
              </span>
              <span className="text-[11px] text-gray-500 block truncate">
                {activeWorkspace === 'club'
                  ? (activeClubRole ? ROLE_LABELS[activeClubRole] : 'Club Workspace')
                  : 'Personal tickets & registrations'}
              </span>
            </div>
          </div>
          <Badge variant={activeWorkspace === 'club' ? 'violet' : 'blue'} className="text-[10px] py-0 px-2 shrink-0">
            {activeWorkspace === 'club' ? 'Club' : 'Student'}
          </Badge>
        </div>
      )
    }

    return (
      <div className="mb-4 p-3 rounded-xl bg-gray-50 border border-gray-200">
        <div className="flex items-center justify-between mb-2 px-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <Layers size={12} className="text-blue-600" />
            {isDualEligible ? 'Active Workspace' : 'Club Organizations'}
          </span>
          <span className="text-[11px] text-blue-600 font-medium">
            {activeWorkspace === 'club' ? 'Club Mode' : 'Student Mode'}
          </span>
        </div>

        {isDualEligible && (
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-white border border-gray-200">
            <button
              type="button"
              onClick={() => handleSelectWorkspace('student')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeWorkspace === 'student'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <GraduationCap size={14} />
              <span>Student</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectWorkspace('club')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeWorkspace === 'club'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Building2 size={14} />
              <span>Club</span>
            </button>
          </div>
        )}

        {activeWorkspace === 'club' && availableClubs.length > 1 && (
          <div className={isDualEligible ? 'mt-3 pt-2.5 border-t border-gray-200' : 'mt-1'}>
            <span className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider block mb-1.5">
              Select Club ({availableClubs.length})
            </span>
            <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-0.5">
              {availableClubs.map((club) => {
                const isSelected = club.id === activeClubId
                return (
                  <button
                    key={club.id}
                    type="button"
                    onClick={() => handleSelectClub(club.id)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                      isSelected
                        ? 'bg-white text-gray-900 font-semibold border border-gray-300 shadow-xs'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className="truncate pr-2">{club.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="violet" className="text-[9px] py-0 px-1.5">
                        {ROLE_LABELS[club.role]}
                      </Badge>
                      {isSelected && <Check size={12} className="text-blue-600" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Desktop Variant ───────────────────────────────────────────────────────
  if (!isDualEligible && availableClubs.length <= 1) {
    return (
      <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100/80 border border-gray-200 text-xs text-gray-700">
        {activeWorkspace === 'club' ? (
          <>
            <Building2 size={13} className="text-indigo-600" />
            <span className="max-w-[110px] truncate font-medium text-gray-900">
              {activeClubName}
            </span>
            <Badge variant="violet" className="text-[10px] py-0 px-1.5 font-medium ml-0.5">
              {activeClubRole ? ROLE_LABELS[activeClubRole] : 'Club'}
            </Badge>
          </>
        ) : (
          <>
            <GraduationCap size={13} className="text-blue-600" />
            <span className="font-medium text-gray-900">Student</span>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="relative hidden md:block" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        aria-label="Switch workspace or organization"
        aria-expanded={isOpen}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer shadow-xs ${
          activeWorkspace === 'club'
            ? 'bg-indigo-50/70 hover:bg-indigo-100/70 text-indigo-700 border-indigo-200'
            : 'bg-blue-50/70 hover:bg-blue-100/70 text-blue-700 border-blue-200'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {activeWorkspace === 'club' ? (
            <>
              <Building2 size={13} className="text-indigo-600 shrink-0" />
              <span className="max-w-[110px] truncate">{activeClubName}</span>
              <Badge variant="violet" className="text-[10px] py-0 px-1.5 shrink-0">
                {activeClubRole ? ROLE_LABELS[activeClubRole] : 'Club'}
              </Badge>
            </>
          ) : (
            <>
              <GraduationCap size={13} className="text-blue-600 shrink-0" />
              <span>Student Space</span>
            </>
          )}
        </div>
        <ChevronDown
          size={12}
          className={`text-gray-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={dropdownMenu}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute right-0 top-full mt-2 w-72 p-2 rounded-xl bg-white shadow-xl border border-gray-200 flex flex-col gap-2 z-50 text-left"
          >
            {/* Header */}
            <div className="px-2 py-1 flex items-center justify-between border-b border-gray-100 pb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                {isDualEligible ? 'Workspaces' : 'Organizations'}
              </span>
              <span className="text-[10px] text-blue-600 font-medium">
                {isDualEligible ? 'Dual Access' : `${availableClubs.length} Clubs`}
              </span>
            </div>

            {/* Workspace Options */}
            {isDualEligible && (
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => handleSelectWorkspace('student')}
                  className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer text-left ${
                    activeWorkspace === 'student'
                      ? 'bg-blue-50 border border-blue-200 text-gray-900'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        activeWorkspace === 'student'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      <GraduationCap size={16} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold block">Student Workspace</span>
                      <span className="text-[11px] text-gray-500 block truncate">
                        Passes, tickets & registrations
                      </span>
                    </div>
                  </div>
                  {activeWorkspace === 'student' && (
                    <Check size={14} className="text-blue-600 shrink-0 ml-1" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectWorkspace('club')}
                  className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer text-left ${
                    activeWorkspace === 'club'
                      ? 'bg-indigo-50 border border-indigo-200 text-gray-900'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        activeWorkspace === 'club'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      <Building2 size={16} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold block">Club Workspace</span>
                      <span className="text-[11px] text-gray-500 block truncate">
                        Event hosting, payments & rosters
                      </span>
                    </div>
                  </div>
                  {activeWorkspace === 'club' && (
                    <Check size={14} className="text-indigo-600 shrink-0 ml-1" />
                  )}
                </button>
              </div>
            )}

            {/* Organizations Selection */}
            {availableClubs.length > 0 && (
              <div className={isDualEligible ? 'pt-2 border-t border-gray-100' : 'pt-0.5'}>
                <div className="px-2 pb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    Club Organization ({availableClubs.length})
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 max-h-44 overflow-y-auto pr-1">
                  {availableClubs.map((club) => {
                    const isSelected = activeWorkspace === 'club' && club.id === activeClubId
                    return (
                      <button
                        key={club.id}
                        type="button"
                        onClick={() => handleSelectClub(club.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                          isSelected
                            ? 'bg-gray-100 text-gray-900 font-semibold'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Building2 size={12} className={isSelected ? 'text-indigo-600' : 'text-gray-400'} />
                          <span className="truncate max-w-[130px]">{club.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="violet" className="text-[9px] py-0 px-1.5 font-medium">
                            {ROLE_LABELS[club.role]}
                          </Badge>
                          {isSelected && <Check size={12} className="text-indigo-600" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
