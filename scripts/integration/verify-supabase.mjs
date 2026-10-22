import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

// Explicit opt-in: this creates confirmed sandbox identities without sending email,
// then deletes only the users created by this run (and their cascading test data).
const config = Object.fromEntries(
  ['URL', 'PROJECT_REF', 'ANON_KEY', 'SERVICE_ROLE_KEY', 'INTEGRATION_CONFIRM'].map(
    (name) => [name, process.env[`YANKE_SUPABASE_${name}`]],
  ),
);
for (const [name, value] of Object.entries(config)) {
  assert(value, `Missing YANKE_SUPABASE_${name}; no remote work performed`);
}
assert.match(config.PROJECT_REF, /^[a-z]{20}$/);
assert.equal(config.URL, `https://${config.PROJECT_REF}.supabase.co`);
assert.equal(config.INTEGRATION_CONFIRM, config.PROJECT_REF, 'Explicit project confirmation required');

const createdUsers = [];
let passed = 0;
let cleaned = 0;
let failed = false;

async function request(path, { token, admin = false, method = 'GET', body, prefer } = {}) {
  const key = admin ? config.SERVICE_ROLE_KEY : config.ANON_KEY;
  const response = await fetch(`${config.URL}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token ?? key}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch { throw new Error(`Non-JSON response: HTTP ${response.status}`); }
  }
  return { status: response.status, data };
}

function ok(result, expected = 200) {
  assert.equal(result.status, expected, `Expected HTTP ${expected}, got ${result.status} (${result.data?.code ?? 'no code'})`);
  return result.data;
}

function denied(result) {
  assert([401, 403].includes(result.status), `Expected access denial, got HTTP ${result.status}`);
}

async function check(name, run) {
  await run();
  passed += 1;
  console.log(`PASS ${name}`);
}

async function sandboxUser() {
  const email = `yanke-integration-${randomUUID()}@example.invalid`;
  const password = `Yk-${randomBytes(24).toString('base64url')}!`;
  const user = ok(await request('/auth/v1/admin/users', {
    admin: true, method: 'POST',
    body: { email, password, email_confirm: true, user_metadata: { yanke_sandbox: true } },
  }));
  assert(user.id, 'Admin create-user response has no id');
  createdUsers.push(user.id);
  const session = ok(await request('/auth/v1/token?grant_type=password', {
    method: 'POST', body: { email, password },
  }));
  assert.equal(session.user.id, user.id);
  assert(session.access_token && session.refresh_token, 'Password login did not issue a session');
  return { id: user.id, token: session.access_token, refresh: session.refresh_token };
}

try {
  const a = await sandboxUser();
  const b = await sandboxUser();
  await check('real GoTrue password sessions, user endpoint and refresh token', async () => {
    assert.equal(ok(await request('/auth/v1/user', { token: a.token })).id, a.id);
    const refreshed = ok(await request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', body: { refresh_token: a.refresh },
    }));
    assert.equal(refreshed.user.id, a.id);
    assert(refreshed.access_token, 'Refresh did not return access token');
    a.token = refreshed.access_token;
  });

  await check('registration trigger and two-user profile isolation', async () => {
    for (const user of [a, b]) {
      const rows = ok(await request('/rest/v1/profiles?select=id,nickname', { token: user.token }));
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, user.id);
    }
    const invisible = ok(await request(`/rest/v1/profiles?id=eq.${b.id}&select=id`, { token: a.token }));
    assert.equal(invisible.length, 0);
  });

  await check('anonymous users cannot access private tables or statistic views', async () => {
    for (const table of ['profiles', 'plans', 'checkins', 'v_user_daily_stats', 'v_user_daily_subject_stats']) {
      denied(await request(`/rest/v1/${table}?select=*`));
    }
  });

  await check('profile nickname grant and protected columns', async () => {
    const rows = ok(await request(`/rest/v1/profiles?id=eq.${a.id}`, {
      token: a.token, method: 'PATCH', body: { nickname: '集成沙箱' }, prefer: 'return=representation',
    }));
    assert.equal(rows[0].nickname, '集成沙箱');
    denied(await request(`/rest/v1/profiles?id=eq.${a.id}`, {
      token: a.token, method: 'PATCH', body: { created_at: '2026-01-01T00:00:00Z' },
    }));
    assert.deepEqual(ok(await request(`/rest/v1/profiles?id=eq.${b.id}`, {
      token: a.token, method: 'PATCH', body: { nickname: '不可写' }, prefer: 'return=representation',
    })), []);
  });

  const makePlan = (user) => ({
    id: randomUUID(), user_id: user.id, subject: '数学', title: '集成沙箱计划',
    start_at: '2026-10-22T01:00:00Z', end_at: '2026-10-22T03:00:00Z',
    timezone: 'Asia/Shanghai', geofence_enabled: false,
  });
  const pa = makePlan(a);
  const pb = makePlan(b);

  await check('two-user plan insert and JWT/PostgREST row isolation', async () => {
    for (const [user, plan] of [[a, pa], [b, pb]]) {
      const rows = ok(await request('/rest/v1/plans', {
        token: user.token, method: 'POST', body: plan, prefer: 'return=representation',
      }), 201);
      assert.equal(rows[0].user_id, user.id);
      const visible = ok(await request('/rest/v1/plans?select=id,user_id', { token: user.token }));
      assert.equal(visible.length, 1);
      assert.equal(visible[0].id, plan.id);
    }
    denied(await request('/rest/v1/plans', {
      token: a.token, method: 'POST', body: { ...makePlan(b) },
    }));
  });

  await check('plan editing, forbidden ownership/timezone changes and cross-user updates', async () => {
    const rows = ok(await request(`/rest/v1/plans?id=eq.${pa.id}`, {
      token: a.token, method: 'PATCH', body: { title: '已编辑', status: 'completed', summary: null },
      prefer: 'return=representation',
    }));
    assert.equal(rows[0].title, '已编辑');
    for (const body of [{ user_id: b.id }, { timezone: 'UTC' }]) {
      denied(await request(`/rest/v1/plans?id=eq.${pa.id}`, { token: a.token, method: 'PATCH', body }));
    }
    assert.deepEqual(ok(await request(`/rest/v1/plans?id=eq.${pb.id}`, {
      token: a.token, method: 'PATCH', body: { title: '不可写' }, prefer: 'return=representation',
    })), []);
  });

  await check('actual PostgreSQL plan constraints reject invalid time and geofence fields', async () => {
    const invalid = [
      { end_at: '2026-10-22T01:10:00Z' },
      { end_at: '2026-10-22T16:00:00Z' },
      { geofence_enabled: true },
    ];
    for (const patch of invalid) {
      const result = await request('/rest/v1/plans', {
        token: a.token, method: 'POST', body: { ...makePlan(a), ...patch },
      });
      assert.equal(result.status, 400);
      assert.equal(result.data?.code, '23514');
    }
  });

  await check('client check-in writes and hard plan deletion are denied', async () => {
    denied(await request('/rest/v1/checkins', {
      token: a.token, method: 'POST',
      body: { plan_id: pa.id, user_id: a.id, type: 'normal', duration_minutes: 120 },
    }));
    denied(await request(`/rest/v1/plans?id=eq.${pa.id}`, { token: a.token, method: 'DELETE' }));
  });

  await check('trusted check-in write snapshots and same-user foreign key', async () => {
    const rows = ok(await request('/rest/v1/checkins', {
      admin: true, method: 'POST', prefer: 'return=representation',
      body: { plan_id: pa.id, user_id: a.id, type: 'normal', duration_minutes: 120 },
    }), 201);
    assert.equal(rows[0].subject, '数学');
    assert.equal(rows[0].study_date, '2026-10-22');
    assert.equal(rows[0].plan_timezone, 'Asia/Shanghai');
    const mismatch = await request('/rest/v1/checkins', {
      admin: true, method: 'POST',
      body: { plan_id: pb.id, user_id: a.id, type: 'normal', duration_minutes: 120 },
    });
    assert.equal(mismatch.status, 409);
    assert.equal(mismatch.data?.code, '23503');
  });

  await check('check-in reads and both security-invoker statistic views isolate users', async () => {
    const ca = ok(await request('/rest/v1/checkins?select=user_id,duration_minutes', { token: a.token }));
    assert.equal(ca.length, 1);
    assert.equal(ca[0].user_id, a.id);
    assert.deepEqual(ok(await request('/rest/v1/checkins?select=id', { token: b.token })), []);
    const stats = ok(await request('/rest/v1/v_user_daily_stats?select=*', { token: a.token }));
    assert.equal(stats.length, 1);
    assert.equal(stats[0].user_id, a.id);
    assert.equal(Number(stats[0].total_minutes), 120);
    assert.equal(Number(stats[0].completion_rate), 1);
    const subjects = ok(await request('/rest/v1/v_user_daily_subject_stats?select=*', { token: a.token }));
    assert.equal(subjects.length, 1);
    assert.equal(subjects[0].user_id, a.id);
    assert.deepEqual(ok(await request('/rest/v1/v_user_daily_subject_stats?select=*', { token: b.token })), []);
    const bStats = ok(await request('/rest/v1/v_user_daily_stats?select=user_id,total_minutes', { token: b.token }));
    assert.equal(bStats.length, 1);
    assert.equal(bStats[0].user_id, b.id);
    assert.equal(Number(bStats[0].total_minutes), 0);
  });

  await check('soft deletion keeps historical minutes and removes completion denominator', async () => {
    ok(await request(`/rest/v1/plans?id=eq.${pa.id}`, {
      token: a.token, method: 'PATCH', body: { status: 'deleted' },
    }), 204);
    const stats = ok(await request('/rest/v1/v_user_daily_stats?select=*', { token: a.token }));
    assert.equal(Number(stats[0].plan_count), 0);
    assert.equal(stats[0].completion_rate, null);
    assert.equal(Number(stats[0].total_minutes), 120);
    assert.equal(ok(await request('/rest/v1/checkins?select=id', { token: a.token })).length, 1);
  });
} catch (error) {
  failed = true;
  // Never print response bodies, session objects, request headers or credentials.
  console.error(`FAIL ${error instanceof Error ? error.message : 'Unknown verification error'}`);
} finally {
  for (const id of createdUsers) {
    try {
      ok(await request(`/auth/v1/admin/users/${id}`, { admin: true, method: 'DELETE' }));
      for (const [table, column] of [['profiles', 'id'], ['plans', 'user_id'], ['checkins', 'user_id']]) {
        const rows = ok(await request(`/rest/v1/${table}?${column}=eq.${id}&select=*`, { admin: true }));
        assert.equal(rows.length, 0, `Account deletion did not cascade to ${table}`);
      }
      cleaned += 1;
    } catch (error) {
      failed = true;
      console.error(`FAIL sandbox cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  console.log(`${passed} checks passed; ${cleaned}/${createdUsers.length} sandbox accounts deleted with cascades verified`);
  if (failed) process.exitCode = 1;
}
