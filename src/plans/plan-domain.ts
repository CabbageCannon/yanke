import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const subjects = ['数学', '英语', '政治', '专业课', '其他'] as const;
export type Subject = typeof subjects[number];
export type Plan = {
  id: string;
  user_id: string;
  subject: Subject;
  title: string | null;
  start_at: string;
  end_at: string;
  timezone: string;
  status: 'pending' | 'completed' | 'missed' | 'deleted';
  geofence_enabled: boolean;
  geofence_name: string | null;
};
export type PlanDraft = { subject: Subject; title: string; date: string; start: string; end: string };
export type PlanValues = Pick<Plan, 'subject' | 'title' | 'start_at' | 'end_at'>;

export function deviceTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
}

export function draftForPlan(plan: Plan): PlanDraft {
  return { subject: plan.subject, title: plan.title ?? '',
    date: formatInTimeZone(plan.start_at, plan.timezone, 'yyyy-MM-dd'),
    start: formatInTimeZone(plan.start_at, plan.timezone, 'HH:mm'),
    end: formatInTimeZone(plan.end_at, plan.timezone, 'HH:mm') };
}

export function newPlanDraft(date: Date, timezone: string): PlanDraft {
  const [hour, minute] = formatInTimeZone(date, timezone, 'HH:mm').split(':').map(Number);
  const start = Math.max(8 * 60, Math.min(22 * 60 + 30, hour * 60 + Math.floor(minute / 30) * 30));
  const time = (value: number) => `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;
  return { subject: '数学', title: '', date: formatInTimeZone(date, timezone, 'yyyy-MM-dd'),
    start: time(start), end: time(Math.min(start + 60, 23 * 60)) };
}

export function validatePlan(draft: PlanDraft, timezone: string):
  { ok: true; values: PlanValues } | { ok: false; error: string } {
  const fail = (error: string) => ({ ok: false as const, error });
  if (!subjects.includes(draft.subject)) return fail('请选择科目。');
  const title = draft.title.trim();
  if (Array.from(title).length > 100) return fail('标题最多100字。');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || draft.date.startsWith('0000-')) {
    return fail('日期请填写为 YYYY-MM-DD，例如2026-10-22。');
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.end)) {
    return fail('时间请填写为 HH:mm，例如09:00。');
  }
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const startMinute = minutes(draft.start), endMinute = minutes(draft.end);
  if (startMinute < 480 || endMinute > 1380 || endMinute <= startMinute) {
    return fail('请选择同一天08:00至23:00内的时间，结束须晚于开始。');
  }
  if (endMinute - startMinute < 15) return fail('学习计划至少15分钟。');
  try {
    if (timezone !== 'UTC' && !timezone.includes('/')) return fail('无法识别计划时区，请重新打开计划。');
    const start = fromZonedTime(`${draft.date}T${draft.start}:00`, timezone);
    const end = fromZonedTime(`${draft.date}T${draft.end}:00`, timezone);
    if (formatInTimeZone(start, timezone, 'yyyy-MM-dd HH:mm') !== `${draft.date} ${draft.start}` ||
        formatInTimeZone(end, timezone, 'yyyy-MM-dd HH:mm') !== `${draft.date} ${draft.end}`) {
      return fail('日期或当地时间无效，请检查后重试。');
    }
    if (end.getTime() - start.getTime() < 15 * 60_000) return fail('实际学习时间至少15分钟。');
    return { ok: true, values: { subject: draft.subject, title: title || null,
      start_at: start.toISOString(), end_at: end.toISOString() } };
  } catch {
    return fail('日期或计划时区无效，请检查后重试。');
  }
}

export function overlaps(a: Pick<Plan, 'start_at' | 'end_at'>, b: Pick<Plan, 'start_at' | 'end_at'>) {
  return Date.parse(a.start_at) < Date.parse(b.end_at) && Date.parse(a.end_at) > Date.parse(b.start_at);
}

export function planErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  if (code === 'PGRST116') return '计划已变化或无法修改，请刷新时间表后重试。';
  if (code === '42501' || code === 'PGRST301') return '账号无权进行此操作，请重新登录后重试。';
  if (code === '23514' || code === '22007') return '计划内容不符合要求，请检查日期、时间和标题。';
  return '操作未完成，请检查网络后重试。已填写的内容会保留。';
}
