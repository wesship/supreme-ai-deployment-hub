-- AI Films controlled rollout hardening.
-- Keeps the companion disabled by default and narrows transcript RPC access.

insert into public.feature_flags (key, enabled, description, active)
values (
  'ai_film_companion',
  false,
  'Enable the authenticated D3VONN AI Film Companion experience',
  true
)
on conflict (key) do update
set description = excluded.description,
    active = true,
    updated_at = now();

-- Authenticated users may retrieve transcript matches through RLS.
-- Anonymous callers must not execute the transcript matching function directly.
revoke execute on function public.match_ai_film_transcript(vector, text, integer) from anon;
grant execute on function public.match_ai_film_transcript(vector, text, integer) to authenticated;

-- Do not expose unpublished film records to every authenticated user.
drop policy if exists "Published films are publicly readable" on public.ai_films;
create policy "Published films are publicly readable"
  on public.ai_films
  for select
  to authenticated, anon
  using (published = true);

comment on function public.match_ai_film_transcript(vector, text, integer)
is 'Authenticated, RLS-governed semantic retrieval for approved published AI Film transcripts.';
