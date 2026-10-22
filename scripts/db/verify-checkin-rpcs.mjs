import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function verifyCheckinRpcs(db, migration) {
  const a = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const b = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const rows = async (sql, params = []) => (await db.query(sql, params)).rows;
  let passed = 0;
  const check = async (label, run) => { await run(); passed += 1; console.log(`PASS RPC ${label}`); };
  const rejects = async (sql, params, code) => assert.rejects(
    () => db.query(sql, params), (error) => { assert.equal(error.code, code); return true; },
  );
  async function user(id = a) {
    await db.exec('reset role; set role authenticated;');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  }
  const clock = async (time) => db.query("select set_config('yanke.test_now', $1, false)", [time]);
  async function plan(overrides = {}) {
    const value = {
      id: randomUUID(), user_id: a, subject: '数学',
      start_at: '2026-10-22T09:00:00+08:00', end_at: '2026-10-22T11:00:00+08:00',
      timezone: 'Asia/Shanghai', ...overrides,
    };
    const keys = Object.keys(value);
    await db.query(`insert into public.plans (${keys.join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(value));
    return value.id;
  }
  const realtime = async (id, verified = false) => (await rows('select * from public.check_in_plan($1, $2)', [id, verified]))[0];
  const makeup = async (id, minutes, summary = null) => (await rows('select * from public.makeup_plan($1, $2, $3)', [id, minutes, summary]))[0];
  const complete = async (id, summary = null) => (await rows('select * from public.complete_plan($1, $2)', [id, summary]))[0];
  const streak = async (today) => (await rows('select public.get_checkin_streak($1) as n', [today]))[0].n;

  await db.exec('reset role;');
  await db.query('insert into auth.users(id) values ($1),($2)', [a, b]);
  await check('production functions use locked plans, server clocks and explicit execution grants', async () => {
    const functions = await rows(`select proname, prosecdef, provolatile, proconfig, proargnames,
      pg_get_functiondef(oid) as definition from pg_proc where pronamespace = 'public'::regnamespace
      and proname in ('check_in_plan', 'makeup_plan', 'complete_plan', 'get_checkin_streak')`);
    assert.equal(functions.length, 4);
    for (const fn of functions) {
      assert.equal(fn.prosecdef, true);
      assert(fn.proconfig.includes('search_path=""'));
      assert(!fn.proargnames.some((name) => /now|time|user/i.test(name)));
      if (fn.proname !== 'get_checkin_streak') assert.match(fn.definition, /for update/i);
      if (['check_in_plan', 'makeup_plan'].includes(fn.proname)) assert.match(fn.definition, /pg_catalog.clock_timestamp\(\)/);
    }
    for (const signature of ['check_in_plan(uuid,boolean)', 'makeup_plan(uuid,numeric,text)', 'complete_plan(uuid,text)', 'get_checkin_streak(date)']) {
      const [grants] = await rows(`select has_function_privilege('anon', $1, 'EXECUTE') as anon,
        has_function_privilege('authenticated', $1, 'EXECUTE') as authenticated`, [`public.${signature}`]);
      assert.deepEqual(grants, { anon: false, authenticated: true });
    }
  });

  await check('unmodified real-time production entry records its server timestamp', async () => {
    const smokeUser = randomUUID();
    await db.query('insert into auth.users(id) values ($1)', [smokeUser]);
    const [{ zone, start, end }] = await rows(`select name as zone, clock_timestamp() - interval '1 minute' as start,
      clock_timestamp() + interval '1 hour' as "end" from pg_timezone_names
      where name like '%/%' and name not like 'posix/%' and name not like 'right/%'
        and (clock_timestamp() at time zone name)::time between time '09:00' and time '21:00'
      order by name limit 1`);
    await user(smokeUser);
    const id = await plan({ user_id: smokeUser, start_at: start, end_at: end, timezone: zone });
    const before = Date.now();
    const saved = await realtime(id);
    assert.equal(saved.type, 'late');
    assert(saved.duration_minutes >= 58 && saved.duration_minutes <= 60);
    assert(new Date(saved.checked_at).getTime() >= before - 1000);
    assert(new Date(saved.checked_at).getTime() <= Date.now() + 1000);
    await db.exec('reset role;');
    await db.query('delete from auth.users where id=$1', [smokeUser]);
  });

  // Substitute only the clock in this disposable PostgreSQL, never in a deployable migration.
  // Exact endpoints are deterministic without exposing a client-controlled production clock.
  assert.equal(migration.match(/pg_catalog\.clock_timestamp\(\)/g)?.length, 2);
  await db.exec('reset role;');
  await db.exec(`create schema test_clock;
    create function test_clock.now() returns timestamptz language sql volatile set search_path = '' as $$
      select current_setting('yanke.test_now')::timestamptz;
    $$;`);
  await db.exec(migration.replaceAll('create function ', 'create or replace function ')
    .replaceAll('pg_catalog.clock_timestamp()', 'test_clock.now()'));
  await user();

  await check('normal includes exactly start minus 15 minutes and exactly start', async () => {
    for (const time of ['2026-10-22T08:45:00+08:00', '2026-10-22T09:00:00+08:00']) {
      await clock(time);
      const id = await plan();
      const saved = await realtime(id);
      assert.equal(saved.type, 'normal');
      assert.equal(saved.duration_minutes, 120);
      assert.equal((await rows('select status from public.plans where id=$1', [id]))[0].status, 'pending');
    }
  });
  await check('late has no grace, floors minutes and allows zero just before end', async () => {
    for (const [time, minutes] of [
      ['2026-10-22T09:00:00.001+08:00', 119], ['2026-10-22T09:01:00+08:00', 119],
      ['2026-10-22T10:59:59+08:00', 0],
    ]) {
      await clock(time);
      const saved = await realtime(await plan());
      assert.equal(saved.type, 'late');
      assert.equal(saved.duration_minutes, minutes);
    }
  });
  await check('real-time rejects before its opening and at or after end without writing', async () => {
    for (const time of ['2026-10-22T08:44:59.999+08:00', '2026-10-22T11:00:00+08:00', '2026-10-22T11:00:00.001+08:00']) {
      await clock(time);
      const id = await plan();
      await rejects('select public.check_in_plan($1)', [id], '22023');
      assert.equal((await rows('select count(*)::int as n from public.checkins where plan_id=$1', [id]))[0].n, 0);
    }
  });
  await check('optional geofence needs explicit true only when enabled', async () => {
    await clock('2026-10-22T09:00:00+08:00');
    const id = await plan({ geofence_enabled: true, geofence_name: '图书馆', geofence_lat: 31, geofence_lng: 121, geofence_radius: 200 });
    for (const verified of [false, null]) await rejects('select public.check_in_plan($1,$2)', [id, verified], '22023');
    assert.equal((await realtime(id, true)).duration_minutes, 120);
    assert.equal((await realtime(await plan(), null)).duration_minutes, 120);
  });
  await check('real-time replay returns the immutable original even outside window; makeup conflicts', async () => {
    const id = await plan();
    const first = await realtime(id);
    await clock('2026-10-23T12:00:00+08:00');
    const repeated = await realtime(id);
    assert.equal(repeated.id, first.id);
    assert.equal(repeated.duration_minutes, first.duration_minutes);
    assert.equal(new Date(repeated.checked_at).getTime(), new Date(first.checked_at).getTime());
    await rejects('select public.makeup_plan($1,90)', [id], '23505');
  });
  await check('rapid repeated requests preserve a single check-in result', async () => {
    await clock('2026-10-22T09:00:00+08:00');
    const id = await plan();
    const results = await Promise.all(Array.from({ length: 8 }, () => realtime(id)));
    assert.equal(new Set(results.map((row) => row.id)).size, 1);
    assert.equal((await rows('select count(*)::int as n from public.checkins where plan_id=$1', [id]))[0].n, 1);
  });
  await check('makeup includes end and exactly 168 hours; does not complete', async () => {
    for (const time of ['2026-10-22T11:00:00+08:00', '2026-10-29T11:00:00+08:00']) {
      await clock(time);
      const id = await plan();
      const saved = await makeup(id, 1440, ' \n补齐旧知识\t ');
      assert.equal(saved.type, 'makeup');
      assert.equal(saved.duration_minutes, 1440);
      const [snapshot] = await rows('select subject, study_date::text, plan_timezone from public.checkins where id=$1', [saved.id]);
      assert.deepEqual(snapshot, { subject: '数学', study_date: '2026-10-22', plan_timezone: 'Asia/Shanghai' });
      const [p] = await rows('select status,summary from public.plans where id=$1', [id]);
      assert.deepEqual(p, { status: 'pending', summary: '补齐旧知识' });
      await rejects('select public.makeup_plan($1,1)', [id], '23505');
      assert.equal((await realtime(id)).id, saved.id);
    }
  });
  await check('makeup rejects before end, beyond 168 hours, fractions, nonfinite and out-of-range values', async () => {
    for (const time of ['2026-10-22T10:59:59.999+08:00', '2026-10-29T11:00:00.001+08:00']) {
      await clock(time);
      await rejects('select public.makeup_plan($1,90)', [await plan()], '22023');
    }
    await clock('2026-10-23T12:00:00+08:00');
    for (const duration of [null, '1.5', 'NaN', 'Infinity', '-Infinity', '0', '-1', '1441', '1e100']) {
      await rejects('select public.makeup_plan($1,$2::numeric)', [await plan(), duration], '22023');
    }
    assert.equal((await makeup(await plan(), 1)).duration_minutes, 1);
  });
  await check('makeup summary failure rolls back check-in and preserves previous plan values', async () => {
    const id = await plan({ summary: '保留内容' });
    await rejects('select public.makeup_plan($1,90,$2)', [id, '字'.repeat(2001)], '22023');
    assert.equal((await rows('select count(*)::int as n from public.checkins where plan_id=$1', [id]))[0].n, 0);
    assert.equal((await rows('select summary from public.plans where id=$1', [id]))[0].summary, '保留内容');
  });
  await check('completion without check-in is atomic, optional and never creates minutes', async () => {
    const id = await plan({ summary: '原总结' });
    assert.equal((await complete(id)).summary, '原总结');
    assert.equal((await complete(id, '\t\n　\u00a0 ')).summary, null);
    assert.equal((await complete(id, '　复习完成\n ')).summary, '复习完成');
    assert.equal((await complete(id, '')).status, 'completed');
    assert.equal((await rows('select count(*)::int as n from public.checkins where plan_id=$1', [id]))[0].n, 0);
    const pending = await plan({ summary: '先前' });
    await rejects('select public.complete_plan($1,$2)', [pending, '字'.repeat(2001)], '22023');
    assert.deepEqual((await rows('select status,summary from public.plans where id=$1', [pending]))[0], { status: 'pending', summary: '先前' });
    assert.equal((await complete(pending, '字'.repeat(2000))).summary.length, 2000);
  });
  await check('makeup null keeps summary and whitespace explicitly clears it without completion', async () => {
    for (const [input, expected] of [[null, '原总结'], ['\t　\n', null]]) {
      const id = await plan({ summary: '原总结' });
      await makeup(id, 1, input);
      const [p] = await rows('select status,summary from public.plans where id=$1', [id]);
      assert.deepEqual(p, { status: 'pending', summary: expected });
      assert.equal((await complete(id)).summary, expected);
    }
  });
  await check('RPCs hide other users, unknown and deleted plans', async () => {
    const own = await plan();
    const deleted = await plan({ status: 'deleted' });
    await user(b);
    for (const id of [own, deleted, randomUUID()]) {
      await rejects('select public.check_in_plan($1)', [id], 'P0002');
      await rejects('select public.makeup_plan($1,1)', [id], 'P0002');
      await rejects('select public.complete_plan($1)', [id], 'P0002');
    }
    await user();
    await rejects('select public.complete_plan($1)', [deleted], 'P0002');
  });
  await check('anonymous and missing-identity sessions cannot call trusted writes or streak', async () => {
    const id = await plan();
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`reset role; set role ${role};`);
      await db.query("select set_config('request.jwt.claim.sub', '', false)");
      for (const [sql, params] of [
        ['select public.check_in_plan($1)', [id]], ['select public.makeup_plan($1,1)', [id]],
        ['select public.complete_plan($1)', [id]], ['select public.get_checkin_streak($1)', ['2026-10-22']],
      ]) await rejects(sql, params, '42501');
    }
    await user();
  });
  await check('check-in date and subject snapshots survive plan edit and soft deletion', async () => {
    await clock('2026-10-23T12:00:00+08:00');
    const id = await plan();
    await makeup(id, 1);
    await db.query("update public.plans set subject='英语', start_at='2026-10-24T01:00:00Z', end_at='2026-10-24T03:00:00Z', status='deleted' where id=$1", [id]);
    assert.deepEqual(await rows('select subject,study_date::text from public.checkins where plan_id=$1', [id]), [{ subject: '数学', study_date: '2026-10-22' }]);
    await rejects('select public.check_in_plan($1)', [id], 'P0002');
  });

  await check('streak deduplicates study dates, includes zero minutes and ignores future dates', async () => {
    await user(b);
    assert.equal(await streak('2026-10-22'), 0);
    for (const [day, minutes] of [['2026-10-19', 1], ['2026-10-20', 0], ['2026-10-20', 1], ['2026-10-21', 1], ['2026-10-23', 1]]) {
      const id = await plan({ user_id: b, start_at: `${day}T09:00:00+08:00`, end_at: `${day}T11:00:00+08:00` });
      await db.exec('reset role; set role service_role;');
      await db.query("insert into public.checkins(plan_id,user_id,type,duration_minutes) values($1,$2,'normal',$3)", [id, b, minutes]);
      await user(b);
    }
    assert.equal(await streak('2026-10-21'), 3);
    assert.equal(await streak('2026-10-22'), 3);
    assert.equal(await streak('2026-10-23'), 1);
    assert.equal(await streak('2026-10-24'), 1);
    assert.equal(await streak('2026-10-25'), 0);
    await rejects('select public.get_checkin_streak($1)', [null], '22023');
    await rejects('select public.get_checkin_streak($1)', ['infinity'], '22023');
  });
  await check('makeup restores original-date streak across a gap and week; completion adds no day', async () => {
    await clock('2026-10-24T12:00:00+08:00');
    const id = await plan({ user_id: b });
    await makeup(id, 1);
    assert.equal(await streak('2026-10-23'), 5);
    const completedOnly = await plan({ user_id: b, start_at: '2026-10-24T09:00:00+08:00', end_at: '2026-10-24T11:00:00+08:00' });
    await complete(completedOnly);
    assert.equal(await streak('2026-10-25'), 0);
    await user(a);
    assert.equal(await streak('2026-10-23'), 1);
  });

  await db.exec('reset role;');
  return passed;
}
