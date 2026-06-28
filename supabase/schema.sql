create extension if not exists pgcrypto;

create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  reps integer not null check (reps > 0),
  sets integer not null check (sets > 0),
  set_groups jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0
);

create table if not exists public.routine_schedule (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  is_active boolean not null default true,
  unique (routine_id, weekday)
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid references public.routines(id) on delete set null,
  title text,
  scheduled_date date not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'completed' check (status in ('started', 'completed'))
);

create table if not exists public.workout_exercise_logs (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
  routine_exercise_id uuid references public.routine_exercises(id) on delete set null,
  name text not null,
  planned_reps integer not null check (planned_reps > 0),
  planned_sets integer not null check (planned_sets > 0),
  planned_set_groups jsonb,
  actual_reps integer not null check (actual_reps > 0),
  actual_sets integer not null check (actual_sets > 0),
  actual_set_groups jsonb,
  notes text
);

alter table public.workout_sessions
add column if not exists title text;

alter table public.routine_exercises
add column if not exists set_groups jsonb not null default '[]'::jsonb;

alter table public.workout_exercise_logs
add column if not exists planned_set_groups jsonb;

alter table public.workout_exercise_logs
add column if not exists actual_set_groups jsonb;

update public.routine_exercises
set set_groups = jsonb_build_array(jsonb_build_object('reps', reps, 'sets', sets))
where set_groups = '[]'::jsonb;

update public.workout_exercise_logs
set planned_set_groups = jsonb_build_array(jsonb_build_object('reps', planned_reps, 'sets', planned_sets))
where planned_set_groups is null;

update public.workout_exercise_logs
set actual_set_groups = jsonb_build_array(jsonb_build_object('reps', actual_reps, 'sets', actual_sets))
where actual_set_groups is null;

create index if not exists routines_user_id_idx on public.routines(user_id);
create index if not exists routine_exercises_routine_id_idx on public.routine_exercises(routine_id);
create index if not exists routine_schedule_routine_id_idx on public.routine_schedule(routine_id);
create index if not exists workout_sessions_user_id_idx on public.workout_sessions(user_id);
create index if not exists workout_exercise_logs_session_id_idx on public.workout_exercise_logs(workout_session_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists routines_set_updated_at on public.routines;
create trigger routines_set_updated_at
before update on public.routines
for each row
execute function public.set_updated_at();

alter table public.routines enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.routine_schedule enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_exercise_logs enable row level security;

drop policy if exists "Users manage their routines" on public.routines;
create policy "Users manage their routines"
on public.routines
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage their routine exercises" on public.routine_exercises;
create policy "Users manage their routine exercises"
on public.routine_exercises
for all
using (
  exists (
    select 1 from public.routines
    where routines.id = routine_exercises.routine_id
      and routines.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.routines
    where routines.id = routine_exercises.routine_id
      and routines.user_id = auth.uid()
  )
);

drop policy if exists "Users manage their routine schedule" on public.routine_schedule;
create policy "Users manage their routine schedule"
on public.routine_schedule
for all
using (
  exists (
    select 1 from public.routines
    where routines.id = routine_schedule.routine_id
      and routines.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.routines
    where routines.id = routine_schedule.routine_id
      and routines.user_id = auth.uid()
  )
);

drop policy if exists "Users manage their workout sessions" on public.workout_sessions;
create policy "Users manage their workout sessions"
on public.workout_sessions
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users manage their workout logs" on public.workout_exercise_logs;
create policy "Users manage their workout logs"
on public.workout_exercise_logs
for all
using (
  exists (
    select 1 from public.workout_sessions
    where workout_sessions.id = workout_exercise_logs.workout_session_id
      and workout_sessions.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.workout_sessions
    where workout_sessions.id = workout_exercise_logs.workout_session_id
      and workout_sessions.user_id = auth.uid()
  )
);
