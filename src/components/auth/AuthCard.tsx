import type { ReactNode } from 'react'
import { Link } from 'react-router'
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
  const isClub = role === 'club_member'
  const isLocalDev = Boolean(import.meta.env?.DEV) && !isProduction

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 sm:px-6 lg:px-8 py-10 sm:py-16 relative overflow-hidden bg-[var(--color-surface-0)]">
      {/* Background ambient lighting */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] pointer-events-none -z-0"
        style={{
          background: isClub
            ? 'radial-gradient(ellipse at center, oklch(58% 0.26 285 / 0.12) 0%, transparent 70%)'
            : 'radial-gradient(ellipse at center, oklch(72% 0.16 200 / 0.10) 0%, transparent 70%)',
        }}
      />
      <div aria-hidden="true" className="absolute inset-0 grid-pattern opacity-25 pointer-events-none -z-0" />

      {/* Centered composition container */}
      <div className="w-full max-w-4xl mx-auto my-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.09)] glass-elevated shadow-[0_24px_64px_oklch(0%_0_0_/_0.6)] overflow-hidden grid grid-cols-1 lg:grid-cols-12"
        >
          {/* Left branding panel — visible on desktop */}
          <div
            className="hidden lg:flex lg:col-span-5 flex-col justify-between p-8 sm:p-10 border-r border-[oklch(100%_0_0_/_0.08)] relative overflow-hidden text-left"
            style={{ background: 'oklch(10% 0.022 265)' }}
          >
            {/* Background subtle radial */}
            <div
              className="absolute -top-24 -left-24 w-72 h-72 rounded-full pointer-events-none"
              style={{
                background: isClub
                  ? 'radial-gradient(circle, oklch(58% 0.26 285 / 0.22) 0%, transparent 70%)'
                  : 'radial-gradient(circle, oklch(72% 0.16 200 / 0.20) 0%, transparent 70%)',
              }}
            />

            <div className="relative z-10">
              <Link to="/" className="inline-flex items-center mb-8" aria-label="FestFlow home">
                <Logo variant="navbar" />
              </Link>

              <div className="space-y-6">
                <div>
                  <h2 className="font-display font-bold text-xl text-[var(--color-text-primary)] mb-2">
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
                      <span className="text-[var(--color-brand-violet)] font-bold">{icon}</span>
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
          <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center text-left">
            {/* Mobile logo header */}
            <div className="lg:hidden mb-6 flex flex-col items-center text-center gap-2">
              <Link to="/" aria-label="FestFlow home">
                <Logo variant="navbar" />
              </Link>
              <Badge variant={isClub ? 'purple' : 'cyan'}>
                {isClub ? 'Club Portal' : 'Student Hub'}
              </Badge>
              {!isConfigured && (
                <Badge variant={isProduction ? 'danger' : 'amber'}>
                  {isProduction ? 'Backend Unconfigured' : 'Simulation Mode'}
                </Badge>
              )}
            </div>

            {/* Role switcher */}
            <div className="grid grid-cols-2 p-1 bg-[var(--color-surface-2)] rounded-xl mb-6 border border-[var(--color-surface-3)]">
              <Link
                to={mode === 'login' ? '/student/login' : '/student/signup'}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-[10px] text-xs font-semibold transition-all ${
                  !isClub
                    ? 'bg-[var(--color-surface-3)] text-[var(--color-text-primary)] shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                <GraduationCap size={14} />
                Student
              </Link>
              <Link
                to={mode === 'login' ? '/club/login' : '/club/signup'}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-[10px] text-xs font-semibold transition-all ${
                  isClub
                    ? 'text-[var(--color-brand-violet)] shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`}
                style={isClub ? { background: 'oklch(58% 0.26 285 / 0.18)', border: '1px solid oklch(58% 0.26 285 / 0.3)' } : {}}
              >
                <Building2 size={14} />
                Club Organizer
              </Link>
            </div>

            {/* Title */}
            <div className="mb-6">
              <h1 className="font-display font-bold text-xl sm:text-2xl text-[var(--color-text-primary)] tracking-tight">
                {title}
              </h1>
              <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-1.5 leading-relaxed">
                {subtitle}
              </p>
            </div>

            {/* Form Inputs & Submission */}
            {children}

            {/* Mode Switcher Link */}
            <div className="mt-6 pt-5 border-t border-[oklch(100%_0_0_/_0.07)] text-center text-xs text-[var(--color-text-secondary)]">
              {mode === 'login' ? (
                <p>
                  Don&apos;t have an account?{' '}
                  <Link
                    to={isClub ? '/club/signup' : '/student/signup'}
                    className="font-semibold text-[var(--color-brand-violet)] hover:underline ml-1 transition-colors"
                  >
                    Sign up as {isClub ? 'Club' : 'Student'}
                  </Link>
                </p>
              ) : (
                <p>
                  Already registered?{' '}
                  <Link
                    to={isClub ? '/club/login' : '/student/login'}
                    className="font-semibold text-[var(--color-brand-violet)] hover:underline ml-1 transition-colors"
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

            {/* Local testing helper — displayed only in local dev when Supabase is not configured */}
            {isLocalDev && !isConfigured && (
              <div className="mt-4 p-3 bg-[var(--color-surface-2)]/60 rounded-xl border border-dashed border-[var(--color-surface-3)] text-[11px] text-[var(--color-text-muted)]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-[var(--color-text-secondary)] flex items-center gap-1.5">
                    <Sparkles size={11} /> Local Testing Helper
                  </span>
                  <span className="text-[10px] text-[var(--color-brand-amber)] font-medium">Dev Simulation</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDemoUser(role)}
                  className="w-full mt-1.5 py-2 px-3 rounded-xl bg-[var(--color-surface-3)] hover:bg-[var(--color-surface-4)] text-[var(--color-text-primary)] font-semibold transition-colors text-center text-xs border border-[oklch(100%_0_0_/_0.06)] flex items-center justify-center gap-2 cursor-pointer"
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
