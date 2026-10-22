import assert from 'node:assert/strict';
import { randomBytes, randomUUID, X509Certificate } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const config = Object.fromEntries(['URL', 'PROJECT_REF', 'ANON_KEY', 'SERVICE_ROLE_KEY', 'DB_PASSWORD', 'INTEGRATION_CONFIRM']
  .map((name) => [name, process.env[`YANKE_SUPABASE_${name}`]]));
for (const [name, value] of Object.entries(config)) assert(value, `Missing YANKE_SUPABASE_${name}; no remote work performed`);
assert.match(config.PROJECT_REF, /^[a-z]{20}$/);
assert.equal(config.URL, `https://${config.PROJECT_REF}.supabase.co`);
assert.equal(config.INTEGRATION_CONFIRM, config.PROJECT_REF, 'Explicit project confirmation required');
assert(process.argv[2], 'Usage: node verify-checkin-rpcs.mjs <temporary pg/lib/index.js>');
const pg = await import(pathToFileURL(resolve(process.argv[2])).href);
const { Client } = pg.default ?? pg;
const pooler = new URL((await readFile(new URL('../../supabase/.temp/pooler-url', import.meta.url), 'utf8')).trim());
assert.equal(pooler.protocol, 'postgresql:');
assert.equal(pooler.username, `postgres.${config.PROJECT_REF}`, 'Linked database must belong to the confirmed project');
assert(pooler.hostname.endsWith('.pooler.supabase.com'), 'Expected the Supabase session pooler');
assert.equal(pooler.port, '5432', 'Session pooling is required for explicit locks');
pooler.password = config.DB_PASSWORD;
for (const name of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) pooler.searchParams.delete(name);
const caResponse = await fetch('https://supabase-downloads.s3.ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt', {
  signal: AbortSignal.timeout(15_000),
});
assert(caResponse.ok, `Official Supabase CA download returned HTTP ${caResponse.status}`);
const ca = await caResponse.text();
assert.equal(new X509Certificate(ca).fingerprint256, '80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA');
const dbOptions = { connectionString: pooler.href, ssl: { ca, rejectUnauthorized: true }, connectionTimeoutMillis: 15_000 };
const monitor = new Client(dbOptions);
const locker = new Client(dbOptions);
const createdUsers = [];
let passed = 0;
let cleaned = 0;
let failed = false;

async function request(path, { token, admin = false, method = 'GET', body, singular = false, prefer } = {}) {
  const key = admin ? config.SERVICE_ROLE_KEY : config.ANON_KEY;
  const response = await fetch(`${config.URL}${path}`, {
    method,
    headers: {
      apikey: key, Authorization: `Bearer ${token ?? key}`, 'Content-Type': 'application/json',
      Accept: singular ? 'application/vnd.pgrst.object+json' : 'application/json',
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
const rpc = (name, body, token) => request(`/rest/v1/rpc/${name}`, {
  method: 'POST', body, token, singular: name !== 'get_checkin_streak',
});
function ok(result, status = 200) {
  assert.equal(result.status, status, `Expected HTTP ${status}, got ${result.status} (${result.data?.code ?? 'no code'})`);
  return result.data;
}
function errorCode(result, code) {
  assert(result.status >= 400, `Expected rejection, got HTTP ${result.status}`);
  assert.equal(result.data?.code, code);
}
async function check(name, run) { await run(); passed += 1; console.log(`PASS ${name}`); }
async function sandbox() {
  const email = `yanke-rpc-${randomUUID()}@example.invalid`;
  const password = `Yk-${randomBytes(24).toString('base64url')}!`;
  const user = ok(await request('/auth/v1/admin/users', {
    admin: true, method: 'POST', body: { email, password, email_confirm: true, user_metadata: { yanke_sandbox: true } },
  }));
  assert(user.id, 'Sandbox creation did not return id');
  createdUsers.push(user.id);
  const session = ok(await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } }));
  assert.equal(session.user.id, user.id);
  return { id: user.id, token: session.access_token };
}

// Hold the exact plan row, then observe distinct blocked PostgreSQL backends before releasing it.
// HTTP parallelism by itself does not prove that separate transactions actually contended.
async function contended(planId, name, body, token) {
  await locker.query('begin');
  let calls = Promise.resolve([]);
  let observationError;
  let observed = 0;
  try {
    await locker.query('select id from public.plans where id=$1 for update', [planId]);
    const { rows: [{ pid }] } = await locker.query('select pg_backend_pid() as pid');
    calls = Promise.allSettled(Array.from({ length: 4 }, () => rpc(name, body, token)));
    const deadline = Date.now() + 4_000;
    while (Date.now() < deadline) {
      const { rows: [{ n }] } = await monitor.query(`with recursive blocked(pid) as (
          select pid from pg_stat_activity where $1=any(pg_blocking_pids(pid))
          union select a.pid from pg_stat_activity a join blocked b on b.pid=any(pg_blocking_pids(a.pid))
        ) select count(distinct a.pid)::int as n from blocked b join pg_stat_activity a using(pid)
          where a.wait_event_type='Lock' and a.query like $2`, [pid, `%${name}%`]);
      observed = n;
      if (n >= 2) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert(observed >= 2, 'Could not observe two independent transactions blocked by the held plan lock');
  } catch (error) { observationError = error; }
  finally { await locker.query('commit'); }
  const results = await calls;
  if (observationError) throw observationError;
  assert(results.every((result) => result.status === 'fulfilled'), 'A concurrent HTTP request failed');
  console.log(`Observed ${observed} independent PostgreSQL backends waiting on the plan lock`);
  return results.map((result) => result.value);
}

try {
  await monitor.connect();
  await locker.connect();
  const { rows: [server] } = await monitor.query(`select clock_timestamp() as now,
      current_setting('server_version') as version, name as zone,
      (clock_timestamp() at time zone name)::date::text as today
    from pg_timezone_names where name like 'Etc/GMT%'
      and (clock_timestamp() at time zone name)::time between time '11:00' and time '19:00'
    order by name limit 1`);
  assert(server, 'No suitable fixed-offset IANA test timezone');
  console.log(`Cloud PostgreSQL ${server.version}; TLS certificate verification enabled`);
  const now = new Date(server.now).getTime();
  const iso = (minutes) => new Date(now + minutes * 60_000).toISOString();
  const a = await sandbox();
  const b = await sandbox();
  async function plan(user, patch = {}) {
    const p = {
      id: randomUUID(), user_id: user.id, subject: '数学', timezone: server.zone,
      start_at: iso(10), end_at: iso(70), ...patch,
    };
    ok(await request('/rest/v1/plans', { method: 'POST', token: user.token, body: p }), 201);
    return p.id;
  }

  await check('real JWT realtime RPC, replay, manual completion and atomic summary updates', async () => {
    const id = await plan(a);
    const first = ok(await rpc('check_in_plan', { p_plan_id: id }, a.token));
    assert.equal(first.type, 'normal');
    assert.equal(first.duration_minutes, 60);
    const repeated = ok(await rpc('check_in_plan', { p_plan_id: id }, a.token));
    assert.equal(repeated.id, first.id);
    assert.equal(repeated.checked_at, first.checked_at);
    const completed = ok(await rpc('complete_plan', { p_plan_id: id, p_summary: '　今日复习完成\n' }, a.token));
    assert.equal(completed.status, 'completed');
    assert.equal(completed.summary, '今日复习完成');
    assert.equal(ok(await rpc('complete_plan', { p_plan_id: id }, a.token)).summary, '今日复习完成');
    assert.equal(ok(await rpc('complete_plan', { p_plan_id: id, p_summary: '\t　 ' }, a.token)).summary, null);
  });
  await check('real late RPC uses server timestamp and geofence requires explicit true', async () => {
    const id = await plan(a, {
      start_at: iso(-10), end_at: iso(50), geofence_enabled: true,
      geofence_name: '沙箱图书馆', geofence_lat: 31, geofence_lng: 121, geofence_radius: 200,
    });
    errorCode(await rpc('check_in_plan', { p_plan_id: id }, a.token), '22023');
    const late = ok(await rpc('check_in_plan', { p_plan_id: id, p_geofence_verified: true }, a.token));
    assert.equal(late.type, 'late');
    assert.equal(late.duration_minutes, Math.floor((new Date(iso(50)) - new Date(late.checked_at)) / 60_000));
    assert(late.duration_minutes >= 45 && late.duration_minutes <= 50);
  });
  await check('PostgREST numeric rejects fractional/nonfinite/out-of-range makeup without writing', async () => {
    const id = await plan(b, { start_at: iso(-1440 - 60), end_at: iso(-1440) });
    for (const value of [1.5, 0, 1441, 'NaN', 'Infinity', null]) {
      errorCode(await rpc('makeup_plan', { p_plan_id: id, p_duration_minutes: value }, b.token), '22023');
    }
    const saved = ok(await rpc('makeup_plan', { p_plan_id: id, p_duration_minutes: 90, p_summary: ' 补卡总结 ' }, b.token));
    assert.equal(saved.type, 'makeup');
    assert.equal(saved.duration_minutes, 90);
    assert.notEqual(saved.study_date, server.today);
    const [p] = ok(await request(`/rest/v1/plans?id=eq.${id}&select=status,summary`, { token: b.token }));
    assert.deepEqual(p, { status: 'pending', summary: '补卡总结' });
    errorCode(await rpc('makeup_plan', { p_plan_id: id, p_duration_minutes: 1 }, b.token), '23505');
    assert.equal(ok(await rpc('complete_plan', { p_plan_id: id }, b.token)).summary, '补卡总结');
  });
  await check('completion without check-in adds no minutes and summary errors roll back', async () => {
    const id = await plan(b, { summary: '原总结' });
    errorCode(await rpc('complete_plan', { p_plan_id: id, p_summary: '字'.repeat(2001) }, b.token), '22023');
    const [unchanged] = ok(await request(`/rest/v1/plans?id=eq.${id}&select=status,summary`, { token: b.token }));
    assert.deepEqual(unchanged, { status: 'pending', summary: '原总结' });
    assert.equal(ok(await rpc('complete_plan', { p_plan_id: id, p_summary: '' }, b.token)).summary, null);
    assert.deepEqual(ok(await request(`/rest/v1/checkins?plan_id=eq.${id}&select=id`, { token: b.token })), []);
    assert.equal(ok(await rpc('get_checkin_streak', { p_today: server.today }, b.token)), 1);
  });
  await check('anonymous/foreign/deleted plans cannot use RPCs and direct check-in writes stay denied', async () => {
    const id = await plan(b);
    for (const [name, body] of [
      ['check_in_plan', { p_plan_id: id }], ['makeup_plan', { p_plan_id: id, p_duration_minutes: 1 }],
      ['complete_plan', { p_plan_id: id }], ['get_checkin_streak', { p_today: server.today }],
    ]) {
      errorCode(await rpc(name, body), '42501');
      if (name !== 'get_checkin_streak') errorCode(await rpc(name, body, a.token), 'P0002');
    }
    ok(await request(`/rest/v1/plans?id=eq.${id}`, { token: b.token, method: 'PATCH', body: { status: 'deleted' } }), 204);
    errorCode(await rpc('complete_plan', { p_plan_id: id }, b.token), 'P0002');
    errorCode(await request('/rest/v1/checkins', {
      method: 'POST', token: a.token, body: { plan_id: id, user_id: a.id, type: 'normal', duration_minutes: 1 },
    }), '42501');
  });
  await check('independent locked transactions replay one realtime record', async () => {
    const id = await plan(a);
    const results = await contended(id, 'check_in_plan', { p_plan_id: id }, a.token);
    const values = results.map((result) => ok(result));
    assert.equal(new Set(values.map((row) => row.id)).size, 1);
    assert.equal(new Set(values.map((row) => row.checked_at)).size, 1);
    assert(values.every((row) => row.duration_minutes === 60));
  });
  await check('independent locked transactions allow one makeup and reject three duplicates', async () => {
    const id = await plan(a, { start_at: iso(-120), end_at: iso(-60) });
    const results = await contended(id, 'makeup_plan', { p_plan_id: id, p_duration_minutes: 1 }, a.token);
    assert.equal(results.filter((result) => result.status === 200).length, 1);
    const conflicts = results.filter((result) => result.status !== 200);
    assert.equal(conflicts.length, 3);
    for (const result of conflicts) errorCode(result, '23505');
    assert.equal(ok(await request(`/rest/v1/checkins?plan_id=eq.${id}&select=id`, { token: a.token })).length, 1);
  });
  await check('original study dates, soft-delete history and separate-user streaks survive real RPC writes', async () => {
    const old = await plan(b, { start_at: iso(-2880 - 60), end_at: iso(-2880) });
    const saved = ok(await rpc('makeup_plan', { p_plan_id: old, p_duration_minutes: 1 }, b.token));
    assert.equal(ok(await rpc('get_checkin_streak', { p_today: server.today }, b.token)), 2);
    ok(await request(`/rest/v1/plans?id=eq.${old}`, { token: b.token, method: 'PATCH', body: { status: 'deleted', subject: '英语' } }), 204);
    assert.equal(ok(await rpc('get_checkin_streak', { p_today: server.today }, b.token)), 2);
    const [history] = ok(await request(`/rest/v1/checkins?id=eq.${saved.id}&select=subject,study_date,duration_minutes`, { token: b.token }));
    assert.equal(history.subject, '数学');
    assert.equal(history.study_date, saved.study_date);
    const current = await plan(b, { start_at: iso(-120), end_at: iso(-60) });
    ok(await rpc('makeup_plan', { p_plan_id: current, p_duration_minutes: 1 }, b.token));
    assert.equal(ok(await rpc('get_checkin_streak', { p_today: server.today }, b.token)), 3);
    assert.equal(ok(await rpc('get_checkin_streak', { p_today: server.today }, a.token)), 1);
  });
} catch (error) {
  failed = true;
  // Deliberately omit response bodies, connection strings, sessions and request headers.
  console.error(`FAIL ${error instanceof Error ? error.message : 'Unknown verification error'}`);
} finally {
  await locker.end().catch(() => { failed = true; console.error('FAIL closing lock connection'); });
  await monitor.end().catch(() => { failed = true; console.error('FAIL closing monitor connection'); });
  for (const id of createdUsers) {
    try {
      ok(await request(`/auth/v1/admin/users/${id}`, { admin: true, method: 'DELETE' }));
      for (const [table, column] of [['profiles', 'id'], ['plans', 'user_id'], ['checkins', 'user_id']]) {
        assert.deepEqual(ok(await request(`/rest/v1/${table}?${column}=eq.${id}&select=*`, { admin: true })), []);
      }
      cleaned += 1;
    } catch { failed = true; console.error('FAIL sandbox cleanup; inspect only identities created by this run'); }
  }
  console.log(`${passed} cloud RPC checks passed; ${cleaned}/${createdUsers.length} sandbox accounts deleted with cascades verified`);
  if (failed) process.exitCode = 1;
}
