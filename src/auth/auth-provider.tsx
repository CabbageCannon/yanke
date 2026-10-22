import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';

import { AuthSessionStore, type AuthActionResult, type AuthSnapshot, type SessionScope } from '@/lib/auth-session';
import { getSupabaseClient, getSupabaseConfig } from '@/lib/supabase';

type AuthState = Omit<AuthSnapshot, 'phase'> & { phase: AuthSnapshot['phase'] | 'unconfigured' };
type AuthContextValue = AuthState & {
  client: SupabaseClient | null;
  scope: SessionScope | null;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signUp: (email: string, password: string) => Promise<AuthActionResult>;
  signOut: () => Promise<AuthActionResult>;
  retry: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const unavailable = async () => ({ error: '账号服务暂时不可用，请稍后再试。' });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [config] = useState(getSupabaseConfig);
  const [attempt, setAttempt] = useState(0);
  const [runtime, setRuntime] = useState<{ client: SupabaseClient; store: AuthSessionStore } | null>(null);
  const [snapshot, setSnapshot] = useState<AuthState>({
    phase: config.kind === 'ready' ? 'restoring' : 'unconfigured',
    session: null, version: 0, error: null,
  });

  useEffect(() => {
    if (config.kind !== 'ready') return;
    let disposed = false;
    let disconnect: (() => void) | undefined;
    // Connect after mount so static rendering never starts session persistence.
    void Promise.resolve().then(getSupabaseClient).then((client) => {
      if (disposed || !client) return;
      const store = new AuthSessionStore(client.auth);
      setRuntime({ client, store });
      const unsubscribe = store.subscribe(() => setSnapshot(store.getSnapshot()));
      void store.start();

      const updateRefresh = (state: string | null | undefined) => {
        const refresh = state === 'active' ? client.auth.startAutoRefresh() : client.auth.stopAutoRefresh();
        void refresh.catch(() => store.restore());
      };
      const appState = AppState.addEventListener('change', updateRefresh);
      updateRefresh(AppState.currentState);
      disconnect = () => {
        unsubscribe();
        store.stop();
        appState.remove();
        void client.auth.stopAutoRefresh();
      };
    }).catch(() => {
      if (!disposed) setSnapshot({ phase: 'restoreError', session: null, version: 0,
        error: '账号服务暂时不可用，请稍后重试。' });
    });
    return () => {
      disposed = true;
      disconnect?.();
    };
  }, [config, attempt]);

  const userId = snapshot.session?.user.id;
  const scope = useMemo(() => {
    if (snapshot.phase !== 'signedIn') return null;
    const current = runtime?.store.getScope();
    return current?.key === `${userId}:${snapshot.version}` ? current : null;
  },
    [runtime, snapshot.phase, snapshot.version, userId]);

  return (
    <AuthContext.Provider value={{
      ...snapshot,
      client: snapshot.phase === 'signedIn' ? runtime?.client ?? null : null,
      scope,
      signIn: runtime?.store.signIn ?? unavailable,
      signUp: runtime?.store.signUp ?? unavailable,
      signOut: runtime?.store.signOut ?? unavailable,
      retry: () => {
        if (!runtime) setAttempt((value) => value + 1);
        else if (snapshot.phase === 'signOutError') void runtime.store.signOut();
        else void runtime.store.restore();
      },
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside AuthProvider');
  return auth;
}
