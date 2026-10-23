import { subjects, type Subject } from '../plans/plan-domain.ts';

export type CheckIn = { id: string; plan_id: string; type: 'normal' | 'late' | 'makeup';
  duration_minutes: number; study_date: string; checked_at: string };
export type DailyStats = { study_date: string; plan_count: number; completed_plan_count: number; total_minutes: number };
export type SubjectStats = { study_date: string; subject: Subject; total_minutes: number };
export const checkinLabels = { normal: '正常打卡', late: '迟到打卡', makeup: '补卡' };

export function validateMinutes(input: string): { ok: true; minutes: number } | { ok: false; error: string } {
  const value = input.trim();
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > 1440) {
    return { ok: false, error: '补卡时长请填写1–1440的整数分钟。' };
  }
  return { ok: true, minutes: Number(value) };
}

export function validateSummary(input: string) {
  return Array.from(input.trim()).length <= 2000 ? null : '总结最多2000字，请缩短后重试。';
}

export function aggregateStats(daily: DailyStats[], bySubject: SubjectStats[]) {
  const total = daily.reduce((sum, row) => ({ plans: sum.plans + Number(row.plan_count),
    completed: sum.completed + Number(row.completed_plan_count), minutes: sum.minutes + Number(row.total_minutes) }),
  { plans: 0, completed: 0, minutes: 0 });
  const minutes = Object.fromEntries(subjects.map((subject) => [subject, 0])) as Record<Subject, number>;
  for (const row of bySubject) minutes[row.subject] += Number(row.total_minutes);
  return { ...total, subjects: minutes, completionRate: total.plans ? total.completed / total.plans : null };
}

export function studyErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  if (code === 'P0002' || code === 'PGRST116') return '计划已删除或无法读取，请关闭详情后刷新时间表。';
  if (code === '23505') return '此计划已有打卡，不能再补卡。请查看已保存的记录。';
  if (code === '22023') return '未满足操作条件：实时打卡需在开始前15分钟至结束前；补卡需在结束后168小时内。请检查时长和总结后重试。';
  if (code === '42501' || code === 'PGRST301') return '账号无权进行此操作，请重新登录后重试。';
  return '请求未完成，请检查网络后重试。已填写的内容会保留。';
}
