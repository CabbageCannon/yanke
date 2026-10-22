export type SupabaseConfig =
  | { kind: 'ready'; url: string; key: string }
  | { kind: 'missing' | 'invalid' | 'unsafe' };

export function parseSupabaseConfig(urlValue?: string, keyValue?: string): SupabaseConfig {
  const url = urlValue?.trim() ?? '';
  const key = keyValue?.trim() ?? '';
  let publicKey = key.startsWith('sb_publishable_') && key.length > 15;

  if (key.startsWith('sb_secret_')) return { kind: 'unsafe' };
  if (key.split('.').length === 3) {
    try {
      const payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const claims: unknown = JSON.parse(atob(payload));
      if (typeof claims === 'object' && claims !== null && 'role' in claims) {
        if (claims.role === 'service_role') return { kind: 'unsafe' };
        publicKey = claims.role === 'anon';
      }
    } catch {
      return { kind: 'invalid' };
    }
  }
  if (!url || !key) return { kind: 'missing' };
  if (!publicKey) return { kind: 'invalid' };
  try {
    const parsed = new URL(url);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if ((parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) ||
        parsed.username || parsed.password || parsed.search || parsed.hash) {
      return { kind: 'invalid' };
    }
    return { kind: 'ready', url: url.replace(/\/+$/, ''), key };
  } catch {
    return { kind: 'invalid' };
  }
}
