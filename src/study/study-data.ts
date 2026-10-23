import type { SupabaseClient } from '@supabase/supabase-js';

import { planColumns } from '../plans/plan-data.ts';
import type { Plan } from '../plans/plan-domain.ts';
import { aggregateStats, type CheckIn, type DailyStats, type SubjectStats } from './study-domain.ts';

export async function loadStudyPlan(client: SupabaseClient, userId: string, id: string) {
  const [plan, checkin] = await Promise.all([
    client.from('plans').select(planColumns).eq('user_id', userId).eq('id', id).neq('status', 'deleted').single(),
    client.from('checkins').select('id,plan_id,type,duration_minutes,study_date,checked_at')
      .eq('user_id', userId).eq('plan_id', id).maybeSingle(),
  ]);
  if (plan.error) throw plan.error;
  if (checkin.error) throw checkin.error;
  return { plan: plan.data as Plan, checkin: checkin.data as CheckIn | null };
}

// Composite RPC results are PostgREST arrays unless single() requests an object.
export async function checkInPlan(client: SupabaseClient, id: string): Promise<CheckIn> {
  const { data, error } = await client.rpc('check_in_plan', { p_plan_id: id, p_geofence_verified: false }).single();
  if (error) throw error;
  return data as CheckIn;
}

export async function makeupPlan(client: SupabaseClient, id: string, minutes: number, summary: string | null): Promise<CheckIn> {
  const { data, error } = await client.rpc('makeup_plan', { p_plan_id: id, p_duration_minutes: minutes, p_summary: summary }).single();
  if (error) throw error;
  return data as CheckIn;
}

export async function completePlan(client: SupabaseClient, id: string, summary: string | null): Promise<Plan> {
  const { data, error } = await client.rpc('complete_plan', { p_plan_id: id, p_summary: summary }).single();
  if (error) throw error;
  return data as Plan;
}

export async function loadStudyStats(client: SupabaseClient, userId: string, today: string,
  range: { from: string; to: string } | null) {
  // Page through dates so cumulative history is not silently capped by PostgREST.
  async function rows<T>(view: string, columns: string, bySubject = false): Promise<T[]> {
    const result: T[] = [];
    for (let offset = 0; ; offset += 500) {
      let query = client.from(view).select(columns).eq('user_id', userId).order('study_date');
      if (bySubject) query = query.order('subject');
      if (range) query = query.gte('study_date', range.from).lt('study_date', range.to);
      const { data, error } = await query.range(offset, offset + 499);
      if (error) throw error;
      result.push(...data as T[]);
      if (data.length < 500) return result;
    }
  }
  const [daily, bySubject, streak] = await Promise.all([
    rows<DailyStats>('v_user_daily_stats', 'study_date,plan_count,completed_plan_count,total_minutes'),
    rows<SubjectStats>('v_user_daily_subject_stats', 'study_date,subject,total_minutes', true),
    client.rpc('get_checkin_streak', { p_today: today }),
  ]);
  if (streak.error) throw streak.error;
  if (!Number.isInteger(streak.data) || streak.data < 0) throw new Error('Invalid streak response');
  return { ...aggregateStats(daily, bySubject), streak: streak.data as number };
}
