import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router'
import { motion } from 'motion/react'
import { CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Button, Logo } from '@/components/ui'

export function getSafeNextPath(candidate: string | null | undefined, defaultTarget: string): string {
  if (candidate && candidate.startsWith('/') && !candidate.startsWith('//') && !candidate.includes(':')) {
    return candidate
  }
  return defaultTarget
}

export function getTargetWithPendingTeam(candidate: string | null | undefined, defaultTarget: string): string {
  const pendingTeamToken = sessionStorage.getItem('festflow_pending_team_token')
  const pendingJoinCode = sessionStorage.getItem('festflow_pending_join_code')

  if (pendingTeamToken) {
    sessionStorage.removeItem('festflow_pending_team_token')
    return `/join-team?token=${encodeURIComponent(pendingTeamToken)}`
  }
  if (pendingJoinCode) {
    sessionStorage.removeItem('festflow_pending_join_code')
    return `/join-team?code=${encodeURIComponent(pendingJoinCode)}`
  }
  return getSafeNextPath(candidate, defaultTarget)
}

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { refreshProfile, role } = useAuth()

  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    // 1. Check if error was passed in URL query or hash fragment (e.g. invalid or expired token)
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const errorParam = searchParams.get('error') || hashParams.get('error')
    const errorDescription = searchParams.get('error_description') || hashParams.get('error_description')

    if (errorParam || errorDescription) {
      setStatus('error')
      setErrorMessage(errorDescription || errorParam || 'Authentication verification failed. The link may have expired.')
      return
    }

    if (!isSupabaseConfigured) {
      // In simulation mode, simulate instant confirmation
      const timer = setTimeout(() => {
        setStatus('success')
        setTimeout(() => navigate('/discover'), 1200)
      }, 800)
      return () => clearTimeout(timer)
    }

    // 2. Live Supabase Auth: Exchange code if PKCE, or get existing session
    async function processAuth() {
      try {
        const code = searchParams.get('code')
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            setStatus('error')
            setErrorMessage(error.message)
            return
          }
          if (data?.session) {
            await refreshProfile()
            setStatus('success')
            const typeParam = searchParams.get('type') || hashParams.get('type')
            if (typeParam === 'recovery') {
              setTimeout(() => {
                navigate('/reset-password', { replace: true })
              }, 800)
              return
            }

            const rawCandidate = searchParams.get('next') || searchParams.get('redirect') || hashParams.get('next') || hashParams.get('redirect')
            const userRole = (data.session.user.user_metadata?.role as string) || role || 'student'
            const defaultTarget = userRole === 'club_member' ? '/club/dashboard' : '/student/dashboard'
            const target = getTargetWithPendingTeam(rawCandidate, defaultTarget)
            setTimeout(() => {
              navigate(target, { replace: true })
            }, 800)
            return
          }
        }

        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          setStatus('error')
          setErrorMessage(error.message)
          return
        }

        if (session) {
          await refreshProfile()
          setStatus('success')
          
          const typeParam = searchParams.get('type') || hashParams.get('type')
          if (typeParam === 'recovery') {
            setTimeout(() => {
              navigate('/reset-password', { replace: true })
            }, 800)
            return
          }

          // Role-based redirect
          const rawCandidate = searchParams.get('next') || searchParams.get('redirect') || hashParams.get('next') || hashParams.get('redirect')
          const userRole = (session.user.user_metadata?.role as string) || role || 'student'
          const defaultTarget = userRole === 'club_member' ? '/club/dashboard' : '/student/dashboard'
          const target = getTargetWithPendingTeam(rawCandidate, defaultTarget)
          
          setTimeout(() => {
            navigate(target, { replace: true })
          }, 800)
        } else {
          // Listen for onAuthStateChange in case hash fragment is still being processed
          const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            if ((event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY') && currentSession) {
              await refreshProfile()
              setStatus('success')
              if (event === 'PASSWORD_RECOVERY' || (searchParams.get('type') || hashParams.get('type')) === 'recovery') {
                navigate('/reset-password', { replace: true })
                return
              }
              const candidate = searchParams.get('next') || searchParams.get('redirect') || hashParams.get('next') || hashParams.get('redirect')
              const userRole = (currentSession.user.user_metadata?.role as string) || 'student'
              const defaultTarget = userRole === 'club_member' ? '/club/dashboard' : '/student/dashboard'
              const target = getTargetWithPendingTeam(candidate, defaultTarget)
              navigate(target, { replace: true })
            }
          })

          // Timeout fallback if no session detected after 4 seconds
          const timeout = setTimeout(() => {
            subscription.unsubscribe()
            if (status === 'processing') {
              setStatus('success')
              navigate('/student/login')
            }
          }, 4000)

          return () => {
            subscription.unsubscribe()
            clearTimeout(timeout)
          }
        }
      } catch (err) {
        setStatus('error')
        setErrorMessage(err instanceof Error ? err.message : 'Failed to finalize session.')
      }
    }

    processAuth()
  }, [navigate, searchParams, refreshProfile, role, status])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-0)] px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md p-8 glass rounded-[var(--radius-card)] border border-[oklch(100%_0_0_/_0.1)] text-center shadow-2xl"
      >
        <div className="flex justify-center mb-6">
          <Link to="/" aria-label="FestFlow home">
            <Logo variant="auth" />
          </Link>
        </div>

        {status === 'processing' && (
          <div className="space-y-4">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--color-surface-3)] border-t-[#18CFFC] animate-spin mx-auto" />
            <h1 className="text-xl font-bold font-display text-[var(--color-text-primary)]">
              Verifying Your Account
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Completing secure authentication and setting up your workspace…
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <CheckCircle2 size={48} className="text-emerald-400 mx-auto" />
            <h1 className="text-xl font-bold font-display text-[var(--color-text-primary)]">
              Verification Confirmed!
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Welcome to FestFlow! Redirecting you to your account…
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-5">
            <AlertTriangle size={48} className="text-red-400 mx-auto" />
            <h1 className="text-xl font-bold font-display text-[var(--color-text-primary)]">
              Verification Notice
            </h1>
            <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-200">
              {errorMessage || 'The verification link may have expired or was already used.'}
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Link to="/student/login">
                <Button variant="primary" className="w-full">
                  Sign In to FestFlow <ArrowRight size={15} />
                </Button>
              </Link>
              <Link to="/discover">
                <Button variant="ghost" className="w-full">
                  Explore Campus Events
                </Button>
              </Link>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
