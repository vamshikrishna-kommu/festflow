import type { RegistrationWithEvent } from '@/types'

export const TICKET_CACHE_PREFIX = 'festflow_cached_ticket_'
export const PASSES_CACHE_PREFIX = 'festflow_cached_passes_'
export const OFFLINE_PASS_STORAGE_KEY = 'festflow_offline_cached_passes'
export const CACHE_OWNER_KEY = 'festflow_cache_owner_uid'
export const SESSION_PASS_PREFIX = 'festflow_session_pass_'

const SESSION_PASS_TTL_MS = 12 * 60 * 60 * 1000 // 12 hours max in-session pass validity

interface SanitizedTicketCacheEntry {
  owner_user_id: string
  cached_at: string
  registration: RegistrationWithEvent
}

interface SessionPassEntry {
  userId: string
  registrationId: string
  qrToken: string
  expiresAt: number
}

function getLocalStore(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

function getSessionStore(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null
  } catch {
    return null
  }
}

function removePrefixedKeys(store: Storage | null, prefixes: string[], exactKeys: string[] = []): void {
  if (!store) return
  try {
    const keysToRemove: string[] = [...exactKeys]
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i)
      if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => {
      try {
        store.removeItem(key)
      } catch {
        // ignore individual removal failure
      }
    })
  } catch {
    // ignore storage enumeration issues
  }
}

/**
 * Strips bearer credentials (`qr_token`, `qr_token_hash`) before writing to persistent localStorage.
 * Ensures stolen or leftover browser storage cannot replay static bearer tokens across sessions.
 */
export function sanitizeRegistrationForCache<T extends Record<string, any>>(
  reg: T
): Omit<T, 'qr_token' | 'qr_token_hash'> {
  const { qr_token: _rawQr, qr_token_hash: _rawHash, ...safeFields } = reg
  return safeFields
}

/**
 * Clears all user-specific ticket and pass caches from both localStorage and sessionStorage.
 * Invoked unconditionally on sign-out, account switch, or unauthenticated state.
 */
export function clearAllUserTicketCaches(): void {
  removePrefixedKeys(
    getLocalStore(),
    [TICKET_CACHE_PREFIX, PASSES_CACHE_PREFIX],
    [OFFLINE_PASS_STORAGE_KEY, CACHE_OWNER_KEY]
  )
  removePrefixedKeys(
    getSessionStore(),
    [SESSION_PASS_PREFIX],
    ['festflow_preferred_club_id']
  )
}

/**
 * Enforces single-account isolation across browser storage.
 * If another user was previously active (or unattributed caches belong to another account),
 * wipes all prior cached passes/tickets before recording the new owner.
 */
export function reconcileTicketCacheOwner(nextUserId: string | null | undefined): void {
  if (!nextUserId) {
    clearAllUserTicketCaches()
    return
  }

  const localStore = getLocalStore()
  if (!localStore) return

  try {
    const previousOwner = localStore.getItem(CACHE_OWNER_KEY)
    if (previousOwner && previousOwner !== nextUserId) {
      clearAllUserTicketCaches()
    } else if (!previousOwner) {
      // Scrub legacy caches belonging to another account or lacking owner tagging
      let mismatchDetected = false
      for (let i = 0; i < localStore.length; i++) {
        const key = localStore.key(i)
        if (!key) continue
        if (key.startsWith(PASSES_CACHE_PREFIX) && key !== `${PASSES_CACHE_PREFIX}${nextUserId}`) {
          mismatchDetected = true
          break
        }
        if (key.startsWith(TICKET_CACHE_PREFIX)) {
          const raw = localStore.getItem(key)
          if (raw) {
            const parsed = JSON.parse(raw)
            const studentId = parsed?.registration?.student_id ?? parsed?.student_id
            if (studentId && studentId !== nextUserId) {
              mismatchDetected = true
              break
            }
          }
        }
      }
      if (mismatchDetected) {
        clearAllUserTicketCaches()
      }
    }

    localStore.setItem(CACHE_OWNER_KEY, nextUserId)
  } catch {
    // ignore storage access issues
  }
}

/**
 * Caches ticket metadata without persisting plaintext bearer `qr_token` in localStorage.
 * Stores active confirmed pass token only in ephemeral, user-scoped sessionStorage (with TTL)
 * so short in-session offline cellular drops preserve ticket rendering cleanly.
 */
export function writeCachedTicket(
  registration: RegistrationWithEvent,
  activeUserId?: string | null
): void {
  const ownerId = activeUserId || registration.student_id
  if (!ownerId || !registration.id) return

  reconcileTicketCacheOwner(ownerId)

  const localStore = getLocalStore()
  if (localStore) {
    try {
      const sanitized = sanitizeRegistrationForCache(registration) as RegistrationWithEvent
      const payload: SanitizedTicketCacheEntry = {
        owner_user_id: ownerId,
        cached_at: new Date().toISOString(),
        registration: sanitized,
      }
      localStore.setItem(`${TICKET_CACHE_PREFIX}${registration.id}`, JSON.stringify(payload))
    } catch {
      // ignore quota failures
    }
  }

  const sessionStore = getSessionStore()
  const rawQrToken = typeof (registration as any).qr_token === 'string' ? (registration as any).qr_token.trim() : ''
  const isConfirmed = registration.status === 'confirmed' && Boolean(registration.ticket_issued_at)

  if (sessionStore && rawQrToken && isConfirmed) {
    try {
      const sessionPayload: SessionPassEntry = {
        userId: ownerId,
        registrationId: registration.id,
        qrToken: rawQrToken,
        expiresAt: Date.now() + SESSION_PASS_TTL_MS,
      }
      sessionStore.setItem(
        `${SESSION_PASS_PREFIX}${ownerId}_${registration.id}`,
        JSON.stringify(sessionPayload)
      )
    } catch {
      // ignore sessionStorage errors
    }
  }
}

/**
 * Reads cached offline ticket for the active user only.
 * Enforces owner match, upgrades/scrubs any legacy persistent plaintext `qr_token`, and
 * hydrates `qr_token` strictly from active-session `sessionStorage` when non-expired.
 */
export function readCachedTicket(
  registrationId: string,
  activeUserId?: string | null,
  isPlatformAdmin = false
): { registration: RegistrationWithEvent | null; unauthorized: boolean } {
  if (!activeUserId) {
    clearAllUserTicketCaches()
    return { registration: null, unauthorized: true }
  }

  reconcileTicketCacheOwner(activeUserId)

  const localStore = getLocalStore()
  if (!localStore) return { registration: null, unauthorized: false }

  try {
    const cacheKey = `${TICKET_CACHE_PREFIX}${registrationId}`
    const raw = localStore.getItem(cacheKey)
    if (!raw) return { registration: null, unauthorized: false }

    const parsed = JSON.parse(raw)
    const isWrapped = parsed && typeof parsed === 'object' && 'registration' in parsed && 'owner_user_id' in parsed
    const ownerId: string | undefined = isWrapped ? parsed.owner_user_id : parsed?.student_id
    const regObj: RegistrationWithEvent | null = isWrapped ? parsed.registration : parsed

    if (!regObj || (!isPlatformAdmin && regObj.student_id !== activeUserId && ownerId !== activeUserId)) {
      clearAllUserTicketCaches()
      return { registration: null, unauthorized: true }
    }

    const sanitized = sanitizeRegistrationForCache(regObj) as RegistrationWithEvent

    // Scrub legacy plaintext persistent cache entries immediately if encountered
    if (!isWrapped || 'qr_token' in (regObj as any) || 'qr_token_hash' in (regObj as any)) {
      try {
        const cleanedEntry: SanitizedTicketCacheEntry = {
          owner_user_id: activeUserId,
          cached_at: isWrapped && parsed.cached_at ? parsed.cached_at : new Date().toISOString(),
          registration: sanitized,
        }
        localStore.setItem(cacheKey, JSON.stringify(cleanedEntry))
      } catch {
        // ignore rewrite error
      }
    }

    // Hydrate bearer token only from ephemeral user-scoped sessionStorage if non-expired
    const sessionStore = getSessionStore()
    if (sessionStore) {
      const sessionKey = `${SESSION_PASS_PREFIX}${ownerId || activeUserId}_${registrationId}`
      const rawSession = sessionStore.getItem(sessionKey)
      if (rawSession) {
        try {
          const entry = JSON.parse(rawSession) as SessionPassEntry
          const ownerMatches = entry.userId === activeUserId || (isPlatformAdmin && entry.userId === ownerId)
          if (ownerMatches && entry.registrationId === registrationId && entry.expiresAt > Date.now() && entry.qrToken) {
            return {
              registration: { ...sanitized, qr_token: entry.qrToken } as RegistrationWithEvent,
              unauthorized: false,
            }
          }
          sessionStore.removeItem(sessionKey)
        } catch {
          sessionStore.removeItem(sessionKey)
        }
      }
    }

    return { registration: sanitized, unauthorized: false }
  } catch {
    return { registration: null, unauthorized: false }
  }
}

/**
 * Caches a student's sanitized registration summary list in user-keyed localStorage.
 */
export function writeCachedStudentPasses(
  userId: string,
  registrations: RegistrationWithEvent[]
): void {
  if (!userId) return
  reconcileTicketCacheOwner(userId)

  const localStore = getLocalStore()
  if (!localStore) return

  try {
    const sanitizedList = registrations.map((r) => sanitizeRegistrationForCache(r))
    localStore.setItem(`${PASSES_CACHE_PREFIX}${userId}`, JSON.stringify(sanitizedList))
  } catch {
    // ignore quota errors
  }
}

/**
 * Reads cached student registration summaries strictly for the active user.
 */
export function readCachedStudentPasses(userId: string): RegistrationWithEvent[] | null {
  if (!userId) return null
  reconcileTicketCacheOwner(userId)

  const localStore = getLocalStore()
  if (!localStore) return null

  try {
    const raw = localStore.getItem(`${PASSES_CACHE_PREFIX}${userId}`)
    if (!raw) return null
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return null
    return list
      .filter((r) => r && r.student_id === userId)
      .map((r) => sanitizeRegistrationForCache(r) as RegistrationWithEvent)
  } catch {
    return null
  }
}

