import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { Sparkles, Building2, GraduationCap, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui'
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

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-16 px-3 sm:px-4 flex flex-col justify-center items-center relative overflow-hidden bg-[var(--color-surface-0)]">
      {/* Background ambient glowing orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[radial-gradient(circle,oklch(60%_0.22_295_/_0.15)_0%,transparent_70%)] pointer-events-none -z-10 blur-3xl" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-[radial-gradient(circle,oklch(65%_0.20_330_/_0.1)_0%,transparent_70%)] pointer-events-none -z-10 blur-3xl" />

      {/* Brand logo header */}
      <div className="mb-5 sm:mb-6 flex flex-col items-center text-center">
        <Link to="/" className="flex items-center gap-2 group mb-2.5 sm:mb-3">
          <span className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[var(--color-brand-purple)] to-[var(--color-brand-pink)] shadow-md shadow-[var(--color-brand-purple)]/20 group-hover:scale-105 transition-transform">
            <Sparkles size={17} className="text-white" />
          </span>
          <span className="font-display font-bold text-xl sm:text-2xl text-[var(--color-text-primary)]">
            FestFlow
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant={isClub ? 'purple' : 'cyan'}>
            {isClub ? 'Club Portal' : 'Student Hub'}
          </Badge>
          {!isConfigured && (
            <Badge variant={isProduction ? 'danger' : 'amber'}>
              {isProduction ? 'Backend Unconfigured' : 'Simulation Mode'}
            </Badge>
          )}
        </div>
      </div>

      {/* Main Form Container Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md relative glass p-4 sm:p-6 md:p-8 rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.1)] shadow-[0_16px_40px_oklch(0%_0_0_/_0.4)]"
      >
        {/* Role switcher toggle tabs */}
        <div className="grid grid-cols-2 p-1 bg-[var(--color-surface-2)] rounded-xl mb-5 sm:mb-6 text-xs font-medium border border-[var(--color-surface-3)]">
          <Link
            to={mode === 'login' ? '/student/login' : '/student/signup'}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition-all ${
              !isClub
                ? 'bg-[var(--color-surface-3)] text-[var(--color-text-primary)] shadow-sm font-semibold'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            <GraduationCap size={15} />
            Student
          </Link>
          <Link
            to={mode === 'login' ? '/club/login' : '/club/signup'}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition-all ${
              isClub
                ? 'bg-gradient-to-r from-[var(--color-brand-purple)]/20 to-[var(--color-brand-pink)]/20 text-[var(--color-brand-purple)] border border-[var(--color-brand-purple)]/30 shadow-sm font-semibold'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            <Building2 size={15} />
            Club Organizer
          </Link>
        </div>

        {/* Card Title & Subtitle */}
        <div className="mb-6 text-left">
          <h1 className="text-xl sm:text-2xl font-bold font-display text-[var(--color-text-primary)] tracking-tight">
            {title}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mt-1">
            {subtitle}
          </p>
        </div>

        {/* Form content */}
        {children}

        {/* Mode switcher (Login <-> Signup) */}
        <div className="mt-6 pt-5 border-t border-[var(--color-surface-3)] text-center text-xs text-[var(--color-text-secondary)]">
          {mode === 'login' ? (
            <p>
              Don't have an account yet?{' '}
              <Link
                to={isClub ? '/club/signup' : '/student/signup'}
                className="font-semibold text-[var(--color-brand-purple)] hover:text-[var(--color-brand-pink)] transition-colors underline underline-offset-2 ml-1"
              >
                Sign up as {isClub ? 'Club' : 'Student'}
              </Link>
            </p>
          ) : (
            <p>
              Already registered?{' '}
              <Link
                to={isClub ? '/club/login' : '/student/login'}
                className="font-semibold text-[var(--color-brand-purple)] hover:text-[var(--color-brand-pink)] transition-colors underline underline-offset-2 ml-1"
              >
                Sign in to your account
              </Link>
            </p>
          )}
        </div>

        {/* Missing credentials notice / simulation helper */}
        {!isConfigured && (
          isProduction ? (
            <div className="mt-4 p-3.5 bg-red-500/10 rounded-xl border border-red-500/30 text-xs text-red-200 text-left">
              <div className="flex items-center gap-2 mb-1.5 font-semibold text-red-400">
                <AlertTriangle size={15} />
                <span>Production Configuration Error</span>
              </div>
              <p className="text-[11px] text-red-300/80 leading-relaxed">
                Supabase backend is not configured in this production deployment. Please set <code className="text-white bg-red-950/40 px-1 py-0.5 rounded">VITE_SUPABASE_URL</code> and <code className="text-white bg-red-950/40 px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code> in your hosting settings to enable live accounts.
              </p>
            </div>
          ) : (
            <div className="mt-4 p-3 bg-[var(--color-surface-2)]/60 rounded-xl border border-dashed border-[var(--color-surface-3)] text-[11px] text-[var(--color-text-muted)] text-left">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-[var(--color-text-secondary)]">
                  Local Testing Helper
                </span>
                <span className="text-[10px] text-amber-400 font-medium">Dev Simulation</span>
              </div>
              <p className="mb-2 leading-relaxed">
                No Supabase keys set in <code className="text-white">.env</code>. You can test form submissions, or instant-simulate login below:
              </p>
              <button
                type="button"
                onClick={() => setDemoUser(role)}
                className="w-full py-1.5 px-2.5 rounded-lg bg-[var(--color-surface-3)] hover:bg-[var(--color-surface-3)]/80 text-[var(--color-text-primary)] font-medium transition-colors text-center text-[11px] border border-[oklch(100%_0_0_/_0.06)]"
              >
                ⚡ Instant 1-Click Test Login as {isClub ? 'Club Leader' : 'Student'}
              </button>
            </div>
          )
        )}
      </motion.div>
    </div>
  )
}
