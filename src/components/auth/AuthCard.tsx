import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { motion } from 'motion/react'
import { Building2, GraduationCap, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react'
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
    <div className="min-h-screen w-full flex items-center justify-center px-4 sm:px-6 lg:px-8 py-10 sm:py-16 relative bg-[#F7F8FA]">
      <div className="w-full max-w-4xl mx-auto my-auto relative z-10 min-w-0">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="w-full rounded-2xl border border-gray-200 bg-white shadow-[0_20px_50px_-15px_rgba(17,24,39,0.08)] overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-w-0"
        >
          {/* Left branding panel — desktop */}
          <div className="hidden lg:flex lg:col-span-5 flex-col justify-between p-8 sm:p-10 border-r border-gray-200 text-left bg-gray-50/70">
            <div>
              <Link to="/" className="inline-flex items-center mb-8" aria-label="FestFlow home">
                <Logo variant="navbar" />
              </Link>

              <div className="space-y-6">
                <div>
                  <h2 className="font-display font-bold text-xl text-gray-900 mb-2">
                    {isClub ? 'Campus Club Management' : 'All Your Campus Passes'}
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                    {isClub
                      ? 'Create events, manage registrations, coordinate team roles, and verify UPI transactions directly.'
                      : 'Discover campus hackathons, symposiums, and cultural fests with automated digital passes.'}
                  </p>
                </div>

                <div className="space-y-3.5 pt-2">
                  {[
                    '0% platform fee for college events',
                    'Digital QR passes for campus entry',
                    'Direct UPI collection to club accounts',
                  ].map((text) => (
                    <div key={text} className="flex items-center gap-2.5 text-xs text-gray-700 font-medium">
                      <CheckCircle2 size={15} className="text-blue-600 shrink-0" />
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 pt-8">
              Built for college clubs and student communities.
            </p>
          </div>

          {/* Right form panel */}
          <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-center text-left w-full min-w-0 bg-white">
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
            <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl mb-6 border border-gray-200 gap-1">
              <Link
                to={mode === 'login' ? `/student/login${search}` : `/student/signup${search}`}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 rounded-lg text-xs font-semibold transition-all ${
                  !isClub
                    ? 'bg-white text-gray-900 shadow-xs border border-gray-200/80'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <GraduationCap size={14} className={!isClub ? 'text-blue-600 shrink-0' : 'shrink-0'} />
                <span className="truncate">Student</span>
              </Link>
              <Link
                to={mode === 'login' ? `/club/login${search}` : `/club/signup${search}`}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 rounded-lg text-xs font-semibold transition-all ${
                  isClub
                    ? 'bg-white text-gray-900 shadow-xs border border-gray-200/80'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Building2 size={14} className={isClub ? 'text-blue-600 shrink-0' : 'shrink-0'} />
                <span className="truncate">Club Organizer</span>
              </Link>
            </div>

            {/* Title */}
            <div className="mb-6">
              <h1 className="font-display font-bold text-xl sm:text-2xl text-gray-900 tracking-tight break-words">
                {title}
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1.5 leading-relaxed">
                {subtitle}
              </p>
            </div>

            {/* Form Inputs & Submission */}
            {children}

            {/* Mode Switcher Link */}
            <div className="mt-6 pt-5 border-t border-gray-100 text-center text-xs text-gray-600">
              {mode === 'login' ? (
                <p>
                  Don&apos;t have an account?{' '}
                  <Link
                    to={isClub ? `/club/signup${search}` : `/student/signup${search}`}
                    className="font-semibold text-blue-600 hover:text-blue-700 hover:underline ml-1 transition-colors"
                  >
                    Sign up as {isClub ? 'Club' : 'Student'}
                  </Link>
                </p>
              ) : (
                <p>
                  Already registered?{' '}
                  <Link
                    to={isClub ? `/club/login${search}` : `/student/login${search}`}
                    className="font-semibold text-blue-600 hover:text-blue-700 hover:underline ml-1 transition-colors"
                  >
                    Sign in
                  </Link>
                </p>
              )}
            </div>

            {/* Production missing credentials warning */}
            {!isConfigured && isProduction && (
              <div className="mt-4 p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-900">
                <div className="flex items-center gap-2 mb-1 font-semibold text-rose-700">
                  <AlertTriangle size={13} />
                  <span>Production Configuration Error</span>
                </div>
                <p className="text-[11px] text-rose-700/90 leading-relaxed">
                  Configure <code className="text-rose-900 bg-rose-100 px-1 rounded">VITE_SUPABASE_URL</code> and{' '}
                  <code className="text-rose-900 bg-rose-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> in your deployment dashboard.
                </p>
              </div>
            )}

            {/* Local testing helper */}
            {isLocalDev && (
              <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-[11px] text-gray-600">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                    <Sparkles size={11} className="text-blue-600" /> Local Testing Helper
                  </span>
                  <span className="text-[10px] text-amber-700 font-medium">Dev Simulation</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDemoUser(role)}
                  className="w-full mt-1.5 py-2 px-3 rounded-lg bg-white hover:bg-gray-100 text-gray-900 font-semibold transition-colors text-center text-xs border border-gray-200 shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
                >
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
