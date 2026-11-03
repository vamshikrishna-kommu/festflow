/**
 * FestFlow Cryptographic QR Token and Hashing Security Module
 * 
 * Enforces 256-bit cryptographically secure randomness (CSPRNG) for all QR tokens
 * and SHA-256 one-way hashing for secure database storage and turnstile lookup.
 */

/**
 * Generates a 256-bit cryptographically secure QR token.
 * Output format: "FFQ_" followed by 64 hexadecimal characters (32 random bytes).
 */
export function generateSecureQrToken(): string {
  const bytes = new Uint8Array(32)
  const gCrypto = typeof crypto !== 'undefined' ? crypto : (globalThis as any).crypto
  if (gCrypto && typeof gCrypto.getRandomValues === 'function') {
    gCrypto.getRandomValues(bytes)
  } else {
    // In Node.js environments where crypto global differs
    try {
      const nodeCrypto = (globalThis as any).process ? (globalThis as any).crypto || null : null
      if (nodeCrypto && typeof nodeCrypto.getRandomValues === 'function') {
        nodeCrypto.getRandomValues(bytes)
      } else {
        throw new Error('No cryptographically secure random number generator (CSPRNG) available.')
      }
    } catch {
      throw new Error('No cryptographically secure random number generator (CSPRNG) available.')
    }
  }

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()

  return `FFQ_${hex}`
}

/**
 * Computes a SHA-256 hex digest of the normalized QR token.
 * Token is normalized via UPPER(TRIM(token)) to guarantee 100% case-insensitive
 * consistency between client scanner, email tokens, and database indexes.
 */
export async function hashQrTokenAsync(token: string): Promise<string> {
  const normalized = token.trim().toUpperCase()
  const gCrypto = typeof crypto !== 'undefined' ? crypto : (globalThis as any).crypto
  if (gCrypto && gCrypto.subtle && gCrypto.subtle.digest) {
    const encoder = new TextEncoder()
    const data = encoder.encode(normalized)
    const hashBuffer = await gCrypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  return syncSha256(normalized)
}

/**
 * Synchronous SHA-256 hasher for simulation modes, turnstile verification, tests, and Node scripts.
 * Pure-JS implementation runs identically and deterministically in all runtimes.
 */
export function hashQrTokenSync(token: string): string {
  const normalized = token.trim().toUpperCase()
  return syncSha256(normalized)
}

/**
 * Validates whether a token conforms to the secure 256-bit QR token format.
 */
export function isSecureQrToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false
  const clean = token.trim()
  // Matches "FFQ_" followed by 64 hex characters (256 bits)
  return /^FFQ_[0-9A-Fa-f]{64}$/.test(clean)
}

/**
 * Checks if a string is a legacy human-readable ticket code (e.g. "FF-12345678" or "TKT-...").
 * Human-readable ticket codes MUST be rejected from turnstile QR scanning.
 */
export function isTicketCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false
  const clean = code.trim().toUpperCase()
  return (
    clean.startsWith('FF-') ||
    clean.startsWith('TKT-') ||
    /^[0-9A-Z]{2,4}-[0-9A-Z]{4,10}/.test(clean)
  )
}

/**
 * Sanitizes and extracts the raw QR bearer token from deep links, URIs, or query strings.
 */
export function cleanQrPayload(raw: string): string {
  if (!raw || typeof raw !== 'string') return ''
  let cleaned = raw.trim()

  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    try {
      const parsed = JSON.parse(cleaned)
      if (parsed.qr_token) return cleanQrPayload(String(parsed.qr_token))
      if (parsed.token) return cleanQrPayload(String(parsed.token))
      if (parsed.qr) return cleanQrPayload(String(parsed.qr))
    } catch {
      // not JSON
    }
  }

  if (cleaned.toLowerCase().startsWith('festflow://pass/')) {
    cleaned = cleaned.substring(16)
  } else if (cleaned.toLowerCase().startsWith('festflow://ticket/')) {
    cleaned = cleaned.substring(18)
  } else if (cleaned.toLowerCase().includes('/pass/')) {
    const idx = cleaned.toLowerCase().indexOf('/pass/')
    cleaned = cleaned.substring(idx + 6)
  } else if (cleaned.toLowerCase().includes('/ticket/')) {
    const idx = cleaned.toLowerCase().indexOf('/ticket/')
    cleaned = cleaned.substring(idx + 8)
  }

  if (cleaned.includes('?')) {
    cleaned = cleaned.split('?')[0]
  }

  cleaned = cleaned.replace(/\/+$/, '')
  return cleaned.trim().toUpperCase()
}

// ── Lightweight Pure-JS SHA-256 for Synchronous Client Simulation ───────────
function syncSha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount))
  }

  const mathPow = Math.pow
  const maxWord = mathPow(2, 32)
  const lengthProperty = 'length'
  let i = 0
  let j = 0
  let result = ''
  const words: number[] = []
  const asciiBitLength = ascii[lengthProperty] * 8

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]

  let candidate = 2
  while (hash.length < 8) {
    let isPrime = true
    for (let factor = 2; factor * factor <= candidate; factor++) {
      if (candidate % factor === 0) {
        isPrime = false
        break
      }
    }
    if (isPrime) {
      hash.push(((mathPow(candidate, 0.5) * maxWord) | 0) >>> 0)
    }
    candidate++
  }

  ascii += '\x80'
  while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00'
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i)
    words[i >> 2] = (words[i >> 2] || 0) | ((j & 0xff) << ((3 - (i % 4)) * 8))
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0
  words[words[lengthProperty]] = asciiBitLength | 0

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16))
    const oldHash = hash.slice(0)
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15]
      const w2 = w[i - 2]
      const a = hash[0]
      const e = hash[4]
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0)
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]))

      hash = [(temp1 + temp2) | 0, a, hash[1], hash[2], (hash[3] + temp1) | 0, e, hash[5], hash[6]]
    }
    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0
    }
  }

  for (i = 0; i < 8; i++) {
    for (let b = 3; b >= 0; b--) {
      const byte = (hash[i] >> (8 * b)) & 0xff
      result += byte.toString(16).padStart(2, '0')
    }
  }
  return result
}
