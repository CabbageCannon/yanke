import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { parseSupabaseConfig } from './supabase-config';

export function getSupabaseConfig() {
  return parseSupabaseConfig(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  );
}

let client: SupabaseClient | undefined;

// Called after mount: static rendering must not touch browser/native session storage.
export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (config.kind !== 'ready') return null;
  client ??= createClient(config.url, config.key, {
    auth: {
      storage: AsyncStorage,
      storageKey: 'yanke.auth.session',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}
