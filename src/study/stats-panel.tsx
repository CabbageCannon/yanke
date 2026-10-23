import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays, format, startOfWeek } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import type { SessionScope } from '@/lib/auth-session';
import { subjects } from '@/plans/plan-domain';
import { theme } from '@/theme';
import { loadStudyStats } from './study-data';
import { studyErrorMessage } from './study-domain';
import { StudySheet, studyStyles as styles } from './study-sheet';

export function StatsPanel({ client, scope, today, revision, onClose }:
  { client: SupabaseClient; scope: SessionScope; today: Date; revision: number; onClose: () => void }) {
  const [period, setPeriod] = useState<'week' | 'all'>('week');
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; stats?: Awaited<ReturnType<typeof loadStudyStats>>; error?: string } | null>(null);
  const generation = useRef(0);
  const day = format(today, 'yyyy-MM-dd');
  const from = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const to = format(addDays(startOfWeek(today, { weekStartsOn: 1 }), 7), 'yyyy-MM-dd');
  const key = `${period}/${day}/${revision}/${retry}`;
  useEffect(() => {
    if (!scope.isCurrent()) return;
    let active = true;
    const sequence = ++generation.current;
    const current = () => active && scope.isCurrent() && sequence === generation.current;
    void loadStudyStats(client, scope.userId, day, period === 'week' ? { from, to } : null)
      .then((stats) => { if (current()) setResult({ key, stats }); })
      .catch((error) => { if (current()) setResult({ key, error: studyErrorMessage(error) }); });
    return () => { active = false; };
  }, [client, scope, day, period, from, to, revision, retry, key]);
  const current = result?.key === key ? result : null;
  return (
    <StudySheet title="学习统计" onClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="查看本周统计" onPress={() => setPeriod('week')} style={styles.textButton}>
        <Text style={styles.link}>{period === 'week' ? '✓ ' : ''}本周（{from}起）</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="查看累计统计" onPress={() => setPeriod('all')} style={styles.textButton}>
        <Text style={styles.link}>{period === 'all' ? '✓ ' : ''}累计</Text>
      </Pressable>
      {!current && <ActivityIndicator color={theme.colors.primary} accessibilityLabel="正在读取统计" />}
      {current?.error && <Text accessibilityRole="alert" style={styles.message}>{current.error}</Text>}
      {current?.stats && <>
        <View style={styles.card}>
          <Text style={styles.title}>{period === 'week' ? '本周' : '累计'}时长：{current.stats.minutes}分钟</Text>
          <Text style={styles.label}>完成率：{current.stats.completionRate === null ? '—' : `${Math.round(current.stats.completionRate * 100)}%`}</Text>
          <Text style={styles.helper}>已完成{current.stats.completed} / 全部{current.stats.plans}个计划（含未来计划）</Text>
          <Text style={styles.label}>连续打卡：{current.stats.streak}天</Text>
          <Text style={styles.helper}>截至{day}；今日未打卡可从昨天起算，补卡归原学习日。</Text>
        </View>
        {subjects.map((subject) => <View key={subject} style={styles.card}>
          <Text style={styles.label}>{subject}：{current.stats!.subjects[subject]}分钟</Text>
        </View>)}
        <Text style={styles.helper}>按学习日汇总实际打卡分钟。无打卡完成记0分钟；软删计划不计完成率，已有打卡仍计历史时长和天数。</Text>
      </>}
      <Pressable accessibilityRole="button" style={styles.textButton} onPress={() => setRetry((value) => value + 1)}>
        <Text style={styles.link}>刷新统计</Text>
      </Pressable>
    </StudySheet>
  );
}
