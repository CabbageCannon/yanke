import type { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { SessionScope } from '@/lib/auth-session';
import { theme } from '@/theme';
import { deletePlan, savePlan } from './plan-data';
import { overlaps, planErrorMessage, subjects, validatePlan, type Plan, type PlanDraft } from './plan-domain';

export type EditorState = { id: string; plan?: Plan; draft: PlanDraft; timezone: string };

export function PlanEditor({ editor, client, scope, plans, onClose, onSaved }:
  { editor: EditorState; client: SupabaseClient; scope: SessionScope; plans: Plan[];
    onClose: () => void; onSaved: (plan: Plan, notice: string) => void }) {
  const [draft, setDraft] = useState(editor.draft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const validation = validatePlan(draft, editor.timezone);
  const overlapping = validation.ok && plans.some((plan) => plan.id !== editor.id && overlaps(plan, validation.values));
  const change = (field: keyof PlanDraft, value: string) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setError(null); setConfirmDelete(false);
  };
  const submit = async (remove = false) => {
    if (pending.current || !scope.isCurrent()) return;
    if (!remove && !validation.ok) { setError(validation.error); return; }
    pending.current = true; setBusy(true); setError(null);
    try {
      if (remove) {
        const plan = await deletePlan(client, scope.userId, editor.id);
        if (mounted.current && scope.isCurrent()) onSaved(plan, '计划已删除。');
      } else if (validation.ok) {
        const { plan, overlap } = await savePlan(client, scope.userId, editor.id, validation.values,
          editor.timezone, !editor.plan);
        if (mounted.current && scope.isCurrent()) onSaved(plan,
          overlap ? '已保存，与其他计划重叠，可在计划列表中分别查看。' : '计划已保存。');
      }
    } catch (failure) {
      if (mounted.current && scope.isCurrent()) setError(planErrorMessage(failure));
    } finally {
      pending.current = false;
      if (mounted.current && scope.isCurrent()) setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.panel}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <View style={styles.row}>
              <Text accessibilityRole="header" style={styles.title}>{editor.plan ? '编辑计划' : '新建计划'}</Text>
              <Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={styles.textButton}>
                <Text style={styles.link}>取消</Text>
              </Pressable>
            </View>
            <View accessibilityRole="radiogroup" style={styles.subjects}>
              {subjects.map((subject) => (
                <Pressable key={subject} accessibilityRole="radio" accessibilityLabel={subject}
                  accessibilityState={{ checked: draft.subject === subject, disabled: busy }} disabled={busy}
                  onPress={() => change('subject', subject)}
                  style={[styles.subject, draft.subject === subject && styles.selected]}>
                  <Text style={draft.subject === subject ? styles.primaryText : styles.link}>{subject}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>日期（YYYY-MM-DD）</Text>
            <TextInput accessibilityLabel="计划日期" value={draft.date} onChangeText={(value) => change('date', value)}
              editable={!busy} style={styles.input} maxLength={10} autoCorrect={false} placeholder="2026-10-22" />
            <View style={styles.row}>
              <View style={styles.timeField}>
                <Text style={styles.label}>开始（HH:mm）</Text>
                <TextInput accessibilityLabel="开始时间" value={draft.start} onChangeText={(value) => change('start', value)}
                  editable={!busy} style={styles.input} maxLength={5} autoCorrect={false} placeholder="09:00" />
              </View>
              <View style={styles.timeField}>
                <Text style={styles.label}>结束（HH:mm）</Text>
                <TextInput accessibilityLabel="结束时间" value={draft.end} onChangeText={(value) => change('end', value)}
                  editable={!busy} style={styles.input} maxLength={5} autoCorrect={false} placeholder="11:00" />
              </View>
            </View>
            <Text style={styles.helper}>时间按 {editor.timezone} 保存；同日08:00–23:00，至少15分钟。</Text>
            <Text style={styles.label}>标题（可选）</Text>
            <TextInput accessibilityLabel="计划标题" value={draft.title} onChangeText={(value) => change('title', value)}
              editable={!busy} style={styles.input} maxLength={100} placeholder="例如：高数第二章" />
            {editor.plan?.geofence_enabled && <Text style={styles.helper}>已绑定地点：{editor.plan.geofence_name}</Text>}
            {overlapping && <Text style={styles.helper}>此时间与已有计划重叠，仍可保存；可在计划列表中分别查看。</Text>}
            {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy, busy }}
              onPress={() => { void submit(); }} style={[styles.save, busy && styles.disabled]}>
              <Text style={styles.primaryText}>{busy ? '请稍候…' : '保存计划'}</Text>
            </Pressable>
            {editor.plan && (!confirmDelete ? (
              <Pressable accessibilityRole="button" disabled={busy} style={styles.textButton} onPress={() => setConfirmDelete(true)}>
                <Text style={styles.link}>删除计划</Text>
              </Pressable>
            ) : (
              <View style={styles.confirm}>
                <Text style={styles.helper}>删除后从时间表隐藏，已有打卡历史保留。</Text>
                <View style={styles.row}>
                  <Pressable accessibilityRole="button" disabled={busy} style={styles.textButton} onPress={() => { void submit(true); }}>
                    <Text style={styles.link}>确认删除</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" disabled={busy} style={styles.textButton} onPress={() => setConfirmDelete(false)}>
                    <Text style={styles.link}>保留计划</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.2)' },
  panel: { maxHeight: '94%', width: '100%', maxWidth: 560, alignSelf: 'center',
    backgroundColor: theme.colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  content: { padding: theme.spacing.page, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: theme.fontSize.title, fontWeight: '600', color: theme.colors.text },
  label: { fontSize: theme.fontSize.body, color: theme.colors.text },
  helper: { fontSize: theme.fontSize.caption, color: theme.colors.secondaryText, lineHeight: 20 },
  error: { fontSize: theme.fontSize.body, color: theme.colors.text, lineHeight: 22 },
  subjects: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subject: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 12,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  selected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  timeField: { flex: 1, gap: 8, minWidth: 0 },
  input: { minHeight: 48, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12,
    backgroundColor: theme.colors.card, paddingHorizontal: 12, color: theme.colors.text, fontSize: theme.fontSize.body },
  textButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  link: { fontSize: theme.fontSize.body, color: theme.colors.primary },
  save: { minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, backgroundColor: theme.colors.primary },
  primaryText: { fontSize: theme.fontSize.body, fontWeight: '600', color: theme.colors.card },
  disabled: { opacity: 0.6 },
  confirm: { gap: 8 },
});
