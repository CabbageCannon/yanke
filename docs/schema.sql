-- 研刻 YanKe 数据库结构 v0.1（Supabase / Postgres）

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  nickname text,
  created_at timestamptz default now()
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  subject text not null,
  title text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  repeat_rule jsonb,                -- null | {type:'weekly', weekday:1..7}
  geofence_enabled boolean default false,
  geofence_name text,
  geofence_lat float8,
  geofence_lng float8,
  geofence_radius int default 200,
  status text default 'pending',    -- pending/completed/missed/deleted
  summary text,
  created_at timestamptz default now(),
  constraint end_after_start check (end_at > start_at)
);

create table checkins (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  checked_at timestamptz not null,
  type text not null,               -- normal/late/makeup
  duration_minutes int not null,
  created_at timestamptz default now()
);

create index idx_plans_user_start on plans(user_id, start_at);
create index idx_checkins_user on checkins(user_id, checked_at);

-- RLS
alter table profiles enable row level security;
alter table plans enable row level security;
alter table checkins enable row level security;

create policy "own profile" on profiles
  for all using (auth.uid() = id);

create policy "own plans" on plans
  for all using (auth.uid() = user_id);

create policy "own checkins" on checkins
  for all using (auth.uid() = user_id);

-- 统计视图（后台用）
create view v_user_stats as
select p.user_id,
       count(distinct p.id) as plan_count,
       count(c.id) as checkin_count,
       coalesce(sum(c.duration_minutes), 0) as total_minutes
from plans p
left join checkins c on c.plan_id = p.id
group by p.user_id;

-- 第二周（不在第一周执行）
-- friendships(id, requester_id, addressee_id, status, created_at)
-- posts(id, user_id, content, image_url, visibility default 'friends', created_at)
-- comments(id, post_id, user_id, content, created_at)
-- notifications(id, user_id, type, payload jsonb, read boolean, created_at)