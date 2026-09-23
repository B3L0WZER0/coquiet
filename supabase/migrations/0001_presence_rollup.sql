-- Server-aggregated presence, replacing client-to-client Realtime Presence
-- gossip (O(N^2) egress) with: clients upsert a heartbeat row, a scheduled
-- job aggregates and broadcasts one small rollup (O(N) egress).
-- Run this in the Supabase SQL editor (project ref plozfyhpspmtmadqgszv).

-- pg_cron is usually enabled via Database -> Extensions in the dashboard.
-- If this statement fails for lack of privilege, enable it there instead and
-- skip this line.
create extension if not exists pg_cron with schema extensions;

create table if not exists public.presence_sessions (
  id text primary key,
  activity text,
  drink text,
  channel text not null,
  last_seen timestamptz not null default now()
);

create index if not exists presence_sessions_last_seen_idx
  on public.presence_sessions (last_seen);

alter table public.presence_sessions enable row level security;

-- Open write, same trust model as today's channel.track(): anyone with the
-- anon key can already claim any session id. No select policy for anon —
-- unlike today, individual visitors' raw activity/drink is no longer
-- readable off the wire, only the aggregate the rollup broadcasts.
create policy "anon can insert presence" on public.presence_sessions
  for insert to anon with check (true);

create policy "anon can update presence" on public.presence_sessions
  for update to anon using (true) with check (true);

create policy "anon can delete presence" on public.presence_sessions
  for delete to anon using (true);

-- Keep this in the same unit as EXPIRY_MS in src/lib/presence/aggregate.ts.
create or replace function public.presence_rollup() returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
begin
  delete from public.presence_sessions where last_seen < now() - interval '75 seconds';

  select jsonb_build_object(
    'count', count(*),
    'activities', jsonb_build_object(
      'working', count(*) filter (where activity = 'working'),
      'studying', count(*) filter (where activity = 'studying'),
      'reading', count(*) filter (where activity = 'reading'),
      'creating', count(*) filter (where activity = 'creating')
    ),
    'drinks', jsonb_build_object(
      'coffee', count(*) filter (where drink = 'coffee'),
      'tea', count(*) filter (where drink = 'tea'),
      'water', count(*) filter (where drink = 'water')
    )
  )
  into payload
  from public.presence_sessions;

  -- `false` = public broadcast, no RLS on realtime.messages needed for anon
  -- subscribers to receive it.
  perform realtime.send(payload, 'pulse', 'coquiet:pulse', false);
end;
$$;

-- pg_cron's sub-minute ('N seconds') schedules need a recent-enough pg_cron
-- version. If this errors, fall back to the commented '* * * * *' line below
-- (every 1 minute) and raise HEARTBEAT_MS's effective staleness accordingly.
select cron.schedule('presence-rollup', '15 seconds', $$select public.presence_rollup();$$);
-- select cron.schedule('presence-rollup', '* * * * *', $$select public.presence_rollup();$$);
