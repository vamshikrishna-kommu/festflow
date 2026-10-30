import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { motion } from 'motion/react'
import { Building2, GraduationCap, AlertTriangle, Sparkles } from 'lucide-react'
import { Badge, Logo } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { isProduction } from '@/lib/supabase'

interface AuthCardProps {
  title: string
  subtitle: string
  role: 'club_member' | 'student'
  mode: 'login' | 'signup'
  children: ReactNode
}

export function AuthCard({ title, subtitle, role, mode, children }: AuthCardProps) {
  const { isConfigured, setDemoUser } = useAuth()
  const location = useLocation()
  const search = location.search || ''
  const isClub = role === 'club_member'
  const isLocalDev = Boolean(import.meta.env?.DEV) && !isProduction

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 sm:px-6 lg:px-8 py-10 sm:py-16 relative overflow-hidden bg-[#08080A]">
      {/* Background ambient lighting */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] pointer-events-none -z-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(127, 26, 251, 0.14) 0%, rgba(24, 207, 252, 0.08) 50%, transparent 70%)',
        }}
      />
      <div aria-hidden="true" className="absolute inset-0 grid-pattern opacity-20 pointer-events-none -z-0" />

      {/* Centered composition container */}
      <div className="w-full max-w-4xl mx-auto my-auto relative z-10 min-w-0">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="w-full rounded-[var(--radius-card)] border border-white/10 bg-[#0E0E12]/90 backdrop-blur-xl shadow-[0_24px_64px_rgba(0,0,0,0.8)] overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-w-0"
        >
          {/* Left branding panel — visible on desktop */}
          <div
            className="hidden lg:flex lg:col-span-5 flex-col justify-between p-8 sm:p-10 border-r border-white/10 relative overflow-hidden text-left bg-[#14141A]"
          >
            {/* Background subtle radial */}
            <div
              className="absolute -top-24 -left-24 w-72 h-72 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(127, 26, 251, 0.22) 0%, rgba(24, 207, 252, 0.12) 50%, transparent 70%)',
              }}
            />

            <div className="relative z-10">
              <Link to="/" className="inline-flex items-center mb-8" aria-label="FestFlow home">
                <Logo variant="navbar" />
              </Link>

              <div className="space-y-6">
                <div>
                  <h2 className="font-display font-bold text-xl text-white mb-2">
                    {isClub ? 'Campus Club Management' : 'All Your Campus Passes'}
                  </h2>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    {isClub
                      ? 'Create events, manage registrations, verify UPI transactions, and admit attendees with real-time QR scanning.'
                      : 'Discover campus hackathons, symposiums, and cultural fests with automated digital passes.'}
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  {[
                    { icon: '✦', text: '0% platform fee for college events' },
                    { icon: '⚡', text: 'Digital QR passes for campus entry' },
                    { icon: '🔒', text: 'Direct UPI collection to club accounts' },
                  ].map(({ icon, text }) => (
                    <div key={text} className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
                      <span className="text-[#18CFFC] font-bold">{icon}</span>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="relative z-10 text-[11px] text-[var(--color-text-muted)] pt-8">
              Built for college clubs and student communities.
            </p>
          </div>

          {/* Right form panel */}
          <div className="lg:col-span-7 p-4 sm:p-8 lg:p-10 flex flex-col justify-center text-left w-full min-w-0">
            {/* Mobile logo header */}
            <div className="lg:hidden mb-6 flex flex-col items-center text-center gap-2">
              <Link to="/" aria-label="FestFlow home">
                <Logo variant="navbar" />
              </Link>
              <Badge variant="brand">
                {isClub ? 'Club Portal' : 'Student Hub'}
              </Badge>
              {!isConfigured && (
                <Badge variant={isProduction ? 'danger' : 'amber'}>
                  {isProduction ? 'Backend Unconfigured' : 'Simulation Mode'}
                </Badge>
              )}
            </div>

            {/* Role switcher */}
            <div className="grid grid-cols-2 p-1 bg-[#14141A] rounded-xl mb-6 border border-white/10 gap-1">
              <Link
                to={mode === 'login' ? `/student/login${search}` : `/student/signup${search}`}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 rounded-[10px] text-[11px] sm:text-xs font-semibold transition-all ${
                  !isClub
                    ? 'bg-gradient-to-r from-[#18CFFC] via-[#07A4FC] to-[#7F1AFB] text-white shadow-[0_4px_16px_rgba(127,26,251,0.35)]'
                    : 'text-[var(--color-text-muted)] hover:text-white'
                }`}
              >
                <GraduationCap size={14} className="shrink-0" />
                <span className="truncate">Student</span>
              </Link>
              <Link
                to={mode === 'login' ? `/club/login${search}` : `/club/signup${search}`}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 rounded-[10px] text-[11px] sm:text-xs font-semibold transition-all ${
                  isClub
                    ? 'bg-gradient-to-r from-[#18CFFC] via-[#07A4FC] to-[#7F1AFB] text-white shadow-[0_4px_16px_rgba(127,26,251,0.35)]'
                    : 'text-[var(--color-text-muted)] hover:text-white'
                }`}
              >
                <Building2 size={14} className="shrink-0" />
                <span className="truncate">Club Organizer</span>
              </Link>
            </div>

            {/* Title */}
            <div className="mb-6">
              <h1 className="font-display font-extrabold text-lg sm:text-2xl text-white tracking-tight break-words">
                {title}
              </h1>
              <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-1.5 leading-relaxed">
                {subtitle}
              </p>
            </div>

            {/* Form Inputs & Submission */}
            {children}

            {/* Mode Switcher Link */}
            <div className="mt-6 pt-5 border-t border-white/5 text-center text-xs text-[var(--color-text-secondary)]">
              {mode === 'login' ? (
                <p>
                  Don&apos;t have an account?{' '}
                  <Link
                    to={isClub ? `/club/signup${search}` : `/student/signup${search}`}
                    className="font-semibold text-[#18CFFC] hover:text-[#07A4FC] hover:underline ml-1 transition-colors"
                  >
                    Sign up as {isClub ? 'Club' : 'Student'}
                  </Link>
                </p>
              ) : (
                <p>
                  Already registered?{' '}
                  <Link
                    to={isClub ? `/club/login${search}` : `/student/login${search}`}
                    className="font-semibold text-[#18CFFC] hover:text-[#07A4FC] hover:underline ml-1 transition-colors"
                  >
                    Sign in
                  </Link>
                </p>
              )}
            </div>

            {/* Production missing credentials warning */}
            {!isConfigured && isProduction && (
              <div className="mt-4 p-3.5 bg-rose-500/10 rounded-xl border border-rose-500/25 text-xs text-rose-200">
                <div className="flex items-center gap-2 mb-1.5 font-semibold text-rose-400">
                  <AlertTriangle size={13} />
                  <span>Production Configuration Error</span>
                </div>
                <p className="text-[11px] text-rose-300/80 leading-relaxed">
                  Configure <code className="text-white bg-rose-950/40 px-1 rounded">VITE_SUPABASE_URL</code> and{' '}
                  <code className="text-white bg-rose-950/40 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> in your deployment dashboard.
                </p>
              </div>
            )}

            {/* Local testing helper — displayed in local dev */}
            {isLocalDev && (
              <div className="mt-4 p-3 bg-[#14141A] rounded-xl border border-dashed border-white/10 text-[11px] text-[var(--color-text-muted)]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-[var(--color-text-secondary)] flex items-center gap-1.5">
                    <Sparkles size={11} className="text-[#18CFFC]" /> Local Testing Helper
                  </span>
                  <span className="text-[10px] text-amber-400 font-medium">Dev Simulation</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDemoUser(role)}
                  className="w-full mt-1.5 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold transition-colors text-center text-xs border border-white/10 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>⚡</span>
                  <span>1-Click Test Sign-In as {isClub ? 'Club Leader' : 'Student'}</span>
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
