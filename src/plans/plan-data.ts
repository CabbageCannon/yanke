import type { SupabaseClient } from '@supabase/supabase-js';
import type { GeofenceFields } from '../geofence/domain.ts';

import type { Plan, PlanValues } from './plan-domain.ts';

export const planColumns = 'id,user_id,subject,title,start_at,end_at,timezone,status,summary,geofence_enabled,geofence_name,geofence_lat,geofence_lng,geofence_radius';

export async function loadPlans(client: SupabaseClient, userId: string, from: string, to: string): Promise<Plan[]> {
  const { data, error } = await client.from('plans').select(planColumns).eq('user_id', userId)
    .neq('status', 'deleted').lt('start_at', to).gt('end_at', from).order('start_at').order('id');
  if (error) throw error;
  return data as Plan[];
}

export async function savePlan(client: SupabaseClient, userId: string, id: string, values: PlanValues & GeofenceFields,
  timezone: string, create: boolean): Promise<{ plan: Plan; overlap: boolean }> {
  const conflict = await client.from('plans').select('id').eq('user_id', userId).neq('status', 'deleted')
    .neq('id', id).lt('start_at', values.end_at).gt('end_at', values.start_at).limit(1);
  if (conflict.error) throw conflict.error;
  if (create) {
    const inserted = await client.from('plans').insert({ ...values, id, user_id: userId, timezone })
      .select(planColumns).single();
    if (!inserted.error) return { plan: inserted.data as Plan, overlap: !!conflict.data?.length };
    // Retry the same UUID after an uncertain response without creating a second plan.
    if (inserted.error.code !== '23505') throw inserted.error;
  }
  const updated = await client.from('plans').update(values).eq('id', id).eq('user_id', userId)
    .neq('status', 'deleted').select(planColumns).single();
  if (updated.error) throw updated.error;
  return { plan: updated.data as Plan, overlap: !!conflict.data?.length };
}

export async function deletePlan(client: SupabaseClient, userId: string, id: string): Promise<Plan> {
  const { data, error } = await client.from('plans').update({ status: 'deleted' })
    .eq('id', id).eq('user_id', userId).select(planColumns).single();
  if (error) throw error;
  return data as Plan;
}
