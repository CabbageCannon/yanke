export type GCJ02Coordinate = { latitude: number; longitude: number; coordinateSystem: 'gcj02' };
export type Poi = GCJ02Coordinate & { id: string; name: string; address: string };
export type Geofence = GCJ02Coordinate & { name: string; radius: number };
export type LocationFix = GCJ02Coordinate & { accuracy: number; timestamp: number };
export type GeofenceFields = {
  geofence_enabled: boolean;
  geofence_name: string | null;
  geofence_lat: number | null;
  geofence_lng: number | null;
  geofence_radius: number | null;
};
export const defaultGeofenceRadius = 200;

export function geofenceFromFields(value: GeofenceFields): Geofence | null {
  if (!value.geofence_enabled || value.geofence_name === null || value.geofence_lat === null ||
      value.geofence_lng === null || value.geofence_radius === null) return null;
  const geofence: Geofence = { name: value.geofence_name, latitude: value.geofence_lat,
    longitude: value.geofence_lng, radius: value.geofence_radius, coordinateSystem: 'gcj02' };
  return validateGeofence(geofence).ok ? geofence : null;
}

export function isGCJ02Coordinate(value: unknown): value is GCJ02Coordinate {
  if (!value || typeof value !== 'object') return false;
  const point = value as Partial<GCJ02Coordinate>;
  return point.coordinateSystem === 'gcj02' && typeof point.latitude === 'number' &&
    Number.isFinite(point.latitude) && point.latitude >= -90 && point.latitude <= 90 &&
    typeof point.longitude === 'number' && Number.isFinite(point.longitude) &&
    point.longitude >= -180 && point.longitude <= 180;
}

export function validateGeofence(value: Geofence | null):
  { ok: true; fields: GeofenceFields } | { ok: false; error: string } {
  if (value === null) return { ok: true, fields: { geofence_enabled: false, geofence_name: null,
    geofence_lat: null, geofence_lng: null, geofence_radius: null } };
  if (!isGCJ02Coordinate(value) || typeof value.name !== 'string' || !value.name.trim() ||
      Array.from(value.name.trim()).length > 120) {
    return { ok: false, error: '请先选择有效的高德地点。' };
  }
  if (!Number.isInteger(value.radius) || value.radius < 50 || value.radius > 1000) {
    return { ok: false, error: '围栏半径须为50至1000米的整数。' };
  }
  return { ok: true, fields: { geofence_enabled: true, geofence_name: value.name.trim(),
    geofence_lat: value.latitude, geofence_lng: value.longitude, geofence_radius: value.radius } };
}

export function distanceMeters(a: GCJ02Coordinate, b: GCJ02Coordinate): number {
  if (!isGCJ02Coordinate(a) || !isGCJ02Coordinate(b)) throw new RangeError('需要有效的GCJ-02坐标。');
  const rad = (degrees: number) => degrees * Math.PI / 180;
  const h = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 2 * 6_371_008.8 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function checkGeofence(value: Geofence, fix: LocationFix, now = Date.now()):
  { ok: true; inside: boolean; distanceMeters: number } | { ok: false; error: string } {
  const valid = validateGeofence(value);
  if (!valid.ok) return valid;
  if (!isGCJ02Coordinate(fix)) return { ok: false, error: '定位坐标无效，请重新获取位置。' };
  if (!Number.isFinite(fix.accuracy) || fix.accuracy <= 0 || fix.accuracy > Math.min(100, value.radius)) {
    return { ok: false, error: '定位精度不足，请开启精确位置后重试。' };
  }
  if (!Number.isFinite(now) || !Number.isFinite(fix.timestamp) || now - fix.timestamp > 30_000 ||
      fix.timestamp - now > 5_000) return { ok: false, error: '位置已过期，请重新获取位置。' };
  const distance = distanceMeters(value, fix);
  return { ok: true, inside: distance <= value.radius, distanceMeters: distance };
}
