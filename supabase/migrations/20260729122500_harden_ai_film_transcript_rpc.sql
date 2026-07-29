-- Restrict transcript retrieval to authenticated callers and pin object lookup.
begin;

revoke all on function public.match_ai_film_transcript(vector, text, integer)
from public, anon;

grant execute on function public.match_ai_film_transcript(vector, text, integer)
to authenticated, service_role;

alter function public.match_ai_film_transcript(vector, text, integer)
  set search_path = pg_catalog, public, extensions;

-- Trigger functions do not need to be directly callable through the Data API.
revoke all on function public.ai_film_touch_updated_at()
from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
