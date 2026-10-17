-- Founder's Seat v3: paywall (7-day free trial, then a one-time ₹269 unlock), Google sign-in names, owner tools.
-- Safe to run more than once in the Supabase SQL editor.

-- Google accounts send full_name rather than name
create or replace function public.handle_new_player() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.players (id, email, name, institution, last_seen)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
          new.raw_user_meta_data->>'institution', now())
  on conflict (id) do nothing;
  return new;
end $$;

-- Players may update only their own name, college and last-seen time
revoke update on public.players from authenticated;
grant update (name, institution, last_seen) on public.players to authenticated;

-- One row per checkout attempt. Only the payment edge function writes here (service role).
create table if not exists public.payments (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant_order_id text not null unique,
  amount_paise int not null,
  status text not null default 'PENDING',          -- PENDING, COMPLETED, FAILED, MISMATCH
  phonepe_order_id text,
  provider_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payments enable row level security;
drop policy if exists "read own payments" on public.payments;
create policy "read own payments" on public.payments for select to authenticated using (user_id = auth.uid());

-- Free access for programmes (cohort licences, pilots, reviewers). Managed by the owner from /admin.
create table if not exists public.access_grants (
  email text primary key,
  note text,
  granted_at timestamptz not null default now()
);
alter table public.access_grants enable row level security;

-- Settings in one place
create table if not exists public.app_settings (key text primary key, value text not null);
alter table public.app_settings enable row level security;
insert into public.app_settings (key, value) values
  ('owner_email', 'kohinoor.mukherjee64@gmail.com'),
  ('trial_days', '7'),
  ('price_inr', '269')
on conflict (key) do nothing;

create or replace function public.setting(k text) returns text
language sql stable security definer set search_path = public as $$ select value from app_settings where key = k $$;
revoke all on function public.setting(text) from public, anon, authenticated;

-- What the game calls on start: may this player play, and why
create or replace function public.my_access() returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  em text := lower(coalesce(auth.jwt()->>'email', ''));
  created timestamptz; trial_end timestamptz; is_paid boolean; is_granted boolean; st text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select u.created_at into created from auth.users u where u.id = uid;
  trial_end := coalesce(created, now()) + make_interval(days => setting('trial_days')::int);
  is_paid := exists (select 1 from payments where user_id = uid and status = 'COMPLETED');
  is_granted := em = lower(setting('owner_email')) or exists (select 1 from access_grants where lower(email) = em);
  st := case when is_granted then 'granted' when is_paid then 'paid' when now() < trial_end then 'trial' else 'expired' end;
  return json_build_object('access', st <> 'expired', 'status', st, 'trial_ends_at', trial_end,
                           'price_inr', setting('price_inr')::int, 'trial_days', setting('trial_days')::int);
end $$;
revoke all on function public.my_access() from public, anon;
grant execute on function public.my_access() to authenticated;

-- Owner-only helpers
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select lower(coalesce(auth.jwt()->>'email', '')) = lower(setting('owner_email')) $$;

create or replace function public.admin_grant(p_email text, p_note text default null, p_remove boolean default false) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'not authorised'; end if;
  if p_remove then delete from access_grants where lower(email) = lower(trim(p_email));
  else insert into access_grants (email, note) values (lower(trim(p_email)), p_note)
       on conflict (email) do update set note = excluded.note; end if;
  return (select coalesce(json_agg(g order by g.granted_at desc), '[]'::json) from access_grants g);
end $$;
revoke all on function public.admin_grant(text, text, boolean) from public, anon;
grant execute on function public.admin_grant(text, text, boolean) to authenticated;

-- Stats for /admin, now with payments and access status
create or replace function public.admin_stats() returns json
language plpgsql security definer set search_path = public as $$
declare r json;
begin
  if not is_owner() then raise exception 'not authorised'; end if;
  select json_build_object(
    'totals', json_build_object(
      'players', (select count(*) from players),
      'logins', (select count(*) from logins),
      'games', (select count(*) from games),
      'finished', (select count(*) from games where finished),
      'active_7d', (select count(distinct user_id) from logins where day > (now() at time zone 'Asia/Kolkata')::date - 7),
      'paid', (select count(distinct user_id) from payments where status = 'COMPLETED'),
      'revenue_inr', (select coalesce(sum(amount_paise), 0) / 100 from payments where status = 'COMPLETED'),
      'in_trial', (select count(*) from auth.users u where u.created_at > now() - make_interval(days => setting('trial_days')::int))
    ),
    'daily', (select coalesce(json_agg(s), '[]'::json) from (select * from daily_stats limit 120) s),
    'players', (select coalesce(json_agg(p), '[]'::json) from (
      select pl.name, pl.email, pl.institution, pl.created_at, pl.last_seen,
        (select count(*) from logins l where l.user_id = pl.id) as days_active,
        (select count(*) from games g where g.user_id = pl.id) as games,
        (select max(g.founder_outcome) from games g where g.user_id = pl.id and g.finished) as best_outcome,
        (select coalesce(u.raw_app_meta_data->>'provider', 'email') from auth.users u where u.id = pl.id) as provider,
        case
          when lower(pl.email) = lower(setting('owner_email')) or exists (select 1 from access_grants a where lower(a.email) = lower(pl.email)) then 'granted'
          when exists (select 1 from payments y where y.user_id = pl.id and y.status = 'COMPLETED') then 'paid'
          when (select u.created_at from auth.users u where u.id = pl.id) > now() - make_interval(days => setting('trial_days')::int) then 'trial'
          else 'expired' end as access
      from players pl order by pl.last_seen desc nulls last limit 500) p),
    'payments', (select coalesce(json_agg(x), '[]'::json) from (
      select y.merchant_order_id, y.amount_paise / 100 as amount_inr, y.status, y.created_at, pl.email
      from payments y left join players pl on pl.id = y.user_id order by y.created_at desc limit 200) x),
    'grants', (select coalesce(json_agg(g order by g.granted_at desc), '[]'::json) from access_grants g)
  ) into r;
  return r;
end $$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
