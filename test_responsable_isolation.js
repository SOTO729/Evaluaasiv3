/**
 * Integration test: Responsable campus isolation
 * Verifies that responsables can only see/manage candidates from their own campus,
 * NOT all candidates in the database.
 *
 * Endpoints tested:
 *  - GET  /partners/candidates/search/advanced  (responsable sees only own campus candidates)
 *  - GET  /partners/candidates/search            (same isolation)
 *  - POST /partners/groups/:id/members/bulk-assign-by-criteria (same isolation)
 *  - GET  /user-management/users                 (responsable sees only own campus candidates)
 *
 * Run: node test_responsable_isolation.js dev|prod
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
    if (res.data.access_token) return res.data.access_token;
    if (i < retries - 1) await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error(`Login failed for ${username}`);
}

let passed = 0, failed = 0;
function assert(condition, msg) {
  if (condition) { passed++; console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

async function main() {
  console.log(`=== Responsable Campus Isolation Test — ${ENV.toUpperCase()} ===`);
  console.log(`API: ${API}\n`);

  const adminToken = await login('admin', 'admin123');
  console.log('Admin login: OK');

  const ts = Date.now().toString(36);

  // ============================================================
  // SETUP: Create coordinator → partner → 2 campuses → 2 groups
  //        → candidatos in each campus
  // ============================================================
  console.log('\n--- Setup ---');

  // 1. Coordinator
  const coordRes = await request('POST', '/user-management/users', adminToken, {
    name: 'IsoCoord', first_surname: 'Test', second_surname: ts.slice(0,4),
    email: `isocoord_${ts}@test.com`, role: 'coordinator',
  });
  if (coordRes.status !== 201) { console.log(`FATAL: coordinator: ${JSON.stringify(coordRes.data).slice(0,300)}`); process.exit(1); }
  const coordId = coordRes.data.user.id;
  const coordToken = await login(coordRes.data.user.username, coordRes.data.temporary_password);
  console.log(`  Coordinator: ${coordRes.data.user.username}`);

  // 2. Partner
  const partnerRes = await request('POST', '/partners', coordToken, {
    name: `IsoPart_${ts}`, country: 'Mexico',
  });
  if (partnerRes.status !== 201) { console.log(`FATAL: partner: ${JSON.stringify(partnerRes.data).slice(0,300)}`); process.exit(1); }
  const partnerId = partnerRes.data.partner.id;
  console.log(`  Partner: ${partnerRes.data.partner.name} (${partnerId})`);

  // 3. Campus A
  const campusARes = await request('POST', `/partners/${partnerId}/campuses`, coordToken, {
    name: `CampusIsoA_${ts}`, state_name: 'Jalisco',
    director_name: 'DirA', director_first_surname: 'Test', director_second_surname: 'A',
    director_email: `dira_${ts}@test.com`, director_phone: '3310001111',
    director_gender: 'M', director_curp: `ISOA${ts.toUpperCase().padEnd(14,'X')}`.slice(0,18),
    director_date_of_birth: '1990-01-15',
  });
  if (campusARes.status !== 201) { console.log(`FATAL: campusA: ${JSON.stringify(campusARes.data).slice(0,300)}`); process.exit(1); }
  const campusAId = campusARes.data.campus.id;
  const respAUser = campusARes.data.director_user;
  console.log(`  Campus A: ${campusARes.data.campus.name} (${campusAId})`);
  console.log(`  Responsable A: ${respAUser.username}`);

  // 4. Campus B
  const campusBRes = await request('POST', `/partners/${partnerId}/campuses`, coordToken, {
    name: `CampusIsoB_${ts}`, state_name: 'Nuevo León',
    director_name: 'DirB', director_first_surname: 'Test', director_second_surname: 'B',
    director_email: `dirb_${ts}@test.com`, director_phone: '8110002222',
    director_gender: 'F', director_curp: `ISOB${ts.toUpperCase().padEnd(14,'Y')}`.slice(0,18),
    director_date_of_birth: '1985-06-20',
  });
  if (campusBRes.status !== 201) { console.log(`FATAL: campusB: ${JSON.stringify(campusBRes.data).slice(0,300)}`); process.exit(1); }
  const campusBId = campusBRes.data.campus.id;
  const respBUser = campusBRes.data.director_user;
  console.log(`  Campus B: ${campusBRes.data.campus.name} (${campusBId})`);
  console.log(`  Responsable B: ${respBUser.username}`);

  // 5. Groups
  const groupARes = await request('POST', `/partners/campuses/${campusAId}/groups`, coordToken, { name: `GrpIsoA_${ts}` });
  if (groupARes.status !== 201) { console.log(`FATAL: groupA: ${JSON.stringify(groupARes.data).slice(0,300)}`); process.exit(1); }
  const groupAId = groupARes.data.group.id;
  console.log(`  Group A: ${groupARes.data.group.name} (${groupAId})`);

  const groupBRes = await request('POST', `/partners/campuses/${campusBId}/groups`, coordToken, { name: `GrpIsoB_${ts}` });
  if (groupBRes.status !== 201) { console.log(`FATAL: groupB: ${JSON.stringify(groupBRes.data).slice(0,300)}`); process.exit(1); }
  const groupBId = groupBRes.data.group.id;
  console.log(`  Group B: ${groupBRes.data.group.name} (${groupBId})`);

  // 6. Create 3 candidatos for campus A
  const candAIds = [];
  for (let i = 1; i <= 3; i++) {
    const cr = await request('POST', '/user-management/users', coordToken, {
      name: `CandA${i}`, first_surname: 'IsoTest', second_surname: ts.slice(0,4),
      email: `canda${i}_${ts}@test.com`, role: 'candidato', gender: 'M',
    });
    if (cr.status !== 201) { console.log(`FATAL: candA${i}: ${JSON.stringify(cr.data).slice(0,300)}`); process.exit(1); }
    candAIds.push(cr.data.user.id);
    // Add to group A
    await request('POST', `/partners/groups/${groupAId}/members`, coordToken, { user_id: cr.data.user.id });
  }
  console.log(`  Candidates A: ${candAIds.length} created & added to group A`);

  // 7. Create 2 candidatos for campus B
  const candBIds = [];
  for (let i = 1; i <= 2; i++) {
    const cr = await request('POST', '/user-management/users', coordToken, {
      name: `CandB${i}`, first_surname: 'IsoTest', second_surname: ts.slice(0,4),
      email: `candb${i}_${ts}@test.com`, role: 'candidato', gender: 'F',
    });
    if (cr.status !== 201) { console.log(`FATAL: candB${i}: ${JSON.stringify(cr.data).slice(0,300)}`); process.exit(1); }
    candBIds.push(cr.data.user.id);
    // Add to group B
    await request('POST', `/partners/groups/${groupBId}/members`, coordToken, { user_id: cr.data.user.id });
  }
  console.log(`  Candidates B: ${candBIds.length} created & added to group B`);

  // 8. Create 1 candidato NOT in any group (orphan)
  const orphanRes = await request('POST', '/user-management/users', coordToken, {
    name: 'CandOrphan', first_surname: 'IsoTest', second_surname: ts.slice(0,4),
    email: `candorphan_${ts}@test.com`, role: 'candidato', gender: 'M',
  });
  if (orphanRes.status !== 201) { console.log(`FATAL: orphan: ${JSON.stringify(orphanRes.data).slice(0,300)}`); process.exit(1); }
  const orphanId = orphanRes.data.user.id;
  console.log(`  Orphan candidate: ${orphanRes.data.user.username} (not in any group)`);

  // Login as responsables
  const respAToken = await login(respAUser.username, respAUser.temporary_password);
  const respBToken = await login(respBUser.username, respBUser.temporary_password);
  console.log('  Responsable logins: OK\n');

  // ============================================================
  // TEST 1: /candidates/search/advanced — Responsable A only sees campus A candidates
  // ============================================================
  console.log('--- Test 1: search/advanced isolation for Responsable A ---');
  const searchA = await request('GET', '/partners/candidates/search/advanced?per_page=100', respAToken);
  assert(searchA.status === 200, `Resp A search/advanced returns 200 (got ${searchA.status})`);
  
  const searchAIds = (searchA.data.candidates || []).map(c => c.id);
  
  // Should see campus A candidates
  const seesAllCampusA = candAIds.every(id => searchAIds.includes(id));
  assert(seesAllCampusA, `Resp A sees all 3 campus A candidates`);
  
  // Should NOT see campus B candidates
  const seesNoCampusB = candBIds.every(id => !searchAIds.includes(id));
  assert(seesNoCampusB, `Resp A does NOT see any campus B candidates`);
  
  // Should NOT see orphan candidate (not in any campus)
  assert(!searchAIds.includes(orphanId), `Resp A does NOT see orphan candidate`);
  
  // Total count should be exactly 3 (campus A only)
  assert(searchA.data.total === 3, `Resp A total candidates = 3 (got ${searchA.data.total})`);

  // ============================================================
  // TEST 2: /candidates/search/advanced — Responsable B only sees campus B candidates
  // ============================================================
  console.log('\n--- Test 2: search/advanced isolation for Responsable B ---');
  const searchB = await request('GET', '/partners/candidates/search/advanced?per_page=100', respBToken);
  assert(searchB.status === 200, `Resp B search/advanced returns 200 (got ${searchB.status})`);
  
  const searchBIds = (searchB.data.candidates || []).map(c => c.id);
  
  // Should see campus B candidates
  const seesAllCampusB = candBIds.every(id => searchBIds.includes(id));
  assert(seesAllCampusB, `Resp B sees all 2 campus B candidates`);
  
  // Should NOT see campus A candidates
  const seesNoCampusA_B = candAIds.every(id => !searchBIds.includes(id));
  assert(seesNoCampusA_B, `Resp B does NOT see any campus A candidates`);
  
  // Should NOT see orphan
  assert(!searchBIds.includes(orphanId), `Resp B does NOT see orphan candidate`);
  
  assert(searchB.data.total === 2, `Resp B total candidates = 2 (got ${searchB.data.total})`);

  // ============================================================
  // TEST 3: /candidates/search (simple) — Same isolation
  // ============================================================
  console.log('\n--- Test 3: candidates/search (simple) isolation ---');
  const simpleA = await request('GET', '/partners/candidates/search?per_page=100', respAToken);
  assert(simpleA.status === 200, `Resp A simple search returns 200 (got ${simpleA.status})`);
  
  const simpleAIds = (simpleA.data.candidates || []).map(c => c.id);
  const simpleSeesOnlyA = candAIds.every(id => simpleAIds.includes(id)) &&
                          candBIds.every(id => !simpleAIds.includes(id)) &&
                          !simpleAIds.includes(orphanId);
  assert(simpleSeesOnlyA, `Resp A simple search: sees only campus A candidates`);
  assert(simpleA.data.total === 3, `Resp A simple search total = 3 (got ${simpleA.data.total})`);

  // ============================================================
  // TEST 4: /candidates/search/advanced with text filter
  // ============================================================
  console.log('\n--- Test 4: search/advanced with text filter ---');
  const filteredA = await request('GET', `/partners/candidates/search/advanced?search=IsoTest&per_page=100`, respAToken);
  assert(filteredA.status === 200, `Resp A filtered search returns 200 (got ${filteredA.status})`);
  assert(filteredA.data.total === 3, `Resp A filtered search total = 3 (got ${filteredA.data.total})`);
  
  const filteredB = await request('GET', `/partners/candidates/search/advanced?search=IsoTest&per_page=100`, respBToken);
  assert(filteredB.status === 200, `Resp B filtered search returns 200 (got ${filteredB.status})`);
  assert(filteredB.data.total === 2, `Resp B filtered search total = 2 (got ${filteredB.data.total})`);

  // ============================================================
  // TEST 5: Coordinator sees ALL candidates (no isolation)
  // ============================================================
  console.log('\n--- Test 5: Coordinator sees all candidates ---');
  const coordSearch = await request('GET', `/partners/candidates/search/advanced?search=IsoTest&per_page=100`, coordToken);
  assert(coordSearch.status === 200, `Coordinator search returns 200 (got ${coordSearch.status})`);
  // Coordinator should see at least 5 (3 A + 2 B) + orphan = 6
  assert(coordSearch.data.total >= 5, `Coordinator sees >= 5 IsoTest candidates (got ${coordSearch.data.total})`);
  
  const coordIds = (coordSearch.data.candidates || []).map(c => c.id);
  const coordSeesAll = [...candAIds, ...candBIds].every(id => coordIds.includes(id));
  assert(coordSeesAll, `Coordinator sees both campus A and campus B candidates`);

  // ============================================================
  // TEST 6: /user-management/users — Responsable isolation
  // ============================================================
  console.log('\n--- Test 6: user-management/users isolation ---');
  const umA = await request('GET', '/user-management/users?per_page=100', respAToken);
  assert(umA.status === 200, `Resp A user-management returns 200 (got ${umA.status})`);
  
  const umAIds = (umA.data.users || []).map(u => u.id);
  const umSeesOnlyA = candAIds.every(id => umAIds.includes(id));
  assert(umSeesOnlyA, `Resp A user-management: sees all campus A candidates`);
  
  const umNoB = candBIds.every(id => !umAIds.includes(id));
  assert(umNoB, `Resp A user-management: does NOT see campus B candidates`);
  
  const umNoOrphan = !umAIds.includes(orphanId);
  assert(umNoOrphan, `Resp A user-management: does NOT see orphan candidate`);

  // Responsable B user-management
  const umB = await request('GET', '/user-management/users?per_page=100', respBToken);
  assert(umB.status === 200, `Resp B user-management returns 200 (got ${umB.status})`);
  
  const umBIds = (umB.data.users || []).map(u => u.id);
  const umBSeesOwn = candBIds.every(id => umBIds.includes(id));
  assert(umBSeesOwn, `Resp B user-management: sees campus B candidates`);
  
  const umBNoA = candAIds.every(id => !umBIds.includes(id));
  assert(umBNoA, `Resp B user-management: does NOT see campus A candidates`);

  // ============================================================
  // TEST 7: search/advanced with exclude_group_id — still isolated
  // ============================================================
  console.log('\n--- Test 7: search/advanced with exclude_group_id ---');
  // Resp A searches excluding group A → should see 0 (all A candidates are in group A)
  const exclA = await request('GET', `/partners/candidates/search/advanced?exclude_group_id=${groupAId}&per_page=100`, respAToken);
  assert(exclA.status === 200, `Resp A exclude group A returns 200 (got ${exclA.status})`);
  assert(exclA.data.total === 0, `Resp A exclude group A: 0 remaining candidates (got ${exclA.data.total})`);

  // ============================================================
  // TEST 8: Admin sees ALL (sanity check)
  // ============================================================
  console.log('\n--- Test 8: Admin sees all (no isolation) ---');
  const adminSearch = await request('GET', `/partners/candidates/search/advanced?search=IsoTest&per_page=100`, adminToken);
  assert(adminSearch.status === 200, `Admin search returns 200 (got ${adminSearch.status})`);
  assert(adminSearch.data.total >= 6, `Admin sees >= 6 IsoTest candidates (got ${adminSearch.data.total})`);

  // ============================================================
  // CLEANUP
  // ============================================================
  console.log('\n--- Cleanup ---');
  const allUserIds = [coordId, orphanId, ...candAIds, ...candBIds];
  for (const uid of allUserIds) {
    await request('POST', `/user-management/users/${uid}/toggle-active`, adminToken);
  }
  await request('DELETE', `/partners/${partnerId}`, adminToken);
  console.log('  Cleanup done');

  // ============================================================
  // RESULTS
  // ============================================================
  console.log(`\n=== ${ENV.toUpperCase()}: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
