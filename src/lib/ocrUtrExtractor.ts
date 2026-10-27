/**
 * FestFlow Intelligent OCR & Transaction Reference (UTR/RRN) Extraction Engine.
 * 
 * Secure client-side extraction using lazy-loaded Tesseract.js in a Web Worker.
 * Preserves student privacy by running 100% in-browser without sending receipts
 * to external OCR APIs.
 */

export interface OcrExtractionResult {
  success: boolean
  reference: string | null
  confidence: number // 0 to 1
  labelMatched?: string
  rawCandidate?: string
  message: string
  allCandidates?: string[]
}

export type OcrProgressCallback = (progress: number, statusText: string) => void

// High-confidence label patterns specifically denoting UPI interbank transaction references
const UTR_LABEL_PATTERNS = [
  { regex: /upi\s*(?:trans(?:action)?|txn)?\s*(?:id|ref(?:erence)?(?:\s*no\.?)?|number)/i, label: 'UPI Ref/Txn ID', weight: 0.95 },
  { regex: /\butr\b(?:\s*(?:no\.?|num(?:ber)?|id))?/i, label: 'UTR', weight: 0.98 },
  { regex: /\brrn\b(?:\s*(?:no\.?|num(?:ber)?|id))?/i, label: 'RRN', weight: 0.95 },
  { regex: /bank\s*(?:ref(?:erence)?(?:\s*no\.?)?|reference\s*num(?:ber)?|txn\s*id)/i, label: 'Bank Ref No', weight: 0.92 },
  { regex: /transaction\s*(?:ref(?:erence)?(?:\s*no\.?)?|reference\s*num(?:ber)?)/i, label: 'Transaction Ref', weight: 0.88 },
  { regex: /\bref(?:erence)?\s*(?:no\.?|number|id)\b/i, label: 'Ref No', weight: 0.82 },
]

// Patterns that identify NON-UTR data to prevent false positives
const AMOUNT_PATTERN = /(?:₹|rs\.?|inr)\s*[\d,]+(?:\.\d{1,2})?|[\d,]+\.\d{2}/i
const PHONE_PATTERN = /(?:\+91[\s-]?)?[6-9]\d{9}/
const ACCOUNT_PATTERN = /(?:a\/c|account|acct)[\s.:#]*[\dXx*]+/i

/**
 * Normalizes text to extract candidate 12-digit UPI references (NPCI standard)
 * or alphanumeric provider references.
 */
function cleanReferenceCandidate(raw: string): string {
  // Strip whitespace and common punctuation often injected by OCR (dashes, dots, colons)
  return raw.replace(/[\s\-.:]/g, '').trim()
}

/**
 * Checks if a string looks like a genuine UPI transaction reference (12 digits, or 10-18 alphanumeric)
 */
function isValidReferenceFormat(candidate: string): boolean {
  if (!candidate) return false
  const clean = cleanReferenceCandidate(candidate)
  
  // Standard NPCI UPI UTR is strictly 12 digits (starts with year/day offset, e.g. 4289... or 5123...)
  if (/^\d{12}$/.test(clean)) {
    return true
  }

  // Some apps (e.g. PhonePe internal transaction reference or bank specific) may use 10-18 alphanumeric chars
  if (/^[a-zA-Z0-9]{10,22}$/.test(clean) && /\d{4,}/.test(clean)) {
    return true
  }

  return false
}

/**
 * Parses OCR recognized text line-by-line using contextual label scoring.
 */
export function extractUtrFromText(recognizedText: string): OcrExtractionResult {
  if (!recognizedText || !recognizedText.trim()) {
    return {
      success: false,
      reference: null,
      confidence: 0,
      message: 'No readable text could be recognized from the image.',
    }
  }

  const lines = recognizedText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  interface ScoredCandidate {
    value: string
    label: string
    confidence: number
    rawLine: string
  }

  const scoredCandidates: ScoredCandidate[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Check for label matches
    for (const { regex, label, weight } of UTR_LABEL_PATTERNS) {
      if (regex.test(line)) {
        // Strategy A: Reference on the SAME line after label (e.g., "UTR: 428910485923")
        const labelMatch = line.match(regex)
        if (labelMatch) {
          const afterLabel = line.substring(labelMatch.index! + labelMatch[0].length)
          
          // Look for 12 digits (with optional spaces/dashes) in the remainder of this line
          const sameLineDigits = afterLabel.match(/(?:\d[\s\-.:]?){11,16}\d/)
          if (sameLineDigits) {
            const clean = cleanReferenceCandidate(sameLineDigits[0])
            if (/^\d{12}$/.test(clean)) {
              scoredCandidates.push({
                value: clean,
                label,
                confidence: weight,
                rawLine: line,
              })
            }
          }

          // Alphanumeric reference on same line (e.g. "UPI Ref: T240128123456789012")
          const sameLineAlpha = afterLabel.match(/[a-zA-Z0-9]{10,22}/)
          if (sameLineAlpha && isValidReferenceFormat(sameLineAlpha[0])) {
            const clean = cleanReferenceCandidate(sameLineAlpha[0])
            scoredCandidates.push({
              value: clean,
              label,
              confidence: weight * 0.9,
              rawLine: line,
            })
          }
        }

        // Strategy B: Reference on the NEXT line (e.g. line i: "UPI transaction ID", line i+1: "428910485923")
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1]
          
          // Look for 12 digits on next line
          const nextLineDigits = nextLine.match(/(?:\d[\s\-.:]?){11,16}\d/)
          if (nextLineDigits) {
            const clean = cleanReferenceCandidate(nextLineDigits[0])
            if (/^\d{12}$/.test(clean)) {
              scoredCandidates.push({
                value: clean,
                label: `${label} (next line)`,
                confidence: weight * 0.92,
                rawLine: nextLine,
              })
            }
          }

          const nextLineAlpha = nextLine.match(/[a-zA-Z0-9]{10,22}/)
          if (nextLineAlpha && isValidReferenceFormat(nextLineAlpha[0])) {
            const clean = cleanReferenceCandidate(nextLineAlpha[0])
            // Ensure next line is not an account number, phone, or date
            if (!ACCOUNT_PATTERN.test(nextLine) && !AMOUNT_PATTERN.test(nextLine)) {
              scoredCandidates.push({
                value: clean,
                label: `${label} (next line)`,
                confidence: weight * 0.85,
                rawLine: nextLine,
              })
            }
          }
        }
      }
    }
  }

  // Strategy C: If no label-bound candidate was found, search for standalone 12-digit numbers
  // that are NOT phone numbers, account numbers, or timestamps
  if (scoredCandidates.length === 0) {
    for (const line of lines) {
      // Discard lines that clearly describe money, dates, or contact info
      if (AMOUNT_PATTERN.test(line) || ACCOUNT_PATTERN.test(line)) {
        continue
      }

      // Check for standalone 12 digits
      const digits12Match = line.match(/\b\d{12}\b/)
      if (digits12Match) {
        const val = digits12Match[0]
        // Filter out Indian 10-digit mobile numbers with 2-digit prefixes if misidentified
        if (!PHONE_PATTERN.test(line)) {
          scoredCandidates.push({
            value: val,
            label: '12-digit transaction candidate',
            confidence: 0.65,
            rawLine: line,
          })
        }
      }
    }
  }

  if (scoredCandidates.length === 0) {
    return {
      success: false,
      reference: null,
      confidence: 0,
      message: 'Could not confidently detect the UTR. Please enter it manually.',
    }
  }

  // Sort by highest confidence score
  scoredCandidates.sort((a, b) => b.confidence - a.confidence)
  const best = scoredCandidates[0]

  if (best.confidence < 0.6) {
    return {
      success: false,
      reference: null,
      confidence: best.confidence,
      message: 'Could not confidently detect the UTR. Please enter it manually.',
      allCandidates: scoredCandidates.map((c) => c.value),
    }
  }

  return {
    success: true,
    reference: best.value,
    confidence: best.confidence,
    labelMatched: best.label,
    rawCandidate: best.rawLine,
    message: 'Reference detected — please verify it.',
    allCandidates: Array.from(new Set(scoredCandidates.map((c) => c.value))),
  }
}

/**
 * Runs Tesseract client-side OCR on an image File or Blob with timeout safety and progress feedback.
 */
export async function extractUtrFromImageFile(
  file: File | Blob,
  onProgress?: OcrProgressCallback
): Promise<OcrExtractionResult> {
  let worker: any = null

  // Create timeout promise to avoid freezing on corrupt images
  const timeoutMs = 30000
  let timeoutId: any

  const timeoutPromise = new Promise<OcrExtractionResult>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('OCR extraction timed out after 30 seconds.'))
    }, timeoutMs)
  })

  const ocrPromise = (async (): Promise<OcrExtractionResult> => {
    try {
      onProgress?.(0.1, 'Initializing OCR engine…')

      // Dynamically import tesseract.js to avoid bundling heavy WASM on initial page load
      const { createWorker } = await import('tesseract.js')
      
      onProgress?.(0.25, 'Loading language data…')
      worker = await createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            const mapped = 0.3 + (m.progress || 0) * 0.65
            onProgress?.(mapped, `Scanning receipt text (${Math.round((m.progress || 0) * 100)}%)…`)
          }
        },
      })

      onProgress?.(0.85, 'Analyzing payment reference patterns…')
      const result = await worker.recognize(file)
      const text = result?.data?.text || ''

      onProgress?.(0.98, 'Matching transaction reference…')
      const parsed = extractUtrFromText(text)
      return parsed
    } finally {
      if (worker) {
        try {
          await worker.terminate()
        } catch {
          // Ignore worker termination cleanup issues
        }
      }
    }
  })()

  try {
    const res = await Promise.race([ocrPromise, timeoutPromise])
    clearTimeout(timeoutId)
    return res
  } catch (err) {
    clearTimeout(timeoutId)
    console.warn('[FestFlow OCR] Extraction notice:', err)
    return {
      success: false,
      reference: null,
      confidence: 0,
      message: 'Could not confidently detect the UTR. Please enter it manually.',
    }
  }
}
