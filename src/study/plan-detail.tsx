import type { SupabaseClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import type { SessionScope } from '@/lib/auth-session';
import type { Plan } from '@/plans/plan-domain';
import { theme } from '@/theme';
import { checkInPlan, completePlan, loadStudyPlan, makeupPlan } from './study-data';
import { checkinLabels, studyErrorMessage, validateMinutes, validateSummary, type CheckIn } from './study-domain';
import { StudySheet, studyStyles as styles } from './study-sheet';

type StudyPlan = { plan: Plan; checkin: CheckIn | null };
type Action = 'checkin' | 'makeup' | 'complete';

export function PlanDetail({ initialPlan, client, scope, onClose, onEdit, onChanged }:
  { initialPlan: Plan; client: SupabaseClient; scope: SessionScope; onClose: () => void;
    onEdit: (plan: Plan) => void; onChanged: (plan: Plan) => void }) {
  const [state, setState] = useState<StudyPlan | null>(null);
  const [summary, setSummary] = useState('');
  const [dirty, setDirty] = useState(false);
  const [minutes, setMinutes] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const pending = useRef(false), mounted = useRef(false), generation = useRef(0);
  const needsReconcile = useRef(false);
  useEffect(() => {
    if (!scope.isCurrent()) return;
    mounted.current = true;
    const sequence = ++generation.current;
    const current = () => mounted.current && scope.isCurrent() && sequence === generation.current;
    void loadStudyPlan(client, scope.userId, initialPlan.id).then((value) => {
      if (!current()) return;
      setState(value); setSummary(value.plan.summary ?? ''); setDirty(false); setError(null);
    }).catch((failure) => { if (current()) setError(studyErrorMessage(failure)); })
      .finally(() => { if (current()) setBusy(false); });
    return () => { mounted.current = false; };
  }, [client, scope, initialPlan.id, retry]);

  const submit = async (action: Action) => {
    if (pending.current || busy || !state || !scope.isCurrent()) return;
    if (action === 'checkin' && state.plan.geofence_enabled) return;
    const duration = validateMinutes(minutes);
    const summaryError = action === 'checkin' ? null : validateSummary(summary);
    if (summaryError) { setError(summaryError); return; }
    if (action === 'makeup' && !duration.ok) { setError(duration.error); return; }
    pending.current = true; setBusy(true); setError(null); setNotice(null);
    const sequence = ++generation.current;
    const current = () => mounted.current && scope.isCurrent() && sequence === generation.current;
    let observed = state;
    try {
      // An uncertain write is always read back before another write can be sent.
      if (needsReconcile.current) {
        observed = await loadStudyPlan(client, scope.userId, state.plan.id);
        if (!current()) return;
        setState(observed); onChanged(observed.plan); needsReconcile.current = false;
        if (action === 'makeup' && observed.checkin) {
          setNotice('已读取到已保存的打卡，未再次提交补卡。'); return;
        }
      }
      if (!current()) return;
      const submittedSummary = dirty ? summary : null;
      if (action === 'complete') {
        observed = { ...observed, plan: await completePlan(client, observed.plan.id, submittedSummary) };
      } else {
        const checkin = action === 'checkin' ? await checkInPlan(client, observed.plan.id) :
          await makeupPlan(client, observed.plan.id, duration.ok ? duration.minutes : 0, submittedSummary);
        observed = { plan: action === 'makeup' && submittedSummary !== null ?
          { ...observed.plan, summary: submittedSummary.trim() || null } : observed.plan, checkin };
      }
      observed = await loadStudyPlan(client, scope.userId, state.plan.id);
      if (!current()) return;
      setState(observed); onChanged(observed.plan); needsReconcile.current = false;
      if (action !== 'checkin') { setSummary(observed.plan.summary ?? ''); setDirty(false); }
      setNotice(action === 'complete' ? '已保存完成状态与总结。' :
        `${checkinLabels[observed.checkin!.type]}已保存：${observed.checkin!.duration_minutes}分钟。${observed.plan.status === 'completed' ? '计划已完成。' : '计划仍需手动完成。'}`);
    } catch (failure) {
      if (!current()) return;
      needsReconcile.current = true;
      try {
        const actual = await loadStudyPlan(client, scope.userId, state.plan.id);
        if (!current()) return;
        setState(actual); onChanged(actual.plan); needsReconcile.current = false;
        setError(studyErrorMessage(failure));
        if (actual.checkin) setNotice(`已读取到${checkinLabels[actual.checkin.type]}：${actual.checkin.duration_minutes}分钟；请以此记录为准。`);
      } catch {
        const knownFailure = typeof failure === 'object' && failure !== null && 'code' in failure &&
          ['P0002', 'PGRST116', '42501', 'PGRST301'].includes(String(failure.code));
        if (current()) setError(knownFailure ? studyErrorMessage(failure) :
          '暂时无法确认服务器结果。输入已保留；重试时会先读取现状，避免重复补卡。');
      }
    } finally {
      pending.current = false;
      if (current()) setBusy(false);
    }
  };

  return (
    <StudySheet title="计划详情" busy={busy} onClose={onClose}>
      {busy && <ActivityIndicator color={theme.colors.primary} accessibilityLabel="正在读取或保存计划" />}
      {state && <>
        <View style={styles.card}>
          <Text style={styles.title}>{state.plan.subject}{state.plan.title ? ` · ${state.plan.title}` : ''}</Text>
          <Text style={styles.label}>{format(new Date(state.plan.start_at), 'M/d HH:mm')}–{format(new Date(state.plan.end_at), 'HH:mm')}</Text>
          <Text style={styles.label}>{state.plan.status === 'completed' ? '✓ 已完成' : '待手动完成'}</Text>
          <Text style={styles.helper}>{state.plan.geofence_enabled ? `地点：${state.plan.geofence_name}` : '未绑定地点，无需定位。'}</Text>
          <Text style={styles.label}>{state.checkin ? `${checkinLabels[state.checkin.type]} · ${state.checkin.duration_minutes}分钟` : '尚未打卡 · 0分钟'}</Text>
          {state.checkin && <Text style={styles.helper}>归属学习日：{state.checkin.study_date}；打卡与完成分别记录。</Text>}
        </View>
        {!state.checkin && <>
          {state.plan.geofence_enabled && <Text style={styles.helper}>此计划需要真实前台围栏判断。定位功能尚未接入，暂不可实时打卡；可在计划结束后补卡。</Text>}
          <Pressable accessibilityRole="button" disabled={busy || state.plan.geofence_enabled}
            accessibilityState={{ disabled: busy || state.plan.geofence_enabled }}
            style={[styles.button, (busy || state.plan.geofence_enabled) && styles.disabled]} onPress={() => { void submit('checkin'); }}>
            <Text style={styles.primaryText}>实时打卡</Text>
          </Pressable>
          <Text style={styles.helper}>开始前15分钟至结束前可打卡。开始后按剩余分钟记录，无迟到宽限；以服务器时间为准。</Text>
        </>}
        <Text style={styles.label}>小总结（可选）</Text>
        <TextInput accessibilityLabel="小总结" value={summary} onChangeText={(value) => {
          setSummary(value); setDirty(true); setError(null);
        }} editable={!busy} multiline style={[styles.input, styles.summary]} placeholder="今天学了哪些知识点？" />
        <Text style={styles.helper}>{Array.from(summary.trim()).length}字 · 建议280字以内，最多2000字；清空后保存可删除原总结。</Text>
        {!state.checkin && <>
          <Text style={styles.label}>补卡时长（分钟）</Text>
          <TextInput accessibilityLabel="补卡分钟" value={minutes} onChangeText={(value) => { setMinutes(value); setError(null); }}
            editable={!busy} keyboardType="number-pad" style={styles.input} placeholder="1–1440的整数，例如90" />
          <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }}
            style={[styles.button, busy && styles.disabled]} onPress={() => { void submit('makeup'); }}>
            <Text style={styles.primaryText}>保存补卡（含所填总结）</Text>
          </Pressable>
          <Text style={styles.helper}>仅结束后168小时内可补卡；无需定位，不自动完成。已有打卡不可叠加。</Text>
        </>}
        <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }}
          style={[styles.button, busy && styles.disabled]} onPress={() => { void submit('complete'); }}>
          <Text style={styles.primaryText}>{state.plan.status === 'completed' ? '保存总结' : '完成计划（总结可选）'}</Text>
        </Pressable>
        {!state.checkin && <Text style={styles.helper}>直接完成会记录完成状态，时长为0，不增加连续打卡天数。</Text>}
        <Pressable accessibilityRole="button" disabled={busy} style={styles.textButton} onPress={() => onEdit(state.plan)}>
          <Text style={styles.link}>编辑或删除计划</Text>
        </Pressable>
      </>}
      {error && <Text accessibilityRole="alert" style={styles.message}>{error}</Text>}
      {notice && <Text accessibilityLiveRegion="polite" style={styles.message}>{notice}</Text>}
      {!state && !busy && <Pressable accessibilityRole="button" style={styles.button} onPress={() => { setBusy(true); setRetry((value) => value + 1); }}>
        <Text style={styles.primaryText}>重新读取详情</Text>
      </Pressable>}
    </StudySheet>
  );
}
