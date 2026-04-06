/**
 * Integration test — Issuer Logo in Badge Verification
 *
 * Tests:
 *   1. Badge templates list includes issuer_logo_url field
 *   2. Template detail includes issuer_logo_url
 *   3. Upload issuer logo requires auth (401/422)
 *   4. Upload issuer logo to invalid template (404)
 *   5. Delete issuer logo requires auth (401/422)
 *   6. Delete issuer logo invalid template (404)
 *   7. Verify endpoint returns issuer_logo_url for badge (if issued badges exist)
 *   8. Verify invalid code returns error
 *   9. Template with logo has valid URL
 *
 * Run: node test_issuer_logo.js [dev|prod]
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
    if (i < retries - 1) await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error(`Login failed for ${username}`);
}

let passed = 0, failed = 0;
function assert(condition, msg) {
  if (condition) { passed++; console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

async function main() {
  console.log(`=== Issuer Logo Verification Test — ${ENV.toUpperCase()} ===`);
  console.log(`API: ${API}\n`);

  // ── Login ──
  console.log('1. Logging in...');
  const adminToken = await login('admin', 'admin123');
  console.log('   Admin login: OK');

  // ── 2. Templates list includes issuer_logo_url ──
  console.log('\n2. Badge templates: issuer_logo_url field');
  const r1 = await request('GET', '/badges/templates', adminToken);
  assert(r1.status === 200, `Templates list returns 200 (got ${r1.status})`);
  const templates = r1.data.templates || [];
  if (templates.length > 0) {
    assert('issuer_logo_url' in templates[0], 'Template has issuer_logo_url field');
  } else {
    console.log('  INFO: No templates found — field check skipped');
    passed++;
  }

  // ── 3. Template detail includes issuer_logo_url ──
  console.log('\n3. Template detail: issuer_logo_url');
  const activeTemplate = templates.find(t => t.is_active);
  if (activeTemplate) {
    const r2 = await request('GET', `/badges/templates/${activeTemplate.id}`, adminToken);
    assert(r2.status === 200, `Template detail returns 200 (got ${r2.status})`);
    const tmpl = r2.data.template || r2.data;
    assert('issuer_logo_url' in tmpl, 'Detail has issuer_logo_url');
  } else {
    console.log('  SKIP: No active templates');
  }

  // ── 4. Upload issuer logo requires auth ──
  console.log('\n4. Upload logo: requires auth');
  const r3 = await request('POST', '/badges/templates/1/issuer-logo', null, {});
  assert([401, 422].includes(r3.status), `No auth → 401/422 (got ${r3.status})`);

  // ── 5. Upload logo to invalid template ──
  console.log('\n5. Upload logo: invalid template');
  // Note: actual file upload would need multipart, so we just test basic validation
  const r4 = await request('POST', '/badges/templates/999999/issuer-logo', adminToken, {});
  assert([400, 404].includes(r4.status), `Invalid template → 400/404 (got ${r4.status})`);

  // ── 6. Delete issuer logo requires auth ──
  console.log('\n6. Delete logo: requires auth');
  const r5 = await request('DELETE', '/badges/templates/1/issuer-logo', null);
  assert([401, 422].includes(r5.status), `No auth → 401/422 (got ${r5.status})`);

  // ── 7. Delete logo invalid template ──
  console.log('\n7. Delete logo: invalid template');
  const r6 = await request('DELETE', '/badges/templates/999999/issuer-logo', adminToken);
  assert(r6.status === 404, `Invalid template → 404 (got ${r6.status})`);

  // ── 8. Template with logo has valid URL ──
  console.log('\n8. Template with logo: valid URL');
  const tmplWithLogo = templates.find(t => t.issuer_logo_url);
  if (tmplWithLogo) {
    assert(
      tmplWithLogo.issuer_logo_url.startsWith('https://'),
      `Logo URL starts with https: ${tmplWithLogo.issuer_logo_url.substring(0, 50)}...`
    );
  } else {
    console.log('  INFO: No templates with logo configured — skipped');
    passed++;
  }

  // ── 9. Verify badge includes issuer_logo_url ──
  console.log('\n9. Verify badge: issuer_logo_url in response');
  // Try to find an issued badge
  let badgeCode = null;
  for (const t of templates) {
    const r = await request('GET', `/badges/templates/${t.id}`, adminToken);
    if (r.status === 200) {
      const badges = (r.data.issued_badges || []);
      if (badges.length > 0 && badges[0].badge_code) {
        badgeCode = badges[0].badge_code;
        break;
      }
    }
  }

  if (badgeCode) {
    const r7 = await request('GET', `/verify/${badgeCode}`, null);
    assert(r7.status === 200, `Verify returns 200 (got ${r7.status})`);
    assert(r7.data.valid === true, 'Badge is valid');
    assert('issuer_logo_url' in (r7.data.badge || {}), 'Verify response has issuer_logo_url');

    const logo = r7.data.badge.issuer_logo_url;
    assert(
      logo === null || (typeof logo === 'string' && logo.startsWith('https://')),
      `issuer_logo_url is null or valid URL`
    );
  } else {
    console.log('  SKIP: No issued badges in DEV — verify skipped');
  }

  // ── 10. Verify invalid code ──
  console.log('\n10. Verify: invalid code returns error');
  const r8 = await request('GET', '/verify/INVALID_CODE_99999', null);
  assert(
    r8.data.valid === false || r8.status === 404,
    `Invalid code → valid=false or 404 (got status=${r8.status}, valid=${r8.data.valid})`
  );

  // ── Summary ──
  console.log(`\n=== ${ENV.toUpperCase()}: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
