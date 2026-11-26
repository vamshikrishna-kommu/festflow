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
  const { refreshProfile } = useAuth()

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

            const storedNext = sessionStorage.getItem('festflow_oauth_next')
            if (storedNext) sessionStorage.removeItem('festflow_oauth_next')

            const rawCandidate =
              searchParams.get('next') ||
              searchParams.get('redirect') ||
              hashParams.get('next') ||
              hashParams.get('redirect') ||
              storedNext

            // Look up database profile role and active club memberships (never trust editable user_metadata.role)
            let userRole = 'student'
            let hasActiveClubAccess = false
            try {
              const { data: pRec } = await (supabase.from('profiles') as any)
                .select('role')
                .eq('id', data.session.user.id)
                .maybeSingle()
              if (pRec?.role) userRole = pRec.role as string

              if (userRole !== 'club_member') {
                const { data: mRec } = await (supabase.from('club_members') as any)
                  .select('id')
                  .eq('user_id', data.session.user.id)
                  .eq('status', 'active')
                  .limit(1)
                hasActiveClubAccess = Boolean(mRec && mRec.length > 0)
              }
            } catch {
              // Fail safe to student workspace if role lookup fails
              userRole = 'student'
            }

            const defaultTarget =
              userRole === 'platform_admin'
                ? '/admin'
                : userRole === 'club_member' || hasActiveClubAccess
                ? '/club/dashboard'
                : '/student/dashboard'
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

          const storedNext = sessionStorage.getItem('festflow_oauth_next')
          if (storedNext) sessionStorage.removeItem('festflow_oauth_next')

          const rawCandidate =
            searchParams.get('next') ||
            searchParams.get('redirect') ||
            hashParams.get('next') ||
            hashParams.get('redirect') ||
            storedNext

          let userRole = 'student'
          let hasActiveClubAccess = false
          try {
            const { data: pRec } = await (supabase.from('profiles') as any)
              .select('role')
              .eq('id', session.user.id)
              .maybeSingle()
            if (pRec?.role) userRole = pRec.role as string

            if (userRole !== 'club_member') {
              const { data: mRec } = await (supabase.from('club_members') as any)
                .select('id')
                .eq('user_id', session.user.id)
                .eq('status', 'active')
                .limit(1)
              hasActiveClubAccess = Boolean(mRec && mRec.length > 0)
            }
          } catch {
            userRole = 'student'
          }

          const defaultTarget =
            userRole === 'platform_admin'
              ? '/admin'
              : userRole === 'club_member' || hasActiveClubAccess
              ? '/club/dashboard'
              : '/student/dashboard'
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
              let userRole = 'student'
              let hasActiveClubAccess = false
              try {
                const { data: pRec } = await (supabase.from('profiles') as any)
                  .select('role')
                  .eq('id', currentSession.user.id)
                  .maybeSingle()
                if (pRec?.role) userRole = pRec.role as string

                if (userRole !== 'club_member') {
                  const { data: mRec } = await (supabase.from('club_members') as any)
                    .select('id')
                    .eq('user_id', currentSession.user.id)
                    .eq('status', 'active')
                    .limit(1)
                  hasActiveClubAccess = Boolean(mRec && mRec.length > 0)
                }
              } catch {
                userRole = 'student'
              }
              const defaultTarget =
                userRole === 'platform_admin'
                  ? '/admin'
                  : userRole === 'club_member' || hasActiveClubAccess
                  ? '/club/dashboard'
                  : '/student/dashboard'
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
  }, [navigate, searchParams, refreshProfile, status])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA] px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md p-8 bg-white rounded-2xl border border-gray-200 text-center shadow-lg"
      >
        <div className="flex justify-center mb-6">
          <Link to="/" aria-label="FestFlow home">
            <Logo variant="auth" />
          </Link>
        </div>

        {status === 'processing' && (
          <div className="space-y-4">
            <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin mx-auto" />
            <h1 className="text-xl font-bold font-display text-gray-900">
              Verifying Your Account
            </h1>
            <p className="text-sm text-gray-600">
              Completing secure authentication and setting up your workspace…
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <CheckCircle2 size={44} className="text-emerald-600 mx-auto" />
            <h1 className="text-xl font-bold font-display text-gray-900">
              Verification Confirmed!
            </h1>
            <p className="text-sm text-gray-600">
              Welcome to FestFlow! Redirecting you to your account…
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-5">
            <AlertTriangle size={44} className="text-rose-600 mx-auto" />
            <h1 className="text-xl font-bold font-display text-gray-900">
              Verification Notice
            </h1>
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
              {errorMessage || 'The verification link may have expired or was already used.'}
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Link to="/student/login">
                <Button variant="primary" className="w-full" rightIcon={<ArrowRight size={15} />}>
                  Sign In to FestFlow
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
