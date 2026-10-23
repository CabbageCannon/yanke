import type { ExpoGaodeMapModule } from 'expo-gaode-map/build/ExpoGaodeMapModule';

import { isGCJ02Coordinate, type LocationFix } from './domain.ts';

export type LocationSdk = Pick<ExpoGaodeMapModule, 'getPrivacyStatus' | 'isNativeSDKConfigured' |
  'isSDKInitialized' | 'initSDK' | 'checkLocationPermission' | 'requestLocationPermission' |
  'setAllowsBackgroundLocationUpdates' | 'setLocatingWithReGeocode' | 'setLocationMode' |
  'setHttpTimeOut' | 'setDesiredAccuracy' | 'setLocationTimeout' | 'getCurrentLocation'>;
export type LocationResult = { ok: true; location: LocationFix } |
  { ok: false; reason: 'unsupported' | 'privacy' | 'unconfigured' | 'permission' | 'timeout' |
    'background' | 'invalid_location' | 'location_failed' | 'busy'; error: string };
const failure = (reason: Extract<LocationResult, { ok: false }>['reason'], error: string): LocationResult =>
  ({ ok: false, reason, error });

async function bounded<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort = () => {};
  const limit = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(new Error('background'));
    timer = setTimeout(() => reject(new Error('timeout')), 15_000);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
  try { return await Promise.race([operation, limit]); }
  finally { clearTimeout(timer); signal.removeEventListener('abort', onAbort); }
}

// Caller supplies an abort signal tied to foreground state; abort never claims to cancel the native single request.
export async function requestSingleForegroundLocation(sdk: LocationSdk, platform: 'android' | 'ios',
  signal: AbortSignal): Promise<LocationResult> {
  if (signal.aborted) return failure('background', '请回到前台后重新打卡。');
  try {
    if (!sdk.getPrivacyStatus().isReady) return failure('privacy', '请先阅读并同意本次高德定位的隐私说明。');
    if (!sdk.isNativeSDKConfigured()) return failure('unconfigured', '此安装包未配置高德原生定位Key。');
    if (!sdk.isSDKInitialized()) sdk.initSDK({});
    let permission = await bounded(sdk.checkLocationPermission(), signal);
    if (!permission.granted) permission = await bounded(sdk.requestLocationPermission(), signal);
    if (signal.aborted) return failure('background', '请回到前台后重新打卡。');
    if (!permission.granted) return failure('permission', '未获得位置权限，请允许前台定位后重试，或前往系统设置。');
    sdk.setAllowsBackgroundLocationUpdates(false);
    sdk.setLocatingWithReGeocode(false);
    if (platform === 'android') {
      sdk.setLocationMode(1);
      sdk.setHttpTimeOut(10_000);
    } else {
      sdk.setDesiredAccuracy(1);
      sdk.setLocationTimeout(10);
    }
    const raw = await bounded(sdk.getCurrentLocation(), signal);
    if (signal.aborted) return failure('background', '请回到前台后重新打卡。');
    // Android returns coordType explicitly; iOS AMapLocationKit returns AMap coordinates in mainland China.
    const coordType = 'coordType' in raw ? raw.coordType : undefined;
    const point = { latitude: raw.latitude, longitude: raw.longitude, coordinateSystem: 'gcj02' as const };
    if ((platform === 'android' && coordType !== 'GCJ02') || (coordType !== undefined && coordType !== 'GCJ02') ||
        !isGCJ02Coordinate(point) || raw.isAvailableCoordinate === false ||
        !Number.isFinite(raw.accuracy) || raw.accuracy <= 0 ||
        !Number.isFinite(raw.timestamp) || Date.now() - raw.timestamp > 30_000 || raw.timestamp - Date.now() > 5_000) {
      return failure('invalid_location', '未取得有效的新鲜高德坐标，请重新获取位置。');
    }
    return { ok: true, location: { ...point, accuracy: raw.accuracy, timestamp: raw.timestamp } };
  } catch (error) {
    if (error instanceof Error && error.message === 'background') return failure('background', '请回到前台后重新打卡。');
    if (error instanceof Error && error.message === 'timeout') return failure('timeout', '定位超时，请检查定位服务后重试。');
    return failure('location_failed', '定位失败，请检查网络和系统定位服务后重试。');
  }
}
