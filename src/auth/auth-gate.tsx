import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WeekTimetable } from '@/components/week-timetable';
import { validateCredentials } from '@/lib/auth-session';
import { theme } from '@/theme';
import { useAuth } from './auth-provider';

export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (auth.phase === 'unconfigured') {
    return <WeekTimetable notice="账号服务暂时不可用，可先预览时间表。" />;
  }
  if (auth.phase === 'signedOut') return <EmailAuthScreen />;
  if (auth.phase === 'signedIn' && auth.scope) {
    return <View key={auth.scope.key} style={styles.fill}>{children}</View>;
  }
  return (
    <SafeAreaView style={styles.statusScreen}>
      {auth.error ? (
        <>
          <Text accessibilityRole="alert" style={styles.error}>{auth.error}</Text>
          <Pressable accessibilityRole="button" onPress={auth.retry} style={styles.primaryButton}>
            <Text style={styles.primaryText}>{auth.phase === 'signOutError' ? '重试退出' : '重试'}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator color={theme.colors.primary} accessibilityLabel="正在处理账号" />
          <Text style={styles.helper}>{auth.phase === 'signingOut' ? '正在退出…' : '正在恢复账号…'}</Text>
        </>
      )}
    </SafeAreaView>
  );
}

function EmailAuthScreen() {
  const auth = useAuth();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const pending = useRef(false);
  const passwordInput = useRef<ComponentRef<typeof TextInput>>(null);

  const submit = async () => {
    if (pending.current) return;
    setConfirmation(false);
    const validation = validateCredentials(email, password, register);
    setError(validation);
    if (validation) return;
    pending.current = true;
    setBusy(true);
    const result = await (register ? auth.signUp(email, password) : auth.signIn(email, password));
    setError(result.error);
    if (result.needsEmailConfirmation) {
      setConfirmation(true);
      setRegister(false);
      setPassword('');
    }
    pending.current = false;
    setBusy(false);
  };

  return (
    <SafeAreaView style={styles.fill}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formScroll}>
          <View style={styles.form}>
            <Text accessibilityRole="header" style={styles.title}>{register ? '注册研刻' : '登录研刻'}</Text>
            <Text style={styles.helper}>用邮箱保存你的学习计划</Text>
            <View style={styles.field}>
              <Text style={styles.label}>邮箱</Text>
              <TextInput accessibilityLabel="邮箱" value={email} onChangeText={setEmail}
                style={styles.input} autoCapitalize="none" autoCorrect={false}
                keyboardType="email-address" autoComplete="email" textContentType="emailAddress"
                returnKeyType="next" editable={!busy} onSubmitEditing={() => passwordInput.current?.focus()} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>密码</Text>
              <TextInput ref={passwordInput} accessibilityLabel="密码" value={password}
                onChangeText={setPassword} style={styles.input} secureTextEntry
                autoCapitalize="none" autoCorrect={false} editable={!busy}
                autoComplete={register ? 'new-password' : 'current-password'}
                textContentType={register ? 'newPassword' : 'password'}
                returnKeyType="go" onSubmitEditing={() => { void submit(); }} />
              {register && <Text style={styles.helper}>至少6位，建议使用更长的密码</Text>}
            </View>
            {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            {confirmation && (
              <Text accessibilityLiveRegion="polite" style={styles.helper}>
                请查看邮箱中的确认邮件，确认后再登录。如未收到，请稍后重试。
              </Text>
            )}
            <Pressable accessibilityRole="button" disabled={busy}
              accessibilityState={{ disabled: busy, busy }}
              style={[styles.primaryButton, busy && styles.disabled]} onPress={() => { void submit(); }}>
              <Text style={styles.primaryText}>{busy ? '请稍候…' : register ? '注册' : '登录'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy} style={styles.switchButton}
              onPress={() => { setRegister(!register); setError(null); setConfirmation(false); setPassword(''); }}>
              <Text style={styles.switchText}>{register ? '已有账号，去登录' : '没有账号，去注册'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function AccountMenu() {
  const { session, signOut } = useAuth();
  return (
    <View style={styles.accountBar}>
      <Text style={styles.accountEmail} numberOfLines={1}>{session?.user.email}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="退出当前账号" style={styles.switchButton}
        onPress={() => { void signOut(); }}>
        <Text style={styles.switchText}>退出</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.colors.background },
  statusScreen: { flex: 1, padding: theme.spacing.page, justifyContent: 'center', gap: 16 },
  formScroll: { flexGrow: 1, justifyContent: 'center', padding: theme.spacing.page },
  form: { width: '100%', maxWidth: 400, alignSelf: 'center', gap: 16 },
  title: { fontSize: theme.fontSize.title, fontWeight: '600', color: theme.colors.text },
  helper: { fontSize: theme.fontSize.caption, color: theme.colors.secondaryText, lineHeight: 20 },
  field: { gap: theme.spacing.block },
  label: { fontSize: theme.fontSize.body, color: theme.colors.text },
  input: { minHeight: 48, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12,
    backgroundColor: theme.colors.card, paddingHorizontal: 12, fontSize: theme.fontSize.body,
    color: theme.colors.text },
  error: { fontSize: theme.fontSize.body, color: theme.colors.text, lineHeight: 22 },
  primaryButton: { minHeight: 48, borderRadius: 12, backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center', padding: 12 },
  primaryText: { fontSize: theme.fontSize.body, fontWeight: '600', color: theme.colors.card },
  disabled: { opacity: 0.6 },
  switchButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  switchText: { fontSize: theme.fontSize.body, color: theme.colors.primary },
  accountBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  accountEmail: { flex: 1, fontSize: theme.fontSize.caption, color: theme.colors.secondaryText },
});
