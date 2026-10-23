import assert from 'node:assert/strict';
import test from 'node:test';

import { savePlan } from '../../src/plans/plan-data.ts';
import { checkInPlan, completePlan, loadStudyStats, makeupPlan } from '../../src/study/study-data.ts';
import { aggregateStats, validateMinutes, validateSummary } from '../../src/study/study-domain.ts';

test('makeup accepts only integer minutes from 1 to 1440 before reaching the server', () => {
  for (const input of ['1', '1440', ' 90 ', '0090']) assert.equal(validateMinutes(input).ok, true, input);
  for (const input of ['', ' ', '0', '-1', '1441', '90.5', '1e2', 'Infinity', 'NaN', '99999999999999999999']) {
    assert.equal(validateMinutes(input).ok, false, input);
  }
});

test('summary limit counts PostgreSQL characters rather than UTF-16 units and trims whitespace', () => {
  assert.equal(validateSummary(' \t\n\u3000'), null);
  assert.equal(validateSummary(`\u3000${'📚'.repeat(2000)}\u00a0`), null);
  assert.notEqual(validateSummary('📚'.repeat(2001)), null);
});

test('completion is weighted across one plan collection and zero subjects remain visible', () => {
  const stats = aggregateStats([
    { plan_count: 1, completed_plan_count: 1, total_minutes: 60 },
    { plan_count: 9, completed_plan_count: 0, total_minutes: 120 },
  ], [{ subject: '数学', total_minutes: 60 }, { subject: '数学', total_minutes: 120 }]);
  assert.equal(stats.completionRate, 0.1);
  assert.equal(stats.minutes, 180);
  assert.deepEqual(stats.subjects, { 数学: 180, 英语: 0, 政治: 0, 专业课: 0, 其他: 0 });
});

test('no plans shows null rate while soft-deleted historical minutes remain countable', () => {
  assert.equal(aggregateStats([], []).completionRate, null);
  const stats = aggregateStats([{ plan_count: 0, completed_plan_count: 0, total_minutes: 90 }],
    [{ subject: '英语', total_minutes: 90 }]);
  assert.equal(stats.completionRate, null); assert.equal(stats.minutes, 90); assert.equal(stats.subjects.英语, 90);
});

test('write RPCs request a composite object, exact arguments, no authoritative client time', async () => {
  const calls = [], output = { id: 'returned' };
  const client = { rpc: (name, args) => ({ single: async () => { calls.push({ name, args }); return { data: output, error: null }; } }) };
  assert.equal(await checkInPlan(client, 'plan'), output);
  assert.equal(await makeupPlan(client, 'plan', 90, ''), output);
  assert.equal(await completePlan(client, 'plan', null), output);
  assert.deepEqual(calls, [
    { name: 'check_in_plan', args: { p_plan_id: 'plan', p_geofence_verified: false } },
    { name: 'makeup_plan', args: { p_plan_id: 'plan', p_duration_minutes: 90, p_summary: '' } },
    { name: 'complete_plan', args: { p_plan_id: 'plan', p_summary: null } },
  ]);
});

test('RPC errors propagate without fabricating a saved result', async () => {
  const error = { code: '23505' };
  const client = { rpc: () => ({ single: async () => ({ data: null, error }) }) };
  await assert.rejects(makeupPlan(client, 'plan', 90, null), (failure) => failure === error);
});

test('plan edit payload cannot overwrite a newer completed status, summary or timezone', async () => {
  let payload;
  const query = { eq: () => query, neq: () => query, lt: () => query, gt: () => query,
    limit: async () => ({ data: [], error: null }), select: () => query,
    update: (value) => { payload = value; return query; },
    single: async () => ({ data: { status: 'completed', summary: 'new summary' }, error: null }) };
  const client = { from: () => query };
  const values = { subject: '数学', title: 'edit', start_at: 'start', end_at: 'end' };
  const result = await savePlan(client, 'user', 'id', values, 'UTC', false);
  assert.deepEqual(payload, values);
  assert.equal(result.plan.status, 'completed'); assert.equal(result.plan.summary, 'new summary');
});

test('statistics filter study dates, page all rows, and pass device observation day to scalar streak RPC', async () => {
  const calls = [];
  const client = { from: (view) => {
    const call = { view, filters: [], orders: [] }; calls.push(call);
    const query = { select: () => query,
      eq: (...args) => { call.filters.push(['eq', ...args]); return query; },
      gte: (...args) => { call.filters.push(['gte', ...args]); return query; },
      lt: (...args) => { call.filters.push(['lt', ...args]); return query; },
      order: (column) => { call.orders.push(column); return query; },
      range: async (from, to) => {
        call.range = [from, to];
        return { error: null, data: from === 0 ? Array.from({ length: 500 }, () => view === 'v_user_daily_stats' ?
          { study_date: '2026-10-20', plan_count: 2, completed_plan_count: 1, total_minutes: 1 } :
          { study_date: '2026-10-20', subject: '数学', total_minutes: 1 }) : [] };
      } };
    return query;
  }, rpc: async (name, args) => { assert.equal(name, 'get_checkin_streak');
    assert.deepEqual(args, { p_today: '2026-10-22' }); return { data: 3, error: null }; } };
  const stats = await loadStudyStats(client, 'user', '2026-10-22', { from: '2026-10-19', to: '2026-10-26' });
  assert.equal(stats.minutes, 500); assert.equal(stats.subjects.数学, 500); assert.equal(stats.streak, 3);
  assert.equal(stats.completionRate, 0.5); assert.equal(calls.length, 4);
  for (const call of calls) assert.deepEqual(call.filters,
    [['eq', 'user_id', 'user'], ['gte', 'study_date', '2026-10-19'], ['lt', 'study_date', '2026-10-26']]);
  assert.equal(calls.filter((call) => call.range[0] === 500).length, 2);
});
