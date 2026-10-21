-- Canonical initial migration. docs/schema.sql is an exact copy; see docs/database.md.
-- Foundation only: check-in/completion RPC rules are intentionally not implemented.
begin;

create function public.is_iana_timezone(value text)
returns boolean
language sql stable strict
set search_path = ''
as $$
  select exists (
    select 1 from pg_catalog.pg_timezone_names
    where name = value
      and (name = 'UTC' or name like '%/%')
      and name not like 'posix/%' and name not like 'right/%'
  );
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text check (nickname is null or (btrim(nickname) <> '' and char_length(nickname) <= 50)),
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (subject in ('数学', '英语', '政治', '专业课', '其他')),
  title text check (title is null or (btrim(title) <> '' and char_length(title) <= 100)),
  start_at timestamptz not null,
  end_at timestamptz not null,
  timezone text not null default 'Asia/Shanghai' check (public.is_iana_timezone(timezone)),
  geofence_enabled boolean not null default false,
  geofence_name text,
  geofence_lat double precision,
  geofence_lng double precision,
  geofence_radius integer,
  status text not null default 'pending' check (status in ('pending', 'completed', 'missed', 'deleted')),
  summary text check (summary is null or char_length(summary) <= 2000),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint plans_time_window check (
    isfinite(start_at) and isfinite(end_at)
    and end_at >= start_at + interval '15 minutes'
    and (start_at at time zone timezone)::date = (end_at at time zone timezone)::date
    and (start_at at time zone timezone)::time >= time '08:00'
    and (end_at at time zone timezone)::time <= time '23:00'
    and (start_at at time zone timezone)::time < (end_at at time zone timezone)::time
  ),
  constraint plans_geofence check (
    (
      not geofence_enabled
      and geofence_name is null and geofence_lat is null
      and geofence_lng is null and geofence_radius is null
    ) or (
      geofence_enabled
      and geofence_name is not null and btrim(geofence_name) <> '' and char_length(geofence_name) <= 120
      and geofence_lat is not null and geofence_lat between -90 and 90
      and geofence_lng is not null and geofence_lng between -180 and 180
      and geofence_radius is not null and geofence_radius between 50 and 1000
    )
  )
);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  checked_at timestamptz not null default now() check (isfinite(checked_at)),
  type text not null check (type in ('normal', 'late', 'makeup')),
  duration_minutes integer not null check (duration_minutes >= 0),
  -- Snapshots keep history stable when a plan is edited or soft-deleted.
  subject text not null check (subject in ('数学', '英语', '政治', '专业课', '其他')),
  plan_start_at timestamptz not null,
  plan_end_at timestamptz not null,
  plan_timezone text not null check (public.is_iana_timezone(plan_timezone)),
  study_date date generated always as ((plan_start_at at time zone plan_timezone)::date) stored,
  created_at timestamptz not null default now(),
  foreign key (plan_id, user_id) references public.plans(id, user_id) on delete cascade
);

create function public.snapshot_checkin_plan()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if row(new.plan_id, new.user_id, new.subject, new.plan_start_at, new.plan_end_at, new.plan_timezone)
       is distinct from
       row(old.plan_id, old.user_id, old.subject, old.plan_start_at, old.plan_end_at, old.plan_timezone) then
      raise check_violation using message = 'Check-in plan snapshots cannot be changed';
    end if;
    return new;
  end if;

  select p.subject, p.start_at, p.end_at, p.timezone
    into new.subject, new.plan_start_at, new.plan_end_at, new.plan_timezone
    from public.plans p where p.id = new.plan_id and p.user_id = new.user_id;
  if not found then
    raise foreign_key_violation using message = 'Check-in must reference a plan owned by the same user';
  end if;
  return new;
end;
$$;

create trigger snapshot_checkin_plan
before insert or update on public.checkins
for each row execute function public.snapshot_checkin_plan();

create index plans_user_start_idx on public.plans (user_id, start_at);
create index checkins_user_study_date_idx on public.checkins (user_id, study_date);

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.checkins enable row level security;

create policy profiles_select_own on public.profiles
for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy plans_select_own on public.plans
for select to authenticated using ((select auth.uid()) = user_id);
create policy plans_insert_own on public.plans
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy plans_update_own on public.plans
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy checkins_select_own on public.checkins
for select to authenticated using ((select auth.uid()) = user_id);

create view public.v_user_daily_stats with (security_invoker = true) as
with plan_stats as (
  select user_id, (start_at at time zone timezone)::date as study_date,
    count(*) as plan_count,
    count(*) filter (where status = 'completed') as completed_plan_count
  from public.plans where status <> 'deleted'
  group by user_id, (start_at at time zone timezone)::date
), checkin_stats as (
  select user_id, study_date, count(*) as checkin_count, sum(duration_minutes) as total_minutes
  from public.checkins group by user_id, study_date
)
select coalesce(p.user_id, c.user_id) as user_id,
  coalesce(p.study_date, c.study_date) as study_date,
  coalesce(p.plan_count, 0) as plan_count,
  coalesce(p.completed_plan_count, 0) as completed_plan_count,
  case when p.plan_count > 0 then p.completed_plan_count::numeric / p.plan_count end as completion_rate,
  coalesce(c.checkin_count, 0) as checkin_count,
  coalesce(c.total_minutes, 0) as total_minutes
from plan_stats p full join checkin_stats c using (user_id, study_date);

create view public.v_user_daily_subject_stats with (security_invoker = true) as
select user_id, study_date, subject, count(*) as checkin_count, sum(duration_minutes) as total_minutes
from public.checkins group by user_id, study_date, subject;

-- Supabase default privileges can grant broad table/function access; replace them explicitly.
revoke all on public.profiles, public.plans, public.checkins,
  public.v_user_daily_stats, public.v_user_daily_subject_stats from public, anon, authenticated;
revoke all on function public.is_iana_timezone(text), public.handle_new_user(),
  public.snapshot_checkin_plan() from public, anon, authenticated;

grant usage on schema public to authenticated, service_role;
grant select on public.profiles, public.plans, public.checkins,
  public.v_user_daily_stats, public.v_user_daily_subject_stats to authenticated;
grant update (nickname) on public.profiles to authenticated;
grant insert (id, user_id, subject, title, start_at, end_at, timezone,
  geofence_enabled, geofence_name, geofence_lat, geofence_lng, geofence_radius, status, summary)
  on public.plans to authenticated;
grant update (subject, title, start_at, end_at,
  geofence_enabled, geofence_name, geofence_lat, geofence_lng, geofence_radius, status, summary)
  on public.plans to authenticated;
grant execute on function public.is_iana_timezone(text) to authenticated, service_role;
grant all on public.profiles, public.plans, public.checkins,
  public.v_user_daily_stats, public.v_user_daily_subject_stats to service_role;

commit;
