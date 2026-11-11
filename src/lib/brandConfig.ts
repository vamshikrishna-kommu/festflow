import { PRODUCTION_CANONICAL_DOMAIN } from './canonicalUrl'

/**
 * Centralized official FestFlow brand & support contact configuration.
 * All public-facing contact links, legal pages, help desks, and support
 * fallbacks import from this single source of truth.
 */
export const OFFICIAL_CONTACT_EMAIL = 'festflow.events@gmail.com'
export const OFFICIAL_SUPPORT_MAILTO = `mailto:${OFFICIAL_CONTACT_EMAIL}`
export const OFFICIAL_WEBSITE_URL = PRODUCTION_CANONICAL_DOMAIN
export const OFFICIAL_SUPPORT_PHONE = '+91-9876543210'

/**
 * Builds an encoded mailto URL targeting the official FestFlow support inbox.
 */
export function buildOfficialMailto(subject?: string, body?: string): string {
  const params: string[] = []
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`)
  if (body) params.push(`body=${encodeURIComponent(body)}`)
  return params.length > 0
    ? `${OFFICIAL_SUPPORT_MAILTO}?${params.join('&')}`
    : OFFICIAL_SUPPORT_MAILTO
}

/**
 * Normalizes legacy placeholder support addresses stored in localStorage or
 * older DB defaults to the unified official contact email.
 */
export function normalizeSupportEmail(email?: string | null): string {
  const clean = (email || '').trim().toLowerCase()
  if (
    !clean ||
    clean === 'support@festflow.online' ||
    clean === 'clubs@festflow.online' ||
    clean === 'privacy@festflow.online' ||
    clean === 'terms@festflow.online'
  ) {
    return OFFICIAL_CONTACT_EMAIL
  }
  return (email || '').trim()
}

