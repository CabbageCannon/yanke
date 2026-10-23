import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

import { createPoiSearchHandler } from '../../supabase/functions/amap-poi-search/handler.ts';

// Creates and deletes one confirmed sandbox identity; never sends mail or searches for a fake POI.
const config = Object.fromEntries(['URL', 'PROJECT_REF', 'ANON_KEY', 'SERVICE_ROLE_KEY', 'INTEGRATION_CONFIRM']
  .map((name) => [name, process.env[`YANKE_SUPABASE_${name}`]]));
for (const [name, value] of Object.entries(config)) assert(value, `Missing YANKE_SUPABASE_${name}; no remote work performed`);
assert.match(config.PROJECT_REF, /^[a-z]{20}$/);
assert.equal(config.URL, `https://${config.PROJECT_REF}.supabase.co`);
assert.equal(config.INTEGRATION_CONFIRM, config.PROJECT_REF, 'Explicit test project confirmation required');

async function auth(path, method, body, admin = false) {
  const key = admin ? config.SERVICE_ROLE_KEY : config.ANON_KEY;
  const response = await fetch(`${config.URL}/auth/v1/${path}`, { method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30_000) });
  assert(response.ok, `Auth operation failed: HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}

let userId;
let stage = 'create test identity';
try {
  const email = `yanke-poi-${randomUUID()}@example.invalid`, password = `Yk-${randomBytes(24).toString('base64url')}!`;
  const user = await auth('admin/users', 'POST', { email, password, email_confirm: true,
    user_metadata: { yanke_sandbox: true } }, true);
  assert(typeof user.id === 'string');
  userId = user.id;
  stage = 'obtain test user session';
  const session = await auth('token?grant_type=password', 'POST', { email, password });
  assert.equal(session.user.id, userId); assert(session.access_token);
  // Deliberately omit amapKey: this tests hosted GoTrue with the real handler, not a deployed Edge runtime or AMap.
  const handle = createPoiSearchHandler({ supabaseUrl: config.URL, supabaseKey: config.ANON_KEY });
  const request = (token, query) => new Request('https://local.test/amap-poi-search', { method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
  stage = 'real JWT with missing AMap key';
  const unavailable = await handle(request(session.access_token, '图书馆'));
  assert.equal(unavailable.status, 503); assert.equal((await unavailable.json()).error.code, 'AMAP_UNCONFIGURED');
  console.log('PASS real hosted user JWT + local handler returns explicit no-key 503');
  stage = 'forged JWT';
  assert.equal((await handle(request('forged.jwt.payload', '图书馆'))).status, 401);
  console.log('PASS hosted Auth rejects forged JWT before AMap');
  stage = 'invalid input with real JWT';
  assert.equal((await handle(request(session.access_token, ' '))).status, 400);
  console.log('PASS real hosted user JWT + invalid input returns 400');
} catch {
  console.error(`FAIL POI boundary integration at: ${stage}; credentials and responses withheld`);
  process.exitCode = 1;
} finally {
  if (userId) {
    try {
      await auth(`admin/users/${userId}`, 'DELETE', undefined, true);
      const check = await fetch(`${config.URL}/auth/v1/admin/users/${userId}`, {
        headers: { apikey: config.SERVICE_ROLE_KEY, Authorization: `Bearer ${config.SERVICE_ROLE_KEY}` },
        signal: AbortSignal.timeout(30_000),
      });
      assert.equal(check.status, 404);
      console.log('PASS this run\'s sandbox identity deleted and absence verified');
    } catch {
      console.error('FAIL POI sandbox identity cleanup; administrator follow-up required');
      process.exitCode = 1;
    }
  }
}
