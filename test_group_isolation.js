/**
 * Test: Group Isolation per Coordinator
 * Verifies that each coordinator only sees groups belonging to their own partners/campuses.
 * Candidates are shared; groups, partners and campuses are isolated.
 */
const https = require('https');

const ENV = process.argv[2] || 'dev';
const API = ENV === 'prod'
  ? 'https://evaluaasi-motorv2-api.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api'
  : 'https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api';

let passed = 0, failed = 0, total = 0;
function assert(condition, msg) {
  total++;
  if (condition) { passed++; console.log(`  ✅ ${msg}`); }
  else { failed++; console.log(`  ❌ FAIL: ${msg}`); }
}

function req(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(API + path);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    const r = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    r.on('error', reject);
    r.on('timeout', () => { r.destroy(); reject(new Error('timeout')); });
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function login(username, password) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await req('POST', '/auth/login', null, { username, password });
      if (r.status === 200 && r.data.access_token) return r.data.access_token;
    } catch {}
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error(`Login failed for ${username}`);
}

const UID = Math.random().toString(36).slice(2, 8);

async function run() {
  console.log(`\n🔬 Test Group Isolation — ENV: ${ENV}\n`);

  // Warmup
  await req('GET', '/warmup');
  const adminToken = await login('admin', 'admin123');
  console.log('🔑 Admin logged in\n');

  // ---- Create two coordinators ----
  console.log('📋 1. Creating two coordinators...');
  const coordARes = await req('POST', '/user-management/users', adminToken, {
    name: 'GrpCoordA', first_surname: 'Test', second_surname: UID,
    email: `grpcoorA_${UID}@test.com`, role: 'coordinator'
  });
  assert(coordARes.status === 201, `CoordA created (${coordARes.status}) ${JSON.stringify(coordARes.data).slice(0,200)}`);
  console.log('   CoordA raw:', JSON.stringify(coordARes.data).slice(0,300));
  const coordA = coordARes.data.user || coordARes.data;
  const coordAId = coordA.id;
  const coordAUser = coordA.username;
  const coordAPass = coordARes.data.temporary_password || coordARes.data.generated_password || coordARes.data.password;

  const coordBRes = await req('POST', '/user-management/users', adminToken, {
    name: 'GrpCoordB', first_surname: 'Test', second_surname: UID,
    email: `grpcoorB_${UID}@test.com`, role: 'coordinator'
  });
  assert(coordBRes.status === 201, `CoordB created (${coordBRes.status})`);
  const coordB = coordBRes.data.user || coordBRes.data;
  const coordBId = coordB.id;
  const coordBUser = coordB.username;
  const coordBPass = coordBRes.data.temporary_password || coordBRes.data.generated_password || coordBRes.data.password;

  console.log(`   CoordA: ${coordAUser} (${coordAId})`);
  console.log(`   CoordB: ${coordBUser} (${coordBId})`);

  // Login as coordinators
  const tokenA = await login(coordAUser, coordAPass);
  const tokenB = await login(coordBUser, coordBPass);
  console.log('   Both coordinators logged in\n');

  // ---- Create partners (each coordinator creates their own) ----
  console.log('📋 2. Creating partners...');
  const partnerARes = await req('POST', '/partners', tokenA, {
    name: `PartnerA_${UID}`, description: 'Test partner A', is_active: true
  });
  assert(partnerARes.status === 201, `PartnerA created by CoordA (${partnerARes.status})`);
  const partnerAId = partnerARes.data.id || partnerARes.data.partner?.id;

  const partnerBRes = await req('POST', '/partners', tokenB, {
    name: `PartnerB_${UID}`, description: 'Test partner B', is_active: true
  });
  assert(partnerBRes.status === 201, `PartnerB created by CoordB (${partnerBRes.status})`);
  const partnerBId = partnerBRes.data.id || partnerBRes.data.partner?.id;

  // ---- Create campuses ----
  console.log('\n📋 3. Creating campuses...');
  const campusARes = await req('POST', `/partners/${partnerAId}/campuses`, tokenA, {
    name: `CampusA_${UID}`, country: 'Estados Unidos', state_name: 'Texas', city: 'Dallas',
    director_name: 'DirA', director_first_surname: 'Test', director_second_surname: 'A',
    director_email: `dira_${UID}@test.com`, director_phone: '5551234567',
    director_gender: 'M', director_date_of_birth: '1990-01-15'
  });
  assert(campusARes.status === 201, `CampusA created by CoordA (${campusARes.status}) ${JSON.stringify(campusARes.data).slice(0,300)}`);
  const campusAId = campusARes.data.campus?.id || campusARes.data.id;

  const campusBRes = await req('POST', `/partners/${partnerBId}/campuses`, tokenB, {
    name: `CampusB_${UID}`, country: 'Estados Unidos', state_name: 'California', city: 'LA',
    director_name: 'DirB', director_first_surname: 'Test', director_second_surname: 'B',
    director_email: `dirb_${UID}@test.com`, director_phone: '5559876543',
    director_gender: 'F', director_date_of_birth: '1985-06-20'
  });
  assert(campusBRes.status === 201, `CampusB created by CoordB (${campusBRes.status})`);
  const campusBId = campusBRes.data.campus?.id || campusBRes.data.id;

  // ---- Create groups ----
  console.log('\n📋 4. Creating groups...');
  const groupARes = await req('POST', `/partners/campuses/${campusAId}/groups`, tokenA, {
    name: `GrupoA_${UID}`, description: 'Group of CoordA'
  });
  assert(groupARes.status === 201, `GroupA created by CoordA (${groupARes.status})`);
  const groupAId = groupARes.data.group?.id || groupARes.data.id;
  console.log(`   GroupA: id=${groupAId}`);

  const groupBRes = await req('POST', `/partners/campuses/${campusBId}/groups`, tokenB, {
    name: `GrupoB_${UID}`, description: 'Group of CoordB'
  });
  assert(groupBRes.status === 201, `GroupB created by CoordB (${groupBRes.status})`);
  const groupBId = groupBRes.data.group?.id || groupBRes.data.id;
  console.log(`   GroupB: id=${groupBId}`);

  // ===== ISOLATION TESTS =====

  // ---- Test: list-all endpoint ----
  console.log('\n🔍 5. Testing /groups/list-all isolation...');
  const allA = await req('GET', '/partners/groups/list-all', tokenA);
  assert(allA.status === 200, `CoordA list-all returned 200`);
  const allAGroupIds = (allA.data.groups || []).map(g => g.id);
  console.log(`   CoordA sees groups: ${JSON.stringify(allAGroupIds)} (looking for ${groupAId})`);
  assert(allAGroupIds.includes(groupAId), `CoordA sees their own GroupA in list-all`);
  assert(!allAGroupIds.includes(groupBId), `CoordA does NOT see CoordB's GroupB in list-all`);

  const allB = await req('GET', '/partners/groups/list-all', tokenB);
  assert(allB.status === 200, `CoordB list-all returned 200`);
  const allBGroupIds = (allB.data.groups || []).map(g => g.id);
  assert(allBGroupIds.includes(groupBId), `CoordB sees their own GroupB in list-all`);
  assert(!allBGroupIds.includes(groupAId), `CoordB does NOT see CoordA's GroupA in list-all`);

  // ---- Test: search endpoint ----
  console.log('\n🔍 6. Testing /groups/search isolation...');
  const searchA = await req('GET', `/partners/groups/search?search=${UID}`, tokenA);
  assert(searchA.status === 200, `CoordA search returned 200`);
  const searchAIds = (searchA.data.groups || []).map(g => g.id);
  assert(searchAIds.includes(groupAId), `CoordA finds their own GroupA in search`);
  assert(!searchAIds.includes(groupBId), `CoordA does NOT find CoordB's GroupB in search`);

  const searchB = await req('GET', `/partners/groups/search?search=${UID}`, tokenB);
  assert(searchB.status === 200, `CoordB search returned 200`);
  const searchBIds = (searchB.data.groups || []).map(g => g.id);
  assert(searchBIds.includes(groupBId), `CoordB finds their own GroupB in search`);
  assert(!searchBIds.includes(groupAId), `CoordB does NOT find CoordA's GroupA in search`);

  // ---- Test: campus groups endpoint ----
  console.log('\n🔍 7. Testing /campuses/<id>/groups isolation...');
  const campGrpA = await req('GET', `/partners/campuses/${campusAId}/groups`, tokenA);
  assert(campGrpA.status === 200, `CoordA can get groups from their own campus`);
  const campGrpAIds = (campGrpA.data.groups || []).map(g => g.id);
  assert(campGrpAIds.includes(groupAId), `CoordA sees GroupA in their campus`);

  // CoordB should NOT have access to CoordA's campus
  const campGrpCross = await req('GET', `/partners/campuses/${campusAId}/groups`, tokenB);
  assert(campGrpCross.status === 403, `CoordB gets 403 trying to access CoordA's campus groups (${campGrpCross.status})`);

  // ---- Test: dashboard isolation ----
  console.log('\n🔍 8. Testing /partners/dashboard group count isolation...');
  const dashA = await req('GET', '/partners/dashboard', tokenA);
  assert(dashA.status === 200, `CoordA dashboard returned 200`);
  const dashAGroups = dashA.data.stats?.total_groups || 0;
  assert(dashAGroups >= 1, `CoordA dashboard shows at least 1 group (got ${dashAGroups})`);

  const dashB = await req('GET', '/partners/dashboard', tokenB);
  assert(dashB.status === 200, `CoordB dashboard returned 200`);
  const dashBGroups = dashB.data.stats?.total_groups || 0;
  assert(dashBGroups >= 1, `CoordB dashboard shows at least 1 group (got ${dashBGroups})`);

  // Cross-check: each coordinator sees only their own count
  // (Since we created exactly 1 group each, both should see exactly 1)
  assert(dashAGroups === 1, `CoordA sees exactly 1 group in dashboard (got ${dashAGroups})`);
  assert(dashBGroups === 1, `CoordB sees exactly 1 group in dashboard (got ${dashBGroups})`);

  // ---- Test: direct group access ----
  console.log('\n🔍 9. Testing direct group access isolation...');
  const grpAccA = await req('GET', `/partners/groups/${groupAId}`, tokenA);
  assert(grpAccA.status === 200, `CoordA can access their own GroupA directly`);

  const grpCross = await req('GET', `/partners/groups/${groupAId}`, tokenB);
  assert(grpCross.status === 403, `CoordB gets 403 trying to access CoordA's GroupA directly (${grpCross.status})`);

  const grpAccB = await req('GET', `/partners/groups/${groupBId}`, tokenB);
  assert(grpAccB.status === 200, `CoordB can access their own GroupB directly`);

  const grpCross2 = await req('GET', `/partners/groups/${groupBId}`, tokenA);
  assert(grpCross2.status === 403, `CoordA gets 403 trying to access CoordB's GroupB directly (${grpCross2.status})`);

  // ---- Summary ----
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed}/${total} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
