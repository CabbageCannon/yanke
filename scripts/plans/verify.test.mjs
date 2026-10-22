import assert from 'node:assert/strict';
import test from 'node:test';

import { draftForPlan, newPlanDraft, overlaps, validatePlan } from '../../src/plans/plan-domain.ts';

const draft = (changes = {}) => ({ subject: '数学', title: '', date: '2026-10-22', start: '09:00', end: '11:00', ...changes });

test('Shanghai wall time becomes UTC and round-trips using the frozen plan timezone', () => {
  const result = validatePlan(draft({ title: '  高数  ' }), 'Asia/Shanghai');
  assert.equal(result.ok, true);
  assert.equal(result.values.start_at, '2026-10-22T01:00:00.000Z');
  assert.equal(result.values.end_at, '2026-10-22T03:00:00.000Z');
  assert.equal(result.values.title, '高数');
  assert.deepEqual(draftForPlan({ ...result.values, timezone: 'Asia/Shanghai' }), draft({ title: '高数' }));
});

test('IANA summer and winter offsets remain distinct and edits keep original wall time', () => {
  for (const [date, expected] of [['2026-07-01', '2026-07-01T13:00:00.000Z'], ['2026-12-01', '2026-12-01T14:00:00.000Z']]) {
    const result = validatePlan(draft({ date }), 'America/New_York');
    assert.equal(result.ok, true);
    assert.equal(result.values.start_at, expected);
    assert.equal(draftForPlan({ ...result.values, timezone: 'America/New_York' }).start, '09:00');
  }
});

test('accepts minimum duration and exact visible endpoints, including UTC', () => {
  for (const times of [{ start: '08:00', end: '08:15' }, { start: '22:45', end: '23:00' }]) {
    assert.equal(validatePlan(draft(times), 'UTC').ok, true);
  }
  assert.equal(validatePlan(draft({ title: '   ' }), 'UTC').values.title, null);
});

test('rejects short, reversed, out-of-grid and malformed times', () => {
  for (const times of [{ start: '08:00', end: '08:14' }, { start: '11:00', end: '09:00' },
    { start: '07:59', end: '09:00' }, { start: '22:00', end: '23:01' },
    { start: '22:00', end: '00:00' }, { start: '9:00' }, { start: '09:60' }, { end: '24:00' }]) {
    assert.equal(validatePlan(draft(times), 'Asia/Shanghai').ok, false, JSON.stringify(times));
  }
});

test('rejects nonexistent dates, invalid zones and a skipped IANA calendar day', () => {
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-1-01']) {
    assert.equal(validatePlan(draft({ date }), 'Asia/Shanghai').ok, false, date);
  }
  assert.equal(validatePlan(draft({ date: '2028-02-29' }), 'Asia/Shanghai').ok, true);
  for (const zone of ['Not/AZone', '+08:00', 'local']) assert.equal(validatePlan(draft(), zone).ok, false);
  assert.equal(validatePlan(draft({ date: '2011-12-30' }), 'Pacific/Apia').ok, false);
});

test('validates subject and trimmed title character limit', () => {
  assert.equal(validatePlan(draft({ subject: '物理' }), 'UTC').ok, false);
  assert.equal(validatePlan(draft({ title: '字'.repeat(101) }), 'UTC').ok, false);
  assert.equal(validatePlan(draft({ title: '字'.repeat(100) }), 'UTC').ok, true);
});

test('grid selection snaps down to half-hours and stays in the same visible day', () => {
  assert.deepEqual(newPlanDraft(new Date('2026-10-22T01:17:00Z'), 'Asia/Shanghai'), draft({ end: '10:00' }));
  const late = newPlanDraft(new Date('2026-10-22T15:00:00Z'), 'Asia/Shanghai');
  assert.equal(late.start, '22:30'); assert.equal(late.end, '23:00');
  assert.equal(validatePlan(late, 'Asia/Shanghai').ok, true);
});

test('adjacent plans are not overlapping; intersections across dates are', () => {
  const a = { start_at: '2026-10-22T01:00:00Z', end_at: '2026-10-22T03:00:00Z' };
  assert.equal(overlaps(a, { start_at: a.end_at, end_at: '2026-10-22T04:00:00Z' }), false);
  assert.equal(overlaps(a, { start_at: '2026-10-22T02:00:00Z', end_at: '2026-10-22T05:00:00Z' }), true);
  assert.equal(overlaps(a, { start_at: '2026-10-21T23:00:00Z', end_at: '2026-10-22T02:00:00Z' }), true);
});
