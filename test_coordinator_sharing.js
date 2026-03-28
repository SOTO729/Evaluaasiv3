/**
 * Integration test: Coordinator Candidate Sharing
 * Verifies that candidatos are shared across ALL coordinators.
 * Coordinators should see ALL candidatos (not just their own), but
 * responsables/auxiliares should remain scoped to their coordinator.
 *
 * Endpoints tested:
 *  - GET  /user-management/users          (coordinator sees all candidatos)
 *  - GET  /user-management/users/stats    (stats include all candidatos)
 *  - GET  /partners/candidates/search/advanced (coordinator sees all candidatos)
 *
 * Run: node test_coordinator_sharing.js dev|prod
 */
const https = require('https');

const ENV = process.argv[2] || 'dev';
const API = ENV === 'prod'
  ? 'https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api'
  : 'https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api';

function request(method, path, token, body, retries = 2) {
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
    req.on('error', async (err) => {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 3000));
        resolve(request(method, path, token, body, retries - 1));
      } else { reject(err); }
    });
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

async function warmup() {
  for (let i = 0; i < 5; i++) {
    try {
      const res = await request('GET', '/warmup', null);
      if (res.status === 200) { console.log('Warmup OK'); return; }
    } catch {}
    await new Promise(r => setTimeout(r, 5000));
  }
  console.log('Warmup: no response after 5 retries, continuing anyway');
}

async function main() {
  console.log(`=== Coordinator Candidate Sharing Test — ${ENV.toUpperCase()} ===`);
  console.log(`API: ${API}\n`);

  await warmup();

  const adminToken = await login('admin', 'admin123');
  console.log('Admin login: OK');

  const ts = Date.now().toString(36);

  // ============================================================
  // SETUP: Create 2 coordinators, each with their own partner/campus/candidates
  // ============================================================
  console.log('\n--- Setup ---');

  // 1. Coordinator A
  const coordARes = await request('POST', '/user-management/users', adminToken, {
    name: 'CoordShareA', first_surname: 'Test', second_surname: ts.slice(0, 4),
    email: `coordsharea_${ts}@test.com`, role: 'coordinator',
  });
  if (coordARes.status !== 201) { console.log(`FATAL: coordA: ${JSON.stringify(coordARes.data).slice(0, 300)}`); process.exit(1); }
  const coordAId = coordARes.data.user.id;
  const coordAToken = await login(coordARes.data.user.username, coordARes.data.temporary_password);
  console.log(`  Coordinator A: ${coordARes.data.user.username} (id=${coordAId})`);

  // 2. Coordinator B
  const coordBRes = await request('POST', '/user-management/users', adminToken, {
    name: 'CoordShareB', first_surname: 'Test', second_surname: ts.slice(0, 4),
    email: `coordshareb_${ts}@test.com`, role: 'coordinator',
  });
  if (coordBRes.status !== 201) { console.log(`FATAL: coordB: ${JSON.stringify(coordBRes.data).slice(0, 300)}`); process.exit(1); }
  const coordBId = coordBRes.data.user.id;
  const coordBToken = await login(coordBRes.data.user.username, coordBRes.data.temporary_password);
  console.log(`  Coordinator B: ${coordBRes.data.user.username} (id=${coordBId})`);

  // 3. Partner & Campus for Coord A
  const partnerARes = await request('POST', '/partners', coordAToken, {
    name: `PartShareA_${ts}`, country: 'Mexico',
  });
  if (partnerARes.status !== 201) { console.log(`FATAL: partnerA: ${JSON.stringify(partnerARes.data).slice(0, 300)}`); process.exit(1); }
  const partnerAId = partnerARes.data.partner.id;

  const campusARes = await request('POST', `/partners/${partnerAId}/campuses`, coordAToken, {
    name: `CampShareA_${ts}`, state_name: 'Jalisco',
    director_name: 'DirShareA', director_first_surname: 'Test', director_second_surname: 'A',
    director_email: `dirsharea_${ts}@test.com`, director_phone: '3310001111',
    director_gender: 'M', director_curp: `SHA${ts.toUpperCase().padEnd(15, 'X')}`.slice(0, 18),
    director_date_of_birth: '1990-01-15',
  });
  if (campusARes.status !== 201) { console.log(`FATAL: campusA: ${JSON.stringify(campusARes.data).slice(0, 300)}`); process.exit(1); }
  const campusAId = campusARes.data.campus.id;
  const respAUser = campusARes.data.director_user;
  console.log(`  Partner/Campus A created. Resp A: ${respAUser.username}`);

  // 4. Partner & Campus for Coord B
  const partnerBRes = await request('POST', '/partners', coordBToken, {
    name: `PartShareB_${ts}`, country: 'Mexico',
  });
  if (partnerBRes.status !== 201) { console.log(`FATAL: partnerB: ${JSON.stringify(partnerBRes.data).slice(0, 300)}`); process.exit(1); }
  const partnerBId = partnerBRes.data.partner.id;

  const campusBRes = await request('POST', `/partners/${partnerBId}/campuses`, coordBToken, {
    name: `CampShareB_${ts}`, state_name: 'Nuevo León',
    director_name: 'DirShareB', director_first_surname: 'Test', director_second_surname: 'B',
    director_email: `dirshareb_${ts}@test.com`, director_phone: '8110002222',
    director_gender: 'F', director_curp: `SHB${ts.toUpperCase().padEnd(15, 'Y')}`.slice(0, 18),
    director_date_of_birth: '1985-06-20',
  });
  if (campusBRes.status !== 201) { console.log(`FATAL: campusB: ${JSON.stringify(campusBRes.data).slice(0, 300)}`); process.exit(1); }
  const campusBId = campusBRes.data.campus.id;
  const respBUser = campusBRes.data.director_user;
  console.log(`  Partner/Campus B created. Resp B: ${respBUser.username}`);

  // 5. Groups
  const groupARes = await request('POST', `/partners/campuses/${campusAId}/groups`, coordAToken, { name: `GrpShareA_${ts}` });
  if (groupARes.status !== 201) { console.log(`FATAL: groupA: ${JSON.stringify(groupARes.data).slice(0, 300)}`); process.exit(1); }
  const groupAId = groupARes.data.group.id;

  const groupBRes = await request('POST', `/partners/campuses/${campusBId}/groups`, coordBToken, { name: `GrpShareB_${ts}` });
  if (groupBRes.status !== 201) { console.log(`FATAL: groupB: ${JSON.stringify(groupBRes.data).slice(0, 300)}`); process.exit(1); }
  const groupBId = groupBRes.data.group.id;

  // 6. Candidates for Coord A (3 candidatos)
  const candAIds = [];
  for (let i = 1; i <= 3; i++) {
    const cr = await request('POST', '/user-management/users', coordAToken, {
      name: `CandShareA${i}`, first_surname: 'ShareTest', second_surname: ts.slice(0, 4),
      email: `candsharea${i}_${ts}@test.com`, role: 'candidato', gender: 'M',
    });
    if (cr.status !== 201) { console.log(`FATAL: candA${i}: ${JSON.stringify(cr.data).slice(0, 300)}`); process.exit(1); }
    candAIds.push(cr.data.user.id);
    await request('POST', `/partners/groups/${groupAId}/members`, coordAToken, { user_id: cr.data.user.id });
  }
  console.log(`  Coord A candidates: ${candAIds.length} created`);

  // 7. Candidates for Coord B (2 candidatos)
  const candBIds = [];
  for (let i = 1; i <= 2; i++) {
    const cr = await request('POST', '/user-management/users', coordBToken, {
      name: `CandShareB${i}`, first_surname: 'ShareTest', second_surname: ts.slice(0, 4),
      email: `candshareb${i}_${ts}@test.com`, role: 'candidato', gender: 'F',
    });
    if (cr.status !== 201) { console.log(`FATAL: candB${i}: ${JSON.stringify(cr.data).slice(0, 300)}`); process.exit(1); }
    candBIds.push(cr.data.user.id);
    await request('POST', `/partners/groups/${groupBId}/members`, coordBToken, { user_id: cr.data.user.id });
  }
  console.log(`  Coord B candidates: ${candBIds.length} created`);

  // 8. Responsable unique to Coord A (created by admin, assigned to coord A)
  // Already created via campus director: respAUser belongs to Coord A
  // Already created via campus director: respBUser belongs to Coord B

  console.log('  Setup complete.\n');

  // ============================================================
  // TEST 1: /user-management/users — Coord A sees ALL candidatos (including B's)
  // ============================================================
  console.log('--- Test 1: Coord A sees all candidatos via user-management/users ---');
  const usersA = await request('GET', '/user-management/users?per_page=200&role=candidato', coordAToken);
  assert(usersA.status === 200, `Coord A users endpoint returns 200 (got ${usersA.status})`);

  const usersAIds = (usersA.data.users || []).map(u => u.id);

  // Coord A sees its own candidates
  const aSeesOwnCands = candAIds.every(id => usersAIds.includes(id));
  assert(aSeesOwnCands, `Coord A sees its own 3 candidates`);

  // Coord A ALSO sees Coord B's candidates
  const aSeesBCands = candBIds.every(id => usersAIds.includes(id));
  assert(aSeesBCands, `Coord A sees Coord B's 2 candidates (shared)`);

  // ============================================================
  // TEST 2: /user-management/users — Coord B sees ALL candidatos (including A's)
  // ============================================================
  console.log('\n--- Test 2: Coord B sees all candidatos via user-management/users ---');
  const usersB = await request('GET', '/user-management/users?per_page=200&role=candidato', coordBToken);
  assert(usersB.status === 200, `Coord B users endpoint returns 200 (got ${usersB.status})`);

  const usersBIds = (usersB.data.users || []).map(u => u.id);

  // Coord B sees its own candidates
  const bSeesOwnCands = candBIds.every(id => usersBIds.includes(id));
  assert(bSeesOwnCands, `Coord B sees its own 2 candidates`);

  // Coord B ALSO sees Coord A's candidates
  const bSeesACands = candAIds.every(id => usersBIds.includes(id));
  assert(bSeesACands, `Coord B sees Coord A's 3 candidates (shared)`);

  // Both coordinators should see the same candidato count
  assert(usersAIds.length === usersBIds.length, `Both coordinators see same candidate count (A=${usersAIds.length}, B=${usersBIds.length})`);

  // ============================================================
  // TEST 3: Responsables remain scoped to their coordinator
  // ============================================================
  console.log('\n--- Test 3: Responsables NOT shared (scoped to coordinator) ---');
  const usersAAll = await request('GET', '/user-management/users?per_page=200', coordAToken);
  const usersAAllList = usersAAll.data.users || [];
  const respInA = usersAAllList.filter(u => u.role === 'responsable');
  const respAIds = respInA.map(u => u.id);

  // Coord A should see its own responsable
  assert(respAIds.includes(respAUser.id), `Coord A sees its own responsable (${respAUser.username})`);

  // Coord A should NOT see Coord B's responsable
  assert(!respAIds.includes(respBUser.id), `Coord A does NOT see Coord B's responsable`);

  const usersBAll = await request('GET', '/user-management/users?per_page=200', coordBToken);
  const usersBAllList = usersBAll.data.users || [];
  const respInB = usersBAllList.filter(u => u.role === 'responsable');
  const respBIds = respInB.map(u => u.id);

  // Coord B should see its own responsable
  assert(respBIds.includes(respBUser.id), `Coord B sees its own responsable (${respBUser.username})`);

  // Coord B should NOT see Coord A's responsable
  assert(!respBIds.includes(respAUser.id), `Coord B does NOT see Coord A's responsable`);

  // ============================================================
  // TEST 4: /user-management/users/stats — includes all candidatos
  // ============================================================
  console.log('\n--- Test 4: Stats include all candidatos ---');
  const statsA = await request('GET', '/user-management/stats', coordAToken);
  assert(statsA.status === 200, `Coord A stats returns 200 (got ${statsA.status})`);

  const statsB = await request('GET', '/user-management/stats', coordBToken);
  assert(statsB.status === 200, `Coord B stats returns 200 (got ${statsB.status})`);

  // Both should report the same total users (candidatos are shared)
  const totalA = statsA.data.total_users || statsA.data.total || 0;
  const totalB = statsB.data.total_users || statsB.data.total || 0;
  assert(totalA === totalB, `Stats total_users equal for both coordinators (A=${totalA}, B=${totalB})`);

  // The candidato count in stats should be >= 5 (our test candidates)
  const getRoleCount = (data, role) => {
    const entry = (data.users_by_role || []).find(r => r.role === role);
    return entry ? entry.count : 0;
  };
  const candCountA = getRoleCount(statsA.data, 'candidato');
  const candCountB = getRoleCount(statsB.data, 'candidato');
  assert(candCountA >= 5, `Coord A stats: candidato count >= 5 (got ${candCountA})`);
  assert(candCountB >= 5, `Coord B stats: candidato count >= 5 (got ${candCountB})`);
  assert(candCountA === candCountB, `Both coordinators see same candidato count in stats (A=${candCountA}, B=${candCountB})`);

  // ============================================================
  // TEST 5: /partners/candidates/search/advanced — Coord sees all candidatos
  // ============================================================
  console.log('\n--- Test 5: search/advanced — coordinators see all candidates ---');
  const searchA = await request('GET', '/partners/candidates/search/advanced?per_page=200', coordAToken);
  assert(searchA.status === 200, `Coord A search/advanced returns 200 (got ${searchA.status})`);

  const searchAIds = (searchA.data.candidates || []).map(c => c.id);

  // Coord A sees own candidates
  const searchAOwn = candAIds.every(id => searchAIds.includes(id));
  assert(searchAOwn, `Coord A search/advanced sees own 3 candidates`);

  // Coord A sees B's candidates
  const searchAOther = candBIds.every(id => searchAIds.includes(id));
  assert(searchAOther, `Coord A search/advanced sees Coord B's 2 candidates`);

  const searchB = await request('GET', '/partners/candidates/search/advanced?per_page=200', coordBToken);
  assert(searchB.status === 200, `Coord B search/advanced returns 200 (got ${searchB.status})`);

  const searchBIds = (searchB.data.candidates || []).map(c => c.id);

  // Coord B sees own candidates
  const searchBOwn = candBIds.every(id => searchBIds.includes(id));
  assert(searchBOwn, `Coord B search/advanced sees own 2 candidates`);

  // Coord B sees A's candidates
  const searchBOther = candAIds.every(id => searchBIds.includes(id));
  assert(searchBOther, `Coord B search/advanced sees Coord A's 3 candidates`);

  // Both coordinators should see the same total
  const searchTotalA = searchA.data.total || searchAIds.length;
  const searchTotalB = searchB.data.total || searchBIds.length;
  assert(searchTotalA === searchTotalB, `search/advanced total equal for both (A=${searchTotalA}, B=${searchTotalB})`);

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  console.log(`${'='.repeat(50)}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
