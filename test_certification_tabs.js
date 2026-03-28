/**
 * Integration test: Certification Tabs — Dashboard endpoint
 * 
 * Verifica que /api/users/me/dashboard devuelve:
 *   - exam_materials_map (objeto) para candidatos
 *   - competency_standard_id/name/code en cada examen
 *   - exam_materials_map vacío ({}) para no-candidatos (admin, editor)
 *
 * Run: node test_certification_tabs.js dev|prod
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
    if (i < retries - 1) {
      console.log(`  Login attempt ${i + 1} failed for ${username}, retrying in 3s...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  throw new Error(`Login failed for ${username} after ${retries} attempts`);
}

let passed = 0, failed = 0;
function assert(condition, msg) {
  if (condition) { passed++; console.log(`  ✅ PASS: ${msg}`); }
  else { failed++; console.log(`  ❌ FAIL: ${msg}`); }
}

async function main() {
  console.log(`\n=== Certification Tabs Integration Test — ${ENV.toUpperCase()} ===`);
  console.log(`API: ${API}\n`);

  // Login as admin first (needed to create test candidato)
  const adminToken = await login('admin', 'admin123');
  console.log('Admin login OK\n');

  // ────────────────────────────────────────────────
  // 1. Candidato tests — create a temp candidato via admin
  // ────────────────────────────────────────────────
  console.log('--- 1. Candidato ---');
  const ts = Date.now().toString(36);
  const candRes = await request('POST', '/user-management/users', adminToken, {
    name: 'TestCert', first_surname: 'Tabs', second_surname: ts.slice(0, 4),
    email: `testcert_${ts}@test.com`, role: 'candidato', gender: 'M',
  });
  let alumnoToken;
  if (candRes.status === 201) {
    const candUsername = candRes.data.user.username;
    const candTempPwd = candRes.data.temporary_password;
    alumnoToken = await login(candUsername, candTempPwd);
    console.log(`  Created candidato: ${candUsername}`);
  } else {
    // Fallback: try alumno/alumno123
    console.log('  Could not create candidato, trying alumno/alumno123...');
    alumnoToken = await login('alumno', 'alumno123');
  }
  console.log('  Login OK\n');

  const alumnoRes = await request('GET', '/users/me/dashboard', alumnoToken);
  assert(alumnoRes.status === 200, `Dashboard returns 200 (got ${alumnoRes.status})`);

  const d = alumnoRes.data;

  // exam_materials_map exists and is an object
  assert(
    d.exam_materials_map !== undefined && d.exam_materials_map !== null,
    'exam_materials_map exists in response'
  );
  assert(
    typeof d.exam_materials_map === 'object' && !Array.isArray(d.exam_materials_map),
    'exam_materials_map is a plain object (not array)'
  );

  // Validate each value in exam_materials_map is an array of numbers
  const mapKeys = Object.keys(d.exam_materials_map);
  if (mapKeys.length > 0) {
    let allValid = true;
    for (const key of mapKeys) {
      const val = d.exam_materials_map[key];
      if (!Array.isArray(val)) { allValid = false; break; }
      if (!val.every(v => typeof v === 'number')) { allValid = false; break; }
    }
    assert(allValid, `exam_materials_map values are arrays of numbers (${mapKeys.length} entries)`);
  } else {
    console.log('  ℹ️  exam_materials_map is empty (alumno may not have group assignments)');
  }

  // Exams have competency_standard fields
  const exams = d.exams || [];
  console.log(`  ℹ️  Candidato has ${exams.length} exam(s)\n`);

  if (exams.length > 0) {
    let allHaveFields = true;
    for (const exam of exams) {
      if (!('competency_standard_id' in exam)) { allHaveFields = false; break; }
      if (!('competency_standard_name' in exam)) { allHaveFields = false; break; }
      if (!('competency_standard_code' in exam)) { allHaveFields = false; break; }
    }
    assert(allHaveFields, 'All exams have competency_standard_id, _name, _code keys');

    // Values can be null but must be present
    const first = exams[0];
    assert(
      first.competency_standard_id === null || typeof first.competency_standard_id === 'number',
      `competency_standard_id is null or number (got ${typeof first.competency_standard_id})`
    );
    assert(
      first.competency_standard_name === null || typeof first.competency_standard_name === 'string',
      `competency_standard_name is null or string (got ${typeof first.competency_standard_name})`
    );
    assert(
      first.competency_standard_code === null || typeof first.competency_standard_code === 'string',
      `competency_standard_code is null or string (got ${typeof first.competency_standard_code})`
    );

    // If exam_materials_map has entries, the exam_ids should correspond to actual exam ids
    if (mapKeys.length > 0) {
      const examIds = new Set(exams.map(e => String(e.id)));
      const mapExamIds = mapKeys;
      const allMapped = mapExamIds.every(id => examIds.has(id));
      assert(allMapped, 'exam_materials_map keys correspond to assigned exam IDs');
    }
  } else {
    console.log('  ℹ️  No exams assigned — skipping competency_standard field checks');
  }

  // Standard dashboard shape assertions
  assert(Array.isArray(d.exams), 'exams is array');
  assert(Array.isArray(d.materials), 'materials is array');
  assert(typeof d.stats === 'object', 'stats is object');
  assert(typeof d.user === 'object', 'user is object');

  // ────────────────────────────────────────────────
  // 2. Admin tests — exam_materials_map should be {}
  // ────────────────────────────────────────────────
  console.log('\n--- 2. Admin (admin/admin123) ---');
  console.log('  Login OK (reused)\n');

  const adminRes = await request('GET', '/users/me/dashboard', adminToken);
  assert(adminRes.status === 200, `Dashboard returns 200 (got ${adminRes.status})`);

  const ad = adminRes.data;
  assert(
    ad.exam_materials_map !== undefined,
    'exam_materials_map exists for admin'
  );
  assert(
    typeof ad.exam_materials_map === 'object' && Object.keys(ad.exam_materials_map).length === 0,
    'exam_materials_map is empty object for admin'
  );

  // Admin exams also have competency_standard fields
  const adminExams = ad.exams || [];
  if (adminExams.length > 0) {
    const hasFields = adminExams.every(e =>
      'competency_standard_id' in e &&
      'competency_standard_name' in e &&
      'competency_standard_code' in e
    );
    assert(hasFields, `Admin exams (${adminExams.length}) have competency_standard fields`);
  }

  // ────────────────────────────────────────────────
  // 3. Editor tests — exam_materials_map should be {}
  // ────────────────────────────────────────────────
  console.log('\n--- 3. Editor ---');
  let editorToken;
  try {
    editorToken = await login('editor', 'editor123');
    console.log('  Login OK\n');
  } catch {
    // Create a temp editor
    const edRes = await request('POST', '/user-management/users', adminToken, {
      name: 'TestEd', first_surname: 'Cert', second_surname: ts.slice(0, 4),
      email: `tested_${ts}@test.com`, role: 'editor',
    });
    if (edRes.status === 201) {
      editorToken = await login(edRes.data.user.username, edRes.data.temporary_password);
      console.log(`  Created editor: ${edRes.data.user.username}`);
    } else {
      console.log('  ⚠️  Could not create/login editor — skipping editor tests');
    }
  }

  if (editorToken) {
    const editorRes = await request('GET', '/users/me/dashboard', editorToken);
    assert(editorRes.status === 200, `Dashboard returns 200 (got ${editorRes.status})`);

    const ed = editorRes.data;
    assert(
      ed.exam_materials_map !== undefined,
      'exam_materials_map exists for editor'
    );
    assert(
      typeof ed.exam_materials_map === 'object' && Object.keys(ed.exam_materials_map).length === 0,
      'exam_materials_map is empty object for editor'
    );
  }

  // ────────────────────────────────────────────────
  // Summary
  // ────────────────────────────────────────────────
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`${'='.repeat(50)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
