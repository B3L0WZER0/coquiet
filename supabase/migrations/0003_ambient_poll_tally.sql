-- The Ambient poll's running totals, for the version panel. Counts only: the
-- votes themselves stay unreadable to the public key.
-- Run this in the Supabase SQL editor (project ref plozfyhpspmtmadqgszv).

create or replace function public.ambient_vote_tally()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'moving', count(*) filter (where choice = 'moving'),
    'still', count(*) filter (where choice = 'still')
  )
  from public.ambient_votes;
$$;

grant execute on function public.ambient_vote_tally() to public;
