/**
 * Unit Test Suite for Intelligent UPI UTR/RRN OCR Extraction Engine
 */

import { extractUtrFromText } from '../src/lib/ocrUtrExtractor.js'

let total = 0
let passed = 0

function assert(condition: boolean, name: string, detail?: string) {
  total++
  if (condition) {
    passed++
    console.log(`  ✓ PASS: ${name}`)
  } else {
    console.error(`  ✗ FAIL: ${name}${detail ? ` -> ${detail}` : ''}`)
  }
}

console.log('\n============================================================')
console.log('FESTFLOW: UPI UTR EXTRACTION TEST SUITE')
console.log('============================================================\n')

// 1. Google Pay Receipt (same line & line break)
console.log('--- Test Suite 1: Google Pay Receipts ---')
const gpaySample1 = `
Paid to Robotics Club
₹499.00
Completed • 28 Oct 2026, 11:42 AM
UPI transaction ID
428910485923
To: robotics.club@okaxis
Google transaction ID: CICAgODV_72eCg
`
const resGpay1 = extractUtrFromText(gpaySample1)
assert(resGpay1.success, 'Extracts UTR from Google Pay (next line)')
assert(resGpay1.reference === '428910485923', `Correct UTR 428910485923 (got ${resGpay1.reference})`)
assert(resGpay1.labelMatched?.includes('UPI Ref/Txn ID') === true, 'Correct label matched')

const gpaySample2 = `
Paid ₹250
UPI Transaction ID: 512398471928
From: State Bank of India
`
const resGpay2 = extractUtrFromText(gpaySample2)
assert(resGpay2.success && resGpay2.reference === '512398471928', 'Extracts UTR from Google Pay (same line with colon)')

// 2. PhonePe Receipt
console.log('\n--- Test Suite 2: PhonePe Receipts ---')
const phonePeSample1 = `
Transaction Successful
28 Oct 2026 at 3:15 PM
Paid to
Cultural Committee
₹300
Debited from
State Bank of India - 4102
UTR: 429019283741
Transaction ID: T241028151529182910
`
const resPhonePe1 = extractUtrFromText(phonePeSample1)
assert(resPhonePe1.success, 'Extracts UTR from PhonePe receipt')
assert(resPhonePe1.reference === '429019283741', `Correct 12-digit UTR 429019283741 (got ${resPhonePe1.reference})`)
assert(resPhonePe1.reference !== 'T241028151529182910', 'Prioritizes true 12-digit UTR over internal app transaction ID')

// 3. Paytm Receipt
console.log('\n--- Test Suite 3: Paytm Receipts ---')
const paytmSample = `
Payment to FestFlow Club
₹150
28 Oct, 04:30 PM
UPI Ref No: 429182736451
Order ID: PYTM_9182739182
`
const resPaytm = extractUtrFromText(paytmSample)
assert(resPaytm.success, 'Extracts UTR from Paytm receipt')
assert(resPaytm.reference === '429182736451', `Correct UTR 429182736451 (got ${resPaytm.reference})`)

// 4. BHIM / Bank RRN
console.log('\n--- Test Suite 4: BHIM & Bank Receipts ---')
const bhimSample = `
BHIM UPI Payment Advice
Reference Number (RRN): 429210984756
Beneficiary: Hackathon Lead
Amount: INR 500.00
`
const resBhim = extractUtrFromText(bhimSample)
assert(resBhim.success, 'Extracts RRN from BHIM receipt')
assert(resBhim.reference === '429210984756', `Correct RRN 429210984756 (got ${resBhim.reference})`)

// 5. OCR Spaced Digits (e.g. "4289 1048 5923")
console.log('\n--- Test Suite 5: Spaced Digit Normalization ---')
const spacedSample = `
UPI Ref No.
4289 1048 5923
`
const resSpaced = extractUtrFromText(spacedSample)
assert(resSpaced.success && resSpaced.reference === '428910485923', 'Normalizes OCR-spaced 12-digit UTR')

// 6. Non-UTR Filtering (Amounts, Phone numbers, Accounts, Dates)
console.log('\n--- Test Suite 6: Avoid False Positives ---')
const phoneAndAmountSample = `
Paid ₹12000.00 to Mobile +91 9876543210
Date: 28/10/2026
Account: XXXXXXXXX1234
No transaction reference was shown.
`
const resFalsePos = extractUtrFromText(phoneAndAmountSample)
assert(!resFalsePos.success, 'Correctly rejects receipt without valid transaction reference')
assert(resFalsePos.reference === null, 'Does not pick up phone number or amount as UTR')

// 7. Empty or Blurry Text
console.log('\n--- Test Suite 7: Blurry or Garbage Text ---')
const blurrySample = `
asdfjkl random noise 123
blur text
`
const resBlurry = extractUtrFromText(blurrySample)
assert(!resBlurry.success, 'Gracefully handles blurry or unreadable text')
assert(resBlurry.reference === null, 'Returns null reference for unreadable image')

console.log('\n============================================================')
console.log(`TEST RESULTS: ${passed}/${total} Passed (${total - passed} Failed)`)
console.log('============================================================\n')

if (passed !== total) {
  process.exit(1)
}
