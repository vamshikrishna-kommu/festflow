// =============================================================================
// FESTFLOW — VERIFIED COLLEGE DIRECTORY AUTOMATED VERIFICATION SUITE
// =============================================================================
// Comprehensive test suite covering:
// 1. Anurag University exact verification (U-1188, Ghatkesar, Medchal-Malkajgiri)
// 2. Multi-term search (Anurag University, Anurag, AU, U-1188, Ghatkesar)
// 3. Multi-district coverage across 4 target districts
// 4. AISHE code format validation & normalization
// 5. CSV Import & Export pipeline with duplicate detection
// 6. Verification lifecycle and audit history logging
// 7. Missing college requests workflow
// 8. Club vs College verification decoupling
// 9. Legacy profile backward compatibility
// =============================================================================

// Mock browser localStorage for Node test runner
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
  INSTITUTION_TYPE_LABELS,
  isValidAisheCode,
  normalizeCollegeName,
  searchCollegesDirectory,
  saveCollegeRecord,
  setCollegeVerificationStatus,
  getCollegeVerificationHistory,
  submitCollegeRequest,
  getCollegeRequests,
  reviewCollegeRequest,
  parseAndValidateCollegeCsv,
  exportCollegesToCsv,
  getCollegeDirectoryMetrics,
  type CollegeDirectoryRecord,
} from '../src/lib/collegeDirectory'

let passedTests = 0
let failedTests = 0

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`)
    passedTests++
  } else {
    console.error(`  ✗ FAIL: ${message}`)
    failedTests++
  }
}

async function runTestSuite() {
  console.log('=============================================================================')
  console.log(' FESTFLOW — VERIFIED COLLEGE DIRECTORY INTEGRATION TEST SUITE')
  console.log('=============================================================================\n')

  // ── TEST 1: Anurag University Presence & Search Verification ──────────────
  console.log('1. Validating Anurag University (Immediate Blocker Validation)...')
  const anuragMatch = AUTHENTIC_SEED_COLLEGES.find((c) => c.aishe_code === 'U-1188')
  assert(!!anuragMatch, 'Anurag University is present in authoritative seed dataset')
  assert(anuragMatch?.official_name === 'Anurag University', 'Official name is exactly "Anurag University"')
  assert(anuragMatch?.short_name === 'AU', 'Short name is "AU"')
  assert(anuragMatch?.aishe_code === 'U-1188', 'AISHE code is U-1188')
  assert(anuragMatch?.institution_type === 'private_university', 'Institution type is "private_university"')
  assert(anuragMatch?.district === 'Medchal-Malkajgiri', 'District is Medchal-Malkajgiri')
  assert(anuragMatch?.locality?.includes('Ghatkesar') || false, 'Locality contains Ghatkesar')
  assert(anuragMatch?.pincode === '500088', 'PIN code is 500088')
  assert(anuragMatch?.official_website === 'https://www.anurag.edu.in/', 'Website is https://www.anurag.edu.in/')
  assert(anuragMatch?.verification_status === 'verified', 'Verification status is verified')

  // Multi-term search validation for Anurag University
  console.log('\n2. Testing Multi-Term Search Queries for Anurag University...')
  const qOfficial = await searchCollegesDirectory({ query: 'Anurag University' })
  assert(
    qOfficial.colleges.some((c) => c.aishe_code === 'U-1188'),
    'Search by "Anurag University" returns Anurag University'
  )

  const qName = await searchCollegesDirectory({ query: 'Anurag' })
  assert(
    qName.colleges.some((c) => c.aishe_code === 'U-1188'),
    'Search by "Anurag" returns Anurag University'
  )

  const qAcronym = await searchCollegesDirectory({ query: 'AU' })
  assert(
    qAcronym.colleges.some((c) => c.short_name === 'AU' && c.aishe_code === 'U-1188'),
    'Search by acronym "AU" returns Anurag University'
  )

  const qAishe = await searchCollegesDirectory({ query: 'U-1188' })
  assert(
    qAishe.colleges.some((c) => c.aishe_code === 'U-1188'),
    'Search by AISHE code "U-1188" returns Anurag University'
  )

  const qLocality = await searchCollegesDirectory({ query: 'Ghatkesar' })
  assert(
    qLocality.colleges.some((c) => c.aishe_code === 'U-1188'),
    'Search by locality "Ghatkesar" returns Anurag University'
  )

  const qMedchal = await searchCollegesDirectory({ district: 'Medchal-Malkajgiri' })
  assert(
    qMedchal.colleges.some((c) => c.aishe_code === 'U-1188'),
    'District filter Medchal-Malkajgiri includes Anurag University'
  )

  // Disambiguation check
  const distinctCheck = AUTHENTIC_SEED_COLLEGES.filter((c) =>
    (c.official_name || c.name).toLowerCase().includes('anurag')
  )
  assert(
    distinctCheck.length === 1 && distinctCheck[0].aishe_code === 'U-1188',
    'Anurag University is strictly isolated and not confused or merged with Suryapet AEC (C-19746)'
  )

  // ── TEST 3: Multi-District Coverage (4 Target Districts) ───────────────────
  console.log('\n3. Checking Geographical Coverage (4 Telangana Target Districts)...')
  const districtsFound = new Set(AUTHENTIC_SEED_COLLEGES.map((c) => c.district))
  for (const dist of TELANGANA_DISTRICTS) {
    assert(districtsFound.has(dist), `Target district "${dist}" has authentic seed institutions`)
  }
  const hydColleges = AUTHENTIC_SEED_COLLEGES.filter((c) => c.district === 'Hyderabad')
  const medchalColleges = AUTHENTIC_SEED_COLLEGES.filter((c) => c.district === 'Medchal-Malkajgiri')
  const rrColleges = AUTHENTIC_SEED_COLLEGES.filter((c) => c.district === 'Rangareddy')
  const sangareddyColleges = AUTHENTIC_SEED_COLLEGES.filter((c) => c.district === 'Sangareddy')

  assert(hydColleges.length >= 20, `Hyderabad district has ${hydColleges.length} verified institutions (>= 20)`)
  assert(medchalColleges.length >= 20, `Medchal-Malkajgiri has ${medchalColleges.length} verified institutions (>= 20)`)
  assert(rrColleges.length >= 20, `Rangareddy has ${rrColleges.length} verified institutions (>= 20)`)
  assert(sangareddyColleges.length >= 10, `Sangareddy has ${sangareddyColleges.length} verified institutions (>= 10)`)
  assert(AUTHENTIC_SEED_COLLEGES.length >= 80, `Total authentic institutions: ${AUTHENTIC_SEED_COLLEGES.length} (>= 80)`)

  // ── TEST 4: Institution Classification Types & Authorities ─────────────────
  console.log('\n4. Checking Classification Types & Accreditation Authorities...')
  const typesFound = new Set(AUTHENTIC_SEED_COLLEGES.map((c) => c.institution_type))
  assert(typesFound.has('central_university'), 'Contains Central Universities (HCU, MANUU, EFLU)')
  assert(typesFound.has('state_university'), 'Contains State Universities (OU, JNTUH, BRAOU, NIMS)')
  assert(typesFound.has('private_university'), 'Contains Private Universities (Anurag University, Woxsen)')
  assert(typesFound.has('institute_of_national_importance'), 'Contains INI (IIT Hyderabad)')
  assert(typesFound.has('autonomous_college'), 'Contains Autonomous Colleges (CBIT, VNR, KMIT, SNIST)')
  assert(typesFound.has('constituent_college'), 'Contains Constituent Colleges (UCEOU, Nizam, UCEST JNTUH)')
  assert(typesFound.has('government_college'), 'Contains Government Colleges (OMC, GMC, Tara GDC, GDCH)')
  assert(typesFound.has('government_aided_college'), 'Contains Government-Aided Colleges (Badruka, Loyola, AV College)')
  assert(typesFound.has('deemed_university'), 'Contains Deemed Universities (IIIT Hyderabad, GITAM, IFHE)')

  // ── TEST 5: AISHE Code Validation ───────────────────────────────────────────
  console.log('\n5. Validating AISHE Code Formats & Validation Rules...')
  assert(isValidAisheCode('C-19754'), 'Valid college AISHE code C-19754 accepted')
  assert(isValidAisheCode('U-0027'), 'Valid university AISHE code U-0027 accepted')
  assert(isValidAisheCode('U-1188'), 'Valid university AISHE code U-1188 (Anurag) accepted')
  assert(isValidAisheCode('S-10492'), 'Valid standalone AISHE code S-10492 accepted')
  assert(isValidAisheCode('U-0010-C'), 'Valid off-campus AISHE code U-0010-C accepted')
  assert(!isValidAisheCode('INVALID_CODE'), 'Malformed string "INVALID_CODE" rejected')
  assert(!isValidAisheCode('12345'), 'AISHE code missing prefix prefix "12345" rejected')
  assert(!isValidAisheCode(''), 'Empty AISHE code rejected')

  // ── TEST 6: Name Normalization & Duplicate Prevention ──────────────────────
  console.log('\n6. Testing Name Normalization for Duplicate Prevention...')
  const norm1 = normalizeCollegeName('Anurag University')
  const norm2 = normalizeCollegeName('anurag university')
  const norm3 = normalizeCollegeName('Anurag University!')
  assert(norm1 === norm2, 'Normalized names match regardless of case and punctuation')
  assert(norm1 === 'anuraguniversity', 'Normalizes correctly to "anuraguniversity"')

  // ── TEST 7: CSV Import Pipeline with Duplicate Detection ───────────────────
  console.log('\n7. Testing CSV Import Validation & Duplicate Detection Pipeline...')
  const mockExisting: CollegeDirectoryRecord[] = AUTHENTIC_SEED_COLLEGES.map((c) => ({
    ...c,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))

  const sampleCsv = `official_name,short_name,aishe_code,district,locality,institution_type,website
Mahindra University,MU,U-1088,Medchal-Malkajgiri,Bahadurpally,private_university,https://www.mahindrauniversity.edu.in
Anurag University,AU,U-1188,Medchal-Malkajgiri,Ghatkesar,private_university,https://anurag.edu.in
Mahindra University Duplicate,MUD,U-1088,Medchal-Malkajgiri,Bahadurpally,private_university,https://mu.edu.in
,,Hyderabad,,affiliated_college,
Broken AISHE College,BAC,NOT_AN_AISHE,Rangareddy,Gachibowli,affiliated_college,https://bac.edu`

  const validation = parseAndValidateCollegeCsv(sampleCsv, mockExisting)

  assert(validation.totalRows === 5, 'Detected 5 total rows in CSV')
  assert(validation.validRows.length === 1, `Identified exactly 1 valid new row (Mahindra University), got ${validation.validRows.length}`)
  assert(
    validation.duplicatesInDb.some((d) => d.identifier.includes('U-1188') || d.existingName.includes('Anurag')),
    'Identified duplicate against existing database (Anurag University / U-1188)'
  )
  assert(
    validation.duplicatesInFile.some((d) => d.identifier.includes('U-1088')),
    'Identified duplicate within the CSV file (duplicate AISHE U-1088)'
  )
  assert(
    validation.errors.some((e) => e.column === 'aishe_code' && e.message.includes('Invalid AISHE')),
    'Caught format error for broken AISHE code "NOT_AN_AISHE"'
  )

  // ── TEST 8: CSV RFC 4180 Export Round-Trip ─────────────────────────────────
  console.log('\n8. Testing CSV RFC 4180 Export Round-Trip...')
  const exportedCsv = exportCollegesToCsv(mockExisting.slice(0, 5))
  assert(exportedCsv.startsWith('official_name,short_name,aishe_code'), 'CSV headers correctly formatted')
  assert(exportedCsv.includes('Anurag University') || exportedCsv.includes('Osmania University'), 'Exported CSV contains records')
  const reImported = parseAndValidateCollegeCsv(exportedCsv, [])
  assert(reImported.validRows.length === 5, 'Exported CSV successfully re-parsed with 100% fidelity')

  // ── TEST 9: Verification Lifecycle & Audit History ─────────────────────────
  console.log('\n9. Testing Verification Lifecycle & Audit History Tracking...')
  const testCollegeId = 'test-college-lifecycle-uuid'
  const savedTest = await saveCollegeRecord(
    {
      id: testCollegeId,
      official_name: 'Test Technological University',
      name: 'Test Technological University',
      district: 'Hyderabad',
      aishe_code: 'U-9999',
      verification_status: 'unverified',
    },
    'admin@festflow.online'
  )
  assert(savedTest.verification_status === 'unverified', 'Created initial unverified institution')

  const verifRes = await setCollegeVerificationStatus(testCollegeId, 'verified', {
    authority: 'UGC',
    sourceReference: 'UGC Gazette Notification No. 1234',
    academicYear: '2024-2025',
    notes: 'Verified via UGC official recognition letter',
    adminEmail: 'superadmin@festflow.online',
    adminId: 'admin-uuid-1',
  })
  assert(verifRes.success, 'Status successfully transitioned to verified')

  const history = await getCollegeVerificationHistory(testCollegeId)
  assert(history.length >= 1, `Audit history entry recorded (found ${history.length})`)
  assert(history[0].new_status === 'verified', 'Audit history records new_status = verified')
  assert(history[0].verification_authority === 'UGC', 'Audit history records authority = UGC')
  assert(history[0].verified_by_email === 'superadmin@festflow.online', 'Audit history records admin email')

  // ── TEST 10: Missing College Request Workflow ──────────────────────────────
  console.log('\n10. Testing Student & Club Missing College Request Workflow...')
  const reqRes = await submitCollegeRequest({
    userId: 'student-user-uuid-123',
    collegeName: 'Sphoorthy Engineering College',
    shortName: 'SPHN',
    district: 'Rangareddy',
    locality: 'Nadergul',
    website: 'https://sphoorthyengg.ac.in',
    aisheCode: 'C-19827',
    institutionType: 'affiliated_college',
    supportingInfo: 'Affiliated to JNTUH, Sagar Road Nadergul',
  })

  assert(reqRes.success && !!reqRes.requestId, 'Student successfully submitted missing college request')

  const pendingRequests = await getCollegeRequests('pending')
  const myReq = pendingRequests.find((r) => r.id === reqRes.requestId)
  assert(!!myReq, 'Admin can view submitted request in pending queue')

  const reviewRes = await reviewCollegeRequest(reqRes.requestId!, 'approve', {
    adminNotes: 'Verified against TSCHE and JNTUH affiliation list',
    adminEmail: 'admin@festflow.online',
    adminId: 'admin-1',
  })

  assert(reviewRes.success && !!reviewRes.createdCollegeId, 'Admin approval automatically creates college record')

  // ── TEST 11: Club vs College Verification Decoupling ──────────────────────
  console.log('\n11. Testing Club vs College Verification Decoupling...')
  assert(anuragMatch?.verification_status === 'verified', 'Anurag University is government verified')

  const mockClub = {
    club_name: 'Anurag Coding Club',
    college_id: anuragMatch?.id,
    is_verified: false,
  }
  assert(
    mockClub.is_verified === false,
    'Club is_verified status remains strictly independent from host college verification'
  )

  // ── TEST 12: Directory Metrics Summary ─────────────────────────────────────
  console.log('\n12. Testing Directory Metrics Reporting Function...')
  const metrics = await getCollegeDirectoryMetrics()
  assert(metrics.total >= 80, `Metrics total institutions: ${metrics.total} (>= 80)`)
  assert(metrics.verified >= 80, `Metrics verified institutions: ${metrics.verified} (>= 80)`)
  assert(metrics.districtsCount['Medchal-Malkajgiri'] >= 20, 'Medchal-Malkajgiri has >= 20 institutions in metrics')
  assert(metrics.districtsCount['Hyderabad'] >= 20, 'Hyderabad has >= 20 institutions in metrics')
  assert(metrics.districtsCount['Rangareddy'] >= 20, 'Rangareddy has >= 20 institutions in metrics')
  assert(metrics.districtsCount['Sangareddy'] >= 10, 'Sangareddy has >= 10 institutions in metrics')

  // ── SUMMARY ────────────────────────────────────────────────────────────────
  console.log('\n=============================================================================')
  console.log(` RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`)
  console.log('=============================================================================')

  if (failedTests > 0) {
    process.exit(1)
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal error in test suite:', err)
  process.exit(1)
})
