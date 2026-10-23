import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays, format, startOfDay, startOfWeek } from 'date-fns';
import { randomUUID } from 'expo-crypto';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountMenu } from '@/auth/auth-gate';
import { useAuth } from '@/auth/auth-provider';
import { WeekTimetable } from '@/components/week-timetable';
import type { SessionScope } from '@/lib/auth-session';
import { theme } from '@/theme';
import { PlanDetail } from '@/study/plan-detail';
import { StatsPanel } from '@/study/stats-panel';
import { loadPlans } from './plan-data';
import { deviceTimezone, draftForPlan, newPlanDraft, overlaps, planErrorMessage, type Plan } from './plan-domain';
import { PlanEditor, type EditorState } from './plan-editor';

const subjectColors = { 数学: theme.subjects.math, 英语: theme.subjects.english,
  政治: theme.subjects.politics, 专业课: theme.subjects.major, 其他: theme.subjects.other };
const statusLabel = (plan: Plan) => plan.status === 'completed' ? '✓ 已完成' : plan.status === 'missed' ? '已错过' : '待学习';
const planTime = (plan: Plan) => `${format(new Date(plan.start_at), 'M/d HH:mm')}–${format(new Date(plan.end_at),
  format(new Date(plan.start_at), 'yyyy-MM-dd') === format(new Date(plan.end_at), 'yyyy-MM-dd') ? 'HH:mm' : 'M/d HH:mm')}`;

function useCalendarNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(tick, addDays(startOfDay(new Date()), 1).getTime() - Date.now() + 100);
    };
    const tick = () => { setNow(new Date()); schedule(); };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') { clearTimeout(timer); tick(); }
    });
    schedule();
    return () => { clearTimeout(timer); subscription.remove(); };
  }, []);
  return now;
}

function useWeekPlans(client: SupabaseClient | null, scope: SessionScope | null, from: string, to: string) {
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState({ range: '', request: '', from, to, plans: [] as Plan[], error: null as string | null });
  const generation = useRef(0);
  const range = `${from}/${to}`, request = `${range}/${reload}`;
  useEffect(() => {
    if (!client || !scope) return;
    let active = true;
    const sequence = ++generation.current;
    const current = () => active && scope.isCurrent() && sequence === generation.current;
    void loadPlans(client, scope.userId, from, to).then((plans) => {
      if (current()) setResult({ range, request, from, to, plans, error: null });
    }).catch((error) => {
      if (current()) setResult((previous) => ({ range, request, from, to,
        plans: previous.range === range ? previous.plans : [], error: planErrorMessage(error) }));
    });
    return () => { active = false; };
  }, [client, scope, from, to, range, request]);
  const refresh = () => { generation.current++; setReload((value) => value + 1); };
  const acceptChange = (plan: Plan) => {
    generation.current++;
    setResult((previous) => {
      const plans = previous.plans.filter((item) => item.id !== plan.id);
      if (plan.status !== 'deleted' && overlaps(plan, { start_at: previous.from, end_at: previous.to })) plans.push(plan);
      return { ...previous, plans: plans.sort((a, b) => a.start_at.localeCompare(b.start_at) || a.id.localeCompare(b.id)) };
    });
    setReload((value) => value + 1);
  };
  return { plans: result.range === range ? result.plans : [], loading: result.request !== request,
    error: result.request === request ? result.error : null, refresh, acceptChange };
}

export function PlansScreen() {
  const { client, scope } = useAuth();
  const now = useCalendarNow();
  const [selectedWeek, setSelectedWeek] = useState<Date | null>(null);
  const currentWeek = startOfWeek(now, { weekStartsOn: 1 });
  const week = selectedWeek ?? currentWeek;
  const timezone = deviceTimezone();
  const from = week.toISOString(), to = addDays(week, 7).toISOString();
  const data = useWeekPlans(client, scope, from, to);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [detail, setDetail] = useState<Plan | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const events = useMemo(() => data.plans.map((plan) => ({ id: plan.id,
    start: plan.start_at, end: plan.end_at, readonly: true,
    text: `${plan.status === 'completed' ? '✓ ' : ''}${plan.subject}\n${format(new Date(plan.start_at), 'HH:mm')}–${format(new Date(plan.end_at), 'HH:mm')}`,
    backgroundColor: subjectColors[plan.subject], textColor: theme.colors.text })), [data.plans]);
  const create = (date: Date) => {
    if (!scope?.isCurrent() || data.loading) return;
    setNotice(null);
    setEditor({ id: randomUUID(), timezone, draft: newPlanDraft(date, timezone) });
  };
  const select = (id: string) => {
    const plan = data.plans.find((item) => item.id === id);
    if (!plan || !scope?.isCurrent()) return;
    setListOpen(false); setNotice(null);
    setDetail(plan);
  };
  const changed = (plan: Plan) => { data.acceptChange(plan); setRevision((value) => value + 1); };
  const moveWeek = (offset: number) => {
    setSelectedWeek(addDays(week, offset * 7)); setNotice(null); setDetail(null); setEditor(null);
  };

  return (
    <>
      <WeekTimetable toolbar={<AccountMenu />} weekStart={week} timezone={timezone} events={events}
        onCreate={create} onSelect={select}
        caption={data.plans.length ? '点击计划块查看、打卡或完成；重叠计划也可从列表中选择。' :
          data.loading ? '正在读取学习计划…' : '点击任意空白格，创建你的第一个学习计划。'}
        navigation={(
          <View style={styles.navigation}>
            <Pressable accessibilityRole="button" accessibilityLabel="上一周" style={styles.button} onPress={() => moveWeek(-1)}><Text style={styles.link}>上一周</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="回到本周" style={styles.button} onPress={() => { setSelectedWeek(null); setNotice(null); setDetail(null); setEditor(null); }}><Text style={styles.link}>本周</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="下一周" style={styles.button} onPress={() => moveWeek(1)}><Text style={styles.link}>下一周</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="新建计划" disabled={data.loading} accessibilityState={{ disabled: data.loading }}
              style={styles.button} onPress={() => create(selectedWeek ? addDays(week, 0) : new Date())}><Text style={styles.link}>新建计划</Text></Pressable>
          </View>
        )}
        status={(
          <View style={styles.status}>
            <View style={styles.navigation}>
              <Pressable accessibilityRole="button" style={styles.button} onPress={() => setListOpen(true)}><Text style={styles.link}>本周计划（{data.plans.length}）</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="刷新计划" disabled={data.loading} style={styles.button} onPress={data.refresh}><Text style={styles.link}>刷新</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="查看学习统计" style={styles.button} onPress={() => setStatsOpen(true)}><Text style={styles.link}>统计</Text></Pressable>
              {data.loading && <ActivityIndicator size="small" color={theme.colors.primary} accessibilityLabel="正在读取计划" />}
            </View>
            {data.error && <Text accessibilityRole="alert" style={styles.message}>{data.error} 点击刷新重试。</Text>}
            {notice && <Text accessibilityLiveRegion="polite" style={styles.message}>{notice}</Text>}
          </View>
        )}
      />
      {listOpen && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setListOpen(false)}>
          <View style={styles.backdrop}>
            <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.listPanel}>
              <View style={styles.listHeading}><Text accessibilityRole="header" style={styles.title}>本周计划</Text>
                <Pressable accessibilityRole="button" style={styles.button} onPress={() => setListOpen(false)}><Text style={styles.link}>关闭列表</Text></Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.list}>
                {!data.plans.length && <Text style={styles.message}>{data.loading ? '正在读取…' : '这一周还没有计划。'}</Text>}
                {data.plans.map((plan) => (
                  <Pressable key={plan.id} accessibilityRole="button" accessibilityLabel={`${plan.subject} ${plan.title ?? ''} ${planTime(plan)} ${statusLabel(plan)}`}
                    onPress={() => select(plan.id)} style={[styles.planRow, { borderLeftColor: subjectColors[plan.subject] }]}>
                    <Text style={styles.rowTitle}>{plan.subject}{plan.title ? ` · ${plan.title}` : ''}</Text>
                    <Text style={styles.message}>{planTime(plan)} · {statusLabel(plan)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </SafeAreaView>
          </View>
        </Modal>
      )}
      {detail && client && scope && <PlanDetail key={detail.id} initialPlan={detail} client={client} scope={scope}
        onClose={() => setDetail(null)} onChanged={changed} onEdit={(plan) => {
          setDetail(null); setEditor({ id: plan.id, plan, timezone: plan.timezone, draft: draftForPlan(plan) });
        }} />}
      {statsOpen && client && scope && <StatsPanel client={client} scope={scope} today={now}
        revision={revision} onClose={() => setStatsOpen(false)} />}
      {editor && client && scope && <PlanEditor key={editor.id} editor={editor} client={client} scope={scope} plans={data.plans}
        onClose={() => setEditor(null)} onSaved={(plan, message) => {
          changed(plan); setEditor(null); setNotice(message);
        }} />}
    </>
  );
}

const styles = StyleSheet.create({
  navigation: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  button: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  link: { fontSize: theme.fontSize.body, color: theme.colors.primary },
  status: { gap: 4 },
  message: { fontSize: theme.fontSize.caption, color: theme.colors.secondaryText, lineHeight: 20 },
  title: { fontSize: theme.fontSize.title, fontWeight: '600', color: theme.colors.text },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.2)' },
  listPanel: { maxHeight: '80%', width: '100%', maxWidth: 560, alignSelf: 'center',
    backgroundColor: theme.colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  listHeading: { paddingHorizontal: 16, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { padding: theme.spacing.page, gap: 12 },
  planRow: { padding: 12, gap: 8, minHeight: 72, borderRadius: theme.radius.plan,
    borderLeftWidth: 4, backgroundColor: theme.colors.card },
  rowTitle: { fontSize: theme.fontSize.body, color: theme.colors.text, fontWeight: '600' },
});
