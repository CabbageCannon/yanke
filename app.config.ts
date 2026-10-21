import type { ExpoConfig } from 'expo/config';

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
  ],
};

export default config;
