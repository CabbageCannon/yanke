import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

import { deletePlan, loadPlans, savePlan } from '../../src/plans/plan-data.ts';

const config = Object.fromEntries(['URL', 'PROJECT_REF', 'ANON_KEY', 'SERVICE_ROLE_KEY', 'INTEGRATION_CONFIRM']
  .map((name) => [name, process.env[`YANKE_SUPABASE_${name}`]]));
for (const [name, value] of Object.entries(config)) assert(value, `Missing ${name}; no remote work performed`);
assert.match(config.PROJECT_REF, /^[a-z]{20}$/);
assert.equal(config.URL, `https://${config.PROJECT_REF}.supabase.co`);
assert.equal(config.INTEGRATION_CONFIRM, config.PROJECT_REF, 'Explicit test-project confirmation required');
const options = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } };
const admin = createClient(config.URL, config.SERVICE_ROLE_KEY, options);
const identities = [];
let failed = false, passed = 0;
const check = async (name, run) => { await run(); passed++; console.log(`PASS ${name}`); };
const ok = (result) => { assert.equal(result.error, null, result.error?.code ?? 'request failed'); return result.data; };
async function sandbox() {
  const email = `yanke-plans-${randomUUID()}@example.invalid`, password = `Yk-${randomBytes(24).toString('base64url')}!`;
  const { user } = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true,
    user_metadata: { yanke_sandbox: true } }));
  identities.push(user.id);
  const client = createClient(config.URL, config.ANON_KEY, options);
  ok(await client.auth.signInWithPassword({ email, password }));
  return { client, id: user.id };
}
try {
  const a = await sandbox(), b = await sandbox(), id = randomUUID();
  const values = { subject: '数学', title: 'T06 sandbox', start_at: '2030-01-07T01:00:00.000Z', end_at: '2030-01-07T03:00:00.000Z' };
  const range = ['2030-01-06T16:00:00.000Z', '2030-01-13T16:00:00.000Z'];
  await check('real repository create and same-UUID retry update exactly one owned plan', async () => {
    await savePlan(a.client, a.id, id, values, 'Asia/Shanghai', true);
    const retry = await savePlan(a.client, a.id, id, { ...values, title: 'retry retained draft' }, 'Asia/Shanghai', true);
    assert.equal(retry.plan.id, id);
    const plans = await loadPlans(a.client, a.id, ...range);
    assert.equal(plans.length, 1); assert.equal(plans[0].title, 'retry retained draft');
  });
  await check('real JWT/RLS rejects cross-user reads, edits, deletes and forged ownership', async () => {
    assert.equal((await loadPlans(b.client, a.id, ...range)).length, 0);
    await assert.rejects(savePlan(b.client, a.id, id, values, 'Asia/Shanghai', false));
    await assert.rejects(deletePlan(b.client, a.id, id));
    await assert.rejects(savePlan(a.client, b.id, randomUUID(), values, 'Asia/Shanghai', true));
  });
  await check('editing leaves frozen timezone and existing geofence fields untouched', async () => {
    ok(await a.client.from('plans').update({ geofence_enabled: true, geofence_name: 'sandbox location',
      geofence_lat: 31.2, geofence_lng: 121.5, geofence_radius: 200 }).eq('id', id));
    await savePlan(a.client, a.id, id, { ...values, subject: '英语' }, 'America/New_York', false);
    const plan = ok(await a.client.from('plans').select('*').eq('id', id).single());
    assert.equal(plan.timezone, 'Asia/Shanghai'); assert.equal(plan.geofence_enabled, true);
    assert.equal(plan.geofence_name, 'sandbox location'); assert.equal(plan.geofence_radius, 200);
    assert.equal(plan.geofence_lat, 31.2); assert.equal(plan.geofence_lng, 121.5);
  });
  await check('overlap is allowed and detected; adjacent interval is not a conflict', async () => {
    const overlap = await savePlan(a.client, a.id, randomUUID(), values, 'Asia/Shanghai', true);
    assert.equal(overlap.overlap, true);
    const adjacent = await savePlan(a.client, a.id, randomUUID(), { ...values,
      start_at: values.end_at, end_at: '2030-01-07T04:00:00.000Z' }, 'Asia/Shanghai', true);
    assert.equal(adjacent.overlap, false);
  });
  await check('soft-delete retry is idempotent, hidden from load and not resurrected by save', async () => {
    assert.equal((await deletePlan(a.client, a.id, id)).status, 'deleted');
    assert.equal((await deletePlan(a.client, a.id, id)).status, 'deleted');
    assert.equal((await loadPlans(a.client, a.id, ...range)).some((plan) => plan.id === id), false);
    await assert.rejects(savePlan(a.client, a.id, id, values, 'Asia/Shanghai', false));
  });
} catch (error) {
  failed = true;
  console.error('FAIL plan integration:', error?.code ?? error?.name ?? 'unknown');
} finally {
  for (const id of identities) {
    try { ok(await admin.auth.admin.deleteUser(id)); }
    catch { failed = true; console.error('FAIL sandbox identity cleanup'); }
  }
  if (identities.length) {
    for (const [table, column] of [['profiles', 'id'], ['plans', 'user_id'], ['checkins', 'user_id']]) {
      try {
        const result = await admin.from(table).select('*', { head: true, count: 'exact' }).in(column, identities);
        ok(result); assert.equal(result.count, 0);
      } catch { failed = true; console.error(`FAIL ${table} sandbox cascade cleanup`); }
    }
  }
  console.log(`Plan integration: ${passed}/5 groups passed; cleanup ${failed ? 'requires inspection' : 'passed'}`);
}
if (failed) process.exitCode = 1;
