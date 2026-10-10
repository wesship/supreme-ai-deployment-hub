-- Make Data API privileges match the RLS access model instead of relying on RLS alone.
begin;

revoke all privileges on table public.ai_films from anon, authenticated;
grant select on table public.ai_films to anon, authenticated;

revoke all privileges on table public.ai_film_transcript_chunks from anon, authenticated;
grant select on table public.ai_film_transcript_chunks to authenticated;

revoke all privileges on table public.ai_film_library from anon, authenticated;
grant select, insert, update, delete on table public.ai_film_library to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'ai_film_projects',
    'ai_film_assets',
    'ai_film_entities',
    'ai_film_relationships',
    'ai_film_canon_rules',
    'ai_film_scenes',
    'ai_film_scene_assets',
    'ai_film_asset_versions',
    'ai_film_reviews',
    'ai_film_review_comments',
    'ai_film_release_checklists',
    'ai_film_render_jobs',
    'ai_film_storyboards',
    'ai_film_shots',
    'ai_film_render_attempts',
    'ai_film_export_jobs',
    'ai_film_subtitle_tracks',
    'ai_film_publications',
    'ai_film_collaborators',
    'ai_film_activity_events',
    'ai_film_analytics_snapshots',
    'ai_film_commercial_releases'
  ]
  loop
    execute format(
      'revoke all privileges on table public.%I from anon, authenticated',
      table_name
    );
    execute format(
      'grant select, insert, update, delete on table public.%I to authenticated',
      table_name
    );
  end loop;
end
$$;

notify pgrst, 'reload schema';
commit;
