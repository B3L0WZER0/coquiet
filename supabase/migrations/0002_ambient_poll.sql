-- The one-time Ambient room question: gently moving landscapes, or still ones.
-- Run this in the Supabase SQL editor (project ref plozfyhpspmtmadqgszv).

create table if not exists public.ambient_votes (
  -- A random id kept in the voter's browser, so a retry or a second tab
  -- changes one vote rather than adding another.
  voter text primary key,
  choice text not null check (choice in ('moving', 'still')),
  -- The scene on screen when they answered.
  scene text,
  created_at timestamptz not null default now()
);

-- RLS on with no policies: nobody reads or writes the table directly. Votes
-- arrive only through the function below, which also means PostgREST's
-- internal RETURNING never meets a missing select policy (see 0001).
alter table public.ambient_votes enable row level security;

create or replace function public.cast_ambient_vote(p_voter text, p_choice text, p_scene text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.ambient_votes (voter, choice, scene)
  values (left(p_voter, 64), p_choice, left(p_scene, 16))
  on conflict (voter) do update set choice = excluded.choice, scene = excluded.scene;
$$;

grant execute on function public.cast_ambient_vote(text, text, text) to public;

-- The result, for the SQL editor:
--   select choice, count(*) from ambient_votes group by choice;
