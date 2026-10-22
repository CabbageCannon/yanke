import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { AuthSessionStore, authErrorMessage, validateCredentials } from '../../src/lib/auth-session.ts';
import { parseSupabaseConfig } from '../../src/lib/supabase-config.ts';

const session = (id, token = 'test-token') => ({ user: { id }, access_token: token });
const response = (value, error = null) => ({ data: { session: value }, error });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

function harness(initial = null) {
  let callback;
  let unsubscribed = false;
  const auth = {
    getSession: async () => response(initial),
    onAuthStateChange(listener) {
      callback = listener;
      return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } };
    },
    signInWithPassword: async () => response(session('a')),
    signUp: async () => response(null),
    signOut: async () => { callback('SIGNED_OUT', null); return { error: null }; },
  };
  const store = new AuthSessionStore(auth);
  return { auth, store, emit: (event, value) => callback(event, value),
    unsubscribed: () => unsubscribed };
}

test('configuration accepts public keys and rejects server keys even without a URL', () => {
  const jwt = (role) => `test.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.test`;
  assert.equal(parseSupabaseConfig('https://project.supabase.co', 'sb_publishable_test').kind, 'ready');
  assert.equal(parseSupabaseConfig('http://127.0.0.1:54321', jwt('anon')).kind, 'ready');
  assert.equal(parseSupabaseConfig(undefined, 'sb_secret_test').kind, 'unsafe');
  assert.equal(parseSupabaseConfig(undefined, jwt('service_role')).kind, 'unsafe');
  assert.equal(parseSupabaseConfig('https://project.supabase.co', jwt('authenticated')).kind, 'invalid');
  assert.equal(parseSupabaseConfig('', '').kind, 'missing');
  for (const url of ['http://remote.example', 'https://user:pass@example.com', 'https://x.test/?key=x']) {
    assert.equal(parseSupabaseConfig(url, 'sb_publishable_test').kind, 'invalid');
  }
});

test('Expo config rejects a server key hidden behind another valid public key', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./app.config.ts')"], {
    cwd: new URL('../..', import.meta.url), encoding: 'utf8',
    env: { ...process.env, EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_test_server_key' },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /服务端 Key 不能用于客户端/);
  assert.doesNotMatch(result.stderr, /sb_secret_test_server_key/);
});

test('credentials validate before calling Auth and messages do not reveal server content', async () => {
  const { store, auth } = harness();
  await store.start();
  let calls = 0;
  auth.signInWithPassword = async () => { calls++; return response(null); };
  assert.ok((await store.signIn('bad', 'password')).error);
  assert.ok(validateCredentials('a@example.com', '12345', true));
  assert.equal(validateCredentials(' a@example.com ', '123456', true), null);
  assert.equal(calls, 0);
  assert.match(authErrorMessage({ code: 'invalid_credentials', message: 'secret details' }, '登录'), /邮箱或密码/);
  assert.doesNotMatch(authErrorMessage(new Error('secret details'), '登录'), /secret/);
});

test('restored user exposes a scope; refresh and repeated sign-in preserve it', async () => {
  const { store, emit } = harness(session('a'));
  await store.start();
  const scope = store.getScope();
  assert.equal(scope.userId, 'a');
  emit('TOKEN_REFRESHED', session('a', 'new-token'));
  emit('SIGNED_IN', session('a', 'another-token'));
  assert.equal(store.getScope().key, scope.key);
  assert.equal(scope.isCurrent(), true);
  assert.equal(store.getSnapshot().session.access_token, 'another-token');
});

test('switching identity invalidates the previous user scope immediately', async () => {
  const { store, emit } = harness(session('a'));
  await store.start();
  const oldScope = store.getScope();
  emit('SIGNED_IN', session('b'));
  assert.equal(oldScope.isCurrent(), false);
  assert.equal(store.getScope().userId, 'b');
  assert.notEqual(store.getScope().key, oldScope.key);
  emit('TOKEN_REFRESHED', session('a'));
  assert.equal(store.getScope().userId, 'b');
});

test('a late restoration response cannot replace a newer sign-in event', async () => {
  const { auth, store, emit } = harness();
  const pending = deferred();
  auth.getSession = () => pending.promise;
  const start = store.start();
  emit('SIGNED_IN', session('b'));
  pending.resolve(response(session('a')));
  await start;
  assert.equal(store.getScope().userId, 'b');
});

test('restoration failure blocks personal data and can be retried', async () => {
  const { auth, store } = harness();
  auth.getSession = async () => { throw new Error('offline'); };
  await store.start();
  assert.equal(store.getSnapshot().phase, 'restoreError');
  assert.equal(store.getScope(), null);
  auth.getSession = async () => response(session('a'));
  await store.restore();
  assert.equal(store.getScope().userId, 'a');
});

test('registration without a session requests confirmation and stays signed out', async () => {
  const { store } = harness();
  await store.start();
  assert.deepEqual(await store.signUp('a@example.com', 'password'),
    { error: null, needsEmailConfirmation: true });
  assert.equal(store.getSnapshot().phase, 'signedOut');
  assert.equal(store.getScope(), null);
});

test('successful sign-in trims email and keeps the password unchanged', async () => {
  const { store, auth, emit } = harness();
  await store.start();
  auth.signInWithPassword = async (credentials) => {
    assert.deepEqual(credentials, { email: 'a@example.com', password: ' password ' });
    emit('SIGNED_IN', session('a', 'latest-token'));
    return response(session('a', 'returned-token'));
  };
  assert.equal((await store.signIn(' a@example.com ', ' password ')).error, null);
  assert.equal(store.getScope().userId, 'a');
  assert.equal(store.getSnapshot().session.access_token, 'latest-token');
});

test('a newer identity event wins over an older authentication response', async () => {
  const { auth, store, emit } = harness();
  await store.start();
  const pending = deferred();
  auth.signInWithPassword = () => pending.promise;
  const signIn = store.signIn('a@example.com', 'password');
  emit('SIGNED_IN', session('b'));
  const scope = store.getScope();
  pending.resolve(response(session('a')));
  assert.ok((await signIn).error);
  assert.equal(store.getScope().userId, 'b');
  assert.equal(scope.isCurrent(), true);
});

test('repeated submissions only make one request', async () => {
  const { auth, store } = harness();
  await store.start();
  const pending = deferred();
  let calls = 0;
  auth.signInWithPassword = () => { calls++; return pending.promise; };
  const first = store.signIn('a@example.com', 'password');
  assert.ok((await store.signIn('a@example.com', 'password')).error);
  pending.resolve(response(session('a')));
  await first;
  assert.equal(calls, 1);
});

test('sign-out removes the scope before network completion and ignores late refreshes', async () => {
  const { auth, store, emit } = harness(session('a'));
  await store.start();
  const oldScope = store.getScope();
  const pending = deferred();
  auth.signOut = () => pending.promise;
  const signOut = store.signOut();
  assert.equal(store.getScope(), null);
  assert.equal(oldScope.isCurrent(), false);
  emit('TOKEN_REFRESHED', session('a'));
  assert.equal(store.getSnapshot().phase, 'signingOut');
  pending.resolve({ error: null });
  await signOut;
  assert.equal(store.getSnapshot().phase, 'signedOut');
  emit('TOKEN_REFRESHED', session('a'));
  assert.equal(store.getScope(), null);
});

test('sign-out failure stays blocked until retry instead of restoring the old user', async () => {
  const { auth, store, emit } = harness(session('a'));
  await store.start();
  auth.signOut = async () => ({ error: { code: 'offline' } });
  assert.ok((await store.signOut()).error);
  emit('TOKEN_REFRESHED', session('a'));
  await store.restore();
  assert.equal(store.getSnapshot().phase, 'signOutError');
  assert.equal(store.getScope(), null);
  auth.signOut = async () => { emit('SIGNED_OUT', null); return { error: null }; };
  assert.equal((await store.signOut()).error, null);
  assert.equal(store.getSnapshot().phase, 'signedOut');
});

test('external sign-out cancels in-flight authentication', async () => {
  const { auth, store, emit } = harness();
  await store.start();
  const pending = deferred();
  auth.signInWithPassword = () => pending.promise;
  const signIn = store.signIn('a@example.com', 'password');
  emit('SIGNED_OUT', null);
  pending.resolve(response(session('a')));
  assert.ok((await signIn).error);
  assert.equal(store.getScope(), null);
});

test('stopped stores unsubscribe and reject late responses and scope checks', async () => {
  const { auth, store, emit, unsubscribed } = harness(session('a'));
  await store.start();
  const scope = store.getScope();
  let notifications = 0;
  store.subscribe(() => { notifications++; });
  const pending = deferred();
  auth.getSession = () => pending.promise;
  const restore = store.restore();
  store.stop();
  const before = notifications;
  pending.resolve(response(session('b')));
  await restore;
  emit('SIGNED_IN', session('b'));
  assert.equal(unsubscribed(), true);
  assert.equal(notifications, before);
  assert.equal(scope.isCurrent(), false);
});
