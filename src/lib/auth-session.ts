import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';

type AuthApi = Pick<SupabaseClient['auth'], 'getSession' | 'onAuthStateChange' |
  'signInWithPassword' | 'signUp' | 'signOut'>;
export type AuthPhase = 'restoring' | 'signedOut' | 'signedIn' | 'restoreError' |
  'signingOut' | 'signOutError';
export type AuthSnapshot = {
  phase: AuthPhase;
  session: Session | null;
  version: number;
  error: string | null;
};
export type AuthActionResult = { error: string | null; needsEmailConfirmation?: boolean };
export type SessionScope = { key: string; userId: string; isCurrent: () => boolean };

export function validateCredentials(email: string, password: string, register = false) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 254) {
    return '请输入有效的邮箱地址。';
  }
  if (!password) return '请输入密码。';
  if (register && password.length < 6) return '密码至少需要6位。';
  return null;
}

export function authErrorMessage(error: unknown, action: string) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  switch (code) {
    case 'invalid_credentials': return '邮箱或密码不正确。';
    case 'email_not_confirmed': return '请先确认邮箱，再登录。';
    case 'user_already_exists':
    case 'email_exists': return '该邮箱已注册，请直接登录。';
    case 'weak_password': return '密码强度不足，请使用更长的密码。';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit': return '操作过于频繁，请稍后重试。';
    case 'signup_disabled': return '暂时无法注册，请稍后再试。';
    default: return `${action}失败，请检查网络后重试。`;
  }
}

export class AuthSessionStore {
  private snapshot: AuthSnapshot = { phase: 'restoring', session: null, version: 0, error: null };
  private listeners = new Set<() => void>();
  private subscription: { unsubscribe: () => void } | null = null;
  private request = 0;
  private activeRequest: number | null = null;
  private eventVersion = 0;
  private stopped = false;
  private auth: AuthApi;

  constructor(auth: AuthApi) { this.auth = auth; }

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  async start() {
    this.subscription = this.auth.onAuthStateChange(this.onAuthEvent).data.subscription;
    await this.restore();
  }

  stop() {
    this.stopped = true;
    this.request += 1;
    this.subscription?.unsubscribe();
    this.listeners.clear();
  }

  private update(phase: AuthPhase, session: Session | null, error: string | null = null) {
    if (this.stopped) return;
    const changedUser = this.snapshot.session?.user.id !== session?.user.id;
    this.snapshot = {
      phase, session, error,
      version: this.snapshot.version + (changedUser ? 1 : 0),
    };
    for (const listener of this.listeners) listener();
  }

  private onAuthEvent = (event: AuthChangeEvent, session: Session | null) => {
    if (this.stopped || event === 'INITIAL_SESSION') return;
    if (event === 'SIGNED_OUT') {
      this.request += 1;
      this.activeRequest = null;
      this.eventVersion += 1;
      this.update('signedOut', null);
      return;
    }
    if (this.snapshot.phase === 'signingOut' || this.snapshot.phase === 'signOutError') return;
    if (event === 'TOKEN_REFRESHED' && this.snapshot.session?.user.id !== session?.user.id) return;
    this.eventVersion += 1;
    this.update(session ? 'signedIn' : 'signedOut', session);
  };

  getScope(): SessionScope | null {
    const { session, version, phase } = this.snapshot;
    if (phase !== 'signedIn' || !session) return null;
    return {
      key: `${session.user.id}:${version}`,
      userId: session.user.id,
      isCurrent: () => !this.stopped && this.snapshot.phase === 'signedIn' &&
        this.snapshot.version === version && this.snapshot.session?.user.id === session.user.id,
    };
  }

  restore = async () => {
    if (this.activeRequest !== null || this.snapshot.phase === 'signOutError') return;
    const request = ++this.request;
    const eventVersion = this.eventVersion;
    this.activeRequest = request;
    this.update('restoring', null);
    try {
      const { data, error } = await this.auth.getSession();
      if (request !== this.request || eventVersion !== this.eventVersion || this.stopped) return;
      if (error) this.update('restoreError', null, authErrorMessage(error, '恢复账号'));
      else this.update(data.session ? 'signedIn' : 'signedOut', data.session);
    } catch (error) {
      if (request === this.request && eventVersion === this.eventVersion) {
        this.update('restoreError', null, authErrorMessage(error, '恢复账号'));
      }
    } finally {
      if (this.activeRequest === request) this.activeRequest = null;
    }
  };

  private async authenticate(email: string, password: string, register: boolean): Promise<AuthActionResult> {
    const validation = validateCredentials(email, password, register);
    if (validation) return { error: validation };
    if (this.activeRequest !== null) return { error: '正在处理，请稍候。' };
    if (this.snapshot.phase !== 'signedOut') return { error: '请先退出当前账号。' };
    const request = ++this.request;
    const eventVersion = this.eventVersion;
    this.activeRequest = request;
    try {
      const credentials = { email: email.trim(), password };
      const { data, error } = await (register ? this.auth.signUp(credentials) :
        this.auth.signInWithPassword(credentials));
      if (request !== this.request || this.stopped) return { error: '操作已结束，请重试。' };
      if (error) return { error: authErrorMessage(error, register ? '注册' : '登录') };
      if (eventVersion !== this.eventVersion) {
        if (this.snapshot.session?.user.id !== data.session?.user.id) {
          return { error: '账号已变更，请重试。' };
        }
      } else this.update(data.session ? 'signedIn' : 'signedOut', data.session);
      return { error: null, needsEmailConfirmation: register && !data.session };
    } catch (error) {
      return { error: authErrorMessage(error, register ? '注册' : '登录') };
    } finally {
      if (this.activeRequest === request) this.activeRequest = null;
    }
  }

  signIn = (email: string, password: string) => this.authenticate(email, password, false);
  signUp = (email: string, password: string) => this.authenticate(email, password, true);

  signOut = async (): Promise<AuthActionResult> => {
    const request = ++this.request;
    this.activeRequest = request;
    this.update('signingOut', null);
    try {
      const { error } = await this.auth.signOut({ scope: 'local' });
      if (request !== this.request || this.stopped) return { error: null };
      if (error) {
        const message = authErrorMessage(error, '退出');
        this.update('signOutError', null, message);
        return { error: message };
      }
      this.update('signedOut', null);
      return { error: null };
    } catch (error) {
      const message = authErrorMessage(error, '退出');
      if (request === this.request) this.update('signOutError', null, message);
      return { error: message };
    } finally {
      if (this.activeRequest === request) this.activeRequest = null;
    }
  };
}
