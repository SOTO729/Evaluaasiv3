/**
 * Integration test for chat message templates
 * Run: node test_templates.js dev|prod
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
  console.log(`=== Chat Templates Test — ${ENV.toUpperCase()} ===`);
  console.log(`API: ${API}\n`);

  const adminToken = await login('admin', 'admin123');
  console.log('Admin login: OK');

  const ts = Date.now().toString(36);

  // --- TEST 1: Auth required ---
  console.log('\n--- TEST 1: Auth required ---');
  const noAuth = await request('GET', '/support/chat/templates', null);
  assert(noAuth.status === 401 || noAuth.status === 422, `GET /templates without auth = ${noAuth.status}`);

  // --- TEST 2: Candidato cannot access ---
  console.log('\n--- TEST 2: Candidato cannot access ---');
  const candRes = await request('POST', '/user-management/users', adminToken, {
    name: 'TplCand', first_surname: 'Test', second_surname: ts.slice(0,3),
    email: `tplcand_${ts}@test.com`, role: 'candidato', gender: 'M',
  });
  if (candRes.status === 201) {
    const candToken = await login(candRes.data.user.username, candRes.data.temporary_password);
    const candList = await request('GET', '/support/chat/templates', candToken);
    assert(candList.status === 403, `Candidato GET /templates = 403 (got ${candList.status})`);
    await request('PUT', `/user-management/users/${candRes.data.user.id}`, adminToken, { is_active: false });
  }

  // --- TEST 3: Admin CRUD ---
  console.log('\n--- TEST 3: Admin CRUD (personal template) ---');
  const listBefore = await request('GET', '/support/chat/templates', adminToken);
  assert(listBefore.status === 200, `GET /templates = 200 (got ${listBefore.status})`);
  const countBefore = (listBefore.data.templates || []).length;

  const create = await request('POST', '/support/chat/templates', adminToken, {
    title: `Test ${ts}`, content: `Hola, este es un mensaje de prueba ${ts}`,
  });
  assert(create.status === 201, `POST /templates = 201 (got ${create.status})`);
  assert(create.data.template?.title === `Test ${ts}`, 'Template title matches');
  assert(create.data.template?.is_global === false, 'Personal template by default');

  const tplId = create.data.template?.id;

  const listAfter = await request('GET', '/support/chat/templates', adminToken);
  assert((listAfter.data.templates || []).length === countBefore + 1, 'List count increased by 1');

  const update = await request('PUT', `/support/chat/templates/${tplId}`, adminToken, {
    title: `Updated ${ts}`, content: `Mensaje actualizado ${ts}`,
  });
  assert(update.status === 200, `PUT /templates/${tplId} = 200 (got ${update.status})`);
  assert(update.data.template?.title === `Updated ${ts}`, 'Updated title matches');

  // --- TEST 4: Global template ---
  console.log('\n--- TEST 4: Global template ---');
  const globalCreate = await request('POST', '/support/chat/templates', adminToken, {
    title: `Global ${ts}`, content: `Plantilla global ${ts}`, is_global: true,
  });
  assert(globalCreate.status === 201, `Global template created = 201 (got ${globalCreate.status})`);
  assert(globalCreate.data.template?.is_global === true, 'is_global = true');
  assert(globalCreate.data.template?.owner_user_id === null, 'owner_user_id = null for global');
  const globalTplId = globalCreate.data.template?.id;

  // --- TEST 5: Emoji in content ---
  console.log('\n--- TEST 5: Emoji support ---');
  const emojiCreate = await request('POST', '/support/chat/templates', adminToken, {
    title: `Emoji ${ts}`, content: `Hola! 👋😊 Bienvenido al soporte 🎉`,
  });
  assert(emojiCreate.status === 201, `Emoji template created = 201 (got ${emojiCreate.status})`);
  assert(emojiCreate.data.template?.content.includes('👋'), 'Emoji preserved in content');
  const emojiTplId = emojiCreate.data.template?.id;

  // --- TEST 6: Validation ---
  console.log('\n--- TEST 6: Validation ---');
  const noTitle = await request('POST', '/support/chat/templates', adminToken, { content: 'test' });
  assert(noTitle.status === 400, `Missing title = 400 (got ${noTitle.status})`);

  const noContent = await request('POST', '/support/chat/templates', adminToken, { title: 'test' });
  assert(noContent.status === 400, `Missing content = 400 (got ${noContent.status})`);

  // --- TEST 7: Coordinator can create personal but NOT global ---
  console.log('\n--- TEST 7: Coordinator permissions ---');
  const coordRes = await request('POST', '/user-management/users', adminToken, {
    name: 'TplCoord', first_surname: 'Test', second_surname: ts.slice(0,3),
    email: `tplcoord_${ts}@test.com`, role: 'coordinator',
  });
  if (coordRes.status === 201) {
    const coordToken = await login(coordRes.data.user.username, coordRes.data.temporary_password);

    // Can list templates (sees global + own)
    const coordList = await request('GET', '/support/chat/templates', coordToken);
    assert(coordList.status === 200, `Coordinator lists templates = 200`);
    const seesGlobal = (coordList.data.templates || []).some(t => t.id === globalTplId);
    assert(seesGlobal, 'Coordinator sees global template');

    // Can create personal
    const coordPersonal = await request('POST', '/support/chat/templates', coordToken, {
      title: `Coord ${ts}`, content: `Mi plantilla ${ts}`,
    });
    assert(coordPersonal.status === 201, `Coordinator creates personal = 201 (got ${coordPersonal.status})`);

    // Cannot create global
    const coordGlobal = await request('POST', '/support/chat/templates', coordToken, {
      title: `CoordGlob ${ts}`, content: `test`, is_global: true,
    });
    assert(coordGlobal.status === 403, `Coordinator creates global = 403 (got ${coordGlobal.status})`);

    // Cannot edit admin's global template
    const coordEditGlobal = await request('PUT', `/support/chat/templates/${globalTplId}`, coordToken, {
      title: 'Hacked',
    });
    assert(coordEditGlobal.status === 403, `Coordinator edits global = 403 (got ${coordEditGlobal.status})`);

    // Cannot delete admin's personal template
    const coordDeleteAdmin = await request('DELETE', `/support/chat/templates/${tplId}`, coordToken);
    assert(coordDeleteAdmin.status === 403, `Coordinator deletes admin's personal = 403 (got ${coordDeleteAdmin.status})`);

    // Cleanup coordinator personal template
    if (coordPersonal.data.template?.id) {
      await request('DELETE', `/support/chat/templates/${coordPersonal.data.template.id}`, coordToken);
    }

    await request('PUT', `/user-management/users/${coordRes.data.user.id}`, adminToken, { is_active: false });
  }

  // --- TEST 8: Delete ---
  console.log('\n--- TEST 8: Delete ---');
  const del1 = await request('DELETE', `/support/chat/templates/${tplId}`, adminToken);
  assert(del1.status === 200, `Delete personal = 200 (got ${del1.status})`);

  const del2 = await request('DELETE', `/support/chat/templates/${globalTplId}`, adminToken);
  assert(del2.status === 200, `Delete global = 200 (got ${del2.status})`);

  if (emojiTplId) {
    await request('DELETE', `/support/chat/templates/${emojiTplId}`, adminToken);
  }

  // Verify deleted
  const del404 = await request('DELETE', `/support/chat/templates/${tplId}`, adminToken);
  assert(del404.status === 404, `Delete already-deleted = 404 (got ${del404.status})`);

  console.log(`\n=== ${ENV.toUpperCase()}: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
