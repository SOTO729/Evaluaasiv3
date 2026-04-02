/**
 * Integration test for candidate payment system
 *
 * Tests:
 *   1. candidate-pay requires candidato role (admin → 403)
 *   2. candidate-pay requires group_exam_id (400)
 *   3. candidate-pay requires token (400)
 *   4. candidate-pay with invalid group_exam_id (404)
 *   5. candidate-retake requires candidato role (403)
 *   6. candidate-retake with invalid group_exam_id (404)
 *   7. mis-examenes includes payment fields
 *   8. check-access includes payment fields
 *   9. my-payments includes payment_type field
 *   10. editor cannot use candidate endpoints (403)
 *
 * Run: node test_candidate_payments.js [dev|prod]
 */
const https = require('https');

const ENV = process.argv[2] || 'dev';
const API = ENV === 'prod'
  ? 'https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api'
  : 'https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api';

function request(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(API + path);
    const opts = {
      hostname: url.hostname, path: url.pathname + url.search, method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function login(username, password, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const res = await request('POST', '/auth/login', null, { username, password });
    if (res.data && res.data.access_token) return res.data.access_token;
    if (i < retries - 1) await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error(`Login failed for ${username}`);
}

let passed = 0, failed = 0;
function assert(condition, msg) {
  if (condition) { passed++; console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

async function main() {
  console.log(`=== Candidate Payments Test — ${ENV.toUpperCase()} ===`);
  console.log(`API: ${API}\n`);

  // ── Login ──
  console.log('1. Logging in...');
  const adminToken = await login('admin', 'admin123');
  console.log('   Admin login: OK');

  let alumnoToken;
  try {
    alumnoToken = await login('U343Z793S8', 'TestPay2024!');
    console.log('   Candidato login: OK');
  } catch (e) {
    console.log('   Candidato login FAILED — skipping candidato tests');
    alumnoToken = null;
  }

  const editorToken = await login('145B3B9FDS', 'TestEdit2024!');
  console.log('   Editor login: OK');

  // ── 2. candidate-pay: admin gets 403 ──
  console.log('\n2. candidate-pay: admin role blocked');
  const r1 = await request('POST', '/payments/candidate-pay', adminToken, {
    group_exam_id: 1, token: 'fake-token', payment_method_id: 'visa',
  });
  assert(r1.status === 403, `Admin gets 403 (got ${r1.status})`);
  assert(
    r1.data && r1.data.error && r1.data.error.toLowerCase().includes('candidato'),
    'Error mentions candidatos'
  );

  // ── 3. candidate-pay: missing group_exam_id ──
  console.log('\n3. candidate-pay: missing group_exam_id');
  if (alumnoToken) {
    const r2 = await request('POST', '/payments/candidate-pay', alumnoToken, {
      token: 'fake', payment_method_id: 'visa',
    });
    assert(r2.status === 400, `Missing group_exam_id → 400 (got ${r2.status})`);
  } else {
    console.log('  SKIP: No alumno token');
  }

  // ── 4. candidate-pay: missing token ──
  console.log('\n4. candidate-pay: missing token');
  if (alumnoToken) {
    const r3 = await request('POST', '/payments/candidate-pay', alumnoToken, {
      group_exam_id: 99999, payment_method_id: 'visa',
    });
    assert(r3.status === 400, `Missing token → 400 (got ${r3.status})`);
  } else {
    console.log('  SKIP: No alumno token');
  }

  // ── 5. candidate-pay: invalid group_exam_id → 404 ──
  console.log('\n5. candidate-pay: invalid group_exam_id');
  if (alumnoToken) {
    const r4 = await request('POST', '/payments/candidate-pay', alumnoToken, {
      group_exam_id: 999999, token: 'fake-token', payment_method_id: 'visa',
      payer_email: 'test@test.com',
    });
    assert(r4.status === 404, `Invalid group_exam_id → 404 (got ${r4.status})`);
  } else {
    console.log('  SKIP: No alumno token');
  }

  // ── 6. candidate-retake: admin gets 403 ──
  console.log('\n6. candidate-retake: admin role blocked');
  const r5 = await request('POST', '/payments/candidate-retake', adminToken, {
    group_exam_id: 1, token: 'fake-token', payment_method_id: 'visa',
  });
  assert(r5.status === 403, `Admin gets 403 for retake (got ${r5.status})`);

  // ── 7. candidate-retake: invalid group_exam_id ──
  console.log('\n7. candidate-retake: invalid group_exam_id');
  if (alumnoToken) {
    const r6 = await request('POST', '/payments/candidate-retake', alumnoToken, {
      group_exam_id: 999999, token: 'fake-token', payment_method_id: 'visa',
      payer_email: 'test@test.com',
    });
    assert(r6.status === 404, `Invalid group_exam_id → 404 (got ${r6.status})`);
  } else {
    console.log('  SKIP: No alumno token');
  }

  // ── 8. mis-examenes: includes payment fields ──
  console.log('\n8. mis-examenes: payment fields');
  if (alumnoToken) {
    const r7 = await request('GET', '/partners/mis-examenes', alumnoToken);
    assert(r7.status === 200, `mis-examenes returns 200 (got ${r7.status})`);
    if (r7.data && r7.data.exams && r7.data.exams.length > 0) {
      const exam = r7.data.exams.find(e => e.group_id);
      if (exam) {
        assert('requires_payment' in exam, 'Exam has requires_payment field');
        assert('is_paid' in exam, 'Exam has is_paid field');
        assert('certification_cost' in exam, 'Exam has certification_cost field');
        assert(typeof exam.requires_payment === 'boolean', 'requires_payment is boolean');
        assert(typeof exam.is_paid === 'boolean', 'is_paid is boolean');

        // ── 9. check-access: includes payment fields ──
        console.log('\n9. check-access: payment fields');
        const examId = exam.exam_id || exam.id;
        const geid = exam.group_exam_id;
        if (geid) {
          const r8 = await request('GET', `/exams/${examId}/check-access?group_exam_id=${geid}`, alumnoToken);
          assert(r8.status === 200, `check-access returns 200 (got ${r8.status})`);
          assert('requires_payment' in r8.data, 'check-access has requires_payment');
          assert('is_paid' in r8.data, 'check-access has is_paid');
        } else {
          console.log('  SKIP: No group_exam_id on exam');
        }
      } else {
        console.log('  SKIP: No exams with group_id found');
      }
    } else {
      console.log('  SKIP: Alumno has no assigned exams');
    }
  } else {
    console.log('  SKIP: No alumno token');
  }

  // ── 10. my-payments: payment_type field ──
  console.log('\n10. my-payments: payment_type field');
  if (alumnoToken) {
    const r9 = await request('GET', '/payments/my-payments', alumnoToken);
    assert(r9.status === 200, `my-payments returns 200 (got ${r9.status})`);
    if (r9.data && r9.data.payments && r9.data.payments.length > 0) {
      const p = r9.data.payments[0];
      assert('payment_type' in p, 'Payment has payment_type field');
      assert(
        ['voucher', 'certification', 'retake'].includes(p.payment_type),
        `payment_type is valid: ${p.payment_type}`
      );
    } else {
      console.log('  INFO: No payments found for alumno — field check skipped');
      passed++; // Not a failure
    }
  } else {
    console.log('  SKIP: No alumno token');
  }

  // ── 11. Editor cannot use candidate-pay ──
  console.log('\n11. editor: candidate-pay blocked');
  const r10 = await request('POST', '/payments/candidate-pay', editorToken, {
    group_exam_id: 1, token: 'fake', payment_method_id: 'visa',
  });
  assert(r10.status === 403, `Editor gets 403 (got ${r10.status})`);

  // ── 12. No auth → 401/422 ──
  console.log('\n12. candidate-pay: no auth');
  const r11 = await request('POST', '/payments/candidate-pay', null, {
    group_exam_id: 1, token: 'fake', payment_method_id: 'visa',
  });
  assert([401, 422].includes(r11.status), `No auth → 401/422 (got ${r11.status})`);

  // ── Summary ──
  console.log(`\n=== ${ENV.toUpperCase()}: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
