import type { SupabaseClient } from '@supabase/supabase-js';

import { isGCJ02Coordinate, type Poi } from './domain.ts';

export async function searchPois(client: SupabaseClient, query: string, signal: AbortSignal): Promise<Poi[]> {
  const term = query.trim();
  if (!term || Array.from(term).length > 50) throw new Error('请输入1至50字的地点名称。');
  const { data, error, response } = await client.functions.invoke('amap-poi-search', {
    method: 'POST', body: { query: term, page: 1 }, signal, timeout: 15_000,
  });
  if (error) {
    const status = response?.status;
    throw new Error(status === 401 ? '登录状态已过期，请重新登录后搜索。' :
      status === 429 ? '高德搜索次数暂达上限，请稍后重试。' :
      status === 503 ? '地点搜索暂不可用，请稍后重试；也可暂不绑定地点。' :
      '地点搜索未完成，请检查网络后重试。');
  }
  if (!data || data.page !== 1 || !Array.isArray(data.pois) || data.pois.length > 20 ||
      !data.pois.every((poi: unknown) => isGCJ02Coordinate(poi) && 'id' in poi && typeof poi.id === 'string' &&
        !!poi.id && 'name' in poi && typeof poi.name === 'string' && !!poi.name.trim() &&
        Array.from(poi.name.trim()).length <= 120 && 'address' in poi && typeof poi.address === 'string')) {
    throw new Error('地点搜索返回异常，请重新搜索。');
  }
  return data.pois as Poi[];
}
