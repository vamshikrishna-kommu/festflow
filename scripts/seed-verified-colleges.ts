// =============================================================================
// FESTFLOW — REPEATABLE SEED & IMPORT PIPELINE FOR VERIFIED COLLEGE DIRECTORY
// =============================================================================
// Reads from AUTHENTIC_SEED_COLLEGES (or CSV), validates all records, detects
// duplicates (by AISHE code and normalized name), and idempotently seeds either
// the live Supabase instance (if env vars provided) or the local storage cache.
//
// Usage:
//   npx tsx scripts/seed-verified-colleges.ts [--dry-run]
// =============================================================================

// Mock browser environment for Node.js
const memoryStorage: Record<string, string> = {}
;(globalThis as any).localStorage = {
  getItem: (key: string) => memoryStorage[key] || null,
  setItem: (key: string, val: string) => {
    memoryStorage[key] = String(val)
  },
  removeItem: (key: string) => {
    delete memoryStorage[key]
  },
  clear: () => {
    for (const k in memoryStorage) delete memoryStorage[k]
  },
}
;(globalThis as any).window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
  CustomEvent: class CustomEvent {
    type: string
    detail: any
    constructor(type: string, params: any = {}) {
      this.type = type
      this.detail = params.detail
    }
  },
}

import {
  AUTHENTIC_SEED_COLLEGES,
  TELANGANA_DISTRICTS,
  isValidAisheCode,
  normalizeCollegeName,
  saveCollegeRecord,
  searchCollegesDirectory,
  getCollegeDirectoryMetrics,
  type CollegeDirectoryRecord,
} from '../src/lib/collegeDirectory'
import { isSupabaseConfigured, supabase } from '../src/lib/supabase'

interface SeedSummary {
  totalProcessed: number
  importedCount: number
  verifiedCount: number
  pendingCount: number
  rejectedCount: number
  skippedDuplicates: number
  districtsCount: Record<string, number>
}

async function runSeedPipeline(dryRun: boolean = false): Promise<SeedSummary> {
  console.log('=============================================================================')
  console.log(' FESTFLOW — REPEATABLE VERIFIED COLLEGE SEED & AUDIT PIPELINE')
  console.log(` Mode: ${dryRun ? 'DRY-RUN (No writes)' : 'LIVE SEEDING'}`)
  console.log(` Target Backend: ${isSupabaseConfigured ? 'Supabase PostgreSQL' : 'Local Directory Cache'}`)
  console.log('=============================================================================\n')

  const summary: SeedSummary = {
    totalProcessed: 0,
    importedCount: 0,
    verifiedCount: 0,
    pendingCount: 0,
    rejectedCount: 0,
    skippedDuplicates: 0,
    districtsCount: {},
  }

  TELANGANA_DISTRICTS.forEach((d) => {
    summary.districtsCount[d] = 0
  })

  const seenAishe = new Set<string>()
  const seenNorm = new Set<string>()

  // Fetch existing colleges first to prevent duplicates
  const existingResult = await searchCollegesDirectory({ limit: 500 })
  const existingColleges = existingResult.colleges

  existingColleges.forEach((c) => {
    if (c.aishe_code) seenAishe.add(c.aishe_code.toUpperCase())
    if (c.official_name || c.name) seenNorm.add(normalizeCollegeName(c.official_name || c.name))
  })

  console.log(`[Seed Pipeline] Initial existing records in directory: ${existingColleges.length}`)
  console.log(`[Seed Pipeline] Total authoritative seed candidates: ${AUTHENTIC_SEED_COLLEGES.length}\n`)

  for (const college of AUTHENTIC_SEED_COLLEGES) {
    summary.totalProcessed++

    const aisheUpper = college.aishe_code?.toUpperCase()
    const normName = normalizeCollegeName(college.official_name || college.name)

    // Validate AISHE code
    if (college.aishe_code && !isValidAisheCode(college.aishe_code)) {
      console.warn(`[Seed Warning] Invalid AISHE code for "${college.official_name}": ${college.aishe_code}`)
    }

    // Check duplicate
    if (aisheUpper && seenAishe.has(aisheUpper)) {
      // Already present
      summary.skippedDuplicates++
      continue
    }

    if (seenNorm.has(normName)) {
      summary.skippedDuplicates++
      continue
    }

    if (aisheUpper) seenAishe.add(aisheUpper)
    seenNorm.add(normName)

    if (college.district in summary.districtsCount) {
      summary.districtsCount[college.district]++
    }

    if (college.verification_status === 'verified') summary.verifiedCount++
    else if (college.verification_status === 'pending') summary.pendingCount++
    else if (college.verification_status === 'rejected') summary.rejectedCount++

    if (!dryRun) {
      await saveCollegeRecord(college, 'system-seed@festflow.online')
    }

    summary.importedCount++
  }

  // Double check Anurag University
  const anuragCheck = await searchCollegesDirectory({ query: 'Anurag University' })
  const hasAnurag = anuragCheck.colleges.some(
    (c) => c.official_name === 'Anurag University' && c.aishe_code === 'U-1188'
  )

  console.log('\n─────────────────────────────────────────────────────────────────────────────')
  console.log(' SEED EXECUTION AUDIT REPORT')
  console.log('─────────────────────────────────────────────────────────────────────────────')
  console.log(`Total Candidates Evaluated : ${summary.totalProcessed}`)
  console.log(`Newly Imported Records     : ${summary.importedCount}`)
  console.log(`Duplicates Prevented       : ${summary.skippedDuplicates}`)
  console.log(`Verified Status Count      : ${summary.verifiedCount}`)
  console.log(`Pending Status Count       : ${summary.pendingCount}`)
  console.log(`Rejected Status Count      : ${summary.rejectedCount}`)
  console.log('Districts Breakdown:')
  for (const [dist, cnt] of Object.entries(summary.districtsCount)) {
    console.log(`  • ${dist.padEnd(22)}: ${cnt} institutions`)
  }
  console.log(`Anurag University Verified : ${hasAnurag ? '✓ YES (U-1188 in Medchal-Malkajgiri)' : '✗ MISSING'}`)
  console.log('─────────────────────────────────────────────────────────────────────────────\n')

  return summary
}

const isDryRun = process.argv.includes('--dry-run')
runSeedPipeline(isDryRun).catch((err) => {
  console.error('Fatal error during seed execution:', err)
  process.exit(1)
})

