/**
 * Canonical URL & Domain Configuration for FestFlow
 * Ensures all email links, auth redirects, and share links use the production domain (https://festflow.online)
 * while safely preserving localhost for local development.
 */

export const PRODUCTION_CANONICAL_DOMAIN = 'https://festflow.online'

/**
 * Checks if the current browser environment is running on a local development host.
 */
export function isLocalDevelopment(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname.toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0'
}

/**
 * Returns the canonical frontend application base URL.
 * - In local dev (localhost / 127.0.0.1): returns the active local origin (e.g. http://localhost:5173).
 * - In production, staging, or Vercel preview: ALWAYS returns the canonical https://festflow.online
 *   so that verification emails and share links never point to internal Vercel deployment hashes.
 */
export function getFrontendBaseUrl(): string {
  if (typeof window !== 'undefined') {
    if (isLocalDevelopment()) {
      return window.location.origin
    }
  }
  return PRODUCTION_CANONICAL_DOMAIN
}

/**
 * Generates an absolute URL for authentication callbacks (PKCE exchange).
 * Resolves to https://festflow.online/auth/callback in production.
 */
export function getAuthCallbackUrl(nextPath?: string): string {
  const base = getFrontendBaseUrl()
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base
  if (nextPath) {
    const encodedNext = encodeURIComponent(nextPath.startsWith('/') ? nextPath : `/${nextPath}`)
    return `${cleanBase}/auth/callback?next=${encodedNext}`
  }
  return `${cleanBase}/auth/callback`
}

/**
 * Generates an absolute URL for password reset links.
 * Resolves to https://festflow.online/reset-password in production.
 */
export function getResetPasswordUrl(): string {
  const base = getFrontendBaseUrl()
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base
  return `${cleanBase}/reset-password`
}

/**
 * Safely resolves an application route against the canonical base URL.
 */
export function resolveCanonicalUrl(path: string): string {
  const base = getFrontendBaseUrl()
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${cleanBase}${cleanPath}`
}
