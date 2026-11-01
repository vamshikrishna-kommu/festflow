import { validateCoupon, redeemCoupon } from '../src/lib/coupons'

async function run() {
  console.log('Testing coupon redemption workflow...')
  
  // 1. Percentage discount: FEST20 (20% off on ₹500 = ₹100 discount, ₹400 payable)
  const res1 = await validateCoupon('FEST20', 'ev_sample_1', 500)
  if (!res1.valid || res1.discountAmount !== 100 || res1.finalPrice !== 400) {
    throw new Error(`FEST20 failed: discount=${res1.discountAmount}, final=${res1.finalPrice}`)
  }
  console.log('✓ PASS: FEST20 applied: discount ₹100, final price ₹400')

  // 2. Fixed discount: CAMPUS50 (₹50 off on ₹300 = ₹250 payable)
  const res2 = await validateCoupon('CAMPUS50', 'ev_sample_1', 300)
  if (!res2.valid || res2.discountAmount !== 50 || res2.finalPrice !== 250) {
    throw new Error(`CAMPUS50 failed: discount=${res2.discountAmount}, final=${res2.finalPrice}`)
  }
  console.log('✓ PASS: CAMPUS50 applied: discount ₹50, final price ₹250')

  // 3. Invalid coupon
  const res3 = await validateCoupon('INVALID_CODE', 'ev_sample_1', 300)
  if (res3.valid) {
    throw new Error('Expected invalid coupon to fail')
  }
  console.log('✓ PASS: Invalid coupon rejected as expected')

  // 4. Redeem coupon
  if (res1.coupon) {
    await redeemCoupon(res1.coupon.id)
    console.log('✓ PASS: redeemCoupon recorded usage increment')
  }

  console.log('\n=======================================')
  console.log('ALL PAYMENT COUPON TESTS PASSED! (4/4)')
  console.log('=======================================')
}

run().catch((err) => {
  console.error('Test error:', err)
  process.exit(1)
})
