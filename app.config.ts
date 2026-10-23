import type { ExpoConfig } from 'expo/config';
import { parseSupabaseConfig } from './src/lib/supabase-config.ts';

const publicKeys = [
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
];
if (publicKeys.some((key) => parseSupabaseConfig(undefined, key).kind === 'unsafe')) {
  throw new Error('Supabase 服务端 Key 不能用于客户端公开配置。');
}

const config: ExpoConfig = {
  name: '研刻',
  slug: 'yanke',
  version: '0.1.0',
  scheme: 'yanke',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  ios: { bundleIdentifier: 'com.yanke.app' },
  android: {
    package: 'com.yanke.app',
    blockedPermissions: [
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.FOREGROUND_SERVICE_LOCATION',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
  },
  web: { output: 'static' },
  plugins: [
    'expo-router',
    [
      'expo-gaode-map',
      {
        androidKey: process.env.AMAP_ANDROID_KEY,
        iosKey: process.env.AMAP_IOS_KEY,
        enableLocation: true,
        enableBackgroundLocation: false,
        locationDescription: '仅在打卡时获取一次前台位置，以判断是否在计划围栏内。',
      },
    ],
    './plugins/with-amap-android-dependencies.js',
  ],
};

export default config;
