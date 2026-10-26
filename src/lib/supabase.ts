import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/**
 * Safely cleans environment variable values by stripping extra whitespace
 * and any accidental wrapping quotes (' or ") that beginners often paste.
 */
function cleanEnv(val: unknown): string | undefined {
  if (typeof val !== 'string') return undefined
  let trimmed = val.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim()
  }
  return trimmed || undefined
}

const rawUrl = cleanEnv(
  import.meta.env?.VITE_SUPABASE_URL ??
  import.meta.env?.VITE_PUBLIC_SUPABASE_URL ??
  (typeof globalThis !== 'undefined' ? (globalThis as any).process?.env?.VITE_SUPABASE_URL : undefined)
)

// Check VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_PUBLISHABLE_KEY, and VITE_PUBLIC_SUPABASE_ANON_KEY
const rawKey = cleanEnv(
  import.meta.env?.VITE_SUPABASE_ANON_KEY ??
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env?.VITE_PUBLIC_SUPABASE_ANON_KEY ??
  (typeof globalThis !== 'undefined' ? (globalThis as any).process?.env?.VITE_SUPABASE_ANON_KEY : undefined)
)

const isPlaceholder = (val?: string) => {
  if (!val) return true
  const lower = val.toLowerCase()
  return (
    lower === 'your-anon-key-here' ||
    lower === 'placeholder-anon-key' ||
    lower.includes('your-anon-key') ||
    lower.includes('your-project-ref')
  )
}

export const isProduction = Boolean(import.meta.env?.PROD)

export const isSupabaseConfigured = Boolean(
  rawUrl &&
  rawKey &&
  !isPlaceholder(rawUrl) &&
  !isPlaceholder(rawKey) &&
  rawUrl.startsWith('https://') &&
  rawKey.length > 20
)

export const isProductionMissingCredentials = isProduction && !isSupabaseConfigured

if (!isSupabaseConfigured) {
  if (isProduction) {
    console.error(
      '[FestFlow CRITICAL] Deployed in PRODUCTION mode but Supabase credentials (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are missing or invalid. ' +
      'Real authentication, payments, and event entry are disabled to prevent data corruption. Configure environment variables in your deployment dashboard.'
    )
  } else {
    const missing: string[] = []
    if (!rawUrl || isPlaceholder(rawUrl)) missing.push('VITE_SUPABASE_URL')
    if (!rawKey || isPlaceholder(rawKey)) missing.push('VITE_SUPABASE_ANON_KEY')

    console.info(
      `[FestFlow] Running in Simulation Mode because the following are not configured in your .env: ${missing.join(', ')}.`
    )
  }
}

const supabaseUrl = isSupabaseConfigured ? rawUrl! : 'https://placeholder-festflow.supabase.co'
const supabaseAnonKey = isSupabaseConfigured ? rawKey! : 'placeholder-anon-key'

/**
 * Supabase browser client.
 * Uses only the anon key — never expose service-role keys in frontend code.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
