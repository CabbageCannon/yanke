-- Trusted writes use server time; the client supplies only a self-discipline geofence result.
begin;

create function public.check_in_plan(p_plan_id uuid, p_geofence_verified boolean default false)
returns public.checkins
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_plan public.plans;
  v_checkin public.checkins;
  v_now timestamptz;
  v_type text;
  v_minutes integer;
begin
  if v_user is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  select * into v_plan from public.plans
    where id = p_plan_id and user_id = v_user and status <> 'deleted' for update;
  if not found then
    raise no_data_found using message = 'Plan not found';
  end if;

  -- Return the original result even after its window closes; never recalculate a replay.
  select * into v_checkin from public.checkins where plan_id = v_plan.id;
  if found then return v_checkin; end if;

  v_now := pg_catalog.clock_timestamp();
  if v_now < v_plan.start_at - interval '15 minutes' or v_now >= v_plan.end_at then
    raise invalid_parameter_value using message = 'Outside real-time check-in window';
  end if;
  if v_plan.geofence_enabled and p_geofence_verified is distinct from true then
    raise invalid_parameter_value using message = 'Geofence confirmation required';
  end if;

  if v_now <= v_plan.start_at then
    v_type := 'normal';
    v_minutes := floor(extract(epoch from (v_plan.end_at - v_plan.start_at)) / 60)::integer;
  else
    v_type := 'late';
    v_minutes := floor(extract(epoch from (v_plan.end_at - v_now)) / 60)::integer;
  end if;

  insert into public.checkins (plan_id, user_id, checked_at, type, duration_minutes)
    values (v_plan.id, v_user, v_now, v_type, v_minutes) returning * into v_checkin;
  return v_checkin;
end;
$$;

-- Numeric deliberately rejects fractions and non-finite values before casting to integer.
create function public.makeup_plan(p_plan_id uuid, p_duration_minutes numeric, p_summary text default null)
returns public.checkins
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_plan public.plans;
  v_checkin public.checkins;
  v_now timestamptz;
  v_summary text;
begin
  if v_user is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  if p_duration_minutes is null or p_duration_minutes::text in ('NaN', 'Infinity', '-Infinity')
    or p_duration_minutes < 1 or p_duration_minutes > 1440
    or p_duration_minutes <> trunc(p_duration_minutes) then
    raise invalid_parameter_value using message = 'Makeup duration must be an integer from 1 to 1440';
  end if;

  select * into v_plan from public.plans
    where id = p_plan_id and user_id = v_user and status <> 'deleted' for update;
  if not found then
    raise no_data_found using message = 'Plan not found';
  end if;
  if exists (select 1 from public.checkins where plan_id = v_plan.id) then
    raise unique_violation using message = 'Plan already has a check-in';
  end if;

  v_now := pg_catalog.clock_timestamp();
  if v_now < v_plan.end_at or v_now > v_plan.end_at + interval '168 hours' then
    raise invalid_parameter_value using message = 'Outside makeup window';
  end if;

  -- Match whitespace trimming in the client, including full-width spaces.
  v_summary := nullif(btrim(p_summary, E' \t\n\r\f' ||
    U&'\000B\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'), '');
  if char_length(v_summary) > 2000 then
    raise invalid_parameter_value using message = 'Summary exceeds 2000 characters';
  end if;

  insert into public.checkins (plan_id, user_id, checked_at, type, duration_minutes)
    values (v_plan.id, v_user, v_now, 'makeup', p_duration_minutes::integer) returning * into v_checkin;
  if p_summary is not null then
    update public.plans set summary = v_summary where id = v_plan.id;
  end if;
  return v_checkin;
end;
$$;

create function public.complete_plan(p_plan_id uuid, p_summary text default null)
returns public.plans
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_plan public.plans;
  v_summary text;
begin
  if v_user is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  select * into v_plan from public.plans
    where id = p_plan_id and user_id = v_user and status <> 'deleted' for update;
  if not found then
    raise no_data_found using message = 'Plan not found';
  end if;

  v_summary := nullif(btrim(p_summary, E' \t\n\r\f' ||
    U&'\000B\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'), '');
  if char_length(v_summary) > 2000 then
    raise invalid_parameter_value using message = 'Summary exceeds 2000 characters';
  end if;

  update public.plans set status = 'completed',
    summary = case when p_summary is null then summary else v_summary end
    where id = v_plan.id returning * into v_plan;
  return v_plan;
end;
$$;

create function public.get_checkin_streak(p_today date)
returns integer
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_streak integer;
begin
  if v_user is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;
  if p_today is null or not isfinite(p_today) then
    raise invalid_parameter_value using message = 'A finite observation date is required';
  end if;

  with days as (
    select distinct study_date from public.checkins
      where user_id = v_user and study_date <= p_today
  ), ranked as (
    select study_date, row_number() over (order by study_date desc) as n from days
  ), anchor as (
    select max(study_date) as day from days
  )
  select count(*)::integer into v_streak from ranked cross join anchor
    where anchor.day >= p_today - 1 and ranked.study_date = anchor.day - (ranked.n::integer - 1);
  return v_streak;
end;
$$;

revoke all on function public.check_in_plan(uuid, boolean), public.makeup_plan(uuid, numeric, text),
  public.complete_plan(uuid, text), public.get_checkin_streak(date) from public, anon, authenticated;
grant execute on function public.check_in_plan(uuid, boolean), public.makeup_plan(uuid, numeric, text),
  public.complete_plan(uuid, text), public.get_checkin_streak(date) to authenticated;

commit;
