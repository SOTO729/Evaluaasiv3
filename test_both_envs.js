/**
 * Integration test for multi-tenant coordinator isolation
 * Run: node test_both_envs.js dev|prod
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
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
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

async function login(username, password) {
  const res = await request('POST', '/auth/login', null, { username, password });
  if (!res.data.access_token) throw new Error(`Login failed for ${username}: ${JSON.stringify(res.data)}`);
  return res.data.access_token;
}

let passed = 0, failed = 0;
function assert(condition, msg) {
  if (condition) { passed++; console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

async function main() {
  console.log(`=== Testing ${ENV.toUpperCase()} ===`);
  console.log(`API: ${API}\n`);

  const adminToken = await login('admin', 'admin123');
  console.log('Admin login: OK');

  const ts = Date.now().toString(36);

  // Create two test coordinators
  const c1Res = await request('POST', '/user-management/users', adminToken, {
    username: `tc1_${ts}`, email: `tc1_${ts}@test.com`, password: 'Tc1!Pass',
    name: 'TC', first_surname: 'One', second_surname: 'T', role: 'coordinator',
  });
  const c2Res = await request('POST', '/user-management/users', adminToken, {
    username: `tc2_${ts}`, email: `tc2_${ts}@test.com`, password: 'Tc2!Pass',
    name: 'TC', first_surname: 'Two', second_surname: 'T', role: 'coordinator',
  });

  if (c1Res.status !== 201 || c2Res.status !== 201) {
    console.log(`FATAL: Could not create coordinators: ${JSON.stringify(c1Res.data).slice(0,300)}`);
    process.exit(1);
  }

  const c1Id = c1Res.data.user.id;
  const c2Id = c2Res.data.user.id;
  const token1 = await login(c1Res.data.user.username, c1Res.data.temporary_password);
  const token2 = await login(c2Res.data.user.username, c2Res.data.temporary_password);
  console.log(`Coordinators: ${c1Res.data.user.username}, ${c2Res.data.user.username}\n`);

  // --- PARTNER ISOLATION ---
  console.log('--- Partner Isolation ---');
  const p1 = await request('POST', '/partners', token1, { name: `IsoA_${ts}`, country: 'Mexico' });
  const p2 = await request('POST', '/partners', token2, { name: `IsoB_${ts}`, country: 'Mexico' });
  assert(p1.status === 201, 'Coord1 creates partner');
  assert(p2.status === 201, 'Coord2 creates partner');

  const list1 = await request('GET', '/partners?per_page=200&active_only=false', token1);
  const list2 = await request('GET', '/partners?per_page=200&active_only=false', token2);
  const ids1 = (list1.data.partners||[]).map(p=>p.id);
  const ids2 = (list2.data.partners||[]).map(p=>p.id);
  assert(ids1.includes(p1.data.partner.id) && !ids1.includes(p2.data.partner.id), 'Coord1 sees only own partner');
  assert(ids2.includes(p2.data.partner.id) && !ids2.includes(p1.data.partner.id), 'Coord2 sees only own partner');

  const cross = await request('GET', `/partners/${p1.data.partner.id}/campuses?active_only=false`, token2);
  assert(cross.status === 403, `Cross-partner access = 403 (got ${cross.status})`);

  // --- USER ISOLATION ---
  console.log('\n--- User Isolation ---');
  const ca1 = await request('POST', '/user-management/users', token1, {
    name:'CA', first_surname:'T', second_surname:'1', email:`ca1_${ts}@t.com`, role:'candidato', gender:'M',
  });
  const ca2 = await request('POST', '/user-management/users', token2, {
    name:'CB', first_surname:'T', second_surname:'2', email:`cb2_${ts}@t.com`, role:'candidato', gender:'F',
  });
  assert(ca1.status === 201, 'Coord1 creates candidato');
  assert(ca2.status === 201, 'Coord2 creates candidato');

  if (ca1.status === 201 && ca2.status === 201) {
    const ca1Id = ca1.data.user.id;
    const ca2Id = ca2.data.user.id;

    // Listing isolation
    const u1 = await request('GET', '/user-management/users?per_page=200', token1);
    const u2 = await request('GET', '/user-management/users?per_page=200', token2);
    const u1Ids = (u1.data.users||[]).map(u=>u.id);
    const u2Ids = (u2.data.users||[]).map(u=>u.id);
    assert(u1Ids.includes(ca1Id) && !u1Ids.includes(ca2Id), 'Coord1 list: only own users');
    assert(u2Ids.includes(ca2Id) && !u2Ids.includes(ca1Id), 'Coord2 list: only own users');

    // Detail isolation
    const xDetail = await request('GET', `/user-management/users/${ca1Id}`, token2);
    assert(xDetail.status === 403, `Cross-detail = 403 (got ${xDetail.status})`);

    // Edit isolation
    const xEdit = await request('PUT', `/user-management/users/${ca1Id}`, token2, { name:'X' });
    assert(xEdit.status === 403, `Cross-edit = 403 (got ${xEdit.status})`);

    // Own edit works
    const ownEdit = await request('PUT', `/user-management/users/${ca1Id}`, token1, { name:'OK' });
    assert(ownEdit.status === 200, `Own edit = 200 (got ${ownEdit.status})`);

    // Password isolation
    const xPwd = await request('PUT', `/user-management/users/${ca1Id}/password`, token2, { new_password:'NewPass123!' });
    assert(xPwd.status === 403, `Cross-password = 403 (got ${xPwd.status})`);

    // Toggle isolation
    const xToggle = await request('POST', `/user-management/users/${ca1Id}/toggle-active`, token2);
    assert(xToggle.status === 403, `Cross-toggle = 403 (got ${xToggle.status})`);

    // Admin sees all
    const adm = await request('GET', '/user-management/users?per_page=500', adminToken);
    const admIds = (adm.data.users||[]).map(u=>u.id);
    assert(admIds.includes(ca1Id) && admIds.includes(ca2Id), 'Admin sees both users');

    // Cleanup candidatos
    await request('POST', `/user-management/users/${ca1Id}/toggle-active`, adminToken);
    await request('POST', `/user-management/users/${ca2Id}/toggle-active`, adminToken);
  }

  // Cleanup
  console.log('\nCleanup...');
  await request('DELETE', `/partners/${p1.data.partner.id}`, adminToken);
  await request('DELETE', `/partners/${p2.data.partner.id}`, adminToken);
  await request('PUT', `/user-management/users/${c1Id}`, adminToken, { is_active: false });
  await request('PUT', `/user-management/users/${c2Id}`, adminToken, { is_active: false });

  console.log(`\n=== ${ENV.toUpperCase()}: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
