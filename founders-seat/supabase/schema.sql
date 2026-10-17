-- Founder's Seat: player tracking schema (run once in the Supabase SQL editor)

create table if not exists public.players (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  institution text,
  created_at timestamptz not null default now(),
  last_seen timestamptz
);

create table if not exists public.logins (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default ((now() at time zone 'Asia/Kolkata')::date),
  created_at timestamptz not null default now(),
  unique (user_id, day)
);

create table if not exists public.games (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  seed int,
  archetype text,
  month int not null default 1,
  outcome text,
  founder_outcome numeric,
  decision_quality numeric,
  finished boolean not null default false,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

alter table public.players enable row level security;
alter table public.logins enable row level security;
alter table public.games enable row level security;

drop policy if exists "own player row" on public.players;
create policy "own player row" on public.players for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "own logins" on public.logins;
create policy "own logins" on public.logins for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own games" on public.games;
create policy "own games" on public.games for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Create the player row automatically at sign-up
create or replace function public.handle_new_player() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.players (id, email, name, institution, last_seen)
  values (new.id, new.email, new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'institution', now())
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_player();

-- Daily summary (visible in the Supabase table editor)
create or replace view public.daily_stats with (security_invoker = true) as
with days as (
  select day from public.logins
  union select (created_at at time zone 'Asia/Kolkata')::date from public.players
  union select (started_at at time zone 'Asia/Kolkata')::date from public.games
)
select d.day,
  (select count(*) from public.players p where (p.created_at at time zone 'Asia/Kolkata')::date = d.day) as new_signups,
  (select count(distinct l.user_id) from public.logins l where l.day = d.day) as players_logged_in,
  (select count(*) from public.games g where (g.started_at at time zone 'Asia/Kolkata')::date = d.day) as games_started,
  (select count(*) from public.games g where g.finished and (g.updated_at at time zone 'Asia/Kolkata')::date = d.day) as games_finished
from days d order by d.day desc;
revoke all on public.daily_stats from anon, authenticated;

-- Admin stats for the /admin page: only the owner's account can call it
create or replace function public.admin_stats() returns json
language plpgsql security definer set search_path = public as $$
declare r json;
begin
  if coalesce(auth.jwt()->>'email', '') <> 'kohinoor.mukherjee64@gmail.com' then
    raise exception 'not authorised';
  end if;
  select json_build_object(
    'totals', json_build_object(
      'players', (select count(*) from players),
      'logins', (select count(*) from logins),
      'games', (select count(*) from games),
      'finished', (select count(*) from games where finished),
      'active_7d', (select count(distinct user_id) from logins where day > (now() at time zone 'Asia/Kolkata')::date - 7)
    ),
    'daily', (select coalesce(json_agg(s), '[]'::json) from (select * from daily_stats limit 120) s),
    'players', (select coalesce(json_agg(p), '[]'::json) from (
      select pl.name, pl.email, pl.institution, pl.created_at, pl.last_seen,
        (select count(*) from logins l where l.user_id = pl.id) as days_active,
        (select count(*) from games g where g.user_id = pl.id) as games,
        (select max(g.founder_outcome) from games g where g.user_id = pl.id and g.finished) as best_outcome
      from players pl order by pl.last_seen desc nulls last limit 500) p)
  ) into r;
  return r;
end $$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
