import { useState } from 'react'
import { motion } from 'motion/react'
import { useAuth } from '@/context/AuthContext'
import type { UserRole } from '@/types'

interface GoogleAuthButtonProps {
  role?: UserRole
  mode?: 'login' | 'signup'
  redirectTo?: string
  onError?: (error: string) => void
  disabled?: boolean
  className?: string
}

export function GoogleAuthButton({
  role = 'student',
  mode = 'login',
  redirectTo,
  onError,
  disabled = false,
  className = '',
}: GoogleAuthButtonProps) {
  const { signInWithGoogle, isLoading: authLoading } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isLoading = isSubmitting || authLoading

  const handleGoogleSignIn = async () => {
    if (isLoading || disabled) return
    setIsSubmitting(true)

    try {
      const res = await signInWithGoogle({
        redirectTo,
        role,
      })

      if (res.error) {
        setIsSubmitting(false)
        if (onError) onError(res.error)
      }
      // If success, Supabase initiates navigation/redirect to Google OAuth consent
    } catch (err) {
      setIsSubmitting(false)
      const msg = err instanceof Error ? err.message : 'Google authentication could not be initialized.'
      if (onError) onError(msg)
    }
  }

  const label = mode === 'signup' ? 'Sign up with Google' : 'Continue with Google'

  return (
    <motion.button
      type="button"
      whileHover={!disabled && !isLoading ? { scale: 1.01 } : undefined}
      whileTap={!disabled && !isLoading ? { scale: 0.99 } : undefined}
      onClick={handleGoogleSignIn}
      disabled={disabled || isLoading}
      aria-label={label}
      className={`relative flex items-center justify-center gap-3 w-full py-2.5 sm:py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 select-none ${
        disabled || isLoading
          ? 'opacity-60 cursor-not-allowed bg-[#14141A] text-zinc-400 border border-white/5'
          : 'bg-[#14141A] text-white border border-white/10 hover:border-[#18CFFC]/50 hover:bg-[#181822] hover:shadow-[0_4px_24px_rgba(24,207,252,0.12)] active:border-[#18CFFC] focus:outline-none focus:ring-2 focus:ring-[#18CFFC]/40 focus:border-[#18CFFC]'
      } ${className}`}
    >
      {/* Official Google G SVG icon */}
      {isLoading ? (
        <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-[#18CFFC] animate-spin shrink-0" />
      ) : (
        <svg
          className="w-5 h-5 shrink-0"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
      )}

      <span>{isLoading ? 'Connecting to Google…' : label}</span>
    </motion.button>
  )
}

export function AuthDivider({ text = 'or continue with email' }: { text?: string }) {
  return (
    <div className="relative my-4 sm:my-5">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-white/[0.08]" />
      </div>
      <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
        <span className="bg-[#0E0E12] px-3 text-[var(--color-text-muted)] font-medium">
          {text}
        </span>
      </div>
    </div>
  )
}
