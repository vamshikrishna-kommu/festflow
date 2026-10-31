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

  // ── Mobile Variant (Rendered in mobile drawer) ─────────────────────────────
  if (variant === 'mobile') {
    if (!isDualEligible && availableClubs.length <= 1) {
      // Single workspace mobile view
      return (
        <div className="flex items-center justify-between px-3.5 py-2.5 mb-3 rounded-xl bg-[var(--color-surface-2)]/70 border border-[oklch(100%_0_0_/_0.06)]">
          <div className="flex items-center gap-2.5 min-w-0">
            {activeWorkspace === 'club' ? (
              <div className="w-7 h-7 rounded-lg bg-[#18CFFC]/15 text-[#18CFFC] flex items-center justify-center shrink-0">
                <Building2 size={15} />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-lg bg-cyan-500/15 text-[var(--color-brand-cyan)] flex items-center justify-center shrink-0">
                <GraduationCap size={15} />
              </div>
            )}
            <div className="min-w-0">
              <span className="text-xs font-bold text-[var(--color-text-primary)] block truncate">
                {activeWorkspace === 'club' ? activeClubName : 'Student Workspace'}
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)] block truncate">
                {activeWorkspace === 'club'
                  ? (activeClubRole ? ROLE_LABELS[activeClubRole] : 'Club Workspace')
                  : 'Personal tickets & registrations'}
              </span>
            </div>
          </div>
          <Badge variant={activeWorkspace === 'club' ? 'purple' : 'cyan'} className="text-[10px] py-0 px-2 shrink-0">
            {activeWorkspace === 'club' ? 'Club' : 'Student'}
          </Badge>
        </div>
      )
    }

    return (
      <div className="mb-4 p-3 rounded-2xl bg-[var(--color-surface-2)]/80 border border-[oklch(100%_0_0_/_0.08)]">
        <div className="flex items-center justify-between mb-2 px-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] flex items-center gap-1.5">
            <Layers size={12} className="text-[var(--color-brand-violet)]" />
            Active Workspace
          </span>
          <span className="text-[10px] text-[var(--color-brand-cyan)] font-medium">
            {activeWorkspace === 'club' ? 'Club Mode' : 'Student Mode'}
          </span>
        </div>

        {/* Workspace Dual Segmented Control */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--color-surface-1)] border border-[oklch(100%_0_0_/_0.06)]">
          <button
            type="button"
            onClick={() => handleSelectWorkspace('student')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeWorkspace === 'student'
                ? 'bg-cyan-500/20 text-[var(--color-brand-cyan)] border border-cyan-500/30 shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-white'
            }`}
          >
            <GraduationCap size={14} />
            <span>Student</span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectWorkspace('club')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeWorkspace === 'club'
                ? 'bg-[#7F1AFB]/20 text-[#C084FC] border border-[#7F1AFB]/35 shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-white'
            }`}
          >
            <Building2 size={14} />
            <span>Club</span>
          </button>
        </div>

        {/* Organization Switcher (If multiple clubs available in Club Workspace) */}
        {activeWorkspace === 'club' && availableClubs.length > 1 && (
          <div className="mt-3 pt-2.5 border-t border-[oklch(100%_0_0_/_0.06)]">
            <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider block mb-1.5">
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
                        ? 'bg-[var(--color-surface-3)] text-white font-semibold border border-[var(--color-brand-purple)]/40'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)]/60'
                    }`}
                  >
                    <span className="truncate pr-2">{club.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="purple" className="text-[9px] py-0 px-1.5">
                        {ROLE_LABELS[club.role]}
                      </Badge>
                      {isSelected && <Check size={12} className="text-[var(--color-brand-purple)]" />}
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

  // ── Desktop Variant (Rendered in Navbar adjacent to Avatar) ────────────────
  if (!isDualEligible && availableClubs.length <= 1) {
    // Single workspace badge
    return (
      <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[var(--color-surface-2)]/60 border border-[oklch(100%_0_0_/_0.06)] text-xs text-[var(--color-text-secondary)]">
        {activeWorkspace === 'club' ? (
          <>
            <Building2 size={13} className="text-[var(--color-brand-purple)]" />
            <span className="max-w-[110px] truncate font-medium text-[var(--color-text-primary)]">
              {activeClubName}
            </span>
            <Badge variant="purple" className="text-[9px] py-0 px-1.5 font-medium ml-0.5">
              {activeClubRole ? ROLE_LABELS[activeClubRole] : 'Club'}
            </Badge>
          </>
        ) : (
          <>
            <GraduationCap size={13} className="text-[var(--color-brand-cyan)]" />
            <span className="font-medium text-[var(--color-text-primary)]">Student</span>
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
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-sm ${
          activeWorkspace === 'club'
            ? 'bg-[#7F1AFB]/10 hover:bg-[#7F1AFB]/15 text-[#C084FC] border-[#7F1AFB]/25 hover:border-[#7F1AFB]/40'
            : 'bg-[#18CFFC]/10 hover:bg-[#18CFFC]/15 text-[#18CFFC] border-[#18CFFC]/25 hover:border-[#18CFFC]/40'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {activeWorkspace === 'club' ? (
            <>
              <Building2 size={13} className="text-[#7F1AFB] shrink-0" />
              <span className="max-w-[110px] truncate">{activeClubName}</span>
              <Badge variant="purple" className="text-[9px] py-0 px-1.5 shrink-0">
                {activeClubRole ? ROLE_LABELS[activeClubRole] : 'Club'}
              </Badge>
            </>
          ) : (
            <>
              <GraduationCap size={13} className="text-[var(--color-brand-cyan)] shrink-0" />
              <span>Student Workspace</span>
            </>
          )}
        </div>
        <ChevronDown
          size={12}
          className={`text-[var(--color-text-muted)] transition-transform duration-200 ${
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
            className="absolute right-0 top-full mt-2 w-72 p-2.5 rounded-2xl glass-elevated shadow-2xl border border-[oklch(100%_0_0_/_0.12)] flex flex-col gap-2 z-50 text-left"
          >
            {/* Header */}
            <div className="px-2 py-1 flex items-center justify-between border-b border-[oklch(100%_0_0_/_0.08)] pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                Workspaces
              </span>
              <span className="text-[10px] text-[var(--color-brand-violet)] font-semibold">
                Dual Access Active
              </span>
            </div>

            {/* Workspace Options */}
            <div className="flex flex-col gap-1">
              {/* 1. Student Workspace Option */}
              <button
                type="button"
                onClick={() => handleSelectWorkspace('student')}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer text-left ${
                  activeWorkspace === 'student'
                    ? 'bg-cyan-500/10 border border-cyan-500/30 text-white'
                    : 'hover:bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      activeWorkspace === 'student'
                        ? 'bg-cyan-500/20 text-[var(--color-brand-cyan)]'
                        : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    <GraduationCap size={16} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold block">Student Workspace</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] block truncate">
                      Event passes, tickets & registrations
                    </span>
                  </div>
                </div>
                {activeWorkspace === 'student' && (
                  <Check size={14} className="text-[var(--color-brand-cyan)] shrink-0 ml-1" />
                )}
              </button>

              {/* 2. Club Workspace Option */}
              <button
                type="button"
                onClick={() => handleSelectWorkspace('club')}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer text-left ${
                  activeWorkspace === 'club'
                    ? 'bg-[#18CFFC]/10 border border-[#18CFFC]/30 text-white'
                    : 'hover:bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      activeWorkspace === 'club'
                        ? 'bg-[#18CFFC]/20 text-[#18CFFC]'
                        : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    <Building2 size={16} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold block">Club Workspace</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] block truncate">
                      Event hosting, payments & turnstile check-in
                    </span>
                  </div>
                </div>
                {activeWorkspace === 'club' && (
                  <Check size={14} className="text-[#18CFFC] shrink-0 ml-1" />
                )}
              </button>
            </div>

            {/* Organizations Selection (Visible when multiple clubs exist) */}
            {availableClubs.length > 0 && (
              <div className="pt-2 border-t border-[oklch(100%_0_0_/_0.08)]">
                <div className="px-2 pb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
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
                            ? 'bg-[var(--color-surface-3)] text-white font-semibold border border-[#18CFFC]/30'
                            : 'text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-surface-3)]/60'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Building2 size={12} className={isSelected ? 'text-[#18CFFC]' : 'text-[var(--color-text-muted)]'} />
                          <span className="truncate max-w-[130px]">{club.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="purple" className="text-[9px] py-0 px-1.5 font-medium">
                            {ROLE_LABELS[club.role]}
                          </Badge>
                          {isSelected && <Check size={12} className="text-[#18CFFC]" />}
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
