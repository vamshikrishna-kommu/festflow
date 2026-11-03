// scripts/test-staging-postgrest.mjs
// Run: node scripts/test-staging-postgrest.mjs
import assert from 'node:assert/strict';

const STAGING_URL = process.env.SUPABASE_STAGING_URL;
const ANON_KEY = process.env.SUPABASE_STAGING_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY; // For post-test cleanup
const STUDENT_A_JWT = process.env.STAGING_STUDENT_A_JWT; // Owner of ticket
const STUDENT_B_JWT = process.env.STAGING_STUDENT_B_JWT; // Stranger student
const ORGANIZER_JWT = process.env.STAGING_ORGANIZER_JWT; // Club staff
const REG_ID = process.env.STAGING_DISPOSABLE_REGISTRATION_ID; // Dedicated test registration
const EVENT_ID = process.env.STAGING_EVENT_ID;
const QR_TOKEN = process.env.STAGING_DISPOSABLE_QR_TOKEN; // Matching 256-bit pass token

if (!STAGING_URL || !ANON_KEY || !STUDENT_A_JWT || !STUDENT_B_JWT || !ORGANIZER_JWT || !REG_ID || !EVENT_ID || !QR_TOKEN) {
  console.error('ERROR: Missing required environment variables:');
  console.error('SUPABASE_STAGING_URL, SUPABASE_STAGING_ANON_KEY, STAGING_STUDENT_A_JWT,');
  console.error('STAGING_STUDENT_B_JWT, STAGING_ORGANIZER_JWT, STAGING_DISPOSABLE_REGISTRATION_ID,');
  console.error('STAGING_EVENT_ID, STAGING_DISPOSABLE_QR_TOKEN');
  process.exit(1);
}

// Exactly matches Migration 046 Section 10 column-level SELECT grants
const SAFE_ROSTER_COLUMNS = 'id,event_id,student_id,ticket_code,status,team_name,team_role,team_id,team_members,created_at';

async function run() {
  console.log('=== STARTING POSTGREST HTTP STAGING VERIFICATION ===');

  // TEST 1: Unauthorized Access (Anonymous call to get_student_ticket_pass)
  console.log('\n[Test 1] Anonymous call to get_student_ticket_pass');
  const res1 = await fetch(`${STAGING_URL}/rest/v1/rpc/get_student_ticket_pass`, {
    method: 'POST',
    headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_registration_id: REG_ID }),
  });
  if (res1.status === 200) {
    const data1 = await res1.json();
    assert.equal(data1.success, false, 'Anonymous caller must not receive ticket');
    assert.equal(data1.outcome, 'UNAUTHENTICATED');
  } else {
    assert([401, 403].includes(res1.status), `Expected 401 or 403, got ${res1.status}`);
  }
  console.log('PASS: Anonymous access rejected.');

  // TEST 2: Student A retrieves their own ticket pass
  console.log('\n[Test 2] Student A retrieves own ticket pass');
  const res2 = await fetch(`${STAGING_URL}/rest/v1/rpc/get_student_ticket_pass`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${STUDENT_A_JWT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_registration_id: REG_ID }),
  });
  assert.equal(res2.status, 200, `Expected 200, got ${res2.status}`);
  const data2 = await res2.json();
  assert.equal(data2.success, true, 'Student A must be authorized');
  assert.equal(data2.outcome, 'AUTHORIZED');
  assert.ok(data2.qr_token, 'Pass must include bearer qr_token');
  assert.equal(data2.qr_token_hash, undefined, 'qr_token_hash must be absent from pass RPC output');
  console.log('PASS: Student pass retrieved. qr_token_hash strictly omitted.');

  // TEST 3: Student B attempts to retrieve Student A's ticket
  console.log('\n[Test 3] Student B attempts to retrieve Student A ticket');
  const res3 = await fetch(`${STAGING_URL}/rest/v1/rpc/get_student_ticket_pass`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${STUDENT_B_JWT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_registration_id: REG_ID }),
  });
  assert.equal(res3.status, 200, `Expected 200, got ${res3.status}`);
  const data3 = await res3.json();
  assert.equal(data3.success, false, 'Stranger must be blocked');
  assert.equal(data3.outcome, 'FORBIDDEN', `Expected FORBIDDEN, got ${data3.outcome}`);
  assert.equal(data3.qr_token, undefined, 'Stranger must never receive qr_token');
  console.log('PASS: Horizontal privilege escalation strictly blocked.');

  // TEST 4A: Organizer queries permitted safe roster columns
  console.log('\n[Test 4A] Organizer queries permitted safe roster columns');
  const res4a = await fetch(`${STAGING_URL}/rest/v1/registrations?id=eq.${REG_ID}&select=${SAFE_ROSTER_COLUMNS}`, {
    method: 'GET',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ORGANIZER_JWT}`,
    },
  });
  assert.equal(res4a.status, 200, `Expected 200 for safe columns, got ${res4a.status}`);
  const rows4a = await res4a.json();
  assert.ok(Array.isArray(rows4a) && rows4a.length > 0, 'Safe roster record must return data');
  assert.ok(rows4a[0].ticket_code, 'ticket_code must be visible in safe roster');
  console.log('PASS: Organizer can query permitted safe columns.');

  // TEST 4B: Organizer explicitly attempts to SELECT qr_token (Must fail with 42501 / Permission Denied)
  console.log('\n[Test 4B] Organizer explicitly attempts to SELECT qr_token');
  const res4b = await fetch(`${STAGING_URL}/rest/v1/registrations?id=eq.${REG_ID}&select=id,qr_token`, {
    method: 'GET',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ORGANIZER_JWT}`,
    },
  });
  assert([400, 403].includes(res4b.status), `Expected 400/403 for qr_token access, got ${res4b.status}`);
  const err4b = await res4b.json();
  const isDenied4b = err4b.code === '42501' || (err4b.message && err4b.message.toLowerCase().includes('permission denied'));
  assert.ok(isDenied4b, `Expected 42501 Permission Denied, got: ${JSON.stringify(err4b)}`);
  console.log('PASS: Direct SELECT on qr_token denied with explicit 42501 Insufficient Privilege.');

  // TEST 4C: Organizer explicitly attempts to SELECT qr_token_hash (Must fail with 42501 / Permission Denied)
  console.log('\n[Test 4C] Organizer explicitly attempts to SELECT qr_token_hash');
  const res4c = await fetch(`${STAGING_URL}/rest/v1/registrations?id=eq.${REG_ID}&select=id,qr_token_hash`, {
    method: 'GET',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ORGANIZER_JWT}`,
    },
  });
  assert([400, 403].includes(res4c.status), `Expected 400/403 for qr_token_hash access, got ${res4c.status}`);
  const err4c = await res4c.json();
  const isDenied4c = err4c.code === '42501' || (err4c.message && err4c.message.toLowerCase().includes('permission denied'));
  assert.ok(isDenied4c, `Expected 42501 Permission Denied, got: ${JSON.stringify(err4c)}`);
  console.log('PASS: Direct SELECT on qr_token_hash denied with explicit 42501 Insufficient Privilege.');

  // TEST 5: Gate Turnstile Check-In and Replay Rejection
  console.log('\n[Test 5] Gate Turnstile Check-In and Replay Rejection');
  const res5a = await fetch(`${STAGING_URL}/rest/v1/rpc/check_in_ticket`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ORGANIZER_JWT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_event_id: EVENT_ID,
      p_ticket_code_or_payload: QR_TOKEN,
      p_notes: 'Staging automated HTTP test',
    }),
  });
  assert.equal(res5a.status, 200, `Expected 200, got ${res5a.status}`);
  const data5a = await res5a.json();
  assert.equal(data5a.success, true, `Admission failed: ${JSON.stringify(data5a)}`);
  assert.equal(data5a.outcome, 'VALID');

  // Replay Scan
  const res5b = await fetch(`${STAGING_URL}/rest/v1/rpc/check_in_ticket`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ORGANIZER_JWT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_event_id: EVENT_ID,
      p_ticket_code_or_payload: QR_TOKEN,
    }),
  });
  assert.equal(res5b.status, 200, `Expected 200, got ${res5b.status}`);
  const data5b = await res5b.json();
  assert.equal(data5b.success, false, 'Replay scan must be rejected');
  assert.equal(data5b.outcome, 'ALREADY_USED', `Expected ALREADY_USED, got ${data5b.outcome}`);
  console.log('PASS: Turnstile check-in and replay protection verified.');

  // POST-TEST CLEANUP: Reset the check-in record for repeatable testing
  if (SERVICE_KEY) {
    console.log('\n[Cleanup] Removing staging check_in row for disposable test ticket...');
    await fetch(`${STAGING_URL}/rest/v1/check_ins?ticket_code=eq.${data5a.ticket_code}`, {
      method: 'DELETE',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
    });
    console.log('Cleanup completed: Disposable test registration reset.');
  }

  console.log('\n============================================================');
  console.log('ALL POSTGREST HTTP STAGING TESTS PASSED WITH ZERO ERRORS');
  console.log('============================================================');
}

run().catch((err) => {
  console.error('\nHTTP STAGING TEST SUITE FAILED:');
  console.error(err);
  process.exit(1);
});
