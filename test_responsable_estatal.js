/**
 * Integration tests for responsable_estatal role
 * Tests: user creation, login, mi-partner endpoints with state filtering
 */

const API = 'https://evaluaasi-motorv2-api-dev.purpleocean-384694c4.southcentralus.azurecontainerapps.io/api';

let adminToken = '';
let estatalToken = '';
let estatalUserId = null;
const PARTNER_ID = 50;  // Educare pruebas
const STATE = 'Veracruz';
const ESTATAL_USERNAME = `resp_estatal_test_${Date.now()}`;
let tempPassword = '';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ ${message}`);
    failed++;
  }
}

async function request(method, path, body = null, token = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);

  const resp = await fetch(`${API}${path}`, opts);
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: resp.status, data };
}

async function loginAdmin() {
  for (let i = 0; i < 3; i++) {
    const r = await request('POST', '/auth/login', { username: 'admin', password: 'admin123' });
    if (r.status === 200) {
      adminToken = r.data.access_token;
      return;
    }
    await new Promise(res => setTimeout(res, 5000));
  }
  throw new Error('Could not login as admin');
}

// Test Suite
async function run() {
  console.log('\n=== Test: responsable_estatal role ===\n');

  // Login admin
  await loginAdmin();
  console.log('Admin logged in.\n');

  // 1. Create responsable_estatal user
  console.log('--- 1. Create responsable_estatal user ---');
  const createResp = await request('POST', '/user-management/users', {
    email: `${ESTATAL_USERNAME}@test.com`,
    name: 'Test',
    first_surname: 'Estatal',
    second_surname: 'Prueba',
    role: 'responsable_estatal',
    partner_id: PARTNER_ID,
    assigned_state: STATE
  }, adminToken);
  assert(createResp.status === 201, `Create user: status ${createResp.status}`);
  assert(createResp.data?.user?.role === 'responsable_estatal', `Role is responsable_estatal: ${createResp.data?.user?.role}`);
  assert(createResp.data?.user?.assigned_state === STATE, `Assigned state is ${STATE}: ${createResp.data?.user?.assigned_state}`);
  estatalUserId = createResp.data?.user?.id;
  const autoUsername = createResp.data?.user?.username;
  tempPassword = createResp.data?.temporary_password;
  assert(!!tempPassword, `Got temporary password`);

  // 1b. Change password via admin (temp passwords require reset)
  const pwdResp = await request('PUT', `/user-management/users/${estatalUserId}/password`, {
    new_password: 'EstatalTest1234!'
  }, adminToken);
  assert(pwdResp.status === 200, `Password changed: status ${pwdResp.status}`);

  // 2. Login as responsable_estatal
  console.log('\n--- 2. Login as responsable_estatal ---');
  const loginResp = await request('POST', '/auth/login', {
    username: autoUsername,
    password: 'EstatalTest1234!'
  });
  assert(loginResp.status === 200, `Login: status ${loginResp.status}`);
  assert(loginResp.data?.user?.role === 'responsable_estatal', `Login role: ${loginResp.data?.user?.role}`);
  estatalToken = loginResp.data?.access_token;

  // 3. GET /partners/mi-partner — should return partner with state-filtered campuses
  console.log('\n--- 3. GET /partners/mi-partner (state-filtered) ---');
  const miPartner = await request('GET', '/partners/mi-partner', null, estatalToken);
  assert(miPartner.status === 200, `mi-partner: status ${miPartner.status}`);
  assert(miPartner.data?.partner?.id === PARTNER_ID, `Partner ID: ${miPartner.data?.partner?.id}`);
  assert(miPartner.data?.forced_state === STATE, `Forced state: ${miPartner.data?.forced_state}`);

  // Verify only Veracruz campuses are returned
  const campuses = miPartner.data?.campuses || [];
  const allInState = campuses.every(c => c.state_name === STATE);
  assert(allInState, `All campuses in ${STATE}: ${campuses.map(c => c.state_name).join(', ')}`);
  assert(campuses.length > 0, `Has campuses: ${campuses.length}`);

  // 4. GET /partners/mi-partner/dashboard — should auto-filter by state
  console.log('\n--- 4. GET /partners/mi-partner/dashboard ---');
  const dashboard = await request('GET', '/partners/mi-partner/dashboard', null, estatalToken);
  assert(dashboard.status === 200, `Dashboard: status ${dashboard.status}`);
  assert(dashboard.data?.filter?.forced_state === STATE, `Dashboard forced_state: ${dashboard.data?.filter?.forced_state}`);

  // 5. GET /partners/mi-partner/certificates — should auto-filter by state
  console.log('\n--- 5. GET /partners/mi-partner/certificates ---');
  const certs = await request('GET', '/partners/mi-partner/certificates', null, estatalToken);
  assert(certs.status === 200, `Certificates: status ${certs.status}`);

  // 6. Verify state filter cannot be overridden via query param
  console.log('\n--- 6. Cannot override state filter ---');
  const overrideResp = await request('GET', '/partners/mi-partner/dashboard?state=Yucatán', null, estatalToken);
  assert(overrideResp.status === 200, `Override attempt: status ${overrideResp.status}`);
  assert(overrideResp.data?.filter?.forced_state === STATE, `State not overridden: ${overrideResp.data?.filter?.forced_state}`);

  // 7. Verify responsable_estatal without assigned_state is rejected
  console.log('\n--- 7. Create without assigned_state fails ---');
  const noState = await request('POST', '/user-management/users', {
    email: `nostate_${Date.now()}@test.com`,
    name: 'No',
    first_surname: 'State',
    second_surname: 'Test',
    role: 'responsable_estatal',
    partner_id: PARTNER_ID
  }, adminToken);
  assert(noState.status === 400, `No state rejected: status ${noState.status}`);

  // 8. responsable_estatal sees forced_state in response
  console.log('\n--- 8. forced_state present in responses ---');
  const adminPartner = await request('GET', '/partners/mi-partner', null, estatalToken);
  // Already verified above, but let's ensure forced_state is returned
  assert(typeof adminPartner.data?.forced_state === 'string', `forced_state is string for estatal`);

  // 9. Verify export endpoint works
  console.log('\n--- 9. Export certificates ---');
  const exportResp = await request('GET', '/partners/mi-partner/certificates/export', null, estatalToken);
  // Should return 200 with Excel file or error if no certs
  assert([200, 404].includes(exportResp.status), `Export: status ${exportResp.status}`);

  // 10. Cleanup: delete test user
  console.log('\n--- 10. Cleanup ---');
  if (estatalUserId) {
    const delResp = await request('DELETE', `/user-management/users/${estatalUserId}`, null, adminToken);
    assert([200, 204].includes(delResp.status), `Delete user: status ${delResp.status}`);
  }

  // Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed out of ${passed + failed} ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test failed with error:', err.message);
  process.exit(1);
});
