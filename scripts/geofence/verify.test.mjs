import assert from 'node:assert/strict';
import test from 'node:test';

import { checkGeofence, distanceMeters, isGCJ02Coordinate, validateGeofence } from '../../src/geofence/domain.ts';
import { requestSingleForegroundLocation } from '../../src/geofence/location-request.ts';
import { createPoiSearchHandler } from '../../supabase/functions/amap-poi-search/handler.ts';
import { verifyCheckinLocation } from '../../src/geofence/checkin-location.ts';
import { searchPois } from '../../src/geofence/poi-data.ts';
import { planColumns, savePlan } from '../../src/plans/plan-data.ts';
import { checkInPlan } from '../../src/study/study-data.ts';

const center = { latitude: 31.2304, longitude: 121.4737, coordinateSystem: 'gcj02' };
const fence = { ...center, name: '测试图书馆', radius: 200 };
const now = Date.now();
const fix = (changes = {}) => ({ ...center, accuracy: 10, timestamp: now, ...changes });

test('geofence removal clears every database field; enabled input requires a complete valid selection', () => {
  assert.deepEqual(validateGeofence(null), { ok: true, fields: { geofence_enabled: false, geofence_name: null,
    geofence_lat: null, geofence_lng: null, geofence_radius: null } });
  assert.equal(validateGeofence(fence).fields.geofence_radius, 200);
  for (const radius of [50, 1000]) assert.equal(validateGeofence({ ...fence, radius }).ok, true);
  for (const changes of [{ radius: 49 }, { radius: 1001 }, { radius: 50.5 }, { radius: NaN },
    { name: ' ' }, { name: '字'.repeat(121) }, { latitude: Infinity }, { longitude: 181 },
    { coordinateSystem: 'wgs84' }]) assert.equal(validateGeofence({ ...fence, ...changes }).ok, false);
});

test('only finite numeric GCJ-02 coordinates are accepted at geographic endpoints', () => {
  for (const value of [null, undefined, {}, { ...center, latitude: NaN }, { ...center, longitude: '121' },
    { ...center, latitude: 90.01 }, { ...center, coordinateSystem: 'wgs84' }]) assert.equal(isGCJ02Coordinate(value), false);
  assert.equal(isGCJ02Coordinate({ ...center, latitude: -90, longitude: 180 }), true);
  assert.throws(() => distanceMeters(center, { ...center, latitude: NaN }), RangeError);
});

test('Haversine supports inside/outside, antipodes and exact inclusive radius without rounding', () => {
  assert.equal(distanceMeters(center, center), 0);
  assert.equal(checkGeofence(fence, fix(), now).inside, true);
  assert.equal(checkGeofence(fence, fix({ latitude: center.latitude + 0.01 }), now).inside, false);
  const origin = { latitude: 0, longitude: 0, coordinateSystem: 'gcj02' };
  const boundary = { ...origin, latitude: (200 / 6_371_008.8) * (180 / Math.PI) };
  assert.equal(distanceMeters(origin, boundary), 200);
  assert.equal(checkGeofence({ ...fence, ...origin }, { ...fix(), ...boundary }, now).inside, true);
  assert.equal(checkGeofence({ ...fence, ...origin }, { ...fix(), ...boundary, latitude: boundary.latitude * 1.000001 }, now).inside, false);
  assert.ok(Number.isFinite(distanceMeters(origin, { ...origin, latitude: 0, longitude: 180 })));
});

test('precision and freshness failures cannot verify; accuracy does not change the distance boundary', () => {
  for (const changes of [{ accuracy: 0 }, { accuracy: -1 }, { accuracy: Infinity }, { accuracy: 101 },
    { timestamp: now - 30_001 }, { timestamp: now + 5001 }, { timestamp: NaN }, { coordinateSystem: 'wgs84' }]) {
    assert.equal(checkGeofence(fence, fix(changes), now).ok, false);
  }
  assert.equal(checkGeofence({ ...fence, radius: 50 }, fix({ accuracy: 51 }), now).ok, false);
  assert.equal(checkGeofence(fence, fix({ accuracy: 100 }), now).inside, true);
  assert.equal(checkGeofence(fence, fix({ timestamp: now - 30_000 }), now).ok, true);
});

function sdk(changes = {}) {
  const calls = [];
  const mark = (name) => (...args) => { calls.push([name, ...args]); };
  return { calls, getPrivacyStatus: () => ({ isReady: true }), isNativeSDKConfigured: () => true,
    isSDKInitialized: () => false, initSDK: mark('init'),
    checkLocationPermission: async () => ({ granted: true }),
    requestLocationPermission: async () => ({ granted: true }),
    setAllowsBackgroundLocationUpdates: mark('background'), setLocatingWithReGeocode: mark('address'),
    setLocationMode: mark('mode'), setHttpTimeOut: mark('httpTimeout'),
    setDesiredAccuracy: mark('accuracy'), setLocationTimeout: mark('locationTimeout'),
    getCurrentLocation: async () => ({ ...fix({ timestamp: Date.now() }), coordType: 'GCJ02' }), ...changes };
}
const locate = (driver, platform = 'android', signal = new AbortController().signal) =>
  requestSingleForegroundLocation(driver, platform, signal);

test('single native request uses foreground permission, no web key, no address and native timeout', async () => {
  let permissions = 0, positions = 0;
  const driver = sdk({ checkLocationPermission: async () => ({ granted: false }),
    requestLocationPermission: async () => { permissions++; return { granted: true }; },
    getCurrentLocation: async () => { positions++; return { ...fix(), coordType: 'GCJ02', address: 'discard this' }; } });
  const result = await locate(driver);
  assert.equal(result.ok, true);
  assert.equal(permissions, 1); assert.equal(positions, 1);
  assert.deepEqual(Object.keys(result.location).sort(), ['accuracy', 'coordinateSystem', 'latitude', 'longitude', 'timestamp']);
  assert.deepEqual(driver.calls, [['init', {}], ['background', false], ['address', false], ['mode', 1], ['httpTimeout', 10_000]]);
  const ios = sdk();
  assert.equal((await locate(ios, 'ios')).ok, true);
  assert.deepEqual(ios.calls.slice(-2), [['accuracy', 1], ['locationTimeout', 10]]);
});

test('privacy, key and permission rejection never request a position', async () => {
  let positions = 0;
  const unexpected = async () => { positions++; throw new Error('must not request'); };
  for (const [reason, changes] of [
    ['privacy', { getPrivacyStatus: () => ({ isReady: false }) }],
    ['unconfigured', { isNativeSDKConfigured: () => false }],
    ['permission', { checkLocationPermission: async () => ({ granted: false }), requestLocationPermission: async () => ({ granted: false }) }],
  ]) assert.equal((await locate(sdk({ ...changes, getCurrentLocation: unexpected }))).reason, reason);
  assert.equal(positions, 0);
});

test('Android rejects WGS-84/missing coordinate type; both platforms reject invalid and stale results', async () => {
  for (const changes of [{ coordType: 'WGS84' }, { coordType: undefined }, { latitude: NaN },
    { accuracy: 0 }, { isAvailableCoordinate: false }, { timestamp: Date.now() - 31_000 }]) {
    assert.equal((await locate(sdk({ getCurrentLocation: async () => ({ ...fix(), coordType: 'GCJ02', ...changes }) }))).reason, 'invalid_location');
  }
  assert.equal((await locate(sdk({ getCurrentLocation: async () => fix() }), 'ios')).ok, true);
  assert.equal((await locate(sdk({ getCurrentLocation: async () => { throw new Error('native failure'); } }))).reason, 'location_failed');
});

test('background abort and JS timeout return failure even if the native request later resolves', async (t) => {
  let resolvePosition;
  const operation = new Promise((resolve) => { resolvePosition = resolve; });
  const controller = new AbortController();
  const result = locate(sdk({ getCurrentLocation: () => operation }), 'android', controller.signal);
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  assert.equal((await result).reason, 'background');
  resolvePosition({ ...fix(), coordType: 'GCJ02' });
  assert.equal((await locate(sdk(), 'android', controller.signal)).reason, 'background');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const timed = locate(sdk({ getCurrentLocation: () => new Promise(() => {}) }));
  await new Promise((resolve) => setImmediate(resolve));
  t.mock.timers.tick(15_001);
  assert.equal((await timed).reason, 'timeout');
  t.mock.timers.reset();
});

const authUrl = 'https://test-project.supabase.co/auth/v1/user';
const settings = { supabaseUrl: 'https://test-project.supabase.co', supabaseKey: 'test-anon', amapKey: 'test-server-key' };
const request = (body = { query: '图书馆' }, changes = {}) => new Request('https://test.local/amap-poi-search', {
  method: 'POST', headers: { Authorization: 'Bearer test-user-token', 'Content-Type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body), ...changes });
function handler(upstream = { status: '1', pois: [] }, changes = {}) {
  const calls = [];
  const fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return Response.json(String(input) === authUrl ? { id: 'test-user' } : upstream);
  };
  return { calls, run: createPoiSearchHandler({ ...settings, fetch, ...changes }) };
}

test('POI CORS/method/missing token paths do not contact Auth or upstream', async () => {
  const service = handler();
  assert.equal((await service.run(new Request('https://test.local', { method: 'OPTIONS' }))).status, 204);
  assert.equal((await service.run(new Request('https://test.local'))).status, 405);
  assert.equal((await service.run(request({}, { headers: {} }))).status, 401);
  assert.equal(service.calls.length, 0);
});

test('POI actually verifies user token at Auth; forged JWT, anonymous user and unavailable Auth never reach AMap', async () => {
  for (const [status, auth] of [[401, new Response(null, { status: 401 })],
    [401, Response.json({ id: 'anon-user', is_anonymous: true })],
    [401, Response.json({})], [503, new Response(null, { status: 500 })]]) {
    let calls = 0;
    const service = handler(undefined, { fetch: async (url, init) => {
      calls++; assert.equal(String(url), authUrl); assert.equal(init.headers.Authorization, 'Bearer forged.jwt.payload');
      return auth;
    } });
    assert.equal((await service.run(request({}, { headers: { Authorization: 'Bearer forged.jwt.payload' } }))).status, status);
    assert.equal(calls, 1);
  }
  assert.equal((await handler(undefined, { fetch: async () => { throw new TypeError('network'); } }).run(request())).status, 503);
});

test('POI rejects malformed, oversized and unsupported inputs before contacting AMap', async () => {
  for (const body of ['{', null, [], {}, { query: ' ' }, { query: '字'.repeat(51) },
    { query: 'a\nb' }, { query: '图书馆', page: 0 }, { query: '图书馆', page: 4 },
    { query: '图书馆', page: 1.2 }, { query: '图书馆', page: '1' }, { query: '图书馆', page: null },
    { query: '图书馆', url: 'https://evil.local' }, { query: 'x'.repeat(2049) }]) {
    const service = handler();
    assert.equal((await service.run(request(body))).status, 400, JSON.stringify(body));
    assert.equal(service.calls.length, 1);
  }
  assert.equal((await handler().run(request({}, { headers: { Authorization: 'Bearer user', 'Content-Type': 'text/plain' } }))).status, 400);
});

test('POI missing server key returns explicit 503 after real authentication, with no fake places', async () => {
  const service = handler(undefined, { amapKey: undefined });
  const response = await service.run(request());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'AMAP_UNCONFIGURED');
  assert.equal(service.calls.length, 1);
});

test('POI uses fixed endpoint, safe encoded parameters, bounded page/size/timeout and minimal GCJ-02 response', async () => {
  const service = handler({ status: '1', pois: [{ id: 'poi-1', name: ' 图书馆 ', address: '大学路1号',
    pname: '上海市', cityname: '上海市', adname: '杨浦区', location: '121.4737,31.2304', tel: 'discard', secret: 'discard' },
  { id: 'broken', name: '坏坐标', location: ',' }] });
  const response = await service.run(request({ query: ' 图书馆&key=evil ', page: 3 }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { page: 3, pois: [{ id: 'poi-1', name: '图书馆', address: '上海市杨浦区大学路1号', ...center }] });
  const url = new URL(service.calls[1].url);
  assert.equal(url.origin + url.pathname, 'https://restapi.amap.com/v3/place/text');
  assert.equal(url.searchParams.get('keywords'), '图书馆&key=evil');
  assert.equal(url.searchParams.get('key'), 'test-server-key');
  assert.equal(url.searchParams.get('page'), '3'); assert.equal(url.searchParams.get('offset'), '20');
  assert.ok(service.calls.every((call) => call.init.signal instanceof AbortSignal));
  assert.ok(service.calls.every((call) => call.init.redirect === 'error'));
});

test('POI empty result is valid; malformed coordinates never escape and responses cap at 20 places', async () => {
  assert.deepEqual(await (await handler().run(request())).json(), { pois: [], page: 1 });
  for (const location of [',', 'NaN,31', '181,31', '121,91', '121,31,3', '0x10,31']) {
    const service = handler({ status: '1', pois: [{ id: 'broken', name: '地点', location }] });
    assert.equal((await service.run(request())).status, 502);
  }
  const service = handler({ status: '1', pois: Array.from({ length: 30 }, (_, i) => ({ id: String(i), name: '地点', location: '121,31', address: [] })) });
  assert.equal((await (await service.run(request())).json()).pois.length, 20);
});

test('POI quota, bad response, network, HTTP and timeout errors are generic and contain no key or upstream details', async () => {
  for (const [status, upstream] of [[429, { status: '0', infocode: '10003', info: 'test-server-key' }],
    [502, { status: '0', infocode: '10001', info: 'test-server-key' }], [502, { status: '1' }]]) {
    const response = await handler(upstream).run(request());
    assert.equal(response.status, status); assert.ok(!(await response.text()).includes('test-server-key'));
  }
  for (const [status, result] of [[429, () => new Response(null, { status: 429 })],
    [502, () => new Response(null, { status: 500 })], [502, () => new Response('not json')],
    [502, () => { throw new TypeError('network test-server-key'); }],
    [504, () => { throw new DOMException('test-server-key', 'TimeoutError'); }]]) {
    const response = await handler(undefined, { fetch: async (url) => String(url) === authUrl ? Response.json({ id: 'user' }) : result() }).run(request());
    assert.equal(response.status, status); assert.ok(!(await response.text()).includes('test-server-key'));
  }
});

test('explicit accept and refusal synchronize real SDK consent before any permission or position request', async () => {
  for (const consent of [false, true]) {
    let decision, permissions = 0, positions = 0;
    const driver = sdk({ setPrivacyConfig: (config) => { decision = config; },
      getPrivacyStatus: () => ({ isReady: decision?.hasAgree === true }),
      checkLocationPermission: async () => { permissions++; return { granted: true }; },
      getCurrentLocation: async () => { positions++; return { ...fix({ timestamp: Date.now() }), coordType: 'GCJ02' }; } });
    const result = await requestSingleForegroundLocation(driver, 'android', new AbortController().signal, consent);
    assert.deepEqual(decision, { hasShow: true, hasContainsPrivacy: true, hasAgree: consent,
      privacyVersion: 'yanke-foreground-2026-10-23' });
    assert.equal(result.ok, consent);
    assert.equal(permissions, Number(consent)); assert.equal(positions, Number(consent));
  }
});

const fields = () => validateGeofence(fence).fields;
test('disabled, malformed or closed plan verification never asks for location', async () => {
  let positions = 0;
  const locate = async () => { positions++; return { ok: true, location: fix() }; };
  assert.deepEqual(await verifyCheckinLocation(validateGeofence(null).fields, locate, () => true), { ok: true, verified: false });
  assert.equal((await verifyCheckinLocation({ ...fields(), geofence_lat: null }, locate, () => true)).ok, false);
  assert.equal((await verifyCheckinLocation(fields(), locate, () => false)).ok, false);
  assert.equal(positions, 0);
});

test('only a fresh precise inside fix in the current scope yields verified true; every other path prevents the RPC', async () => {
  const calls = [];
  const client = { rpc: (name, args) => ({ single: async () => { calls.push({ name, args }); return { data: {}, error: null }; } }) };
  for (const location of [fix({ timestamp: Date.now() }), fix({ latitude: center.latitude + 0.01 }),
    fix({ timestamp: Date.now() - 31_000 }), fix({ accuracy: 101 }), fix({ coordinateSystem: 'wgs84' })]) {
    const result = await verifyCheckinLocation(fields(), async () => ({ ok: true, location }), () => true);
    if (result.ok) await checkInPlan(client, 'plan', result.verified);
  }
  for (const reason of ['permission', 'background', 'timeout', 'unsupported']) {
    assert.equal((await verifyCheckinLocation(fields(), async () => ({ ok: false, reason, error: reason }), () => true)).ok, false);
  }
  assert.deepEqual(calls, [{ name: 'check_in_plan', args: { p_plan_id: 'plan', p_geofence_verified: true } }]);
  let current = true;
  assert.equal((await verifyCheckinLocation(fields(), async () => {
    current = false; return { ok: true, location: fix({ timestamp: Date.now() }) };
  }, () => current)).ok, false);
});

test('client POI contract submits only query/page with cancellation; invalid response never becomes selectable', async () => {
  const signal = new AbortController().signal, calls = [];
  const poi = { id: 'real-poi', name: '图书馆', address: '大学路1号', ...center };
  const client = { functions: { invoke: async (name, options) => {
    calls.push({ name, options }); return { data: { pois: [poi], page: 1 }, error: null };
  } } };
  assert.deepEqual(await searchPois(client, ' 图书馆 ', signal), [poi]);
  assert.deepEqual(calls, [{ name: 'amap-poi-search', options: {
    method: 'POST', body: { query: '图书馆', page: 1 }, signal, timeout: 15_000,
  } }]);
  for (const query of [' ', '字'.repeat(51)]) await assert.rejects(searchPois(client, query, signal));
  assert.equal(calls.length, 1);
  for (const data of [null, { page: 2, pois: [poi] }, { page: 1, pois: [{ ...poi, coordinateSystem: 'wgs84' }] },
    { page: 1, pois: [{ ...poi, latitude: Infinity }] }, { page: 1, pois: [{ ...poi, name: '' }] },
    { page: 1, pois: Array.from({ length: 21 }, () => poi) }]) {
    await assert.rejects(searchPois({ functions: { invoke: async () => ({ data, error: null }) } }, '图书馆', signal));
  }
});

test('client POI network, quota and auth errors are retryable and do not expose raw server details', async () => {
  for (const status of [401, 429, 503, 502, undefined]) {
    const client = { functions: { invoke: async () => ({ data: null, error: new Error('private raw server response'),
      response: status ? { status } : undefined }) } };
    await assert.rejects(searchPois(client, '图书馆', new AbortController().signal), (error) =>
      !error.message.includes('private') && /搜索|登录/.test(error.message));
  }
});

test('plan reads and saves all fence columns; removing writes every null without overwriting completion or summary', async () => {
  const columns = ['geofence_enabled', 'geofence_name', 'geofence_lat', 'geofence_lng', 'geofence_radius'];
  for (const column of columns) assert.ok(planColumns.split(',').includes(column));
  let payload;
  const query = { eq: () => query, neq: () => query, lt: () => query, gt: () => query,
    limit: async () => ({ data: [], error: null }), select: () => query,
    update: (value) => { payload = value; return query; },
    single: async () => ({ data: { status: 'completed', summary: 'preserved' }, error: null }) };
  const client = { from: () => query }, values = { subject: '数学', title: null, start_at: 'start', end_at: 'end' };
  for (const geofence of [fence, null]) {
    const result = await savePlan(client, 'user', 'plan', { ...values, ...validateGeofence(geofence).fields }, 'UTC', false);
    assert.deepEqual(payload, { ...values, ...validateGeofence(geofence).fields });
    assert.equal('status' in payload, false); assert.equal('summary' in payload, false); assert.equal('timezone' in payload, false);
    assert.equal(result.plan.status, 'completed'); assert.equal(result.plan.summary, 'preserved');
  }
});
