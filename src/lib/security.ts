// FestFlow Production Security Hardening Utilities (Phase 9)

/**
 * Escapes unsafe HTML characters to prevent Cross-Site Scripting (XSS).
 */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return ''
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Validates that an external link uses a safe protocol (https:// or http://).
 * Strictly rejects javascript:, data:, vbscript:, and relative malicious protocols.
 */
export function validateSafeUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const trimmed = url.trim()
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString()
    }
  } catch {
    // invalid URL format
  }
  return null
}

/**
 * Validates an uploaded file's size and MIME type before processing.
 * Max default size: 5 MB (5,242,880 bytes).
 */
export interface FileValidationResult {
  valid: boolean
  error?: string
}

const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]

export function validateUploadedFile(
  file: File,
  maxSizeBytes = 5 * 1024 * 1024,
  allowedMimes = ALLOWED_IMAGE_MIMES
): FileValidationResult {
  if (!file) {
    return { valid: false, error: 'No file provided.' }
  }

  // 1. File size check
  if (file.size > maxSizeBytes) {
    const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(0)
    return { valid: false, error: `File size exceeds the ${maxMb}MB limit.` }
  }

  // 2. MIME type check
  if (!allowedMimes.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: 'Invalid file format. Only JPG, PNG, WEBP, and PDF files are permitted.',
    }
  }

  // 3. Filename extension check against double-extensions (e.g., invoice.pdf.exe)
  const nameParts = file.name.split('.')
  if (nameParts.length > 2) {
    const dangerousExtensions = ['exe', 'bat', 'sh', 'js', 'html', 'svg', 'php', 'py']
    if (dangerousExtensions.includes(nameParts[nameParts.length - 1].toLowerCase())) {
      return { valid: false, error: 'Executable and script file extensions are strictly prohibited.' }
    }
  }

  return { valid: true }
}

/**
 * Double-click / rapid button submission throttle to prevent replay bursts.
 */
const lastExecutionTimes = new Map<string, number>()

export function checkActionRateLimit(actionKey: string, cooldownMs = 1500): boolean {
  const now = Date.now()
  const lastTime = lastExecutionTimes.get(actionKey) || 0

  if (now - lastTime < cooldownMs) {
    return false // Rate limited (too fast)
  }

  lastExecutionTimes.set(actionKey, now)
  return true // Permitted
}

/**
 * Strict Payment Authoritative Validation Check.
 * Asserts that paid event passes cannot be claimed without backend verified approval.
 */
export function isPaymentAuthoritativeVerified(
  isFree: boolean,
  registrationStatus: string,
  submissionStatus?: string | null,
  ticketIssuedAt?: string | null
): boolean {
  if (isFree) {
    return registrationStatus === 'confirmed'
  }
  // Paid event MUST have organizer approved submission AND ticket issued
  return (
    registrationStatus === 'confirmed' &&
    submissionStatus === 'approved' &&
    Boolean(ticketIssuedAt)
  )
}


