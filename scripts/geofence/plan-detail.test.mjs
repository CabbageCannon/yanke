import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

import * as checkinLocation from '../../src/geofence/checkin-location.ts';
import { requestSingleForegroundLocation } from '../../src/geofence/location-request.ts';
import * as studyDomain from '../../src/study/study-domain.ts';

const require = createRequire(import.meta.url);
const code = ts.transpileModule(readFileSync(new URL('../../src/study/plan-detail.tsx', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const plan = { id: 'plan', user_id: 'user', subject: '数学', title: null, start_at: '2026-10-23T01:00:00Z',
  end_at: '2026-10-23T03:00:00Z', timezone: 'Asia/Shanghai', status: 'pending', summary: null,
  geofence_enabled: true, geofence_name: '图书馆', geofence_lat: 31, geofence_lng: 121, geofence_radius: 200 };
const checkin = { id: 'card', plan_id: 'plan', type: 'normal', duration_minutes: 120,
  study_date: '2026-10-23', checked_at: '2026-10-23T01:00:00Z' };

// Execute the actual TSX submit handlers with hook/platform adapters; no native module or cloud mutation.
function detailHarness({ uncertain = false, committed = false } = {}) {
  let cursor = 0, tree, reads = 0, rpcCalls = 0, permissions = 0, positions = 0, decision;
  const hooks = [], effects = [], privacyConfigs = [];
  const React = {
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return hooks[index] ?? (hooks[index] = { current: initial }); },
    useEffect(effect) { const index = cursor++; if (!(index in hooks)) { hooks[index] = true; effects.push(effect); } },
  };
  const sdk = {
    setPrivacyConfig(config) { decision = config; privacyConfigs.push(config); },
    getPrivacyStatus: () => ({ isReady: decision?.hasAgree === true }),
    isNativeSDKConfigured: () => true, isSDKInitialized: () => true,
    async checkLocationPermission() { permissions++; return { granted: true }; },
    async requestLocationPermission() { throw Error('Permission was already granted'); },
    setAllowsBackgroundLocationUpdates() {}, setLocatingWithReGeocode() {}, setLocationMode() {}, setHttpTimeOut() {},
    async getCurrentLocation() { positions++; return { latitude: 31, longitude: 121, accuracy: 5,
      timestamp: Date.now(), coordType: 'GCJ02' }; },
  };
  const data = {
    async loadStudyPlan() {
      reads++;
      if (uncertain && reads === 2) throw Error('Read-back unavailable');
      return { plan, checkin: committed && reads >= 3 ? checkin : null };
    },
    async checkInPlan() { rpcCalls++; if (uncertain) throw Error('Uncertain check-in response'); return checkin; },
    async completePlan() { throw Error('Unexpected completion'); },
    async makeupPlan() { throw Error('Unexpected makeup'); },
  };
  const jsx = (type, props) => ({ type, props });
  const modules = {
    react: React, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { ActivityIndicator: 'ActivityIndicator', AppState: { currentState: 'active' },
      Linking: {}, Pressable: 'Pressable', Text: 'Text', TextInput: 'TextInput', View: 'View' },
    '@/theme': { theme: { colors: { primary: 'green' } } },
    '@/geofence/checkin-location': checkinLocation,
    '@/geofence/location': { locationSupportError: () => null,
      getForegroundLocation: consent => requestSingleForegroundLocation(sdk, 'android', new AbortController().signal, consent) },
    './study-data': data, './study-domain': studyDomain, './study-sheet': { StudySheet: 'StudySheet', studyStyles: {} },
  };
  const moduleObject = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => name in modules ? modules[name] : require(name), moduleObject, moduleObject.exports);
  const props = { initialPlan: plan, client: {}, scope: { userId: 'user', isCurrent: () => true },
    onClose() {}, onEdit() {}, onChanged() {} };
  function render() {
    cursor = 0; tree = moduleObject.exports.PlanDetail(props);
    while (effects.length) effects.shift()();
  }
  function text(node) {
    if (Array.isArray(node)) return node.map(text).join('');
    return node && typeof node === 'object' ? text(node.props?.children) : node ?? '';
  }
  function button(node, label) {
    if (Array.isArray(node)) { for (const child of node) { const found = button(child, label); if (found) return found; } }
    else if (node && typeof node === 'object') {
      if (node.type === 'Pressable' && text(node) === label) return node;
      return button(node.props?.children, label);
    }
    return null;
  }
  async function flush() { for (let index = 0; index < 5; index++) await new Promise(resolve => setImmediate(resolve)); render(); }
  return {
    async mount() { render(); await flush(); },
    async click(label) { const target = button(tree, label); assert.ok(target, `Missing button: ${label}`); target.props.onPress(); await flush(); },
    hasButton: label => !!button(tree, label), text: () => text(tree),
    counts: () => ({ reads, rpcCalls, permissions, positions, decisions: privacyConfigs.map(config => config.hasAgree) }),
  };
}

test('actual detail reconciles an uncertain successful check-in before privacy and never replays the RPC', async () => {
  const detail = detailHarness({ uncertain: true, committed: true });
  await detail.mount();
  await detail.click('实时打卡'); await detail.click('同意并获取本次位置');
  assert.match(detail.text(), /暂时无法确认服务器结果/);
  await detail.click('实时打卡');
  assert.match(detail.text(), /已读取到正常打卡：120分钟；未再次提交打卡/);
  assert.equal(detail.hasButton('同意并获取本次位置'), false);
  assert.equal(detail.hasButton('不同意，本次不定位'), false);
  assert.equal(detail.hasButton('实时打卡'), false);
  assert.deepEqual(detail.counts(), { reads: 3, rpcCalls: 1, permissions: 1, positions: 1, decisions: [true] });
});

test('actual detail fresh refusal synchronizes false without requesting permission, position or RPC', async () => {
  const detail = detailHarness();
  await detail.mount(); await detail.click('实时打卡'); await detail.click('不同意，本次不定位');
  assert.deepEqual(detail.counts(), { reads: 1, rpcCalls: 0, permissions: 0, positions: 0, decisions: [false] });
  assert.equal(detail.hasButton('实时打卡'), true);
  assert.doesNotMatch(detail.text(), /打卡已保存/);
});

test('actual detail unresolved failure with no saved card reconciles before another consent decision', async () => {
  const detail = detailHarness({ uncertain: true });
  await detail.mount(); await detail.click('实时打卡'); await detail.click('同意并获取本次位置');
  await detail.click('实时打卡');
  assert.equal(detail.counts().reads, 3);
  await detail.click('不同意，本次不定位');
  assert.deepEqual(detail.counts(), { reads: 3, rpcCalls: 1, permissions: 1, positions: 1, decisions: [true, false] });
  assert.equal(detail.hasButton('实时打卡'), true);
});
