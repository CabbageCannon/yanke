import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verifyCheckinRpcs } from './verify-checkin-rpcs.mjs';

// Install PGlite outside the application; pass its dist/index.js path as the only argument.
if (!process.argv[2]) throw new Error('Usage: node scripts/db/verify.mjs <PGlite dist/index.js>');
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const root = fileURLToPath(new URL('../../', import.meta.url));
const migrationDir = resolve(root, 'supabase/migrations');
const migrations = await readdir(migrationDir);
const sql = (await Promise.all(migrations.filter((name) => name.endsWith('.sql')).sort()
  .map((name) => readFile(resolve(migrationDir, name), 'utf8')))).join('\n');
const snapshot = await readFile(resolve(root, 'docs/schema.sql'), 'utf8');
assert.equal(snapshot.replaceAll('\r\n', '\n'), sql.replaceAll('\r\n', '\n'), 'Schema snapshot must match migrations');

const db = new PGlite();
const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const plan1 = '10000000-0000-4000-8000-000000000001';
const plan2 = '10000000-0000-4000-8000-000000000002';
const futurePlan = '10000000-0000-4000-8000-000000000003';
const makeupPlan = '10000000-0000-4000-8000-000000000004';
const otherPlan = '10000000-0000-4000-8000-000000000005';
let passed = 0;

async function test(label, run) {
  await run();
  passed += 1;
  console.log(`PASS ${label}`);
}
async function rows(query, params = []) { return (await db.query(query, params)).rows; }
async function rejects(query, params, codes) {
  await assert.rejects(() => db.query(query, params), (error) => {
    assert.ok(codes.includes(error.code), `Expected ${codes}, received ${error.code}: ${error.message}`);
    return true;
  });
}
async function asUser(id) {
  await db.exec('reset role; set role authenticated;');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
}
async function asAdmin() { await db.exec('reset role;'); }
async function insertPlan(overrides = {}) {
  const plan = {
    user_id: userA, subject: '数学', start_at: '2026-10-21T09:00:00+08:00',
    end_at: '2026-10-21T11:00:00+08:00', ...overrides,
  };
  const columns = Object.keys(plan);
  return db.query(`insert into public.plans (${columns.join(',')}) values (${columns.map((_, i) => `$${i + 1}`).join(',')}) returning id`, Object.values(plan));
}
async function invalidPlan(overrides, codes = ['23514']) {
  await assert.rejects(() => insertPlan(overrides), (error) => {
    assert.ok(codes.includes(error.code), `Expected ${codes}, received ${error.code}: ${error.message}`);
    return true;
  });
}

try {
  console.log((await rows('select version() as version'))[0].version);
  // Supabase-owned auth/roles are test stubs. All constraints, grants, RLS and views run in PostgreSQL.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant execute on functions to anon, authenticated;
  `);
  await test('migration executes; schema snapshot matches', () => db.exec(sql));
  await test('auth insert trigger creates profiles', async () => {
    await db.query('insert into auth.users (id) values ($1), ($2)', [userA, userB]);
    assert.equal((await rows('select count(*)::int as n from public.profiles'))[0].n, 2);
  });
  await asUser(userA);
  await test('profile RLS and restricted mutation', async () => {
    assert.deepEqual(await rows('select id from public.profiles'), [{ id: userA }]);
    assert.equal((await db.query('update public.profiles set nickname = $1 where id = $2', ['甲', userB])).affectedRows, 0);
    await db.query('update public.profiles set nickname = $1 where id = $2', ['甲', userA]);
    await rejects('insert into public.profiles (id) values ($1)', [userA], ['42501']);
    await rejects('delete from public.profiles where id = $1', [userA], ['42501']);
  });
  await test('own plan CRUD writes and cross-user insert rejection', async () => {
    await insertPlan({ id: plan1, status: 'completed' });
    await insertPlan({ id: plan2, start_at: '2026-10-21T14:00:00+08:00', end_at: '2026-10-21T15:00:00+08:00' });
    await insertPlan({ id: futurePlan, start_at: '2099-10-21T09:00:00+08:00', end_at: '2099-10-21T10:00:00+08:00' });
    await insertPlan({ id: makeupPlan, start_at: '2026-10-20T09:00:00+08:00', end_at: '2026-10-20T10:30:00+08:00', status: 'completed' });
    await invalidPlan({ user_id: userB }, ['42501']);
  });
  await test('time bounds reject null, reversed, short, infinite and local cross-day plans', async () => {
    await invalidPlan({ start_at: null }, ['23502']);
    await invalidPlan({ end_at: null }, ['23502']);
    await invalidPlan({ end_at: '2026-10-21T09:00:00+08:00' });
    await invalidPlan({ end_at: '2026-10-21T08:00:00+08:00' });
    await invalidPlan({ end_at: '2026-10-21T09:14:59+08:00' });
    await invalidPlan({ end_at: 'infinity' });
    await invalidPlan({ start_at: '2026-10-21T15:45:00Z', end_at: '2026-10-21T16:00:00Z' });
  });
  await test('15-minute, UTC-cross-day and IANA daylight-saving plans are valid', async () => {
    await insertPlan({ start_at: '2026-10-25T09:00:00+08:00', end_at: '2026-10-25T09:15:00+08:00' });
    await insertPlan({ timezone: 'America/New_York', start_at: '2026-10-25T23:45:00Z', end_at: '2026-10-26T00:00:00Z' });
    await insertPlan({ timezone: 'America/New_York', start_at: '2026-11-01T12:45:00-05:00', end_at: '2026-11-01T13:15:00-05:00' });
    await invalidPlan({ timezone: 'not/a-zone' }, ['23514', '22023']);
    await invalidPlan({ timezone: '+08:00' }, ['23514', '22023']);
  });
  await test('local timetable boundaries include 08:00 and 23:00, reject times outside the grid', async () => {
    await insertPlan({ start_at: '2026-10-28T08:00:00+08:00', end_at: '2026-10-28T08:15:00+08:00' });
    await insertPlan({ start_at: '2026-10-28T22:45:00+08:00', end_at: '2026-10-28T23:00:00+08:00' });
    await invalidPlan({ start_at: '2026-10-28T07:59:59+08:00', end_at: '2026-10-28T08:15:00+08:00' });
    await invalidPlan({ start_at: '2026-10-28T22:45:00+08:00', end_at: '2026-10-28T23:00:01+08:00' });
  });
  await test('subject, title, status and summary bounds', async () => {
    await invalidPlan({ subject: '自定义' });
    await invalidPlan({ title: ' ' });
    await invalidPlan({ title: '字'.repeat(101) });
    await invalidPlan({ title: ' '.repeat(100) + '字' });
    await invalidPlan({ status: 'anything' });
    await invalidPlan({ summary: '字'.repeat(2001) });
  });
  await test('geofence is optional; enabled fields and ranges are enforced', async () => {
    const geofence = { geofence_enabled: true, geofence_name: '图书馆', geofence_lat: 31.23, geofence_lng: 121.47, geofence_radius: 50 };
    for (const override of [
      { geofence_name: null }, { geofence_name: ' ' }, { geofence_lat: null }, { geofence_lat: 91 },
      { geofence_lat: 'NaN' }, { geofence_lng: 181 }, { geofence_radius: null },
      { geofence_radius: 49 }, { geofence_radius: 1001 },
    ]) await invalidPlan({ ...geofence, ...override });
    await invalidPlan({ geofence_name: '图书馆' });
    await insertPlan({ ...geofence, start_at: '2026-10-27T09:00:00+08:00', end_at: '2026-10-27T10:00:00+08:00' });
    await insertPlan({ ...geofence, geofence_radius: 1000, start_at: '2026-10-27T11:00:00+08:00', end_at: '2026-10-27T12:00:00+08:00' });
  });
  await test('plan ownership, creation time and timezone cannot be overwritten; hard delete is denied', async () => {
    for (const column of ['user_id', 'created_at', 'timezone']) {
      const value = { user_id: userB, created_at: '2026-01-01T00:00:00Z', timezone: 'UTC' }[column];
      await rejects(`update public.plans set ${column} = $1 where id = $2`, [value, plan1], ['42501']);
    }
    await rejects('delete from public.plans where id = $1', [plan1], ['42501']);
  });
  await asUser(userB);
  await test('second user cannot read or update first user plans', async () => {
    assert.deepEqual(await rows('select id from public.plans'), []);
    assert.equal((await db.query("update public.plans set title = '侵入' where id = $1", [plan1])).affectedRows, 0);
    await insertPlan({ id: otherPlan, user_id: userB, status: 'completed' });
    assert.deepEqual(await rows('select id from public.plans'), [{ id: otherPlan }]);
  });
  await asAdmin();
  await db.exec('set role service_role;');
  await test('trusted write path snapshots the plan, including makeup original study date', async () => {
    for (const [planId, userId, type, duration, checkedAt] of [
      [plan1, userA, 'normal', 120, '2026-10-21T09:00:00+08:00'],
      [makeupPlan, userA, 'makeup', 90, '2026-10-23T12:00:00+08:00'],
      [otherPlan, userB, 'late', 60, '2026-10-21T10:00:00+08:00'],
    ]) await db.query('insert into public.checkins (plan_id, user_id, type, duration_minutes, checked_at) values ($1, $2, $3, $4, $5)', [planId, userId, type, duration, checkedAt]);
    const snapshotRow = (await rows('select subject, study_date::text, plan_timezone from public.checkins where plan_id = $1', [makeupPlan]))[0];
    assert.deepEqual(snapshotRow, { subject: '数学', study_date: '2026-10-20', plan_timezone: 'Asia/Shanghai' });
  });
  await test('one check-in per plan and same-user relation', async () => {
    await rejects("insert into public.checkins (plan_id, user_id, type, duration_minutes) values ($1, $2, 'normal', 120)", [plan1, userA], ['23505']);
    await rejects("insert into public.checkins (plan_id, user_id, type, duration_minutes) values ($1, $2, 'normal', 120)", [plan2, userB], ['23503']);
  });
  await test('check-in type, nonnegative integer duration and finite time are enforced', async () => {
    await rejects("insert into public.checkins (plan_id, user_id, type, duration_minutes) values ($1, $2, 'bad', 1)", [plan2, userA], ['23514']);
    await rejects("insert into public.checkins (plan_id, user_id, type, duration_minutes) values ($1, $2, 'normal', -1)", [plan2, userA], ['23514']);
    await rejects("insert into public.checkins (plan_id, user_id, type, duration_minutes) values ($1, $2, 'normal', $3)", [plan2, userA, '1.5'], ['22P02']);
    await rejects("insert into public.checkins (plan_id, user_id, type, duration_minutes, checked_at) values ($1, $2, 'normal', 1, 'infinity')", [plan2, userA], ['23514']);
    await db.query('update public.checkins set duration_minutes = 0 where plan_id = $1', [otherPlan]);
    await db.query('update public.checkins set duration_minutes = 60 where plan_id = $1', [otherPlan]);
    await rejects("update public.checkins set subject = '英语' where plan_id = $1", [plan1], ['23514']);
  });
  await asAdmin();
  await test('composite foreign key independently rejects cross-user relation', async () => {
    await db.exec('alter table public.checkins disable trigger snapshot_checkin_plan;');
    try {
      await rejects(`insert into public.checkins (plan_id, user_id, type, duration_minutes, subject, plan_start_at, plan_end_at, plan_timezone)
        select id, $1, 'normal', 1, subject, start_at, end_at, timezone from public.plans where id = $2`, [userB, plan2], ['23503']);
    } finally { await db.exec('alter table public.checkins enable trigger snapshot_checkin_plan;'); }
  });
  await asUser(userA);
  await test('authenticated check-ins are read-only and user-isolated', async () => {
    assert.equal((await rows('select count(*)::int as n from public.checkins'))[0].n, 2);
    assert.deepEqual(await rows('select plan_id from public.checkins where user_id = $1', [userB]), []);
    await rejects("insert into public.checkins (plan_id, user_id, type, duration_minutes) values ($1, $2, 'normal', 999)", [plan2, userA], ['42501']);
    await rejects('update public.checkins set duration_minutes = 999 where plan_id = $1', [plan1], ['42501']);
    await rejects('delete from public.checkins where plan_id = $1', [plan1], ['42501']);
  });
  await test('security-invoker stats isolate users, count future plans and attribute makeup to original date', async () => {
    const stats = await rows("select user_id, study_date::text, plan_count::int, completed_plan_count::int, completion_rate::float8, checkin_count::int, total_minutes::int from public.v_user_daily_stats where study_date in ('2026-10-20', '2026-10-21', '2099-10-21') order by study_date");
    assert.deepEqual(stats, [
      { user_id: userA, study_date: '2026-10-20', plan_count: 1, completed_plan_count: 1, completion_rate: 1, checkin_count: 1, total_minutes: 90 },
      { user_id: userA, study_date: '2026-10-21', plan_count: 2, completed_plan_count: 1, completion_rate: 0.5, checkin_count: 1, total_minutes: 120 },
      { user_id: userA, study_date: '2099-10-21', plan_count: 1, completed_plan_count: 0, completion_rate: 0, checkin_count: 0, total_minutes: 0 },
    ]);
    assert.deepEqual(await rows('select user_id from public.v_user_daily_subject_stats where user_id = $1', [userB]), []);
    assert.deepEqual(await rows("select study_date::text, total_minutes::int from public.v_user_daily_subject_stats order by study_date"), [
      { study_date: '2026-10-20', total_minutes: 90 }, { study_date: '2026-10-21', total_minutes: 120 },
    ]);
  });
  await test('plan editing preserves original subject, date and time snapshots', async () => {
    await db.query("update public.plans set subject = '英语', start_at = '2026-10-22T09:00:00+08:00', end_at = '2026-10-22T10:00:00+08:00' where id = $1", [plan1]);
    assert.deepEqual(await rows('select subject, study_date::text from public.checkins where plan_id = $1', [plan1]), [{ subject: '数学', study_date: '2026-10-21' }]);
  });
  await test('soft deletion preserves history and removes the plan from completion denominator', async () => {
    await db.query("update public.plans set status = 'deleted' where id = $1", [plan1]);
    assert.equal((await rows('select count(*)::int as n from public.checkins where plan_id = $1', [plan1]))[0].n, 1);
    assert.deepEqual(await rows("select plan_count::int, completed_plan_count::int, total_minutes::int from public.v_user_daily_stats where study_date = '2026-10-21'"), [{ plan_count: 1, completed_plan_count: 0, total_minutes: 120 }]);
    await db.query("update public.plans set status = 'deleted' where id = $1", [makeupPlan]);
    assert.deepEqual(await rows("select plan_count::int, completion_rate, total_minutes::int from public.v_user_daily_stats where study_date = '2026-10-20'"), [{ plan_count: 0, completion_rate: null, total_minutes: 90 }]);
  });
  await asUser(userB);
  await test('second user stats contain only their own duration', async () => {
    assert.deepEqual(await rows('select user_id, plan_count::int, total_minutes::int from public.v_user_daily_stats'), [{ user_id: userB, plan_count: 1, total_minutes: 60 }]);
    assert.deepEqual(await rows('select user_id, total_minutes::int from public.v_user_daily_subject_stats'), [{ user_id: userB, total_minutes: 60 }]);
  });
  await asAdmin();
  await test('trigger helpers have no direct client execute privilege', async () => {
    assert.deepEqual(await rows(`select
      has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE') as profile_helper,
      has_function_privilege('authenticated', 'public.snapshot_checkin_plan()', 'EXECUTE') as snapshot_helper`),
    [{ profile_helper: false, snapshot_helper: false }]);
  });
  await asUser('');
  await test('an authenticated role without a user identity sees no data', async () => {
    for (const table of ['profiles', 'plans', 'checkins', 'v_user_daily_stats', 'v_user_daily_subject_stats']) {
      assert.deepEqual(await rows(`select * from public.${table}`), []);
    }
    await invalidPlan({}, ['42501']);
  });
  await asAdmin();
  await db.exec('set role anon;');
  await test('anonymous users cannot read tables or stats', async () => {
    for (const table of ['profiles', 'plans', 'checkins', 'v_user_daily_stats', 'v_user_daily_subject_stats']) {
      await rejects(`select * from public.${table}`, [], ['42501']);
    }
  });
  await asAdmin();
  await test('account deletion cascades profiles, plans and check-ins without touching another user', async () => {
    await db.query('delete from auth.users where id = $1', [userA]);
    for (const [table, key] of [['profiles', 'id'], ['plans', 'user_id'], ['checkins', 'user_id']]) {
      assert.deepEqual(await rows(`select count(*)::int as n from public.${table} where ${key} = $1`, [userA]), [{ n: 0 }]);
    }
    assert.deepEqual(await rows('select plan_id from public.checkins'), [{ plan_id: otherPlan }]);
  });
  passed += await verifyCheckinRpcs(db, await readFile(resolve(migrationDir, '20261022000100_checkin_rpcs.sql'), 'utf8'));
  console.log(`${passed} checks passed. Supabase Auth/API/cloud deployment were not tested.`);
} catch (error) {
  console.error(`${error.code ?? error.name}: ${error.message}`);
  process.exitCode = 1;
} finally { await db.close(); }
