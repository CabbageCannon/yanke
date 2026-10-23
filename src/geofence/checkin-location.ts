import { checkGeofence, geofenceFromFields, type GeofenceFields } from './domain.ts';
import type { LocationResult } from './location-request.ts';

// Actual coordinates stay in this one operation and are never included in a write payload.
export async function verifyCheckinLocation(fields: GeofenceFields, locate: () => Promise<LocationResult>,
  isCurrent: () => boolean): Promise<{ ok: true; verified: boolean } | { ok: false; error: string }> {
  if (!isCurrent()) return { ok: false, error: '本次操作已关闭，请重新打开计划。' };
  if (!fields.geofence_enabled) return { ok: true, verified: false };
  const fence = geofenceFromFields(fields);
  if (!fence) return { ok: false, error: '围栏信息不完整，请编辑计划重新选择地点。' };
  const result = await locate();
  if (!isCurrent()) return { ok: false, error: '本次操作已关闭，请重新打开计划。' };
  if (!result.ok) return result;
  const checked = checkGeofence(fence, result.location);
  if (!checked.ok) return checked;
  if (!checked.inside) return { ok: false, error: `你在围栏范围外，需进入「${fence.name}」${fence.radius}米内后重试。` };
  return { ok: true, verified: true };
}
