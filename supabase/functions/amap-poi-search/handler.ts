type Fetch = typeof fetch;
type Settings = { supabaseUrl?: string; supabaseKey?: string; amapKey?: string; fetch?: Fetch };
const cors = { 'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' };
const limitedCodes = new Set(['10003', '10004', '10014', '10044', '10045']);
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const timeoutError = (error: unknown) => error instanceof Error &&
  (error.name === 'TimeoutError' || error.name === 'AbortError');
const json = (status: number, body: unknown) => Response.json(body, { status, headers: cors });
const fail = (status: number, code: string, message: string) => json(status, { error: { code, message } });

async function readInput(request: Request): Promise<unknown> {
  if (!request.body) throw new Error('body');
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0, body = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 2048) { await reader.cancel(); throw new Error('body'); }
      body += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } finally { reader.releaseLock(); }
}

function poi(value: unknown) {
  if (!record(value) || typeof value.id !== 'string' || !value.id.trim() || value.id.length > 128 ||
      typeof value.name !== 'string' || !value.name.trim() || Array.from(value.name.trim()).length > 120 ||
      typeof value.location !== 'string') return null;
  const parts = value.location.split(',');
  if (parts.length !== 2 || parts.some((part) => !/^-?\d+(\.\d+)?$/.test(part.trim()))) return null;
  const [longitude, latitude] = parts.map(Number);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  const address = [...new Set([value.pname, value.cityname, value.adname, value.address]
    .filter((part): part is string => typeof part === 'string' && !!part.trim()).map((part) => part.trim()))]
    .join('').slice(0, 500);
  return { id: value.id, name: value.name.trim(), address, latitude, longitude, coordinateSystem: 'gcj02' };
}

export function createPoiSearchHandler(settings: Settings) {
  const requestFetch = settings.fetch ?? fetch;
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', '请使用POST搜索地点。');
    const bearer = /^Bearer ([^\s]+)$/i.exec(request.headers.get('Authorization') ?? '');
    if (!bearer || bearer[1].length > 8192) return fail(401, 'UNAUTHORIZED', '请登录后搜索地点。');
    if (!settings.supabaseUrl || !settings.supabaseKey) return fail(503, 'UNAVAILABLE', '地点服务尚未配置。');
    // GoTrue verifies the signature, expiry and real user; decoding a JWT is not authentication.
    try {
      const auth = await requestFetch(`${settings.supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
        headers: { apikey: settings.supabaseKey, Authorization: `Bearer ${bearer[1]}` },
        signal: AbortSignal.timeout(5000), redirect: 'error',
      });
      if (auth.status === 401 || auth.status === 403) return fail(401, 'UNAUTHORIZED', '登录已失效，请重新登录。');
      if (!auth.ok) return fail(503, 'AUTH_UNAVAILABLE', '暂时无法验证账号，请稍后重试。');
      const user: unknown = await auth.json();
      if (!record(user) || typeof user.id !== 'string' || !user.id || user.is_anonymous === true) {
        return fail(401, 'UNAUTHORIZED', '请登录后搜索地点。');
      }
    } catch {
      return fail(503, 'AUTH_UNAVAILABLE', '暂时无法验证账号，请稍后重试。');
    }
    if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return fail(400, 'INVALID_INPUT', '请提交JSON搜索词。');
    }
    let body: unknown;
    try { body = await readInput(request); } catch { return fail(400, 'INVALID_INPUT', '搜索参数无效。'); }
    if (!record(body) || Object.keys(body).some((key) => key !== 'query' && key !== 'page') ||
        typeof body.query !== 'string') return fail(400, 'INVALID_INPUT', '搜索参数无效。');
    const query = body.query.trim(), page = body.page === undefined ? 1 : body.page;
    if (!query || Array.from(query).length > 50 || /[\u0000-\u001f\u007f]/.test(query) ||
        !Number.isInteger(page) || (page as number) < 1 || (page as number) > 3) {
      return fail(400, 'INVALID_INPUT', '搜索词须为1至50字，页码须为1至3。');
    }
    if (!settings.amapKey) return fail(503, 'AMAP_UNCONFIGURED', '高德地点搜索尚未配置，请稍后重试。');
    const endpoint = new URL('https://restapi.amap.com/v3/place/text');
    endpoint.search = new URLSearchParams({ key: settings.amapKey, keywords: query,
      page: String(page), offset: '20', extensions: 'base', output: 'JSON' }).toString();
    try {
      const upstream = await requestFetch(endpoint, { signal: AbortSignal.timeout(8000), redirect: 'error' });
      if (upstream.status === 429) return fail(429, 'RATE_LIMITED', '地点搜索次数受限，请稍后重试。');
      if (!upstream.ok) return fail(502, 'AMAP_UNAVAILABLE', '高德地点服务暂时不可用，请稍后重试。');
      const data: unknown = await upstream.json();
      if (record(data) && limitedCodes.has(String(data.infocode))) {
        return fail(429, 'RATE_LIMITED', '地点搜索次数受限，请稍后重试。');
      }
      if (!record(data) || data.status !== '1' || !Array.isArray(data.pois)) {
        return fail(502, 'AMAP_UNAVAILABLE', '高德地点服务暂时不可用，请稍后重试。');
      }
      const pois = data.pois.slice(0, 20).map(poi).filter((item) => item !== null);
      if (data.pois.length > 0 && pois.length === 0) return fail(502, 'AMAP_UNAVAILABLE', '地点数据无效，请稍后重试。');
      return json(200, { pois, page });
    } catch (error) {
      return timeoutError(error) ? fail(504, 'AMAP_TIMEOUT', '地点搜索超时，请重试。') :
        fail(502, 'AMAP_UNAVAILABLE', '高德地点服务暂时不可用，请稍后重试。');
    }
  };
}
