/**
 * Integration test for last_seen / online status in chat
 * Run: node test_last_seen.js dev|prod
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
  console.log(`=== Last Seen / Online Status Test — ${ENV.toUpperCase()} ===`);
  console.log(`API: ${API}\n`);

  // 1. Login as admin — this should update last_seen
  const adminToken = await login('admin', 'admin123');
  console.log('Admin login: OK\n');

  // 2. Make an authenticated request (this triggers before_request hook)
  const pingRes = await request('GET', '/health', adminToken);
  assert(pingRes.status === 200, 'Authenticated health check works');

  // 3. Check admin's last_seen is set by checking via user detail
  const ts = Date.now().toString(36);

  // Create a test candidato, make some requests, then check last_seen in chat
  const candRes = await request('POST', '/user-management/users', adminToken, {
    name: 'TestLS', first_surname: 'Seen', second_surname: ts.slice(0,3),
    email: `testls_${ts}@test.com`, role: 'candidato', gender: 'M',
  });
  assert(candRes.status === 201, 'Test candidato created');

  if (candRes.status === 201) {
    const candId = candRes.data.user.id;
    const candUsername = candRes.data.user.username;
    const candPass = candRes.data.temporary_password;

    // Login as candidato — this sets last_login AND triggers before_request for last_seen
    const candToken = await login(candUsername, candPass);
    console.log(`  Candidato logged in: ${candUsername}`);

    // Make a few requests to ensure last_seen is updated
    await request('GET', '/health', candToken);
    await request('GET', '/health', candToken);

    // Now create a chat conversation as candidato
    const convRes = await request('POST', '/support/chat/conversations', candToken, {
      subject: `Test last_seen ${ts}`,
      content: 'Testing last seen feature',
    });
    assert(convRes.status === 201 || convRes.status === 200, `Chat conversation created (${convRes.status})`);

    if (convRes.status === 201 || convRes.status === 200) {
      const convId = convRes.data.conversation?.id || convRes.data.id;

      // Login as soporte/admin and check the conversation — candidate should have last_seen
      // List conversations as admin (soporte-like)
      const convsRes = await request('GET', '/support/chat/conversations', adminToken);
      assert(convsRes.status === 200, 'Admin can list conversations');

      // Find our test conversation
      const testConv = (convsRes.data.conversations || []).find(c => c.id === convId);
      if (testConv) {
        console.log(`  Conversation found: #${testConv.id}`);
        console.log(`  Candidate data: ${JSON.stringify(testConv.candidate)}`);

        assert(testConv.candidate !== null, 'Candidate is serialized in conversation');
        assert(testConv.candidate?.last_seen !== undefined, 'last_seen field EXISTS in candidate summary');
        assert(testConv.candidate?.last_seen !== null, `last_seen is NOT null (value: ${testConv.candidate?.last_seen})`);

        if (testConv.candidate?.last_seen) {
          // Verify it's a recent timestamp (within last 2 minutes)
          const seenDate = new Date(testConv.candidate.last_seen + (testConv.candidate.last_seen.endsWith('Z') ? '' : 'Z'));
          const diffMs = Date.now() - seenDate.getTime();
          const diffMin = diffMs / 60000;
          assert(diffMin < 2, `last_seen is recent (${diffMin.toFixed(1)} min ago)`);
          console.log(`  last_seen value: ${testConv.candidate.last_seen} (${diffMin.toFixed(1)} min ago)`);
        }
      } else {
        console.log(`  WARNING: Could not find conversation #${convId} in list`);
      }

      // Also test: conversation detail should include last_seen
      const detailRes = await request('GET', `/support/chat/conversations/${convId}`, adminToken);
      if (detailRes.status === 200) {
        const detail = detailRes.data.conversation || detailRes.data;
        assert(detail.candidate?.last_seen !== null, 'Conversation detail includes last_seen');
      }
    }

    // Test: after candidato stops making requests for 5+ minutes, they'd be "offline"
    // We can't wait 5 minutes, but we can at least verify the logic by checking the timestamp

    // Cleanup
    await request('PUT', `/user-management/users/${candId}`, adminToken, { is_active: false });
  }

  console.log(`\n=== ${ENV.toUpperCase()}: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
