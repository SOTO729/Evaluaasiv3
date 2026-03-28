/**
 * Integration test for candidato branding feature
 * Tests that candidatos inherit branding from their most recent campus assignment
 * Run: node test_candidato_branding.js dev|prod
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
    if (i < retries - 1) await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(`Login failed for ${username}`);
}

let passed = 0, failed = 0;
function assert(condition, msg) {
  if (condition) { passed++; console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

async function main() {
  console.log(`=== Candidato Branding Test — ${ENV.toUpperCase()} ===`);
  console.log(`API: ${API}\n`);

  const adminToken = await login('admin', 'admin123');
  console.log('Admin login: OK');

  const ts = Date.now().toString(36);

  // ============================================================
  // SETUP: Create coordinator → partner → campus (with branding)
  // ============================================================
  console.log('\n--- Setup ---');

  // 1. Create coordinator
  const coordRes = await request('POST', '/user-management/users', adminToken, {
    name: 'BrandCoord', first_surname: 'Test', second_surname: ts.slice(0, 4),
    email: `bcoord_${ts}@test.com`, role: 'coordinator',
  });
  if (coordRes.status !== 201) {
    console.log(`FATAL: Could not create coordinator: ${JSON.stringify(coordRes.data).slice(0, 300)}`);
    process.exit(1);
  }
  const coordId = coordRes.data.user.id;
  const coordToken = await login(coordRes.data.user.username, coordRes.data.temporary_password);
  console.log(`  Coordinator: ${coordRes.data.user.username}`);

  // 2. Create partner
  const partnerRes = await request('POST', '/partners', coordToken, {
    name: `BrandPartner_${ts}`, country: 'Mexico',
  });
  if (partnerRes.status !== 201) {
    console.log(`FATAL: Could not create partner: ${JSON.stringify(partnerRes.data).slice(0, 300)}`);
    process.exit(1);
  }
  const partnerId = partnerRes.data.partner.id;
  console.log(`  Partner: ${partnerRes.data.partner.name} (${partnerId})`);

  // 3. Create campus A (will have branding)
  const campusARes = await request('POST', `/partners/${partnerId}/campuses`, coordToken, {
    name: `CampusBrand_${ts}`, state_name: 'Jalisco',
    director_name: 'Dir', director_first_surname: 'Test', director_second_surname: 'A',
    director_email: `dir_a_${ts}@test.com`, director_phone: '3310001111',
    director_gender: 'M', director_curp: `TESA${ts.toUpperCase().padEnd(14, 'X')}`.slice(0, 18),
    director_date_of_birth: '1990-01-15',
  });
  if (campusARes.status !== 201) {
    console.log(`FATAL: Could not create campus A: ${JSON.stringify(campusARes.data).slice(0, 500)}`);
    process.exit(1);
  }
  const campusAId = campusARes.data.campus.id;
  const respAUser = campusARes.data.director_user;
  console.log(`  Campus A: ${campusARes.data.campus.name} (${campusAId})`);
  console.log(`  Responsable A: ${respAUser.username} / ${respAUser.temporary_password}`);

  // 4. Create campus B (will have DIFFERENT branding — for "most recent" test)
  const campusBRes = await request('POST', `/partners/${partnerId}/campuses`, coordToken, {
    name: `CampusBrand2_${ts}`, state_name: 'Nuevo León',
    director_name: 'Dir', director_first_surname: 'Test', director_second_surname: 'B',
    director_email: `dir_b_${ts}@test.com`, director_phone: '8110002222',
    director_gender: 'F', director_curp: `TESB${ts.toUpperCase().padEnd(14, 'Y')}`.slice(0, 18),
    director_date_of_birth: '1985-06-20',
  });
  if (campusBRes.status !== 201) {
    console.log(`FATAL: Could not create campus B: ${JSON.stringify(campusBRes.data).slice(0, 500)}`);
    process.exit(1);
  }
  const campusBId = campusBRes.data.campus.id;
  const respBUser = campusBRes.data.director_user;
  console.log(`  Campus B: ${campusBRes.data.campus.name} (${campusBId})`);
  console.log(`  Responsable B: ${respBUser.username} / ${respBUser.temporary_password}`);

  // 5. Login as responsable A and set branding (red theme)
  const respAToken = await login(respAUser.username, respAUser.temporary_password);
  const brandARes = await request('PUT', '/partners/mi-plantel/branding', respAToken, {
    primary_color: '#e11d48', secondary_color: '#0891b2',
  });
  console.log(`  Branding A set: ${brandARes.status} (primary=#e11d48, secondary=#0891b2)`);
  assert(brandARes.status === 200, `Set branding on campus A = 200 (got ${brandARes.status})`);

  // 6. Login as responsable B and set branding (green theme)
  const respBToken = await login(respBUser.username, respBUser.temporary_password);
  const brandBRes = await request('PUT', '/partners/mi-plantel/branding', respBToken, {
    primary_color: '#059669',
  });
  console.log(`  Branding B set: ${brandBRes.status} (primary=#059669)`);
  assert(brandBRes.status === 200, `Set branding on campus B = 200 (got ${brandBRes.status})`);

  // 7. Create group in campus A
  const groupARes = await request('POST', `/partners/campuses/${campusAId}/groups`, coordToken, {
    name: `GroupA_${ts}`,
  });
  if (groupARes.status !== 201) {
    console.log(`FATAL: Could not create group A: ${JSON.stringify(groupARes.data).slice(0, 300)}`);
    process.exit(1);
  }
  const groupAId = groupARes.data.group.id;
  console.log(`  Group A: ${groupARes.data.group.name} (${groupAId})`);

  // 8. Create group in campus B
  const groupBRes = await request('POST', `/partners/campuses/${campusBId}/groups`, coordToken, {
    name: `GroupB_${ts}`,
  });
  if (groupBRes.status !== 201) {
    console.log(`FATAL: Could not create group B: ${JSON.stringify(groupBRes.data).slice(0, 300)}`);
    process.exit(1);
  }
  const groupBId = groupBRes.data.group.id;
  console.log(`  Group B: ${groupBRes.data.group.name} (${groupBId})`);

  // 9. Create candidato
  const candRes = await request('POST', '/user-management/users', coordToken, {
    name: 'CandBrand', first_surname: 'Test', second_surname: ts.slice(0, 4),
    email: `cand_brand_${ts}@test.com`, role: 'candidato', gender: 'M',
  });
  if (candRes.status !== 201) {
    console.log(`FATAL: Could not create candidato: ${JSON.stringify(candRes.data).slice(0, 300)}`);
    process.exit(1);
  }
  const candId = candRes.data.user.id;
  const candUsername = candRes.data.user.username;
  const candPassword = candRes.data.temporary_password;
  console.log(`  Candidato: ${candUsername} (${candId.slice(0, 8)})`);

  // 10. Create a second candidato (never assigned to any group — control)
  const cand2Res = await request('POST', '/user-management/users', coordToken, {
    name: 'CandNone', first_surname: 'Test', second_surname: ts.slice(0, 4),
    email: `cand_none_${ts}@test.com`, role: 'candidato', gender: 'F',
  });
  if (cand2Res.status !== 201) {
    console.log(`FATAL: Could not create candidato2: ${JSON.stringify(cand2Res.data).slice(0, 300)}`);
    process.exit(1);
  }
  const cand2Username = cand2Res.data.user.username;
  const cand2Password = cand2Res.data.temporary_password;
  const cand2Id = cand2Res.data.user.id;
  console.log(`  Candidato (no group): ${cand2Username} (${cand2Id.slice(0, 8)})`);

  // ============================================================
  // TEST 1: Candidato without group gets no branding
  // ============================================================
  console.log('\n--- Test 1: Candidato without group → branding null ---');
  const cand2Token = await login(cand2Username, cand2Password);
  const noBrandRes = await request('GET', '/partners/candidato-branding', cand2Token);
  assert(noBrandRes.status === 200, `No-group candidato status = 200 (got ${noBrandRes.status})`);
  assert(noBrandRes.data.branding === null, `No-group candidato branding = null (got ${JSON.stringify(noBrandRes.data.branding)})`);

  // ============================================================
  // TEST 2: Non-candidato user gets 403
  // ============================================================
  console.log('\n--- Test 2: Non-candidato roles → 403 ---');
  const adminBrandRes = await request('GET', '/partners/candidato-branding', adminToken);
  assert(adminBrandRes.status === 403, `Admin gets 403 (got ${adminBrandRes.status})`);

  const coordBrandRes = await request('GET', '/partners/candidato-branding', coordToken);
  assert(coordBrandRes.status === 403, `Coordinator gets 403 (got ${coordBrandRes.status})`);

  const respBrandRes = await request('GET', '/partners/candidato-branding', respAToken);
  assert(respBrandRes.status === 403, `Responsable gets 403 (got ${respBrandRes.status})`);

  // ============================================================
  // TEST 3: Add candidato to group A → gets campus A branding
  // ============================================================
  console.log('\n--- Test 3: Candidato in campus A → gets A branding ---');
  const addMemberARes = await request('POST', `/partners/groups/${groupAId}/members`, coordToken, {
    user_id: candId,
  });
  assert(addMemberARes.status === 201, `Add candidato to group A = 201 (got ${addMemberARes.status})`);

  const candToken = await login(candUsername, candPassword);
  const brandFromA = await request('GET', '/partners/candidato-branding', candToken);
  assert(brandFromA.status === 200, `Candidato in A: status = 200 (got ${brandFromA.status})`);
  assert(brandFromA.data.branding !== null, `Candidato in A: branding is not null`);
  assert(brandFromA.data.branding?.primary_color === '#e11d48', `Candidato in A: primary_color = #e11d48 (got ${brandFromA.data.branding?.primary_color})`);
  assert(brandFromA.data.branding?.secondary_color === '#0891b2', `Candidato in A: secondary_color = #0891b2 (got ${brandFromA.data.branding?.secondary_color})`);
  assert(brandFromA.data.branding?.campus_name?.includes('CampusBrand_'), `Candidato in A: campus_name includes 'CampusBrand_' (got ${brandFromA.data.branding?.campus_name})`);
  assert(brandFromA.data.branding?.logo_url !== undefined, `Candidato in A: logo_url field exists`);

  // ============================================================
  // TEST 4: Add candidato to group B (more recent) → gets campus B branding
  // ============================================================
  console.log('\n--- Test 4: Candidato also in campus B (newest) → gets B branding ---');

  // Small delay to ensure joined_at is different
  await new Promise(r => setTimeout(r, 1500));

  const addMemberBRes = await request('POST', `/partners/groups/${groupBId}/members`, coordToken, {
    user_id: candId,
  });
  assert(addMemberBRes.status === 201, `Add candidato to group B = 201 (got ${addMemberBRes.status})`);

  const brandFromB = await request('GET', '/partners/candidato-branding', candToken);
  assert(brandFromB.status === 200, `Candidato in B: status = 200 (got ${brandFromB.status})`);
  assert(brandFromB.data.branding !== null, `Candidato in B: branding is not null`);
  assert(brandFromB.data.branding?.primary_color === '#059669', `Most recent campus B: primary_color = #059669 (got ${brandFromB.data.branding?.primary_color})`);
  assert(brandFromB.data.branding?.secondary_color === null || brandFromB.data.branding?.secondary_color === undefined || brandFromB.data.branding?.secondary_color === null,
    `Campus B has no secondary_color (got ${brandFromB.data.branding?.secondary_color})`);
  assert(brandFromB.data.branding?.campus_name?.includes('CampusBrand2_'), `Most recent campus B name (got ${brandFromB.data.branding?.campus_name})`);

  // ============================================================
  // TEST 5: Unauthenticated request → 401
  // ============================================================
  console.log('\n--- Test 5: Unauthenticated → 401 ---');
  const unauthRes = await request('GET', '/partners/candidato-branding', null);
  assert(unauthRes.status === 401 || unauthRes.status === 422, `Unauthenticated = 401/422 (got ${unauthRes.status})`);

  // ============================================================
  // CLEANUP
  // ============================================================
  console.log('\n--- Cleanup ---');
  // Deactivate test users
  await request('POST', `/user-management/users/${candId}/toggle-active`, adminToken);
  await request('POST', `/user-management/users/${cand2Id}/toggle-active`, adminToken);
  await request('POST', `/user-management/users/${coordId}/toggle-active`, adminToken);
  // Delete partner (cascades to campuses, groups, members)
  await request('DELETE', `/partners/${partnerId}`, adminToken);
  console.log('  Cleanup done');

  // ============================================================
  // RESULTS
  // ============================================================
  console.log(`\n=== ${ENV.toUpperCase()}: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
