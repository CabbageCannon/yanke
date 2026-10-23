import Constants, { ExecutionEnvironment } from 'expo-constants';
import { AppState, Platform } from 'react-native';

import { requestSingleForegroundLocation, type LocationResult } from './location-request.ts';

let busy = false;

// Invoke only from a user's real-time check-in on a plan with a geofence.
export async function getForegroundLocation(): Promise<LocationResult> {
  if ((Platform.OS !== 'android' && Platform.OS !== 'ios') ||
      Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return { ok: false, reason: 'unsupported', error: '高德围栏打卡需要原生安装包，Web和Expo Go暂不可用。' };
  }
  if (AppState.currentState !== 'active') return { ok: false, reason: 'background', error: '请回到前台后重新打卡。' };
  if (busy) return { ok: false, reason: 'busy', error: '正在获取位置，请稍候。' };
  busy = true;
  const controller = new AbortController();
  const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') controller.abort(); });
  try {
    const { default: sdk } = await import('expo-gaode-map');
    return await requestSingleForegroundLocation(sdk, Platform.OS, controller.signal);
  } catch {
    return { ok: false, reason: 'unsupported', error: '此安装包不支持高德定位，请安装包含原生模块的版本。' };
  } finally { subscription.remove(); busy = false; }
}
