/**
 * Integration test for soporte role permissions
 * Run: node test_soporte.js dev|prod
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
  console.log(`=== Soporte Permissions Test — ${ENV.toUpperCase()} ===`);
  console.log(`API: ${API}\n`);

  const adminToken = await login('admin', 'admin123');
  console.log('Admin login: OK');

  const ts = Date.now().toString(36);

  // Create a test soporte user
  const sopRes = await request('POST', '/user-management/users', adminToken, {
    name: 'TestSop', first_surname: 'Role', second_surname: 'Check',
    email: `sop_${ts}@test.com`, role: 'soporte',
  });
  if (sopRes.status !== 201) {
    console.log(`FATAL: Could not create soporte: ${JSON.stringify(sopRes.data).slice(0,300)}`);
    process.exit(1);
  }
  const sopId = sopRes.data.user.id;
  const sopUsername = sopRes.data.user.username;
  const sopToken = await login(sopUsername, sopRes.data.temporary_password);
  console.log(`Soporte created: ${sopUsername}`);

  // Create test users of various roles (via admin)
  const roles = ['coordinator', 'editor', 'financiero', 'candidato', 'responsable_partner'];
  const testUsers = {};
  for (const role of roles) {
    const r = await request('POST', '/user-management/users', adminToken, {
      name: `T${role.slice(0,4)}`, first_surname: 'Test', second_surname: ts.slice(0,4),
      email: `t${role}_${ts}@test.com`, role,
      gender: role === 'candidato' ? 'M' : undefined,
    });
    if (r.status === 201) {
      testUsers[role] = r.data.user;
      console.log(`  Created ${role}: ${r.data.user.username} (${r.data.user.id.slice(0,8)})`);
    } else {
      console.log(`  WARN: Could not create ${role}: ${JSON.stringify(r.data).slice(0,200)}`);
    }
  }

  // --- TEST 1: Soporte LISTING — sees coordinators, editors, financiero, candidatos, etc. ---
  console.log('\n--- TEST 1: Soporte listing visibility ---');
  const sopUsers = await request('GET', '/user-management/users?per_page=500', sopToken);
  assert(sopUsers.status === 200, 'Soporte GET /users returns 200');
  const sopUsersList = sopUsers.data.users || [];
  const sopUserIds = sopUsersList.map(u => u.id);
  const sopRoles = [...new Set(sopUsersList.map(u => u.role))].sort();
  console.log(`  Soporte sees ${sopUsers.data.total} users, roles: ${sopRoles.join(', ')}`);

  // Should see coordinator, editor, financiero, candidato, responsable_partner
  if (testUsers.coordinator) assert(sopUserIds.includes(testUsers.coordinator.id), 'Soporte sees coordinator');
  if (testUsers.editor) assert(sopUserIds.includes(testUsers.editor.id), 'Soporte sees editor');
  if (testUsers.financiero) assert(sopUserIds.includes(testUsers.financiero.id), 'Soporte sees financiero');
  if (testUsers.candidato) assert(sopUserIds.includes(testUsers.candidato.id), 'Soporte sees candidato');

  // Should NOT see admin, developer, gerente
  const adminInList = sopUsersList.some(u => u.role === 'admin');
  const devInList = sopUsersList.some(u => u.role === 'developer');
  const gerenteInList = sopUsersList.some(u => u.role === 'gerente');
  assert(!adminInList, 'Soporte does NOT see any admin in list');
  assert(!devInList, 'Soporte does NOT see any developer in list');
  assert(!gerenteInList, 'Soporte does NOT see any gerente in list');

  // --- TEST 2: Soporte DETAIL — can view coordinator detail ---
  console.log('\n--- TEST 2: Soporte detail visibility ---');
  if (testUsers.coordinator) {
    const detCoord = await request('GET', `/user-management/users/${testUsers.coordinator.id}`, sopToken);
    assert(detCoord.status === 200, `Soporte views coordinator detail = 200 (got ${detCoord.status})`);
  }
  if (testUsers.editor) {
    const detEditor = await request('GET', `/user-management/users/${testUsers.editor.id}`, sopToken);
    assert(detEditor.status === 200, `Soporte views editor detail = 200 (got ${detEditor.status})`);
  }

  // Soporte cannot view admin detail
  // Find admin user id from the admin token
  const adminMe = await request('GET', '/auth/me', adminToken);
  const adminUserId = adminMe.data.user ? adminMe.data.user.id : adminMe.data.id;
  if (adminUserId) {
    const detAdmin = await request('GET', `/user-management/users/${adminUserId}`, sopToken);
    assert(detAdmin.status === 403, `Soporte views admin detail = 403 (got ${detAdmin.status})`);
  }

  // --- TEST 3: Soporte EDIT — can edit candidato, responsable_partner but NOT coordinator ---
  console.log('\n--- TEST 3: Soporte edit permissions ---');
  if (testUsers.candidato) {
    const editCand = await request('PUT', `/user-management/users/${testUsers.candidato.id}`, sopToken, { name: 'EditedBySop' });
    assert(editCand.status === 200, `Soporte edits candidato = 200 (got ${editCand.status})`);
  }
  if (testUsers.responsable_partner) {
    const editRP = await request('PUT', `/user-management/users/${testUsers.responsable_partner.id}`, sopToken, { name: 'EditedRP' });
    assert(editRP.status === 200, `Soporte edits responsable_partner = 200 (got ${editRP.status})`);
  }
  if (testUsers.coordinator) {
    const editCoord = await request('PUT', `/user-management/users/${testUsers.coordinator.id}`, sopToken, { name: 'Hacked' });
    assert(editCoord.status === 403, `Soporte edits coordinator = 403 (got ${editCoord.status})`);
  }
  if (testUsers.editor) {
    const editEditor = await request('PUT', `/user-management/users/${testUsers.editor.id}`, sopToken, { name: 'Hacked' });
    assert(editEditor.status === 403, `Soporte edits editor = 403 (got ${editEditor.status})`);
  }
  if (testUsers.financiero) {
    const editFin = await request('PUT', `/user-management/users/${testUsers.financiero.id}`, sopToken, { name: 'Hacked' });
    assert(editFin.status === 403, `Soporte edits financiero = 403 (got ${editFin.status})`);
  }

  // --- TEST 4: Soporte PASSWORD — can change candidato pwd but NOT coordinator pwd ---
  console.log('\n--- TEST 4: Soporte password permissions ---');
  if (testUsers.candidato) {
    const pwdCand = await request('PUT', `/user-management/users/${testUsers.candidato.id}/password`, sopToken, { new_password: 'NewPass123!' });
    assert(pwdCand.status === 200, `Soporte changes candidato password = 200 (got ${pwdCand.status})`);
  }
  if (testUsers.coordinator) {
    const pwdCoord = await request('PUT', `/user-management/users/${testUsers.coordinator.id}/password`, sopToken, { new_password: 'NewPass123!' });
    assert(pwdCoord.status === 403, `Soporte changes coordinator password = 403 (got ${pwdCoord.status})`);
  }
  if (testUsers.editor) {
    const pwdEditor = await request('PUT', `/user-management/users/${testUsers.editor.id}/password`, sopToken, { new_password: 'NewPass123!' });
    assert(pwdEditor.status === 403, `Soporte changes editor password = 403 (got ${pwdEditor.status})`);
  }

  // --- TEST 5: Soporte TOGGLE — can toggle candidato but NOT coordinator ---
  console.log('\n--- TEST 5: Soporte toggle-active permissions ---');
  if (testUsers.candidato) {
    const togCand = await request('POST', `/user-management/users/${testUsers.candidato.id}/toggle-active`, sopToken);
    assert(togCand.status === 200, `Soporte toggles candidato = 200 (got ${togCand.status})`);
    // Toggle back
    await request('POST', `/user-management/users/${testUsers.candidato.id}/toggle-active`, sopToken);
  }
  if (testUsers.coordinator) {
    const togCoord = await request('POST', `/user-management/users/${testUsers.coordinator.id}/toggle-active`, sopToken);
    assert(togCoord.status === 403, `Soporte toggles coordinator = 403 (got ${togCoord.status})`);
  }

  // --- CLEANUP ---
  console.log('\nCleanup...');
  const allTestIds = [sopId, ...Object.values(testUsers).map(u => u.id)];
  for (const id of allTestIds) {
    await request('PUT', `/user-management/users/${id}`, adminToken, { is_active: false });
  }

  console.log(`\n=== ${ENV.toUpperCase()}: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
