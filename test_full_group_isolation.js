/**
 * Test: Full Group Isolation per Coordinator
 * Comprehensive test covering ALL group-related endpoints:
 * - CRUD operations (list, search, get, update, delete)
 * - Group config (get, update, reset)
 * - Group members (add, bulk, count, campus-responsables)
 * - Group exams (assign, detail, update members)
 * - Export endpoints (members, certifications, campus-report, partner-report)
 * - Certificates (stats, analytics, candidate detail)
 * - Direct access isolation (403 for cross-coordinator access)
 *
 * Verifies coordinators CANNOT access each other's groups in any endpoint.
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

function req(method, path, token, body, isFormData) {
  return new Promise((resolve, reject) => {
    const url = new URL(API + path);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {},
      timeout: 60000
    };
    if (!isFormData) opts.headers['Content-Type'] = 'application/json';
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
    if (body && !isFormData) r.write(JSON.stringify(body));
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

const UID = Math.random().toString(36).slice(2, 8).toUpperCase();

async function run() {
  console.log(`\n🔬 Full Group Isolation Test — ENV: ${ENV} — UID: ${UID}\n`);

  // Warmup
  await req('GET', '/warmup');
  const adminToken = await login('admin', 'admin123');
  console.log('🔑 Admin logged in\n');

  // ════════════════════════════════════════════════
  // SETUP: Create 2 coordinators, partners, campuses, groups
  // ════════════════════════════════════════════════
  console.log('📋 SETUP: Creating two coordinators with full hierarchy...');

  const coordARes = await req('POST', '/user-management/users', adminToken, {
    name: 'IsoCoordA', first_surname: 'Test', second_surname: UID,
    email: `isocA_${UID}@test.com`, role: 'coordinator'
  });
  assert(coordARes.status === 201, `CoordA created (${coordARes.status})`);
  const coordA = coordARes.data.user || coordARes.data;
  const tokenA = await login(coordA.username, coordARes.data.temporary_password);

  const coordBRes = await req('POST', '/user-management/users', adminToken, {
    name: 'IsoCoordB', first_surname: 'Test', second_surname: UID,
    email: `isocB_${UID}@test.com`, role: 'coordinator'
  });
  assert(coordBRes.status === 201, `CoordB created (${coordBRes.status})`);
  const coordB = coordBRes.data.user || coordBRes.data;
  const tokenB = await login(coordB.username, coordBRes.data.temporary_password);
  console.log(`  CoordA: ${coordA.username} | CoordB: ${coordB.username}`);

  // Partners
  const pA = await req('POST', '/partners', tokenA, { name: `PartA_${UID}`, description: 'A' });
  assert(pA.status === 201, `PartnerA created`);
  const partnerAId = pA.data.id || pA.data.partner?.id;

  const pB = await req('POST', '/partners', tokenB, { name: `PartB_${UID}`, description: 'B' });
  assert(pB.status === 201, `PartnerB created`);
  const partnerBId = pB.data.id || pB.data.partner?.id;

  // Campuses
  const cA = await req('POST', `/partners/${partnerAId}/campuses`, tokenA, {
    name: `CampA_${UID}`, country: 'Estados Unidos', state_name: 'Texas', city: 'Dallas',
    director_name: 'DirA', director_first_surname: 'T', director_second_surname: 'A',
    director_email: `dirA_${UID}@test.com`, director_phone: '5551111111',
    director_gender: 'M', director_date_of_birth: '1990-01-01'
  });
  assert(cA.status === 201, `CampusA created`);
  const campusAId = cA.data.campus?.id || cA.data.id;

  const cB = await req('POST', `/partners/${partnerBId}/campuses`, tokenB, {
    name: `CampB_${UID}`, country: 'Estados Unidos', state_name: 'California', city: 'LA',
    director_name: 'DirB', director_first_surname: 'T', director_second_surname: 'B',
    director_email: `dirB_${UID}@test.com`, director_phone: '5552222222',
    director_gender: 'F', director_date_of_birth: '1985-06-20'
  });
  assert(cB.status === 201, `CampusB created`);
  const campusBId = cB.data.campus?.id || cB.data.id;

  // Groups
  const gA = await req('POST', `/partners/campuses/${campusAId}/groups`, tokenA, {
    name: `GrpA_${UID}`, description: 'Group A'
  });
  assert(gA.status === 201, `GroupA created`);
  const groupAId = gA.data.group?.id || gA.data.id;

  const gB = await req('POST', `/partners/campuses/${campusBId}/groups`, tokenB, {
    name: `GrpB_${UID}`, description: 'Group B'
  });
  assert(gB.status === 201, `GroupB created`);
  const groupBId = gB.data.group?.id || gB.data.id;

  console.log(`  GroupA: ${groupAId} | GroupB: ${groupBId}\n`);

  // ════════════════════════════════════════════════
  // TEST 1: LIST / SEARCH ISOLATION
  // ════════════════════════════════════════════════
  console.log('🔍 TEST 1: List & Search isolation...');

  const allA = await req('GET', '/partners/groups/list-all', tokenA);
  assert(allA.status === 200, 'CoordA list-all 200');
  const idsA = (allA.data.groups || []).map(g => g.id);
  assert(idsA.includes(groupAId), 'CoordA sees own group in list-all');
  assert(!idsA.includes(groupBId), 'CoordA does NOT see CoordB group in list-all');

  const allB = await req('GET', '/partners/groups/list-all', tokenB);
  const idsB = (allB.data.groups || []).map(g => g.id);
  assert(idsB.includes(groupBId), 'CoordB sees own group in list-all');
  assert(!idsB.includes(groupAId), 'CoordB does NOT see CoordA group in list-all');

  const sA = await req('GET', `/partners/groups/search?search=${UID}`, tokenA);
  assert(sA.status === 200, 'CoordA search 200');
  const sIdsA = (sA.data.groups || []).map(g => g.id);
  assert(sIdsA.includes(groupAId), 'CoordA finds own group in search');
  assert(!sIdsA.includes(groupBId), 'CoordA does NOT find CoordB group in search');

  const sB = await req('GET', `/partners/groups/search?search=${UID}`, tokenB);
  const sIdsB = (sB.data.groups || []).map(g => g.id);
  assert(sIdsB.includes(groupBId), 'CoordB finds own group in search');
  assert(!sIdsB.includes(groupAId), 'CoordB does NOT find CoordA group in search');

  // ════════════════════════════════════════════════
  // TEST 2: DIRECT GROUP ACCESS
  // ════════════════════════════════════════════════
  console.log('\n🔍 TEST 2: Direct group access isolation...');

  const dA = await req('GET', `/partners/groups/${groupAId}`, tokenA);
  assert(dA.status === 200, 'CoordA accesses own group (200)');

  const dCross1 = await req('GET', `/partners/groups/${groupAId}`, tokenB);
  assert(dCross1.status === 403, `CoordB blocked from CoordA group (${dCross1.status})`);

  const dB = await req('GET', `/partners/groups/${groupBId}`, tokenB);
  assert(dB.status === 200, 'CoordB accesses own group (200)');

  const dCross2 = await req('GET', `/partners/groups/${groupBId}`, tokenA);
  assert(dCross2.status === 403, `CoordA blocked from CoordB group (${dCross2.status})`);

  // ════════════════════════════════════════════════
  // TEST 3: GROUP CONFIG ISOLATION
  // ════════════════════════════════════════════════
  console.log('\n🔍 TEST 3: Group config isolation...');

  const cfgA = await req('GET', `/partners/groups/${groupAId}/config`, tokenA);
  assert(cfgA.status === 200, 'CoordA reads own group config (200)');

  const cfgCross = await req('GET', `/partners/groups/${groupAId}/config`, tokenB);
  assert(cfgCross.status === 403, `CoordB blocked from CoordA group config (${cfgCross.status})`);

  const cfgUpd = await req('PUT', `/partners/groups/${groupAId}/config`, tokenB, {
    enable_tier_basic_override: true
  });
  assert(cfgUpd.status === 403, `CoordB blocked from updating CoordA group config (${cfgUpd.status})`);

  const cfgReset = await req('POST', `/partners/groups/${groupAId}/config/reset`, tokenB, {});
  assert(cfgReset.status === 403, `CoordB blocked from resetting CoordA group config (${cfgReset.status})`);

  // ════════════════════════════════════════════════
  // TEST 4: GROUP UPDATE / DELETE ISOLATION
  // ════════════════════════════════════════════════
  console.log('\n🔍 TEST 4: Group update/delete isolation...');

  const updCross = await req('PUT', `/partners/groups/${groupAId}`, tokenB, {
    name: 'Hacked Name'
  });
  assert(updCross.status === 403, `CoordB blocked from updating CoordA group (${updCross.status})`);

  const delCross = await req('DELETE', `/partners/groups/${groupAId}`, tokenB);
  assert(delCross.status === 403, `CoordB blocked from deleting CoordA group (${delCross.status})`);

  // ════════════════════════════════════════════════
  // TEST 5: GROUP MEMBERS ISOLATION (add, bulk, count, campus-responsables)
  // ════════════════════════════════════════════════
  console.log('\n🔍 TEST 5: Group members isolation...');

  const countCross = await req('GET', `/partners/groups/${groupAId}/members/count`, tokenB);
  assert(countCross.status === 403, `CoordB blocked from member count of CoordA group (${countCross.status})`);

  const addCross = await req('POST', `/partners/groups/${groupAId}/members`, tokenB, {
    user_id: 'fake-user-id'
  });
  assert(addCross.status === 403, `CoordB blocked from adding member to CoordA group (${addCross.status})`);

  const bulkCross = await req('POST', `/partners/groups/${groupAId}/members/bulk`, tokenB, {
    user_ids: ['fake-user-id']
  });
  assert(bulkCross.status === 403, `CoordB blocked from bulk adding to CoordA group (${bulkCross.status})`);

  const bulkCritCross = await req('POST', `/partners/groups/${groupAId}/members/bulk-assign-by-criteria`, tokenB, {
    search: 'test'
  });
  assert(bulkCritCross.status === 403, `CoordB blocked from bulk-assign-by-criteria on CoordA group (${bulkCritCross.status})`);

  const respCross = await req('GET', `/partners/groups/${groupAId}/campus-responsables`, tokenB);
  assert(respCross.status === 403, `CoordB blocked from campus-responsables of CoordA group (${respCross.status})`);

  // ════════════════════════════════════════════════
  // TEST 6: GROUP EXAMS ISOLATION (assign, detail, update members, add assignments)
  // ════════════════════════════════════════════════
  console.log('\n🔍 TEST 6: Group exams isolation...');

  const examAssignCross = await req('POST', `/partners/groups/${groupAId}/exams`, tokenB, {
    exam_id: 1, assignment_type: 'all'
  });
  assert([403, 400, 404].includes(examAssignCross.status) && examAssignCross.status !== 200,
    `CoordB blocked from assigning exam to CoordA group (${examAssignCross.status})`);

  const examDetailCross = await req('GET', `/partners/groups/${groupAId}/exams/1/detail`, tokenB);
  assert(examDetailCross.status === 403, `CoordB blocked from exam detail of CoordA group (${examDetailCross.status})`);

  const examMembersCross = await req('PUT', `/partners/groups/${groupAId}/exams/1/members`, tokenB, {
    assignment_type: 'all'
  });
  assert(examMembersCross.status === 403, `CoordB blocked from updating exam members on CoordA group (${examMembersCross.status})`);

  const addAssignCross = await req('POST', `/partners/groups/${groupAId}/exams/1/assignments/add`, tokenB, {
    user_ids: ['fake']
  });
  assert(addAssignCross.status === 403, `CoordB blocked from adding exam assignments on CoordA group (${addAssignCross.status})`);

  // ════════════════════════════════════════════════
  // TEST 7: RETAKE ISOLATION
  // ════════════════════════════════════════════════
  console.log('\n🔍 TEST 7: Retake isolation...');

  const retakeCross = await req('POST', `/partners/groups/${groupAId}/exams/1/members/fake-uid/retake`, tokenB, {});
  assert(retakeCross.status === 403, `CoordB blocked from applying retake on CoordA group (${retakeCross.status})`);

  const retakePreviewCross = await req('POST', `/partners/groups/${groupAId}/exams/1/retake-preview`, tokenB, {
    user_id: 'fake-uid'
  });
  assert(retakePreviewCross.status === 403, `CoordB blocked from retake preview on CoordA group (${retakePreviewCross.status})`);

  // ════════════════════════════════════════════════
  // TEST 8: STUDY MATERIALS ISOLATION
  // ════════════════════════════════════════════════
  console.log('\n🔍 TEST 8: Study materials isolation...');

  const matCross = await req('POST', `/partners/groups/${groupAId}/study-materials`, tokenB, {
    material_ids: [1], assignment_type: 'all'
  });
  assert(matCross.status === 403, `CoordB blocked from assigning study materials to CoordA group (${matCross.status})`);

  // ════════════════════════════════════════════════
  // TEST 9: EXPORT ISOLATION
  // ════════════════════════════════════════════════
  console.log('\n🔍 TEST 9: Export isolation...');

  const expMemCross = await req('GET', `/partners/groups/${groupAId}/export-members`, tokenB);
  assert(expMemCross.status === 403, `CoordB blocked from export-members of CoordA group (${expMemCross.status})`);

  const expCertCross = await req('GET', `/partners/groups/${groupAId}/export-certifications`, tokenB);
  assert(expCertCross.status === 403, `CoordB blocked from export-certifications of CoordA group (${expCertCross.status})`);

  const expCampCross = await req('GET', `/partners/campuses/${campusAId}/export-report`, tokenB);
  assert(expCampCross.status === 403, `CoordB blocked from export-campus-report of CoordA campus (${expCampCross.status})`);

  const expPartCross = await req('GET', `/partners/partners/${partnerAId}/export-report`, tokenB);
  assert(expPartCross.status === 403, `CoordB blocked from export-partner-report of CoordA partner (${expPartCross.status})`);

  // ════════════════════════════════════════════════
  // TEST 10: CERTIFICATES HUB ISOLATION
  // ════════════════════════════════════════════════
  console.log('\n🔍 TEST 10: Certificates hub isolation...');

  const certStatsCross = await req('GET', `/partners/groups/${groupAId}/certificates/stats`, tokenB);
  assert(certStatsCross.status === 403, `CoordB blocked from certificate stats of CoordA group (${certStatsCross.status})`);

  const analyticsCross = await req('GET', `/partners/groups/${groupAId}/analytics`, tokenB);
  assert(analyticsCross.status === 403, `CoordB blocked from analytics of CoordA group (${analyticsCross.status})`);

  const candDetailCross = await req('GET', `/partners/groups/${groupAId}/candidates/fake-uid/certification-detail`, tokenB);
  assert(candDetailCross.status === 403, `CoordB blocked from candidate-detail of CoordA group (${candDetailCross.status})`);

  // ════════════════════════════════════════════════
  // TEST 11: CAMPUS GROUPS & PARTNER ISOLATION
  // ════════════════════════════════════════════════
  console.log('\n🔍 TEST 11: Campus & Partner cross-access...');

  const campGrpCross = await req('GET', `/partners/campuses/${campusAId}/groups`, tokenB);
  assert(campGrpCross.status === 403, `CoordB blocked from CoordA campus groups (${campGrpCross.status})`);

  const partnerCross = await req('GET', `/partners/${partnerAId}`, tokenB);
  assert(partnerCross.status === 403, `CoordB blocked from CoordA partner (${partnerCross.status})`);

  const campusCross = await req('GET', `/partners/campuses/${campusAId}`, tokenB);
  assert(campusCross.status === 403, `CoordB blocked from CoordA campus (${campusCross.status})`);

  // ════════════════════════════════════════════════
  // TEST 12: DASHBOARD ISOLATION
  // ════════════════════════════════════════════════
  console.log('\n🔍 TEST 12: Dashboard isolation...');

  const dashA = await req('GET', '/partners/dashboard', tokenA);
  assert(dashA.status === 200, 'CoordA dashboard 200');
  assert(dashA.data.stats?.total_groups === 1, `CoordA sees 1 group (got ${dashA.data.stats?.total_groups})`);

  const dashB = await req('GET', '/partners/dashboard', tokenB);
  assert(dashB.status === 200, 'CoordB dashboard 200');
  assert(dashB.data.stats?.total_groups === 1, `CoordB sees 1 group (got ${dashB.data.stats?.total_groups})`);

  // ════════════════════════════════════════════════
  // TEST 13: TEMPLATE DOWNLOAD ISOLATION
  // ════════════════════════════════════════════════
  console.log('\n🔍 TEST 13: Template & bulk-assign isolation...');

  const templateCross = await req('GET', `/partners/groups/${groupAId}/exams/bulk-assign-template`, tokenB);
  assert(templateCross.status === 403, `CoordB blocked from bulk-assign-template of CoordA group (${templateCross.status})`);

  // ════════════════════════════════════════════════
  // TEST 14: POSITIVE ACCESS (coordinator accesses own resources)
  // ════════════════════════════════════════════════
  console.log('\n🔍 TEST 14: Positive access (own resources)...');

  const ownCfg = await req('GET', `/partners/groups/${groupAId}/config`, tokenA);
  assert(ownCfg.status === 200, 'CoordA reads own config (200)');

  const ownCount = await req('GET', `/partners/groups/${groupAId}/members/count`, tokenA);
  assert(ownCount.status === 200, 'CoordA gets own member count (200)');

  const ownResp = await req('GET', `/partners/groups/${groupAId}/campus-responsables`, tokenA);
  assert(ownResp.status === 200, 'CoordA gets own campus-responsables (200)');

  const ownStats = await req('GET', `/partners/groups/${groupAId}/certificates/stats`, tokenA);
  assert(ownStats.status === 200, 'CoordA reads own certificate stats (200)');

  const ownAnalytics = await req('GET', `/partners/groups/${groupAId}/analytics`, tokenA);
  assert(ownAnalytics.status === 200, 'CoordA reads own analytics (200)');

  const ownPartner = await req('GET', `/partners/${partnerAId}`, tokenA);
  assert(ownPartner.status === 200, 'CoordA reads own partner (200)');

  const ownCampus = await req('GET', `/partners/campuses/${campusAId}`, tokenA);
  assert(ownCampus.status === 200, 'CoordA reads own campus (200)');

  // ════════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════════
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  RESULTS: ${passed}/${total} passed, ${failed} failed`);
  console.log(`${'═'.repeat(60)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
