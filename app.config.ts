export default {
  expo: {
    name: '研刻',
    slug: 'yanke',
    scheme: 'yanke',
    ios: { bundleIdentifier: 'com.yanke.app' },
    android: { package: 'com.yanke.app' },
    plugins: ['expo-router', 'expo-gaode-map', 'expo-notifications'],
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      amapWebKey: process.env.EXPO_PUBLIC_AMAP_WEB_KEY,
    },
  },
};